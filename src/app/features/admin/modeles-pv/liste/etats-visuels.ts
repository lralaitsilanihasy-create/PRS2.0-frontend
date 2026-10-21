import { NomIcone } from '../../../../shared/ui/icone';
import { EtatLigne } from './modeles-pv-vue';

/**
 * Le code visuel des trois états (cahier du 21/10) : une icône et un libellé pour chacun — la couleur n'est jamais seule à porter
 * l'information. Les teintes sont celles de la palette « Institutionnel » (`styles/_palette-institutionnelle.scss`, `--{état}-*`).
 */
export const ICONE_ETAT: Readonly<Record<EtatLigne, NomIcone>> = { miss: 'alert', prep: 'upload', ok: 'check' };
