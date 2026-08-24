import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { PermissionsService } from '../../core/auth/permissions.service';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { CrudService } from '../../services/api/crud.service';
import { LectureBadge } from '../security/lecture-badge';
import { EtatErreur } from '../ui/etat-erreur';
import { CrudResourceConfig, FieldConfig, RowAction } from './crud-config';

interface ActiveFilter {
  label: string;
  key: string;
  value: string;
}

type Row = Record<string, unknown>;

/**
 * Écran CRUD générique piloté par `CrudResourceConfig` (fourni via `route.data.crud`).
 * Affiche la liste, gère création/modification/suppression et le mapping des
 * erreurs de validation (`fieldErrors`) renvoyées en 400.
 *
 * Les actions d'écriture sont masquées (`*appCan`) selon la capacité de la config ;
 * le backend reste l'autorité (403/409).
 */
@Component({
  selector: 'app-crud-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, LectureBadge, EtatErreur],
  templateUrl: './crud-page.html',
  styleUrl: './crud-page.scss',
})
export class CrudPage {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly permissions = inject(PermissionsService);

  protected readonly config: CrudResourceConfig;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly service: CrudService<any, string | number>;

  /** Vrai si l'utilisateur peut écrire (capacité accordée, ou ressource sans capacité). */
  readonly canWrite = computed(() => {
    if (this.config.readOnly) {
      return false;
    }
    const cap = this.config.writeCapability;
    return cap ? this.permissions.can(cap) : true;
  });

  readonly rows = signal<Row[]>([]);
  readonly loading = signal(false);
  /** Échec du chargement de la liste (affiche l'erreur + « Réessayer », AUDIT.md P9). */
  readonly erreur = signal(false);
  readonly formOpen = signal(false);
  readonly formMode = signal<'create' | 'edit'>('create');
  readonly fieldErrors = signal<Record<string, string>>({});
  readonly activeFilter = signal<ActiveFilter | null>(null);
  /** id → libellé, par champ FK (chargé une fois par référentiel lié). */
  private readonly lookups = signal<Record<string, Map<string, string>>>({});
  /** Options { value, label, row? } d'une liste déroulante FK (valeur brute ; `row` = ligne source pour les filtres niveau/champ). */
  private readonly refOptions = signal<Record<string, { value: unknown; label: string; row?: Row }[]>>({});
  /** Par champ à `superiorLevelFilter` : map (valeur de `fromField`) → niveau (lue dans le référentiel `viaService`). */
  private readonly auxLevelMaps = signal<Record<string, Map<string, number>>>({});

  /** Lignes affichées (toutes, ou filtrées par le query param actif). */
  readonly visibleRows = computed(() => {
    const f = this.activeFilter();
    const rows = this.rows();
    return f ? rows.filter((r) => String(r[f.key]) === f.value) : rows;
  });

  /** Valeur du filtre courant, résolue en libellé si possible (repli sur #id). */
  readonly filterValueLabel = computed(() => {
    const f = this.activeFilter();
    if (!f) {
      return '';
    }
    const field = this.config.fields.find((c) => c.key === f.key);
    const label = field?.ref ? this.lookups()[f.key]?.get(f.value) : undefined;
    return label ?? `#${f.value}`;
  });

  form: FormGroup = this.fb.group({});
  private editingId: string | number | null = null;
  /** Terme de recherche par nom (débattu puis envoyé au serveur si `config.searchByName`). */
  private readonly search$ = new Subject<string>();

  /** Champs affichés en colonnes de liste (exclut ceux marqués `hideInList`, ex. PK). */
  get listFields(): FieldConfig[] {
    return this.config.fields.filter((f) => !f.hideInList);
  }

  /** Champs affichés dans le formulaire (exclut les PK auto-générées, masquées). */
  get formFields(): FieldConfig[] {
    return this.config.fields.filter((f) => !f.autoId && !f.hideInForm);
  }

  /** Options d'une liste déroulante FK, filtrées par `superiorLevelFilter` et/ou `matchFields` si définis. */
  refOptionsFor(key: string): { value: unknown; label: string; row?: Row }[] {
    const ref = this.config.fields.find((f) => f.key === key)?.ref;
    let opts = this.refOptions()[key] ?? [];
    if (!ref) {
      return opts;
    }
    const slf = ref.superiorLevelFilter;
    if (slf) {
      // Niveau de la valeur choisie dans `fromField` : on ne garde que les options de niveau strictement au-dessus.
      const src = this.form?.get(slf.fromField)?.value;
      const srcLevel = src != null ? this.auxLevelMaps()[key]?.get(String(src)) : undefined;
      if (srcLevel == null) {
        return []; // pas de catégorie choisie (ou inconnue) → aucun parent proposé
      }
      opts = opts.filter(
        (o) => (o.row?.[slf.optionLevelKey] as number | undefined) != null
          && (o.row![slf.optionLevelKey] as number) < srcLevel
          && String(o.value) !== String(this.editingId),
      );
    }
    // Filtres « même champ » (ex. même organigramme) : contrainte ignorée tant que le champ source est vide.
    for (const m of ref.matchFields ?? []) {
      const want = this.form?.get(m.formField)?.value;
      if (want === null || want === undefined || want === '') {
        continue;
      }
      opts = opts.filter((o) => String(o.row?.[m.optionKey]) === String(want));
    }
    return opts;
  }

