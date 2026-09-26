# Grille de contrôle du sous-type DAO — exemple proposé (2026-09-26)

**Demande du pilote** : « Créer un exemple de grille de contrôle ». Le référentiel des points de contrôle ne contenait
**aucun** point pour la famille DMC / sous-type DAO (`GET /api/points-ctrls?sousType=DAO` → 0) : l'examen d'un dossier
d'appel d'offres n'avait donc que ses pièces à évaluer, et rien à observer sur la fiche DAO (lot B).

Cette grille est un **exemple**, à corriger par la Commission ; elle vit au référentiel (Administrateur → Points de
contrôle) et se pose ou se retire par `node scripts/grille-dao.mjs --poser | --retirer`. Rien n'est codé en dur dans
l'application : l'examen lit la grille servie.

## Ce qui guide l'exemple

- **Portée `DOSSIER`** pour tous les points : un dossier DAO n'a pas de lignes de plan à examiner une à une, ni de
  fiche de présentation, ni d'AGPM ; il a *une* fiche DAO et ses pièces. Les pièces ont déjà leurs étapes propres
  (RAS / observation, pièce par pièce) : la grille ne les redouble pas.
- **Chaque point nomme les informations de la fiche qu'il contrôle** (codes du référentiel `B02-…` à `B12`) : c'est
  là que l'examinateur clique pour poser une observation ancrée (`idDmc` + `champFiche`), et c'est ce que le PV
  imprime.
- **Les contrôles du serveur ne sont pas répétés** : la fiche ne se valide pas si les dates ne s'ordonnent pas
  (`DATES_ORDRE`), si la garantie sort de 1-2 % (`GARANTIE_TAUX`), si une avance de plus de 5 % n'a pas de garantie
  de restitution. La grille porte le jugement de la Commission, pas la forme.
- **Le dossier réel 2463** sert de banc d'essai : ses anomalies (§9 de `jeu-donnees-2463-faits.md`) doivent tomber
  sous au moins un point — c'est le point 12.

## Les douze points

| # | Libellé | Portée | Obl. | Ce que l'examinateur vérifie (informations de la fiche) |
|---|---|---|---|---|
| 1 | Conformité au plan de passation | DOSSIER | oui | Objet, mode (AOO), forme (à commande / quantité fixe / contrat-cadre), catégorie et financement du DAO sont ceux de la ligne du plan examinée et de l'AGPM (B01, B02-OB-01, B02-OB-03). |
| 2 | Allotissement | DOSSIER | oui | Nombre et intitulés des lots, attribution lot par lot ou en totalité, offres partielles, nombre maximal de lots par candidat : identiques entre le DPAO, l'acte d'engagement et le besoin (B02-LV, B02-AU-02, B02-AU-07, B12). |
| 3 | Montants et estimation | DOSSIER | oui | Minimum et maximum de chaque lot (B05-TP-02, B05-TP-03) dans l'enveloppe du plan ; somme des maxima ≤ estimation de la ligne ; cohérence avec les quantités min/max des articles (B12). |
| 4 | Garantie de soumission | DOSSIER | oui | Formes admises (B05-GS-02) conformes au CMP ; montant par lot (B05-GS-03) entre 1 et 2 % du maximum du lot ; validité (B05-GS-04) couvrant la validité des offres plus trente jours (B04-VO-01). |
| 5 | Délais de la consultation | DOSSIER | oui | Validité des offres (B04-VO-01), délais d'éclaircissement (B04-DE-02, B04-DE-03), date et heure de remise et d'ouverture (B04-LR-03, B04-LR-04, B04-OP-02, B04-OP-03) : cohérents entre eux, avec le calendrier du plan et le délai légal de publicité. |
| 6 | Candidats : pièces et capacités | DOSSIER | oui | Pièces exigées (B03-CQ-01, B04-CO-01), fiches de renseignements jointes (B04-CD-01), capacités technique et financière demandées (B03-CQ-02, B03-CQ-03, B03-CQ-09, B03-CQ-10) : proportionnées à l'objet et non discriminantes. |
| 7 | Évaluation et attribution | DOSSIER | oui | Évaluation par lot ou sur l'ensemble (B06-EO-01), critères additionnels (B06-EO-02), détermination de l'offre évaluée (B06-EO-05), offres anormalement hautes ou basses (B06-EO-07), préférence nationale (B03-CQ-08, B06-EO-09) : conformes au CMP. |
| 8 | Paiements, avance et garanties financières | DOSSIER | oui | Avance (taux ≤ 20 %, garantie de restitution, remboursement : B08-AV), acomptes (B08-AC-01), garantie de bonne exécution et retenue (B08-GB, B08-RG), intérêts moratoires (B08-IM-01), délai de paiement (B08-PA-08) : conformes au CCAG. |
| 9 | Pénalités, garantie et dérogations | DOSSIER | oui | Régime et plafond des pénalités (B09-PR-02, B09-PR-03), délai de garantie (B09-DG-01, B09-DG-02) ; toute dérogation au CCAG est justifiée ET récapitulée à l'article « dérogations » du CCAP (B10-DD-01). |
| 10 | Exécution et livraison | DOSSIER | non | Délai de livraison par lot (B06-EO-12), lieux de livraison (B09-LL-01), passation des commandes (B09-DX-03), transport, inspection et réception (B09-RT-01, B09-IV-01, B09-DI-01) : réalistes et cohérents avec le besoin. |
| 11 | Spécifications techniques | DOSSIER | oui | Articles, quantités minimum et maximum, caractéristiques exigées (B12) : précises, mesurables, sans référence à une marque ou à un fournisseur, cohérentes avec les lots et les montants. |
| 12 | Cohérence des mentions du dossier | DOSSIER | oui | Références, intitulés, dates et mentions reprises d'un document à l'autre — numéro de l'appel d'offres sur les plis (B04-RO-02), description de l'objet (B02-OB-02), dates laissées en blanc, restes d'un autre dossier — sans contradiction. |

Sur le dossier 2463, le point 12 relève les deux anomalies conservées (« AOO N° 2461/MT » sur les plis, « matériels
et mobiliers de logements » au DPAO 1.2) ; le point 9 relève que l'article 24 du CCAP ne récapitule pas le plafond de
pénalités à 10 % ; le point 1 relève l'écart entre la destination unique du DPAO 6.5.1 et les cinq du CCAP ; le point 4
n'a rien à dire — les trois formes du DPAO 6.6 sont admises, la garantie vaut 2 % du maximum, 105 jours ≥ 75 + 30.

## Poser, retirer

```bash
node scripts/grille-dao.mjs            # pose les points absents (par libellé), affiche la grille servie
node scripts/grille-dao.mjs --retirer  # retire les points de cet exemple (refusé si un examen les référence : 409)
```

Compte utilisé : `ADMIN01`. Le script est idempotent : un point déjà présent (même libellé) n'est pas recréé.
