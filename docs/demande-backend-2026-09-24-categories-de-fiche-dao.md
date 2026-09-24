# Demande backend — La fiche DAO a trois catégories, pas une (lot 5)

**Date** : 2026-09-24 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : le pilote ouvre le chantier des
travaux — « Il y a 3 catégories de fiches DAO : Fournitures et Services, Travaux et Réhabilitation, Prestations
Intellectuelles. On a fini la fiche DAO pour Fournitures et Services. »

> **Ce que ce lot demande est un axe, pas un contenu.** Quelle que soit la matière des travaux, le référentiel a
> besoin d'une **seconde dimension**. Il n'en a qu'une aujourd'hui, le type de marché, et tout ce qu'il porte est
> implicitement de la catégorie *Fournitures et Services*. Le contenu des travaux fera l'objet d'un lot séparé, dès
> que le fichier de correspondance correspondant sera remis.

## Constat (mesuré sur DBPRS20 le 24/09)

### La catégorie existe déjà dans la donnée, et elle vient du plan

`t_marche.ID_NATURE` pointe sur `tr_nature`, qui porte **sept** entrées :

| id | libellé | lignes de marché |
|---|---|---|
| 1 | Travaux | 8 |
| 2 | Fournitures | 41 |
| 3 | Services | 0 |
| 4 | Prestations intellectuelles | 4 |
| 5 | Fournitures et services | 0 |
| 6 | PRESTATIONS DE SERVICE | 48 |
| 7 | Prestations | 0 |

Le référentiel sert déjà cette information : **`B01-AC-12` « Nature du marché »**, source `PPM`, `clePpm = NATURE`.
Une fiche la reprend telle quelle — la fiche 5 porte « Fournitures ». **La catégorie est donc dérivable du plan,
exactement comme la forme du marché l'est depuis le lot 1c.**

### Le référentiel, lui, n'a qu'un axe

`tr_champ_fiche_marche` porte `TYPES_MARCHE` (quantité fixe, à commande, contrat-cadre) et **rien sur la
catégorie**. Les 265 champs chargés — 151 des fournitures et 114 du contrat-cadre — sont tous, sans le dire, de la
catégorie *Fournitures et Services*. Charger les travaux dans le même référentiel les mélangerait : « Lieu de
livraison » et « Lieu d'exécution des travaux » ne sont pas le même champ, et une fiche de travaux n'a que faire
des incoterms.

### Rien n'est cassé aujourd'hui, mais le défaut est latent

Les huit lignes en appel d'offres du plan signé 100328 sont toutes de nature **Fournitures** ou **Prestations de
service**, donc toutes de la catégorie *Fournitures et Services*. Aucune ligne de travaux ni de prestations
intellectuelles n'est éligible aujourd'hui.

Mais **la première qui le deviendra ouvrira une fiche de fournitures**, sans que rien ne le signale : l'écran
demanderait les incoterms et le lieu de livraison pour un chantier. C'est exactement le défaut que le lot 1c a
corrigé pour la forme du marché, sur l'autre axe.

## Demande

### B1 — La catégorie devient un attribut du référentiel

- Un référentiel de catégories, à trois valeurs : `FOURNITURES_SERVICES`, `TRAVAUX`, `PRESTATIONS_INTELLECTUELLES`.
- **`tr_champ_fiche_marche` porte `CATEGORIES`**, comme il porte `TYPES_MARCHE` : un champ vaut pour une ou
  plusieurs catégories. Les 265 champs existants sont marqués `FOURNITURES_SERVICES` par migration.
- Idem pour les **rubriques** (`tr_rubrique_fiche_marche`) et, si un bloc devait être propre à une catégorie, pour
  les blocs. La règle du lot 4 §B4 s'étend : **une rubrique n'est servie que si au moins un de ses champs vaut pour
  la catégorie ET le type demandés**.
- `GET /api/champs-fiche-marche` prend un paramètre **`categorie`** en plus de `typeMarche`. Sans lui, le contrat
  d'aujourd'hui est conservé — tout est servi, inactifs compris, pour l'écran d'administration.

