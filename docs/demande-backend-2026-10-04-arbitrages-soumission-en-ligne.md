# Demande backend — 2026-10-04 — Soumission en ligne : les arbitrages du pilote après le lot 4

Le pilote a tranché le 04/10 au soir les questions laissées ouvertes par les lots 1 à 4
(`demande-backend-2026-10-04-ouverture-des-plis.md`, questions 1, 3, 4, 5 ; `…-commission-appel-offres.md` ; `…-depot-scelle.md`).
Quatre décisions demandent un changement au serveur (B1 à B4). Les quatre autres confirment le fonctionnement actuel et sont
consignées au §B5 pour que la documentation du backend les reprenne.

Les noms ci-dessous sont **proposés** : le backend fait autorité, et ce document sera corrigé en place si la livraison s'en écarte.

## B1 — Les pièces des offres : les membres de la CAO seulement

> Décision du pilote : « Après l'ouverture, qui peut lire les pièces des offres ? — **Les membres de la CAO seulement**. »

Aujourd'hui (§B4 du lot 4), `GET /api/fiches-marche/{idDmc}/seance/offres/{idOffre}/pieces/{nomFichier}` sert le responsable,
les membres de la CAO et la PRMP ; l'UGPM reçoit 403.

| Méthode | URL | Accès demandé | Statuts |
|---|---|---|---|
| GET | /api/fiches-marche/{idDmc}/seance/offres/{idOffre}/pieces/{nomFichier} | **membres de la CAO de la procédure** | 200, **403** pour le responsable, la PRMP, l'UGPM et tout autre compte |

- **La lecture** (`GET …/seance/lecture`) ne change pas : le responsable, la PRMP et l'UGPM continuent de lire, offre par offre,
  ce qui est lu en séance (soumissionnaire, montants, délai, garantie, pièces manquantes, alertes). Seul l'**accès aux fichiers**
  est restreint.
- Le 403 porte un code nommé, proposé `PIECE_RESERVEE_CAO`, pour que l'écran l'explique.
- Le responsable conduit la séance sans ouvrir les pièces. S'il doit montrer une pièce à la salle, c'est un membre qui l'ouvre
  depuis son poste.

> ⚠️ **2026-10-04 — livré (V70), conforme.** Le code `PIECE_RESERVEE_CAO` est retenu ; il vaut pour le responsable, la PRMP,
> l'UGPM et tout autre compte. Un 403 peut désormais porter un `code` dans `ErrorResponse`.
- À reporter dans `docs/regles-gestion.md` (règle d'accès) et `docs/api-endpoints.md` (§ lot 4, B4).

## B2 — Le PV d'ouverture : signé par la CAO, extrait publié

> Décision du pilote : « PV d'ouverture : **signé par la CAO, extrait publié**. »

Aujourd'hui (§B5 du lot 4), `POST …/seance/pv` produit le PV, passe la séance à `CLOSE` et, si `B04-OP-13 = OUI`, publie
aussitôt un extrait sans les alertes ni la vérification des NIF. Les membres présents n'ont qu'une ligne de signature sur papier.

Proposition : une **signature électronique simple** par chaque **membre présent**, depuis son espace `/cao`. Le niveau Simple
est celui retenu pour la plateforme (§B5) : l'acte authentifié du membre connecté, horodaté et journalisé.

| Méthode | URL | Accès | Corps | Réponse | Statuts |
|---|---|---|---|---|---|
| POST | /api/fiches-marche/{idDmc}/seance/pv | responsable | `{ observations }` | `SeanceDto` (`etat = PV_A_SIGNER`) | 200, 403, 409 |
| POST | /api/fiches-marche/{idDmc}/seance/pv/signer | **membre présent** de la CAO | — | `SeanceDto` | 200, 403 `NON_PRESENT`, 409 `DEJA_SIGNE` / `PV_NON_PRODUIT` |
| GET | /api/fiches-marche/{idDmc}/seance/pv | responsable, membres, PRMP, UGPM | le PDF (avec les signatures déjà posées) | 200, 403, 404 |

- **Nouvel état** de la séance, proposé `PV_A_SIGNER`, entre `DECHIFFREE` et `CLOSE`. La séance passe à `CLOSE` quand **tous les
  membres présents** ont signé.
- `SeanceDto.pv` gagne `signatures: [{ im, nom, president, date }]` et `signaturesAttendues: [{ im, nom }]`.
- **Publication** : l'extrait (sans les alertes ni la vérification des NIF — c'est la décision « extrait publié », conforme à la
  livraison du lot 4) n'est publié **qu'une fois le PV signé par tous les présents**, et non plus dès sa production. Avant cela,
  `GET /api/procedures-en-ligne/{idDmc}/pv` → 404.
