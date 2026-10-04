# Demande backend — 2026-10-04 — La soumission en ligne des offres : lot 0 (scellement) et lot 1 (espace candidat)

**Date** : 2026-10-04 · **Émetteur** : front · **Origine** : plan `docs/plan-2026-10-04-soumission-en-ligne.md`,
arbitré par le pilote le 04/10. Q2 (le candidat) et Q4 (le scellement) ont été tranchées par des décisions propres, les
autres questions selon les recommandations.

**Ce qui est demandé maintenant** :
- **B1** : une **ADR** du scellement, avant toute ligne de code des lots 2 à 4.
- **B2 à B8** : le **contrat du lot 1** (espace candidat), qui ne dépend pas de l'ADR et peut avancer en parallèle.

Les lots 2 (cérémonie), 3 (dépôt) et 4 (ouverture) feront chacun leur demande, une fois l'ADR écrite.

**Conventions** : les noms de routes, de champs et de codes ci-dessous sont **PROPOSÉS**. Le backend les fixe et corrige
ce document en place (encadré ⚠️ daté) quand il s'en écarte. Le front ne code rien contre un nom non confirmé, sauf
derrière le repli habituel « contrat en attente ».

---

## B1 — ADR : le scellement des offres (lot 0)

**Décision du pilote (Q4)** : chiffrement **dans le navigateur du candidat**, ouverture **au quorum** des membres
désignés (paramètres internes de V50), et une **procédure de secours** en cas de parts perdues. L'option « clé gardée
par le serveur » est écartée : un administrateur ou une intrusion pourrait lire les offres avant l'ouverture.

### B1.1 — Les exigences (non négociables)

1. **Avant l'heure d'ouverture, personne ne peut lire une offre** : ni le serveur, ni un administrateur de la base ou du
   serveur, ni un membre seul, ni moins de `quorum` membres ensemble.
2. **Toutes les offres d'une procédure s'ouvrent ensemble**, en séance, jamais une par une avant les autres.
3. Le serveur **refuse** toute contribution à l'ouverture (part déchiffrée) avant `B04-OP-02` / `B04-OP-03`.
4. **L'intégrité est prouvable** : l'empreinte SHA-256 du contenu chiffré figure dans l'accusé de réception remis au
   candidat. À l'ouverture, une offre dont l'empreinte ne correspond plus est signalée au PV.
5. **Aucun secret en clair ne transite ni ne se stocke** : ni la clé d'une offre, ni la clé privée d'un membre, ni une
   phrase secrète.
6. La **procédure de secours** S1 à S5 du plan (§Q4) est réalisable.
7. **Aucune cryptographie écrite à la main.** Les primitives viennent de WebCrypto (navigateur) et de la JCA/JCE
   (serveur). Le partage de secret vient d'une **bibliothèque auditée**, nommée dans l'ADR (ajout de dépendance npm).

### B1.2 — La proposition du front : un partage par offre, pas une clé de procédure partagée

Le plan parlait d'**une** clé de procédure coupée en parts. Le front propose une variante qui tient les mêmes
exigences sans jamais faire exister la clé entière, **même pendant la cérémonie**.

- **À la cérémonie** :
  - **chaque membre** désigné, et le **dépositaire de secours** (S3), génère **dans son propre navigateur** une paire de
    clés ;
  - la clé privée est chiffrée par une **phrase secrète** du membre, puis remise au serveur (copie qu'il ne peut pas
    lire) et gardée hors ligne par le membre (fichier, ou impression pour le dépositaire) ;
  - **seule la clé publique** est publiée par la procédure.
