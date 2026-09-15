# Plan — Refonte ergonomique, lot 4 : la page dossier guidée

**Date** : 2026-09-15 · **Rédacteur** : dev-lead · **Branches** : `chantier/refonte-ergonomique` des deux dépôts
(identiques à `main` : back `827abbd`, front `fd90d25`) · **Origine** : page dossier de la direction C retenue par
Mathieu le 14/09 (`maquettes-design/src/GuideDossier.tpl.html`), accueil de la direction A livré au lot 3.

> **Statut : proposition, non commitée.** Les six décisions du §9 ont été tranchées par Mathieu le 15/09/2026
> (recommandations adoptées). Les lots se commitent en local, un commit atomique par geste, sur la branche du
> chantier ; rien ne se pousse sans son accord.

---

## 0. En bref

Une **route par dossier** dans l'espace de chaque profil (`/<espace>/dossier/:idDossier`) remplace, écran par
écran, la modale `DossierConsultation`. La page reprend la maquette C : identité, frise des sept étapes, **étape en
cours ouverte avec ses gestes**, puis les documents officiels dans la visionneuse du lot 1. Les gestes viennent du
serveur, par un seul endpoint nouveau qui réutilise le calcul de « À faire » : `GET /api/dossiers/{id}/gestes`.

| Ordre | Lot | Agent | Dépend de | Taille |
|---|---|---|---|---|
| 1 | **L4-D1** Demande backend « gestes d'un dossier » | docs | — | S |
| 2 | **L4-B1** `GET /api/dossiers/{id}/gestes` | backend-spring | D1 (le contrat du §6 suffit pour démarrer) | M |
| 2 | **L4-F1** Découpage de `DossierConsultation` en blocs partagés (aucun changement visible) | frontend-angular | commit du correctif de défilement | M |
| 3 | **L4-Q1** Contrat, permissions et C2 de B1 | qa-test | B1 | S |
| 3 | **L4-F2** Route et page en lecture seule | frontend-angular | F1 | M |
| 4 | **L4-F3** Étape en cours et gestes (liens et modales existants) | frontend-angular | F2 ; B1 (ou doublure du contrat) | M |
| 5 | **L4-F4** Navette du PV dans la page | frontend-angular | F3 | M |
| 5 | **L4-F5** Décision de retrait dans la page | frontend-angular | F3 | S |
| 6 | **L4-Q2** Recette de bout en bout, captures 1366×768 | qa-test | F4, F5 | M |
| 7 | **L4-F6** Brancher les points d'entrée, un écran par commit | frontend-angular | F3 (idéalement Q2) | M |
| 8 | **L4-F7** Nettoyage : fin du mode embarqué | frontend-angular | F6 | S |
| 8 | **L4-D2** `api-endpoints.md`, `regles-gestion.md`, clôture de la demande | docs | B1 | S |
| 9 | **L4-Q3** Non-régression des écrans rebranchés | qa-test | F6, F7 | S |
| opt. | **L4-B2** Contenu d'un dossier filtré par dossier | backend-spring puis frontend-angular | mesure de Q2 | M |

En parallèle dès le premier jour : **D1, B1 et F1**. F3 peut démarrer sur une doublure du contrat si B1 n'est pas
fusionné.

---

## 1. Existant

- **Aucune route vers un dossier.** On consulte par `features/circuit/dossier-consultation.ts` (1 165 lignes), modale
  en lecture seule avec un mode `embedded`. Elle est montée par **15 fichiers**, pas 10 : les 10 cités dans la demande
  plus `prmp/suivi-delais.ts`, `transverse/notifications-page.ts`, `verificateur/en-attente-prmp.ts`,
  `verificateur/verifier-dossier.ts` (mode embarqué) et `layout/main-layout` (clic sur une notification de la cloche).
- **Chargement de la consultation** : une vague `forkJoin` qui lit les listes **scopées** `GET /api/ppms`,
  `/api/marches`, `/api/service-beneficiaires` et `/api/marche-previsions`, puis filtre par dossier dans le navigateur.
  Pour le Président, cela représente le contenu de tout le pays. Aucun de ces endpoints n'accepte `?dossier=`.
- **« À faire »** (`features/home/a-faire.ts`, `a-faire/a-faire-navigation.ts`) : NUMEROTER, DISPATCHER, REATTRIBUER,
  COMPLETER_PIECES_DEPOT et la consultation s'ouvrent en modale ; DECIDER_RETRAIT n'ouvre que la liste des retraits.
- **Écrans de travail déjà routés** (à conserver) : `examiner/:idDossier` (Membre, Président, CC ; concentration,
  `sortieProtegeeGuard`), `verifier/:idDossier` (Vérificateur, Président, CC ; concentration), `prmp/rectifier/:idDossier`
  (`returnUrl` déjà géré), `soumettre-dossier?reprendre=`, `pv-examens/:idPv`, `lettre-renvois/:idLettre`.
- **Composants intégrables tels quels** : `shared/circuit/pv-workflow.ts` (entrées `pv`, `idLocalite`,
  `nbObservationsExamen`, sortie `changed`), `shared/circuit/chronometrage-dossier.ts`, `shared/ui/document-visionneuse.ts`,
  `features/circuit/reception-form.ts`, `dispatch-form.ts`, `prmp/completer-pieces-depot-modal.ts`, `detail-pv-modal.ts`.
- **Données déjà servies** : `GET /api/dossiers/{id}` porte `datesEtapes`, `acteursEtapes` (nul pour PRMP et UGPM),
  `datePrevisionnelleFin` et `attentePrmp`. Le chronométrage porte les passages, mais **ni reste, ni échéance, ni
  urgence**. Les gestes du connecté n'existent que dans la liste « À faire ».
