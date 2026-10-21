# Demande backend — 2026-10-21 — Modèles de PV : la page éditée dans l'application (option C')

## Contexte et décisions du pilote

Le pilote veut que l'Administrateur modifie **le texte et la mise en page** d'un modèle de PV **sans Word**. Trois options lui ont été
présentées le 21/10 :
- **A** : un éditeur des seuls paragraphes du Word ;
- **C** : une conversion Word ↔ page web, qui abîme la mise en page ;
- **C'** : le modèle devient une page construite dans l'application.

Il a retenu **C'**, sur la maquette `docs/maquette-2026-10-21-editeur-modele-pv.html` : le PV de mise en concurrence sur une feuille
A4, éditable, avec ses étiquettes et ses cadres conditionnels, et un aperçu rempli.

Les décisions du 21/10 :
1. **Un PV produit depuis une page reconstruite est acceptable.** Ce n'est plus le fichier Word officiel, mais sa reconstruction.
2. **Pas de coexistence.** L'Administrateur ne dépose plus de Word : tout modèle géré est une page.
   - Nuance, pour qu'aucun PV ne perde son document : les fichiers Word **intégrés** (plan : 12, lettre de renvoi : 2) continuent de
     produire jusqu'à ce que leur page de remplacement soit validée sur des dossiers réels, puis sont retirés.
   - C'est une relève, pas une coexistence côté Administrateur.
3. **Le PDF suffit.** Il n'y a plus d'export Word. Le PDF est ce qui se signe et s'archive.

**Ce qui reste valable** de G1 et des lots suivants :
- le catalogue des variables, les conditions (`ConditionsModele`) et les champs saisis ;
- les versions (brouillon, en vigueur, remplacée), la mise en vigueur avec motif et l'historique ;
- les rattachements, `/integres` et `/couverture` ;
- l'aperçu sur un dossier réel, sans rien enregistrer ;
- le formulaire du membre (G3) et la production (G2).

**Ce qui change** : le **support** d'une version, et donc le contrôle et le rendu. Le dépôt d'un `.docx` et le modèle de départ en Word
sont à remplacer.

## B1 — Le support d'une version : un document structuré, pas du HTML libre

Proposition : la version porte un **document JSON**, celui de l'éditeur (Tiptap / ProseMirror). Ses types de nœuds sont **fermés** :
- le serveur le valide, le contrôle et le rend sans jamais interpréter de HTML venu du navigateur, donc sans risque d'injection ;
- le contrôle (variables connues, blocs déclarés, listes bien placées) se fait sur des nœuds typés, pas sur du texte.

| Nœud | Attributs | Rôle |
|---|---|---|
| `doc` | — | la racine : `entete?`, `corps`, `piedDePage?` |
| `page` (réglages) | format `A4`, orientation, marges en mm | une seule fois par version |
| `paragraph` | alignement (gauche, centre, droite, justifié), retrait, espacements | |
| `heading` | niveau 1 à 3 | facultatif |
| `text` + marques | `bold`, `italic`, `underline`, `fontFamily`, `fontSize`, `color` (liste fermée) | |
| `bulletList`, `orderedList`, `listItem` | | |
| `table`, `tableRow`, `tableCell` | `colspan`, `rowspan`, largeur de colonne, bordures oui/non, fond (liste fermée) | |
| `image` | `idImage` (voir B3), largeur, alignement | l'emblème, un logo |
| `pageBreak` | | saut de page |
| **`variable`** | `code` (au catalogue), `format?` (`long`, `court`, `lettres`, `majuscules`, `minuscules`) | ex-`{{CODE\|format}}` |
| **`champ`** | `code` (un champ saisi déclaré) | ex-`{{SAISI:code}}` |
| **`bloc`** | `condition` (un nom déclaré) ; contenu : des nœuds de corps | ex-`{{SI:NOM}}…{{FINSI:NOM}}`, sur plusieurs paragraphes ou tableaux |
| **`tableRow` répétée** | `liste` (`OBSERVATIONS`, `TITULAIRES`) | ex-`{{POUR:LISTE}}` ; ses `variable` sont du préfixe de la liste (`OBS.*`, `TIT.*`) |
| `numeroPage`, `nombrePages` | | facultatif : « Page 2 / 3 » au pied de page |

