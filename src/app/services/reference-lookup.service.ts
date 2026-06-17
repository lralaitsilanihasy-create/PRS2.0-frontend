import { Injectable, Injector, Type, inject } from '@angular/core';
import { Observable, map, shareReplay } from 'rxjs';

import { CrudService } from './api/crud.service';

/**
 * Charge un référentiel UNE fois (cache partagé `shareReplay`) et expose une table
 * de correspondance `id → libellé`. Réutilisable par tout écran qui doit résoudre
 * des clés étrangères en libellés, sans schéma N+1 ni endpoint imbriqué.
 */
@Injectable({ providedIn: 'root' })
export class ReferenceLookupService {
  private readonly injector = inject(Injector);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private readonly cache = new Map<Type<CrudService<any, any>>, Observable<Map<string, string>>>();

  /**
   * @param service  Service du référentiel (ex. ModePassationService).
   * @param idKey    Champ clé primaire du DTO (ex. 'idMode').
   * @param labelKeys Champs composant le libellé (ex. ['libelle']).
   */
  lookup(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service: Type<CrudService<any, any>>,
    idKey: string,
    labelKeys: string[],
  ): Observable<Map<string, string>> {
    let obs = this.cache.get(service);
    if (!obs) {
      obs = this.injector
        .get(service)
        .list()
        .pipe(
          map((rows: Record<string, unknown>[]) => {
            const m = new Map<string, string>();
            for (const r of rows) {
              const id = String(r[idKey]);
              const label = labelKeys
                .map((k) => r[k])
                .filter((v) => v !== null && v !== undefined && v !== '')
                .join(' ')
                .trim();
              m.set(id, label || id);
            }
            return m;
          }),
          shareReplay(1),
        );
      this.cache.set(service, obs);
    }
    return obs;
  }
}
