# Entité · Mallette

Simulateur web (PWA, téléphone d'abord) de la mallette de désamorçage ESP32 de Pascal, sous l'œil de l'Entité.

Lien prévu : https://passcool17.github.io/entite-mallette/ (publié seulement après le PASS du QA).

## État

Version 0.1.4 (locale, pas encore publiée ; la 0.1.3 est en ligne).

- 0.1.4 : plus difficile, par la réflexion : tout se déduit du n° de série et des écrans, l'Entité ment (œil qui
  grésille), 4 minutes. Un seul mode (pas de mode facile).

- 0.1.3 : correctif paysage (téléphone couché, avec ou sans barres du navigateur) : panneau entier toujours visible,
  fils et code agrandis dans une loupe, bouton son qui n'est plus coupé. Écran de chargement avec vrai pourcentage,
  et correction du blocage à la 1re visite (rechargement provoqué par le service worker).

- 0.1.2 : musique de tension qui accélère avec le compte à rebours, parties tirées au sort (code, ordre des clés,
  bon fil, trappes) avec graine reproductible, vibrations (réglage à côté du son).

- 0.1.1 : plein écran (bouton + automatique à « Ouvrir la mallette », verrouillage paysage si le navigateur le permet),
  voix enregistrées lues depuis `voix/` avec repli sur la synthèse vocale, zones tactiles agrandies (serrures, clavier).
- 0.1.0 : première version (QA PASS).

## Fonctions

