import { Routes } from '@angular/router';

import { DOCUMENT_PUBLIC_CONFIG } from './publication-resources.config';

/** Espace Chargé de publication (lazy, sous roleGuard CHARGE_PUBLICATION). */
export const PUBLICATION_ROUTES: Routes = [
  { path: '', redirectTo: 'publications', pathMatch: 'full' },
  { path: 'publications', loadComponent: () => import('./publications-page').then((m) => m.PublicationsPage) },
  { path: 'documents', loadComponent: () => import('../../shared/crud/crud-page').then((m) => m.CrudPage), data: { crud: DOCUMENT_PUBLIC_CONFIG } },
  { path: 'notifications', loadComponent: () => import('../transverse/notifications-list').then((m) => m.NotificationsList) },
];
