# La mallette de l’Entité

Simulateur web (PWA, téléphone d’abord, portrait 412×915 et paysage 915×412) de la mallette de désamorçage
ESP32 de PassCool_17, dans une valise Lykus HC-3010. Un seul joueur : l’Entité dicte tout à voix haute, ment, et
presse pendant que tu choisis. Aucune réponse calculée n’est écrite (sauf `?debug=1`) ; l’objectif de l’étape (quoi faire, quel module) l’est, et à l’étape 10 le bandeau reprend la consigne de câblage dictée.

Lien : https://passcool17.github.io/entite-mallette/

Archive figée de la v0.1.5 (commit db2b57ad) : https://passcool17.github.io/entite-mallette-v015/
(dépôt passcool17/entite-mallette-v015, cache séparé `entite-mallette-v015-0.1.5`).

## Version 0.2.5 (24 nov. 2026)

État : en ligne sur https://passcool17.github.io/entite-mallette/ (cache `entite-mallette-v0.2.5`, imports `?v=0.2.5`).

- **Étape 10, bandeau clair** : plus de « Rebranche les câbles : nouvelle consigne. ». Le bandeau affiche la consigne
  exacte dictée par l’Entité (couleur du câble et prise, ou rang d’une lettre sur la plaque), et reste visible jusqu’à
  la réussite. Ce n’est pas une réponse calculée : c’est le même indice que la voix. Le bouton « Indice » fonctionne
  comme aux autres étapes (gratuit à 45 s, puis −15 s, puis −30 s). Les autres bandeaux, déjà assez clairs, sont inchangés.
- **Voix : 172 mp3 branchés, synthèse en secours** : les 170 nouvelles répliques (Piper `fr_FR-tom-medium`, recette v2,
  liste et mesures dans `voix/NOUVELLES-v0.2.4.md` et `voix/verification-v0.2.4.json`) sont jouées en fichier. `intro` et
  `depart` restent les voix ElevenLabs d’origine. Une phrase assemblée (étape 10, fragments de code, lettres…) enchaîne
  les mp3 dans l’ordre. Si un fichier manque ou échoue, ce morceau bascule en synthèse française. Le tutoriel et la
  jauge batterie n’ont pas de réplique parlée (inchangé). Les 170 ids restent documentés dans `voix/A-ENREGISTRER-v0.2.5.md`.
  Les 170 mp3 ne sont pas dans le précache du service worker (comme avant : seulement `intro`, `depart` et `tension.mp3`) ;
  le préchargement les tire depuis le manifeste.

### Toujours vrai
Rotatifs E1–E4 = lettres seulement, chiffres au clavier 4×4, baie banane 5×5 (5 couleurs, glisser + toucher), ECG sur le
CYD 2 (labyrinthe aux étapes 5 et 9), tout dans la valise ouverte. Les archives v0.1.5 / v0.1.6 ne sont pas touchées.

### Prochaines étapes
- Test sur le vrai S20 FE (lisibilité du bandeau étape 10, enchaînement des fragments, son).

## Version 0.2.4 (24 nov. 2026)

État : en ligne sur https://passcool17.github.io/entite-mallette/ (cache `entite-mallette-v0.2.4`, imports `?v=0.2.4`).

### Clarté (priorité, retour de Pascal : « on reste bloqué sans savoir quoi faire »)
- **Bandeau objectif** sous le chrono (portrait) ou dans la barre du haut (paysage / bureau) : « Étape N/12 » + une phrase
  courte qui dit QUOI faire et OÙ (ex. « Branche les câbles dans les bonnes prises. », « Tape le code sur le clavier. »).
  L’Entité dit la même phrase avant chaque consigne ; « Réécouter » rejoue objectif + consigne. Jamais de solution écrite
  (aucun chiffre, lettre ou couleur de réponse ; testé sur les 12 étapes).
- **Module actif** : le ou les modules de l’étape pulsent en bleu (contour statique si « mouvement réduit »). Un leurre
  de l’Entité ne brille jamais ; quand l’œil est rouge, le contour reste sur le vrai module.
- **Indices** : niveau 1 automatique et gratuit après 45 s sans progrès (où regarder : « Regarde la plaque de série »…) ;
  bouton « Indice » (44 px, coût affiché) : niveau 2 = la règle expliquée pas à pas (−15 s ; aux étapes de code, rappel
  des vrais fragments), niveau 3 = un morceau de la réponse DIT à voix haute, jamais écrit (première lettre, premier
  chiffre, premier geste, première direction, bonne trappe…) (−30 s). Le bandeau ne montre que la source de l’indice.
