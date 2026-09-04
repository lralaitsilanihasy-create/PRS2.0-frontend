# Demande backend — Prise en charge : garde d'acteur, et occurrences par niveau de navette

> ✅ **CLÔTURÉE le 04/09** — backend livré (`5225529`, 753 tests) et contre-recetté en réel 5/5
> (403 non-attributaire, 409 tâche d'autrui, VISA#1/#2 par niveau, 1 COSIGNATURE par désigné,
> `nomCcCoSignataire` peuplé) — dossier 100290, PV 14 SIGNE, aucune réassignation SQL.

**Date** : 2026-09-04 · **Demandeur** : frontend · **Origine** : constats de la recette réelle du
cycle à deux niveaux (dossier 100285, PV 12) — trois réassignations SQL ont été nécessaires pour la
terminer.

## Constat 1 — PEC d'une étape tenue par un AUTRE : 200 silencieux qui corrige la prévision d'autrui

`POST /dossiers/{id}/prise-en-charge` par un acteur B alors qu'une tâche est OUVERTE au nom de A
répond **200** et **corrige la prévision de la tâche de A** (le « replay » ne vérifie pas
l'acteur). Vécu : le CC avait pris EXAMEN#2 (bouton offert par délégation) — Rina, l'assignataire,
était verrouillée sans recours : son POST « réussissait » en modifiant la prévision du CC.

**Demandes** :
- le replay (correction de prévision) n'est permis qu'au **même acteur** ; un AUTRE acteur reçoit
  **409** explicite : « Étape déjà prise en charge par {nom} » ;
- la prise en charge d'**EXAMEN** est réservée à l'**attributaire courant** du dispatch (cohérent
  avec « seul l'assignataire examine », d24c115) — 403 sinon, même par délégation.

## Constat 2 — Deux niveaux : VISA et COSIGNATURE sont mono-tâche pour des acteurs successifs

Sur un dossier à deux niveaux, l'étape **VISA** couvre deux acteurs successifs (CC au niveau CC,
Président au niveau Président) mais ne porte qu'UNE tâche : le premier preneur verrouille l'autre.
Même chose pour **COSIGNATURE** avec plusieurs co-signataires (CC + Membre).

**Demandes** :
- `POST /{pv}/accepter` (niveau CC → Président) **clôt** l'occurrence VISA en cours et le Président
  prend en charge une **nouvelle occurrence** VISA (n+1) — chaque niveau a sa tâche, sa prévision,
  sa durée ;
- COSIGNATURE : une tâche **par co-signataire désigné** (occurrences successives, ou tâches
  parallèles si le modèle le permet) — chaque signature clôt la sienne ;
- à défaut (v1 minimale) : appliquer le constat 1 (409 nominal) et accepter le **transfert**
  explicite de la tâche au nouvel acteur du niveau.

## Constat 3 — `nomCcCoSignataire` non peuplé

`PvExamenDto.imCcCoSignataire` est servi, mais `nomCcCoSignataire` vaut null (vérifié après un visa
« P + CC + Membre ») — le front replie sur le matricule. Peupler le nom comme pour
`nomMembreCoSignataire`.

## Tests attendus

1. B fait une PEC sur une tâche ouverte par A → 409 « déjà prise en charge par A » ; A re-poste →
   200 (prévision corrigée).
2. PEC d'EXAMEN par le dispatcheur ou le CC en copie (non attributaires) → 403.
3. Deux niveaux : PEC VISA par le CC → accepter → l'occurrence VISA#1 est close ; PEC du Président →
   VISA#2 ; le visa clôt VISA#2.
4. Visa P+CC+Membre → deux tâches COSIGNATURE (une par désigné), chacune close par sa signature.
5. `nomCcCoSignataire` renseigné dans le DTO après un visa désignant le CC.
