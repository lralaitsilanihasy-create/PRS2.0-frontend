import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';

import { ApiError, corpsErreur, erreursParChamp } from '../../../core/errors/api-error';
import { ToastService } from '../../../core/notifications/toast.service';
import { TYPES_DOCX, TYPES_PDF, validerFichier } from '../../../core/securite/fichiers-surs';
import { CategorieDao, ChampFiche, ConfianceImport, FicheMarche, ImportDaoResult, PassageImport, PropositionImport, ReponseCadrageImport, TypeMarche } from '../../../models';
import { FicheMarcheService } from '../../../services/fiche-marche.services';
import { ModaleDirective } from '../../../shared/a11y/modale.directive';
import { Icone } from '../../../shared/ui/icone';
import { QUESTIONS_CADRAGE } from './fiche-marche-modele';

/**
 * Les couples (catégorie, forme) dont le serveur sait lire le DAO : ceux dont le document type est décrit (lot D).
 * Miroir de `ModelesDao.COUVERTURES` ; un couple absent d'ici qui deviendrait lisible le dirait par le 422
 * `MODELE_ABSENT`. Fournitures : contrat-cadre (D1), quantité fixe et à commande (D2, 29/09). Prestations
 * intellectuelles : quantité fixe et à commande (D3, 29/09 — il n'existe pas de contrat-cadre de PI). Travaux : les trois
 * formes (D4, 30/09 — le contrat-cadre de travaux sur le document type du contrat-cadre).
 */
export const IMPORTABLES: Readonly<Partial<Record<CategorieDao, readonly TypeMarche[]>>> = {
  FOURNITURES_SERVICES: ['CONTRAT_CADRE', 'QUANTITE_FIXE', 'A_COMMANDE'],
  PRESTATIONS_INTELLECTUELLES: ['QUANTITE_FIXE', 'A_COMMANDE'],
  // ⚠️ 30/09 (lot D4, T-3) — travaux : marché ordinaire (DPAO-T, AE-T, CCAP-T) et contrat-cadre (DPAC-CC, AE-CC).
  TRAVAUX: ['QUANTITE_FIXE', 'A_COMMANDE', 'CONTRAT_CADRE'],
};

/** Le DAO de cette fiche peut-il être importé ? Sans catégorie, le serveur lit comme des fournitures ; l'écran aussi. */
export function importPossible(typeMarche: TypeMarche | null, categorie: CategorieDao | null): boolean {
  return !!typeMarche && (IMPORTABLES[categorie ?? 'FOURNITURES_SERVICES'] ?? []).includes(typeMarche);
}

/** Types acceptés : le Word (.docx) et, depuis le 29/09 (serveur `LecturePdf`), le PDF « texte ». */
const TYPES_IMPORT: readonly string[] = [...TYPES_DOCX, ...TYPES_PDF];

/** Même valeur ? (le serveur rend les nombres typés, la fiche les garde parfois en texte). */
export function memeValeur(a: unknown, b: unknown): boolean {
  if (a == null || b == null || a === '' || b === '') return false;
  const x = String(a).trim(), y = String(b).trim();
  return x.toLowerCase() === y.toLowerCase() || (x !== '' && !Number.isNaN(Number(x)) && Number(x) === Number(y));
}

/**
 * Cochée d'office ? (plan du 28/09, Q8) — seulement une valeur SÛRE (confiance haute, sans anomalie) qui remplit une
 * case VIDE. Rien de ce qui écraserait une saisie, rien de moyen ou de bas : la PRMP le coche elle-même.
 */
export function cocheeDOffice(p: PropositionImport): boolean {
  return p.confiance === 'haute' && !p.anomalies.length && (p.actuelle == null || p.actuelle === '');
}

type Ligne = PropositionImport & { libelle: string; bloc: string; identique: boolean; bloquee: boolean };

/**
 * ⚠️ **Import du DAO** (demande du pilote du 28/09 ; plan `docs/plan-2026-09-28-import-dao.md`, contrat
 * `docs/demande-backend-2026-09-28-import-dao.md`) — la fiche reste le formulaire : le serveur LIT le document
 * (`POST …/import`, rien n'est écrit), cet écran montre ce qu'il a lu, avec l'extrait et la confiance, et la PRMP
 * retient ligne par ligne ; seul « Appliquer » écrit, d'un seul coup (`PUT …/import/appliquer`, fusion : ce qui n'est
 * pas retenu reste tel quel). Sans document, rien ne change : on saisit.
 */
@Component({
  selector: 'app-import-dao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective, Icone],
  templateUrl: './import-dao.html',
  styleUrl: './import-dao.scss',
})
export class ImportDao {
  private readonly ficheService = inject(FicheMarcheService);
  private readonly toast = inject(ToastService);

