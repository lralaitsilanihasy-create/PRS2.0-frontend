/**
 * Environnement de production.
 * Substitué à `environment.ts` au build prod via `fileReplacements` (angular.json).
 * Adapter `apiUrl` à l'URL réelle de l'API en production.
 */
export const environment = {
  production: true,
  apiUrl: '/api',
};
