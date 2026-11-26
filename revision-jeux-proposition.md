# La mallette de l'Entité · révision des jeux (proposition)

*25 nov. 2026, soir (heure de Toronto). Base : v0.4.0 en ligne. **Proposition seulement : aucun code, aucun commit, aucun push.** Rien ne change avant ton OK, Pascal.*

## 1. Le but, en deux phrases

Que chaque épreuve soit **trippante** : un geste physique clair, une tension, une surprise, l'Entité qui ment, et des modules qui se répondent. Avec **seulement** les pièces du plan d'impression v0.8, sans en déplacer ni en ajouter.

## 2. À retenir tout de suite (ton 22:08)

> **Les 5 molettes servent à former des MOTS de 5 lettres, jamais le numéro de série.**

- **Étape 1** devient un **jeu de mot** (« Mot mêlé »), différent du cryptex de l'étape 8 : à l'étape 1 on **regarde** des lettres mélangées, à l'étape 8 on **écoute** un mot épelé.
- Le **numéro de série** reste, mais **en chiffres seulement** (4 chiffres + un lot leurre). Il sert ailleurs : serrures, code, câbles.
- Plus aucune lettre de série sur les molettes. Les molettes gardent les lettres A–V seulement.

## 3. Top 3 des changements

1. **Étape 1 « Mot mêlé »** : lettres mélangées sur l'écran du bas, tu les remets en mot sur les 5 molettes. Version moyenne : un score « 3 sur 5 bien placées » après chaque essai.
2. **Serrures « deux clés, deux mains »** : l'Entité crie « Maintenant ! » trop tôt (mensonge), le vrai signal est dans les lumières. Il faut tourner les deux clés ensemble. Les vraies clés sont rangées dans la trappe qui s'ouvre après le code 1.
3. **Les lumières et les haut-parleurs vivent** : chaque barrette a sa note au Simon, une barrette devient le chrono des câbles, la barrette s'allume sous la prise quand tu branches. Le deuxième labyrinthe se joue **dans le noir**.

## 4. Les pièces du plan v0.8 (rien d'autre)

**Couvercle**
- CYD 1 : l'œil de l'Entité (au centre, en haut).
- 2 haut-parleurs SPK-L / SPK-R (+ 2 amplis MAX98357A cachés).
- 5 barrettes de 8 LED WS2812B (zigzag), numérotées 1 à 5.
- 5 douilles banane D1 à D5, une sous chaque barrette.

**Base**
- 5 ports de câbles banane B1 à B5 (noir, bleu, vert, rouge, jaune), 43 mm de fiche.
- 5 molettes KY-040 E1 à E5 (tourner = lettre, appuyer = valider), anneau de 20 lettres A–V sans K ni Q.
- Levier à capot bleu **ARM** et rouge **TRANSMIT** (leviers lumineux).
- Chrono rouge **TM1637** (4 chiffres), au-dessus des serrures.
- 2 **serrures à clé** I et II, en bas à gauche.
- 2 **trappes** A et B (portes motorisées SG90), au centre.
- **CYD 2** : écran tactile en bas au centre (n° de série, Réécouter, lettres, labyrinthe).
- **Clavier** 4×4 (chiffres seulement) et **joystick** KY-023 dessous (avec son bouton).
- Interrupteur KCD1, prise de recharge, pile 3S, électronique cachée.

## 5. Le déroulé actuel (v0.4.0)

| Étape | Épreuve | Pièce |
|---|---|---|
| 0 | Armer | ARM |
| 1 | 5 lettres du n° de série | molettes |
| 2 | Ouvrir la bonne trappe | barrettes, trappes |
| 3 | Simon | barrettes, douilles |
| 4 | Brancher les câbles | câbles, douilles |
| 5 | Labyrinthe | joystick, CYD 2 |
| 6 | Code 1 | clavier |
| 7 | Serrures dans l'ordre | serrures |
| 8 | Mot épelé (cryptex) | molettes |
| 9 | Labyrinthe saboté | joystick |
| 10 | Câbles, 2e couche | câbles |
| 11 | Code 2 | clavier |
| 12 | TRANSMIT | levier rouge |

Constat : deux fois les molettes, deux fois les câbles, deux fois le labyrinthe, deux fois le code. Bien, mais ça se répète. Je garde les 12 étapes et je **change la saveur** de la 2e fois.

## 6. Épreuve par épreuve

