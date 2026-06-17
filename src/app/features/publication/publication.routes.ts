import { Routes } from '@angular/router';

import { CrudPage } from '../../shared/crud/crud-page';
import { NotificationsList } from '../transverse/notifications-list';
import { DOCUMENT_PUBLIC_CONFIG } from './publication-resources.config';
import { PublicationsPage } from './publications-page';

/** Espace Chargé de publication (lazy, sous roleGuard CHARGE_PUBLICATION). */
export const PUBLICATION_ROUTES: Routes = [
  { path: '', redirectTo: 'publications', pathMatch: 'full' },
  { path: 'publications', component: PublicationsPage },
  { path: 'documents', component: CrudPage, data: { crud: DOCUMENT_PUBLIC_CONFIG } },
  { path: 'notifications', component: NotificationsList },
];
