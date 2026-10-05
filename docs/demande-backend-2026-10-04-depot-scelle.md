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

> ⚠️ **Livraison backend du 2026-10-04 (§B1, lot 3, V68).** Conforme : les six conditions dans cet ordre, codes tels que proposés.
> - **Condition 3** : la cérémonie close **et** `parts[].empreinte` de l'en-tête exactement les empreintes de `GET …/cles`, dans
>   l'ordre — sinon `CLES_INDISPONIBLES`, à la création comme au scellement (une clé remplacée entre-temps : le candidat rescelle).
> - **Condition 5** : le groupement n'est pas connu du serveur, mais l'exclusion de ses membres doit l'être. Le corps de
>   `POST …/offres` gagne donc **`groupementNifs: string[]`** (facultatif) : les NIF des membres, **pour ce seul contrôle** (gardés
>   pour la revérification au scellement, jamais servis). Messages tels qu'arrêtés ; pour un membre : « Un membre du groupement (NIF
>   *n*, *raison sociale*) est exclu des marchés publics par la décision de l'ARMP *réf.* du *JJ/MM/AAAA*, sans date de fin | jusqu'au
>   *JJ/MM/AAAA*. Le groupement ne peut pas déposer d'offre pendant cette période. »
> - **L'horloge** : `GET /api/horloge` tel que proposé (`fuseau` = le paramètre `FICHE_SE_FUSEAU`, défaut `Indian/Antananarivo`).
> - `ProcedureEnLigneDto` gagne `remplacementAutorise` et `depotsOuverts`, comme proposé.
> - La date limite est revérifiée **à chaque morceau** aussi (`DELAI_DEPASSE`), et au scellement.

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

> ⚠️ **Livraison backend du 2026-10-04 (§B2, lot 3).** Conforme. Ordre servi : `AE` (par lot si alloti), `RECU-DAO`, `GARANTIE` (si le
> cadrage dit `garantieSoumission = OUI`), puis les pièces de la fiche, rubrique `OFFRE` puis `ADMINISTRATIVE`, dans l'ordre du DAO.
> `obligatoire` vaut `true` pour toutes (aucune pièce de la fiche n'est facultative aujourd'hui) ; `parLot` d'une pièce de la fiche ne
> vaut `true` que si le marché est alloti. Le `code` `PIECE-<idPiece>` est stable **pour une version** de la fiche : une révision
> recopie les pièces sous de nouveaux identifiants — le candidat scelle contre la version publiée au moment du dépôt.

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