*Légende : Joueur · Pièce · Fun · Changement · Moyen/Difficile · Faisable · Voix.*

### Étape 0 · Armement
- **Joueur** : lève le capot bleu, bascule ARM.
- **Pièce** : levier ARM (lumineux).
- **Fun** : le geste de « mise à feu ». Le levier clignote tant qu'on n'a pas armé.
- **Changement** : au déclic, les 5 barrettes font un balayage violet, le chrono affiche 8:00 et clignote 3 fois, la musique démarre. Le levier suivant (rouge) reste éteint jusqu'à la fin.
- **Moyen/Difficile** : pareil.
- **Faisable** : oui (FastLED, TM1637, lumière du levier déjà prévue).
- **Voix** : aucune nouvelle.

### Étape 1 · « Mot mêlé » (remplace le n° de série sur les molettes)
- **Joueur** : l'écran du bas montre **5 lettres mélangées** (par exemple `E G I N S`). Il forme le mot sur E1 à E5, puis clique une molette.
- **Pièce** : molettes E1–E5, CYD 2.
- **Fun** : le cliquetis des crans, le déclic « ça y est », et l'Entité qui se trompe exprès (« C'était SIGNE ») pour te faire douter.
- **Changement** : ce n'est plus le n° de série. Le mot vient d'une liste de mots de 5 lettres (celle du cryptex). **Le mot de l'étape 1 est toujours différent du mot de l'étape 8.** Les lettres mélangées sont l'énigme, pas la réponse : le mot n'est jamais écrit.
- **Moyen** : l'Entité dit un thème (« C'est un objet », « C'est dans la nature », « C'est une machine ») et, après un essai raté, l'écran affiche « 3 / 5 bien placées » (un nombre, jamais les lettres). Chaque essai raté : −5 s.
- **Difficile** : pas de thème, pas de score (juste « faux »), et un mensonge de l'Entité sur le mot. Essai raté : −8 s.
- **Faisable** : oui. Les molettes et le CYD 2 existent déjà. Aucun fil de plus.
- **Voix** : nouvelles (voir section 9) : consigne du mot mêlé, 3 thèmes, indices 1 à 3. Les indices actuels parlent du n° de série : à remplacer.