- **En-tête et pied de page** : un en-tête répété sur chaque page (ou sur la première seulement : attribut) et un pied de page.
- **Taille** : 2 Mo au plus par document, sans image ; les images sont à part (B3).
- **Le schéma** est commun au front et au serveur. Le front l'écrit dans l'éditeur ; le serveur le publie avec la version, ou dans la
  documentation.

> ⚠️ **2026-10-21, livré (backend), avec cinq précisions sur le format**
> - **L'enveloppe** : `{ page?, entete?, enteteSurPremiereSeulement?, corps, piedDePage? }`. Les trois zones sont chacune un `doc`
>   Tiptap tel quel : `{ type: "doc", content: [...] }`. Les nœuds gardent la forme native de Tiptap : `type`, `attrs`, `content`,
>   `marks`, `text`.
> - **Les noms d'attributs** :
>   - `paragraph` / `heading` : `textAlign` (`left`, `center`, `right`, `justify`), `retrait`, `retraitDroite` et
>     `retraitPremiereLigne` en mm, `espaceAvant` et `espaceApres` en points, `interligne` ;
>   - `table` : `bordures` (défaut vrai), `retrait` en mm, `largeur` en % ;
>   - `tableCell` / `tableHeader` : `colspan`, `rowspan`, `colwidth` (les pixels de Tiptap, lus comme des proportions), `fond`,
>     `alignementVertical` (`haut`, `milieu`, `bas`), `bordures` ;
>   - `image` : `idImage`, `largeur` en mm, `alignement` ;
>   - les marques de police sont **`textStyle`** avec `fontFamily`, `fontSize` (`12` ou `"12pt"`) et `color`, comme les
>     extensions Tiptap.
> - **`page`** porte aussi `police` et `taille` par défaut. Le modèle de départ s'en sert : Arial 10.
> - **Un bloc en ligne** : `bloc` peut aussi se trouver dans un paragraphe, avec un contenu en ligne. Le départ en a besoin pour
>   « Commission {Centrale | Régionale} ». L'attribut `enLigne` est accepté mais pas nécessaire : la place du nœud suffit.
> - **Marques sur les nœuds métier** : une `variable` ou un `champ` portent des `marks` comme un texte (un `{{OBS.LIRE}}` en
>   gras).
>
> Deux règles de validation :
> - **un attribut inconnu de valeur nulle est toléré**, parce que Tiptap écrit les valeurs par défaut ; s'il a une valeur, il est
>   refusé ;
> - **le schéma est publié** par `GET /api/modeles-pv/schema` : nœuds, attributs, polices, couleurs (7), fonds (5), formats et
>   limites (2 Mo, 40 niveaux, 50 000 nœuds).

## B2 — Les routes

| Route | Effet |
|---|---|
| `POST /api/modeles-pv/{id}/versions` | **corps JSON** `{ document, motif? }` au lieu du multipart : une version en `BROUILLON`, avec son `rapport` (B4) ; 400 `DOCUMENT_INVALIDE` (`details` : chemin du nœud fautif → raison) ; 409 `MODELE_ARCHIVE` |
| `GET /api/modeles-pv/{id}/versions/{n}` | renvoie aussi le `document` |
| `PUT /api/modeles-pv/{id}/versions/{n}/document` | sur un **brouillon** seulement : remplace le document, recalcule le rapport (409 `VERSION_FIGEE` sinon). L'éditeur enregistre ainsi sans multiplier les versions ; « Enregistrer une nouvelle version » reste le `POST` |
| `POST …/versions/{n}/apercu?dossier=&avis=` | inchangé, **PDF seul** (`format` retiré) |
| `POST /api/modeles-pv/{id}/versions/depart` | inchangé dans son principe : produit un **document** (B5) au lieu d'un `.docx` |
| `GET …/versions/{n}/fichier` | sur une ancienne version Word seulement (consultation) ; une version page n'a pas de fichier |
| **retiré** | le dépôt multipart d'un `.docx` |

Conditions, champs, mise en vigueur, rattachements, archivage, duplication, `/variables`, `/integres` et `/couverture` sont
**inchangés**.

