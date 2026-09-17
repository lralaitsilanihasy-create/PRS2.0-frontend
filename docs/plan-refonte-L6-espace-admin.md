# Plan — Lot 6 : l'espace d'administration

**Date** : 2026-09-17 · **Rédacteur** : dev-lead · **Branche** : `chantier/espace-admin` (à partir de
`main` : front `2c76cde`, back `783a7e3`) · **Origine** : relevé de Mathieu sur la capture de
`/admin/tableau-de-bord` (« c'est désordonné et difficile à lire · c'est quoi la différence entre
Sessions et Comptes ? »), maquettes `maquettes-design/admin/` — **A retenue pour la coquille et
l'accueil, C retenue pour l'écran des comptes**.

> **Statut : ouvert — F1 et F4 livrés le 17/09** sur `chantier/espace-admin` (commits `a191247`
> et `dacb351`). Restent F2, F3, F5, puis Q1 et D1 ; F2 et F3 attendent B1 et B2. Ce plan se lit
> avec la demande backend `demande-backend-2026-09-17-espace-admin.md`, qui porte les cinq besoins
> serveur (B1 à B5).

---

## 0. En bref

Le lot 5 a donné au menu ses **rubriques** (`core/navigation/groupes-menu.ts`). Le L6 n'invente donc
pas le mécanisme : il **re-classe** les entrées de l'Administrateur dans des rubriques qui décrivent
son métier, remplace son écran d'accueil — aujourd'hui emprunté au contrôle — et transforme le
sommaire « Comptes & hiérarchie » en annuaire agissant.

| Ordre | Lot | Agent | Dépend de | Taille | Touche un fichier chaud ? |
|---|---|---|---|---|---|
| 1 | **L6-F1** Rubriques de l'Administrateur re-classées — **LIVRÉ** | frontend-angular | — | S | `navigation.ts` (33 commits) — **2 lignes retirées** |
| 1 | **L6-F4** Actions de compte : suspendre, réactiver, réinitialiser — **LIVRÉ** | frontend-angular | — | S | non |
| 2 | **L6-F2** Accueil de l'Administrateur (maquette A) | frontend-angular | B1 | M | non — écran neuf |
| 2 | **L6-F3** Annuaire (maquette C) | frontend-angular | B2, F4 | L | non — écran neuf |
| 3 | **L6-F5** Journal : onglet « Connexions » | frontend-angular | B4 | S | `audit-logs-admin.ts` (calme) |
| 4 | **L6-Q1** Recette : rubriques, accueil, annuaire, actions | qa-test | F1…F5 | M | — |
| 5 | **L6-D1** Clôture du plan, `api-endpoints.md`, `regles-gestion.md` | docs | Q1 | S | — |

**En parallèle dès le premier jour : F1 et F4**, qui ne croisent aucun fichier et ne dépendent
d'aucune route neuve. F2 et F3 attendent B1 et B2.

---

## 1. Existant, mesuré le 17/09

### 1.1 Le menu est déjà groupé — c'est le classement qui est faux

`groupes-menu.ts` (lot 5) porte déjà les rubriques de l'Administrateur :

| Rubrique actuelle | Entrées |
|---|---|
| Suivi | Tableau de bord global · Journal d'audit · **Sessions** |
| Demandes | Inscriptions en attente · Rattachements en attente |
| Organisation | Chaînes de contrôle · Comptes & hiérarchie |
| Paramétrage | Délais standards · Seuil AGPM (AMI) · Référentiels · **Actualités** |
| Données | PPM & marchés · Marchés & dates prév. |

Trois défauts, tous dans le **classement**, pas dans le mécanisme :

1. **« Sessions » est rangé dans Suivi** alors que c'est un journal de connexions — et un CRUD
   générique *éditable* sur une table que rien n'alimente (§1.3).
2. **« Actualités » est rangé dans Paramétrage** alors que c'est de la communication, pas un réglage
   du moteur de contrôle. À l'inverse, **« Points de contrôle » et « Règles d'alerte » sont noyés
   dans les 20 nomenclatures de « Référentiels »** alors que ce sont les réglages qui changent le
   comportement du contrôle pour tout le monde.
3. **« PPM & marchés » et « Marchés & dates prév. » sont des écrans PRMP réutilisés** (`features/prmp`
   dans `admin.routes.ts:90-91`) : de la consultation de données métier, pas de l'administration.

### 1.2 Le poids visuel ne suit pas le contenu

« Sessions » = 1 table. « Comptes & hiérarchie » = un sommaire de **8 écrans**. « Référentiels » = un
sommaire de **22 écrans**. Les trois ont la même ligne de menu. Conséquence directe : huit écrans
d'administration (mandats PRMP, UGPM, organigrammes, arbre des entités, mapping DMC, pièces PRMP,
pièces UGPM, affectations PRMP⇄entité) n'apparaissent **nulle part** dans le menu — on ne les atteint
qu'en passant par un sommaire.

