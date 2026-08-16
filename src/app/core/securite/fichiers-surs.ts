/**
 * Garde-fous de sécurité pour les fichiers affichés ou téléversés.
 *
 * Une URL `blob:` hérite de l'origine de l'application : un document HTML ou SVG
 * restitué tel quel dans une iframe ou un `window.open` exécuterait son script
 * dans cette origine (accès au stockage local, donc au jeton de session).
 * Tout affichage de blob doit donc passer par `urlBlobSure()` / `blobSur()`,
 * qui forcent un type MIME inerte.
 *
 * La validation d'upload doublonne la garde du backend (qui reste l'autorité)
 * pour un retour immédiat à l'utilisateur.
 */

/** Types dont l'affichage direct est sans danger (aucune exécution de script). */
export const TYPES_AFFICHABLES: readonly string[] = ['application/pdf', 'image/jpeg', 'image/png'];

/** Types acceptés au téléversement d'une pièce jointe. */
export const TYPES_PIECE: readonly string[] = ['application/pdf', 'image/jpeg', 'image/png'];

/** Type unique accepté pour l'import d'un document PPM. */
export const TYPES_PDF: readonly string[] = ['application/pdf'];

/** Taille maximale d'un fichier téléversé (Mo). */
export const TAILLE_MAX_MO = 20;

/** Retourne un Blob au type MIME sûr — contenu inchangé, type forcé si suspect. */
export function blobSur(blob: Blob): Blob {
  return TYPES_AFFICHABLES.includes(blob.type) ? blob : new Blob([blob], { type: 'application/pdf' });
}

/** `URL.createObjectURL` sur un blob au type forcé sûr — à utiliser pour tout affichage. */
export function urlBlobSure(blob: Blob): string {
  return URL.createObjectURL(blobSur(blob));
}

/**
 * Valide un fichier téléversé (type MIME et taille).
 * Retourne le message d'erreur à afficher, ou `null` si le fichier est acceptable.
 */
export function validerFichier(
  file: File,
  typesAcceptes: readonly string[] = TYPES_PIECE,
  maxMo = TAILLE_MAX_MO,
): string | null {
  if (!typesAcceptes.includes(file.type)) {
    const attendu = typesAcceptes.length === 1 ? 'PDF' : 'PDF ou image JPEG/PNG';
    return `Format de fichier non accepté : ${attendu} attendu.`;
  }
  if (file.size > maxMo * 1024 * 1024) {
    return `Fichier trop volumineux (${(file.size / 1024 / 1024).toFixed(1)} Mo) — maximum ${maxMo} Mo.`;
  }
  return null;
}
