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

### A2 — Plus de Word de spécifications en fournitures

- `PUT /{idDmc}/specifications` est refusé pour une fiche de fournitures et services : **409 `SPECIFICATIONS_HORS_PERIMETRE`**,
  sur le modèle de `PIECES_HORS_PERIMETRE`.
- Le DAO complet n'insère plus de Word en fournitures.
- **Versions déjà validées** : rien ne change, une version figée garde ce qu'elle a produit.
- **Q1** : des fiches de fournitures en base portent-elles un Word de spécifications ? Le front n'en connaît pas depuis la
  réinitialisation du 17/10.

### A3 — Le message B14 en fournitures

- **Avec des articles** : l'information `SPECIFICATIONS_DU_BESOIN` ne parle plus de Word. Elle peut dire « Le DAO complet portera
  le tableau des spécifications tiré du besoin », ou disparaître.
- **Sans article** : l'avertissement demande de saisir le besoin, sans évoquer de Word.

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

### B3 — Le message B14 en travaux

Sans PDF déposé, l'avertissement dit : « Aucun devis descriptif ni plan n'est déposé : la pièce « Descriptif technique et plans
des travaux » manquera au dossier. Déposez-les en PDF. »

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
