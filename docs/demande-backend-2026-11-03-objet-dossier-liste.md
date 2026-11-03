# Demande backend — 2026-11-03 — L'objet du marché sur la liste des dossiers

## Contexte

Le pilote veut que chaque dossier se nomme par l'objet de son marché (maquette « espace PRMP », lot 6). « Tous mes dossiers »
(`GET /api/dossiers`) n'affiche aujourd'hui que la référence. Un brouillon, qui n'a pas encore de référence, s'y lit donc
« Dossier #100400 » : on ne sait pas qu'il s'agit du rapport justificatif de la RNS 13 à Fort Dauphin.

Le front ne peut pas retrouver l'objet seul :
- `ficheMarche` (avec `designationMarche`) est **absent des listes**, par choix, pour son coût (§ `DossierDto`) ;
- un dossier de **marché** ne dit pas sur la liste de quelle procédure ni de quelle ligne il vient ;
- `idDetailOrigine` (V163) obligerait à relire toutes les lignes de tous les plans pour un seul libellé.

## B1 — `DossierDto.objetMarche` et `DossierDto.lot`, sur les listes aussi

- **`objetMarche`** (`String`, `null` pour un plan) : la désignation de la ligne du plan que le dossier réalise :
  - un dossier de mise en concurrence né d'une fiche : la ligne de sa fiche ;
  - un dossier hors fiche rattaché à une ligne (`idDetailOrigine`, V163 : RJ, MGG…) : cette ligne ;
  - un dossier de marché : la ligne de sa procédure ;
  - un acte de gestion : la ligne de son marché.
- **`lot`** (`Integer`, `null` sinon) : le lot d'un dossier de marché.
- **Servis sur `GET /api/dossiers`** et ses variantes de liste, **résolus en lot** comme les noms d'auteur (quelques requêtes pour
  toute la liste, pas une par dossier), et sur `GET /api/dossiers/{id}`.
- Un dossier sans ligne connue garde `objetMarche` à `null` : le front affiche alors « — ».

## Ce que fait le front

À la livraison, « Tous mes dossiers » (PRMP, UGPM) gagne une colonne « Objet du marché ». Un brouillon y paraît sous son type
et son objet, par exemple « Rapport justificatif — Travaux de réhabilitation de la RNS 13… », au lieu de « Dossier #100400 ».
Rien n'est codé contre ces champs avant leur livraison.

> ⚠️ **2026-11-03 — B1 livré (PRS20, sans migration), un écart mineur.** `DossierDto.objetMarche` et `DossierDto.lot` sont servis
> sur `GET /api/dossiers` et toutes ses variantes de liste, et sur `GET /api/dossiers/{id}`.
> - Ils sont résolus en lot, une requête par nature pour toute la liste : actes de gestion, attributions, procédures, désignations des
>   lignes.
> - L'origine de l'objet suit la demande :
>   - la ligne de la fiche pour une mise en concurrence ;
>   - `idDetailOrigine` pour un dossier hors fiche ;
>   - la ligne de la procédure pour un marché, ou sa ligne d'origine pour un marché hors fiche (MGG) ;
>   - la ligne du marché pour un acte de gestion ;
>   - `null` pour un plan.
> - `lot` : le lot de l'attribution d'un dossier de marché ; `null` pour un acte de gestion, même sur un marché alloti.
> - **Écart** : la réponse de création (`POST /api/saisies/dossier`) ne les porte pas, faute de passer par l'enrichissement des listes.
>   L'écran les lit à la relecture du dossier.