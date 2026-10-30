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
//  POST { action: 'matchStart', players: [tickets] }  (host, when a round goes live) -> { match, key }
//  POST { action: 'matchEnd', match, key, winners: [names], play: { name: { moved, active, jumps } }, together }
//       -> { eligible: [names] }
//  POST { action: 'claim', token, match }  (you won that match) -> { prize, inv, ticket }
//  POST { action: 'starter', token }  (open one of your two welcome crates) -> { prize, inv, ticket }
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
// a prize needs a real game: at least two different accounts that both actually moved around,
// timed by this server (not the game), and the same two accounts can only farm each other so much
const MATCH_MIN_SECS = 40;
const MATCH_MIN_MOVED = 40;   // meters each counted player must have covered
const MATCH_MIN_ACTIVE = 0.3; // ...spending at least this share of the round on the move
const MATCH_MIN_JUMPS = 2;    // ...and jumping now and then (idle devices and walk-bots don't)
const MATCH_TOGETHER = 0.3;   // share of the moving time where 2+ players move at once (one person
                              // steering two devices can only move one of them at a time)
const PAIR_PER_DAY = 3;

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
// every account has a random "gen". Sessions and tickets carry it, so when an account is deleted,
// every device it was logged in on is logged out - even if someone new takes the name later
const newGen = () => crypto.randomBytes(6).toString('hex');
async function newSession(u) {
  const token = crypto.randomBytes(24).toString('hex');
  await redis('SET', 'sess:' + token, u.name + '|' + (u.gen || ''), 'EX', SESSION_DAYS * 86400);
  return token;
}
// the account a session token belongs to (null = logged out)
async function sessionUser(token) {
  if (typeof token !== 'string' || !/^[0-9a-f]{48}$/.test(token)) return null;
  const v = await redis('GET', 'sess:' + token);
  if (!v) return null;
  const [name, gen = ''] = v.split('|');
  const u = await getUser(name);
  return u && (u.gen || '') === gen ? u : null;
}
const userKey = (name) => 'user:' + String(name).toLowerCase();
const invKey = (name) => 'inv:' + String(name).toLowerCase();   // kept apart, so a settings save can never undo a prize
// colors from the old catalog -> the closest one in the current catalog
const OLD = { lemon: 'butter', lavender: 'lilac', fog: 'sky', cream: 'butter', caramel: 'tangerine', moss: 'lime', plum: 'fuchsia',
  slate: 'azure', blood: 'ruby', deepsea: 'turquoise', navy: 'sapphire', royal: 'amethyst', mauve: 'magenta', steel: 'sapphire',
  sunset: 'tomato', toxic: 'laser', electric: 'cyber', neonpurple: 'neonpink', rosegold: 'gold', bronze: 'amber', neonred: 'ruby',
  silver: 'sky', platinum: 'periwinkle', pearl: 'butter', graphite: 'sapphire', crimson: 'bloodmoon', midnight: 'abyss' };
function cleanInv(inv) {
  const colors = [...new Set((inv && inv.colors || []).map((id) => (ITEMS.byId[id] ? id : OLD[id])).filter((id) => ITEMS.byId[id]))];
  const starter = Math.max(0, Math.min(2, +(inv && inv.starter) || 0));   // welcome crates still to open
  while (colors.length + starter < 2) { const s = ITEMS.starter(rnd); for (const id of s) if (colors.length + starter < 2 && !colors.includes(id)) colors.push(id); }
  return { colors, cos: [], starter };
}
async function getUser(name) {
  const raw = await redis('GET', userKey(name));
  if (!raw) return null;
  const u = JSON.parse(raw);
  const inv = await redis('GET', invKey(name));
  u.inv = cleanInv(inv ? JSON.parse(inv) : u.inv);
  return u;
}
const putUser = (u) => redis('SET', userKey(u.name), JSON.stringify(Object.assign({}, u, { inv: undefined })));
const putInv = (u) => redis('SET', invKey(u.name), JSON.stringify(u.inv));
const isDev = (name) => DEVS.includes(String(name).toLowerCase());

