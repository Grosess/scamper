// ============================================================
//  ACCOUNT - optional log in (username + password). Your settings and stats are saved to your
//  account, so they follow you to any computer. Needs the server part (api/account.js), which
//  only exists when the game is hosted on Vercel - anywhere else the Account page says so.
// ============================================================
const Account = (() => {
  const $ = (id) => document.getElementById(id);
  const API = 'api/account';
  const KEYS = { settings: 'scamper-settings', stats: 'scamper-stats', me: 'scamper-account' };
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k)) || null; } catch (e) { return null; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let me = read(KEYS.me);   // { name, token, updated }
  let online = null;        // is the server there? (null = don't know yet)
  let saveTimer = 0;

  async function call(body) {
    let r;
    try { r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    catch (e) { throw new Error('Could not reach the server.'); }
    let j = null;
    try { j = await r.json(); } catch (e) {}
    if (!j) throw new Error('Accounts only work on the Vercel version of Scamper.');
    if (!r.ok) { const err = new Error(j.error || 'Something went wrong.'); err.status = r.status; throw err; }
    return j;
  }
  const local = () => ({ settings: read(KEYS.settings) || {}, stats: read(KEYS.stats) || {} });
  // put the account's saved data on this device, then reload so the game picks it up
  function apply(data, updated) {
    if (data && data.settings) write(KEYS.settings, data.settings);
    if (data && data.stats) write(KEYS.stats, data.stats);
    me.updated = updated;
    write(KEYS.me, me);
    location.reload();
  }
  function status(t, bad) { const s = $('accStatus'); s.textContent = t; s.classList.toggle('bad', !!bad); }
  function render() {
    const inn = !!me;
    $('accOut').classList.toggle('hidden', inn || online === false);
    $('accIn').classList.toggle('hidden', !inn);
    $('accOff').classList.toggle('hidden', online !== false);
    if (inn) $('accName').textContent = me.name;
    $('accTab').textContent = inn ? me.name : 'Account';
  }
  async function enter(action) {
    const username = $('accUser').value.trim(), password = $('accPass').value;
    status(action === 'login' ? 'Logging in…' : 'Creating your account…');
    try {
      const j = await call({ action, username, password, data: local() });
      me = { name: j.name, token: j.token, updated: j.updated };
      write(KEYS.me, me);
      $('accPass').value = '';
      // logging in on a new device: take the account's settings + stats
      if (action === 'login' && j.data && Object.keys(j.data.settings || {}).length) { apply(j.data, j.updated); return; }
      status('');
      render();
    } catch (e) { status(e.message, true); }
  }
  async function save() {
    if (!me) return;
    try {
      const j = await call({ action: 'save', token: me.token, data: local() });
      me.updated = j.updated;
      write(KEYS.me, me);
      $('accSaved').textContent = 'Saved to your account.';
    } catch (e) {
      if (e.status === 401) { me = null; localStorage.removeItem(KEYS.me); render(); }
      $('accSaved').textContent = e.message;
    }
  }

  // the game calls this whenever it saves settings or stats
  function dirty() {
    if (!me || online === false) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 4000);
  }

  $('accLogin').onclick = () => enter('login');
  $('accRegister').onclick = () => enter('register');
  $('accPass').addEventListener('keydown', (e) => { if (e.key === 'Enter') enter('login'); });
  $('accLogout').onclick = async () => {
    const t = me && me.token;
    me = null;
    localStorage.removeItem(KEYS.me);
    render();
    try { await call({ action: 'logout', token: t }); } catch (e) {}
  };
  render();
  // is the server there? Logged in: also pick up anything saved from another computer
  (async () => {
    try {
      await call({ action: 'ping' });
      online = true;
      if (me) {
        const j = await call({ action: 'load', token: me.token });
        if (j.updated > (me.updated || 0) && !sessionStorage.getItem('scamper-synced')) {
          sessionStorage.setItem('scamper-synced', '1');
          apply(j.data, j.updated);
        }
      }
    } catch (e) {
      if (e.status === 401) { me = null; localStorage.removeItem(KEYS.me); }
      else if (!e.status || e.status === 503) online = false;
      if (e.status === 503) $('accOffText').textContent = e.message;
    }
    render();
  })();
  return { dirty };
})();
