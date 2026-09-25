# Demande backend — les formulaires du candidat : le besoin par lot et sa génération

*Front → backend, 25/09/2026. Suite de l'esquisse de conception « Les formulaires du candidat » (pilote),*
*et de la traçabilité `docs/correspondance-2026-09-25-fiche-dao-vs-dossier-2463.md`, qui liste comme*
*« hors fiche » les trente pages que cette demande vise à faire entrer dans la chaîne.*
*⚠️ Les sept arbitrages du pilote du 25/09 sont intégrés ; deux points restent marqués* **à confirmer**.

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

### Qui écrit le besoin

⚠️ **À confirmer par le pilote.** La cible est : **le service bénéficiaire rédige le besoin, la PRMP le
valide** — c'est lui qui écrit les spécifications techniques dans la vraie vie.

**En V1, la PRMP (et son UGPM) saisit seule** : les endpoints ci-dessus s'ouvrent à `PRMP`/`UGPM`, comme le
reste de la fiche. Prévoir dès maintenant la **place du rôle** dans le modèle — un `redigePar` sur l'article,
ou un statut du besoin (`BROUILLON` / `SOUMIS_A_LA_PRMP` / `VALIDE`) — pour ne pas avoir à migrer plus tard,
mais **ne pas conditionner l'écriture à ce rôle** tant qu'il n'existe pas.

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

## B2 — Les trois champs existants que le besoin rend faux *(fournitures)*

- **`B02-AU-03` « Quantités minimum et maximum »** (`TEXTE_LONG`) ne renvoie plus au bordereau : le besoin le
  porte. À **retirer du référentiel fournitures**, ou à servir en lecture seule, dérivé du besoin.
- **`B09-LL-01` « Lieu de livraison »** est aujourd'hui un `TEXTE_LONG` **unique** : dans le 2463, il empile
  « lot 1 Ministère, lots 2 et 3 Ambatondrazaka, lots 4 et 5 Fort-Dauphin ». La liste des fournitures a besoin
  d'un **lieu par lot** → passer le champ en **`parLot`**, comme `B06-EO-12`.
- **`B04-CD-01`** (fiches A1-A4 jointes) et **`B04-CD-02`** (forme de la garantie jointe) sont des textes
  libres, alors qu'ils **commandent** ce qui est généré. Il faut qu'ils deviennent exploitables : une liste à
  choix multiples pour les fiches (A1, A2, A3, A4), une liste simple pour la garantie (C1, C2, les deux).
  ⚠️ Ces deux champs valent pour **toutes les catégories**, puisque A1-A4 et C1/C2 sont générés partout.

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

---

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
| qui rédige | service bénéficiaire, validation PRMP — **à confirmer** ; **V1 : la PRMP saisit seule**, le rôle est prévu au modèle |
| formats | Word pour A1-A4 et C1/C2, Excel protégé pour bordereau et conformité ; modèles officiels stockés tels quels, seuls les blancs sont des champs ; **conformité aux dossiers types à confirmer** |
| copie numérique du bordereau | relève du DPAO ; question de cadrage + mention à `B04-CO-01`, le papier faisant foi — **documentée, hors V1** |
| taux de garantie | **avertissement non bloquant** ; taux et bornes administrables, départ à 2 % ; **rien en dur** |
| périmètre | A1-A4 et C1/C2 : **toutes catégories** · besoin, bordereau, conformité, liste : **fournitures en V1** ; travaux gardent leur DQE ; pas de bloc Besoin en prestations intellectuelles |
| lots répétés | **« Dupliquer depuis le lot n »** en V1, chaque lot modifiable ensuite ; catalogue réutilisable plus tard |