- **L'œil de l'Entité** (Canvas2D, `js/eye.js`) : anneaux de points lumineux qui tournent par groupes, ondes de lumière,
  iris à pétales lumineux, pupille noire à stries, blocs de données à la dérive. Il pulse avec la voix (`AnalyserNode`),
  suit du regard le dernier geste et a 5 humeurs : repos, regard, colère (moins de 30 s ou erreur), piégée (victoire :
  l'œil se replie en disque lumineux, le lecteur optique 5D), explosion.
- **Panneau à l'échelle réelle** d'une mallette Lykus HC-3010 : CYD 1 (l'œil), afficheur 4 chiffres TM1637,
  2 barrettes WS2812B de 8 LED, 5 serrures Gebildet 12 mm (points rouge/vert), 3 trappes à servo SG90,
  2 interrupteurs à cache (rouge, bleu), lecteur RFID, gros bouton rouge lumineux (maintenir), clavier membrane 4x4,
  CYD 2 (fils à couper, code, téléversement), grille de haut-parleur.
- **Probabilité d'échec** affichée en % : elle baisse à chaque étape et remonte à chaque erreur.
- **Mensonges de l'Entité** : l'écran 2 montre d'abord un faux code, un faux ordre de clés ou un faux fil, puis la vérité
  revient ; le % ment parfois une fraction de seconde.
- **Sons** synthétisés (WebAudio) : tic-tac, bips, clés, servos, cisaille, alarme, explosion, accord final.
- **Musique de tension** (`audio/tension.mp3`, 16 s en boucle, MP3 96 kb/s, 193 Ko) : générée gratuitement sur la box
  avec MusicGen (modèle small), prompt « suspense thriller underscore loop, relentless pulsing analog synth bass
  sixteenth notes, metallic clock ticking, dark drone, cinematic tension, steady 120 bpm, no melody », puis bouclée
  sans couture (fondu enchaîné de 1,5 s de la fin dans le début). Elle démarre au toucher « Ouvrir la mallette »,
  passe par le bouton son, baisse sous chaque réplique, fond à la victoire et se coupe net à l'explosion.
  Intensité de 0 à 1 selon le temps restant (courbe qui accélère sous 60 s) : boucle jusqu'à +14 % de vitesse,
  filtre passe-bas qui s'ouvre de 1,4 à 10,4 kHz, et une basse synthétisée (WebAudio) hachée de 2 à 8 Hz qui monte.
- **Vibrations** : courte sur une erreur, longue à l'explosion, double à la victoire. Bouton à côté du son,
  réglage gardé dans le téléphone. Sans vibreur (iPhone) : bouton masqué, rien ne se passe.
- **Voix** : répliques froides en français (synthèse vocale du navigateur en attendant le bot Voix, voir `VOIX.md`),
  sous-titrées sous l'œil, avec un grondement grave qui passe dans l'analyseur.
- **Secousse = explosion** (DeviceMotion, permission demandée sur iPhone), bouton « Simuler une secousse » en secours.
- **Aperçu CYD** `?cyd=1` : rendu natif 240x320, 20 i/s max, particules réduites, boutons d'humeur. Voir `PORTAGE-CYD.md`.
- **Plein écran** : bouton en haut à droite, et automatique au toucher « Ouvrir la mallette ». Une fois en plein écran,
  l'app demande `screen.orientation.lock('landscape')` ; si c'est refusé, elle garde l'orientation actuelle.
  Sans API plein écran (Safari iPhone), le bouton est masqué et l'accueil propose d'installer l'app sur l'écran d'accueil.
- **Zones tactiles** agrandies sans changer le dessin à l'échelle : serrures 48 px, touches du clavier jusqu'à l'espace
  entre les touches (environ 40 px en portrait, limité par le pas réel de 17 mm du clavier membrane).
- PWA installable, hors ligne (service worker versionné écrit à la main), `prefers-reduced-motion` respecté,
  zones sûres, libellés accessibles. Le son ne démarre qu'après un toucher.

## Séquence de désamorçage (ordre final)

Minuterie : 4:00. Erreurs : -10 s (ordre) ou -15 s (code), et la probabilité d'échec remonte.

### Règles à déduire (0.1.4, mode unique)

Tout vient du panneau : la plaque affiche `N° DE SÉRIE 4K7-29B · LOT 316` (tiré de la graine ; le lot est un leurre).
Les règles sont dans le texte d'étape ; aucune réponse n'est affichée telle quelle.

- **Interrupteurs** : dernier chiffre du n° pair → bleu d'abord ; impair → rouge d'abord.
- **Clés I, II, III** : chaque clé pèse un chiffre du n° (I = 1er, II = 2e, III = 3e, toujours différents) ;
  tourner de la plus légère à la plus lourde.
- **Fils** : plus d'un fil rouge → le dernier rouge ; sinon, dernier chiffre pair → le 2e fil ; sinon → le fil
  sans jumeau. Mauvais fil = explosion.
- **Code (pilule)** : 1er chiffre = dernier chiffre du n° ; 3e = somme des 4 chiffres du n°, unités seules ;
  2e et 4e = fragment montré par l'écran 2 après le badge (`CODE _6_2` reste en haut de l'écran 2).
- **Mensonges** : l'écran 2 affiche parfois un faux code, un faux ordre ou un faux fil ; à chaque mensonge
  (et quand le % ment), l'œil et le CYD 1 grésillent en rouge. Ce qui s'affiche pendant le grésillement est faux.
- Croix A et B : toujours à moins d'une seconde d'écart.

| # | Étape | Pièce | Ouvre | Échec |
|---|---|---|---|---|
| 1 | Lever le cache rouge, basculer ; puis le bleu | interrupteurs à cache | **Trappe A** : les 2 moitiés de la clé en croix | 88,4 % |
| 2 | Tourner Croix A et Croix B ensemble (moins de 1 s d'écart : deux doigts, ou l'une puis l'autre très vite) | 2 serrures | **Trappe B** : badge Podkova (le code source) | 75,1 % |
| 3 | Présenter le badge Podkova | lecteur RFID | code sur l'écran 2 (faux puis vrai) + **Trappe C** : clés I, II, III | 61,8 % |
| 4 | Tourner I, II, III dans l'ordre de l'écran 2 (il ment d'abord) | 3 serrures | écran des fils | 44,6 % |
| 5 | Couper le seul fil sans jumeau (mauvais fil = explosion) | CYD 2 | saisie du code | 29,3 % |
| 6 | Taper le code Podkova : téléversement de la pilule empoisonnée | clavier 4x4 | arme le gros bouton | 11,2 % |
| 7 | Maintenir le gros bouton rouge 1,5 s : sceller le lecteur 5D | gros bouton | victoire | 0,0 % |

Trappes A, B et C : à chaque partie, elles tombent au hasard sur T1, T2 et T3 (le texte d'étape dit laquelle s'ouvre).

### Parties tirées au sort

Chaque partie tire d'une seule graine (générateur mulberry32) : le code de la pilule (4 chiffres), l'ordre des clés
I, II, III, les couleurs des fils et le fil sans jumeau, et la trappe de chaque objet. Les écrans, les faux indices et
les textes d'étape suivent ces valeurs.

- `?seed=12345` : rejoue toujours la même partie (aussi après « Recommencer »).
- `?debug=1` : affiche la graine à côté du numéro de version, et la journalise dans la console.
- `?cyd=1` (aperçu CYD) n'est pas touché.

Tant qu'une clé n'est pas ramassée dans sa trappe, sa serrure est vide et refuse le geste.
Explosion : temps écoulé, mauvais fil ou secousse.

## Chargement (0.1.3)

- L'écran de chargement est en HTML/CSS dans `index.html` : il s'affiche dès le premier octet, avant la feuille de style,
  le JS, les polices et le service worker. Anneaux de points cyan et balayage de la barre animés en continu (CSS,
  sur le compositeur) : rien ne paraît figé même si le réseau cale ou si le JS calcule.
- **Pourcentage réel**, en deux phases : code (CSS + modules, 15 %), mesuré en octets par `PerformanceObserver` ;
  puis médias (85 %) : `audio/tension.mp3`, les voix listées dans `voix/voix.json` et les 3 polices, en octets reçus
  (flux `fetch`) sur octets attendus (`Content-Length`). Le % ne recule jamais. `role="progressbar"` + `aria-valuenow`.
- « Ouvrir la mallette » reste désactivé jusqu'à 100 %. Après 8 s : bouton « Ouvrir sans attendre » (le chargement
  continue). Fichier en échec : message + **Réessayer** (ou jouer sans). Code qui n'arrive pas en 25 s : message + Réessayer.
- Pas de double téléchargement : `js/preload.js` garde les fichiers, `audio.js` les reprend (décodage seulement au
  toucher) ; le service worker précache les médias depuis le cache HTTP.
- **Cause du « plus rien ne bouge » à la 1re visite** : le service worker s'installait pendant le chargement
  (il re-téléchargeait tout, musique comprise, en concurrence), puis `clients.claim()` déclenchait `controllerchange`
  et l'app **rechargeait la page** (prévu pour les mises à jour, pas pour la 1re visite). Ajoutez à ça une cascade de
  modules JS (3 allers-retours) et une feuille de style bloquante. Corrigé : rechargement seulement s'il y avait déjà
  un SW, SW enregistré après le préchargement, `modulepreload` pour les modules, CSS non bloquante derrière l'écran
  de chargement, polices sorties du chemin critique.
- Mesuré (`tests/v013-chargement.mjs`, contexte neuf, Fast 3G + CPU x4) : écran de chargement à 0,8 s, prêt à 5,0 s,
  une seule navigation, musique et voix téléchargées une fois ; revisite prête en 1,3 s.

## Paysage sur téléphone (0.1.3)

Testé à 915x412, 915x340 (barres du navigateur visibles) et 800x360.

- Le panneau garde son rapport 273:169 et sa largeur suit la hauteur réellement visible (`innerHeight`, recalculée au
  redimensionnement et quand le texte d'étape change de hauteur) : il tient entier, sans défiler.
- **Loupe** : à l'étape des fils, l'écran 2 passe agrandi dans la colonne de l'œil (5 fils de 44 px de haut, toujours
  visibles). À l'étape du code, l'écran 2 et le clavier y passent ensemble (touches de 38 px, zone tactile de 44 px
  avec l'espace entre les touches). Un repère « agrandi ◀ » reste à leur place sur le panneau ; tout revient ensuite.
  En portrait, rien ne change.
- La colonne de l'œil (300 px au minimum) garde la minuterie et les 3 boutons ; la probabilité d'échec passe dans
  la barre d'étape. Avant, le bouton son débordait et était à moitié coupé.

## Panneau : dimensions et choix d'orientation

Les cotes réelles sont dans `js/panel-config.js` (pour le futur panneau imprimé en 3D) :
zone utile 273 x 169 mm, base 83 mm, couvercle 17 mm, encombrement de chaque pièce et deux implantations en mm.

- **Paysage** (écran large, ou téléphone tourné) : le panneau est affiché à 273:169, pièces à l'échelle.
- **Portrait** (téléphone 412x915) : **le panneau est tourné de 90°** (169 de large x 273 de haut). Le rapport et l'échelle
  des pièces sont conservés, mais les pièces sont replacées dans ce cadre (une implantation dédiée) plutôt que tournées
  avec leur texte, pour rester lisibles. Les CYD sont montés en portrait (natif 240x320), sauf le CYD 2 en paysage
  dans l'implantation paysage.
- 3 trappes sur 5 servos SG90 disponibles : il en reste 2 en réserve.

## Fichiers

- `index.html`, `css/app.css`, `js/app.js` (logique et panneau), `js/eye.js` (rendu), `js/eye-config.js` (tous les
  paramètres de l'œil), `js/panel-config.js` (cotes réelles), `js/audio.js`, `js/voix.js`, `sw.js`, `manifest.webmanifest`.
- `tests/v014.mjs` (partie complète avec `?seed=N` en lisant seulement l'écran), `tests/v013-chargement.mjs` (1re visite à froid en Fast 3G, revisite, échec + Réessayer), `tests/v013.mjs` (test léger 0.1.3 : paysage 915x412, 915x340, 800x360, toutes les étapes), `tests/v012.mjs` (test léger 0.1.2 : graine, indices, musique, vibrations, `?cyd=1`), `tests/v011.mjs` (test léger 0.1.1 : plein écran, voix fichier + repli, zones tactiles, paysage),
  `tests/voix-liste.mjs` (liste des voix), `tests/run.mjs` (test léger : séquence complète jusqu'à la victoire, console, captures), `tests/fps.mjs` (une mesure d'fps),
  `tests/eye.html` (œil seul, `?ref=1` = cadrage de la référence).
- Polices auto-hébergées : Chakra Petch et JetBrains Mono (licence OFL, `fonts/OFL.txt`).

## Tester en local

```sh
python3 -m http.server 8792   # depuis ce dossier
node tests/run.mjs http://localhost:8792/
```

## Voix enregistrées

- Déposer les fichiers dans `voix/<id>.mp3` (ids de `VOIX.md`), puis lancer `node tests/voix-liste.mjs` : il écrit
  `voix/voix.json` avec la liste des fichiers présents. L'app ne demande que les fichiers listés (pas d'erreur 404).
- Chaque fichier passe dans l'`AnalyserNode` : l'œil pulse sur la vraie voix. Fichier absent, illisible ou trop lent
  à arriver : synthèse vocale + grondement, comme avant. Le service worker garde les MP3 lus pour le hors ligne.

## Prochaines étapes

- Recevoir les voix du bot Voix, lancer `node tests/voix-liste.mjs`, publier.
- Essai réel sur le Galaxy S20 FE (fps de l'œil, secousse, synthèse vocale française disponible).
- Porter l'œil sur le CYD 1 (`PORTAGE-CYD.md`) et la logique sur l'ESP32.
- Tirer le panneau 3D de `js/panel-config.js`.
