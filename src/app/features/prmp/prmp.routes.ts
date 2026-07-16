import { Routes } from '@angular/router';

import { roleGuard } from '../../core/auth/auth.guard';
import { CrudPage } from '../../shared/crud/crud-page';
import { CreerUgpm } from './creer-ugpm';
import { DossiersClotures } from '../circuit/dossiers-clotures';
import { DossiersPipeline } from '../circuit/dossiers-pipeline';
import { LettreRenvoiConsultation } from '../circuit/lettre-renvoi-consultation';
import { ECHEANCE_CONFIG, PPM_CONFIG } from '../circuit/circuit-resources.config';
import { DossiersARectifier } from './dossiers-a-rectifier';
import { DossiersListe } from './dossiers-liste';
import { MesDossiers } from './mes-dossiers';
import { MesBrouillons } from './mes-brouillons';
import { MesPpmMarches } from './mes-ppm-marches';
import { PrmpRetraits } from './retraits';
import { RectifierDossier } from './rectifier-dossier';
import { SoumettreDossier } from './soumettre-dossier';

/** Espace PRMP (lazy, sous roleGuard PRMP). */
export const PRMP_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
  {
    path: 'tableau-de-bord',
    component: DossiersPipeline,
    data: { title: 'Mes dossiers' },
  },
  { path: 'a-rectifier', component: DossiersARectifier },
  // Formulaire restreint de rectification en place (en-tête PPM + lignes marché) ; returnUrl en query param.
  { path: 'rectifier/:idDossier', component: RectifierDossier },
  { path: 'dossiers-verifies', component: DossiersClotures, data: { title: 'Dossiers vérifiés', source: 'prmp-clotures' } },
  { path: 'ppm', component: CrudPage, data: { crud: PPM_CONFIG } },
  { path: 'soumettre-dossier', component: SoumettreDossier },
  // Création d'une UGPM par la PRMP (sous sa tutelle) — réservé PRMP (l'UGPM ne crée pas d'UGPM).
  { path: 'creer-ugpm', component: CreerUgpm, canActivate: [roleGuard], data: { roles: ['PRMP'] } },
  { path: 'mes-brouillons', component: MesBrouillons },
  { path: 'ppm-marches', component: MesPpmMarches },
  // Accueil « Mes dossiers » : présente toutes les entrées (type → statut) en cartes.
  { path: 'dossiers', component: MesDossiers },
  // Liste générique par type de dossier × groupe de statut (brouillon | soumis).
  { path: 'dossiers/:type/:groupe', component: DossiersListe },
  { path: 'retraits', component: PrmpRetraits },
  { path: 'calendrier', component: CrudPage, data: { crud: ECHEANCE_CONFIG } },
  // Lettres de renvoi reçues (lecture seule) ; `:idLettre` (lien de notification) déplie le détail.
  { path: 'lettre-renvois', component: LettreRenvoiConsultation, data: { source: 'mes', piecesUpload: true, title: 'Mes lettres de renvoi' } },
  { path: 'lettre-renvois/:idLettre', component: LettreRenvoiConsultation, data: { source: 'mes', piecesUpload: true, title: 'Mes lettres de renvoi' } },
];
