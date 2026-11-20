# Entité · Mallette

Simulateur web (PWA, téléphone d'abord) de la mallette de désamorçage ESP32 de Pascal, sous l'œil de l'Entité.

Lien prévu : https://passcool17.github.io/entite-mallette/ (publié seulement après le PASS du QA).

## État

Version 0.1.0 : une version complète, testée en local (Chromium sans écran, 412x915). Pas encore publiée.

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
- **Voix** : répliques froides en français (synthèse vocale du navigateur en attendant le bot Voix, voir `VOIX.md`),
  sous-titrées sous l'œil, avec un grondement grave qui passe dans l'analyseur.
- **Secousse = explosion** (DeviceMotion, permission demandée sur iPhone), bouton « Simuler une secousse » en secours.
- **Aperçu CYD** `?cyd=1` : rendu natif 240x320, 20 i/s max, particules réduites, boutons d'humeur. Voir `PORTAGE-CYD.md`.
- PWA installable, hors ligne (service worker versionné écrit à la main), `prefers-reduced-motion` respecté,
  zones sûres, libellés accessibles. Le son ne démarre qu'après un toucher.

## Séquence de désamorçage (ordre final)

Minuterie : 3:00. Erreurs : -10 s (ordre) ou -15 s (code).

| # | Étape | Pièce | Ouvre | Échec |
|---|---|---|---|---|
| 1 | Lever le cache rouge, basculer ; puis le bleu | interrupteurs à cache | **Trappe 1** : les 2 moitiés de la clé en croix | 88,4 % |
| 2 | Tourner Croix A et Croix B ensemble (moins de 1 s d'écart : deux doigts, ou l'une puis l'autre très vite) | 2 serrures | **Trappe 2** : badge Podkova (le code source) | 75,1 % |
| 3 | Présenter le badge Podkova | lecteur RFID | code sur l'écran 2 (faux puis vrai) + **Trappe 3** : clés I, II, III | 61,8 % |
| 4 | Tourner I, II, III dans l'ordre de l'écran 2 (il ment d'abord) | 3 serrures | écran des fils | 44,6 % |
| 5 | Couper le seul fil sans jumeau (mauvais fil = explosion) | CYD 2 | saisie du code | 29,3 % |
| 6 | Taper le code Podkova : téléversement de la pilule empoisonnée | clavier 4x4 | arme le gros bouton | 11,2 % |
| 7 | Maintenir le gros bouton rouge 1,5 s : sceller le lecteur 5D | gros bouton | victoire | 0,0 % |

Tant qu'une clé n'est pas ramassée dans sa trappe, sa serrure est vide et refuse le geste.
Explosion : temps écoulé, mauvais fil ou secousse.

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
- `tests/run.mjs` (test léger : séquence complète jusqu'à la victoire, console, captures), `tests/fps.mjs` (une mesure d'fps),
  `tests/eye.html` (œil seul, `?ref=1` = cadrage de la référence).
- Polices auto-hébergées : Chakra Petch et JetBrains Mono (licence OFL, `fonts/OFL.txt`).

## Tester en local

```sh
python3 -m http.server 8792   # depuis ce dossier
node tests/run.mjs http://localhost:8792/
```

## Prochaines étapes

- Enregistrer les voix (bot Voix, `VOIX.md`) et les déclarer dans `js/voix.js`.
- Essai réel sur le Galaxy S20 FE (fps de l'œil, secousse, synthèse vocale française disponible).
- Porter l'œil sur le CYD 1 (`PORTAGE-CYD.md`) et la logique sur l'ESP32.
- Tirer le panneau 3D de `js/panel-config.js`.
