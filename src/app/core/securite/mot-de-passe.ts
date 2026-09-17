/**
 * Génération d'un mot de passe provisoire, pour la réinitialisation par l'Administrateur
 * (`POST /api/comptes-auth/{login}/reinitialiser-mot-de-passe`).
 *
 * ⚠️ Pourquoi le CLIENT le tire. L'endpoint attend un mot de passe dans son corps : c'est
 * l'appelant qui l'impose. Jusqu'ici, il était donc SAISI À LA MAIN dans le formulaire PRMP ou UGPM
 * — c'est-à-dire choisi par un humain pressé, sur un compte qui donne accès au circuit de contrôle
 * des marchés publics. Un tirage aléatoire ne se devine pas, ne se réutilise pas d'un compte à
 * l'autre, et ne ressemble pas au nom de la personne.
 *
 * ⚠️ `crypto.getRandomValues` et rien d'autre. `Math.random()` n'est pas un générateur
 * cryptographique : sa suite est prédictible à partir de quelques tirages. Ici, un mot de passe
 * prédictible est un compte ouvert.
 *
 * La politique du serveur (`MotDePasseValide`) demande 8 à 72 caractères dont au moins une lettre
 * et un chiffre. On tient cette règle **par construction** plutôt qu'en re-tirant jusqu'à ce qu'elle
 * passe : un caractère de chaque classe est placé d'abord, le reste est complété, puis l'ensemble
 * est battu — sans quoi les trois premières positions trahiraient leur classe.
 */

/** Alphabets SANS les caractères qu'on se lit mal à voix haute ou sur papier : 0/O, 1/l/I. */
const MINUSCULES = 'abcdefghijkmnopqrstuvwxyz';
const MAJUSCULES = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const CHIFFRES = '23456789';
const ALPHABET = MINUSCULES + MAJUSCULES + CHIFFRES;

/** Longueur par défaut : 16 — très au-dessus du minimum de 8 imposé par le serveur. */
export const LONGUEUR_MOT_DE_PASSE = 16;

/**
 * Entier aléatoire dans `[0, borne[`, SANS biais.
 *
 * Un simple `tirage % borne` favorise les premières valeurs quand `borne` ne divise pas la plage du
 * générateur ; on rejette donc la queue non divisible avant de prendre le reste.
 */
function indiceAleatoire(borne: number): number {
  const plage = 0x1_0000_0000;
  const limite = Math.floor(plage / borne) * borne;
  const tampon = new Uint32Array(1);
  let tirage = 0;
  do {
    crypto.getRandomValues(tampon);
    tirage = tampon[0];
  } while (tirage >= limite);
  return tirage % borne;
}

/** Un caractère tiré dans l'alphabet donné. */
function tirer(alphabet: string): string {
  return alphabet[indiceAleatoire(alphabet.length)];
}

/**
 * Mot de passe provisoire : `longueur` caractères, dont au moins une minuscule, une majuscule et un
 * chiffre. Refuse une longueur inférieure à 8 — ce serait plus faible que ce que le serveur accepte.
 */
export function genererMotDePasse(longueur: number = LONGUEUR_MOT_DE_PASSE): string {
  if (longueur < 8) {
    throw new Error('Un mot de passe provisoire fait au moins 8 caractères (politique du serveur).');
  }
  const caracteres = [tirer(MINUSCULES), tirer(MAJUSCULES), tirer(CHIFFRES)];
  while (caracteres.length < longueur) {
    caracteres.push(tirer(ALPHABET));
  }
  // Battage de Fisher-Yates, à la même source aléatoire : sans lui, les trois premières positions
  // porteraient toujours une minuscule, une majuscule puis un chiffre.
  for (let i = caracteres.length - 1; i > 0; i--) {
    const j = indiceAleatoire(i + 1);
    [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
  }
  return caracteres.join('');
}
