# Design institutionnel : inventaire et plan (étape 0)

Ce document répond à la demande du pilote du 30/10. Le design change l'apparence seulement ; les menus, les pages, les routes, les
données et la logique ne changent pas. **Rien n'est modifié à cette étape.**

## 1. Le projet

| Point | Constat |
|---|---|
| Angular | **22.1**, composants **standalone** (pas de NgModule), signals, `OnPush` |
| Bibliothèque d'interface | **aucune** (ni Material, ni PrimeNG, ni Bootstrap) : un design system maison |
| Icônes | bibliothèque **maison** en SVG (`shared/ui/icone.ts`, `<app-icone nom=…>`), au trait. **Elle est conservée** : pas de Tabler. |
| Polices | Plus Jakarta Sans auto-hébergée (`public/fonts`, `styles/_fonts.scss`) ; **Inter n'est pas disponible** |
| Styles globaux | `src/styles.scss` (623 l.), qui importe `styles/_design-system.scss` (1 743 l., **84 jetons** `--p-*`, `--n-*`, `--success-*`…), `_responsive.scss`, `_ppm-table.scss`, `_document-officiel.scss`, `_palette-institutionnelle.scss`, `_fonts.scss` |
| Composants | 264 composants, dont la plupart ont un gabarit **inline** ; 39 fichiers `.scss`, 16 `.html` |
| Couleurs écrites en dur | **1 734** dans **148 fichiers** de `src/app` ; 38 dégradés ; 142 `box-shadow` |
| Logo | `public/mef-logo.png` (page de connexion) ; dans la coquille, une pastille « MEF » en texte |
| Fil d'Ariane | **existe déjà** dans la coquille (`main-layout.html`, lot B du 22/09) |
| Badge de statut | **existe déjà** : `app-statut-badge` (28 écrans), et les classes `.badge-success/-warning/-danger/-info/-neutral/-primary` (≈ 130 emplois) |

**Fichiers les plus chargés en couleurs en dur** : examen du Membre (`examen-dossier.scss` 130, `examen-grille.scss` 101,
`examen-synthese.scss` 53), accueil « À faire » (64 + 53), répartition du dispatch (56), page du PV (56), éditeur des modèles de PV
(55), page du dossier (55 + 43), instantanés de procédure (50), grille de saisie du PPM (47).

## 2. Routes et pages

229 routes, qui servent **≈ 110 écrans distincts** : le même composant sert souvent plusieurs profils. Par exemple, `PageDossier`
est monté sous 7 espaces et `DossiersPipeline` sous 6. Chaque type d'écran ci-dessous correspond à un modèle de la demande.

### Tableau de bord / accueil (10)

