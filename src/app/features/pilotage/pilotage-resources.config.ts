import { CrudResourceConfig } from '../../shared/crud/crud-config';
import { SnapshotStatsService } from '../../services';

/**
 * Instantanés de statistiques (lecture seule ici).
 * Sert de vue « statistiques » pour les profils sans accès aux KPIs agrégés
 * (`/kpis/tableau-bord` est réservé Président/Admin).
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
