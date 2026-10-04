# Demande backend — 2026-10-04 — Soumission en ligne, lot 2 : la cérémonie des clés et la procédure de secours (S1 à S4)

**Date** : 2026-10-04 · **Émetteur** : front · **Origine** : plan `docs/plan-2026-10-04-soumission-en-ligne.md` (lot 2),
**ADR-0013** « Le scellement des offres déposées en ligne » (PRS20, proposée le 04/10), V50 / ADR-0010 (paramètres internes,
responsable de la procédure), lot 1 (V63 à V65). Le lot 1 est livré des deux côtés.

**Ce que le lot produit** : pour chaque procédure en remise électronique, **`n` = membres + 1 clés publiques** (RSA-OAEP
3072, SHA-256) publiées par la procédure, chacune née dans le navigateur de son détenteur, dont la clé privée n'existe
qu'**enveloppée** par sa phrase secrète — le serveur en garde une copie qu'il ne peut pas lire. Une cérémonie **close** est la
condition de la publication de l'avis : sans clés publiées, aucun candidat ne pourrait sceller (lot 3). Le lot porte aussi
la procédure de secours S1 à S4 ; S5 (le dernier recours) relève de la séance d'ouverture (lot 4).

**Conventions** : les noms de routes, de champs et de codes sont **PROPOSÉS**. Le backend les fixe et corrige ce document
en place (encadré ⚠️ daté). Le front ne code rien contre un nom non confirmé.

> ⚠️ **Correction du 2026-10-04 (décision du pilote, Q11 du plan) — qui sont les « membres ».** Partout dans ce document,
> « membre désigné » et « membre de la commission » désignent un **membre de la commission d'appel d'offres (CAO), hors
> experts**, désigné par la PRMP par une décision, et porteur d'un compte **`MEMBRE_CAO`** actif — **pas** un contrôleur de la
> CNM choisi par le responsable, comme V50 et l'ADR-0010 l'avaient prévu. La CAO, ses comptes et ce que V50 devient sont la
> demande du lot **2a**, `docs/demande-backend-2026-10-04-commission-appel-offres.md`, à livrer **avant** ce lot, renommé
> **2b**. Conséquences ici :
> - §B1 : le dépositaire reste désigné par le responsable ; la règle 12 et le reste ne changent pas ;
> - §B2.1 : « membres désignés » = membres hors experts de la CAO ; la garde est par identité (il siège dans la CAO de
>   l'`idDmc`), le profil est `MEMBRE_CAO` ;
> - §B2.2, §B4, §B5.1 : l'appelant « membre » est un compte `MEMBRE_CAO` ; `n` = membres hors experts + 1 ;
> - §B6 : les notifications aux membres partent **aussi par courriel** — une personne extérieure ne vit pas dans
>   l'application ;
> - §B7 : l'écran « Ma clé » vit dans l'espace **`/cao`** (coquille propre, modèle de `/candidat`), pas en route transverse
>   de la coquille interne ; le responsable ne choisit plus les membres, il les lit.
>
> Le président de la CAO n'a ici aucun droit de plus : sa clé est une clé parmi `n`. Le responsable de la procédure (CNM)
> reste le gardien neutre, sous réserve de la question 1 de la demande 2a.

---

## B1 — Le dépositaire de la part de secours (S3)

L'ADR-0013 (§6) attend un dépositaire **désigné** avant d'ouvrir les lots 2 à 4, et laisse au juriste le choix de
l'organisme (l'ARMP est une piste). La **structure** ne dépend pas de ce choix ; seule la **valeur** en dépend. Le front
propose donc de la fixer maintenant, et de laisser le juriste poser, s'il le veut, une contrainte sur l'organisme.

- **Le dépositaire n'est pas un compte** : il n'a pas de session. C'est une désignation nominative, comme le responsable
  (ADR-0010), portée par les paramètres internes : `partDeSecours: { depositaire: { nom, organisme, fonction, contact } |
  null, etat }`, `etat` ∈ `A_DESIGNER` · `DESIGNE` · `PUBLIEE` (sa clé est publiée) · `VERIFIEE` · `PERDUE`.
- **Qui désigne** : le **responsable de la procédure**, dans `PUT …/parametres-internes`, qui gagne `depositaire` (les trois
  valeurs actuelles restent). Le journal dédié (Q7 de V50) reçoit le champ `depositaire`.
- **Règle 12, `SE_DEPOSITAIRE`**, bloquante, mode électronique : « Aucun dépositaire de la part de secours n'est désigné :
  la fiche ne peut pas être validée en remise électronique. » `etat = COMPLETS` l'exige.