| Écran | Routes |
|---|---|
| `AFaireEcran` « À faire » | `/{prmp,president,cc,secretaire,membre,verificateur,assistant}/a-faire` |
| `AdminAccueil` « Poste d'administration » | `/admin/tableau-de-bord` |
| `Home` (aiguillage d'accueil) | `/` |
| `ResultatExamen` (carrefour à cartes) | `/{president,cc,membre,prmp}/resultat-examen` |
| `RecusHub` (carrefour des reçus) | `/prmp/recus` |
| `SectionHome` (carrefour des nomenclatures) | `/admin/referentiels` |
| `KpiDashboard` (statistiques, hors menu) | `/{president,cc}/statistiques` |
| `RapportsPage` (hors menu) | `/{admin,president,cc}/rapports` |
| `AccueilPublic` (portail public, sans menu) | `/accueil/:audience` |
| `SuiviDelais` « Suivi des dossiers CNM » | `/prmp/tableau-de-bord` (c'est une **liste** avec chiffres de synthèse) |

### Listes (≈ 55)

| Domaine | Écrans |
|---|---|
| Dossiers | `DossiersPipeline` (« Tous les dossiers », « À vérifier », « Vérifications »), `DossiersClotures`, `DossiersARectifier`, `DossiersListe`, `MesDossiers`, `MesBrouillons`, `EnAttentePrmp`, `DossierMarcheProcedures` |
| Décisions et PV | `MembrePv`, `PvDefinitifs`, `PvAssistant` (liste et détail), `LettreRenvoiList`, `LettreRenvoiConsultation` (liste et détail), `RetraitsValidation`, `PrmpRetraits` |
| Passation (PRMP) | `ContratsVigueur`, `RetraitsDao`, `RecusDao`, `QuestionsDao`, `DepotsDao`, `PpmMarches`, `MesPpmMarches`, `PrmpMarchesPrevisions` |
| Pilotage | `DispatchsControleurs`, `ChainesControle`, `InterimsEcran` |
| Administration | `AnnuaireAdmin`, `PrmpAdmin`, `ControleurAdmin`, `UgpmAdmin`, `MandatsAdmin`, `PrmpPiecesAdmin`, `UgpmPiecesAdmin`, `InscriptionsAdmin`, `RattachementsAdmin`, `AuditLogsAdmin`, `ActualitesAdmin`, `EntreprisesAdmin`, `ExclusionsArmpAdmin`, `ModelesPvListe`, `CrudPage` (écran générique : PPM, documents publics, nomenclatures) |
| Transverses | `NotificationsPage`, `NotificationsList`, `ProceduresEnLigne` (« Mes procédures en ligne », et liste publique du candidat), `PublicationsPage` |
| Espaces externes | candidat : `MesOffres`, `MesInvitations`, `RemisesTitulaire`, `BonsCommandeTitulaire` ; CAO : `MesProceduresCao`, `RemisesCao`, `ReceptionsMembre` ; dépositaire : `MesProceduresDepositaire` ; les trois : `NotificationsExternes` |

### Fiches détail (≈ 8)

| Écran | Routes |
|---|---|
| `PageDossier` (page du dossier, à onglets) | `/{7 espaces}/dossier/:idDossier` |
| `VerifierPpm` | `/prmp/verifier-ppm/:idPpm` |
| `ProcedureEnLigneDetail` | `/candidat/procedures/:idDmc` |
| `AmiEnLigneDetail` | `/candidat/amis/:idDmc` |
| `ProcedureCao` | `/cao/procedures/:idDmc` |
| `ProcedureDepositaireEcran` | `/depositaire/procedures/:idDmc` |

S'y ajoutent les détails servis par les écrans de liste (`…/pv-examens/:idPv`, `…/lettre-renvois/:idLettre`).

### Formulaires (≈ 26)

| Domaine | Écrans |
|---|---|
| Sans menu | `Login`, `RegisterPrmp`, `InscriptionCandidat`, `ConfirmationCandidat`, `ActivationCao` (CAO et dépositaire) |
| Dossiers | `SoumettreDossier`, `RectifierDossier`, `RectifierDossierDao`, `MiseAJourPpm`, `CreerUgpm` |
| Procédure | `ParametresInternesEcran`, `CaoEcran`, `AmiDao`, `DepotOffre`, `EntrepriseCandidat` |
| Réglages (Administrateur) | `DelaisStandards`, `AgpmSeuilAdmin`, `PreControleRegles`, `CompteDaoAdmin`, `CaoQuorumAdmin`, `SigmpTransitionAdmin`, `RecoursSuspensifsAdmin`, `RemiseElectroniqueAdmin`, `ParametresCandidatsAdmin`, `ChampsFicheMarcheAdmin`, `DmcMappingAdmin` |

### Autres : écrans de travail, à signaler (≈ 11)

Ces écrans reçoivent la palette, la typographie, les blocs et les styles communs, sans modèle imposé :

- `FicheMarcheEcran` : la fiche du DAO, un long formulaire par lot avec ses documents produits ;
- `ExamenDossier` : l'examen séquentiel par ligne, avec sa grille ;
- `VerifierDossier`, `SeanceEcran` (séance d'ouverture), `EvaluationEcran` (évaluation des offres) et `PreselectionAmi` ;
- `CalendrierMarches` : un calendrier et un diagramme de Gantt ;
- `EntiteArbre` : l'arbre des entités ;
- `Messagerie` (hors menu) ;
- `ModelePvFicheEcran` : l'éditeur Tiptap des modèles de PV ;
- `AccessDenied` : la page d'erreur.

**Les documents officiels ne sont pas restylés** : avis spécifique, fiche de présentation, AGPM, DAO, lettres d'invitation et page
du PV, rendus par `_document-officiel.scss`. Ils reproduisent un modèle réglementaire, avec leurs propres noirs et leurs emblèmes.
Leurs couleurs restent écrites dans `_document-officiel.scss`.

## 3. Le menu

### Aujourd'hui

C'est un menu **latéral vertical**, rangé en **rubriques** (lot 5 du 16/09). Il se réduit en **rail** de 76 px, mémorisé dans
`localStorage` sous la clé `cnm.menu-compact`. Ses intitulés de rubrique sont dorés (`#f5c542`) sur une bande sombre, chez les
dix profils, depuis le 22/09. Quatre fichiers le définissent :

- la source unique des entrées, `NAV_BY_ROLE` (`core/navigation/navigation.ts`) ;
- leurs rubriques, `GROUPES_PAR_CHEMIN` (`core/navigation/groupes-menu.ts`), avec son garde-fou de dérive `groupes-menu.spec.ts` ;
- deux scripts de contrôle, `scripts/hauteur-menu.mjs` et `scripts/contrastes-coquille.mjs`.

| Profil | Entrées de 1er niveau (hors délégation et intérim) |
|---|---|
| PRMP | 11 : À faire · Suivi des dossiers CNM · Créer dossier · Mettre à jour un PPM · Appels d'offres · Reçus des frais · Contrats en vigueur · PV et lettres de renvoi · Demandes de retrait · Calendrier · Notifications |
| UGPM | 8 : À faire · Tous les dossiers · Créer dossier · Mes brouillons · Appels d'offres · Reçus des frais · Contrats en vigueur · Notifications |
| Président et Chef de commission | 8, plus 2 en délégation : À faire · Tous les dossiers · Répartition de dispatch · Examen de dossiers · Demandes de retrait · Chaînes de contrôle · Intérim · Notifications · (délégation) Vérifications · Archivage des PV |
| Secrétaire | 3 : À faire · Tous les dossiers · Notifications |
| Membre | 4 : À faire · Tous les dossiers · PV et lettres de renvoi · Notifications |
| Vérificateur | 4 : À faire · À vérifier · Vérifiés / clôturés · Notifications |
| Assistant contrôleur | 5 : À faire · Tous les dossiers · Lettres de renvoi reçues · PV reçus · Notifications |
| Chargé de publication | 3 : Publications · Documents publics · Notifications |
| Responsable de procédure | 2 : Mes procédures en ligne · Notifications |
| Administrateur | 12 : Poste d'administration · Demandes d'accès · Comptes & personnes · Chaînes de contrôle · Délais standards · Points de contrôle · Seuil AGPM (AMI) · Règles d'alerte · Nomenclatures · Journal · Actualités · Notifications |

Les espaces externes (candidat, CAO, dépositaire) ont leur propre coquille, `EspaceExterneLayout`, avec de courts onglets.

### Proposition

C'est une **barre horizontale**. **Les rubriques actuelles deviennent les menus déroulants**, sans nouveau classement. La table
`GROUPES_PAR_CHEMIN` reste la source unique, et le garde-fou `groupes-menu.spec.ts` continue de jouer.

- **Accueil en tête** : l'entrée d'accueil, « À faire » ou « Poste d'administration », reste une entrée directe, en premier.
- **Une rubrique d'une seule entrée** s'affiche comme une **entrée directe**, sans déroulant : par exemple « Calendrier » chez la
  PRMP. Un déroulant d'un seul élément coûte un clic pour rien.
- **Notifications** reste une entrée directe, **à droite** de la barre, comme le pied actuel du menu.
- **Les menus de 7 entrées ou moins restent à plat** : Secrétaire, Membre, Vérificateur, Assistant, Chargé de publication et
  Responsable de procédure.
- **Délégation et intérim** : « Exercé par délégation » et « Exercé par intérim » deviennent chacun un déroulant à leur nom, en fin
  de barre.

| Profil | Barre proposée |
|---|---|
| PRMP | À faire · **Mon travail ▾** (Suivi des dossiers CNM, Créer dossier, Mettre à jour un PPM, Appels d'offres, Reçus des frais, Contrats en vigueur) · **Décisions ▾** (PV et lettres de renvoi, Demandes de retrait) · Calendrier · … · Notifications |
| UGPM | À faire · **Mon travail ▾** (6) · … · Notifications |
| Président et Chef de commission | À faire · Tous les dossiers · **Décisions ▾** (Examen de dossiers, Demandes de retrait) · **Pilotage ▾** (Répartition de dispatch, Chaînes de contrôle, Intérim) · **Exercé par délégation ▾** · … · Notifications |
| Administrateur | Poste d'administration · **Accès ▾** (Demandes d'accès, Comptes & personnes) · **Règles du contrôle ▾** (Chaînes, Délais, Points de contrôle, Seuil AGPM, Règles d'alerte) · Nomenclatures · **Traces ▾** (Journal, Actualités) · … · Notifications |
| Autres profils | à plat, comme aujourd'hui |

Les **pastilles** des entrées (`badges.*`) suivent leur entrée. Une rubrique repliée montre la **somme** de ses pastilles, pour qu'un
dossier en attente ne se cache pas dans un déroulant.

Ce que la proposition supprime :

- **le rail compact**, sans objet en barre horizontale : clé `cnm.menu-compact`, `MenuCompactStore`, bouton de la barre du haut,
  libellés courts. **C'est une fonctionnalité retirée** (voir Q1) ;
- le script `hauteur-menu.mjs`, sans objet. Il serait remplacé par une mesure de **largeur** de la barre, pour les dix profils à
  1229 px et 1366 px.

Sous 768 px, la barre se replie derrière un bouton « Menu » et s'affiche en liste verticale, comme le tiroir actuel. En **mode
concentration** (`data.concentration`, la page du dossier), la barre reste repliée derrière ce bouton : c'est la règle actuelle du
tiroir.

## 4. Composants partagés et statuts

| Demandé | Existant | Proposition |
|---|---|---|
| badge-statut | `app-statut-badge` et les classes `.badge-*` | **garder** le composant et ses classes, et **restyler** les classes : un seul point change ≈ 160 emplois |
| carte-indicateurs | des chiffres de synthèse écrits écran par écran (« À faire », suivi des délais, poste d'administration…) | **créer** `shared/ui/carte-indicateurs.ts` |
| fil-ariane | dans `main-layout` | **garder** l'existant (construit à partir des routes), le **restyler** |
| titre-page | une classe `.page-header` ou un `<h1>` par écran | **créer** `shared/ui/titre-page.ts`, avec un emplacement d'actions à droite |
| bloc | les classes `.card` et `.panel` du design system | **créer** `shared/ui/bloc.ts` ; restyler aussi `.card` pour que les écrans non encore migrés suivent |
| bandeau-section | les intitulés dorés du menu, quelques `section-title` | **créer** `shared/ui/bandeau-section.ts` |

### Statuts métier : correspondance proposée avec les 4 familles

Elle part de `statutSeverity` (`shared/circuit/circuit-workflow.ts`), qui classe déjà chaque statut. **Seule la famille « info »
(bleue) change** : la règle « aucun texte en bleu » l'interdit, elle rejoint **examen**.

| Famille | Statuts |
|---|---|
| **retard** (rouge) | RETIRE · REJETE · REFUSEE · DEFAVORABLE · REFUSE (compte) · SUSPENDU · ABROGE · REVOQUE · ELIMINEE · ECARTEE · HORS_BUDGET · INCONNU_DGI · REFUSE_SUR_PIECES · alertes de délai dépassé |
| **examen** (ambre) | SOUMIS · PRET_DISPATCH · DISPATCHE · EN_EXAMEN · EXAMINE · PROJET_SOUMIS · EN_RECTIFICATION · EN_ATTENTE · EN_ATTENTE_DECISION_PRMP · EN_ATTENTE_PIECES · EN_ATTENTE_COMPLEMENTS_DEPOT · A_REEXAMINER · OBSERVATIONS_LEVEES · DECISION_TRANSMISE_SIGMP · FAVORABLE_RESERVES · EN_TRANSITION · A_EVALUER · EN_COURS · OUVERT (signalement) · A_VENIR |
| **favorable** (vert) | CLOTURE · SIGNE / PV_SIGNE · PROJET_ACCEPTE · APPROUVE · ACCEPTEE · PUBLIE · FAV · VALIDEE (fiche) · ACTIF · QUALIFIEE · EVALUEE · VERIFIE_DGI · VERIFIE_SUR_PIECES · LEVE_MODIFICATION · ACHEVE (mandat ou intérim) |
| **neutre** (gris) | BROUILLON · NON_OUVERTE · NON_VERIFIE · SANS_COMPTE · INACTIF · ARCHIVE · ECARTE (signalement) · tout statut inconnu |

Deux cas sont à trancher (Q4) :

- **FAVORABLE_RESERVES, l'avis FAVR** : il est classé « examen », puisque des réserves restent à lever. On pourrait aussi le
  vouloir « favorable ».
- **DECISION_TRANSMISE_SIGMP et OBSERVATIONS_LEVEES** : ils sont classés « examen », puisque le circuit continue.

## 5. Plan des fichiers

**Étape 1 : palette et styles globaux**

- `src/styles.scss` : les jetons de la demande, la typographie (13 px, titres en serif, graisses 400 et 500), le focus visible,
  pas de dégradés ni d'ombres.
- `styles/_design-system.scss` : les **anciens jetons** (`--p-*`, `--n-*`, `--success-*`…) sont **redirigés** vers les nouveaux.
  Par exemple, `--p-700` devient `var(--bouton-principal)` et `--n-500` devient `var(--texte-secondaire)`. Les 1 734 emplois
  suivent ainsi d'un coup, avant le nettoyage écran par écran. Les jetons de rôle (`--prmp-ink`…) passent aux couleurs neutres
  ou de statut, sans bleu en texte.
- `styles/_palette-institutionnelle.scss` : il est rebranché sur les nouveaux jetons.

**Étape 2 : coquille et composants partagés**

- `layout/main-layout/main-layout.{html,scss,ts}` : bandeau tricolore, en-tête, barre horizontale à déroulants, pied de page.
  **La logique du menu ne bouge pas**, ni les entrées, ni les droits, ni la délégation, ni l'intérim. Seuls changent l'état
  d'ouverture des déroulants et le retrait du rail.
- `core/navigation/groupes-menu.ts` : rien ne change sur les rubriques. Les libellés courts tombent avec le rail.
- `features/externe/espace-externe-layout.ts`, `features/auth/*` (connexion, inscription), `features/errors/*` : le bandeau
  tricolore et le logo, sans menu.
- À créer dans `shared/ui/` : `carte-indicateurs.ts`, `titre-page.ts`, `bloc.ts`, `bandeau-section.ts`.
- À restyler dans `styles.scss` et `_design-system.scss` : tableaux (`.ppm-table` compris), formulaires, boutons, liens,
  alertes et badges.
- Scripts : `contrastes-coquille.mjs` est mis à jour avec les nouvelles paires de couleurs ; `hauteur-menu.mjs` est remplacé par
  `largeur-menu.mjs`.
- Tests : `main-layout.spec.ts` (885 lignes), et `groupes-menu.spec.ts` pour la partie des libellés courts, à adapter.

**Étape 3 : les écrans, par lots**, avec `ng build`, les tests, le lint et des captures après chaque lot :

1. **Accueils** : `AFaireEcran`, `AdminAccueil`, `ResultatExamen`, `RecusHub`, `SectionHome`.
2. **Listes de dossiers** : `DossiersPipeline`, `SuiviDelais`, `DossiersClotures`, `MesBrouillons`, `EnAttentePrmp`…
3. **Page du dossier** : `PageDossier` et ses onglets. C'est la plus lourde, avec ≈ 100 couleurs en dur.
4. **Examen et vérification** : `ExamenDossier`, `VerifierDossier`, PV. C'est le point le plus dense, avec ≈ 290 couleurs en dur.
5. **Passation** : `FicheMarcheEcran`, séance, évaluation, AMI, dépôts, reçus, contrats.
6. **Pilotage et décisions** : dispatch, chaînes, intérim, retraits, lettres.
7. **Administration** : ≈ 30 écrans, dont `CrudPage` qui en sert une vingtaine à lui seul.
8. **Espaces externes et pages sans menu** : candidat, CAO, dépositaire, connexion, portail public.

**Estimation** : étapes 1 et 2, ≈ 2 jours ; étape 3, ≈ 6 à 9 jours selon la profondeur du nettoyage des couleurs en dur.

## 6. Points à valider

> ⚠️ **2026-10-30 — décisions du pilote** (recommandations acceptées) :
> - **Q1** : la barre horizontale est validée et le rail compact est retiré. Le titre d'un déroulant porte la somme des pastilles de
>   ses entrées, et il reste surligné quand une de ses pages est ouverte.
> - **Q2** : (a), la pile système « Segoe UI », Roboto, Arial ; les titres sont en Georgia. Plus Jakarta Sans est retirée.
> - **Q3** : le pied de page tient en une ligne de texte, sans lien : « Commission nationale des marchés · Ministère de l'Économie et
>   des Finances · PRS 2.0 ».
> - **Q4** : FAVORABLE_RESERVES, OBSERVATIONS_LEVEES et DECISION_TRANSMISE_SIGMP sont classés **examen**.
> - **Q5** : la règle couvre `src/styles.scss` et ses partiels `src/styles/_*.scss`, sauf `_document-officiel.scss`.
> - **Q6** : les trois changements sont confirmés.
> - **Contrastes** : la palette est corrigée sur deux points, pour l'accessibilité (WCAG AA).
>   - `--favorable-texte` passe à `#187547` : 5,01:1 au lieu de 4,40:1 sur son fond.
>   - `--bordure-champ` `#868E96` est ajoutée pour le contour des champs, à 3,32:1 sur blanc. `--bordure` vaut 1,35:1 : elle reste
>     réservée aux filets décoratifs.

- **Q1, le menu horizontal** remplace la barre latérale et **supprime le rail compact**, une fonctionnalité livrée au lot 5. Les
  rubriques actuelles deviennent les déroulants. Est-ce validé ?
- **Q2, la police** : Inter n'est pas dans le projet. Deux choix :
  - **(a)** prendre la pile système « Segoe UI », Roboto, Arial, sans rien ajouter ;
  - **(b)** auto-héberger Inter en woff2, sous licence libre OFL, dans `public/fonts`. C'est un ajout de ressource, mais pas de
    dépendance npm.

  Dans les deux cas, Plus Jakarta Sans est retirée.
- **Q3, le pied de page** : il n'en existe pas aujourd'hui, donc rien à reprendre. Que doit-il porter ? Par exemple : « Commission
  nationale des marchés · Ministère de l'Économie et des Finances · PRS 2.0 », et un lien vers l'aide ou les textes.
- **Q4, les statuts limites** : le classement de FAVORABLE_RESERVES, OBSERVATIONS_LEVEES et DECISION_TRANSMISE_SIGMP (§4).
- **Q5, la règle « aucune couleur en dur hors de styles.scss »** : nous proposons d'y inclure les partiels importés par
  `styles.scss` (`src/styles/_*.scss`), et d'en excepter `_document-officiel.scss`, propre aux documents réglementaires.
- **Q6, les décisions antérieures que ce design remplace**, à confirmer :
  - l'or des intitulés passe de `#f5c542` à `--or` `#F5B800` ;
  - le bleu `--p-*` des boutons, des liens et des pastilles d'information disparaît ;
  - les couleurs propres à chaque profil (`--prmp-ink`…) cessent d'être des textes colorés.
