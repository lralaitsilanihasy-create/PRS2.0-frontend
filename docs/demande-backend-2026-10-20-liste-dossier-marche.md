# Demande backend — 2026-10-20 — Ce que la liste « Dossier de marché — choisir la procédure » doit encore lire

## Contexte

L'écran `/prmp/dossier-marche` (front, 19-20/10) liste les procédures menées en ligne dont le dossier de mise en concurrence est
clôturé, pour que la PRMP crée le dossier de marché depuis l'attribution du lot. Le pilote a demandé de revoir les informations
affichées. Le tableau montre désormais, à partir de `GET /api/dmcs/eligibles` :

| Colonne | Contenu | Source |
|---|---|---|
| Marché | objet ; forme · catégorie · ligne du plan | `designationMarche`, `formeMarche`, `categorie`, `idDetail`, `refeDossier` |
| Estimation | montant estimatif | `montEstim` |
| Mise en concurrence | référence du dossier contrôlé (lien), son état, offres reçues | `dossier`, `nbOffres` |
| Dossier de marché | numéro ou référence (lien), état en clair | `dossiersMarche` (V138) |
| Action | « Créer le dossier de marché » ou « Ouvrir l'attribution » | — |

Deux informations manquent pour que la PRMP choisisse sans ouvrir chaque procédure. Les lire procédure par procédure ferait un appel
par ligne.

## B1 — Le numéro de la procédure

La PRMP et la Commission désignent la procédure par son numéro (13-CC/MEF/SG/PRMP.2026), pas par la ligne du plan. Il est porté par
la fiche (`B02-OE-01` pour un contrat-cadre, à défaut `B02-OB-03`), et l'en-tête des écrans de la fiche l'affiche déjà.

Demande : `numeroProcedure` sur chaque ligne qui a une fiche, avec la même règle que l'en-tête de la procédure.

> ⚠️ **2026-10-20, livré (backend), tel que demandé**
> - **La règle** : celle de l'en-tête. Un contrat-cadre prend `B02-OE-01`, puis `B02-OB-03` ; les autres marchés prennent
>   `B02-OB-03` ; à défaut, la référence du plan.
> - **La source** : la dernière version de la fiche, en une requête pour toute la liste. `numeroProcedure` est `null` sans fiche.
> - **Précision** : `dossiersMarche` a été livré le 19/10 **sans migration**. Il n'existe pas de V138 : la dernière migration est V137.

## B2 — L'état de l'attribution, par lot

Ce qui décide la création du dossier de marché, c'est l'évaluation close et la proposition du rapport. Demande, sur chaque ligne qui a
une fiche en remise électronique :

```
attributions: [{
  lot,
  etat,                 // EN_EVALUATION, PROPOSE, AU_CONTROLE… (l'état du lot sur /attribution)
  rapportSigneLe,       // null tant que le rapport n'est pas signé
  propose: { candidat, montant, nbTitulaires }   // rang 1 ; nbTitulaires > 1 pour un contrat-cadre multi-attributaire
}]
```

En une requête pour toute la liste, comme `dossiersMarche`.

> ⚠️ **2026-10-20, livré (backend), avec une précision sur le coût**
> - **Le champ** : `attributions: [{ lot, etat, rapportSigneLe, propose: { candidat, montant, nbTitulaires } }]`.
> - **L'état** : celui de l'écran d'attribution, par la même règle, extraite en un seul endroit (`EN_EVALUATION`, `PROPOSE`,
>   `AU_CONTROLE`, `AVIS_RENDU`, `ATTRIBUE`…).
> - **`propose`** : l'offre du rang 1. Elle est nulle avant la clôture, ou pour un lot proposé infructueux. `nbTitulaires` vaut 1,
>   ou le nombre de titulaires proposés d'un contrat-cadre.
> - **Les cas vides** : une liste vide tant que l'évaluation n'est pas ouverte, `null` sans fiche.
> - **Le coût** : l'écran fait **un seul appel**. Le serveur repère en une requête les procédures dont l'évaluation est ouverte, puis lit
>   l'attribution de chacune d'elles. Calculer l'état par une seule requête SQL aurait dupliqué une règle à six facteurs (clôture, avis
>   de la Commission, délai d'attente, signature, notification, infructuosité), qui aurait fini par diverger.
> - **Sur 13-CC** : `[{ 1, "AU_CONTROLE", <signature du rapport>, { "Hygiène & Services…", 179570562, 3 } }]` : le rapport propose
>   trois titulaires (constaté le 19/10).

## Côté front

Dès la livraison :
- le numéro de procédure en tête de la colonne « Marché » ;
- une colonne « Attribution » : « Rapport signé le 19/10/2026 », « Hygiène & Services Madagascar SARL — 179 570 562 Ar HT »
  (« + 2 titulaires » pour un contrat-cadre), ou « Évaluation en cours » ;
- « Créer le dossier de marché » ne sera proposé que pour un lot `PROPOSE`, sans dossier de marché.
