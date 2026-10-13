import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * ⚠️ Manuel révisé, R4 (13/10) — le rendu **générique** d'un JSON figé (instantané d'un écran), le même langage que l'export PDF du
 * serveur : un objet en « libellé : valeur », une liste d'objets en tableau, une liste de valeurs simples en énumération. Il rend
 * lisible n'importe quel écran figé, même ceux qui n'ont pas de vue dédiée (AMI, CAO, Avis, Plan, Acte, DSS) ; les vues dédiées
 * (séance, évaluation, attribution) le gardent sous un volet « Données complètes ». Lecture seule, sans appel.
 */

type Simple = string | number | boolean | null | undefined;

interface Champ {
  cle: string;
  libelle: string;
  valeur: unknown;
}

interface Colonne {
  cle: string;
  libelle: string;
}

export type FormeFigee =
  | { type: 'vide' }
  | { type: 'texte'; texte: string }
  | { type: 'liste'; elements: string[] }
  | { type: 'table'; colonnes: Colonne[]; lignes: Record<string, unknown>[] }
  | { type: 'objet'; simples: Champ[]; composes: Champ[] };

/** Les clés les plus courantes des DTO, en clair ; les autres sont dépliées depuis leur camelCase (`montantTtc` → « Montant ttc »). */
const LIBELLES_CLES: Readonly<Record<string, string>> = {
  idDmc: 'Procédure n°',
  idDossier: 'Dossier n°',
  idOffre: 'Offre',
  idInstantane: 'Instantané n°',
  etat: 'État',
  etape: 'Étape',
  lot: 'Lot',
  lots: 'Lots',
  numero: 'N°',
  nom: 'Nom',
  im: 'Matricule',
  le: 'Le',
  par: 'Par',
  date: 'Date',
  motif: 'Motif',
  clause: 'Clause',
  observation: 'Observation',
  observations: 'Observations',
  candidat: 'Candidat',
  entreprise: 'Entreprise',
  raisonSociale: 'Raison sociale',
  nif: 'NIF',
  montant: 'Montant (HT)',
  montantTtc: 'Montant (TTC)',
  montantEvalue: 'Montant évalué',
  prixLu: 'Prix lu (HT)',
  prixLuTtc: 'Prix lu (TTC)',
  prixCorrige: 'Prix corrigé',
  rabais: 'Rabais',
  delai: 'Délai',
  rang: 'Rang',
  president: 'Président',
  present: 'Présent',
  membres: 'Membres',
  offres: 'Offres',
  signatures: 'Signatures',
  signaturesAttendues: 'Signataires attendus',
  signe: 'Signé',
  signeLe: 'Signé le',
  produit: 'Produit',
  produitLe: 'Produit le',
  publie: 'Publié',
  publieLe: 'Publié le',
  quorum: 'Quorum',
  decision: 'Décision',
  reference: 'Référence',
  objet: 'Objet',
  fichier: 'Fichier',
  disponible: 'Disponible',
  echeance: 'Échéance',
  debut: 'Début',
  fin: 'Fin',
  jours: 'Jours',
  ecoule: 'Écoulé',
  heureOuverture: "Heure d'ouverture",
  ouverteLe: 'Ouverte le',
  ouvertePar: 'Ouverte par',
  dechiffreeLe: 'Déchiffrée le',
  declarations: "Déclarations d'intérêts",
  conflit: "Conflit d'intérêts",
  proposition: "Proposition d'attribution",
  attributaire: 'Attributaire',
  infructueux: 'Infructueux',
  versionPpm: 'Version du plan',
  valeurs: 'Valeurs de la fiche',
  ligne: 'Ligne du plan',
  avis: 'Avis',
  lettres: 'Lettres',
  documents: 'Documents',
  projets: 'Projets',
  ami: "Appel à manifestation d'intérêt",
  preselection: 'Présélection',
  acte: 'Acte',
  marche: 'Marché',
  demandes: 'Demandes',
  courante: 'Demande courante',
  declaree: 'Déclarée',
  // La ligne du plan (PLAN) et les disponibilités (AVIS), telles que le serveur les fige.
  idDetail: 'Ligne n°',
  idLigneOrigine: "Ligne d'origine n°",
  idPpm: 'Plan n°',
  supprimee: 'Supprimée',
  designationMarche: 'Désignation du marché',
  numCompte: 'N° de compte',
  montEstim: 'Montant estimé',
  ancienMontEstim: 'Ancien montant estimé',
  nouvMontEstim: 'Nouveau montant estimé',
  financement: 'Financement',
  statut: 'Statut',
  avisImprimeLe: 'Avis imprimé le',
  idNature: 'Nature',
  idMode: 'Mode de passation',
  formeMarche: 'Forme du marché',
  justifModeDerogatoire: 'Justification du mode dérogatoire',
  justifDelaiAmenage: 'Justification du délai aménagé',
  version: 'Version',
  raison: 'Raison',
  idAvis: 'Avis du PV',
  statutPv: 'Statut du PV',
  statutDossier: 'Statut du dossier',
  idDossierSoumis: 'Dossier soumis n°',
  idDocument: 'Document n°',
  type: 'Type',
  libelle: 'Libellé',
  extension: 'Format',
  nomFichier: 'Nom du fichier',
  tailleOctets: 'Taille (octets)',
  dateGeneration: 'Généré le',
  publication: 'Publication',
  anomalies: 'Anomalies',
  regle: 'Règle',
  message: 'Message',
  dates: 'Dates',
  lancement: 'Lancement',
  ouverture: 'Ouverture des plis',
  attribution: 'Attribution',
  dateAffichage: "Date d'affichage",
  dateSignature: 'Date de signature',
  dateEnvoi: "Date d'envoi",
  lieu: 'Lieu',
  candidats: 'Candidats',
};

