# Demande backend — 2026-10-29 — Bons de commande et réception : quantités, TTC, réception partielle

## Contexte

Lot 3 du plan du 29/10 sur les trois formes de marché. Il concerne le module commun au marché à commandes et au contrat-cadre :
bons de commande (lot MS-3, V126) et réception des commandes (lot MS-4, V127). La documentation du serveur annonce elle-même ce qui
manque (`docs/api-endpoints.md`) :

> Bons de commande — **Pas encore** : un plafond **en quantité** par article (seul le montant est contrôlé) ; le TTC (le bon porte
> le hors taxes) ; …
>
> Réception des commandes — **Pas encore** : la réception partielle (par article) ; …

Ce lot ne dépend d'aucun arbitrage du pilote déjà posé (A1 à A6). Les questions propres au lot sont en fin de document.

Rappel : le front ne teste plus que `A_COMMANDE` / `CONTRAT_CADRE` pour la forme du contrat (front 9ef3fde ; il attendait à tort
`MARCHE_A_COMMANDES`).

## B1 — Plafond en quantité par article (marché à commandes)

Aujourd'hui, `BonCommandeService` contrôle le **montant** : le cumul de l'année contractuelle ne dépasse pas le maximum annuel
(`B05-TP-03`, 409 `MAXIMUM_DEPASSE`). La quantité commandée d'un article n'est bornée par rien. Pourtant le besoin d'un marché à
commandes porte, par article, une `quantiteMin` et une `quantiteMax` (`FicheArticle.QUANTITE_MIN / QUANTITE_MAX`, contrôle min ≤ max
dans `ControlesFicheMarche`, l. 927-928), et l'estimation du marché est « quantité max × prix » (`FicheMarcheService.besoinValide`).

Demandé, pour un bon de marché à commandes dont la ligne porte un `idArticle` :

- refuser l'émission quand le cumul des quantités de cet article, sur les bons **émis** (annulés exclus) de la même **année
  contractuelle**, dépasserait sa `quantiteMax` : 409 `QUANTITE_MAX_DEPASSEE` avec `details` = `{ rang, idArticle, quantiteMax,
  dejaCommande, demande }` ;
- dans `Consommation`, par article du besoin, ce qui est commandé et ce qui reste :
  `articles[{ idArticle, designation, unite, quantiteMin, quantiteMax, commandeAnnee, resteQuantite }]`, pour que le front affiche le
  reste à côté de chaque ligne du bon ;
- une alerte `QUANTITE_MIN_NON_ATTEINTE` (jumelle de `MINIMUM_NON_ATTEINT`), à 30 jours au plus de la fin de l'année contractuelle,
  quand un article n'a pas atteint sa `quantiteMin`. Signalée seulement, jamais bloquante.

Une ligne saisie sans `idArticle` (offre déposée par pièces, contenu purgé) n'est pas bornée en quantité : le montant reste le seul
contrôle, comme aujourd'hui.

> ⚠️ **2026-10-29 — livré (PRS20, V148), avec ces précisions.**
> - Plusieurs lignes du même article dans un bon s'additionnent ; `details.rang` est la **première** ligne de l'article.
> - `QUANTITE_MAX_DEPASSEE` passe **avant** `MAXIMUM_DEPASSE` : un bon qui dépasse les deux reçoit le premier.
> - `articles[]` suit l'ordre du besoin ; il est **vide** pour un contrat-cadre ; `resteQuantite` est nul sans `quantiteMax`.
> - **`QUANTITE_MIN_NON_ATTEINTE` n'est servie que dans `Consommation.alertes`**, pas dans `ContratVigueurDto.alertes` (le contrat en
>   vigueur ne lit pas le besoin), contrairement à `MINIMUM_NON_ATTEINT` qui est dans les deux.

## B2 — Le montant TTC du bon (marché à commandes et contrat-cadre)

Le bon ne porte que le hors taxes (`montantHt`). Le titulaire facture TTC, et l'attribution connaît déjà les deux montants
(`Attribution.montant` / `montantTtc`).

Demandé :

