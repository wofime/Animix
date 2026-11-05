// Couche P2P (PeerJS). L'hôte = salon "mj-XXXX"; les invités s'y connectent.
const LET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const OPTS = {debug: 1, config: {iceServers: [
  {urls: 'stun:stun.l.google.com:19302'}, {urls: 'stun:stun1.l.google.com:19302'}, {urls: 'stun:global.stun.twilio.com:3478'},
  // TURN public de secours (best effort) pour les réseaux 4G / box strictes
  {urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject'},
  {urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject'}]}};
const MSG = {'peer-unavailable': 'Salon introuvable : code faux ou hôte déconnecté', network: 'Serveur PeerJS injoignable',
  'server-error': 'Serveur PeerJS injoignable', 'socket-error': 'Serveur PeerJS injoignable', 'socket-closed': 'Serveur PeerJS injoignable'};

export class Room {
  peer = null; isHost = false; code = ''; conns = new Map(); hostConn = null;
  onmsg = null; onleave = null; onclose = null;
  async host() {
    const code = Array.from({length: 4}, () => LET[Math.random() * LET.length | 0]).join('');
    try { await this.#open('mj-' + code); }
    catch (e) { if (e.type === 'unavailable-id') return this.host(); throw e; }
    this.isHost = true; this.code = code;
    this.peer.on('disconnected', () => this.peer.reconnect()); // garde le salon visible sur le serveur
    this.peer.on('error', e => console.warn('PeerJS', e.type));
    this.peer.on('connection', c => {
      c.on('open', () => this.conns.set(c.peer, c));
      c.on('data', d => this.onmsg?.(d, c.peer));
      c.on('close', () => { this.conns.delete(c.peer); this.onleave?.(c.peer); });
    });
    return code;
  }
  async join(code) {
    await this.#open();
    this.code = code.toUpperCase().trim();
    await new Promise((res, rej) => {
      const fail = m => { clearTimeout(t); rej(new Error(m)); };
      const t = setTimeout(() => fail('Connexion P2P bloquée (réseau). Essaie un autre Wi-Fi/4G'), 20000);
      this.peer.on('error', e => fail(MSG[e.type] || 'Erreur : ' + e.type));
      const c = this.peer.connect('mj-' + this.code, {reliable: true, serialization: 'json'});
      c.on('open', () => { clearTimeout(t); this.hostConn = c; res(); });
      c.on('error', e => fail('Erreur : ' + (e.type || e)));
      c.on('data', d => this.onmsg?.(d));
      c.on('close', () => this.onclose?.());
    });
  }
  #open(id) {
    return new Promise((res, rej) => {
      this.peer = id ? new Peer(id, OPTS) : new Peer(OPTS);
      const t = setTimeout(() => { this.peer.destroy(); rej(Object.assign(new Error('Serveur PeerJS injoignable'), {type: 'network'})); }, 10000);
      this.peer.on('open', () => { clearTimeout(t); res(); });
      this.peer.on('error', e => { if (!this.peer.open) { clearTimeout(t); this.peer.destroy(); rej(e.message ? e : Object.assign(new Error(MSG[e.type] || e.type), {type: e.type})); } });
    });
  }
  get id() { return this.peer.id; }
  send(d) { this.hostConn?.send(d); }
  broadcast(d) { this.conns.forEach(c => c.open && c.send(d)); }
}
