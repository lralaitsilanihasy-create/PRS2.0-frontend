# Demande backend — Gestion de l'INTÉRIM dans le circuit de contrôle (lot 1 : Président et CC)

**Date** : 2026-09-21 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : proposition
`docs/proposition-2026-09-13-gestion-interim-controle.md` (13/09), **arbitrée par le pilote le 21/09**
(« On veut insérer la gestion d'intérim »). Ce document remplace l'esquisse du §5 de la proposition : ce
qui suit est **la demande**, et le backend y répond par un commit — les écarts se corrigent ici, en place.

## Ce que le pilote a décidé (21/09)

| # | Question | Décision |
|---|---|---|
| Q1 | Qui désigne ? | **Le titulaire désigne lui-même son intérimaire.** Le **Président** désigne n'importe quel **CC**, de n'importe quelle localité. Un **CC de la Centrale** (trois CC) désigne un **autre CC** ou un **Membre de sa localité**. Un **CC régional** (seul CC de sa localité) désigne un **Membre de sa localité**. |
| Q2 | Qui supplée qui ? | Même réponse : Président ← CC (toute localité) ; CC ← CC ou Membre **de sa localité**. Les autres profils (Secrétaire, Vérificateur, Assistant, Membre absent) **ne déclarent pas d'absence** dans ce lot. |
| Q3 | Part Président quand le CC intérimaire du Président a déjà signé la part CC | **Le CC intérimaire désigne à son tour un CC ou un Membre de sa localité** comme intérimaire de **son propre rôle de CC** : la part CC est signée par cet intérimaire, la part Président par le CC intérimaire du Président — deux personnes distinctes, la règle tient. ⚠️ Lecture du frontend, cas résiduel au §B4.5. |
| Q4 | Pièce et repli ponctuel | **Pièce obligatoire** à la désignation ; **la note PDF au visa et `interimDispatch` restent** comme repli d'urgence (absence non anticipée). |
| Q5 | Mention « par intérim » | **Conserver** l'arbitrage du 01/09 : mention sur les documents régionaux seulement, Centrale sans mention. |
| Q6 | Notifications | **Copie** : le titulaire garde les siennes, l'intérimaire actif en reçoit une copie. |
| Q7 | Acte vers un titulaire absent | **Avertir** ; l'attribution reste au titulaire, son intérimaire agit. Refus pour un acte d'identité et intérimaire proposé à la réattribution : sans objet dans ce lot (aucune absence de Membre n'est déclarée) — lot 2 si les Membres déclarent un jour la leur. |

Conséquence structurante, à lire avant tout : **un Membre peut être l'intérimaire d'un CC** — il exerce
alors des actes de CC (dispatch, visa, réattribution, retrait, part CC de la signature) sous sa propre
identité, tracé « par intérim de X ». C'est le **sens inverse** de la délégation ascendante (supérieur →
subordonné), qui reste inchangée.

## Constat (vrai au 21/09)

Aucune entité d'intérim n'existe. L'intérim n'est qu'une **exception ponctuelle auto-déclarée à l'acte** :
`Dispatch.interimDispatch` (CC hors localité) et le **visa par intérim** (P/CC du périmètre, non
dispatcheur, note PDF obligatoire, `viseParInterim`, note fermée à la PRMP). Personne ne sait à l'avance
qui supplée qui ; **le Président n'est suppléé par personne** (visa de ses dispatchs, pré-dispatch central,
part Président). Détail au §1 de la proposition.

## Demande

### B1 — Ressource `Interim` (`t_interim`, `/api/interims`)

