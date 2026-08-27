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
 * Délai avant révocation d'une URL d'objet remise au navigateur.
 *
 * Révoquer dans la foulée du `click()` ou du `window.open()` coupe le flux avant que le
 * navigateur ait fini de lire le blob : le téléchargement échoue en `ERR_FAILED` et l'onglet
 * ouvert reste blanc. Une minute laisse la place au transfert, puis rend la mémoire —
 * ne jamais remplacer ce différé par une révocation immédiate.
 */
const DELAI_REVOCATION_MS = 60_000;

/**
 * Enregistre un blob sur le poste sous `nomFichier`, via un lien `download` synthétique.
 *
 * Passe par `blobSur()` : un contenu piégé arrive au disque avec un type inerte, et surtout
 * l'URL `blob:` créée ici ne peut plus servir de puits actif si le code appelant évolue
 * (`window.open`, `<iframe>`). Unique manière d'écrire un téléchargement dans ce dépôt.
 */
export function telechargerBlob(blob: Blob, nomFichier: string): void {
  const url = urlBlobSure(blob);
  const lien = document.createElement('a');
  lien.href = url;
  lien.download = nomFichier;
  lien.click();
  setTimeout(() => URL.revokeObjectURL(url), DELAI_REVOCATION_MS);
}

/**
 * Ouvre un blob dans un nouvel onglet (consultation d'une pièce, d'un PDF, d'une photo).
 *
 * Le type MIME est forcé inerte par `blobSur()` — sans quoi un HTML ou un SVG téléversé
 * s'exécuterait dans l'origine de l'application, l'onglet ouvert partageant cette origine.
 * L'URL est révoquée en différé (cf. `DELAI_REVOCATION_MS`) : sans cela elle reste vivante
 * jusqu'au rechargement de l'application.
 */
export function ouvrirBlobSur(blob: Blob): void {
  const url = urlBlobSure(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), DELAI_REVOCATION_MS);
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
