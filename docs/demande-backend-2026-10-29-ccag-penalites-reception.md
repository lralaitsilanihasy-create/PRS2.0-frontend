# Demande backend — 2026-10-29 — CCAG : pénalités de retard et réception des commandes

## Contexte

Décision du pilote du 29/10 : « suivre les textes en vigueur ». Les hypothèses de la réception des commandes (lot MS-4, V127 ; lot 3,
V148) se lisent dans les trois CCAG que le serveur embarque lui-même (`src/main/resources/modeles/dao-fixes/` :
`FOURNITURES_SERVICES-CCAG.docx`, `TRAVAUX-CCAG.docx`, `PRESTATIONS_INTELLECTUELLES-CCAG.docx`). Lecture du front, à valider par le
juriste. La recette réelle du 29/10 (procédure 5, travaux, marché à commandes) a montré deux des écarts ci-dessous : pénalité à 1 ‰ et
« sans délai de garantie : la réception provisoire vaut définitive ».

## B1 — Le taux de la pénalité journalière suit le CCAG de la catégorie

Aujourd'hui : `ReceptionCommandeService.TAUX_DEFAUT = 1` (‰), pour toutes les catégories, hypothèse du lot MS (« pénalité 1 ‰ »).

| CCAG | Article | Taux journalier | Plafond |
|---|---|---|---|
| Fournitures et services courants | 12.1 et 12.2 | **1/1000** | 15 % |
| Travaux | 20.1 et 20.4 | **1/2000** | 15 % |
| Prestations intellectuelles | 16.1 et 16.4 | **1/2000** | 10 % |

Chaque fois « sauf stipulation différente du CCAP ». Demandé : à défaut de taux saisi au PV et de taux au CCAP de la fiche (si un champ
le porte), le taux par défaut est celui du CCAG de la catégorie : 1 ‰ en fournitures et services, **0,5 ‰ en travaux et en
prestations intellectuelles**. `penaliteNote` cite l'article. Le plafond par catégorie est déjà juste (15 % / 10 %).

## B2 — La base de la pénalité : la commande en retard

CCAG fournitures, art. 12.1 : « En cas de retard dans l'exécution du Marché, qu'il s'agisse de l'ensemble du Marché ou d'une partie, d'un
lot ou d'une commande pour laquelle un délai d'exécution partiel ou une date limite a été fixé, il est appliqué une pénalité journalière
de 1/1000 du montant de l'ensemble du Marché ou de la partie du Marché considérée ». Travaux (20.1) et PI (16.1) : « du montant de
l'ensemble du Marché ou de la tranche considérée ».

Le lot 3 (V148, Q4 sur la proposition du front) a retenu la **valeur livrée en retard**. La lecture du CCAG désigne plutôt **le montant
de la commande** (le bon, qui a son propre délai) : la partie du marché pour laquelle un délai a été fixé. Demandé : base = montant HT
du bon, jours de retard = de l'échéance du bon à la livraison qui l'achève (la dernière, en cas de livraisons partielles). Si le
juriste retient l'autre lecture, garder la règle actuelle : le dire en réponse.

## B3 — La garantie d'une réception partielle

CCAG fournitures, art. 22.2 : « Lorsque le Marché prévoit à la fois des livraisons par tranches et un délai de garantie, chaque livraison
fait l'objet d'une réception provisoire partielle et puis d'une réception définitive partielle à l'issue du délai de garantie. Dans ce
cas, la dernière réception provisoire partielle et la dernière réception définitive partielle valent respectivement réception provisoire
et réception définitive ».

Aujourd'hui (V148) : « le délai de garantie part de la dernière réception acceptée ». Demandé : une garantie **par réception
partielle**, à compter de sa date ; la réception définitive partielle de chaque livraison à son terme (alerte
`RECEPTION_DEFINITIVE_A_PRONONCER` par réception) ; le bon `RECU_DEFINITIF` à la dernière.

## B4 — En travaux, une garantie d'office

CCAG travaux, art. 44.1 : « Le délai de garantie est, sauf stipulation différente du Marché […], d'un an à compter de la date d'effet de
la réception ou de six mois à compter de cette date si le Marché ne concerne que des travaux d'entretien ou des terrassements ».

Aujourd'hui (`ReceptionCommandeService.garantieMois`, l. 789-801) : sans `B09-GT-01` saisi, aucune garantie (« la réception provisoire
vaut définitive », l. 750). Demandé, en travaux : à défaut de `B09-GT-01`, **12 mois** (6 mois si le marché ne porte que sur de
l'entretien ou des terrassements — à reconnaître comment ? Q1). En fournitures, l'art. 23.1 ne prévoit une garantie que « si le Marché
prévoit un délai de garantie contractuelle » (12 mois à défaut de durée) : la règle actuelle y est conforme.

## B5 — Le délai de décision de la commission de réception (rappel)

CCAG fournitures, art. 22.1 : la décision de réception, d'ajournement, de réfaction ou de rejet est notifiée au fournisseur « dans un
délai qui, sauf disposition différente du CCAP, ne peut excéder quinze jours à compter de la fin des opérations préalables à la
réception ». Demandé : une échéance `decisionAvantLe` (livraison + 15 jours) sur la réception, et une alerte au président de la
commission à son approche, puis une fois dépassée. Rien de bloquant.

## Questions

- **Q1** — Comment reconnaître un marché de travaux « ne concernant que des travaux d'entretien ou des terrassements » (garantie de six
  mois) : une case du CCAP, la nature de la ligne du plan, ou laisser 12 mois et la saisie de `B09-GT-01` ?
- **Q2** — B2 : base de la pénalité = montant du bon (lecture du front) ou valeur livrée en retard (règle actuelle) ? À confirmer par le
  juriste.

## Ce que fera le front

- B1, B2 : rien (le PV affiche déjà le taux, la base et la note servis) ; le libellé du champ « Taux de pénalité (‰ par jour ; vide :
  1 ‰) » dira le taux par défaut servi pour la catégorie, s'il est servi (sinon « vide : taux du CCAG »).
- B3 : la frise de réception montrera la définitive partielle de chaque livraison.
- B5 : l'échéance de décision et son alerte dans la réception du bon et dans « Réceptions » du membre.

## ⚠️ Décision du pilote (2026-10-29) sur Q1 et Q2

Aucun texte du dossier ni du portail CNLEGIS (non interrogeable automatiquement) ne tranche ces deux points. Le pilote retient les règles
d'attente comme **règles définitives** :

- **Q1 (garantie de 6 mois en travaux)** — **12 mois par défaut** en travaux quand `B09-GT-01` n'est pas saisi (B4) ; la PRMP saisit
  6 mois pour un marché d'entretien ou de terrassement. Aucune reconnaissance automatique de l'objet du marché.
- **Q2 (base de la pénalité)** — la **règle actuelle** est retenue : la valeur livrée en retard, chaque livraison avec ses propres jours
  de retard (V148). **B2 est retiré** : rien à changer.
