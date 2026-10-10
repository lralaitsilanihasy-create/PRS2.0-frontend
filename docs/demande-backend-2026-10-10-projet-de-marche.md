# Demande backend — le projet de marché face à la loi (2026-10-10)

Origine : relecture par le pilote, le 10/10, du projet de marché produit pour le **lot 1 de la procédure 40** (dossier de marché 100371).
Le document est comparé ici au texte de la **loi n° 2016-055** (version CNLEGIS), articles 28 et 60.

Producteur : `AttributionService.projet(...)` (Q1 de la demande `attribution-notification` : le projet de marché est produit par le
serveur).

## Arbitrage du pilote (10/10) — un lot, un marché

L'art. 28-II laisse le choix à la PRMP : des lots « donnant lieu chacun à un marché distinct », ou un « marché unique ». L'art. 28-VII
permet aussi un seul acte d'engagement pour plusieurs lots attribués au même candidat. **Le pilote retient une seule règle pour
l'application : un lot = un marché.** Ni marché unique, ni acte d'engagement regroupé. Rien ne change donc dans la création des
dossiers de marché (un par lot attribuable, RG-ATT-02).

## Le constat

| Mention exigée par l'art. 60 | Dans le projet du lot 1 (procédure 40) |
|---|---|
| Identification des parties contractantes | ✅ |
| Justification de la qualité de la personne signant le marché | ⚠️ « représentée par sa Personne responsable des marchés publics, *nom* » : aucun acte de désignation |
| Définition de l'objet du marché | ⚠️ l'objet des **cinq** lots, suivi de « — lot 1 » (titre) et de « , lot 1 » (article 1) |
| Référence aux articles de la loi en vertu desquels le marché est passé | ❌ |
| Énumération par ordre de priorité des pièces du marché | ✅ (article 2) |
| Le prix ou les modalités de sa détermination | ✅ (hors taxes) |
| Délai d'exécution et, le cas échéant, sanction de son dépassement | ⚠️ « Le délai d'exécution est celui de l'acte d'engagement : **6.** » (sans unité) ; aucune sanction |
| Conditions de réception, et de réception partielle | ❌ |
| Conditions de règlement | ❌ |
| Conditions de résiliation | ❌ |
| Date de notification du marché | ❌ |
| Comptable public assignataire et imputation budgétaire | ❌ |
| Domiciliation bancaire des paiements | ❌ |
| Droit applicable (concurrence internationale) | sans objet pour un appel d'offres national ; à porter pour `DAOOI` / `DAORI` |

## B1 — L'objet du marché est celui du lot

Pour une procédure allotie, le titre et l'article 1 portent l'objet de l'appel d'offres, puis **le seul lot du marché**, avec sa
désignation saisie dans la fiche (par exemple « … — Lot n°01 : campus universitaire d'Antsiranana »). Ils ne recopient plus
l'énumération des cinq lots. Si la désignation du lot n'est pas saisie, la mention reste « lot n ».

## B2 — Les mentions obligatoires de l'art. 60

Le projet porte **toutes** les mentions de l'art. 60. Il les **remplit** quand la donnée est connue de l'application, et laisse sinon
un **champ à compléter** (« …… »), visible et nommé, pour que rien ne manque à la signature :

- **Qualité du signataire** : la PRMP « nommée par *acte* », depuis le mandat en vigueur (`/api/mandats/actif`), s'il y en a un.
- **Base légale** : les articles de la loi en vertu desquels le marché est passé, selon le mode de passation de la ligne du plan
  (par exemple l'appel d'offres ouvert).
- **Délai d'exécution avec son unité** (mois, jours…, telle qu'elle est saisie à l'acte d'engagement ou dans la fiche), et la
  **sanction du dépassement** : renvoi aux pénalités de retard du CCAP / des données particulières.
- **Réception (et réception partielle), règlement, résiliation** : une clause chacune, au moins par renvoi explicite aux articles
  du CCAP (ou CPS) du dossier.
- **Date de notification** : champ à compléter (la notification suit la signature).
- **Comptable public assignataire et imputation budgétaire** : depuis la ligne du plan ou la fiche si elles y figurent, sinon champs
  à compléter.
- **Domiciliation bancaire** du titulaire : depuis l'entreprise si elle est déclarée, sinon champ à compléter.
- **Droit applicable** : seulement pour une procédure internationale.

Le montant TTC n'est pas exigé par l'art. 60. À ajouter si les taxes sont connues de l'évaluation ; sinon le hors taxes suffit.

## Hypothèses (à confirmer ou corriger)

- **H1** — Le projet reste un document **produit** (PDF et Word), sans saisie nouvelle à l'écran : la PRMP complète les champs
  laissés « …… » dans le Word avant la signature. Si le backend préfère de nouveaux champs saisis, il le dit et le front suivra.
- **H2** — Les mêmes règles valent pour le dossier de marché d'une fiche PI (sous-type `MPI`) : « l'offre » s'y lit « la
  proposition ».

## Côté front

Rien à changer pour B1 et B2 si H1 tient : l'écran tire déjà le projet en PDF et en Word (« Projet de marché (PDF) »,
« Enregistrer en Word »).
