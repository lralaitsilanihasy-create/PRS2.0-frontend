# Demande backend — Réserver la SOUMISSION du projet de PV à l'examinateur

**Date** : 2026-09-08 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : constat + arbitrage
pilote — un **Président dispatcheur** a pu **soumettre le projet de PV** d'un examen réalisé par le
**CC** (à qui il avait redispatché le dossier). Le journal a alors nommé le Président comme opérateur de
la « Soumission d'examen », alors que l'examen — et donc sa soumission — revient à l'examinateur.

## Constat (dossier #100305, réel)

1. Président `PRES001` dispatche au Membre, retire, **redispatche au CC** `CCANT01`.
2. Le **CC examine** : `t_examen.imCtrlMembre = CCANT01`, `t_pv_examen(idPv=26).imCtrlMembre = CCANT01`.
3. Mais la **navette #1 SOUMISSION** porte `imActeur = PRES001` :

```
GET /api/pv-navettes → { idNavette:56, idPv:26, numNavette:1, sens:"SOUMISSION",
                         imActeur:"PRES001", dateAction:"2026-09-08T08:18:36" }
```

→ La soumission a été faite en étant **connecté Président**. Le front envoie l'utilisateur courant
(`imActeur = auth.ref()`), ce qui est correct ; le problème est que **le backend l'a acceptée** : rien
ne réserve `POST /api/pv-examens/{idPv}/soumettre` à l'examinateur du PV.

## Règle arbitrée par le pilote (2026-09-08)

La **soumission** du projet de PV (`BROUILLON → PROJET_SOUMIS`) **et sa re-soumission** après
rectification (`EN_RECTIFICATION → …`) sont réservées à **l'EXAMINATEUR** du dossier — l'assignataire
courant du dispatch, c.-à-d. `imCtrlMembre` du PV / de l'examen. C'est le même esprit que « seul
l'assignataire examine » (garde `d24c115`) et que la rectification, déjà restreinte à l'assignataire.

## Demande

Sur `POST /api/pv-examens/{idPv}/soumettre` (la 1ʳᵉ soumission comme la re-soumission après retour de
rectification) : **403** si l'`imActeur` (ou l'utilisateur courant) **n'est pas l'examinateur** du PV
(`imCtrlMembre` du PV / assignataire courant du dispatch de l'examen).

- La capacité `PV_SOUMETTRE` seule ne suffit plus : le CC et le Président la portent par délégation mais
  n'ont pas à soumettre le PV d'un examen d'autrui.
- Message d'erreur explicite (affiché en dialogue côté front) : soumission réservée à l'examinateur.
- Cas EN_RECTIFICATION : même garde (l'examinateur qui a rectifié re-soumet).
- ⚠️ Vérifier la **cohérence de l'`imActeur`** : soit l'ignorer et prendre l'utilisateur authentifié
  comme acteur, soit exiger `imActeur == utilisateur authentifié` — pour que la navette ne puisse pas
  enregistrer un acteur autre que l'appelant réel.

## Côté front — déjà fait

Le bouton « Soumettre le projet » est désormais masqué à qui n'est pas l'examinateur
(`pv-workflow.ts`, `canSoumettre` : `peutSoumettre(statut) && auth.ref() === imExaminateur`,
`imExaminateur = pv.imCtrlMembre`). La garde serveur reste l'autorité (le bouton n'est qu'un garde-fou
d'UI ; un appel direct doit être refusé).

## Donnée existante (#100305 / PV 26)

La navette #1 déjà enregistrée porte `imActeur = PRES001` : le correctif étant un **write** (au moment
du geste), il ne réécrit pas cette ligne. Si le pilote veut un journal propre sur ce dossier de test, il
faut soit rejouer le flux, soit une correction de donnée ponctuelle — à voir avec lui, hors périmètre de
la garde.

## Contre-recette attendue

1. Dossier examiné par l'assignataire A, PV en `BROUILLON`. `POST …/soumettre` par **A** → 200,
   navette `imActeur = A`.
2. Le même POST par le **dispatcheur** (Président/CC ≠ A) → **403** (message explicite), aucune navette.
3. Après rectification (`EN_RECTIFICATION`) : re-soumission par A → 200 ; par un autre → 403.
