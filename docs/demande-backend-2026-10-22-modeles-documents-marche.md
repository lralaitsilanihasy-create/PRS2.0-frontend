# Demande backend — 2026-10-22 — Modèles de documents : le projet de marché et les documents du DAO, rédigés comme les modèles de PV

## Contexte

Le pilote demande d'appliquer **le même principe que les modèles de PV** aux documents des **dossiers de mise en concurrence** (DAO)
et des **dossiers de marché**. Il a validé le principe le 22/10, avec les trois choix proposés par le front :

1. **Le Word est obligatoire** pour ces documents : le candidat et la PRMP les complètent.
2. **Le texte des documents types de l'ARMP peut être modifié**, mais l'écart avec le document type est tracé et affiché, et la mise
   en vigueur exige la validation du juriste.
3. **On commence par le projet de marché**, puis les documents courts du DAO, puis les longs.

Ce que le principe reprend des modèles de PV (V138-V139 et suites) : la page éditée dans l'application, les variables du catalogue,
les passages conditionnels et leurs règles, les listes répétées, les versions (brouillon, en vigueur, remplacée), le rapport de
contrôle, le modèle de départ assemblé par le serveur, l'aperçu sur le dossier d'exemple, la relève automatique avec retour au
producteur d'origine.

État actuel :

| Document | Producteur aujourd'hui | Format |
|---|---|---|
| Projet de marché (art. 60), et projet de contrat-cadre multi-attributaire | `ProjetMarcheService`, texte écrit dans le code (`DocumentLibre`) | Word (POI) et PDF |
| 15 modèles du DAO : `DPAO-F`, `DPAO-T`, `DPAC-CC`, `DPIC-PI`, `AE-F`, `AE-T`, `AE-CC`, `AE-PI`, `CCAP-F`, `CCAP-T`, `CPS-PI`, `AVIS-F`, `AVIS-T`, `LETTRE-PI`, `LETTRE-AOR` | fichiers de commande `resources/modeles/dao/*.txt` (environ 4 000 lignes : `CONDITION`, `{{SI:…}}`, jetons `{{B01-AC-01}}`), tirés des documents types de l'ARMP par les scripts du front (`scripts/modeles-dao`) | Word |
| Pièces fixes : CCAG et IC par catégorie | `resources/modeles/dao-fixes/*.docx`, joints tels quels | Word |

Les pièces fixes restent hors du principe : ce sont des documents de l'ARMP joints sans modification.

## W1 — Prérequis : le Word produit depuis la page

Aujourd'hui une page ne se rend qu'en PDF (OpenHTMLtoPDF ; `FORMAT_INDISPONIBLE` pour le Word). Il faut **un rendu `.docx` de la
page**, fidèle à ce que l'éditeur sait écrire :
- texte et marques (gras, italique, souligné, police, taille, couleur) ; alignements, retraits, interligne, espacements ;
- titres (niveaux 1 à 3) et **numérotation automatique des articles** (arbitrage Q3, voir W2) ; listes ;
- tableaux (largeurs, fusions, fonds, bordures) et ligne répétée ; images (emblème) ;
- en-tête, pied de page, numéro de page et nombre de pages ; sauts de page ;
- passages conditionnels résolus, variables remplies.

Les « …… » d'une donnée inconnue restent dans le Word, pour que la PRMP les complète avant la signature, comme aujourd'hui.

`format=docx` devient permis sur l'aperçu et la production d'une version page, pour les natures qui l'exigent (voir M1). **Le Word et
le PDF sont produits tous les deux** (arbitrage Q4).

> ⚠️ **2026-10-22, livré (backend)**
> - Le Word et le PDF s'écrivent depuis un même document résolu (règles, lignes répétées, variables) : un seul calcul. Comparé en image
>   (Word → PDF) au PDF sur trois documents : mêmes pages, mêmes coupures de ligne.
> - Tout ce que le schéma permet est rendu, fusions de cellules comprises. Listes : la puce ou le numéro sont écrits en tête d'élément
>   (retrait suspendu), sans numérotation Word.
> - `format=docx` est permis pour la nature `PROJET_MARCHE` seulement (et plus tard `DOCUMENT_DAO`) ; un PV ou une lettre garde
>   `FORMAT_INDISPONIBLE`.
> - Les « …… » restent dans le Word, comme demandé.

