# Demande backend — 2026-09-27 — La ligne du plan passe à « Lancé » quand son dossier de mise en concurrence est créé

**Origine** : règle énoncée par le pilote le 27/09, écran du plan de passation à l'appui : « lorsque la ligne de la PPM
est en phase de création de dossier de mise en concurrence, son statut doit être en lancé ».

**Constat** : le statut d'une ligne (`t_marche.STATUT`, code du référentiel administrable `/api/statut-marches` : `PREVU`,
`LANCE`, `CHDP`, `DSS` — V24, `PREVU` indélébile) n'est écrit que par la saisie et la mise à jour du PPM
(`MarcheService`, `statutMarcheService.normaliser(dto.getStatut())`). La création du DMC (`POST /api/dmcs/par-marche/{idDetail}`,
`DmcService.creerParMarche`, qui pose `StatutDmc.A_PREPARER`) ne touche pas la ligne : les deux lignes qui portent
aujourd'hui un DAO (303092, 303101) sont restées `PREVU`. Le statut est donc à la main de la PRMP, qui doit y penser.

**Décision** : le statut suit le fait. Le geste qui ouvre la mise en concurrence — la création du DMC — pose `LANCE` ;
le geste qui la referme — la suppression de la fiche et de son DMC, qui rend la ligne préparable — rend `PREVU`. Les
deux statuts manuels (`CHDP` changement de projet, `DSS` déclaré sans suite) restent à la main de la PRMP, en saisie
comme en mise à jour, dans les deux états.

## B1 — À la création du DMC : `PREVU` → `LANCE`

- Dans `DmcService.creerParMarche`, après la création du DMC et dans la même transaction : si la ligne est `PREVU`
  (ou sans statut), elle passe `LANCE`. Un statut manuel déjà posé (`CHDP`, `DSS`) n'est pas écrasé : la création du
  DMC est alors refusée ? — **non** : elle reste possible (une PRMP peut relancer un projet changé), mais le statut n'est
  pas touché et la réponse le dit (`avertissements: ["statut"]` ou un champ `statutLigne` dans le `Dmc` renvoyé).
- Journal : la ligne du journal du dossier de planification porte l'événement (`LIGNE_LANCEE`, ou l'existant
  `DMC_CREE` enrichi du statut avant / après).

> ⚠️ **Livraison backend du 2026-09-27 (§B1).** Conforme, avec ces précisions : la réponse porte **`DmcDto.statutLigne`**
> (le statut de la ligne après la création : `LANCE`, ou le statut manuel conservé) — pas d'`avertissements[]` ; il n'existait
> pas de `DMC_CREE` au journal, l'événement est **`LIGNE_LANCEE`**, détail « Ligne n : DMC m créé, statut PREVU → LANCE » ou
> « … statut CHDP conservé (statut manuel) », posé quel que soit le créateur (PRMP / UGPM, ou Administrateur en acte
> contrôleur). Le socle de test ne sème que `PREVU` : si le code **`LANCE` a disparu du référentiel** (seul `PREVU` est
> indestructible), le serveur le **remet** (« Lancé », ordre 11, actif) avant de l'écrire, sinon la ligne ne pourrait plus se
> ré-enregistrer (`normaliser` refuse un code inconnu).

> ⚠️ **Décision du pilote du 2026-09-30 — §B1 remplacé.** La ligne ne passe plus « Lancé » à la création du DMC, mais à la
> **première impression de l'avis spécifique** : « Le statut du marché ne doit être changé en Lancé que lorsque l'avis
> spécifique est imprimé. » Voir `demande-backend-2026-09-30-statut-lance-avis.md`.

## B2 — À la suppression de la fiche et du DMC : `LANCE` → `PREVU`

- `FicheMarcheService.supprimer` (`DELETE /api/fiches-marche/{idDmc}`, « la ligne du plan redevient préparable ») :
  si la ligne est `LANCE`, elle redevient `PREVU`. Un `CHDP` / `DSS` reste tel quel.

