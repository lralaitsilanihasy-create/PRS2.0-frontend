# Demande backend — Générer le DPAO, l'acte d'engagement et le CCAP depuis la fiche (lot 2)

**Date** : 2026-09-23 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : dernière étape annoncée du lot 1,
« Documents · DPAO · AE · CCAP (lot 2) ». Suite de `demande-backend-2026-09-22-fiche-marche-dao.md` (lot 1),
`-23-fiche-marche-dossier.md` (lot 1b) et `-23-type-marche-depuis-le-plan.md` (lot 1c), tous livrés et recettés.

> **Ce lot se livre en deux temps.** **2a** — toute la mécanique (génération, stockage, versions, téléchargement,
> jointure au dossier) avec une **mise en page provisoire dérivée du référentiel**. **2b** — le même contenu coulé
> dans les **modèles Word officiels**, que le pilote doit encore fournir. 2a ne dépend pas de 2b : il produit dès
> maintenant des documents complets et fidèles, lisibles par la Commission. Voir B5.

## Constat (mesuré sur la base locale le 23/09)

La fiche sait **déjà** quel document porte chaque information : le référentiel sert `documentMaitre` et `reprises`
sur chacun de ses 151 champs. Pour un marché à quantité fixe (139 champs ouverts au plus) :

| document | champs dont il est maître | dont repris du PPM | du cadrage | saisis | + informations reprises d'ailleurs |
|---|---|---|---|---|---|
| DPAO — dossier de pré-qualification et d'appel d'offres | 77 | 20 | 8 | 49 | — |
| CCAP — cahier des clauses administratives particulières | 50 | 0 | 3 | 47 | 29 |
| AE — acte d'engagement | 10 | 1 | 1 | 8 | 30 |
| aucun document (donnée de pilotage) | 2 | 2 | 0 | 0 | — |

La composition documentaire est donc **entièrement spécifiée, champ par champ**. Ce qui manque n'est ni la donnée ni
la cartographie : c'est la **fabrication du fichier**.

Or côté serveur, **rien** n'existe : `GET /api/fiches-marche/1/documents` et `GET /api/dmcs/1/documents` renvoient
404. L'étape 7 de l'écran annonce une génération qui n'a pas d'endpoint.

Conséquence concrète, vérifiable sur le plan de test : un dossier de mise en concurrence exige **six pièces
obligatoires** (`GET /api/type-piece-jointes?typeDossier=DMC`) —

| id | pièce | obligatoire |
|---|---|---|
| 6 | Dossier d'appel d'offres complet | oui |
| 7 | Cahier des clauses administratives générales | oui |
| 8 | Cahier des clauses techniques particulières | oui |
| 9 | Avis d'appel d'offres | oui |
| 10 | Estimation du coût des travaux/fournitures | oui |
| 11 | Garantie de soumission | oui |
| 12 | Avis de non-objection (si requis) | non |
| 13 | Rapport d'évaluation des offres | non |

— et la PRMP doit aujourd'hui **les téléverser à la main**, après avoir saisi les mêmes informations dans la fiche.
C'est très exactement la double saisie que la fiche marché devait supprimer.

## Demande

### B1 — La validation de la fiche produit les documents

`POST /api/fiches-marche/{idDmc}/valider` (existant) **génère les documents de la version qu'il fige**, dans la même
transaction. Une version validée sans ses documents n'existe pas : c'est ce couplage qui garantit qu'un document
correspond toujours à un état figé et daté de la fiche, jamais à un brouillon en cours.

- Trois documents en **quantité fixe** : `DPAO`, `CCAP`, `AE`. Le jeu suit `documentMaitre` : si un type de marché
  n'ouvre aucun champ pour un document, ce document n'est pas produit.
- Format **`.docx`**, plus un **PDF** par document (H1 du lot 1 : Word pour le travail, PDF pour la publication).
- Stockage : une table `t_document_fiche_marche` (`idDocument`, `idFiche`, `type`, `extension`, `nomFichier`,
  `tailleOctets`, `empreinte`, `dateGeneration`, contenu ou chemin selon le mode retenu pour
  `t_piece_jointe_dossier`). La clé est **`idFiche`**, pas `idDmc` : c'est la version qui porte ses documents.