## W2 — La numérotation automatique des articles (arbitrage Q3)

Un CCAP compte des dizaines d'articles ; les numéroter à la main casse à chaque article ajouté ou retiré. Ajouter au schéma de la page
un **titre numéroté** :
- un attribut sur `heading` (par exemple `numerotation: "ARTICLE"`, avec le gabarit « ARTICLE n : » ou « Article n — ») ;
- le numéro est calculé au rendu (PDF et Word), dans l'ordre du document, **après résolution des passages conditionnels** : un article
  retiré par une règle ne laisse pas de trou ;
- un renvoi interne (« l'article … du CCAP ») peut citer le numéro d'un titre par son identifiant (Q5).

Le front ajoute à l'éditeur le choix « Titre numéroté » et affiche le numéro calculé.

> ⚠️ **2026-10-22, livré (backend)**
> - Sur `heading` : `numerotation` (gabarit qui contient `{n}`, 40 caractères au plus) et `id` (unique dans le document).
> - Un compteur par niveau, remis à zéro sous un titre de niveau supérieur ; les titres sans gabarit ne comptent pas. Le numéro prend
>   les marques du premier texte du titre.
> - **Q5 — Renvoi calculé, livré dès maintenant** : nœud en ligne `renvoi` { cible: id } ; il rend le numéro, ou « …… » quand le titre
>   est retiré par une règle. Le contrôle signale une cible absente (`RENVOI_INCONNU`, bloquant). Le front l'exposera quand il voudra
>   (D3).

## M1 — Le projet de marché comme modèle

- **Une nature nouvelle** `PROJET_MARCHE` pour les modèles (à côté de `PV` et `LETTRE_RENVOI`), avec son catalogue filtré
  (`?nature=PROJET_MARCHE`), comme la lettre de renvoi (L1).
- **Le catalogue** reprend chaque donnée que `ProjetMarcheService` lit aujourd'hui, une variable par donnée (codes proposés) :
  `MARCHE.OBJET`, `MARCHE.NUMERO_AO`, `MARCHE.LOT`, `MARCHE.BASE_LEGALE`, `MARCHE.MONTANT_HT`, `MARCHE.MONTANT_HT|lettres`,
  `MARCHE.MONTANT_TTC`, `MARCHE.DELAI`, `MARCHE.SANCTION_RETARD`, `MARCHE.COMPTABLE`, `MARCHE.IMPUTATION`, `MARCHE.DOMICILIATION`,
  `MARCHE.INDEMNITE_RESILIATION`, `MARCHE.DATE_NOTIFICATION`, `AC.ENTITE`, `AC.MINISTERE`, `AC.SIGNATAIRE`, `TITULAIRE.RAISON_SOCIALE`,
  `TITULAIRE.NIF`, `TITULAIRE.ADRESSE`, `TITULAIRE.REPRESENTANT`, `TITULAIRE.OFFRE_NUMERO`, et une **liste répétée** `TITULAIRES`
  pour le contrat-cadre. Chaque variable porte son exemple, pour l'aperçu sur le dossier d'exemple.
- **Une donnée inconnue** rend « …… » (la constante `A_COMPLETER`), et non une chaîne vide : c'est la règle de l'art. 60 actuelle.
- **Les règles** : `CONTRAT_CADRE` (plusieurs titulaires), `PI` (« la proposition » au lieu de « l'offre »), `INTERNATIONAL` (article
  « Droit applicable »), `RECEPTION_PAR_TRANCHES`, `ALLOTI`.
- **Le modèle de départ** : une page assemblée d'après le texte actuel de `ProjetMarcheService` (les deux variantes dans une seule page,
  séparées par `CONTRAT_CADRE`), recopié mot pour mot.
- **La relève** : un modèle `PROJET_MARCHE` en vigueur produit le projet à la place de `ProjetMarcheService` ; archivé ou sans version
  en vigueur, retour au code actuel (même règle que la relève du plan).
