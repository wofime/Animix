// Mercato : logique AUTORITAIRE exécutée uniquement chez l'hôte.
// Les invités envoient {t:'bid',amount}; l'hôte diffuse l'état complet.
import { shuffle } from '../characters.js';
const DURATION = 15000, SNIPE = 3000, SOLD_PAUSE = 3500, MIN_STEP = 10;
export const TIER_PTS = {1: 10, 2: 20, 3: 30, 4: 45, 5: 60};

export class MercatoHost {
  constructor({pool, budget = 1000, slots = 5, send}) {
    this.pool = pool; this.queue = []; this.send = send; this.endsAt = 0;
    this.s = {phase: 'lobby', players: [], budget, slots, cur: null, bid: 0, leader: null, ms: 0, last: null, n: 0, total: 0, ranking: []};
  }
  push() { this.s.ms = Math.max(0, this.endsAt - Date.now()); this.send(this.s); }
  join(id, name) {
    if (this.s.phase === 'lobby' && !this.s.players.some(p => p.id === id))
      this.s.players.push({id, name: (name || 'Joueur').slice(0, 16), budget: this.s.budget, team: []});
    this.push();
  }
  leave(id) { if (this.s.phase === 'lobby') { this.s.players = this.s.players.filter(p => p.id !== id); this.push(); } }
  start() {
    const s = this.s;
    this.queue = shuffle([...this.pool]).slice(0, s.players.length * s.slots + 3);
    s.total = this.queue.length; this.next();
  }
  next() {
    const s = this.s;
    if (!this.queue.length || !s.players.some(p => p.team.length < s.slots)) return this.finish();
    s.cur = this.queue.shift(); s.n++; s.bid = 0; s.leader = null; s.phase = 'auction';
    this.endsAt = Date.now() + DURATION; this.push(); this.tick();
  }
  tick() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => Date.now() >= this.endsAt ? this.close() : this.tick(), 200);
  }
  bid(id, amount) {
    const s = this.s, p = s.players.find(x => x.id === id);
    if (s.phase !== 'auction' || !p || !Number.isFinite(amount)) return;
    if (amount < s.bid + MIN_STEP || amount > p.budget || p.team.length >= s.slots) return;
    s.bid = Math.floor(amount); s.leader = id;
    if (this.endsAt - Date.now() < SNIPE) this.endsAt = Date.now() + SNIPE; // anti-snipe
    this.push();
  }
  close() {
    const s = this.s, p = s.players.find(x => x.id === s.leader);
    if (p) { p.budget -= s.bid; p.team.push({...s.cur, price: s.bid}); }
    s.last = {char: s.cur, leader: p?.name || null, price: s.bid}; s.phase = 'sold'; this.endsAt = 0;
    this.push(); setTimeout(() => this.next(), SOLD_PAUSE);
  }
  finish() {
    const s = this.s; s.phase = 'end'; s.cur = null;
    s.ranking = s.players.map(p => ({...p, score: p.team.reduce((a, c) => a + (TIER_PTS[c.tier] || 0), 0) + Math.floor(p.budget / 100)}))
      .sort((a, b) => b.score - a.score);
    this.push();
  }
}
