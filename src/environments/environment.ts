/**
 * Environnement de développement.
 * Centralise l'URL de base de l'API REST du backend Spring Boot (PRS20).
 * Ne JAMAIS coder l'URL en dur dans un service : importer `environment.apiUrl`.
 */
export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
};