- **Le rattachement : un modèle par catégorie** (arbitrage Q1 du pilote) — fournitures et services, travaux, prestations
  intellectuelles. Le projet d'une procédure est produit par le modèle en vigueur de sa catégorie ; une catégorie sans modèle en vigueur
  garde le code actuel. Le départ se génère pour la catégorie choisie (texte actuel, où « la proposition » remplace « l'offre » en PI).

> ⚠️ **2026-10-22, livré (backend), avec des écarts**
> - **Codes** : ceux proposés, plus `MARCHE.ORIGINAL_AE` (l'original de l'acte d'engagement d'une offre en ligne),
>   `MARCHE.NB_TITULAIRES`, `MARCHE.PROCEDURE` et `MARCHE.LOT_NUMERO` (pied de page). Les variables du contrat-cadre sont dans la
>   liste `TITULAIRES` (`TIT.CANDIDAT`, `TIT.NIF`, `TIT.ADRESSE`, `TIT.REPRESENTANT`, `TIT.OFFRE_NUMERO`, `TIT.MONTANT_HT`,
>   `TIT.DELAI`).
> - **Les `MARCHE.*` du PV** (`ESTIMATION`, `ECART`, `DOSSIER_MEC`) restent au PV : la nature d'une variable n'est plus lue sur
>   son préfixe, elle est déclarée au catalogue.
> - **« …… »** : chaque variable porte le texte exact du code. Exemples : « …… (montant hors taxes) » se trouve dans la page, et
>   « …… (acte de nomination) » dans `AC.SIGNATAIRE`. Un fragment que le code omet (ministère, adresse, numéro, montant TTC,
>   indemnité) est sous une règle `… renseigne`.
> - **Règles** : les clés `contratCadre`, `pi`, `international`, `receptionParTranches` et `alloti` sont au catalogue. Le
>   départ en déclare 21, dont `SIMPLE` / `CONTRAT_CADRE`.
> - **Répéter des paragraphes** : un nœud nouveau, `repetition` { liste } (un paragraphe par titulaire), à ajouter à l'éditeur. Dans une
>   répétition, une règle lit l'élément courant (`TIT.ADRESSE renseigne`).
> - **Le départ est mot pour mot** : un test compare le texte rendu par la page à celui du code sur trois variantes (marché complet, PI
>   sans données, contrat-cadre à deux titulaires), pied de page compris. Seule la mise en forme change : Arial 10, interligne 1,3,
>   proche du PDF actuel (Helvetica).
> - **Rattachement** : `PUT …/rattachements` { categories: [...] } ; la fiche et la liste servent `categories`. Une catégorie, un
>   modèle (409 `CATEGORIE_DEJA_SERVIE`). La catégorie d'une procédure est celle de sa fiche validée.
> - **Départ** : `POST …/versions/depart` { categorie } (à défaut la seule rattachée ; 400 `CATEGORIE_REQUISE`).
> - **Aperçu** : `exemple=true`, ou `procedure=40&lot=1` pour la contre-recette, en PDF ou en Word. Un dossier n'est pas permis
>   (400 `PROCEDURE_OU_EXEMPLE`).
> - **Relève** : le projet est produit par le modèle en vigueur de la catégorie à la création du dossier de marché et à la régénération.
>   Un projet déjà produit ne change pas. Archivé ou sans version en vigueur, le projet revient au code ; journal général comme pour le
>   plan.
> - Hors périmètre : un modèle intégré « projet de marché » n'est pas ajouté à `/integres` ni à `/couverture` (le texte du code n'est
>   pas un fichier) ; à demander si l'écran doit le montrer.

## D — Les documents du DAO (lots suivants, à confirmer après M1)

- **Une nature `DOCUMENT_DAO`**, un modèle par sigle (les 15 ci-dessus), le sigle servant de rattachement (le DAO choisit déjà le
  document par catégorie et par forme : `documentEffectif`).
- **Le catalogue** : les champs de la fiche DAO par catégorie (fournitures 139, travaux 162, PI 111), les clés de cadrage
  (`alloti`, `groupement`, `typeMarche`, `typePrix`, `avance`, `provenance`…), les dérivés (`{{DERIVE.…}}`), le lot ; et les formats
  `.lettres` / `.chiffres` déjà en usage.
- **Le modèle de départ** : conversion mécanique des fichiers de commande actuels — `CONDITION` → règle déclarée, `{{SI:NOM}}` …
  `{{FINSI:NOM}}` → passage conditionnel, jeton → variable, `PARA` / `CENTRE` / `TITRE` → paragraphe et style. Ce qui reste entre
  chevrons (à compléter par le candidat) reste du texte.
