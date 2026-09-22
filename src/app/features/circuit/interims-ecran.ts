import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { AuthService } from '../../core/auth/auth.service';
import { libelleRole, roleDuLibelleProfil } from '../../core/auth/libelles-profils';
import { ApiError } from '../../core/errors/api-error';
import {
  LIBELLES_MOTIFS_INTERIM,
  LIBELLES_STATUTS_INTERIM,
  aujourdHuiIso,
  dateFr,
  interimairesAdmissibles,
  nomControleur,
  periodeInterim,
  peutRevoquer,
  titulairesPossibles,
} from '../../core/interim/interim-libelles';
import { InterimStore } from '../../core/interim/interim.store';
import { ToastService } from '../../core/notifications/toast.service';
import { TYPES_PDF, ouvrirBlobSur, validerFichier } from '../../core/securite/fichiers-surs';
import { Controleur, Interim, MotifInterim, Role } from '../../models';
import { ControleurService, InterimService, LocaliteService, ProfileService } from '../../services';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { fermerAvecAnimation } from '../../shared/a11y/fermeture-animee';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { Icone } from '../../shared/ui/icone';

/** Taille plafond de la pièce (PDF), alignée sur le serveur (10 Mo, type lu sur les octets). */
const PIECE_MAX_MO = 10;
const MOTIFS: readonly MotifInterim[] = ['CONGE', 'MISSION', 'MALADIE', 'VACANCE_POSTE', 'AUTRE'];

/**
 * **Intérim désigné** (demande `docs/demande-backend-2026-09-21-gestion-interim.md`, backend `e867082`,
 * ADR-0008) — « X (titulaire) est absent du D1 au D2 ; Y (intérimaire) agit à sa place, dans SON périmètre,
 * sous sa PROPRE identité ». Un même écran, deux montages :
 *  - **« Mon intérim »** chez le Président et le Chef de commission (`/<espace>/interim`) : le titulaire
 *    désigne LUI-MÊME son intérimaire (arbitrage pilote Q1 : Président ← tout CC ; CC ← autre CC de sa
 *    localité ou Membre de sa localité), pièce PDF obligatoire, révocation ; il voit aussi les intérims
 *    qu'il exerce (un CC peut suppléer le Président) ;
 *  - **« Intérims »** chez l'Administrateur (`/admin/comptes/interims`, `data.admin`) : tout l'historique,
 *    désignation et révocation EN REPLI pour tout titulaire (§B3, implémenté serveur).
 * Calqué sur les mandats PRMP (période, référence, indélébile : ni PUT ni DELETE, statut dérivé serveur).
 * Le serveur reste l'autorité : 403 / 409 nominatifs (dialogue centralisé) ; l'écran ne fait que proposer
 * des choix valides (`interimairesAdmissibles`, miroir de la garde).
 */
