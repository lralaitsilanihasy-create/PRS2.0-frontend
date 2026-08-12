import { Routes } from '@angular/router';

import { roleGuard } from '../../core/auth/auth.guard';
import { CrudPage } from '../../shared/crud/crud-page';
import { CreerUgpm } from './creer-ugpm';
import { DossiersClotures } from '../circuit/dossiers-clotures';
import { DossiersPipeline } from '../circuit/dossiers-pipeline';
import { LettreRenvoiConsultation } from '../circuit/lettre-renvoi-consultation';
import { PvDefinitifs } from '../circuit/pv-definitifs';
import { ResultatExamen } from '../circuit/resultat-examen';
import { ECHEANCE_CONFIG, PPM_CONFIG } from '../circuit/circuit-resources.config';
import { DossiersARectifier } from './dossiers-a-rectifier';
import { DossiersListe } from './dossiers-liste';
import { MesDossiers } from './mes-dossiers';
import { MesBrouillons } from './mes-brouillons';
import { MesPpmMarches } from './mes-ppm-marches';
import { MiseAJourPpm } from './mise-a-jour-ppm';
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
  // ⚠️ 2026-08-05 — versionnement : édition de la version n+1 d'un PPM (dossier BROUILLON rattaché à
  // son prédécesseur). Créée depuis « Dossiers vérifiés » ; le PPM en vigueur reste intact jusqu'à la
  // soumission de cette version.
  { path: 'mise-a-jour/:idDossier', component: MiseAJourPpm },
  { path: 'ppm-marches', component: MesPpmMarches },
  // Accueil « Mes dossiers » : présente toutes les entrées (type → statut) en cartes.
  // ⚠️ 2026-08-07 (demande user) — la liste d'une ligne s'ouvre SOUS les cartes, au même écran : les
  // écrans de liste sont des routes ENFANTS, rendues dans le `router-outlet` de `MesDossiers`. Ils
  // gardent ainsi leurs paramètres et données de route (type, groupe, source, titre), qu'un simple
  // encastrement de composant aurait perdus. Les routes de premier niveau restent en place pour les
  // liens profonds (notifications, bandeau de renvoi de la saisie).
  {
    path: 'dossiers',
    component: MesDossiers,
    children: [
      // ⚠️ `encastre` (2026-08-07, demande user) — l'écran est rendu SOUS les cartes : il n'a plus
      // à proposer son propre bouton « ← Mes dossiers », on y est déjà.
      { path: 'a-rectifier', component: DossiersARectifier, data: { encastre: true } },
      {
        path: 'verifies',
        component: DossiersClotures,
        data: { title: 'Dossiers vérifiés', source: 'prmp-clotures', encastre: true },
      },
      // Liste générique par type de dossier × groupe de statut (brouillon | soumis).
      // ⚠️ Déclarée APRÈS les segments littéraux : « a-rectifier » ne doit pas être pris pour un type.
      { path: ':type/:groupe', component: DossiersListe, data: { encastre: true } },
    ],
  },
  { path: 'retraits', component: PrmpRetraits },
  { path: 'calendrier', component: CrudPage, data: { crud: ECHEANCE_CONFIG } },
  // ⚠️ 2026-08-12 (demande user) — hub « Examen de dossiers » (même composant que Président/CC, variante
  // PRMP à deux cartes) : SES lettres de renvoi et SES PV définitifs, listes rendues sous les cartes.
  {
    path: 'resultat-examen',
    component: ResultatExamen,
    children: [
      { path: 'pv-definitifs', component: PvDefinitifs },
      { path: 'lettre-renvois', component: LettreRenvoiConsultation, data: { source: 'mes', piecesUpload: true, title: 'Mes lettres de renvoi' } },
      { path: 'lettre-renvois/:idLettre', component: LettreRenvoiConsultation, data: { source: 'mes', piecesUpload: true, title: 'Mes lettres de renvoi' } },
    ],
  },
  // Anciennes URL (liens de notification, favoris) → redirigées vers le hub.
  { path: 'lettre-renvois', redirectTo: 'resultat-examen/lettre-renvois' },
  { path: 'lettre-renvois/:idLettre', redirectTo: 'resultat-examen/lettre-renvois/:idLettre' },
  { path: 'pv-definitifs', redirectTo: 'resultat-examen/pv-definitifs' },
];
