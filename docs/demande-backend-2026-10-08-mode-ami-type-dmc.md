# Demande backend — 2026-10-08 — Le mode « Appel à manifestation d'intérêt » sans type de DMC

**Date** : 2026-10-08 · **Émetteur** : front · **Origine** : recette de l'AMI en ligne (tranches AMI-a et AMI-b,
`demande-backend-2026-10-07-ami-pi.md`), bloquée sur DBPRS20 ; accord du pilote du 07/10 pour le rattachement.

**Conventions** : le backend fixe la solution et corrige ce document en place (encadré ⚠️ daté).

## Le constat

- Les deux seules lignes de prestations intellectuelles de DBPRS20 — **303290** et **303291**, plan **100359** — portent le
  mode **9 « Appel à manifestation d'intérêt »**.
- Ce mode a **`idTypeDmc = null`** dans le référentiel des modes de passation : `POST /api/dmcs/par-marche/303290` répond
  **409 `MODE_NON_DAO`** (« Le mode « Appel à manifestation d'intérêt » n'est rattaché à aucun type de dossier de mise en
  concurrence — à faire par l'Administrateur (Types de DMC) »).
- Conséquence : aucune fiche de prestations intellectuelles ne naît de ces lignes, donc ni l'AMI (AMI-a, AMI-b), ni plus tard la
  demande de propositions (lot 3). Le test `AmiIntegrationTest` contourne le cas en créant sa propre ligne de prestations
  intellectuelles en « Appel d'offres ouvert » (mode 92) : le chemin réel n'est pas couvert.

## B1 — Une ligne en mode AMI crée sa fiche

Qu'une ligne de prestations intellectuelles en mode « Appel à manifestation d'intérêt » crée sa fiche : c'est le mode réel de ces
marchés au plan de passation. La fiche porte d'abord l'AMI, puis la demande de propositions (lot 3).

- **Par une migration**, pas par une saisie à l'écran Administrateur : le référentiel doit être juste dans toutes les bases
  (production comprise), pas seulement en recette.
- **Question Q1 (au backend)** : rattacher le mode 9 au **type de DMC de l'appel d'offres ouvert (id 1)** — accord du pilote —, ou
  créer un **type propre à la demande de propositions** ? Le front n'a pas d'autre exigence que la catégorie
  `PRESTATIONS_INTELLECTUELLES` de la fiche, tirée de la nature de la ligne.
- **Question Q2** : le mode est-il identifié par son libellé ou par un code stable ? Une base où il porte un autre identifiant que 9
  doit être couverte par la migration.

## Ensuite

Une fois la fiche créée sur la ligne 303290, le front fait la recette de bout en bout : AMI préparé et publié, expression déposée
par un candidat, présélection par la commission, rapport signé, liste publiée, lettres d'invitation tirées de la liste, dossier de
la demande de propositions.