- sur le bon : `tauxTva` (en %, figé à l'émission), `montantTva` et `montantTtc`, arrondis au centime comme le hors taxes ;
- dans le document du bon (PDF et Word) : total HT, TVA, total TTC ;
- dans `Consommation` : `cumulTtc` à côté de `cumulHt`. Les plafonds (maximum annuel, montant du marché subséquent) restent
  contrôlés **en HT**, comme aujourd'hui (voir Q2).

**Q1** décide d'où vient le taux.

> ⚠️ **2026-10-29 — livré (PRS20, V148) sur la proposition de Q1 et Q2.**
> - Taux = (TTC − HT) / HT de l'offre du titulaire à l'attribution, à deux décimales : sa ligne de titulaire d'un contrat-cadre
>   (`AttributionTitulaire`), sinon l'attributaire du lot ; à défaut `FICHE_TAUX_TVA`. **Sans aucune source, `tauxTva`, `montantTva`
>   et `montantTtc` sont nuls** (le document n'imprime alors pas les lignes TVA et TTC).
> - Les trois champs sont **en fin** de `BonCommandeDto`.
> - **Un bon émis avant V148 n'a pas de TVA** : rien n'est recalculé ; `cumulTtc` ne compte que les bons qui portent un TTC.
> - Document : lignes « TVA (n %) » et « Total toutes taxes comprises » dans le tableau, « soit … Ariary toutes taxes comprises » dans
>   la phrase d'arrêté.

## B3 — La réception partielle par article

Aujourd'hui une réception porte sur **tout** le bon : la décision (`RECEPTION`, `AJOURNEMENT`, `REFACTION`, `REJET`) vaut pour
l'ensemble ; `montantReceptionne` = montant du bon − réfaction ; une seule réception à la fois.

Demandé :

- **à la livraison** (`POST …/bons/{idBon}/livraison`, titulaire ou PRMP/UGPM) : les quantités livrées par ligne du bon,
  `lignes[{ rang, quantiteLivree }]`, chacune entre 0 et le reliquat de la ligne (400 `QUANTITE_LIVREE_INVALIDE`). Sans `lignes`,
  la livraison vaut pour tout le reliquat, comme aujourd'hui ;
- **au PV** (`POST /api/receptions-commandes/{id}/pv`, président) : les quantités **reçues** par ligne,
  `lignes[{ rang, quantiteRecue }]`, au plus la quantité livrée ; `montantReceptionne` = Σ quantité reçue × prix unitaire, moins
  la réfaction s'il y en a une ;
- **reliquat** : tant qu'une ligne n'est pas entièrement reçue, le bon reste ouvert à une nouvelle livraison (nouvel état
  `RECU_PARTIEL`, ou équivalent). La réception provisoire du bon n'est prononcée (`RECU_PROVISOIRE`) qu'avec la dernière quantité.
  Voir **Q3** ;
- dans `ReceptionCommandeDto` et `DuBon` : par ligne, commandé, livré, reçu, reliquat ; et dans le PV de réception, le tableau des
  quantités.

**Pénalité indicative** : aujourd'hui, montant du bon × taux × jours de retard. Avec des livraisons partielles, elle devrait porter
sur la **valeur livrée en retard** (chaque livraison avec ses propres jours de retard). Voir **Q4**.

> ⚠️ **2026-10-29 — livré (PRS20, V148 : table `t_reception_ligne`) sur les propositions de Q3 et Q4, avec ces précisions.**
> - **Livraison** : une ligne **omise** de `lignes` vaut 0 (sans `lignes` du tout : tout le reliquat). Au moins une quantité positive.
>   `details` de `QUANTITE_LIVREE_INVALIDE` = `{ rang, reliquat }`.
> - **PV** : une ligne omise vaut sa **quantité livrée** (le front préremplit, mais un oubli ne ramène pas la ligne à 0). Ajournement ou
>   rejet : rien de reçu, `lignes` ignorées. Réception ou réfaction : au moins une quantité reçue positive. Code d'erreur
>   **`QUANTITE_RECUE_INVALIDE`** (`details` = `{ rang, quantiteLivree }`), nouveau. La **réfaction** est bornée par la **valeur
>   reçue**, plus par le montant du bon.
> - **État** : `RECU_PARTIEL` (le nom proposé). Le délai de garantie part de la dernière réception acceptée.
> - **`DuBon.lignes[]`** : `{ rang, idArticle, designation, unite, commande, livre, recu, reliquat }` ; `livre` cumule toutes les
>   livraisons déclarées, **ajournées et rejetées comprises** ; `recu` ne compte que les PV signés qui acceptent.
> - **`ReceptionCommandeDto`** : `valeurLivree` (base de la pénalité) et `lignes[{ rang, idArticle, designation, unite, prixUnitaire,
>   quantiteCommandee, quantiteLivree, quantiteRecue }]`, en fin d'objet ; `quantiteRecue` nulle avant le PV.
> - **Réceptions d'avant V148** (sans lignes) : elles valent tout le bon ; leurs `lignes` sont vides et leurs montants restent ceux
>   du bon.
> - PV : tableau N°, désignation, unité, commandé, livré, reçu, **reliquat après ce PV**, puis « Montant réceptionné : … ».

## Questions au pilote (ou au juriste)

- **Q1 — Taux de TVA du bon.** Trois sources possibles :
  - (a) le paramètre `FICHE_TAUX_TVA` des bordereaux (V45-V46), figé à l'émission ;
  - (b) le rapport `montantTtc / montant` de l'attribution, qui suit l'offre retenue (y compris une offre exonérée) ;
  - (c) un taux saisi par la PRMP sur le bon.

  Proposition : (b) quand l'attribution porte les deux montants, (a) sinon. Un titulaire exonéré aurait alors un TTC égal au HT.
- **Q2 — Plafonds en HT ou TTC ?** Le maximum annuel (`B05-TP-03`) et le montant retenu du marché subséquent sont-ils des montants
  HT ? Le serveur les contrôle en HT aujourd'hui ; ce lot ne change rien sans réponse contraire.
- **Q3 — Réception partielle : un PV par livraison, ou un PV par bon ?** Proposition : un PV par livraison (chaque livraison est
  reçue, ajournée ou rejetée pour ce qu'elle apporte), et la réception provisoire du bon une fois tout reçu. Le délai de garantie
  part alors de la **dernière** réception.
- **Q4 — Pénalité de retard sur une livraison partielle** : sur la valeur livrée en retard (proposition), ou sur tout le bon ?
- **Q5 — Contrat-cadre : un plafond en quantité ?** Le devis de l'offre retenue d'un marché subséquent n'est pas structuré (prix
  saisis, `BonCommandeService`). Sans articles structurés au marché subséquent, B1 ne vaut que pour le marché à commandes.
  Faut-il structurer le devis du marché subséquent (lot à part), ou s'en tenir au plafond en montant ?

> ⚠️ **2026-10-29 — sur demande de l'utilisateur, le serveur livre sur les propositions du front**, à confirmer par le pilote : Q1 (b)
> puis (a) ; Q2 plafonds en HT, inchangés ; Q3 un PV par livraison ; Q4 sur la valeur livrée ; Q5 plafond en montant seul pour le
> contrat-cadre (pas de devis structuré). Une réponse contraire du pilote rouvrira le point concerné.

## Ce que fera le front

Une fois le contrat livré :

- **bons** (`bons-commande-contrat.ts`) : reste en quantité à côté de chaque article ; refus `QUANTITE_MAX_DEPASSEE` nommé sur la ligne ;
  total HT, TVA, TTC ;
- **consommation** : quantités par article et alerte de quantité minimale ;
- **livraison** (PRMP/UGPM et espace candidat) : quantités livrées par ligne, préremplies au reliquat ;
- **PV de réception** (président de la commission) : quantités reçues par ligne, montant réceptionné recalculé, reliquat affiché ;
  nouvel état du bon dans la frise de réception.

Rien n'est construit avant la réponse.

> ⚠️ **Front, 2026-10-29 — livré** (sur PRS20 7b67b12, V148).
> - **Bons** (`features/bons-commande/bons-commande-contrat.ts`) : le refus `QUANTITE_MAX_DEPASSEE` nomme la ligne, le maximum,
>   le déjà commandé et la demande ; le choix d'un article dit son reste de l'année (« Ramette A4 — reste 20 ») ; chaque bon montre son
>   TTC et son taux sous le HT (rien pour un bon d'avant V148) ; le cumul TTC suit le cumul HT.
> - **Consommation** : tableau des articles du marché à commandes (minimum, maximum, commandé cette année, reste) et alerte
>   `QUANTITE_MIN_NON_ATTEINTE`.
> - **Livraison** (PRMP/UGPM dans `receptions/receptions-bon.ts`, titulaire dans `candidat/bons-commande-titulaire.ts`) : un composant
>   commun, `receptions/quantites-lignes.ts`, ne montre que les lignes à reliquat, préremplies au reliquat ; toutes ces lignes sont
>   envoyées (une ligne omise vaudrait 0). L'état `RECU_PARTIEL` ouvre une nouvelle livraison.
> - **PV** : en réception ou réfaction, quantités reçues par ligne, préremplies à la quantité livrée ; ajournement et rejet n'envoient
>   aucune quantité. Le bon montre commandé, livré, reçu et reliquat par ligne ; chaque réception, ses quantités et sa valeur livrée.
> - Le libellé de `REFACTION_INVALIDE` dit désormais « inférieur à la valeur reçue ».
> - Non recetté à l'écran : aucun contrat en vigueur en base depuis le reset du 28/10. Les réponses Q1-Q5 du pilote restent attendues.

> ⚠️ **Front, 2026-10-29 — état des questions après lecture des textes** (`D:\TEXTES MP`, CCAG embarqués par le serveur ; décision du
> pilote : « suivre les textes en vigueur »).
> - **Q3 (un PV par livraison)** : **confirmée** par le CCAG fournitures, art. 22.2 (« réception séparée, dite réception partielle » ;
>   la dernière vaut réception de l'ensemble). La garantie par réception partielle est demandée dans
>   `demande-backend-2026-10-29-ccag-penalites-reception.md`, B3.
> - **Q4 (base de la pénalité)** : **décidée** (pilote, 29/10) — la valeur livrée en retard, telle que livrée (V148).
> - **Q5 (plafond en quantité du contrat-cadre)** : **non** — les quantités d'un contrat-cadre sont indicatives et l'acheteur ne s'engage
>   sur aucun minimum (décret n° 2019-1064, art. 6, 8, 11, 34) ; le plafond en montant du marché subséquent suffit.
> - **Q1 (source du taux de TVA)** et **Q2 (plafonds en hors taxes)** : aucun texte lu ne les traite — **décidées** (pilote, 29/10) :
>   la livraison actuelle est retenue (taux de l'offre, à défaut celui des bordereaux ; plafonds en HT).
> - Toutes les questions de cette demande sont donc closes.