> ⚠️ **Livraison backend du 2026-10-04 (§B3, lot 3).** Conforme. Précisions :
> - **`enTete` voyage comme une chaîne** (le JSON sérialisé, pas un objet) : ce sont ses octets UTF-8 qui entrent dans l'empreinte ; le
>   serveur le relit pour le contrôler et le garde tel quel.
> - Contrôles (400 `EN_TETE_INVALIDE`) : `version = 1`, `idOffre` UUID (**c'est l'identifiant de l'offre** : le navigateur le tire),
>   `idDmc` et `lot` ceux du corps, `algorithmes` exactement les trois, `tailleMorceau = 4194304`, `nombreMorceaux = max(1,
>   ⌈tailleContenu / tailleMorceau⌉)`, `quorum` et `n` ceux de la cérémonie, chaque `part` en base64.
> - **Rangs des morceaux : de 0 à `nombreMorceaux − 1`** (l'ADR ne le fixait pas) — c'est aussi le `rang` des données authentifiées.
> - Le conteneur sur disque : longueur de l'en-tête (4 octets, gros-boutiste), en-tête, morceaux dans l'ordre ; l'empreinte ne couvre
>   que l'en-tête et les morceaux, comme l'ADR le dit.
> - `TAILLE_DEPASSEE` dès la création (taille annoncée) et au scellement (octets reçus).
> - Question 2 (ZIP par `fflate`) : sans objection côté serveur, qui ne voit jamais le clair. Le lot 4 relira ce ZIP au déchiffrement :
>   entrées stockées ou `deflate` seulement, comme proposé.

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

> ⚠️ **Livraison backend du 2026-10-04 (§B4, lot 3, V68).** Conforme, routes, DTO et codes tels que proposés. Écarts et précisions :
> - `POST …/offres` : codes en plus — 400 `LOT_INVALIDE` (marché alloti sans lot, ou lot hors 1…n ; non alloti avec un lot autre que
>   `null`), 400 `REMPLACE_INVALIDE` (l'offre à remplacer n'est pas l'une de vos offres déposées pour ce lot), 409 `TAILLE_DEPASSEE`. Un
>   identifiant déjà pris répond `OFFRE_EXISTANTE`. Un dépôt `EN_COURS` de la même entreprise pour le même lot est **abandonné** (purgé)
>   au profit du nouveau : recommencer ne demande rien de plus.
> - Morceaux : 400 `MORCEAU_INVALIDE` (rang hors de l'offre, morceau vide) ; 403 sur l'offre d'un autre candidat ; `DELAI_DEPASSE`.
> - Sceller : `MORCEAU_MANQUANT` porte les rangs dans **`details.rangs`** ; 409 **`MORCEAU_INVALIDE`** si un morceau autre que le
>   dernier n'est pas plein ou si la somme des contenus diffère de `tailleContenu` ; `EMPREINTE_DIFFERENTE` est journalisé et les
>   morceaux restent (renvoyer le fautif, resceller) ; `CLES_INDISPONIBLES` si une clé a changé depuis la création.
> - `AccuseDto` = `{ offre: OffreDto, entreprise, n, quorum, empreintesDetenteurs }` (l'offre **imbriquée** sous `offre`, pas aplatie).
>   `OffreDto` gagne `dateRetrait`. Le PDF de l'accusé est produit à la demande (moteur `DocumentLibre`), le courriel `ACCUSE_DEPOT`
>   porte le texte de l'accusé, **sans pièce jointe** (`EmailService` n'en envoie pas) : le PDF se télécharge par `…/accuse`.
> - Retrait : `DELETE` d'un dépôt `EN_COURS` → 409 **`OFFRE_NON_DEPOSEE`** (il se purge seul) ; même code pour l'accusé d'un dépôt en
>   cours.
> - Purge : toutes les 5 minutes (`app.offres.cron-entretien`), fichiers compris ; le journal reste.

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

> ⚠️ **Livraison backend du 2026-10-04 (§B5, lot 3).** Conforme, en suivant la proposition de la question 1 (le nombre seul avant la
> date limite). `DepotsDto.depots[]` = `{ numero, entreprise, nif, lot, dateDepot, dateRetrait, empreinte, taille, etat }` : les
> `DEPOSEE` par rang d'arrivée, puis les `RETIREE`, `REMPLACEE`, `ECARTEE` ; `depots` vaut `null` avant l'échéance. 403 pour
> l'Administrateur (sauf s'il est désigné responsable de la procédure) et pour tout autre profil ; la PRMP et l'UGPM au périmètre de la
> fiche. `FicheMarcheDto.depots = { nombre, clos }` en mode électronique, `null` en papier. `CeremonieDto.premierDepot` devient vrai à
> la première offre scellée.

## B6 — Notifications et journal

- `ACCUSE_DEPOT` au candidat (courriel, avec le PDF ou son lien), à chaque scellement ; `OFFRE_RETIREE` au candidat (courriel).
- `DEPOTS_CLOS` à la PRMP et au responsable de la procédure, à la date limite, avec le nombre — **aucune notification par
  dépôt** avant l'échéance (§B5).
- Journal `t_offre_journal` : création, morceaux (le nombre, pas le contenu), scellement (empreinte), remplacement, retrait,
  purge — par compte et par offre. Le journal global reçoit la route et l'acteur.
- Aucune dépendance côté serveur : il ne déchiffre rien au lot 3. Il **vérifie** seulement que l'en-tête est bien formé et que
  `parts[].empreinte` sont exactement les empreintes publiées (409 `CLES_INDISPONIBLES` si la liste a changé entre-temps — un
  remplacement de clé, lot 2b §B5 — le candidat rescelle avec la liste à jour).

> ⚠️ **Livraison backend du 2026-10-04 (§B6, lot 3).** Conforme. `ACCUSE_DEPOT` et `OFFRE_RETIREE` : une trace en base (type
> `CANDIDAT`) et le courriel, que le candidat lit (son espace n'a pas de centre de notifications). `DEPOTS_CLOS` : **une fois** par
> procédure (`t_ceremonie_cles.DATE_DEPOTS_CLOS`), au plus 5 minutes après la date limite, à la PRMP du plan et au responsable. Journal
> `t_offre_journal` : `CREATION`, `SCELLEMENT`, `SCELLEMENT_REFUSE`, `REMPLACEMENT`, `RETRAIT`, `PURGE` (les morceaux ne sont pas
> journalisés un par un : `t_offre_morceau` en garde la taille et l'empreinte jusqu'au scellement).
>
> **Recette** : le conteneur va sous `app.offres.repertoire` — sur le JAR de recette, `C:\Users\LANTO\prs-offres` (défaut
> `${user.home}/prs-offres`). La voie proposée (révision de la fiche 40 en électronique) reste à l'accord du pilote.

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

---

> ✅ **Front, lot 3 livré (2026-10-04, JAR V68)** — contre-recette réelle à venir (accord du pilote : une fiche validée et lancée).
> - **`core/securite/scellement.ts`** : archive ZIP du contenu (`fflate`, entrées stockées : `manifeste.json` + `<code>-<nom>` par
>   pièce, empreinte de chaque pièce au manifeste) ; `K` tirée, **partagée par `shamir-secret-sharing`** en `n` parts seuil
>   `quorum`, chaque part chiffrée RSA-OAEP pour un détenteur **dans l'ordre de `GET …/cles`** ; morceaux de 4 Mio AES-256-GCM,
>   **rangs 0…n−1** ; en-tête sérialisé une fois (`enTete` chaîne) ; empreinte = SHA-256(en-tête UTF-8 ‖ morceaux). **Testé** de bout
>   en bout : deux parts sur trois reconstituent `K` et le contenu revient à l'identique sur deux morceaux ; une part seule, un
>   morceau altéré ou un en-tête modifié échouent.
> - ⚠️ **À reprendre au lot 4 — les données authentifiées d'un morceau, octet pour octet** (l'ADR ne les fixait pas) : la chaîne
>   UTF-8 `${idOffre}|1|${rang}|${0|1}|${sha256 hexadécimal minuscule des octets UTF-8 de l'en-tête}` ; IV 12 octets en tête du
>   morceau, étiquette de 16 octets en fin. **Parts** : `shamir-secret-sharing` 0.0.4, 33 octets (32 + l'abscisse en dernier
>   octet), le clair RSA-OAEP est la part brute.
> - **Dépendances npm ajoutées**, à version figée : `shamir-secret-sharing` 0.0.4 (ADR §2) et `fflate` 0.8.3 (question 2, sans
>   objection du serveur).
> - **Écrans** : `/candidat/procedures/:idDmc/offre` (soumissionnaire et lot, groupement — `groupementNifs` envoyés —, acte
>   d'engagement saisi, pièces attendues avec `validerFichier` sur `B04-SE-07`/`-08`, code de la garantie, liste de ce qui manque,
>   temps restant à l'horloge du serveur, progression, **reprise** d'un morceau en échec réseau — trois essais, jamais sur une
>   erreur à code —, accusé à l'écran et en PDF) ; « **Mes offres** » (accusé, remplacer `?remplace=&lot=`, retirer en deux
>   temps) ; « Déposer une offre » sur la procédure quand `depotsOuverts` ; **PRMP** : pastille « n offres déposées », registre
>   `/prmp/dao/{idDmc}/depots` (nombre seul avant l'échéance, liste ensuite).
> - **Vérifié en lecture seule** sur la fiche 34 : pastilles « Commission : constituée », « Cérémonie close », « 0 offre déposée »,
>   registre « le détail s'affichera à la date limite ». Le dépôt réel attend une fiche **validée et lancée** en électronique.

> ⚠️ **Recette du 2026-10-05 (fiche 34, marché à un seul lot) — défaut trouvé et corrigé au front.** La procédure publique sert
> `lots: [{ numero: 1, … }]` pour un marché non alloti ; l'écran de dépôt proposait donc « Lot 1 » et scellait `lot = 1` dans l'en-tête.
> Le serveur ramène le lot à nul pour un marché à un seul lot (`controlerLot`), puis compare l'en-tête : refus « En-tête du conteneur
> invalide : lot ne correspond pas au corps ». **Tout dépôt sur un marché non alloti était impossible.** Correction front : un seul lot →
> pas de choix, lot nul au corps comme à l'en-tête (`lotEffectif`) ; dépôt réussi ensuite (offre n° 1, fiche 34).
> **Constat pour le backend (non bloquant)** : le corps accepte `lot = 1` sur un marché à un seul lot et le ramène à nul, l'en-tête
> scellé non. Tolérer `1` dans l'en-tête de la même façon rendrait les deux contrôles symétriques.
