import { Room } from './p2p.js';
import { listAnimes, loadCharacters } from './characters.js';
import { MercatoHost, TIER_PTS } from './games/mercato.js';

const app = document.getElementById('app');
const room = new Room();
let game = null, S = null, me = null, animes = [], name = localStorage.mjName || '';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const stars = n => '★'.repeat(n) + '☆'.repeat(5 - n);
const pic = c => `<div class="pic">${c.image ? `<img src="${esc(c.image)}" alt="" onerror="this.remove()">` : esc(c.name[0])}</div>`;
const toast = m => { const t = document.getElementById('toast'); t.textContent = m; t.className = 'on'; setTimeout(() => t.className = '', 2500); };
const teamHtml = t => t.length ? t.map(c => `${esc(c.name)} <small>${c.price}M</small>`).join(' · ') : '—';

async function home() {
  animes = await listAnimes();
  app.innerHTML = `
  <section class="card"><h2>Ton pseudo</h2><input type="text" id="name" maxlength="16" placeholder="Pseudo" value="${esc(name)}"></section>
  <section class="card"><h2>Créer un salon Mercato</h2>
    <h3>Univers</h3><div class="row chips">${animes.map(a => `<label><input type="checkbox" value="${esc(a.id)}" checked> ${esc(a.name)} (${a.characters.length})</label>`).join('')}</div>
    <div class="row"><div><h3>Budget (M)</h3><input type="number" id="budget" value="1000" min="100" step="100"></div>
    <div><h3>Persos par joueur</h3><input type="number" id="slots" value="5" min="1" max="15"></div></div>
    <button id="create">Créer le salon</button></section>
  <section class="card"><h2>Rejoindre un salon</h2><input type="text" id="code" maxlength="4" placeholder="Code à 4 lettres" style="text-transform:uppercase"><button id="join">Rejoindre</button></section>`;
  const getName = () => { name = document.getElementById('name').value.trim() || 'Joueur'; localStorage.mjName = name; return name; };
  document.getElementById('create').onclick = async () => {
    const ids = [...app.querySelectorAll('.chips input:checked')].map(i => i.value);
    const pool = await loadCharacters(ids);
    if (pool.length < 4) return toast('Choisis au moins un univers');
    try { await room.host(); } catch (e) { return toast(e.message || 'Connexion P2P impossible'); }
    me = room.id;
    game = new MercatoHost({pool, budget: +document.getElementById('budget').value, slots: +document.getElementById('slots').value,
      send: s => { room.broadcast({t: 's', s}); setState(s); }});
    room.onmsg = (d, id) => { if (d.t === 'join') game.join(id, d.name); if (d.t === 'bid') game.bid(id, d.amount); if (d.t === 'pass') game.pass(id); };
    room.onleave = id => game.leave(id);
    game.join(me, getName());
  };
  document.getElementById('join').onclick = async () => {
    toast('Connexion…'); try { await room.join(document.getElementById('code').value); } catch (e) { return toast(e.message); }
    me = room.id; room.onmsg = d => d.t === 's' && setState(d.s);
    room.onclose = () => { toast('Connexion perdue'); setTimeout(() => location.reload(), 1500); };
    room.send({t: 'join', name: getName()});
  };
}

function setState(s) { S = s; document.getElementById('roomtag').textContent = 'Salon ' + room.code; render(); }
function placeBid(inc) { const amt = S.bid + inc; room.isHost ? game.bid(me, amt) : room.send({t: 'bid', amount: amt}); }

function pass() { room.isHost ? game.pass(me) : room.send({t: 'pass'}); }

function render() {
  const mine = S.players.find(p => p.id === me);
  if (!mine) { app.innerHTML = '<section class="card"><h2>Partie déjà lancée</h2><p class="tm">Attends la prochaine draft.</p></section>'; return; }
  if (S.phase === 'lobby') {
    app.innerHTML = `<section class="card"><h3>Code du salon</h3><div class="code">${room.code}</div>
      <p class="tm">${S.budget}M chacun, ${S.slots} persos à recruter.</p></section>
      <section class="card"><h2>Joueurs (${S.players.length})</h2>${S.players.map(p => `<div class="pl"><span>${esc(p.name)}</span><span>${p.id === me ? 'toi' : ''}</span></div>`).join('')}
      ${room.isHost ? '<button id="go">Lancer la draft</button>' : '<p class="tm">En attente de l\'hôte…</p>'}</section>`;
    document.getElementById('go')?.addEventListener('click', () => game.start());
  } else if (S.phase === 'auction' || S.phase === 'sold') {
    const auction = S.phase === 'auction', c = S.cur || S.last.char, full = mine.team.length >= S.slots;
    const lead = S.players.find(p => p.id === S.leader);
    app.innerHTML = `<section class="card lot"><h3>Lot ${S.n}/${S.total}</h3>${pic(c)}
      <h2>${esc(c.name)}</h2><div class="tm">${esc(c.anime)}</div><div class="tier">${stars(c.tier)}</div>
      ${auction ? `<div class="bid">${S.bid}M</div><div>${lead ? (lead.id === me ? '<b style="color:var(--ok)">Tu mènes</b>' : esc(lead.name)) : 'Aucune mise'}</div>
      <div class="tm">Ouvert par ${esc(S.players.find(p => p.id === S.opener)?.name)} (obligatoire à ${S.bid > 10 ? 10 : S.bid}M)</div>
      <div>${S.turn === me ? '<b style="color:var(--ok)">À toi de jouer</b>' : 'Tour de ' + esc(S.players.find(p => p.id === S.turn)?.name || '')}</div>` : `<div class="sold">${S.last.leader ? `Vendu à <b>${esc(S.last.leader)}</b> · ${S.last.price}M` : 'Invendu'}</div>`}</section>
      ${auction ? `<section class="card"><div class="me">Ton solde : <b>${mine.budget}M</b> · ${mine.team.length}/${S.slots} persos</div>
      <div class="row">${[10, 50, 100, 250].map(i => `<button data-i="${i}" ${S.turn !== me || S.bid + i > mine.budget ? 'disabled' : ''}>+${i}</button>`).join('')}<button class="ghost" id="pass" ${S.turn !== me ? 'disabled' : ''}>Passer</button></div></section>` : ''}
      <section class="card"><h3>Équipes</h3>${S.players.map(p => `<div class="pl ${p.id === me ? 'mine' : ''}"><span><b>${esc(p.name)}</b> · ${p.budget}M<br><span class="tm">${teamHtml(p.team)}</span></span></div>`).join('')}</section>`;
    app.querySelectorAll('[data-i]').forEach(b => b.onclick = () => placeBid(+b.dataset.i));
    document.getElementById('pass')?.addEventListener('click', pass);
  } else {
    app.innerHTML = `<section class="card"><h2>Résultats de la draft</h2>${S.ranking.map((p, i) => `
      <div class="pl ${p.id === me ? 'mine' : ''}"><span>${['🥇', '🥈', '🥉'][i] || (i + 1) + '.'} <b>${esc(p.name)}</b><br><span class="tm">${teamHtml(p.team)}</span></span><b>${p.score} pts</b></div>`).join('')}
      <p class="tm">Score = points de tier (${Object.values(TIER_PTS).join('/')}) + 1 pt par 100M restants.</p>
      <button class="ghost" onclick="location.reload()">Rejouer</button></section>`;
  }
}

home();
