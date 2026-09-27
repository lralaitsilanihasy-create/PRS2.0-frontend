# Demande backend — 2026-09-26 — La rectification d'un dossier DAO après le PV (lot C)

**Origine** : `docs/plan-2026-09-26-lot-c-rectification-dossier-dao.md` (lot C, décidé par le pilote le 26/09 :
« démarre le lot C »). Le lot B (V44) ancre une observation d'examen sur une information de la fiche DAO ; ce lot
ramène ces observations à la PRMP et fait revenir la fiche corrigée devant le Vérificateur ou la Commission.

## Le constat

Un dossier DAO (famille DMC, né de `POST /api/fiches-marche/{idDmc}/dossier`) suit le circuit générique jusqu'au
Vérificateur ou jusqu'à la lettre de renvoi. Ensuite, le circuit suppose un PPM : la rectification est un
ré-import (`PUT /api/saisies/ppm/{id}`), le réexamen compare deux versions de plan (`perimetre-examen`). Pour un
DAO, la correction est une **révision de la fiche** (`POST …/reviser`, version n+1, validation) — que rien ne
relie au dossier soumis : la validation de la version n+1 ne touche pas les pièces du dossier, la resoumission
n'exige rien, le réexamen ne sait pas ce qui a changé.

Principe (plan, §2) : **la rectification d'un dossier DAO est une révision validée de la fiche** — jamais un
nouveau dossier, jamais un ré-import. Le dossier garde sa référence, son circuit et son PV.

## B1 — Réviser une fiche dont le dossier est en circuit

- `POST /api/fiches-marche/{idDmc}/reviser` reste possible quand le dossier soumis est **rendu à la PRMP** :
  `EN_ATTENTE_DECISION_PRMP` (observations maintenues) ou `EN_ATTENTE_PIECES` (lettre de renvoi signée).
- Il est **refusé — 409 `DOSSIER_EN_EXAMEN`** (corps : `idDossier`, `statut`) — tant que la Commission tient la
  version examinée : `SOUMIS`, `RECEPTIONNE`, `DISPATCHE`, `EXAMINE`, `A_REEXAMINER`, `PV_SIGNE`, `EN_VERIFICATION`,
  et les états qui suivent la levée (`OBSERVATIONS_LEVEES`, `DECISION_TRANSMISE_SIGMP`, `CLOTURE`). Une fiche
  sans dossier soumis se révise comme aujourd'hui. *(Q3 du plan : à confirmer par le pilote.)*
- Le dossier mémorise **la version de la fiche qu'il a soumise** : `DossierDto.ficheMarche.versionSoumise`, posée
  à la soumission et à chaque resoumission / transmission de compléments. C'est la version que la Commission a
  examinée, la référence du diff de B5.

