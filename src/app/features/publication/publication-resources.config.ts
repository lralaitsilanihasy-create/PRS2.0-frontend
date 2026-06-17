import { CrudResourceConfig } from '../../shared/crud/crud-config';
import { DocumentPublicService } from '../../services';

/** Documents publics — écriture CHARGE_PUBLICATION (actions d'intégrité via le service). */
export const DOCUMENT_PUBLIC_CONFIG: CrudResourceConfig = {
  title: 'Documents publics',
  service: DocumentPublicService,
  idKey: 'idDocPublic',
  writeCapability: 'PUBLICATION_MANAGE',
  fields: [
    { key: 'idDocPublic', label: 'Identifiant', type: 'number', pk: true, required: true },
    { key: 'idPublication', label: 'Publication', type: 'number', required: true },
    { key: 'typeDoc', label: 'Type' },
    { key: 'libelleDoc', label: 'Libellé' },
    { key: 'cheminFichier', label: 'Chemin fichier' },
    { key: 'format', label: 'Format' },
    { key: 'tailleOctets', label: 'Taille (octets)', type: 'number' },
    { key: 'hashSha256', label: 'Empreinte SHA-256' },
  ],
};