- Le PDF reproduit chaque signature : nom, qualité (président ou membre), date et heure, et la mention « signé électroniquement
  sur la plateforme ».
- **Notifications** : `PV_A_SIGNER` à chaque membre présent (courriel compris, comme au lot 4) ; `PV_OUVERTURE` (PRMP, membres,
  soumissionnaires si publié) part **à la dernière signature**, et non plus à la production.
- **Journal** : chaque signature (qui, quand).
- **Question 1** au backend : un membre présent qui ne signe pas — absent après la séance, compte bloqué — bloque la publication.
  Faut-il une sortie (le président constate le refus ou l'empêchement, motif au PV) ? Proposé : oui, `POST …/seance/pv/empechement`
  par le président, `{ im, motif }`, porté au PV.
- Le PV de carence (aucune offre) et le PV de constat d'illisibilité (S5) suivent la même règle.

> ⚠️ **2026-10-04 — livré (V70), Q1 retenue.** Écarts et précisions :
> - `SeanceDto.pv` = `{ produit, publie, signe, signatures: [{ im, nom, president, date, empechement, motif,
>   constatePar }], signaturesAttendues: [{ im, nom }] }` : un empêchement constaté figure parmi les `signatures`
>   (`empechement = true`) ;
> - les signataires sont **figés à la production du PV** (membres présents, y compris présents d'office pour avoir apporté leurs
>   parts) ; les présences ne se modifient plus en `PV_A_SIGNER` (409 `SEANCE_CLOSE`) ; un compte qui n'est pas signataire reçoit
>   aussi 403 `NON_PRESENT` ; après la dernière signature, `signer` → 409 `DEJA_SIGNE` ;
> - `empechement` : le **président** de la CAO, ou **le responsable** si le président est lui-même empêché ; 400
>   **`MOTIF_ABSENT`** / **`NON_SIGNATAIRE`**, 409 `DEJA_SIGNE` si le membre a déjà signé ; le PV imprime « empêché de signer :
>   motif (constaté par X le …) » ;
> - **sans aucun membre présent**, rien à attendre : le PV est signé d'office, la séance passe aussitôt à `CLOSE` ;
> - le **PV de constat (S5)** se signe de même mais la séance **reste `ILLISIBLE`** (seuls `pv.signe` le disent) ;
>   `OFFRES_ILLISIBLES` part toujours dès le constat ;
> - journal : `SIGNATURE`, `EMPECHEMENT`, `PV_SIGNE`.

## B3 — La garantie de soumission lue en séance

> Décision du pilote : l'acte d'engagement saisi en ligne gagne **la garantie** — montant et émetteur, lus en séance.

Aujourd'hui, le manifeste scellé (lot 3, §B3) porte `garantie: { codeVerification, nomFichier } | null`, et la lecture
(lot 4, §B4) sert `garantie: { codeVerification, presente } | null`.

Proposition — le **manifeste** (contenu chiffré, version de format 2) :

```
garantie: { codeVerification, nomFichier, montant: number, monnaie: 'MGA', emetteur: string } | null
```

- `montant` et `emetteur` sont **obligatoires** quand la garantie est présente. Ils sont saisis par le candidat à côté du code de
  vérification et contrôlés dans le navigateur, comme les montants de l'acte d'engagement : le serveur ne lit rien avant
  l'ouverture.
- La **lecture** sert `garantie: { codeVerification, presente, montant, monnaie, emetteur } | null`. Le **PV** imprime le montant
  et l'émetteur, offre par offre.
- **Compatibilité** : une offre déjà déposée avec un manifeste sans `montant` ni `emetteur` reste lisible. Ces champs sont alors
  servis `null`, et la lecture ne doit pas marquer l'offre `LECTURE_IMPOSSIBLE`. **Le front ne scellera le nouveau format qu'après
  la livraison** de ce point : un champ inconnu dans un manifeste ne doit jamais rendre une offre illisible en séance.
- **Question 2** au backend : faut-il confronter le montant au minimum de la fiche (`B05-GS-*`, montant de la garantie exigée par
  lot) et lever une **alerte** en lecture (jamais un refus, comme les rapprochements) si le montant est inférieur ? Proposé : oui,
  alerte `GARANTIE_INSUFFISANTE`.

> ⚠️ **2026-10-04 — livré (V70), Q2 retenue.** Écarts et précisions :
> - le minimum est **`B05-GS-03`** (par lot **`B05-GS-03#n`**), lu sur la dernière version validée ; l'alerte ne se lève que
>   pour un montant **déclaré et inférieur** : aucune alerte en format 1 (montant `null`) ni sans minimum à la fiche. Message :
>   « Garantie de 1 500 000 pour un minimum de 1 600 000 fixé par la fiche[ (lot n)]. » ; absente du PV publié ;
> - le serveur **ne contrôle pas** la présence du montant ni de l'émetteur (il ne lit rien avant l'ouverture) ; `montant` se
>   lit nombre ou chaîne (« 1 600 000 », « 1600000,50 »), illisible il vaut `null` — l'offre n'est jamais marquée
>   `LECTURE_IMPOSSIBLE` pour ces champs, et un champ inconnu du manifeste est ignoré. Le front peut sceller le format 2.