> ⚠️ **Livré le 2026-09-27 (backend, V49) — §B1, deux précisions.** Le statut « `RECEPTIONNE` » n'existe pas au modèle :
> c'est `PRET_DISPATCH` qui est verrouillé ; et `EN_ATTENTE_COMPLEMENTS_DEPOT` (compléments demandés au dépôt, dossier
> rendu à la PRMP) **ouvre** la révision comme les deux autres attentes. Le 409 porte `idDossier` et **`details.statut`**
> (nouveau champ `details` du corps d'erreur, à clés nommées). `versionSoumise` est posée par `soumettre` et avancée par
> `resoumettre` / `transmettre-complements` ; le dossier retient aussi, séparément, la **version examinée** (celle du
> PV — dans la boucle FAVR la version soumise avance sans que la Commission réexamine) : c'est elle qui borne le diff
> de B5. Migration : reprise des dossiers DAO déjà soumis (dernière version validée avant leur soumission).

## B2 — La validation de la révision remplace les pièces produites du dossier

- `POST /api/fiches-marche/{idDmc}/valider` sur la version n+1, quand un dossier soumis existe : les documents
  régénérés **remplacent** les pièces produites du dossier (celles déposées par `POST …/dossier`, aujourd'hui 22 :
  DPAO, CCAP, AE par lot, LF, BP et TC par lot, A1-A4, C1/C2 par lot), la version précédente de chaque pièce
  **conservée** (même mécanique que les pièces corrigées d'un PPM : original gardé, nouvelle version en tête).
  Les pièces **déposées à part** par la PRMP (types obligatoires du sous-type DMC : CCAG, CCTP, avis, estimation,
  garantie) ne sont pas touchées. *(Q2 du plan.)*
- `DossierDto.ficheMarche` (résumé) reflète la version n+1 ; `POST …/dossier` continue de répondre 409
  `DOSSIER_EXISTANT`.
- Journal du dossier soumis : action `FICHE_REVISEE` (« Fiche marché version n+1 validée, N information(s)
  modifiée(s), P pièce(s) remplacée(s) »), après `DOSSIER_CREE_DEPUIS_FICHE`.

> ⚠️ **Livré le 2026-09-27 (backend, V49) — §B2, un écart de compte.** Les pièces produites sont les **PDF** joints par
> `POST …/dossier` : DPAO, CCAP, AE par lot, LF, A1-A4, C1/C2 par lot — les classeurs `xlsx` (BP, TC) sont des
> documents de la fiche, jamais des pièces du dossier ; les « 22 » de la demande sont donc les PDF d'une ligne à cinq
> lots. À la validation d'une révision, dossier `EN_ATTENTE_DECISION_PRMP` ou `EN_ATTENTE_PIECES`, ils sont joints en
> version corrigée (`versionCorrigee = true`), les précédents conservés ; en attente de pièces, ils portent en plus
> `apresLettreRenvoi = true` et `idLettre`. Dossier encore brouillon : remplacement, comme avant ; dossier en examen :
> impossible (B1). `FICHE_REVISEE` compte N sur les valeurs **imprimées** qui diffèrent de la version validée précédente
> et P sur les PDF joints ; il suit `FICHE_MARCHE_VALIDEE` dans le journal.

## B3 — Resoumettre et transmettre les compléments exigent la révision validée

- `POST /api/dossiers/{id}/resoumettre` (chemin FAVR) et `POST /api/dossiers/{id}/transmettre-complements`
  (chemin lettre de renvoi), pour un dossier DMC : **409 `FICHE_NON_REVISEE`** tant que la fiche n'a pas une
  version validée **postérieure** à `versionSoumise` (corps : `versionSoumise`, `versionCourante`, `statutFiche`).
  Une révision ouverte et non validée est un refus (`statutFiche: BROUILLON`).
- À l'acceptation : `versionSoumise` avance, le circuit repart comme pour un PPM (Vérificateur, ou
  `A_REEXAMINER`). La garde des compléments « au moins une pièce rattachée à la dernière lettre » est remplacée,
  pour un DMC, par la révision validée (les pièces remplacées de B2 y sont rattachées).

> ⚠️ **Livré le 2026-09-27 (backend, V49) — §B3 tel que demandé.** 409 `FICHE_NON_REVISEE` avec `idDossier` et
> `details { versionSoumise, versionCourante, statutFiche }` (valeurs nulles possibles : fiche jamais enregistrée). À
> l'acceptation, `versionSoumise` prend la version validée ; `transmettre-complements` retient en outre l'ancienne
> version soumise comme version examinée (B5). Un dossier DAO soumis avant V49 sans version connue (reprise
> impossible) est traité comme « version soumise = 0 » : toute version validée passe.

## B4 — L'observation du PV dit la valeur actuelle

- `ObservationPvDto` (lecture, `GET /api/observations-pv?dossier=`) gagne, pour une observation ancrée
  (`champFiche` non nul) : `valeurChampFicheActuelle` (la valeur de l'information dans la **version validée
  courante** de la fiche, formatée comme `valeurChampFiche`), `versionFicheObservee` (la version figée à la pose)
  et `versionFicheActuelle`. Identiques tant que la fiche n'a pas été revalidée ; `valeurChampFicheActuelle` nulle
  si l'information n'existe plus dans la version courante (champ fermé par le cadrage).
- Rien ne change à l'écriture ni au périmètre figé : c'est une lecture.

> ⚠️ **Livré le 2026-09-27 (backend, V49) — §B4 tel que demandé, une limite.** La version dont la valeur a été figée est
> désormais **stockée** avec l'observation (ligne d'examen, puis copie au PV) ; les observations posées **avant V49**
> n'en ont pas : `versionFicheObservee` y est nulle (`versionFicheActuelle` et `valeurChampFicheActuelle` sont servis
> quand même). `ObservationControleDto.versionFiche` (lecture seule) porte la même version sur les lignes d'examen.

## B5 — Le périmètre de réexamen d'un dossier DAO

- `GET /api/dossiers/{id}/perimetre-examen` (`PerimetreExamenDto`) gagne, pour un dossier DMC en
  `A_REEXAMINER` : `ficheDao: { versionExaminee, versionCourante, informations: [{ champFiche, lot, libelle,
  avant, apres }] }` — les informations dont la valeur diffère entre la version examinée (`versionSoumise` au
  moment du PV) et la version courante, valeurs formatées comme dans les documents ; `ficheDaoAExaminer` vrai s'il
  y en a au moins une. `miseAJour`, `lignes`, `ficheAExaminer`, `agpmAExaminer` gardent leur sens (vides ou faux
  pour un DMC). Hors réexamen, `ficheDao` est nul.
- Les points de contrôle du sous-type restent tous à réévaluer (Q4 du plan) ; le front met en évidence les
  informations de `ficheDao.informations`.

> ⚠️ **Livré le 2026-09-27 (backend, V49) — §B5 tel que demandé.** `versionExaminee` est la version examinée retenue par
> le dossier (celle du PV, pas la dernière soumise) ; `informations` compare les valeurs **imprimées** (`avant` nul :
> information ouverte par la révision, `apres` nul : fermée par le cadrage), clés triées ; libellé du référentiel, lot
> lu sur la clé. Hors `A_REEXAMINER` ou pour un plan : `ficheDao` nul, `ficheDaoAExaminer` faux.

