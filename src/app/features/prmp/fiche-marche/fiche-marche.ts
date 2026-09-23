import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map, shareReplay, switchMap } from 'rxjs/operators';

import { AuthService } from '../../../core/auth/auth.service';
import { ouvrirBlobSur, telechargerBlob } from '../../../core/securite/fichiers-surs';
import { ApiError, erreursParChamp } from '../../../core/errors/api-error';
import { ToastService } from '../../../core/notifications/toast.service';
import { BilanControles, BlocFiche, Cadrage, ChampFiche, DocumentFiche, FicheMarche, LigneEligible, ReferentielFiche, RubriqueFiche, TypeMarche, VersionFiche } from '../../../models';
import { ChampFicheMarcheService, DmcService, FicheMarcheService } from '../../../services/fiche-marche.services';
import { EtatErreur } from '../../../shared/ui/etat-erreur';
import { Icone } from '../../../shared/ui/icone';
import { TitreSiTronqueDirective } from '../../../shared/ui/titre-si-tronque';
import {
  BILAN_VIDE,
  CLES_IMPOSEES_PAR_LE_PLAN,
  ETAPES_FICHE,
  LIBELLES_DOCUMENTS,
  LIBELLES_TYPES_MARCHE,
  NOMS_DOCUMENTS,
  QUESTIONS_CADRAGE,
  QuestionCadrage,
  REFERENTIEL_ESQUISSE,
  allotissementDuPlan,
  blocsASaisir,
  cadrageComplet,
  documentsProduits,
  champsDeRubrique,
  nbLotsDuPlan,
  progression,
  questionsPosees,
  reprises,
  resumeCadrage,
  rubriqueOuverte,
  typeOutille,
} from './fiche-marche-modele';

type Valeur = string | number | null;

/**
 * Le serveur ne sert pas (encore) la route : 404, 405, 501 — et 400, car aujourd'hui `GET /api/dmcs/eligibles`
 * tombe sur `GET /api/dmcs/{id}` de l'existant, qui refuse « eligibles » comme identifiant (constaté le 22/09).
 * Un 401/403 ou un 5xx restent des erreurs : ils ne parlent pas du contrat.
 */