- **Tutoriel** au premier lancement (5 écrans, « Passer » 44 px, retenu dans `localStorage`), rejouable via « Comment jouer ».
- **Retours** : bonne action = module flashé en vert + bip + DEL de progression + « Étape N/12 franchie · Bien. » ; erreur =
  flash rouge + vibration + « Faux · −8 s » + réplique de l’Entité.
- **Correctif voix** : une réplique « tout de suite » (mensonge, erreur, indice) ne peut plus effacer une consigne : la
  consigne coupée est redite juste après (avant, un mensonge pendant `depart.mp3` pouvait faire disparaître la consigne
  de l’étape 1).

### Son mixé comme le vrai matériel (ESP32 → I2S → 2 × MAX98357A → SPK-L / SPK-R)
- Un seul graphe WebAudio : bus voix, bus musique (boucle `audio/tension.mp3` + basse pulsée), bus effets, chacun dans
  un panoramique stéréo (L/R), puis volume général → limiteur (DynamicsCompressor −10 dB, ratio 12) → sortie.
- La voix passe PAR-DESSUS la musique : la boucle continue, baissée de **−8 dB (×0,398)**, attaque **150 ms**, relâche
  **400 ms** (mp3 : au début de la lecture ; synthèse française : sur `onstart` / `onend`, secours à 700 ms). Les bips
  passent au-dessus. Contexte audio relancé au premier geste (mobile).
- Bouton son conservé ; muet + volume gardés dans `localStorage` (`entite-son`).

### Jauge batterie (CYD 1, coin haut droit)
- Batterie réelle : Mspalocell 12 V 5600 mAh Li-ion 3S (12,6 V pleine, ~9,0 V vide, 67,2 Wh). Icône + % (+ tension en
  paysage / bureau), tension tirée d’une courbe OCV Li-ion réaliste ×3 (100 % 12,6 V · 50 % 11,4 V · 15 % 10,7 V · 0 % 9,0 V).
- Simulation accélérée : −0,5 %/min en partie (≈ −4 % sur 8 min), −0,1 %/min hors partie ; −0,3 % par servo / trappe,
  −0,5 % par sabotage, −1 % à l’explosion. Vert ≥ 40 %, ambre, rouge < 15 % : icône qui clignote + un bip discret, une fois,
  aucune pénalité.
- `localStorage` `entite-batterie` : continue de baisser d’une session à l’autre ; ≤ 5 % → rechargée à 100 % à l’ouverture ;
  nouveau jour (ou première visite) → 62-100 % au hasard. `?debug=1&batt=12` force un niveau.

### Paliers et variantes
- Chaque partie tire **moyen** ou **difficile** (~50/50, caché ; `?debug=1` l’affiche ; `?seed=N` reproductible).
- 9 étapes ont plusieurs règles (bassin par palier) : encodeurs (ordre, envers, lettre suivante sur l’anneau, échangées
  par paires) ; trappe (couleur la plus présente, la plus rare, ni l’une ni l’autre, première DEL à gauche) ; séquence
  (ordre, envers, position + 1) ; baie banane étape 4 (brancher couleur → prise, intervertir deux câbles, débrancher deux
  câbles, prise = rang d’une lettre du n° de série) ; code 1 (ordre, envers, + 1) ; clés (légère → lourde ou l’inverse) ;
  mot (ordre, envers, lettre suivante) ; baie étape 10 (double, intervertir, débrancher + rang de lettre) ; code 2
  (envers, en commençant par le 3e, + dernier chiffre de la plaque).
- Deux parties de suite diffèrent sur au moins 3 règles (signature de la partie précédente dans `localStorage`
  `entite-derniere-partie`). Toutes les nouvelles répliques sont dans `voix/manifest.json` (`mp3Ready: false` → synthèse).

### Toujours vrai
Rotatifs E1–E4 = lettres seulement, chiffres au clavier 4×4, baie banane 5×5 (5 couleurs, glisser + toucher), ECG sur le
CYD 2 (labyrinthe aux étapes 5 et 9), brouillage OLED sur le cadre seulement, tout dans la valise ouverte.

### Prochaines étapes
- Faire enregistrer les nouvelles répliques (objectifs, indices, variantes) par le bot Voix (`mp3Ready: true`).
- Test sur le vrai S20 FE (son mixé, vibration, lisibilité du bandeau en plein soleil).
- Porter la file de voix, le ducking et la jauge (lecture ADC du pont diviseur 3S) sur l’ESP32.

