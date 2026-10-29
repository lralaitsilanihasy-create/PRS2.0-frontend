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

## B2 — Le montant TTC du bon (marché à commandes et contrat-cadre)

Le bon ne porte que le hors taxes (`montantHt`). Le titulaire facture TTC, et l'attribution connaît déjà les deux montants
(`Attribution.montant` / `montantTtc`).

Demandé :

- sur le bon : `tauxTva` (en %, figé à l'émission), `montantTva` et `montantTtc`, arrondis au centime comme le hors taxes ;
- dans le document du bon (PDF et Word) : total HT, TVA, total TTC ;
- dans `Consommation` : `cumulTtc` à côté de `cumulHt`. Les plafonds (maximum annuel, montant du marché subséquent) restent
  contrôlés **en HT**, comme aujourd'hui (voir Q2).

**Q1** décide d'où vient le taux.

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

## Ce que fera le front

Une fois le contrat livré :

- **bons** (`bons-commande-contrat.ts`) : reste en quantité à côté de chaque article ; refus `QUANTITE_MAX_DEPASSEE` nommé sur la ligne ;
  total HT, TVA, TTC ;
- **consommation** : quantités par article et alerte de quantité minimale ;
- **livraison** (PRMP/UGPM et espace candidat) : quantités livrées par ligne, préremplies au reliquat ;
- **PV de réception** (président de la commission) : quantités reçues par ligne, montant réceptionné recalculé, reliquat affiché ;
  nouvel état du bon dans la frise de réception.

Rien n'est construit avant la réponse.
