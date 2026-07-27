import { Routes } from '@angular/router';

import { DossiersClassement, ClassementGroupe } from '../circuit/dossiers-classement';
import { DossiersCircuitListe } from '../circuit/dossiers-circuit-liste';
import { Messagerie } from '../transverse/messagerie';
import { SecretaireDashboard } from './secretaire-dashboard';
import { SecretaireEnregistrement } from './enregistrement';
import { SecretaireReceptions } from './receptions';

/** Groupes du Secrétaire : à réceptionner (SOUMIS) vs réceptionné-enregistré (PRET_DISPATCH). */
const SECRETAIRE_GROUPES: ClassementGroupe[] = [
  { key: 'receptions', label: 'Réceptions', statuts: ['SOUMIS'], icon: '📥', kind: 'a' },
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
  { path: 'receptions', component: SecretaireReceptions },
  { path: 'enregistrement', component: SecretaireEnregistrement },
  { path: 'messagerie', component: Messagerie },
];