### 1.3 L'accueil de l'Administrateur n'est pas le sien

`/admin/tableau-de-bord` charge `KpiDashboard` depuis `features/pilotage` (`admin.routes.ts:38`) —
le tableau de bord du **contrôle**, réutilisé tel quel. Il affiche « Dossiers déposés », « Dossiers
conformes », « Taux de conformité » et « Top 5 des points non conformes ». Même rempli, aucune de ces
mesures n'est du ressort de l'Administrateur. Pendant ce temps `KpiService.mesCompteursAdmin()`
calcule déjà trois compteurs (inscriptions en attente, comptes, journal) que rien n'affiche en tête.

### 1.4 Trois gestes d'administration manquent ou sont cachés

| Geste | État |
|---|---|
| Suspendre un compte | `POST /api/comptes-auth/{login}/desactiver` **existe, aucun écran ne l'appelle** |
| Réinitialiser un mot de passe | `POST /api/comptes-auth/{login}/reinitialiser-mot-de-passe` existe, atteint **par effet de bord** en remplissant des champs optionnels du formulaire PRMP ou UGPM |
| Voir les connexions | nulle part : `/api/auth/**` est **exclu** du journal d'audit (`AuditConfig.java:23`), `t_session_utilisateur` n'est écrite par aucun code applicatif, et les échecs ne vivent qu'en mémoire dans `LoginRateLimiter` |

`t_audit_log.SESSION_ID` porte pourtant une clé étrangère vers `t_session_utilisateur(ID_SESSION)`
(`V1__baseline.sql:3017`) : le schéma prévoyait que chaque action pointe vers sa session. Cette FK est
morte depuis la baseline.

### 1.5 Fichiers chauds (`git log main --since=2026-08-28`)

| Fichier | Commits | Nature |
|---|---|---|
| `core/navigation/navigation.ts` | **33** | exclusivement des **données** : ajouter, retirer, renommer une entrée de `NAV_BY_ROLE` |
| `features/admin/admin-resources.config.ts` | 5 | ajout de ressources CRUD |
| `features/admin/admin.routes.ts` | 3 | branchement d'écrans dédiés |
| `core/navigation/groupes-menu.ts` | 2 | le fichier du lot 5 — **calme** |
| tous les autres écrans `features/admin/*` | 0 à 2 | calmes |

**Ce que cela dit** : comme au lot 5, le risque est concentré sur `NAV_BY_ROLE`. Le L6 n'y touche que
pour **retirer deux entrées** ; tout le reclassement vit dans `groupes-menu.ts`, calme.

---

## 2. Stratégie

1. **Ne pas réécrire le mécanisme de rubriques.** Il est bon et il est neuf. On change la table de
   classement, pas le code qui la lit.
2. **Deux écrans neufs, aucun écran supprimé.** L'accueil et l'annuaire sont des fichiers neufs ; les
   22 écrans de référentiels et les 8 écrans de comptes restent là où ils sont, joignables comme
   avant. Le seul retrait est celui de l'écran « Sessions » (§4.5), remplacé par un onglet en lecture
   seule.
3. **Rien de ce qui est dessiné ne reste creux.** Chaque chiffre des maquettes a sa source : soit une
   route existante, soit un des cinq besoins B1 à B5. Les chiffres qui n'en ont pas ne sont pas
   affichés (§6).

---

## 3. Le menu cible

| Rubrique | Entrées | Changement |
|---|---|---|
| **Accès** | Demandes d'accès · Comptes & personnes | « Inscriptions » et « Rattachements » fusionnent en une entrée à deux onglets ; « Comptes & hiérarchie » devient « Comptes & personnes » et ouvre sur l'annuaire |
| **Règles du contrôle** | Chaînes de contrôle · Délais standards · Points de contrôle · Seuil AGPM (AMI) · Règles d'alerte | « Points de contrôle » et « Règles d'alerte » **sortent** des nomenclatures et deviennent des entrées de plein droit |
| **Référentiels** | Nomenclatures · Organisation de l'État | les 20 tables restantes ; « Organisation de l'État » regroupe ministères, organigrammes, entités, localités, arbre |
| **Traces** | Journal (onglets Actions / Connexions) · Actualités | « Sessions » disparaît du menu et devient un onglet ; « Actualités » quitte Paramétrage |

**Retirés du menu, routes conservées** : `PPM & marchés`, `Marchés & dates prév.` — écrans PRMP
réutilisés, de la consultation. Décision de Mathieu du 17/09, réversible en une ligne de
`NAV_BY_ROLE`.

