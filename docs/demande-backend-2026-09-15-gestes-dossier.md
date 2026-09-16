# Demande backend — Gestes d'un dossier : ce que le connecté peut faire, calculé par le serveur

**Date** : 2026-09-15 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : refonte ergonomique, lot 4
(page dossier guidée), plan `frontend/docs/plan-refonte-L4-page-dossier.md`, §1 et §6. Page dossier de la
direction C retenue par Mathieu le 14/09 (`maquettes-design/src/GuideDossier.tpl.html`).

## Constat

La nouvelle page dossier (une route par dossier, remplaçant écran par écran la modale `DossierConsultation`)
doit ouvrir l'étape en cours avec **les gestes que le connecté peut y faire**. Or aucune route ne sert cette
information pour un dossier donné : elle n'existe que noyée dans `GET /api/dossiers/a-faire`
(demande du 14/09), qui calcule des sections, des compteurs et un tri sur l'ensemble du périmètre — pas la
question « qu'est-ce que je peux faire sur CE dossier ». Un dossier absent de « À faire » (parce qu'il n'a
aucun geste pour le connecté, ou parce que le connecté le consulte par simple curiosité) ne renvoie donc
rien de ce qui devrait armer le panneau de la page.

Le **délai de l'étape en cours** (reste, échéance, urgence) a le même problème : il n'est servi nulle part
hors de la liste « À faire ». `GET /api/dossiers/{id}` porte `datesEtapes` et `datePrevisionnelleFin`, le
chronométrage porte les passages déjà clos, mais ni l'un ni l'autre ne donne le reste ou l'échéance de
l'étape où le dossier se trouve maintenant. Un Membre qui consulte le dossier d'un collègue (donc sans geste
à lui) doit malgré tout voir ce délai.

## Demande

Le contrat ci-dessous reprend **à l'identique** le §6 du plan `plan-refonte-L4-page-dossier.md`.

### Route

| | |
|---|---|
| Méthode et URL | `GET /api/dossiers/{id}/gestes` |
| Accès | `hasAnyRole('PRESIDENT','CHEF_COMMISSION','SECRETAIRE','MEMBRE','VERIFICATEUR','ASSISTANT_CONTROLEUR','PRMP','UGPM')`, comme `a-faire` ; puis la **garde de visibilité du dossier** (`service.findById(id)`, comme `/chronometrage`) |
| Réponse | `200 GestesDossierDto` ; `401` anonyme ; `403` profil hors liste ou dossier hors périmètre ; `404` dossier inexistant |
| Corps | aucun ; lecture seule, à la volée, **sans migration** |

### Options écartées

- *`a-faire?idDossier=`* : les compteurs et les sections n'ont pas de sens pour un seul dossier,
  `delegations` se sert à part, et rien ne revient quand le connecté n'a aucun geste. Or la page doit quand
  même afficher le délai de l'étape.
- *Endpoint agrégé « dossier + contenu + gestes »* : il recopierait le masquage C2 déjà appliqué à
  `DossierDto`, au journal et au chronométrage. Deux appels en parallèle côté front coûtent moins cher
  qu'une seconde source de vérité.

**Retenu** : une sous-ressource qui rejoue le calcul d'« À faire » sur un seul dossier.

### Réponse — exemple

```json
{
  "idDossier": 1052,
  "profil": "PRESIDENT",
  "genereLe": "2026-09-14T15:00:00",
  "etapeCourante": {
    "urgence": "BIENTOT",
    "delai": { "etape": "VISA", "entree": "2026-09-11T12:00:00", "standardHeures": 16, "ecouleHeures": 11,
               "restantHeures": 5, "echeance": "2026-09-15T12:00:00", "pauseDepuis": null, "pauseHeures": null,
               "datePrevisionnelleFin": "2026-09-24" }
  },
  "taches": [
    { "section": "PV_A_VISER", "geste": "VISER", "gestesSecondaires": ["RETOURNER"], "mode": "TITULAIRE",
      "urgence": "BIENTOT", "rang": 1,
      "dossier": { "…": "AFaireDto.Dossier, à l'identique" },
      "delai":   { "…": "AFaireDto.Delai, à l'identique" },
      "faits":   { "…": "AFaireDto.Faits, à l'identique" },
      "refs": { "idReception": 398, "idDispatch": 311, "idExamen": 205, "idPv": 144, "idLettre": null, "idDemandeRetrait": null } }
  ]
}
```

### Règles

1. **`taches` a la forme exacte de `AFaireDto.Tache`**, avec **toutes** les lignes du connecté sur ce
   dossier, titulaire **et** non titulaire (`mode` le dit). Il n'y a pas de paramètre `delegations`. Tri :
   les lignes `TITULAIRE` d'abord, puis les autres, chaque groupe dans l'ordre d'« À faire » ; `rang` part
   de 1 sur toute la liste.
2. **Invariant de parité**, testé : l'ensemble (`section`, `geste`, `gestesSecondaires`, `mode`, `urgence`,
   `delai`, `faits`, `refs`) est égal aux lignes de `GET /a-faire?delegations=true` (`taches` ∪
   `delegations.taches`) dont `dossier.idDossier == id`. Aucune règle n'est réécrite :
   `ReglesAFaire.lignes(acteur, etat)` sur un lot d'un seul identifiant.
