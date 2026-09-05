# Demande backend — Rectifications : conserver CHAQUE version du PPM (historique du dossier)

**Date** : 2026-09-06 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : demande pilote
(écran « Rectifier le dossier », 00002) — « garder les versions non rectifiées et la version
rectifiée pour l'historique du dossier ».

## Constat

La rectification par import remplace le contenu courant du dossier **en place** ; seul un
instantané du **dernier** cycle est figé (`t_snapshot_rectif_ligne`) et il ne sert que le
`/diff-rectification`. Après plusieurs cycles, les états intermédiaires sont perdus — alors que
les **mises à jour** de PPM, elles, conservent chaque version en entier. Le pilote veut le même
niveau d'historique pour les rectifications : pouvoir consulter chaque version non rectifiée ET
la version courante.

## Demande

1. **À chaque rectification validée** (le PUT `saisies/ppm/{idDossier}` d'un cycle), figer la
   version REMPLACÉE en **version archivée immuable** : numéro d'ordre, date, auteur (PRMP),
   itération de rectification, et les lignes complètes (mêmes champs que le PPM courant —
   montants, bénéficiaires, dates prévisionnelles…).
2. **`GET /dossiers/{id}/versions`** : liste des versions archivées — numéro, date, auteur,
   origine (`RECTIFICATION` ; extensible à `MISE_A_JOUR` si l'unification a du sens), nombre de
   lignes.
3. **`GET /dossiers/{id}/versions/{n}`** : contenu complet de la version (lignes), lecture seule.
4. **Reprise de l'existant** : si l'instantané du dernier cycle est encore en base, le servir
   comme première version archivée (pas de trou pour 00002).
5. Le `/diff-rectification` actuel reste inchangé (dernier cycle) ; si la mécanique du
   versionnement des mises à jour peut être réutilisée telle quelle, la préférer à une table neuve.

## Côté front (après livraison)

Section « Historique des versions » dans la consultation du dossier : liste des versions
(numéro, date, auteur, origine), ouverture d'une version dans le tableau partagé en lecture
seule, badge « version courante » — même langage que le diff existant.

## Tests attendus

1. Deux cycles de rectification successifs → deux versions archivées + la courante ; chaque
   version restitue ses propres montants/lignes.
2. Une version archivée est immuable (toute écriture refusée).
3. Dossier jamais rectifié → liste vide (aucune régression sur `/diff-rectification`).