De 14 entrées à **12**, et aucune n'est un sommaire vide : « Comptes & personnes » ouvre sur l'annuaire,
qui donne accès aux 8 écrans qu'il cachait.

---

## 4. Les lots

### 4.1 L6-F1 — Rubriques re-classées *(S)* — **LIVRÉ le 17/09 (`a191247`)**

> **Trois écarts au plan, décidés en cours de route** :
> 1. **« Organisation de l'État » n'est pas créé.** Le §3 le donne comme seconde entrée de
>    « Référentiels », mais c'est un sommaire d'écran NEUF (ministères, organigrammes, entités,
>    localités, arbre), que ni le §4.1 ni la stratégie du §2 (« deux écrans neufs ») ne prévoient —
>    et il porterait le menu à 13 entrées au lieu des 12 annoncées. La rubrique « Référentiels »
>    n'a donc qu'une entrée, « Nomenclatures » (l'ancien sommaire, moins ses deux promus).
> 2. **« Sessions » quitte le menu dès F1**, pas F5. Le menu cible du §3 ne la porte pas, et le
>    critère de hauteur ne tient pas sans ce retrait (mesuré). F5 garde ce qui lui revient : la
>    route, sa configuration `SECURITE`, et l'onglet « Connexions » qui la remplace.
> 3. **« Demandes d'accès » ouvre les inscriptions**, et les deux écrans se renvoient l'un à
>    l'autre par un lien de tête de page jusqu'à F3 — garder les deux entrées coûtait +31 px de
>    défilement à 1229×691.
>
> **Mesure du critère** (`node scripts/hauteur-menu.mjs`, livré avec le lot — Chrome sans interface,
> CSS compilé du dépôt, données réelles de `NAV_BY_ROLE`) :
>
> | Administrateur | 1366×768 large | 1366×768 rail | 1229×691 large | 1229×691 rail |
> |---|---|---|---|---|
> | avant (main `2c76cde`) | −30 | −33 | **+47** | **+44** |
> | après | −116 | −122 | **−39** | **−45** |
>
> (+ = pixels qui défilent, − = marge restante.) Les neuf autres menus sont mesurés aussi : aucun
> ne défile, et aucun ne bouge. La marge de 39 px ne laisse la place qu'à **une** entrée de plus.

- `groupes-menu.ts` : quatre rubriques neuves pour l'Administrateur (`acces`, `regles`,
  `referentiels`, `traces`) et leur ordre ; les rubriques existantes des neuf autres profils ne
  bougent pas.
- `navigation.ts` : **retrait** de `ppm-marches` et `marches-previsions` ; **renommage** de
  « Comptes & hiérarchie » en « Comptes & personnes » ; ajout de « Points de contrôle » et
  « Règles d'alerte » pointant sur leurs écrans de référentiel existants.
- Mot court du rail pour chaque entrée neuve (`COURTS_PAR_ROLE`), en respectant WCAG 2.5.3 :
  le mot visible doit être un **fragment** du libellé complet, pas un synonyme — la règle posée par
  `af94f03` au lot 5.
- **Critère** : les 12 entrées tiennent sans défilement à 1366×768 **et** à 1229×691, les deux tailles
  de recette du lot 5.

### 4.2 L6-F4 — Actions de compte *(S)* — **LIVRÉ le 17/09 (`dacb351`)**

> Modale commune `features/admin/actions-compte.ts`, ouverte par un bouton « Compte » sur la ligne
> de la personne dans les trois écrans. Le chemin par effet de bord est retiré au passage : les
> champs de compte ne sont plus rendus en modification, un enregistrement de fiche ne touche donc
> plus jamais à un mot de passe.
>
> **Limite à lever par B2** : aucune route ne donne le login d'un compte **actif** (`UgpmDto` le
> porte, `PrmpDto` et `ControleurDto` non ; `/comptes-auth/en-attente` ne liste que les inactifs).
> La modale déduit ce qu'elle peut et **demande** le login quand elle ne sait pas, en le disant.
> L'annuaire rendra cette saisie inutile.

Trois actions branchées sur des endpoints **qui existent déjà** :

| Action | Route | Garde |
|---|---|---|
| Suspendre | `POST /api/comptes-auth/{login}/desactiver` | confirmation ; refus sur son propre compte |
| Réactiver | `POST /api/comptes-auth/{login}/activer` | — |
| Réinitialiser le mot de passe | `POST /api/comptes-auth/{login}/reinitialiser-mot-de-passe` | confirmation ; le mot de passe ne s'affiche qu'une fois |

Elles vivent d'abord dans les écrans existants (`prmp-admin`, `ugpm-admin`, `controleur-admin`), puis
F3 les reprend dans la fiche d'annuaire. Aucune demande backend.

