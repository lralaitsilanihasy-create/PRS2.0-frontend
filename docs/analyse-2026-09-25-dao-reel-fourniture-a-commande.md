# La fiche DAO « à commande » confrontée à un vrai dossier d'appel d'offres

*Analyse du 25/09/2026, sur `NatureMarches/DAO_Fournitures/Fourniture_a_commande.pdf` — dossier réel du Ministère
de l'Enseignement Supérieur et de la Recherche Scientifique (AOO n° 2461/MT/MESupReS/PRMP/UGPM.2026, fourniture et
livraison de matériels informatiques en cinq lots, à commande, 87 pages).*

Jusqu'ici la fiche était construite sur le **fichier de correspondance** — la carte des informations, établie par
l'administration. Ce dossier-ci est le produit fini : un DAO réellement publié, ses **données particulières**
remplies clause par clause (p. 17-19), son **acte d'engagement** (p. 36-38), son CCAP et ses spécifications. Il
permet de vérifier non plus ce que le classeur annonce, mais ce qu'un dossier contient vraiment.

## Verdict

**La fiche tient.** Les trente clauses remplies du DPAO réel trouvent leur champ, à huit exceptions près, toutes
listées ci-dessous. Une seule concerne une correction livrée ce matin et demande à être reprise ; les autres sont
des ajouts.

## 1. ⚠️ Une correction de ce matin est contredite par le dossier réel

Nous avons retiré, ce matin, la reprise `AE` de `B02-AU-04` « Durée de validité du marché à commande », parce que le
classeur ne la marque qu'au DPAO. **L'acte d'engagement réel la porte** :

> **ARTICLE 5 - DURÉE - DELAIS** — 5.3 Durée de validité
> « La durée de validité est fixée à **douze (12) mois** à compter de la date d'effet »

Et la clause 1.2 du DPAO la donne également (« pour une durée de validité de douze (12) mois »). L'information est
donc **saisie au DPAO et reprise dans l'acte d'engagement** : la reprise `AE` doit être rétablie.

Les trois autres corrections du matin sont confirmées par le même dossier :

- `B02-AU-03` **quantités** minimum et maximum : l'acte d'engagement ne porte pas de quantités, il porte un
  **montant** minimum et un **montant** maximum (article 2), déjà servis par `B05-TP-02` et `B05-TP-03`. Le DPAO
  renvoie d'ailleurs les quantités au *Cahier des Prescriptions Spéciales* — le retrait de la reprise est juste ;
- `B02-AU-02` attribution des lots et `B05-GS-03` montant de la garantie de soumission : absents de l'acte
  d'engagement réel. Retraits justes.

## 2. Le point de structure : un DAO alloti, c'est un acte d'engagement PAR LOT

Le dossier réel porte cinq lots, et :

- la **garantie de soumission** est donnée **lot par lot** — cinq montants distincts (1 600 000 Ar pour les lots 1,
  3 et 5 ; 2 170 000 Ar pour les lots 2 et 4) ;
- l'**acte d'engagement** est établi **par lot** : son en-tête porte « LOT N° … » et son propre numéro de dossier
  (2463-MI, quand le DPAO porte 2461-MT) ;
- le **montant minimum et le montant maximum** de l'article 2 sont ceux du lot, pas du marché entier ;
- les offres sont remises en **plis séparés par lot**, et un candidat ne peut « prétendre qu'à deux lots au
  maximum ».

Notre fiche produit **un** acte d'engagement et porte **un** montant de garantie, **un** montant minimum, **un**
montant maximum. Pour un marché non alloti, c'est exact. Pour un marché alloti — le cas courant — c'est une
simplification qui ne tiendra pas à l'usage.

Trois façons d'en sortir, à arbitrer :

1. **Champs répétés par lot** : les quelques informations qui varient (garantie, montants minimum et maximum,
   délai de livraison) deviennent des tableaux à une ligne par lot, alimentés par le nombre de lots du plan.
   C'est la solution juste, et la plus lourde.
2. **Une fiche par lot** : la ligne du plan porte déjà ses lots ; on préparerait une fiche par lot, chacune
   produisant son acte d'engagement. Simple pour le modèle, mais multiplie la saisie commune par cinq.
3. **Statu quo assumé** : un seul jeu de montants, et une mention libre « par lot » dans les champs de texte. À
   n'envisager que si les marchés allotis restent rares — le plan de test dit le contraire.

*Ma recommandation : la 1, limitée aux quatre informations qui varient réellement. Le reste du DAO est commun aux
lots ; multiplier la fiche entière (solution 2) ferait payer cinq fois une saisie de cent informations.*

