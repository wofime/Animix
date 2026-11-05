// Mercato au tour par tour : logique AUTORITAIRE exécutée uniquement chez l'hôte.
// Chaque lot : un "ouvreur" (qui change à chaque lot) est OBLIGÉ de le prendre à la mise minimale.
// Ensuite les autres jouent à tour de rôle : surenchérir ou passer (passer = définitif pour ce lot).
// Le lot est vendu quand plus personne ne peut/veut surenchérir. Pas de chrono.
import { shuffle } from '../characters.js';
const SOLD_PAUSE = 3500, MIN_STEP = 10, OPEN = 10;
export const TIER_PTS = {1: 10, 2: 20, 3: 30, 4: 45, 5: 60};

export class MercatoHost {
  constructor({pool, budget = 1000, slots = 5, send}) {
    this.pool = pool; this.queue = []; this.send = send; this.openIdx = 0;
    this.s = {phase: 'lobby', players: [], budget, slots, cur: null, bid: 0, leader: null, opener: null, turn: null, passed: [], last: null, n: 0, total: 0, ranking: []};
  }
  push() { this.send(this.s); }
  can(p) { return p.team.length < this.s.slots; }
  idx(id) { return this.s.players.findIndex(p => p.id === id); }
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
    const s = this.s, P = s.players;
    if (!this.queue.length || !P.some(p => this.can(p))) return this.finish();
    let k = -1; // ouvreur : tourne à chaque lot, en sautant ceux qui ne peuvent pas ouvrir
    for (let i = 0; i < P.length; i++) { const j = (this.openIdx + i) % P.length; if (this.can(P[j]) && P[j].budget >= OPEN) { k = j; break; } }
    if (k < 0) { this.queue.shift(); return this.next(); } // personne ne peut ouvrir : lot ignoré
    this.openIdx = (k + 1) % P.length;
    s.cur = this.queue.shift(); s.n++; s.phase = 'auction'; s.bid = OPEN; s.leader = s.opener = P[k].id; s.passed = [];
    this.advance(k);
  }
  // Donne la main au prochain joueur qui peut et veut surenchérir ; sinon vend.
  advance(from) {
    const s = this.s, P = s.players;
    for (let i = 1; i <= P.length; i++) {
      const p = P[(from + i) % P.length];
      if (p.id !== s.leader && !s.passed.includes(p.id) && this.can(p) && p.budget >= s.bid + MIN_STEP) { s.turn = p.id; return this.push(); }
    }
    this.close();
  }
  bid(id, amount) {
    const s = this.s, p = s.players.find(x => x.id === id);
    if (s.phase !== 'auction' || s.turn !== id || !Number.isFinite(amount)) return;
    if (amount < s.bid + MIN_STEP || amount > p.budget) return;
    s.bid = Math.floor(amount); s.leader = id; this.advance(this.idx(id));
  }
  pass(id) {
    const s = this.s;
    if (s.phase !== 'auction' || s.turn !== id) return;
    s.passed.push(id); this.advance(this.idx(id));
  }
  close() {
    const s = this.s, p = s.players.find(x => x.id === s.leader);
    p.budget -= s.bid; p.team.push({...s.cur, price: s.bid});
    s.last = {char: s.cur, leader: p.name, price: s.bid}; s.phase = 'sold'; s.turn = null;
    this.push(); setTimeout(() => this.next(), SOLD_PAUSE);
  }
  finish() {
    const s = this.s; s.phase = 'end'; s.cur = null; s.turn = null;
    s.ranking = s.players.map(p => ({...p, score: p.team.reduce((a, c) => a + (TIER_PTS[c.tier] || 0), 0) + Math.floor(p.budget / 100)}))
      .sort((a, b) => b.score - a.score);
    this.push();
  }
}
