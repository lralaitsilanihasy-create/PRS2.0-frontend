import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { PreloadAllModules, provideRouter, withPreloading } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { HeureServeur } from './core/horloge/heure-serveur';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Preload : les écrans (tous lazy, y compris à l'intérieur des features) se
    // téléchargent en tâche de fond après le premier rendu — TTI court, navigation sans latence.
    provideRouter(routes, withPreloading(PreloadAllModules)),
    // ⚠️ Phase 2 du plan cookie (2026-08-17) : plus d'interceptor Authorization — la session est
    // portée par le cookie HttpOnly PRS_SESSION (envoyé automatiquement en même origine), et la
    // protection XSRF intégrée d'HttpClient (active par défaut) pose X-XSRF-TOKEN depuis le
    // cookie XSRF-TOKEN sur les mutations. errorInterceptor traite les réponses (401 → login).
    provideHttpClient(withFetch(), withInterceptors([errorInterceptor])),
    // ⚠️ 24/10 (« heure-serveur ») — l'heure de l'application est celle du serveur : écart calé au démarrage (trois secondes au plus).
    provideAppInitializer(() => inject(HeureServeur).demarrer()),
  ]
};
