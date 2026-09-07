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

---

## Note de livraison backend — 2026-09-07 (`PRS20`, commit `399c1c0`)

Les trois trous sont fermés, sans migration de schéma pour T2 et T3. Suite : 796 tests verts à ce commit.
Tests : `RecensementTrousIntegrationTest` (3 cas, un par trou).

### T1 — le retrait au journal

Dérivé de `t_demande_retrait` **à la lecture**, donc rétroactif : `DEMANDE_RETRAIT` (opérateur = la PRMP,
`idPrmpOperateur` posé — donc **pas** de marqueur « opérateur ≠ attributaire »), `RETRAIT_ACCEPTE`
(opérateur = le décideur), `RETRAIT_REFUSE` (avec l'observation). Les trois noms sont ceux que vous
proposiez. Détail dans `docs/demande-backend-2026-09-07-retrait-dossier-journal.md`.

### T2 — la transmission SIGMP directe

⚠️ **Le chemin réel est `POST /api/sigmp-transmissions`**, pas `/transmissions-sigmp` comme écrit dans le
recensement — à corriger dans vos notes. Il clôt désormais l'occurrence `VERIFICATION` **ouverte** du
dossier (`ChronometrageService.cloturerSiOuverte`), et **n'en crée jamais** : un dossier jamais pris en
charge ne se voit pas inventer une tâche. Le trou est **reconfirmé** par le test, sur le chemin FAV direct.

### T3 — les justifications hors import : arbitrage rendu

**L'écart à l'import reste volontaire** — un PDF ne porte aucune justification, et y appliquer la garde
bloquerait tout import d'un plan dérogatoire. Plutôt que de documenter le trou, je l'ai **fermé ailleurs** :
`POST /api/dossiers/{id}/soumettre` exige les justifications d'un dossier **DDP**, sur ses **lignes
stockées** (non supprimées) et la globale du PPM, avec les **mêmes 400 par champ** qu'à la saisie
(`marches[i].justifModeDerogatoire`, `marches[i].justifDelaiAmenage`, `justificationFiche`).

C'est le point où **tous les chemins convergent** : cela couvre aussi les PATCH de rectification champ à
champ, que la demande ne mentionnait pas. Conséquence pour le front : un plan importé sans justification
part en **400 à la soumission** — l'écran de mise à jour par import doit donc laisser compléter la grille
avant de soumettre. Les erreurs sont déjà affichées telles quelles par l'intercepteur.