### 4.3 L6-F2 — Accueil de l'Administrateur *(M, dépend de B1)*

Écran neuf `features/admin/admin-accueil.ts`, monté sur `/admin/tableau-de-bord` à la place de
`KpiDashboard`. Reprend la maquette A :

- **À traiter maintenant** — deux cartes de file d'attente avec l'ancienneté de la plus vieille
  demande, et le bouton qui y mène ;
- **Accès** — quatre tuiles : comptes actifs, suspendus, échecs de connexion (24 h), sessions ouvertes ;
- **Derniers changements de paramétrage** — le journal d'audit filtré sur les tables de réglage (B5) ;
- **À surveiller** — mandats PRMP qui expirent sous 30 jours, pics d'échecs de connexion ;
- **Système** — schéma de base, dernière migration, dernière exécution du moteur d'alertes ;
- **Actualité à l'ouverture** — celle qui est affichée, avec un lien pour la modifier.

**Le KpiDashboard n'est pas modifié** : il reste l'accueil du Président et du Chef de commission.

### 4.4 L6-F3 — Annuaire *(L, dépend de B2 et F4)*

Écran neuf `features/admin/annuaire-admin.ts`, cible de `/admin/comptes` à la place de `SectionHome`.
Reprend la maquette C : recherche, filtres (profil, localité, statut, connexion), liste à gauche,
fiche à droite. La fiche réunit **accès**, **place dans l'organisation** (supérieur, chaîne de
contrôle, délégation, mandat) et **activité**, et porte les quatre actions.

Les 8 écrans jusque-là cachés derrière le sommaire deviennent les destinations des actions de la
fiche (« Modifier la fiche » → `prmp-admin`, « Changer de chaîne » → `chaines-controle`, « Pièces »
→ `prmp-pieces-admin`…). **Aucun n'est supprimé ni réécrit dans ce lot.**

### 4.5 L6-F5 — Journal : onglet « Connexions » *(S, dépend de B4)*

`audit-logs-admin.ts` gagne deux onglets : **Actions** (l'existant, inchangé) et **Connexions**
(neuf, en lecture seule — matricule, connexion, déconnexion, durée, IP, poste, succès ou échec).

La route `/admin/sessions` et sa configuration `SECURITE` de `admin-resources.config.ts` sont
**retirées** : un CRUD éditable sur un journal de preuve n'a pas de raison d'exister, et celui-ci
portait une table que rien n'alimentait.

### 4.6 L6-Q1 — Recette *(M)*

- les 12 entrées à 1366×768 et 1229×691, clavier et lecteur d'écran ;
- l'accueil avec des données réelles **et** à zéro (un poste neuf) ;
- l'annuaire sur les quatre catégories de personnes (contrôleur, PRMP, UGPM, compte sans personne) ;
- les quatre actions, dont le refus de se suspendre soi-même ;
- contrastes AA sur tout ce qui est neuf, méthode du lot 5.

Preuves en **captures légendées à 1366×768**, conservées dans `recette-refonte/captures-admin/`.

---

## 5. Ce que ce lot ne fait pas

- il ne réécrit **aucun** des 22 écrans de référentiel ni des 8 écrans de comptes ;
- il ne touche pas au `CrudPage` générique ;
- il ne traite pas le repère de focus hors coquille ni les glyphes détournés hors `layout/`
  (lots à part, laissés ouverts par le L5) ;
- il ne tranche pas le sort des 158 endpoints orphelins.

---

## 6. Honnêteté des chiffres dessinés

Trois mesures des maquettes **ne sont pas calculables aujourd'hui** :

| Mesure | Maquette | Source nécessaire |
|---|---|---|
| Échecs de connexion (24 h) | A, tuile et bloc « À surveiller » | B4 |
| Dernière connexion, échecs sur 30 j | C, bloc « Accès » de la fiche | B4 |
| Sessions ouvertes | A, tuile | B4 |

Tant que B4 n'est pas livré, **ces trois tuiles ne sont pas affichées** — pas affichées à zéro, pas
affichées avec un tiret : absentes. Une mesure fausse sur un tableau de bord de sécurité est pire
qu'une mesure absente.

---

## 7. Décisions attendues de Mathieu

1. **« PPM & marchés » et « Marchés & dates prév. » hors du menu Administrateur** — proposé au §3,
   réversible. *(à confirmer)*
2. **Alimenter `t_session_utilisateur`** plutôt que de retirer l'exclusion d'`/api/auth/**` du journal
   d'audit — motivé dans la demande backend, §B4. *(à confirmer)*
3. **L'annuaire couvre-t-il les UGPM ?** Elles ont un compte mais ne sont pas des contrôleurs ;
   les inclure élargit B2. *(proposé : oui — l'administrateur cherche « une personne », pas « un
   contrôleur »)*
