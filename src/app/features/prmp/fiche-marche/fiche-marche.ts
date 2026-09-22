import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { ApiError, erreursParChamp } from '../../../core/errors/api-error';
import { ToastService } from '../../../core/notifications/toast.service';
import { BilanControles, BlocFiche, Cadrage, ChampFiche, FicheMarche, LigneEligible, ReferentielFiche, RubriqueFiche, TypeMarche, VersionFiche } from '../../../models';
import { ChampFicheMarcheService, DmcService, FicheMarcheService } from '../../../services/fiche-marche.services';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import { Icone } from '../../../shared/ui/icone';
import {
  BILAN_VIDE,
  ETAPES_FICHE,
  LIBELLES_DOCUMENTS,
  LIBELLES_TYPES_MARCHE,
  QUESTIONS_CADRAGE,
  QuestionCadrage,
  REFERENTIEL_ESQUISSE,
  blocsASaisir,
  cadrageComplet,
  champsDeRubrique,
  progression,
  questionsPosees,
  reprises,
  resumeCadrage,
  rubriqueOuverte,
} from './fiche-marche-modele';

type Valeur = string | number | null;

/**
 * Le serveur ne sert pas (encore) la route : 404, 405, 501 — et 400, car aujourd'hui `GET /api/dmcs/eligibles`
 * tombe sur `GET /api/dmcs/{id}` de l'existant, qui refuse « eligibles » comme identifiant (constaté le 22/09).
 * Un 401/403 ou un 5xx restent des erreurs : ils ne parlent pas du contrat.
 */
function routeAbsente(e: HttpErrorResponse | ApiError): boolean {
  return e.status === 404 || e.status === 400 || e.status === 405 || e.status === 501;
}

/**
 * **Fiche marché d'un appel d'offres** (`/prmp/dao` : choix de la ligne du PPM ; `/prmp/dao/:idDmc` : le parcours) —
 * proposition `docs/proposition-2026-09-22-dmc-appel-offres-fiche-marche.md`, développée CONTRE le contrat proposé
 * au backend (`docs/demande-backend-2026-09-22-fiche-marche-dao.md`, lot 1 : quantité fixe, sans génération).
 *
 * Décision pilote : un FORMULAIRE, aucun import de PDF. Sept étapes de l'esquisse : ligne du PPM (22 informations
 * reprises, verrouillées) → cadrage (dix questions qui ouvrent ou ferment des rubriques) → saisie bloc par bloc,
 * l'écran étant DESSINÉ depuis le référentiel serveur (`champs-fiche-marche`) → reprises → contrôles (bilan serveur)
 * → validation PRMP (fige, versionne) → documents (lot 2).
 *
 * ⚠️ Tant que le serveur ne sert pas le contrat : le référentiel se replie sur la STRUCTURE de l'esquisse (blocs,
 * rubriques, comptes attendus, aucun champ) et l'écran le dit ; les enregistrements échouent proprement.
 */
@Component({
  selector: 'app-fiche-marche',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, Icone, EtatErreur],
  templateUrl: './fiche-marche.html',
  styleUrl: './fiche-marche.scss',
})
export class FicheMarcheEcran {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly champService = inject(ChampFicheMarcheService);
  private readonly dmcService = inject(DmcService);
  private readonly ficheService = inject(FicheMarcheService);

  readonly etapes = ETAPES_FICHE;
  readonly libellesDocuments = LIBELLES_DOCUMENTS;
  readonly libellesTypes = LIBELLES_TYPES_MARCHE;

  /** `null` = `/prmp/dao` : choix de la ligne du PPM. */
  readonly idDmc = toSignal(this.route.paramMap.pipe(map((p) => (p.get('idDmc') ? Number(p.get('idDmc')) : null))), { initialValue: null as number | null });
  /** Raccourci H3 depuis « Mes PPM & marchés » : `?dossier=` restreint le choix à un PPM, `?ligne=` ouvre la ligne d'emblée. */
  private readonly raccourci = toSignal(
    this.route.queryParamMap.pipe(map((q) => ({ dossier: q.get('dossier') ? Number(q.get('dossier')) : null, ligne: q.get('ligne') ? Number(q.get('ligne')) : null }))),
    { initialValue: { dossier: null as number | null, ligne: null as number | null } },
  );
  readonly filtreDossier = computed(() => this.raccourci().dossier);

  readonly loading = signal(true);
  readonly erreur = signal(false);
  readonly saving = signal(false);
  /** Le serveur ne sert pas (encore) le contrat : structure de l'esquisse à l'écran, rien n'est enregistrable. */
  readonly contratAbsent = signal(false);