## Version 0.2.3 (23 nov. 2026)

- **Vraie baie banane 5×5** : les 5 câbles restent ancrés sur la base (un port par couleur), et n’importe quel câble se
  branche dans n’importe laquelle des 5 prises du couvercle (1 à 5) ; une prise = un câble ; les câbles se croisent
  librement (courbes de Bézier SVG, gaine sombre, fiche moulée de la couleur du câble, pointe dorée). Prise vide = alésage
  laiton ouvert. Câble débranché = fiche posée sur la base à côté de son port.
  - **Glisser-déposer** (doigt ou souris) : fiche → prise libre = branché (clic) ; → prise occupée = échange si le câble venait
    d’une prise, sinon l’occupant retombe sur la base ; lâché ailleurs = débranché. La prise survolée s’allume.
  - **Toucher-choisir** : toucher un port de la base (ou une prise branchée) = câble choisi (halo pulsé, prises en
    surbrillance), puis toucher une prise = branché / déplacé / échangé ; re-toucher sa prise ou son port = débranché.
    Cibles ≥ 44×44 px. Clavier : Entrée/Espace font pareil.
- **5 couleurs Keadic distinctes, une de chaque** : rouge `#e53935`, noir `#1b1d22` (liseré `#7c8594`), jaune `#f5c518`,
  vert `#22c55e`, bleu `#2b7cff`, mélangées selon la graine (fini les deux câbles qui semblaient bleus). Départ : 1→1 … 5→5.
- **Étape 4** : « La baie banane. Branche le câble [couleur] dans la prise [N]. » **Étape 10** : « Deuxième couche. … Débranche
  le câble [B] et laisse-le débranché. Puis branche le câble [C] dans la prise [M]. » Pendant ces étapes, débrancher ou
  déplacer n’est jamais puni ; seule une fiche branchée dans la mauvaise prise coûte −8 s (puis l’Entité remet tout).
  Hors de ces étapes, toucher aux câbles coûte −5 s et l’Entité rebranche. L’Entité ment aussi (« Non ! Branche plutôt… », œil rouge).
- **Rotatifs = lettres, clavier = chiffres** (règle de Pascal) : E1–E4 n’affichent plus jamais de chiffres, seulement l’anneau
  `A-V`. Le n° de série devient `L C L C-L C L C` (ex. `F9R0-T8B2`) : étape 1 = ses **4 lettres** (dans l’ordre en
  moyen-difficile, en partant de la fin en difficile) sur E1–E4 ; les chiffres restent pour les serrures et le clavier 4×4.
- **CYD 2 = moniteur cardiaque (ECG)** hors labyrinthe : tracé P-QRS-T balayé de gauche à droite avec traînée phosphore et
  spot lumineux, cœur qui bat, BPM et état. Veille ~70 BPM (cyan, `VEILLE`) ; en jeu le pouls monte avec le chrono
  (plus vite sous 3 min et sous 60 s), chaque erreur (+20 à 25 BPM d’adrénaline qui retombe lentement), les répliques et
  mensonges de l’Entité, l’hésitation : vert `STABLE` < 95, ambre `STRESS` 95-125, rouge `STRESS ÉLEVÉ` / `CRITIQUE` ≥ 125
  (léger tremblement). Victoire : retour à 72 BPM `STABLE` ; explosion : tracé plat `0 BPM · ARRÊT`. Purement visuel, aucun bip.
  Étapes 5 et 9 : labyrinthe inchangé.
- **OLED** : les traits rouges vus sur « L U L T » étaient le brouillage volontaire d’un mensonge, tiré au hasard sur tout
  l’écran ; il reste mais seulement en cadre rouge et sur les bords, les lettres restent nettes.
- **Chargement bloqué à 14 % corrigé** (mini PC avec un ancien service worker) : chaque module est importé avec `?v=0.2.3`
  (un ancien SW ne peut plus servir un vieux `game.js` au nouvel `app.js`) ; `sw.js` fait `skipWaiting()` à l’installation
  et sert `.js` / `.css` / `.json` réseau d’abord (cache seulement hors ligne) ; le SW est enregistré dès l’écran de chargement
  (`updateViaCache: 'none'`) ; une erreur de module s’affiche aussitôt et « Réessayer » désinscrit le SW de l’app et vide ses
  anciens caches (jamais `entite-mallette-v015-*` / `v016-*`) avant de recharger.

## Version 0.2.2 (23 nov. 2026)

