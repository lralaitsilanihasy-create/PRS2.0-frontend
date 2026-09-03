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

### 1. Garde : écriture d'un dispatch d'un dossier central réservée au Président — SAUF réattribution par l'attributaire

Toute écriture sur `t_dispatch` (POST `/api/dispatchs`, PUT, **intérim compris**) portant sur un
dossier dont la localité est la centrale (`Localite.estCentrale(...)` via la réception → dossier)
est refusée en **403** quand le profil courant est `CHEF_COMMISSION` :

> « Le dispatch d'un dossier de la Commission nationale (localité centrale) relève du seul
> Président. »

**⚠️ Dérogation (précision pilote du même jour)** : « Pour la localité centrale (CNM), le CC peut
dispatcher ou examiner le dossier que le président lui a dispatché. » Le CC **attributaire courant**
d'un dispatch (le Président le lui a confié — « Chef de commission ⤴ ») peut le **RÉATTRIBUER** :
`PUT /api/dispatchs/{id}` reste **autorisé** au CC quand `existing.imCtrlMembre` = son IM, même sur
un dossier central (le front vient de livrer ce geste — bouton « Dispatcher » du groupe Dispatch,
PUT avec le nouveau `imCtrlMembre`). La garde 403 ne vise donc que : le POST initial, un PUT sur un
dispatch dont il n'est PAS l'attributaire, et l'intérim.

- Garde par **profil courant** (comme `normaliserAssociationCc`) : le dispatch est un droit natif
  du CC — les paires de `t_delegation_profil` ne jouent pas ici.
- **Annulation** (`/api/dispatchs/{id}/annuler`, « Retirer ») — **arbitrage pilote rendu (même
  jour, remplace la version « attributaire »)** : « Le CC ne doit pas pouvoir retirer le dossier
  qu'il n'a pas dispatché. Par contre, il peut retirer le dossier s'il est le dispatcheur de ce
  dossier. » Garde **GÉNÉRALE** (toutes localités, pas seulement la centrale) : un CC n'annule que
  s'il est le **dispatcheur** (`imCtrlDispatch` = son IM) **OU l'attributaire** (`imCtrlMembre` =
  son IM — geste « RENDRE » : le CC renvoie au pré-dispatch un dossier que le Président lui avait
  confié, précision pilote du même jour), **403** sinon ; le Président n'est pas restreint. NB :
  une réattribution par le CC pose `imCtrlDispatch` = son IM (JWT) — il peut donc retirer ensuite,
  ce qui est voulu.
- Ne change PAS : la **copie CC** d'un dispatch Président → Membre de la centrale (le CC suit le
  circuit), l'attribution **au** CC par le Président (« Chef de commission ⤴ », fa457d9 — c'est le
  Président qui dispatche), et tout ce qui concerne les localités régionales.

### 1 bis. Réattribution : notifications et garde d'examen

Le `update()` actuel ne notifie personne et accepte un re-ciblage même examen entamé. Pour le geste
de réattribution (changement d'`imCtrlMembre`) :

- **Notifier le nouvel attributaire** (`EXAMEN_A_FAIRE`, comme `notifierMembreAssigne` au POST) —
  **sauf s'il est le dispatcheur lui-même** (cas « reprise », voir ci-dessous : pas
  d'auto-notification).
- **Notifier l'ANCIEN attributaire** que le dossier lui est retiré (aujourd'hui il disparaît de sa
  file en silence).
- **409 si un examen existe déjà** sur ce dispatch (le circuit propre passe par « Retirer », qui
  purge l'aval) — le front n'offre le bouton que sans examen commencé, garde miroir demandée.

**⚠️ Précision pilote (même jour) — « Retirer » du CC = REPRISE, pas annulation** : « après avoir
retiré un dossier assigné à un membre, ce dossier doit […] revenir parmi les dossiers à examiner
[du CC], et non pas revenir vers le président qui a dispatché ce dossier au CC. » Le front
n'appelle donc plus `/annuler` pour un CC : son « Retirer » fait un **PUT de réattribution vers
lui-même** (`imCtrlMembre` = lui, dossier toujours `DISPATCHE`, retour dans SA file « À
examiner »). `/annuler` (retour `PRET_DISPATCH` + purge) reste le geste du **Président**. La garde
403 du point 1 (annulation par un CC non dispatcheur) reste utile en défense.

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
4. **Réattribution** : Président dispatche AU CC (`imCtrlMembre=CCANT01`) puis `CCANT01` PUT le même
   dispatch avec `imCtrlMembre=MEMANT1` → accepté, dossier toujours `DISPATCHE`, notification
   `EXAMEN_A_FAIRE` à `MEMANT1` ; le même PUT par un CC **non attributaire** → 403.
5. Réattribution avec un examen déjà entamé sur le dispatch → **409**.
6. **Annulation** : CC annule un dispatch dont il est le DISPATCHEUR (`imCtrlDispatch` = lui, y
   compris après sa propre réattribution) → accepté ; CC **attributaire** (« rendre » un dossier
   que le Président lui a dispatché) → accepté ; CC ni dispatcheur ni attributaire (dispatch du
   Président vers un Membre, même dans sa localité) → **403** ; Président → accepté partout.
7. Transition `PRET_DISPATCH` d'un dossier central → notification au Président, **aucune** au CC ;
   dossier régional → les deux, comme avant.
8. GET `/api/localites` → `estCentrale: true` pour `ANT`, `false` ailleurs.
