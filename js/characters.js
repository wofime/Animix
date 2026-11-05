// Chargeur de persos PARTAGÉ : tous les mini-jeux l'utilisent.
// Format d'un fichier : { id, name, characters:[{name, tier(1-5), image?}] }
const BASE = 'data/anime/';
export async function listAnimes() {
  const files = await (await fetch(BASE + 'index.json')).json();
  const out = [];
  for (const f of files) {
    try {
      const d = await (await fetch(BASE + f)).json();
      if (d?.name && Array.isArray(d.characters)) out.push({...d, id: d.id || f.replace('.json', '')});
    } catch (e) { console.warn('JSON ignoré :', f, e); } // un fichier cassé ne casse rien
  }
  return out;
}
/** Tous les persos des animes choisis (ids), ou de tous si ids = null. */
export async function loadCharacters(ids = null) {
  const all = await listAnimes();
  return all.filter(a => !ids || ids.includes(a.id))
    .flatMap(a => a.characters.map(c => ({tier: 3, ...c, anime: a.name, animeId: a.id})));
}
export const pickRandom = (chars, n) => shuffle([...chars]).slice(0, n);
export function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