  /** Options d'une liste déroulante alimentée par les valeurs distinctes déjà saisies. */
  dataOptionsFor(field: FieldConfig): { value: unknown; label: string }[] {
    const seen = new Set<string>();
    const out: { value: unknown; label: string }[] = [];
    for (const row of this.rows()) {
      const v = row[field.key];
      if (v === null || v === undefined || v === '') {
        continue;
      }
      const cle = String(v);
      if (seen.has(cle)) {
        continue;
      }
      seen.add(cle);
      out.push({ value: v, label: cle });
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, 'fr', { numeric: true }));
  }

  constructor() {
    this.config = this.route.snapshot.data['crud'] as CrudResourceConfig;
    this.service = inject(this.config.service);
    this.load();
    this.buildLookups();

    // Filtre client piloté par le query param (ex. ?organigramme=2).
    this.route.queryParamMap.subscribe((params) => {
      const match = (this.config.filters ?? []).find((f) => params.get(f.param) !== null);
      this.activeFilter.set(
        match ? { label: match.label, key: match.key, value: params.get(match.param) as string } : null,
      );
    });

    // Recherche par nom côté serveur (débattu) : terme vide → liste complète.
    if (this.config.searchByName) {
      this.search$
        .pipe(debounceTime(300), distinctUntilChanged(), takeUntilDestroyed())
        .subscribe((term) => this.runSearch(term));
    }
  }

  onSearch(term: string): void {
    this.search$.next(term);
  }

  private runSearch(term: string): void {
    const t = term.trim();
    if (!t) {
      this.load();
      return;
    }
    this.loading.set(true);
    this.erreur.set(false);
    this.service.searchByName(t).subscribe({
      next: (rows) => {
        this.rows.set(rows as Row[]);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
  }

  /** Retire le filtre courant (revient à la liste complète). */
  clearFilter(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  /** Public : rejoué tel quel par le bouton « Réessayer » de l'état d'erreur (AUDIT.md P9). */
  load(): void {
    this.loading.set(true);
    this.erreur.set(false);
    this.service.list().subscribe({
      next: (rows) => {
        this.rows.set(rows as Row[]);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.erreur.set(true);
      },
    });
  }

  openCreate(): void {
    this.formMode.set('create');
    this.editingId = null;
    this.fieldErrors.set({});
    this.form = this.buildForm(null);
    this.formOpen.set(true);
  }

  openEdit(row: Row): void {
    this.formMode.set('edit');
    this.editingId = row[this.config.idKey] as string | number;
    this.fieldErrors.set({});
    this.form = this.buildForm(row);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const body = this.form.getRawValue();
    const request =
      this.formMode() === 'create'
        ? this.service.create(body)
        : this.service.update(this.editingId as string | number, body);

    request.subscribe({
      next: () => {
        this.toast.success(this.formMode() === 'create' ? 'Enregistrement créé.' : 'Modifié.');
        this.formOpen.set(false);
        this.load();
      },
      error: (err: ApiError) => {
        // 400 : le toast global est supprimé, on affiche les erreurs sous les champs.
        this.fieldErrors.set(err.fieldErrors ?? {});
      },
    });
  }

  remove(row: Row): void {
    const id = row[this.config.idKey] as string | number;
    if (!confirm(`Supprimer définitivement cet enregistrement (${id}) ?`)) {
      return;
    }
    this.service.delete(id).subscribe({
      next: () => {
        this.toast.success('Enregistrement supprimé.');
        this.load();
      },
      // 404 / 409 (ex. PRMP avec dossiers/entités liés) : le toast est déjà affiché par
      // l'intercepteur ; on absorbe l'erreur pour éviter un log non géré (la liste reste inchangée).
      error: () => {},
    });
  }

  /** Options figées normalisées en paires { value, label } (une valeur brute est son propre libellé). */
  optionsFixes(field: FieldConfig): { value: string | number; label: string }[] {
    return (field.options ?? []).map((opt) =>
      typeof opt === 'object' ? opt : { value: opt, label: String(opt) },
    );
  }

  display(row: Row, field: FieldConfig): string {
    // Affichage depuis une autre clé (ex. libellé fourni par le serveur) si défini.
    if (field.displayKey) {
      const v = row[field.displayKey];
      return v === null || v === undefined || v === '' ? '—' : String(v);
    }
    const value = row[field.key];
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    if (field.type === 'boolean') {
      return value ? 'Oui' : 'Non';
    }
    if (field.ref) {
      // Résolution FK : libellé si connu, sinon repli sur l'id brut.
      return this.lookups()[field.key]?.get(String(value)) ?? String(value);
    }
    if (field.options) {
      // Option figée en paire {value,label} : la cellule montre le libellé, pas le code envoyé.
      const opt = this.optionsFixes(field).find((o) => o.value === value);
      if (opt) return opt.label;
    }
    return String(value);
  }

  /** Charge chaque référentiel lié UNE fois et construit sa table id → libellé. */
  private buildLookups(): void {
    for (const field of this.config.fields) {
      const ref = field.ref;
      if (!ref) {
        continue;
      }
      const slf = ref.superiorLevelFilter;
      const needsRow = !!slf || !!ref.matchFields; // conserve la ligne source pour les filtres
      inject(ref.service)
        .list()
        .subscribe({
          next: (rows: Row[]) => {
            const map = new Map<string, string>();
            const options: { value: unknown; label: string; row?: Row }[] = [];
            for (const r of rows) {
              const raw = r[ref.idKey];
              const id = String(raw);
              const label = ref.labelKeys
                .map((k) => r[k])
                .filter((v) => v !== null && v !== undefined && v !== '')
                .join(' ')
                .trim();
              map.set(id, label || id);
              options.push({ value: raw, label: label || id, row: needsRow ? r : undefined });
            }
            this.lookups.update((cur) => ({ ...cur, [field.key]: map }));
            this.refOptions.update((cur) => ({ ...cur, [field.key]: options }));
          },
        });
      // Référentiel auxiliaire (ex. catégories) : map (valeur source) → niveau, pour calculer le seuil.
      if (slf) {
        inject(slf.viaService)
          .list()
          .subscribe({
            next: (rows: Row[]) => {
              const m = new Map<string, number>();
              for (const r of rows) {
                const key = r[slf.viaMatchKey];
                const lvl = r[slf.viaLevelKey];
                if (key != null && lvl != null) m.set(String(key), Number(lvl));
              }
              this.auxLevelMaps.update((cur) => ({ ...cur, [field.key]: m }));
            },
          });
      }
    }
  }

  fieldError(key: string): string | undefined {
    return this.fieldErrors()[key];
  }

  /** Paramètres de requête d'une action de ligne (ex. { ppm: row.idPpm }). */
  rowActionParams(action: RowAction, row: Row): Record<string, unknown> {
    return { [action.queryParam]: row[action.valueKey ?? this.config.idKey] };
  }

  private buildForm(model: Row | null): FormGroup {
    const group: Record<string, ReturnType<FormBuilder['control']>> = {};
    for (const field of this.config.fields) {
      // Champ dérivé serveur : hors formulaire ET hors payload (valeur client ignorée de toute façon).
      if (field.hideInForm) continue;
      const locked = this.formMode() === 'edit' && !!field.pk;
      const fallback = field.type === 'boolean' ? false : null;
      let initial = model ? (model[field.key] ?? fallback) : fallback;
      // PK auto-générée : à la création, valeur = max(ids existants) + 1 (le champ reste masqué).
      if (field.autoId && this.formMode() === 'create') {
        initial = this.nextAutoId(field);
      }
      group[field.key] = this.fb.control(
        { value: initial, disabled: locked },
        field.required ? [Validators.required] : [],
      );
    }
    const fg = this.fb.group(group);
    // Ordre auto par groupe (`autoOrderBy`) : à la création, suit le champ de regroupement
    // (ex. la famille) et propose max(du groupe) + 1 tant que l'utilisateur n'a rien saisi.
    if (this.formMode() === 'create') {
      for (const field of this.config.fields) {
        if (!field.autoOrderBy) {
          continue;
        }
        const groupCtrl = fg.get(field.autoOrderBy);
        const orderCtrl = fg.get(field.key);
        if (!groupCtrl || !orderCtrl) {
          continue;
        }
        groupCtrl.valueChanges.subscribe((g) => {
          if (!orderCtrl.dirty) {
            orderCtrl.setValue(this.nextOrder(field, g));
          }
        });
      }
    }
    return fg;
  }

  /** Prochain ordre dans le groupe : max des lignes de même valeur de regroupement + 1 (1 si aucune). */
  private nextOrder(field: FieldConfig, groupValue: unknown): number {
    const group = String(groupValue);
    const nums = this.rows()
      .filter((r) => String(r[field.autoOrderBy as string]) === group)
      .map((r) => Number(r[field.key]))
      .filter((n) => Number.isFinite(n));
    return (nums.length ? Math.max(...nums) : 0) + 1;
  }

  /** Prochain identifiant numérique libre pour une PK auto-générée (max existant + 1). */
  private nextAutoId(field: FieldConfig): number {
    const ids = this.rows()
      .map((r) => Number(r[field.key]))
      .filter((n) => Number.isFinite(n));
    return (ids.length ? Math.max(...ids) : 0) + 1;
  }
}
