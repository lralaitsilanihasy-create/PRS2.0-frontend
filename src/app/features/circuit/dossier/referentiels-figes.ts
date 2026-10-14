import { Injectable, inject, signal } from '@angular/core';
import { catchError, of } from 'rxjs';

import { ModePassation, Nature, StatutMarche } from '../../../models';
import { ModePassationService, NatureService, StatutMarcheService } from '../../../services';
import { ResolveurFiges } from '../../../shared/ui/donnees-figees';

/**
 * ⚠️ 14/10 (refonte des présentations) — les écrans figés montraient « Nature 1 », « Mode de passation 1 », « Statut PREVU » : la ligne
 * du plan est figée avec ses identifiants et ses codes de référentiel. Ce résolveur, fourni par l'onglet des écrans figés, les traduit
 * avec les référentiels d'aujourd'hui (lus une fois, en silence ; à défaut, la valeur reste affichée telle quelle).
 */
@Injectable()
export class ReferentielsFiges implements ResolveurFiges {
  private readonly natures = signal<ReadonlyMap<number, string>>(new Map());
  private readonly modes = signal<ReadonlyMap<number, string>>(new Map());
  private readonly statuts = signal<ReadonlyMap<string, string>>(new Map());

  constructor() {
    inject(NatureService).list().pipe(catchError(() => of([] as Nature[])))
      .subscribe((l) => this.natures.set(new Map(l.filter((n) => n.libelle).map((n) => [n.idNature, n.libelle as string]))));
    inject(ModePassationService).list().pipe(catchError(() => of([] as ModePassation[])))
      .subscribe((l) => this.modes.set(new Map(l.filter((m) => m.libelle).map((m) => [m.idMode, m.libelle as string]))));
    inject(StatutMarcheService).list().pipe(catchError(() => of([] as StatutMarche[])))
      .subscribe((l) => this.statuts.set(new Map(l.map((s) => [s.code, s.libelle]))));
  }

  resoudre(cle: string, valeur: string | number): string | null {
    if (cle === 'idNature') return this.natures().get(Number(valeur)) ?? null;
    if (cle === 'idMode') return this.modes().get(Number(valeur)) ?? null;
    if (cle === 'statut') return this.statuts().get(String(valeur)) ?? null;
    return null;
  }
}