## B6 — La lettre de renvoi nomme l'information

- Le PDF de la lettre de renvoi imprime, pour chaque observation ancrée, « Information de la fiche DAO : *libellé*
  — lot *n* » sous la ligne « au lieu de / lire », comme le PV.

> ⚠️ **Livré le 2026-09-27 (backend) — §B6, avec un écart de forme.** Le corps de la lettre est un **texte libre**
> (`corpsLettre`, saisi dans `pv-workflow.ts`) : le serveur n'y trouve pas de ligne « au lieu de / lire » sous laquelle
> s'insérer. Le PDF imprime donc, **après le corps**, un bloc « Informations de la fiche du dossier d'appel d'offres
> visées par les observations » qui donne, pour chaque ligne d'observation ancrée de l'examen, « Au lieu de « … »,
> lire « … » » puis « Information de la fiche DAO : *libellé* — lot *n* ». Sans observation ancrée, rien ne change. Au
> passage, les sauts de ligne du corps sont désormais rendus dans le Word (ils étaient perdus).

## Ce que le front fera

- C1 « Rectifier un dossier DAO » (trois étapes : observations avec « Corriger dans la fiche », état de la
  révision, pièces déposées à part), aiguillé depuis « Dossiers à rectifier » sur `idDmc` ; « Décrire et
  resoumettre » sur `POST /resoumettre`.
- C2 la fiche ouverte à l'information visée (`?champ=`, `?reviser`), les observations du PV en marge des cellules.
- C3 la carte partagée : « observée → actuelle » (B4).
- C4 le réexamen : informations changées mises en évidence dans le document de l'examen (B5) ; « Transmettre les
  compléments » d'un DAO sur la révision validée (B3).
- C5 la consultation de la lettre de renvoi (B6).
- Rien n'est codé contre un contrat non servi : C2 et l'aiguillage de C1 partent sans attendre, le reste suit.

> ✅ **Fait côté front le 2026-09-26 (C1 et C2 complets, sur les endpoints existants).** `prmp/rectifier-dossier-dao`
> (trois étapes, « Décrire et resoumettre » sur `POST /resoumettre`), aiguillage depuis « Dossiers à rectifier » et
> « Suivi des délais » sur `idDmc` ; la fiche s'ouvre sur l'information visée (`?champ=`, `?reviser`) avec les
> observations du PV en marge. Recette réelle sur le dossier 100353 : révision v2, resoumission acceptée, dossier
> `EN_VERIFICATION`. **Deux repli en attendant B1 et B3** : la version examinée est reconnue par les documents que le
> dossier porte (`idDocumentFiche` ∈ documents de la version n — le résumé `ficheMarche.version` suit déjà la dernière
> version validée, il ne peut pas servir) ; la resoumission n'est fermée que par l'écran. **C3 attend B4**
> (`valeurChampFicheActuelle` : non servi à ce jour), **C4 attend B5**, **C5 attend B6**.

> ✅ **Fait côté front le 2026-09-27, sur V49.** Modèles B1/B4/B5 ; **C3** : la carte partagée dit « → actuelle « … »
> (version n) » quand la valeur d'aujourd'hui diffère de la valeur observée (vérifié sur le dossier 100353 : « 2 000 000
> Ariary (deux millions ariary) », version 2) ; **C4** : le document de l'examen marque les informations de
> `perimetre.ficheDao.informations` (« modifiée — avant : … ») ; la consultation de la lettre, pour un dossier DAO en
> attente de pièces, dit que le complément est la fiche révisée (« Réviser la fiche → ») et traduit le 409
> `FICHE_NON_REVISEE`. **Repli B1 levé** : `versionSoumise` servie est prise d'abord (0 = inconnue → reconnaissance par
> les documents, conservée pour les dossiers d'avant V49). **C5** : rien de plus à l'écran — la PRMP ne lit pas les
> lignes d'examen (`examen-details` lui répond vide) et les observations du PV n'existent que pour un avis FAVR ; le PDF
> de B6 porte l'information. Non joué en réel : le chemin lettre de renvoi → réexamen (C4) — il attend un second dossier
> avec avis défavorable.

## Questions posées au pilote (plan, §5)
> ✅ **Tranchées le 26/09** : Q2 remplacement automatique des pièces produites (B2 telle quelle) ; Q3 fiche
> verrouillée pendant l'examen (B1 telle quelle) ; Q4 tous les points réévalués, changements mis en évidence (B5
> telle quelle). Le contrat ci-dessus est donc **ferme** ; l'ordre de livraison souhaité : B1, B2, B3 et B4 d'abord
> (chemin FAVR), B5 et B6 ensuite.

## Ce que le backend rend

Les six points, `docs/api-endpoints.md` et `docs/regles-gestion.md` à jour, un ADR si la règle B1/B3 le mérite
(la révision liée au circuit), et un mot ici si la livraison s'écarte de la demande (encadré ⚠️ daté, à l'endroit
corrigé).
