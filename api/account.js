// ============================================================
//  ACCOUNTS - username + password, keeps your settings and stats.
//  A Vercel serverless function (this file is served at /api/account). The data lives in an
//  Upstash Redis database connected to the Vercel project (Storage tab -> Upstash -> Redis);
//  connecting it sets KV_REST_API_URL + KV_REST_API_TOKEN for this function.
//  Passwords are never stored: only a salted scrypt hash.
//
//  POST { action: 'ping' }
//  POST { action: 'register', username, password, data }  -> { name, token }
//  POST { action: 'login', username, password }           -> { name, token, data, updated }
//  POST { action: 'load', token }                         -> { name, data, updated }
//  POST { action: 'save', token, data }                   -> { updated }
//  POST { action: 'logout', token }
// ============================================================
const crypto = require('crypto');

const DB_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const DB_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const NAME = /^[A-Za-z0-9_]{3,16}$/;
const SESSION_DAYS = 60;
const MAX_DATA = 64 * 1024;

async function redis(...cmd) {
  const r = await fetch(DB_URL, { method: 'POST', headers: { Authorization: `Bearer ${DB_TOKEN}` }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
const scrypt = (pw, salt) => new Promise((ok, bad) => crypto.scrypt(pw, salt, 32, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? bad(e) : ok(k))));

// too many tries from one place: wait it out (count per key, resets after `secs`)
async function limited(key, max, secs) {
  const n = await redis('INCR', key);
  if (n === 1) await redis('EXPIRE', key, secs);
  return n > max;
}
async function newSession(name) {
  const token = crypto.randomBytes(24).toString('hex');
  await redis('SET', 'sess:' + token, name, 'EX', SESSION_DAYS * 86400);
  return token;
}
async function whoIs(token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{48}$/.test(token)) return null;
  return redis('GET', 'sess:' + token);
}
const userKey = (name) => 'user:' + name.toLowerCase();
async function getUser(name) {
  const raw = await redis('GET', userKey(name));
  return raw ? JSON.parse(raw) : null;
}
function cleanData(d) {
  if (!d || typeof d !== 'object') return {};
  const out = { settings: d.settings && typeof d.settings === 'object' ? d.settings : {}, stats: d.stats && typeof d.stats === 'object' ? d.stats : {} };
  return JSON.stringify(out).length > MAX_DATA ? null : out;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!DB_URL || !DB_TOKEN) return res.status(503).json({ error: 'Accounts are not switched on for this server yet.' });
  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const name = String(b.username || '').trim(), password = String(b.password || '');
  try {
    switch (b.action) {
      case 'ping': return res.json({ ok: true });

      case 'register': {
        if (!NAME.test(name)) return res.status(400).json({ error: 'Usernames are 3-16 letters, numbers or _.' });
        if (password.length < 6 || password.length > 72) return res.status(400).json({ error: 'Passwords need 6-72 characters.' });
        if (await limited('reg:' + ip, 5, 3600)) return res.status(429).json({ error: 'Too many new accounts from here. Try again later.' });
        const data = cleanData(b.data);
        if (!data) return res.status(413).json({ error: 'Too much data.' });
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = (await scrypt(password, salt)).toString('hex');
        const user = { name, salt, hash, data, updated: Date.now(), created: Date.now() };
        const ok = await redis('SET', userKey(name), JSON.stringify(user), 'NX');
        if (ok !== 'OK') return res.status(409).json({ error: 'That username is taken.' });
        return res.json({ name, token: await newSession(name), updated: user.updated });
      }

      case 'login': {
        if (!NAME.test(name) || !password) return res.status(400).json({ error: 'Wrong username or password.' });
        if (await limited('try:' + name.toLowerCase(), 10, 900) || await limited('tryip:' + ip, 30, 900)) {
          return res.status(429).json({ error: 'Too many tries. Wait 15 minutes.' });
        }
        const user = await getUser(name);
        const hash = await scrypt(password, user ? user.salt : 'no-such-user');
        if (!user || !crypto.timingSafeEqual(hash, Buffer.from(user.hash, 'hex'))) return res.status(401).json({ error: 'Wrong username or password.' });
        return res.json({ name: user.name, token: await newSession(user.name), data: user.data, updated: user.updated });
      }

      case 'load': {
        const who = await whoIs(b.token);
        const user = who && (await getUser(who));
        if (!user) return res.status(401).json({ error: 'Logged out.' });
        return res.json({ name: user.name, data: user.data, updated: user.updated });
      }

      case 'save': {
        const who = await whoIs(b.token);
        const user = who && (await getUser(who));
        if (!user) return res.status(401).json({ error: 'Logged out.' });
        if (await limited('save:' + who.toLowerCase(), 60, 600)) return res.status(429).json({ error: 'Saving too often.' });
        const data = cleanData(b.data);
        if (!data) return res.status(413).json({ error: 'Too much data.' });
        user.data = data;
        user.updated = Date.now();
        await redis('SET', userKey(user.name), JSON.stringify(user));
        return res.json({ updated: user.updated });
      }

      case 'logout': {
        if (typeof b.token === 'string' && /^[0-9a-f]{48}$/.test(b.token)) await redis('DEL', 'sess:' + b.token);
        return res.json({ ok: true });
      }

      default: return res.status(400).json({ error: 'Unknown action.' });
    }
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Server error. Try again.' });
  }
};
