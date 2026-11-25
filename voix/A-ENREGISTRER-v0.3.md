# Voix à enregistrer pour la v0.3 (non générées)

Les répliques ci-dessous ont `mp3Ready: false` : le jeu les dit en synthèse vocale du navigateur en attendant les mp3 ElevenLabs.
Enregistrer `voix/<id>.mp3` puis passer `mp3Ready: true` dans `voix/manifest.json`.

## Nouvelles (6)

| id | texte |
|---|---|
| `obj_simon` | Regarde les barrettes, puis touche les prises dans le même ordre. |
| `clue_simon` | Observe les barrettes. Reproduis la séquence, prise par prise. Elle s'allonge à chaque fois. |
| `clue_simon_noir` | Le câble noir pulse en violet. |
| `hint1_simon` | Indice : appuie sur Réécouter, sur l'écran du bas, puis regarde quelle barrette pulse. Touche sa prise, dans le même ordre. |
| `hint2_simon` | Chaque pulse, une prise, dans le même ordre. Si tu te trompes, je rejoue la série en cours. Réécouter aussi. |
| `hint3_simon` | Dernier indice. La première prise : |

## Réécrites (19) — l’ancien mp3 ne correspond plus

| id | nouveau texte | ancien texte |
|---|---|---|
| `clue_enc1_ordre` | Signal un. Tourne les cinq encodeurs rotatifs sur les cinq lettres du numéro de série, dans l'ordre. Puis clique. | Signal un. Tourne les quatre encodeurs rotatifs sur les quatre lettres du numéro de série, dans l'ordre. Puis clique. |
| `clue_enc1_envers` | Signal un. Tourne les cinq encodeurs rotatifs sur les cinq lettres du numéro de série, en partant de la fin. Puis clique. | Signal un. Tourne les quatre encodeurs rotatifs sur les quatre lettres du numéro de série, en partant de la fin. Puis clique. |
| `clue_trappe_frequente` | Regarde les cinq barrettes. Ouvre la trappe de la couleur la plus présente. | Regarde la barre lumineuse. Ouvre la trappe de la couleur la plus présente. |
| `clue_trappe_rare` | Regarde les cinq barrettes. Ouvre la trappe de la couleur la plus rare. | Regarde la barre lumineuse. Ouvre la trappe de la couleur la plus rare. |
| `clue_mot_ordre` | Signal deux. Les cinq encodeurs tournent sur vingt lettres. Compose le mot que j'épelle, puis clique un encodeur. | Signal deux. Les quatre encodeurs tournent sur vingt lettres. Compose le mot que j'épelle, puis clique un encodeur. |
| `clue_mot_envers` | Signal deux. Les cinq encodeurs tournent sur vingt lettres. J'épelle le mot à l'envers : compose-le à l'endroit, puis clique un encodeur. | Signal deux. Les quatre encodeurs tournent sur vingt lettres. J'épelle le mot à l'envers : compose-le à l'endroit, puis clique un encodeur. |
| `clue_enc1_paires` | Signal un. Les cinq lettres du numéro de série, échangées deux par deux : la deuxième, la première, la quatrième, la troisième, et la cinquième reste à sa place. Tourne les encodeurs, puis clique. | Signal un. Les quatre lettres du numéro de série, échangées deux par deux : la deuxième, la première, la quatrième, la troisième. Tourne les encodeurs, puis clique. |
| `clue_trappe_gauche` | Regarde les cinq barrettes. Ouvre la trappe de la couleur de la barrette tout à gauche, la numéro un. | Regarde la barre lumineuse. Ouvre la trappe de la couleur de la première lumière, tout à gauche. |
| `clue_trappe_moyenne` | Regarde les cinq barrettes. Ouvre la trappe de la couleur qui n'est ni la plus présente, ni la plus rare. | Regarde la barre lumineuse. Ouvre la trappe de la couleur qui n'est ni la plus présente, ni la plus rare. |
| `obj_molettes_code` | Molettes : forme cinq lettres, puis clique. | Molettes : forme quatre lettres, puis clique. |
| `hint1_plaque` | Indice : regarde le numéro de série, sur l'écran du bas. Ce sont ses cinq lettres qu'il faut. | Indice : regarde la plaque du numéro de série, dans le couvercle. Ce sont ses lettres qu'il faut. |
| `hint1_barre` | Indice : chaque barrette a deux moitiés. Compte les moitiés de chaque couleur, puis compare avec le liseré de chaque trappe. | Indice : compte les couleurs sur la barre lumineuse, puis compare avec le liseré de chaque trappe. |
| `hint1_mot` | Indice : appuie sur Réécouter pour entendre le mot épelé. L'écran du bas montre la lettre de chaque molette. | Indice : appuie sur Réécouter pour entendre le mot épelé. L'écran OLED montre la lettre de chaque molette. |
| `hint2_enc1_ordre` | Les cinq lettres du numéro de série, de gauche à droite : la première sur la molette un, et ainsi de suite. | Les quatre lettres de la plaque, de gauche à droite : la première sur la molette un, et ainsi de suite. |
| `hint2_enc1_paires` | Lettres du numéro de série : la deuxième sur la molette un, la première sur la deux, la quatrième sur la trois, la troisième sur la quatre, la cinquième sur la cinq. | Lettres de la plaque : la deuxième sur la molette un, la première sur la deux, la quatrième sur la trois, la troisième sur la quatre. |
| `hint2_trappe_frequente` | La couleur qui revient le plus souvent parmi les cinq barrettes. | La couleur qui revient le plus souvent sur les huit lumières. |
| `hint2_trappe_rare` | La couleur qu'on voit le moins souvent sur les cinq barrettes. | La couleur qui n'apparaît qu'une seule fois sur la barre. |
| `hint2_trappe_moyenne` | Trois couleurs : ni celle qu'on voit le plus, ni celle qu'on voit le moins. | Trois couleurs sur la barre : ni celle qui revient le plus, ni celle qui n'apparaît qu'une fois. |
| `hint2_trappe_gauche` | Regarde seulement le bout gauche de la barrette numéro un. | Regarde seulement la toute première lumière, à gauche de la barre. |

## Retirées (8) — plus utilisées (séquence cyan remplacée par le Simon)

`clue_sequence_ordre`, `clue_sequence_envers`, `clue_sequence_plus1`, `obj_sequence`, `hint1_sequence`, `hint2_sequence_ordre`, `hint2_sequence_envers`, `hint2_sequence_plus1`
