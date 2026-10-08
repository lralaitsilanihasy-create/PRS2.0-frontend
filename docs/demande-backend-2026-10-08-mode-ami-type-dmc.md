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

> ⚠️ **Backend, 2026-10-08 — B1 livré (V85)** ; contrat : `docs/api-endpoints.md`, § *L'appel à manifestation d'intérêt en ligne,
> tranche AMI-b* (dernier point).
> - **Q1 : rattaché au type `DAO`** (accord du pilote). Toute la chaîne de la fiche (création du DMC, fiche, dossier soumis, lettres
>   d'invitation, consultation restreinte) exige ce type ; un type propre à la demande de propositions obligerait à reprendre chacune
>   de ces gardes, sans gain pour le front. La catégorie `PRESTATIONS_INTELLECTUELLES` vient toujours de la nature de la ligne.
> - **Q2 : par le libellé, pas par l'identifiant** : le référentiel des modes n'a pas de code stable. V85 retient le mode dont le
>   libellé contient « manifestation » puis « intérêt » (sans accents ni casse) et le rattache au type de **code** `DAO`. Il ne touche
>   pas un mode déjà rattaché par l'Administrateur. Sur DBPRS20, seul le mode **9** est concerné (vérifié en lecture).
> - **Test** : `AmiIntegrationTest.modeAmiRattacheAuTypeDao` couvre le chemin réel — une ligne PI en mode AMI sans type répond
>   `MODE_NON_DAO`, le SQL de V85 la rattache, puis la fiche naît et l'AMI se prépare.
> - **Recette** : au prochain démarrage du JAR, `POST /api/dmcs/par-marche/303290` (et 303291) crée la fiche. Le plan 100359 est
>   transmis au SIGMP ; la garde du PV signé favorable reste celle de toute ligne.

## Ensuite

Une fois la fiche créée sur la ligne 303290, le front fait la recette de bout en bout : AMI préparé et publié, expression déposée
par un candidat, présélection par la commission, rapport signé, liste publiée, lettres d'invitation tirées de la liste, dossier de
la demande de propositions.
