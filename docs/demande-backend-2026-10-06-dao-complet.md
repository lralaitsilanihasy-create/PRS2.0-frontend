# Demande backend — 2026-10-06 — Le DAO complet : un seul document, sur le plan et la mise en page des DAO réels

> Demande du pilote (06/10) : « Est-ce qu'on peut avoir le document de DAO en version intégrale, mais non pas divisé, et qui a la même
> structure et même mise en page que les DAO qu'on a téléversés ? » Arbitrages du même jour :
> - **les spécifications techniques** : la PRMP joint un **Word**, inséré à sa place ;
> - **le DAO complet seul** : il remplace les documents séparés.

**Le constat.** La fiche produit aujourd'hui des documents **séparés**, remplis depuis la fiche sur les documents types de l'ARMP
(lot D, `scripts/modeles-dao/`) : DPAO (ou DPAC, DPIC), acte d'engagement, CCAP (ou CPS), formulaires du candidat, bordereau des
prix ou DQE. Ils sont servis par `GET /api/fiches-marche/{idDmc}/documents`.

Les DAO réels déposés dans le dépôt sont, eux, **un seul document**, qui suit l'ordre des six documents types de l'ARMP :
- `Documents Types/Travaux/ExemplesDAO/daolance.DAO_2026_4SDC_vf.pdf` (travaux, 187 pages) ;
- `NatureMarches/DAO_Fournitures/Fourniture_a_commande.pdf` (fournitures, 86 pages).

| Ordre | Partie (DAO réel) | Source |
|---|---|---|
| 0 | Page de garde, sommaire général | **à produire** |
| 1 | Instructions aux candidats | **texte fixe** — document type n° 1 |
| 2 | Données particulières (DPAO / DPAC / DPIC) | produit (lot D) |
| 3 | Formulaires de soumission (lettre, fiches de renseignements, modèles de garantie, BP / DQE) | produits (formulaires du candidat, V45 / V59) |
| 4 | Acte d'engagement et ses annexes | produit (lot D) |
| 5 | Cahier des prescriptions spéciales (CCAP / CPS) et ses annexes | produit (lot D) |
| 5 bis | **Spécifications techniques** (devis descriptif, prescriptions, plans) | **Word joint par la PRMP** (B2) |
| 6 | Cahier des clauses administratives générales | **texte fixe** — document type n° 6 |

Les noms ci-dessous sont **proposés** : le backend fait autorité, et ce document sera corrigé en place si la livraison s'en écarte.

---

## B1 — Le document « DAO complet »

- **Un document par version validée de la fiche**, en **Word** et en **PDF**, produit à la validation comme les autres. Il remplace
  les documents séparés dans `GET …/documents` (arbitrage « le DAO complet seul »). L'**avis** spécifique reste un document à part.