  readonly eligibles = signal<LigneEligible[]>([]);
  /** Lignes montrées : celles du PPM demandé par le raccourci, sinon toutes. */
  readonly eligiblesAffichees = computed(() => {
    const d = this.filtreDossier();
    return d == null ? this.eligibles() : this.eligibles().filter((l) => l.idDossier === d);
  });
  readonly refDossierFiltre = computed(() => {
    const d = this.filtreDossier();
    const l = d == null ? null : this.eligibles().find((x) => x.idDossier === d);
    return l ? l.refeDossier || `#${l.idDossier}` : d == null ? null : `#${d}`;
  });
  readonly referentiel = signal<ReferentielFiche>(REFERENTIEL_ESQUISSE);
  readonly fiche = signal<FicheMarche | null>(null);
  /** Versions figées (`GET …/versions`, B5) — la plus récente en tête. */
  readonly versions = signal<VersionFiche[]>([]);
  readonly cadrage = signal<Cadrage>({ typeMarche: 'QUANTITE_FIXE' });
  readonly valeurs = signal<Record<string, Valeur>>({});
  readonly erreursChamp = signal<ReadonlyMap<string, string>>(new Map());
  /** 0..6 — index dans `ETAPES_FICHE`. */
  readonly etape = signal(0);
  readonly blocIdx = signal(0);

  readonly estPrmp = computed(() => this.auth.role() === 'PRMP');
  readonly typeMarche = computed<TypeMarche | null>(() => (this.cadrage()['typeMarche'] as TypeMarche | null) ?? null);
  readonly questions = computed(() => questionsPosees(this.cadrage()));
  readonly cadrageOk = computed(() => cadrageComplet(this.cadrage()));
  readonly resume = computed(() => resumeCadrage(this.cadrage()));
  readonly blocs = computed(() => blocsASaisir(this.referentiel(), this.typeMarche()));
  readonly blocCourant = computed<BlocFiche | null>(() => this.blocs()[this.blocIdx()] ?? null);
  readonly blocPpm = computed<BlocFiche | null>(() => this.referentiel().blocs.find((b) => b.code === 'B01') ?? null);
  readonly prog = computed(() => progression(this.referentiel(), this.cadrage(), this.valeurs()));
  readonly bilan = computed<BilanControles>(() => this.fiche()?.bilanControles ?? BILAN_VIDE);
  readonly reprisesListe = computed(() => reprises(this.referentiel(), this.cadrage(), this.valeurs(), this.fiche()?.valeursPpm ?? {}, this.fiche()?.valeursCadrage ?? {}));
  readonly figee = computed(() => this.fiche()?.statut === 'VALIDEE');
  /** Les 22 informations de la ligne, pour B01 (clé → valeur) ; libellé via le référentiel quand il est chargé. */
  readonly valeursPpm = computed(() => {
    const v = this.fiche()?.valeursPpm ?? {};
    const champs = this.referentiel().champs;
    return Object.keys(v).map((code) => ({ code, libelle: champs.find((c) => c.code === code)?.libelle ?? code, valeur: v[code] }));
  });

  constructor() {
    effect(() => {
      const id = this.idDmc();
      untracked(() => this.charger(id));
    });
  }

  charger(id: number | null = this.idDmc()): void {
    this.loading.set(true);
    this.erreur.set(false);
    this.contratAbsent.set(false);
    if (id == null) {
      this.dmcService
        .eligibles()
        .pipe(catchError((e: HttpErrorResponse) => (routeAbsente(e) ? (this.contratAbsent.set(true), of([] as LigneEligible[])) : (this.erreur.set(true), of([] as LigneEligible[])))))
        .subscribe((l) => {
          this.eligibles.set(l);
          this.loading.set(false);
          // `?ligne=` (raccourci H3) : la ligne demandée est éligible → on l'ouvre sans passer par la liste.
          const demandee = this.raccourci().ligne;
          const cible = demandee == null ? null : l.find((x) => x.idDetail === demandee);
          if (cible) this.choisirLigne(cible);
        });
      return;
    }
    forkJoin({
      ref: this.champService.referentiel('QUANTITE_FIXE').pipe(catchError(() => of(null))),
      fiche: this.ficheService.lire(id).pipe(catchError((e: HttpErrorResponse) => (routeAbsente(e) ? of(null) : (this.erreur.set(true), of(null))))),
      versions: this.ficheService.versions(id).pipe(catchError(() => of([] as VersionFiche[]))),
    }).subscribe(({ ref, fiche, versions }) => {
      if (ref && ref.blocs?.length) this.referentiel.set(ref);
      else this.contratAbsent.set(true);
      this.fiche.set(fiche);
      this.versions.set([...versions].sort((a, b) => b.version - a.version));
      if (fiche) {
        this.cadrage.set({ typeMarche: 'QUANTITE_FIXE', ...fiche.cadrage });
        this.valeurs.set({ ...fiche.valeurs });
        this.etape.set(fiche.statut === 'VALIDEE' ? 5 : cadrageComplet(fiche.cadrage) ? 2 : 1);
      } else {
        this.etape.set(1);
      }
      this.loading.set(false);
    });
  }