- **Carte des espaces** : `ESPACES_A_FAIRE` (`core/navigation/navigation.ts`) associe déjà les huit profils du circuit
  à leur espace.

---

## 2. Routage — recommandation : une route par espace, plus un alias partageable

**Route canonique** : `/<espace>/dossier/:idDossier`, montée en `loadComponent` dans les sept `*.routes.ts` des espaces
du circuit (`prmp`, `secretaire`, `membre`, `president`, `cc`, `verificateur`, `assistant` ; l'UGPM passe par `prmp`),
avec `data: { title: 'Dossier', concentration: true }`.

**Alias** : `/dossier/:idDossier` dans `app.routes.ts`, sous `MainLayout` et `authGuard`. Une garde le redirige vers
`/<ESPACES_A_FAIRE[rôle]>/dossier/:id`, en conservant les paramètres de requête. L'Administrateur et le Chargé de
publication vont vers `/acces-refuse` : ils n'ont pas la page en v1.

Pourquoi pas une route unique `/dossier/:id` ? Tout le front est rangé par espace : l'accueil « À faire », l'examen et
la vérification sont montés dans chaque espace, et la délégation ascendante monte les écrans des subordonnés dans
l'espace du Président et du CC. `cibleGeste(geste, t, espace)` construit ses URL dans l'espace. Une route hors espace
obligerait chaque geste à retrouver son espace et laisserait la page sans `roleGuard`. Au singulier, `dossier` évite
toute collision avec les enfants de `prmp/dossiers/:type/:groupe` et suit `examiner/`, `verifier/` et `rectifier/`.

| Effet sur | Ce qui se passe |
|---|---|
| **Menus** | Aucune entrée nouvelle. `navigation.ts` n'est pas touché : 31 commits du patron depuis le 28/08. On arrive sur la page depuis « À faire », les listes, les notifications ou la recherche. |
| **Mode concentration** | Oui. Le menu passe en tiroir, comme pour l'examen. Sans cela, à 125 % (1229 px de large), il reste environ 980 px pour les 13 colonnes du plan (décision 4). |
| **Retour arrière** | La page est une vraie route : le bouton « précédent » du navigateur fonctionne. Le fil d'Ariane lit `?returnUrl=`, la convention de `rectifier`. Seul un chemin interne commençant par `/` et pas par `//` est accepté ; à défaut, retour à `/<espace>/a-faire`. Les écrans de travail ouverts depuis la page reçoivent `returnUrl` vers la page ; ceux qui l'ignorent aujourd'hui ne changent pas dans ce lot. |
| **Liens depuis « À faire »** | VOIR, SUIVRE et « Consulter le dossier » deviennent des liens vers la page. Pour le bouton d'action, voir la décision 2 : la page s'ouvre avec `?geste=<GESTE>`, et l'action correspondante se déclenche à l'arrivée **seulement si le serveur la sert**. Le dispatch groupé reste en modale sur l'accueil. |
| **Notifications, recherche** | Le repli « consultation » de la cloche et de `/notifications` mène à la page ; les types déjà routés vers un écran d'action ne changent pas. Voir la décision 5 pour la barre de recherche. |
| **Partage de lien** | `/dossier/1052` fonctionne pour tout profil du circuit ; le serveur tranche le périmètre (403 : état « hors de votre périmètre »). |

---

## 3. Contenu de la page

### 3.1 Gabarit à 1366×768, mode concentration

```
┌ barre du haut (48 px) : ☰ menu · recherche · cloche ─────────────────────────────────────────┐
│ ← À faire › 00002/MTP/PPM-AGPM/2026                              [Journal] [Délais]  (CNM)    │ fil + outils
│ 00002/MTP/PPM-AGPM/2026 (h1)                                         Fin de traitement prévue │ identité
│ Ministère des Travaux publics · Plan de passation 2026                      jeu. 24/09        │
│ [Examiné] [PPM-AGPM] [Antananarivo] [12 lignes · 3 482 442 000 Ar]                            │
│ ●────────●────────●────────◉────────○────────○────────○   frise : date, acteur au survol       │
│ ┌ Étape 4 sur 7 · à vous ──────────────────────────────┬ Ce que dit le projet de PV ─────────┐ │
│ │ Viser le projet de PV     [Reste 5 h · avant 15/09 12:00]│ avis, observations, dernier retour│ │ étape en cours
│ │ phrase guide                                          │ [Voir le projet de PV]            │ │
│ │ [Viser…] [Retourner au Chef de commission] [Lettre…]   │                                   │ │
│ └───────────────────────────────────────────────────────┴───────────────────────────────────┘ │
│ [Fiche] [Plan 12] [AGPM] [Pièces 8] [Versions]                               [Annotations]    │ documents
│ ┌ feuille officielle, pleine largeur, fluide ───────────────────────────────────────────────┐ │
```

Quand le panneau sort de l'écran, une **barre collante compacte** reste en haut : référence, étape, délai et bouton du
geste principal. On garde ainsi le panneau fixe de la direction A sans prendre de largeur au plan (décision 3).

### 3.2 Blocs, sources et visibilité

| Bloc | Source | Contrôleurs CNM | PRMP et UGPM |
|---|---|---|---|
| Identité (référence, entité, type, localité, lignes, montant) | `GET /api/dossiers/{id}`, bloc `DossierIdentite` | oui | oui, plus la référence PPM (règle existante `montrerReferencePpm` : PRMP, UGPM, Secrétaire) |
| Frise des 7 étapes | `DossierDto.datesEtapes`, `acteursEtapes` | date et acteur au survol | **date seule** (`acteursEtapes` nul côté serveur) |
| Fin de traitement prévue | `DossierDto.datePrevisionnelleFin` | oui | oui |
| Délai de l'étape (reste, échéance, urgence) | `gestes.etapeCourante` | oui | **non** : restitution interne (règle pilote du 06/09) ; seule la pause « chez vous depuis le … » s'affiche |
| Qui porte l'étape | `acteursEtapes` et `taches[].mode` | « à vous », « à vous par délégation », « chez N. Razafindrakoto, Membre » | « à vous » ou « à la Commission nationale des marchés », libellé déjà retenu en `c197146` |
| Gestes | `gestes.taches` | titulaire et non titulaire (mode affiché) | SOUMETTRE, COMPLETER_BROUILLON (UGPM), COMPLETER_PIECES_DEPOT, TRANSMETTRE_COMPLEMENTS, RECTIFIER |
| Projet de PV et navette | `PvExamen` (`refs.idPv`), `faits` | Président, CC, Membre concernés | **jamais** (aucun appel) |
| Documents officiels | `DossierContenuStore`, bloc `DossierDocuments` | oui | oui |
| Pièces jointes | bloc `DossierPieces` | oui | oui |
| Historique des versions | bloc `DossierVersions` | **Vérificateur seul** (règle pilote du 12/09) | non |
| Journal | `GET /{id}/journal`, bloc `DossierJournal` en sous-dialogue | bouton | **jamais** : 403 côté serveur, aucun appel |
| Chronométrage détaillé | `ChronometrageDossier` en sous-dialogue | bouton | **jamais** (règle du 06/09, aucun appel) |

### 3.3 Gestes : ce que fait le panneau

Le panneau n'affiche **que** ce que sert `GET /api/dossiers/{id}/gestes`. Il ne déduit rien du statut. Un geste
absent de la réponse n'est jamais proposé, même demandé par `?geste=`.

| Geste(s) | Sur la page | Composant réutilisé | Lot |
|---|---|---|---|
| NUMEROTER | modale par-dessus la page | `ReceptionForm` | F3 |
| DISPATCHER, REATTRIBUER | modale | `DispatchForm` (dossier, réception et dispatch chargés comme dans « À faire ») | F3 |
| COMPLETER_PIECES_DEPOT | modale | `CompleterPiecesDepotModal` | F3 |
| EXAMINER, REEXAMINER, REPRENDRE_EXAMEN | lien `/<espace>/examiner/:id` | `ExamenDossier` | F3 |
| VERIFIER, TRANSMETTRE_DECISION, TRANSMETTRE_SIGMP | lien `/<espace>/verifier/:id` | `VerifierDossier` | F3 |
| RECTIFIER | lien `/prmp/rectifier/:id?returnUrl=<page>` | `RectifierDossier` | F3 |
| SOUMETTRE, COMPLETER_BROUILLON | lien `/prmp/soumettre-dossier?reprendre=:id` | `SoumettreDossier` | F3 |
| TRANSMETTRE_COMPLEMENTS, SIGNER_LETTRE, ARCHIVER_LETTRE | lien vers la lettre (`refs.idLettre`), à défaut vers la liste des lettres (même repli que `cibleGeste`) | écrans de lettres existants | F3 |
| ARCHIVER_PV | lien `/<espace>/pv-examens/:idPv` | `PvAssistant` | F3 |
| SOUMETTRE_PV, ACCEPTER, VISER, RETOURNER, SIGNER | **dans le panneau**, avec un volet « Ce que dit le projet de PV » | `PvWorkflow`, `DetailPvModal` | F4 |
| DECIDER_RETRAIT | **dans le panneau** : Accepter, ou Refuser avec motif obligatoire | nouveau `DecisionRetrait` sur les appels existants de `DemandeRetraitService` | F5 |
| VOIR, SUIVRE | aucun bouton, une phrase d'état (« en attente de la PRMP depuis… », « en cours à la Commission ») | — | F3 |

Après un geste réussi, la page recharge le dossier et ses gestes puis appelle `DossiersRefreshStore.notifierChangement()`
pour les pastilles. La modale se ferme, on reste sur la page.

### 3.4 Écarts assumés par rapport à la maquette C (v1)

- Pas d'« Aperçu PDF du projet » ni de « PDF d'origine » : ces fonctions n'existent pas (écart déjà noté au lot 2).
- Pas de durée par étape sous la frise, ni de « 54 h consommées sur 112 h » : ces chiffres restent dans le
  sous-dialogue « Délais ». Les recalculer côté front dupliquerait le chronométrage.
- Pas de liste des observations dans le panneau PRMP : le geste RECTIFIER mène à l'écran de rectification, qui les porte.
- Les cellules observées ne sont pas encadrées dans le plan de la page (piste pour après le L4 : `ChampCible` du lot 2).

---

## 4. Frontière page / modale

**Règle.** Devient page ce qui se **consulte** ou se **partage par un lien**. Reste modale ce qui se valide en moins
d'une minute sans quitter son contexte, et tout geste qui porte sur **plusieurs dossiers**.

| Devient page ou y est intégré | Reste un écran routé | Reste une modale |
|---|---|---|
| Consultation d'un dossier depuis toutes les listes, la cloche, `/notifications`, « À faire » | Examen, vérification, rectification, saisie et soumission, mise à jour du PPM, archivage d'un PV, lettres de renvoi | Réception et numérotation, dispatch et réattribution, pièces du dépôt |
| Navette du PV (`PvWorkflow` dans le panneau) | | **Dispatch groupé** (« À faire », « Tous les dossiers ») |
| Décision de retrait (formulaire court dans le panneau) | | Détail du projet de PV, détail PPM, sous-dialogues Journal et Délais |
| | | **Consultation pendant une tâche** : `mise-a-jour-ppm.ts` (dossier d'origine pendant la saisie) et `pv-page.ts` jusqu'à la fin de Q2 |
| | | Confirmations (retour de navette, refus de retrait) |

---

## 5. Sort de `DossierConsultation`

**Principe : on déplace, on ne copie pas.** Une copie divergerait dès la prochaine demande pilote traitée par le patron
dans la modale (30 commits sur ce fichier depuis le 28/08). Une fois découpée, une demande pilote s'applique à la
modale et à la page en même temps.

**L4-F1** extrait, sans rien changer à l'écran, dans `features/circuit/dossier/` :

| Nouveau fichier | Contenu déplacé depuis la consultation |
|---|---|
| `dossier-contenu.store.ts` | `@Injectable()` fourni par le composant hôte : la vague unique (`ngOnInit` actuel), les diffs de versions et de rectification, `ficheDoc`, `agpmDoc`, versions archivées et leur cache. Même règle C2 : ni journal ni chronométrage **demandés** pour la PRMP et l'UGPM. |
| `dossier-documents.ts` | Barre d'onglets fiche, plan, AGPM, pièces et historique ; visionneuse ; interrupteur d'annotations partagé. |
| `dossier-pieces.ts` | Les trois groupes (initiales, corrigées, après lettre de renvoi) et `ouvrirPiece` (`ouvrirBlobSur`). |
| `dossier-versions.ts` | Sélecteur et vue d'une version archivée, sous-onglets. |
| `dossier-journal.ts` et `journal-libelles.ts` | Table du journal ; `actionLabel` en fonction pure, testée. |
| `dossier-identite.ts` | Bloc repliable : entité, localité, référence PRMP, exercice, signataire, mise à jour. |

`dossier-consultation.ts` devient une **coquille modale d'environ 250 lignes** (voile, en-tête, sous-dialogues, pied) :
même sélecteur, mêmes entrées `dossier` et `embedded`, même sortie `closed`. Les 15 appelants ne changent pas. Les
commentaires « Demande pilote » suivent le code déplacé : c'est la traçabilité du patron.

**Pendant la transition**, la modale (coquille) et la page (qui assemble les mêmes blocs) cohabitent. F6 retire la
modale écran par écran. **Au terme de F7**, la modale ne reste que là où l'utilisateur ne doit pas quitter sa tâche
(`mise-a-jour-ppm`, éventuellement `pv-page`) ; `verifier-dossier` monte directement `DossierDocuments` et le mode
`embedded` disparaît.

---

## 6. Backend : contrat de `GET /api/dossiers/{id}/gestes`

**L'API actuelle ne suffit pas.** Le dossier, la frise, le journal et le chronométrage sont servis. En revanche, **ce
que le connecté peut faire sur ce dossier-là** n'existe que noyé dans `GET /api/dossiers/a-faire`, et le reste ou
l'échéance de l'étape n'est servi nulle part hors de cette liste.

**Options écartées.**
- *`a-faire?idDossier=`* : les compteurs et les sections n'ont pas de sens pour un seul dossier, `delegations` se
  sert à part, et rien ne revient quand le connecté n'a aucun geste. Or la page doit quand même afficher le délai de
  l'étape.
- *Endpoint agrégé « dossier + contenu + gestes »* : il recopierait le masquage C2 déjà appliqué à `DossierDto`,
  au journal et au chronométrage. Deux appels en parallèle côté front coûtent moins cher qu'une seconde source de
  vérité.

**Retenu** : une sous-ressource qui rejoue le calcul d'« À faire » sur un seul dossier.

| | |
|---|---|
| Méthode et URL | `GET /api/dossiers/{id}/gestes` |
| Accès | `hasAnyRole('PRESIDENT','CHEF_COMMISSION','SECRETAIRE','MEMBRE','VERIFICATEUR','ASSISTANT_CONTROLEUR','PRMP','UGPM')`, comme `a-faire` ; puis la **garde de visibilité du dossier** (`service.findById(id)`, comme `/chronometrage`) |
| Réponse | `200 GestesDossierDto` ; `401` anonyme ; `403` profil hors liste ou dossier hors périmètre ; `404` dossier inexistant |
| Corps | aucun ; lecture seule, à la volée, **sans migration** |

```json
{
  "idDossier": 1052,
  "profil": "PRESIDENT",
  "genereLe": "2026-09-14T15:00:00",
  "etapeCourante": {
    "urgence": "BIENTOT",
    "delai": { "etape": "VISA", "entree": "2026-09-11T12:00:00", "standardHeures": 16, "ecouleHeures": 11,
               "restantHeures": 5, "echeance": "2026-09-15T12:00:00", "pauseDepuis": null, "pauseHeures": null,
               "datePrevisionnelleFin": "2026-09-24" }
  },
  "taches": [
    { "section": "PV_A_VISER", "geste": "VISER", "gestesSecondaires": ["RETOURNER"], "mode": "TITULAIRE",
      "urgence": "BIENTOT", "rang": 1,
      "dossier": { "…": "AFaireDto.Dossier, à l'identique" },
      "delai":   { "…": "AFaireDto.Delai, à l'identique" },
      "faits":   { "…": "AFaireDto.Faits, à l'identique" },
      "refs": { "idReception": 398, "idDispatch": 311, "idExamen": 205, "idPv": 144, "idLettre": null, "idDemandeRetrait": null } }
  ]
}
```

**Règles.**
1. **`taches` a la forme exacte de `AFaireDto.Tache`**, avec **toutes** les lignes du connecté sur ce dossier,
   titulaire **et** non titulaire (`mode` le dit). Il n'y a pas de paramètre `delegations`. Tri : les lignes
   `TITULAIRE` d'abord, puis les autres, chaque groupe dans l'ordre d'« À faire » ; `rang` part de 1 sur toute la
   liste.
2. **Invariant de parité**, testé : l'ensemble (`section`, `geste`, `gestesSecondaires`, `mode`, `urgence`, `delai`,
   `faits`, `refs`) est égal aux lignes de `GET /a-faire?delegations=true` (`taches` ∪ `delegations.taches`) dont
   `dossier.idDossier == id`. Aucune règle n'est réécrite : `ReglesAFaire.lignes(acteur, etat)` sur un lot d'un seul
   identifiant.
3. **`etapeCourante`** vaut `null` sur un statut hors `STATUTS_ACTIFS` du côté de l'appelant (CLOTURE, RETIRE,
   REMPLACE, PV_SIGNE ; BROUILLON pour un contrôleur). Sinon, `delai` = `ChronometrageService.delaiCourant`, et
   `urgence` suit les mêmes seuils que les lignes chronométrées : `EN_PAUSE` sur un statut suspensif, `HORS_DELAI`
   pour un brouillon, `SANS_DELAI` si l'entrée est inconnue, **jamais** `SUIVI`. `etapeCourante` est servi même quand
   `taches` est vide : un Membre qui consulte le dossier d'un collègue voit le délai.
