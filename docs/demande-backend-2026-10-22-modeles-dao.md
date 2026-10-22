# Demande backend — 2026-10-22 — Modèles de documents : les documents du DAO, à partir des modèles intégrés (lots D1 à D3)

## Contexte

Suite de `demande-backend-2026-10-22-modeles-documents-marche.md`. Le backend a livré W1, W2 et M1, et attendait **la confirmation des
lots D1 à D3 après la contre-recette de M1**.

**La contre-recette de M1 est faite (front, 22/10)** :
- un modèle de projet de marché créé depuis l'onglet « Dossier de marché » ; départ sans blocage, 15 titres numérotés, 3 répétitions ;
- l'éditeur ouvre et réenregistre la page sans la modifier (front 14f4cc4 : `trailingNode` coupé) ;
- aperçu sur l'exemple, et sur la procédure 3, lot 1 (contrat-cadre à 3 titulaires), en PDF et en Word : articles 1 à 5 numérotés, une
  ligne par titulaire, « …… » pour les données inconnues ;
- les procédures 1, 2 et 40 répondent « L'évaluation de cette procédure n'est pas ouverte » (base de recette) : la 3 a servi.

Les trois modèles réels sont créés, en brouillon et sans blocage : `PROJET-MARCHE-F` (id 35), `PROJET-MARCHE-T` (36),
`PROJET-MARCHE-PI` (37). Aucun n'est en vigueur.

**Le pilote confirme D1 à D3 (22/10)**, avec cette précision : **les modèles intégrés du DAO servent de modèle de départ.** Les
15 fichiers de commande (`resources/modeles/dao/*.txt`), choisis aujourd'hui par `ModelesDao.COUVERTURES` (type de document × forme ×
catégorie), `ModelesDao.AVIS` et `ModelesDao.LETTRES`, deviennent chacun le départ d'un modèle modifiable.

Les arbitrages de la demande précédente restent : Word et PDF ; texte de l'ARMP modifiable, écarts tracés, validation du juriste
saisie par l'Administrateur (nom et qualité, date, motif) à la mise en vigueur d'une version qui s'écarte du document type.

## D0 — Les documents intégrés du DAO, listés

Comme `/integres` pour le PV du plan et la lettre de renvoi, servir les 15 documents du DAO avec ce que l'écran doit montrer :
- le **sigle** (`DPAO-F`…), le **libellé** (« Données particulières de l'appel d'offres — fournitures et services »), le **type de
  document** (`DPAO`, `DPAC`, `DPIC`, `AE`, `CCAP`, `AVIS`, `LETTRE`) et la **catégorie** ;
- les **formes** et **modes** qu'il sert (les lignes de `COUVERTURES`, `AVIS`, `LETTRES` qui le choisissent) ;
- `enService` : `false` dès qu'un modèle de l'application en vigueur le relève pour toutes ses couvertures ;
- la consultation du texte intégré (le fichier Word du décalque) et son aperçu sur une procédure et un lot, en Word et en PDF.

Une route dédiée (`GET /api/modeles-pv/integres?nature=DOCUMENT_DAO`) ou l'extension de `/integres` : au choix du backend.

> ⚠️ **2026-10-22, livré (backend) — routes dédiées**
> - `GET /api/modeles-pv/integres/dao` : les 15, avec `sigle`, `libelle`, `typeDocument` (DPAO, DPAC, DPIC, AE, CCAP, AVIS,
>   LETTRE), `categories`, `couvertures` (`typeMarche` ; `categorie` ; `mode` : `OUVERT` pour l'avis, `RESTREINT` pour
>   LETTRE-AOR, nul sinon), `enService` et `modeleRattache`.
> - **Consultation** : les fichiers Word du décalque ne sont pas dans le backend (seuls les fichiers de commande le sont).
>   `GET /integres/dao/{sigle}/fichier?format=pdf|docx` sert donc le **rendu brut** du fichier, jetons visibles.
> - **Aperçu de l'intégré** : `POST /integres/dao/{sigle}/apercu?procedure=&lot=&format=`, sur la fiche validée de la procédure ; 404
>   sans fiche validée.

## D1 à D3 — Le modèle de départ, d'après le document intégré

- **Une nature `DOCUMENT_DAO`**, et **un modèle par sigle** : le sigle est le rattachement (`PUT …/rattachements { sigles: [...] }`,
  409 si un sigle est déjà servi). Un modèle sert toutes les couvertures de son sigle, comme le fichier intégré aujourd'hui.
