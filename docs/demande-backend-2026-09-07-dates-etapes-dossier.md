# Demande backend — Servir les DATES DES ÉTAPES du circuit sur le DTO dossier

> ✅ **CLÔTURÉE le 07/09** — backend livré : `DossierDto.datesEtapes` aux 7 clés (toujours présentes,
> null si l'étape n'est pas franchie), dérivé en lot dans `ChronometrageService.datesEtapes` (aucun
> N+1), `RECEPTION` = `dateEnregistrement` par construction. ⚠️ Règle affinée à la livraison
> (dossier réel) : le franchissement se juge sur le STATUT, pas sur l'existence de la tâche —
> DISPATCH/EXAMEN/PROJET_PV redeviennent null après annulation de dispatch ou réexamen ; PV_SIGNE
> daté à la dernière signature seulement ; VERIFICATION aux observations levées ; CLOTURE au statut
> clôturé. PROJET_PV = clôture d'EXAMEN (repli, pas de tâche de soumission). Contre-recette front
> verte : frise Président datée sans dispatchs/examens (portée), RECEPTION = dateEnregistrement.
> Aucun changement front (frise déjà câblée sur datesEtapes).

**Date** : 2026-09-07 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : demande pilote —
la frise du circuit (tableau de bord, « Pipeline — toutes localités ») doit porter **la date de
chaque étape franchie** sous son point (Réception, Dispatch, Examen, Projet PV, PV signé,
Vérification, Clôture).

## Constat

Le front datait chaque étape par jointure des listes `receptions` / `dispatchs` / `examens` /
`pvs` / `verifications`. Mais selon la PORTÉE du profil, ces listes reviennent **vides** : au
Président (« toutes localités »), `GET /api/dispatchs` et `GET /api/examens` répondent `[]` — la
frise n'a alors aucune date (seul le statut de l'étape en cours s'affiche).

Le **chronométrage** du dossier porte, lui, toutes les dates par étape (occurrences closes de
RECEPTION, DISPATCH, EXAMEN, VISA/COSIGNATURE, VERIFICATION…) et est déjà résolu **en lot** pour
`dateEnregistrement` / `datePrevisionnelleFin` (`enrichirChronometrage`, sans N+1).

## Demande

Ajouter au DTO dossier (mêmes listes que `dateEnregistrement`) :

- **`datesEtapes`** : objet nullable `{ [étape]: date-heure | null }`, une entrée par étape de la
  frise (clés du front : `RECEPTION`, `DISPATCH`, `EXAMEN`, `PROJET_PV`, `PV_SIGNE`,
  `VERIFICATION`, `CLOTURE`), chaque valeur = la **date de franchissement** de l'étape, dérivée
  des tâches de chronométrage :
  - `RECEPTION` = clôture de RECEPTION (= `dateEnregistrement`, par cohérence) ;
  - `DISPATCH` = clôture du dernier DISPATCH ;
  - `EXAMEN` = clôture du dernier EXAMEN ;
  - `PROJET_PV` = soumission du projet de PV (à défaut, clôture d'EXAMEN de la navette qui l'a
    produit) ;
  - `PV_SIGNE` = pose de la dernière signature (COSIGNATURE close / PV SIGNE) ;
  - `VERIFICATION` = clôture de la VERIFICATION ;
  - `CLOTURE` = clôture du dossier (transmission SIGMP / archivage).
  Chaque étape non encore atteinte → `null`. Résolution **en lot**, aucun N+1.

Le front est prêt : il alignera `datesEtapes` sur ses 7 étapes et l'utilisera en priorité, avec
repli sur les jointures actuelles quand le champ n'est pas servi.

## Tests attendus

1. Dossier examiné (projet de PV soumis) → `RECEPTION`, `DISPATCH`, `EXAMEN`, `PROJET_PV` datés,
   le reste `null`.
2. Cohérence : `datesEtapes.RECEPTION` = `dateEnregistrement`.
3. Le Président lit `datesEtapes` sur `GET /api/dossiers` alors que `dispatchs`/`examens` restent
   vides (portée inchangée).
