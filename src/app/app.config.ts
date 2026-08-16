import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { PreloadAllModules, provideRouter, withPreloading } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Preload : les écrans (tous lazy, y compris à l'intérieur des features) se
    // téléchargent en tâche de fond après le premier rendu — TTI court, navigation sans latence.
    provideRouter(routes, withPreloading(PreloadAllModules)),
    // Ordre : authInterceptor pose le jeton, errorInterceptor traite la réponse.
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorInterceptor]))
  ]
};