- **Le départ** (`POST …/versions/depart { sigle }`) convertit le fichier de commande :
  - `CONDITION NOM<US>expression` → règle déclarée, avec la même expression ;
  - `{{SI:NOM}}` … `{{FINSI:NOM}}` → passage conditionnel (en bloc ou en ligne, comme le fichier) ;
  - `{{CODE}}`, `{{CODE.lettres}}`, `{{CODE.chiffres}}`, `{{LOT}}`, `{{DERIVE.…}}` → variables du catalogue, avec leur format ;
  - `TITRE`, `CENTRE`, `PARA`, les tableaux et la numérotation « ARTICLE n : » → titres (numérotés par W2), paragraphes, tableaux ;
  - ce qui reste entre chevrons (à compléter par le candidat, ou à la notification) reste du texte.
- **Le départ ne s'écarte pas du document type** : il est la référence des écarts (D-ARMP).
- **Le catalogue** `?nature=DOCUMENT_DAO&sigle=…` : les champs de la fiche DAO de la catégorie, les clés de cadrage (`alloti`,
  `groupement`, `typeMarche`, `typePrix`, `avance`, `provenance`…), les dérivés et le lot.
- **L'aperçu** : `exemple=true`, ou `procedure=&lot=`, en Word et en PDF (comme M1).
- **La relève** : un modèle en vigueur produit le document de son sigle à la place du fichier intégré (`DaoCompletService`), pour toute
  couverture qui le choisit ; archivé, détaché ou sans version en vigueur, retour au fichier intégré. Journal général comme pour le plan.
- **Les pièces fixes** (CCAG et IC, `modeles/dao-fixes`) restent hors du principe.

> ⚠️ **2026-10-22, livré (backend) pour les 15 sigles à la fois, avec un choix d'architecture**
> - **La page est une vue modifiable du fichier de commande.** La production garde le moteur du DAO : un modèle en vigueur est
>   reconverti en fichier de commande, puis rendu exactement comme l'intégré. Les Word produits restent donc ceux que juge
>   `verifier.mjs`. La conversion est sans perte : un test fait l'aller-retour sur les 15 fichiers.
> - **Correspondances** :
>
>   | Fichier de commande | Page |
>   |---|---|
>   | `TITRE` | titre 1 centré |
>   | `SOUS_TITRE` | titre 2 |
>   | `PARA` | paragraphe justifié |
>   | `CENTRE`, `DROITE` | paragraphe centré, à droite |
>   | `VIDE` | paragraphe vide, sans réglage |
>   | `PARA {{SI:X}}` … `{{FINSI:X}}` | passage (bloc) |
>   | tableaux | tableaux |
>   | jetons | variables : le code garde son suffixe (`B05-GS-03.lettres`) ; les codes admettent le tiret |
>
>   `{{IMAGE:embleme}}` et les marqueurs de plage dans les cellules restent du texte.
> - **Limite, signalée par le contrôle** : ce que le moteur ne sait pas rendre est un **avertissement**
>   `MISE_EN_FORME_NON_RENDUE`, avec le lieu :
>   - gras et police dans le texte ;
>   - listes, images de la bibliothèque ;
>   - retraits, fonds et fusions ;
>   - titres numérotés, renvois, en-tête et pied.
>
>   Un passage en ligne est **bloquant** (`PASSAGE_EN_LIGNE`), car son texte serait toujours imprimé. L'éditeur peut donc offrir
>   moins d'outils pour cette nature.
> - **Numérotation** : le départ garde les « ARTICLE n : » écrits en clair, comme le document type. La numérotation W2 et les renvois ne
>   sont pas rendus par le moteur du DAO. On peut les y ajouter sur demande, mais ils changeraient des numéros fixés par l'ARMP.
> - **Le départ** : `POST …/versions/depart` (sigle rattaché, ou `{ sigle }`).
>   - Les 15 départs n'ont aucun point bloquant ni avertissement, et sont `CONFORME_ARMP`.
>   - Le motif « texte à faire valider » est posé comme pour les autres départs.
> - **Catalogue** `?nature=DOCUMENT_DAO&sigle=` :
>   - les champs actifs de la fiche, par rubrique ;
>   - les jetons du moteur, tels que les fichiers les emploient ;
>   - `formats` (`.lettres`, `.chiffres`, `.doublet`, `.heure`, `.heureLocale`, `.parLot`, `.lignesParLot`) ;
>   - `cles` : les clés que lisent les règles des fichiers.
>
>   Une règle d'un document du DAO peut lire toute clé : le moteur la résout.
> - **Aperçu d'une version** :
>   - `exemple=true` : le rendu brut, car il n'y a pas de fiche fictive du DAO ;
>   - `procedure=&lot=` : la fiche validée, rendue comme en production.
> - **Relève** : les six points de production (documents à la validation, avis, lettres, projets de publication, relecture des
>   mentions) prennent la version en vigueur du sigle, sinon le fichier intégré. Le journal général est tenu comme pour le plan.
>   L'import d'un DAO (lecture par modèle inversé) garde les fichiers intégrés.

