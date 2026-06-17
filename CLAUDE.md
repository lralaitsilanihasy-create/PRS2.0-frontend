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
- `src/app/` : composants, services, routes
  - `app.ts`, `app.config.ts`, `app.routes.ts` : configuration de l'application standalone
- `src/app/services/` : services HTTP (appels à l'API)
- `src/app/components/` (ou `pages/`) : composants d'interface
- `src/app/models/` : interfaces TypeScript décrivant les données de l'API
- `src/environments/` : URLs d'API par environnement (si présent)
- `public/` : ressources statiques (favicon, images)

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

## Backend associé
- URL de base de l'API : `http://localhost:8080/api`
- Le backend doit autoriser le CORS depuis `http://localhost:4200`,
  sinon les requêtes seront bloquées par le navigateur.

## Commandes
- Serveur de dev : `ng serve` → `http://localhost:4200`
- Générer un composant : `ng generate component nom`
- Générer un service : `ng generate service services/nom`
- Build de production : `ng build`
- Tests : `ng test`

## Notes pour Claude
- Respecter l'architecture standalone du projet existant (cf. `app.ts` / `app.config.ts`).
- Proposer des interfaces TypeScript pour chaque ressource consommée.
- Signaler tout ajout de dépendance npm.
- Garder les composants fins ; déplacer la logique métier et les appels API dans les services.