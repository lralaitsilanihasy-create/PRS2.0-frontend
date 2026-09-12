# Demande backend — Chronométrage SANS « prise en charge » : mesure automatique entrée→fin d'étape

**Date** : 2026-09-12 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : décision pilote — retirer
la **« prise en charge » (PEC)** du chronométrage. Le calcul des délais doit se faire **automatiquement**,
du moment où le dossier **entre** dans une étape/un processus jusqu'au moment où cette étape/ce processus est
**terminé**. Plus aucune action à « prendre en charge » au préalable.

## Modèle actuel (à défaire)

- **PEC manuelle** : `POST /api/dossiers/{id}/prise-en-charge` (avec une prévision en heures saisie par le
  porteur) démarre le compteur d'une étape.
- **« Aucune action sans prise en charge »** (garde serveur `1a92f5a`, demande pilote du 2026-09-04) :
  réception, dispatch, examen, visa, signature, archivage sont **bloqués** tant que la PEC n'est pas faite.
- Le DTO `GET /api/dossiers/{id}/chronometrage` expose des **tâches PEC** (`taches[]`), `acteursAttendus`,
  et le widget affiche « Étape en cours … **Pas encore prise en charge** » + un bouton « Prendre en charge ».

## Modèle demandé (nouveau)

1. **Supprimer la PEC.** Plus de `POST …/prise-en-charge`, plus de garde « aucune action sans PEC ». Les
   actions (réception, dispatch, examen, visa, signature, archivage) s'exécutent **directement**, sans geste
   préalable.
2. **Délai par étape = automatique.** Pour chaque étape/processus du circuit :
   `durée = horodatage de FIN de l'étape − horodatage d'ENTRÉE dans l'étape`, en **heures ouvrées** (comme
   aujourd'hui). L'entrée = la transition de statut **vers** cette étape ; la fin = la transition **vers
   l'étape suivante**. Ces horodatages sont **déjà** enregistrés par le backend (ce sont ceux qui alimentent
   `datesEtapes` et le journal des actions) — donc **aucune saisie**, tout est dérivé des transitions.
3. **Étape en cours** : entrée connue, pas encore de fin → durée courante = `maintenant − entrée`.

## Impact sur le contrat

- `POST /api/dossiers/{id}/prise-en-charge` : **retiré** (ou neutralisé).
- Gardes serveur « aucune action sans PEC » (`1a92f5a`) : **retirées** — les endpoints d'action ne
  vérifient plus la PEC.
- `GET /api/dossiers/{id}/chronometrage` : le DTO **ne porte plus** de PEC — retirer `taches[]` (ou les
  remplacer par des **durées d'étape** dérivées), `acteursAttendus`, et tout ce qui dit « pas encore prise
  en charge ». À la place, par étape : `entree`, `fin?`, `dureeHeuresOuvrees`. Conserver les totaux
  `dureeBruteHeuresOuvrees` (entrée circuit → SIGMP) et `datePrevisionnelleFin` si toujours pertinents.

## Décisions pilote (2026-09-12) — tranchées

1. **NET CNM conservé.** On garde la distinction : `dureeBruteHeuresOuvrees` (total de bout en bout) **et**
   `dureeNetteHeuresOuvrees` (= brut − attentes PRMP). C'est le **NET** qui juge la CNM. Les périodes où la
   **balle est chez la PRMP** (statuts suspensifs) restent **exclues** du net — la mesure « entrée → fin
   d'étape » ne compte donc, au net, que le temps réellement CNM.
2. **« Fin de traitement prévue » = délais standards.** Le référentiel `tr_delai_standard` (8 étapes) et
   l'écran Admin « Délais standards » sont **conservés** comme objectifs par étape ; sans PEC, la fin prévue
   se calcule sur ces délais standards (plus sur une prévision saisie). **OK pilote.**
3. La **maille par étape** (les 8 étapes du modèle `c66db71`) reste la référence pour les durées — détail
   d'implémentation laissé au backend, du moment que le net exclut bien les attentes PRMP.

## Côté front — à faire APRÈS livraison (rien avant : le backend porte encore la PEC)

- Retirer le bouton **« Prendre en charge »** et les gardes **« aucune action sans prise en charge »** de
  `reception-form`, `dispatch-form`, `examen-dossier`, `pv-assistant` (le corps de ces écrans redevient
  actif directement).
- Simplifier `app-chronometrage-dossier` : plus de PEC ni d'« acteurs attendus » ; afficher les **durées
  d'étape** (entrée → fin) et l'étape en cours.
- Retirer `priseEnCharge()` du service, `pecPermise`/`acteursAttendus` des usages.

**Tant que le backend impose la PEC, le front ne peut pas retirer ses gardes** (une action sans PEC serait
refusée). D'où la séquence : backend d'abord, front ensuite (contre-recette réelle à la livraison).