3. **`etapeCourante`** vaut `null` sur un statut hors `STATUTS_ACTIFS` du côté de l'appelant (CLOTURE,
   RETIRE, REMPLACE, PV_SIGNE ; BROUILLON pour un contrôleur). Sinon, `delai` = `ChronometrageService.delaiCourant`,
   et `urgence` suit les mêmes seuils que les lignes chronométrées : `EN_PAUSE` sur un statut suspensif,
   `HORS_DELAI` pour un brouillon, `SANS_DELAI` si l'entrée est inconnue, **jamais** `SUIVI`. `etapeCourante`
   est servi même quand `taches` est vide : un Membre qui consulte le dossier d'un collègue voit le délai.
4. **Règle C2** : pour la PRMP et l'UGPM, mêmes champs à `null` que dans « À faire »
   (`dossier.acteursEtapes`, `niveauNavette`, `faits.consigneDispatch`, `dernierRetourNavette`,
   `partsAttendues`, `refs.idDispatch`) ; l'annuaire des contrôleurs n'est pas chargé.
5. **Performance** : au plus 15 ordres SQL, garde de visibilité comprise, vérifiés au compteur Hibernate.

## Tests attendus

Repris à l'identique du lot L4-B1 (§7 du plan) :

1. Parité avec `a-faire?delegations=true`, pour chaque profil du jeu de test et chaque dossier de son
   périmètre.
2. 404 dossier inexistant ; 403 hors périmètre (CC d'une autre localité, PRMP d'une autre tutelle) ; 403
   Administrateur et Chargé de publication ; 401 anonyme.
3. Statuts terminaux : `taches = []` et `etapeCourante = null`. EN_ATTENTE_DECISION_PRMP : `EN_PAUSE` avec
   `pauseDepuis` pour la PRMP.
4. Un Membre non attributaire : `taches = []`, `etapeCourante` servi.
5. C2 : le corps brut renvoyé à la PRMP et à l'UGPM ne contient aucun nom ni matricule de contrôleur.
6. Compteur SQL ≤ 15, constant.

## Côté front

`DossierService.gestes(idDossier)` avec `skipErrorToast()`, interfaces `GestesDossier` et
`EtapeCouranteDossier` dans `models/a-faire.model.ts` (fichier du chantier, pas `circuit.model.ts` : 19
commits du patron). Si l'endpoint n'est pas servi (404 ou 405 alors que le dossier a répondu 200), la page
reste en lecture seule avec une mention discrète, sans toast.

## Plan

Contrat détaillé et discussion au §6 de `frontend/docs/plan-refonte-L4-page-dossier.md` ; consommateur :
lot L4-F3 (« Étape en cours et gestes ») du même plan.

---

## Note de livraison backend — 2026-09-15 (`PRS20`, commits `5c3176a` et `642e7c7`)

Le contrat du §6 (repris à l'identique du plan) est livré tel que demandé, sans écart sur la forme des
réponses ni sur les codes 401/403/404. Suite verte, tests 1 à 6 tous couverts
(`GestesDossierIntegrationTest`, complément de `ReglesAFaireTest`). Documentation à jour :
`docs/api-endpoints.md` du backend (section dédiée, sous l'accueil « À faire ») et
`docs/regles-gestion.md` (paragraphe « Page dossier »).

### Trois écarts assumés par rapport à la lettre de la demande

1. **La garde appelle `findAFaireParId` + `controlerVisibilite`, pas `DossierService.findById`.**
   `findById` charge et mappe tout le `DossierDto` pour n'en garder que l'existence — une lecture inutile
   ici, puisque la ligne d'« À faire » du dossier (de toute façon nécessaire au calcul) sert tout aussi
   bien de test d'existence. `controlerVisibilite`, extrait de `findById`, porte ensuite la garde de
   périmètre avec les **mêmes messages** (404 « Dossier introuvable : {id} », 403 « Dossier hors de votre
   périmètre de visibilité (§1). ») : rien ne change côté appelant, seule une requête SQL est économisée.
2. **Le filtre de statut actif se fait en Java, pas en SQL.** `findAFaireParId` ne filtre ni le périmètre
   ni le statut, à la différence des trois requêtes de l'accueil (`findAFaireTous`,
   `findAFaireParLocalite`, `findAFairePourPrmp`), qui reçoivent chacune l'ensemble de statuts actifs en
   paramètre SQL. Ici, l'ensemble à appliquer (`STATUTS_ACTIFS_CNM` ou `STATUTS_ACTIFS_PARTIE_CONTROLEE`)
   dépend du **profil de l'appelant**, connu seulement après la lecture de la ligne — le filtrer en SQL
   aurait exigé une seconde requête conditionnelle. Un dossier existant mais à un statut inactif renvoie
   donc bien **200** avec `taches: []` et `etapeCourante: null`, jamais 404 : l'existence et l'activité
   sont deux questions distinctes, et seule la première conditionne le code HTTP.
3. **`rang` numérote toute la liste, pas deux listes séparées.** L'accueil numérote `taches` et
   `delegations.taches` chacune à partir de 1 (deux séries) ; la page n'a qu'une seule liste (titulaire
   d'abord, puis les autres) et la numérote d'un seul tenant, du premier au dernier — plus simple à
   consommer pour un panneau qui n'affiche qu'un dossier à la fois. L'invariant de parité testé ignore
   volontairement `rang` pour cette raison.

Aucun de ces trois écarts ne touche la forme JSON des réponses.