const sign = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
function ticketFor(u) {
  const body = Buffer.from(JSON.stringify({ n: u.name, g: u.gen || '', e: Date.now() + TICKET_HOURS * 3600e3 })).toString('base64url');
  return body + '.' + sign(body);
}
// a ticket -> { name, gen } (null = forged or expired)
function readTicket(t) {
  if (typeof t !== 'string' || t.length > 400) return null;
  const [body, sig] = t.split('.');
  if (!body || !sig || sig.length !== sign(body).length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(sign(body)))) return null;
  try { const j = JSON.parse(Buffer.from(body, 'base64url').toString()); return j.e > Date.now() ? { name: j.n, gen: j.g || '' } : null; } catch (e) { return null; }
}
async function ticketUser(t) {
  const k = readTicket(t), u = k && (await getUser(k.name));
  return u && (u.gen || '') === k.gen ? u : null;
}
const profile = (u, token) => ({ name: u.name, token, ticket: ticketFor(u), inv: u.inv, dev: isDev(u.name), updated: u.updated });

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
        const user = { name, salt, hash, data, gen: newGen(), updated: now, created: now };
        const ok = await redis('SET', userKey(name), JSON.stringify(user), 'NX');
        if (ok !== 'OK') return res.status(409).json({ error: 'That name is taken.' });
        user.inv = { colors: [], cos: [], starter: 2 };   // two welcome crates, opened in the game
        await putInv(user);
        return res.json(profile(user, await newSession(user)));
      }

      case 'login': {
        if (!/^[A-Za-z0-9_]{3,16}$/.test(name) || !password) return res.status(400).json({ error: 'Wrong name or password.' });
        if (await limited('try:' + name.toLowerCase(), 10, 900) || await limited('tryip:' + ip, 30, 900)) {
          return res.status(429).json({ error: 'Too many tries. Wait 15 minutes.' });
        }
        const user = await getUser(name);
        const hash = await scrypt(password, user ? user.salt : 'no-such-user');
        if (!user || !crypto.timingSafeEqual(hash, Buffer.from(user.hash, 'hex'))) return res.status(401).json({ error: 'Wrong name or password.' });
        return res.json(Object.assign(profile(user, await newSession(user)), { data: user.data }));
      }

      case 'load': {
        const user = await sessionUser(b.token), who = user && user.name;
        if (!user) return res.status(401).json({ error: 'Logged out.' });
        return res.json(Object.assign(profile(user, b.token), { data: user.data }));
      }

      case 'save': {
        const user = await sessionUser(b.token), who = user && user.name;
        if (!user) return res.status(401).json({ error: 'Logged out.' });
        if (await limited('save:' + who.toLowerCase(), 60, 600)) return res.status(429).json({ error: 'Saving too often.' });
        const data = cleanData(b.data);
        if (!data) return res.status(413).json({ error: 'Too much data.' });
        user.data = data;
        user.updated = Date.now();
        await putUser(user);
        return res.json({ updated: user.updated });
      }

      // a round just went live: remember who's in it (by account) and when it started
      case 'matchStart': {
        if (await limited('mstart:' + ip, 120, 3600)) return res.status(429).json({ error: 'Slow down.' });
        const users = await Promise.all((Array.isArray(b.players) ? b.players.slice(0, 12) : []).map(ticketUser));
        const names = [...new Set(users.filter(Boolean).map((u) => u.name.toLowerCase()))];
        if (names.length < 2) return res.json({ match: null });   // needs two real accounts to count
        // only whoever started the match (the host) gets the key to end it
        const id = crypto.randomBytes(12).toString('hex'), key = crypto.randomBytes(12).toString('hex');
        await redis('SET', 'match:' + id, JSON.stringify({ names, key, start: Date.now() }), 'EX', 3 * 3600);
        return res.json({ match: id, key });
      }

      // the round ended: work out who earned a prize. The server checks the time itself, and only
      // counts players who really moved; winners need at least one other active account in the game
      case 'matchEnd': {
        if (typeof b.match !== 'string' || !/^[0-9a-f]{24}$/.test(b.match)) return res.status(400).json({ error: 'No match.' });
        const raw = await redis('GET', 'match:' + b.match);
        if (!raw) return res.status(404).json({ error: 'No match.' });
        const m = JSON.parse(raw);
        if (b.key !== m.key) return res.status(403).json({ error: 'Not your match.' });
        if (m.done) return res.json({ eligible: m.eligible });
        // a player counts if they really played: moved far enough, were on the move a good part of
        // the round, and jumped now and then. The round counts if at least two such players took
        // part (not the whole lobby) AND people were moving at the same time - not one, then the other
        const play = b.play && typeof b.play === 'object' ? b.play : {}, secs = (Date.now() - m.start) / 1000;
        const real = (n) => { const p = play[n]; return !!p && +p.moved >= MATCH_MIN_MOVED && +p.active >= secs * MATCH_MIN_ACTIVE && +p.jumps >= MATCH_MIN_JUMPS; };
        const active = m.names.filter(real);
        const ok = secs >= MATCH_MIN_SECS && active.length >= 2 && +b.together >= MATCH_TOGETHER;
        const winners = (Array.isArray(b.winners) ? b.winners : []).map((n) => String(n).toLowerCase());
        // only two players need to pass the full check; any winner who took part (moved a bit) gets a crate
        m.eligible = ok ? winners.filter((n) => m.names.includes(n) && +(play[n] || {}).moved >= MATCH_MIN_MOVED) : [];
        m.active = active;
        m.done = true;
        m.claimed = [];
        await redis('SET', 'match:' + b.match, JSON.stringify(m), 'EX', 3 * 3600);
        return res.json({ eligible: m.eligible });
      }

      // you won a real match against other people: roll a prize (the server picks it, not the game)
      case 'claim': {
        const user = await sessionUser(b.token), who = user && user.name;
        if (!user) return res.status(401).json({ error: 'Logged out.' });
        const raw = typeof b.match === 'string' && /^[0-9a-f]{24}$/.test(b.match) ? await redis('GET', 'match:' + b.match) : null;
        const m = raw && JSON.parse(raw), me = who.toLowerCase();
        if (!m || !m.done || !m.eligible.includes(me)) return res.status(403).json({ error: 'No prize for that game.' });
        if (m.claimed.includes(me)) return res.status(409).json({ error: 'Already claimed.' });
        // every check first (so a refused claim doesn't burn the prize), then mark it claimed
        const now = Date.now(), day = new Date().toISOString().slice(0, 10), others = m.active.filter((n) => n !== me);
        if (now - (+(await redis('GET', 'lastclaim:' + me)) || 0) < CLAIM_GAP * 1000) return res.status(429).json({ error: 'Too soon for another prize.' });
        // the same two accounts can only win prizes off each other a few times a day
        let fresh = false;
        for (const o of others) if (!(await limited(`pair:${[me, o].sort().join(':')}:${day}`, PAIR_PER_DAY, 86400))) fresh = true;
        if (!fresh) return res.status(429).json({ error: 'You\'ve won enough off the same players today - play some new people!' });
        if (await limited('claims:' + me + ':' + day, CLAIMS_PER_DAY, 86400)) return res.status(429).json({ error: 'That\'s all the prizes for today!' });
        m.claimed.push(me);
        await redis('SET', 'match:' + b.match, JSON.stringify(m), 'EX', 3 * 3600);
        const prize = ITEMS.roll(user.inv.colors, rnd);
        if (prize) user.inv.colors.push(prize.id);
        await putInv(user);
        await redis('SET', 'lastclaim:' + me, String(now), 'EX', 86400);
        return res.json({ prize: prize ? prize.id : null, inv: user.inv, ticket: ticketFor(user) });
      }

      // a new account's welcome crates: two, each a normal roll, never the same color twice
      case 'starter': {
        const user = await sessionUser(b.token);
        if (!user) return res.status(401).json({ error: 'Logged out.' });
        if (!(user.inv.starter > 0)) return res.status(409).json({ error: 'No crates left.' });
        const prize = ITEMS.roll(user.inv.colors, rnd);
        if (prize) user.inv.colors.push(prize.id);
        user.inv.starter--;
        await putInv(user);
        return res.json({ prize: prize ? prize.id : null, inv: user.inv, ticket: ticketFor(user) });
      }

      case 'verify': {
        const user = await ticketUser(b.ticket);
        if (!user) return res.status(401).json({ error: 'Not a real account.' });
        const dev = isDev(user.name);
        return res.json({
          name: user.name, dev,
          colors: dev ? ITEMS.COLORS.map((c) => c.hex) : user.inv.colors.map((id) => ITEMS.byId[id]).filter(Boolean).map((c) => c.hex),
          cos: dev ? ITEMS.COSMETICS.map((c) => c.id) : [],   // cosmetics are developer-only
        });
      }

      case 'delete': {
        const user = await sessionUser(b.token), who = user && user.name;
        if (!user) return res.status(401).json({ error: 'Logged out.' });
        if (await limited('try:' + who.toLowerCase(), 10, 900)) return res.status(429).json({ error: 'Too many tries. Wait 15 minutes.' });
        const hash = await scrypt(password, user.salt);
        if (!crypto.timingSafeEqual(hash, Buffer.from(user.hash, 'hex'))) return res.status(401).json({ error: 'Wrong password.' });
        await redis('DEL', userKey(user.name));
        await redis('DEL', invKey(user.name));
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