> ⚠️ **Livraison backend du 2026-09-27 (§B2).** `PREVU` est rendu à **toute la filiation** `LANCE` de la ligne du DMC
> (la copie d'une mise à jour en cours aussi, sinon elle resterait « Lancé » sans DAO) ; le détail du journal
> `FICHE_MARCHE_SUPPRIMEE` s'achève par « ; statut rendu à PREVU (ligne n) ».

## B3 — Une ligne en mise en concurrence ne redevient pas « Prévu » à la main

- Saisie du PPM (`PUT` des marchés) et mise à jour du PPM (nouvelle version) : `statut = PREVU` sur une ligne qui porte
  un DMC vivant est refusé par un **400 nominatif** `[{ champ: "statut", message: "La ligne est en mise en concurrence
  (dossier n° …) : elle ne redevient pas « Prévu ». Supprimez la fiche DAO pour la rendre préparable." }]`. `CHDP` et
  `DSS` restent acceptés. Une version nouvelle du PPM recopie `LANCE` sur la ligne recopiée (filiation
  `ID_LIGNE_ORIGINE`) : la mise à jour du plan ne fait pas oublier la mise en concurrence.

> ⚠️ **Livraison backend du 2026-09-27 (§B3).** Le 400 vaut sur `PUT /api/marches/{id}` et `PATCH …/rectifier` (donc sur
> la façade `PUT /api/saisies/ppm/{id}`, qui passe par eux), message tel quel, **validé avant toute mutation** (un 400 ne
> laisse pas d'entité sale). Deux nuances, dans l'esprit de `statutsAdmissibles()` du front : un **statut absent** sur une
> ligne lancée vaut **inchangé** (un réimport du plan, qui n'envoie pas de statut, ne la ramène pas à « Prévu » — sans DMC,
> absent vaut toujours `PREVU`) ; une ligne **restée `PREVU`** d'avant la règle, ou avant le rattrapage, **se ré-enregistre
> telle quelle** (on ne cache jamais la valeur affichée, le front la laisse dans la liste dans ce cas). `LANCE` envoyé
> explicitement est accepté (code du référentiel). La recopie de `LANCE` par la mise à jour du plan était déjà le
> comportement (`copierLignes` recopie le statut) : vérifié par le test, rien de changé.

> ⚠️ **Décision du pilote du 2026-09-30 — §B3 remplacé.** La garde porte sur l'avis imprimé, plus sur le DMC vivant ; la ligne ne passe plus « Lancé » à la création du DMC, mais à la
> **première impression de l'avis spécifique** : « Le statut du marché ne doit être changé en Lancé que lorsque l'avis
> spécifique est imprimé. » Voir `demande-backend-2026-09-30-statut-lance-avis.md`.

## B4 — Ce que la ligne dit au front

- `MarcheDto` (les marchés d'un dossier, la grille de saisie, la consultation) gagne **`idDmc: Long | null`** : le DMC
  vivant de la ligne, ou `null`. La grille s'en sert pour retirer « Prévu » de la liste déroulante d'une ligne lancée
  et le dire à côté (« lancée par le dossier de mise en concurrence n° … ») ; la consultation n'a rien à faire, le
  badge suit le code. `LigneEligible.dejaDao` / `idDmc` existent déjà de leur côté, inchangés.

> ⚠️ **Décision du pilote du 2026-09-30 — §B4 complété (`avisImprimeLe`).** La ligne ne passe plus « Lancé » à la création du DMC, mais à la
> **première impression de l'avis spécifique** : « Le statut du marché ne doit être changé en Lancé que lorsque l'avis
> spécifique est imprimé. » Voir `demande-backend-2026-09-30-statut-lance-avis.md`.

## B5 — Rattrapage

- Script `docs/referentiel/2026-09-27-statut-lance-dmc.sql` idempotent : toute ligne `PREVU` (ou nulle) qui porte un DMC
  vivant passe `LANCE` (303092 et 303101 sur DBPRS20).

> ⚠️ **Livraison backend du 2026-09-27 (§B4 / §B5).** `MarcheDto.idDmc` est le DMC vivant **de la filiation** (le plus
> ancien), servi en liste et en page par une seule requête ; il est ignoré en entrée. Le script prend aussi les copies
> d'une filiation dans une version du plan **non remplacée** (`t_dossier.STATUT <> 'REMPLACE'`). Sur DBPRS20 au 27/09 au
> soir, **quatre** lignes portent un DMC et sont restées `PREVU` (303092, 303094, 303098, 303101 — DMC 16 à 19), pas deux :
> le script les passe toutes à `LANCE`.

## B6 — Tests

- Création du DMC sur une ligne `PREVU` → `LANCE` ; sur une ligne `CHDP` → statut inchangé, réponse le dit.
- Suppression de la fiche → `PREVU` ; sur une ligne `DSS` → inchangé.
- `PUT` d'un marché en `PREVU` avec DMC vivant → 400 nominatif `statut` ; en `DSS` → 200.
- Mise à jour du PPM : la ligne recopiée garde `LANCE`.
- `MarcheDto.idDmc` servi (nul sans DMC).

> ⚠️ **Livraison backend du 2026-09-27 (§B6).** `StatutLanceDmcIntegrationTest` (4 cas) : création sur `PREVU` → `LANCE`
> (`statutLigne`, `idDmc` en liste et à l'unité, journal `LIGNE_LANCEE`) et sur `CHDP` → conservé, dit ; suppression de la
> fiche → `PREVU` (journal), `DSS` inchangé ; mise à jour du plan → copie `LANCE` avec `idDmc` par filiation, `PUT` en
> `PREVU` → 400 `statut` (message exact), absent → inchangé, `DSS` → 200, `LANCE` → 200, ligne sans DMC → `PREVU` libre ;
> rectification (`PATCH …/rectifier`) : `PREVU` → 400, `CHDP` → 200 avec `idDmc`.

## Ce que le backend rend

B1 à B6, `docs/api-endpoints.md` (DTO et 400), `docs/regles-gestion.md` (§ PRMP, statut de marché), et un encadré ⚠️
daté ici pour tout écart.

> ⚠️ **Rendu le 2026-09-27.** Aucune migration (le code `LANCE` est du référentiel V24, remis par le serveur s'il manque) ;
> rattrapage par `docs/referentiel/2026-09-27-statut-lance-dmc.sql`. Contrat : `docs/api-endpoints.md`, § *Marchés*
> (`statut`, `idDmc`), § *Dossiers de mise en concurrence* (encadré « la ligne passe à Lancé », `statutLigne`), § *Défaire
> une fiche marché* et § *Statuts de marché* ; règle : `docs/regles-gestion.md`, § 3.8 *Statuts de marché*.
