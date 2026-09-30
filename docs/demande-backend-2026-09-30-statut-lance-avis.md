# Demande backend — 2026-09-30 — La ligne passe à « Lancé » à l'impression de l'avis spécifique, plus à la création de la fiche

**Origine** : décision du pilote du 30/09, avec une capture du plan 00004 à l'appui : « Le statut du marché ne doit être
changé en Lancé que lorsque l'avis spécifique est imprimé. »

**Constat** : depuis la règle du 27/09 (`demande-backend-2026-09-27-statut-lance-dmc.md`), la **création du DMC**
(`DmcService.creerParMarche`) fait passer la ligne de `PREVU` à `LANCE`. Sur le plan 00004, les sept lignes qui ont une
fiche DAO sont ainsi « Lancé » :
- 303105, 303107 (fournitures) ;
- 303111, 303119, 303120, 303121, 303127 (travaux).

Or aucune n'a d'avis spécifique imprimé : aucun dossier n'est encore passé en Commission. Un marché n'est pas lancé
tant que son avis n'est pas publié.

**Décision** : le statut suit **la publication**. La fiche DAO et son examen font partie de la **préparation** : la
ligne reste « Prévu ». La **première impression** de l'avis spécifique (lot AV, livré le 30/09) la fait passer
« Lancé ». Les statuts manuels (`CHDP`, `DSS`) restent à la main de la PRMP, comme le 27/09.

## B1 — La création du DMC ne touche plus le statut

- Dans `DmcService.creerParMarche`, retirer le passage `PREVU → LANCE`. `DmcDto.statutLigne` reste servi (le statut
  de la ligne, désormais inchangé).
- L'événement de journal `LIGNE_LANCEE` quitte la création du DMC ; il passe à B2.

> ⚠️ **Livraison backend du 2026-09-30 (§B1).** Conforme. `DmcService` ne touche plus le statut, et le journal de
> création du DMC n'écrit plus `LIGNE_LANCEE`. `DmcDto.statutLigne` reste servi : c'est le statut tel quel, en règle
> générale `PREVU`.

## B2 — La première impression de l'avis spécifique : `PREVU` → `LANCE`

- Dans `AvisSpecifiqueService.produire`, dans la même transaction que l'impression : si la ligne du DMC est `PREVU` (ou
  sans statut), elle passe `LANCE`. Même périmètre que la règle de suppression du 27/09 : la ligne **et sa filiation**
  vivante (la copie d'une mise à jour en cours), pour que la version courante du plan dise « Lancé ».
- Un statut manuel (`CHDP`, `DSS`) n'est pas écrasé, et l'impression reste possible.
- Une réimpression ne change rien : la ligne est déjà `LANCE`.
- Journal : `LIGNE_LANCEE`, détail « Ligne n : avis spécifique imprimé (publication du JJ/MM/AAAA), statut PREVU →
  LANCE », ou « … statut CHDP conservé (statut manuel) ». Il s'ajoute à `AVIS_SPECIFIQUE_IMPRIME`.
- La réponse de `POST …/avis-specifique` n'a pas à changer. L'écran relit le plan quand il l'affiche.

> ⚠️ **Livraison backend du 2026-09-30 (§B2).** Conforme.
> - Dans la même transaction que l'impression, la ligne du DMC **et toute sa filiation** passent de `PREVU` (ou sans
>   statut) à `LANCE`. C'est le même périmètre que la suppression de la fiche.
> - Un statut manuel (`CHDP`, `DSS`) n'est pas écrasé, et l'impression reste possible.
> - Journal `LIGNE_LANCEE` sur le **plan** (le dossier de la ligne, comme le 27/09), à la première impression :
>   « Ligne 303121 : avis spécifique imprimé (publication du 05/10/2026), statut PREVU → LANCE », ou « … statut CHDP
>   conservé (statut manuel) ». Il s'ajoute à `AVIS_SPECIFIQUE_IMPRIME`, qui va sur le dossier DAO.
> - Une réimpression ne change rien et n'écrit rien, sauf si une ligne de la filiation est encore « Prévu ».
> - La réponse de `POST …/avis-specifique` est inchangée.
>
> Tests : `AvisSpecifiqueIntegrationTest.premiereImpressionLanceLaLigne` et `statutManuelConserve`.

## B3 — « Lancé » ne se choisit plus à la main avant l'avis, et ne se quitte plus pour « Prévu » après

Saisie et mise à jour du PPM (`PUT /api/marches/{id}`, `PATCH …/rectifier`), avec le même 400 nominatif `statut` que le
27/09, validé avant toute mutation :