4. **Règle C2** : pour la PRMP et l'UGPM, mêmes champs à `null` que dans « À faire » (`dossier.acteursEtapes`,
   `niveauNavette`, `faits.consigneDispatch`, `dernierRetourNavette`, `partsAttendues`, `refs.idDispatch`) ;
   l'annuaire des contrôleurs n'est pas chargé.
5. **Performance** : au plus 15 ordres SQL, garde de visibilité comprise, vérifiés au compteur Hibernate.

**Côté front** : `DossierService.gestes(idDossier)` avec `skipErrorToast()`, interfaces `GestesDossier` et
`EtapeCouranteDossier` dans `models/a-faire.model.ts` (fichier du chantier, pas `circuit.model.ts` : 19 commits du
patron). Si l'endpoint n'est pas servi (404 ou 405 alors que le dossier a répondu 200), la page reste en lecture seule
avec une mention discrète, sans toast.

---

## 7. Lots

Conventions communes : `git fetch` avant chaque lot, puis vérifier les fichiers chauds (§8.1). Un commit par geste
lisible seul, au format du dépôt : front `feat(dossier): …`, `refactor(consultation): …` ; back « Page dossier : … »
sans accents. Commits locaux sur `chantier/refonte-ergonomique`, **aucun push**. Suites : front ≥ 289 tests et
`npm run lint`, back ≥ 1004 tests en local et `-DexcludedGroups=word` comme la CI.

