# Demande backend — 2026-10-17 — Spécifications : des données en fournitures, un PDF de plans en travaux

## Contexte

Le 06/10 (V73), un **Word de spécifications techniques** déposé sur la fiche (`PUT /{idDmc}/specifications`, `.docx` ≤ 20 Mo)
a été inséré dans le DAO complet. L'avertissement B14 (`SPECIFICATIONS_ABSENTES`, puis l'information
`SPECIFICATIONS_DU_BESOIN` du 17/10) invite à le joindre.

En recette sur la fiche des consomptibles informatiques (ligne 303339), le pilote pose deux constats :
1. **Le dépôt du Word est introuvable en fournitures.** L'écran l'a placé dans le bloc B14 (pièces de l'offre exigées), que le
   référentiel ne sert qu'aux travaux. L'information invite donc à joindre un Word que la PRMP ne peut déposer nulle part.
2. **Le principe de l'application est la donnée d'abord.** La Commission examine les **données de la fiche** (onglet « Fiche
   DAO » de l'examen, observation ancrée sur un champ). Les documents en sont la mise en forme. Un Word libre échappe à ce
   principe.

**Arbitrage du pilote (17/10).**
- **Fournitures et services** : les spécifications sont les données du besoin (B12), et ça suffit. Plus de Word.
- **Travaux** : ce qu'un formulaire ne sait pas porter, c'est-à-dire les plans et le devis descriptif, arrive en **PDF**.
  C'est la forme réelle des plans, produits par les logiciels de dessin, souvent en grand format.

## Volet A — Fournitures et services : les spécifications sont des données

### A1 — Un champ « Prescriptions générales » au B12

Les exigences communes à tous les articles (conditionnement, garantie du fabricant, normes, marquage, notice) n'ont
aujourd'hui pas de place hors d'un Word. Demande : un champ **`TEXTE_LONG`**, facultatif, dans le bloc du besoin (B12), en
fournitures et services. Son libellé : « Prescriptions générales applicables à tous les articles ».
- **Rendu** : le DAO complet l'imprime en tête de la section « Spécifications techniques », avant le tableau
  (`TableauxBesoin.specifications`). Un paragraphe par ligne saisie.
- **Code** : au choix du backend. Le front le servira par le référentiel comme les autres champs ; rien de particulier à coder.
- **Examen** : c'est un champ de la fiche, donc observable par la Commission comme les autres.

> ⚠️ **2026-10-17, livré côté backend (A1).** Le champ est **`B12-BE-01`** : texte long, facultatif, rubrique `B12-BE` (la seule
> rubrique du B12 en fournitures), document maître `AUCUN`, quantité fixe, à commandes et contrat-cadre.
> - **Chargement** : il est ajouté au CSV des fournitures et à sa copie `docs/referentiel-champs-fiche-marche-fournitures.csv`. Une
>   base existante le reçoit par `docs/referentiel/2026-10-17-prescriptions-generales.sql`, sans migration.
> - **Saisie** : comme tout champ, par `PUT …/blocs/B12`, `{"valeurs":{"B12-BE-01":"…"}}`.
> - **Rendu** : le DAO complet l'imprime en tête des spécifications techniques. Viennent d'abord « Prescriptions générales
>   applicables à tous les articles » en gras, puis un paragraphe par ligne non vide, et enfin le tableau.
> - **À noter** : c'est le **premier champ du bloc B12**, jusqu'ici fait du seul besoin. L'écran doit l'y servir.

### A2 — Plus de Word de spécifications en fournitures

- `PUT /{idDmc}/specifications` est refusé pour une fiche de fournitures et services : **409 `SPECIFICATIONS_HORS_PERIMETRE`**,
  sur le modèle de `PIECES_HORS_PERIMETRE`.
- Le DAO complet n'insère plus de Word en fournitures.
- **Versions déjà validées** : rien ne change, une version figée garde ce qu'elle a produit.
- **Q1** : des fiches de fournitures en base portent-elles un Word de spécifications ? Le front n'en connaît pas depuis la
  réinitialisation du 17/10.

> ⚠️ **2026-10-17, livré côté backend (A2).**
> - **Le refus** : `PUT …/specifications` en fournitures et services → **409 `SPECIFICATIONS_HORS_PERIMETRE`**, avant toute lecture du
>   fichier.
> - **Le DAO complet** n'insère plus de Word en fournitures. **La révision** ne recopie pas un Word que la catégorie n'admet plus ;
>   la version validée garde le sien.
> - **Q1 : non.** La table des spécifications est **vide** dans DBPRS20 : aucune fiche, de fournitures ou non, ne porte de fichier.
> - **Une conséquence réglée au passage** : l'exemption du CCTP (E2, 07/10) reconnaissait les spécifications au seul Word. Elle les
>   reconnaît aussi à un besoin dont un article porte des caractéristiques. Sans cela, le CCTP serait redevenu exigé pour toute fiche
>   de fournitures.

### A3 — Le message B14 en fournitures

- **Avec des articles** : l'information `SPECIFICATIONS_DU_BESOIN` ne parle plus de Word. Elle peut dire « Le DAO complet portera
  le tableau des spécifications tiré du besoin », ou disparaître.
- **Sans article** : l'avertissement demande de saisir le besoin, sans évoquer de Word.

> ⚠️ **2026-10-17, livré côté backend (A3).**
> - **Avec des articles** : `SPECIFICATIONS_DU_BESOIN` (liste `ok`) dit « Le DAO complet portera le tableau des spécifications tiré du
>   besoin. ».
> - **Sans article** : `SPECIFICATIONS_ABSENTES` dit « Aucune spécification technique : le besoin n'a pas d'article. Saisissez le
>   besoin (bloc B12) : ses articles et leurs caractéristiques font le tableau des spécifications du DAO complet. ».

## Volet B — Travaux : le devis descriptif et les plans en PDF

### B1 — Dépôt d'un PDF sur la fiche de travaux

- La route des spécifications (ou une route sœur, au choix du backend) accepte un **PDF** en travaux : devis descriptif et
  plans.
  - **Taille** : à fixer par le backend, plus large que les 20 Mo du Word (les plans en A1 pèsent lourd). Le front propose 50 Mo.
  - **Contrôle** : un vrai PDF, pas un scan imposé, avec le même contrôle de type et de taille que les autres dépôts.
- **Q2** : un PDF seul, ou plusieurs (un par plan) ? Le front propose **un seul PDF assemblé** par la PRMP ou son bureau
  d'études : il est plus simple à retirer, à joindre et à lire.
- **Le Word de travaux** : le garde-t-on en plus, pour un devis descriptif rédigé en Word ? Le front propose de **ne plus
  l'accepter**, car un PDF suffit, le Word s'exportant en PDF. C'est la **Q3**.

> ⚠️ **2026-10-17, livré côté backend (B1).** C'est la même route, `PUT …/specifications`.
> - **Le contrôle** : en travaux, un **PDF** seulement, lisible, non chiffré, d'une page au moins, de **50 Mo** au plus (413 au-delà).
>   Le nom déposé est gardé.
> - **Le service** : `GET …/specifications/fichier` le sert en `application/pdf`.
> - **Q2** : un seul PDF, comme le propose le front.
> - **Q3** : le Word est refusé en travaux (**400 `FORMAT_INVALIDE`**, « un Word s'exporte en PDF »). Le Word reste en prestations
>   intellectuelles.
> - **La limite de taille** : `max-file-size` passe à 50 Mo **pour cette seule route**. Partout ailleurs, un intercepteur
>   (`TailleFichiersConfig`) maintient 20 Mo par fichier et 25 Mo par requête, avec la même réponse qu'avant : 400 « Fichier trop
>   volumineux ». Beaucoup de dépôts n'avaient pas d'autre contrôle de taille.

### B2 — Un document à part, annexé au DAO, jamais fondu dedans

Le DAO complet est assemblé par Word, qui n'insère pas un PDF comme contenu. Des pages en A1 au milieu d'un DAO en A4 casseraient
aussi la charte : pagination, en-tête, sommaire. Le PDF reste donc **un document à part** :
- **dans le DAO complet**, la section « Spécifications techniques » le **cite** :
  - la « Liste des plans » (T7, depuis `B04-CD-03`) reste ;
  - on y ajoute une phrase de renvoi, par exemple « Le devis descriptif et les plans font l'objet du document annexé
    « Devis descriptif et plans » » ;
- **au retrait du DAO**, les candidats le reçoivent **avec** le DAO complet, dans la liste `GET …/documents` de la version ;
- **dans le dossier soumis**, il est **joint d'office** sous la pièce **`DESCRIPTIF_PLANS`** (« Descriptif technique et plans des
  travaux »). Le référentiel des pièces l'exige déjà pour les DAO de travaux (`t_piece_sous_type`, catégorie `TRAVAUX`) ; il n'y a
  rien à joindre à la main, comme pour le DAO complet ;
- **dans l'étape 7 de la fiche**, il apparaît avec un sigle court, par exemple `DP`, et s'ouvre comme les autres PDF.

> ⚠️ **2026-10-17, livré côté backend (B2)**, avec une précision sur l'existant.
> - **Le document** : à la validation, le PDF devient le document **`DESCRIPTIF_PLANS`** de la version (V129).
>   - **Fichier** : `DP_<réf>_<ligne>_v<n>.pdf`, extension `pdf`, titre « Descriptif technique et plans des travaux ».
>   - **Liste** : `GET …/documents` le sert même à côté du DAO complet, donc **au retrait** des candidats. Sigle proposé à l'étape 7 :
>     `DP`, comme le préfixe du fichier.
> - **La jointure** : il est **joint d'office** au dossier sous la pièce `DESCRIPTIF_PLANS`, avec le DAO complet, et ne se remplace
>   plus à la main (`PIECE_PRODUITE_PAR_FICHE`).
> - **Dans le DAO complet** : l'annexe 1 « Liste des plans » commence par « Le devis descriptif et les plans font l'objet du document
>   annexé « Descriptif technique et plans des travaux », remis avec le présent dossier. ». Avec ce renvoi, une liste vide n'imprime
>   plus « Néant. ».
> - **La précision sur l'existant** : la pièce `DESCRIPTIF_PLANS` existait déjà depuis le 15/10 (V119). La PRMP la déposait **à la
>   main** sur le dossier, en plusieurs fichiers, et le retrait la servait déjà.
>   - Les fichiers déposés ainsi restent.
>   - Le retrait ne sert pas deux fois un fichier joint d'office.

### B3 — Le message B14 en travaux

Sans PDF déposé, l'avertissement dit : « Aucun devis descriptif ni plan n'est déposé : la pièce « Descriptif technique et plans
des travaux » manquera au dossier. Déposez-les en PDF. »

> ⚠️ **2026-10-17, livré côté backend (B3)**, au mot près.
> - **Le message** : « Aucun devis descriptif ni plan n'est déposé : la pièce « Descriptif technique et plans des travaux » manquera au
>   dossier. Déposez-les en PDF. ».
> - **Les tests** : `FicheDaoTravauxIntegrationTest.descriptifEtPlansEnPdf` (dépôt, refus du Word, document, jointure d'office,
>   révision), `DaoCompletIntegrationTest` (fournitures, limite de taille) et `TableauxBesoinTest` (prescriptions générales).

## Recette du front, dès la livraison

- **Fournitures** (fiche 303339, en révision) :
  - le champ « Prescriptions générales » est au B12 ;
  - une fois saisi, il apparaît dans le DAO complet avant le tableau ;
  - plus aucune invitation à joindre un Word.
- **Travaux** : une fiche de travaux à créer, faute de ligne de travaux éligible aujourd'hui ; la recette réelle est donc
  différée, comme celle de la charte des travaux. On y vérifiera :
  - le dépôt d'un PDF de plans ;
  - sa présence au retrait ;
  - sa jointure d'office sous `DESCRIPTIF_PLANS` ;
  - le renvoi dans le DAO complet.
- **Front** :
  - le dépôt PDF des travaux reste au bloc B14 ;
  - plus de dépôt en fournitures ;
  - le sigle du nouveau document à l'étape 7.

## Recette du front, 17/10 (backend 7a399ee, front 7555eaf)

**Volet A, fournitures** : fiche 303339, avec l'accord du pilote.
- **Passage en v4** : `POST …/reviser`, puis `PUT …/blocs/B12` avec `B12-BE-01` = « Les fournitures sont neuves, d'origine
  constructeur, livrées dans leur emballage d'origine avec notice en français. », puis `POST …/valider`, sans bloquant.
- **Le besoin** garde ses 12 articles. La v4 produit `DAO_COMPLET` (docx, pdf) et `BORDEREAU_ESTIMATIF`.
- **DAO complet v4**, 98 pages. À la page 61, sous « Spécifications techniques » : « Prescriptions générales applicables à tous
  les articles » en gras, le texte saisi, puis le tableau des 12 articles. Vérifié au texte (PDFBox) et au rendu de la page.
- **Écran** :
  - le champ est au B12, sous l'estimation ;
  - « Enregistrer et continuer » enregistre la liste du besoin, puis les champs du bloc ;
  - le dépôt Word n'est plus proposé en fournitures, puisque le B14 n'est pas servi.

**Deux remarques sur le référentiel** (à la main du backend) : `B12-BE-01` est rangé sous la rubrique « Articles et
caractéristiques exigées, par lot » et porte la mention « sans document » (`documentMaitre = AUCUN`). Or le DAO complet
l'imprime. Une rubrique « Prescriptions générales » et un document maître parlant seraient plus justes.

**Volet B, travaux** : différé, faute de ligne de travaux éligible. L'écran est prêt :
- dépôt PDF au B14, 50 Mo au plus ;
- un Word est refusé ;
- le document s'ouvre par « Ouvrir le PDF » ;
- le sigle `DP` s'affiche à l'étape 7.