## B4 — La CAO saisie par la PRMP et l'UGPM ; la conservation en paramètre

### B4.1 — L'UGPM saisit la CAO

> Décision du pilote : « Qui saisit la CAO ? — **PRMP et UGPM**. »

| Méthode | URL | Accès demandé |
|---|---|---|
| PUT | /api/fiches-marche/{idDmc}/cao | PRMP **et UGPM** de la fiche (même entité, mêmes droits que sur la fiche du marché) |
| POST | /api/fiches-marche/{idDmc}/cao/decision (fichier de la décision) | PRMP **et UGPM** |
| POST | /api/fiches-marche/{idDmc}/cao/membres/{idMembre}/inviter (renvoi de l'invitation) | PRMP **et UGPM** |

- La **décision** reste celle de la PRMP (sa référence et sa date). L'UGPM la prépare et la saisit, comme elle saisit la fiche.
- Le **journal** de la CAO nomme l'acteur réel (PRMP ou UGPM).
- Les exclusions restent les mêmes : ni la PRMP ni l'UGPM ne siègent.

> ⚠️ **2026-10-04 — livré (V70).** Précision sur le journal : le `ref` d'une UGPM est celui de sa PRMP de tutelle. L'entrée
> `membresCommission` écrite par une UGPM porte donc `nomActeur` = son nom (« NOM Prénoms », à défaut son login) et **`acteur`
> vide**, pour ne pas imputer l'acte à la PRMP.

### B4.2 — La durée de conservation des offres

> Décision du pilote : « Combien de temps conserve-t-on les offres ? — **À fixer par l'Administrateur**. »

- Nouveau paramètre, proposé `OFFRE_CONSERVATION_ANNEES`, dans `GET` / `PUT /api/parametres/candidats` (déjà servi à
  l'Administrateur, lot 1). **Valeur nulle par défaut = conservation sans limite** : rien n'est supprimé tant que l'Administrateur
  n'a pas fixé de durée.
- Le délai court **à partir de la clôture de la séance** et vise les conteneurs chiffrés, les contenus déchiffrés, les offres
  remplacées et les offres retirées. Le journal (dépôts, retraits, accusés, empreintes) et le PV ne sont **jamais** supprimés.
- La purge, une fois la durée fixée, est journalisée (procédure, nombre d'offres, date).
- **Question 3** au backend : la purge est-elle automatique (tâche planifiée) ou un geste de l'Administrateur sur une liste de
  procédures échues ? Proposé : un geste, pour qu'aucune suppression ne se fasse sans un acteur nommé.

> ⚠️ **2026-10-04 — livré (V70), Q3 : le geste de l'Administrateur est retenu.** Écarts et précisions :
> - le champ JSON est **`offreConservationAnnees`** (la clé du paramètre reste `OFFRE_CONSERVATION_ANNEES`) ; de 1 à 100 (400
>   nominatif), **`0` au `PUT` l'efface** (retour à « sans limite »), absent il garde sa valeur ;
> - deux routes neuves, Administrateur seul : `GET /api/admin/offres/conservation` → `{ annees, echues: [{ idDmc, reference,
>   objet, etatSeance, closeLe, echeance, offresAPurger }] }` (procédures échues ayant encore des offres sur disque, la plus
>   ancienne d'abord ; vide tant que la durée n'est pas fixée) et `POST /api/admin/offres/conservation/{idDmc}/purger` →
>   `{ idDmc, offresPurgees, purgeeLe }`, 409 **`CONSERVATION_NON_FIXEE`** ou **`CONSERVATION_EN_COURS`** (`details.echeance`) ;
> - « clôture de la séance » = `closeLe` : PV entièrement signé, ou constat S5 **dont le PV est signé** ;
> - la purge vise toutes les offres de la procédure (déposées et écartées comprises, pas seulement remplacées et retirées) ;
>   restent la ligne de l'offre, son empreinte, sa lecture, l'accusé, les journaux et le PV. Après la purge, une pièce répond
>   404 (« … a été purgé le … ») et `…/lecture` reste servie ; journal `PURGE_CONSERVATION` (offres et séance).

## B5 — Décisions qui confirment le fonctionnement actuel (rien à changer)

- **Dépositaire de la part de secours : libre, par procédure.** Le responsable le désigne (nom, organisme, fonction, contact),
  comme aujourd'hui. L'« ARMP (hypothèse) » de la recette n'est pas une règle : aucun organisme imposé.
- **Reçu des frais de dossier : pièce de l'offre.** Le téléchargement du DAO reste libre après inscription ; `RECU-DAO` reste une
  pièce obligatoire de l'offre, vérifiée par la CAO. Cela confirme la décision Q3 : le juriste n'a plus à la confirmer.
- **Signature électronique : Simple pour l'instant.** Avancée et Qualifiée attendent la liste officielle des prestataires de
  certification. Une fiche qui exige plus que Simple reste refusée.

> ⚠️ **2026-10-04 — livré (V70), consigné sans changement** dans `docs/regles-gestion.md` et `docs/api-endpoints.md`
> (§ *Les arbitrages du pilote après le lot 4*, §B5) ; l'ADR-0013 note le dépositaire libre (question 1 de l'ADR).

## Ce que le front fera, à la livraison

- **B1** : dès maintenant, l'écran de séance du responsable, de la PRMP et de l'UGPM ne propose plus d'ouvrir les pièces. Seul
  l'espace `/cao` les ouvre. Le 403 `PIECE_RESERVEE_CAO` sera nommé.
- **B2** : dans `/cao/procedures/{idDmc}`, « Signer le PV d'ouverture » (aperçu du PDF, confirmation) et la liste des signatures.
  Chez le responsable, l'état « PV à signer » et qui manque. Chez la PRMP et l'UGPM, la même chose en lecture.
- **B3** : au dépôt, « Montant de la garantie » et « Émetteur » à côté du code. Contrôle dans le navigateur, manifeste en version 2
  **après** la livraison. En lecture et en projection : montant et émetteur, et l'alerte si elle est retenue.
- **B4.1** : l'écran CAO de la fiche ouvert à l'UGPM en écriture.
- **B4.2** : le champ dans l'écran « Paramètres des candidats » de l'Administrateur.