  // ── Étape 1 : la ligne du PPM ────────────────────────────────────────────────────────────────

  choisirLigne(l: LigneEligible): void {
    if (l.dejaDao && l.idDmc) {
      void this.router.navigate(['/prmp/dao', l.idDmc]);
      return;
    }
    this.saving.set(true);
    this.dmcService.creerParMarche(l.idDetail).subscribe({
      next: (dmc) => {
        this.saving.set(false);
        void this.router.navigate(['/prmp/dao', dmc.idDmc]);
      },
      error: () => this.saving.set(false), // 409 nominatif (déjà un DAO, mode non mappé, PPM non signé) → dialogue centralisé
    });
  }

  // ── Étape 2 : le cadrage ─────────────────────────────────────────────────────────────────────

  repondre(cle: string, valeur: Valeur): void {
    this.cadrage.update((c) => {
      const suivant: Cadrage = { ...c, [cle]: valeur };
      // Une question qui disparaît emporte sa réponse (et son complément) : le cadrage ne garde rien d'invisible.
      for (const q of QUESTIONS_CADRAGE) {
        if (q.si && String(suivant[q.si.cle] ?? '') !== q.si.valeur) delete suivant[q.cle];
        if (q.complement && String(suivant[q.cle] ?? '') !== q.complement.si) delete suivant[q.complement.cle];
      }
      return suivant;
    });
  }

  reponse(q: QuestionCadrage): string {
    return String(this.cadrage()[q.cle] ?? '');
  }

  complement(q: QuestionCadrage): Valeur {
    return q.complement ? (this.cadrage()[q.complement.cle] ?? null) : null;
  }

  enregistrerCadrage(): void {
    const id = this.idDmc();
    if (id == null || !this.cadrageOk() || this.saving()) return;
    this.saving.set(true);
    this.ficheService.cadrage(id, this.cadrage()).subscribe({
      next: (f) => {
        this.saving.set(false);
        this.appliquer(f);
        this.etape.set(2);
        this.blocIdx.set(0);
      },
      error: () => this.saving.set(false),
    });
  }

  // ── Étape 3 : les blocs ──────────────────────────────────────────────────────────────────────

  rubriquesOuvertes(bloc: BlocFiche): RubriqueFiche[] {
    const cadrage = this.cadrage();
    return [...bloc.rubriques].sort((a, b) => a.rang - b.rang).filter((r) => rubriqueOuverte(this.referentiel().champs, bloc.code, r, cadrage));
  }

  champs(bloc: BlocFiche, rubrique: RubriqueFiche): ChampFiche[] {
    return champsDeRubrique(this.referentiel().champs, bloc.code, rubrique.code, this.cadrage());
  }

  valeur(code: string): Valeur {
    return this.valeurs()[code] ?? null;
  }

  valeurAffichee(champ: ChampFiche): string {
    const f = this.fiche();
    const v = champ.source === 'PPM' ? (f?.valeursPpm?.[champ.code] ?? null) : champ.source === 'CADRAGE' ? (f?.valeursCadrage?.[champ.code] ?? null) : this.valeur(champ.code);
    return v == null ? '' : String(v);
  }