> ⚠️ **Livraison backend du 2026-09-24 — B1 livré (V40), avec trois écarts.** (1) **Les 23 informations reprises du
> plan valent pour les trois catégories**, pas pour les fournitures seules : ce sont celles de la ligne (entité,
> montant, nature, calendrier…), une fiche de travaux les relit aussi — c'est le piège du lot 4 §B2, évité d'avance.
> Leurs rubriques `B01-AC`, `B02-OB`, `B02-LV` aussi. Conséquence sur le **test 2** : `categorie=TRAVAUX` sert **23
> champs (tous `PPM`) et ces 3 rubriques**, et **aucun** champ saisi ni rubrique des fournitures — pas zéro. Les 12
> reflets de cadrage de V35 restent `FOURNITURES_SERVICES` (leurs rubriques le sont) : le CSV des travaux apportera
> les siens s'il en faut. (2) Les **blocs** portent aussi `CATEGORIES` (les trois, par défaut) : le bloc d'annexes des
> travaux pourra leur être réservé. (3) `categories` des champs : absente = `FOURNITURES_SERVICES` à la création,
> **inchangée** à la modification (l'écran Administrateur ne l'envoie pas encore ; il ne doit pas l'effacer) ; même
> règle pour la colonne `categories` du CSV. `ChampFicheMarcheDto.categories` est servi.
>
> ⚠️ **Pour le CSV des travaux — les rubriques ne se chargent pas par le CSV.** Comme au lot 4 (V39), une rubrique
> (et un bloc, dont celui des annexes) se crée **par migration** ; le `POST` d'un champ exige sa rubrique. Il faudra,
> dans le document de conversion, la **liste des rubriques** (code, bloc, libellé, rang, document maître) et du bloc
> d'annexes : le backend en fera la migration avant l'import des champs.

### B2 — La catégorie de la fiche se déduit du plan

- **`FicheMarcheDto.categorie`** est dérivée de `ID_NATURE` de la ligne courante, relue à chaque lecture, comme
  `typeMarche` l'est de `FORME_MARCHE`. Elle n'est **jamais** une réponse de cadrage.
- **`LigneEligible.categorie`** et **`LigneEligible.categorieOutillee`**, jumeaux de `formeMarche` et
  `formeOutillee` : l'écran de choix de ligne montre la catégorie et n'offre de préparer que ce qui est outillé.
- **`FicheMarcheDto.typeOutille`** (lot 3 §B2) devient vrai seulement si **la catégorie et la forme** le sont
  toutes deux. Le front n'a alors rien à changer : sa page courte couvre déjà ce cas.

> ⚠️ **Livraison backend du 2026-09-24 — B2 livré tel que demandé, plus deux précisions.** (1) Une ligne **sans
> nature** (`ID_NATURE` nul) n'est pas préparable non plus — même règle qu'une forme absente au lot 1c, message qui
> nomme le champ « Nature » du plan ; sur DBPRS20, 0 ligne sur 101. (2) Le refus porte le **même code**
> `FORME_NON_OUTILLEE` (test 6), avec trois messages : nature absente, nature sans catégorie (« à compléter par
> l'Administrateur »), catégorie non outillée (« Cette ligne est de catégorie « Travaux et réhabilitation » ; … »).
> Catégories outillées : `DmcService.CATEGORIES_OUTILLEES` = fournitures et services. Le bilan et les documents ne
> retiennent que les champs de la catégorie de la fiche.
>
> **B5 (tranches) livré** : clé de cadrage `tranches` (`OUI` / `NON`), acceptée pour une fiche de **travaux**
> seulement ; ailleurs, **400** nominatif. Tant que les travaux ne sont pas outillés, une fiche de travaux refuse
> toute écriture (409) : la clé ne s'exercera de bout en bout qu'à l'ouverture des travaux. Si le CSV des travaux
> apporte un reflet `CADRAGE` de clé `tranches`, c'est lui qui la validera.
>
> **FAR (pièces jointes, arbitrage du pilote du 24/09)** : un champ de type `PIECE` n'est désormais **ni attendu ni
> bloquant** au bilan — obligatoire ou non, il ne compte pas dans « informations saisies / attendues » et n'empêche pas
> la validation (il se joint au dossier, il ne se saisit pas dans la fiche). Sans cela, un FAR obligatoire aurait
> bloqué toute validation, sa valeur étant refusée en 400. Le CSV des travaux peut donc les charger tels quels.

### B3 — La correspondance des sept natures vers les trois catégories

Le référentiel des natures ne colle pas aux catégories : sept entrées pour trois catégories, dont trois inutilisées
et deux qui disent la même chose de deux façons.

| nature | catégorie proposée |
|---|---|
| 1 Travaux | `TRAVAUX` |
| 2 Fournitures · 3 Services · 5 Fournitures et services · 6 PRESTATIONS DE SERVICE · 7 Prestations | `FOURNITURES_SERVICES` |
| 4 Prestations intellectuelles | `PRESTATIONS_INTELLECTUELLES` |

La correspondance est **administrable**, pas codée en dur : une colonne `CATEGORIE_DAO` sur `tr_nature`, que
l'Administrateur peut corriger. Une nature sans catégorie rend la ligne non préparable, avec le message qui nomme
ce qu'il faut compléter — même forme que le lot 1c pour une forme absente.

> **À trancher par le pilote** : « PRESTATIONS DE SERVICE » (48 lignes) et « Prestations intellectuelles » (4)
> désignent-elles bien deux catégories différentes ? La première va aux fournitures et services, la seconde à sa
> propre catégorie. Si c'est inexact, seule la ligne du tableau change. Les trois natures à zéro ligne — Services,
> Fournitures et services, Prestations — gagneraient à être retirées du référentiel : elles font double emploi.

> ⚠️ **Livraison backend du 2026-09-24 — B3 livré** : `tr_nature.CATEGORIE_DAO` (V40, contrainte sur les trois
> valeurs), semée **par libellé** selon ce tableau (les identifiants peuvent différer d'une base à l'autre),
> administrable par `PUT /api/natures/{id}` (`categorieDao` : inconnue → 400, **absente → inchangée**, vide → retirée).
> Le retrait des trois natures inutilisées est laissé à l'Administrateur (écran des natures) : rien n'a été supprimé.

### B4 — Ce que ce lot ne fait pas

Il ne charge **aucun champ de travaux** : le fichier de correspondance « DAO Travaux et Réhabilitation » n'a pas
encore été remis. Le lot pose l'axe ; le contenu suivra, converti comme les 116 des fournitures et les 114 du
contrat-cadre, avec son document de conversion.

## Tests attendus (recette backend)

1. `GET /api/champs-fiche-marche?typeMarche=QUANTITE_FIXE&categorie=FOURNITURES_SERVICES` sert les **139** champs
   d'aujourd'hui : le contrat existant ne bouge pas.
2. Le même appel en `categorie=TRAVAUX` sert **zéro** champ et **zéro** rubrique, tant que rien n'est chargé.
3. Une ligne de nature Travaux → `categorie = TRAVAUX`, `categorieOutillee = false`, `typeOutille = false`.
4. Une ligne de nature Fournitures → `categorie = FOURNITURES_SERVICES`, préparable comme aujourd'hui.
5. Une nature sans catégorie → la ligne n'est pas préparable, et le message nomme le référentiel à compléter.
6. La création du DMC et les quatre écritures de la fiche répondent **409** sur une catégorie non outillée, du même
   code que pour une forme non outillée.

## Côté front

**Rien à écrire, ou presque.** La page courte des formes non outillées, livrée le 23/09, couvre déjà le cas : elle
s'affiche dès que `typeOutille` est faux, montre la ligne du plan et explique. Il restera à nommer la catégorie
dans son texte et dans la colonne « Mode et forme » du choix de ligne, ce qui est une phrase.

C'est le bénéfice d'un écran piloté par la donnée : ajouter une catégorie ne demande pas d'écran neuf.

## Pièce manquante

Le **fichier de correspondance « DAO Travaux et Réhabilitation »** — l'équivalent des 37 pages remises le 23/09
pour les fournitures et services. Sans lui, aucun champ de travaux ne peut être converti, et ce lot s'arrête à
l'axe.
