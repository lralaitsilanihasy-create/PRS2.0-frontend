# Demande backend — Navette du PV à DEUX NIVEAUX et co-signature élargie (dossiers Président → CC → Membre)

> ✅ **CLÔTURÉE le 04/09** — backend livré (`f648254`, 748 tests) + front `7520345` ; recette réelle
> complète (PV 00002 : niveau CC → accepter → visa Président P+CC+M → 3 signatures → SIGNE).

**Date** : 2026-09-04 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : spec pilote du jour

> « Pour le dossier de dispatch à deux niveaux (Président vers CC, puis CC vers Membre), la navette
> du projet de PV se fait à deux niveaux aussi (Membre avec CC, puis CC avec Président). La
> co-signature peut être Président + CC + Membre ; ou Président + CC ; ou Président + Membre ; ou
> Président + un autre Membre de la localité au niveau centrale. »

## Arbitrages pilote (AskUserQuestion 2026-09-04 — les 4 recommandations retenues)

1. **Verrou par niveau** : le Membre soumet AU CC ; le CC retourne au Membre OU accepte et transmet
   au Président ; le Président retourne AU CC (qui corrige l'orientation : redescend au Membre ou
   re-transmet) OU vise. Rien ne saute d'étage.
2. **Visa final = le Président seul** (dispatcheur initial) : avis global modifiable, co-signataires,
   clôture. Le passage CC est une **acceptation intermédiaire sans visa**.
3. **Le Président choisit la combinaison de signataires AU VISA** : le CC et/ou le Membre
   examinateur et/ou un AUTRE Membre de la centrale — au minimum 2 personnes distinctes au total,
   lui compris. Le PV n'imprime que les lignes des désignés.
4. **Périmètre = chemin réel** : deux niveaux SEULEMENT quand le dossier est passé par les deux
   (Président → CC, puis réattribution CC → Membre). Un dispatch direct (Président → Membre, CC
   régional → Membre, ou CC/Président auto-attributaire) garde la navette simple actuelle.

## Discriminant du « deux niveaux » (proposition)

Sur le DERNIER dispatch du dossier : localité **centrale** ET `imCtrlDispatch` = un
**CHEF_COMMISSION** ET `imCtrlMembre` ≠ ce CC. (Seul le Président dispatche un dossier central :
si le dispatcheur courant est le CC, c'est qu'il a réattribué — le chemin P → CC → M est prouvé.)
Cas « le CC examine lui-même » (`imCtrlMembre` = CC) : UN niveau — le CC soumet, navette directe
CC ↔ Président.

## Demandes

### 1. Flux de navette à deux niveaux

- `POST /{id}/soumettre` (Membre) : inchangé — le PV part au **niveau CC** (deux-niveaux) ou au
  dispatcheur (simple). Notifier le bon destinataire.
- `POST /{id}/accepter` : sur un deux-niveaux, réservé au **CC** (403 sinon) — acte « accepté au
  niveau CC, transmis au Président », trace de navette (sens `TRANSMISSION_PRESIDENT` ou
  équivalent), notification au Président. Le PV passe au **niveau Président**.
- `POST /{id}/retourner` :
  - au niveau CC : geste du CC → retour au Membre (`EN_RECTIFICATION`, comme aujourd'hui) ;
  - au niveau Président : geste du Président → **retour AU CC** (nouveau sens de navette
    `RETOUR_CC`) — le PV revient au niveau CC, le CC choisit : re-`retourner` au Membre ou
    re-`accepter` après échange. 403 pour un retour qui sauterait un étage.
- `POST /{id}/viser` : sur un deux-niveaux, réservé au **Président** (403 pour le CC), et
  seulement au niveau Président (409 si le PV n'y est pas). Navette simple : inchangé (dispatcheur).
- `PvExamenDto` expose le **niveau courant** de la navette (`niveauNavette: 'CC' | 'PRESIDENT' |
  null`) pour que le front affiche le bon panneau au bon acteur.

### 2. Co-signature élargie (visa du Président, deux-niveaux)

`PvVisaRequest` : remplacer `imMembreCoSignataire` par une liste `coSignataires` (1 à 2 IM) —
rétro-compatibilité : `imMembreCoSignataire` seul reste accepté (équivaut à `[lui]`).
Combinaisons valides sur un deux-niveaux central (le Président signe toujours) :

| Combinaison | coSignataires |
|---|---|
| Président + CC + Membre | [CC du circuit, Membre examinateur] |
| Président + CC | [CC du circuit] |
| Président + Membre | [Membre examinateur] |
| Président + autre Membre | [tout autre Membre de la CENTRALE] |

Gardes : personnes **distinctes** (le Président jamais dans la liste), CC = le CC du circuit du
dossier, Membre = un Membre (profil) de la localité centrale ; 400 explicite sinon. Navette
simple : contrat actuel inchangé (un co-signataire Membre).

### 3. Signatures par part, dynamiques

`POST /{id}/signer(role)` : chaque **désigné** signe SA part (CC → part CC, Membre → part Membre),
le Président la sienne — 403 pour un non-désigné, 409 part déjà signée (verrou actuel conservé).
**PV → SIGNE quand toutes les parts DÉSIGNÉES + celle du Président sont posées** (2 ou 3
signatures selon la combinaison). Notifications `PV_A_COSIGNER` à chaque désigné au visa.

### 4. Document PV (docx)

Le bloc signatures n'imprime que les lignes des **désignés** (+ Président). ⚠️ Les 14 modèles
officiels ont des lignes de signature figées — prévoir le retrait des lignes non désignées à la
génération (même mécanique que les patchs existants), PAS un modèle par combinaison.

### 5. Hors périmètre (inchangé)

Chronométrage (EXAMEN clos à la soumission, VISA/COSIGNATURE inchangés), navette simple des
dossiers à un niveau, lettres de renvoi, vérification.

## Tests attendus

1. Deux-niveaux : soumission Membre → notification CC ; `accepter` par le Président avant le CC →
   403 ; `viser` par le CC → 403.
2. CC accepte → navette `TRANSMISSION_PRESIDENT`, notification Président, niveau = PRESIDENT.
3. Président retourne → navette `RETOUR_CC`, niveau = CC ; le CC retourne → `EN_RECTIFICATION`
   chez le Membre (le circuit du retour descend étage par étage).
4. Visa Président avec `coSignataires` = [CC, Membre] → 3 parts à signer, PV SIGNE après les 3.
5. Visa avec [autre Membre de la centrale] → accepté ; avec un Membre d'une autre localité → 400 ;
   avec le Président lui-même dans la liste → 400.
6. Rétro-compat : `imMembreCoSignataire` seul → équivalent `[lui]` (navette simple intacte).
7. Dispatch direct Président → Membre (même dossier central) : navette actuelle inchangée.
8. Document : PV signé en P+CC seul → aucune ligne « Membre » au bloc signatures.