## 3. Sept informations du dossier réel que la fiche ne collecte pas

Aucune ne figure dans le fichier de correspondance des fournitures — ce sont des manques de la **source**, que le
dossier réel révèle. Deux d'entre elles existent déjà chez les travaux ou les prestations intellectuelles, ce qui
rend l'ajout mécanique.

| # | information du DAO réel | clause | existe ailleurs ? |
|---|---|---|---|
| 1 | **Remise des offres par voie électronique** admise ou non, et ses modalités | 7.3 | oui — `B04-VE-01/02`, mais **chez les prestations intellectuelles seulement** : les travaux ne l'ont pas non plus |
| 2 | **Composition du dossier d'appel d'offres** (modèles de fiches, modèles de garantie, plans) | 5.1 | oui — `B04-CD-01/02/03` chez les travaux |
| 3 | **Nombre maximum de lots** qu'un même candidat peut obtenir | 1.1 | non |
| 4 | **Présentation des plis** : plis séparés par lot, double enveloppe originale/copie scellée | 7.1 | non (`B04-RO-02` ne porte que les mentions) |
| 5 | **Comptable assignataire** du nantissement | AE art. 4 | oui — `B03-NT-01` chez les travaux |
| 6 | **Annexes de l'acte d'engagement** : cadre du bordereau de prix, état des sommes versées à des tiers, **déclaration des bénéficiaires effectifs** | AE | partiellement — bloc `B11` chez les travaux, rien chez les fournitures |
| 7 | **Numéro du dossier d'appel d'offres** comme donnée propre | en-tête | oui — `B02-OE-01` en contrat-cadre |

⚠️ La **déclaration des bénéficiaires effectifs** (annexe 3 de l'acte d'engagement) n'apparaît dans aucun de nos
trois classeurs. C'est une pièce récente et obligatoire ; elle mérite d'être signalée à l'auteur du fichier de
correspondance.

## 4. Un doublon à trancher

`B06-EO-11` « Délai de livraison (jours) » et `B06-EO-12` « Délai maximum de livraison (jours) » se recouvrent. Le
dossier réel n'a qu'une règle, et elle est claire :

> « Le délai de livraison est fixé dans le **bon de commande**, sans toutefois dépasser **trente (30) jours** à
> compter du lendemain de la date de notification de ce bon. » (clause 12)

Un seul champ suffit — le **plafond** —, le délai lui-même étant fixé commande par commande. *Recommandation :
garder `B06-EO-12` (le plafond), retirer `B06-EO-11`, ou le réserver aux marchés à quantité fixe où le délai est
unique.*

## 5. Ce que le dossier réel confirme, et qu'il ne faut pas toucher

- Les **quantités** minimum et maximum sont renvoyées au Cahier des Prescriptions Spéciales, pas détaillées au
  DPAO : notre champ de texte long convient.
- Le **contenu et la décomposition des prix** (EXW, transports intérieurs, assurance, services locaux) sont écrits
  exactement comme `B05-CP-02` les attend.
- Les **offres anormalement hautes ou basses** sont décrites par une méthode en toutes lettres — deux moyennes
  successives, un seuil haut et un seuil bas — que `B06-EO-07`, champ de texte long, accueille sans difficulté. Un
  découpage en deux pourcentages serait plus rigide que le dossier réel.
- La **préférence nationale** est traitée par deux champs (accordée ou non, puis le taux), comme le DPAO réel.

## ✅ Arbitré le 25/09 — le pilote suit la recommandation

Le point de structure est tranché sur la **solution 1** — rendre répétables les quatre informations qui varient
réellement (garantie de soumission, montant minimum, montant maximum, délai de livraison), et laisser commun le
reste du dossier. Les quatre points sont écrits en demande :
`docs/demande-backend-2026-09-25-dao-a-commande-par-lot.md` — B1 la reprise à rétablir, B2 le mécanisme par lot,
B3 les sept informations manquantes, B4 le doublon.

## Ce qui reste à faire

1. Le backend livre la demande ; le front construit ensuite le tableau par lot, avec repli sur la valeur unique
   tant que `parLot` n'est pas servi — comme au lot 1.
2. Signaler à l'auteur du fichier de correspondance les sept manques du §3, et en particulier la **déclaration des
   bénéficiaires effectifs**, absente des trois classeurs alors qu'elle est une annexe obligatoire de l'acte
   d'engagement.
3. La recette se fera sur une **ligne allotie** du plan de test, jusqu'à la génération : l'acte d'engagement doit
   alors sortir une fois par lot.
