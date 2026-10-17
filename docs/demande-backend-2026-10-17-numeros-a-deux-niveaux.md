# Demande backend — 2026-10-17 — La lecture des tableaux reconnaît les numéros à deux niveaux (« 2.3 ») et les chapitres en chiffres romains

## Contexte

En livrant la tranche B de la charte des DAO de travaux (3a4b16e), le backend a relevé que le DAO des bâtiments scolaires
du MEN (`Documents Types/Travaux/ExemplesDAO/daolance.DAO_2026_4SDC_vf.pdf`) ne rend **aucun article** à l'import
(`demande-backend-2026-10-17-charte-dao-travaux.md`, §T4). Le pilote demande que cela soit traité : les DAO de bâtiments
suivent souvent cette forme.

Le front a regardé le détail quantitatif et estimatif (pages 44 à 50, deux lots). Les chiffres romains ne sont que la moitié
de la cause :

| Ligne du tableau | Première cellule | Unité | Ce qu'elle est |
|---|---|---|---|
| « I — Terrassement » | `I` | — | un chapitre |
| « 1.1 — Débroussaillage et décapage des terres végétales » | `1.1` | m2 | un article |
| « 2.2 — Béton armé dosé à 350 kg/m3… » | `2 .2` (coupée par l'extraction) | m3 | un article |
| « Total terrassement…… » | vide | — | un sous-total |

`LectureTableaux.NUMERO` (`^\d{1,3}$`) ne reconnaît ni `I`, ni `1.1`. Aucune ligne n'est numérotée, donc aucune n'est un
article. Le prototype avait la même règle.

## B1 — Un numéro d'article à deux niveaux

Une première cellule de la forme `chapitre.article` est un numéro d'article :
- motif : `^(\d{1,2})\s*\.\s*(\d{1,3})$`, qui accepte la coupure « 2 .2 » ;
- `code` (et donc `numeroPrix`) : la forme rétablie sans espace, « 2.2 ». Le champ accepte déjà « 2.4 » (V59) ;
- rang de tri : `n = (chapitre + 1) × 1000 + article`. Les articles restent rangés dans l'ordre du DQE (0.1 avant 1.1 avant
  10.1), et un rang ne peut pas se confondre avec un numéro simple (≤ 999).

Un numéro simple (`^\d{1,3}$`) se lit comme aujourd'hui.

## B2 — Un chapitre en chiffres romains est une ligne de section

Une première cellule de la forme `^[IVXL]{1,7}$` compte comme une ligne numérotée (début du tableau, `iPremier`), mais elle
ne crée **jamais** d'article :
- sans unité, c'est une section du bordereau, comme « 000 Installation » aujourd'hui : elle devient la `serie` et le
  `serieLibelle` des articles qui la suivent (« IV », « Maçonnerie - ravalement ») ;
- avec une unité, elle est ignorée. Un article n'a jamais un numéro romain.

Les lignes de sous-total (« Total terrassement… ») n'ont pas de numéro et sont déjà ignorées.

## Mesure (prototype `scripts/import-dao/lire-specs.mjs`, 17/10)

- **DAO du MEN** : 0 → **113 articles**, sur deux lots (56 + 57). Les douze chapitres (0 à XI) deviennent les séries. Le
  résultat est dans le jeu de référence : `scripts/import-dao/attendus-articles/men-4sdc.json`.
  - Les numéros 5.3 et 5.4 manquent aux deux lots : ils n'existent pas dans le document.
  - Le 5.1 du lot 1, en haut de la page 45, n'est pas lu : la ligne n'appartient à aucun tableau extrait, sans doute parce
    que son filet supérieur n'est pas tracé. C'est une limite de ce document, pas de la règle. Le lot 2 a bien son 5.1.
- **Parité** : les neuf DAO déjà mesurés (2463, 297, 6114, MTP Ankily, 6213, routiers, et les trois DAO de démonstration)
  donnent une sortie **identique**, ligne pour ligne, avant et après. Aucun ne porte de numéro à deux niveaux.

Code du prototype, à porter tel quel (comme l'ADR-0012) :

```js
const ROMAIN = /^[IVXL]{1,7}$/;
const numeroDe = (x) => {
  if (/^\d{1,3}$/.test(x)) return { n: +x, code: x };
  const m = /^(\d{1,2})\s*\.\s*(\d{1,3})$/.exec(x);
  return m ? { n: (+m[1] + 1) * 1000 + +m[2], code: `${+m[1]}.${+m[2]}` } : null;
};
const numerote = (l) => numeroDe(premiere(l)) != null || ROMAIN.test(premiere(l));
// iPremier : t.lignes.findIndex(numerote)
// par ligne : numero = numeroDe(premiere(l)), chapitre = ROMAIN.test(premiere(l)),
//             num = numero?.n ?? (chapitre ? -1 : null) ;
//             la ligne de section (bordereau sans unité) reste traitée avant ; puis `if (chapitre) continue` ;
//             a.code ??= numero.code
```

Le tableau « Définition des prix » (`PRIX_DEF`) n'est pas touché.

> ⚠️ **2026-10-17, livré côté backend (B1, B2), sans écart.**
> - **Portage** : `LectureTableaux.numeroDe` et `ROMAIN`, tels quels. Le début du tableau, la ligne de section et le code de
>   l'article passent par eux. L'astérisque de la tranche B (« 2.2* ») est retiré avant le motif.
> - **Mesure** : `LectureTableauxRecetteTest` reçoit le DAO du MEN contre une copie de `attendus-articles/men-4sdc.json` :
>   **113 articles sur 113**, identiques (lot, numéro, désignation, unité, quantités, série, caractéristiques). Les cinq DAO
>   réels de la recette gardent leur parité.
> - **Fichier** : la recette cherche le DAO dans `PRS_DAO_DIR`, à défaut dans Téléchargements, puis dans
>   `frontendprs2/Documents Types/Travaux/ExemplesDAO`.
> - **Test sans fichier** (pour la CI) : `LectureTableauxNumerosTest`, sur un détail quantitatif construit à la main
>   (« 0 », « I », « 2 .2 », « 10.1 », chapitre avec unité ignoré).

## Hypothèses à confirmer

- **H1** : `^[IVXL]{1,7}$` suffit (jusqu'à XXXVIII chapitres). Un DAO qui numéroterait ses chapitres en lettres (A, B…) reste
  hors champ : « A » se confondrait avec une unité ou une désignation.
- **H2** : aucune contrainte serveur sur `numeroPrix` n'interdit le point. Le front le croit au vu de V59 (« 2.4 » cité
  dans la demande du DQE des travaux).

> ⚠️ **2026-10-17, confirmées.**
> - **H1** : tenue.
> - **H2** : tenue. `NUMERO_PRIX` et `SERIE` sont des `varchar(10)` sans motif (V59). `BesoinFiche` n'y contrôle que la
>   longueur et l'unicité du numéro dans le lot. « 2.2 » et « XIV » passent.

## Ce que le front fera, dès la livraison

- Rien à développer à l'écran : la revue de l'import montre déjà le numéro, la série et son libellé.
- Recette par l'import du DAO du MEN sur une fiche de travaux à deux lots, dès qu'une ligne de travaux sera éligible. Le
  résultat sera reporté dans cette demande.