  readonly idDmc = input.required<number>();
  readonly champs = input<ChampFiche[]>([]);
  readonly typeMarche = input<TypeMarche | null>(null);
  readonly categorie = input<CategorieDao | null>(null);
  /** Fiche encore vierge : l'import est proposé en tête du cadrage ; sinon, un simple bouton « Réimporter ». */
  readonly vierge = input(false);
  readonly applique = output<FicheMarche>();

  readonly importable = computed(() => importPossible(this.typeMarche(), this.categorie()));
  readonly lecture = signal(false);
  readonly erreur = signal<string | null>(null);
  readonly resultat = signal<ImportDaoResult | null>(null);
  readonly cochees = signal<ReadonlySet<string>>(new Set());
  readonly cadrageCoche = signal<ReadonlySet<string>>(new Set());
  readonly envoi = signal(false);
  readonly refus = signal<ReadonlyMap<string, string>>(new Map());
  readonly refusGeneral = signal<string | null>(null);

  private readonly parCode = computed(() => new Map(this.champs().map((c) => [c.code, c])));

  /** Les lignes, dans l'ordre du référentiel (bloc, rang), avec ce qui décide de la case. */
  readonly lignes = computed<Ligne[]>(() => {
    const r = this.resultat();
    if (!r) return [];
    const ordre = new Map(this.champs().map((c, i) => [c.code, i]));
    return r.propositions
      .map((p) => {
        const c = this.parCode().get(p.code);
        return { ...p, libelle: c?.libelle ?? p.code, bloc: c?.bloc ?? p.code.slice(0, 3), identique: memeValeur(p.valeur, p.actuelle), bloquee: p.anomalies.length > 0 };
      })
      .sort((a, b) => (ordre.get(a.code) ?? 9999) - (ordre.get(b.code) ?? 9999));
  });
  readonly blocs = computed(() => [...new Set(this.lignes().map((l) => l.bloc))]);
  lignesDuBloc(bloc: string): Ligne[] { return this.lignes().filter((l) => l.bloc === bloc); }

  readonly nbRetenues = computed(() => this.cochees().size + this.cadrageCoche().size);
  readonly nbAVerifier = computed(() => this.lignes().filter((l) => l.confiance !== 'haute' && !l.identique && !l.bloquee).length);

  // ── Lecture ───────────────────────────────────────────────────────────────────────────────
  choisir(ev: Event): void {
    const champ = ev.target as HTMLInputElement;
    const brut = champ.files?.[0];
    champ.value = '';   // le même fichier doit pouvoir être relu
    if (!brut) return;
    // Certains postes ne donnent pas de type à un .docx : le nom suffit alors, le serveur vérifie le contenu.
    const fichier = !brut.type && /\.docx$/i.test(brut.name) ? new File([brut], brut.name, { type: TYPES_DOCX[0] }) : brut;
    // Le message de format de `validerFichier` ne connaît pas ce couple : on le dit ici ; la taille, elle, reste la sienne.
    if (!TYPES_IMPORT.includes(fichier.type)) { this.erreur.set('Format de fichier non accepté : document Word (.docx) ou PDF attendu.'); return; }
    const refus = validerFichier(fichier, TYPES_IMPORT);
    if (refus) { this.erreur.set(refus); return; }
    this.erreur.set(null);
    this.lecture.set(true);
    this.ficheService.importerDao(this.idDmc(), fichier).subscribe({
      next: (r) => {
        this.lecture.set(false);
        this.refus.set(new Map());
        this.refusGeneral.set(null);
        this.cochees.set(new Set(r.propositions.filter(cocheeDOffice).map((p) => p.code)));
        // Une réponse n'est retenue d'office que si la question est vraiment sans réponse (défaut compris).
        this.cadrageCoche.set(new Set(r.cadrage.filter((c) => { const v = this.actuelleCadrage(c); return v == null || v === ''; }).map((c) => c.cle)));
        this.resultat.set(r);
      },
      error: (e: ApiError | HttpErrorResponse) => {
        this.lecture.set(false);
        this.erreur.set(corpsErreur<{ message?: string }>(e)?.message ?? (e as ApiError).message ?? 'Le document n’a pas pu être lu.');
      },
    });
  }

  // ── Revue ─────────────────────────────────────────────────────────────────────────────────
  basculer(code: string): void {
    this.cochees.update((s) => { const n = new Set(s); if (n.has(code)) n.delete(code); else n.add(code); return n; });
  }
  basculerCadrage(cle: string): void {
    this.cadrageCoche.update((s) => { const n = new Set(s); if (n.has(cle)) n.delete(cle); else n.add(cle); return n; });
  }
  /** ⚠️ 03/10 — où coller chaque passage de liste repéré (lecture par clause). */
  libellePassage(liste: PassageImport['liste']): string {
    return { MATERIEL: 'Matériel exigé — bloc B13', PERSONNEL: 'Personnel clé — bloc B13', PIECES: 'Pièces de l’offre — bloc B14' }[liste];
  }