- **KY-040 sans boutons + / −** : on tourne le bouton lui-même (anneau de 20 crans, repère blanc, 18° par cran, tic à chaque cran).
  - Glisser : torsion autour du bouton (départ sur le bord) ou glissé horizontal (départ au centre ; 20 px = 1 cran, droite = +1).
  - Molette : haut = +1, bas = −1. Toucher le tiers gauche = −1, le tiers droit = +1, **le centre = clic** (valider).
  - Clavier : ←/↓ = −1, →/↑ = +1, Entrée/Espace = clic.
- **Cryptex à 20 lettres** : 20 crans = 1 tour = l’anneau `A B C D E F G H I J L M N O P R S T U V` (sans K, Q, W, X, Y, Z).
  Étape 1 : chiffres (0-9). Étape 8 : l’Entité épelle un mot français de 4 lettres (NORD, CODE, LUNE, STOP, MARS, PORT, VENT,
  NUIT, CAGE, BLEU, NOIR, SOIR, TOUR, FILS ; en palier difficile, épelé à l’envers) ; on le compose sur les 4 encodeurs,
  l’OLED affiche les lettres choisies (jamais la réponse), puis clic au centre d’un bouton.
- **5 câbles banane base → couvercle** : chaque câble de couleur part d’un port de la base et monte se brancher par-dessous
  dans sa douille (1 à 5) du couvercle. Débranché, la douille reste vide et la fiche retombe sur la base, à côté de son port.
  Un mauvais câble retombe aussi (pénalité), puis l’Entité le rebranche. En paysage et sur ordinateur, les câbles passent
  sous les douilles, chacun sur sa voie, et rejoignent les ports au bord gauche de la base.

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
7. Serrures à clé (I, II, III), dans le bon ordre · 8. Cryptex : mot de 4 lettres épelé · 9. Labyrinthe saboté (axes inversés par moments) ·
10. Câbles, couche 2 · 11. Code 2 · 12. Lever le capot rouge et basculer le levier TRANSMIT.

Erreur : −5 s ou −8 s et +3,2 % d’échec. Avertissements à 30 s et 10 s ; à zéro, la mallette saute.
Deux paliers cachés (moyen-difficile, difficile) tirés ~50/50 ; les règles changent selon le palier
(ordre inversé, fréquence rare, etc.) et se déduisent de ce qui est dicté et du n° de série.

### Paramètres d’URL

- `?seed=N` : partie reproductible (même palier, même série, mêmes réponses).
- `?debug=1` : expose `window.__entiteDebug` (run, state, face, voiceLog, voiceStats, musicStats,
  ttsAvailable, forceSabotage(on), idle(ms), cables(), ecg(), oled()) pour les tests.

## Voix : `voix/manifest.json`

Toutes les répliques (89) sont listées dans `voix/manifest.json`. Chaque entrée :

| champ | sens |
|---|---|
| `id` | identifiant (ex. `clue_code1`, `chiffre_7`, `taunt_debranche`) |
| `file` | `voix/<id>.mp3` |
| `dfplayerTrack` | numéro de piste DFPlayer Mini (`0001`, `0002`, …) pour la vraie mallette |
| `category` | `intro`, `clue`, `digit`, `color` (dont `cable_*`), `socket` (`prise_1` … `prise_5`), `letter` (les 20 lettres de l’anneau), `taunt`, `sabotage`, `outcome` |
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
- `js/guide.js` : objectifs, modules actifs, indices (v0.2.5 : bandeau étape 10 = consigne dictée). `js/battery.js` : modèle de batterie 3S (v0.2.4).
- `sw.js` : service worker, cache `entite-mallette-v0.2.5` (manifeste des voix inclus). À l’activation, les anciens
  caches `entite-mallette-*` (dont `entite-mallette-v0.2.2`, `entite-mallette-v0.2.1`, `entite-mallette-v0.2.0-r2`, `entite-mallette-v0.2.0` et `entite-mallette-v0.1.5-base`) sont supprimés, sauf ceux des archives (`entite-mallette-v015-*`, `entite-mallette-v016-*`).

## Tests

```
python3 -m http.server 8794 --bind 127.0.0.1 &
node tests/v025.mjs            # ou : node tests/v025.mjs <base>
```

`tests/v025.mjs` (test léger v0.2.5) : bandeau de l’étape 10 = consigne dictée (les 3 variantes), persistant jusqu’à
la réussite ; bouton Indice à l’étape 10 (gratuit, −15 s, −30 s) ; 172 mp3 prêts, fragments de l’étape 10 enchaînés,
repli synthèse si un id est absent ; imports `?v=0.2.5` ; 0 erreur 404. Captures dans `/workspace/qa/entite-mallette/v0.2.5-live/`.