- **Le plan** est celui du tableau ci-dessus, dans l'ordre des documents types et avec leur numérotation de sections. Si la fiche est
  allotie, les parties par lot (acte d'engagement, BP / DQE) se suivent, lot par lot, à leur place.
- **La mise en page** est celle des documents types :
  - styles, polices, marges et tableaux des fichiers Word de l'ARMP, déjà repris par les modèles du lot D (`modeles-docx/`) ;
  - chaque partie commence sur une nouvelle page ;
  - **en-tête** : « DAO n° {B02-OB-03} — {objet} » ; **pied de page** : « page n / N », la numérotation est continue.
- **La page de garde** (proposition, alignée sur les DAO réels) : le ministère ou l'entité, la PRMP, « Dossier d'appel d'offres », le
  mode de passation, le numéro du DAO, l'objet, les lots, la source de financement, la date.
- **Le sommaire général** : les parties et leurs pages. En Word, c'est un champ table des matières, mis à jour à l'ouverture ; dans le
  PDF, il porte les numéros de page.
- **Les textes fixes** (Instructions aux candidats, CCAG) sont **recopiés tels quels** des documents types, par catégorie :
  `Documents Types/{Fournitures et services | Travaux | Prestations_Intellectuelles}/1-…Instructions…` et `…/6-…Clauses
  Administratives Générales…`. Ils sont fournis en `.doc` : le backend les convertit une fois en `.docx`, comme il l'a fait pour les
  modèles du lot D. Aucun jeton, aucune condition.
- **Les prestations intellectuelles** suivent le même plan, sous le titre « **Dossier de consultation** » : IC-PI, DPIC, formulaires,
  AE-PI, CPS-PI, CCAG-PI. **Le contrat-cadre** place son DPAC au rang 2.

> ⚠️ **2026-10-06 — livré par le backend, avec ces écarts** (arbitrage du pilote : assemblage **par Word sur le serveur**, ADR-0014 ;
> V73 ; contrat : `docs/api-endpoints.md`, § *Le DAO complet en un seul document*) :
> - **Type** `DAO_COMPLET`, deux lignes de `GET …/documents` (`docx` puis `pdf`), `libelle` « Dossier d'appel d'offres complet »
>   (« Dossier de consultation complet » en PI), nom `DAO_COMPLET_{référence}_{idDetail}_v{n}.{ext}`.
> - **Les classeurs restent à part** : le bordereau des prix, le DQE et le tableau de conformité sont des `xlsx`, que Word n'insère
>   pas ; ils restent servis dans la liste, à côté du DAO complet. Le rang 3 ne contient donc que les formulaires Word (A1-A4, C1, C2).
> - **Mise en page** : chaque partie est le document du lot D tel qu'il est produit aujourd'hui ; les styles des fichiers Word de
>   l'ARMP (`modeles-docx/`) ne sont pas encore appliqués aux parties produites. Les textes fixes (IC, CCAG) gardent, eux, la mise en
>   page des documents types.
> - **Sommaire** : il ne liste que les parties (titres de section), avec leurs pages ; les titres internes des parties n'y entrent pas.
> - **Page de garde** : ministère, entité, PRMP, « DOSSIER D'APPEL D'OFFRES » (ou « DOSSIER DE CONSULTATION »), mode, « N° »
>   `B02-OB-03` (à défaut la référence du plan), objet, lots, financement, **date de validation** de la version.
> - **Contrat-cadre** : son DPAC en section II, avec l'IC et le CCAG de sa catégorie (il n'y a pas d'IC propre au contrat-cadre).
> - **Sans Word sur le serveur** (ou en échec), la validation passe et les documents séparés restent servis comme avant : le front
>   doit garder l'affichage de la liste séparée. ⚠️ Le serveur de production doit avoir Microsoft Word.
> - **Durée** : environ 30 s ajoutées à la validation d'une version (90 pages).

## B2 — Les spécifications techniques, jointes par la PRMP

| Méthode | URL | Accès | Corps / réponse |
|---|---|---|---|
| GET | `/api/fiches-marche/{idDmc}/specifications` | lecture de la fiche | `{ nomFichier, taille, deposeLe, deposePar }` ou 404 |
| PUT | `/api/fiches-marche/{idDmc}/specifications` | PRMP et UGPM de la fiche | multipart `fichier` (**.docx** seulement, type lu sur le contenu ; taille max proposée 20 Mo) → 200 |
| DELETE | `/api/fiches-marche/{idDmc}/specifications` | idem | 204 |
| GET | `/api/fiches-marche/{idDmc}/specifications/fichier` | lecture de la fiche | le .docx |

- Le fichier est rattaché à la **version** de la fiche, comme le besoin : il est figé à la validation (409 sur une version validée) et
  **recopié** à la révision.
- **Inséré au rang 5 bis**, après le CCAP / CPS et avant le CCAG, sous le titre « Spécifications techniques ». Ses titres rejoignent
  le sommaire général ; ses styles sont ramenés à ceux du DAO quand ils entrent en conflit (sinon la mise en page du document joint
  est gardée).
- **Sans fichier**, la partie n'apparaît pas. Proposition : un **avertissement** au contrôle de la fiche (`SPECIFICATIONS_ABSENTES`,
  non bloquant) pour les fournitures et les travaux, car un DAO réel en porte toujours.

> ⚠️ **2026-10-06 — livré tel que demandé, à ces précisions près** :
> - **Taille maximale : 20 Mo**, 413 au-delà ; la limite multipart du serveur passe à 20 Mo. Refus : 400 `FICHIER_ABSENT`,
>   400 `FORMAT_INVALIDE` (pas un `.docx`, lu sur le contenu ; un document **à macros** est aussi refusé).
> - GET (métadonnées) et DELETE répondent **404** sans fichier. Les écritures suivent les gardes de la fiche : 409 `FICHE_VALIDEE` sur
>   une version validée, et les autres refus d'écriture de la fiche (vacance de mandat…).
> - **Ses titres ne rejoignent pas le sommaire** : seul « Spécifications techniques » y figure. Le document est inséré tel quel ; quand
>   un style porte le même nom des deux côtés, celui du DAO l'emporte.
> - L'avertissement `SPECIFICATIONS_ABSENTES` est rattaché au **bloc B14** ; il est muet en prestations intellectuelles.

