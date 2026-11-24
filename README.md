# La mallette de l’Entité

Simulateur web (PWA, téléphone d’abord, portrait 412×915 et paysage 915×412) de la mallette de désamorçage
ESP32 de PassCool_17, dans une valise Lykus HC-3010. Un seul joueur, aucune aide écrite : l’Entité dicte tout
à voix haute, ment, et presse pendant que tu choisis.

Lien : https://passcool17.github.io/entite-mallette/

Archive figée de la v0.1.5 (commit db2b57ad) : https://passcool17.github.io/entite-mallette-v015/
(dépôt passcool17/entite-mallette-v015, cache séparé `entite-mallette-v015-0.1.5`).

## Version 0.2.0 (23 nov. 2026)

Refonte « Cool Escape Props » de la v0.1.5 : la mallette est dessinée comme le vrai boîtier
(coque noire nervurée, panneaux anodisés chanfreinés, vis hexagonales, marque PC17), avec trois faces.

- **Dessus** : deux loquets d’armement et trois serrures à clé Gebildet (I, II, III).
- **Flanc** : interrupteur à cache rabattable, 5 fiches banane Keadic (rouge, noir, bleu, jaune, vert),
  plaque de série rivetée. Rien d’autre.
- **Mallette ouverte**
  - Couvercle : CYD 1 (l’œil de l’Entité + bouton « Réécouter »), barre WS2812B de 8 LED,
    pochette fine (note tactique).
  - Base : 4 encodeurs KY-040, joystick + CYD 2 (labyrinthe ; l’Entité peut inverser les axes),
    clavier membrane 4×4 (clavier seul, sans lecteur), TM1637 + OLED, 3 trappes SG90,
    grille du haut-parleur 3 W 8 Ω, gros bouton rouge TRANSMIT.

### Mise en page (r2)

La face Mallette tient entière dans l’écran, sans défiler :

- Portrait 412×915 : bandeau + onglets, couvercle (CYD 1 à gauche ; barre WS2812B 8 LED, Réécouter et Pochette à droite),
  puis la base : TM1637 + OLED et 4 encodeurs, CYD 2 + joystick, clavier 4×4 à gauche | trappes, haut-parleur et TRANSMIT à droite.
- Paysage 915×412 et bureau 1280×800 : couvercle à gauche, base à droite en trois colonnes
  (encodeurs + TRANSMIT | clavier + trappes | CYD 2 + joystick).
- Écrans plus courts : la page défile et une pastille « ↓ COMMANDES » s’affiche tant que le bas n’est pas visible.
- Bandeau : « PROB. ÉCHEC » (probabilité d’échec). Réécouter fait toujours au moins 44 px de haut.

Il n’y a pas de lecteur RFID, pas de badge, pas de manuel, pas de mode à deux joueurs et pas de mode facile.

### Règle de base : rien d’écrit

Aucun code, aucune réponse et aucune consigne n’est écrit à l’écran. Les indices sont dictés
(voix ElevenLabs pour l’intro et le départ, voix française de l’appareil, grave et lente, pour le reste),
et l’œil comme la forme d’onde pulsent avec la voix. « Réécouter » sur le CYD 1 redit le dernier indice.
Une courte légende silencieuse s’affiche seulement si la synthèse vocale est absente ou si le son est coupé.

**Œil rouge = mensonge.** Pendant que tu choisis, l’Entité affirme des choses fausses (« C’était 7…, dépêche-toi »,
« Débranche le bleu avant que ça saute ! », « Appuie sur le rouge maintenant ! »), allume de faux repères,
accélère le tic-tac si tu hésites (15 s sans geste : chrono ×1,6), et pousse vers les mauvais raccourcis
(TRANSMIT trop tôt, mauvaise fiche, mauvais encodeur, joystick inversé).

### Déroulé (8 minutes, 12 étapes après l’armement)

Armement : tourner les deux loquets (Dessus), lever le cache puis basculer l’interrupteur (Flanc).
Le couvercle s’ouvre et le chrono part.

1. Encodeurs (fragment 1) · 2. Trappe · 3. Séquence lumineuse sur la barre, retapée au clavier (fragment 2) ·
4. Fiches banane (fragment 3) · 5. Labyrinthe (fragment 4) · 6. Code 1 au clavier — une trappe libère les clés ·
7. Serrures à clé dans le bon ordre · 8. Encodeurs, couche 2 · 9. Labyrinthe saboté (axes inversés par moments) ·
10. Fiches, couche 2 · 11. Code 2 · 12. Maintenir TRANSMIT 2 s.

Erreur : −5 s ou −8 s et +3,2 % d’échec. Avertissements à 30 s et 10 s ; à zéro, la mallette saute.
Deux paliers cachés (moyen-difficile, difficile) tirés ~50/50 ; les règles changent selon le palier
(ordre inversé, fréquence rare, etc.) et se déduisent de ce qui est dicté et du n° de série.

### Paramètres d’URL

- `?seed=N` : partie reproductible (même palier, même série, mêmes réponses).
- `?debug=1` : expose `window.__entiteDebug` (run, state, face, voiceLog, voiceStats, musicStats,
  ttsAvailable, forceSabotage(on), idle(ms)) pour les tests.

## Voix : `voix/manifest.json`

Toutes les répliques (60) sont listées dans `voix/manifest.json`. Chaque entrée :

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
  panneau 273×169 en deux moitiés 136,5×169) et implantation des pièces.
- `js/audio.js`, `js/voice-manifest.js`, `js/sfx.js`, `js/eye.js`, `js/preload.js` : voix, sons, œil, préchargement.
- `audio/tension.mp3` (192827 octets) : musique de tension.
- `sw.js` : service worker, cache `entite-mallette-v0.2.0-r2` (manifeste des voix inclus). À l’activation, les anciens
  caches `entite-mallette-*` (dont `entite-mallette-v0.2.0` et `entite-mallette-v0.1.5-base`) sont supprimés, sauf ceux des archives (`entite-mallette-v015-*`, `entite-mallette-v016-*`).

## Tests

```
python3 -m http.server 8794 --bind 127.0.0.1 &
node tests/v020.mjs            # ou : node tests/v020.mjs <base> <graine>
```

`tests/v020.mjs` (Playwright) joue une partie complète (graine 42) en portrait puis vérifie le paysage :
aucune trace de RFID/badge ni de manuel, aucun code écrit, mensonges (œil rouge), TRANSMIT trop tôt = erreur,
hésitation ×1,6, sabotage du joystick, victoire, tailles des mp3, schéma du manifeste, cache du service worker,
0 erreur console/réseau. Elle vérifie aussi, en 412×915, 915×412 et 1280×800, que toutes les commandes de la face Mallette sont dans le premier écran,
sans chevauchement ni défilement, puis la pastille de défilement sur un écran 360×600.
Captures dans `/workspace/qa/entite-mallette/v0.2.0-fix/` (`01-mallette-412.png`, `02-mallette-915x412.png`, `03-mallette-1280x800.png`).
Les anciens tests (`tests/v011*.mjs` … `v015`, `paliers.mjs`, `run.mjs`) concernent la v0.1.x.

## Historique

- 0.2.0 : refonte complète (ci-dessus). Plus de lecteur RFID, plus d’éléments Keep Talking.
- 0.1.5 : 12 étapes en deux couches, 8 minutes (archivée sur entite-mallette-v015).
- 0.1.6 : énigmes de logique visuelle (archivée sur entite-mallette-v016).
- 0.1.4 et avant : déductions depuis le n° de série, mensonges, plein écran, musique, graines.