- **La conformité ARMP** (choix 2 du pilote) :
  - le serveur garde, pour chaque modèle, le **texte du document type** (la source tirée par les scripts du front) ;
  - le rapport de contrôle d'une version liste **les écarts** avec ce texte (paragraphes modifiés, ajoutés, retirés), sans les bloquer ;
  - la **mise en vigueur** d'une version qui s'écarte du document type exige une **validation du juriste** : nom, date, motif,
    enregistrés avec la version et repris au journal (Q2).
- **Ordre** : D1 avis et lettres d'invitation (`AVIS-F`, `AVIS-T`, `LETTRE-PI`, `LETTRE-AOR`) ; D2 actes d'engagement ; D3 DPAO,
  DPAC, DPIC, CCAP, CPS.

## Questions

- **Q1 — Rattachement du projet de marché.** Un seul modèle pour tous les projets de marché (proposé), ou un par catégorie
  (fournitures, travaux, PI) ?
- **Q2 — Le juriste.** Il n'y a pas de profil « juriste » dans l'application. Le front propose que l'Administrateur saisisse, à la mise
  en vigueur, le nom du juriste qui a validé, la date et le motif (déclaration tracée). Ou faut-il un profil, ou une validation par un
  autre profil existant ?
- **Q3 — La numérotation des articles.** L'éditeur ne numérote pas automatiquement (« Article 1 — Objet » est écrit en toutes lettres).
  Suffit-il pour le projet de marché ? Pour un CCAP, une numérotation automatique (« ARTICLE n : ») serait-elle à ajouter au schéma ?
- **Q4 — Le Word et le PDF.** Faut-il produire les deux (proposé), ou le Word seul pour le dossier, le PDF ne servant qu'à l'aperçu ?

> ⚠️ **2026-10-22, arbitrages du pilote**
> - **Q1 — Un modèle par catégorie** : fournitures et services, travaux, prestations intellectuelles (M1 corrigé en conséquence).
> - **Q2 — Selon la recommandation du front** : l'Administrateur saisit, à la mise en vigueur d'une version qui s'écarte du document
>   type, le nom et la qualité du juriste qui a validé, la date et le motif ; le tout est enregistré avec la version et repris au
>   journal. Pas de profil nouveau.
> - **Q3 — Oui** : numérotation automatique des articles (W2).
> - **Q4 — Le Word et le PDF**, tous les deux.

Question restante, pour le backend :
- **Q5 — Les renvois internes.** Un renvoi « l'article … du CCAP » doit-il citer le numéro calculé d'un titre numéroté (W2), ou reste-t-il
  écrit à la main ? Le front propose le renvoi calculé pour D3 seulement.

> ⚠️ **2026-10-22, réponse (backend)**
> - **Q5** : renvoi calculé, livré avec W2 (nœud `renvoi`), pour que D3 n'ait plus qu'à l'employer.
> - **D1 à D3** : non livrés. À confirmer par une demande après la contre-recette de M1.

## Lots

| Lot | Contenu |
|---|---|
| W1 | Le Word produit depuis la page (prérequis) |
| W2 | La numérotation automatique des articles |
| M1 | Le projet de marché comme modèle : nature, catalogue, règles, départ, relève |
| D1 | Avis et lettres d'invitation du DAO, avec la conformité ARMP |
| D2 | Actes d'engagement |
| D3 | DPAO, DPAC, DPIC, CCAP, CPS |

## Côté front

- La page « Modèles de procès-verbaux » devient **« Modèles de documents »**, en trois onglets : « PV d'examen », « Dossier de mise
  en concurrence », « Dossier de marché » (maquette : `docs/maquette-2026-10-22-modeles-documents.html`).
- La fiche d'un modèle reste la même (versions, éditeur, règles, champs, aperçu) ; un modèle qui exige le Word affiche « Word et PDF »
  et l'aperçu propose les deux.
- Pour un document du DAO : un panneau « Écarts avec le document type de l'ARMP » dans l'onglet de contrôle, et la saisie de la
  validation du juriste à la mise en vigueur.
- À la livraison de M1 : contre-recette sur le projet de marché de la procédure 40 (lot 1), comparé au document produit aujourd'hui.
