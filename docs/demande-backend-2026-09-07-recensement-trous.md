# Recensement des trous backend ouverts — au 07/09/2026

> ✅ **LES TROIS TROUS LIVRÉS le 07/09** (backend `399c1c0`, `RecensementTrousIntegrationTest` couvre
> les 3 cas, sans migration) :
> - **T1** — retrait dérivé au journal, **contre-recetté en réel** (voir la demande dédiée) ✅
> - **T2** — `POST /api/sigmp-transmissions` clôt l'occurrence VERIFICATION ouverte si elle existe (et
>   n'en invente jamais). Le front appelait DÉJÀ le bon endpoint (`sigmp-transmissions`) — aucun code
>   à changer. ✅ **CONTRE-RECETTÉ RÉEL 07/09** (dossier jetable 100303 mené en circuit FAV complet
>   jusqu'à CLOTURE) : occurrence VERIFICATION `dateFin:null` AVANT la transmission, `dateFin` posée
>   APRÈS → l'occurrence se clôt.
> - **T3** — arbitrage rendu : l'import PDF reste **permissif** (un PDF ne porte pas de justification),
>   la garde est posée au `POST /api/dossiers/{id}/soumettre` (400 par champ, mêmes qu'à la saisie).
>   Le front affiche déjà ces 400 — l'écran de mise à jour par import doit s'attendre à un refus à la
>   soumission tant que la grille n'est pas complétée. À vérifier à la recette 00002.
>
> ⚠️ Coquille corrigée : le chemin réel de la transmission est **`/api/sigmp-transmissions`** (et non
> `/transmissions-sigmp`).

> Vue consolidée à l'usage de la session backend. Trois trous appellent une correction serveur ;
> deux points sont des **arbitrages à valider par le pilote** (aucune action backend tant que non
> tranché) ; les correctifs déjà faits côté front sont rappelés pour éviter les doublons.

## Trous appelant une correction backend

### T1 — Le retrait d'un dossier n'apparaît pas dans le journal des actions ⛔
- **Constat réel (#100299)** : `GET /dossiers/100299/journal` = 5 actions (Création, Soumission,
  Réception, Soumission, Réception) sans aucun retrait, alors que `GET /demande-retraits?dossier=100299`
  porte une demande **ACCEPTÉE** (PRMP 08:23:03 → PRES001 08:23:50) entre la 1re réception et la 2e
  soumission. Le retour en BROUILLON n'a laissé aucune trace.
- **Demande** : dériver dans la fusion à la lecture (rétroactif) `DEMANDE_RETRAIT` (à `dateDemande`,
  opérateur = `idPrmp`, motif) et **`RETRAIT_ACCEPTE`** (à `dateDecision` si `ACCEPTEE`, opérateur =
  `imCtrlCc`, « SOUMIS → BROUILLON »), + `RETRAIT_REFUSE` si refusée. Rang 0 (visible de tous).
- **Détail complet** : `docs/demande-backend-2026-09-07-retrait-dossier-journal.md`. Front prêt
  (libellés inertes, commit `7c86e4a`).

### T2 — La transmission SIGMP DIRECTE (avis FAV) ne clôt pas l'occurrence VERIFICATION ⛔
- **Constat (03/09, dossier 100278, avis FAV sans boucle FAVR)** : sur un avis FAVORABLE, la
  transmission au SIGMP se fait **sans** `POST /verifications` (pas de passage vérificateur). Or
  l'occurrence de chronométrage **VERIFICATION** ouverte n'est jamais close — `DATE_FIN` reste vide
  à jamais. Le chemin MAINTENUE (avec passage) clôt bien VERIFICATION : **seul** le chemin FAV direct
  laisse la tâche ouverte.
- **Demande** : au `POST /api/sigmp-transmissions`, **clore l'occurrence VERIFICATION encore ouverte**
  du dossier (comme le ferait un passage vérificateur) avant/à l'ouverture de l'étape SIGMP.
- **Mitigation front déjà en place** (`f121dbc`) : `tacheEnCours` = tâche de l'ÉTAPE COURANTE seule,
  une occurrence étrangère restée ouverte ne bloque plus la prise en charge — mais la donnée de
  chronométrage reste fausse (VERIFICATION jamais close) tant que le fond n'est pas corrigé.
- ⚠️ **À reconfirmer** : constat du 03/09 sur un dossier depuis purgé (reset). À rejouer sur le
  chemin FAV-direct pour vérifier si le trou subsiste.

### T3 — Justifications de la fiche : la mise à jour PAR IMPORT échappe à la garde ⛔ (trou assumé)
- **Constat** : la garde « justification obligatoire par champ » (400 nominatif, livrée V13 back +
  `831753b` front) s'applique à la **saisie manuelle** de la grille, mais **pas** à la mise à jour
  d'un PPM **par import PDF** — un import peut réintroduire des lignes sans justification là où la
  saisie les refuserait.
- **Demande** : appliquer la même garde (justification requise par champ concerné) au flux de mise à
  jour par import, ou confirmer que l'écart est volontaire (auquel cas on ferme le trou côté doc).

## Arbitrages en attente du PILOTE (pas d'action backend tant que non tranché)

- **Rectification à écart toléré (≤3 créations / ≤3 suppressions)** — 3 arbitrages backend rendus
  (V19, `94c273b`) restent **à valider par le pilote** avant d'être considérés définitifs.
- **Examen fantôme / journal purge** (`d364f1a`, ✅ clôturé et contre-recetté) — 2 arbitrages
  rendus ; le résidu prospectif sur l'ancien 00001 a été effacé par le reset, rien à rattraper.

## Correctifs déjà traités côté FRONT (rappel — aucune action backend)

- **Fin de traitement CNM affichée avant l'enregistrement** → masquée tant que `dateEnregistrement`
  est nul (`c8a371d`). Le backend continue de servir la projection ; c'est un choix d'affichage.
- **« Aucune pièce attendue » pour un DDP** → comportement correct (DDP n'a que des pièces
  facultatives ; seules obligatoires + facultatives déposées s'affichent). Nuance de libellé
  éventuelle, sans impact backend.