  /** `2026-09-22T10:05:00` → `22/09/2026 10:05` ; date seule → `22/09/2026` ; vide → `—`. */
  dateFr(iso: string | null | undefined): string {
    const m = (iso ?? '').match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/);
    if (!m) return '—';
    return `${m[3]}/${m[2]}/${m[1]}${m[4] ? ` ${m[4]}:${m[5]}` : ''}`;
  }

  /** Montant en toutes lettres, servi par le serveur après enregistrement (`enLettres[code]`). */
  lettres(code: string): string {
    return this.fiche()?.enLettres?.[code] ?? '';
  }

  saisir(champ: ChampFiche, ev: Event): void {
    const code = champ.code;
    const cible = ev.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const brut = cible.value;
    const numerique = champ.type === 'NOMBRE' || champ.type === 'MONTANT' || champ.type === 'POURCENTAGE';
    const valeur: Valeur = brut === '' ? null : numerique ? (Number.isFinite(Number(brut)) ? Number(brut) : brut) : brut;
    this.valeurs.update((v) => ({ ...v, [code]: valeur }));
    if (this.erreursChamp().has(code)) {
      this.erreursChamp.update((m) => {
        const n = new Map(m);
        n.delete(code);
        return n;
      });
    }
  }

  erreurDe(code: string): string | null {
    return this.erreursChamp().get(code) ?? null;
  }

  allerAuBloc(code: string): void {
    const i = this.blocs().findIndex((b) => b.code === code);
    if (i >= 0) {
      this.blocIdx.set(i);
      this.etape.set(2);
    }
  }

  /** Enregistre le bloc courant (`PUT …/blocs/{bloc}`) puis passe au suivant, ou aux reprises après le dernier. */
  enregistrerBloc(): void {
    const id = this.idDmc();
    const bloc = this.blocCourant();
    if (id == null || !bloc || this.saving()) return;
    const codes = new Set(this.referentiel().champs.filter((c) => c.bloc === bloc.code && c.source === 'SAISIE').map((c) => c.code));
    const valeurs: Record<string, Valeur> = {};
    for (const [code, v] of Object.entries(this.valeurs())) if (codes.has(code)) valeurs[code] = v;
    this.saving.set(true);
    this.ficheService.bloc(id, bloc.code, valeurs).subscribe({
      next: (f) => {
        this.saving.set(false);
        this.appliquer(f);
        this.erreursChamp.set(new Map());
        if (this.blocIdx() < this.blocs().length - 1) this.blocIdx.update((i) => i + 1);
        else this.etape.set(3);
      },
      error: (e: ApiError | HttpErrorResponse) => {
        this.saving.set(false);
        // 400 nominatifs par champ : posés sous chaque champ, jamais en toast (règle des justifications).
        const parChamp = erreursParChamp(e);
        if (e.status === 400 && parChamp.size) {
          this.erreursChamp.set(parChamp);
          this.toast.error(`${parChamp.size} champ(s) refusé(s) par le serveur — voir le bloc ${bloc.code}.`);
        } else {
          this.toast.error(e.message || 'Enregistrement impossible.');
        }
      },
    });
  }

  blocPrecedent(): void {
    if (this.blocIdx() > 0) this.blocIdx.update((i) => i - 1);
    else this.etape.set(1);
  }

  // ── Étapes 5 et 6 : contrôles, validation ─────────────────────────────────────────────────────

  controler(): void {
    const id = this.idDmc();
    if (id == null || this.saving()) return;
    this.saving.set(true);
    this.ficheService.controler(id).subscribe({
      next: (bilan) => {
        this.saving.set(false);
        this.fiche.update((f) => (f ? { ...f, bilanControles: bilan } : f));
        this.etape.set(4);
      },
      error: () => this.saving.set(false),
    });
  }

  valider(): void {
    const id = this.idDmc();
    if (id == null || this.saving() || this.bilan().bloquants.length) return;
    this.saving.set(true);
    this.ficheService.valider(id).subscribe({
      next: (f) => {
        this.saving.set(false);
        this.appliquer(f);
        // La version qui vient d'être figée rejoint l'historique sans relecture serveur.
        const entete: VersionFiche = { idFiche: f.idFiche ?? null, version: f.version, statut: f.statut, typeMarche: f.typeMarche, dateCreation: f.dateCreation, dateValidation: f.dateValidation, validePar: f.validePar, nbValeurs: Object.keys(f.valeurs ?? {}).length };
        this.versions.update((v) => [entete, ...v.filter((x) => x.version !== f.version)]);
        this.etape.set(6);
        this.toast.success(`Fiche marché validée — version ${f.version} figée. Les documents seront générés au lot 2.`);
      },
      error: () => this.saving.set(false),
    });
  }

  reviser(): void {
    const id = this.idDmc();
    if (id == null || this.saving()) return;
    this.saving.set(true);
    this.ficheService.reviser(id).subscribe({
      next: (f) => {
        this.saving.set(false);
        this.appliquer(f);
        this.etape.set(2);
        this.blocIdx.set(0);
      },
      error: () => this.saving.set(false),
    });
  }

  allerA(i: number): void {
    // Le rail ne remonte jamais avant la ligne, ni au-delà de ce que la fiche permet.
    if (i === 0) {
      void this.router.navigate(['/prmp/dao']);
      return;
    }
    if (!this.fiche() && i > 1) return;
    if (i >= 2 && !this.cadrageOk()) return;
    this.etape.set(i);
  }

  etatEtape(i: number): 'faite' | 'courante' | 'a-venir' {
    if (i === this.etape()) return 'courante';
    if (i < this.etape()) return 'faite';
    return 'a-venir';
  }

  montant(v: number | null | undefined): string {
    return v == null ? '—' : `${new Intl.NumberFormat('fr-FR').format(v)} Ar`;
  }

  private appliquer(f: FicheMarche): void {
    this.fiche.set(f);
    this.cadrage.set({ typeMarche: 'QUANTITE_FIXE', ...f.cadrage });
    this.valeurs.set({ ...f.valeurs });
  }
}