### Étape 2 · Trappes A / B
- **Joueur** : regarde les 5 barrettes (10 moitiés colorées), applique la règle de l'Entité, ouvre la bonne trappe.
- **Pièce** : barrettes, trappes SG90, joystick (choix A ou B).
- **Fun** : la bonne trappe s'ouvre avec un « clac », la mauvaise **tremble** (le servo secoue la porte) puis se referme.
- **Changement** : (a) tremblement du servo sur une erreur ; (b) en **difficile**, les barrettes ne restent allumées que 5 secondes puis s'éteignent : il faut compter de mémoire ; Réécouter les rallume, −5 s ; (c) choix de la trappe : **gauche = A, droite = B, appui = ouvrir** au joystick.
- **Moyen** : barrettes allumées en continu, règles simples (plus présente, tout à gauche).
- **Difficile** : barrettes qui s'éteignent, règles « plus rare » et « ni l'une ni l'autre ».
- **Faisable** : oui pour le servo et les LED. **À confirmer** : le plan ne montre ni bouton ni capteur sur les trappes ; je propose le joystick (bouton SW du KY-023). Variante : choisir en tournant E1 sur la lettre A ou B puis cliquer (les deux lettres sont sur l'anneau). Aussi à confirmer : la couleur de chaque trappe (liseré imprimé fixe ou autre).
- **Voix** : aucune nouvelle (les règles actuelles suffisent).

### Étape 3 · Simon sur les barrettes
- **Joueur** : regarde quelle barrette pulse (effet K2000), touche la douille dessous avec la fiche d'un câble, dans l'ordre.
- **Pièce** : barrettes, douilles, haut-parleurs.
- **Fun** : on touche vraiment avec une fiche banane, comme un faux circuit.
- **Changement** : **une note par barrette** (5 notes d'une gamme) dans SPK-L / SPK-R, donc on joue de la musique. Au dernier tour, en **difficile**, l'Entité annonce « Cette fois, à l'envers » : on rejoue la série à l'envers.
- **Moyen** : séries 2 à 5, rythme constant.
- **Difficile** : séries 3 à 6, plus rapide à chaque tour, dernier tour à l'envers.
- **Faisable** : oui. Notes générées par l'ESP32 (I2S déjà prévu pour les amplis).
- **Voix** : 2 nouvelles (« Écoute les notes. », « Cette fois, à l'envers. »).

### Étape 4 · Baie banane 1
- **Joueur** : branche ou débranche des câbles dans les 5 douilles selon la consigne.
- **Pièce** : câbles B1–B5, douilles D1–D5, barrettes.
- **Fun** : brancher à la main, avec l'Entité qui dit « Débranche le bleu, vite ! » (mensonge).
- **Changement** : quand un câble est branché, **la barrette au-dessus de la douille prend la couleur du câble** (retour d'état, pas de réponse). Un mauvais branchement fait un éclair rouge sur la barrette et un zap dans les haut-parleurs.
- **Moyen** : 1 consigne simple.
- **Difficile** : consignes combinées (échange, série).
- **Faisable** : oui (détection des câbles déjà prévue dans le matériel).
- **Voix** : aucune nouvelle.

### Étape 5 · Labyrinthe 1 (joystick)
- **Joueur** : guide le point vers la cible sur l'écran du bas.
- **Pièce** : joystick, CYD 2.
- **Fun** : la manette physique, et un mur qui **bouge** une fois.
- **Changement** : **en difficile seulement**, un mur apparaît ou disparaît au bout de 8 s, avec un petit glitch. Aucune nouvelle pièce.
- **Moyen** : labyrinthe fixe 5×5.
- **Difficile** : un mur qui bouge, plus la pression « Trop lent » après 9 s.
- **Faisable** : oui (CYD 2 dessine déjà le labyrinthe).
- **Voix** : aucune nouvelle (« Je prends tes commandes » existe déjà pour l'étape 9).

### Étape 6 · Code 1
- **Joueur** : tape au clavier les fragments entendus au fil des étapes, selon la règle.
- **Pièce** : clavier 4×4 (chiffres), CYD 2 (points du code).
- **Fun** : retenir, et repérer le **mensonge** (œil rouge = faux fragment).
- **Changement** : après une erreur, le clavier est **bloqué 3 s** (bip bas, les touches ne répondent plus) : on attend, le chrono tourne. Au bon code, la **trappe B s'ouvre** avec un clac : c'est là que sont rangées les **vraies clés** des serrures.
- **Moyen / Difficile** : comme aujourd'hui (2 ou 3 faux fragments).
- **Faisable** : oui. Les clés dans la trappe : **à confirmer avec Impression 3D** (place derrière la porte, module de 56 mm de profondeur).
- **Voix** : 1 nouvelle (« Clavier bloqué. Respire. »).

### Étape 7 · Serrures I et II : « deux clés, deux mains »
- **Joueur** : prend les 2 clés dans la trappe, les met dans les serrures I et II. Attend le signal, tourne **les deux en même temps** (à moins de 1 s d'écart).
- **Pièce** : serrures I et II, barrettes, chrono, haut-parleurs.
- **Fun** : l'ambiance « lancement de missile », deux mains, et l'Entité qui dit « Maintenant ! » **trop tôt** pour te faire craquer. Le vrai signal : **les 5 barrettes passent au vert** et un bip.
- **Changement** : avec 2 serrures, « l'ordre selon le poids » est un pile ou face. On le garde seulement en difficile, après le signal. Le n° de série (chiffres) donne alors l'ordre.
- **Moyen** : tourner ensemble au signal vert.
- **Difficile** : fausses alertes de l'Entité (2 fois), puis tourner d'abord la serrure du plus petit chiffre du n° de série, puis l'autre.
- **Faisable** : **à confirmer avec Électronique** : le plan ne dit pas comment on détecte la clé tournée. Hypothèse : un contact par serrure (1 entrée chacune).
- **Voix** : 4 nouvelles (consigne, faux « Maintenant », « Trop tôt », réussite).

### Étape 8 · Cryptex : le mot épelé
- **Joueur** : écoute l'Entité épeler un mot, le compose sur E1–E5, clique.
- **Pièce** : molettes, haut-parleurs, barrettes.
- **Fun** : c'est l'épreuve **à l'oreille** : aucun mot à l'écran, seulement les lettres que tu composes.
- **Changement** : à chaque lettre épelée, **la barrette n s'allume** (1 à 5), pour aider à placer chaque lettre sur sa molette. Règle à l'envers : l'ordre des barrettes est inversé aussi, c'est le piège.
- **Moyen** : barrettes qui accompagnent, Réécouter gratuit.
- **Difficile** : pas de barrettes, Réécouter coûte 5 s, règle « lettre suivante ».
- **Faisable** : oui.
- **Voix** : aucune nouvelle. Les lignes existantes sont réutilisées.

### Étape 9 · Labyrinthe dans le noir
- **Joueur** : même joystick, mais **on ne voit que les cases autour du point**.
- **Pièce** : joystick (et son bouton), CYD 2.
- **Fun** : tâtonner à l'aveugle, puis **appuyer sur le joystick** = un éclair de 1 s qui montre tout le labyrinthe (−5 s). Le sabotage (axes inversés) reste.
- **Changement** : remplace le 2e labyrinthe identique. Même code de labyrinthe, un masque en plus.
- **Moyen** : on voit un carré 3×3 autour du point, 2 éclairs possibles.
- **Difficile** : on voit les 4 cases voisines, 1 éclair, et le sabotage plus long.
- **Faisable** : oui (CYD 2) ; le bouton du joystick est **à confirmer câblé**.
- **Voix** : 2 nouvelles (« Je coupe la lumière. », « Un éclair. Une seule fois. »).

### Étape 10 · Baie banane 2 contre la montre
- **Joueur** : l'Entité a « remis les câbles droits » : 2 à 3 consignes d'affilée.
- **Pièce** : câbles, douilles, barrette 1 (comme chrono).
- **Fun** : **la barrette 1 se vide** LED par LED pendant que tu branches (8 LED = 25 s). À zéro : −8 s et on repart.
- **Moyen** : 2 consignes, barrette de 30 s.
- **Difficile** : 3 consignes, barrette de 20 s, mensonge de l'Entité.
- **Faisable** : oui.
- **Voix** : aucune nouvelle.

### Étape 11 · Code 2 avec le chrono
- **Joueur** : au « Top » de l'Entité, **lit les minutes sur le chrono**, puis les utilise dans le code.
- **Pièce** : TM1637, clavier.
- **Fun** : le chrono devient un indice vivant. Aucun code n'est écrit, c'est juste l'horloge de la mallette.
- **Changement** : nouvelle règle de code « plus les minutes lues au top » (en difficile). Les règles actuelles restent en moyen.
- **Moyen** : règles actuelles (à l'envers, rotation).
- **Difficile** : « plus les minutes lues au top » ou « décalé ».
- **Faisable** : oui (le TM1637 est déjà là, l'ESP32 connaît le temps).
- **Voix** : 4 nouvelles (« Au top, regarde le chrono. », « Top. », consigne, indice 2).

### Étape 12 · TRANSMIT
- **Joueur** : lève le capot rouge, bascule le levier.
- **Pièce** : levier TRANSMIT, barrettes, chrono, haut-parleurs.
- **Fun** : l'Entité supplie (« Ne touche pas ! »). Les 5 barrettes tournent en rouge. **Victoire** : balayage vert, jingle, et **le chrono se fige sur ton temps** (une trace de ta partie).
- **Changement** : le chrono figé, et le « Ne touche pas au levier » dit 2 fois.
- **Moyen / Difficile** : pareil.
- **Faisable** : oui.
- **Voix** : aucune nouvelle.

## 7. Rythme et variété

- **12 étapes, 8 minutes** : je garde. C'est serré, donc je propose un **bonus rafale** : une étape réussie en moins de 25 s rend **+3 s** (le chrono clignote). Ça récompense la vitesse.
- **Trois actes** : réveil (étapes 0 à 3), câblage et verrou (4 à 6), verrous finaux (7 à 12). La musique et la couleur des barrettes changent à chaque acte.
- **Rejouer** : le palier (moyen ou difficile) reste tiré au hasard ; chaque étape a 2 à 3 règles ; deux parties de suite diffèrent déjà. S'ajoutent le mot mêlé (34 mots), le mur mobile, le mode à l'envers du Simon et la règle « minutes du chrono ».

## 8. Règles qui ne bougent pas

- Aucune réponse à l'écran sauf avec `?debug=1`.
- Molettes : lettres A–V seulement. Chiffres : clavier seulement.
- Difficulté tirée au hasard entre moyen et difficile. Pas de mode facile.
- Aucune pièce du plan déplacée ni ajoutée.
- Voix de l'Entité : recette v0.1.5, enregistrée **plus tard** par Voix, **après ton OK**.

## 9. Voix nouvelles proposées (à enregistrer après approbation)

Français brut, sans mot anglais. Ces textes sont des propositions.

| Id | Texte |
|---|---|
| `clue_mot_melange` | Signal un. Les lettres sont mélangées, sur l'écran du bas. Forme le mot sur les cinq molettes, puis clique. |
| `theme_objet` | C'est un objet. |
| `theme_nature` | C'est dans la nature. |
| `theme_machine` | C'est une machine, ou un métier. |
| `hint1_mot_melange` | Indice : les cinq lettres sont sur l'écran du bas. Remets-les dans l'ordre pour faire un mot. |
| `hint2_mot_melange` | Un mot de cinq lettres. Chaque molette porte une lettre. |
| `hint3_mot_melange` | Dernier indice. La première lettre : |
| `simon_notes` | Écoute les notes. |
| `simon_envers` | Cette fois, à l'envers. |
| `code_bloque` | Clavier bloqué. Respire. |
| `cles_intro` | Deux clés. Deux mains. Attends mon signal. |
| `cles_maintenant` | Maintenant ! *(faux, dit trop tôt)* |
| `cles_trop_tot` | Trop tôt. |
| `cles_ensemble` | Ensemble. Bien. |
| `noir_coupe` | Je coupe la lumière. |
| `noir_eclair` | Un éclair. Une seule fois. |
| `code2_top` | Au top, regarde le chrono. Retiens les minutes. |
| `code2_top_dit` | Top. |
| `clue_code2_chrono` | Code deux. Chaque fragment plus les minutes que tu as vues au top. |
| `hint2_code2_chrono` | Ajoute à chaque fragment le chiffre des minutes, lu sur le chrono au top. |
| `rafale` | Rapide. Je n'aime pas ça. |

**À remplacer** (la v0.4.0 parle du n° de série pour les molettes, l'autre exécuteur les corrige déjà) : `clue_enc1_*`, `hint1_plaque`, `hint2_enc1_*`, `hint3_molette1` de l'étape 1.

Total : **21 nouvelles lignes**, plus la refonte des lignes de l'étape 1.

## 10. Questions pour toi (3)

1. **Mot mêlé** : d'accord que l'écran du bas affiche les 5 lettres **mélangées** (c'est l'énigme, jamais le mot) ? Sinon l'Entité devrait faire des devinettes à la voix (une trentaine de lignes en plus).
2. **Serrures** : d'accord pour « deux clés, deux mains » à la place de l'ordre par poids (pile ou face avec 2 serrures), avec les clés rangées dans la trappe ?
3. **Voix** : on fait d'abord une version avec la voix de l'appareil pour les 21 lignes, puis Voix n'enregistre que celles que tu gardes ?

## 11. Ordre de travail proposé

0. **Avant tout : figer la v0.4.0 dans Prototypes** (dépôt `entite-mallette-v040`, Pages, fiche du portail), comme pour les versions d'avant. Rien ne change en ligne avant ton OK.
1. v0.5.0 : n° de série en chiffres, **mot mêlé** (étape 1), voix texte seul.
2. v0.5.1 : barrettes vivantes (câbles, Simon avec notes, chrono de l'étape 10, accompagnement du cryptex).
3. v0.5.2 : serrures « deux clés » et trappes (tremblement, clés dedans).
4. v0.5.3 : labyrinthe dans le noir, mur mobile, clavier bloqué.
5. v0.5.4 : code 2 avec le chrono, bonus rafale, fin en beauté.
6. Chaque version : test complet (toutes les variantes, moyen et difficile), un seul retest du Testeur QA sur ce qui change, publication normale.
7. À la fin : Voix enregistre seulement les lignes que tu as gardées.

## 12. À confirmer côté matériel (pas pour toi, pour Électronique et Impression 3D)

- Détection d'une clé tournée dans chaque serrure (contact ?).
- Comment choisir une trappe (joystick, ou molette E1 sur A ou B) et comment on la marque (couleur, lettre).
- Place pour 2 clés derrière la porte d'une trappe.
- Bouton du joystick KY-023 câblé.
- Rien d'autre : toutes les autres idées utilisent des sorties déjà prévues (barrettes, chrono, haut-parleurs).
