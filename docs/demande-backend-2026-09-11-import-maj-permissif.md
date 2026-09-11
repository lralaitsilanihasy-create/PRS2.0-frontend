# Demande backend — Rendre l'import de mise à jour PERMISSIF (comme l'import de création)

**Date** : 2026-09-11 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : constat pilote — l'import
d'un PPM de mise à jour (`JIRAMA PPM MAJ 1.pdf`, dossier 100319) échoue **en bloc** en 400, alors qu'une
seule ligne est incohérente et que l'incohérence est trivialement corrigeable.

## Constat (400 reproduit avec le vrai PDF)

`POST /api/saisies/ppm/100319/mise-a-jour/import` (multipart, part `fichier`) →

```json
{ "status": 400, "message": "Validation échouée",
  "erreurs": [
    { "champ": "marches[1].beneficiaires",
      "message": "Le nouveau montant estimatif est fourni : chaque bénéficiaire doit porter nouvMontBenef." } ] }
```

Le **marché #2** porte un **nouveau montant estimatif = 468 794 467** au niveau du marché, mais la colonne
**« nouveau montant par bénéficiaire » est vide**. Il n'a **qu'UN bénéficiaire** (JIRAMA/EP) → la valeur
attendue est évidente (= 468 794 467). Sur tout le reste du PDF (≈ 60 lignes), aucune autre ligne n'est en
cause.

## Le fond : deux imports, deux comportements

- **Import de CRÉATION** `POST /api/saisies/ppm/import` → renvoie un `SaisiePpmImportResult` **read-only**
  avec **anomalies** (`corrige:true` pour les auto-corrections de montant, `A_VERIFIER`/`BLOQUANT` sinon).
  Il **ne rejette pas** : il charge, signale, auto-corrige. La **validation stricte** (cohérence
  bénéficiaires = Σ montants) a lieu **plus tard**, au `POST /api/saisies/ppm` (création réelle).
- **Import de MISE À JOUR** `POST /api/saisies/ppm/{id}/mise-a-jour/import` → **@Valid-rejette** (400) dès
  qu'une ligne est incohérente. Conséquence : **une seule ligne bloque tout l'import**, et l'utilisateur ne
  peut même pas charger le diff pour corriger la ligne dans la grille.

Cette asymétrie est le vrai problème : le PPM JIRAMA (source externe) laisse souvent la case « nouveau
montant par bénéficiaire » vide quand il n'y a qu'un bénéficiaire — le flux de mise à jour est donc
**inutilisable** sur ces PDF, alors que le flux de création les avalerait.

## Demande — aligner l'import mise-à-jour sur l'import de création

1. **Ne plus @Valid-rejeter** la cohérence bénéficiaires/montants **à l'import** mise-à-jour : parser le PDF,
   calculer le diff, et le **renvoyer** (comme l'import de création renvoie ses lignes + anomalies).
2. **Auto-corriger le cas NON AMBIGU** — marché à **un seul bénéficiaire** avec `nouvMontEstim` fourni mais
   `nouvMontBenef` vide → poser `nouvMontBenef = nouvMontEstim`, avec une **anomalie `corrige:true`**
   (« auto-corrigé, à confirmer »), exactement comme les auto-corrections de montant de l'import de création.
   (Miroir côté ancien montant si le même cas se présente.)
3. **Cas AMBIGU** (≥ 2 bénéficiaires, incohérence non déductible) → **anomalie** (`A_VERIFIER`/`BLOQUANT`),
   sans rejeter : l'utilisateur corrige la ligne dans la grille avant de créer.
4. **La validation STRICTE reste** — mais à **« Créer la mise à jour »** (le POST de création de la version
   suivante), pas à l'import. C'est déjà le point où le flux de création valide ; il suffit que la mise à
   jour fasse pareil.
5. Le **diff renvoyé** doit porter les **anomalies par ligne** (comme `SaisiePpmImportResult`) pour que la
   grille partagée les affiche (surlignage/badges) — si `DiffDossier` ne les porte pas encore, les y ajouter.

## Côté front — prêt

La grille partagée (`ppm-saisie-grid`) consomme déjà des `anomaliesParLigne` et gère la revue/validation par
ligne + la cohérence des montants (garde `benefsCoherents` reflétant la règle serveur) ; l'écran mise à jour
consomme déjà le `DiffDossier`. Dès que l'import renvoie le diff (+ anomalies) au lieu de rejeter, l'écran
affichera les lignes, l'utilisateur confirmera l'auto-correction du marché #2 et créera la mise à jour. Le
front affiche par ailleurs désormais proprement tout 400 résiduel de l'import (commit `3d30186`, plus de
silence).

## Recette de contre-vérification

1. `POST /api/saisies/ppm/100319/mise-a-jour/import` avec `JIRAMA PPM MAJ 1.pdf` → **200** (diff renvoyé,
   plus de 400). Le marché #2 revient avec `nouvMontBenef = 468 794 467` **auto-corrigé** (anomalie
   `corrige:true`), les autres lignes inchangées.
2. Créer un cas **ambigu** (2 bénéficiaires, `nouvMontEstim` fourni, un seul `nouvMontBenef`) → l'import
   renvoie le diff avec une **anomalie** sur cette ligne (pas de 400), et « Créer la mise à jour » la
   **refuse** tant qu'elle n'est pas corrigée (même 400 par champ qu'aujourd'hui, mais **au create**).
3. Depuis l'UI : importer le PDF JIRAMA → la grille montre les lignes + le marché #2 signalé/auto-corrigé →
   « Créer la mise à jour » → version suivante créée.
