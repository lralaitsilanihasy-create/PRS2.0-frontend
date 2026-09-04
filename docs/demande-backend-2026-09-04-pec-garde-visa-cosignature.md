# Demande backend — Prise en charge : garde d'acteur sur VISA et COSIGNATURE

> ✅ **CLÔTURÉE le 04/09** — backend livré (`1a92f5a`, 765 tests) et contre-recetté en réel 4/4
> (cycle deux-niveaux neuf, dossier purgé après) : niveau CC → PEC Président 403 / CC 200 ;
> niveau PRESIDENT → PEC CC 403 / Président 200 ; COSIGNATURE → non-désigné 403, désignés 200 ;
> `acteursAttendus` = [CC] → [PRES001] → [désignés] selon l'état, messages 403 nominatifs.

**Date** : 2026-09-04 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : constat pilote —
suite directe de `5225529` (garde EXAMEN) et `4ee9c0b` (attributaire au DTO).

## Constat (vécu en recette réelle, dossier 100286)

Sur un dossier à deux niveaux, le CC a accepté le PV (VISA#1 close — la mécanique par niveaux de
`5225529` a bien joué) **puis a cliqué « Prendre en charge » à nouveau** : le serveur a répondu 200
et ouvert **VISA#2 au nom du CC**, alors que cette occurrence revient au **Président** (le PV est à
son niveau). Résultat : le Président était verrouillé — sa PEC = tâche d'autrui, 409 — et rien dans
l'UI ne pouvait réparer (déblocage fait en SQL, tâche 75 supprimée).

`5225529` garde EXAMEN (attributaire seul) et les tâches déjà ouvertes (409 autrui), mais la
**création** d'une occurrence VISA/COSIGNATURE n'est pas gardée par acteur.

## Demandes

1. **Garde d'acteur à la PEC** (`POST /dossiers/{id}/prise-en-charge`) quand l'étape courante est :
   - **VISA** — mêmes acteurs que ceux que `POST /pv-examens/{id}/viser` (ou `/accepter` au niveau
     CC) accepterait : deux niveaux, niveau CC → le **CC dispatcheur** du dossier ; niveau
     PRESIDENT → un **PRESIDENT** ; navette simple → le **dispatcheur** (intérim du périmètre
     compris, comme au visa). Autre acteur → **403** explicite (« Le visa de ce dossier revient à … »).
   - **COSIGNATURE** — les **co-signataires désignés** du PV seulement (chacun ouvre SA tâche) ;
     autre acteur → 403.
2. **`acteursAttendus`** (liste de matricules, nullable) dans le DTO de
   `GET /dossiers/{id}/chronometrage` : les acteurs que la garde ci-dessus accepterait pour
   l'étape courante — même philosophie que `attributaire` (`4ee9c0b`) : le front masque le bouton
   à quiconque n'y est pas, sur tous les écrans, sans recharger les dispatchs. Quand la liste ne
   peut pas être close (intérim ouvert du périmètre), la servir vide ou nulle — le front replie
   sur la règle du porteur nominal et le serveur tranche.

## Tests attendus

1. Deux niveaux, PV transmis au Président : PEC par le CC (dispatcheur du dossier compris) → 403 ;
   PEC par le Président → 200, occurrence VISA n+1.
2. Deux niveaux, niveau CC : PEC par le Président → 403 ; par le CC dispatcheur → 200.
3. PV visé avec co-signataires désignés : PEC par un contrôleur non désigné → 403 ; chaque désigné
   ouvre sa tâche COSIGNATURE → 200.
4. `acteursAttendus` reflète chacun de ces cas dans le DTO du chronométrage.
