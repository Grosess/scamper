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
    return Object.assign({ debug: 1 }, CONFIG.net.peerServer || {});
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

  join(code, cb) {
    const peer = new Peer(this._opts());
    let done = false;
    const fail = (msg) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      peer.destroy();
      cb(msg);
    };
    const timer = setTimeout(() => fail('Could not reach that game. Check the code and try again.'), 12000);

    peer.on('open', (id) => {
      this.id = id;
      const c = peer.connect(CONFIG.net.prefix + code, { reliable: true, serialization: 'json' });
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
      if (err.type === 'peer-unavailable') fail(`No game found with code ${code}.`);
      else if (!done) fail(describeError(err));
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