/** Les clés qui portent un montant en ariary (`montant`, `montEstim`, `prixLu`, `total`…) ; un nombre sans cette marque s'affiche tel quel (année, numéro, rang). */
const CLES_MONTANT = /mont|prix|total|rabais|ajustement|garantie/i;

export function libelleCle(cle: string): string {
  const connu = LIBELLES_CLES[cle];
  if (connu) return connu;
  const deplie = cle.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
  return deplie.charAt(0).toUpperCase() + deplie.slice(1);
}

export function estSimple(v: unknown): v is Simple {
  return v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
}

const estObjet = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Une valeur simple en texte : dates ISO en `JJ/MM/AAAA[ à HH:MM]`, montants en ariary, booléens en « oui » / « non », vide en « — ». */
export function texteSimple(v: Simple, cle = ''): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'oui' : 'non';
  if (typeof v === 'number') return CLES_MONTANT.test(cle) ? `${new Intl.NumberFormat('fr-FR').format(v)} Ar` : String(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(v);
  if (m) return m[4] ? `${m[3]}/${m[2]}/${m[1]} à ${m[4]}:${m[5]}` : `${m[3]}/${m[2]}/${m[1]}`;
  return v;
}

/** La forme d'une valeur : ce que le gabarit en rend. */
export function formeDe(v: unknown): FormeFigee {
  if (estSimple(v)) return v == null || v === '' ? { type: 'vide' } : { type: 'texte', texte: texteSimple(v) };
  if (Array.isArray(v)) {
    if (!v.length) return { type: 'vide' };
    if (v.every(estSimple)) return { type: 'liste', elements: v.map((x) => texteSimple(x)) };
    const lignes = v.map((x) => (estObjet(x) ? x : { valeur: x }));
    const colonnes: Colonne[] = [];
    for (const l of lignes) for (const cle of Object.keys(l)) if (!colonnes.some((c) => c.cle === cle)) colonnes.push({ cle, libelle: libelleCle(cle) });
    return { type: 'table', colonnes, lignes };
  }
  if (estObjet(v)) {
    const champs = Object.entries(v).map(([cle, valeur]) => ({ cle, libelle: libelleCle(cle), valeur }));
    if (!champs.length) return { type: 'vide' };
    const simples = champs.filter((c) => estSimple(c.valeur) || (Array.isArray(c.valeur) && !c.valeur.length));
    const composes = champs.filter((c) => !simples.includes(c));
    return { type: 'objet', simples, composes };
  }
  return { type: 'texte', texte: String(v) };
}

