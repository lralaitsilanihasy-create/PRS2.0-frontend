# Plan — 2026-10-04 — La soumission en ligne des offres (plateforme de dépôt)

**Statut** : proposition du front, **à arbitrer par le pilote** (Q1 à Q10). Rien n'est codé.
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
- **Q2 — Qui est le candidat ?**
  - **Recommandé** : un compte par **entreprise**, porté par une personne, créé par **inscription publique** avec
    vérification de l'adresse électronique, et identifiants légaux déclarés (NIF, STAT, RCS).
  - Sans validation par l'Administrateur : une validation préalable filtrerait l'accès à la concurrence.
  - Groupements : le mandataire dépose pour le groupement, et les membres sont déclarés dans l'offre.
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
| **1** | Espace candidat : inscription, procédures ouvertes en ligne, retrait du DAO | profil `CANDIDAT`, comptes, liste publique des procédures `ELECTRONIQUE` lancées, téléchargement journalisé | `/candidat` : inscription, liste, fiche de la procédure, documents |
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