> ⚠️ **2026-10-21, livré (backend) tel que demandé, avec quatre ajouts**
> - **409 `SUPPORT_ABANDONNE`** pour un dépôt multipart sur `POST …/versions`, plutôt qu'un 415 muet.
> - **409 `VERSION_SANS_FICHIER`** pour `GET …/fichier` sur une page.
> - **400 `FORMAT_INDISPONIBLE`** pour `format=docx` sur une page. Une ancienne version Word garde ses deux formats d'aperçu.
> - **Journal** : `ENREGISTREE` (POST) et `DOCUMENT_MODIFIE` (PUT).
>
> `support` (`WORD` / `PAGE`) et `document` sont servis par `GET …/versions/{n}` et par les gestes qui produisent ou modifient
> une version. La fiche du modèle ne sert pas les documents (`document: null`), pour rester légère.

## B3 — Les images

- `POST /api/modeles-pv/images` : multipart `fichier`, PNG ou JPEG, 2 Mo au plus. Le contrôle se fait par le contenu, pas par le type
  déclaré, comme pour les actualités. Retour `{ idImage, largeur, hauteur }`.
- `GET /api/modeles-pv/images/{idImage}` : l'image, servie avec son type contrôlé.
- **Le front reprend l'emblème** des PV officiels (`word/media/image1.png`) comme première image : pas besoin de le redéposer.

> ⚠️ **2026-10-21, livré (backend) — écart sur l'emblème.** L'emblème n'est pas à reprendre par le front : le serveur le sert.
> - **`GET /api/modeles-pv/images/embleme`** rend `{ idImage, largeur, hauteur, type, code: "EMBLEME" }`. L'image est extraite de
>   `PV_AFSR_PPM_CENTRALE.docx` et créée au premier appel, avec un identifiant stable ensuite.
> - Le dépôt rend aussi `type` (le type contrôlé) et `code` (nul pour une image déposée).
> - `GET …/images/{idImage}` sert l'image avec `X-Content-Type-Options: nosniff`.
> - Une `image` dont l'`idImage` n'existe pas rend le document invalide (`DOCUMENT_INVALIDE`).

## B4 — Le contrôle d'une version

Ce sont les mêmes points qu'aujourd'hui, appliqués aux nœuds. Le champ `ou` donne le **chemin** du nœud (« corps › paragraphe 12 »,
« corps › tableau 2 › ligne 1 › cellule 1 »), pour que l'écran puisse y amener le curseur.

| Niveau | Contrôle |
|---|---|
| Bloquant | `VARIABLE_INCONNUE` (avec suggestion), `FORMAT_INCONNU`, `CHAMP_NON_DECLARE`, `CONDITION_NON_DECLAREE`, `LISTE_INCONNUE`, `VARIABLE_HORS_LISTE`, `POUR_MAL_PLACE` (une ligne répétée hors d'un tableau, ou deux listes imbriquées), `SECTION_ABSENTE` (PV : `PV.REFERENCE`, `PV.MEMBRE`, et l'avis ou un bloc qui lit l'avis), `ESSAI_ECHEC` (le rendu PDF d'essai échoue) |
| Avertissement | `CONDITION_INUTILISEE`, `CHAMP_INUTILISE` |
| Retiré | `FICHIER_ILLISIBLE`, `MARQUEUR_COUPE`, `BLOC_MAL_FERME`, `BLOC_NON_FERME`, `ANCIEN_MARQUEUR`, `IMAGE_NON_PRISE_EN_CHARGE` : ils n'ont plus de sens, un nœud ne se coupe pas |

« Déclarer ce que le Word utilise » devient « Déclarer ce que la page utilise ». Le front s'en charge à partir de
`rapport.conditionsUtilisees` et `rapport.champsUtilises`, qui sont inchangés.

> ⚠️ **2026-10-21, livré (backend), avec quatre précisions**
> - **`chemin`** : chaque point du rapport porte un champ nouveau, `chemin`. Ce sont les rangs du nœud dans les `content` depuis sa
>   zone (`corps/1/1` : 2e nœud du corps, puis son 2e enfant). Le front y amène le curseur sans avoir à relire `ou`. `ou` reste le
>   lieu lisible, les frères comptés par sorte (« corps › paragraphe 2 › variable 1 »). Les erreurs de `DOCUMENT_INVALIDE` sont
>   rangées par ce même chemin.
> - **La `suggestion`** d'une variable inconnue est le **code seul** (`PV.REFERENCE`), à poser dans l'attribut `code`.
> - **`POUR_MAL_PLACE`** ne signale plus qu'une ligne répétée dans une autre : le schéma interdit déjà une ligne hors d'un tableau,
>   qui est refusée en `DOCUMENT_INVALIDE`.
> - **L'essai** (`ESSAI` / `ESSAI_ECHEC`) va toujours jusqu'au PDF. Le rendu est en Java, sans Word : `ESSAI_PDF_NON_VERIFIE`
>   ne vient plus que d'une version Word. Le premier point d'un rapport de page est `DOCUMENT_VALIDE`.