## B3 — Où le DAO complet est servi

- **`GET …/documents`** : le DAO complet, en `.docx` et en `.pdf`, et l'avis. Plus les documents séparés.
- **Le dossier DAO soumis à la Commission** : le DAO complet y est joint à la place des documents séparés.
- **Le retrait par les candidats** (`GET /api/procedures-en-ligne/{idDmc}/documents`) : le DAO complet, en `.docx` et `.pdf`, sous
  la garde des frais (V72). Le candidat y trouve l'acte d'engagement et les formulaires à remplir, qu'il recopie depuis le Word.
- **Les versions déjà validées** (fiches 40 à 48) : le DAO complet est produit à la **première demande**, puis gardé. Sinon, la règle
  est la production à la validation.

> ⚠️ **2026-10-06 — écarts de la livraison** :
> - **Pas de production « à la première demande »** : une lecture ne lance jamais Word, qui prend environ 30 s. Une **tâche planifiée**
>   produit le DAO complet des dernières versions validées qui n'en ont pas, deux minutes après le démarrage puis toutes les dix
>   minutes. D'ici là, la liste sert les documents séparés.
> - **Dossier soumis** : le PDF du DAO complet devient la pièce unique du DAO (type `DAO_COMPLET`) à la **prochaine jointure**
>   (création, rattachement, validation d'une version liée). Un dossier **déjà soumis** garde ses pièces : le rattrapage ne le touche
>   pas.
> - **Retrait candidat** : la même liste que `…/documents`, donc le DAO complet et les classeurs, sous la garde des frais (V72).

## Hypothèses

- **H1** — Les jetons, conditions et sections des documents du lot D ne changent pas : le DAO complet **assemble**, il ne réécrit
  rien. Les preuves `decrire.mjs` / `verifier.mjs` restent valables partie par partie.
- **H2** — Les formulaires du candidat restent aussi saisis **en ligne** (lot 5) : leur place dans le DAO complet est la version
  imprimable, comme dans les DAO réels.

## Questions

1. **Q1** : la conversion `.doc` → `.docx` des Instructions aux candidats et des CCAG garde-t-elle fidèlement la mise en page (tableaux,
   numérotation) ? Sinon, le pilote fournira des `.docx` ouverts dans Word.
2. **Q2** : le PDF du DAO complet porte-t-il les numéros de page du sommaire (calcul serveur), ou faut-il un renvoi « voir sommaire du
   Word » ?
3. **Q3** : une taille maximale du DAO complet à fixer (le Word des spécifications avec plans peut être lourd) ?

> ⚠️ **2026-10-06 — réponses du backend** :
> - **Q1** : la conversion a été faite **par Word lui-même** (ouvrir le `.doc`, enregistrer en `.docx`) ; tableaux et numérotation sont
>   gardés. Les six fichiers sont dans `src/main/resources/modeles/dao-fixes/` ; le pilote peut les remplacer par ses propres `.docx`.
> - **Q2** : **oui**, Word pagine avant d'enregistrer : le sommaire du PDF porte les numéros de page, et le pied « page n / N ».
> - **Q3** : pas de plafond propre au DAO complet ; seules les spécifications sont limitées, à **20 Mo**.
>
> **H1** retenue : le DAO complet assemble, il ne réécrit rien. **H2** retenue.

## Ce que le front fera, dès la livraison

- **Fiche, étape 7 (Documents)** : le DAO complet en tête (Word, PDF), à la place des documents séparés.
- **Fiche, bloc des pièces** (proposition) : « Spécifications techniques », pour déposer, remplacer, retirer et télécharger le Word ;
  l'avertissement du contrôle s'il manque.
- **Page de la procédure (candidat)** : « Dossier d'appel d'offres complet », Word et PDF, sous la garde des frais.

> ✅ **Front, 2026-10-06 — livré.** Étape 7 de la fiche : le DAO complet en tête (pastille « DAO », Ouvrir le PDF, Enregistrer
> PDF / Word), puis les classeurs ; la liste des documents séparés reste affichée tant que le serveur la sert (fiche sans DAO complet).
> Bloc B14 : section « Spécifications techniques » (dépôt d'un `.docx` ≤ 20 Mo contrôlé avant envoi, remplacement, retrait,
> enregistrement ; 400, 409 et 413 nommés ; lecture seule sur une version validée). Page de la procédure (candidat) : le DAO complet
> en tête de la liste. Message de l'étape 7 : le CCAG et les spécifications ne sont plus cités parmi les pièces à joindre quand le DAO
> complet existe.

## C — Constats de recette du 06/10 (PDF du DAO complet de la fiche 47, 119 pages, comparé aux DAO réels)

La pagination continue, l'en-tête « DAO n° … — objet », le pied « page n / N » et le sommaire paginé sont **conformes**. Restent :

- **C1 — Page de garde incomplète.** Elle ne porte que le titre, le numéro, l'objet et la date. Celle du DAO réel
  (`Fourniture_a_commande.pdf`, p. 1) porte, de haut en bas :
  - l'**emblème** de la République (celui de l'avis spécifique) ;
  - le **ministère**, « Personne responsable des marchés publics », « Unité de gestion de la passation des marchés » ;
  - « DOSSIER D'APPEL D'OFFRES **OUVERT** » (le mode de passation dans l'intitulé) ;
  - le numéro, l'objet, la **liste des lots** ;
  - « Lancé le …… » ;
  - **financement**, **imputation administrative**, **compte**.

  Le ministère, la PRMP, le mode, les lots et le financement annoncés par l'encadré B1 n'apparaissent pas sur la fiche 47 : sont-ils
  vides pour cette fiche (recopie de la fiche 32), ou non imprimés ?

  > ⚠️ **Backend, 2026-10-06 — corrigé.** C'était un **défaut du backend** : la page de garde cherchait le ministère, la PRMP, le
  > mode, les lots et le financement sous des clés que la fiche ne sert pas ; ils sont désormais lus sur les valeurs du plan de la
  > ligne. La page de garde porte, de haut en bas : l'**emblème** (celui de l'avis), le ministère, l'entité si elle diffère,
  > « PERSONNE RESPONSABLE DES MARCHÉS PUBLICS », « UNITÉ DE GESTION DE LA PASSATION DES MARCHÉS », l'intitulé qui porte le mode
  > (« DOSSIER D'APPEL D'OFFRES OUVERT » ; pour un mode qui n'est pas un appel d'offres, « DOSSIER D'APPEL D'OFFRES » et le mode
  > en dessous ; PI : « DOSSIER DE CONSULTATION »), « N° » `B02-OB-03`, l'objet, « Lot n : … » si la ligne a plusieurs lots,
  > « Lancé le ……… » (à compléter), « Financement », « Imputation administrative », « Compte ». Écarts :
  > - **les intitulés PRMP et UGPM sont imprimés seuls**, comme dans le DAO réel, sans nom de personne ;
  > - **l'imputation administrative** est faite des services bénéficiaires du plan (code et libellé du SOA, sans le montant), faute
  >   d'un champ dédié ; **le compte** est le compte budgétaire du plan (`B01-AC-17`) ;
  > - **la date de validation n'est plus imprimée** : « Lancé le » la remplace ;
  > - une valeur absente du plan omet sa ligne.
