# Mini-Jeux entre potes
Plateforme de mini-jeux P2P (PeerJS/WebRTC) pour GitHub Pages, sans serveur de jeu.

## Déployer
Push sur GitHub, puis Settings > Pages > branche `main`, dossier `/ (root)`.

## Ajouter un anime
Dépose `monanime.json` dans `data/anime/` :
`{"id":"monanime","name":"Mon Anime","characters":[{"name":"Perso","tier":3,"image":"url optionnelle"}]}`
(tier de 1 à 5). Le workflow GitHub met `index.json` à jour tout seul ; sinon ajoute le nom du fichier à la main.
Un fichier invalide est simplement ignoré.

## Ajouter un jeu
Crée `js/games/monjeu.js` et appelle `loadCharacters(ids)` depuis `js/characters.js`.

## Tester en local
`python -m http.server` puis http://localhost:8000 (les modules ES ne marchent pas en file://).
