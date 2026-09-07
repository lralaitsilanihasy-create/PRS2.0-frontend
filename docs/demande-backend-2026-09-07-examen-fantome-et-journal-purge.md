# Signalement backend — Examen fantôme au chronométrage + examen absent du journal après retrait

> ✅ **CLÔTURÉ le 07/09** — backend livré (`d364f1a`) et contre-recetté en réel (décor neuf, purgé
> après) : (C1) après un retour de navette déclenché par le Président, AUCUNE tâche EXAMEN à son nom
> — les tâches restent RECEPTION/DISPATCH/EXAMEN(Rina)/VISA(Président) ; (C2) les événements
> SOUMISSION_EXAMEN et RETOUR_RECTIFICATION sont figés dans `t_action_dossier` juste avant la purge
> — ils survivent à l'annulation du dispatch (PV purgé, 404 confirmé), avec un identifiant réel et
> la même visibilité hiérarchique. ⚠️ Prospectif : la tâche EXAMEN#2 déjà présente sur 00001 et son
> examen déjà purgé du journal ne sont pas rattrapés — seuls les prochains gestes sont corrects.

**Date** : 2026-09-07 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : deux constats
pilote sur le dossier réel 00001 (id 100295), après le parcours :
Création → Soumission → Réception → Dispatch (→ Rina) → Examen#1 (Rina, clos) → Visa#1 (Président,
resté ouvert) → **Examen#2 (Président, instantané, prévision 40 h std)** → Retrait du dispatch.

## Constat 1 — Chronométrage : une tâche EXAMEN au nom du PRÉSIDENT, après le visa

`GET /dossiers/100295/chronometrage` sert, entre le Visa#1 et le retrait :

```
EXAMEN#2  acteur=PRES001  priseEnCharge=21:06  fin=21:06  prévision=40 h (std)
```

- **Un examen ne s'attribue jamais au Président** : l'examen appartient à l'attributaire du dispatch
  (Rina). L'acteur `PRES001` vient de ce que le Président a **déclenché** la réouverture de l'étape
  (retour au Membre pour rectification, avant de retirer le dispatch) — mais le déclencheur d'une
  transition n'est pas l'acteur de la tâche rouverte.
- Signature d'une tâche créée par transition (prise en charge = fin, prévision **standard** et non
  la prévision réelle) : l'occurrence EXAMEN#2 est ouverte **et close dans le même instant**, sans
  qu'aucun examinateur ne l'ait prise en charge.

**Demande** : à la réouverture de l'étape EXAMEN (retour de navette / rectification), soit ne PAS
créer de tâche tant que l'attributaire ne l'a pas réellement prise en charge, soit la créer au nom
de **l'attributaire courant du dispatch** (jamais du déclencheur de la transition). Même principe
que la garde d'acteur posée sur VISA/COSIGNATURE (`1a92f5a`).

## Constat 2 — Journal : l'examen disparaît après un retrait de dispatch

Le journal complet (`ed162e8`) dérive **à la lecture** les événements du traitement (soumission
d'examen, visa, signatures…) depuis `t_pv_navette` + les dates du PV. Le **retrait du dispatch
purge le circuit** (examen, PV, navettes supprimés). À la relecture, ces événements ne sont plus
dérivables : le journal du 00001 ne montre plus que Création / Soumission / Réception / Dispatch /
Retrait — alors que le dossier **est passé par l'examen** (visible, lui, au chronométrage, dont les
tâches ne sont pas purgées).

**Arbitrage demandé** : faut-il que le journal garde la trace de l'examen/visa **même après retrait**
(le dossier « est passé par l'examen », c'est une étape de son histoire) ? Si oui, ces événements
doivent être **persistés au fil de l'eau** (une écriture dans `t_action_dossier` au moment du geste),
et non seulement dérivés des données vivantes — la dérivation à la lecture les perd dès la purge.
À défaut, documenter que le journal reflète l'état vivant et qu'un retrait efface l'historique
d'examen du journal (le chronométrage restant la trace complète).

## Tests attendus (constat 1)

1. Dispatch → examen soumis → retour au Membre pour rectification : la tâche EXAMEN rouverte est au
   nom de l'attributaire (ou absente jusqu'à sa prise en charge) — **jamais** `PRES001`.
2. Aucune tâche EXAMEN instantanée (prise en charge = fin) créée par une transition du Président.

---

## Note de livraison backend — 2026-09-07 (`PRS20`, commit `d364f1a`)

Sans migration. Tests : `ExamenAttributaireEtJournalPurgeIntegrationTest` (les 2 cas attendus, plus la
survie du journal à l'annulation d'un dispatch).

### C1 — l'examen fantôme : la cause

La soumission du projet de PV clôt l'étape `EXAMEN`. Quand aucune tâche n'est ouverte, le chronométrage en
créait une **instantanée au nom de l'appelant** — d'où `EXAMEN#2` à `PRES001` quand le Président
re-soumettait **pour** le Membre (ce que la délégation Président → Membre autorise).

`ChronometrageService.cloturerExamen` raisonne désormais sur l'**attributaire du dispatch** : elle clôt sa
tâche ouverte s'il en a une ; sinon, l'occurrence instantanée n'est créée **que si l'appelant est
l'attributaire** (tolérance historique du Membre qui soumet sans prise en charge). Un tiers ne laisse
**aucune** tâche : le chronométrage ne prête pas un examen à qui ne l'a pas fait. Même principe que la
garde d'acteur du visa et de la co-signature (`1a92f5a`).

### C2 — le journal après purge : la troisième voie

Ni « persister au fil de l'eau » (refonte de neuf gestes, et doublons avec les dérivés) ni « documenter la
perte ». `JournalDossierService.figerTraitement` **copie les événements dérivés en lignes de
`t_action_dossier` juste avant** que la purge du circuit n'efface leurs sources — à l'annulation d'un
dispatch comme au retrait accepté. Une seule écriture, exactement ce que le journal montrait la seconde
d'avant ; rien n'est écrit en double tant que les sources vivent ; idempotent par construction (après la
purge, plus rien n'est dérivable).

⚠️ **Pour le front** : ces copies portent un `idAction` réel, contrairement aux mêmes événements servis en
dérivé. Le type et l'instant restent la bonne clé d'identification.

⚠️ **Non rétroactif, par nature** : le journal d'un dossier purgé **avant** ce correctif ne récupère pas
l'examen perdu — la source avait déjà disparu. Les prochains retraits, eux, gardent leur histoire.

### Correctif inclus dans le même commit

Le dossier réel a révélé une incohérence sur `datesEtapes` (livré la veille) : `DISPATCH`, `EXAMEN` et
`PROJET_PV` étaient datés à partir de tâches closes alors que le statut était revenu à `PRET_DISPATCH`
(dispatch annulé). Ils ne sont désormais datés que si le **statut a dépassé l'étape** — même principe que
`PV_SIGNE`, `VERIFICATION` et `CLOTURE`. Un réexamen (`A_REEXAMINER`) remet également `EXAMEN` à `null`.
