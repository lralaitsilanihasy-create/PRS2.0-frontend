import { CrudResourceConfig } from '../../shared/crud/crud-config';
import {
  DispatchService,
  EcheanceService,
  ExamenDetailService,
  ExamenService,
  PpmService,
  ReceptionService,
  VerificationService,
} from '../../services';

/** PPM — éditable par tout utilisateur authentifié (pas de capacité dédiée). */
export const PPM_CONFIG: CrudResourceConfig = {
  title: 'Mes PPM',
  service: PpmService,
  idKey: 'idPpm',
  fields: [
    { key: 'idPpm', label: 'Identifiant', type: 'number', pk: true, required: true },
    { key: 'idDossier', label: 'Dossier', type: 'number', required: true },
    { key: 'exercice', label: 'Exercice', type: 'number', required: true },
    { key: 'signataire', label: 'Signataire', required: true },
    { key: 'dateSignature', label: 'Date signature', type: 'date', required: true },
    { key: 'reference', label: 'Référence', required: true },
    { key: 'libelle', label: 'Libellé' },
    { key: 'dateReceptionCnm', label: 'Réception CNM', type: 'date' },
    { key: 'idLocalite', label: 'Localité' },
    { key: 'idPrmp', label: 'PRMP' },
  ],
};

/** Réception — écriture SECRETAIRE (titulaire/délégué). */
export const RECEPTION_CONFIG: CrudResourceConfig = {
  title: 'Réceptions',
  service: ReceptionService,
  idKey: 'idReception',
  writeCapability: 'RECEPTION_WRITE',
  note: 'Réservé au Secrétaire (titulaire/délégué). Règle : numPassage = 1 ⟺ type « INITIAL ». Si « Complet » est coché, le dossier passe automatiquement en PRET_DISPATCH.',
  fields: [
    { key: 'idReception', label: 'Identifiant', type: 'number', pk: true, required: true },
    { key: 'idDossier', label: 'Dossier', type: 'number', required: true },
    { key: 'numPassage', label: 'N° passage', type: 'number', required: true },
    { key: 'typePassage', label: 'Type de passage', required: true },
    { key: 'imCtrlRecept', label: 'Secrétaire (matricule)' },
    { key: 'dateReception', label: 'Date réception', type: 'date' },
    { key: 'observation', label: 'Observation' },
    { key: 'complet', label: 'Complet (→ prêt dispatch)', type: 'boolean' },
    { key: 'idReceptionPrec', label: 'Réception précédente', type: 'number' },
  ],
};

/** Examen — écriture MEMBRE (titulaire/délégué). */
export const EXAMEN_CONFIG: CrudResourceConfig = {
  title: 'Examens',
  service: ExamenService,
  idKey: 'idExamen',
  writeCapability: 'EXAMEN_WRITE',
  note: 'Examen possible uniquement pour un dossier au statut PRET_DISPATCH (après dispatch), dans votre localité.',
  fields: [
    { key: 'idExamen', label: 'Identifiant', type: 'number', pk: true, required: true },
    { key: 'idDispatch', label: 'Dispatch', type: 'number', required: true },
    { key: 'imCtrlMembre', label: 'Membre (matricule)' },
    { key: 'dateExamen', label: "Date d'examen", type: 'date' },
  ],
};

/** Détails d'examen (points de contrôle) — écriture MEMBRE. */
export const EXAMEN_DETAIL_CONFIG: CrudResourceConfig = {
  title: "Détails d'examen",
  service: ExamenDetailService,
  idKey: 'idDetailExamen',
  writeCapability: 'EXAMEN_WRITE',
  fields: [
    { key: 'idDetailExamen', label: 'Identifiant', type: 'number', pk: true, required: true },
    { key: 'idExamen', label: 'Examen', type: 'number', required: true },
    { key: 'idPtControle', label: 'Point de contrôle', type: 'number', required: true },
    { key: 'conforme', label: 'Conforme', type: 'boolean', required: true },
    { key: 'obsSiNonConforme', label: 'Obs. si non conforme' },
  ],
};

/** Dispatch — écriture PRESIDENT / CHEF_COMMISSION. */
export const DISPATCH_CONFIG: CrudResourceConfig = {
  title: 'Dispatch des dossiers',
  service: DispatchService,
  idKey: 'idDispatch',
  writeCapability: 'DISPATCH_WRITE',
  note: 'Dispatch possible uniquement pour un dossier au statut PRET_DISPATCH, sans dispatch déjà existant (anti-doublon). Intérim obligatoire pour un CC hors de sa localité.',
  fields: [
    { key: 'idDispatch', label: 'Identifiant', type: 'number', pk: true, required: true },
    { key: 'idReception', label: 'Réception', type: 'number', required: true },
    { key: 'imCtrlDispatch', label: 'Dispatcheur (matricule)' },
    { key: 'imCtrlCc', label: 'CC (matricule)' },
    { key: 'imCtrlMembre', label: 'Membre assigné (matricule)' },
    { key: 'dateDispatch', label: 'Date dispatch', type: 'date' },
    { key: 'dateCtrlAssigne', label: 'Date assignation', type: 'date' },
    { key: 'instructions', label: 'Instructions' },
    { key: 'interimDispatch', label: 'Intérim', type: 'boolean', required: true },
  ],
};

/** Vérification de la levée — écriture VERIFICATEUR (titulaire/délégué). */
export const VERIFICATION_CONFIG: CrudResourceConfig = {
  title: 'Vérifications',
  service: VerificationService,
  idKey: 'idVerification',
  writeCapability: 'VERIFICATION_WRITE',
  note: 'Vérification possible uniquement sur un PV au statut SIGNE. Si « Observations levées » est coché, le dossier est clôturé automatiquement.',
  fields: [
    { key: 'idVerification', label: 'Identifiant', type: 'number', pk: true, required: true },
    { key: 'idReception', label: 'Réception', type: 'number', required: true },
    { key: 'idPv', label: 'PV', type: 'number', required: true },
    { key: 'imCtrlVerif', label: 'Vérificateur (matricule)' },
    { key: 'dateVerif', label: 'Date vérification', type: 'date' },
    { key: 'observation', label: 'Observation' },
    { key: 'obsLevees', label: 'Observations levées (→ clôture)', type: 'boolean' },
  ],
};

/** Échéances / calendrier — éditable par tout utilisateur authentifié. */
export const ECHEANCE_CONFIG: CrudResourceConfig = {
  title: 'Calendrier des jalons',
  service: EcheanceService,
  idKey: 'idEcheance',
  fields: [
    { key: 'idEcheance', label: 'Identifiant', type: 'number', pk: true, required: true },
    { key: 'idDetail', label: 'Marché (détail)', type: 'number', required: true },
    { key: 'typeJalon', label: 'Type de jalon', required: true },
    { key: 'datePrevue', label: 'Date prévue', type: 'date', required: true },
    { key: 'dateReelle', label: 'Date réelle', type: 'date' },
    { key: 'statutJalon', label: 'Statut' },
    { key: 'ecartJours', label: 'Écart (jours)', type: 'number' },
    { key: 'alerteEnvoyee', label: 'Alerte envoyée', type: 'boolean' },
  ],
};