- **Sa clé** naît sur le poste du responsable, en sa présence, pendant la cérémonie (§B2.3) : il n'a pas de navigateur à
  lui. Sa **phrase secrète est générée** (pas choisie) et **imprimée sur le pli scellé**, avec l'empreinte de sa clé et, en
  dernier recours, l'enveloppe en base64. Le serveur ne reçoit jamais la phrase.
- Le pilote et le juriste tranchent l'organisme ; rien d'autre ne bouge quand ils l'auront fait.

## B2 — La cérémonie

### B2.1 — L'état de la cérémonie

| Méthode | URL | Accès | Réponse | Statuts |
|---|---|---|---|---|
| GET | /api/fiches-marche/{idDmc}/ceremonie | responsable de la procédure, membres désignés | `CeremonieDto` | 200, 403, 404 |

- `CeremonieDto` = `{ idDmc, etat, dateCeremoniePrevue, dateCloture, quorum, n, premierDepot, detenteurs: DetenteurDto[],
  avertissements: [{ regle, message }] }`.
  - `etat` ∈ `A_VENIR` (des clés manquent, jamais close) · `CLOSE` · `A_REFAIRE` (rouverte, §B5.2) ;
  - `n` = `membresCommission.length + 1` ; `quorum` celui des paramètres internes ;
  - `premierDepot` : **posé par le lot 3** à la première offre scellée ; toujours `false` au lot 2. Il est servi dès
    maintenant parce que l'écran s'en sert pour offrir, ou non, la réouverture.
- `DetenteurDto` = `{ role: 'MEMBRE' | 'SECOURS', im: string | null, nom, empreinte: string | null, clePublique: string | null,
  datePublication, etatPart: 'ABSENTE' | 'PUBLIEE' | 'VERIFIEE' | 'PERDUE', derniereVerification, remplacements: number }`.
  - `empreinte` = SHA-256 de la forme SPKI de la clé publique, en hexadécimal minuscule (ADR §1) ;
  - `clePublique` = SPKI en base64 ; publique par nature, servie à qui lit la cérémonie.
