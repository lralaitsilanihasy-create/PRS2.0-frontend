import { CrudResourceConfig } from '../../shared/crud/crud-config';
import { SnapshotStatsService } from '../../services';

/**
 * Instantanés de statistiques (lecture seule ici).
 *
 * ⚠️ 2026-08-04 — **plus référencé par aucune route**. Servait de vue « statistiques » de repli pour les
 * profils privés des KPIs agrégés ; cette prémisse est caduque : `GET /api/kpis/tableau-bord` est ouvert à
 * PRESIDENT / ADMINISTRATEUR / CHEF_COMMISSION, et le Chef de commission affiche désormais le MÊME tableau
 * de bord KPI que le Président. Conservé pour un éventuel ré-usage (profil sans droit sur les KPIs).
 */
export const SNAPSHOT_STATS_CONFIG: CrudResourceConfig = {
  title: 'Statistiques',
  service: SnapshotStatsService,
  idKey: 'idSnapshot',
  readOnly: true,
  fields: [
    { key: 'idSnapshot', label: 'ID', type: 'number' },
    { key: 'dateSnapshot', label: 'Date' },
    { key: 'idLocalite', label: 'Localité' },
    { key: 'exercice', label: 'Exercice', type: 'number' },
    { key: 'nbDossiersRecus', label: 'Reçus', type: 'number' },
    { key: 'nbDossiersClotures', label: 'Clôturés', type: 'number' },
    { key: 'nbDossiersEnCours', label: 'En cours', type: 'number' },
    { key: 'tauxConformite', label: 'Taux conformité', type: 'number' },
    { key: 'delaiMoyenJours', label: 'Délai moyen (j)', type: 'number' },
  ],
};
