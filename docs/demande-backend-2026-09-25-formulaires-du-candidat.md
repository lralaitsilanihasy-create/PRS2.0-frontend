# Demande backend — les formulaires du candidat : le besoin par lot et sa génération

*Front → backend, 25/09/2026. Suite de l'esquisse de conception « Les formulaires du candidat » (pilote),*
*et de la traçabilité `docs/correspondance-2026-09-25-fiche-dao-vs-dossier-2463.md`, qui liste comme*
*« hors fiche » les trente pages que cette demande vise à faire entrer dans la chaîne.*
*⚠️ Les arbitrages du pilote du 25/09 sont intégrés, y compris ceux du second tour : **la PRMP rédige le besoin**,*
*le **rendu d'un bloc se déclare**, le **taux de TVA doit être exposé**, et les modèles officiels A1-A4 / C1-C2*
*seront fournis par le pilote — d'ici là, un gabarit provisoire filigrané sert à éprouver le pré-remplissage.*

## Ce que le pilote veut obtenir

Cinq pièces aujourd'hui jointes à la main deviennent des **formulaires générés depuis la fiche**, que le
candidat n'a plus qu'à compléter :

| pièce | pages au 2463 | pré-rempli par la fiche | complété par le candidat |
|---|---|---|---|
| Fiches A1 à A4 | 22-31 | en-tête : référence de l'AOO, objet, autorité contractante, lot visé | identité, capacités, références |
| Garanties C1 / C2 | 33-34 | bénéficiaire, référence, **montant du lot en chiffres et en lettres**, validité | garant, donneur d'ordre, date, signature |
| Bordereaux des prix | 40-44 | n° d'article, désignation, unité, **quantités min/max** | **prix unitaires HT seulement** |
| Spécifications techniques | 57-61 | colonne « caractéristiques exigées » | caractéristiques proposées, marque, modèle, conforme oui/non |
| Liste des fournitures et calendrier | 62-66 | **entièrement générée** : articles, quantités, lieu et délai par lot | rien |

Les montants par ligne, les totaux minimum et maximum, la TVA et le TTC sont **calculés**, jamais saisis.

## Deux périmètres, décidés

| | catégories | ce que ça couvre |
|---|---|---|
| **Formulaires administratifs** | **toutes** — fournitures, travaux, prestations intellectuelles | A1 à A4 et C1/C2 : en-tête pré-rempli, montant de la garantie par lot |
| **Besoin, bordereau, conformité, liste des fournitures** | **fournitures seulement, en V1** | le nouveau bloc et les trois pièces qu'il alimente |

En **travaux**, le détail quantitatif et estimatif reste celui d'aujourd'hui (`B11-FR-06`, `B11-AN-02`) : rien
n'y change. En **prestations intellectuelles**, il n'y a ni article ni quantité : **pas de bloc Besoin**.

## Le constat, côté modèle existant

**1. Le besoin prend un code de bloc NEUF : `B12`.** Vérifié sur la base : les codes `B01` à `B11` sont
utilisés (`B07` en contrat-cadre, `B11 — Annexes et formulaires` en travaux). **`B12` est le premier libre.**
⚠️ **`B11` et ses champs ne sont pas touchés** — en particulier `B11-FR-06` (« Cadre de bordereau de prix et
de détail quantitatif et estimatif ») et `B11-AN-02` : **un code déjà utilisé ne se réaffecte jamais.**

**2. La fiche ne sait porter qu'une valeur par clé.** `t_fiche_marche_valeur` associe une clé à une chaîne :
`CODE`, ou `CODE#rang` depuis la saisie par lot (V43). Le besoin, lui, est un **tableau à deux niveaux** —
*n* articles par lot, *m* caractéristiques par article. Il n'entre pas dans ce modèle et **ne doit pas y
entrer de force** : une clé `B12-AR-01#lot3#article2#carac4` serait illisible, incontrôlable et impossible à
réordonner. C'est une **ressource à part**, rattachée à la fiche et au lot.

**3. Les lots viennent du plan, pas de la fiche.** `t_lot` porte déjà `designationLot`, `montLot`, `qteLot`
et `uniteLot` pour chaque lot de la ligne de marché, et c'est le serveur qui dit à la fiche si elle est
allotie (`saisieParLot`, `nbLots`). Le besoin s'accroche au **lot du plan**, par son rang, comme le font déjà
les quatre champs « par lot ».

---

## B1 — Le modèle du besoin : une ressource, pas des champs

Deux tables filles de la fiche, ordonnées, éditables tant que la fiche est en brouillon.

**`t_fiche_article`** — un article du besoin, dans un lot :

| champ | type | contraintes |
|---|---|---|
| `idArticle` | PK | |
| `idDmc` | FK fiche | obligatoire |
| `lot` | entier | rang du lot au plan ; `null` si la ligne n'est pas allotie |
| `ordre` | entier | rang d'affichage et numéro porté au bordereau |
| `designation` | texte | obligatoire, max 500 |
| `unite` | texte | obligatoire, max 20 (U, boîte, lot, m…) |
| `quantiteMin` | entier | obligatoire si la forme est **à commande** |
| `quantiteMax` | entier | obligatoire si la forme est **à commande** |
| `quantite` | entier | obligatoire si la forme est **quantité fixe** ou **contrat-cadre** |

**`t_fiche_caracteristique`** — une exigence technique d'un article :

| champ | type | contraintes |
|---|---|---|
| `idCaracteristique` | PK | |
| `idArticle` | FK article | obligatoire, cascade à la suppression de l'article |
| `ordre` | entier | rang d'affichage |
| `libelle` | texte | obligatoire, max 300 — *« Mémoire vive »* |
| `exigence` | texte | obligatoire, max 500 — *« 8 Go au minimum »* |

Endpoints attendus, sur le modèle des ressources existantes de la fiche :

| méthode | URL | rôle |
|---|---|---|
| `GET` | `/api/fiches-marche/{idDmc}/articles` | tous les articles de la fiche, avec leurs caractéristiques, triés par lot puis ordre |
| `PUT` | `/api/fiches-marche/{idDmc}/articles` | **remplacement en bloc** du besoin d'un lot (`?lot=n`) ou de toute la fiche — même geste que l'enregistrement d'un bloc de champs |
| `DELETE` | `/api/fiches-marche/{idDmc}/articles/{idArticle}` | retirer un article |

Le remplacement en bloc est préférable à un CRUD article par article : l'écran est une **grille** (comme la
saisie du PPM), on y ajoute, déplace et supprime des lignes avant d'enregistrer une fois.

**Gardes attendues** : fiche validée → **409** (le besoin se corrige par révision, comme les valeurs) ; `lot`
au-delà du nombre de lots du plan → **400** ; `lot` renseigné sur une ligne non allotie, ou absent sur une
ligne allotie → **400** ; catégorie hors fournitures → **409** `BESOIN_HORS_PERIMETRE`.

### Qui écrit le besoin — tranché le 25/09

**La PRMP.** Pas de rôle « service bénéficiaire » : le bloc `B12` suit **les mêmes droits et le même circuit
de validation que le reste de la fiche DAO** — écriture ouverte à `PRMP` et `UGPM`, figé à la validation,
corrigé par révision.

Les champs `redigePar` et `profilRedacteur` que le backend a posés restent utiles comme **trace** de l'acteur
qui a enregistré ; ils ne commandent aucun droit. Aucun statut de besoin n'est attendu.

