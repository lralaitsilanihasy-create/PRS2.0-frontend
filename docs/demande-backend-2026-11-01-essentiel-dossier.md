# Demande backend — 2026-11-01 — L'essentiel d'un dossier, et la date du dispatch dans l'historique

## Contexte

Le 01/11, le pilote a retenu la variante A de la maquette « page du dossier ». Le front en a livré le lot 1 avec les routes
existantes :

- l'en-tête du dossier en bleu nuit ;
- la chaîne de la procédure, lue sur `GET /api/dossiers/{id}/filiation` ;
- les éléments du dossier rangés par phase ;
- l'historique ouvert en fenêtre par le bouton « Historique » ou la touche H, lu sur `GET /api/dossiers/{id}/historique` et
  regroupé par phase.

Il manque une bande **« L'essentiel »**, sous l'en-tête. Elle dit d'un coup d'œil ce qu'est devenu le dossier :

| Case | Exemple (00009/MAOO-CC/CNM/2026) |
|---|---|
| Avis de la CNM | Favorable · PV 00009/MAOO-CC/CNM/PV/2026, définitif |
| Attributaire, par lot | SAVA Routes et Ouvrages SA · offre n° 1 · 11 279 883 606 Ar |
| Contrat | Contrat cadre · signé le 14/09/2026 · jusqu'au 16/09/2027 |
| Suites | 1 bon de commande · version 1 du 05/10/2026 |

Aucune route ne sert ces quatre faits ensemble. L'historique en porte des morceaux, en texte libre dans `detail` (par exemple
« Contrat cadre, jusqu'au 16/09/2027 »). Le front ne doit pas les extraire de phrases.

## B1 — L'essentiel d'un dossier

`GET /api/dossiers/{idDossier}/essentiel`

- **Accès** : les mêmes lecteurs que `GET /api/dossiers/{id}`. Pour la PRMP et l'UGPM, la même visibilité que l'historique :
  - l'avis seulement d'après un PV **signé** ;
  - aucun nom de contrôleur.
- **Réponse** : chaque bloc vaut `null` quand il n'existe pas encore. Un dossier de planification n'a ni attribution, ni
  contrat, ni suites.

```json
{
  "avis": { "code": "FAV", "libelle": "Favorable", "refePv": "00009/MAOO-CC/CNM/PV/2026", "definitif": true, "idPv": 41 },
  "attributions": [
    { "lot": 1, "attributaire": "SAVA Routes et Ouvrages SA", "numeroOffre": 1, "montant": 11279883606, "idDossierMarche": 100398 }
  ],
  "contrat": { "forme": "CONTRAT_CADRE", "libelleForme": "Contrat cadre", "signeLe": "2026-09-14", "finLe": "2026-09-16" },
  "suites": { "bonsCommande": 1, "dernierBon": { "numero": 1, "date": "2026-10-05T11:00:00" }, "actesGestion": 0 }
}
```

Précisions sur les champs :

- **`avis`** : celui du dernier PV du dossier. Le PV de la Commission sur le DAO pour un dossier de mise en concurrence ; celui du
  marché pour un dossier de marché.
- **`attributions`** :
  - sur un dossier de **marché**, son seul lot ;
  - sur un dossier de **mise en concurrence**, un élément par lot attribué ;
  - un **montant** est numérique, en ariary : le front le formate.
- **`contrat`** : le contrat du marché. Son `libelleForme` est celui de la forme de marché (`A_COMMANDE`, `CONTRAT_CADRE`…).
- **`suites`** : nombre de bons de commande (ou de marchés subséquents) et le dernier, plus le nombre d'actes de gestion.

Le front affiche une case par bloc non nul. Les cases mènent à l'élément qui les justifie :

| Case | Ouvre |
|---|---|
| Avis | le PV |
| Attributaire | l'élément « Attribution » |
| Contrat | l'élément « Attribution » |
| Suites | l'historique |

Sans réponse (route absente, échec), la bande ne paraît pas.

## B2 — La date du dispatch dans l'historique

Sur 00009/MAOO-CC/CNM/2026, vu par PRES001, `GET /api/dossiers/100398/historique` sert l'élément `DISPATCH` **sans date** :
`acteur` PRES001, `detail` « attribué à MEMANT1 ». Trié « sans date en dernier », il paraît après le bon de commande du 05/10,
tout en bas de l'historique. Le front l'affiche dans une tranche « Contrôle de la CNM » isolée en fin de liste.

La frise du même dossier date pourtant le dispatch au 25/08 (`datesEtapes`). Demande : servir la `date` du `DISPATCH`, celle de
l'attribution du dossier au Membre, comme pour les autres éléments du circuit.

## Hors périmètre

La chaîne de la procédure ne montre pas le contrat ni les bons de commande : ils n'ont pas de numéro de dossier et ne sont pas des
nœuds de la filiation. `suites` (B1) en tient lieu dans « L'essentiel ».

> ⚠️ **2026-11-01 — B1, B2 livrés (PRS20, sans migration). Précisions :**
> - **B1** — forme comme demandé. `avis.libelle` vient du référentiel des avis (`tr_avis`). `attributions` : seuls les lots
>   **attribués et non retirés** ; l'attributaire est l'offre attribuée, à défaut (contrat-cadre multi-attributaire) le titulaire de
>   rang 1. `contrat` : celui du lot du dossier de marché ; pour un dossier de mise en concurrence à plusieurs lots, **le premier lot**.
>   `contrat.signeLe` = date de **signature du marché** (attribution), à défaut la prise d'effet du contrat. `suites` vaut `null` sans
>   bon de commande ni acte de gestion ; `dernierBon` = le plus récemment émis. `libelleForme` : celui de `FormeMarche` (« Contrat cadre »,
>   comme l'exemple).
> - **B2** — `DISPATCH` daté : sa date, à défaut celle de l'affectation au Membre, à défaut la fin du passage DISPATCH du
>   chronométrage (celle de la frise). Sur 100398, le dispatch n'a aucune date propre en base : c'est le dernier repli qui s'applique.