## B5 — Le rendu PDF et le modèle de départ

- **Rendu** : document → HTML et CSS de page (`@page`, en-têtes courants, sauts) → PDF. Le moteur est au choix du backend ;
  OpenHTMLtoPDF par exemple sait faire les en-têtes répétés et les marges A4. **Signaler toute dépendance ajoutée.**
- **Polices** :
  - « Times New Roman » et « Arial » ne sont pas libres d'être embarquées ;
  - proposition : des polices **métriquement compatibles** et libres (Liberation Serif / Liberation Sans), embarquées dans le PDF, et
    présentées dans l'éditeur sous les noms « Times New Roman » et « Arial » ;
  - à confirmer (Q2).
- **Le même rendu partout** : la production (G2), l'aperçu et l'essai du contrôle passent par le même code. Le PDF signé est stocké
  et figé, comme aujourd'hui.
- **Le modèle de départ** produit un document :
  - l'en-tête officiel reconstruit, avec l'emblème ;
  - les phrases de `ModelePvDepart.FAMILLES` ;
  - les blocs d'avis et les deux champs, déclarés d'office ;
  - l'annexe sous `AVEC_RESERVES`, avec sa ligne répétée ;
  - les titulaires pour le marché.

  Le contenu est celui livré le 21/10 ; seul le support change. Le front fournit, en document JSON, la reconstruction de la page
  de la maquette : en-tête, tableau des signatures, annexe.

> ⚠️ **2026-10-21, livré (backend) — écart : le départ n'attend pas le JSON du front.**
> - **Le serveur reconstruit lui-même la page** (`ModelePvDepart`), d'après `PV_AFSR_PPM_*` :
>   - en-tête avec l'emblème (`GET …/images/embleme`), le ministère, la commission et sa localité ;
>   - titre, identification, « L'an … », présents ;
>   - avis en trois blocs, observation générale, titulaires du marché ;
>   - signatures sans bordures ;
>   - annexe sous `AVEC_RESERVES`, qui commence par un `pageBreak` ;
>   - pied de page avec le numéro de page.
> - Les marges de la base (7,5 mm à gauche, aucune à droite, et des retraits de paragraphe) deviennent des marges de page de 25 mm.
> - Rendu vérifié sur le dossier de mise en concurrence et sur le dossier de marché : **1 page** pour un avis favorable ou
>   défavorable, **2** avec l'annexe.
> - Le front peut, s'il le souhaite, proposer plus tard sa propre reconstruction : elle s'enregistrera comme une page ordinaire.
>
> **Le moteur (Q3)** : **OpenHTMLtoPDF 1.1.97**, `io.github.openhtmltopdf:openhtmltopdf-pdfbox`, sous licence **LGPL 2.1** ou
> ultérieure. Deux changements au pom :
> - c'est la seule dépendance ajoutée ;
> - PDFBox monte de 3.0.3 à 3.0.7, parce que le moteur le demande.
>
> **Les polices (Q2)** : Liberation Serif et Liberation Sans 2.1.5, sous licence SIL OFL 1.1.
> - Elles sont embarquées (en sous-ensemble) sous les noms « Times New Roman » et « Arial ».
> - Un `fontFamily` hors de ces deux noms est refusé.

## B6 — La relève des fichiers intégrés et les versions Word existantes

- **Fichiers intégrés (plan, lettre de renvoi)** : inchangés tant que leur page de remplacement n'est pas en vigueur **et** comparée
  sur des dossiers réels (G4). `/integres` et `/couverture` le disent déjà ; `enService` passera à `false` à la relève.
