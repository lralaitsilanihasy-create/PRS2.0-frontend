import { Routes } from '@angular/router';

import { ClassementGroupe, GROUPE_ENREGISTREMENT, GROUPE_RECEPTIONS } from '../circuit/dossiers-classement';




/** Groupes du Secrétaire : à réceptionner vs réceptionné-enregistré (groupes PARTAGÉS avec P/CC via délégation). */
const SECRETAIRE_GROUPES: ClassementGroupe[] = [GROUPE_RECEPTIONS, GROUPE_ENREGISTREMENT];

/** Classement « Mes dossiers » (Secrétaire) : cartes par type × {réceptions, enregistrement}, sa localité. */
const CLASSEMENT_SECRETAIRE = { subtitle: 'Domaine Secrétaire', base: '/secretaire/mes-dossiers', groupes: SECRETAIRE_GROUPES };

/** Espace Secrétaire (lazy, sous roleGuard SECRETAIRE). */
export const SECRETAIRE_ROUTES: Routes = [
  { path: '', redirectTo: 'mes-dossiers', pathMatch: 'full' },
  { path: 'tableau-de-bord', loadComponent: () => import('./secretaire-dashboard').then((m) => m.SecretaireDashboard) },
  { path: 'mes-dossiers', loadComponent: () => import('../circuit/dossiers-classement').then((m) => m.DossiersClassement), data: { classement: CLASSEMENT_SECRETAIRE } },
  { path: 'mes-dossiers/:type/:groupe', loadComponent: () => import('../circuit/dossiers-circuit-liste').then((m) => m.DossiersCircuitListe), data: { classement: CLASSEMENT_SECRETAIRE } },
  { path: 'messagerie', loadComponent: () => import('../transverse/messagerie').then((m) => m.Messagerie) },
];
