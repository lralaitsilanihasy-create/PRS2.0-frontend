# Demande backend — 2026-10-04 — Soumission en ligne, lot 3 : le dépôt scellé d'une offre

**Date** : 2026-10-04 · **Émetteur** : front · **Origine** : plan `docs/plan-2026-10-04-soumission-en-ligne.md` (lot 3, Q2, Q6,
Q7, Q10), **ADR-0013** (§1 « Dépôt », §4 « Le conteneur », §7 « Le stockage »), lots 1 (candidat, V63 à V65), 2a (CAO, V67) et 2b
(cérémonie, V66), tous livrés et contre-recettés.

**Ce que le lot produit** : un candidat connecté **scelle son offre dans son navigateur** et la dépose avant la date limite ; le
serveur reçoit un **conteneur** qu'il ne peut pas lire, l'horodate, en recalcule l'empreinte et rend un **accusé de réception**.
Il connaît qui a déposé, quand, pour quel lot, et combien d'octets — **jamais le contenu**, ni un prix. Le candidat peut
remplacer ou retirer son offre tant que la date limite n'est pas passée, si la fiche l'autorise (`B04-SE-10`). La première offre
scellée fige la cérémonie et la CAO (`premierDepot`, lot 2b).

**Hors du lot** : l'ouverture des plis et la lecture des offres (lot 4) ; les formulaires structurés du candidat (bordereau,
DQE, capacités — lot 5) ; la garantie déposée directement par le garant (voie A, lot 5) ; la prorogation en cas
d'indisponibilité (lot 5). Au lot 3, l'offre est faite de **pièces** (des fichiers) et de l'**acte d'engagement** : son PDF
signé, et ses quelques valeurs saisies pour la lecture en séance.

**Conventions** : les noms de routes, de champs et de codes sont **PROPOSÉS** ; le backend les fixe et corrige ce document en
place (encadré ⚠️ daté). Le front ne code rien contre un nom non confirmé.

---

## B1 — Quand peut-on déposer : les conditions, et l'horloge

Le dépôt d'une offre pour une procédure exige, dans l'ordre où le serveur les vérifie :

