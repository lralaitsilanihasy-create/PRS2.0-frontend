import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, WritableSignal, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError, codeErreur, corpsErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur, telechargerBlob } from '../../core/securite/fichiers-surs';
import { Ami, AmiCorps, Expression, PublicationAmi } from '../../models';
import { AmiService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { dateHeureFr, tailleLisible } from '../candidat/libelles-candidat';
import { EnteteProcedure } from './entete-procedure';

/** Les refus nommés du contrat AMI-a (V82). */
export const MESSAGES_AMI: Readonly<Record<string, string>> = {
  CRITERES_OBLIGATOIRES: 'Il faut au moins un critère de sélection.',
  PONDERATION_INVALIDE: 'Les poids des critères doivent être positifs et totaliser 100.',
  NOTE_MINIMALE_INVALIDE: 'La note minimale se donne sur 100.',
  DATE_LIMITE_INVALIDE: 'La date limite doit être à venir.',
  NOMBRE_RETENUS_INVALIDE: 'Le nombre de candidats retenus va de 1 à 20.',
  CATEGORIE_SANS_AMI: 'L’appel à manifestation d’intérêt est réservé aux prestations intellectuelles.',
  AMI_PUBLIE: 'L’appel est déjà publié : il ne se modifie plus.',
  AMI_DISPENSE: 'L’appel est dispensé de publicité : la liste restreinte se saisit aux lettres d’invitation.',
  PUBLICATION_OBLIGATOIRE: 'Déclarez au moins un support de publication, daté.',
  MOTIF_OBLIGATOIRE: 'Le motif de la dispense est obligatoire.',
  LECTURE_FERMEE: 'Les expressions d’intérêt ne se lisent qu’après la date limite.',
};

export function messageAmi(e: ApiError, defaut: string): string {
  const code = codeErreur(e);
  if (e.status === 403) return 'Ce geste est réservé à la PRMP de la fiche.';
  return (code && MESSAGES_AMI[code]) || corpsErreur<{ message?: string }>(e)?.message || defaut;
}

interface LigneCritere {
  id: number;
  code: string | null;
  libelle: string;
  poids: number | null;
  description: string;
}

interface LignePublication {
  id: number;
  support: string;
  date: string;
  reference: string;
}

/**
 * ⚠️ **L'appel à manifestation d'intérêt** d'une fiche de prestations intellectuelles (tranche AMI-a, 07/10, V82 ; loi 2016-055,
 * art. 32 et 42-II). La PRMP ou l'UGPM le prépare — critères pondérés sur 100, pièces attendues, note minimale, nombre de candidats
 * retenus (six par défaut), date limite ; la PRMP seule le publie (supports déclarés, avis signé) ou déclare la dispense de publicité.
 * Les expressions d'intérêt ne se lisent qu'après la date limite (arbitrage Q2) : avant, leur nombre seulement. La notation par la
 * commission et la liste restreinte viennent avec la tranche AMI-b.
 */
@Component({
  selector: 'app-ami-dao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur, EnteteProcedure],
  template: `
    <section class="ami">
      <header class="page-header">
        <app-entete-procedure [idDmc]="idDmc" />
        <h1 class="page-title">Appel à manifestation d’intérêt</h1>
      </header>
      <p class="page-role">
        La liste restreinte des consultants invités à remettre une proposition naît de cet appel (art. 42-II) : les candidats déposent
        leur expression d’intérêt en ligne, la commission les note sur les critères publiés et retient les meilleurs.
      </p>

      @if (chargement()) {
        <p class="text-muted" role="status">Chargement de l’appel…</p>
      } @else if (erreur()) {
        <app-etat-erreur message="L’appel à manifestation d’intérêt n’a pas pu être chargé." (reessayer)="charger()" />
      } @else {
        @if (ami(); as a) {
          <p class="ami__etat">
            <span class="badge" [class.badge-warning]="a.etat === 'BROUILLON'" [class.badge-success]="a.etat === 'PUBLIE'" [class.badge-neutral]="a.etat === 'DISPENSE'">{{ etats[a.etat] }}</span>
            @if (a.publieLe) { <span class="text-sm text-muted">publié le {{ dateHeure(a.publieLe) }}{{ a.publiePar ? ' par ' + a.publiePar : '' }}</span> }
            @if (a.etat === 'PUBLIE') {
              <span class="text-sm"><strong>{{ a.nombreExpressions }}</strong> {{ a.nombreExpressions > 1 ? 'expressions déposées' : 'expression déposée' }}</span>
            }
          </p>
        }

        @if (editable()) {
          <!-- La préparation : PRMP ou UGPM, tant que l'appel n'est pas publié. -->
          <section class="card ami__bloc" aria-labelledby="ami-prep">
            <h2 id="ami-prep" class="ami__h2">{{ ami() ? 'Préparation' : 'Préparer l’appel' }}</h2>
            <div class="ami__ligne">
              <label class="form-label" for="ami-limite">Date limite de dépôt des expressions</label>
              <input id="ami-limite" class="form-control ami__court" type="datetime-local" [value]="dateLimite()" (input)="dateLimite.set(valeur($event))" />
            </div>

            <h3 class="ami__h3">Critères de sélection <span class="text-sm" [class.ami__ko]="total() !== 100">— total {{ total() }} / 100</span></h3>
            <p class="text-sm text-muted">L’aptitude, les références, l’expérience (art. 42-II) : chaque critère porte un poids, et les poids totalisent 100.</p>
            <table class="cnm-table ami__table">
              <caption class="cnm-sr-only">Critères de sélection</caption>
              <thead><tr><th scope="col">Critère</th><th scope="col" class="cnm-num">Poids</th><th scope="col">Précision</th><th scope="col"><span class="cnm-sr-only">Actions</span></th></tr></thead>
              <tbody>
                @for (c of criteres(); track c.id; let i = $index) {
                  <tr>
                    <td><input class="form-control" [attr.aria-label]="'Critère ' + (i + 1)" [value]="c.libelle" (input)="poserCritere(c.id, 'libelle', valeur($event))" /></td>
                    <td class="ami__poids"><input class="form-control" type="number" min="1" max="100" [attr.aria-label]="'Poids du critère ' + (i + 1)" [value]="c.poids ?? ''" (input)="poserCritere(c.id, 'poids', valeur($event))" /></td>
                    <td><input class="form-control" [attr.aria-label]="'Précision du critère ' + (i + 1)" [value]="c.description" (input)="poserCritere(c.id, 'description', valeur($event))" /></td>
                    <td><button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Retirer le critère ' + (i + 1)" [disabled]="criteres().length <= 1" (click)="retirerCritere(c.id)">✕</button></td>
                  </tr>
                }
              </tbody>
            </table>
            <button type="button" class="btn btn-outline btn-sm" (click)="ajouterCritere()">Ajouter un critère</button>

            <h3 class="ami__h3">Pièces attendues</h3>
            <p class="text-sm text-muted">Chaque pièce est exigée au dépôt, en PDF ou en image (une par ligne).</p>
            <ul class="ami__pieces">
              @for (p of pieces(); track $index; let i = $index) {
                <li>
                  <input class="form-control" [attr.aria-label]="'Pièce attendue ' + (i + 1)" [value]="p" (input)="poserPiece(i, valeur($event))" />
                  <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Retirer la pièce ' + (i + 1)" (click)="retirerPiece(i)">✕</button>
                </li>
              }
            </ul>
            <button type="button" class="btn btn-outline btn-sm" (click)="ajouterPiece()">Ajouter une pièce</button>

            <div class="ami__duo">
              <div>
                <label class="form-label" for="ami-note">Note minimale (sur 100, facultative)</label>
                <input id="ami-note" class="form-control ami__court" type="number" min="0" max="100" [value]="noteMinimale() ?? ''" (input)="noteMinimale.set(nombre(valeur($event)))" />
              </div>
              <div>
                <label class="form-label" for="ami-retenus">Candidats retenus sur la liste restreinte</label>
                <input id="ami-retenus" class="form-control ami__court" type="number" min="1" max="20" [value]="nombreRetenus() ?? ''" (input)="nombreRetenus.set(nombre(valeur($event)))" />
              </div>
            </div>

            @if (refusPrep(); as r) { <div class="alert alert-danger" role="alert"><span>{{ r }}</span></div> }
            <div class="ami__actions">
              <button type="button" class="btn btn-primary" [disabled]="occupe() || !prepComplete()" (click)="enregistrer()">{{ occupe() ? 'Enregistrement…' : 'Enregistrer' }}</button>
              @if (!prepComplete()) { <span class="text-sm text-muted">Date limite, critères nommés totalisant 100 : tout est requis.</span> }
            </div>
          </section>
        } @else if (ami(); as a) {
          <section class="card ami__bloc" aria-labelledby="ami-fige">
            <h2 id="ami-fige" class="ami__h2">L’appel</h2>
            <dl class="ami__dl">
              <dt>Date limite</dt><dd><strong>{{ a.dateLimite ? dateHeure(a.dateLimite) : '—' }}</strong></dd>
              <dt>Note minimale</dt><dd>{{ a.noteMinimale != null ? a.noteMinimale + ' / 100' : '—' }}</dd>
              <dt>Candidats retenus</dt><dd>{{ a.nombreRetenus ?? '—' }}</dd>
            </dl>
            @if (a.criteres.length) {
              <h3 class="ami__h3">Critères</h3>
              <ul>@for (c of a.criteres; track c.code) { <li><span class="cnm-mono">{{ c.code }}</span> {{ c.libelle }} — <strong>{{ c.poids }}</strong> points{{ c.description ? ' (' + c.description + ')' : '' }}</li> }</ul>
            }
            @if (a.pieces.length) {
              <h3 class="ami__h3">Pièces attendues</h3>
              <ul>@for (p of a.pieces; track p) { <li>{{ p }}</li> }</ul>
            }
            @if (a.publications.length) {
              <h3 class="ami__h3">Publication</h3>
              <ul>@for (p of a.publications; track $index) { <li>{{ p.support }}, le {{ date(p.date) }}{{ p.reference ? ' — ' + p.reference : '' }}</li> }</ul>
            }
            @if (a.etat === 'DISPENSE') {
              <div class="alert alert-info" role="status"><span>Dispensé de publicité : {{ a.motifDispense }}. La liste restreinte se saisit aux lettres d’invitation de la fiche.</span></div>
            }
          </section>
        }

        @if (ami(); as a) {
          @if (a.etat !== 'DISPENSE') {
            <section class="card ami__bloc" aria-labelledby="ami-avis">
              <h2 id="ami-avis" class="ami__h2">{{ a.etat === 'PUBLIE' ? 'L’avis publié' : 'Le projet d’avis' }}</h2>
              <p class="text-sm text-muted">{{ a.etat === 'PUBLIE' ? 'Signé électroniquement à la publication.' : 'Produit sur la préparation enregistrée ; il se fige à la publication.' }}</p>
              <div class="ami__actions">
                <button type="button" class="btn btn-outline btn-sm" [disabled]="occupe()" (click)="avis('pdf')">Ouvrir le PDF</button>
                <button type="button" class="btn btn-outline btn-sm" [disabled]="occupe()" (click)="avis('docx')">Enregistrer le Word</button>
              </div>
            </section>
          }

          @if (a.etat === 'BROUILLON' && estPrmp()) {
            <section class="card ami__bloc" aria-labelledby="ami-pub">
              <h2 id="ami-pub" class="ami__h2">Publier</h2>
              <p class="text-sm">Déclarez où l’avis paraît (journal des marchés publics, journal national…). La publication fige l’appel et ouvre le dépôt en ligne.</p>
              @for (p of publications(); track p.id; let i = $index) {
                <div class="ami__pub">
                  <input class="form-control" [attr.aria-label]="'Support ' + (i + 1)" placeholder="Support" [value]="p.support" (input)="poserPublication(p.id, 'support', valeur($event))" />
                  <input class="form-control ami__court" type="date" [attr.aria-label]="'Date de parution ' + (i + 1)" [value]="p.date" (input)="poserPublication(p.id, 'date', valeur($event))" />
                  <input class="form-control" [attr.aria-label]="'Référence de parution ' + (i + 1)" placeholder="Référence (facultative)" [value]="p.reference" (input)="poserPublication(p.id, 'reference', valeur($event))" />
                  <button type="button" class="btn btn-ghost btn-sm" [attr.aria-label]="'Retirer le support ' + (i + 1)" [disabled]="publications().length <= 1" (click)="retirerPublication(p.id)">✕</button>
                </div>
              }
              <button type="button" class="btn btn-outline btn-sm" (click)="ajouterPublication()">Ajouter un support</button>
              @if (refusPub(); as r) { <div class="alert alert-danger" role="alert"><span>{{ r }}</span></div> }
              <div class="ami__actions">
                <button type="button" class="btn btn-primary" [disabled]="occupe() || !pubComplete()" (click)="publier()">Publier et signer l’avis</button>
              </div>
              <details class="ami__dispense">
                <summary>Déclarer la dispense de publicité</summary>
                <p class="text-sm">Sous le seuil réglementaire (art. 42-II), l’appel n’est pas publié : la liste restreinte se saisit aux lettres d’invitation.</p>
                <label class="form-label" for="ami-motif">Motif</label>
                <textarea id="ami-motif" class="form-control" rows="2" [value]="motif()" (input)="motif.set(valeur($event))"></textarea>
                <button type="button" class="btn btn-outline btn-sm" [disabled]="occupe() || !motif().trim()" (click)="dispenser()">Déclarer la dispense</button>
              </details>
            </section>
          }

          @if (a.etat === 'PUBLIE') {
            <section class="card ami__bloc" aria-labelledby="ami-expr">
              <h2 id="ami-expr" class="ami__h2">Expressions d’intérêt</h2>
              @if (!a.lectureOuverte) {
                <p class="text-sm" role="status">Elles se lisent après la date limite{{ a.dateLimite ? ', le ' + dateHeure(a.dateLimite) : '' }}. D’ici là, seul leur nombre est connu : {{ a.nombreExpressions }}.</p>
              } @else if (exprChargement()) {
                <p class="text-muted" role="status">Chargement des expressions…</p>
              } @else if (exprErreur()) {
                <app-etat-erreur message="Les expressions n’ont pas pu être chargées." (reessayer)="chargerExpressions()" />
              } @else if (!expressions().length) {
                <p class="text-muted">Aucune expression d’intérêt reçue.</p>
              } @else {
                <p class="text-sm text-muted">La notation par la commission et la liste restreinte arrivent avec la tranche suivante.</p>
                @for (x of expressions(); track x.id) {
                  <details class="ami__x">
                    <summary>
                      <span class="cnm-mono">n° {{ x.numero }}</span> <strong>{{ x.raisonSociale || '—' }}</strong>
                      <span class="text-sm text-muted">NIF {{ x.nif || '—' }} · déposée le {{ dateHeure(x.deposeeLe) }}</span>
                    </summary>
                    <p class="ami__lettre">{{ x.lettre }}</p>
                    @if (x.qualifications) { <p><strong>Qualifications :</strong> {{ x.qualifications }}</p> }
                    @if (x.references.length) {
                      <h3 class="ami__h3">Références</h3>
                      <ul>@for (r of x.references; track $index) { <li>{{ r.intitule }} — {{ r.client }}{{ r.annee ? ', ' + r.annee : '' }}{{ r.montant != null ? ', ' + montant(r.montant) + ' Ar' : '' }}</li> }</ul>
                    }
                    @if (x.groupement.length) {
                      <h3 class="ami__h3">Groupement</h3>
                      <ul>@for (m of x.groupement; track m.nif) { <li>{{ m.raisonSociale }} (NIF {{ m.nif }}) — {{ m.role }}</li> }</ul>
                    }
                    <h3 class="ami__h3">Pièces</h3>
                    <ul class="ami__pj">
                      @for (p of x.pieces; track p.id) {
                        <li>{{ p.libelle }} <span class="text-xs text-muted">{{ p.nom }} · {{ taille(p.taille) }}</span>
                          <button type="button" class="btn btn-outline btn-sm" [disabled]="occupe()" (click)="lirePiece(x, p.id)">Ouvrir</button></li>
                      }
                    </ul>
                    <p class="text-xs text-muted">Empreinte <span class="cnm-mono">{{ x.empreinte }}</span></p>
                  </details>
                }
              }
            </section>
          }
        }
      }
    </section>
  `,
  styles: `
    :host { display: block; }
    .ami { display: flex; flex-direction: column; gap: 1rem; }
    .ami__etat { display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; margin: 0; }
    .ami__bloc { padding: 1rem 1.1rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .ami__h2 { margin: 0; font-size: 1.05rem; }
    .ami__h3 { margin: 0.6rem 0 0; font-size: 0.95rem; }
    .ami__ko { color: var(--danger-700, #b42318); font-weight: 600; }
    .ami__court { max-width: 16rem; }
    .ami__table { table-layout: fixed; }
    .ami__table th:nth-child(1) { width: 40%; } .ami__table th:nth-child(2) { width: 7rem; } .ami__table th:nth-child(4) { width: 3rem; }
    .ami__pieces { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
    .ami__pieces li, .ami__pub { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .ami__pub .form-control:first-child { flex: 1 1 14rem; }
    .ami__duo { display: grid; grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr)); gap: 0.75rem; }
    .ami__actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
    .ami__dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.3rem 1rem; margin: 0; }
    .ami__dl dd { margin: 0; }
    .ami__dispense { margin-top: 0.5rem; border-top: 1px solid var(--n-200); padding-top: 0.5rem; }
    .ami__dispense summary { cursor: pointer; }
    .ami__x { border: 1px solid var(--n-200); border-radius: var(--radius-md, 6px); padding: 0.5rem 0.75rem; }
    .ami__x summary { cursor: pointer; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: baseline; }
    .ami__lettre { white-space: pre-line; }
    .ami__pj { display: flex; flex-direction: column; gap: 0.3rem; }
    .ami__pj li { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; }
  `,
})
export class AmiDao implements OnInit {
  private readonly service = inject(AmiService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  readonly idDmc = Number(inject(ActivatedRoute).snapshot.paramMap.get('idDmc'));

  readonly etats: Readonly<Record<Ami['etat'], string>> = { BROUILLON: 'En préparation', PUBLIE: 'Publié', DISPENSE: 'Dispensé de publicité' };
  readonly dateHeure = dateHeureFr;
  readonly taille = tailleLisible;
  readonly estPrmp = computed(() => this.auth.role() === 'PRMP');
  private readonly peutPreparer = computed(() => ['PRMP', 'UGPM'].includes(this.auth.role() ?? ''));

  readonly chargement = signal(true);
  readonly erreur = signal(false);
  readonly ami = signal<Ami | null>(null);
  readonly occupe = signal(false);
  readonly editable = computed(() => this.peutPreparer() && (this.ami()?.etat ?? 'BROUILLON') === 'BROUILLON');

  // ── La préparation ──
  private prochainId = 1;
  readonly dateLimite = signal('');
  readonly criteres = signal<LigneCritere[]>([]);
  readonly pieces = signal<string[]>([]);
  readonly noteMinimale = signal<number | null>(null);
  readonly nombreRetenus = signal<number | null>(6);
  readonly refusPrep = signal<string | null>(null);
  readonly total = computed(() => this.criteres().reduce((s, c) => s + (c.poids ?? 0), 0));
  readonly prepComplete = computed(
    () => this.dateLimite() !== '' && this.criteres().length > 0 && this.total() === 100
      && this.criteres().every((c) => c.libelle.trim() !== '' && (c.poids ?? 0) > 0),
  );

  // ── La publication ──
  readonly publications = signal<LignePublication[]>([]);
  readonly refusPub = signal<string | null>(null);
  readonly motif = signal('');
  readonly pubComplete = computed(() => this.publications().some((p) => p.support.trim() !== '' && p.date !== ''));

  // ── Les expressions ──
  readonly expressions = signal<Expression[]>([]);
  readonly exprChargement = signal(false);
  readonly exprErreur = signal(false);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.lire(this.idDmc).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (a) => this.recevoir(a),
      error: (e: ApiError) => {
        this.chargement.set(false);
        if (e.status === 404) this.recevoir(null);
        else this.erreur.set(true);
      },
    });
  }

  private recevoir(a: Ami | null): void {
    this.ami.set(a);
    this.chargement.set(false);
    this.dateLimite.set(a?.dateLimite?.slice(0, 16) ?? '');
    const criteres = a?.criteres.length ? a.criteres : [{ code: null, libelle: '', poids: 100, description: null }];
    this.criteres.set(criteres.map((c) => ({ id: this.prochainId++, code: c.code, libelle: c.libelle, poids: c.poids, description: c.description ?? '' })));
    this.pieces.set(a?.pieces.length ? [...a.pieces] : ['']);
    this.noteMinimale.set(a?.noteMinimale ?? null);
    this.nombreRetenus.set(a?.nombreRetenus ?? 6);
    if (!this.publications().length) this.publications.set([{ id: this.prochainId++, support: '', date: '', reference: '' }]);
    if (a?.etat === 'PUBLIE' && a.lectureOuverte) this.chargerExpressions();
  }

  valeur(ev: Event): string {
    return (ev.target as HTMLInputElement).value;
  }

  nombre(v: string): number | null {
    return v.trim() === '' || Number.isNaN(Number(v)) ? null : Number(v);
  }

  date(iso: string): string {
    const [a, m, j] = iso.split('-');
    return j && m && a ? `${j}/${m}/${a}` : iso;
  }

  montant(n: number): string {
    return new Intl.NumberFormat('fr-FR').format(n);
  }

  ajouterCritere(): void {
    this.criteres.update((l) => [...l, { id: this.prochainId++, code: null, libelle: '', poids: null, description: '' }]);
  }

  retirerCritere(id: number): void {
    this.criteres.update((l) => (l.length > 1 ? l.filter((c) => c.id !== id) : l));
  }

  poserCritere(id: number, champ: 'libelle' | 'poids' | 'description', v: string): void {
    this.criteres.update((l) => l.map((c) => (c.id === id ? { ...c, [champ]: champ === 'poids' ? this.nombre(v) : v } : c)));
  }

  ajouterPiece(): void {
    this.pieces.update((l) => [...l, '']);
  }

  retirerPiece(i: number): void {
    this.pieces.update((l) => l.filter((_, k) => k !== i));
  }

  poserPiece(i: number, v: string): void {
    this.pieces.update((l) => l.map((p, k) => (k === i ? v : p)));
  }

  ajouterPublication(): void {
    this.publications.update((l) => [...l, { id: this.prochainId++, support: '', date: '', reference: '' }]);
  }

  retirerPublication(id: number): void {
    this.publications.update((l) => (l.length > 1 ? l.filter((p) => p.id !== id) : l));
  }

  poserPublication(id: number, champ: 'support' | 'date' | 'reference', v: string): void {
    this.publications.update((l) => l.map((p) => (p.id === id ? { ...p, [champ]: v } : p)));
  }

  enregistrer(): void {
    if (this.occupe() || !this.prepComplete()) return;
    const corps: AmiCorps = {
      dateLimite: this.dateLimite().length === 16 ? `${this.dateLimite()}:00` : this.dateLimite(),
      criteres: this.criteres().map((c) => ({ code: c.code, libelle: c.libelle.trim(), poids: c.poids ?? 0, description: c.description.trim() || null })),
      pieces: this.pieces().map((p) => p.trim()).filter((p) => p !== ''),
      noteMinimale: this.noteMinimale(),
      nombreRetenus: this.nombreRetenus(),
    };
    this.geste(this.service.preparer(this.idDmc, corps), this.refusPrep, 'Appel enregistré : le projet d’avis est à jour.', 'L’enregistrement a échoué.');
  }

  publier(): void {
    if (this.occupe() || !this.pubComplete()) return;
    const publications: PublicationAmi[] = this.publications()
      .filter((p) => p.support.trim() !== '' && p.date !== '')
      .map((p) => ({ support: p.support.trim(), date: p.date, reference: p.reference.trim() || null }));
    this.geste(this.service.publier(this.idDmc, publications), this.refusPub, 'Appel publié : l’avis est signé et le dépôt en ligne est ouvert.', 'La publication a échoué.');
  }

  dispenser(): void {
    if (this.occupe() || !this.motif().trim()) return;
    this.geste(this.service.dispenser(this.idDmc, this.motif().trim()), this.refusPub, 'Dispense de publicité déclarée.', 'La déclaration a échoué.');
  }

  private geste(appel: Observable<Ami>, refus: WritableSignal<string | null>, succes: string, defaut: string): void {
    this.occupe.set(true);
    refus.set(null);
    appel.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (a) => {
        this.occupe.set(false);
        this.recevoir(a);
        this.toast.success(succes);
      },
      error: (e: ApiError) => {
        this.occupe.set(false);
        refus.set(messageAmi(e, defaut));
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
        this.toast.error('L’avis n’a pas pu être produit — enregistrez la préparation, puis réessayez.');
      },
    });
  }

  chargerExpressions(): void {
    this.exprChargement.set(true);
    this.exprErreur.set(false);
    this.service.expressions(this.idDmc).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (l) => {
        this.expressions.set(l);
        this.exprChargement.set(false);
      },
      error: () => {
        this.exprErreur.set(true);
        this.exprChargement.set(false);
      },
    });
  }

  lirePiece(x: Expression, idPiece: number): void {
    if (this.occupe()) return;
    this.occupe.set(true);
    this.service.piece(this.idDmc, x.id, idPiece).subscribe({
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
