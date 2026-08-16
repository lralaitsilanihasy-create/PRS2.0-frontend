import { Routes } from '@angular/router';

import { roleGuard } from '../../core/auth/auth.guard';







import { PPM_CONFIG } from '../circuit/circuit-resources.config';










/** Espace PRMP (lazy, sous roleGuard PRMP). */
export const PRMP_ROUTES: Routes = [
  { path: '', redirectTo: 'tableau-de-bord', pathMatch: 'full' },
  {
    path: 'tableau-de-bord',
    loadComponent: () => import('../circuit/dossiers-pipeline').then((m) => m.DossiersPipeline),
    data: { title: 'Mes dossiers' },
  },
  { path: 'a-rectifier', loadComponent: () => import('./dossiers-a-rectifier').then((m) => m.DossiersARectifier) },
  // Formulaire restreint de rectification en place (en-tête PPM + lignes marché) ; returnUrl en query param.
  { path: 'rectifier/:idDossier', loadComponent: () => import('./rectifier-dossier').then((m) => m.RectifierDossier) },
  { path: 'dossiers-verifies', loadComponent: () => import('../circuit/dossiers-clotures').then((m) => m.DossiersClotures), data: { title: 'Dossiers vérifiés', source: 'prmp-clotures' } },
  { path: 'ppm', loadComponent: () => import('../../shared/crud/crud-page').then((m) => m.CrudPage), data: { crud: PPM_CONFIG } },
  { path: 'soumettre-dossier', loadComponent: () => import('./soumettre-dossier').then((m) => m.SoumettreDossier) },
  // Création d'une UGPM par la PRMP (sous sa tutelle) — réservé PRMP (l'UGPM ne crée pas d'UGPM).
  { path: 'creer-ugpm', loadComponent: () => import('./creer-ugpm').then((m) => m.CreerUgpm), canActivate: [roleGuard], data: { roles: ['PRMP'] } },
  { path: 'mes-brouillons', loadComponent: () => import('./mes-brouillons').then((m) => m.MesBrouillons) },
  // ⚠️ 2026-08-05 — versionnement : édition de la version n+1 d'un PPM (dossier BROUILLON rattaché à
  // son prédécesseur). Créée depuis « Dossiers vérifiés » ; le PPM en vigueur reste intact jusqu'à la
  // soumission de cette version.
  { path: 'mise-a-jour/:idDossier', loadComponent: () => import('./mise-a-jour-ppm').then((m) => m.MiseAJourPpm) },
  { path: 'ppm-marches', loadComponent: () => import('./mes-ppm-marches').then((m) => m.MesPpmMarches) },
  // Accueil « Mes dossiers » : présente toutes les entrées (type → statut) en cartes.
  // ⚠️ 2026-08-07 (demande user) — la liste d'une ligne s'ouvre SOUS les cartes, au même écran : les
  // écrans de liste sont des routes ENFANTS, rendues dans le `router-outlet` de `MesDossiers`. Ils
  // gardent ainsi leurs paramètres et données de route (type, groupe, source, titre), qu'un simple
  // encastrement de composant aurait perdus. Les routes de premier niveau restent en place pour les
  // liens profonds (notifications, bandeau de renvoi de la saisie).
  {
    path: 'dossiers',
    loadComponent: () => import('./mes-dossiers').then((m) => m.MesDossiers),
    children: [
      // ⚠️ `encastre` (2026-08-07, demande user) — l'écran est rendu SOUS les cartes : il n'a plus
      // à proposer son propre bouton « ← Mes dossiers », on y est déjà.
      { path: 'a-rectifier', loadComponent: () => import('./dossiers-a-rectifier').then((m) => m.DossiersARectifier), data: { encastre: true } },
      {
        path: 'verifies',
        loadComponent: () => import('../circuit/dossiers-clotures').then((m) => m.DossiersClotures),
        data: { title: 'Dossiers vérifiés', source: 'prmp-clotures', encastre: true },
      },
      // Liste générique par type de dossier × groupe de statut (brouillon | soumis).
      // ⚠️ Déclarée APRÈS les segments littéraux : « a-rectifier » ne doit pas être pris pour un type.
      { path: ':type/:groupe', loadComponent: () => import('./dossiers-liste').then((m) => m.DossiersListe), data: { encastre: true } },
    ],
  },
  { path: 'retraits', loadComponent: () => import('./retraits').then((m) => m.PrmpRetraits) },
  // ⚠️ 2026-08-12 (demande user) — le calendrier montre l'objet de chaque ligne des dossiers de
  // planification avec ses processus CAPM (remplace le CRUD « échéances », vide pour la PRMP).
  { path: 'calendrier', loadComponent: () => import('./calendrier-marches').then((m) => m.CalendrierMarches) },
  // ⚠️ 2026-08-12 (demande user) — hub « Examen de dossiers » (même composant que Président/CC, variante
  // PRMP à deux cartes) : SES lettres de renvoi et SES PV définitifs, listes rendues sous les cartes.
  {
    path: 'resultat-examen',
    loadComponent: () => import('../circuit/resultat-examen').then((m) => m.ResultatExamen),
    children: [
      { path: 'pv-definitifs', loadComponent: () => import('../circuit/pv-definitifs').then((m) => m.PvDefinitifs) },
      { path: 'lettre-renvois', loadComponent: () => import('../circuit/lettre-renvoi-consultation').then((m) => m.LettreRenvoiConsultation), data: { source: 'mes', piecesUpload: true, title: 'Mes lettres de renvoi' } },
      { path: 'lettre-renvois/:idLettre', loadComponent: () => import('../circuit/lettre-renvoi-consultation').then((m) => m.LettreRenvoiConsultation), data: { source: 'mes', piecesUpload: true, title: 'Mes lettres de renvoi' } },
    ],
  },
  // Anciennes URL (liens de notification, favoris) → redirigées vers le hub.
  { path: 'lettre-renvois', redirectTo: 'resultat-examen/lettre-renvois' },
  { path: 'lettre-renvois/:idLettre', redirectTo: 'resultat-examen/lettre-renvois/:idLettre' },
  { path: 'pv-definitifs', redirectTo: 'resultat-examen/pv-definitifs' },
];
