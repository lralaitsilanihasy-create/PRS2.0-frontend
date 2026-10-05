# Demande backend — 2026-10-04 — Soumission en ligne, lot 4 : l'ouverture des plis en séance

**Date** : 2026-10-04 · **Émetteur** : front · **Origine** : plan `docs/plan-2026-10-04-soumission-en-ligne.md` (lot 4, Q8),
**ADR-0013** (§1 « Ouverture », §2 « La reconstitution au serveur sous condition », §5 S3 et S5), lots 2a (CAO, V67), 2b
(cérémonie, V66) et 3 (dépôt, V68), livrés.

**Ce que le lot produit** : à l'heure d'ouverture des plis (`B04-OP-02` / `B04-OP-03`), en séance présidée par le **président de
la CAO** et conduite par le **responsable de la procédure**, chaque membre présent apporte **ses parts** — il les déchiffre dans son
navigateur avec sa clé ; au **quorum**, le serveur reconstitue la clé de **chaque** offre, vérifie son empreinte, la déchiffre, et
**toutes les offres s'ouvrent dans le même geste** (exigence 2). La séance lit à haute voix ce que chaque offre déclare ; le serveur
produit le **PV d'ouverture**. Le contenu des offres devient alors une pièce du dossier.

**Conventions** : les noms de routes, de champs et de codes sont **PROPOSÉS** ; le backend les fixe et corrige ce document en place
(encadré ⚠️ daté). Le front ne code rien contre un nom non confirmé.

---

## B0 — D'abord : lever la condition de l'ADR (interopérabilité Shamir)

L'ADR-0013 §2 subordonne la reconstitution au serveur à un test d'interopérabilité en CI : des parts produites par
`shamir-secret-sharing` doivent être recombinées par BouncyCastle (`bcprov-jdk18on` ≥ 1.80). Le front fournit les vecteurs,
**produits par son propre code** :

