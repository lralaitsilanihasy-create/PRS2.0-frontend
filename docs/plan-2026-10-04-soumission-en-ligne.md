# Plan — 2026-10-04 — La soumission en ligne des offres (plateforme de dépôt)

**Statut** : proposition du front. **Q2 arbitrée le 04/10** ; Q1 et Q3 à Q10 restent à arbitrer. Rien n'est codé.
**Origine** : pilote, 04/10 : « Attaquer la soumission en ligne ». Suite de la remise électronique (V50, 27/09), qui
préparait la fiche et annonçait : « la plateforme de dépôt viendra plus tard ». Q14 du 27/09 avait tranché : les
formulaires du candidat seront remplis **en ligne**, sur le besoin de la fiche.

## 1. Ce qui existe déjà

| Brique | État | Où |
|---|---|---|
| Réglages de la remise électronique sur la fiche : mode `PAPIER`/`ELECTRONIQUE`, URL, formats, tailles, signature, remplacement, prorogation, assistance | ✅ livré (V50) | rubrique `B04-SE`, `B05-GS-10..14`, `B04-OP-10..13` |
| Paramètres internes : membres détenteurs d'une **part de clé**, **quorum**, date de la **cérémonie des clés**, responsable de la procédure | ✅ livré (V50, ADR-0010) — « sans engagement sur le protocole de partage de clés » | `/api/fiches-marche/{idDmc}/parametres-internes` |
| Le besoin structuré, lisible par API : articles par lot (fournitures), DQE par série (travaux), matériel, personnel, pièces de l'offre | ✅ livré (V45, V59 à V62) | `/articles`, `/materiel`, `/personnel`, `/pieces` |
| Publication : avis spécifique, « Lancé » = 1re publication | ✅ livré | avis spécifique |
| Maquettes du candidat : fournitures 2463 (bordereau, calendrier, conformité), bâtiment MEN (DQE, corps d'état, capacités, pièces, visite), routier MTP (prix en lettres, sous-détail, seuils calculés) | ✅ maquettes, n'enregistrent rien | `docs/maquette-2026-09-27-formulaires-en-ligne.html`, `docs/maquette-2026-10-02-soumission-en-ligne-*.html` |
| **Comptes de candidats, dépôt, scellement, ouverture des plis en ligne** | ❌ rien, ni au front ni au backend | — |
| **Clause juridique de la remise électronique** (C1/C2, garanties, `B10-PC-01`) | ❌ en attente du juriste : `[[CLAUSE À FOURNIR PAR LE JURISTE…]]` | — |

Conséquence : la plateforme peut être **développée et recettée** maintenant, mais aucune procédure réelle ne peut
s'ouvrir en ligne avant la clause du juriste. Les DAO réels étudiés (2463, MEN, MTP) prévoient tous la remise papier.

## 2. Le chemin d'une offre (cible)

1. **Publication** : la fiche validée en mode `ELECTRONIQUE` est lancée ; la procédure apparaît sur l'espace public.
2. **Inscription** du candidat (une entreprise), puis **retrait du DAO** (téléchargement des documents produits).
3. **Cérémonie des clés**, avant la publication (règle 8 de V50) : la clé de la procédure est créée et partagée entre
   les membres désignés, avec le quorum.
4. **Préparation de l'offre** : formulaires en ligne (prix, délais, capacités) et pièces jointes, par lot. Brouillon
   possible.
5. **Dépôt** avant la date limite : l'offre est **scellée** (chiffrée), et le candidat reçoit un **accusé de réception
   horodaté** avec l'empreinte du dépôt. Il peut remplacer ou retirer son offre si `B04-SE-10` = Oui.
6. **Ouverture des plis**, à la date calculée (`B04-OP-02/03`) : le quorum des membres réunit ses parts, les offres sont
   déchiffrées, et la séance produit le PV d'ouverture, publié si `B04-OP-13` = Oui.
7. Ensuite, l'évaluation : **hors de ce plan**.

## 3. Questions au pilote

- **Q1 — Où vit la plateforme ?**
  - **Recommandé** : dans **cette application et ce backend**, comme un espace à part `/candidat`, avec un profil
    `CANDIDAT` qui n'atteint aucune route interne (garde par profil côté serveur, comme les dix profils actuels).
    C'est la même origine, le même cookie `HttpOnly` et le même CSRF.
  - L'autre voie, une application séparée, double l'authentification et le déploiement sans gain fonctionnel.
- **Q2 — Qui est le candidat ? ✅ Arbitrée par le pilote le 04/10.**
  - Un compte par **entreprise**, porté par une personne, créé par **inscription publique**. Groupements : le
    mandataire dépose pour le groupement, et les membres sont déclarés dans l'offre.
  - **Trois niveaux de confiance.** L'inscription reste légère ; les contrôles se placent au dépôt, où le candidat
    s'engage.

    | Niveau | Ce que le compte peut faire | Ce qu'on vérifie |
    |---|---|---|
    | 1. Compte | consulter les procédures, retirer le DAO | adresse électronique **et** téléphone confirmés par un code ; anti-robot ; inscriptions limitées par adresse et par jour |
    | 2. Entreprise déclarée | préparer une offre en brouillon | NIF, STAT et RCS **uniques** sur la plateforme ; pièces téléversées (carte fiscale, statuts, pouvoir du signataire) ; NIF vérifié (ci-dessous) |
    | 3. Dépôt | déposer une offre scellée | ce que le DAO exige déjà : garantie avec code de vérification, reçu des frais de dossier, pièces administratives, signature |

  - **Le dépôt n'est jamais bloqué par la vérification** (seule l'exclusion par l'ARMP le bloque, ci-dessous). Le statut de vérification de l'entreprise s'affiche à la
    commission à l'ouverture des plis, et c'est elle qui juge sur pièces, comme pour une offre papier.
  - **La vérification du NIF : deux voies, choisies par un paramètre administrable.**
    - Le paramètre `CANDIDAT_VERIFICATION_NIF` vaut `AUTOMATIQUE` (interrogation d'un service de la DGI) ou
      `SUR_PIECES` (l'Administrateur contrôle la carte fiscale téléversée). Sa valeur par défaut est `SUR_PIECES`, tant
      qu'aucun service de la DGI n'est raccordé.
    - Côté serveur : un seul contrat « vérifier un NIF », deux implémentations. Le service DGI n'est qu'un
      **raccordement** à brancher le jour où l'interface est connue ; on ne l'invente pas.
    - En mode `AUTOMATIQUE`, un service DGI injoignable ou une réponse illisible **retombe sur la vérification sur
      pièces**, sans bloquer l'inscription ni le dépôt.
    - Le statut porte sa source : `VERIFIE_DGI`, `VERIFIE_SUR_PIECES`, `INCONNU_DGI` (le NIF n'existe pas pour la DGI),
      `NON_VERIFIE`, avec la date et l'acteur. C'est ce statut que la commission voit.
  - **Le répertoire des entreprises exclues ou sanctionnées par l'ARMP.**
    - Il est tenu dans l'application par l'Administrateur : NIF, raison sociale, motif, référence de la décision de
      l'ARMP, date de début et date de fin (l'exclusion peut être temporaire), avec un journal.
    - Une entreprise du répertoire est reconnue par son NIF. Pendant la période d'exclusion, elle est **signalée** à
      l'inscription, au candidat et à l'Administrateur.
    - **Elle ne peut pas déposer : le système refuse, avec un message (pilote, 04/10).** C'est le système qui refuse, pas
      la commission : la seule exception à la règle « le système ne refuse pas, la commission décide ».
      - Réponse du serveur au dépôt : **409 `ENTREPRISE_EXCLUE`**, avec le message, servi tel quel et affiché par
        l'écran :
        > « Votre entreprise (NIF *n*) est exclue des marchés publics par la décision de l'ARMP *référence* du
        > *date de début*, jusqu'au *date de fin*. Vous ne pouvez pas déposer d'offre pendant cette période. »
        Pour une exclusion sans fin, la fin de phrase devient « … du *date de début*, sans date de fin. ». Pour un
        groupement, le message nomme l'entreprise membre exclue.
      - Le refus est vérifié **au moment du dépôt**, sur le répertoire du jour : une exclusion levée rouvre le dépôt, et
        une exclusion prononcée pendant la préparation le ferme.
      - Le même message s'affiche dès l'ouverture de l'offre, pour que le candidat ne prépare pas une offre qu'il ne
        pourra pas déposer, et à l'inscription comme signalement.
      - Groupement : si l'un des membres déclarés est exclu, le dépôt du groupement est refusé.
      - Le refus est journalisé (entreprise, procédure, décision, date), et l'Administrateur le voit.
    - **Une exclusion prononcée après un dépôt** ne peut pas retirer une offre scellée. Le système l'**écarte** à
      l'ouverture : elle n'est pas déchiffrée, la séance la mentionne « écartée : entreprise exclue par l'ARMP » avec la
      décision, et le candidat reçoit le même message.
    - Une erreur de saisie dans le répertoire (un mauvais NIF) bloquerait un candidat à tort. Chaque fiche du
      répertoire porte donc sa référence de décision, et l'Administrateur la corrige au journal.
  - **La collusion** (une même personne derrière plusieurs entreprises).
    - Les rapprochements donnent une **alerte** : même téléphone, même adresse électronique, même signataire ou même
      adresse postale sur plusieurs comptes.
    - L'alerte est remise à la commission avec les offres concernées, à l'ouverture.
    - **Le refus se fait après décision de la commission**, motivée et journalisée, jamais par le système.
  - **Le ménage.**
    - Un compte jamais confirmé est supprimé après `CANDIDAT_DELAI_CONFIRMATION_JOURS` jours (paramètre, défaut 7).
    - Un compte inactif est **archivé** après `CANDIDAT_DELAI_INACTIVITE_MOIS` mois (paramètre, défaut 24), jamais
      supprimé : ses retraits de DAO et ses dépôts restent au journal.
- **Q3 — Le retrait du DAO et son coût.**
  - **Recommandé** : le téléchargement est **libre après inscription** et journalisé (qui, quand, quelle version).
  - La preuve du paiement des frais de dossier (`{{PARAM.compte-dao}}`) est une **pièce de l'offre**, vérifiée à
    l'ouverture, pas un péage au téléchargement. Elle reste à confirmer par le juriste.
- **Q4 — Le scellement : c'est la décision structurante.**
  - **(a) Recommandé : chiffrement dans le navigateur du candidat.** C'est ce que V50 a préparé (parts, quorum,
    cérémonie).
    - La procédure a une clé publique ; l'offre est chiffrée dans le navigateur (WebCrypto, sans dépendance) avant
      l'envoi.
    - La clé privée n'existe qu'en **parts** détenues par les membres, et n'est reconstituée qu'à l'ouverture, au
      quorum.
    - Ni le serveur ni un administrateur ne peuvent lire une offre avant la séance.
    - Coût : la cérémonie et l'ouverture sont des écrans à part entière, et une part perdue au-delà du quorum rend les
      offres illisibles. Il faut donc une procédure de secours, à écrire dans l'ADR.
  - **(b) Chiffrement par le serveur**, la clé gardée par le serveur, l'accès verrouillé jusqu'à l'heure d'ouverture.
    - C'est plus simple, mais un administrateur de la base ou du serveur peut lire les offres avant l'ouverture.
    - Les paramètres « parts » et « quorum » de V50 deviennent alors décoratifs.
  - Dans les deux cas, une **ADR backend** fixe le protocole avant tout code.
  - Pour (a), le partage de secret (Shamir) demande une **bibliothèque auditée** : c'est un ajout de dépendance npm, à
    signaler. On ne l'écrit pas soi-même.
- **Q5 — La signature électronique** (`B04-SE-05` : Qualifiée, Avancée ou Simple).
  - **Recommandé, premier temps** : niveau **Simple** = authentification du compte, empreinte SHA-256 de l'offre
    scellée, accusé horodaté par le serveur.
  - Les niveaux Avancée et Qualifiée dépendent des prestataires de certification (`B04-SE-06`, liste officielle
    toujours « À définir »). Ils viennent dans un second temps.
  - Tant qu'une fiche exige plus que Simple, elle ne peut pas s'ouvrir sur la plateforme. Le serveur le refuse en le
    nommant.
- **Q6 — Les formulaires en ligne.**
  - **Recommandé** : les **pièces jointes** et l'**acte d'engagement** (montant par lot, délai) d'abord.
  - Les formulaires structurés des maquettes viennent ensuite, chacun lu sur le besoin de la fiche : bordereau et
    calendrier (fournitures), DQE et sous-détail (travaux), capacités, personnel, matériel.
  - Contrainte avec (a) : le **montant lu en séance** est dans l'offre chiffrée. Le serveur ne connaît aucun prix avant
    l'ouverture, donc pas de contrôle serveur au dépôt, seulement dans le navigateur.
- **Q7 — La garantie de soumission** (`B05-GS-10`).
  - **Recommandé** : la **voie B** (téléversement de la garantie avec son code de vérification) dans l'offre.
  - La voie A (dépôt direct par le garant) suppose des comptes de garants habilités (`B05-GS-13`, liste « À définir »).
    Elle vient plus tard.
  - L'original papier (`B05-GS-11`) reste hors plateforme.
- **Q8 — L'ouverture des plis.**
  - **Recommandé** : une séance sur la plateforme, menée par le responsable de la procédure. Les membres du quorum
    apportent leur part, et les offres s'ouvrent ensemble ; aucune ne s'ouvre seule.
  - La séance lit à haute voix (écran projeté) les éléments du PV d'ouverture : candidat, montant par lot, garantie,
    rabais. Le PV est produit par le moteur des documents, comme les PV actuels.
  - `B04-OP-10` (Présentiel, En ligne ou Mixte) ne change que la diffusion. Le lien `B04-OP-11` reste vide au premier
    temps.
- **Q9 — Disponibilité et prorogation** (`B04-SE-12`, `-13`, `-16`).
  - **Recommandé** : le serveur **journalise** les indisponibilités. La prorogation reste une **décision de la PRMP**,
    proposée par le serveur quand le seuil est atteint dans la fenêtre, jamais automatique.
- **Q10 — Les fichiers.**
  - Jusqu'à 500 Mo par offre (`B04-SE-09`), donc un **envoi par morceaux** avec reprise.
  - Le stockage relève du backend : où, combien de temps, et sauvegarde. C'est une question d'infrastructure, à poser
    au backend.
  - Côté front, chaque fichier passe par `validerFichier()` (type et taille), comme tout téléversement.

## 4. Découpage proposé (si les recommandations sont retenues)

| Lot | Contenu | Côté backend | Côté front |
|---|---|---|---|
| **0** | ADR du scellement (Q4) et contrat de la plateforme | ADR, puis réponse à la demande | demande `demande-backend-…-soumission-en-ligne.md` (B1…) |
| **1** | Espace candidat : inscription à trois niveaux, vérification du NIF (deux voies), répertoire des exclus, alertes de collusion, ménage ; procédures ouvertes en ligne, retrait du DAO | profil `CANDIDAT`, comptes, codes de confirmation, paramètres `CANDIDAT_*`, répertoire des exclus, liste publique des procédures `ELECTRONIQUE` lancées, téléchargement journalisé | `/candidat` : inscription, entreprise, liste, fiche de la procédure, documents ; Admin : vérification sur pièces, répertoire des exclus, paramètres |
| **2** | Cérémonie des clés | clé publique par procédure, dépôt des parts (chiffrées pour chaque membre) | écran de la cérémonie (responsable et membres) |
| **3** | Dépôt scellé : pièces et acte d'engagement, brouillon, accusé, remplacement et retrait | envoi par morceaux, stockage chiffré, horodatage, refus après la date limite | écran de l'offre (maquettes) et chiffrement dans le navigateur |
| **4** | Ouverture des plis et PV d'ouverture | reconstitution au quorum, déchiffrement en séance, PV | écran de la séance |
| **5** | Formulaires structurés (bordereau, DQE, capacités), garantie voie A, signature avancée et qualifiée, prorogation | par sujet | par sujet |

Une recette de bout en bout est possible dès la fin du lot 4, sur une fiche de recette en mode électronique (la
fiche 19 l'est déjà). Chaque écriture dans DBPRS20 demande votre accord, comme d'habitude.

## 5. Ce que le plan ne décide pas

- La **clause du juriste** : sans elle, la plateforme reste en recette.
- Les **listes officielles** (prestataires de certification, garants habilités) : `B04-SE-06` et `B05-GS-13` sont
  toujours « À définir ».
- L'**évaluation des offres** après l'ouverture.
