// ============================================================
//  ACCOUNTS - one account = one unique name. Keeps your settings, stats, and the colors and
//  cosmetics you've won. A Vercel serverless function (served at /api/account); the data lives in
//  the Upstash Redis database connected to the project (KV_REST_API_URL / KV_REST_API_TOKEN).
//  Passwords are never stored: only a salted scrypt hash.
//
//  POST { action: 'ping' }
//  POST { action: 'check', username }                       -> { ok, problem }
//  POST { action: 'register', username, password, data }    -> profile
//  POST { action: 'login', username, password }             -> profile + data
//  POST { action: 'load', token }                           -> profile + data
//  POST { action: 'save', token, data }                     -> { updated }
//  POST { action: 'claim', token }   (you won a game)       -> { prize, inv, ticket }
//  POST { action: 'verify', ticket } (a host checking a joiner) -> { name, colors, cos, dev }
//  POST { action: 'logout', token }
//  POST { action: 'delete', token, password }  -> deletes the account and everything stored with it
//  profile = { name, token, ticket, inv: { colors: [ids], cos: [ids] }, dev, updated }
//
//  A ticket is a short signed note "this player is <name>". Players hand it to whoever hosts
//  their game, and the host asks this server what that name really owns - so nobody can claim
//  someone else's name or colors they haven't won. It never lets anyone log in as you.
// ============================================================
const crypto = require('crypto');
const ITEMS = require('../js/items.js');

const DB_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const DB_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const SECRET = process.env.TICKET_SECRET || DB_TOKEN || '';
const DEVS = ['archer'];
const SESSION_DAYS = 60;
const TICKET_HOURS = 12;
const MAX_DATA = 64 * 1024;
const CLAIM_GAP = 40;        // seconds between prizes (a round takes longer than this)
const CLAIMS_PER_DAY = 60;

async function redis(...cmd) {
  const r = await fetch(DB_URL, { method: 'POST', headers: { Authorization: `Bearer ${DB_TOKEN}` }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
const scrypt = (pw, salt) => new Promise((ok, bad) => crypto.scrypt(pw, salt, 32, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? bad(e) : ok(k))));
const rnd = () => crypto.randomInt(0, 1e9) / 1e9;

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
const userKey = (name) => 'user:' + String(name).toLowerCase();
async function getUser(name) {
  const raw = await redis('GET', userKey(name));
  if (!raw) return null;
  const u = JSON.parse(raw);
  u.inv = u.inv || { colors: ITEMS.starter(rnd), cos: [] };   // accounts from before prizes existed
  return u;
}
const putUser = (u) => redis('SET', userKey(u.name), JSON.stringify(u));
const isDev = (name) => DEVS.includes(String(name).toLowerCase());

const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
function ticketFor(name) {
  const body = Buffer.from(JSON.stringify({ n: name, e: Date.now() + TICKET_HOURS * 3600e3 })).toString('base64url');
  return body + '.' + sign(body);
}
function readTicket(t) {
  if (typeof t !== 'string' || t.length > 400) return null;
  const [body, sig] = t.split('.');
  if (!body || !sig || sig.length !== sign(body).length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(body)))) return null;
  try { const j = JSON.parse(Buffer.from(body, 'base64url').toString()); return j.e > Date.now() ? j.n : null; } catch (e) { return null; }
}
const profile = (u, token) => ({ name: u.name, token, ticket: ticketFor(u.name), inv: u.inv, dev: isDev(u.name), updated: u.updated });

function cleanData(d) {
  if (!d || typeof d !== 'object') return {};
  const out = { settings: d.settings && typeof d.settings === 'object' ? d.settings : {}, stats: d.stats && typeof d.stats === 'object' ? d.stats : {} };
  return JSON.stringify(out).length > MAX_DATA ? null : out;
}

