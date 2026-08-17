# Audit technique — frontendprs2 (CNM PRS 2.0)

> **Date** : 16 août 2026 · **Périmètre** : frontend Angular (`src/`, configuration, dépendances) · **Méthode** : lecture systématique du code (138 fichiers TS, ~38 000 lignes), build de production mesuré, `npm audit`, vérification manuelle de chaque constat majeur (fichier:ligne).
>
> **Suivi des corrections (16/08/2026)** — appliquées et vérifiées le jour même :
> `787ec4a` S1/S11 (secrets détrackés + .gitignore) · `62a26f7` D1 (Angular 22.1.x, npm audit = 0) ·
> `816ced8` S2/S3-timer/S4/S5/S7/S13 (blobs sûrs, validation uploads, expiration, interceptor, échappement impression) ·
> `3e7fb0e` P2/P3/P7 (badges 30 s, poll conditionnel, doublons) · `9ff24e9` A1 partiel/A5/A6 (directive appModale sur 27 dialogues, noms accessibles, cloche) ·
> `f8dca39` P4/P11 (112 routes en loadComponent, preload, budget anyScript — plus gros chunk lazy 200 → 69 kB).
> `fad4ca7` P2 **clos** (badges par `GET /api/kpis/badges` — un appel, throttle supprimé, badge « à dispatcher » gagné par le CC) et P1 **outillé** (`CrudService.listePage`, filtres combinables) après la livraison backend `c16407f`, qui a aussi clos **S6** (CSP, `nosniff`, `X-Frame-Options` vérifiés en live) et la garde serveur de **S2** (`Content-Type` des pièces).
> `b350579` **S8 clos** (polices auto-hébergées, 119 Ko, zéro appel Google — vérifié), **P8 clos** (logo 238 → 120 Ko + dimensions), **T2 clos** (CI : tests, build, `npm audit` bloquant à « high ») et **A7 clos** (champs du login nommés, erreurs reliées).
> `a3735ff` **A4 clos** (pièces de l'examen ouvrables au clavier) et **A3 clos** (11/11 champs de la grille PPM nommés, 14/14 en-têtes avec `scope`).
> `b85abbf` **P5/P6 traités — avec réserve** : contrôles mémoïsés (WeakMap), entrées de composants rendues stables (`sublabels`, `benefsOf`/`previsionsOf`). ⚠️ **Le diagnostic P5 surestimait l'impact** : mesuré au Chrome DevTools Protocol sur une grille de 40 lignes, l'écart est dans le bruit (30 ajouts de ligne : 210 → 194 ms ; frappe : 1,50 → 1,44 ms). En **zoneless + OnPush**, la frappe dans un formulaire réactif ne déclenche pas le cycle complet supposé. À retenir pour les prochains audits de ce dépôt : chiffrer avant d'optimiser.
> `414b922` **A5 clos** (45 indicateurs annoncés, navigation annoncée + titre du document), **A6 partiellement clos** (lien d'évitement ; restent les `scope` des tables hors grille PPM) et **P9 traité** (composant `<app-etat-erreur>` avec « Réessayer », branché sur le pipeline et « Mes dossiers » PRMP — à étendre aux autres listes au fil de l'eau).
> `1216458` **A2 clos** : palette de texte re-basée au minimum nécessaire (n-500 → #586586 à 5,52:1, n-400 → #667299 à 4,51:1, placeholders conformes), hiérarchie et teintes préservées. Mesuré sur le DOM du tableau de bord Président : **114 textes sous le seuil AA avant, 17 après** — les restants relèvent des tokens sémantiques (badges 10 px) et des boutons secondaires, pas de la palette neutre.
> **S3 clos (phase 2 du plan cookie, 2026-08-17)** : le JWT n'est **plus jamais stocké** côté front — session portée par le cookie `HttpOnly; Secure; SameSite=Strict` posé par le backend (phase 1), interceptor `Authorization` supprimé (XSRF automatique d'`HttpClient`), SSE par cookie, `POST /api/auth/logout`, purge à la volée du jeton des sessions antérieures. Le `localStorage` ne garde que le profil d'affichage (non secret) et l'échéance.
> **Recette de la phase 2 exécutée en réel (17/08)** : connexion ✓ ; jeton introuvable côté client (ni `localStorage`, ni `sessionStorage`, ni `document.cookie`) ✓ ; **aucun en-tête `Authorization` émis** ✓ ; mutation métier acceptée avec `X-XSRF-TOKEN` posé automatiquement par Angular (`POST /notifications/lire-tout` → 200) ✓ ; session conservée au rechargement (F5) ✓ ; flux SSE authentifié par cookie, stable ✓ ; déconnexion → cookie vidé et écran protégé redirigé vers le login ✓. Le backend tourne déjà en **mode exclusif** (`token: null` dans le corps du login).
> **Plan cookie TERMINÉ (17/08)** — phases 0 et 2 côté front (`7a252af`, `7cbaf14`), 1 et 3 côté backend (`21ef41e`, `63a6e28`). Le mode **exclusif** est actif : le jeton n'existe plus nulle part côté client, ni stocké ni dans le corps des réponses. Recette rejouée après le flip : 7/7 points, puis parcours métier vérifié sur les **6 profils** (PRMP, Secrétaire, CC, Membre, Vérificateur, Administrateur) — aucun 401/403. ⚠️ Conséquence à connaître : **aucun client non-navigateur ne peut plus obtenir de jeton** (`/api/auth/login` renvoie `token: null`) — tout harnais externe en `Authorization: Bearer` doit passer au cookie. Phase 4 (préfixe `__Host-`, refresh glissant, révocation) laissée ouverte, non exigée par l'audit.
> Restent ouverts : P1 (adoption écran par écran des pages), A2b (badges sémantiques et boutons secondaires, 17 textes), A6 (scope des tables restantes), S9 (choix produit : persistance des interrupteurs de délégation conservée), T1/T3 (couverture, e2e versionnés).

## Sommaire

- [1. Résumé exécutif](#1-résumé-exécutif)
- [2. Contexte technique](#2-contexte-technique)
- [3. Tableau des problèmes](#3-tableau-des-problèmes)
- [4. Performance / fluidité](#4-performance--fluidité)
- [5. Sécurité](#5-sécurité)
- [6. Vulnérabilités des dépendances (npm audit)](#6-vulnérabilités-des-dépendances-npm-audit)
- [7. Accessibilité](#7-accessibilité)
- [8. Tests automatisés](#8-tests-automatisés)
- [9. Recommandations avec exemples corrigés](#9-recommandations-avec-exemples-corrigés)
- [10. Plan d'action priorisé](#10-plan-daction-priorisé)

---

## 1. Résumé exécutif

| Dimension | Score | Lecture |
|---|:---:|---|
| **Fluidité / performance** | **6 / 10** | Fondations excellentes (zoneless, OnPush 69/70, bundle initial 345 kB, dépendances minimales) ; pénalisée par le volume réseau (pas de pagination, listes rechargées à chaque navigation, aucun cache) et l'absence de lazy loading *à l'intérieur* des features. |
| **Sécurité** | **4 / 10** | Discipline du code saine (aucun `innerHTML`, interpolation partout, API centralisée, guards systématiques, quasi zéro log) ; plombée par un **secret dans un fichier suivi par git**, un vecteur XSS réel via les blob-URLs de pièces jointes, le JWT en `localStorage` et l'absence de CSP et de déconnexion à l'expiration. |
| **Accessibilité** | **3 / 10** | Base ARIA présente (79 `aria-hidden`, 51 `aria-label`, landmarks corrects) mais les 29 modales sont inutilisables au clavier, la grille de saisie PPM n'a aucun label, et le **texte par défaut de l'application échoue au contraste AA**. |
| **Tests** | **3 / 10** | 42 tests bien ciblés (auth, permissions, workflow du circuit) mais 5 fichiers de spec pour 138 fichiers TS, aucune mesure de couverture, aucune CI, aucun e2e versionné. |

### Les 5 constats prioritaires

1. **[Critique — Sécurité]** Mot de passe PostgreSQL superuser en clair dans `.claude/settings.local.json` (lignes 24 et 26), **fichier suivi par git** et absent du `.gitignore`. Pas encore dans HEAD : un seul `git commit -a` le publierait.
2. **[Élevé — Sécurité]** Pièces jointes ouvertes en blob-URL *same-origin* sans forcer le type MIME (8 écrans, dont l'iframe de l'examen `examen-dossier.ts:904`), combiné à des uploads non validés côté front : un fichier HTML/SVG téléversé peut exécuter du script dans l'origine de l'application et lire le JWT stocké en `localStorage`.
3. **[Critique — Performance]** Aucune pagination (`CrudService.list()` sans paramètre) et rechargement de listes complètes à **chaque clic de menu** pour alimenter des badges (`main-layout.ts:238-251` + `314-321`), répliqué sur 4 rôles.
4. **[Critique — Accessibilité]** 29 modales sans piège de focus, sans Échap (1 seule sur 29), sans restitution du focus — dont 7 fermables *uniquement* au clic sur l'arrière-plan ; et couleur de texte par défaut `#6b7a9e` sur `#f8f9fe` ≈ 4,07:1 (< 4,5:1 AA) à 12,5 px.
5. **[Élevé — Dépendances]** 21 vulnérabilités npm (1 critique, 14 élevées) — toutes corrigeables par la montée `22.0.1 → 22.1.x` (`ng update`), quasi toutes dans la chaîne de build (dev).

---

## 2. Contexte technique

| Élément | Valeur |
|---|---|
| Type | SPA web (interface du système de contrôle des marchés publics CNM) |
| Framework | **Angular 22.0.1**, architecture 100 % standalone, **zoneless** (pas de zone.js), signals |
| Langage / styles | TypeScript 6.0.3 strict · SCSS (design system maison `src/styles/`) |
| Backend | API REST Spring Boot (`PRS20`) — `http://localhost:8080/api` en dev, `/api` relatif en prod |
| Gestionnaire de paquets | **npm** 11.13.0 (`packageManager` épinglé) |
| Dépendances runtime | 8 seulement : Angular + `rxjs` + `tslib` — aucune librairie tierce lourde |
| Test runner | Vitest (via `@angular/build:unit-test`) + jsdom |
| Services tiers | **Google Fonts** (seul appel externe du front) |
| Base de données | Aucune côté front ; PostgreSQL côté backend (hors périmètre) |
| CI/CD | **Absente** (pas de `.github/workflows`, ni GitLab CI, ni Jenkins) |
| Config sensible | `src/environments/environment{,.prod}.ts` (URL API uniquement — sains) ; ⚠️ `.claude/settings.local.json` **suivi par git** avec secrets (§5.1) |

Build de production mesuré (16/08/2026) : **initial 345 kB bruts / 90 kB transférés**, 37 chunks lazy (1 par espace de rôle : `prmp-routes` 200 kB, `admin-routes` 134 kB…). Un seul dépassement de budget : `detail-ppm-modal.scss` 8,36 kB (> 8 kB).

---

## 3. Tableau des problèmes

Criticité : 🔴 Critique · 🟠 Élevé · 🟡 Moyen · ⚪ Faible

| # | Fichier / ligne | Problème | Catégorie | Criticité | Impact |
|---|---|---|---|:---:|---|
| S1 | `.claude/settings.local.json:24,26` | `PGPASSWORD='«expurgé»'` (superuser) et `DB_PASSWORD` en clair dans un fichier **suivi par git** | Sécurité | 🔴 | Publication de l'accès BDD au prochain `commit -a` |
| S2 | `examen-dossier.ts:904` + 7 autres écrans | Blob-URLs same-origin sans type MIME forcé (iframe/`window.open`) | Sécurité | 🟠 | XSS → vol du JWT si pièce HTML/SVG téléversée |
| S3 | `auth.service.ts:25,72,157-164` | JWT + identité en `localStorage`, persistant par défaut | Sécurité | 🟠 | Toute XSS = vol de session ; jeton sur disque |
| S4 | `soumettre-dossier.ts:1701`, `detail-ppm-modal.ts:1090`, `completer-pieces-depot-modal.ts:157`, `lettre-renvoi-consultation.ts:366` | Uploads sans validation de type/taille (attribut `accept` seul) | Sécurité | 🟡 | Vecteur d'entrée du risque S2 |
| S5 | `auth.service.ts:60-63` | `isAuthenticated` mémoïsé sur `session()` seul (`Date.now()` non réactif) → pas de déconnexion à l'expiration | Sécurité | 🟡 | Session « ouverte » à l'écran jusqu'au premier 401 |
| S6 | `index.html:1-19` | Aucune CSP, aucun header de sécurité déclaré | Sécurité | 🟡 | Pas de défense en profondeur contre S2 |
| S7 | `pv-page.ts:506-555` | `document.write` avec interpolations brutes (`${titre}`) dans une fenêtre same-origin | Sécurité | 🟡 | XSS si référence hostile |
| S8 | `index.html:9-14` | Google Fonts (11 fichiers de police) : tiers sur le chemin critique + transfert d'IP hors UE | Sécurité/RGPD/Perf | 🟡 | Contentieux RGPD établi ; render-blocking |
| S9 | `permissions.service.ts:130` + `auth.service.ts:149-153` | `logout()` ne purge pas `cnm.delegations-exercees.<matricule>` | RGPD | 🟡 | Rémanence d'identité sur poste partagé |
| S10 | `docs/api-endpoints.md:293,313,508,2962` | Identifiants de démo réels committés | Sécurité | 🟡 | Comptes valides exposés dans le dépôt |
| S11 | `.gitignore` | `screenshots/` et `output/` non ignorés (captures avec noms/matricules) | RGPD | 🟡 | Commit accidentel de données personnelles |
| S12 | `notifications.store.ts:73-98` | SSE en `fetch` brut hors interceptors : un 401 reboucle toutes les 5 s sans déconnecter | Sécurité | ⚪ | Session zombie côté flux |
| S13 | `auth.interceptor.ts:16` | Exclusion d'auth par `includes('/auth/')` (sous-chaîne, pas préfixe) | Sécurité | ⚪ | Perte silencieuse du Bearer sur routes futures |
| P1 | `crud.service.ts:34-36` + `dossiers-liste.ts:246-252` | Aucune pagination : téléchargement de tables entières puis filtre client | Performance | 🔴 | Temps/mémoire linéaires avec la base — risque de scalabilité n°1 |
| P2 | `main-layout.ts:238-251, 314-321` (×4 rôles) | `forkJoin` de listes complètes rejoué à chaque `NavigationEnd` pour lire des `.length` | Performance | 🔴 | Coût réseau dominant, payé à chaque clic de menu |
| P3 | `notifications.store.ts:51-59,107-110` | `revision` bumpé à chaque poll de 60 s (même sans changement) + polling permanent en parallèle du SSE, sans test de visibilité | Performance | 🟠 | La page notifications recharge sa liste complète toutes les 60 s |
| P4 | 9 fichiers `features/*/*.routes.ts` | 112 `component:` statiques, 0 `loadComponent` → chaque rôle télécharge tous ses écrans | Performance | 🟠 | TTI dégradé (chunk PRMP 200 kB dont écrans jamais ouverts) |
| P5 | `ppm-saisie-grid.ts:107-143,466-494` | ~20 appels de fonction par cellule en double boucle ; `marcheControls()` retourne un tableau neuf à chaque appel | Performance | 🟠 | Lag perceptible à la frappe sur l'écran de saisie principal |
| P6 | `dossiers-pipeline.ts:84,230` | `sublabels(d)` retourne un objet neuf par cycle (OnPush enfant neutralisé) ; pagination factice (`visibleDossiers` = tout) | Performance | 🟠 | Re-rendus systématiques + DOM complet |
| P7 | `dossiers-liste.ts:223-237`, `mes-brouillons.ts:175-178` | Double chargement au montage (`paramMap` + `effect`) → 6 requêtes au lieu de 3 | Performance | 🟠 | Requêtes doublées sur chaque liste PRMP |
| P8 | `public/mef-logo.png` + `login.html:36` | Logo 243 Ko en PNG, sans dimensions ni format moderne | Performance | 🟠 | Plus gros asset, servi sur l'écran d'entrée |
| P9 | 49 occurrences (`error: () => loading.set(false)`) + 32 `error: () => {}` | Erreurs réseau → écran vide indistinguable de « aucun résultat », sans bouton Réessayer | Performance/UX | 🟠 | Utilisateur perdu après le toast éphémère |
| P10 | `verifier-dossier.ts:100` + 16 autres | `track $index` sur listes rechargées du serveur | Performance | 🟡 | Re-rendu intégral au moindre ajout |
| P11 | `angular.json:41-52` | Aucun budget sur les chunks lazy ; skeletons sur 3 écrans / 49 | Performance | 🟡 | Dérives de taille invisibles |
| A1 | 29 modales (`detail-ppm-modal.ts`, `dispatch-form.ts`…) | 0 piège de focus, Échap sur 1/29, 0 restitution du focus, 7 modales fermables uniquement au clic backdrop | Accessibilité | 🔴 | Blocage fonctionnel complet au clavier |
| A2 | `_design-system.scss:117-120` (+105 usages `--n-400`, placeholders `--n-300`) | Texte par défaut 4,07:1, texte secondaire 2,25:1, placeholders 1,43:1 (AA = 4,5:1) — à 9-12,5 px | Accessibilité | 🔴 | Lisibilité insuffisante pour toute l'application |
| A3 | `ppm-saisie-grid.ts:85-142` | Grille de saisie sans aucun label/`aria-label` (3 champs sans même un placeholder), en-têtes `rowspan/colspan` sans `scope` | Accessibilité | 🔴 | Écran métier central inexploitable au lecteur d'écran |
| A4 | `examen-dossier.ts:127,147` ; `pv-assistant.ts:48` | Accordéon de pièces et ligne de tableau en `div/tr (click)` sans rôle/tabindex/clavier | Accessibilité | 🔴 | Le Membre ne peut ouvrir aucune pièce au clavier |
| A5 | `notification-center.ts:30-32` + 66 « Chargement… » muets | 1 seul `aria-live` (toasts) ; badge de non-lues écrasé par l'`aria-label` statique ; navigations silencieuses | Accessibilité | 🟠 | Changements d'état jamais annoncés |
| A6 | 28 dialogs / 7 boutons ✕ / 200 `<th>` | `aria-labelledby` manquant, boutons symbole sans nom, aucun `scope`/`caption` | Accessibilité | 🟠 | Corrections mécaniques, non faites |
| A7 | `login.html:43-54` | Champs de connexion nommés par le seul placeholder (label vide) | Accessibilité | 🟠 | Première page de l'application |
| T1 | `src/**` | 5 specs / 138 fichiers TS ; services HTTP, interceptors, `pv-workflow`, `ppm-form-factory` non testés | Tests | 🟠 | Régressions invisibles sur la logique métier |
| T2 | — | Aucune CI (tests jamais exécutés automatiquement), aucune config de couverture | Tests | 🟠 | Les 42 tests existants peuvent casser silencieusement |
| T3 | — | E2E Playwright existants mais non versionnés (scripts hors dépôt) | Tests | 🟡 | Connaissance de test perdue |
| D1 | `package.json` | 21 vulnérabilités npm (1 critique, 14 élevées, 2 modérées, 4 faibles) — toutes `fixAvailable` | Dépendances | 🟠 | Corrigées par `ng update` vers 22.1.x |

---

## 4. Performance / fluidité

### 4.1 Ce qui est déjà très bon (à préserver)

- **Zoneless + OnPush sur 69 composants / 70** (seul `app.ts` — shell racine — l'omet, impact nul).
- **Lazy loading par rôle** : `app.routes.ts` est exemplaire (15 `loadComponent`/`loadChildren`, 0 import direct). Bundle initial mesuré : **345 kB / 90 kB transférés** — très en dessous du budget.
- **Parallélisation** : 82 `forkJoin` contre 15 opérateurs séquentiels — pas de cascades.
- **`takeUntilDestroyed()` systématique** sur les abonnements longue durée (`main-layout.ts:179-281`…), zéro `addEventListener` orphelin, flux SSE coupé par `AbortController`.
- **8 dépendances runtime** — rien à élaguer.

### 4.2 P1 — Aucune pagination

[src/app/services/api/crud.service.ts:34](src/app/services/api/crud.service.ts#L34)
```ts
list(): Observable<T[]> { return this.http.get<T[]>(this.baseUrl); }
```
Aucun paramètre de pagination ; 2 seules occurrences paginées dans tout le projet (`circuit.services.ts:69,80`). Les listes téléchargent la table entière puis filtrent côté client ([dossiers-liste.ts:246-252](src/app/features/prmp/dossiers-liste.ts#L246)) :
```ts
this.dossierService.list(brouillon ? 'BROUILLON' : undefined).subscribe({
  next: (rows) => { this.dossiers.set(rows.filter((d) => d.idTypeDossier === type && ...)); }
```
Le pager de [dossiers-pipeline.ts:230](src/app/features/circuit/dossiers-pipeline.ts#L230) est factice pour la majorité des sources : `readonly visibleDossiers = computed(() => this.dossiers());` — le DOM rend tout. `dispatchs-controleurs.ts:303-311` fait un `forkJoin` de **7 listes complètes** pour une statistique.

### 4.3 P2 — Listes complètes rechargées à chaque navigation (badges)

[main-layout.ts:238-246](src/app/layout/main-layout/main-layout.ts#L238) rejoue à chaque `NavigationEnd` un `forkJoin` de 5 endpoints ([lignes 314-321](src/app/layout/main-layout/main-layout.ts#L314)) — `list('BROUILLON')`, `ppmService.list()`, `list('CLOTURE')`, lettres, compteurs — **uniquement pour lire des `.length`**. Répliqué pour Secrétaire (l.221), Vérificateur (l.258) et Président (l.291). Chaque clic de menu retélécharge ces tables.

### 4.4 P3 — Poll de notifications : rechargements fantômes

[notifications.store.ts:51-59](src/app/core/notifications/notifications.store.ts#L51) : `refresh()` incrémente `revision` **inconditionnellement** ; le `setInterval` de 60 s (l.109) tourne **en parallèle** du flux SSE (au lieu d'être un repli) et sans test de `visibilityState`. Conséquence, via l'`effect` de `notifications-page.ts:179-181` : la page notifications **recharge sa liste complète toutes les 60 s**, onglet caché compris. À noter aussi : détection d'événement par `chunk.includes('maj')` (fragile en frontière de buffer) et `setTimeout` de reconnexion non annulable (l.92-98).

### 4.5 P4 — Le lazy loading s'arrête à la porte des features

Les 9 fichiers `features/*/*.routes.ts` totalisent **112 `component:` avec imports statiques et 0 `loadComponent`** ([prmp.routes.ts:4-21](src/app/features/prmp/prmp.routes.ts#L4) : 20 imports, dont `SoumettreDossier` 2 024 lignes et, transitivement, `detail-ppm-modal.ts` 1 823 lignes). Un PRMP qui ouvre son tableau de bord parse tous les écrans de son espace.

### 4.6 P5/P6 — Templates chauds

- [ppm-saisie-grid.ts:107-143](src/app/shared/prmp/ppm-saisie-grid.ts#L107) : double boucle marchés × bénéficiaires avec ~20 appels de méthode par cellule (`ctrl(g,…)`, `bctrl(b,…)`, `estChampModifie(g,…)`, `rowspanBenef(g)`) et `marcheControls()` / `beneficiairesControls(g)` qui **retournent un tableau neuf à chaque appel** — des milliers d'invocations par cycle sur une grande grille, lag perceptible à la frappe.
- [dossiers-pipeline.ts:84](src/app/features/circuit/dossiers-pipeline.ts#L84) : `[sublabels]="sublabels(d)"` retourne un objet neuf par cycle → l'OnPush de `app-circuit-timeline` est neutralisé pour chaque ligne. Même motif `previsionsOf()` ([prmp-marches-previsions.ts:54](src/app/features/prmp/prmp-marches-previsions.ts#L54)).
- 17 `track $index` sur listes serveur, le pire : [verifier-dossier.ts:100](src/app/features/verificateur/verifier-dossier.ts#L100) (fil d'échanges rechargé).

### 4.7 P7-P9 — Divers réseau/UX

- **Double chargement au montage** ([dossiers-liste.ts:223-237](src/app/features/prmp/dossiers-liste.ts#L223)) : `paramMap` émet à l'abonnement **et** l'`effect` s'exécute au premier cycle → `charger()` ×2 → 6 requêtes au lieu de 3. Idem `mes-brouillons.ts:175-178`.
- **Logo de connexion 243 Ko** (`public/mef-logo.png`), sans `width`/`height` (CLS), pas de `NgOptimizedImage` (0 `ngSrc` dans le projet).
- **Google Fonts** : 11 fichiers de police, `<link rel="stylesheet">` render-blocking.
- **États d'erreur** : 49 × `error: () => loading.set(false)` (écran vide) et 32 × `error: () => {}` (échec silencieux, compteurs figés). Le toast centralisé de `error.interceptor.ts` est éphémère — pas de « Réessayer » dans le corps des listes. Skeletons sur 3 écrans / 49.

---

## 5. Sécurité

### 5.1 🔴 S1 — Secret BDD dans un fichier suivi par git (vérifié)

`.claude/settings.local.json` lignes 24 et 26 contiennent `$env:PGPASSWORD='«expurgé»'` (compte `postgres`, base `DBPRS20`) et `$env:DB_PASSWORD='«expurgé»'` — valeurs masquées dans ce rapport. Vérifications effectuées : `git ls-files` **liste le fichier** (il est suivi), le `.gitignore` n'exclut rien sous `.claude/`, et `git show HEAD:… | grep PGPASSWORD` → 0 (pas encore publié). Le fichier est en état modifié : **un `git commit -a` + push publierait le mot de passe superuser**.

**Correctif immédiat** :
```bash
git rm --cached .claude/settings.local.json
echo ".claude/settings.local.json" >> .gitignore
# puis ROTATION du mot de passe postgres (il est déjà écrit sur disque dans un dépôt)
```

### 5.2 🟠 S2 — Blob-URLs same-origin sans type MIME forcé

Une URL `blob:` hérite de l'origine du document créateur : si le backend restitue une pièce téléversée avec `Content-Type: text/html` ou `image/svg+xml`, le document s'exécute **dans l'origine de l'application** avec accès au `localStorage` (donc au JWT, cf. S3). 8 écrans concernés, le plus exposé étant l'iframe de l'examen ([examen-dossier.ts:904-905](src/app/features/membre/examen-dossier.ts#L904), pièce téléversée par la PRMP, ouverte par le Membre) :
```ts
this.currentObjectUrl = URL.createObjectURL(blob);
this.openUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(this.currentObjectUrl));
```
Également : `detail-ppm-modal.ts:1182`, `prmp-pieces-admin.ts:164`, `ugpm-pieces-admin.ts:158`, `controleur-admin.ts:436`, `reception-form.ts:332`, `dossier-consultation.ts:558`, `lettre-renvoi-consultation.ts:340`, `detail-pv-modal.ts:438`, `pv-definitifs.ts:264`. Un seul écran filtre correctement le type : `inscriptions-admin.ts:226-229` — c'est le motif à généraliser. Le risque est amplifié par les **uploads non validés** (S4) : `soumettre-dossier.ts:1701-1712`, `detail-ppm-modal.ts:1090-1092`, `completer-pieces-depot-modal.ts:157-160`, `lettre-renvoi-consultation.ts:366-368` n'imposent ni type ni taille (seul l'attribut `accept`, trivialement contournable), alors que les écrans admin valident bien (`prmp-pieces-admin.ts:123-134`).

### 5.3 🟠 S3 / 🟡 S5 — Session : stockage et expiration

- JWT + identité complète (`nomAffichage`, `login`, matricule, localité, rôle) dans `localStorage` sous `cnm.session`, **persistant par défaut** (`authenticate(credentials, remember = true)`, [auth.service.ts:72](src/app/core/auth/auth.service.ts#L72)). Toute XSS devient un vol de session ; le jeton survit à la fermeture du navigateur.
- **Pas de déconnexion à l'expiration** (vérifié) — [auth.service.ts:60-63](src/app/core/auth/auth.service.ts#L60) :
```ts
readonly isAuthenticated = computed(() => {
  const s = this.session();
  return !!s && Date.now() < s.expiresAt;   // Date.now() n'est pas réactif :
});                                          // mémoïsé sur session() seul → reste true
```
Aucun timer de purge, pas de lecture de la claim `exp`, pas de refresh. L'expiration n'est réévaluée qu'au démarrage (`restore()`). Le 401 est, lui, bien traité (`error.interceptor.ts:30-35` : purge + redirection `/login`) — sauf pour le flux SSE (S12) qui reboucle toutes les 5 s sans déconnecter.

### 5.4 🟡 S6-S8 — Défense en profondeur absente

- **Aucune CSP** ni header de sécurité déclaré (`index.html`) — une CSP `default-src 'self'; object-src 'none'` neutraliserait S2/S7 en profondeur (idéalement posée en en-tête serveur, avec `X-Content-Type-Options: nosniff`, `X-Frame-Options`/`frame-ancestors`).
- **`document.write` interpolé** ([pv-page.ts:506-555](src/app/features/membre/pv-page.ts#L506)) : `${titre}` (référence serveur) injecté brut dans une fenêtre `about:blank` same-origin.
- **Google Fonts** : dépendance tierce sans SRI + transfert de l'IP de chaque agent vers Google (jurisprudence RGPD défavorable pour un SI public) → auto-héberger.

### 5.5 🟡 RGPD (S9-S11)

- `logout()` ([auth.service.ts:149-153](src/app/core/auth/auth.service.ts#L149)) ne purge que `cnm.session` : la clé `cnm.delegations-exercees.<MATRICULE>` **survit à la déconnexion** et révèle l'identité du dernier utilisateur du poste.
- Identifiants de démonstration réels committés dans `docs/api-endpoints.md:293,313,508,2962` (+ un JWT d'exemple tronqué l.297).
- `screenshots/` et `output/` (captures d'écrans avec noms/matricules, présentations) ne sont **ni ignorés ni suivis** → risque de commit accidentel. À ajouter au `.gitignore`.
- Bon point : **une seule** occurrence `console.*` dans tout `src/` (`main.ts:6`, erreur de bootstrap), aucune télémétrie, aucun tracker.

### 5.6 Ce qui est déjà bien

Aucun `[innerHTML]`/`bypassSecurityTrustHtml` ; toasts/alertes par interpolation ; URL d'API centralisée (`environment.apiUrl`, `/api` relatif en prod) ; guards par rôle systématiques sur les 9 espaces avec doctrine explicite « le backend applique réellement le RBAC » ; `HttpParams`/`encodeURIComponent` partout (pas de concaténation d'URL) ; formulaires d'inscription/comptes avec `Validators` (email, minLength 8).

---

## 6. Vulnérabilités des dépendances (npm audit)

`npm audit --json` du 16/08/2026 — synthèse brute :

```json
"metadata": {
  "vulnerabilities": { "info": 0, "low": 4, "moderate": 2, "high": 14, "critical": 1, "total": 21 },
  "dependencies": { "prod": 11, "dev": 562, "optional": 135, "total": 572 }
}
```

| Package | Sévérité | Avis (titre abrégé) | Portée | Correction |
|---|---|---|---|---|
| `tar` | **Critique** | Decompression DoS via unlimited input (+4 autres avis) | dev (CLI) | `fixAvailable` |
| `@angular/common` 22.0.1 | Élevée | GHSA-jhpw-976m-542j — HttpTransferCache cache-key ambiguity | **prod** (inopérant ici : pas de SSR/hydratation, mais à corriger) | `>= 22.0.2` |
| `@angular/build`, `@angular/forms`, `@angular/platform-browser`, `@angular/router`, `@angular/compiler-cli` | Élevée/Faible | Transitives de `@angular/common`/`@babel/core`/`esbuild`/`vite`/`piscina` | dev/prod | 22.1.x |
| `piscina` | Élevée | Prototype pollution → RCE (CVSS 8.1) | dev (build) | `fixAvailable` |
| `brace-expansion`, `fast-uri`, `immutable`, `ip-address`, `nanoid`, `postcss`, `undici`, `vite` | Élevée | DoS/host-confusion/path-traversal divers | dev | `fixAvailable` |
| `hono`, `@hono/node-server` | Modérée | XSS JSX / path traversal (outillage) | dev | `fixAvailable` |
| `esbuild`, `body-parser`, `@babel/core` | Faible | Divers | dev | `fixAvailable` |

**Lecture** : 20 des 21 vulnérabilités sont dans la **chaîne de build** (devDependencies) — elles n'atteignent pas le bundle livré. La seule qui touche le runtime (`@angular/common`) concerne le cache de transfert SSR, non utilisé ici. Aucune n'est donc exploitable en production en l'état, mais tout se corrige d'un coup.

**Dépendances obsolètes** (`npm outdated`) : tout Angular `22.0.1 → 22.1.2/22.1.4` (mineur), `prettier 3.8.4 → 3.9.6`, `vitest 4.1.8 → 4.1.10` ; majeures en retard : `typescript 6.0.3` (7.0.2 disponible — attendre le support Angular), `jsdom 28 → 30`.

**Commandes de correction** :
```bash
ng update @angular/cli @angular/core   # monte tout l'écosystème Angular en 22.1.x
npm update                              # rattrape prettier/vitest/transitives
npm audit                               # contrôle final (attendu : 0)
```

---

## 7. Accessibilité

Maturité mesurée : 79 `aria-hidden`, 51 `aria-label`, 46 `role`, 29 `aria-modal`… mais **1 seul `aria-live`**, **2 `tabindex`**, **1 `keydown`**, **0 `scope`/`caption`**, **0 `<input id=>`**. `@angular/cdk` (et son `A11yModule`) absent.

### 7.1 🔴 A1 — Les modales (29) sont inutilisables au clavier

- **Nom accessible** : 28/29 dialogs sans `aria-labelledby` (le titre `<h2>` existe pourtant juste à côté — ex. [detail-ppm-modal.ts:50](src/app/shared/prmp/detail-ppm-modal.ts#L50), 7 dialogs dans ce seul fichier). Seule exception conforme : `toast-container.ts:48-51`.
- **Piège de focus** : 0/29 (`cdkTrapFocus` : 0 occurrence) — Tab s'échappe dans la page derrière le backdrop.
- **Échap** : 1/29 (`toast-container.ts:43`). **7 modales n'ont même pas de bouton ✕** : la seule sortie est le clic sur l'arrière-plan (`detail-ppm-modal.ts:423,462,491,577,598` ; `ppm-saisie-grid.ts:208,253` — dont les modales CAPM et Lots, sans même un `role`).
- **Restitution du focus** : 0/29.

### 7.2 🔴 A2 — Contraste : la palette échoue au niveau AA (vérifié)

[_design-system.scss:117-120](src/styles/_design-system.scss#L117) : le texte par défaut du `body` est `--n-500 #6b7a9e` sur `--n-50 #f8f9fe` ≈ **4,07:1** (< 4,5:1) à `--text-base` = **12,5 px**. `--n-400 #a0a8c0` (105 usages en couleur de texte) ≈ **2,25:1**, presque toujours à 10 px ; placeholders `--n-300 #d0d8e8` ≈ **1,43:1** — et le placeholder est le *seul* nom de champ sur le login et la grille PPM. Échelle typographique entière sous 12 px (`--text-xs` 10 px : 82 usages ; 2 occurrences à 9 px), tout en `px` (la préférence de taille du navigateur est ignorée).

### 7.3 🔴 A3/A4 — Écrans métier centraux

- **Grille PPM** ([ppm-saisie-grid.ts:119-142](src/app/shared/prmp/ppm-saisie-grid.ts#L119)) : ~13 champs × N lignes sans aucun label ni `aria-label`, 3 champs sans même un placeholder (`montEstim`, `financement`, `ancMontBenef`), en-tête à double niveau (`rowspan="2"`/`colspan="4"`) sans `scope` → « zone d'édition » ×13 au lecteur d'écran.
- **Accordéon des pièces de l'examen** ([examen-dossier.ts:127,147](src/app/features/membre/examen-dossier.ts#L127), vérifié) : `<div (click)="togglePiece(p)">` sans `role="button"`, `tabindex`, gestion clavier ni `aria-expanded` — le Membre ne peut ouvrir aucune pièce au clavier. Même motif `<tr (click)>` dans `pv-assistant.ts:48`.

### 7.4 🟠 A5-A7 — Annonces et nommage

- Badge de la cloche **écrasé** par `aria-label="Notifications"` statique ([notification-center.ts:30-32](src/app/layout/notification-center/notification-center.ts#L30)) ; 66 indicateurs « Chargement… » sans `aria-live`/`aria-busy` ; navigations SPA silencieuses (pas de `Title` par route).
- 7 boutons ✕ sans `aria-label` (`detail-ppm-modal.ts:70,402,562` ; `dossiers-a-rectifier.ts:180` ; `dossiers-liste.ts:114` ; `mes-brouillons.ts:100` ; `verifier-dossier.ts:235`) — 14 autres sont corrects : incohérence, pas absence de pattern.
- Login ([login.html:43-54](src/app/features/auth/login/login.html#L43)) : labels vides (icône seule), nom des champs porté par le placeholder ; messages d'erreur jamais liés (`aria-describedby` : 1 occurrence projet ; `aria-invalid` : 0).
- Pas de lien d'évitement (« Aller au contenu ») malgré une sidebar à 2 niveaux ; 36 tables sans `scope`/`caption` ; titres en `<div>`/`<span>` dans les modales.

### 7.5 Ce qui est déjà bien

Landmarks corrects et uniques (`aside`/`nav aria-label`/`header`/`main` — `main-layout.html`), 12/12 images avec `alt`, 6/6 iframes avec `title`, icônes de la navigation masquées (`aria-hidden`), `aria-expanded`/`aria-pressed` sur les groupes de menu et bascules de délégation, règle globale `:focus-visible` saine (`_design-system.scss:143-149`), toasts en vraie région live.

---

## 8. Tests automatisés

| Spec | Tests | Contenu |
|---|:---:|---|
| `src/app/app.spec.ts` | 1 | Smoke test du shell |
| `src/app/core/auth/auth.guard.spec.ts` | 5 | `authGuard` + `roleGuard` (redirections, rôles) |
| `src/app/core/auth/auth.service.spec.ts` | 5 | Login/persistance/restauration |
| `src/app/core/auth/permissions.service.spec.ts` | 17 | Titulaires, délégation par table, opt-in « exercées » |
| `src/app/shared/circuit/circuit-workflow.spec.ts` | 14 | Machine d'états du circuit |
| **Total** | **42** | |

- **Qualité** : bonne — ce sont des tests de comportement (cas limites de délégation, transitions du workflow), pas des « should create ». Le ciblage est juste : auth + permissions + workflow sont les bons endroits.
- **Couverture** : 5 fichiers de spec pour 138 fichiers TS (~4 % des fichiers). **Aucune config de couverture** (ni dans `angular.json` ni en script). Runner : Vitest via `@angular/build:unit-test` + jsdom.
- **Trous critiques** : les 20+ services HTTP (`src/app/services/`), les interceptors (`auth.interceptor`, `error.interceptor` — pourtant porteurs de la logique 401), `pv-workflow.ts` (signatures/co-signatures), `ppm-form-factory.ts` (source unique des imports PDF), `dossiers-classement.ts` (files par rôle) : **0 test**.
- **CI/CD : absente.** Aucun workflow — les 42 tests existants ne sont exécutés que manuellement.
- **E2E : non versionnés.** Des scénarios Playwright complets existent (utilisés pendant le développement) mais vivent hors du dépôt — la connaissance de test se perd.

---

## 9. Recommandations avec exemples corrigés

### 9.1 Neutraliser le vecteur blob (S2) — un helper unique

```ts
// shared/fichiers/blob-surs.ts
const TYPES_AFFICHABLES = ['application/pdf', 'image/jpeg', 'image/png'];

/** Force un type MIME sûr : un HTML/SVG téléversé ne peut plus s'exécuter dans l'origine. */
export function urlBlobSure(blob: Blob): string {
  const type = TYPES_AFFICHABLES.includes(blob.type) ? blob.type : 'application/pdf';
  return URL.createObjectURL(new Blob([blob], { type }));
}
```
Remplacer les 10 `URL.createObjectURL(blob)` par `urlBlobSure(blob)`. Compléter côté serveur (`Content-Type` liste blanche + `X-Content-Type-Options: nosniff`) et à l'upload (mêmes contrôles type/taille que `prmp-pieces-admin.ts:123-134`, à mutualiser).

### 9.2 Déconnexion à l'expiration (S5)

```ts
// auth.service.ts — à la persistance et à la restauration :
private armerExpiration(expiresAt: number): void {
  clearTimeout(this.expirationTimer);
  this.expirationTimer = setTimeout(() => this.logout(), Math.max(0, expiresAt - Date.now()));
}
```
(Et à terme : cookie `HttpOnly; Secure; SameSite=Strict` posé par le backend plutôt que `localStorage` ; à défaut, `remember = false` par défaut.)

### 9.3 Purge complète au logout (S9)

```ts
logout(): void {
  // ...existant...
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k?.startsWith('cnm.')) localStorage.removeItem(k);
  }
}
```

### 9.4 Compteurs de badges sans retélécharger les tables (P2)

Demander au backend un endpoint agrégé (le commentaire `main-layout.ts:288` le réclame déjà) :
```
GET /api/kpi/badges  →  { "brouillons": 3, "aRectifier": 1, "preDispatch": 2, ... }
```
En attendant, mémoriser 30 s : `rafraichirCompteursPrmp()` ne relance le `forkJoin` que si `Date.now() - this.derniereMaj > 30_000`.

### 9.5 Cache + pagination dans `CrudService` (P1)

```ts
// crud.service.ts
private cache$?: Observable<T[]>;
list(): Observable<T[]> {
  return (this.cache$ ??= this.http.get<T[]>(this.baseUrl).pipe(shareReplay(1)));
}
invalider(): void { this.cache$ = undefined; }        // à appeler après create/update/delete
listePage(page: number, size: number): Observable<Page<T>> {
  return this.http.get<Page<T>>(this.baseUrl, { params: new HttpParams().set('page', page).set('size', size) });
}
```
La pagination serveur suppose l'endpoint correspondant — à traiter avec l'équipe backend (le front ne doit pas inventer d'API).

### 9.6 Lazy loading intra-feature (P4) — mécanique

```ts
// prmp.routes.ts — avant :
import { SoumettreDossier } from './soumettre-dossier';
{ path: 'soumettre-dossier', component: SoumettreDossier }
// après :
{ path: 'soumettre-dossier', loadComponent: () => import('./soumettre-dossier').then(m => m.SoumettreDossier) }
```
112 lignes à convertir, gain immédiat sur le TTI de chaque rôle. Ajouter ensuite `withPreloading(PreloadAllModules)` dans `app.config.ts` et un budget `"type": "bundle"` dans `angular.json`.

### 9.7 Grille PPM : sortir les appels chauds (P5)

```ts
// ppm-saisie-grid.ts — mémoïser les tableaux :
readonly marcheControls = computed(() => (this.form().get('marches') as FormArray).controls as FormGroup[]);
// et résoudre les FormControl une fois par ligne (Map<uid, Record<champ, FormControl>>)
// plutôt que ctrl(g, nom) → g.get(nom) à chaque cycle.
```

### 9.8 Modales accessibles (A1) — un correctif partagé

La duplication est l'origine de la dérive : créer une directive unique appliquée aux 29 conteneurs.
```ts
@Directive({ selector: '[appModale]' })
export class ModaleDirective implements AfterViewInit, OnDestroy {
  private el = inject(ElementRef<HTMLElement>);
  private declencheur = document.activeElement as HTMLElement | null;
  fermer = output<void>();
  @HostListener('document:keydown.escape') onEchap() { this.fermer.emit(); }
  ngAfterViewInit() { this.el.nativeElement.querySelector<HTMLElement>('h2, [autofocus], button')?.focus(); }
  ngOnDestroy() { this.declencheur?.focus(); }
  // + piège de focus (keydown.tab : boucler sur les éléments focusables du conteneur)
}
```
Ou installer `@angular/cdk` et utiliser `cdkTrapFocus` + `A11yModule` (dépendance officielle, à signaler avant ajout). Compléter chaque dialog par `aria-labelledby` pointant le titre existant.

### 9.9 Contraste (A2) — re-baser 3 tokens

```scss
--n-500: #55638a;   // ≥ 4,5:1 sur --n-50 → nouveau texte par défaut
--n-400: #6b7a9e;   // l'ancien n-500, réservé aux textes ≥ 18.66px bold sinon décoratif
// interdire --n-300 comme couleur de texte/placeholder (≈1,4:1)
```
Et remonter `--text-base` vers 13-14 px (en `rem` : `0.8125rem`) pour respecter la préférence navigateur.

### 9.10 CI minimale (T2)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm test -- --watch=false --coverage
      - run: npm run build
```

---

## 10. Plan d'action priorisé

### Phase 1 — Quick wins (< 1 jour)

| Action | Réf. | Effort |
|---|---|---|
| `git rm --cached .claude/settings.local.json` + `.gitignore` (+ `screenshots/`, `output/`) + **rotation du mot de passe postgres** | S1, S11 | 15 min |
| `ng update @angular/cli @angular/core` puis `npm update` → 0 vulnérabilité | D1 | 30 min |
| Helper `urlBlobSure()` substitué aux 10 `createObjectURL` | S2 | 2 h |
| Timer de déconnexion à l'expiration + purge `cnm.*` au logout | S5, S9 | 1 h |
| Bump de `revision` seulement si le compteur change ; polling suspendu si SSE actif / onglet caché | P3 | 1 h |
| `aria-label` sur les 7 boutons ✕ ; `aria-labelledby` sur les 28 dialogs (titres déjà présents) ; `aria-label` dynamique sur la cloche | A5, A6 | 2 h |
| Supprimer le double chargement (`paramMap` seul, l'`effect` avec `skip(1)`) | P7 | 1 h |
| Logo login converti en WebP/SVG + `width`/`height` | P8 | 30 min |

### Phase 2 — Corrections moyennes (≈ 1 semaine)

| Action | Réf. |
|---|---|
| 112 routes de features converties en `loadComponent` + `withPreloading` + budget `bundle` | P4, P11 |
| Endpoint agrégé de compteurs (avec le backend) ou cache TTL 30 s dans `main-layout` | P2 |
| `shareReplay(1)` + invalidation dans `CrudService` (référentiels d'abord) | P1 (partiel) |
| Directive `appModale` (focus trap + Échap + restitution) appliquée aux 29 modales ; bouton ✕ sur les 7 modales qui n'en ont pas | A1 |
| Re-basage des tokens `--n-400`/`--n-500`, interdiction de `--n-300` en texte ; tailles en `rem` | A2 |
| Labels/`aria-label` sur la grille PPM + `scope` sur ses en-têtes ; labels réels sur le login + `aria-describedby` des erreurs | A3, A7 |
| Accordéon examen et `<tr>` PV assistant convertis en `<button>`/gestion clavier | A4 |
| État d'erreur générique « Réessayer » dans les listes (composant partagé) + `role="status"` sur les chargements | P9, A5 |
| Auto-hébergement des polices (3-4 graisses via `@fontsource` ou fichiers locaux) + meta CSP minimale | S8, S6 |
| CI GitHub Actions (tests + build) + `--coverage` activé | T2 |
| Validation type/taille mutualisée sur les 6 uploads non contrôlés | S4 |

### Phase 3 — Refactoring structurel (long terme)

| Action | Réf. |
|---|---|
| Pagination serveur de bout en bout (API backend + `CrudService.listePage` + pagers réels dans les listes du circuit) | P1 |
| Session en cookie `HttpOnly; Secure; SameSite=Strict` posé par le backend (supprime S3 et l'essentiel de l'impact de S2) + durée courte & refresh | S3 |
| Mémoïsation de la grille PPM (contrôles résolus en Map, `computed` par ligne) et des inputs objets (`sublabels`, `previsionsOf`) | P5, P6 |
| Couverture de tests : interceptors, `pv-workflow`, `ppm-form-factory`, services HTTP (objectif ~60 % sur `core/` et `shared/`) ; versionner les scénarios Playwright dans `e2e/` | T1, T3 |
| Audit a11y automatisé en CI (axe-core / pa11y sur les écrans clés) après les corrections de la phase 2 | A* |
| CSP stricte posée par le serveur web de production + en-têtes HSTS/`nosniff`/`frame-ancestors` | S6 |

---

*Rapport généré par audit statique + build mesuré. Chaque constat critique a été vérifié manuellement dans le code (fichier:ligne). Les corrections impliquant l'API (pagination, endpoint de compteurs, cookies de session) sont à valider avec l'équipe backend — le front ne doit pas inventer d'endpoint.*