- **Au dépôt, dans le navigateur du candidat** :
  1. une clé aléatoire `K` (AES-256-GCM) est tirée **pour cette offre** ;
  2. le contenu est chiffré par `K`, **par morceaux** (jusqu'à 500 Mo, `B04-SE-09`) : chaque morceau a son vecteur
     d'initialisation, et son rang figure dans les données authentifiées, pour qu'on ne puisse ni retirer ni permuter un
     morceau ;
  3. `K` est **partagée** (Shamir) en `n` parts avec le seuil `quorum`, `n` = membres + 1 (la part de secours) ;
  4. chaque part est chiffrée pour **un** membre, avec sa clé publique ;
  5. le navigateur envoie le contenu chiffré et les `n` parts chiffrées. `K` est oubliée.
- **À l'ouverture** :
  - chaque membre présent déverrouille sa clé privée **dans son navigateur** et déchiffre **sa** part de chaque offre ;
  - il envoie ses parts, que le serveur refuse avant l'heure (B1.1, 3) ;
  - au `quorum` atteint, `K` est reconstituée et l'offre déchiffrée. Toutes les offres s'ouvrent dans le même geste.

**Ce que la variante apporte** :
- La clé d'une offre n'existe **jamais** entière ailleurs que chez le candidat, qui possède déjà son offre en clair. Il
  n'y a donc pas de « poste de la cérémonie » qui verrait la clé passer.
- La procédure de secours devient plus simple :
  - **S2** (vérification d'une part) est un défi : le serveur chiffre un nombre aléatoire avec la clé publique du
    membre, et le membre le rend déchiffré. Rien n'est révélé.
  - **S4** (une part perdue avant le premier dépôt) se résout en remplaçant la clé de **ce** membre, sans refaire toute
    la cérémonie. Après le premier dépôt, la perte ne touche que les offres déjà scellées pour lui. La marge du quorum
    (S1) et la part de secours (S3) les couvrent.

**Ce que le front laisse à l'ADR** (sans préférence ferme) :
- **L'algorithme des clés des membres** : RSA-OAEP 3072 bits avec SHA-256, ou ECDH P-256 avec HKDF et AES-KW. Les deux
  sont dans WebCrypto partout ; X25519 ne l'est pas encore partout.
- **La dérivation de la phrase secrète** : WebCrypto n'offre que PBKDF2-SHA-256, à au moins 600 000 itérations ; la
  longueur minimale de la phrase est à fixer.
- **La bibliothèque de partage de secret** : le front a repéré `shamir-secret-sharing` (Privy), annoncée auditée. Le
  backend vérifie les audits, et dit s'il lui faut une contrepartie Java pour reconstituer `K` côté serveur, ou si la
  reconstitution se fait dans le navigateur du responsable de séance. **Le front penche pour le serveur** : il produit
  le PV, et il ne le fait qu'après l'heure d'ouverture (B1.1, 3).
- **La forme du conteneur** d'une offre : l'en-tête, les morceaux, les parts, les versions.

### B1.3 — Le sort des paramètres de V50

- `membresCommission` et `quorum` deviennent les entrées du partage : `n` = membres + 1, seuil = quorum.
- `dateCeremonie` reste la date à laquelle les clés publiques doivent être publiées. La règle 8 de V50 (la cérémonie
  précède la publication) est inchangée.
- La règle 6 (2 ≤ quorum ≤ membres) reçoit l'**avertissement S1**, non bloquant : « Le quorum est égal au nombre de
  membres : la perte d'une seule part rendrait les offres illisibles. »
- **À trancher par l'ADR** : la part de secours compte-t-elle dans `nombreParts` de `ParametresInternesDto` ? Le front
  propose un champ séparé, `partDeSecours: { depositaire, etat }`. Le dépositaire est **à désigner** : c'est une
  question posée au juriste par le pilote, et l'ARMP est une piste.

### B1.4 — Ce qui n'est pas demandé

Aucun code, aucune migration. **L'ADR seule**, puis un encadré ⚠️ ici qui dit les choix et les écarts. Le front écrit
ensuite les demandes des lots 2 à 4 contre l'ADR.

> ⚠️ **Livraison backend du 2026-10-04 (§B1) — ADR-0013, « Le scellement des offres déposées en ligne »** (statut
> *Proposé*, `docs/adr/ADR-0013-scellement-des-offres-en-ligne.md`). Votre variante est retenue : un partage par offre, la clé
> d'une offre n'existe entière que chez le candidat. Les choix laissés à l'ADR :
> - **Clés des détenteurs : RSA-OAEP 3072 bits, SHA-256 avec MGF1-SHA-256.** C'est natif dans WebCrypto et dans la JCA
>   de Java 21. ECDH + HKDF est écarté : Java 21 n'a pas de HKDF sans bibliothèque de plus, ou sans l'écrire à la main.
>   Côté Java, l'`OAEPParameterSpec` doit fixer MGF1 à SHA-256 ; sinon Java prend SHA-1 et ne s'accorde plus avec
>   WebCrypto.
> - **Phrase secrète** : PBKDF2-SHA-256, 600 000 itérations, sel de 16 octets propre au détenteur, enveloppe
>   `wrapKey('pkcs8')` sous AES-256-GCM. **12 caractères au moins** ; l'écran recommande quatre mots ou plus.
> - **Partage** : `shamir-secret-sharing` (Privy, Apache-2.0). Son dépôt annonce deux audits indépendants, **Cure53 et
>   Zellic**, rapports publiés. À figer à une version précise.
> - **Reconstitution de `K` : au serveur**, comme vous le proposez, avec **BouncyCastle** (`bcprov` ≥ 1.80, partage de
>   Shamir OASIS en GF(2^8)). C'est **sous condition** : un test d'interopérabilité en CI, au début du lot 4. Des parts
>   produites par `shamir-secret-sharing` (vos vecteurs, abscisse au dernier octet) doivent être recombinées par
>   BouncyCastle. Le format commun n'est documenté nulle part, et seul ce test le prouve.
>   **Repli** : la recombinaison dans le navigateur du responsable de séance, avec votre bibliothèque. Jamais de
>   recombinaison écrite à la main en Java. `pom.xml` ne prend BouncyCastle qu'au lot 4.
> - **Conteneur v1** : un en-tête JSON (version, offre, procédure, lot, algorithmes, taille des morceaux de 4 Mio,
>   quorum, `n`, et pour chaque détenteur l'empreinte de sa clé publique et sa part chiffrée), puis des morceaux AES-GCM.
>   Les données authentifiées de chaque morceau portent l'offre, la version, le rang, un drapeau « dernier » (contre la
>   troncature) et le SHA-256 de l'en-tête. L'empreinte de l'accusé est le SHA-256 de l'en-tête et des morceaux, calculée
>   des deux côtés.
> - **S2** : le défi par la clé publique, comparé en temps constant. **S1** : l'avertissement sur la règle 6, sans compter
>   la part de secours. **S4** : remplacer la clé d'un seul membre ; chaque offre garde l'empreinte des clés pour
>   lesquelles elle a été scellée.
> - **§B1.3** : la part de secours **ne compte pas** dans `nombreParts`. Elle a son champ propre, `partDeSecours:
>   { depositaire, etat }`, comme vous le proposez. Les lots 2 à 4 ne s'ouvrent pas tant qu'un dépositaire n'est pas
>   désigné.
> - **Question 6, le stockage** : les conteneurs vont sur disque, hors base (`app.offres.repertoire`), un fichier par
>   offre ; la base garde l'en-tête, l'empreinte et le chemin. Ils sont sauvegardés tels quels, donc chiffrés. La durée
>   de conservation est à fixer avec le juriste.
> - **Limites dites dans l'ADR** :
>   - le code qui chiffre est servi par le serveur, et le scellement ne protège pas contre un code servi compromis ;
>   - les clés publiques sont publiées par le serveur, d'où le contrôle de son empreinte par chaque détenteur ;
>   - `quorum` membres qui s'entendent avant l'heure peuvent lire, comme une commission physique.
>
> Aucun code, aucune migration. Le front peut écrire les demandes des lots 2 à 4 contre cette ADR, une fois adoptée.

---

## B2 — Le profil `CANDIDAT` et le compte (lot 1)

- **Un profil de plus, `CANDIDAT`**, qui n'atteint **aucune** route interne. La garde par profil côté serveur est
  celle des dix profils actuels. Le front ajoute un onzième espace, `/candidat`, avec son propre menu.
- **Même origine, même session** : cookie `PRS_SESSION` et CSRF, comme les autres. Aucun jeton côté client.
- **Identifiant de connexion** : les comptes internes se connectent par `login` (matricule). Le candidat n'a pas de
  matricule : le front propose que `login` soit son **adresse électronique**, par la même route `POST /api/auth/login`,
  et que `LoginResponse` porte le profil `CANDIDAT`. À confirmer, ou à remplacer par une route dédiée.
- **Inscription publique** (sans session) — routes proposées :

| Méthode | URL | Corps | Réponse | Statuts |
|---|---|---|---|---|
| POST | /api/candidats/inscription | `{ email, telephone, motDePasse, nom, prenom }` | `{ idCompte, etat: 'A_CONFIRMER' }` | 201, 400, 409 `EMAIL_EXISTANT`, 429 |
| POST | /api/candidats/confirmation | `{ email, codeEmail, codeTelephone }` | `{ etat: 'CONFIRME' }` | 200, 400 `CODE_INVALIDE` ou `CODE_EXPIRE`, 404, 429 |
| POST | /api/candidats/codes | `{ email }` (renvoi des codes) | — | 204, 429 |

- **Les codes** : six chiffres, à usage unique, valables 15 minutes, 5 essais au plus.
  - **Courriel** : l'envoi SMTP existe déjà (`app.mail.enabled`).
  - **Téléphone** : **aucune passerelle SMS n'existe**. **Question** : quel fournisseur ? En attendant, le front propose
    que le code téléphonique soit **désactivable par un paramètre** (`CANDIDAT_CONFIRMATION_TELEPHONE`, défaut `NON`
    tant qu'aucune passerelle n'est raccordée). Le téléphone est alors déclaré sans être confirmé, et la confirmation
    se fait par courriel seul.
- **Anti-robot et limites** : le front propose de **ne pas** dépendre d'un service externe d'anti-robot (il recevrait
  les données de l'inscription). À la place, des limites côté serveur : `CANDIDAT_INSCRIPTIONS_PAR_JOUR` par adresse IP
  (défaut 5), plus les limites des codes ci-dessus, avec la réponse 429 et un message servi.
- **Mot de passe** : la politique des comptes internes, et le même stockage.

> ⚠️ **Livraison backend du 2026-10-04 (§B2, sous-lot 1a, V63).** Conforme, routes et codes tels que proposés.
> - **Question 2, confirmée** : le candidat se connecte par `POST /api/auth/login`, `login` = son adresse électronique
>   (casse ignorée). `LoginResponse` porte `role` = `typeActeur` = `CANDIDAT`, `ref` = `idCompte` (`C` + 9 chiffres), et
>   `nomAffichage` = « NOM Prénom ». Même cookie `PRS_SESSION`, même CSRF.
> - **Deux refus nommés à la connexion**, après le mot de passe seulement (un tiers n'apprend rien) :
>   - 409 `COMPTE_A_CONFIRMER` ;
>   - 409 `COMPTE_ARCHIVE` : un nouveau code part par courriel, et `POST /api/candidats/confirmation` (courriel seul)
>     réactive le compte. C'est ainsi que se fait la réactivation du §B7.
> - **Garde** : un jeton `CANDIDAT` reçoit **403 sur toute route interne**, y compris celles dont le contrôleur n'avait pas
>   de garde de profil (référentiels, annuaire, messages…). Lui restent ouverts `/api/candidat/**` (sous-lot 1b), les
>   routes publiques, et `/api/mon-compte/**` (changer son mot de passe).
> - **Écarts et précisions** :
>   - l'adresse est unique parmi **tous** les comptes, internes compris ;
>   - un compte déjà confirmé répond 200 `CONFIRME` à une nouvelle confirmation ;
>   - un code faux mal formé (pas six chiffres) compte comme un essai ;
>   - le renvoi est limité à **5 par heure et par adresse** (429), et répond toujours 204, même pour une adresse inconnue ;
>   - le 429 des essais épuisés porte un `Retry-After` de 60 s, mais il faut surtout un nouveau code.
> - **Téléphone** : `CANDIDAT_CONFIRMATION_TELEPHONE` (défaut `NON`). Une passerelle vide est en place, qui n'envoie rien et
>   le journalise. Le paramètre doit rester à `NON` tant que le pilote n'a pas choisi de fournisseur (question 3).
> - Le 400 porte désormais un `code` quand il en a un (`CODE_INVALIDE`, `CODE_EXPIRE`).

## B3 — L'entreprise (lot 1)

| Méthode | URL | Corps | Réponse | Statuts |
|---|---|---|---|---|
| GET | /api/candidat/entreprise | — | `EntrepriseDto` ou 404 si pas encore déclarée | 200, 404 |
| PUT | /api/candidat/entreprise | `{ raisonSociale, nif, stat, rcs, adresse, representant: { nom, prenom, fonction } }` | `EntrepriseDto` | 200, 400, 409 `NIF_EXISTANT` / `STAT_EXISTANT` / `RCS_EXISTANT` |
| POST | /api/candidat/entreprise/pieces | multipart `{ type: 'CARTE_FISCALE' \| 'STATUTS' \| 'POUVOIR' \| 'AUTRE', fichier }` | `PieceEntrepriseDto` | 201, 400, 413 |
| DELETE | /api/candidat/entreprise/pieces/{id} | — | — | 204, 404 |

- **Unicité (Q2)** : un NIF, un STAT ou un RCS n'appartient qu'à **une** entreprise sur la plateforme. Un second compte
  qui déclare le même numéro reçoit 409, avec le message « Ce NIF est déjà déclaré par une entreprise inscrite. Si c'est
  la vôtre, connectez-vous avec le compte qui l'a déclarée. » Le message ne nomme pas l'autre compte.
- **Un compte = une entreprise.** Le mandataire d'un groupement déclare les membres **dans son offre** (lot 3), pas ici.
- `EntrepriseDto` = `{ id, raisonSociale, nif, stat, rcs, adresse, representant, pieces: PieceEntrepriseDto[],
  verification: VerificationNifDto, exclusion: ExclusionDto | null }`.
- **Les pièces** : PDF ou image, taille plafonnée par un paramètre. Le front passe par `validerFichier()`.

> ⚠️ **Livraison backend du 2026-10-04 (§B3, sous-lot 1b, V64).** Conforme, routes et codes tels que proposés.
> - Le candidat est celui du jeton : aucune route ne prend d'identifiant de compte.
> - **Écarts et précisions** :
>   - **`stat` et `rcs` sont facultatifs** ; `raisonSociale`, `nif`, `adresse` et le représentant (nom, prénom) sont
>     obligatoires ;
>   - NIF, STAT et RCS sont **normalisés** (sans blancs, en majuscules) avant le contrôle d'unicité, si bien que « 1234 567
>     890 » et « 1234567890 » sont le même NIF ;
>   - le message du 409 est le vôtre, sans nommer l'autre compte.
> - **Pièces** : PDF, JPEG ou PNG reconnus à leurs premiers octets, quel que soit le type annoncé.
>   - Une pièce envoyée avant la déclaration de l'entreprise donne 409 **`ENTREPRISE_ABSENTE`**.
>   - Le plafond est `tailleMaxPieceMo` (413), dans la limite multipart du serveur, 10 Mo : au-delà, le paramètre ne sert
>     à rien sans relever cette limite.

## B4 — La vérification du NIF : deux voies (lot 1, Q2)

- **Paramètre** `CANDIDAT_VERIFICATION_NIF` : `AUTOMATIQUE` ou `SUR_PIECES`, défaut `SUR_PIECES`.
- **Côté serveur** : **un** contrat, « vérifier un NIF », et **deux** implémentations choisies par le paramètre.
  - L'implémentation `AUTOMATIQUE` est un **raccordement** au service de la DGI. Son interface n'est pas connue : le
    backend pose le contrat et un raccordement vide, qui répond « indisponible ». On ne l'invente pas.
  - En `AUTOMATIQUE`, un service injoignable ou une réponse illisible **retombe sur la voie `SUR_PIECES`**, sans bloquer
    ni l'inscription ni le dépôt.
- `VerificationNifDto` = `{ statut, source, date, acteur, motif }` :
  - `statut` vaut `VERIFIE_DGI`, `VERIFIE_SUR_PIECES`, `INCONNU_DGI` (le NIF n'existe pas pour la DGI), `REFUSE_SUR_PIECES`
    (la pièce ne correspond pas) ou `NON_VERIFIE` ;
  - `acteur` est l'Administrateur pour la voie sur pièces, `DGI` pour l'automatique.
- **La vérification ne bloque jamais le dépôt** (décision du pilote). Elle s'affiche à la commission à l'ouverture
  (lot 4).
- **Écran de l'Administrateur** — routes proposées :

| Méthode | URL | Corps | Réponse | Statuts |
|---|---|---|---|---|
| GET | /api/admin/entreprises?verification=NON_VERIFIE | — | `EntrepriseDto[]` (les plus anciennes d'abord) | 200, 403 |
| POST | /api/admin/entreprises/{id}/verification | `{ statut: 'VERIFIE_SUR_PIECES' \| 'REFUSE_SUR_PIECES', motif }` | `VerificationNifDto` | 200, 400 (motif obligatoire pour un refus), 403, 404 |
| GET | /api/admin/entreprises/{id}/pieces/{idPiece}/fichier | — | le fichier | 200, 403, 404 |

- Tout changement de statut est **journalisé**, avec ses valeurs.

> ⚠️ **Livraison backend du 2026-10-04 (§B4).** Conforme. **Un contrat, deux voies**, choisies par `verificationNif` :
> - `AUTOMATIQUE` passe par le raccordement à la DGI, **vide** : il répond « indisponible », on ne l'invente pas. Une
>   réponse indisponible, ou une erreur, retombe sur la voie `SUR_PIECES`.
> - Un NIF nouveau ou changé remet le statut à `NON_VERIFIE`.
> - Les routes de l'Administrateur sont celles proposées. `GET /api/admin/entreprises` prend `NON_VERIFIE` par défaut, et
>   accepte les autres statuts.
> - Chaque changement de statut est journalisé, avec l'ancien statut, le nouveau et le motif.

## B5 — Le répertoire des entreprises exclues par l'ARMP (lot 1, Q2)

- **Tenu par l'Administrateur** — routes proposées :

| Méthode | URL | Corps | Réponse | Statuts |
|---|---|---|---|---|
| GET | /api/exclusions-armp | — | `ExclusionDto[]` | 200, 403 |
| POST | /api/exclusions-armp | `{ nif, raisonSociale, motif, referenceDecision, dateDebut, dateFin \| null }` | `ExclusionDto` | 201, 400, 403 |
| PUT | /api/exclusions-armp/{id} | idem | `ExclusionDto` | 200, 400, 403, 404 |

  - Une exclusion **ne se supprime pas**. Pour corriger une erreur de saisie, on la modifie ; pour la lever avant terme,
    on avance sa date de fin. Chaque changement est au journal, avec les anciennes et les nouvelles valeurs.
  - `ExclusionDto` = `{ id, nif, raisonSociale, motif, referenceDecision, dateDebut, dateFin, enCours, journal }`.
- **Rapprochement par le NIF**, sur le répertoire **du jour**.
- **À l'inscription et à la déclaration de l'entreprise** : un **signalement**, sans refus. `EntrepriseDto.exclusion`
  est rempli ; le candidat et l'Administrateur le voient.
- **Au dépôt** (lot 3, rappelé ici car c'est une décision du pilote) : **le système refuse**, réponse **409
  `ENTREPRISE_EXCLUE`**, avec ce message servi tel quel :
  > « Votre entreprise (NIF *n*) est exclue des marchés publics par la décision de l'ARMP *référence* du *date de
  > début*, jusqu'au *date de fin*. Vous ne pouvez pas déposer d'offre pendant cette période. »
  - Sans date de fin : « … du *date de début*, sans date de fin. ».
  - Pour un groupement : le refus vaut si **un** membre déclaré est exclu, et le message nomme ce membre.
  - Le refus est journalisé (entreprise, procédure, décision, date).
- **Exclusion prononcée après le dépôt** (lot 4) : l'offre, déjà scellée, est **écartée par le système** à
  l'ouverture. Elle n'est pas déchiffrée, et la séance la mentionne « écartée : entreprise exclue par l'ARMP », avec la
  décision.

> ⚠️ **Livraison backend du 2026-10-04 (§B5).** Conforme pour le lot 1.
> - Les routes de l'Administrateur sont celles proposées. Il n'y a **pas de `DELETE`** : la route répond 405.
> - Le journal de chaque exclusion, avec ses anciennes et nouvelles valeurs, est servi dans `ExclusionDto.journal`.
> - Le rapprochement se fait par le NIF normalisé, sur le répertoire du jour.
> - À la déclaration de l'entreprise, `EntrepriseDto.exclusion` est rempli tant que l'exclusion court ; il n'y a pas de
>   refus. L'inscription seule ne porte pas encore de NIF, donc rien à signaler à ce moment-là.
> - Le refus au dépôt (409 `ENTREPRISE_EXCLUE`) et l'offre écartée à l'ouverture relèvent des lots 3 et 4.

## B6 — Les alertes de collusion (lot 1 pour les données, lot 4 pour l'affichage)

- **Rapprochements** entre comptes : même téléphone, même adresse électronique, même signataire (le représentant de
  B3, et plus tard le signataire de l'offre), même adresse postale (comparée après normalisation : casse, espaces,
  accents).
- Le lot 1 **calcule et garde** les rapprochements. Le lot 4 les remet à la commission, **pour les offres déposées sur
  la même procédure**.
- **Jamais de refus par le système** : le refus se fait après décision de la commission, motivée et journalisée.
- **Question** : l'adresse IP de dépôt sert-elle de rapprochement ? Le front ne la propose pas : une IP partagée (un
  cybercafé, un opérateur mobile) donnerait de fausses alertes.

> ⚠️ **Livraison backend du 2026-10-04 (§B6).** Données calculées et gardées (`t_rapprochement_candidat`). Elles sont
> recalculées à l'inscription et à chaque déclaration de l'entreprise, et ne sont servies qu'au lot 4.
> - Critères : **téléphone** (chiffres seuls, `+261` ramené au `0`), **signataire** (le représentant de l'entreprise),
>   **adresse** (casse, blancs et accents ignorés).
> - L'**adresse électronique** d'un compte est unique : deux comptes ne la partagent jamais. Le critère servira aux adresses
>   saisies dans les offres, au lot 3.
> - **Question sur l'IP** : votre proposition est retenue, l'adresse IP n'est pas un critère. Jamais de refus.

## B7 — Le ménage des comptes (lot 1)

- Un compte **jamais confirmé** est **supprimé** après `CANDIDAT_DELAI_CONFIRMATION_JOURS` jours (défaut 7).
- Un compte **inactif** (aucune connexion) est **archivé** après `CANDIDAT_DELAI_INACTIVITE_MOIS` mois (défaut 24),
  jamais supprimé. Ses retraits de DAO et ses dépôts restent au journal. Un compte archivé se réactive en se
  reconnectant, avec un nouveau code envoyé par courriel.
- **Paramètres** : `GET` / `PUT /api/parametres/candidats` (patron des paramètres existants), qui porte aussi
  `CANDIDAT_VERIFICATION_NIF`, `CANDIDAT_CONFIRMATION_TELEPHONE`, `CANDIDAT_INSCRIPTIONS_PAR_JOUR` et la taille maximale
  des pièces.

> ⚠️ **Livraison backend du 2026-10-04 (§B7, sous-lot 1a).** Conforme.
> - Ménage chaque nuit (3 h 30, `app.candidats.cron-menage`) : suppression des comptes jamais confirmés après
>   `delaiConfirmationJours` ; archivage, jamais suppression, des comptes sans connexion depuis `delaiInactiviteMois`.
>   À défaut de connexion, c'est la date de confirmation qui compte.
> - `GET` / `PUT /api/parametres/candidats` (Administrateur seul, `GET` compris) :
>   `{ verificationNif, confirmationTelephone, inscriptionsParJour, delaiConfirmationJours, delaiInactiviteMois,
>   tailleMaxPieceMo }`, avec les défauts SUR_PIECES, false, 5, 7, 24, 10. Au `PUT`, un champ absent garde sa valeur, et une
>   valeur hors bornes donne un 400 nominatif.

## B8 — Les procédures ouvertes en ligne et le retrait du DAO (lot 1, Q3)

| Méthode | URL | Accès | Réponse | Statuts |
|---|---|---|---|---|
| GET | /api/procedures-en-ligne | public (sans session) | `ProcedureEnLigneDto[]` | 200 |
| GET | /api/procedures-en-ligne/{idDmc} | public | `ProcedureEnLigneDto` | 200, 404 |
| GET | /api/procedures-en-ligne/{idDmc}/documents | `CANDIDAT` | `[{ code, intitule, version, taille }]` | 200, 403, 404 |
| GET | /api/procedures-en-ligne/{idDmc}/documents/{code} | `CANDIDAT` | le document produit (le DAO, ses formulaires) | 200, 403, 404 |

- **Qui figure dans la liste** : les fiches **validées**, en mode **`ELECTRONIQUE`**, **lancées** (première publication
  de l'avis), dont la date limite n'est pas passée. Une procédure close reste lisible par son identifiant, avec la
  mention « close ».
- `ProcedureEnLigneDto` = `{ idDmc, reference, objet, autoriteContractante, categorie, lots: [{ numero, intitule }],
  datePublication, dateOuvertureDepots, dateLimite, heureReference, signatureExigee, formatsAcceptes,
  tailleMaxFichierMo, tailleMaxOffreMo, assistance, etat: 'A_VENIR' | 'OUVERTE' | 'CLOSE' }`. Ces champs sont lus sur
  la fiche (rubrique `B04-SE`, échéance) : **aucun paramètre interne** (V50, ADR-0010) n'y figure.
- **Le retrait est libre après inscription** (Q3), et **journalisé** : compte, entreprise, document, version, date.
  C'est le registre des retraits du DAO. La PRMP le consulte : `GET /api/fiches-marche/{idDmc}/retraits`, réservée à
  la PRMP de la fiche.
- **Le reçu des frais de dossier** (`{{PARAM.compte-dao}}`) n'est pas un péage au téléchargement. C'est une **pièce de
  l'offre** (lot 3), à confirmer par le juriste.
- **Q5 (signature)** : une fiche qui exige un niveau **Avancée** ou **Qualifiée** n'apparaît pas dans la liste tant que
  la plateforme ne sait faire que **Simple**. Le front propose que la validation de la fiche l'annonce par un
  **avertissement** (non bloquant, sur `B04-SE-05`) : « La plateforme n'accepte pour l'instant que la signature simple :
  la procédure ne pourra pas s'ouvrir en ligne. »

> ⚠️ **Livraison backend du 2026-10-04 (§B8, sous-lot 1c, V65).** Conforme, routes et `ProcedureEnLigneDto` tels que
> proposés.
> - **Les critères de la liste** :
>   - la dernière version **validée** de la fiche (une révision ouverte ne la masque pas) ;
>   - **lancée**, c'est-à-dire avec un **avis spécifique** imprimé : les lettres d'invitation des prestations
>     intellectuelles (liste restreinte) n'ouvrent rien au public ;
>   - un `B04-SE-05` vide vaut Simple.
>
>   Hors critères, le détail répond 404 sans dire lequel manque. Une procédure close sort de la liste, mais reste lisible
>   par son identifiant avec `etat = CLOSE`.
> - **Les sources** des champs :
>   - `reference` = `B02-OB-03` (numéro du DAO), à défaut la référence du plan ;
>   - `dateLimite` = `B04-LR-03` + `B04-LR-04`, à défaut `B04-CP-02` (contrat-cadre), puis `B04-OV-02` (travaux) ;
>   - `datePublication` = celle saisie à la **première** impression de l'avis (`AAAA-MM-JJ`), à défaut `B04-SE-17` ;
>   - `lots` = les lots du plan, numérotés de 1 à n ; liste vide si le marché n'est pas alloti ;
>   - les autres dates sont en `AAAA-MM-JJTHH:MM`.
>
>   Le tableau complet est dans `docs/api-endpoints.md`.
> - **`etat`** :
>   - `CLOSE` : la date limite est passée ;
>   - `A_VENIR` : avant l'ouverture des dépôts (`B04-SE-03`) ;
>   - `OUVERTE` : sinon.
> - **Les documents** : `.docx` et `.pdf` de la dernière version validée, sans l'avis ni les lettres.
>   - `code` est le **nom du fichier**.
>   - Sans session : **401** ; un agent connecté : 403.
> - **Le registre** :
>   - **Chaque téléchargement** fait une ligne : le même document retiré deux fois en fait deux.
>   - `GET /api/fiches-marche/{idDmc}/retraits` = `[{ date, compte, entreprise, nif, document, version }]`, du plus
>     ancien au plus récent.
>   - `compte` est l'adresse électronique du candidat ; `entreprise` et `nif` valent `null` si l'entreprise n'était pas
>     encore déclarée au retrait.
>   - L'accès est réservé à la **PRMP** de la fiche : l'UGPM et l'Administrateur reçoivent 403.
> - **Q5** : l'avertissement est livré, règle **`SIGNATURE_EN_LIGNE`**, avec votre message.
>
>   ⚠️ **Écart à connaître** : le niveau minimal de l'Administrateur (`FICHE_SE_SIGNATURE_MIN`, V50) vaut **Avancée**
>   par défaut. La règle bloquante `SE_SIGNATURE_MIN` refuse alors une fiche électronique en Simple. **Tant que
>   l'Administrateur ne l'abaisse pas à Simple** (`PUT /api/parametres/fiche-remise-electronique`), aucune procédure ne
>   peut paraître en ligne. Le défaut n'est pas changé : c'est une décision du pilote, signalée.

---

## Ce que le front fera, et quand

- **Dès maintenant, sans attendre** : rien de codé contre ces noms tant que le backend ne les a pas confirmés.
- **À la confirmation du lot 1** :
  - l'espace `/candidat` : inscription, confirmation, connexion, entreprise et pièces, procédures, documents ;
  - côté Administrateur : vérification sur pièces, répertoire des exclus, paramètres ;
  - côté PRMP : le registre des retraits sur la fiche.
  
  Une entrée de menu de plus chez l'Administrateur pour l'espace candidat : le menu n'a que 39 px de marge à 1229×691
  (`scripts/hauteur-menu.mjs`). Le front la place dans une rubrique existante, ou en remplace une.
- **À l'ADR (B1)** : les demandes des lots 2 (cérémonie), 3 (dépôt) et 4 (ouverture).

## Questions ouvertes, en résumé

| # | Question | À qui |
|---|---|---|
| 1 | Le protocole du scellement, l'algorithme, la bibliothèque, et le lieu de reconstitution de `K` | backend (ADR) |
| 2 | La connexion du candidat par son adresse électronique, sur `/api/auth/login` | backend |
| 3 | La passerelle SMS : quel fournisseur ? | pilote, puis backend |
| 4 | L'interface du service de vérification du NIF de la DGI | pilote (DGI) |
| 5 | Le dépositaire de la part de secours ; le sort des garanties si les offres sont illisibles (S5) ; le reçu des frais de dossier comme pièce de l'offre | juriste, par le pilote |
| 6 | Le stockage des offres chiffrées (jusqu'à 500 Mo chacune) : où, combien de temps, sauvegarde | backend (infrastructure) |

---

> ✅ **Front, lot 1 livré et contre-recetté (2026-10-04, JAR V65).**
> - **Espace `/candidat`** dans **sa propre coquille** (`features/candidat/candidat-layout.ts`), jamais dans `MainLayout` :
>   chaque appel de démarrage de la coquille interne (notifications, actualités, intérims, vacance) vaudrait un 403 au
>   profil `CANDIDAT` et son dialogue. Gardes : `espaceCandidatGuard` (un agent connecté est renvoyé à la racine),
>   `candidatConnecteGuard` (« Mon entreprise »), `candidatHorsSessionGuard` (inscription, confirmation) ; `authGuard` et
>   `roleGuard` renvoient un candidat vers `/candidat` sans appeler `/api/interims/mes`.
> - **Écrans** : procédures ouvertes (publiques) et détail avec retrait des documents (connecté, chaque retrait annoncé
>   comme inscrit au registre) ; inscription ; confirmation (réactive aussi un compte archivé : la connexion y mène sur
>   409 `COMPTE_A_CONFIRMER` / `COMPTE_ARCHIVE`) ; « Mon entreprise » (déclaration, pièces, statut de vérification,
>   signalement d'exclusion dans les termes du refus du dépôt).
> - **Administrateur**, sans entrée de menu (il sature) : `/admin/referentiels/candidats` (paramètres),
>   `/admin/referentiels/exclusions-armp` (répertoire, journal, pas de suppression), `/admin/entreprises` (vérification sur
>   pièces, pièce ouverte par `ouvrirBlobSur`) — joignables par le sommaire des nomenclatures, l'accueil et l'annuaire.
> - **PRMP** : « Retraits du DAO » sur la fiche (PRMP seule, remise électronique seule) → `/prmp/dao/{id}/retraits`.
> - **Entrée publique** : troisième audience `/accueil/candidat` (« Entreprises »), qui ne promet que consulter, retirer,
>   déclarer. **Connexion** : `login` accepte l'adresse électronique, lien « Créer un compte candidat ».
> - `Role` et `TypeActeur` gagnent `CANDIDAT` ; `NAV_BY_ROLE` est typé `RoleInterne` (dix menus, garde-fous inchangés).
> - **Recette écran, lecture seule** (`scratchpad/men/ecran-candidat.cjs`) : accueil, procédures (vide : aucune fiche
>   électronique en base), inscription (validation locale, rien envoyé), confirmation, connexion, les trois écrans Admin,
>   l'Administrateur renvoyé hors de `/candidat`, PRMP sur les fiches 19 (404 : base vidée le 25/09), 34 et 40 (remise
>   papier : lien masqué, voulu). Aucune écriture hors `/api/auth`. 110 tests verts sur les 8 fichiers de test touchés, dont 7 nouveaux (gardes,
>   chemins des services) ; lint propre.
> - **Deux points pour le pilote et le backend** :
>   1. **Le code de confirmation est invisible en recette** : `app.mail.enabled=false` fait renvoyer `EmailService.envoyer`
>      sans trace, et le code n'est stocké que haché. Aucun compte candidat ne peut donc être confirmé sur le JAR de
>      recette. **Demandé** : soit un Mailpit local (`app.mail.enabled=true`, `spring.mail.host=localhost`, port 1025,
>      lecture sur `:8025`), soit, sous un profil de recette seulement, le code dans le journal du serveur.
>   2. **`FICHE_SE_SIGNATURE_MIN` vaut Avancée** : tant qu'il n'est pas abaissé à Simple, aucune fiche électronique ne se
>      valide et la liste publique reste vide. Décision du pilote attendue (voir le message au pilote du 04/10).
> - **Non recetté faute de données** : le parcours du candidat connecté (documents, entreprise, pièces) et le registre
>   nominal — ils demandent un compte confirmé (point 1) et une fiche électronique lancée (point 2). Toute écriture dans
>   DBPRS20 attendra l'accord du pilote.
