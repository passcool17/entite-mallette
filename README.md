# La mallette de l’Entité

Simulateur web (PWA, téléphone d’abord, portrait 412×915 et paysage 915×412) de la mallette de désamorçage
ESP32 de PassCool_17, dans une valise Lykus HC-3010. Un seul joueur, aucune aide écrite : l’Entité dicte tout
à voix haute, ment, et presse pendant que tu choisis.

Lien : https://passcool17.github.io/entite-mallette/

Archive figée de la v0.1.5 (commit db2b57ad) : https://passcool17.github.io/entite-mallette-v015/
(dépôt passcool17/entite-mallette-v015, cache séparé `entite-mallette-v015-0.1.5`).

## Version 0.2.1 (23 nov. 2026)

Tout est dans la valise : une seule vue, la mallette ouverte, sans onglet et sans aucune pièce sur la coque extérieure.
Le jeu démarre directement mallette ouverte.

- **Couvercle (vue intérieure, panneau 273×169, 32 mm)**
  - En haut, symétrique : haut-parleur gauche `SPK-L` (3 W 8 Ω) | CYD 1, l’œil de l’Entité, au centre | haut-parleur droit `SPK-R`.
    Les deux grilles pulsent quand l’Entité parle.
  - Barre WS2812B de 8 LED sur toute la largeur.
  - Bouton « Réécouter » (≥ 44 px), pochette fine (note tactique), plaque de série rivetée.
  - Baie de 5 fiches banane Keadic (rouge, noir, bleu, jaune, vert).
- **Base (83 mm)** : TM1637 + OLED, 4 encodeurs KY-040, CYD 2 + joystick (labyrinthe ; l’Entité peut inverser les axes),
  clavier membrane 4×4 seul, 3 trappes SG90 (A, B, C), 3 serrures à clé Gebildet (I, II, III),
  et deux **leviers à capot** : bleu `ARM` (armement) et rouge `TRANSMIT` (fin de partie).
  Il n’y a plus de bouton rond TRANSMIT ni de haut-parleur dans la base.

Levier à capot : toucher le capot pour le lever, puis toucher le levier pour le basculer.
Basculer le levier rouge avant l’étape 12 coûte −8 s et 1 erreur (le levier retombe) ; l’Entité pousse à le faire.

### Mise en page

La mallette tient entière dans l’écran, sans défiler, sans chevauchement :

- Portrait 412×915 : bandeau compact, couvercle (haut-parleurs + œil, barre LED, Réécouter / Pochette / série, fiches),
  puis la base : TM1637 + OLED et encodeurs, CYD 2 + joystick | serrures, clavier 4×4 | trappes et leviers à capot.
- Paysage 915×412 et bureau 1280×800 : couvercle à gauche, base à droite en trois colonnes.
- Écrans plus courts : la page défile et une pastille « ↓ COMMANDES » s’affiche tant que le bas n’est pas visible.
- Bandeau : « PROB. ÉCHEC » (probabilité d’échec).

Il n’y a pas de lecteur RFID, pas de badge, pas de manuel, pas de mode à deux joueurs et pas de mode facile.

### Règle de base : rien d’écrit

Aucun code, aucune réponse et aucune consigne n’est écrit à l’écran. Les indices sont dictés
(voix ElevenLabs pour l’intro et le départ, voix française de l’appareil, grave et lente, pour le reste),
et l’œil comme la forme d’onde pulsent avec la voix. « Réécouter » sur le CYD 1 redit le dernier indice.
Une courte légende silencieuse s’affiche seulement si la synthèse vocale est absente ou si le son est coupé.

**Œil rouge = mensonge.** Pendant que tu choisis, l’Entité affirme des choses fausses (« C’était 7…, dépêche-toi »,
« Débranche le bleu avant que ça saute ! », « Bascule le levier rouge maintenant ! »), allume de faux repères,
accélère le tic-tac si tu hésites (15 s sans geste : chrono ×1,6), et pousse vers les mauvais raccourcis
(levier rouge trop tôt, mauvaise fiche, mauvais encodeur, joystick inversé).

### Déroulé (8 minutes, 12 étapes après l’armement)

Armement : lever le capot bleu puis basculer le levier ARM. Le chrono part.

1. Encodeurs (fragment 1) · 2. Trappe · 3. Séquence lumineuse sur la barre, retapée au clavier (fragment 2) ·
4. Fiches banane (fragment 3) · 5. Labyrinthe (fragment 4) · 6. Code 1 au clavier — une trappe libère les clés ·
7. Serrures à clé (I, II, III), dans le bon ordre · 8. Encodeurs, couche 2 · 9. Labyrinthe saboté (axes inversés par moments) ·
10. Fiches, couche 2 · 11. Code 2 · 12. Lever le capot rouge et basculer le levier TRANSMIT.

Erreur : −5 s ou −8 s et +3,2 % d’échec. Avertissements à 30 s et 10 s ; à zéro, la mallette saute.
Deux paliers cachés (moyen-difficile, difficile) tirés ~50/50 ; les règles changent selon le palier
(ordre inversé, fréquence rare, etc.) et se déduisent de ce qui est dicté et du n° de série.

### Paramètres d’URL