- **Qui lit** : le responsable (tout), et chaque membre désigné — il doit retrouver **sa** empreinte dans la liste publiée
  (ADR §1 : c'est son contrôle contre un serveur qui glisserait une clé). L'Administrateur et la PRMP reçoivent 403, comme
  pour les paramètres internes. Pour eux, **l'état seul** : `FicheMarcheDto.ceremonie` ∈ `A_VENIR` · `CLOSE` ·
  `A_REFAIRE` · `null` (mode papier), comme `parametresInternes` aujourd'hui.

### B2.2 — Publier sa clé (un membre, pour lui-même)

| Méthode | URL | Corps | Réponse | Statuts |
|---|---|---|---|---|
| POST | /api/fiches-marche/{idDmc}/ceremonie/cles | `CleCorps` | **201** `DetenteurDto` | 201, 400, 403, 404, 409 |
| GET | /api/fiches-marche/{idDmc}/ceremonie/cles/mienne | — | `EnveloppeDto` | 200, 403, 404 |

- `CleCorps` = `{ clePublique, empreinte, enveloppe: EnveloppeDto }` ;
  `EnveloppeDto` = `{ chiffre, iv, sel, iterations, kdf: 'PBKDF2-SHA-256', algorithme: 'AES-256-GCM' }` — `chiffre` est
  la clé privée **PKCS#8 enveloppée** (`wrapKey('pkcs8')`) ; `iv` 12 octets, `sel` 16 octets, le tout en base64 ; les
  paramètres sont stockés avec l'enveloppe pour pouvoir relever `iterations` plus tard (ADR §3).
- **Contrôles du serveur** : la clé publique se lit (SPKI, RSA, module de **3072 bits** — 400 `CLE_INVALIDE`) ;
  l'empreinte recalculée est la même (400 `EMPREINTE_INVALIDE`) ; `iterations ≥ 600 000` (400) ; l'appelant est un membre
  désigné de cette procédure (403) ; la cérémonie n'est pas `CLOSE` (409 `CEREMONIE_CLOSE` — remplacer passe par §B5.1) ;
  aucune clé déjà publiée pour lui (409 `CLE_EXISTANTE`, idem).
- **Le serveur ne déchiffre rien, et ne peut rien déchiffrer** : il garde l'enveloppe pour la rendre à son seul propriétaire
  (`/mienne` : 403 à tout autre, responsable compris) — à l'ouverture (lot 4), et pour retélécharger sa copie hors ligne.
- Le membre voit son empreinte dans son navigateur **avant** l'envoi, puis dans la liste de `GET …/ceremonie` : si les deux
  diffèrent, il le dit au responsable et ne publie pas.

### B2.3 — La part de secours (le responsable, en présence du dépositaire)

| Méthode | URL | Corps | Réponse | Statuts |
|---|---|---|---|---|
| POST | /api/fiches-marche/{idDmc}/ceremonie/cles/secours | `CleCorps` | **201** `DetenteurDto` (`role = SECOURS`) | 201, 400, 403, 404, 409 |
| GET | /api/fiches-marche/{idDmc}/ceremonie/cles/secours | — | `EnveloppeDto` | 200, 403, 404 |

- Mêmes contrôles que §B2.2 ; 409 `DEPOSITAIRE_ABSENT` sans dépositaire désigné (§B1) ; 409 `CLE_EXISTANTE`.
- La paire naît dans le navigateur du **responsable**, en présence du dépositaire. La phrase secrète est **générée** (six
  mots tirés au sort, vingt caractères au moins), **affichée une fois** pour l'impression du pli, puis oubliée. Le pli
  scellé porte : la phrase, l'empreinte, et l'enveloppe en base64 en dernier recours (si le serveur en perdait la copie).
- Le `GET …/secours` est réservé au responsable : à l'ouverture (lot 4), c'est lui qui charge l'enveloppe, et le pli
  n'apporte que la phrase, saisie à la main — pas de lecture de QR ni de ressaisie de base64 en séance.
- La part de secours compte pour **une** part (ADR §5, S3) et **hors `nombreParts`** (§6).

### B2.4 — Clore la cérémonie

| Méthode | URL | Corps | Réponse | Statuts |
|---|---|---|---|---|
| POST | /api/fiches-marche/{idDmc}/ceremonie/cloturer | — | `CeremonieDto` (`etat = CLOSE`, `dateCloture`) | 200, 403, 404, 409 `CLES_INCOMPLETES` |

- Responsable seul. 409 `CLES_INCOMPLETES` tant que les `n` clés ne sont pas `PUBLIEE` (le message nomme les manquants).
- **Une cérémonie close fige les paramètres** : `PUT …/parametres-internes` répond 409 `CEREMONIE_CLOSE` sur
  `membresCommission`, `quorum`, `dateCeremonie` et `depositaire` — rouvrir d'abord (§B5.2). Le serveur reste
  l'autorité ; l'écran grise.
- `dateCloture` est la date **effective** de la cérémonie. La règle 8 de V50 (`SE_CEREMONIE`, « la cérémonie précède la
  publication ») continue de comparer `dateCeremonie` (la prévue) à la publication ; c'est §B2.6 qui garde la réalité.
- Journal et notifications : §B6.

### B2.5 — Les clés publiées aux candidats

| Méthode | URL | Accès | Réponse | Statuts |
|---|---|---|---|---|
| GET | /api/procedures-en-ligne/{idDmc}/cles | public | `ClesPubliquesDto` | 200, 404 |

- `ClesPubliquesDto` = `{ idDmc, quorum, n, algorithmes: ['AES-256-GCM', 'RSA-OAEP-3072-SHA256', 'SHAMIR-GF256'],
  dateCloture, detenteurs: [{ role, empreinte, clePublique }] }` — **sans matricule ni nom** : le candidat n'a pas à savoir
  qui siège. C'est l'entrée du scellement (lot 3, ADR §1 et §4).
- **404 tant que la cérémonie n'est pas `CLOSE`**, ou hors des critères de `GET /api/procedures-en-ligne/{idDmc}`.
- Après un remplacement (§B5.1), la liste sert la **nouvelle** clé ; l'en-tête de chaque offre garde les empreintes pour
  lesquelles elle a été scellée (ADR §5, S4), donc rien ne se perd pour les offres déjà déposées.

### B2.6 — La publication de l'avis exige la cérémonie close

- `POST …/avis-specifique` (le « Lancé » de la ligne) répond **409 `CEREMONIE_NON_CLOSE`** en mode électronique tant que
  `etat ≠ CLOSE`. Sans clés publiées, un candidat ne pourrait pas sceller : publier serait annoncer une procédure
  impraticable. La disponibilité (`GET …/avis-specifique/disponibilite`) porte la même raison, pour que l'écran de la PRMP
  le dise avant le clic.
- La validation de la fiche (`POST …/valider`), elle, **n'exige pas** la cérémonie : elle se tient entre la validation et la
  publication, comme le prévoit la règle 8. À confirmer par le pilote (question 2).

## B3 — S1 : la marge du quorum (avertissement)

- Quand `quorum = membresCommission.length`, la règle 6 (`SE_QUORUM`) produit un **avertissement**, non bloquant,
  `SE_QUORUM_MARGE` : « Le quorum est égal au nombre de membres : la perte d'une seule part rendrait les offres
  illisibles. » (ADR §5, S1). La part de secours n'entre pas dans ce calcul.
- Servi dans `ParametresInternesDto.avertissements` (champ nouveau, `[{ regle, message }]`, distinct d'`anomalies` qui
  restent les refus) et dans `BilanControles.avertissements` de la fiche.

## B4 — S2 : la vérification d'une part, sans rien révéler

| Méthode | URL | Accès | Corps | Réponse | Statuts |
|---|---|---|---|---|---|
| POST | /api/fiches-marche/{idDmc}/ceremonie/defi | membre (sa clé) ; responsable avec `?role=SECOURS` | — | **201** `{ idDefi, chiffre, expire }` | 201, 403, 404, 409 `CLE_ABSENTE` |
| POST | /api/fiches-marche/{idDmc}/ceremonie/defi/{idDefi} | le même appelant | `{ clair }` | `DetenteurDto` (`etatPart = VERIFIEE`) | 200, 403, 404, 409 `DEFI_EXPIRE` / `DEFI_ECHOUE` |

- Le serveur tire **32 octets** aléatoires, les chiffre avec la clé publique du détenteur (RSA-OAEP, SHA-256, MGF1-SHA-256
  — l'`OAEPParameterSpec` explicite, sans quoi Java prend SHA-1 pour MGF1, ADR §3), et garde leur **SHA-256** cinq minutes,
  à usage unique. Le détenteur déverrouille sa clé dans son navigateur (phrase secrète) et renvoie le clair en base64 ; le
  serveur compare **en temps constant**. Rien n'est révélé : le défi n'a aucun lien avec les offres.
- Un défi réussi pose `etatPart = VERIFIEE` et `derniereVerification` ; un défi échoué ne change rien à la part, et va au
  journal.
- **La marge** : `disponibles` = parts des membres ni `ABSENTE` ni `PERDUE` (la part de secours n'y compte pas). Quand
  `disponibles ≤ quorum`, `CeremonieDto.avertissements` porte `SE_MARGE_EPUISEE` (« La marge du quorum est épuisée : une
  part de plus perdue rendrait les offres illisibles. ») et le responsable est notifié (§B6).
- **Le rappel** : `FICHE_SE_VERIFICATION_PART_JOURS` (nouveau paramètre de `fiche-remise-electronique`, défaut **7**) :
  autant de jours avant la date limite de remise, chaque membre dont la part n'est pas `VERIFIEE` depuis la clôture reçoit
  `PART_A_VERIFIER`. Un traitement de nuit, comme le ménage des candidats.
- **Déclarer sa part perdue** : `POST /api/fiches-marche/{idDmc}/ceremonie/cles/perdue` (membre, pour lui-même ;
  responsable avec `?role=SECOURS`) → `etatPart = PERDUE`, responsable notifié. La perte la plus probable est l'oubli de la
  phrase secrète : c'est ce geste, puis §B5.

## B5 — S4 : remplacer une clé, refaire la cérémonie

### B5.1 — Remplacer sa clé

| Méthode | URL | Accès | Corps | Réponse | Statuts |
|---|---|---|---|---|---|
| PUT | /api/fiches-marche/{idDmc}/ceremonie/cles | membre (la sienne) | `CleCorps` | `DetenteurDto` (`remplacements + 1`) | 200, 400, 403, 404 |
| PUT | /api/fiches-marche/{idDmc}/ceremonie/cles/secours | responsable | `CleCorps` | `DetenteurDto` | 200, 400, 403, 404, 409 `DEPOSITAIRE_ABSENT` |

- Mêmes contrôles que §B2.2. Permis **cérémonie close ou non** : c'est exactement S4.
- **Avant le premier dépôt** (`premierDepot = false`) : l'ancienne clé est supprimée ; le journal garde son empreinte.
- **Après** : l'ancienne clé est **archivée** (date de remplacement), jamais supprimée : les offres déjà scellées pour son
  empreinte en dépendent, et le lot 4 la retrouve par l'en-tête de l'offre. La nouvelle est publiée (§B2.5) pour les
  offres suivantes. S1 et S3 couvrent l'entre-deux (ADR §5).
- `etatPart` repasse à `PUBLIEE` ; `derniereVerification` est effacée.

### B5.2 — Refaire la cérémonie

| Méthode | URL | Accès | Réponse | Statuts |
|---|---|---|---|---|
| POST | /api/fiches-marche/{idDmc}/ceremonie/rouvrir | responsable | `CeremonieDto` (`etat = A_REFAIRE`) | 200, 403, 404, 409 `DEPOT_EXISTANT` |

- Toutes les parts repassent à `ABSENTE` ; les paramètres internes redeviennent modifiables (un membre qui quitte la
  commission se remplace ici) ; chaque membre republie (§B2.2), le responsable reclôt (§B2.4).
- **409 `DEPOT_EXISTANT`** dès la première offre scellée : on ne refait pas une cérémonie dont des offres dépendent. Un
  membre qui s'en va après le premier dépôt ne se remplace **pas** — sa part est `PERDUE`, et c'est la marge (S1) et la part
  de secours (S3) qui tiennent. L'écran le dit en toutes lettres.

## B6 — Notifications et journal

- **Notifications** (le mécanisme existant : `typeNotif`, `typeObjet = 'PROCEDURE'`, `idObjet = idDmc`, destinataire par
  matricule) : `CLE_A_PUBLIER` (chaque membre désigné, à la désignation et à la réouverture), `CLES_PUBLIEES` (PRMP et
  membres, à la clôture), `PART_A_VERIFIER` (le rappel), `MARGE_QUORUM` et `PART_PERDUE` (responsable). Le centre de
  notifications du front mène à l'écran concerné (§B7).
- **Journal dédié** (`t_parametre_interne_journal`, Q7) : `depositaire`, `clePubliee`, `cleRemplacee`, `clePerdue`,
  `defiReussi`, `defiEchoue`, `ceremonieClose`, `ceremonieRouverte` — avec les **empreintes**, jamais une clé ni une
  enveloppe. Le journal global reçoit la route et l'acteur, sans valeurs.
- **Aucune cryptographie à la main** côté serveur : lecture SPKI et RSA-OAEP par la JCA (ADR §3) ; aucune dépendance de
  plus au lot 2 (BouncyCastle n'arrive qu'au lot 4).

## B7 — Ce que le front construira, à la confirmation

- **Responsable** — section « Cérémonie des clés » dans `/procedure/:idDmc/parametres-internes` : le dépositaire (§B1),
  l'état, les `n` détenteurs avec empreinte et état de part, les avertissements S1 et marge, « Clore », « Rouvrir »,
  et la part de secours : génération dans son navigateur, phrase générée affichée une fois, **impression du pli** (page
  dédiée : phrase, empreinte, enveloppe en base64), envoi de l'enveloppe.
- **Détenteur** — `/procedure/:idDmc/ma-cle`, route transverse sans entrée de menu (le menu de l'Administrateur sature ;
  les membres y arrivent par la notification `CLE_A_PUBLIER`, et par la fiche qu'ils lisent) : générer sa clé (phrase
  **de douze caractères au moins**, quatre mots recommandés, ADR §3), voir son empreinte et la retrouver dans la liste
  publiée, télécharger sa copie hors ligne (`{ version: 1, idDmc, empreinte, enveloppe }`), vérifier sa part (défi),
  déclarer sa part perdue, remplacer sa clé.
- **Cryptographie du navigateur** : WebCrypto seul — `generateKey` RSA-OAEP 3072 SHA-256, `exportKey('spki')`, `digest`
  SHA-256, `deriveKey` PBKDF2-SHA-256 600 000 itérations, `wrapKey('pkcs8')` AES-256-GCM. **Aucune dépendance npm au
  lot 2** (`shamir-secret-sharing` n'arrive qu'au lot 3). Les gestes sensibles ne se font qu'en HTTPS : la phrase ne quitte
  jamais le navigateur, le serveur ne reçoit que l'enveloppe.
- **PRMP** : la fiche montre l'état de la cérémonie ; l'impression de l'avis est refusée en clair tant qu'elle n'est pas
  close (§B2.6).
- **Recette** : elle demande une fiche électronique avec responsable, membres et dépositaire dans DBPRS20 — toute écriture
  attendra l'accord du pilote.

## Questions ouvertes

| # | Question | À qui |
|---|---|---|
| 1 | L'organisme du dépositaire de la part de secours (l'ARMP ?) ; la structure §B1 n'en dépend pas | juriste, par le pilote |
| 2 | La validation de la fiche doit-elle, elle aussi, attendre la cérémonie close ? Le front propose non : la cérémonie se tient entre la validation et la publication, et c'est l'avis qui est gardé (§B2.6) | pilote |
| 3 | Le délai du rappel de vérification, 7 jours par défaut (§B4) | pilote |
| 4 | La phrase du pli de secours : générée et imprimée (§B2.3), ou choisie par le dépositaire ? Le front propose générée : le pli scellé est la protection, et une phrase oubliée rendrait le secours vain | pilote |