1. la procédure figure dans la liste publique (`GET /api/procedures-en-ligne/{idDmc}` : fiche validée, remise électronique,
   lancée par l'avis, signature Simple) — sinon 409 **`PROCEDURE_FERMEE`** ;
2. `etat = OUVERTE` : après l'ouverture des dépôts (`B04-SE-03`), avant la date limite (`B04-LR-03` + `B04-LR-04`), à
   l'**horloge du serveur** (`B04-SE-04`) — sinon 409 `PROCEDURE_FERMEE` (pas encore ouverte) ou **`DELAI_DEPASSE`** ;
3. la cérémonie des clés est **close** et les clés publiques servies (`GET …/cles`, lot 2b) — sinon 409 **`CLES_INDISPONIBLES`**
   (un candidat ne peut pas sceller sans elles) ;
4. le candidat a **déclaré son entreprise** (lot 1, §B3) — sinon 409 `ENTREPRISE_ABSENTE` ;
5. l'entreprise, et chaque membre d'un groupement, ne sont **pas exclus** par l'ARMP (lot 1, §B5) — sinon 409
   **`ENTREPRISE_EXCLUE`**, avec le message arrêté par le pilote (« Votre entreprise (NIF *n*) est exclue des marchés publics par
   la décision de l'ARMP *référence* du *date*, jusqu'au *date*. Vous ne pouvez pas déposer d'offre pendant cette période. »,
   « sans date de fin » le cas échéant ; pour un groupement, le message nomme le membre exclu) ;
6. la fiche autorise le remplacement si l'offre en remplace une (`B04-SE-10 = OUI`) — sinon 409 **`REMPLACEMENT_INTERDIT`**.

- **L'horloge** : `GET /api/horloge` (public) → `{ maintenant: 'AAAA-MM-JJTHH:MM:SS', fuseau: 'Indian/Antananarivo' }`. Le
  navigateur affiche le temps restant d'après le serveur, jamais d'après la pendule du poste.
- `ProcedureEnLigneDto` (lot 1c) gagne `remplacementAutorise` (`B04-SE-10`) et `depotsOuverts: boolean` (la condition 2).
- **Le scellement doit être achevé avant la date limite** : un dépôt commencé et non scellé à l'échéance est refusé à
  `/sceller` (409 `DELAI_DEPASSE`). L'écran le dit dès que moins de quinze minutes restent.

## B2 — Les pièces attendues, lisibles par le candidat

| Méthode | URL | Accès | Réponse | Statuts |
|---|---|---|---|---|
| GET | /api/procedures-en-ligne/{idDmc}/pieces | public | `PieceAttendueDto[]` | 200, 404 |

- `PieceAttendueDto` = `{ code, rubrique: 'ADMINISTRATIVE' | 'OFFRE', numero, libelle, forme, ancienneteMaxMois, parLot,
  modele, obligatoire }` — dérivé des **pièces exigées de la fiche** (`GET /api/fiches-marche/{idDmc}/pieces`, lot 4 du chantier
  b, bloc B14), dans l'ordre du DAO, pour la dernière version validée. `code` est stable (`PIECE-<idPiece>`), c'est la clé par
  laquelle le manifeste de l'offre rattache un fichier à une pièce.
- Deux pièces s'ajoutent toujours, en tête de la rubrique `OFFRE` : l'**acte d'engagement signé** (`AE`, par lot) et le
  **reçu des frais de dossier** (`RECU-DAO`, décision Q3 — à confirmer par le juriste) ; en remise électronique avec garantie
  de soumission exigée, la **garantie** (`GARANTIE`, voie B : le document et son code de vérification, Q7).
- 404 hors des critères de la liste publique.

## B3 — Le conteneur, son contenu, et ce que le serveur en sait

- **Le conteneur** est celui de l'ADR-0013 §4, version 1 : un en-tête JSON en clair, puis des morceaux AES-256-GCM.
  - En-tête : `{ version: 1, idOffre, idDmc, lot, algorithmes: ['AES-256-GCM', 'RSA-OAEP-3072-SHA256', 'SHAMIR-GF256'],
    tailleMorceau: 4194304, nombreMorceaux, tailleContenu, quorum, n, parts: [{ empreinte, part }] }` — `parts` : pour chaque
    détenteur de `GET …/cles`, l'empreinte de sa clé publique et **sa part de `K` chiffrée** (RSA-OAEP, base64), dans l'ordre
    de la liste publiée.
  - Morceaux : `iv` (12 octets) ‖ chiffré ‖ étiquette (16 octets) ; données authentifiées = `idOffre | 1 | rang | dernier (0/1)
    | SHA-256(en-tête)`. Le dernier morceau est le seul plus court.
  - **Empreinte de l'accusé** = SHA-256 de l'en-tête (ses octets UTF-8, tels qu'envoyés) puis des morceaux dans l'ordre.
- **Le contenu en clair** (ce que `K` protège) est une **archive ZIP** (entrées sans compression ou `deflate`) :
  - `manifeste.json` = `{ version: 1, idDmc, lot, entreprise: { nif, raisonSociale }, groupement: [{ nif, raisonSociale, mandataire }]
    | null, acteEngagement: { montantHt, montantTtc, monnaie: 'MGA', delai, delaiUnite: 'JOURS' | 'MOIS', validiteJours,
    rabais: string | null }, pieces: [{ code, nomFichier, taille, sha256 }], garantie: { codeVerification, nomFichier } | null,
    dateScellement }` — les **quelques valeurs** que la séance d'ouverture lit à haute voix (lot 4) ;
  - un fichier par pièce, nommé comme dans `pieces[]`.
  - Les formats (`B04-SE-07`) et la taille par fichier (`B04-SE-08`) se vérifient **dans le navigateur** avant le scellement
    (`validerFichier`) ; le serveur ne peut vérifier que la **taille du conteneur** (`B04-SE-09`, 409 `TAILLE_DEPASSEE`) et
    l'intégrité des morceaux.
- **Ce que le serveur sait** : le compte, l'entreprise déclarée au moment du dépôt, le groupement **n'est pas** connu (il est
  dans le manifeste), le lot, l'horodatage, la taille, l'empreinte, l'en-tête (donc les empreintes des clés pour lesquelles
  l'offre est scellée). **Ce qu'il ignore** : tout le reste, et d'abord les montants.
- **Stockage** (ADR §7) : un fichier par offre sous `app.offres.repertoire`, la base garde l'en-tête, l'empreinte et le chemin.

## B4 — Les routes du dépôt (profil `CANDIDAT`)

| Méthode | URL | Corps | Réponse | Statuts |
|---|---|---|---|---|
| POST | /api/candidat/offres | `{ idDmc, lot, enTete, remplace: idOffre \| null }` | **201** `OffreDto` (`etat = EN_COURS`) | 201, 400, 409 (§B1 : `PROCEDURE_FERMEE`, `DELAI_DEPASSE`, `CLES_INDISPONIBLES`, `ENTREPRISE_ABSENTE`, `ENTREPRISE_EXCLUE`, `REMPLACEMENT_INTERDIT`, **`OFFRE_EXISTANTE`**) |
| PUT | /api/candidat/offres/{idOffre}/morceaux/{rang} | le morceau (`application/octet-stream`), en-tête `X-Empreinte: sha256-hex` | `{ rang, taille, recus }` | 200, 400 `EMPREINTE_DIFFERENTE`, 404, 409 `OFFRE_SCELLEE`, 413 |
| POST | /api/candidat/offres/{idOffre}/sceller | `{ empreinte }` | `AccuseDto` (`etat = DEPOSEE`) | 200, 400, 404, 409 `MORCEAU_MANQUANT`, `EMPREINTE_DIFFERENTE`, `DELAI_DEPASSE`, `ENTREPRISE_EXCLUE`, `TAILLE_DEPASSEE` |
| GET | /api/candidat/offres | — | `OffreDto[]` (toutes ses offres, toutes procédures) | 200 |
| GET | /api/candidat/offres/{idOffre} | — | `OffreDto` | 200, 403, 404 |
| GET | /api/candidat/offres/{idOffre}/accuse | — | le PDF de l'accusé | 200, 403, 404, 409 (non déposée) |
| DELETE | /api/candidat/offres/{idOffre} | — | `OffreDto` (`etat = RETIREE`) | 200, 403, 404, 409 `DELAI_DEPASSE`, `REMPLACEMENT_INTERDIT` (`B04-SE-10 = NON` interdit aussi le retrait) |

- **Une offre déposée par lot et par entreprise** : un second `POST` pour le même lot répond 409 `OFFRE_EXISTANTE`, sauf avec
  `remplace` : l'ancienne passe `REMPLACEE` au scellement de la nouvelle (jamais avant : un remplacement qui échoue laisse
  l'offre d'origine déposée). `lot = null` pour un marché non alloti.
- **Les morceaux** : 4 Mio au plus (plus 28 octets d'iv et d'étiquette ; 413 au-delà), dans n'importe quel ordre, **rejouables**
  (un morceau renvoyé remplace le précédent de même rang si l'empreinte diffère — c'est la reprise d'un envoi coupé) ; le
  serveur vérifie l'empreinte de chaque morceau (`X-Empreinte`) et compte les `recus`.
- **Sceller** : tous les morceaux présents (`MORCEAU_MANQUANT` nomme les rangs), empreinte globale recalculée identique à
  celle du navigateur (`EMPREINTE_DIFFERENTE`), **date limite revérifiée**, exclusion revérifiée (répertoire du jour),
  taille ≤ `B04-SE-09`. Alors : `etat = DEPOSEE`, `dateDepot` = horloge du serveur, `numero` = rang d'arrivée dans la
  procédure, **`premierDepot` posé** sur la cérémonie si c'est la première (lot 2b : plus de réouverture, CAO figée).
- **Un dépôt `EN_COURS` abandonné** (aucun morceau depuis 24 h, ou la date limite passée) est **purgé** par le serveur, fichier
  compris ; le candidat recommence.
- `OffreDto` = `{ idOffre, idDmc, reference, objet, lot, etat: 'EN_COURS' | 'DEPOSEE' | 'REMPLACEE' | 'RETIREE' | 'ECARTEE',
  dateCreation, dateDepot, numero, taille, nombreMorceaux, recus, empreinte, remplace, remplaceePar }`.
- `AccuseDto` = `OffreDto` + `{ entreprise: { nif, raisonSociale }, n, quorum, empreintesDetenteurs: string[] }` — ce que le
  candidat garde ; le **PDF** (`GET …/accuse`) dit la même chose, par le moteur de documents de la fiche, et part aussi par
  courriel (`ACCUSE_DEPOT`).
- **Retrait** (`DELETE`) : avant la date limite, si `B04-SE-10 = OUI` ; le conteneur est **conservé, marqué `RETIREE`**, et
  ne s'ouvre jamais (lot 4) — sa suppression attend l'avis du juriste sur la conservation (ADR §7, question 2). Journalisé.
- **`ECARTEE`** : posé par le lot 4 (exclusion prononcée après le dépôt, décision du pilote) ; déclaré ici pour que l'écran du
  candidat le connaisse.

## B5 — Ce que la PRMP et la fiche en savent

| Méthode | URL | Accès | Réponse | Statuts |
|---|---|---|---|---|
| GET | /api/fiches-marche/{idDmc}/depots | PRMP et UGPM de la fiche, responsable de la procédure | `DepotsDto` | 200, 403, 404 |

- **Avant la date limite**, `DepotsDto` = `{ clos: false, nombre, dateLimite }` — **le nombre seul** : qui a déposé ne se sait pas
  avant l'échéance, comme on ne lit pas le registre des plis avant l'heure (question 1 au pilote).
- **Après**, `{ clos: true, nombre, dateLimite, depots: [{ numero, entreprise, nif, lot, dateDepot, empreinte, taille, etat }] }`,
  les offres `DEPOSEE` et, à part, les `RETIREE` / `REMPLACEE` avec leur date — c'est le registre des dépôts, la matière de la
  séance d'ouverture (lot 4).
- `FicheMarcheDto` gagne `depots: { nombre, clos } | null` (mode électronique seul). `CeremonieDto.premierDepot` devient vrai.
- L'Administrateur ne lit pas les dépôts ; le candidat lit les siens (§B4).

## B6 — Notifications et journal

- `ACCUSE_DEPOT` au candidat (courriel, avec le PDF ou son lien), à chaque scellement ; `OFFRE_RETIREE` au candidat (courriel).
- `DEPOTS_CLOS` à la PRMP et au responsable de la procédure, à la date limite, avec le nombre — **aucune notification par
  dépôt** avant l'échéance (§B5).
- Journal `t_offre_journal` : création, morceaux (le nombre, pas le contenu), scellement (empreinte), remplacement, retrait,
  purge — par compte et par offre. Le journal global reçoit la route et l'acteur.
- Aucune dépendance côté serveur : il ne déchiffre rien au lot 3. Il **vérifie** seulement que l'en-tête est bien formé et que
  `parts[].empreinte` sont exactement les empreintes publiées (409 `CLES_INDISPONIBLES` si la liste a changé entre-temps — un
  remplacement de clé, lot 2b §B5 — le candidat rescelle avec la liste à jour).

## B7 — Ce que le front construira, à la confirmation

- **Écran du dépôt** `/candidat/procedures/:idDmc/offre` (connecté), par étapes : le lot (si alloti) ; le groupement
  (facultatif : NIF et raison sociale des membres, le mandataire) ; l'**acte d'engagement** : montant HT et TTC, délai, validité,
  rabais, et le **PDF signé** ; les **pièces attendues** (§B2), un fichier par pièce, `validerFichier` sur les formats et la taille
  de la fiche ; la **garantie** (fichier + code de vérification) ; le récapitulatif ; puis **« Sceller et déposer »** : archive ZIP
  en mémoire, `K` tirée, morceaux chiffrés, `K` partagée en `n` parts (seuil `quorum`) chiffrées pour les clés publiées, envoi
  des morceaux avec barre de progression et reprise d'un morceau coupé, scellement, **accusé** à l'écran (empreinte, numéro,
  horodatage) et PDF à enregistrer.
- **« Mes offres »** dans l'espace candidat : état, accusé, **remplacer** (`remplace`), **retirer** (confirmation en deux temps).
  La procédure (lot 1) montre « Déposer une offre » quand les conditions §B1 sont réunies, et dit laquelle manque sinon.
- **Cryptographie du navigateur** (`core/securite/scellement.ts`) : WebCrypto pour AES-GCM, RSA-OAEP et SHA-256 ;
  **`shamir-secret-sharing`** (Privy, ADR §2) pour le partage de `K` — **ajout de dépendance npm**, à une version figée ;
  **`fflate`** (MIT, ~8 ko) pour l'archive ZIP — **second ajout**, à confirmer (question 2). Rien d'écrit à la main.
- **Limites dites à l'écran** : l'offre s'assemble en mémoire (500 Mo au plus, `B04-SE-09`) ; un envoi interrompu se reprend
  morceau par morceau dans la même session, pas après fermeture du navigateur (le conteneur scellé n'est pas conservé sur le
  poste au lot 3) ; le temps restant est celui du serveur.
- **Recette** : elle demande une fiche **validée et lancée** en remise électronique, avec sa CAO et sa cérémonie close — la fiche
  34 est un brouillon incomplet ; la voie réaliste est une **révision de la fiche 40** (MEN, validée) en électronique, ou une fiche
  neuve complète. Écritures dans DBPRS20 : accord du pilote.

## Questions ouvertes

| # | Question | À qui |
|---|---|---|
| 1 | Avant la date limite, la PRMP voit-elle **le nombre seul** de dépôts (proposé), ou aussi qui a déposé ? | pilote |
| 2 | Le contenu en clair est une **archive ZIP** (`fflate`, dépendance npm) : accepté ? L'alternative est un format maison, exclu par principe | pilote, backend |
| 3 | L'acte d'engagement au lot 3 : **PDF signé + valeurs saisies** (montants, délai, validité, rabais) pour la lecture en séance — suffisant avant les formulaires structurés du lot 5 ? | pilote |
| 4 | Le conteneur d'une offre **retirée** : conservé marqué (proposé) jusqu'à l'avis du juriste sur la conservation (ADR §7), ou supprimé ? | juriste, par le pilote |
| 5 | Le reçu des frais de dossier comme pièce de l'offre (Q3 du plan) | juriste, par le pilote |
| 6 | Le registre des dépôts est-il un document à produire (PDF) à la date limite, pour la séance ? Le front le propose pour le lot 4 | pilote |