### L4-D1 — Demande backend (docs)
- **Fichier** : `frontend/docs/demande-backend-2026-09-15-gestes-dossier.md`, au format des `demande-backend-*` :
  constat, demande (§6 ci-dessus), tests attendus, côté front.
- **Acceptation** : contrat identique au §6 ; tests 1 à 6 de L4-B1 repris ; renvoi vers ce plan.

### L4-B1 — `GET /api/dossiers/{id}/gestes` (backend-spring)
- **Fichiers** : `controller/DossierController.java` ; `service/AFaireService.java` (méthode publique
  `gestesDossier(Integer id)` réutilisant `charger`, `etat` et `taches` sur `List.of(id)`) ; `repository/DossierRepository.java`
  (variante `SELECT_A_FAIRE … where d.idDossier = :id and d.statut in :statuts`, la visibilité étant tranchée par la
  garde) ; `dto/GestesDossierDto.java` ; tests `GestesDossierIntegrationTest.java` et compléments de `ReglesAFaireTest.java`.
- **Tests attendus** :
  1. Parité avec `a-faire?delegations=true`, pour chaque profil du jeu de test et chaque dossier de son périmètre.
  2. 404 dossier inexistant ; 403 hors périmètre (CC d'une autre localité, PRMP d'une autre tutelle) ; 403
     Administrateur et Chargé de publication ; 401 anonyme.
  3. Statuts terminaux : `taches = []` et `etapeCourante = null`. EN_ATTENTE_DECISION_PRMP : `EN_PAUSE` avec
     `pauseDepuis` pour la PRMP.
  4. Un Membre non attributaire : `taches = []`, `etapeCourante` servi.
  5. C2 : le corps brut renvoyé à la PRMP et à l'UGPM ne contient aucun nom ni matricule de contrôleur.
  6. Compteur SQL ≤ 15, constant.
