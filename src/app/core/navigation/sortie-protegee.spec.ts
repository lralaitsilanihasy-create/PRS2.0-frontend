import { ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { SortieProtegee, sortieProtegeeGuard } from './sortie-protegee';

describe('sortieProtegeeGuard', () => {
  const garder = (ecran: SortieProtegee | null) =>
    sortieProtegeeGuard(ecran as SortieProtegee, {} as ActivatedRouteSnapshot, {} as RouterStateSnapshot, {} as RouterStateSnapshot);

  it("délègue la décision à l'écran, réponse immédiate ou différée", async () => {
    expect(garder({ autoriserSortie: () => true })).toBe(true);
    expect(garder({ autoriserSortie: () => false })).toBe(false);
    expect(await garder({ autoriserSortie: () => Promise.resolve(false) })).toBe(false);
  });

  it("laisse passer un écran qui n'implémente pas la protection", () => {
    expect(garder(null)).toBe(true);
    expect(garder({} as SortieProtegee)).toBe(true);
  });
});
