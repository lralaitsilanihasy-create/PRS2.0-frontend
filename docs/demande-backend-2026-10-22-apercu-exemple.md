# Demande backend — 2026-10-22 — Modèles de PV : un dossier d'exemple pour l'aperçu des PV d'examen

## Contexte

Le pilote demande, dans l'onglet « Aperçu » d'un modèle, **un dossier d'exemple pour avoir un aperçu**. **Un seul suffit**, et il vaut
**pour les PV d'examen** (précisions du pilote, 22/10) : tous les modèles de PV, quelle que soit la famille, ainsi que la lettre de
renvoi.

Le front propose maintenant un dossier réel des sous-types servis, prérempli (front 71cf46f). Cela ne suffit pas :
- **les PV d'examen des familles DMC et DDM** (`PV-MISE-EN-CONCURRENCE`, `PV-MARCHE`) : les dossiers examinés de la recette n'ont pas
  tous un PV, et un dossier réel ne montre qu'un cas ;
- **le PV du plan** : seul le dossier 100379 s'y prête (centrale, avec AGPM) ;
- **la lettre de renvoi** : aucune lettre de renvoi en recette (`GET /api/lettre-renvois` → 0), donc `LETTRE_ABSENTE` sur tous les
  dossiers ;
- **les familles sans dossier examiné** (DGC, DSS en recette) : rien à proposer.

Le catalogue (`GET /api/modeles-pv/variables`) porte déjà une **valeur d'exemple** pour chaque variable (`exemple` :
« Rina RAFIDIMANANA », « 00001/PPM-AGPM/CNM/PV/2026 », « Délai de validité : 60 jours »…).

## E1 — L'aperçu sur le dossier d'exemple

`POST /api/modeles-pv/{id}/versions/{n}/apercu?exemple=true&format=pdf`, **sans** `dossier=`, pour **tout modèle** : PV d'examen de
n'importe quelle famille, et lettre de renvoi.
- Un seul dossier d'exemple, fictif : chaque variable prend son `exemple` du catalogue ; une variable sans exemple prend son libellé
  entre crochets (« [Date de l'examen] »).
- Une liste répétée (`OBSERVATIONS`…) reçoit une ligne d'exemple.
- L'avis se choisit comme aujourd'hui (`avis=`) : c'est lui qui change le texte d'un PV d'examen. Les autres critères prennent la
  valeur de l'exemple : commission centrale, avec AGPM, sous-type = le premier servi par le modèle.
- Les champs saisis viennent du corps `{ saisis }`, comme aujourd'hui.
- Rien n'est enregistré.

`exemple=true` avec `dossier=` : 400 (l'un ou l'autre).

## Question

- **Q1 — Mention « EXEMPLE ».** Le front propose un pied « EXEMPLE — valeurs fictives » sur chaque page, pour que le PDF ne circule
  pas comme un vrai PV. Ou rien ?

## Côté front

À la livraison, l'onglet « Aperçu » de **chaque** modèle (PV d'examen et lettre de renvoi) propose le « Dossier d'exemple » fictif,
prérempli, avec l'avis au choix. Un dossier réel reste possible en saisissant son numéro.