> ⚠️ **Livré le 2026-09-25 (backend, V45) — §B1 tel que demandé, avec ces précisions :**
>
> - **Le besoin est rattaché à la version de fiche**, pas au seul `idDmc` : figé à la validation, **copié à la
>   révision** comme les valeurs. L'API l'expose par `idDmc` (version courante).
> - **Corps du `PUT`** : `{"articles":[…]}`, sur le modèle du `PUT …/blocs/{bloc}` (`{"valeurs":{…}}`). Réponse : tout
>   le besoin de la fiche.
> - **`ordre` = position dans la liste** reçue (1, 2… par lot), caractéristiques comprises : la grille envoie ses lignes
>   dans l'ordre affiché, l'`ordre` envoyé est ignoré. Idem pour `idArticle` : un `PUT` recrée les articles du lot.
> - **Quantités** : à commande, `quantiteMin` et `quantiteMax` obligatoires (`quantite` ignorée) ; quantité fixe et
>   contrat-cadre, `quantite` obligatoire (les deux autres ignorées). Négatives → 400. `quantiteMin > quantiteMax` n'est
>   **pas** un 400 : c'est le contrôle bloquant `QUANTITES_ORDRE`, pour qu'un brouillon s'enregistre.
> - **Champs d'erreur** : `lot` (paramètre hors du plan, ou donné sur une ligne non allotie) ; `articles[i].lot`
>   (article d'un autre lot que `?lot=n`, lot manquant sans `?lot`, lot sur une ligne non allotie) ;
>   `articles[i].designation`, `.unite`, `.quantiteMin`… ; `articles[i].caracteristiques[j].libelle` / `.exigence`.
> - **Place du rédacteur** : `redigePar` et `profilRedacteur` sur chaque article, **posés par le serveur** (l'acteur qui
>   enregistre), servis en lecture, jamais exigés. Pas de statut du besoin tant que le circuit n'est pas confirmé.
> - **« Dupliquer depuis le lot n »** n'a pas d'endpoint : l'écran relit le lot n et l'envoie par `PUT ?lot=m`.

## B2 — Les quatre valeurs que le besoin et le nouveau référentiel rendent fausses *(fournitures)*

- **`B02-AU-03` « Quantités minimum et maximum »** (`TEXTE_LONG`) ne renvoie plus au bordereau : le besoin le
  porte. À **retirer du référentiel fournitures**, ou à servir en lecture seule, dérivé du besoin.
- **`B09-LL-01` « Lieu de livraison »** est aujourd'hui un `TEXTE_LONG` **unique** : dans le 2463, il empile
  « lot 1 Ministère, lots 2 et 3 Ambatondrazaka, lots 4 et 5 Fort-Dauphin ». La liste des fournitures a besoin
  d'un **lieu par lot** → passer le champ en **`parLot`**, comme `B06-EO-12`.
- **`B04-CD-01`** (fiches A1-A4 jointes) et **`B04-CD-02`** (forme de la garantie jointe) sont des textes
  libres, alors qu'ils **commandent** ce qui est généré. Il faut qu'ils deviennent exploitables : une liste à
  choix multiples pour les fiches (A1, A2, A3, A4), une liste simple pour la garantie (C1, C2, les deux).
  ⚠️ Ces deux champs valent pour **toutes les catégories**, puisque A1-A4 et C1/C2 sont générés partout.

### ⚠️ Les versions déjà validées ne sont jamais migrées — arbitrage du 25/09

Une version validée est un acte : elle **n'est ni modifiée ni convertie**. Quatre situations en découlent, et
le front doit les tenir **sans erreur** :

| valeur d'une version validée | ce qu'elle devient | ce que l'écran fait |
|---|---|---|
| `B04-CD-01` — texte libre | le champ est désormais `LISTE_MULTIPLE` | affichée **telle quelle**, avec la mention « ancienne valeur » |
| `B04-CD-02` — texte libre | le champ est désormais `LISTE` | idem |
| `B09-LL-01` — un seul texte pour tous les lots | le champ est désormais **par lot** | idem, sur une seule ligne |
| `B02-AU-03` — texte | **le code n'existe plus au référentiel** | valeur **orpheline** : affichée en lecture, sans champ ni saisie possible |

À la **révision suivante**, ces valeurs ne sont pas reprises : l'ancienne valeur est **montrée en aide à côté
du champ**, et la **ressaisie est obligatoire**. Aucune conversion automatique — un texte libre dans une liste
serait un contresens, et une répartition par lot ne se devine pas à partir d'une phrase.

> ⚠️ **Livré le 2026-09-25 (backend, second tour)** — `POST …/reviser` **ne reprend pas** une valeur que le
> référentiel d'aujourd'hui n'admet plus : champ désactivé ou inconnu (`B02-AU-03`), texte hors des options d'une liste
> (`B04-CD-01`, `B04-CD-02`), clé nue d'un champ devenu par lot sur une ligne allotie (`B09-LL-01`), clé `#n` d'un champ
> qui ne l'est pas. Les autres valeurs et le besoin sont repris comme avant. **L'« ancienne valeur » se lit sur la
> version précédente** (`GET /api/fiches-marche/{idDmc}/versions/{n}`, `valeurs`), qui n'est jamais modifiée : c'est là
> que l'écran la prend pour l'aide à côté du champ. La ressaisie est exigée par le bilan pour les champs obligatoires.

> ⚠️ **Livré le 2026-09-25 (backend)** — `B02-AU-03` est **désactivé** (retiré du référentiel servi, jamais supprimé) ;
> `B09-LL-01` est **par lot** ; `B04-CD-01` est du nouveau type **`LISTE_MULTIPLE`** (options A1, A2, A3, A4 — reçu en
> tableau JSON `["A1","A3"]` ou en chaîne « A1,A3 », enregistré « A1,A3 » dans l'ordre des options, option inconnue →
> 400) ; `B04-CD-02` est une `LISTE` d'options **« C1 », « C2 », « C1 et C2 »**. Les deux valent pour les trois
> catégories (rubrique `B04-CD` ouverte aux prestations intellectuelles). ⚠️ Sur DBPRS20, les versions **validées** de
> la fiche 12 gardent leurs anciens textes (quantités, fiches jointes, garantie, lieu unique) : ils se ressaisissent à la
> révision suivante — un texte libre dans `B04-CD-01` y serait refusé à l'enregistrement du bloc.

## B3 — La génération des fichiers

Le serveur produit déjà le DPAO, le CCAP et l'acte d'engagement en `.docx` et `.pdf`, un AE par lot. Les
formulaires du candidat suivent la même mécanique, avec **un format par nature de pièce** :

| pièce | fichiers attendus | format | catégories |
|---|---|---|---|
| A1 à A4 | un fichier par fiche exigée (`B04-CD-01`), **une fois pour le dossier** | Word | toutes |
| C1 / C2 | **un exemplaire par lot**, pour la ou les formes retenues (`B04-CD-02`) | Word | toutes |
| Bordereau des prix | **un classeur par lot** | Excel protégé : seule la colonne « prix unitaire HT » est déverrouillée, montants et totaux en **formules** | fournitures |
| Tableau de conformité | **un classeur par lot** | Excel, colonnes candidat déverrouillées | fournitures |
| Liste des fournitures et calendrier | **un tableau par lot**, inséré au DAO | comme les documents actuels | fournitures |

**Le montant en lettres** est déjà produit par le serveur pour l'acte d'engagement : les garanties C1/C2 le
réutilisent tel quel (« 1 600 000 Ariary (un million six cent mille ariary) »).

⚠️ **Les modèles officiels sont stockés tels quels, et seuls les blancs sont des champs.** A1-A4 et C1/C2
sont des modèles réglementaires : la génération **remplit des blancs**, elle ne réécrit aucune phrase. Même
exigence que pour les quatorze modèles de PV. ⚠️ **À confirmer par le pilote** : la conformité de ces modèles
aux **dossiers types en vigueur** — c'est lui qui fournira les fichiers de référence.

⚠️ **La remise électronique n'est pas admise** (DPAO §7.3 du 2463) : ces fichiers sont faits pour être
**téléchargés, remplis, imprimés et signés**. Aucun formulaire en ligne, aucun dépôt d'offre dans
l'application — le classeur Excel protégé sert à éviter les erreurs de calcul, pas à dématérialiser l'offre.

> ⚠️ **Livré le 2026-09-25 (backend, V45) — trois pièces sur cinq ; A1-A4 et C1/C2 NE SONT PAS livrés.**
>
> - **A1 à A4, C1/C2 : en attente des modèles officiels.** La demande exige de les remplir tels quels, seuls les blancs
>   étant des champs : sans les fichiers de référence du pilote, les produire reviendrait à écrire nous-mêmes des
>   modèles réglementaires. Les champs qui les commandent (`B04-CD-01`, `B04-CD-02`) et le contrôle
>   `GARANTIE_MANQUANTE` sont prêts ; la génération suivra dès réception des fichiers.
> - **Liste des fournitures et calendrier** : type **`LF`**, docx et pdf, un **tableau par lot** (n°, désignation,
>   unité, quantités), suivi du lieu (`B09-LL-01#n`) et du délai (`B06-EO-12#n` à commande, `B06-EO-11` en quantité
>   fixe) du lot ; joint au dossier soumis comme les autres PDF.
> - **Bordereau des prix** : type **`BP`**, un **`xlsx` par lot** (`DocumentFicheDto.lot`) ; feuille protégée **sans
>   mot de passe** (une aide contre l'erreur, pas une serrure) ; seule « Prix unitaire HT » est déverrouillée ;
>   montants par ligne, total HT, **TVA** et **TTC** en formules. Le taux de TVA est un paramètre administrable
>   (`FICHE_TAUX_TVA`, **20 %** au départ) — sans lui, pas de ligne TVA.
> - **Tableau de conformité** : type **`TC`**, un **`xlsx` par lot**, une ligne par caractéristique exigée ; colonnes
>   « caractéristique proposée », « marque », « modèle », « conforme » déverrouillées, cette dernière en liste OUI/NON.
> - Les `xlsx` ne sont **pas** joints au dossier soumis (seuls les PDF le sont). Ils ne sont produits que pour une fiche
>   de fournitures qui a un besoin. Téléchargement : `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

## B4 — Les contrôles

| contrôle | règle | sévérité | code proposé |
|---|---|---|---|
| quantités | `quantiteMin ≤ quantiteMax` pour chaque article | **bloquant** | `QUANTITES_ORDRE` |
| complétude du besoin | chaque lot a au moins un article ; chaque article au moins une caractéristique | **bloquant** | `BESOIN_INCOMPLET` |
| garanties générées | une pièce C1 ou C2 par lot, au montant de ce lot | **bloquant** | `GARANTIE_MANQUANTE` |
| taux de la garantie | `B05-GS-03#n` rapportée au montant maximum du lot | **avertissement, jamais bloquant** | `GARANTIE_TAUX` |

### Le taux de garantie est administrable, pas écrit en dur

Trois paramètres, modifiables par l'Administrateur — **aucune valeur dans le code** :

| paramètre | valeur de départ | rôle |
|---|---|---|
| taux de référence | **2 %** | observé sur le dossier 2463 |
| borne basse | *à fixer par le pilote* | en deçà, l'avertissement se déclenche |
| borne haute | *à fixer par le pilote* | au-delà, idem |

⚠️ **Sur quel montant ?** Le bordereau ne porte **aucun montant** tant que le candidat n'a pas donné ses prix.
Le seul maximum connu à la publication est **`B05-TP-03#n`**, saisi par la PRMP : c'est lui que le contrôle
compare à la garantie, pas le bordereau. L'avertissement dit l'écart constaté, il n'empêche jamais de valider.

> ⚠️ **Livré le 2026-09-25 (backend, V45) — les quatre contrôles, avec ces précisions :**
>
> - **`BESOIN_INCOMPLET`** vaut pour **toute** fiche de fournitures : une fiche sans besoin ne se valide plus, y compris
>   celles préparées avant cette livraison (bloc `B12`, un message par lot vide et par article sans caractéristique).
> - **`GARANTIE_MANQUANTE`** : la « pièce C1 ou C2 par lot » n'étant pas encore générée, le contrôle vérifie ce qui la
>   commande — **garantie de soumission exigée (`garantieSoumission = OUI`) sans modèle retenu à `B04-CD-02`**. Les
>   montants par lot, eux, sont déjà exigés par le caractère obligatoire de `B05-GS-03`. Il est porté par le rôle
>   `GARANTIE_MANQUANTE:FORME` de `B04-CD-02`, pas par un code écrit dans le programme.
> - **`GARANTIE_TAUX`** (rôles `GARANTIE_TAUX:GARANTIE` = `B05-GS-03`, `:MAXIMUM` = `B05-TP-03`) : un **constat** en
>   `ok` (« 2 % du montant maximum (référence 2 %) ») quand le taux est dans les bornes ou qu'aucune borne n'est fixée ;
>   un **avertissement** hors bornes. Il ne s'évalue que là où le montant maximum existe, donc à commande.
> - **Paramètres** : `GET /api/parametres/fiche-garantie-taux` (tout authentifié) et `PUT` (Administrateur)
>   `{"reference":2,"borneBasse":null,"borneHaute":null}` en %, `null` = non fixé ; 400 hors 0–100 ou borne basse >
>   haute. Semés : référence 2, bornes vides.

## B5 — Ce que le front fera

- une **grille de saisie du besoin** (bloc `B12`), un onglet par lot, sur le modèle de la grille du PPM :
  ajouter, déplacer, supprimer une ligne, et déplier les caractéristiques d'un article ;
- **« Dupliquer depuis le lot n »** — le 2463 répète le lot 2 au lot 4 et le lot 3 au lot 5 : une copie au
  moment de la saisie, chaque lot restant modifiable ensuite. *(Un catalogue d'articles réutilisable est noté
  pour plus tard ; il n'est pas de la V1.)*
- un **aperçu des formulaires** à l'étape 7, à côté des documents déjà produits, avec ce que chacun contient et
  qui le complète ;
- les contrôles affichés au bilan comme les autres, l'avertissement de taux distingué des bloquants.

Rien ne sera codé tant que le contrat n'est pas servi : l'écran se replie, comme au lot 1.

## B6 — Un bloc doit pouvoir déclarer son rendu

Le bloc `B12` est servi **sans aucun champ** : son contenu est la ressource `/articles`. Or l'écran rend un
bloc en bouclant sur ses champs — `B12` s'afficherait donc **vide**.

Le front peut évidemment brancher la grille du besoin sur le code `B12`, mais ce serait un **cas particulier
écrit en dur** : le prochain bloc à rendu propre demanderait la même rustine. Le pilote a tranché pour un
**mécanisme générique** — c'est au **bloc de déclarer son rendu**.

**Demande** : un attribut **`rendu`** sur le bloc servi par `GET /api/champs-fiche-marche` :

| valeur | sens |
|---|---|
| absent ou `null` | rendu normal : la liste des champs du bloc *(tous les blocs actuels)* |
| `"BESOIN"` | le bloc est rendu par la grille du besoin (lots → articles → caractéristiques) |

Le libellé de la rubrique (`B12-BE — Articles et caractéristiques exigées, par lot`) reste l'intitulé affiché.

⚠️ **D'ici là**, le front se replie sur une table de correspondance code → rendu, à un seul endroit, qu'il
supprimera dès que l'attribut sera servi. Comme au lot 1, l'écran ne devine rien : un bloc sans champ et sans
rendu connu affiche « aucune information à saisir dans ce bloc », il ne reste pas blanc.

> ⚠️ **Livré le 2026-09-25 (backend, V46)** — attribut **`rendu`** sur chaque bloc de `GET /api/champs-fiche-marche`
> (`blocs[*].rendu`) : `null` pour tous les blocs existants, **`"BESOIN"`** pour `B12`. Porté par la base
> (`tr_bloc_fiche_marche.RENDU`, CHECK `NULL` ou `BESOIN`) : un nouveau rendu est une migration, jamais un code en dur.
> La table de correspondance de repli peut être retirée.

## B7 — ⚠️ Bloquant : le taux de TVA n'est pas joignable

La livraison annonce un paramètre administrable `FICHE_TAUX_TVA` à 20 %, « sans lui, pas de ligne TVA ». Il
n'est exposé par aucune URL :

```
GET /api/parametres/fiche-taux-tva   → 404
GET /api/parametres/FICHE_TAUX_TVA   → 404
GET /api/parametres                  → 404
```

Seul `GET /api/parametres/fiche-garantie-taux` répond (`{reference: 2, borneBasse: null, borneHaute: null}`).

**Demande, bloquante pour l'aperçu du bordereau** : exposer `FICHE_TAUX_TVA` **en lecture et en
administration**, au **même format que `fiche-garantie-taux`**, et **donner l'URL exacte**.

⚠️ **Le front ne mettra pas 20 % en dur.** Tant que le paramètre est inaccessible, l'aperçu du bordereau
affiche **« Taux de TVA non disponible »** à la place des lignes TVA et TTC — pour qu'on sache *pourquoi*
elles manquent, au lieu de croire à un oubli de la fiche.

> ⚠️ **Livré le 2026-09-25 (backend)** — URL exacte : **`GET /api/parametres/fiche-taux-tva`** (tout authentifié) →
> `{"taux": 20}` (`null` si non fixé) ; **`PUT /api/parametres/fiche-taux-tva`** (Administrateur, 403 sinon), même corps,
> `null` efface, 400 hors 0–100. Même forme d'enveloppe que `fiche-garantie-taux`. Le bordereau généré lit ce même
> paramètre : l'aperçu et le fichier disent toujours la même chose.

## B8 — Les blancs attendus dans les modèles officiels

> ⚠️ **ARBITRÉ PAR LE PILOTE le 2026-09-26 — les modèles officiels SONT ceux du dossier 2463, pages 20 à 34.**
> Il n'y a plus rien à attendre : la source est le PDF déjà utilisé pour la traçabilité
> (`NatureMarches/DAO_Fournitures/Fourniture_a_commande.pdf`). Le front les reconstitue en Word **à l'identique**
> — mêmes libellés, même ordre, même numérotation, même ponctuation, aucune reformulation, aucun ajout — et seuls
> deux types de trous deviennent des champs : les **blancs** (pointillés, crochets, cases vides) et les **valeurs
> propres au 2463 déjà écrites dans le modèle** (« 105ème jour », référence de l'AOO, bénéficiaire), sans quoi le
> modèle ne servirait qu'à ce dossier-là.
>
> **Le gabarit provisoire filigrané reste en place** tant que le pilote n'a pas relu les six Word reconstitués.
> Le plan du travail, les trous relevés page par page, les écarts constatés **dans la source** et la procédure de
> vérification de fidélité sont dans **`docs/plan-2026-09-26-modeles-formulaires-candidat.md`**.

Voici, pièce par pièce, **les blancs que la fiche remplit** — nom du blanc tel qu'il figure au dossier 2463,
et code de la fiche qui l'alimente. Tout le reste est laissé au candidat.

Voici, pièce par pièce, **les blancs que la fiche remplit** — nom du blanc tel qu'il figure au dossier 2463,
et code de la fiche qui l'alimente. Tout le reste est laissé au candidat.

### A1 à A4 — l'en-tête commun *(p. 22-31 du 2463)*

| blanc du modèle | source |
|---|---|
| `N° d'appel d'offres et titre` | `B02-OB-03` (référence) + `B02-OB-01` (objet) |
| `Date` | laissée au candidat *(date de son offre)* |
| `Page … de … pages` | numérotation du document généré |
| lot visé | rang et désignation du lot du plan — **un exemplaire par lot** si le dossier est alloti |
| autorité contractante | `B01` (reprise du PPM) |

⚠️ **A1-b « Renseignements additionnels lorsque le candidat est un groupement »** n'est joint que si le
cadrage autorise le groupement — au 2463, il porte la mention « non applicable ».

### C1 — Garantie bancaire de soumission *(p. 33)*

| blanc du modèle | source |
|---|---|
| `A : (Nom et adresse de l'Acheteur)` | autorité contractante et son adresse (`B01`) |
| `pour l'exécution, ou la fourniture de [titre du Marché]` | `B02-OB-01` + désignation du lot |
| `au profit de [Nom de l'Organisme ayant lancé l'Appel d'offres]` | autorité contractante (`B01`) |
| `à concurrence d'un montant de [montant … en chiffres et en lettres]` **(deux occurrences)** | **`B05-GS-03#n`**, en chiffres **et en toutes lettres** |
| `jusqu'au cent cinquième (105ème) jour` | **`B05-GS-04`** — le nombre et son ordinal en lettres |
| `[nom du candidat]`, `en date du [date]`, signature, banque, adresse, cachet | **candidat** |

### C2 — Caution personnelle et solidaire *(p. 34)*

| blanc du modèle | source |
|---|---|
| `pour [dénomination et adresse complète de l'Autorité contractante]` | autorité contractante (`B01`) |
| `sur [intitulé ou objet résumé du marché et références de l'appel d'offres]` | `B02-OB-01` + `B02-OB-03` + désignation du lot |
| `au plus tard le [date fixée pour la remise des offres]` | **`B04-LR-03`** |
| `dont la validité expire le [date d'expiration de la validité de l'offre]` | **`B04-LR-03` + `B04-VO-01`** *(75 jours au 2463)* — date calculée |
| `ladite caution s'élève à [montant en chiffres et en lettres]` | **`B05-GS-03#n`** |
| `le cent cinquième (105ème) jour` | **`B05-GS-04`** |
| organisme de caution, siège social, nom et adresse du candidat, lieu, date, signature, cachet | **candidat** |

⚠️ **Deux points à vérifier sur les modèles officiels quand ils arriveront** : le **nombre d'occurrences** du
montant (le C1 du 2463 le porte deux fois, dans la même phrase) et la **forme de l'ordinal** — « cent
cinquième (105ème) jour » est écrit en toutes lettres dans le modèle, alors que la fiche ne connaît que le
nombre `105`.

> ⚠️ **Livré le 2026-09-25 (backend, V46) — gabarit provisoire, avec ces précisions :**
>
> - **Types de documents** `A1`, `A2`, `A3`, `A4`, `C1`, `C2`, docx et pdf, toutes catégories ; **filigrane
>   « MODÈLE PROVISOIRE – NON OFFICIEL »** en diagonale sur chaque page (docx : filigrane Word ; pdf : texte grisé) et
>   « Page n de N pages ».
> - **Le gabarit liste les blancs**, il n'imite pas le modèle : une rubrique « pré-remplis par la fiche » (libellé du
>   blanc : valeur) et une rubrique « laissés au candidat » (pointillés). Aucune phrase réglementaire n'est écrite : le
>   jour où les modèles officiels arrivent, seul le générateur change.
> - **A1 à A4 : une pièce par fiche cochée et par lot** (ligne allotie) — comme au §B8, et non « une fois pour le
>   dossier » comme le disait le tableau du §B3. En-tête : `B02-OB-03` + `B02-OB-01`, autorité contractante
>   (`B01-AC-01`), lot visé (rang et désignation du lot au plan). A1 porte A1-b, « non applicable » si le cadrage
>   `groupement` n'est pas `OUI`. La date reste au candidat ; la numérotation est celle du fichier.
> - **C1 / C2 : une pièce par forme retenue et par lot** — « C1 et C2 » produit les deux. Montant `B05-GS-03#n` en
>   chiffres **et** en lettres ; **validité en ordinal** calculée depuis `B05-GS-04` (« jusqu'au cent cinquième (105ème)
>   jour ») — la fiche garde le nombre, le serveur écrit l'ordinal. C2 : `B04-LR-03`, et fin de validité des offres
>   **calculée** `B04-LR-03` + `B04-VO-01` jours. Une valeur absente est écrite « — (non renseigné dans la fiche) ».
> - Produits pour **toute** fiche qui coche `B04-CD-01` / retient `B04-CD-02`, y compris travaux et prestations
>   intellectuelles ; les PDF sont joints au dossier soumis comme les autres. Les deux points à vérifier sur les
>   modèles officiels (occurrences du montant, forme de l'ordinal) sont notés pour leur arrivée.

---


### ⚠️ Cinq besoins NOUVEAUX, révélés par la lecture des modèles (26/09)

Ils naissent du décalque : les modèles écrivent des choses que le serveur ne sait pas encore produire.

> ⚠️ **Corrigé le 2026-09-26 après relecture du dossier par le pilote.** Les cinq besoins sont revus : N1 passe de
> quatre à **neuf** occurrences dont une **calculée**, N3 se dédouble, N4 précise son axe, et **N5 tombe** — le champ
> existait déjà. Le relevé page par page et les vecteurs de test sont dans
> `docs/plan-2026-09-26-modeles-formulaires-candidat.md`.

| # | besoin | où il apparaît | pourquoi il bloque |
|---|---|---|---|
| **N1** | **Un formateur d'ordinaux** : forme **longue** (« cent cinquième »), forme **abrégée** (« 105ème »), **premier/première**, **testé unitairement**. `NombreEnLettres` ne produit que des cardinaux. | **Neuf occurrences** : C1 p. 33 (×2), C2 p. 34 (×2), AE p. 38, CCAP p. 53 et 54, IC p. 9 et 13 (ces deux dernières **en lettres seules**, sans doublet) | **le 105 n'est pas littéral** : c'est `B04-VO-01` (75) + 30. Si la validité des offres change, le nombre **et son ordinal** changent |
| **N2** | **Dates et jours dérivés** : fin de validité de l'offre = `B04-LR-03 + B04-VO-01` ; délai de la garantie = `B05-GS-04 − B04-VO-01`. **Calculés, jamais stockés comme des saisies** ; **affichés avec leur règle** ; **recalculés** si la date de référence bouge. | C1 p. 33, C2 p. 34, AE p. 38 | elles ne sont saisies nulle part, et ce n'est pas au candidat de les calculer |
| **N3** | **DEUX champs de durée** au bloc Candidats : **antécédents juridiques** (litiges, marchés non exécutés, redressement judiciaire) défaut **5 ans** ; **antécédents financiers** défaut **3 ans**. Défauts **administrables**, valeur retenue **portée par la fiche**. | A1-a p. 23, A1-c p. 25 (×2), A3-a p. 28 | la source les paramètre déjà **et se contredit** : « cinq dernières années » au titre, « [nombre d'années] » au corps |
| **N4** | **Deux sections conditionnées** : A1-b par le cadrage `groupement`, sur la **valeur existante** (non autorisé · conjoint ou solidaire · obligatoirement solidaire), **pas** un booléen neuf ; A3-b par le **type de marché** — ventilation travaux / fournitures / services / prestations intellectuelles, le second tableau visant les **prestations similaires à l'objet**. | A1-b p. 24, A3-b p. 30 | au 2463 A1-b porte « (non applicable) » : c'est une **réponse**, pas le modèle |
| ~~N5~~ | ~~L'adresse de l'autorité contractante~~ — **TOMBE.** `B01-AC-02 « Adresse de l'autorité contractante »` existe déjà (source **PPM**, `clePpm = ADRESSE`), et l'entité contractante porte bien une adresse en base. | — | il reste à éprouver que `valeursPpm` la serve **non vide** : première vérification du prochain rejeu |

> ⚠️ **VÉRIFIÉ DANS LE CODE DU BACKEND le 2026-09-26 — le formateur d'ordinaux EXISTE DÉJÀ.** Livré le 25/09 au
> titre de ce même §B8 : `NombreEnLettres.ordinal(long)` (`src/main/java/cnm/prs/service/NombreEnLettres.java`,
> ligne 96) — « premier », « cinquième », « neuvième », « vingt et unième », « quatre-vingtième », « cent
> cinquième » — et le **doublet** est déjà assemblé par `FormulairesCandidat.validiteGarantie()` :
> `ordinal(j) + " (" + j + "ème) jour"`. Un test unitaire existe (`ValeurRepriseRevisionTest.ordinal()`).
> **Il ne faut donc pas le redemander.** Ce qui reste, beaucoup plus étroit :
>
> 1. **Le « trentième (30ème) » de la même phrase n'est pas produit.** La source écrit « jusqu'au **trentième
>    (30ème)** jour suivant l'expiration de la période de validité des offres, **soit** jusqu'au **cent cinquième
>    (105ème)** jour » : deux ordinaux, dont un seul est généré.
> 2. **Le féminin « première »** : `ordinal(1)` ne rend que « premier ». Aucune occurrence féminine dans la
>    source — c'est une précaution, pas un besoin.
> 3. **Élargir les vecteurs de test** à la table ci-dessous (14 cas), dont 75, 80, 105 et 1000.
> 4. ⚠️ **Un arbitrage du pilote** : aujourd'hui **105 est une saisie** (`B05-GS-04`), pas un calcul. La règle de
>    la source est « validité des offres + 30 ». Deux façons de la tenir :
>    **(a)** garder 105 saisi et **dériver le 30** (= `B05-GS-04 − B04-VO-01`) — le contrôle existant
>    `VALIDITE_GARANTIE_SUP_OFFRE` garantit déjà la cohérence ; **(b)** dériver 105 de la validité + 30, et
>    retirer la saisie. **Recommandation : (a)** — la PRMP doit pouvoir écrire ce que son dossier dit, et un
>    contrôle vaut mieux qu'un calcul qui contredirait le document publié.

### ⚠️ Les six modèles sont reconstitués (26/09) — le contrat des jetons

Les six `.docx` sont dans `docs/modeles-candidat/` du dépôt front, **fidèles au caractère près** au dossier 2463
(comparateur automatisé, texte jamais retapé), avec leur tableau de correspondance dans le `README.md` du même
dossier. **Ils ne sont pas à mettre en production** avant la relecture du pilote ; ils sont là pour que le contrat
soit lisible dès maintenant.

**Les jetons**, tous de la forme `{{…}}`, compatibles avec `remplacerDansParagraphe` (remplacement sur le texte
concaténé des runs) :

| jeton | valeur attendue |
|---|---|
| `{{B01-AC-01}}`, `{{B01-AC-02}}`, `{{B02-OB-01}}`, `{{B02-OB-03}}`, `{{B04-LR-03}}`, `{{B03-CQ-01}}` | la valeur de la fiche (PPM ou saisie), telle que servie |
| `{{B05-GS-03}}` · `{{B05-GS-03.lettres}}` | la garantie **du lot** en chiffres · la même en toutes lettres (`MontantEnLettres.ariary`) |
| `{{B05-GS-04.doublet}}` | `ordinal(B05-GS-04) + " (" + B05-GS-04 + "ème)"` — ce que `validiteGarantie()` assemble déjà |
| `{{DERIVE.delai-garantie.doublet}}` | idem, sur `B05-GS-04 − B04-VO-01` — **N1 + N2**, le seul calcul nouveau des garanties |
| `{{DERIVE.fin-validite-offre}}` | `B04-LR-03 + B04-VO-01` jours, en date — **N2** |
| `{{B03-AJ-01}}` · `{{B03-AJ-01.lettres}}` | durée des antécédents juridiques (défaut 5) · en lettres — **N3, code proposé** |
| `{{B03-AF-01.lettres}}` | durée des antécédents financiers (défaut 3), en lettres — **N3, code proposé** |
| `{{A1B.mention}}` | « (non applicable) » quand le cadrage `groupement` n'autorise pas le groupement, chaîne vide sinon — **N4** |
| `{{SI:A1B}}` … `{{FINSI:A1B}}` | **marqueurs** : les paragraphes entre les deux sont **omis** quand le groupement n'est pas autorisé ; les marqueurs eux-mêmes sont toujours retirés — **N4** |
| `{{SI:A3B-NATURES}}` … `{{FINSI:A3B-NATURES}}` | **marqueurs** : les lignes de tableau entre les deux (une par nature, au 2463 « Fournitures », « Services ») sont **régénérées** avec les natures du marché ; marqueurs retirés — **N4** |

**Ce que les modèles ne demandent pas** : aucune adresse nouvelle (`B01-AC-02` existe), aucun ordinal nouveau
hors le « trentième (30ème) » dérivé, aucun champ pour les blancs du candidat — ils restent des pointillés et des
crochets, à sa main.

**Un point qui reste au pilote** : `B05-GS-04` (105) reste-t-il **saisi**, le 30 étant dérivé (recommandation), ou
devient-il dérivé de la validité + 30 ? Le contrat ci-dessus vaut pour les deux réponses.

> ⚠️ **ARBITRÉ PAR LE PILOTE le 2026-09-26 — « oui à tout ».** R1 : `B02-OB-03` **obligatoire**. R4 : `B03-CQ-01`
> **ouvert aux trois catégories**. R5/R6 : **`B03-CQ-09`** (antécédents juridiques, défaut 5) et **`B03-CQ-10`**
> (financiers, défaut 3), attribut **`valeurDefaut`** recopié à la création. R11 : **A1-A4 une fois par dossier**,
> C1/C2 par lot. R12 : **issue (c)** — le moteur du backend rend les six modèles lui-même (docx et PDF) depuis les
> fichiers de commande versionnés `scripts/modeles-candidat/modeles/<sigle>.txt` ; les PDF restent joints au dossier.
> **S6 : absent** (aucune police à embarquer). **105 : saisi**, le « trentième (30ème) » **dérivé**. Les jetons des
> modèles portent désormais `{{B03-CQ-09}}` / `{{B03-CQ-10}}` ; les six `.docx` regénérés restent fidèles au
> caractère près. **Le chantier backend est ouvert** : extension du moteur, N1 (le 30ème et les vecteurs de test),
> N2, N3, N4, les deux changements de référentiel (R1, R4), puis le remplacement du gabarit provisoire filigrané.

> ⚠️ **Relecture du contrat par le backend (2026-09-26), et réponses du front — six points, deux trous reconnus.**
>
> | # | ce que le backend relève ou propose | réponse du front | qui tranche |
> |---|---|---|---|
> | R1 | `B02-OB-03` (numéro de l'AOO) **n'est pas obligatoire** aujourd'hui : un jeton vide imprimerait « — Objet… ». Proposition : le rendre obligatoire. | **D'accord** — tout dossier d'appel d'offres a un numéro. Le front n'a rien à coder : il lit `obligatoire` au référentiel. | pilote (référentiel) |
> | R2 | Pour tout autre jeton vide, imprimer des **pointillés « ……… »**, pour que le papier reste remplissable. | **D'accord.** C'est ce que le dossier lui-même fait de ses blancs. | — |
> | R3 | Le « trentième » dérivé est **protégé** par le contrôle bloquant `VALIDITE_GARANTIE_SUP_OFFRE`. | Noté : c'est exactement pourquoi la recommandation est « 105 saisi, 30 dérivé ». | pilote (105) |
> | R4 | `{{B03-CQ-01}}` **n'existe qu'en fournitures** ; A1 vaut pour les trois catégories. Ouvrir le champ aux trois, ou dire ce qu'A1 imprime sinon. | **Ouvrir aux trois** : la liste des pièces d'identification (immatriculation, existence, non-faillite) est exigée de tout candidat, quelle que soit la catégorie — les DPAO travaux et prestations intellectuelles la portent aussi. À défaut, R2 s'applique : des pointillés. | pilote (référentiel) |
> | R5 | N3 — plutôt que deux rubriques neuves, **`B03-CQ-09`** (antécédents juridiques) et **`B03-CQ-10`** (financiers) dans la rubrique existante « Capacité et qualifications des candidats », ouverte aux trois catégories. | **Mieux que ma proposition.** Les jetons `{{B03-AJ-01}}` / `{{B03-AF-01}}` des modèles deviennent `{{B03-CQ-09}}` / `{{B03-CQ-10}}` dès que le pilote confirme — une ligne du descripteur, rejouée. | pilote |
> | R6 | Le « défaut administrable » est une notion neuve : un attribut **`valeurDefaut`** sur le champ (colonne à l'import, API d'administration), **recopié dans la fiche à sa création** — un changement de défaut ne touche pas les fiches existantes. | **D'accord**, et la règle « recopié à la création » est la bonne : une fiche ne doit pas changer de sens parce qu'un paramètre a bougé après elle. L'écran Admin des champs affichera l'attribut. | — |
> | R7 | `{{SI:A3B-NATURES}}` : les marqueurs sont dans la première et la dernière **cellule** de la plage, pas dans des lignes à part ; lecture « de la ligne qui contient SI à celle qui contient FINSI ». | **C'est la bonne lecture**, et c'est ainsi qu'ils sont posés. | — |
> | R8 | « Les natures du marché » n'est pas défini : une ligne du plan n'a **qu'une** nature. Proposition : les déduire de la **catégorie** — fournitures et services → « Fournitures », « Services » ; travaux → « Travaux » ; prestations intellectuelles → « Prestations intellectuelles ». | **D'accord** — c'est exactement ce que le 2463 imprime (Fournitures, Services). | — |
> | R9 | `{{A1B.mention}}` occupe un paragraphe seul : quand elle est vide, **retirer le paragraphe** plutôt que laisser une ligne blanche. | **D'accord.** | — |
> | R10 | **Trou 1** — le README dit que les colonnes d'années d'A3-a « suivront la durée financière », mais **aucun jeton ne le porte**. Proposition : **trois colonnes fixes en V1**. | **Reconnu, corrigé** dans le README : trois colonnes fixes. Le nombre de colonnes est de la structure, pas du texte ; un jeton de répétition serait un lot à part. | — |
> | R11 | **Trou 2** — A1 à A4 **n'ont plus de blanc « lot visé »** : ils seraient produits **une fois pour le dossier**, non par lot comme l'annonçait ce §B8. C1 et C2 restent par lot. | **Reconnu.** Le §B8 s'appuyait sur le gabarit provisoire ; la source, elle, ne mentionne aucun lot dans A1-A4 — un candidat qui vise deux lots ne remplit qu'une fiche d'identification. **Recommandation : une fois par dossier**, C1/C2 par lot. | pilote |
> | R12 | **Conséquence** : remplir un `.docx` officiel ne donne **pas de PDF** sans Word, absent du serveur et de la CI. Les six formulaires seraient produits **en Word seulement**, et donc **plus joints au dossier soumis**, qui ne reçoit que des PDF. | ⚠️ **C'est le point qui pèse.** Aujourd'hui 38 PDF sont joints au dossier ; avec des modèles Word remplis, les fiches du candidat en sortiraient. Trois issues, à peser par le pilote : **(a)** Word seul, non joint — le candidat les télécharge, la Commission ne les voit pas au dossier ; **(b)** un convertisseur sur le serveur (LibreOffice sans interface, `soffice --headless --convert-to pdf`) — une brique d'infrastructure, à installer aussi en CI ; **(c)** ne pas remplir le `.docx` mais **rendre les modèles par le moteur du backend**, qui produit déjà docx **et** PDF : la chaîne de décalque écrit un **fichier de commande** (paragraphes, tableaux, cellules, jetons) qui décrit chaque modèle à l'identique et que le comparateur vérifie — ce fichier peut être la source du rendu, le `.docx` restant l'objet de relecture. **(c)** est celle qui garde les PDF au dossier sans nouvelle brique, si le moteur sait poser des tableaux à cellules multi-paragraphes ; c'est au backend de dire s'il le sait. | pilote, backend |
>
> S6 (« ☐ » ou rien) et 105 (saisi ou dérivé) restent au pilote ; le contrat tient dans tous les cas.

> ⚠️ **Réponse du backend sur R12 (2026-09-26) — le moteur sait-il rendre le fichier de commande ?**
> **Pas tel quel ; (c) tient pourtant sans nouvelle brique**, par une extension du moteur que nous maîtrisons.
> Relu : le format en tête de `Decalque.java` et les six `scripts/modeles-candidat/modeles/*.txt`.
>
> - **Aujourd'hui**, `DocumentFicheModele` ne sait poser que des blocs → rubriques → lignes « libellé : valeur »
>   (mise en page fixe, alignée à gauche) et, **après** les blocs, des tableaux à **une chaîne par cellule** dont la
>   première ligne est un en-tête gras.
> - **Ce qui manque**, face au format de commande :
>
>   | format de commande | manque au moteur |
>   |---|---|
>   | `TITRE`, `SOUS_TITRE`, `PARA` justifié, `CENTRE`, `DROITE`, `VIDE` | des paragraphes libres avec leur alignement |
>   | l'ordre des enregistrements, tableaux intercalés entre les paragraphes | les tableaux sont aujourd'hui rejetés après les blocs |
>   | `LIGNE` avec `RS` : plusieurs paragraphes dans une cellule | une cellule ne porte qu'une chaîne |
>   | une première `LIGNE` qui n'est pas forcément un en-tête | l'en-tête gras est imposé |
>
> - **L'extension** : une liste **ordonnée** d'éléments (un paragraphe avec son style ; ou un tableau de lignes dont
>   chaque cellule est une liste de paragraphes), rendue par **POI** (docx) et **OpenPDF** (pdf). Justification,
>   centrage, alignement à droite et cellules à plusieurs paragraphes existent dans les deux bibliothèques : **aucune
>   dépendance nouvelle**, le rendu des documents existants inchangé. Les jetons et les marqueurs se traitent
>   **avant** le rendu, sur la liste d'éléments (section A1-b retirée, plage A3-b régénérée, pointillés pour un jeton
>   vide) — plus simple et plus sûr que de retoucher un `.docx` après coup. Le `.txt` serait **copié dans les
>   ressources du backend** et deviendrait la source du rendu ; le `.docx` du décalque resterait l'objet de relecture,
>   et le comparateur pourrait vérifier aussi le texte du docx produit par le serveur.
> - **Deux limites, pour peser (c)** :
>   - **fidélité** : le **texte** au caractère près, la **mise en forme** celle du moteur (police, tailles, largeurs de
>     colonnes) — c'est déjà le cas des `.docx` du décalque, écrits par POI et non repris de la mise en page du PDF ;
>   - **S6** : la police de base de nos PDF n'a pas le glyphe « ☐ ». Si le pilote le retient, il faut embarquer une
>     police (DejaVu, par exemple) dans le JAR ; tant que S6 reste « absent », rien de plus.
>
> Rien n'est construit avant les décisions du pilote (R1, R4, R11, R12, S6).

> ⚠️ **Livré le 2026-09-26 (backend, V47) — le chantier ouvert par le « oui à tout », avec ces précisions :**
>
> - **Fidélité vérifiée** : les six modèles rendus **bruts** par le moteur (jetons non substitués, test
>   `ModelesCandidatRenduTest`, docx dans `PRS20/target/modeles-candidat/`) passés à
>   `node scripts/modeles-candidat/verifier.mjs <sigle> --docx=…` : **six fois « identique »** (A1 2651 car., A2 515,
>   A3 2190, A4 443, C1 2119, C2 2790). Le gabarit provisoire filigrané est **retiré**.
> - **Source du rendu** : `scripts/modeles-candidat/modeles/<sigle>.txt` (commit front `59eb30c`), copiés tels quels dans
>   `src/main/resources/modeles/candidat/`. Une évolution des modèles = recopier les six `.txt` et rejouer le test ;
>   les `.json` (trace des jetons) ne servent qu'au comparateur.
> - **Moteur** : liste ordonnée d'éléments (`DocumentLibre`), paragraphes `TITRE`/`SOUS_TITRE`/`PARA`/`CENTRE`/`DROITE`/`VIDE`
>   et tableaux à cellules multi-paragraphes, POI (docx) + OpenPDF (pdf), sans dépendance nouvelle. **Le docx et le pdf
>   portent le pied de page de la version** (plan, ligne, version, date) — hors du corps, donc hors du comparateur.
>   Ni filigrane ni numérotation automatique : « Page [numéro de la page] de [nombre total de pages] pages » reste le
>   blanc de la source, au candidat.
> - **Formats des jetons** : `{{CODE}}` montant « 1 600 000 Ariary », date « JJ/MM/AAAA », Oui/Non, liste à choix
>   multiples jointe par des virgules ; `{{CODE.lettres}}` « un million six cent mille ariary » pour un montant,
>   « cinq » pour un nombre ; `{{CODE.doublet}}` « cent cinquième (105ème) », « premier (1er) » — le féminin
>   « première (1re) » existe (N1, précaution). Les 14 vecteurs de la demande sont testés.
> - **N2** : `{{DERIVE.delai-garantie.doublet}}` = `B05-GS-04 − B04-VO-01` (pointillés si l'un manque ou si la
>   différence n'est pas positive) ; `{{DERIVE.fin-validite-offre}}` = `B04-LR-03 + B04-VO-01` jours. Calculés à chaque
>   génération, jamais stockés.
> - **N3** : `B03-CQ-09` / `B03-CQ-10` créés (NOMBRE, obligatoires, trois catégories, trois formes, `valeurDefaut` 5 et 3).
>   **`valeurDefaut`** : attribut du champ, servi au référentiel (`ChampFicheMarcheDto.valeurDefaut`), colonne à l'import
>   (absent = inchangé, vide = effacé), API d'administration (400 hors source `SAISIE`) ; **recopié à la création de la
>   fiche** (premier enregistrement — la fiche « virtuelle » servie avant tout enregistrement ne le montre pas encore).
>   Les fiches déjà créées ne le reçoivent pas : le bilan exige la saisie.
> - **N4** : `{{A1B.mention}}` et `{{SI:A1B}}`…`{{FINSI:A1B}}` sur le cadrage `groupement` ; `{{SI:A3B-NATURES}}` régénéré
>   par catégorie (fournitures et services → Fournitures, Services ; travaux → Travaux ; PI → Prestations
>   intellectuelles). Marqueurs jamais imprimés ; mention vide → paragraphe retiré.
> - **R1 / R4 élargis d'un champ** : `B02-OB-03` (numéro de l'AOO) n'existait qu'en fournitures — il est **ouvert aux
>   trois catégories** comme `B03-CQ-01`, puisque A1 à A4 et C1/C2 le portent pour tout appel d'offres. Le fichier des
>   fournitures gagne deux colonnes (`categories`, `valeurDefaut`) ; base déjà chargée :
>   `PRS20/docs/referentiel/2026-09-26-modeles-officiels-candidat.sql`, après V47.
> - ⚠️ **Limite à décider** : les jetons portent les **codes du référentiel des fournitures**. En travaux et en
>   prestations intellectuelles, la garantie de soumission a d'autres codes (`B05-GQ-03` montant, `B04-DV-01` validité
>   des offres, `B04-OV-02` remise des offres) : C1 / C2 y impriment des **pointillés** à ces blancs, tant qu'un alias
>   de jeton par catégorie n'est pas contractualisé. A1 à A4 y sont complets (`B02-OB-03`, `B03-CQ-01`, `-09`, `-10`
>   des trois catégories).

### N1 — ce que le formateur doit rendre

Le comportement attendu, éprouvable ligne à ligne :

| n | forme longue | abrégée |
|---|---|---|
| 1 | premier · **première** | 1er · 1re |
| 2 | deuxième | 2ème |
| 4 | quatrième | 4ème |
| 5 | **cinquième** (cinq → cinqu) | 5ème |
| 9 | **neuvième** (neuf → neuv) | 9ème |
| 15 | quinzième | 15ème |
| 21 | **vingt et unième** (jamais « vingt et premier ») | 21ème |
| 30 | trentième | 30ème |
| 71 | soixante et onzième | 71ème |
| 75 | soixante-quinzième | 75ème |
| 80 | **quatre-vingtième** (chute du « s ») | 80ème |
| 100 | centième | 100ème |
| **105** | **cent cinquième** | **105ème** |
| 1000 | millième | 1000ème |

⚠️ **L'abrégé s'écrit « ème »**, comme la source — pas « 105ᵉ ». On décalque le dossier, pas la typographie idéale.

**Compte des trous** : 19 alimentés par la fiche ou dérivés, une cinquantaine laissés au candidat — dont 15 des 19
dans les deux seules garanties.

## Hors V1 — la copie numérique du bordereau dans l'offre

Décidé sur le principe, **pas construit en V1**. Il s'agit d'autoriser le candidat à joindre le classeur
Excel rempli (clé USB ou CD) en plus de l'original papier signé, pour que la Commission l'importe à
l'évaluation au lieu de ressaisir les prix.

Cela relève du **DPAO**, donc de la fiche, et demande trois choses le jour où ce sera engagé :

1. une **question de cadrage** « Copie numérique du bordereau exigée » — oui / non, **non par défaut**
   (nouvelle clé de cadrage, à accepter côté serveur comme les autres) ;
2. si **oui**, une **mention dans le contenu de l'offre** (`B04-CO-01`) : le candidat joint le classeur
   rempli, **le papier signé faisant foi** en cas d'écart ;
3. côté Commission, l'import du classeur à l'évaluation — hors du périmètre de la fiche.

## Ce qui manque au jeu de données 2463 pour générer ces formulaires

La fiche 12 (ligne 303088, cinq lots) porte 112 informations et produit sept documents. Pour produire en plus
les formulaires du candidat, il lui manque **tout le besoin** : douze articles et leurs caractéristiques, que
le dossier réel donne pourtant pages 40-44 (quantités) et 57-61 (spécifications).

| lot | articles | quantités min/max (BP, p. 40-44) |
|---|---|---|
| 1 | ordinateur de bureau complet Core i5 · onduleur | 15/30 · 10/20 |
| 2 | kit Core i3 + onduleur + imprimante jet d'encre · kit Core i5 + onduleur | 8/16 · 13/26 |
| 3 | imprimante laser multifonction A4 · photocopieuse A4/A3 · duplicopieur A4 | 3/6 · 1/2 · 1/2 |
| 4 | *identiques au lot 2* | 8/16 · 13/26 |
| 5 | *identiques au lot 3* | 3/6 · 1/2 · 1/2 |

Les caractéristiques exigées sont dans les spécifications techniques : 8 Go de mémoire, SSD 500 Go, moniteur
22 pouces au minimum, clavier AZERTY, Windows 10 Professionnel 64 bits en français, onduleur 390 W / 1200 VA,
etc. — de trois à huit exigences par article. **Les lots 4 et 5 valident le geste « dupliquer depuis le lot
n » sur un cas réel.**

⚠️ **Et un avertissement sur le contrôle du taux.** Le dossier réel **ne donne pas** les montants maximum :
nous les avons **déduits** des garanties en appliquant 2 % (cf. la traçabilité, §B05). Vérifier sur ce jeu que
« la garantie vaut 2 % du maximum » reviendrait à vérifier notre propre calcul. Le contrôle ne sera réellement
éprouvé que sur un dossier où les deux valeurs sont données **indépendamment** — raison de plus pour qu'il
reste un **avertissement**, comme le pilote l'a tranché.

Deux indices invitent d'ailleurs à la prudence : les lots 1 et 3 portent la **même** garantie de 1 600 000 Ar
alors que leurs besoins n'ont rien de comparable — 50 unités d'un côté, 10 de l'autre. Soit les montants
maximum sont réellement égaux, soit la garantie n'est pas strictement proportionnelle dans la pratique.

## Les arbitrages du pilote, pour mémoire

| | décision |
|---|---|
| code du bloc | **neuf : `B12`** ; `B11`, `B11-FR-06` et `B11-AN-02` restent intacts — un code utilisé ne se réaffecte jamais |
| qui rédige | **la PRMP** — pas de rôle « service bénéficiaire » ; `B12` suit les droits et le circuit de la fiche |
| formats | Word pour A1-A4 et C1/C2, Excel protégé pour bordereau et conformité ; modèles officiels stockés tels quels, seuls les blancs sont des champs ; **le pilote fournit les modèles**, gabarit provisoire filigrané en attendant (§B8) |
| copie numérique du bordereau | relève du DPAO ; question de cadrage + mention à `B04-CO-01`, le papier faisant foi — **documentée, hors V1** |
| taux de garantie | **avertissement non bloquant** ; taux et bornes administrables, départ à 2 % ; **rien en dur** |
| périmètre | A1-A4 et C1/C2 : **toutes catégories** · besoin, bordereau, conformité, liste : **fournitures en V1** ; travaux gardent leur DQE ; pas de bloc Besoin en prestations intellectuelles |
| lots répétés | **« Dupliquer depuis le lot n »** en V1, chaque lot modifiable ensuite ; catalogue réutilisable plus tard |
| rendu du bloc | **générique** : le bloc déclare son rendu (§B6), jamais un cas `B12` écrit en dur |
| versions validées | **jamais migrées** : affichées telles quelles avec la mention « ancienne valeur » ; ressaisie obligatoire à la révision, aucune conversion |
| TVA | le front **ne met pas 20 % en dur** : sans le paramètre, l'aperçu dit « Taux de TVA non disponible » (§B7, bloquant) |
