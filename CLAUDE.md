# CLAUDE.md — Frontend (frontendprs2)

Contexte projet pour Claude Code. Décrit la stack, les conventions et les commandes
du frontend. À placer à la racine du projet Angular, à côté de `package.json`.

## Stack
- Framework : Angular (CLI récent, architecture **standalone** — pas de NgModule)
- Langage : TypeScript
- Styles : SCSS
- Gestionnaire de paquets : npm
- IDE : VS Code (extension Claude Code)

## Rôle du projet
Interface utilisateur qui consomme l'API REST du backend Spring Boot (projet `PRS20`),
exposée par défaut sur `http://localhost:8080/api`.
Le frontend tourne sur `http://localhost:4200` en développement.

## Structure
Organisation **par domaine métier**, pas par type technique : il n'y a **pas** de dossier
`components/` ni `pages/` — un écran vit dans le dossier de son profil.

- `src/app/app.ts`, `app.config.ts`, `app.routes.ts` : configuration standalone et routes racines
- `src/app/features/` — **l'essentiel des écrans (≈ 55 composants)**, un sous-dossier par espace :
  `prmp/`, `secretaire/`, `president/`, `cc/`, `membre/`, `verificateur/`, `assistant/`,
  `publication/`, `admin/`, plus les transverses `auth/`, `circuit/` (écrans partagés du circuit
  de contrôle : dispatch, réception, consultation, PV…), `pilotage/`, `transverse/`, `home/`,
  `errors/`, `marche/`. Chaque espace a son `*.routes.ts` (toutes les routes en `loadComponent`).
- `src/app/shared/` — composants et directives réutilisables (≈ 12) : `prmp/` (grille de saisie,
  modal de détail PPM, tableaux), `circuit/` (frise, badges de statut, cartes d'observation),
  `a11y/` (directive `appModale`), `ui/`, `security/` (directives d'affichage conditionnel), `crud/`
- `src/app/core/` — socle applicatif : `auth/` (service de session, guards, permissions),
  `interceptors/`, `notifications/` (toasts, alertes, flux temps réel), `securite/`
  (`fichiers-surs`), `navigation/`, `errors/`, `vacance/`
- `src/app/layout/` — coquille de l'application : barre latérale, en-tête, centre de notifications
- `src/app/services/` — services HTTP (un par ressource, tous dérivés de `CrudService`)
- `src/app/models/` — interfaces TypeScript des données de l'API
- `src/styles/` — design system et styles partagés (`_design-system.scss`, `_fonts.scss`,
  `_ppm-table.scss`, `_responsive.scss`)
- `src/environments/` — URL d'API par environnement · `public/` — ressources statiques et polices

> Pour trouver un écran : partir du profil (`features/<profil>/`) ou de son `*.routes.ts`, qui
> associe chaque chemin d'URL à son composant.

## Conventions
- Composants **standalone** uniquement (pas de `NgModule`).
- Appels HTTP via `HttpClient`, encapsulés dans des **services injectables** —
  jamais d'appel HTTP directement dans un composant.
- Programmation réactive avec RxJS (`Observable`) ; gérer proprement les désabonnements.
- Centraliser l'URL de base de l'API en un seul endroit (environment ou constante),
  ne pas la coder en dur dans chaque service.
- Toujours typer les réponses d'API avec des **interfaces TypeScript** (pas de `any`).
- Nommage : fichiers en kebab-case, classes en PascalCase.
- Privilégier les API Angular modernes : `inject()`, signals quand c'est pertinent.
- Lint : ESLint 9 (`eslint.config.js`, format plat) — corriger les erreurs avant de livrer, ne pas désactiver une règle sans motif consigné en commentaire.

## Backend associé — MÊME ORIGINE (depuis le 17/08/2026)
- L'API s'appelle en **relatif** : `environment.apiUrl = '/api'`, en développement comme en
  production. Le serveur de dev relaie `/api` vers `http://localhost:8080` (`proxy.conf.json`,
  branché sur la cible `serve` d'`angular.json`) — donc **jamais** d'appel direct à `:8080` depuis
  le front, et plus de CORS en développement.
- **Pourquoi c'est impératif** : la session est portée par un cookie `PRS_SESSION`
  `HttpOnly; Secure; SameSite=Strict`. Un cookie strict n'est **jamais** envoyé vers une autre
  origine : un appel à `:8080` partirait non authentifié.
- **Aucun jeton côté client** : `POST /api/auth/login` renvoie `token: null` (mode cookie exclusif).
  Il n'y a plus d'intercepteur `Authorization`, plus de jeton en `localStorage` — celui-ci ne garde
  que le profil d'affichage. La déconnexion appelle `POST /api/auth/logout` (le JavaScript ne peut
  pas supprimer un cookie `HttpOnly`).
- **Mutations** : garde CSRF double-submit. `HttpClient` pose `X-XSRF-TOKEN` **automatiquement**
  depuis le cookie `XSRF-TOKEN` — ne rien coder pour cela. En revanche, un `fetch` manuel
  (ex. le flux SSE) doit le poser lui-même sur les méthodes non sûres, sinon 401.
- ⚠️ Tout script externe (seed, test) qui s'authentifiait en `Authorization: Bearer` **ne fonctionne
  plus** : passer par le cookie renvoyé au login.

## Commandes
- Serveur de dev : `ng serve` → `http://localhost:4200` (proxy `/api` inclus — toujours attaquer
  l'application par ce port, pas par `:8080`)
- Générer un composant : `ng generate component nom`
- Générer un service : `ng generate service services/nom`
- Build de production : `ng build`
- Tests : `ng test`
- Lint : `npm run lint` (ESLint 9, configuration plate `eslint.config.js`) — branché sur la CI

## Notes pour Claude
- Respecter l'architecture standalone du projet existant (cf. `app.ts` / `app.config.ts`).
- Proposer des interfaces TypeScript pour chaque ressource consommée.
- Signaler tout ajout de dépendance npm.
- Garder les composants fins ; déplacer la logique métier et les appels API dans les services.

## Acquis de l'audit technique (16-17/08/2026) — voir `AUDIT.md`
À respecter dans tout nouveau code, sous peine de régresser des correctifs livrés :
- **Affichage d'un fichier** : passer par `urlBlobSure()` / `blobSur()`
  (`core/securite/fichiers-surs`) — jamais `URL.createObjectURL(blob)` brut : un HTML ou SVG
  téléversé s'exécuterait dans l'origine de l'application. Tout téléversement passe par
  `validerFichier()` (type et taille).
- **Modale** : poser la directive `appModale` (`shared/a11y`) sur le conteneur du dialogue —
  elle apporte le focus initial, sa restitution, Échap et le piège de Tab. Y ajouter un
  `aria-label`, et un `aria-label` sur tout bouton réduit à un symbole (✕, ⤴…).
- **Élément cliquable** : utiliser `<button>`, jamais `<div (click)>` — sinon l'action est
  inaccessible au clavier.
- **Champ de formulaire** : un nom accessible stable (`<label>` ou `aria-label`) ; le texte de
  substitution ne suffit pas, il disparaît à la saisie.
- **Couleur de texte** : `--n-500` / `--n-400` sont calibrés sur le contraste AA (4,5:1) —
  ne pas les éclaircir ; `--n-300` est réservé aux bordures et fonds.
- **Chargement / erreur** : `role="status"` sur l'indicateur de chargement, et
  `<app-etat-erreur (reessayer)>` dans le corps de la liste en cas d'échec (un toast disparaît,
  l'utilisateur resterait devant un écran vide).
- **Route de feature** : toujours `loadComponent: () => import(...)`, jamais un import statique.