| Demande | Ligne sans avis imprimé | Ligne avec un avis imprimé |
|---|---|---|
| `LANCE` | **refusé** : « Le marché passe « Lancé » à l'impression de son avis spécifique. » (sauf si la ligne est déjà `LANCE` : elle se ré-enregistre telle quelle) | accepté |
| `PREVU` | accepté (**la règle du 27/09 tombe** : une fiche DAO ne l'empêche plus) | **refusé** : « L'avis spécifique de ce marché est imprimé : il ne redevient pas « Prévu ». » |
| `CHDP`, `DSS` | acceptés | acceptés |
| absent (réimport) | inchangé | inchangé |

> ⚠️ **Livraison backend du 2026-09-30 (§B3).** Conforme au tableau, sur `PUT /api/marches/{id}` et
> `PATCH …/rectifier`, validé avant toute mutation (400 nominatif `statut`, messages mot pour mot). « Avis imprimé »
> se lit sur la **filiation** de la ligne : la copie d'une mise à jour du plan hérite de l'avis de sa ligne d'origine.
> **Un écart** : « absent → inchangé » vaut désormais pour **toute** ligne, comme le dit le tableau. Avant, une ligne
> sans DMC dont le statut était absent de la requête revenait à `PREVU`, si bien qu'un réimport ramenait une ligne
> `CHDP` à « Prévu ». Elle garde maintenant son statut. Une ligne sans statut reçoit `PREVU`, comme avant. Tests :
> `StatutLanceDmcIntegrationTest.sansAvis` et `avecAvis`, sur la copie d'une mise à jour, puisque le plan clôturé ne
> se modifie pas.

## B4 — Ce que la ligne dit au front

`MarcheDto` gagne **`avisImprimeLe: string | null`**, la date de la **première** impression de l'avis spécifique de la
ligne (de sa filiation), `null` sinon. `idDmc` reste servi.

La grille s'en servira :
- pour proposer « Lancé » seulement après l'avis, et « Prévu » seulement avant ;
- pour afficher « Lancée par l'avis spécifique imprimé le JJ/MM/AAAA » (au lieu de « lancée par le dossier de mise en
  concurrence n° … »).

> ⚠️ **Livraison backend du 2026-09-30 (§B4).** `MarcheDto.avisImprimeLe` (date `AAAA-MM-JJ`) : la première impression
> de l'avis de la **filiation**, `null` sans avis. Il est servi sur la ligne, sur la liste et sur la page (une seule
> requête pour toute la liste, comme `idDmc`), ainsi que sur toute réponse d'écriture.

## B5 — Rattrapage (à passer avec l'accord du pilote)

Script idempotent `docs/referentiel/2026-09-30-statut-lance-avis.sql` : toute ligne `LANCE` qui n'a **pas** d'avis
imprimé et que le serveur a lancée **à la création de son DMC** (événement `LIGNE_LANCEE` au journal) redevient
`PREVU`. Sur DBPRS20, ce sont les sept lignes du constat. Une ligne mise à « Lancé » **à la main** avant la règle (sans
`LIGNE_LANCEE`) n'est pas touchée : merci de les lister dans votre encadré, s'il y en a.

> ⚠️ **Livraison backend du 2026-09-30 (§B5).** Script `docs/referentiel/2026-09-30-statut-lance-avis.sql` (PRS20),
> idempotent. Il ramène à `PREVU` les lignes « Lancé » que le serveur a lancées à la création de leur DMC (événement
> `LIGNE_LANCEE` « Ligne n : DMC m créé, statut … → LANCE ») et dont la filiation n'a aucun avis imprimé.
> **Sur DBPRS20, ce sont 12 lignes, pas 7** : 303105, 303106, 303107, 303111, 303119, 303120, 303121, 303127, 303145,
> 303182, 303328, 303329. Toutes sont du plan 100359 (00004), et toutes ont leur événement du 29 ou du 30/09. **Aucune
> ligne n'a été mise à « Lancé » à la main**, et aucun avis n'est encore imprimé. La répétition à blanc les ramène
> toutes les 12 à « Prévu ». **Il n'est pas passé : j'attends l'accord du pilote.**

## B6 — Tests

- Création d'une fiche : la ligne reste `PREVU`.
- Première impression : `PREVU → LANCE` sur la ligne et sa filiation, journal `LIGNE_LANCEE`. Réimpression : rien ne
  change. `CHDP` conservé.
- Le tableau de B3, cas par cas.
- `avisImprimeLe` servi, `null` sans avis.

> ⚠️ **Livraison backend du 2026-09-30 (§B6).**
> - `StatutLanceDmcIntegrationTest` (4 cas) :
>   - création du DMC sans changement de statut ;
>   - tableau B3 sans avis, puis avec avis (dont la copie de version et la rectification) ;
>   - `avisImprimeLe` servi et `null` ;
>   - la suppression de la fiche rend encore « Prévu » à une ligne « Lancé » d'avant la règle.
> - `AvisSpecifiqueIntegrationTest` : première impression `PREVU → LANCE` et journal ; réimpression sans effet ;
>   `CHDP` conservé.

## Ce que le backend rend

Commit(s) qui referment B1 à B6, le script B5, et un encadré ⚠️ daté ici pour tout écart. La demande du 27/09 est
corrigée en place : encadrés ⚠️ du 30/09 à ses §B1, §B3 et §B4. Côté front ensuite : la liste déroulante des statuts
(`statutsAdmissibles`) et la mention de la grille et de la modale de détail.