- **C2 — Les couvertures des documents types sont recopiées.**
  - Section I, pp. 3-4 : le cadre « République de Madagascar / Dossier type d'appel d'offres / Marchés publics de travaux », sur deux
    pages, dont une presque vide.
  - Section VI, p. 66 : « Dossier type d'appel d'offres / Marchés publics de travaux », avant le titre du CCAG.

  Un DAO réel ne les porte pas. Proposition : retirer la couverture et le sommaire propres à chaque document type, et ne garder que le
  texte, à partir de son premier titre.

  > ⚠️ **Backend, 2026-10-06 — retenu.** Les six textes fixes (`modeles/dao-fixes/`) ont été rognés une fois, par Word : couverture,
  > sommaire général de l'ARMP et table des matières propre au document retirés. L'IC commence à son texte d'introduction, puis
  > à « INSTRUCTIONS AUX CANDIDATS » ; le CCAG au chapitre I. Pour les PI, la note aux utilisateurs et le modèle de lettre
  > d'invitation qui précédaient l'IC sont aussi retirés. Le titre de la partie (1.1, 2.3) est celui du plan, posé par le serveur.
- **C3 — Le plan diffère de celui des DAO réels.** Le sommaire du DAO réel (p. 2) suit la numérotation de l'ARMP, en deux parties,
  avec les sous-parties :
  - **Première partie : procédure d'appel d'offres** :
    - 1.1 Instructions aux candidats ;
    - 1.2 DPAO ;
    - 1.3 Formulaires de soumission (A. fiches A1 à A4, B. attestation du fabricant, C. garanties C1, C2) ;
  - **Deuxième partie : marché** :
    - 2.1 Acte d'engagement et ses annexes ;
    - 2.2 Cahier des prescriptions spéciales (CCAP et ses annexes 1 à 4, puis spécifications techniques) ;
    - 2.3 CCAG.

  Le nôtre est « Section I à VI », à plat. Proposition : reprendre ces titres et cette numérotation, sous-parties comprises. Les
  spécifications techniques passent alors dans la 2.2.

  > ⚠️ **Backend, 2026-10-06 — retenu**, avec les intitulés exacts du sommaire général des documents types de l'ARMP, sur quatre
  > niveaux, tous au sommaire :
  > - « PREMIÈRE PARTIE : PROCÉDURE D'APPEL D'OFFRES » ; « 1.1. - Instructions aux candidats » ; « 1.2. - Données Particulières de
  >   l'Appel d'Offres (DPAO) » (contrat-cadre : « … d'Appel à Concurrence (DPAC) ») ; « 1.3. - Formulaires de soumission », avec
  >   « A. - Modèles de fiches de renseignements » (A1 à A4), « B. - Modèle d'attestation du fabricant - Non utilisé »,
  >   « C. - Modèles de garantie de soumission » (C1, C2). En **travaux**, comme le document type : « B. - Modèles de garantie de
  >   soumission » (B1, B2), sans attestation du fabricant.
  > - « DEUXIÈME PARTIE : MARCHÉ » ; « 2.1. - Acte d'Engagement » (« Lot n » par lot ; contrat-cadre : « Contrat-cadre valant Acte
  >   d'Engagement et CCAP ») ; « 2.2. - Cahier des Prescriptions Spéciales », puis « Cahier des Clauses Administratives
  >   Particulières (CCAP) et ses annexes », puis « Spécifications techniques » (le Word joint) et « Annexe : Liste des fournitures et
  >   calendrier de livraison » ; « 2.3. - Cahier des Clauses Administratives Générales applicable aux marchés publics de … ».
  > - **Prestations intellectuelles** : « PREMIÈRE PARTIE : PROCÉDURE DE CONSULTATION », « 1.1. - Lettre d'invitation (adressée à
  >   chaque candidat, document à part) » (titre seul : la lettre se produit candidat par candidat), « 1.2. - Instructions aux
  >   candidats (IC) », « 1.3. - DPIC », « 1.4. - Formulaires-types de soumission » ; en 2.2, « Termes de références » au lieu de
  >   « Spécifications techniques ».
  > - **Écart** : les annexes de l'acte d'engagement (bordereau des prix, DQE) sont des classeurs `xlsx`, toujours servis à part ;
  >   le sommaire ne les cite pas. Les annexes 1 à 4 du CCAP sont dans son document, sans entrée au sommaire.