@Component({
  selector: 'app-interims-ecran',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective, ReactiveFormsModule, EtatErreur, Icone],
  template: `
    <section class="it">
      <header class="page-header">
        <div>
          <div class="page-subtitle">{{ admin ? 'Comptes & hiérarchie' : 'Organisation' }}</div>
          <h1 class="page-title">{{ admin ? 'Intérims des contrôleurs' : 'Mon intérim' }}</h1>
        </div>
        @if (peutDesigner()) {
          <button type="button" class="btn btn-primary" (click)="ouvrirDesignation()">+ Désigner un intérimaire</button>
        }
      </header>
      <p class="it__intro">
        @if (admin) {
          Un intérim désigne <strong>qui agit à la place d'un Président ou d'un Chef de commission absent</strong>,
          pour une période, sur pièce. Le titulaire le déclare lui-même ; vous pouvez le faire <strong>en repli</strong>
          pour un absent qui n'a rien déclaré. Un intérim ne se modifie ni ne s'efface : une fin avant terme est une
          <strong>révocation</strong>, une prolongation un nouvel intérim.
        } @else {
          Absent pour une période ? Désignez <strong>qui agit à votre place</strong> — vos dossiers et vos actions lui
          seront ouverts, sous son nom, tracés « par intérim de vous » ; vous gardez les vôtres et vos notifications
          lui sont copiées. Une note de service (PDF) est obligatoire. Un intérim ne se modifie pas : une fin avant
          terme est une <strong>révocation</strong>, une prolongation un nouvel intérim.
        }
      </p>

      @if (!admin) {
        <div class="it__cartes">
          @if (store.subi(); as s) {
            <div class="it__carte it__carte--subi">
              <app-icone nom="users" [taille]="18" />
              <div>
                <b>Vous êtes suppléé par {{ s.nomInterimaire }}</b>
                <span>{{ periode(s) }} · {{ motifLabel(s.motif) }} · réf. {{ s.reference }}</span>
              </div>
            </div>
          }
          @for (i of store.exerces(); track i.idInterim) {
            <div class="it__carte it__carte--exerce">
              <app-icone nom="users" [taille]="18" />
              <div>
                <b>Vous suppléez {{ i.nomTitulaire }}</b>
                <span>{{ libelleRole(i.profilTitulaire) }}{{ localiteSuffixe(i.idLocaliteTitulaire) }} · {{ periode(i) }}</span>
              </div>
            </div>
          }
          @if (!store.subi() && !store.exerces().length) {
            <p class="it__aucun">Aucun intérim en cours aujourd'hui.</p>
          }
        </div>
      }

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else if (erreur()) {
        <app-etat-erreur (reessayer)="charger()" />
      } @else {
        <div class="table-card">
          <table>
            <thead>
              <tr>
                <th scope="col">Titulaire absent</th>
                <th scope="col">Intérimaire</th>
                <th scope="col">Période</th>
                <th scope="col">Motif</th>
                <th scope="col">Référence</th>
                <th scope="col">Statut</th>
                <th scope="col">Désigné par</th>
                <th scope="col" class="r">Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (i of interimsAffiches(); track i.idInterim) {
                <tr>
                  <td>
                    <span class="it__nom">{{ i.nomTitulaire }}</span>
                    <span class="it__sous">{{ libelleRole(i.profilTitulaire) }}{{ localiteSuffixe(i.idLocaliteTitulaire) }}</span>
                  </td>
                  <td>
                    <span class="it__nom">{{ i.nomInterimaire }}</span>
                    <span class="it__sous">{{ libelleRole(i.profilInterimaire) }}{{ localiteSuffixe(i.idLocaliteInterimaire) }}</span>
                  </td>
                  <td class="it__c">{{ periode(i) }}</td>
                  <td>{{ motifLabel(i.motif) }}</td>
                  <td>
                    {{ i.reference }}
                    @if (i.pieceDisponible) {
                      <button type="button" class="btn btn-outline btn-sm it__piece" (click)="ouvrirPiece(i)" [attr.aria-label]="'Ouvrir la pièce de l’intérim ' + i.reference">
                        <app-icone nom="clip" [taille]="13" />Pièce
                      </button>
                    }
                  </td>
                  <td>
                    <span class="badge it__statut it__statut--{{ i.statut.toLowerCase() }}">{{ statutLabel(i.statut) }}</span>
                    @if (i.statut === 'REVOQUE' && i.motifRevocation) {
                      <span class="it__sous" [title]="i.motifRevocation">{{ dateFr(i.dateRevocation) }} — {{ i.motifRevocation }}</span>
                    }
                  </td>
                  <td>
                    <span class="it__nom">{{ i.nomDesignePar || i.designePar }}</span>
                    <span class="it__sous">{{ dateFr(i.dateDesignation) }}</span>
                  </td>
                  <td>
                    <div class="td-actions it__actions">
                      @if (peutRevoquer(i)) {
                        <button type="button" class="btn btn-danger btn-sm" (click)="ouvrirRevocation(i)">Révoquer</button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="8" class="it__empty">Aucun intérim.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </section>

    <!-- Désignation : titulaire (soi, ou tout P/CC pour l'Admin), intérimaire admissible, période, motif, référence, pièce PDF. -->
    @if (designationOuverte()) {
      <div class="modal-backdrop" [class.closing]="closingDesignation()">
        <form class="modal confirm-modal cnm-form" [formGroup]="form" (ngSubmit)="designer()" role="dialog" aria-modal="true" aria-label="Désignation d'un intérimaire" appModale (appModaleFermer)="fermerDesignationAnime()" novalidate>
          <div class="modal-header-plain"><span class="modal-title">Désigner un intérimaire</span></div>
          <div class="modal-body">
            @if (admin) {
              <label class="form-group">
                <span class="form-label required">Titulaire absent</span>
                <select class="form-control" formControlName="imTitulaire">
                  <option value="" disabled>— Choisir —</option>
                  @for (t of titulaires(); track t.imControleur) {
                    <option [value]="t.imControleur">{{ nom(t) }} — {{ libelleRole(roleDe(t)) }}{{ localiteSuffixe(t.idLocalite) }}</option>
                  }
                </select>
              </label>
            } @else {
              <p class="it__moi">Titulaire absent : <strong>{{ auth.nomAffichage() || moi }}</strong> (vous).</p>
            }
            <label class="form-group">
              <span class="form-label required">Intérimaire</span>
              <select class="form-control" formControlName="imInterimaire">
                <option value="" disabled>— Choisir —</option>
                @for (c of admissibles(); track c.imControleur) {
                  <option [value]="c.imControleur">{{ nom(c) }} — {{ libelleRole(roleDe(c)) }}{{ localiteSuffixe(c.idLocalite) }}</option>
                }
              </select>
              <span class="form-hint">{{ aideAdmissibles() }}</span>
            </label>
            <div class="it__dates">
              <label class="form-group">
                <span class="form-label required">Du</span>
                <input class="form-control" type="date" formControlName="dateDebut" />
              </label>
              <label class="form-group">
                <span class="form-label" [class.required]="finRequise()">Au</span>
                <input class="form-control" type="date" formControlName="dateFin" />
                @if (!finRequise()) { <span class="form-hint">Facultatif pour une vacance de poste.</span> }
              </label>
            </div>
            <label class="form-group">
              <span class="form-label required">Motif</span>
              <select class="form-control" formControlName="motif">
                @for (m of motifs; track m) { <option [value]="m">{{ motifLabel(m) }}</option> }
              </select>
            </label>
            <label class="form-group">
              <span class="form-label required">Référence de la note de service</span>
              <input class="form-control" type="text" formControlName="reference" maxlength="100" />
            </label>
            <label class="form-group">
              <span class="form-label required">Pièce (PDF, {{ pieceMaxMo }} Mo au plus)</span>
              <input class="form-control" type="file" accept="application/pdf" (change)="choisirPiece($event)" />
              @if (pieceErreur()) { <span class="form-error">{{ pieceErreur() }}</span> }
              <span class="form-hint">La note de service ou la décision qui désigne l'intérimaire ; elle reste consultable par la commission.</span>
            </label>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" (click)="fermerDesignationAnime()">Annuler</button>
            <button type="submit" class="btn btn-primary" [disabled]="saving() || form.invalid || !piece() || (finRequise() && !form.controls.dateFin.value)">
              {{ saving() ? 'Enregistrement…' : 'Désigner' }}
            </button>
          </div>
        </form>
      </div>
    }

    <!-- Révocation : fin avant terme, motif obligatoire ; effet à la requête suivante de l'intérimaire. -->
    @if (revocation(); as i) {
      <div class="modal-backdrop" [class.closing]="closingRevocation()">
        <form class="modal confirm-modal cnm-form" [formGroup]="formRevocation" (ngSubmit)="revoquer(i)" role="alertdialog" aria-modal="true" aria-label="Révocation de l'intérim" appModale (appModaleFermer)="fermerRevocationAnime()" novalidate>
          <div class="modal-header-plain"><span class="modal-title">Révoquer l'intérim de {{ i.nomInterimaire }}</span></div>
          <div class="modal-body">
            <p class="text-muted">
              {{ i.nomInterimaire }} cesse d'agir pour {{ i.nomTitulaire }} <strong>dès la date choisie</strong> (au plus tôt
              aujourd'hui). Les actes déjà posés restent les siens, tracés « par intérim ». L'intérim reste dans l'historique.
            </p>
            <label class="form-group">
              <span class="form-label required">Motif</span>
              <textarea class="form-control" rows="3" formControlName="motif" maxlength="255"></textarea>
            </label>
            <label class="form-group">
              <span class="form-label">Date d'effet (défaut : aujourd'hui)</span>
              <input class="form-control" type="date" formControlName="dateRevocation" />
            </label>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-outline" (click)="fermerRevocationAnime()">Annuler</button>
            <button type="submit" class="btn btn-danger" [disabled]="saving() || formRevocation.invalid">{{ saving() ? 'Révocation…' : 'Révoquer' }}</button>
          </div>
        </form>
      </div>
    }
  `,
  styles: `
    .it { display: flex; flex-direction: column; gap: 1rem; }
    .it__intro { margin: -0.4rem 0 0; color: var(--n-500); max-width: 62rem; }
    .it__cartes { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    .it__carte { display: flex; gap: 0.6rem; align-items: flex-start; padding: 0.7rem 0.9rem; border-radius: 10px; border: 1px solid var(--n-200, #e0e6f0); background: #fff; min-width: 18rem; }
    .it__carte div { display: flex; flex-direction: column; gap: 0.15rem; }
    .it__carte span { font-size: var(--text-sm, 0.85rem); color: var(--n-500); }
    .it__carte--subi { border-color: var(--warning-text, #b45309); }
    .it__carte--exerce { border-color: var(--c-600, #0284c7); }
    .it__aucun { margin: 0; color: var(--n-500); }
    .it__nom { display: block; font-weight: 600; color: var(--c-800); }
    .it__sous { display: block; font-size: var(--text-xs); color: var(--n-500); max-width: 16rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .it__c { white-space: nowrap; font-variant-numeric: tabular-nums; }
    .it__piece { margin-left: 0.4rem; display: inline-flex; align-items: center; gap: 0.25rem; }
    .it__actions { justify-content: flex-end; }
    .it__empty { text-align: center; color: var(--n-400); padding: 1.5rem; }
    .it__moi { margin: 0 0 0.75rem; }
    .it__dates { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .it__statut--actif { background: var(--success-bg, #dcfce7); color: var(--success-text, #16a34a); }
    .it__statut--a_venir { background: var(--info-bg, #e0f2fe); color: var(--info-text, #075985); }
    .it__statut--acheve { background: var(--n-100); color: var(--n-500); }
    .it__statut--revoque { background: var(--danger-bg, #fee2e2); color: var(--danger-text, #dc2626); }
    @media (max-width: 640px) { .it__dates { grid-template-columns: 1fr; } }
  `,
})
export class InterimsEcran implements OnInit {
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  readonly store = inject(InterimStore);
  private readonly interimService = inject(InterimService);
  private readonly controleurService = inject(ControleurService);
  private readonly profileService = inject(ProfileService);
  private readonly localiteService = inject(LocaliteService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  /** Montage Administrateur (`data.admin`) : tout l'historique, désignation et révocation en repli. */
  readonly admin = !!this.route.snapshot.data['admin'];
  readonly moi = this.auth.ref();
  readonly motifs = MOTIFS;
  readonly pieceMaxMo = PIECE_MAX_MO;

  readonly loading = signal(true);
  readonly erreur = signal(false);
  readonly saving = signal(false);
  readonly interims = signal<Interim[]>([]);
  readonly controleurs = signal<Controleur[]>([]);
  private readonly roleParProfil = signal<ReadonlyMap<number, Role>>(new Map());
  private readonly localites = signal<ReadonlyMap<string, string>>(new Map());

  readonly designationOuverte = signal(false);
  readonly closingDesignation = signal(false);
  readonly revocation = signal<Interim | null>(null);
  readonly closingRevocation = signal(false);
  readonly piece = signal<File | null>(null);
  readonly pieceErreur = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    imTitulaire: ['', Validators.required],
    imInterimaire: ['', Validators.required],
    dateDebut: [aujourdHuiIso(), Validators.required],
    dateFin: [''],
    motif: ['CONGE' as MotifInterim, Validators.required],
    reference: ['', Validators.required],
  });
  readonly formRevocation = this.fb.nonNullable.group({
    motif: ['', Validators.required],
    dateRevocation: [''],
  });
  /** Valeurs suivies du formulaire (les `computed` ne lisent pas un contrôle réactif). */
  private readonly titulaireChoisi = signal('');
  private readonly motifChoisi = signal<MotifInterim>('CONGE');

  /** Historique, le plus récent en tête (le serveur sert l'ordre chronologique). */
  readonly interimsAffiches = computed(() => [...this.interims()].reverse());
  /** Le P/CC désigne pour lui-même ; l'Admin pour tout titulaire. Les autres profils n'ont pas cet écran. */
  readonly peutDesigner = computed(() => this.admin || this.auth.role() === 'PRESIDENT' || this.auth.role() === 'CHEF_COMMISSION');
  readonly titulaires = computed(() => titulairesPossibles(this.controleurs(), (c) => this.roleDe(c)));
  private readonly titulaire = computed(() => this.controleurs().find((c) => c.imControleur === (this.admin ? this.titulaireChoisi() : this.moi)) ?? null);
  readonly admissibles = computed(() => interimairesAdmissibles(this.titulaire(), this.controleurs(), (c) => this.roleDe(c)));
  readonly finRequise = computed(() => this.motifChoisi() !== 'VACANCE_POSTE');
  readonly aideAdmissibles = computed(() => {
    const t = this.titulaire();
    if (!t) return this.admin ? "Choisissez d'abord le titulaire." : '';
    return this.roleDe(t) === 'PRESIDENT'
      ? 'Le Président est suppléé par un Chef de commission, de toute localité.'
      : 'Un Chef de commission est suppléé par un autre Chef de commission de sa localité, ou par un Membre de sa localité.';
  });

  constructor() {
    this.form.controls.imTitulaire.valueChanges.subscribe((v) => {
      this.titulaireChoisi.set(v);
      this.form.controls.imInterimaire.setValue('');
    });
    this.form.controls.motif.valueChanges.subscribe((m) => this.motifChoisi.set(m));
  }

  ngOnInit(): void {
    this.charger();
  }

  /** Une seule vague : historique (les miens, ou tout pour l'Admin) + annuaire + profils + localités. */
  charger(): void {
    this.loading.set(true);
    this.erreur.set(false);
    const historique$ = this.admin
      ? this.interimService.historique()
      : forkJoin({
          titulaire: this.interimService.historique({ titulaire: this.moi ?? undefined }),
          interimaire: this.interimService.historique({ interimaire: this.moi ?? undefined }),
        }).pipe(
          map(({ titulaire, interimaire }) => {
            const vus = new Set<number>();
            return [...titulaire, ...interimaire].filter((i) => (vus.has(i.idInterim) ? false : (vus.add(i.idInterim), true)));
          }),
        );
    forkJoin({
      interims: historique$,
      controleurs: this.controleurService.list(),
      profils: this.profileService.list(),
      localites: this.localiteService.list().pipe(catchError(() => of([]))),
    }).subscribe({
      next: ({ interims, controleurs, profils, localites }) => {
        const roles = new Map<number, Role>();
        for (const p of profils) {
          const r = roleDuLibelleProfil(p.profile);
          if (r) roles.set(p.idProfile, r);
        }
        this.roleParProfil.set(roles);
        this.localites.set(new Map(localites.map((l) => [l.idLocalite, l.libelleLocalite])));
        this.controleurs.set(controleurs);
        this.interims.set(interims);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
  }

  roleDe(c: Controleur): Role | null {
    return c.idProfile != null ? (this.roleParProfil().get(c.idProfile) ?? null) : null;
  }
  nom(c: Controleur): string {
    return nomControleur(c);
  }
  libelleRole(role: Role | string | null | undefined): string {
    return libelleRole(role);
  }
  /** « · Antananarivo » — rien pour le Président (sans localité). */
  localiteSuffixe(id: string | null | undefined): string {
    if (!id) return '';
    return ` · ${this.localites().get(id) ?? id}`;
  }
  periode(i: Interim): string {
    return periodeInterim(i);
  }
  dateFr(iso: string | null | undefined): string {
    return dateFr(iso);
  }
  motifLabel(m: MotifInterim): string {
    return LIBELLES_MOTIFS_INTERIM[m] ?? m;
  }
  statutLabel(s: Interim['statut']): string {
    return LIBELLES_STATUTS_INTERIM[s] ?? s;
  }
  peutRevoquer(i: Interim): boolean {
    return peutRevoquer(i, this.moi, this.admin);
  }

  /** La pièce, ouverte dans un onglet par le chemin sûr (`ouvrirBlobSur`) — jamais `createObjectURL` brut. */
  ouvrirPiece(i: Interim): void {
    this.interimService.piece(i.idInterim).subscribe({ next: (b) => ouvrirBlobSur(b), error: (_e: ApiError) => undefined });
  }

  // ── Désignation ──────────────────────────────────────────────────────────────────────────────

  ouvrirDesignation(): void {
    this.form.reset({ imTitulaire: this.admin ? '' : (this.moi ?? ''), imInterimaire: '', dateDebut: aujourdHuiIso(), dateFin: '', motif: 'CONGE', reference: '' });
    this.titulaireChoisi.set(this.admin ? '' : (this.moi ?? ''));
    this.motifChoisi.set('CONGE');
    this.piece.set(null);
    this.pieceErreur.set(null);
    this.designationOuverte.set(true);
  }
  fermerDesignation(): void {
    if (!this.saving()) this.designationOuverte.set(false);
  }
  fermerDesignationAnime(): void {
    fermerAvecAnimation(this.closingDesignation, () => this.fermerDesignation());
  }
  /** PDF seul, taille plafonnée — validé en miroir du serveur (qui lit le type sur les octets). */
  choisirPiece(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    if (!file) {
      this.piece.set(null);
      this.pieceErreur.set(null);
      return;
    }
    const erreur = validerFichier(file, TYPES_PDF, PIECE_MAX_MO);
    this.pieceErreur.set(erreur);
    this.piece.set(erreur ? null : file);
  }
  designer(): void {
    const piece = this.piece();
    if (this.form.invalid || !piece || (this.finRequise() && !this.form.controls.dateFin.value)) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    this.saving.set(true);
    this.interimService
      .creer(
        {
          imTitulaire: v.imTitulaire,
          imInterimaire: v.imInterimaire,
          dateDebut: v.dateDebut,
          dateFin: v.dateFin || undefined,
          motif: v.motif,
          reference: v.reference.trim(),
        },
        piece,
      )
      .subscribe({
        next: (i) => {
          this.saving.set(false);
          this.designationOuverte.set(false);
          this.toast.success(`${i.nomInterimaire} désigné(e) intérimaire de ${i.nomTitulaire} ${periodeInterim(i)}.`);
          // Cumuls SIGNALÉS par le serveur (déjà intérimaire ailleurs, déjà attributaire) — jamais un refus.
          if (i.avertissements?.length) this.toast.warning(i.avertissements.join(' '));
          this.store.verifier();
          this.charger();
        },
        // 400 (pièce, dates) / 403 (pas le titulaire) / 409 (non admissible, chevauchement) → message backend (dialogue centralisé).
        error: (_e: ApiError) => this.saving.set(false),
      });
  }

  // ── Révocation ───────────────────────────────────────────────────────────────────────────────

  ouvrirRevocation(i: Interim): void {
    this.formRevocation.reset({ motif: '', dateRevocation: '' });
    this.revocation.set(i);
  }
  fermerRevocation(): void {
    if (!this.saving()) this.revocation.set(null);
  }
  fermerRevocationAnime(): void {
    fermerAvecAnimation(this.closingRevocation, () => this.fermerRevocation());
  }
  revoquer(i: Interim): void {
    if (this.formRevocation.invalid) {
      this.formRevocation.markAllAsTouched();
      return;
    }
    const v = this.formRevocation.getRawValue();
    this.saving.set(true);
    this.interimService.revoquer(i.idInterim, { motif: v.motif.trim(), dateRevocation: v.dateRevocation || undefined }).subscribe({
      next: () => {
        this.saving.set(false);
        this.revocation.set(null);
        this.toast.success(`Intérim de ${i.nomInterimaire} pour ${i.nomTitulaire} révoqué.`);
        this.store.verifier();
        this.charger();
      },
      error: (_e: ApiError) => this.saving.set(false),
    });
  }
}
