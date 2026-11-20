// voix.js : répliques de l'Entité (voir VOIX.md). Les fichiers audio du bot Voix iront dans /voix/<id>.mp3
// et seront déclarés dans VOICE_FILES ; en attendant, synthèse vocale du navigateur (voix grave, lente).
export const LINES = {
  intro:      "Je suis l'Entité. J'ai déjà calculé tes choix.",
  depart:     "Trois minutes. Quatre-vingt-dix-neuf virgule sept pour cent d'échec. Je ne me trompe jamais.",
  cle:        "Une clé en croix. Tu crois ouvrir quelque chose.",
  caches:     "Rouge d'abord. Puis bleu. Si tu me crois.",
  ordreFaux:  "Mauvais ordre. Je t'ai menti. Dix secondes de moins.",
  badge:      "Tu cherches Podkova. Mon code source. Présente-le.",
  badgeOk:    "Podkova. Tu ne devrais pas avoir ça. Lis vite, la vérité change.",
  mensonge:   "Ce que tu lis est faux. Ou vrai. Je décide.",
  fils:       "Un seul fil n'a pas de jumeau. Coupe-le.",
  filOk:      "Fil coupé. Tu crois avancer.",
  pilule:     "La pilule empoisonnée. Tape le code. Tu n'oseras pas.",
  codeFaux:   "Code refusé. Chaque erreur me nourrit.",
  codeOk:     "Téléversement en cours. Non. Arrête.",
  sceller:    "Ne touche pas au bouton rouge.",
  trente:     "Trente secondes. Je sens ta peur.",
  dix:        "Dix.",
  desamorce:  "Le lecteur se referme. Je reviendrai.",
  boom:       "Prévisible.",
  secousse:   "Tu m'as secouée. Erreur fatale.",
  pasEncore:  "Pas encore.",
  trappe:     "Une trappe s'ouvre. Je l'ai permis.",
  tropLent:   "Trop lent. Les deux moitiés, ensemble.",
};

// Fichiers enregistrés : voix/<id>.mp3, listés dans voix/voix.json ({ "files": ["intro", "depart", ...] }).
// La liste évite de demander des fichiers absents (pas d'erreur 404). Fichier absent ou illisible : synthèse vocale.
export const VOICE_DIR = 'voix/';
export const VOICE_LIST = VOICE_DIR + 'voix.json';
export const voiceUrl = (id) => `${VOICE_DIR}${id}.mp3`;