- `docs/vecteurs-scellement-2026-10-04.json` (17 ko), généré par `scripts/vecteurs-scellement.mjs` (`node scripts/vecteurs-scellement.mjs`,
  mêmes bibliothèques et mêmes règles que `src/app/core/securite/scellement.ts`) :
  - `shamir` : un secret de 32 octets, `n = 3`, seuil 2, les trois parts en hexadécimal (33 octets chacune, **l'abscisse en dernier
    octet**) — toute paire doit redonner le secret ;
  - `conteneur` : trois détenteurs (clés publiques SPKI et **clés privées PKCS#8 de test**, générées pour l'occasion, sans valeur),
    `K`, l'en-tête tel qu'envoyé, le morceau (base64 et SHA-256), l'empreinte de l'accusé, le SHA-256 du contenu en clair. Le test
    attendu : déchiffrer deux parts RSA-OAEP (SHA-256, **MGF1-SHA-256** explicite), recombiner `K` par BouncyCastle, comparer à
    `conteneur.k`, déchiffrer le morceau AES-256-GCM avec les données authentifiées ci-dessous, comparer `sha256Contenu`.
  - Le front a vérifié ces vecteurs en relecture indépendante (Node, WebCrypto) : parts 1 et 3 → le secret ; détenteurs 2 et 3 →
    `K` ; contenu déchiffré → `sha256Contenu`.
- **Variante à deux morceaux** (4 Mio + 1000 octets : un morceau plein avec « dernier » = 0, puis le court) :
  `node scripts/vecteurs-scellement.mjs --deux-morceaux` (≈ 5,6 Mo, non commitée) — à générer sur le poste si la CI la veut.
- **Les données authentifiées** d'un morceau, fixées par le front au lot 3 (encadré ✅ de la demande du dépôt) : la chaîne UTF-8
  `${idOffre}|1|${rang}|${0 ou 1}|${sha256 hexadécimal minuscule des octets UTF-8 de l'en-tête}` ; IV 12 octets en tête du morceau,
  étiquette de 16 octets en fin.
- **Si le test échoue** : le repli de l'ADR (recombinaison dans le navigateur du responsable de séance, §B3.4). Le front le
  construira seulement dans ce cas — le dire dans l'encadré de §B0.

> ⚠️ **Livraison backend du 2026-10-04 (§B0, lot 4).** ✅ **Condition levée** : `DechiffrementOffreTest` (CI, `bcprov-jdk18on` **1.86**,
> dépendance ajoutée) recombine toute paire des parts Shamir des vecteurs, puis déchiffre le conteneur de bout en bout (deux parts
> RSA-OAEP SHA-256 / MGF1-SHA-256, `K` = `conteneur.k`, morceau AES-256-GCM avec les données authentifiées, `sha256Contenu` et
> l'empreinte de l'accusé retrouvés ; un morceau altéré ou les données d'une autre offre sont refusés). Vecteurs copiés dans
> `src/test/resources/scellement/`. **Le repli §B3.4 n'est pas à construire.** Le test d'intégration de la séance scelle aussi des offres
> en Java (BouncyCastle pour le partage) et les ouvre par les routes ; la variante à deux morceaux n'est pas ajoutée à la CI.
> **Constat sur les vecteurs** : les abscisses de `shamir-secret-sharing` sont tirées au hasard (103, 255, 227 ici), pas « rang + 1 » :
> voir l'encadré du §B2.

## B1 — La séance : son état et son déroulé

| Méthode | URL | Accès | Réponse | Statuts |
|---|---|---|---|---|
| GET | /api/fiches-marche/{idDmc}/seance | responsable, membres de la CAO, PRMP et UGPM de la fiche | `SeanceDto` | 200, 403, 404 |
| POST | /api/fiches-marche/{idDmc}/seance/ouvrir | responsable | `SeanceDto` (`etat = OUVERTE`) | 200, 403, 404, 409 `SEANCE_PREMATUREE`, `DEPOTS_NON_CLOS` |
| PUT | /api/fiches-marche/{idDmc}/seance/presences | responsable | `{ presents: [im…], autres: [{ nom, qualite }] }` | `SeanceDto` | 200, 400, 403, 409 |

- `SeanceDto` = `{ idDmc, etat, heureOuverture, ouverteLe, ouverteDans: secondes | null, quorum, membres: [{ im, nom, president,
  present, partsApportees: boolean }], secoursEmploye: boolean, offres: [{ numero, lot, etat, partsRecues }], dechiffreeLe,
  pv: { produit, idDocument } }`.
  - `etat` ∈ `A_VENIR` (avant l'heure) · `OUVERTE` (le responsable l'a ouverte, les parts arrivent) · `DECHIFFREE` (toutes les
    offres sont ouvertes) · `ILLISIBLE` (S5 constaté) · `CLOSE` (PV produit).
  - `heureOuverture` = `B04-OP-02` + `B04-OP-03`, à l'horloge du serveur (`GET /api/horloge`).
- **Ouvrir** : responsable seul, à partir de l'heure d'ouverture (409 `SEANCE_PREMATUREE` avant, avec l'heure dans `details`),
  quand la date limite des dépôts est passée (409 `DEPOTS_NON_CLOS`). Une procédure **sans offre** déposée : la séance s'ouvre
  quand même et passe directement au PV de carence (§B4).
- **Présences** : le responsable coche les membres présents et ajoute les autres présents (PRMP, observateurs, soumissionnaires
  en mode présentiel ou mixte, `B04-OP-10`) ; elles s'impriment au PV. Un membre qui apporte ses parts est marqué présent
  d'office.
- **Lecture** : les membres et le responsable lisent tout ; la PRMP et l'UGPM lisent l'état et, après déchiffrement, la lecture
  (§B3) — ils ne lisent rien d'une offre avant.

> ⚠️ **Livraison backend du 2026-10-04 (§B1, lot 4, V69).** Conforme. Précisions :
> - `SeanceDto` gagne `autres: [{ nom, qualite }]` (les présents hors CAO) ; `pv` = `{ produit, publie }` (le PDF se lit par
>   `GET …/seance/pv`, pas d'`idDocument`) ; `offres[].etat` vaut l'intégrité une fois l'offre ouverte (`INTACTE`, `ALTEREE`,
>   `LECTURE_IMPOSSIBLE`), sinon l'état de l'offre (`DEPOSEE`, `RETIREE`, `REMPLACEE`, `ECARTEE`).
> - Ouvrir : l'heure d'abord (`SEANCE_PREMATUREE`, `details.heureOuverture` en `AAAA-MM-JJTHH:MM`), puis `DEPOTS_NON_CLOS` ; une seconde
>   ouverture → 409 `SEANCE_DEJA_OUVERTE`. Sans offre, la séance s'ouvre directement **`DECHIFFREE`** (PV de carence).
> - Présences : 400 `MEMBRE_INCONNU` (un `presents` qui n'est pas membre), 400 `PRESENT_INVALIDE` (un autre présent sans nom), 409
>   `SEANCE_NON_OUVERTE` / `SEANCE_CLOSE`.
> - L'Administrateur et les autres profils internes : 403 (sauf s'ils sont le responsable désigné).

## B2 — Les parts : chaque membre apporte les siennes

| Méthode | URL | Accès | Corps | Réponse | Statuts |
|---|---|---|---|---|---|
| GET | /api/fiches-marche/{idDmc}/seance/mes-parts | membre de la CAO (sa clé) ; responsable avec `?role=SECOURS` | — | `[{ idOffre, empreinteCle, part }]` | 200, 403, 409 `SEANCE_NON_OUVERTE` |
| POST | /api/fiches-marche/{idDmc}/seance/parts | le même | `{ parts: [{ idOffre, partClaire }], motif? }` | `SeanceDto` | 200, 400, 403, 409 `SEANCE_NON_OUVERTE` / `PART_INVALIDE` / `PARTS_INCOMPLETES` / `CLE_ABSENTE` |

- **`mes-parts`** : pour chaque offre `DEPOSEE`, la part chiffrée pour **la clé de l'appelant**, retrouvée dans l'en-tête de l'offre
  par l'**empreinte** de sa clé (ADR §5, S4 : une offre scellée avant un remplacement de clé désigne l'**ancienne** clé — le serveur
  sert alors aussi l'enveloppe archivée correspondante, `enveloppe` dans la ligne, pour que le membre la déverrouille avec la phrase
  de l'époque). **Refusé tant que la séance n'est pas `OUVERTE`** : avant l'heure, un membre n'a même pas les parts chiffrées.
- Le membre déverrouille sa clé dans son navigateur (lot 2b), **déchiffre ses parts** (RSA-OAEP), et les envoie **toutes en une
  fois** (`PARTS_INCOMPLETES` s'il en manque une : sa contribution vaut pour toutes les offres ou pour aucune). `partClaire` = la
  part brute de 33 octets, en base64.
- **Le serveur refuse avant l'heure** (exigence 3) et contrôle chaque part sans rien reconstituer : longueur de 33 octets, abscisse
  attendue (le rang du détenteur dans l'en-tête + 1, si `shamir-secret-sharing` numérote ainsi — à constater sur les vecteurs, sinon
  l'abscisse servie dans l'en-tête de la part), sinon 409 `PART_INVALIDE`.
- **La part de secours (S3)** : le responsable, avec `?role=SECOURS`, le pli ouvert devant la séance : l'enveloppe de secours (lot 2b,
  `GET …/cles/secours`), la phrase dictée, les parts déchiffrées — et un **`motif` obligatoire** (400 sans lui), imprimé au PV.
- Les parts claires sont gardées **en mémoire du serveur pour la séance seulement** (ou chiffrées au repos par une clé de session,
  au choix du backend) et **oubliées** après le déchiffrement ou l'abandon de la séance ; jamais journalisées.

> ⚠️ **Livraison backend du 2026-10-04 (§B2, lot 4).** Conforme. Écarts et précisions :
> - **L'abscisse** : `shamir-secret-sharing` tire ses abscisses au hasard ; « rang + 1 » ne vaut pas, et l'en-tête ne la porte pas (la part
>   y est chiffrée). Le serveur contrôle donc la **forme** (33 octets en base64, abscisse non nulle) et la **cohérence** : deux détenteurs
>   n'apportent pas la même abscisse pour une offre — sinon `PART_INVALIDE`. Une part fausse mais bien formée ne se voit qu'au
>   déchiffrement (l'offre passe `LECTURE_IMPOSSIBLE`).
> - `mes-parts` : `enveloppe` est servie seulement quand la part désigne une clé **archivée** (S4) ; `null` sinon.
> - `POST …/parts` : 409 `PARTS_INCOMPLETES` porte les offres manquantes dans `details.offres` ; 400 **`MOTIF_ABSENT`** pour la part de
>   secours sans motif. Un détenteur peut rapporter ses parts (elles remplacent les précédentes).
> - Les parts claires vivent **en mémoire du serveur seulement** (aucun chiffrement au repos : elles ne touchent jamais le disque), effacées
>   au déchiffrement ou au constat S5. **Un redémarrage du serveur pendant la séance les perd** : les membres les rapportent.

## B3 — Le quorum atteint : tout s'ouvre ensemble

- Dès que **`quorum` détenteurs** distincts ont apporté leurs parts (la part de secours compte pour un), le serveur, **dans un même
  geste** et pour **chaque** offre `DEPOSEE` :
  1. recalcule l'**empreinte** du conteneur stocké et la compare à celle de l'accusé — une différence est **signalée** à la lecture et
     au PV (`integrite = ALTEREE`), et le déchiffrement est tenté quand même (AES-GCM refusera un morceau altéré : `LECTURE_IMPOSSIBLE`) ;
  2. **recombine `K`** (BouncyCastle, §B0) à partir de `quorum` parts, déchiffre les morceaux, relit l'archive ZIP (entrées stockées
     ou `deflate`), lit `manifeste.json` et vérifie l'**empreinte de chaque pièce** contre celle du manifeste ;
  3. range le contenu déchiffré au régime des pièces du dossier (ADR §7), et **oublie `K` et les parts**.
- **Ne s'ouvrent pas** : les offres `RETIREE` et `REMPLACEE` (mentionnées au PV comme telles), et les offres d'une entreprise
  **exclue après son dépôt** — posées **`ECARTEE`** par le système à ce moment, **non déchiffrées**, mentionnées « écartée : entreprise
  exclue par l'ARMP » avec la décision (décision du pilote, plan Q2).
- `etat = DECHIFFREE`, `dechiffreeLe`. Un échec technique sur une offre ne bloque pas les autres : elle est marquée
  `LECTURE_IMPOSSIBLE`, avec la raison, et le PV le dit.
- **§B3.4 — le repli** (seulement si §B0 échoue) : `POST …/seance/cle` par le responsable, `{ idOffre, k }` — `K` recombinée dans son
  navigateur à partir des parts que le serveur lui remet **après le quorum** ; le serveur vérifie `K` par le déchiffrement du premier
  morceau. À ne construire que si nécessaire.

> ⚠️ **Livraison backend du 2026-10-04 (§B3, lot 4).** Conforme. L'écartement (entreprise **ou membre du groupement** exclu au répertoire du
> jour) se fait au même geste, avant tout déchiffrement. `LECTURE_IMPOSSIBLE` porte sa raison dans `motif` (conteneur altéré, parts
> insuffisantes, déchiffrement refusé, archive sans `manifeste.json`…). Le clair est rangé sur disque, sous `app.offres.repertoire`
> (`<idOffre>.clair.zip`) ; sa durée de conservation attend le juriste (question 5). §B3.4 : non construit.

## B4 — La lecture en séance

| Méthode | URL | Accès | Réponse | Statuts |
|---|---|---|---|---|
| GET | /api/fiches-marche/{idDmc}/seance/lecture | responsable, membres de la CAO, PRMP et UGPM | `LectureDto` | 200, 403, 409 `SEANCE_NON_DECHIFFREE` |
| GET | /api/fiches-marche/{idDmc}/seance/offres/{idOffre}/pieces/{nomFichier} | responsable, membres de la CAO, PRMP | le fichier | 200, 403, 404, 409 |

- `LectureDto` = `{ offres: [{ numero, idOffre, lot, etat, integrite: 'INTACTE' | 'ALTEREE' | 'LECTURE_IMPOSSIBLE', entreprise: { nif,
  raisonSociale, verification: VerificationNifDto, exclusion }, groupement, acteEngagement: { montantHt, montantTtc, delai,
  delaiUnite, validiteJours, rabais }, garantie: { codeVerification, presente } | null, pieces: [{ code, libelle, presente,
  nomFichier, empreinteConforme }], piecesManquantes: [libelle…], alertes: [{ type: 'RAPPROCHEMENT' | 'EXCLUSION', message }] }],
  nonOuvertes: [{ numero, entreprise, etat, motif }] }`.
  - **La vérification du NIF** (lot 1, §B4) s'affiche ici, comme décidé : elle ne bloque rien, la commission la lit.
  - **Les rapprochements entre déposants** (lot 1, §B6 — même téléphone, signataire, adresse, et désormais les adresses saisies dans
    les manifestes) sont remis **ici**, offre par offre : une alerte, jamais un refus.
  - Les pièces sont comparées aux **pièces attendues** de la version publiée (lot 3, §B2) : présente ou manquante, empreinte conforme.
- Les membres et le responsable ouvrent chaque pièce ; le front la montre par `ouvrirBlobSur` (jamais une URL brute).
- L'ordre de lecture est l'**ordre d'arrivée** (`numero`).

> ⚠️ **Livraison backend du 2026-10-04 (§B4, lot 4).** Conforme. Précisions :
> - `OffreLue` gagne `motif` (la raison d'une intégrité dégradée) ; `groupement` et `acteEngagement` sont **repris du manifeste tels quels** ;
>   `garantie.presente` dit si le manifeste nomme un fichier de garantie.
> - `piecesManquantes` : les libellés des pièces attendues obligatoires absentes du manifeste (la garantie compte présente si le manifeste
>   la porte).
> - `alertes` : `RAPPROCHEMENT` entre déposants **de cette procédure** (téléphone, signataire, adresse, comme au lot 1) ; les adresses saisies
>   dans les manifestes n'y entrent pas encore — le manifeste du lot 3 n'en porte pas. `EXCLUSION` si une exclusion est en cours.
> - Pièces : `manifeste.json` n'est pas servi (404) ; l'UGPM n'ouvre pas les pièces (403, question 4) mais lit la lecture.

## B5 — Le PV d'ouverture

| Méthode | URL | Accès | Corps | Réponse | Statuts |
|---|---|---|---|---|---|
| POST | /api/fiches-marche/{idDmc}/seance/pv | responsable | `{ observations: string \| null }` | `SeanceDto` (`etat = CLOSE`, `pv`) | 200, 403, 409 `SEANCE_NON_DECHIFFREE` |
| GET | /api/fiches-marche/{idDmc}/seance/pv | responsable, membres, PRMP, UGPM | le PDF | 200, 403, 404 |

- Produit par le moteur des documents (comme l'accusé, `DocumentLibre`) : la procédure, la date et l'heure d'ouverture, les
  présents (membres, responsable, autres), l'emploi éventuel de la part de secours et son motif, le nombre d'offres reçues, puis
  **offre par offre** ce que la lecture contient (soumissionnaire, lot, montants, délai, validité, rabais, garantie, pièces manquantes,
  intégrité, alertes), les offres non ouvertes et pourquoi, les observations ; **un PV de carence** s'il n'y a aucune offre.
- **Publication** si `B04-OP-13 = OUI` : le PV se lit sur la procédure publique (`GET /api/procedures-en-ligne/{idDmc}/pv`, public)
  — question 3 au pilote (contenu publié : le PV entier, ou un extrait sans les alertes).
- `PV_OUVERTURE` notifié à la PRMP et aux membres (courriel), et aux soumissionnaires si publié.
- La **signature** du PV par les membres présents : hors du lot (question 1) ; le PDF porte les noms et une place pour signer.

> ⚠️ **Livraison backend du 2026-10-04 (§B5, lot 4).** Conforme. Le PV complet est gardé en base ; **publié** (`B04-OP-13 = OUI`), une
> **seconde version sans les alertes ni la vérification des NIF** se lit par `GET /api/procedures-en-ligne/{idDmc}/pv` — c'est la réponse
> provisoire à la question 3, à revoir si le pilote veut le PV entier. Titres : « Procès-verbal d'ouverture des plis », « de carence », « de
> constat d'illisibilité ». Les membres présents ont une ligne de signature (question 1 : papier). `PV_OUVERTURE` part aussi au constat S5.

## B6 — S5, le dernier recours

| Méthode | URL | Accès | Corps | Réponse | Statuts |
|---|---|---|---|---|---|
| POST | /api/fiches-marche/{idDmc}/seance/constater-illisible | responsable | `{ motif }` | `SeanceDto` (`etat = ILLISIBLE`) | 200, 400, 403, 409 |

- Quand le quorum ne peut plus être atteint (parts perdues au-delà de la marge, part de secours comprise) : le responsable le
  constate, avec un motif ; le PV de constat est produit (§B5, même moteur) ; les soumissionnaires sont avertis (`OFFRES_ILLISIBLES`,
  courriel) ; la procédure est **à relancer**. Les suites juridiques (le sort des garanties) restent à écrire par le juriste (ADR §5).
- Refusé (409) tant qu'un nombre suffisant de parts reste possible : le serveur compte les détenteurs dont la part n'est pas
  `PERDUE` et qui n'ont pas encore apporté leurs parts.

> ⚠️ **Livraison backend du 2026-10-04 (§B6, lot 4).** Conforme. Le refus porte le code **`QUORUM_POSSIBLE`** avec `details.possibles` et
> `details.quorum` (possibles = détenteurs qui ont déjà apporté leurs parts + ceux dont la clé active n'est pas `PERDUE`, part de secours
> comprise). Le motif est obligatoire (400 `MOTIF_ABSENT`) ; seule une séance `OUVERTE` se constate illisible.

## B7 — Notifications et journal

- `SEANCE_A_VENIR` aux membres et au responsable la veille et une heure avant l'heure d'ouverture (courriel) ; `PARTS_ATTENDUES`
  aux membres à l'ouverture ; `PV_OUVERTURE` ; `OFFRES_ILLISIBLES`.
- Journal dédié (`t_seance_journal`) : ouverture, présences, apport de parts (qui, combien, à quelle heure — **jamais les parts**),
  emploi du secours et son motif, déchiffrement (par offre : empreinte vérifiée, intégrité), écartements, PV, constat d'illisibilité.

> ⚠️ **Livraison backend du 2026-10-04 (§B7, lot 4).** Conforme : les quatre notifications (courriel compris pour les membres et les
> soumissionnaires), les rappels toutes les 5 minutes (`app.seance.cron-rappel`), le journal `t_seance_journal` (`OUVERTURE`, `PRESENCES`,
> `APPORT`, `SECOURS`, `ECARTEMENT`, `OUVERTURE_OFFRE`, `DECHIFFREMENT`, `PV`, `CONSTAT`), jamais une part.

## B8 — Ce que le front construira, à la confirmation

- **Espace `/cao`** — la séance d'une procédure : compte à rebours à l'horloge du serveur ; à l'ouverture, « **Apporter mes parts** » :
  sa phrase secrète, la clé déverrouillée **dans son navigateur** (`cles-detenteur.ts`), chaque part déchiffrée, envoi en une fois ;
  l'état du quorum en direct (sondage toutes les 5 secondes de `GET …/seance`) ; puis la **lecture** (offre par offre) et les pièces.
- **Responsable** — `/procedure/:idDmc/seance` (route transverse, garde par identité) : ouvrir, les présences, le quorum, la part de
  secours (pli : phrase dictée, motif), la lecture projetable en grand (mode présentation), le PV (observations, production,
  téléchargement), le constat S5.
- **PRMP** — sur la fiche : l'état de la séance, puis la lecture et le PV.
- **Recette** : une procédure **avec des offres déposées**, donc la recette du lot 3 d'abord (révision de la fiche 40, accord du pilote),
  puis une heure d'ouverture atteinte — en recette, une date limite et une ouverture proches, fixées pour l'occasion.

## Questions ouvertes

| # | Question | À qui |
|---|---|---|
| 1 | La **signature** du PV d'ouverture : papier par les membres présents (proposé au lot 4), ou électronique plus tard ? | pilote |
| 2 | La séance se tient-elle **à distance** (chaque membre depuis son poste, `B04-OP-10 = En ligne`) aussi bien qu'en salle ? Le front le permet : les parts s'apportent depuis n'importe quel poste, le responsable conduit | pilote |
| 3 | Le **PV publié** (`B04-OP-13`) : entier, ou un extrait sans les alertes de rapprochement et la vérification des NIF ? | pilote, juriste |
| 4 | Qui lit les **pièces déchiffrées** après la séance : la CAO et la PRMP (proposé), l'UGPM aussi ? | pilote |
| 5 | La **durée de conservation** des contenus déchiffrés et des conteneurs (ADR §7, question 2) | juriste |

---

> ✅ **Front, lot 4 livré (2026-10-04, JAR V69)** — contre-recette de bout en bout à venir (accord du pilote : des offres déposées).
> - **Responsable** : `/procedure/{idDmc}/seance` (route transverse, garde serveur ; lien depuis ses paramètres internes) — état, heure
>   d'ouverture et temps restant, quorum `apportés / quorum`, membres et présences (cases, autres présents), offres reçues ; « Ouvrir la
>   séance » (409 `SEANCE_PREMATUREE` nommé avec l'heure, `DEPOTS_NON_CLOS`) ; **part de secours** (phrase du pli + motif obligatoire) ;
>   constat S5 (motif ; `QUORUM_POSSIBLE` nommé avec `possibles` / `quorum`) ; lecture en **mode projection** ; PV (observations, production,
>   téléchargement). Relu toutes les 5 secondes tant que la séance attend.
> - **Membre de la CAO** : dans `/cao/procedures/{idDmc}`, la séance — « Apporter mes parts » : `mes-parts`, sa clé déverrouillée **dans
>   le navigateur** (et l'enveloppe archivée servie pour une part S4, même phrase essayée), chaque part déchiffrée, envoi en une fois ;
>   puis la lecture et les pièces.
> - **PRMP / UGPM** : la même page en lecture (aucune action), lien « Séance d'ouverture » sur la fiche une fois les dépôts clos ; l'UGPM
>   lit sans ouvrir les pièces.
> - **Lecture** (`lecture-seance.ts`) : offre par offre, intégrité et motif, NIF et vérification, groupement, montants HT/TTC, délai,
>   validité, rabais, garantie, pièces manquantes, alertes ; pièces ouvertes par `ouvrirBlobSur` ; offres non ouvertes et pourquoi.
> - Vérifié en lecture seule sur la fiche 34 : le responsable voit « À venir », quorum 0 / 2, « Ouvrir la séance » ; le membre « Au moment de
>   l'ouverture, vous apporterez ici vos parts » ; la PRMP la même page sans action. Aucune écriture. L'heure d'ouverture est vide : la
>   fiche 34 n'a pas de `B04-OP-02/03`.

> ✅ **Recette de bout en bout, 2026-10-04 au soir (JAR V69, accord du pilote) — VERTE**, de la fiche jusqu'au PV d'ouverture.
> - **Préparation** : fiche 40 (MEN, travaux, 5 lots) révisée en v5 et passée en remise électronique, un DQE minimal par lot (règle
>   `BESOIN_INCOMPLET` travaux du 02/10, postérieure à la v4) ; le calendrier de la **seule** ligne 303288 recalé par l'Administrateur
>   (`PUT /api/marche-previsions/{id}`, arbitrage du pilote) : tout le plan en base s'arrêtait au 08/06/2026, d'où `DATES_ORDRE`. CAO des
>   deux membres de recette, responsable ADMIN01, cérémonie close à 20:25 (3 parts, quorum 2) ; fiche validée ; dossier 100361 →
>   réception, dispatch, examen, PV 48 FAV signé ; avis spécifique imprimé ; procédure publiée en ligne.
> - **Dépôts** (candidat C000000001, Chromium, scellement réel) : refus nommé avant l'ouverture (« Les dépôts ne sont pas encore
>   ouverts ») ; lots 1, 2, 3 déposés avec accusés ; lot 1 remplacé ; lot 3 retiré à l'écran ; registre PRMP avant l'échéance : le
>   **nombre seul** (2).
> - **Séance** : ouverture refusée avant l'échéance (« La date limite des dépôts n'est pas passée ») ; ouverte à 21:31 ; présences et
>   un autre présent ; mauvaise phrase refusée (« Cette phrase ne déverrouille pas la clé ») ; deux apports → déchiffrement au quorum ;
>   les offres n° 2 et n° 4 **intactes**, n° 1 (remplacée) et n° 3 (retirée) non ouvertes avec leur motif ; une pièce ouverte en onglet ;
>   PV produit et téléchargé ; PRMP en lecture sans geste ; registre des dépôts complet après l'échéance.
> - **Corrigé au front** : après le déchiffrement, le serveur sert `partsApportees = false` (les parts sont effacées), et l'écran affichait
>   « Quorum : 0 / 2 » ; il affiche désormais « atteint (2) » et masque les badges de parts une fois les offres ouvertes.
>
> **Constats pour le backend** (non bloquants) :
> - **C1 — `partsApportees` après le déchiffrement** : les parts doivent disparaître, mais le **fait** qu'un membre a apporté les siennes
>   pourrait rester `true` (le PV et le journal le savent). Le front s'en passe aujourd'hui.
> - **C2 — présentation du PV d'ouverture** : la date limite est imprimée brute (« 2026-10-04T21:30 ») ; les montants sans séparateur
>   (« 230000000 ») ; des codes au lieu de mots (« 6 MOIS », « NON_VERIFIE ») ; une offre remplacée désignée par son identifiant
>   technique (« remplacée par l'offre 239f6619-… ») plutôt que par son numéro d'arrivée (« par l'offre n° 4 »).