  /**
   * Copie le passage : la PRMP l'ouvre dans « Coller une liste » du bloc indiqué, où l'aperçu se vérifie. Rien ne
   * s'applique d'ici — la lecture repère le passage, elle ne le découpe pas (note de décision du 03/10).
   */
  copierPassage(p: PassageImport): void {
    const fait = () => this.toast.info(`Passage copié. Ouvrez « ${this.libellePassage(p.liste)} », puis « Coller une liste ».`);
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(p.texte).then(fait, () => this.toast.error('La copie a été refusée par le navigateur : sélectionnez le passage et copiez-le.'));
    else this.toast.error('La copie n’est pas disponible ici : sélectionnez le passage et copiez-le.');
  }

  libelleConfiance(c: ConfianceImport): string {
    return c === 'haute' ? 'sûre' : c === 'moyenne' ? 'à vérifier' : 'incertaine';
  }
  libelleChamp(code: string): string { return this.parCode().get(code)?.libelle ?? code; }
  /** La question de cadrage en toutes lettres (« Contrat-cadre : mono ou multi-attributaire ? »). */
  libelleQuestion(cle: string): string {
    const q = QUESTIONS_CADRAGE.find((x) => x.cle === cle);
    if (q) return q.libelle;
    // Un complément (« tauxAvance », « nbLots ») se nomme par son libellé, rattaché à sa question.
    return QUESTIONS_CADRAGE.find((x) => x.complement?.cle === cle)?.complement?.libelle ?? cle;
  }
  /** Ce que la fiche porte, réponse par défaut comprise (`modeRemise` absent = « Papier », comme le serveur le lit). */
  actuelleCadrage(c: ReponseCadrageImport): string | number | null {
    return c.actuelle ?? QUESTIONS_CADRAGE.find((q) => q.cle === c.cle)?.defaut ?? null;
  }
  /** Réponse déjà à l'identique : rien à écrire, la case est grisée comme pour une valeur. */
  cadrageIdentique(c: ReponseCadrageImport): boolean { return memeValeur(c.valeur, this.actuelleCadrage(c)); }
  /** La réponse telle que la question la propose (« Multi-attributaire »), sinon la valeur brute (un taux). */
  libelleReponse(cle: string, v: unknown): string {
    if (v == null || v === '') return '—';
    return QUESTIONS_CADRAGE.find((q) => q.cle === cle)?.options.find((o) => o.code === String(v))?.libelle ?? String(v);
  }
  valeurCadrage(r: ReponseCadrageImport): string { return this.libelleReponse(r.cle, r.valeur); }
  affiche(v: unknown): string { return v == null || v === '' ? '—' : String(v); }

  fermer(): void {
    if (this.envoi()) return;
    this.resultat.set(null);
  }

  // ── Application ───────────────────────────────────────────────────────────────────────────
  appliquer(): void {
    const r = this.resultat();
    if (!r || !this.nbRetenues()) return;
    const valeurs: Record<string, string | number> = {};
    for (const p of r.propositions) if (this.cochees().has(p.code) && p.valeur != null) valeurs[p.code] = p.valeur;
    const cadrage: Record<string, string | number> = {};
    for (const c of r.cadrage) if (this.cadrageCoche().has(c.cle)) cadrage[c.cle] = c.valeur;
    this.envoi.set(true);
    this.refus.set(new Map());
    this.refusGeneral.set(null);
    this.ficheService.appliquerImport(this.idDmc(), { cadrage, valeurs, fichier: r.fichier, empreinte: r.empreinte }).subscribe({
      next: (f) => {
        this.envoi.set(false);
        this.resultat.set(null);
        const n = Object.keys(valeurs).length, m = Object.keys(cadrage).length;
        this.toast.success(`Fiche pré-remplie depuis ${r.fichier} : ${n} valeur${n > 1 ? 's' : ''}, ${m} réponse${m > 1 ? 's' : ''} de cadrage. Relisez-la bloc par bloc.`);
        this.applique.emit(f);
      },
      error: (e: ApiError | HttpErrorResponse) => {
        this.envoi.set(false);
        const parChamp = erreursParChamp(e);
        this.refus.set(parChamp);
        // Rien n'a été écrit (atomique) : la liste le dit ligne par ligne, et la PRMP décoche ce qui est refusé.
        this.refusGeneral.set(parChamp.size
          ? `Rien n’a été écrit : ${parChamp.size} ligne${parChamp.size > 1 ? 's' : ''} refusée${parChamp.size > 1 ? 's' : ''} (en rouge ci-dessous).`
          : corpsErreur<{ message?: string }>(e)?.message ?? 'L’application a échoué : rien n’a été écrit.');
      },
    });
  }
}