@Component({
  selector: 'app-donnees-figees',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (forme().type) {
      @case ('vide') { <span class="df__vide">—</span> }
      @case ('texte') { <span class="df__texte">{{ $any(forme()).texte }}</span> }
      @case ('liste') { <span class="df__texte">{{ $any(forme()).elements.join(', ') }}</span> }
      @case ('table') {
        @if (niveau() > 4) {
          <code class="df__json">{{ json() }}</code>
        } @else {
          <div class="table-responsive">
            <table class="cnm-table df__table">
              <thead><tr>@for (c of $any(forme()).colonnes; track c.cle) { <th scope="col">{{ c.libelle }}</th> }</tr></thead>
              <tbody>
                @for (l of $any(forme()).lignes; track $index) {
                  <tr>@for (c of $any(forme()).colonnes; track c.cle) { <td><app-donnees-figees [valeur]="l[c.cle]" [cle]="c.cle" [niveau]="niveau() + 1" /></td> }</tr>
                }
              </tbody>
            </table>
          </div>
        }
      }
      @case ('objet') {
        @if (niveau() > 4) {
          <code class="df__json">{{ json() }}</code>
        } @else {
          @if ($any(forme()).simples.length) {
            <dl class="df__dl" [class.df__dl--compact]="niveau() > 0">
              @for (c of $any(forme()).simples; track c.cle) {
                <dt>{{ c.libelle }}</dt>
                <dd>{{ texte(c.valeur, c.cle) }}</dd>
              }
            </dl>
          }
          @for (c of $any(forme()).composes; track c.cle) {
            <section class="df__bloc">
              @if (niveau() === 0) { <h4 class="df__h">{{ c.libelle }}</h4> } @else { <p class="df__sous">{{ c.libelle }}</p> }
              <app-donnees-figees [valeur]="c.valeur" [cle]="c.cle" [niveau]="niveau() + 1" />
            </section>
          }
        }
      }
    }
  `,
  styles: `
    :host { display: block; font-size: var(--text-sm); }
    .df__vide { color: var(--n-400); }
    .df__dl { display: grid; grid-template-columns: minmax(10rem, max-content) 1fr; gap: 0.2rem 1rem; margin: 0; }
    .df__dl--compact { grid-template-columns: minmax(7rem, max-content) 1fr; gap: 0.1rem 0.6rem; }
    .df__dl dt { color: var(--n-500); font-weight: 500; }
    .df__dl dd { margin: 0; overflow-wrap: anywhere; }
    .df__bloc { margin-top: 0.6rem; }
    .df__h { margin: 0.8rem 0 0.3rem; font-size: var(--text-sm); font-weight: 600; color: var(--n-700, #334155); text-transform: uppercase; letter-spacing: 0.02em; }
    .df__sous { margin: 0.3rem 0 0.15rem; font-weight: 600; color: var(--n-500); }
    .df__table { width: 100%; }
    .df__table td { vertical-align: top; white-space: normal; overflow-wrap: anywhere; }
    .df__json { display: block; white-space: pre-wrap; font-size: var(--text-xs); color: var(--n-500); }
  `,
})
export class DonneesFigees {
  readonly valeur = input.required<unknown>();
  /** La clé parente, pour le format (un montant s'affiche en ariary). */
  readonly cle = input('');
  readonly niveau = input(0);

  readonly forme = computed<FormeFigee>(() => {
    const v = this.valeur();
    const forme = formeDe(v);
    return forme.type === 'texte' && estSimple(v) ? { type: 'texte', texte: texteSimple(v, this.cle()) } : forme;
  });
  readonly json = computed(() => JSON.stringify(this.valeur()));
  readonly texte = (v: unknown, cle: string): string => (estSimple(v) ? texteSimple(v, cle) : Array.isArray(v) ? 'aucun' : '—');
}