module.exports = async (req, res) => {
  // tokens travel in the request body (never cookies), so any page may call this - that's how the
  // GitHub Pages copy of the game can use accounts too
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!DB_URL || !DB_TOKEN) return res.status(503).json({ error: 'Accounts are not switched on for this server yet.' });
  let b = req.body || {};
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const name = String(b.username || '').trim().toLowerCase(), password = String(b.password || '');
  try {
    switch (b.action) {
      case 'ping': return res.json({ ok: true });

      case 'check': {
        if (await limited('chk:' + ip, 120, 600)) return res.status(429).json({ error: 'Slow down a little.' });
        const problem = ITEMS.nameProblem(name) || ((await redis('EXISTS', userKey(name))) ? 'That name is taken' : '');
        return res.json({ ok: !problem, problem });
      }

      case 'register': {
        const problem = ITEMS.nameProblem(name);
        if (problem) return res.status(400).json({ error: problem + '.' });
        if (password.length < 6 || password.length > 72) return res.status(400).json({ error: 'Passwords need 6-72 characters.' });
        if (password.toLowerCase() === name.toLowerCase()) return res.status(400).json({ error: 'Your password can\'t be your name.' });
        if (await limited('reg:' + ip, 5, 3600)) return res.status(429).json({ error: 'Too many new accounts from here. Try again later.' });
        const data = cleanData(b.data);
        if (!data) return res.status(413).json({ error: 'Too much data.' });
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = (await scrypt(password, salt)).toString('hex');
        const now = Date.now();
        const user = { name, salt, hash, data, inv: { colors: ITEMS.starter(rnd), cos: [] }, updated: now, created: now };
        const ok = await redis('SET', userKey(name), JSON.stringify(user), 'NX');
        if (ok !== 'OK') return res.status(409).json({ error: 'That name is taken.' });
        return res.json(profile(user, await newSession(name)));
      }

      case 'login': {
        if (!/^[A-Za-z0-9_]{3,16}$/.test(name) || !password) return res.status(400).json({ error: 'Wrong name or password.' });
        if (await limited('try:' + name.toLowerCase(), 10, 900) || await limited('tryip:' + ip, 30, 900)) {
          return res.status(429).json({ error: 'Too many tries. Wait 15 minutes.' });
        }
        const user = await getUser(name);
        const hash = await scrypt(password, user ? user.salt : 'no-such-user');
        if (!user || !crypto.timingSafeEqual(hash, Buffer.from(user.hash, 'hex'))) return res.status(401).json({ error: 'Wrong name or password.' });
        return res.json(Object.assign(profile(user, await newSession(user.name)), { data: user.data }));
      }

      case 'load': {
        const who = await whoIs(b.token);
        const user = who && (await getUser(who));
        if (!user) return res.status(401).json({ error: 'Logged out.' });
        return res.json(Object.assign(profile(user, b.token), { data: user.data }));
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
        await putUser(user);
        return res.json({ updated: user.updated });
      }

      // you won a game against other people: roll a prize (the server picks it, not the game)
      case 'claim': {
        const who = await whoIs(b.token);
        const user = who && (await getUser(who));
        if (!user) return res.status(401).json({ error: 'Logged out.' });
        const now = Date.now();
        if (now - (user.lastClaim || 0) < CLAIM_GAP * 1000) return res.status(429).json({ error: 'Too soon for another prize.' });
        if (await limited('claims:' + who.toLowerCase() + ':' + new Date().toISOString().slice(0, 10), CLAIMS_PER_DAY, 86400)) {
          return res.status(429).json({ error: 'That\'s all the prizes for today!' });
        }
        const prize = ITEMS.roll(user.inv.colors.concat(user.inv.cos), rnd);
        if (prize) user.inv[prize.kind === 'cos' ? 'cos' : 'colors'].push(prize.id);
        user.lastClaim = now;
        await putUser(user);
        return res.json({ prize: prize ? prize.id : null, inv: user.inv, ticket: ticketFor(user.name) });
      }

      case 'verify': {
        const who = readTicket(b.ticket);
        const user = who && (await getUser(who));
        if (!user) return res.status(401).json({ error: 'Not a real account.' });
        const dev = isDev(user.name);
        return res.json({
          name: user.name, dev,
          colors: dev ? ITEMS.COLORS.map((c) => c.hex) : user.inv.colors.map((id) => ITEMS.byId[id]).filter(Boolean).map((c) => c.hex),
          cos: dev ? ITEMS.COSMETICS.map((c) => c.id) : user.inv.cos,
        });
      }

      case 'delete': {
        const who = await whoIs(b.token);
        const user = who && (await getUser(who));
        if (!user) return res.status(401).json({ error: 'Logged out.' });
        if (await limited('try:' + who.toLowerCase(), 10, 900)) return res.status(429).json({ error: 'Too many tries. Wait 15 minutes.' });
        const hash = await scrypt(password, user.salt);
        if (!crypto.timingSafeEqual(hash, Buffer.from(user.hash, 'hex'))) return res.status(401).json({ error: 'Wrong password.' });
        await redis('DEL', userKey(user.name));
        await redis('DEL', 'sess:' + b.token);
        return res.json({ ok: true });
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
