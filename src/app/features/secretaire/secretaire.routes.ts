import { Routes } from '@angular/router';

import { DossiersClassement, ClassementGroupe, GROUPE_RECEPTIONS } from '../circuit/dossiers-classement';
import { DossiersCircuitListe } from '../circuit/dossiers-circuit-liste';
import { Messagerie } from '../transverse/messagerie';
import { SecretaireDashboard } from './secretaire-dashboard';

/** Groupes du Secrétaire : à réceptionner (groupe PARTAGÉ avec P/CC via délégation) vs réceptionné-enregistré. */
const SECRETAIRE_GROUPES: ClassementGroupe[] = [
  GROUPE_RECEPTIONS,
  { key: 'enregistrement', label: 'Enregistrement', statuts: ['PRET_DISPATCH'], icon: '📚', kind: 'b', colonnes: ['reception'] },
];

/** Classement « Mes dossiers » (Secrétaire) : cartes par type × {réceptions, enregistrement}, sa localité. */
const CLASSEMENT_SECRETAIRE = { subtitle: 'Domaine Secrétaire', base: '/secretaire/mes-dossiers', groupes: SECRETAIRE_GROUPES };

/** Espace Secrétaire (lazy, sous roleGuard SECRETAIRE). */
export const SECRETAIRE_ROUTES: Routes = [
  { path: '', redirectTo: 'mes-dossiers', pathMatch: 'full' },
  { path: 'tableau-de-bord', component: SecretaireDashboard },
  { path: 'mes-dossiers', component: DossiersClassement, data: { classement: CLASSEMENT_SECRETAIRE } },
  { path: 'mes-dossiers/:type/:groupe', component: DossiersCircuitListe, data: { classement: CLASSEMENT_SECRETAIRE } },
  { path: 'messagerie', component: Messagerie },
];
