// ============================================================
//  NET - peer-to-peer lobbies with 4-letter codes (PeerJS / WebRTC).
//  The host's browser runs the game rules; everyone connects to the host.
// ============================================================
const Net = {
  peer: null,
  isHost: false,
  code: '',
  id: null,
  conns: new Map(),   // host only: peerId -> connection
  hostConn: null,     // client only
  onMessage: () => {},
  onLeave: () => {},
  onLost: () => {},

  // Codes alternate consonant/vowel (like "MOKU", "ZEPA") so they're easy to say out loud.
  makeCode() {
    const C = 'BDFGHKLMNPRSTVZ', V = 'AEIOU';
    const banned = ['NAZI', 'HOMO', 'PUTA', 'PUTO', 'PEDO', 'KAKA', 'PENE', 'PENI', 'DAGO', 'RAPE', 'SUKA', 'NIGA'];
    const pick = (s) => s[Math.floor(Math.random() * s.length)];
    let code;
    do { code = pick(C) + pick(V) + pick(C) + pick(V); } while (banned.includes(code));
    return code;
  },

  _opts() {
    // ?relay=1 forces everything through TURN relays (what happens on strict networks) - for testing
    const relayOnly = /[?&]relay=1/.test(location.search);
    const iceServers = CONFIG.net.iceServers.concat(CONFIG.net.turn ? [CONFIG.net.turn] : []);
    const config = { iceServers, iceTransportPolicy: relayOnly ? 'relay' : 'all' };
    return Object.assign({ debug: 1, config }, CONFIG.net.peerServer || {});
  },

  host(cb) {
    let tries = 0;
    const attempt = () => {
      const code = this.makeCode();
      const peer = new Peer(CONFIG.net.prefix + code, this._opts());
      let opened = false;
      peer.on('open', (id) => {
        opened = true;
        this.peer = peer;
        this.isHost = true;
        this.code = code;
        this.id = id;
        cb(null);
      });
      peer.on('connection', (c) => this._accept(c));
      peer.on('error', (err) => {
        if (!opened && err.type === 'unavailable-id' && tries++ < 6) { peer.destroy(); attempt(); }
        else if (!opened) { peer.destroy(); cb(describeError(err)); }
        else console.warn('peer error', err.type);
      });
      // lost the signaling server - existing players stay connected, reconnect so new ones can join
      peer.on('disconnected', () => { if (!peer.destroyed) setTimeout(() => { try { peer.reconnect(); } catch (e) {} }, 1000); });
    };
    attempt();
  },

  _accept(c) {
    c.on('open', () => this.conns.set(c.peer, c));
    c.on('data', (d) => this.onMessage(c.peer, d));
    c.on('close', () => { this.conns.delete(c.peer); this.onLeave(c.peer); });
    c.on('error', () => {});
  },

  // join a lobby. If the code isn't found right away it tries once more (the host may have
  // just reconnected to the matchmaking server), then explains what went wrong.
  join(code, cb, attempt = 0) {
    const peer = new Peer(this._opts());
    let done = false, reached = false;
    const fail = (msg, retry) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      peer.destroy();
      if (retry && attempt === 0) setTimeout(() => this.join(code, cb, 1), 1500);
      else cb(msg);
    };
    const timer = setTimeout(() => fail(reached
      ? 'Found the lobby but could not connect to the host. One of your networks is blocking direct connections - try a phone hotspot, or set up a relay (see README).'
      : 'Could not reach the matchmaking server. Check your internet and try again.', !reached), 20000);

    peer.on('open', (id) => {
      this.id = id;
      reached = true;
      const c = peer.connect(CONFIG.net.prefix + code, { reliable: true, serialization: 'json', metadata: { v: CONFIG.version } });
      c.on('open', () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        this.peer = peer;
        this.hostConn = c;
        this.code = code;
        cb(null);
      });
      c.on('data', (d) => this.onMessage('host', d));
      c.on('close', () => { if (done) this.onLost(); });
      c.on('error', () => {});
    });
    peer.on('error', (err) => {
      if (err.type === 'peer-unavailable') {
        fail(`No game found with code ${code}. Check the code, and make sure you're both on the latest version (refresh the page).`, true);
      } else if (!done) fail(describeError(err));
    });
  },

  send(m) {
    if (this.hostConn && this.hostConn.open) this.hostConn.send(m);
  },

  sendTo(id, m) {
    const c = this.conns.get(id);
    if (c && c.open) c.send(m);
  },

  broadcast(m) {
    for (const c of this.conns.values()) if (c.open) c.send(m);
  },

  kick(id) {
    const c = this.conns.get(id);
    if (c) c.close();
  },

  destroy() {
    if (this.peer && !this.peer.destroyed) this.peer.destroy();
  },
};

function describeError(err) {
  switch (err && err.type) {
    case 'browser-incompatible': return 'Your browser does not support WebRTC.';
    case 'network':
    case 'server-error':
    case 'socket-error':
    case 'socket-closed': return 'Could not reach the matchmaking server. Check your internet and try again.';
    case 'unavailable-id': return 'Could not get a free code. Try again.';
    default: return 'Connection error' + (err && err.type ? ` (${err.type})` : '') + '.';
  }
}