## D-ARMP — Les écarts au document type et la validation du juriste

- Le **texte de référence** d'un sigle est son départ (le fichier intégré converti).
- Le **rapport de contrôle** d'une version liste ses écarts avec cette référence — paragraphe modifié (avant / après), ajouté, retiré —
  au niveau `INFO`, sans bloquer l'enregistrement.
- **La mise en vigueur** d'une version qui a au moins un écart exige `{ juriste: { nom, qualite, date }, motif }` : 400
  `VALIDATION_JURISTE_REQUISE` sinon. Le tout est enregistré avec la version, servi par la fiche, et repris au journal.

> ⚠️ **2026-10-22, livré (backend)**
> - Un niveau de point nouveau, **`INFO`**, qui ne compte ni dans les bloquants ni dans les avertissements :
>   - `CONFORME_ARMP` (OK) quand il n'y a aucun écart ;
>   - sinon `ECARTS_ARMP` (le nombre), puis un `ECART_ARMP` par écart (« Modifié — avant : « … » ; après : « … » », lieu
>     « ligne n »).
> - `GET …/versions/{n}/ecarts` → `[{ type: MODIFIE | AJOUTE | RETIRE, rang, avant, apres }]`, pour le panneau. La comparaison se
>   fait ligne à ligne sur le fichier de commande reconstruit, règles déclarées comprises. Une ligne s'écrit « [TITRE] texte »,
>   « [PARA] texte », « Règle NOM : expression ».
> - **Mise en vigueur** : `{ motif, juriste: { nom, qualite, date } }`. Le juriste est exigé dès qu'il y a un écart (400
>   `VALIDATION_JURISTE_REQUISE`, `details.nbEcarts`). Il est servi par la version (`versions[].juriste`) et repris au journal
>   (« n écart(s) au document type validé(s) par … »).
> - Sans sigle rattaché, les écarts ne se calculent pas (`SANS_SIGLE`, avertissement). Un modèle ne sert qu'un sigle
>   (`UN_SEUL_SIGLE`).

## Ordre

| Lot | Sigles |
|---|---|
| D0 | La liste des 15 documents intégrés, leur consultation et leur aperçu |
| D1 | `AVIS-F`, `AVIS-T`, `LETTRE-PI`, `LETTRE-AOR` — avec D-ARMP |
| D2 | `AE-F`, `AE-T`, `AE-CC`, `AE-PI` |
| D3 | `DPAO-F`, `DPAO-T`, `DPAC-CC`, `DPIC-PI`, `CCAP-F`, `CCAP-T`, `CPS-PI` (renvois calculés, nœud `renvoi`) |

## Questions

- **Q1 — Le rattachement par sigle.** Un modèle par sigle (proposé) convient-il, ou faut-il pouvoir servir une seule forme (quantité
  fixe ou à commande) d'un sigle ?
- **Q2 — La référence des écarts.** Le départ converti (proposé), ou le texte source de l'ARMP (`scripts/modeles-dao/sources`) ?
- **Q3 — Les écarts déjà présents.** Les fichiers intégrés portent des adaptations déclarées (`adapte`, `renvoi`, `ajouts` dans
  `modeles/<sigle>.json`, par exemple la liste de pièces du DAO travaux du MEN). Elles font partie du départ et ne comptent pas comme
  écarts ; faut-il néanmoins les montrer, pour mémoire ?

> ⚠️ **2026-10-22, réponses (backend)**
> - **Q1 — Un modèle par sigle** : il sert toutes les couvertures du sigle ; les formes sont déjà des règles du fichier
>   (`typeMarche`).
> - **Q2 — La référence est le départ**, c'est-à-dire le fichier intégré. Les sources de l'ARMP sont dans le dépôt front.
> - **Q3 — Non montrées** : les adaptations font partie du départ et ne sont pas des écarts. Les fichiers `modeles/<sigle>.json` sont
>   dans le dépôt front ; les copier dans le backend serait une demande à part.
> - **Ordre** : D0 à D3 livrés ensemble, car le mécanisme est le même pour les 15.

## Côté front

- L'onglet « Dossier de mise en concurrence » liste les 15 documents (D0), par catégorie, avec leur état : « Document intégré », « À
  rédiger / À valider », « En vigueur », et « Conforme ARMP » ou « n écarts · validés ».
- « Créer » sur un document intégré : un modèle `DOCUMENT_DAO` rattaché à son sigle, puis sa fiche, d'où l'on génère le départ.
- La fiche : l'éditeur et l'aperçu comme pour le projet de marché ; dans l'onglet de contrôle, un panneau « Écarts avec le document type
  de l'ARMP » ; à la mise en vigueur, la saisie du juriste quand la version s'écarte (maquette du 22/10).
