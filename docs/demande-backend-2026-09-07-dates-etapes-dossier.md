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

---

## Note de livraison backend — 2026-09-07 (`PRS20`, commits `9b21ee3` puis `d364f1a`)

`DossierDto.datesEtapes` : les **sept clés sont toujours présentes**, une étape non atteinte vaut `null`
(Jackson sérialise les nulls dans ce projet — ne comptez pas sur l'absence de clé). Dérivé dans
`ChronometrageService.datesEtapes` depuis les **mêmes tâches** déjà chargées en lot pour
`datePrevisionnelleFin` et `dateEnregistrement` : **aucune requête de plus**, quelle que soit la taille de
la liste.

### La règle de datation, en une phrase

**Le franchissement se juge sur le STATUT, la date vient des TÂCHES.** Une tâche close ne suffit pas : le
dossier doit avoir dépassé l'étape.

| Clé | Datée quand | Source de la date |
|---|---|---|
| `RECEPTION` | toujours si réceptionné | clôture de `RECEPTION` — **identique à `dateEnregistrement`**, par construction (même méthode) |
| `DISPATCH` | statut ≥ dispatché | clôture du dernier `DISPATCH` |
| `EXAMEN`, `PROJET_PV` | statut ≥ examiné | clôture du dernier `EXAMEN` (le projet de PV en naît — même date) |
| `PV_SIGNE` | PV au statut `SIGNE` | dernière `COSIGNATURE`, à défaut `VISA` |
| `VERIFICATION` | observations levées | clôture de la `VERIFICATION` |
| `CLOTURE` | statut `CLOTURE` | `ARCHIVAGE`, à défaut `TRANSMISSION_SIGMP` |

### ⚠️ Correctif du soir même (`d364f1a`), révélé par un dossier réel

Un dispatch **annulé** ramène le dossier à `PRET_DISPATCH` mais laisse ses tâches closes derrière lui :
`DISPATCH`, `EXAMEN` et `PROJET_PV` étaient datés à tort. Ils suivent désormais la même règle que les
autres — statut d'abord. Idem pour un **réexamen** (`A_REEXAMINER`), qui remet `EXAMEN` à `null`.

Autrement dit : la frise peut **perdre** une date si le dossier recule dans le circuit. C'est voulu — elle
raconte où en est le dossier, pas tout ce qui lui est arrivé (ça, c'est le journal).