- **Échec de génération = échec de la validation** (rollback, 500 nommé). Mieux vaut une fiche restée en brouillon
  qu'une version figée dont les documents manquent, qu'aucun geste ne permettrait de rattraper.

### B2 — Lire et télécharger les documents

- `GET /api/fiches-marche/{idDmc}/documents` → la liste des documents de la **version courante** :
  `[{ idDocument, type, libelle, extension, nomFichier, tailleOctets, dateGeneration, version }]`.
  Version non validée : **liste vide**, pas un 404 — l'écran affiche l'étape, désactivée, avec sa raison.
- `GET /api/fiches-marche/{idDmc}/documents?version={n}` → ceux d'une version figée donnée.
- `GET /api/fiches-marche/documents/{idDocument}/contenu` → le binaire, `Content-Disposition: attachment` et le nom
  de fichier servi tel quel (**le front ne compose pas de nom de fichier**, il n'a pas les règles de nommage de la
  CNM). Même contrat que `GET /api/piece-jointe-dossiers/{id}/contenu`, déjà consommé par l'écran.
- Garde : le périmètre de lecture de la fiche (PRMP et UGPM de l'entité), **plus la Commission** dès que le dossier
  est soumis — sinon le Membre ne peut pas lire ce qu'il doit examiner.

**Nom de fichier proposé** : `DPAO_00001-PPM-AGPM-CNM-2026_302873_v2.docx` — type, référence du plan, ligne,
version. À corriger si la CNM a une règle établie.

### B3 — Les documents rejoignent le dossier soumis

Le lot 1b a fait de la fiche la **productrice du dossier** (`POST /api/fiches-marche/{idDmc}/dossier`). Les documents
générés doivent s'y retrouver **sans geste humain** : une pièce jointe manuelle recréerait la double saisie.

- À la création du dossier par la fiche, **et** à chaque nouvelle validation postérieure, les documents sont
  rattachés au dossier comme pièces jointes, sous le type **6 « Dossier d'appel d'offres complet »**.
- Une pièce jointe ainsi produite est **marquée comme issue de la fiche** (`idDocumentFiche` non nul sur
  `t_piece_jointe_dossier`, ou un booléen `genere`) et **ne peut être ni supprimée ni remplacée à la main** :
  `DELETE /api/piece-jointe-dossiers/{id}` répond 409 avec un message qui renvoie à la fiche. On corrige la fiche,
  pas son produit.
- Les autres pièces obligatoires (CCAG, CCTP, avis d'appel d'offres, estimation, garantie de soumission) restent
  **téléversées à la main** dans ce lot. Elles ne sortent pas de la fiche aujourd'hui.

### B4 — Une nouvelle version régénère, sans effacer l'ancienne

`POST /{idDmc}/reviser` ouvre un brouillon ; sa validation produit **de nouveaux documents**, portés par la nouvelle
`idFiche`. Les documents des versions précédentes **restent lisibles** par `?version={n}` : c'est ce que la
Commission a examiné, et l'écran `/versions-archivees` en dépend déjà pour les PPM.

Sur le dossier, en revanche, ce sont les documents de la **dernière version validée** qui sont joints : les
précédents sont détachés, pas supprimés.

### B5 — Mise en page : gabarit provisoire maintenant, modèles officiels ensuite

Les modèles Word officiels (DPAO, AE, CCAP) ne sont pas encore disponibles. **Ne pas attendre** : le générateur
produit d'abord un document dérivé du référentiel, dont la structure est déjà celle de la fiche —

- un titre par **bloc** (`BlocDto.libelle`, dans l'ordre des rangs),
- un sous-titre par **rubrique**,
- une ligne « **libellé : valeur** » par champ **ouvert par le cadrage** et dont le document est maître ou qui y est
  repris, dans l'ordre des rangs,
- un champ sans valeur est **omis**, jamais rendu vide ni, surtout, sous la forme `null` (cf. l'écart relevé au
  lot 1c sur `B02-LV-03`),
- les montants en chiffres **et en lettres** là où `enLettres` est servi,
- un pied de page : référence du plan, ligne, version de la fiche, date de validation.

Quand les modèles arrivent, **seule la mise en page change** : la sélection des champs, elle, est déjà la bonne.
C'est pourquoi le générateur doit séparer nettement *quelles informations vont dans quel document* (dérivé du
référentiel, stable) de *comment elles sont disposées* (le gabarit, remplaçable).

⚠️ Pièges connus, déjà payés sur les 14 modèles de PV (voir `modeles-pv-officiels`) : `xml:space="preserve"`,
les `<w:t/>` vides, l'ordre des éléments dans un `<w:p>`, et le découpage d'un texte en plusieurs `<w:r>` qui casse
une recherche naïve de marqueur.

### B6 — Le référentiel des types de pièce du DMC est à trancher

Le type 7 s'appelle « Cahier des clauses administratives **générales** ». Le CCAG est un texte réglementaire
national : il ne se produit pas par dossier, il se **référence**. Ce que la fiche produit est un CCA **particulières**,
qui ne figure pas dans la liste. Trois lectures possibles :

1. Le DPAO, l'AE et le CCAP sont **les trois pièces du « Dossier d'appel d'offres complet »** (type 6), et le type 7
   attend bien le CCAG réglementaire, joint tel quel.
2. Le type 7 est mal libellé et désigne en réalité le CCAP.
3. Il faut un type de pièce de plus.

**Le front retient la lecture 1** faute d'arbitrage, et c'est ce que B3 décrit. À corriger en place ici si le pilote
tranche autrement — c'est une question de référentiel métier, pas de code.

## Hypothèses (numérotation poursuivie depuis le lot 1)

| # | Hypothèse retenue | à corriger si |
|---|---|---|
| H8 | Les documents sont produits **à la validation**, jamais à la demande sur un brouillon | la PRMP veut un aperçu avant de figer |
| H9 | `.docx` **et** PDF pour chacun des trois | le PDF suffit, ou arrive au lot suivant |
| H10 | Une pièce jointe produite par la fiche est **non modifiable à la main** | la PRMP doit pouvoir substituer un fichier |
| H11 | Le CCAG et le CCTP restent **téléversés**, ils ne sortent pas de la fiche | le CCTP doit être un bloc de la fiche |
| H12 | L'avis d'appel d'offres (type 9) n'est **pas** produit par ce lot | il se déduit du DPAO et doit être généré aussi |

## Options écartées

- **Générer à la demande, sur le brouillon.** Un document qui ne correspond à aucun état figé circule, est imprimé,
  est discuté — et n'est plus rattachable à rien. La version est ce qui rend un document opposable.
- **Composer le document côté front.** Il faudrait y porter une bibliothèque Word, les règles de nommage et les
  modèles officiels, et le résultat dépendrait du navigateur. Le serveur a déjà tout cela pour les PV.
- **Laisser la PRMP joindre les documents à la main après les avoir téléchargés.** C'est un geste de plus, qu'on
  oublie, et qui autorise l'écart entre la fiche et ce que la Commission lit.

## Tests attendus (recette backend)

1. Validation d'une fiche quantité fixe complète → trois documents, six fichiers (docx + pdf), liés à l'`idFiche`
   figée ; `GET …/documents` les liste.
2. Fiche non validée → `GET …/documents` renvoie **200 et une liste vide**.
3. Un champ fermé par le cadrage (ex. garantie de soumission = NON) → ses informations **n'apparaissent pas** dans
   le DPAO généré.
4. Un champ ouvert mais non saisi → la ligne est **omise** ; le mot `null` n'apparaît nulle part dans le document.
5. `reviser` puis valider → nouveaux documents en version n+1 ; `?version=n` sert toujours les anciens.
6. Dossier produit par la fiche → les documents figurent en pièces jointes de type 6 ; `DELETE` sur l'une d'elles
   répond **409**.
7. Un Membre de la Commission lit les documents d'un dossier soumis ; un Membre d'une autre entité reçoit **403**.
8. Échec provoqué de la génération → la validation est **annulée**, la fiche reste en brouillon.

## Côté front (dès la livraison)

- L'étape 7 « Documents » devient active : la liste des documents de la version courante, leur taille, leur date, et
  le téléchargement par `telechargerBlob` / `ouvrirBlobSur` (jamais `URL.createObjectURL` brut — règle de l'audit).
- Les versions antérieures exposent leurs documents depuis l'onglet des versions figées.
- La carte « Fiche marché » de la page du dossier indique que les pièces du type 6 viennent de la fiche, et pourquoi
  elles ne se suppriment pas là.