| Champ (JSON) | Type | Sens |
|---|---|---|
| idInterim | number | PK serveur |
| imTitulaire, nomTitulaire, profilTitulaire, idLocaliteTitulaire | string | le contrôleur absent (`PRESIDENT` ou `CHEF_COMMISSION` dans ce lot) ; nom **figé** à la désignation |
| imInterimaire, nomInterimaire, profilInterimaire, idLocaliteInterimaire | string | le désigné (≠ titulaire) |
| dateDebut, dateFin | date | période **inclusive** ; `dateFin` **obligatoire** (prolongation = **nouvel** intérim, comme la reconduction d'un mandat) — sauf `motif = VACANCE_POSTE`, `dateFin` nulle admise |
| motif | string | `CONGE` · `MISSION` · `MALADIE` · `VACANCE_POSTE` · `AUTRE` |
| reference | string (max 100) | note de service / décision de désignation |
| pieceNom, pieceDisponible | string, boolean | la pièce PDF (voir B2), **obligatoire** (Q4) |
| designePar, nomDesignePar, dateDesignation | string, string, datetime | qui a créé (titulaire, ou Admin — B3) |
| statut | string | **dérivé à la date du jour, jamais reçu** : `REVOQUE` prime ; sinon avant `dateDebut` → `A_VENIR`, pendant → `ACTIF`, après `dateFin` → `ACHEVE` |
| dateRevocation, motifRevocation, revoquePar | date, string, string | fin avant terme (B3) |

**Ni `PUT` ni `DELETE`** : un intérim est un acte daté, l'historique reste ; on le clôt par `revoquer`.

### B2 — Endpoints

| Méthode | URL | Corps | Réponse | Statuts | Accès |
|---|---|---|---|---|---|
| GET | /api/interims | — | `InterimDto[]` | 200 | contrôleurs + Admin — filtres `?titulaire=`, `?interimaire=`, `?actifs=true` (ACTIF **et** A_VENIR) ; ordre chronologique ; **403 PRMP/UGPM** |
| GET | /api/interims/mes | — | `MesInterimsDto` | 200 | contrôleur de session : `exerces` (ACTIF où je suis intérimaire), `subi` (ACTIF où je suis titulaire, ou `null`), `aVenir` — **le signal du front** (bannière, menus, droits) |
| GET | /api/interims/{id} | — | `InterimDto` | 200, 403, 404 | contrôleurs + Admin |
| GET | /api/interims/{id}/piece | — | `application/pdf` | 200, 403, 404 | contrôleurs + Admin — **403 PRMP/UGPM** (même garde que `note-interim`) |
| POST | /api/interims | `multipart/form-data` : partie **`data`** = `CreerInterimRequest` (JSON) + partie **`piece`** = PDF | `InterimDto` | 201, 400, 403, 404, **409** | voir B3 |
| POST | /api/interims/{id}/revoquer | `{ motif (@NotBlank, max 255), dateRevocation? (défaut aujourd'hui) }` | `InterimDto` | 200, 400, 403, 404, 409 | voir B3 |

**`CreerInterimRequest`** = `{ imTitulaire (@NotBlank), imInterimaire (@NotBlank), dateDebut (@NotNull),
dateFin (obligatoire sauf VACANCE_POSTE), motif (@NotNull), reference (@NotBlank, max 100) }`. Pièce :
même validation que la note d'intérim au visa (PDF, taille plafonnée) → **400** sinon.

### B3 — Qui désigne, qui révoque (Q1, Q2)

| Titulaire | Désignateur | Intérimaires admissibles |
|---|---|---|
| Président | **le Président** | tout **CC**, toute localité |
| CC de la Centrale | **ce CC** | un **autre CC de la Centrale**, ou un **Membre de la Centrale** |
| CC régional | **ce CC** | un **Membre de sa localité** (il n'y a pas d'autre CC) |

- `imTitulaire` ≠ utilisateur de session → **403 nominatif** (« Seul Prénoms Nom désigne son intérimaire »).
  ✅ **Confirmé par le pilote le 22/09** (« tout est OK ») : l'**Administrateur** peut désigner et révoquer **pour tout
  titulaire** (repli quand l'absent n'a rien déclaré), comme pour les mandats — implémenté des deux côtés.

  > ⚠️ **Livraison backend du 2026-09-21** — implémenté tel quel : l'Administrateur désigne et révoque en repli
  > (`designePar` = son matricule). Le 403 nomme le titulaire dans la convention de l'application, « NOM Prénoms »
  > (« Seul NOM Prénoms désigne son intérimaire… »). Un titulaire d'un profil hors Président / CC (un Membre) → **409**
  > « ne déclare pas d'absence dans ce lot ». Contrat complet : `docs/api-endpoints.md`, section « Intérims ».
- Intérimaire non admissible (profil, localité, ou lui-même) → **409 nominatif** (« Prénoms Nom n'est pas un
  CC » / « n'est pas de la localité ANT » / « Un titulaire ne peut pas être son propre intérimaire »).
- **Un seul intérim ACTIF ou A_VENIR par titulaire à une date donnée** : chevauchement → 409.
- Cumul côté intérimaire (déjà intérimaire d'un autre titulaire, ou déjà attributaire de dossiers) :
  **signalé** dans la réponse (`avertissements: string[]`), **pas interdit**.
- `revoquer` : le titulaire, le désignateur, ou l'Admin ; déjà ACHEVE/REVOQUE → 409. La révocation prend
  effet **immédiatement** (à la date donnée, au plus tôt aujourd'hui) : les droits tombent à la requête suivante.
- **Chaîne (Q3)** : le CC intérimaire du Président peut désigner **son propre** intérimaire (CC ou Membre de
  sa localité) pour son rôle de CC. **Non transitif** : cet intérimaire agit pour le CC, **jamais** pour le
  Président — chaque intérim porte son seul titulaire.

### B4 — Effets d'un intérim ACTIF (résolus serveur, le front ne rejoue pas la règle)

1. **Garde centrale étendue** : *titulaire OU délégation OU intérimaire actif du titulaire*, et les
   **contrôles d'identité** aussi — « le dispatcheur » ⇒ « le dispatcheur **ou son intérimaire actif** »
   (visa, retrait, réattribution, reprise, annulation du dispatch, réponse à une demande de retrait) ;
   « le Président » ⇒ idem (pré-dispatch central `9c34077`, part Président, VISA#2, dispatch au CC) ;
   « le CC dispatcheur » ⇒ idem (VISA#1 CC, copie CC). Le **périmètre est celui du titulaire** : le CC
   intérimaire du Président agit sur toutes les localités ; le Membre intérimaire d'un CC agit sur la
   localité de ce CC, avec les **capacités du CC** (`PermissionsService` côté front les lit dans `mes`).

   > ⚠️ **Livraison backend du 2026-09-21** — deux précisions qui engagent le front :
   > - **`DispatchDto.imCtrlDispatch` porte le TITULAIRE** quand le dispatch est posé par un intérimaire (ADR-0008 :
   >   c'est le dispatcheur que l'aval reconnaît — visa, retrait, navette à deux niveaux ; le CC de retour vise le PV
   >   que son intérimaire a dispatché). Qui a cliqué se lit sur `idInterim` (→ `imInterimaire` de l'intérim) et au
   >   journal ; `interimDe` vaut donc `imCtrlDispatch`. `interimDispatch` est **forcé à `false`** sous désignation.
   > - **Non étendus, hors lot** : l'examen et la soumission du PV (actes de l'attributaire), la part Membre, et les
   >   **lettres de renvoi** (non listées ici) — l'intérimaire y est jugé sur son propre profil. Le contexte d'intérim
   >   n'est résolu que pour un `CHEF_COMMISSION` ou un `MEMBRE`, les deux seuls profils admissibles.
2. **Visa par un intérimaire désigné** : `POST /pv-examens/{id}/viser` **sans note PDF** — la désignation
   est la justification ; réponse `viseParInterim = true`, **`idInterim`** et **`interimDe`** (titulaire)
   renseignés, `noteInterim*` à `null`. Le chemin ponctuel (note PDF, P/CC du périmètre non désigné) reste
   tel quel (Q4). Mention sur les documents : règle du 01/09 inchangée (Q5) — la mention « par intérim »
   régionale s'applique aussi au visa d'un intérimaire désigné.
3. **Une personne, un rôle par PV** (invariant « deux personnes distinctes ») : l'intérimaire d'un CC qui est
   **attributaire** (examinateur) d'un dossier **ne peut ni viser ni signer la part CC** de ce PV → **409
   nominatif** (« Vous êtes l'attributaire de ce dossier »). Il peut en revanche se dispatcher un dossier
   par intérim (« moi-même », règle existante) : ce PV sera visé par le CC de retour, ou par le Président.
4. **Signature** : une part **par personne et par PV** (déjà vrai). L'intérimaire signe la part de son
   titulaire ; s'il a déjà signé une autre part de ce PV, la part du titulaire **attend** (voir 5).
5. **Chaîne Q3, cas résiduel** : si le CC intérimaire du Président a signé la part CC **avant** d'être
   désigné, la part Président attend le retour du Président ou un autre intérimaire — pas de contournement.
   Le front le dit en clair sur le PV (« Part Président : attend le Président — vous avez signé la part CC »).
6. **Files** — `GET /dossiers/a-faire` et `GET /dossiers/{id}/gestes` : les tâches du titulaire sont servies
   à l'intérimaire dans **`delegations.taches` avec `mode = INTERIM`** (valeur déjà prévue au contrat du
   14/09) et `interimDe` (matricule + nom du titulaire) ; le **titulaire continue de les voir** dans
   `taches` (rien ne lui est retiré). ⚠️ `mode = INTERIM` servait jusqu'ici le seul visa ponctuel : il porte
   désormais aussi l'intérim désigné, `idInterim` non nul distingue les deux.

   > ⚠️ **Livraison backend du 2026-09-21** — `interimDe` porte le **matricule** du titulaire (pas son nom : le front
   > a l'annuaire, et `AFaireDto.Tache` ne porte que des codes). Seules les lignes **`TITULAIRE`** du titulaire sont
   > servies (celles qu'il tient lui-même par délégation ou suppléance ne sont pas les siennes) ; une ligne que le
   > connecté a déjà en son nom pour le même dossier et la même section n'est pas dédoublée. `GET /{id}/gestes` dit
   > la même chose (parité conservée).
7. **Notifications** (Q6) : toute notification adressée au titulaire est **copiée** à l'intérimaire actif au
   moment de l'émission (`t_notification` : ligne propre à l'intérimaire, `interimDe` renseigné, même
   action cible). Rien n'est rejoué à la désignation d'un intérim pour les notifications antérieures.
8. **Trace** : journal `ActionDossierDto.interimDe` + `idInterim` (« Visé par Y, par intérim de X ») ;
   chronométrage `PassageEtapeDto.interimDe` (acteur = intérimaire) ; `acteursEtapes` sert le nom de
   l'intérimaire (celui qui a agi). Aucune entrée de journal **hors dossier** n'est demandée : la
   ressource `interims` est son propre historique.

   > ⚠️ **Livraison backend du 2026-09-21** — journal : `interimDe` / `idInterim` sur `DISPATCH`, `REATTRIBUTION`,
   > `REPRISE`, `RETRAIT_DISPATCH` (détail suffixé « — par intérim de NOM »), sur le `VISA` dérivé et sur la
   > `SIGNATURE` de la part que ce visa a posée. La **part CC signée séparément** par l'intérimaire d'un CC désigné
   > (`signer`, `role = CC`) n'est tracée qu'au **chronométrage** (`COSIGNATURE`, `interimDe`) : le PV ne porte qu'un
   > intérim, celui du visa. Chronométrage : `profil` du passage = celui du titulaire.
9. **Acte vers un titulaire absent** (Q7) : un dispatch du Président vers un CC absent (« Chef de
   commission ⤴ ») est **accepté** ; la réponse porte `avertissements: ["CC absent jusqu'au D2, suppléé par
   Y"]` et le front avertit avant l'envoi grâce à `ControleurDto.interimEnCours` (B5).

   > ⚠️ **Livraison backend du 2026-09-21** — le dispatch vers un CC absent est accepté, mais **`DispatchDto` ne porte
   > pas d'`avertissements`** : le front dispose d'`interimEnCours` dans l'annuaire pour avertir avant l'envoi, ce que
   > la demande prévoit déjà ; doubler l'information dans la réponse aurait ajouté une requête à chaque dispatch.
10. **Fin** : automatique à `dateFin` (statut dérivé) ou révocation. **Rien à défaire** : les actes de
    l'intérimaire restent les siens, tracés comme tels.

### B5 — DTO existants à compléter

| DTO | Ajout |
|---|---|
| `ControleurDto` (`/api/controleurs`, annuaire) | `interimEnCours` = `{ idInterim, imInterimaire, nomInterimaire, dateFin }` ou `null` (titulaire absent) ; `interimPour` = liste de `{ idInterim, imTitulaire, nomTitulaire, dateFin }` (intérimaire) |
| `PvExamenDto` | `idInterim`, `interimDe` à côté de `viseParInterim` (déjà servi) |
| `ActionDossierDto`, `PassageEtapeDto` | `interimDe`, `idInterim` |
| `AFaireTache` | `interimDe` (avec `mode = INTERIM`), `idInterim` |
| `DispatchDto` | `interimDe`, `idInterim` quand le dispatch est posé par un intérimaire ; `interimDispatch` inchangé (repli) |
| `/api/auth/me` | rien de plus : le front appelle `interims/mes` au même moment que `delegation-profils` |

> ⚠️ **Livraison backend du 2026-09-21** — tous livrés (`AFaireTache` = `AFaireDto.Tache`, `PassageEtapeDto` sur
> `GET /api/dossiers/{id}/chronometrage`, `NotificationDto.interimDe` / `idInterim` sur la copie). Précisions :
> `ControleurDto.interimEnCours` / `interimPour` sont **`null` pour la PRMP et l'UGPM** (règle C2 : qui supplée qui
> est une organisation interne — comme `GET /api/interims`, en 403 pour elles) ; `PvExamenDto.idInterim` /
> `interimDe` sont masqués pour elles aussi, comme `viseParInterim`. `GET /api/auth/me` n'existe pas côté serveur
> (le contexte de session vient du login) ; rien n'a été ajouté, comme demandé.

### B6 — Journal et chronométrage : rangs

Visibilité hiérarchique (`a867fb9`) : une action posée **par intérim** est visible comme si le **titulaire**
l'avait posée (rang du titulaire), et par l'intérimaire lui-même. Le Membre intérimaire d'un CC voit donc ce
qu'il a fait en tant que CC pendant l'intérim, pas le reste du périmètre du CC après.

> ⚠️ **Livraison backend du 2026-09-21** — `a867fb9` est un commit du **front** : le serveur ne filtre le journal par
> aucun rang (sa seule garde est le périmètre du dossier, et 403 pour la PRMP/UGPM). Il sert `interimDe` sur chaque
> ligne posée par intérim ; la règle de rang ci-dessus reste une règle d'affichage du front.

### Options écartées

- *L'Admin désigne pour tous, comme les mandats* : le pilote a tranché pour la **désignation par le
  titulaire** (chacun connaît son absence) ; l'Admin n'est proposé qu'en repli (B3, à confirmer).
- *Redirection des notifications* : la copie garde l'historique du titulaire (Q6).
- *Absence des Membres, Secrétaires, Vérificateurs, Assistants* : hors lot — la réattribution (Membre) et
  la délégation ascendante (les autres) couvrent aujourd'hui ; lot 2 sur demande.
- *Mention « par intérim » à la Centrale* : conservée telle quelle (Q5).

## Tests attendus (recette backend)

1. Président désigne CCTMS01 (autre localité) → 201, statut A_VENIR puis ACTIF à `dateDebut`.
2. CC régional désigne un CC d'une autre localité → 409 nominatif ; désigne un Membre de sa localité → 201.
3. CC de la Centrale désigne un autre CC de la Centrale → 201 ; un Membre régional → 409.
4. Deux intérims qui se chevauchent pour le même titulaire → 409 ; sans chevauchement → 201.
5. Titulaire = intérimaire → 409 ; sans pièce → 400 ; `dateFin` absente hors VACANCE_POSTE → 400.
6. Membre intérimaire d'un CC : dispatch dans la localité **sans** `interimDispatch` → 201, `interimDe` servi,
   journal « Dispatché par Y, par intérim de X », chrono acteur = Y.
7. Ce Membre vise un PV dispatché par le CC → 200 `viseParInterim = true`, `idInterim`, pas de note ;
   il vise un PV dont il est l'attributaire → 409 nominatif.
8. CC intérimaire du Président : pré-dispatch d'un dossier central → 201 ; VISA#2 → 200 ; part Président → 200 ;
   il a déjà signé la part CC de ce PV → la part Président reste attendue (409 nominatif à la tentative).
   > ⚠️ Backend 2026-09-21 : « VISA#2 » et « part Président » sont **un seul geste** depuis le visa unique du 31/08 —
   > le visa pose la part Président (`imCtrlPresident` = l'intérimaire, `dateSignaturePresident`). Les douze cas sont
   > couverts par `InterimIntegrationTest` (matricules du socle de test : `CTRCC2` tient le rôle de « CCTMS01 »).
9. Chaîne : ce CC désigne un Membre de sa localité → ce Membre signe la part CC ; il tente un acte du
   Président → 403 (non transitif).
10. Notification émise au titulaire pendant l'intérim → deux lignes (titulaire, intérimaire avec `interimDe`) ;
    émise hors période → une seule.
11. Révocation → la requête suivante de l'intérimaire sur un acte du titulaire → 403 ; `mes` ne le sert plus.
12. PRMP : `GET /api/interims` et `/piece` → 403 ; `a-faire` de l'intérimaire : tâches du titulaire en
    `delegations.taches` `mode = INTERIM`, `taches` du titulaire inchangées.

## Côté front (pour information, livré après le backend)

**Lot 1 front** : écran « Mon intérim » chez le Président et le CC (`/president/interim`, `/cc/interim`),
calqué sur `/admin/comptes/mandats` — historique, « Désigner un intérimaire » (modale, choix restreint aux
admissibles servis par l'annuaire, pièce PDF par `validerFichier`), « Révoquer » ; bannière « Vous êtes
suppléé par Y jusqu'au D2 » / « Vous suppléez X jusqu'au D2 » ; chez l'intérimaire, les entrées de menu du
titulaire dans une rubrique « Exercé par intérim » (même patron que « Exercé par délégation »),
`PermissionsService` alimenté par `interims/mes` à côté des paires ; badge « ⤳ Intérim de X » sur les
lignes (`LIBELLES_MODES.INTERIM` existe déjà) ; avertissement au dispatch vers un CC absent ; écran Admin
`/admin/comptes/interims` en lecture (+ désignation/révocation si B3 confirmé). **Lot 2** : absences des
autres profils, réattribution assistée, retrait éventuel du repli ponctuel.

> ✅ **Front livré le 2026-09-21** (lot 1, sur backend `e867082`) : écran « Intérim » chez le Président et le CC
> (`/president/interim`, `/cc/interim` — historique, désignation sur pièce PDF, révocation) et « Intérims » chez
> l'Admin (`/admin/comptes/interims`, pied de l'accueil, en repli pour tout titulaire) ; `InterimStore` sur
> `GET /interims/mes` (relu à chaque navigation) ; bannières « Vous êtes suppléé par … » / « Vous suppléez … » ;
> `PermissionsService` étendu (titulaire OU délégation OU intérimaire actif) ; rubrique de menu « Exercé par
> intérim » (entrées du titulaire, moins celles que l'intérimaire a déjà) ; `roleGuard` ouvre l'espace du
> titulaire à son intérimaire actif ; visa / retour / part CC par l'intérimaire désigné dans `PvWorkflow` (sans
> note, sous le rôle du titulaire) ; avertissement au dispatch vers un CC absent (`interimEnCours`) ; « Par intérim
> de NOM » sur les lignes d'« À faire », les notifications copiées et les passages du chronométrage. Recette réelle
> CCANT01 → MEMANT1 (désignation, bannières, menu, accès `/cc`, annuaire, révocation, droits retirés) verte.