`tests/v024.mjs` concerne la v0.2.4 (clarté, son mixé, batterie, paliers).


`tests/v023.mjs` (147 vérifications) : jeu de 5 couleurs exact et distinct ; glisser-déposer vers n’importe quelle prise,
échange et débranchement (doigt en portrait et paysage, souris sur bureau, prise survolée) ; toucher-choisir, échange et
débranchement ; cibles ≥ 44 ; étapes 4 et 10 (voix, pénalités, débrancher neutre) ; rotatifs en lettres seulement aux
étapes 1 et 8 (OLED jamais en chiffres), plaque `L C L C-L C L C` ; partie complète graine 42 (cryptex compris), joystick 16/16,
levier rouge trop tôt ; ECG du CYD 2 (veille, adrénaline après une erreur, ≥ 125 BPM sous 60 s, victoire 72, explosion 0) ;
OLED net pendant un mensonge ; 400 graines au hasard cohérentes ; imports versionnés `?v=0.2.3`, SW (skipWaiting, réseau
d’abord), démarrage 0 % → prêt sans erreur ; `voix/_test/` jamais indexé ; manifeste, mp3, symétrie du couvercle,
0 débordement / chevauchement en 412×915, 915×412, 1280×800 et 320×640 ; 0 erreur. Captures dans
`/workspace/qa/entite-mallette/v0.2.3-dev/` (`01-mallette-412.png`, `02-mallette-412-crossed-patchbay.png`,
`03-mallette-915x412-crossed.png`, `04-mallette-1280x800-crossed.png`, `05-cyd2-ecg-stress.png`).

Versions précédentes :

`tests/v022.mjs` (Playwright) joue une partie complète (graine 42) jusqu’à la victoire et vérifie : 0 bouton + / − sur les
KY-040 ; molette, glissé au doigt, torsion (18° par cran), bords −1/+1, clavier et clic au centre ; anneau de 20 lettres
(20 crans = 1 tour) ; l’étape cryptex (mot épelé à la voix, jamais écrit, composé sur l’OLED) et l’étape chiffres ;
5 câbles base → couvercle branchés, puis fiche retombée côté base une fois débranchée (portrait, paysage, bureau) ;
couvercle symétrique, 0 débordement et 0 chevauchement en 412×915, 915×412, 1280×800 et 320×640 ; joystick 16/16 ;
levier rouge trop tôt ; aucune réponse écrite ; mp3 ElevenLabs intacts ; manifeste ; cache du service worker ; 0 erreur.
Captures dans `/workspace/qa/entite-mallette/v0.2.2-dev/` (`01-mallette-412.png`, `02-mallette-412-cryptex-unplug.png`,
`03-mallette-915x412.png`, `04-mallette-1280x800.png`).
`tests/v021.mjs` concerne la v0.2.1 (boutons + / −), `tests/v020.mjs` la v0.2.0 (trois faces). Les anciens tests (`tests/v011*.mjs` … `v015`, `paliers.mjs`, `run.mjs`) concernent la v0.1.x.

## Historique

- 0.2.5 : bandeau étape 10 = consigne de câblage dictée ; voix mp3 par id avec repli synthèse.
- 0.2.4 : clarté (objectif, indices, tutoriel), son mixé −8 dB, jauge batterie 3S, paliers moyen / difficile.
- 0.2.3 : baie banane 5×5 (glisser ou toucher), 5 couleurs distinctes, rotatifs = lettres seulement, ECG sur le CYD 2, chargement à 14 % corrigé.
- 0.2.2 : KY-040 sans + / − (on tourne le bouton), cryptex de 20 lettres, câbles banane base → couvercle.
- 0.2.1 : une seule vue, tout dans la valise ; haut-parleurs de part et d’autre de l’œil ; leviers à capot à la place du bouton TRANSMIT.
- 0.2.0 : refonte « Cool Escape Props » en trois faces (Dessus, Flanc, Mallette). Plus de lecteur RFID, plus d’éléments Keep Talking.
- 0.1.5 : 12 étapes en deux couches, 8 minutes (archivée sur entite-mallette-v015).
- 0.1.6 : énigmes de logique visuelle (archivée sur entite-mallette-v016).
- 0.1.4 et avant : déductions depuis le n° de série, mensonges, plein écran, musique, graines.