- **C4 — La clause 6.2 de la DPAO imprime deux fois les pièces** (p. 36) : la **liste** (B14), puis le **texte** libre `B04-PI-01`,
  et de même la liste administrative et le texte `B03-CQ-01`. Le DAO réel n'imprime que la liste. Proposition : quand la liste B14
  n'est pas vide, les textes `B04-PI-01` / `B04-CO-01` / `B03-CQ-01` ne s'impriment pas dans la clause 6.2. Le front prévient déjà du
  double emploi pour `B03-CQ-01` ; il le fera aussi pour les deux autres si la règle n'est pas retenue.

  > ⚠️ **Backend, 2026-10-06 — règle retenue**, dans les modèles `DPAO-F` et `DPAO-T` : le texte libre ne s'imprime plus que si la
  > liste de sa rubrique est vide (conditions `PIECES-OFFRE-TEXTE` : `B04-CO-01` / `B04-PI-01 renseigne et PIECES.offre vide` ;
  > `PIECES-ADM-TEXTE` : `B03-CQ-01 renseigne et PIECES.administratives vide`). Elle vaut aussi pour les documents séparés. Elle
  > revient sur le texte validé par le pilote le 03/10 (V61), qui imprimait la liste puis le texte.
  > **À faire côté front** : ces deux lignes `CONDITION` sont à reporter dans `scripts/modeles-dao/modeles/DPAO-F.txt` et
  > `DPAO-T.txt` (et leurs `.json`), dont les copies du backend étaient jusqu'ici identiques ; l'avertissement de double emploi
  > devient inutile.