- `?seed=N` : partie reproductible (même palier, même série, mêmes réponses).
- `?debug=1` : expose `window.__entiteDebug` (run, state, face, voiceLog, voiceStats, musicStats,
  ttsAvailable, forceSabotage(on), idle(ms)) pour les tests.

## Voix : `voix/manifest.json`

Toutes les répliques (59) sont listées dans `voix/manifest.json`. Chaque entrée :

| champ | sens |
|---|---|
| `id` | identifiant (ex. `clue_code1`, `chiffre_7`, `taunt_debranche`) |
| `file` | `voix/<id>.mp3` |
| `dfplayerTrack` | numéro de piste DFPlayer Mini (`0001`, `0002`, …) pour la vraie mallette |
| `category` | `intro`, `clue`, `digit`, `color`, `taunt`, `sabotage`, `outcome` |
| `source` | `elevenlabs`, `placeholder` ou `tts` |
| `mp3Ready` | `true` seulement si le mp3 existe vraiment |
| `text` | texte français exact à enregistrer |

Une phrase du jeu est une réplique seule ou une suite d’ids (ex. `clue_code1` + `chiffre_4` + `chiffre_9` …).
Si toutes les répliques d’une suite ont `mp3Ready: true`, les mp3 sont joués (repli sur la synthèse en cas d’échec) ;
sinon la phrase est dite directement par la synthèse vocale. Aucun mp3 non prêt n’est demandé (0 erreur 404).

Aujourd’hui seuls `intro` (41318 octets) et `depart` (63783 octets), voix ElevenLabs d’origine, sont prêts.
Pour ajouter une voix : enregistrer `voix/<id>.mp3` avec le texte exact, passer `mp3Ready` à `true`
et `source` à `elevenlabs`, puis monter la version du service worker. Les fichiers numérotés `dfplayerTrack`
se copient tels quels sur la carte SD du DFPlayer (`0001.mp3`, …).

`voix/voix.json` (ancienne liste) est gardé pour compatibilité. `voix/raw/` et `voix/_test/` restent locaux,
jamais publiés.

## Fichiers

- `index.html`, `css/app.css` : interface et rendu de la mallette.
- `js/app.js` : déroulé, gestes, pression de l’Entité, boucle.
- `js/game.js` : tirage d’une partie (graine mulberry32, paliers, réponses, mensonges, labyrinthes).
- `js/panel-config.js` : cotes Lykus HC-3010 (extérieur 335×260×130, intérieur 300×200×120, base 83, couvercle 32,
  panneau 273×169 en deux moitiés 136,5×169) et implantation des pièces : tout dans le couvercle (`lid`) ou la base (`base`),
  2 haut-parleurs `SPK-L` / `SPK-R` de part et d’autre du CYD 1 centré, aucune pièce sur la coque.
- `js/audio.js`, `js/voice-manifest.js`, `js/sfx.js`, `js/eye.js`, `js/preload.js` : voix, sons, œil, préchargement.
- `audio/tension.mp3` (192827 octets) : musique de tension.
- `sw.js` : service worker, cache `entite-mallette-v0.2.1` (manifeste des voix inclus). À l’activation, les anciens
  caches `entite-mallette-*` (dont `entite-mallette-v0.2.0-r2`, `entite-mallette-v0.2.0` et `entite-mallette-v0.1.5-base`) sont supprimés, sauf ceux des archives (`entite-mallette-v015-*`, `entite-mallette-v016-*`).

## Tests

```
python3 -m http.server 8794 --bind 127.0.0.1 &
node tests/v021.mjs            # ou : node tests/v021.mjs <base> <graine>
```

`tests/v021.mjs` (Playwright) joue une partie complète (graine 42) en portrait puis vérifie le paysage et le bureau :
aucun onglet Dessus/Flanc, aucun bouton TRANSMIT rond, plaque de série + 5 fiches + 3 serrures + 2 leviers à capot
+ 2 haut-parleurs dans la valise et dans le premier écran (412×915, 915×412, 1280×800, sans chevauchement ni défilement),
couvercle symétrique, levier rouge trop tôt = −8 s + 1 erreur, joystick 4 directions × 2 orientations (normal + sabotage),
aucun code écrit, mensonges (œil rouge), hésitation ×1,6, victoire, tailles des mp3, manifeste propre, cache du service worker,
pastille de défilement en 360×600, 0 erreur console/réseau.
Captures dans `/workspace/qa/entite-mallette/v0.2.1-dev/` (`01-mallette-412.png`, `02-mallette-915x412.png`, `03-mallette-1280x800.png`).
`tests/v020.mjs` concerne la v0.2.0 (trois faces). Les anciens tests (`tests/v011*.mjs` … `v015`, `paliers.mjs`, `run.mjs`) concernent la v0.1.x.

## Historique

- 0.2.1 : une seule vue, tout dans la valise ; haut-parleurs de part et d’autre de l’œil ; leviers à capot à la place du bouton TRANSMIT.
- 0.2.0 : refonte « Cool Escape Props » en trois faces (Dessus, Flanc, Mallette). Plus de lecteur RFID, plus d’éléments Keep Talking.
- 0.1.5 : 12 étapes en deux couches, 8 minutes (archivée sur entite-mallette-v015).
- 0.1.6 : énigmes de logique visuelle (archivée sur entite-mallette-v016).
- 0.1.4 et avant : déductions depuis le n° de série, mensonges, plein écran, musique, graines.
