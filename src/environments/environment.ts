/**
 * Environnement de développement.
 * Centralise l'URL de base de l'API REST du backend Spring Boot (PRS20).
 * Ne JAMAIS coder l'URL en dur dans un service : importer `environment.apiUrl`.
 *
 * ⚠️ URL RELATIVE, comme en production : le serveur de développement relaie `/api` vers
 * `http://localhost:8080` (voir `proxy.conf.json`, branché sur la cible `serve` d'angular.json).
 * C'est la **même origine** exigée par la session en cookie `HttpOnly; SameSite=Strict` (phase 0
 * du plan backend) : un cookie strict ne part jamais vers une autre origine, donc l'appel direct
 * à `http://localhost:8080` ne fonctionnerait plus. Bénéfice immédiat, avant même la bascule :
 * plus de préflight CORS en développement.
 *
 * Les délais du proxy sont volontairement très longs : le flux de notifications (SSE) reste
 * ouvert une trentaine de minutes côté serveur, un délai court le couperait en boucle.
 */
export const environment = {
  production: false,
  apiUrl: '/api',
};
