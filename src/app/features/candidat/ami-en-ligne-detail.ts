import { ChangeDetectionStrategy, Component, DOCUMENT, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError, codeErreur, corpsErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { TYPES_PIECE, ouvrirBlobSur, telechargerBlob, validerFichier } from '../../core/securite/fichiers-surs';
import { AmiPublic, Expression, ExpressionCorps } from '../../models';
import { AmisEnLigneService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { dateHeureFr, tailleLisible } from './libelles-candidat';

/** Les refus du dépôt (AMI-a, V82). */
const MESSAGES_DEPOT: Readonly<Record<string, string>> = {
  LETTRE_OBLIGATOIRE: 'La lettre de manifestation d’intérêt est obligatoire.',
  PIECES_MANQUANTES: 'Des pièces attendues manquent',
  FORMAT_INVALIDE: 'Une pièce n’est ni un PDF, ni une image JPEG ou PNG.',
  FICHIER_INCONNU: 'Une pièce ne correspond à aucun fichier envoyé — rejoignez-la.',
  EXPRESSION_ILLISIBLE: 'L’expression n’a pas pu être lue par le serveur.',
  DATE_LIMITE_DEPASSEE: 'La date limite est passée : le dépôt est clos.',
  ENTREPRISE_NON_DECLAREE: 'Déclarez d’abord votre entreprise (ou votre cabinet) dans « Mon entreprise ».',
};

export function messageDepot(e: ApiError): string {
  const code = codeErreur(e);
  if (e.status === 413) return 'Les pièces sont trop volumineuses.';
  if (code === 'PIECES_MANQUANTES') {
    const pieces = corpsErreur<{ details?: { pieces?: string[] } }>(e)?.details?.pieces ?? [];
    return `${MESSAGES_DEPOT['PIECES_MANQUANTES']}${pieces.length ? ' : ' + pieces.join(', ') : ''}.`;
  }
  return (code && MESSAGES_DEPOT[code]) || corpsErreur<{ message?: string }>(e)?.message || 'Le dépôt a échoué. Réessayez.';
}

interface LigneReference {
  id: number;
  intitule: string;
  client: string;
  annee: string;
  montant: string;
}

interface LigneMembre {
  id: number;
  nif: string;
  raisonSociale: string;
  role: string;
}

/**
 * ⚠️ **Un appel à manifestation d'intérêt publié** (tranche AMI-a, 07/10, V82), côté candidat : l'avis, les critères et les pièces
 * attendues se lisent sans session ; le dépôt de l'expression d'intérêt demande un compte et une entreprise déclarée. Pas de
 * scellement, mais l'administration ne lit rien avant la date limite (arbitrage Q2). Un nouveau dépôt remplace le précédent ; le
 * retrait est possible jusqu'à la date limite. L'accusé porte le numéro, la date et l'empreinte SHA-256.
 */
@Component({
  selector: 'app-ami-en-ligne-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EtatErreur],
  template: `
    <nav class="aed__ariane" aria-label="Fil d'Ariane">
      <a routerLink="/candidat/procedures">Procédures ouvertes</a>
      <span aria-hidden="true">›</span>
      <span aria-current="page">{{ ami()?.reference || 'Appel à manifestation d’intérêt' }}</span>
    </nav>

    @if (chargement()) {
      <p class="text-muted" role="status">Chargement de l’appel…</p>
    } @else if (introuvable()) {
      <div class="empty-state">
        <p class="empty-state-title">Cet appel à manifestation d’intérêt n’est pas publié.</p>
        <p class="empty-state-text"><a routerLink="/candidat/procedures">Revenir aux procédures ouvertes</a>.</p>
      </div>
    } @else if (erreur()) {
      <app-etat-erreur message="L’appel n’a pas pu être chargé." (reessayer)="charger()" />
    } @else if (ami(); as a) {
      <header class="page-header">
        <div class="page-subtitle">
          <span>Appel à manifestation d’intérêt</span>
          @if (a.reference) { · <span class="cnm-mono">{{ a.reference }}</span> }
          · <span class="badge" [class.badge-success]="a.ouvert" [class.badge-neutral]="!a.ouvert">{{ a.ouvert ? 'Ouvert' : 'Clos' }}</span>
        </div>
        <h1 class="page-title">{{ a.objet || 'Objet non renseigné' }}</h1>
        @if (a.autoriteContractante) { <p class="aed__sous">{{ a.autoriteContractante }}</p> }
      </header>

      <div class="aed__grille">
        <section class="card aed__bloc" aria-labelledby="aed-cal">
          <h2 id="aed-cal" class="aed__h2">L’appel</h2>
          <dl class="aed__dl">
            <dt>Date limite</dt><dd><strong>{{ a.dateLimite ? dateHeure(a.dateLimite) : '—' }}</strong></dd>
            <dt>Candidats retenus</dt><dd>{{ a.nombreRetenus ?? '—' }} sur la liste restreinte</dd>
            @if (a.publieLe) { <dt>Publié le</dt><dd>{{ dateHeure(a.publieLe) }}</dd> }
          </dl>
          <div class="aed__actions">
            <button type="button" class="btn btn-outline btn-sm" [disabled]="occupe()" (click)="avis('pdf')">Lire l’avis (PDF)</button>
            <button type="button" class="btn btn-outline btn-sm" [disabled]="occupe()" (click)="avis('docx')">Enregistrer l’avis (Word)</button>
          </div>
        </section>

        <section class="card aed__bloc" aria-labelledby="aed-crit">
          <h2 id="aed-crit" class="aed__h2">Critères de sélection</h2>
          <ul class="aed__crit">
            @for (c of a.criteres; track c.code) { <li><span>{{ c.libelle }}{{ c.description ? ' — ' + c.description : '' }}</span><strong>{{ c.poids }} pts</strong></li> }
          </ul>
        </section>

        <!-- ⚠️ AMI-b (Q5) — la liste restreinte définitive, publiée à la dernière signature du rapport de présélection. -->
        @if (a.liste?.length) {
          <section class="card aed__bloc aed__bloc--large" aria-labelledby="aed-liste">
            <h2 id="aed-liste" class="aed__h2">Liste restreinte</h2>
            <p class="text-sm text-muted">Arrêtée par la commission : ces candidats sont invités à remettre une proposition.</p>
            <ol class="aed__liste">
              @for (r of a.liste; track r.rang) { <li><strong>{{ r.raisonSociale }}</strong>@if (r.nif) { <span class="text-xs text-muted"> · NIF {{ r.nif }}</span> }</li> }
            </ol>
          </section>
        }

        <section class="card aed__bloc aed__bloc--large" aria-labelledby="aed-depot">
          <h2 id="aed-depot" class="aed__h2">Votre expression d’intérêt</h2>
          @if (!connecte()) {
            <p class="text-sm">Pour déposer, <a routerLink="/login" [queryParams]="{ returnUrl: '/candidat/amis/' + a.idDmc }">connectez-vous</a> avec votre compte candidat, ou <a routerLink="/candidat/inscription">créez un compte</a>.</p>
          } @else {
            @if (sienne(); as x) {
              <div class="alert alert-success" role="status">
                <span>Déposée le {{ dateHeure(x.deposeeLe) }} sous le n° <strong>{{ x.numero }}</strong>. Empreinte <span class="cnm-mono aed__emp">{{ x.empreinte }}</span></span>
              </div>
              <ul class="aed__pj">
                @for (p of x.pieces; track p.id) {
                  <li>{{ p.libelle }} <span class="text-xs text-muted">{{ p.nom }} · {{ taille(p.taille) }}</span>
                    <button type="button" class="btn btn-outline btn-sm" [disabled]="occupe()" (click)="lirePiece(p.id)">Ouvrir</button></li>
                }
              </ul>
              @if (a.ouvert) {
                <div class="aed__actions">
                  <button type="button" class="btn btn-outline btn-sm" (click)="ouvrirFormulaire()">Remplacer</button>
                  <button type="button" class="btn btn-ghost btn-sm" [disabled]="occupe()" (click)="retirer()">Retirer</button>
                </div>
              }
            } @else if (!a.ouvert) {
              <p class="text-sm text-muted">La date limite est passée : le dépôt est clos.</p>
            }

            @if (a.ouvert && (formulaire() || !sienne())) {
              <p class="text-sm text-muted">Personne ne lit votre expression avant la date limite. {{ sienne() ? 'Le nouveau dépôt remplace le précédent.' : 'Vous pourrez la remplacer ou la retirer jusqu’à la date limite.' }}</p>
              <label class="form-label" for="aed-lettre">Lettre de manifestation d’intérêt</label>
              <textarea id="aed-lettre" class="form-control" rows="5" [value]="lettre()" (input)="lettre.set(valeur($event))"></textarea>
              <label class="form-label" for="aed-qualif">Qualifications (facultatif)</label>
              <textarea id="aed-qualif" class="form-control" rows="3" [value]="qualifications()" (input)="qualifications.set(valeur($event))"></textarea>

              <h3 class="aed__h3">Références de missions similaires</h3>
              @for (r of references(); track r.id; let i = $index) {
                <div class="aed__ref">
                  <input class="form-control" [attr.aria-label]="'Intitulé de la mission ' + (i + 1)" placeholder="Intitulé" [value]="r.intitule" (input)="poserReference(r.id, 'intitule', valeur($event))" />
                  <input class="form-control" [attr.aria-label]="'Client de la mission ' + (i + 1)" placeholder="Client" [value]="r.client" (input)="poserReference(r.id, 'client', valeur($event))" />
                  <input class="form-control aed__court" type="number" [attr.aria-label]="'Année de la mission ' + (i + 1)" placeholder="Année" [value]="r.annee" (input)="poserReference(r.id, 'annee', valeur($event))" />
                  <input class="form-control aed__court" type="number" [attr.aria-label]="'Montant de la mission ' + (i + 1) + ', en ariary'" placeholder="Montant (Ar)" [value]="r.montant" (input)="poserReference(r.id, 'montant', valeur($event))" />
                  <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Retirer la référence ' + (i + 1)" (click)="retirerReference(r.id)">✕</button>
                </div>
              }
              <button type="button" class="btn btn-outline btn-sm" (click)="ajouterReference()">Ajouter une référence</button>

              <h3 class="aed__h3">Groupement (le cas échéant)</h3>
              @for (m of groupement(); track m.id; let i = $index) {
                <div class="aed__ref">
                  <input class="form-control aed__court" [attr.aria-label]="'NIF du membre ' + (i + 1)" placeholder="NIF" [value]="m.nif" (input)="poserMembre(m.id, 'nif', valeur($event))" />
                  <input class="form-control" [attr.aria-label]="'Raison sociale du membre ' + (i + 1)" placeholder="Raison sociale" [value]="m.raisonSociale" (input)="poserMembre(m.id, 'raisonSociale', valeur($event))" />
                  <input class="form-control" [attr.aria-label]="'Rôle du membre ' + (i + 1)" placeholder="Rôle (mandataire, membre…)" [value]="m.role" (input)="poserMembre(m.id, 'role', valeur($event))" />
                  <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Retirer le membre ' + (i + 1)" (click)="retirerMembre(m.id)">✕</button>
                </div>
              }
              <button type="button" class="btn btn-outline btn-sm" (click)="ajouterMembre()">Ajouter un membre</button>

              @if (a.pieces.length) {
                <h3 class="aed__h3">Pièces attendues</h3>
                <ul class="aed__pj">
                  @for (p of a.pieces; track p; let i = $index) {
                    <li>
                      <label class="form-label" [for]="'aed-p' + i">{{ p }}</label>
                      <input [id]="'aed-p' + i" type="file" accept=".pdf,.jpg,.jpeg,.png" (change)="choisir(p, $event)" />
                      @if (fichiers()[p]; as f) { <span class="text-xs text-muted">{{ f.name }} · {{ taille(f.size) }}</span> }
                    </li>
                  }
                </ul>
              }

              @if (refus(); as r) { <div class="alert alert-danger" role="alert"><span>{{ r }}</span></div> }
              <div class="aed__actions">
                <button type="button" class="btn btn-primary" [disabled]="occupe() || !complet()" (click)="deposer()">{{ occupe() ? 'Dépôt…' : 'Déposer l’expression d’intérêt' }}</button>
                @if (!complet()) { <span class="text-sm text-muted">La lettre et chaque pièce attendue sont requises.</span> }
              </div>
            }
          }
        </section>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .aed__ariane { display: flex; gap: 0.4rem; font-size: var(--text-sm); margin-bottom: 0.75rem; }
    .aed__sous { margin: 0; color: var(--n-500); }
    .aed__grille { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr)); gap: 1rem; }
    .aed__bloc { padding: 1rem 1.1rem; display: flex; flex-direction: column; gap: 0.55rem; }
    .aed__bloc--large { grid-column: 1 / -1; }
    .aed__h2 { margin: 0; font-size: 1.05rem; }
    .aed__h3 { margin: 0.6rem 0 0; font-size: 0.95rem; }
    .aed__dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.3rem 1rem; margin: 0; }
    .aed__dl dd { margin: 0; }
    .aed__crit { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
    .aed__crit li { display: flex; justify-content: space-between; gap: 1rem; border-bottom: 1px solid var(--n-200); padding-bottom: 0.3rem; }
    .aed__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
    .aed__ref { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
    .aed__ref .form-control { flex: 1 1 12rem; }
    .aed__ref .aed__court { flex: 0 1 9rem; }
    .aed__pj { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.5rem; }
    .aed__pj li { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
    .aed__emp { word-break: break-all; }
  `,
})
export class AmiEnLigneDetail implements OnInit {
  private readonly service = inject(AmisEnLigneService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  readonly idDmc = Number(inject(ActivatedRoute).snapshot.paramMap.get('idDmc'));

  readonly dateHeure = dateHeureFr;
  readonly taille = tailleLisible;
  readonly connecte = computed(() => this.auth.isAuthenticated() && this.auth.role() === 'CANDIDAT');

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly introuvable = signal(false);
  readonly ami = signal<AmiPublic | null>(null);
  readonly sienne = signal<Expression | null>(null);
  readonly occupe = signal(false);
  readonly formulaire = signal(false);

  // ── Le dépôt ──
  private prochainId = 1;
  readonly lettre = signal('');
  readonly qualifications = signal('');
  readonly references = signal<LigneReference[]>([]);
  readonly groupement = signal<LigneMembre[]>([]);
  readonly fichiers = signal<Record<string, File>>({});
  readonly refus = signal<string | null>(null);
  readonly complet = computed(() => this.lettre().trim() !== '' && (this.ami()?.pieces ?? []).every((p) => !!this.fichiers()[p]));

  ngOnInit(): void {
    this.document.title = 'Appel à manifestation d’intérêt — Espace candidat — PRS 2.0';
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.lire(this.idDmc).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (a) => {
        this.ami.set(a);
        this.chargement.set(false);
        if (this.connecte()) this.chargerSienne();
      },
      error: (e: ApiError) => {
        this.chargement.set(false);
        if (e.status === 404) this.introuvable.set(true);
        else this.erreur.set(true);
      },
    });
  }

  private chargerSienne(): void {
    this.service.sienne(this.idDmc).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (x) => this.sienne.set(x),
      error: () => this.sienne.set(null),
    });
  }

  valeur(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }

  /** Reprend le dépôt en cours pour le remplacer : le texte se reprend, les fichiers se rejoignent. */
  ouvrirFormulaire(): void {
    const x = this.sienne();
    if (x) {
      this.lettre.set(x.lettre);
      this.qualifications.set(x.qualifications ?? '');
      this.references.set(x.references.map((r) => ({ id: this.prochainId++, intitule: r.intitule, client: r.client, annee: r.annee?.toString() ?? '', montant: r.montant?.toString() ?? '' })));
      this.groupement.set(x.groupement.map((m) => ({ id: this.prochainId++, ...m })));
    }
    this.fichiers.set({});
    this.formulaire.set(true);
  }

  ajouterReference(): void {
    this.references.update((l) => [...l, { id: this.prochainId++, intitule: '', client: '', annee: '', montant: '' }]);
  }

  retirerReference(id: number): void {
    this.references.update((l) => l.filter((r) => r.id !== id));
  }

  poserReference(id: number, champ: 'intitule' | 'client' | 'annee' | 'montant', v: string): void {
    this.references.update((l) => l.map((r) => (r.id === id ? { ...r, [champ]: v } : r)));
  }

  ajouterMembre(): void {
    this.groupement.update((l) => [...l, { id: this.prochainId++, nif: '', raisonSociale: '', role: '' }]);
  }

  retirerMembre(id: number): void {
    this.groupement.update((l) => l.filter((m) => m.id !== id));
  }

  poserMembre(id: number, champ: 'nif' | 'raisonSociale' | 'role', v: string): void {
    this.groupement.update((l) => l.map((m) => (m.id === id ? { ...m, [champ]: v } : m)));
  }

  choisir(piece: string, ev: Event): void {
    const champ = ev.target as HTMLInputElement;
    const f = champ.files?.[0];
    if (!f) return;
    const ko = validerFichier(f, TYPES_PIECE);
    if (ko) {
      this.refus.set(`${piece} : ${ko}`);
      champ.value = '';
      return;
    }
    this.refus.set(null);
    this.fichiers.update((m) => ({ ...m, [piece]: f }));
  }

  /**
   * Chaque fichier est renommé d'un préfixe de rang (`p1-…`) : deux pièces peuvent porter le même nom sur le poste, et le serveur
   * rattache la pièce au fichier par son nom.
   */
  deposer(): void {
    const a = this.ami();
    if (!a || this.occupe() || !this.complet()) return;
    const envois = a.pieces.map((p, i) => {
      const f = this.fichiers()[p];
      return { libelle: p, fichier: new File([f], `p${i + 1}-${f.name}`, { type: f.type }) };
    });
    const corps: ExpressionCorps = {
      lettre: this.lettre().trim(),
      qualifications: this.qualifications().trim() || null,
      references: this.references()
        .filter((r) => r.intitule.trim() !== '')
        .map((r) => ({ intitule: r.intitule.trim(), client: r.client.trim(), annee: r.annee ? Number(r.annee) : null, montant: r.montant ? Number(r.montant) : null, description: null })),
      groupement: this.groupement()
        .filter((m) => m.nif.trim() !== '' || m.raisonSociale.trim() !== '')
        .map((m) => ({ nif: m.nif.trim(), raisonSociale: m.raisonSociale.trim(), role: m.role.trim() })),
      pieces: envois.map((e) => ({ libelle: e.libelle, fichier: e.fichier.name })),
    };
    this.occupe.set(true);
    this.refus.set(null);
    this.service.deposer(this.idDmc, corps, envois.map((e) => e.fichier)).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (x) => {
        this.occupe.set(false);
        this.sienne.set(x);
        this.formulaire.set(false);
        this.fichiers.set({});
        this.toast.success(`Expression d’intérêt déposée sous le n° ${x.numero}. L’accusé vous est aussi envoyé par courriel.`);
      },
      error: (e: ApiError) => {
        this.occupe.set(false);
        this.refus.set(messageDepot(e));
      },
    });
  }

  retirer(): void {
    if (this.occupe()) return;
    this.occupe.set(true);
    this.service.retirer(this.idDmc).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.occupe.set(false);
        this.sienne.set(null);
        this.formulaire.set(false);
        this.toast.success('Expression d’intérêt retirée.');
      },
      error: (e: ApiError) => {
        this.occupe.set(false);
        this.toast.error(messageDepot(e));
      },
    });
  }

  avis(format: 'pdf' | 'docx'): void {
    if (this.occupe()) return;
    this.occupe.set(true);
    this.service.avis(this.idDmc, format).subscribe({
      next: (blob) => {
        this.occupe.set(false);
        if (format === 'pdf') ouvrirBlobSur(blob);
        else telechargerBlob(blob, `avis-ami-${this.idDmc}.docx`);
      },
      error: () => {
        this.occupe.set(false);
        this.toast.error('L’avis est indisponible — réessayez.');
      },
    });
  }

  lirePiece(idPiece: number): void {
    if (this.occupe()) return;
    this.occupe.set(true);
    this.service.piece(this.idDmc, idPiece).subscribe({
      next: (blob) => {
        this.occupe.set(false);
        ouvrirBlobSur(blob);
      },
      error: () => {
        this.occupe.set(false);
        this.toast.error('Pièce indisponible — réessayez.');
      },
    });
  }
}
