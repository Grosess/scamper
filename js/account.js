// ============================================================
//  ACCOUNT - log in to pick your own (unique) name, collect colors + cosmetics by winning, and
//  keep your settings and stats on any computer. Without an account you're a guest: a cute
//  random name and the same blue look as every other guest.
//  The server part is api/account.js on Vercel; every copy of the game (Vercel, GitHub Pages,
//  a local file) talks to that one.
// ============================================================
const Account = (() => {
  const $ = (id) => document.getElementById(id);
  const API = /vercel\.app$/.test(location.hostname) ? 'api/account' : 'https://sirishpande.vercel.app/api/account';
  const KEYS = { settings: 'scamper-settings', stats: 'scamper-stats', me: 'scamper-account', last: 'scamper-last-name' };
  const read = (k) => Store.get(k);
  const write = (k, v) => (v === null ? Store.remove(k) : Store.set(k, v));
  const hadSettings = !!read(KEYS.settings);   // nothing saved on this computer yet? then fetch it from the account
  let me = read(KEYS.me);   // { name, token, ticket, inv: { colors, cos }, dev, updated }
  if (me && (!me.token || !me.inv)) me = null;
  let online = null, saveTimer = 0, checkTimer = 0, tab = 'new', pendingSave = false;
  // waiting on the server for who you are (page load with a saved log-in, or logging in right now):
  // the name spots show shimmering placeholders until it answers
  let loading = !!me, loggingIn = false;
  const listeners = [];
  const changed = () => { write(KEYS.me, me); render(); for (const f of listeners) f(); };

  async function call(body) {
    let r;
    try { r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    catch (e) { const err = new Error('Could not reach the account server.'); err.net = true; throw err; }
    let j = null;
    try { j = await r.json(); } catch (e) {}
    if (!j) { const err = new Error('The account server isn\'t answering.'); err.net = true; throw err; }
    if (!r.ok) { const err = new Error(j.error || 'Something went wrong.'); err.status = r.status; throw err; }
    return j;
  }
  const local = () => ({ settings: read(KEYS.settings) || {}, stats: read(KEYS.stats) || {} });
  const take = (j) => { me = { name: j.name, token: j.token || (me && me.token), ticket: j.ticket, inv: j.inv, dev: !!j.dev, updated: j.updated }; };

  // ---- the Account page ----
  function status(t, bad) { const s = $('accStatus'); s.textContent = t; s.classList.toggle('bad', !!bad); }
  function render() {
    const inn = !!me, skel = loading || loggingIn;
    $('accOut').classList.toggle('hidden', inn);
    $('accIn').classList.toggle('hidden', !inn);
    $('accTab').textContent = inn ? me.name : 'Account';
    $('accTab').classList.toggle('skel', skel);
    // the quick log-in box on the Play page
    $('qForm').classList.toggle('hidden', inn || loggingIn);
    $('qIn').classList.toggle('hidden', !inn && !loggingIn);
    $('qName').textContent = inn ? me.name : 'loading';
    $('qName').classList.toggle('skel', skel);
    $('accName').classList.toggle('skel', skel);
    document.dispatchEvent(new Event('account-loading'));
    $('accTabNew').classList.toggle('on', tab === 'new');
    $('accTabLogin').classList.toggle('on', tab === 'login');
    $('accConfirmRow').classList.toggle('hidden', tab !== 'new');
    $('accGo').textContent = tab === 'new' ? 'Create account' : 'Log in';
    $('accPass').autocomplete = tab === 'new' ? 'new-password' : 'current-password';
    $('accNameHint').classList.toggle('hidden', tab !== 'new');
    if (!inn) return;
    $('accName').textContent = me.name;
    $('accDev').classList.toggle('hidden', !me.dev || skel);
    if (skel) {   // placeholder rows for the collection
      $('accCollection').innerHTML = ITEMS.TIERS.map(() => '<div class="acc-tier"><span class="skel">rarity</span><span class="acc-bar skel"></span><b class="skel">0/0</b></div>').join('');
      return;
    }
    // the collection, tier by tier
    const have = new Set(me.inv.colors);
    $('accCollection').innerHTML = ITEMS.TIERS.map((t) => {
      const all = ITEMS.COLORS.filter((it) => it.tier === t.id), got = all.filter((it) => have.has(it.id)).length;
      return `<div class="acc-tier"><span class="acc-tier-name" style="--tc:${t.color}">${t.name}</span><span class="acc-bar"><i style="width:${(got / all.length * 100).toFixed(1)}%;background:${t.color}"></i></span><b>${got}/${all.length}</b></div>`;
    }).join('') + `<p class="note">${have.size} of ${ITEMS.COLORS.length} colors collected. Win games against other people to unlock more.</p>`;
  }
  // is the name free (and clean)? asked while you type
  function checkName() {
    clearTimeout(checkTimer);
    const n = $('accUser').value.trim(), hint = $('accNameHint');
    if (tab !== 'new' || !n) { hint.textContent = '3-14 of a-z, 0-9 or _. This is your name in every game, and it can\'t be changed.'; hint.className = 'note'; return; }
    const local = ITEMS.nameProblem(n);
    if (local) { hint.textContent = local; hint.className = 'note bad'; return; }
    hint.textContent = 'Checking…';
    hint.className = 'note';
    checkTimer = setTimeout(async () => {
      try {
        const j = await call({ action: 'check', username: n });
        if ($('accUser').value.trim() !== n) return;
        hint.textContent = j.ok ? `"${n}" is free!` : j.problem;
        hint.className = j.ok ? 'note good' : 'note bad';
      } catch (e) { hint.textContent = e.message; hint.className = 'note bad'; }
    }, 350);
  }
  async function go() {
    const username = $('accUser').value.trim().toLowerCase(), password = $('accPass').value;
    if (tab === 'new') {
      const p = ITEMS.nameProblem(username);
      if (p) { status(p + '.', true); return; }
      if (password.length < 6) { status('Passwords need at least 6 characters.', true); return; }
      if (password !== $('accPass2').value) { status('The passwords don\'t match.', true); return; }
    }
    status(tab === 'new' ? 'Creating your account…' : 'Logging in…');
    $('accGo').disabled = true;
    try {
      const j = await call({ action: tab === 'new' ? 'register' : 'login', username, password, data: local() });
      take(j);
      write(KEYS.last, j.name);
      $('accPass').value = $('accPass2').value = '';
      // logging in on another computer: bring your settings + stats along
      if (j.data && j.data.settings && Object.keys(j.data.settings).length) { write(KEYS.settings, j.data.settings); if (j.data.stats) write(KEYS.stats, j.data.stats); write(KEYS.me, me); location.reload(); return; }
      status(tab === 'new' ? 'Welcome! You have two crates to open.' : '');
      changed();
    } catch (e) { status(e.message, true); }
    $('accGo').disabled = false;
  }
  async function save() {
    if (!me) return;
    try {
      const j = await call({ action: 'save', token: me.token, data: local() });
      me.updated = j.updated;
      write(KEYS.me, me);
    } catch (e) { if (e.status === 401) { me = null; changed(); } }
  }

  // quick log in (Play page): your last name is filled in, Enter logs in
  const last = read(KEYS.last);
  if (last) { $('qUser').value = last; $('accUser').value = last; tab = 'login'; }
  $('qUser').addEventListener('input', () => { const el = $('qUser'), v = el.value.toLowerCase().replace(/[^a-z0-9_]/g, ''); if (v !== el.value) el.value = v; });
  $('qForm').onsubmit = async (e) => {
    e.preventDefault();
    const username = $('qUser').value.trim(), password = $('qPass').value, msg = $('qMsg');
    if (!username || !password) { (username ? $('qPass') : $('qUser')).focus(); return; }
    msg.textContent = 'Logging in…';
    msg.className = 'q-msg';
    $('qGo').disabled = true;
    loggingIn = true;
    render();
    try {
      const j = await call({ action: 'login', username, password });
      loggingIn = false;
      take(j);
      write(KEYS.last, j.name);
      $('qPass').value = '';
      if (j.data && j.data.settings && Object.keys(j.data.settings).length) { write(KEYS.settings, j.data.settings); if (j.data.stats) write(KEYS.stats, j.data.stats); write(KEYS.me, me); location.reload(); return; }
      changed();
    } catch (err) { msg.textContent = err.message; msg.className = 'q-msg bad'; }
    loggingIn = false;
    render();
    $('qGo').disabled = false;
  };
  $('qOut').onclick = (e) => { e.preventDefault(); $('accLogout').onclick(); };

  $('accTabNew').onclick = () => { tab = 'new'; status(''); render(); checkName(); };
  $('accTabLogin').onclick = () => { tab = 'login'; status(''); render(); checkName(); };
  // names are a-z, 0-9 and _ only: lowercase as you type and drop anything else
  $('accUser').addEventListener('input', () => {
    const el = $('accUser'), v = el.value.toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (v !== el.value) el.value = v;
    checkName();
  });
  $('accGo').onclick = go;
  for (const id of ['accUser', 'accPass', 'accPass2']) $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  $('accLogout').onclick = async () => {
    const t = me && me.token;
    me = null;
    changed();
    try { await call({ action: 'logout', token: t }); } catch (e) {}
  };
  $('accDelete').onclick = async (e) => {
    e.preventDefault();
    const password = prompt('This deletes your account, your name and everything you\'ve won, forever. Type your password to confirm:');
    if (!password || !me) return;
    try {
      await call({ action: 'delete', token: me.token, password });
      me = null;
      changed();
      status('Your account was deleted.');
    } catch (err) { status(err.message, true); }
  };
  $('privacyLink').onclick = (e) => { e.preventDefault(); $('privacy').classList.remove('hidden'); };
  $('privacyClose').onclick = () => $('privacy').classList.add('hidden');
  render();
  checkName();

  // refresh from the server (new prizes from another computer, a fresh ticket)
  (async () => {
    try {
      await call({ action: 'ping' });
      online = true;
      if (!me) { loading = false; render(); return; }
      const j = await call({ action: 'load', token: me.token });
      const newer = j.updated > (me.updated || 0);
      take(j);
      loading = false;
      if ((newer || !hadSettings) && j.data && j.data.settings && Object.keys(j.data.settings).length && !sessionStorage.getItem('scamper-synced')) {
        sessionStorage.setItem('scamper-synced', '1');
        write(KEYS.settings, j.data.settings || {});
        write(KEYS.stats, j.data.stats || {});
        write(KEYS.me, me);
        location.reload();
        return;
      }
      changed();
      if (pendingSave) { pendingSave = false; saveTimer = setTimeout(save, 15000); }
    } catch (e) {
      if (e.status === 401) { me = null; changed(); }
      else online = false;
    }
    loading = false;
    render();
  })();

  return {
    get me() { return me; },
    get loading() { return loading || loggingIn; },
    onChange(f) { listeners.push(f); },
    // the game saved settings or stats: send them up a bit later (batched, to go easy on the server)
    dirty() {
      if (!me || online === false) return;
      // wait until this computer has loaded the account first, so old local data can't
      // overwrite newer data saved from another computer
      if (online !== true) { pendingSave = true; return; }
      clearTimeout(saveTimer);
      saveTimer = setTimeout(save, 15000);
    },
    // you won: ask the server for a prize. Resolves to the prize's id, or null
    // host: a round went live with these players' tickets -> a match id (null = doesn't count)
    async matchStart(tickets) {
      try { const j = await call({ action: 'matchStart', players: tickets }); return j.match ? { id: j.match, key: j.key } : null; } catch (e) { return null; }
    },
    // host: the round ended -> which account names earned a prize
    async matchEnd(match, winners, play, together) {
      try { return (await call({ action: 'matchEnd', match: match.id, key: match.key, winners, play, together })).eligible || []; } catch (e) { return []; }
    },
    // the public game list (cached at the edge for a few seconds)
    async lobbies() {
      try { const r = await fetch(API, { method: 'GET' }); const j = await r.json(); return Array.isArray(j.lobbies) ? j.lobbies : []; } catch (e) { return null; }
    },
    // host: put this game on the public list / keep it there (call every 30s) / take it off
    lobbyUp(info) { call(Object.assign({ action: 'lobbyUp' }, info)).catch(() => {}); },
    lobbyDown(code, key, leaving) {
      const body = JSON.stringify({ action: 'lobbyDown', code, key });
      if (leaving && navigator.sendBeacon) navigator.sendBeacon(API, new Blob([body], { type: 'text/plain' }));
      else call({ action: 'lobbyDown', code, key }).catch(() => {});
    },
    // open one of a new account's welcome crates
    async openStarter() {
      if (!me) return null;
      try {
        const j = await call({ action: 'starter', token: me.token });
        me.inv = j.inv;
        me.ticket = j.ticket;
        changed();
        return j.prize;
      } catch (e) { return null; }
    },
    async claim(match) {
      if (!me) return null;
      try {
        const j = await call({ action: 'claim', token: me.token, match });
        me.inv = j.inv;
        me.ticket = j.ticket;
        changed();
        return j.prize;
      } catch (e) { return null; }
    },
    // host: what does the player holding this ticket really own? (null = not a real account)
    // 'offline' = couldn't tell right now (try again); null = definitely not a real account
    async verify(ticket) {
      if (!ticket) return null;
      try { return await call({ action: 'verify', ticket }); }
      catch (e) { return e.status === 401 ? null : 'offline'; }
    },
  };
})();