- **C5 — Nom du fichier.** `DAO_COMPLET_sans-reference_303279_v1` alors que `B02-OB-03` vaut `001-DAOO/MEN/PRMP/Tvx-PI-2026`. Les
  barres obliques l'ont sans doute écarté : proposition, les remplacer par des tirets
  (`DAO_COMPLET_001-DAOO-MEN-PRMP-Tvx-PI-2026_303279_v1`).

  > ⚠️ **Backend, 2026-10-06 — retenu.** Le nom porte désormais `B02-OB-03` (à défaut, la référence du plan), barres obliques et
  > autres signes remplacés par des tirets : `DAO_COMPLET_001-DAOO-MEN-PRMP-Tvx-PI-2026_303279_v1.pdf`. La cause n'était pas la
  > barre oblique, mais le même défaut que C1 : la référence était lue sous une clé que la fiche ne sert pas. Les autres documents
  > gardent leur nom actuel (référence du plan).
- **C6 — Ordre de `…/documents`.** Le classeur BP vient avant le DAO complet. Le front trie déjà ; un ordre serveur « DAO complet
  d'abord » servirait aussi le dossier soumis et le retrait.

  > ⚠️ **Backend, 2026-10-06 — retenu.** `GET …/documents` (et donc le retrait candidat) sert le DAO complet en tête, `docx` puis
  > `pdf`, puis les classeurs. Le dossier soumis n'est pas concerné : il ne reçoit que le PDF du DAO complet.

> ⚠️ **Backend, 2026-10-06 — reproduction des DAO complets déjà produits.** La migration **V74** retire, au prochain démarrage, les
> DAO complets produits avant ce correctif (26 fichiers en recette, aucun joint à un dossier ; un DAO complet joint comme pièce
> serait gardé). Le rattrapage les reproduit sur le nouveau gabarit dans les minutes qui suivent (environ 20 s par fiche). Contrat :
> `docs/api-endpoints.md`, § *Le DAO complet en un seul document*, bloc « Recette du 06/10 ».

> ✅ **Front, 2026-10-06 — C4 reporté.** `scripts/modeles-dao/modeles/DPAO-F.txt` et `DPAO-T.txt` (et leurs `.json`) portent les
> conditions `PIECES-OFFRE-TEXTE` et `PIECES-ADM-TEXTE` du backend, ainsi que `decrire.mjs` qui les déclare. Une nouvelle génération
> (`node decrire.mjs DPAO-F DPAO-T`) reproduit à l'identique les `.txt` du backend. L'avertissement de double emploi du bloc B14 est
> retiré.

## D — Contre-recette du 06/10 (PDF de la fiche 47 sur le gabarit V74, 109 pages)

Conformes :
- la page de garde : emblème, ministère, PRMP, UGPM, « Dossier d'appel d'offres ouvert », numéro, objet, « Lancé le », financement,
  imputation, compte ;
- le sommaire général en deux parties, avec la numérotation de l'ARMP ;
- les Instructions aux candidats et le CCAG sans la couverture du document type (« DOSSIER TYPE » n'apparaît plus) ;
- le nom de fichier `DAO_COMPLET_001-DAOO-MEN-PRMP-Tvx-PI-2026_303279_v1` ;
- le DAO complet en tête de `…/documents`.

Restent :
- **D1 — Le ministère est imprimé deux fois** sur la page de garde : « MINISTÈRE DES TRAVAUX PUBLICS » puis « MINISTERE DES TRAVAUX
  PUBLICS ». L'entité ne diffère du ministère que par l'accent. Proposition : comparer sans accents ni casse avant d'imprimer
  l'entité.
- **D2 — Le sommaire mélange deux présentations.** Les entrées A1 à A4, B1 et B2 sont dans une police plus grande, avec un interligne
  large, alors que les autres sont en petit corps serré. Ce sont sans doute les styles de titre des formulaires, repris par la table
  des matières. Proposition : un même style de sommaire pour tous les niveaux, comme le sommaire général du DAO réel.
- **D3 — La règle C4 n'est pas visible sur la fiche 47** (p. 30). La clause 6.2 imprime toujours la liste **puis** le texte libre,
  pour les pièces de l'offre (`B04-PI-01`) comme pour les pièces administratives (`B03-CQ-01`). Le DAO complet semble assembler la
  **DPAO déjà produite** à la validation de la version 1, avant la règle. Est-ce voulu (la règle ne vaut que pour les prochaines
  validations), ou faut-il reproduire aussi les parties, et pas seulement l'assemblage, des versions déjà validées ?
