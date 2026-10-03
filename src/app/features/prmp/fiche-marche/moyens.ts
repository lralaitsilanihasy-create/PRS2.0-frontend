import { MaterielExige, PersonnelExige } from '../../../models';

/**
 * ⚠️ Lot 3 du chantier b (03/10) — l'**aperçu** de la ligne que le DPAO imprimera pour une entrée de matériel ou de
 * personnel, telle que le serveur l'imprime (`demande-backend-2026-10-03-materiel-personnel-travaux` §B2, livrée en V60
 * à la lettre des exemples). C'est le serveur qui imprime : si sa forme change, c'est ici qu'on s'aligne.
 */

const nonVide = (s: string | null | undefined): string | null => (s?.trim() ? s.trim() : null);

/** « - Camions bennes ≥ 10 000 kg : 6, dont au moins 4 en propre » · « - Niveleuse : 1, en propre » · « - Bétonnière ≥ 350 l : 1 ». */
export function ligneMateriel(m: MaterielExige): string {
  const quoi = [nonVide(m.designation) ?? '………', nonVide(m.caracteristique)].filter(Boolean).join(' ');
  const n = m.nombre ?? null;
  let combien = n == null ? '………' : String(n);
  if (m.parLot) combien += ' par lot';
  const min = m.minimumEnPropre ?? null;
  if (min != null && n != null && min >= n) combien += ', en propre';
  else if (min != null && min > 0) combien += `, dont au moins ${min} en propre`;
  return `- ${quoi} : ${combien}`;
}

/**
 * « - Conducteur de travaux (1) : ingénieur BTP ou génie civil ; au moins 5 ans d'expérience en travaux routiers ;
 * justificatifs : CV et diplôme certifié ». Les morceaux absents disparaissent avec leur séparateur.
 */
export function lignePersonnel(p: PersonnelExige): string {
  const n = p.nombre ?? 1;
  const tete = `${nonVide(p.poste) ?? '………'} (${n}${p.parLot ? ' par lot' : ''})`;
  const diplome = nonVide(p.diplome);
  const annees = p.experienceAnnees ?? null;
  const domaine = nonVide(p.domaineExperience);
  const experience =
    annees != null ? `au moins ${annees} an${annees > 1 ? 's' : ''} d'expérience${domaine ? ` en ${domaine}` : ''}` : domaine ? `expérience en ${domaine}` : null;
  const justificatifs = nonVide(p.justificatifs);
  const parts = [diplome ? minusculeInitiale(diplome) : null, experience, justificatifs ? `justificatifs : ${justificatifs}` : null].filter(Boolean);
  return `- ${tete}${parts.length ? ' : ' + parts.join(' ; ') : ''}`;
}

/** « Ingénieur BTP… » → « ingénieur BTP… », mais un sigle en tête garde ses capitales (« BTS… ») — règle du serveur (V60). */
function minusculeInitiale(s: string): string {
  const premier = s.split(/\s/)[0];
  return premier.length > 1 && premier === premier.toUpperCase() ? s : s.charAt(0).toLowerCase() + s.slice(1);
}

/** Un minimum en propre au-delà du nombre (400 du serveur, §B1.2) — signalé dès la saisie. */
export function minimumIncoherent(m: MaterielExige): boolean {
  return m.minimumEnPropre != null && m.nombre != null && (m.minimumEnPropre < 0 || m.minimumEnPropre > m.nombre);
}
