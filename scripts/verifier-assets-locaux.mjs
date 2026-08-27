#!/usr/bin/env node
/**
 * Garde-fou de build — ressources **volontairement non versionnées** mais attendues par
 * l'application (`.gitignore`). Sans ce contrôle, leur absence sur un poste passe inaperçue :
 * `ng build` réussit, et l'image manque silencieusement à l'exécution (constat d'audit du
 * 27/08/2026 — le logo MEF de l'écran de connexion était absent du poste de développement).
 *
 * **Ce script n'échoue jamais** : il avertit, il ne bloque pas le build. Le fichier ne peut pas
 * être recréé automatiquement — sa restauration est une action manuelle.
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Chemin (relatif à la racine du projet) → à quoi sert le fichier, pour un message utile. */
const ATTENDUS = [
  {
    chemin: 'public/mef-logo.png',
    usage: "logo du ministère, affiché sur l'écran de connexion (features/auth/login/login.html)",
  },
];

const manquants = ATTENDUS.filter((a) => !existsSync(join(racine, a.chemin)));

if (manquants.length > 0) {
  console.warn('\n⚠  Ressources locales manquantes — le build se poursuit SANS elles :');
  for (const m of manquants) {
    console.warn(`   • ${m.chemin} — ${m.usage}`);
  }
  console.warn(
    "   Ces fichiers sont exclus du dépôt à dessein (voir .gitignore) : ils doivent être\n" +
      '   restaurés à la main sur le poste. Le build reste valide, mais la ressource sera\n' +
      "   introuvable à l'exécution.\n",
  );
}