/** Règle « champ obligatoire vide » du catalogue B4, seule ou portant un rôle (`REGLE:ROLE`). */
function estObligatoire(c: { regle?: string | null }): boolean {
  return (c.regle ?? '').split(':')[0] === 'OBLIGATOIRE';
}

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
  imports: [RouterLink, Icone, EtatErreur, TitreSiTronqueDirective],
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
  /**
   * ⚠️ Lot 2 (demande du 23/09) — documents de la version courante. Tant que la route n'est pas servie, la liste
   * reste vide et `documentsAttendus` est vrai : l'étape annonce ce qui viendra, sans faire croire à une panne.
   */
  readonly documents = signal<DocumentFiche[]>([]);
  readonly documentsAbsents = signal(false);
  /** Version figée dont on consulte les documents à l'étape 6, et ses documents (`GET …/documents?version=`). */
  readonly versionOuverte = signal<number | null>(null);
  readonly documentsVersion = signal<DocumentFiche[]>([]);
  readonly cadrage = signal<Cadrage>({});
  readonly valeurs = signal<Record<string, Valeur>>({});
  readonly erreursChamp = signal<ReadonlyMap<string, string>>(new Map());
  /** 0..6 — index dans `ETAPES_FICHE`. */
  readonly etape = signal(0);
  readonly blocIdx = signal(0);

  readonly estPrmp = computed(() => this.auth.role() === 'PRMP');
  /** ⚠️ Lot 1c — déduit de la forme du marché de la ligne du plan, servi par le serveur ; jamais saisi ici. */
  readonly typeMarche = computed<TypeMarche | null>(() => this.fiche()?.typeMarche ?? null);
  /** Ce type est-il pris en charge aujourd'hui ? Sinon la fiche se lit, mais toute écriture est refusée (409). */
  /**
   * ⚠️ Lot 3 §B2 — c'est le SERVEUR qui sait quels types il outille. Tant qu'il ne le dit pas, on retombe sur la
   * liste du front, qui disparaîtra à la livraison : ouvrir un type deviendra une livraison backend seule.
   */
  readonly typePrisEnCharge = computed(() => this.fiche()?.typeOutille ?? typeOutille(this.typeMarche()));
  /** La fiche a été saisie sous un type qui n'est plus celui du plan (drapeau serveur). */
  readonly typeChange = computed(() => this.fiche()?.typeChange === true);
  /** Toute écriture est vaine : contrat absent, ou forme de marché pas encore prise en charge (409 côté serveur). */
  readonly ecritureBloquee = computed(() => this.contratAbsent() || !this.typePrisEnCharge());
  /**
   * Cadrage **augmenté du type** pour les règles pures : les conditions d'affichage et la question des
   * attributaires s'y réfèrent. Le type n'est jamais renvoyé au serveur — voir `enregistrerCadrage`.
   */
  private readonly cadrageEffectif = computed<Cadrage>(() => ({ ...this.cadrage(), typeMarche: this.typeMarche() }));
  readonly questions = computed(() => questionsPosees(this.cadrageEffectif()));
  readonly cadrageOk = computed(() => cadrageComplet(this.cadrageEffectif()));
  readonly resume = computed(() => resumeCadrage(this.cadrageEffectif()));
  readonly blocs = computed(() => blocsASaisir(this.referentiel(), this.typeMarche()));
  readonly blocCourant = computed<BlocFiche | null>(() => this.blocs()[this.blocIdx()] ?? null);
  readonly blocPpm = computed<BlocFiche | null>(() => this.referentiel().blocs.find((b) => b.code === 'B01') ?? null);
  readonly prog = computed(() => progression(this.referentiel(), this.cadrageEffectif(), this.valeurs()));
  readonly bilan = computed<BilanControles>(() => this.fiche()?.bilanControles ?? BILAN_VIDE);
  /**
   * ⚠️ 23/09 — un « obligatoire » n'est pas une anomalie : c'est une saisie qui **reste à faire**. Sur une fiche
   * neuve, le serveur en renvoie plus de cinquante, qui noyaient les vrais écarts de cohérence. On les sépare :
   * les anomalies se lisent une par une, les obligatoires se comptent par bloc.
   */
  readonly anomalies = computed(() => this.bilan().bloquants.filter((c) => !estObligatoire(c)));
  readonly obligatoiresParBloc = computed(() => {
    const n = new Map<string, number>();
    for (const c of this.bilan().bloquants.filter(estObligatoire)) n.set(c.bloc ?? '—', (n.get(c.bloc ?? '—') ?? 0) + 1);
    return [...n].sort(([a], [b]) => a.localeCompare(b)).map(([bloc, nb]) => ({ bloc, nb }));
  });
  readonly nbObligatoires = computed(() => this.obligatoiresParBloc().reduce((s, g) => s + g.nb, 0));
  readonly blocsRestants = computed(() => this.obligatoiresParBloc().map((g) => g.bloc).join(', '));
  readonly reprisesListe = computed(() => reprises(this.referentiel(), this.cadrageEffectif(), this.valeurs(), this.fiche()?.valeursPpm ?? {}, this.fiche()?.valeursCadrage ?? {}));
  readonly figee = computed(() => this.fiche()?.statut === 'VALIDEE');

  /**
   * ⚠️ Demande du pilote (23/09) — l'allotissement vient du **nombre de lots du plan** : un lot = non alloti, deux
   * et plus = alloti. La question reste affichée (la PRMP doit voir la réponse qui vaut pour son marché) mais elle
   * est **verrouillée**, et le nombre de lots est celui du plan. Même principe que le type de marché (lot 1c).
   */
  readonly nbLotsPlan = computed(() => nbLotsDuPlan(this.referentiel(), this.fiche()?.valeursPpm));
  /** Les documents que cette fiche produira, lus du référentiel de son type — jamais annoncés en dur. */
  readonly documentsDeLaFiche = computed(() => documentsProduits(this.referentiel(), this.typeMarche()));
  /** « DPAC · AE », « DPAO · AE · CCAP »… pour le rail ; vide si le référentiel n'est pas encore là. */
  readonly documentsCourt = computed(() => this.documentsDeLaFiche().join(' · '));
  /** « le DPAC et l'acte d'engagement », en toutes lettres. */
  readonly documentsEnToutesLettres = computed(() => {
    const noms = this.documentsDeLaFiche().map((d) => NOMS_DOCUMENTS[d]);
    if (!noms.length) return 'les documents du dossier';
    if (noms.length === 1) return noms[0];
    return noms.slice(0, -1).join(', ') + ' et ' + noms[noms.length - 1];
  });
  readonly allotiImpose = computed(() => allotissementDuPlan(this.nbLotsPlan()));
  /** Une fiche **validée** est un enregistrement : on n'y réécrit rien, on montre ce qui a été figé. */
  readonly allotiVerrouille = computed(() => !this.figee() && this.allotiImpose() !== null);
  /** Le cadrage enregistré contredit le plan : la PRMP doit réenregistrer pour l'aligner. */
  readonly allotiCorrige = computed(() => {
    const impose = this.allotiImpose();
    const stocke = this.fiche()?.cadrage;
    if (!impose || !stocke || this.figee()) return false;
    return stocke['alloti'] != null && String(stocke['alloti']) !== impose.alloti;
  });
  /** Lot 1b — dossier soumis produit par cette fiche (`null` tant qu'il n'existe pas). */
  readonly idDossierSoumis = computed(() => this.fiche()?.idDossierSoumis ?? null);
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
    // ⚠️ 23/09 (lot 4) — le référentiel suit le TYPE DE LA FICHE, il ne peut plus être demandé en quantité fixe :
    // le contrat-cadre a ses propres blocs, rubriques et champs. La fiche est donc lue une fois, partagée, et le
    // référentiel la suit ; les versions et les documents partent en parallèle, une seule vague à l'arrivée.
    const fiche$ = this.ficheService
      .lire(id)
      .pipe(
        catchError((e: HttpErrorResponse) => (routeAbsente(e) ? of(null) : (this.erreur.set(true), of(null)))),
        shareReplay(1),
      );
    forkJoin({
      ref: fiche$.pipe(
        switchMap((f) => this.champService.referentiel(f?.typeMarche ?? 'QUANTITE_FIXE')),
        catchError(() => of(null)),
      ),
      fiche: fiche$,
      versions: this.ficheService.versions(id).pipe(catchError(() => of([] as VersionFiche[]))),
      docs: this.ficheService.documents(id).pipe(catchError(() => of(null))),
    }).subscribe(({ ref, fiche, versions, docs }) => {
      this.documents.set(docs ?? []);
      this.documentsAbsents.set(docs === null);
      if (ref && ref.blocs?.length) this.referentiel.set(ref);
      else this.contratAbsent.set(true);
      this.fiche.set(fiche);
      this.versions.set([...versions].sort((a, b) => b.version - a.version));
      if (fiche) {
        this.cadrage.set({ ...fiche.cadrage });
        this.valeurs.set({ ...fiche.valeurs });
        this.imposerAllotissement();
        this.etape.set(fiche.statut === 'VALIDEE' ? 5 : cadrageComplet({ ...fiche.cadrage, typeMarche: fiche.typeMarche }) ? 2 : 1);
      } else {
        this.etape.set(1);
      }
      this.loading.set(false);
    });
  }

  // ── Étape 1 : la ligne du PPM ────────────────────────────────────────────────────────────────

  /** Libellé de la forme d'une ligne éligible (lot 1c) ; vide si le serveur ne la sert pas encore. */
  formeDe(l: LigneEligible): string {
    return l.formeMarche ? this.libellesTypes[l.formeMarche] : '';
  }
  /** Une ligne dont la forme n'est pas prise en charge se voit, mais ne se prépare pas. */
  ligneBloquee(l: LigneEligible): boolean {
    return l.formeOutillee === false;
  }

  choisirLigne(l: LigneEligible): void {
    if (this.ligneBloquee(l) && !l.dejaDao) return;
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
    // Une réponse imposée par le plan ne se change pas d'un clic : elle se corrige dans le plan de passation.
    if (this.imposee(cle)) return;
    const type = this.typeMarche();
    this.cadrage.update((c) => {
      const suivant: Cadrage = { ...c, [cle]: valeur };
      // ⚠️ 23/09 (lot 4) — l'élagage se juge sur le cadrage EFFECTIF, type de marché compris. Le type a quitté le
      // cadrage au lot 1c : le tester dans `suivant` effaçait aussitôt toute réponse à une question conditionnée au
      // type — « mono ou multi-attributaire » ne pouvait littéralement pas être répondue.
      const effectif: Cadrage = { ...suivant, typeMarche: type };
      // Une question qui disparaît emporte sa réponse (et son complément) : le cadrage ne garde rien d'invisible.
      for (const q of QUESTIONS_CADRAGE) {
        if (q.si && String(effectif[q.si.cle] ?? '') !== q.si.valeur) delete suivant[q.cle];
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
    // ⚠️ Lot 1c — `this.cadrage()` ne porte QUE les réponses : le type vient du plan et n'est pas renvoyé.
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
    const cadrage = this.cadrageEffectif();
    return [...bloc.rubriques].sort((a, b) => a.rang - b.rang).filter((r) => rubriqueOuverte(this.referentiel().champs, bloc.code, r, cadrage));
  }

  champs(bloc: BlocFiche, rubrique: RubriqueFiche): ChampFiche[] {
    return champsDeRubrique(this.referentiel().champs, bloc.code, rubrique.code, this.cadrageEffectif());
  }

  valeur(code: string): Valeur {
    return this.valeurs()[code] ?? null;
  }

  valeurAffichee(champ: ChampFiche): string {
    const f = this.fiche();
    const v = champ.source === 'PPM' ? (f?.valeursPpm?.[champ.code] ?? null) : champ.source === 'CADRAGE' ? (f?.valeursCadrage?.[champ.code] ?? null) : this.valeur(champ.code);
    return v == null ? '' : champ.source === 'CADRAGE' ? this.libelleCadrage(champ, v) : String(v);
  }

  /** Un champ reflet du cadrage montre le libellé de la réponse (« Territoire national »), pas son code (`NATIONAL`). */
  libelleCadrage(champ: ChampFiche, v: unknown): string {
    const q = QUESTIONS_CADRAGE.find((x) => x.cle === champ.cleCadrage);
    return q?.options.find((o) => o.code === String(v))?.libelle ?? String(v);
  }

  affichageReprise(r: { champ: ChampFiche; valeur: unknown }): string {
    if (r.valeur == null || r.valeur === '') return '—';
    return r.champ.source === 'CADRAGE' ? this.libelleCadrage(r.champ, r.valeur) : String(r.valeur);
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
        this.toast.success(`Fiche marché validée — version ${f.version} figée.`);
        // Lot 2 : la validation produit les documents ; on les relit pour les offrir tout de suite.
        this.ficheService.documents(id).pipe(catchError(() => of(null))).subscribe((d) => {
          this.documents.set(d ?? []);
          this.documentsAbsents.set(d === null);
        });
      },
      error: () => this.saving.set(false),
    });
  }

  /**
   * Ouvre (ou referme) les documents d'une version figée. La version courante d'une fiche validée porte déjà
   * ses documents à l'étape 7 : on lit ici ceux des versions PRÉCÉDENTES, que la Commission a pu examiner.
   */
  ouvrirVersion(v: VersionFiche): void {
    const id = this.idDmc();
    if (id == null) return;
    if (this.versionOuverte() === v.version) {
      this.versionOuverte.set(null);
      this.documentsVersion.set([]);
      return;
    }
    this.versionOuverte.set(v.version);
    this.documentsVersion.set([]);
    this.ficheService.documents(id, v.version).pipe(catchError(() => of([] as DocumentFiche[]))).subscribe((d) => {
      if (this.versionOuverte() === v.version) this.documentsVersion.set(d);
    });
  }

  /** Taille lisible d'un document ; vide si le serveur ne la sert pas. */
  poids(o: number | null | undefined): string {
    if (o == null) return '';
    return o < 1024 * 1024 ? `${Math.round(o / 1024)} ko` : `${(o / (1024 * 1024)).toFixed(1)} Mo`;
  }

  /**
   * Enregistre ou ouvre un document généré. ⚠️ Toujours par `fichiers-surs` : un blob servi par le serveur ne
   * s'ouvre jamais par un `URL.createObjectURL` brut (règle de l'audit, tenue par ESLint).
   */
  obtenirDocument(d: DocumentFiche, ouvrir: boolean): void {
    if (this.saving()) return;
    this.saving.set(true);
    this.ficheService.contenuDocument(d.idDocument).subscribe({
      next: (blob) => {
        this.saving.set(false);
        if (ouvrir) ouvrirBlobSur(blob);
        else telechargerBlob(blob, d.nomFichier);
      },
      error: () => {
        this.saving.set(false);
        this.toast.error('Document indisponible — réessayez, ou régénérez-le en validant une nouvelle version.');
      },
    });
  }

  /**
   * ⚠️ Lot 1b (23/09) — la fiche **produit** le dossier soumis à la Commission, puis on y va. Un 409
   * `DOSSIER_EXISTANT` n'est pas une erreur pour l'utilisateur : le dossier existe, on l'ouvre (son numéro est dans
   * le corps du refus). Les autres refus gardent leur message serveur.
   */
  creerDossier(): void {
    const id = this.idDmc();
    if (id == null || this.saving()) return;
    this.saving.set(true);
    this.ficheService.creerDossier(id).subscribe({
      next: (d) => {
        this.saving.set(false);
        this.fiche.update((f) => (f ? { ...f, idDossierSoumis: d.idDossier } : f));
        void this.router.navigate(['/prmp/dossier', d.idDossier]);
      },
      error: (e: ApiError) => {
        this.saving.set(false);
        const deja = e.code === 'DOSSIER_EXISTANT' ? Number((e.raw?.error as { idDossier?: number } | null)?.idDossier) : NaN;
        if (Number.isFinite(deja)) {
          this.fiche.update((f) => (f ? { ...f, idDossierSoumis: deja } : f));
          void this.router.navigate(['/prmp/dossier', deja]);
        } else {
          this.toast.error(e.message || 'Le dossier n’a pas pu être créé.');
        }
      },
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
    this.cadrage.set({ ...f.cadrage });
    this.valeurs.set({ ...f.valeurs });
    this.imposerAllotissement();
  }

  /**
   * Aligne le cadrage local sur le plan. Rien n'est écrit au serveur ici : la PRMP voit la bonne réponse, et
   * l'enregistrement du cadrage la porte. Une fiche figée est laissée telle quelle — c'est un enregistrement.
   */
  private imposerAllotissement(): void {
    const impose = this.allotiImpose();
    if (!impose || this.figee()) return;
    this.cadrage.update((c) => {
      const suivant: Cadrage = { ...c, alloti: impose.alloti };
      if (impose.nbLots != null) suivant['nbLots'] = impose.nbLots;
      else delete suivant['nbLots'];
      return suivant;
    });
  }

  /** Cette réponse vient-elle du plan ? Alors elle ne se modifie pas ici. */
  imposee(cle: string): boolean {
    return this.allotiVerrouille() && CLES_IMPOSEES_PAR_LE_PLAN.includes(cle);
  }
}