- **Versions Word existantes** : il n'y a, en recette, que des **brouillons** (PV-MISE-EN-CONCURRENCE v1, modèle de départ du 21/10)
  et des modèles d'essai archivés. Aucune n'est en vigueur.
  - Proposition : les garder en consultation, sans conversion. Elles ne peuvent plus être mises en vigueur (409
    `SUPPORT_ABANDONNE`).
  - L'Administrateur génère à la place un modèle de départ en page.

> ⚠️ **2026-10-21, livré (backend), tel que proposé** (V139).
> - Les versions Word gardent leur fichier et leur aperçu. `mettre-en-vigueur` et `PUT …/document` y répondent 409
>   `SUPPORT_ABANDONNE`.
> - **`dupliquer` ne copie pas une version Word** : la copie part sans version, et le journal le dit
>   (« la version Word n'est pas copiée »).
> - En recette, aujourd'hui : `PV-MISE-EN-CONCURRENCE` v1 (le départ Word de ce matin) reste en consultation. Un nouveau
>   « Générer un modèle de départ » en fera la v2, en page.

## Questions

- **Q1 — Le format.** Document JSON de l'éditeur (proposé), ou HTML assaini côté serveur ? Le JSON est plus sûr et plus simple à
  contrôler. Le HTML assaini se rapproche du rendu, mais oblige à une liste blanche stricte.
- **Q2 — Les polices** : Liberation Serif et Liberation Sans, sous les noms Times New Roman et Arial ? Ou d'autres polices, par
  exemple celles de la charte de l'État si elle en impose ?
- **Q3 — Le moteur PDF** et sa licence.
- **Q4 — Enregistrer un brouillon** par `PUT …/document` (proposé), ou une nouvelle version à chaque enregistrement ?
- **Q5 — Les versions Word existantes** : les garder en consultation (proposé), ou les supprimer, puisqu'aucune n'a jamais été en
  vigueur ?

> ⚠️ **2026-10-21, réponses (backend)**
> - **Q1 — le JSON de l'éditeur.** Le serveur écrit lui-même le XHTML, à partir des seuls nœuds connus.
> - **Q2 — Liberation Serif / Sans**, sous les noms Times New Roman et Arial. Aucune charte de l'État n'est connue ici : à revoir si
>   la CNM en impose une.
> - **Q3 — OpenHTMLtoPDF 1.1.97**, LGPL 2.1 (voir B5).
> - **Q4 — `PUT …/document`** sur un brouillon.
> - **Q5 — consultation** (voir B6).

## Lots

| Lot | Contenu |
|---|---|
| P1 | B1, B2, B4 : la version page, son contrôle, et l'aperçu PDF sur un dossier |
| P2 | B3 et B5 : images, rendu PDF fidèle (en-têtes, marges, polices), modèle de départ en page |
| P3 | G2 sur ce support : la production du PV par la version en vigueur |
| P4 | relève du plan et de la lettre de renvoi (G4), puis retrait des fichiers intégrés |

> ⚠️ **2026-10-21, P1 et P2 livrés ensemble (backend).** L'aperçu PDF de P1 demandait le rendu de P2.
> - P3 (production G2) et P4 (relève G4) restent à faire.
> - Une migration (V139) : `SUPPORT` et `DOCUMENT` sur la version, une table des images.

## Côté front

- **Nouvelle dépendance npm, à signaler** : **Tiptap**, sous licence MIT. Les paquets prévus :
  - `@tiptap/core`, `@tiptap/starter-kit`, `@tiptap/pm` ;
  - `@tiptap/extension-table` et ses compléments ligne, cellule et en-tête ;
  - `@tiptap/extension-text-align`, `@tiptap/extension-underline`, `@tiptap/extension-text-style`, `@tiptap/extension-font-family`,
    `@tiptap/extension-image`.
  - Les nœuds métier (`variable`, `champ`, `bloc`, ligne répétée, `pageBreak`) sont écrits dans le projet.
- **L'onglet « Texte et mise en page »** de la fiche d'un modèle, sur la maquette. Il remplace « Dépôt et contrôle » ; le rapport
  reste sous l'éditeur.
- **L'aperçu** devient « PDF dans la page » seul.
- **Le retrait** du dépôt `.docx` et du téléchargement du Word pour les nouvelles versions.
- **La reconstruction en document JSON** du PV de la maquette, comme base du modèle de départ (B5).