- **Acceptation** : tests verts en local et en mode CI ; aucune migration Flyway ; aucun message d'erreur de garde
  modifié.

### L4-F1 — Découpage de la consultation (frontend-angular)
- **Préalable** : le correctif de défilement (§10) est commité ; `git fetch` ; aucun commit du patron sur
  `dossier-consultation.ts` après `fd90d25`.
- **Fichiers** : `features/circuit/dossier-consultation.ts` ; nouveaux `features/circuit/dossier/*` (§5) avec leurs specs.
- **Acceptation** :
  - `git diff --stat` ne touche que la consultation, `features/circuit/dossier/` et les specs ; `dossier-consultation.ts`
    fait moins de 300 lignes.
  - Nombre de commentaires « Demande pilote » identique avant et après sur l'ensemble des fichiers (grep).
  - Spec du store : pour PRMP et UGPM, aucune requête vers `/journal` ni `/chronometrage` ; onglet historique visible
    pour le seul Vérificateur ; référence PPM visible pour PRMP, UGPM et Secrétaire.
  - Captures avant et après de la modale (plan, fiche, AGPM, pièces ; historique pour le Vérificateur) identiques à
    1366×768, pour le Président, le Vérificateur et la PRMP ; même liste de requêtes réseau.

### L4-F2 — Route et page en lecture seule (frontend-angular)
- **Fichiers** :
  - Nouveaux : `features/circuit/page-dossier/page-dossier.ts` et `.scss` ;
    `core/navigation/dossier-alias.guard.ts` et sa spec ; `shared/circuit/frise-delai.ts` (extraction de `friseDossier`
    et `delaiLigne` d'`a-faire-modele.ts`, pour les rendre utilisables sur un `Dossier`).
  - Modifiés : une ligne dans chacun des sept `*.routes.ts` des espaces, `app.routes.ts` (alias),
    `features/home/a-faire/a-faire-modele.ts` (réexport).
- **Contenu** : fil d'Ariane et `returnUrl` validé ; en-tête d'identité ; frise ; `DossierDocuments` ; boutons Journal
  et Délais pour la CNM seulement ; états chargement, 403 et 404 (`app-etat-erreur`, un seul message, pas de cascade de
  toasts) ; `h1` = référence.
- **Acceptation** :
  - Aucun défilement horizontal à 1366×768 ni à 1229×691 (125 %) sur un PPM de 130 lignes : `scrollWidth ≤ clientWidth`
    sur `documentElement` et sur chaque `.doc-visionneuse`.
  - Défilement du plan de 130 lignes dans la page : médiane ≤ 20 ms par image, avec le banc `perf.mjs` du correctif.
  - Garde d'alias : chacun des huit profils arrive dans son espace ; Administrateur et Chargé de publication vont vers
    `/acces-refuse`.
  - `returnUrl` refusé pour `//exemple.org`, `https://…` ou `javascript:` (spec).
  - PRMP et UGPM : aucune requête interne, aucun nom de contrôleur dans le DOM (spec sur doublure contenant des noms,
    puis vérification en recette).

### L4-F3 — Étape en cours et gestes (frontend-angular)
- **Fichiers** :
  - Nouveaux : `features/circuit/page-dossier/etape-courante.ts` (panneau), `barre-collante.ts` ;
    `features/circuit/gestes/ouvrir-geste.ts` (chargement dossier, réception et dispatch, puis choix de la modale,
    extrait d'`a-faire.ts` et partagé).
  - Modifiés : `page-dossier.ts` ; `services/circuit.services.ts` (`gestes()`) ; `models/a-faire.model.ts` ;
    `features/home/a-faire.ts` (utilise `ouvrir-geste.ts`, comportement inchangé).
- **Contenu** : phrase « Étape n sur 7 · à vous / chez … », délai, badge de mode (délégation, intérim, collègue,
  suppléance), gestes du §3.3 hors navette du PV et retrait ; `?geste=` déclenché seulement s'il est servi ; rechargement
  après un geste ; repli en lecture seule si l'endpoint n'est pas servi.
- **Acceptation** :
  - Pour les 12 comptes de démo × 6 dossiers de `PRS_RECETTE`, les gestes affichés égalent la réponse de `/gestes`
    (spec plus vérification Q2).
  - Chaque geste proposé est exécuté une fois en recette sans 403 ni 409 inattendu : NUMEROTER, DISPATCHER,
    REATTRIBUER, COMPLETER_PIECES_DEPOT, EXAMINER, VERIFIER, RECTIFIER, SOUMETTRE ou COMPLETER_BROUILLON, ARCHIVER_PV,
    SIGNER_LETTRE.
  - À 1366×768 et 1229×691, le titre de l'étape et le bouton du geste principal sont visibles sans défiler (bas du
    bouton < `innerHeight`).
  - Barre collante atteignable au clavier, sans piège de focus.

### L4-F4 — Navette du PV dans la page (frontend-angular)
- **Fichiers** : `features/circuit/page-dossier/etape-pv.ts` (nouveau) ; `etape-courante.ts`.
  **`shared/circuit/pv-workflow.ts` n'est pas modifié** (12 commits du patron) : mise en page par la classe hôte seulement.
- **Contenu** : `PvWorkflow` monté seulement si le serveur sert SOUMETTRE_PV, ACCEPTER, VISER, RETOURNER ou SIGNER ;
  volet « Ce que dit le projet de PV » (avis, nombre d'observations, dernier retour, depuis `faits`) ; « Voir le projet
  de PV » ouvre `DetailPvModal` ; `(changed)` recharge la page.
- **Acceptation** :
  - Exercés en recette : VISER en navette simple, VISER par intérim avec note PDF, ACCEPTER au niveau CC puis VISER au
    niveau Président, RETOURNER, SOUMETTRE_PV, SIGNER (part du Membre). Après chaque geste, l'étape suivante s'affiche
    sans rechargement manuel.
  - `git diff` vide sur `pv-workflow.ts`.
  - Le formulaire de visa tient à 1229 px sans défilement horizontal.
  - Aucune requête de PV pour la PRMP et l'UGPM.
  - Si le serveur sert VISER mais que `PvWorkflow` masque son bouton, le panneau l'écrit (« geste indisponible sur cet
    écran ») au lieu de rester vide ; le cas est signalé à Q2.

### L4-F5 — Décision de retrait (frontend-angular)
- **Fichiers** : `features/circuit/decision-retrait.ts` (nouveau) ; `etape-courante.ts`.
  `retraits-validation.ts` n'est pas modifié.
- **Acceptation** : acceptation et refus exécutés en recette (Président et CC) ; motif de refus obligatoire avant
  l'appel ; la liste des retraits reste inchangée ; spec de la validation du motif.

### L4-F6 — Brancher les points d'entrée (frontend-angular, un commit par écran)
Dans l'ordre, du moins chaud au plus chaud (commits du patron depuis le 28/08 entre parenthèses) :
1. `home/a-faire.ts` et `a-faire-navigation.ts` : VOIR, SUIVRE, « Consulter » ; gestes courts selon la décision 2.
2. `core/notifications/notification-route.ts` (3), `layout/main-layout.html` (4) et `transverse/notifications-page.ts` :
   repli vers la page.
3. `verificateur/en-attente-prmp.ts` (1), `circuit/retraits-validation.ts` (2), `prmp/retraits.ts`.
4. `circuit/dispatchs-controleurs.ts` (8), `circuit/dossiers-clotures.ts` (10), `circuit/dossiers-circuit-liste.ts` (12),
   `circuit/lettre-renvoi-consultation.ts`.
5. `circuit/dossiers-pipeline.ts` (11) : pagination d'abord portée dans l'URL (`?page=`), sinon le retour arrière la perd.
6. `prmp/suivi-delais.ts` (17).
7. Barre de recherche du haut, si la décision 5 est validée.

- **Acceptation par commit** :
  - La référence devient un `<a [routerLink]>` (Ctrl+clic ouvre un onglet) avec `returnUrl`.
  - Le retour arrière restitue la liste : même page et mêmes filtres, vérifiés par qa-test.
  - L'import de `DossierConsultation` disparaît de l'écran ; ses specs sont mises à jour ; lint propre.
- `mise-a-jour-ppm.ts` garde la modale ; `pv-page.ts` la garde tant que Q2 n'a pas validé F4.

### L4-F7 — Nettoyage (frontend-angular)
- **Fichiers** : `verificateur/verifier-dossier.ts` (monte `DossierDocuments`), `dossier-consultation.ts` (retrait de
  l'entrée `embedded`), `home/a-faire.ts` (retrait de la modale de consultation).
- **Acceptation** : captures de la vérification identiques à 1366×768 ; plus aucune occurrence de `[embedded]` ; tests verts.

### L4-D2 — Documentation (docs)
- `backend/docs/api-endpoints.md` : ligne du tableau « Dossiers » et section « Gestes d'un dossier » ;
  `backend/docs/regles-gestion.md` : paragraphe « Page dossier » sous « Accueil À faire » (même calcul, parité) ;
  demande D1 marquée clôturée avec le commit ; nombre de tests à jour dans `backend/CLAUDE.md` (1004, et non 878).

### L4-Q1, Q2, Q3 — Vérification (qa-test)
- **Q1** (après B1) : matrice 12 comptes × 6 dossiers `PRS_RECETTE` (backend 18080) ; parité `/gestes` et `/a-faire`
  vérifiée par script ; corps brut PRMP et UGPM sans identité ; codes 401, 403 et 404.
- **Q2** (après F4 et F5) : parcours de bout en bout par profil (Secrétaire numérote, Président dispatche puis vise,
  Membre examine et signe, Vérificateur vérifie, Assistant archive, PRMP rectifie, UGPM complète un brouillon) ; journal
  réseau sans 4xx inattendu ; captures légendées à 1366×768 et 1229×691, publiées sur la page de recette ; mesure du
  temps de chargement de la page pour le Président, qui décide de L4-B2.
- **Q3** (après F6 et F7) : chaque écran rebranché, retour arrière compris ; captures avant et après.

### L4-B2 (optionnel) — Contenu filtré par dossier
Si Q2 mesure plus de 1,5 s de chargement ou plus de 1 Mo de réponses pour le Président : filtre `?dossier=` sur
`/api/marches`, `/api/service-beneficiaires` et `/api/marche-previsions` (backend-spring), puis bascule du
`DossierContenuStore` (frontend-angular). Demande backend séparée, même méthode.

---

## 8. Risques

### 8.1 Conflits avec le travail du patron
Commits du patron depuis le 28/08 sur les fichiers que le L4 toucherait :

| Fichier | Commits | Parade |
|---|---|---|
| `core/navigation/navigation.ts` | 31 | **non modifié** (seul `ESPACES_A_FAIRE` est importé) |
| `features/circuit/dossier-consultation.ts` | 30 | un seul commit de déplacement (F1), fait juste après un `fetch` ; prévenir le patron que la modale délègue à `features/circuit/dossier/` |
| `features/membre/pv-page.ts` | 24 | hors F6 tant que Q2 n'a pas validé F4 |
| `models/circuit.model.ts` | 19 | **non modifié** (nouveaux types dans `a-faire.model.ts`) |
| `prmp/suivi-delais.ts` | 17 | en dernier dans F6, commit de quelques lignes |
| `shared/circuit/chronometrage-dossier.ts`, `pv-workflow.ts` | 16, 12 | **non modifiés**, intégrés tels quels |
| `circuit/dossiers-circuit-liste.ts`, `dossiers-pipeline.ts`, `dossiers-clotures.ts` | 12, 11, 10 | un commit par écran, remplacement du bouton par un lien |
| `president.routes.ts`, `cc.routes.ts` | 9, 8 | une ligne ajoutée, conflit trivial |

Côté backend, `AFaireService` et `DossierController` ont été retouchés le 15/09 par le chantier lui-même ; risque faible.

### 8.2 Régressions de permissions
- **La page ouvre la consultation par URL directe à huit profils.** Le serveur borne le périmètre, mais un écran qui
  appelle un endpoint interdit à un profil produit un toast 403 ou un bloc vide muet (« 403 silencieux »). Endpoints
  concernés : `/journal` et `/chronometrage` pour PRMP et UGPM ; `/historique-echanges` hors PRMP, profils
  exerçant le Vérificateur et Administrateur (le Membre et l'UGPM reçoivent 403) ; PV en navette pour la PRMP. Parade : ne rien demander d'interne selon le profil
  (règle du store), `skipErrorToast()` sur les appels facultatifs avec un état explicite, matrice réseau en Q1 et Q2.
- **Divergence `PvWorkflow` et serveur** : le composant filtre encore par statut et `*appCan`. Parade : il n'est monté
  que si le serveur sert le geste ; un bouton masqué malgré le serveur est signalé à l'écran et dans Q2.
- **Délégation** : un Président sur un dossier régional voit des gestes `SUPPLEANCE` ou `INTERIM`. La page affiche le
  titre, et la garde du serveur tranche à l'exécution.
- **`?geste=` forgé** : ignoré s'il n'est pas dans `taches`.

### 8.3 Fuite C2
Surfaces nouvelles : phrase « chez … » du panneau, badges de mode, volet du projet de PV, corps de `/gestes`.
Parades :
- libellé « la Commission nationale des marchés » pour la PRMP et l'UGPM ;
- aucun appel PV, journal ou chronométrage pour elles ;
- test backend sur le corps brut (B1-5) ;
- spec front sur une doublure qui contient des noms (F2) ;
- recherche de noms de contrôleurs dans le DOM en recette (Q2).

### 8.4 Autres
- **Performance** : la page devient une entrée principale et charge les listes scopées (le pays entier pour le
  Président). Parade : mesure en Q2, puis L4-B2.
- **État des listes perdu au retour** (pagination hors URL) : critère d'acceptation de F6, `dossiers-pipeline` traité
  en dernier.
- **Double chemin pendant la transition** : neutralisé par F1 (blocs partagés).
- **Backend sans B1** (déploiement décalé) : repli de la page en lecture seule, sans toast.

---

## 9. Décisions tranchées par Mathieu (15/09/2026)

1. **Forme des liens.** **Adopté** : `/<espace>/dossier/:id` et un alias `/dossier/:id` partageable. *Option
   écartée, pour mémoire* : une route unique hors espace.
2. **Le bouton d'action de « À faire ».** **Adopté** : il ouvre la page sur l'étape pour les gestes courts
   (numéroter, dispatcher un dossier, réattribuer, pièces du dépôt, navette du PV, retrait) ; il reste direct pour les
   écrans de travail (examen, vérification, rectification, saisie) ; le dispatch groupé reste en modale. *Option
   écartée, pour mémoire* : garder le geste direct partout et n'ouvrir la page que pour « Consulter ».
3. **Où vit le panneau d'action.** **Adopté** : direction C, l'étape ouverte en pleine largeur sous la frise,
   plus une barre collante au défilement. *Option écartée, pour mémoire* : la colonne fixe de la direction A, qui
   aurait retiré environ 370 px au plan à 1366 px.
4. **Menu sur la page.** **Adopté** : en tiroir (mode concentration), comme l'examen. *Option écartée, pour
   mémoire* : menu visible, mais le plan à 13 colonnes ne tient pas à 125 %.
5. **Points d'entrée.** **Adopté** : dans toutes les listes, la référence mène à la page, sauf pendant une tâche
   (mise à jour du PPM ; gestion du PV jusqu'à la recette Q2) ; la barre de recherche du haut, aujourd'hui réservée à la
   PRMP, s'ouvre aux huit profils et mène à la page. *Option écartée, pour mémoire* : ne brancher que « À faire » et
   les notifications.
6. **Périmètre de la v1.** **Adopté** : la page ne propose que les gestes servis par « À faire ». Demander un
   retrait, ouvrir une mise à jour, annuler un dispatch ou rédiger une lettre hors navette restent sur les écrans actuels,
   et le serveur les servira plus tard dans `/gestes`. La PRMP ne voit ni délai CNM détaillé, ni journal (règle pilote du
   06/09 maintenue).

---

## 10. Recoupements avec le correctif de défilement en cours

Un agent front traite en parallèle la lenteur de défilement du PPM dans la modale (suspects : `backdrop-filter` de
`.modal-backdrop` dans `styles/_design-system.scss`, spans de césure de `shared/ui/cesure.ts` et `texte-cesure.ts`).
Le L4 n'en dépend pas fonctionnellement, mais :
- **`dossier-consultation.ts`** : si le correctif y touche (par exemple `content-visibility` sur le corps), F1 part
  **après** son commit ;
- **`shared/prmp/ppm-marches-table.ts`, `document-visionneuse.ts` et la césure** : réutilisés par la page ; tout gain
  profite à la page, dont le critère de défilement (F2) réemploie le banc `perf.mjs` du correctif ;
- la page contourne structurellement le voile flouté (le document défile dans la page, pas dans une modale), mais la
  modale reste dans `mise-a-jour-ppm` : le correctif garde tout son intérêt.
