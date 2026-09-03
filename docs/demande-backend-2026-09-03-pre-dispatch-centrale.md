# Demande backend — Pré-dispatch des dossiers de la localité CENTRALE : privilège du seul Président

**Date** : 2026-09-03 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : demande pilote du jour

> « Pour le dossier de localité centrale (CNM), le CC ne doit pas voir les dossiers pour
> pré-dispatch. Seul le Président en a ce privilège. »

## Contexte

Aujourd'hui, un Chef de commission voit les dossiers `PRET_DISPATCH` de sa localité et peut les
dispatcher (décision A du 2026-07-27). Le pilote restreint ce privilège pour la **localité
centrale** (`Localite.ID_CENTRALE` = `ANT`, segment « CNM » des références) : le dispatch d'un
dossier central relève du **seul Président**. Les commissions **régionales** (CRM) sont
**inchangées** : leur CC continue de dispatcher dans sa localité.

Le front est déjà livré : pour le rôle CC, les dossiers de la localité centrale sont exclus du
groupe « Pré-dispatch » (compteurs du classement + lignes du drill-down + bouton/lot
« Dispatcher »), via `dossierExcluDuGroupe` (classement-config). Le discriminant utilisé est un
**repli miroir** de la constante backend (`idLocalite === 'ANT'`) — voir demande 3 pour le
remplacer par une donnée servie. Il manque la **garde serveur** : sans elle, un POST direct d'un
CC resterait accepté.

## Demandes

### 1. Garde : écriture d'un dispatch d'un dossier central réservée au Président

Toute écriture sur `t_dispatch` (POST `/api/dispatchs`, PUT, **intérim compris**) portant sur un
dossier dont la localité est la centrale (`Localite.estCentrale(...)` via la réception → dossier)
est refusée en **403** quand le profil courant est `CHEF_COMMISSION` :

> « Le dispatch d'un dossier de la Commission nationale (localité centrale) relève du seul
> Président. »

- Garde par **profil courant** (comme `normaliserAssociationCc`) : le dispatch est un droit natif
  du CC — les paires de `t_delegation_profil` ne jouent pas ici.
- **Annulation** (`/api/dispatchs/{id}/annuler`, « Retirer ») d'un dispatch de dossier central par
  un CC : **même garde recommandée** (gérer le dispatch central = même privilège ; l'annulation
  ramène le dossier en pré-dispatch). Appliquer par défaut ; le pilote peut arbitrer autrement.
- Ne change PAS : la **copie CC** d'un dispatch Président → Membre de la centrale (le CC suit le
  circuit), l'attribution **au** CC par le Président (« Chef de commission ⤴ », fa457d9 — c'est le
  Président qui dispatche), et tout ce qui concerne les localités régionales.

### 2. Notification « Dossier prêt à dispatcher » re-routée

`ReceptionService.declencherPretDispatch` notifie aujourd'hui « le Président (toutes localités) et
le CC de la localité ». Pour un dossier de la localité **centrale** : ne plus notifier le CC —
**Président seulement** (le CC n'a aucune action à mener, la notification serait un cul-de-sac).
Régionales inchangées.

### 3. Exposer `estCentrale` dans le référentiel localités

Ajouter à `LocaliteDto` un booléen `estCentrale` (calculé `Localite.estCentrale(idLocalite)` au
mapping — pas de colonne). Le front remplacera alors son repli miroir (`'ANT'` codé en dur,
documenté `ID_LOCALITE_CENTRALE_REPLI`) par la donnée servie : si `ID_CENTRALE` change un jour,
le front suivra sans redéploiement coordonné.

## Tests attendus

1. CC (`CCANT01`) POST `/api/dispatchs` sur un dossier de localité `ANT` → **403** message ci-dessus.
2. Président (`PRES001`) même POST → accepté (comportement actuel).
3. CC d'une localité régionale, dossier de SA localité → accepté (anti-régression décision A).
4. CC annule un dispatch d'un dossier central → 403 (si arbitrage confirmé) ; régional → accepté.
5. Transition `PRET_DISPATCH` d'un dossier central → notification au Président, **aucune** au CC ;
   dossier régional → les deux, comme avant.
6. GET `/api/localites` → `estCentrale: true` pour `ANT`, `false` ailleurs.
