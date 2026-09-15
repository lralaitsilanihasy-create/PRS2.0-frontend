/**
 * Libellé d'une action du journal (code brut si inconnu — le backend reste l'autorité).
 *
 * Fonction pure, sans Angular : partagée par la consultation et la page dossier, testable à froid.
 */
export function actionLabel(type: string): string {
  const labels: Record<string, string> = {
    CREATION: 'Création',
    SOUMISSION: 'Soumission',
    RESOUMISSION: 'Resoumission',
    TRANSMISSION_COMPLEMENTS: 'Transmission de compléments',
    TRANSMISSION_COMPLEMENTS_DEPOT: 'Compléments de dépôt',
    SUPPRESSION: 'Suppression',
    MISE_A_JOUR: 'Mise à jour',
    // ⚠️ Demande pilote (2026-09-04) — gestes du circuit de dispatch, consignés par le backend
    // (demande 2026-09-04-journal-circuit) : libellés prêts, inertes tant que rien n'est servi.
    RECEPTION: 'Réception',
    DISPATCH: 'Dispatch',
    REATTRIBUTION: 'Réattribution',
    REPRISE: 'Reprise par le dispatcheur',
    RETRAIT_DISPATCH: 'Retrait du dispatch',
    // ⚠️ Retrait du DOSSIER par la PRMP (demande 2026-09-07-retrait-dossier-journal) : demande +
    // décision du CC/Président (SOUMIS -> BROUILLON). Libellés prêts, inertes tant que le backend
    // ne dérive pas ces types depuis t_demande_retrait ; noms à aligner sur son choix final.
    DEMANDE_RETRAIT: 'Demande de retrait',
    RETRAIT_ACCEPTE: 'Retrait accepté',
    RETRAIT_REFUSE: 'Retrait refusé',
    // ⚠️ Journal COMPLET (2026-09-04 soir, backend ed162e8, fusion à la lecture) : le traitement
    // raconté jusqu'au bout — examen, navette, visa, signatures, vérification, SIGMP, archivage.
    SOUMISSION_EXAMEN: "Soumission d'examen",
    RETOUR_RECTIFICATION: 'Retour pour rectification',
    TRANSMISSION_PRESIDENT: 'Transmission au Président',
    VISA: 'Visa',
    SIGNATURE: 'Signature',
    PV_SIGNE: 'PV signé',
    DECISION_VERIFICATION: 'Passage de vérification',
    TRANSMISSION_SIGMP: 'Transmission SIGMP',
    ARCHIVAGE: 'Archivage',
  };
  return labels[type] ?? type;
}
