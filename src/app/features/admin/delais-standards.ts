import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';

import { ToastService } from '../../core/notifications/toast.service';
import { DelaiSousType, DelaiStandard, ETAPE_CIRCUIT_LABELS, EtapeCircuit, SousTypeDossier } from '../../models';
import { DelaiStandardService, SousTypeDossierService } from '../../services';

/**
 * ⚠️ Chronométrage (2026-09-01, HEURES ouvrées depuis le 02/09 — backend `c8d987a`) — écran
 * « Délais standards » : le délai par défaut de chaque étape du circuit, en heures ouvrées
 * (8 h = 1 jour ouvré). Il fournit la prévision des étapes non encore prises en charge — la date
 * annoncée à la PRMP existe donc dès la soumission — et il est remplacé, dossier par dossier, par
 * la prévision réellement saisie à la prise en charge. Le GET rend TOUJOURS les huit étapes
 * (repli serveur à 8 h), le PUT est réservé à l'Administrateur (400 si < 1).
 */
@Component({
  selector: 'app-delais-standards',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="dst">
      <header class="page-header">
        <h1 class="page-title">Délais standards du circuit</h1>
        <button type="button" class="btn btn-secondary btn-sm" (click)="charger()" [disabled]="loading()">Rafraîchir</button>
      </header>
      <!-- Un seul <span> : .alert est en flex, des <strong> nus deviendraient des colonnes. -->
      <p class="alert alert-info">
        <span>
          Ces délais (en <strong>heures ouvrées</strong> — 8 h = 1 jour ouvré) servent de prévision
          par défaut aux étapes que personne n'a encore prises en charge : ils alimentent la
          <strong>date prévisionnelle de fin</strong> annoncée à la PRMP dès la soumission. À la
          prise en charge d'une étape, la prévision saisie par le porteur remplace le délai
          standard — pour ce dossier seulement.
        </span>
      </p>

      @if (loading()) {
        <p class="text-muted" role="status">Chargement…</p>
      } @else {
        <div class="table-responsive">
          <table class="cnm-table">
            <thead>
              <tr><th scope="col">Étape</th><th scope="col">Délai standard (heures ouvrées)</th><th scope="col"></th></tr>
            </thead>
            <tbody>
              @for (d of delais(); track d.etape) {
                <tr>
                  <td>
                    {{ d.libelle || etapeLabel(d.etape) }}
                    <span class="cnm-mono dst__code">{{ d.etape }}</span>
                    @if (d.etape === 'ARCHIVAGE') {
                      <span class="badge" title="Chronométrée par profil, mais le compteur global s'arrête à la validation SIGMP.">hors compteur global</span>
                    }
                  </td>
                  <td>
                    <input
                      type="number"
                      class="form-control dst__jours"
                      min="1"
                      step="1"
                      [value]="saisies()[d.etape] ?? d.delaiHeures"
                      [attr.aria-label]="'Délai standard — ' + (d.libelle || etapeLabel(d.etape))"
                      (input)="saisir(d.etape, $any($event.target).value)"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      class="btn btn-primary btn-sm"
                      [disabled]="saving() === d.etape || !modifie(d)"
                      (click)="enregistrer(d)"
                    >
                      {{ saving() === d.etape ? 'Enregistrement…' : 'Enregistrer' }}
                    </button>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="3" class="cnm-muted">Référentiel indisponible.</td></tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- ⚠️ 09/10 (manuel de contrôle, M5b — V99) — un sous-type peut avoir ses propres délais à la Commission. -->
      <section class="dst__st" aria-labelledby="dst-st-titre">
        <h2 id="dst-st-titre" class="dst__h2">Délais par sous-type de dossier</h2>
        <p class="text-sm text-muted dst__aide">
          Un sous-type peut avoir ses propres délais pour les étapes de la Commission ; sans réglage, il suit le délai standard ci-dessus.
          La date prévisionnelle de fin d’un dossier et le délai de son étape à l’accueil « À faire » suivent le délai de son sous-type.
          L’alerte d’examen (au-delà de 5 jours ouvrés, prévenant le Membre, le Chef de commission et le Président) est indépendante de ces réglages.
        </p>
        <label class="form-group dst__choix">
          <span class="form-label">Sous-type</span>
          <select class="form-control" (change)="choisirSousType($any($event.target).value)">
            <option value="" [selected]="!sousType()">— Choisir —</option>
            @for (t of sousTypes(); track t.idSousType) { <option [value]="t.idSousType" [selected]="sousType() === t.idSousType">{{ t.idSousType }}{{ t.libelleSousType ? ' — ' + t.libelleSousType : '' }}</option> }
          </select>
        </label>
        @if (sousType()) {
          @if (chargementSt()) {
            <p class="text-muted" role="status">Chargement…</p>
          } @else if (erreurSt()) {
            <p class="text-sm" role="alert">Les délais de ce sous-type n’ont pas pu être chargés.</p>
          } @else {
            <div class="table-responsive">
              <table class="cnm-table">
                <thead>
                  <tr><th scope="col">Étape</th><th scope="col">Délai standard</th><th scope="col">Délai du sous-type (heures ouvrées)</th><th scope="col"></th></tr>
                </thead>
                <tbody>
                  @for (d of lignesSt(); track d.etape) {
                    <tr>
                      <td>{{ etapeLabel(d.etape) }}<span class="cnm-mono dst__code">{{ d.etape }}</span></td>
                      <td>{{ d.standardHeures }} h</td>
                      <td>
                        <input type="number" class="form-control dst__jours" min="1" step="1" [value]="saisiesSt()[d.etape] ?? d.delaiHeures"
                          [attr.aria-label]="'Délai du sous-type ' + sousType() + ' — ' + etapeLabel(d.etape)" (input)="saisirSt(d.etape, $any($event.target).value)" />
                        @if (d.surcharge) { <span class="badge badge-info dst__propre">propre au sous-type</span> }
                      </td>
                      <td class="dst__actions">
                        <button type="button" class="btn btn-primary btn-sm" [disabled]="savingSt() === d.etape || !modifieSt(d)" (click)="reglerSt(d)">Régler</button>
                        @if (d.surcharge) {
                          <button type="button" class="btn btn-outline btn-sm" [disabled]="savingSt() === d.etape" (click)="revenirSt(d)">Revenir au standard</button>
                        }
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="4" class="cnm-muted">Aucune étape réglable pour ce sous-type.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }
        }
      </section>
    </section>
  `,
  styles: `
    .dst { display: flex; flex-direction: column; gap: 1rem; }
    .dst__jours { max-width: 8rem; }
    .dst__code { font-size: var(--text-xs); color: var(--n-400); margin-left: 0.35rem; }
    .dst__st { display: flex; flex-direction: column; gap: 0.6rem; border-top: 1px solid var(--n-200); padding-top: 1rem; }
    .dst__h2 { margin: 0; font-size: 1.05rem; }
    .dst__aide { margin: 0; max-width: 60rem; }
    .dst__choix { max-width: 26rem; }
    .dst__propre { margin-left: 0.4rem; }
    .dst__actions { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  `,
})
export class DelaisStandards implements OnInit {
  private readonly service = inject(DelaiStandardService);
  private readonly toast = inject(ToastService);

  readonly delais = signal<DelaiStandard[]>([]);
  /** Saisies en cours, par étape (l'input est contrôlé par [value], pas de formulaire). */
  readonly saisies = signal<Partial<Record<EtapeCircuit, string>>>({});
  readonly loading = signal(true);
  readonly saving = signal<EtapeCircuit | null>(null);

  // ── ⚠️ M5b (V99) — les délais par sous-type ──
  private readonly sousTypesService = inject(SousTypeDossierService);
  readonly sousTypes = signal<SousTypeDossier[]>([]);
  readonly sousType = signal<string | null>(null);
  readonly lignesSt = signal<DelaiSousType[]>([]);
  readonly saisiesSt = signal<Partial<Record<EtapeCircuit, string>>>({});
  readonly chargementSt = signal(false);
  readonly erreurSt = signal(false);
  readonly savingSt = signal<EtapeCircuit | null>(null);

  ngOnInit(): void {
    this.charger();
    this.sousTypesService.list().subscribe({
      next: (l) => this.sousTypes.set([...l].sort((a, b) => a.idTypeDossier.localeCompare(b.idTypeDossier) || a.idSousType.localeCompare(b.idSousType))),
      error: () => this.sousTypes.set([]),
    });
  }

  choisirSousType(code: string): void {
    this.sousType.set(code || null);
    this.saisiesSt.set({});
    this.lignesSt.set([]);
    this.erreurSt.set(false);
    if (!code) return;
    this.chargementSt.set(true);
    this.service.parSousType(code).subscribe({
      next: (l) => {
        if (this.sousType() !== code) return;
        this.lignesSt.set(l);
        this.chargementSt.set(false);
      },
      error: () => {
        this.erreurSt.set(true);
        this.chargementSt.set(false);
      },
    });
  }

  saisirSt(etape: EtapeCircuit, valeur: string): void {
    this.saisiesSt.update((s) => ({ ...s, [etape]: valeur }));
  }

  modifieSt(d: DelaiSousType): boolean {
    const saisie = this.saisiesSt()[d.etape];
    return saisie != null && saisie !== '' && Number(saisie) !== d.delaiHeures;
  }

  /** Remplace la ligne d'une étape et oublie sa saisie. */
  private poserLigneSt(maj: DelaiSousType): void {
    this.lignesSt.update((l) => l.map((x) => (x.etape === maj.etape ? maj : x)));
    this.saisiesSt.update((s) => {
      const copie = { ...s };
      delete copie[maj.etape];
      return copie;
    });
  }

  reglerSt(d: DelaiSousType): void {
    const code = this.sousType();
    const heures = Number(this.saisiesSt()[d.etape]);
    if (!code) return;
    if (!Number.isInteger(heures) || heures < 1) {
      this.toast.error("Le délai est un nombre entier d'heures ouvrées, au moins 1 (8 h = 1 jour ouvré).");
      return;
    }
    this.savingSt.set(d.etape);
    this.service.reglerSousType(code, d.etape, heures).subscribe({
      next: (maj) => {
        this.savingSt.set(null);
        this.poserLigneSt({ ...d, ...maj, surcharge: true });
        this.toast.success(`${code} — « ${this.etapeLabel(d.etape)} » : ${heures} h ouvrées.`);
      },
      error: (e: { message?: string }) => {
        this.savingSt.set(null);
        this.toast.error(e.message || 'Le délai n’a pas pu être réglé.');
      },
    });
  }

  revenirSt(d: DelaiSousType): void {
    const code = this.sousType();
    if (!code) return;
    this.savingSt.set(d.etape);
    this.service.revenirAuStandard(code, d.etape).subscribe({
      next: () => {
        this.savingSt.set(null);
        this.poserLigneSt({ ...d, delaiHeures: d.standardHeures, surcharge: false });
        this.toast.success(`${code} — « ${this.etapeLabel(d.etape)} » suit de nouveau le délai standard (${d.standardHeures} h).`);
      },
      error: (e: { message?: string }) => {
        this.savingSt.set(null);
        this.toast.error(e.message || 'Le délai n’a pas pu être rétabli.');
      },
    });
  }

  charger(): void {
    this.loading.set(true);
    this.service.list().subscribe({
      next: (rows) => {
        this.delais.set(rows);
        this.saisies.set({});
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  etapeLabel(etape: EtapeCircuit): string {
    return ETAPE_CIRCUIT_LABELS[etape] ?? etape;
  }

  saisir(etape: EtapeCircuit, valeur: string): void {
    this.saisies.update((s) => ({ ...s, [etape]: valeur }));
  }

  modifie(d: DelaiStandard): boolean {
    const saisie = this.saisies()[d.etape];
    return saisie != null && saisie !== '' && Number(saisie) !== d.delaiHeures;
  }

  enregistrer(d: DelaiStandard): void {
    const heures = Number(this.saisies()[d.etape]);
    if (!Number.isInteger(heures) || heures < 1) {
      this.toast.error("Le délai standard est un nombre entier d'heures ouvrées, au moins 1 (8 h = 1 jour ouvré).");
      return;
    }
    this.saving.set(d.etape);
    this.service.update(d.etape, { ...d, delaiHeures: heures }).subscribe({
      next: (maj) => {
        this.saving.set(null);
        this.delais.update((rows) => rows.map((r) => (r.etape === maj.etape ? maj : r)));
        this.saisies.update((s) => {
          const copie = { ...s };
          delete copie[d.etape];
          return copie;
        });
        this.toast.success(`Délai standard de « ${maj.libelle || this.etapeLabel(maj.etape)} » : ${maj.delaiHeures} h ouvrées.`);
      },
      error: () => this.saving.set(null), // 400/403 → dialogue centralisé (message backend)
    });
  }
}
