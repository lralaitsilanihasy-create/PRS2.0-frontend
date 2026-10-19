# Demande backend — 2026-10-19 — L'état de la fiche et de son dossier sur la liste des lignes éligibles

## Contexte

L'écran « Fiche DAO — choisir la ligne du plan de passation » (`/prmp/dao`) lit `GET /api/dmcs/eligibles`. Pour une ligne qui a déjà
une fiche, il ne reçoit que `dejaDao: true` et `idDmc`, et affichait « Reprendre la fiche » sur toutes ces lignes — y compris sur des
DAO dont le dossier est **clôturé** (consomptibles informatiques, articles de bureau, produits d'entretien en recette), où la fiche est
figée : le serveur refuse toute nouvelle version (V49, B1 : 409 `DOSSIER_EN_EXAMEN`).

Le pilote a relevé le 19/10 que ce libellé laisse croire qu'on peut encore modifier un DAO clôturé. Le front affiche désormais
« Ouvrir la fiche », juste dans tous les cas, mais il ne peut pas dire **où en est** chaque fiche sans un appel par ligne.

## B1 — L'état de la fiche et du dossier, sur chaque ligne

Sur `GET /api/dmcs/eligibles` (avec ou sans `?sousType=`), pour une ligne qui a une fiche (`idDmc` non nul), trois champs calculés
**en lot** :

```json
"fiche": { "statut": "VALIDEE", "version": 2 },
"dossier": { "idDossier": 100382, "refeDossier": "00003/DAOO-CC/CNM/2026", "statut": "CLOTURE" }
```

- `fiche.statut` : `BROUILLON` (aucune version validée, ou révision ouverte) ou `VALIDEE` ; `version` : la dernière ;
- `dossier` : le dossier soumis né de la fiche (`idDossierSoumis`), `null` tant qu'il n'est pas créé ; `statut` : son statut courant.

> ⚠️ **2026-10-19, livré (backend), tel que demandé, avec une précision**
> - Les deux champs sont servis avec et sans `?sousType=`. Ils valent tous deux `null` sur une ligne sans fiche.
> - Ils sont calculés en deux requêtes pour toute la liste.
> - **Précision, la fiche jamais enregistrée** : une ligne dont le DMC existe sans aucune version enregistrée reçoit
>   `fiche: { statut: "BROUILLON", version: 1 }`, comme `GET /api/fiches-marche/{idDmc}`.
> - **Révision ouverte** : `statut` vaut `BROUILLON` et `version` donne le numéro de la révision, pas celui de la version validée.
> - En recette, les trois lignes (DMC 1, 2 et 3) ont une fiche `VALIDEE` (v5, v2, v1). Leurs dossiers 100380, 100381 et 100382
>   sont `CLOTURE`.

## Ce que le front en fera

| Fiche | Dossier | Bouton | Repère |
|---|---|---|---|
| brouillon | — | **Continuer la saisie** | « Brouillon » |
| validée | aucun, ou `BROUILLON` | **Continuer** (créer, compléter, soumettre) | « Fiche validée v n » |
| validée | `EN_ATTENTE_DECISION_PRMP`, `EN_ATTENTE_PIECES`, `EN_ATTENTE_COMPLEMENTS_DEPOT` | **Rectifier** | « Rendu à la PRMP » |
| validée | chez la Commission, ou clôturé | **Consulter** | « À la Commission » / « Dossier clôturé » |

## Questions

- **Q1** — Une ligne dont le dossier est clôturé doit-elle encore figurer parmi les « lignes éligibles », ou passer dans une liste à
  part (« Appels d'offres lancés ») ? Le front propose de la garder, avec son repère, tant que la procédure n'est pas attribuée.

> ⚠️ **2026-10-19, réponse (backend)** — **Q1 : elle reste**, avec son état, comme aujourd'hui. Le serveur ne la retire pas non plus
> après l'attribution : la liste ne connaît pas l'avancement de la procédure. Le front peut la masquer ou la regrouper de son côté.
> Une liste séparée des appels d'offres lancés est à demander au pilote si l'écran en a besoin.

## Côté front, après livraison

Libellé du bouton et repère d'état par ligne sur `/prmp/dao` ; les champs absents gardent le comportement actuel (« Ouvrir la fiche »).
