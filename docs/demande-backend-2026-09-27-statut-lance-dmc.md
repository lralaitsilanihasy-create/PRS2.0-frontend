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

## B2 — À la suppression de la fiche et du DMC : `LANCE` → `PREVU`

- `FicheMarcheService.supprimer` (`DELETE /api/fiches-marche/{idDmc}`, « la ligne du plan redevient préparable ») :
  si la ligne est `LANCE`, elle redevient `PREVU`. Un `CHDP` / `DSS` reste tel quel.

## B3 — Une ligne en mise en concurrence ne redevient pas « Prévu » à la main

- Saisie du PPM (`PUT` des marchés) et mise à jour du PPM (nouvelle version) : `statut = PREVU` sur une ligne qui porte
  un DMC vivant est refusé par un **400 nominatif** `[{ champ: "statut", message: "La ligne est en mise en concurrence
  (dossier n° …) : elle ne redevient pas « Prévu ». Supprimez la fiche DAO pour la rendre préparable." }]`. `CHDP` et
  `DSS` restent acceptés. Une version nouvelle du PPM recopie `LANCE` sur la ligne recopiée (filiation
  `ID_LIGNE_ORIGINE`) : la mise à jour du plan ne fait pas oublier la mise en concurrence.

## B4 — Ce que la ligne dit au front

- `MarcheDto` (les marchés d'un dossier, la grille de saisie, la consultation) gagne **`idDmc: Long | null`** : le DMC
  vivant de la ligne, ou `null`. La grille s'en sert pour retirer « Prévu » de la liste déroulante d'une ligne lancée
  et le dire à côté (« lancée par le dossier de mise en concurrence n° … ») ; la consultation n'a rien à faire, le
  badge suit le code. `LigneEligible.dejaDao` / `idDmc` existent déjà de leur côté, inchangés.

## B5 — Rattrapage

- Script `docs/referentiel/2026-09-27-statut-lance-dmc.sql` idempotent : toute ligne `PREVU` (ou nulle) qui porte un DMC
  vivant passe `LANCE` (303092 et 303101 sur DBPRS20).

## B6 — Tests

- Création du DMC sur une ligne `PREVU` → `LANCE` ; sur une ligne `CHDP` → statut inchangé, réponse le dit.
- Suppression de la fiche → `PREVU` ; sur une ligne `DSS` → inchangé.
- `PUT` d'un marché en `PREVU` avec DMC vivant → 400 nominatif `statut` ; en `DSS` → 200.
- Mise à jour du PPM : la ligne recopiée garde `LANCE`.
- `MarcheDto.idDmc` servi (nul sans DMC).

## Ce que le backend rend

B1 à B6, `docs/api-endpoints.md` (DTO et 400), `docs/regles-gestion.md` (§ PRMP, statut de marché), et un encadré ⚠️
daté ici pour tout écart.
