// ============================================================
//  STORE - saves settings, stats and your log-in in this browser twice: local storage, and a
//  copy in cookies. If one of them gets wiped (some proxies and school setups clear local
//  storage), the other brings it back.
// ============================================================
const Store = (() => {
  const CHUNK = 3000;   // cookies hold ~4KB each, so big values are split over a few
  const YEAR = 365 * 86400;
  const secure = location.protocol === 'https:' ? '; Secure' : '';
  const cookies = () => Object.fromEntries(document.cookie.split('; ').filter(Boolean).map((c) => { const i = c.indexOf('='); return [c.slice(0, i), c.slice(i + 1)]; }));
  const setCookie = (k, v, age) => { document.cookie = `${k}=${v}; path=/; max-age=${age}; SameSite=Lax${secure}`; };
  const enc = (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const dec = (s) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
  const cname = (key) => 'sc_' + key.replace(/[^a-z0-9]/gi, '');

  function readCookie(key) {
    try {
      const all = cookies(), base = cname(key), n = +all[base + '_n'];
      if (!n) return null;
      let s = '';
      for (let i = 0; i < n; i++) { if (all[`${base}_${i}`] === undefined) return null; s += all[`${base}_${i}`]; }
      return dec(s);
    } catch (e) { return null; }
  }
  function writeCookie(key, text) {
    try {
      const base = cname(key), old = +cookies()[base + '_n'] || 0;
      if (text === null) { for (let i = 0; i < old; i++) setCookie(`${base}_${i}`, '', 0); setCookie(base + '_n', '', 0); return; }
      const s = enc(text), n = Math.ceil(s.length / CHUNK) || 1;
      for (let i = 0; i < n; i++) setCookie(`${base}_${i}`, s.slice(i * CHUNK, (i + 1) * CHUNK), YEAR);
      for (let i = n; i < old; i++) setCookie(`${base}_${i}`, '', 0);
      setCookie(base + '_n', String(n), YEAR);
    } catch (e) {}
  }

  return {
    // the saved value (parsed), from local storage - or from the cookie copy if that's all there is
    get(key) {
      let text = null;
      try { text = localStorage.getItem(key); } catch (e) {}
      if (text === null) {
        text = readCookie(key);
        if (text !== null) try { localStorage.setItem(key, text); } catch (e) {}
      }
      try { return text === null ? null : JSON.parse(text); } catch (e) { return null; }
    },
    set(key, value) {
      const text = JSON.stringify(value);
      try { localStorage.setItem(key, text); } catch (e) {}
      writeCookie(key, text);
    },
    remove(key) {
      try { localStorage.removeItem(key); } catch (e) {}
      writeCookie(key, null);
    },
  };
})();
