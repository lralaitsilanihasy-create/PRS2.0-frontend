import { provideRouter } from '@angular/router';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardShell, KpiTile, WorklistItem } from './dashboard-shell';

/**
 * Coquille de tableau de bord (AUDIT.md P9) : un tableau de bord agrège plusieurs sources
 * indépendantes, donc l'état d'erreur se pose PAR TUILE (`WorklistItem.error`, `KpiTile.error`)
 * ou par section (`pipelineError`), pas en remplaçant tout l'écran. Ces tests verrouillent le
 * mécanisme partagé une seule fois ici — c'est lui que réutilisera tout futur consommateur de la
 * coquille, pas chaque tableau de bord individuellement.
 */
describe('DashboardShell — état d’erreur par tuile', () => {
  function preparer(): ComponentFixture<DashboardShell> {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    const fixture = TestBed.createComponent(DashboardShell);
    fixture.componentRef.setInput('title', 'Tableau de bord');
    return fixture;
  }

  it('une tuile KPI en échec affiche un état d’erreur au lieu de sa valeur — jamais un 0 trompeur', () => {
    const fixture = preparer();
    const kpis: KpiTile[] = [
      { label: 'À réceptionner', value: 4, error: true },
      { label: 'Dossiers (localité)', value: 12 },
    ];
    fixture.componentRef.setInput('kpis', kpis);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const tuiles = html.querySelectorAll('.cnm-stat');
    expect(tuiles).toHaveLength(2);

    // La tuile en échec : pas de valeur numérique, une alerte visible et réessayable.
    const enErreur = html.querySelector('.cnm-stat--error');
    expect(enErreur).not.toBeNull();
    expect(enErreur?.getAttribute('role')).toBe('alert');
    expect(enErreur?.textContent).not.toContain('4');
    expect(enErreur?.querySelector('button')?.textContent).toContain('Réessayer');

    // La tuile dont la source a réussi garde sa valeur intacte.
    expect(html.querySelector('.cnm-stat--indigo')?.textContent).toContain('12');
  });

  it('un élément de worklist en échec affiche un état d’erreur au lieu du compteur/de l’action', () => {
    const fixture = preparer();
    const worklist: WorklistItem[] = [
      {
        label: 'Dossiers à réceptionner',
        count: 7,
        actionLabel: 'Réceptionner',
        actionPath: '/secretaire/mes-dossiers',
        error: true,
      },
    ];
    fixture.componentRef.setInput('worklist', worklist);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    const tache = html.querySelector('.dash-task--error');
    expect(tache).not.toBeNull();
    expect(tache?.getAttribute('role')).toBe('alert');
    // Ni le compteur périmé, ni le lien d'action vers une donnée en échec.
    expect(tache?.textContent).not.toContain('7');
    expect(tache?.querySelector('a')).toBeNull();
    expect(tache?.querySelector('button')?.textContent).toContain('Réessayer');
  });

  it('pipelineError affiche l’état d’erreur générique à la place des pastilles de statut', () => {
    const fixture = preparer();
    fixture.componentRef.setInput('pipeline', [{ statut: 'SOUMIS', count: 3 }]);
    fixture.componentRef.setInput('pipelineError', true);
    fixture.detectChanges();

    const html = fixture.nativeElement as HTMLElement;
    expect(html.querySelector('app-etat-erreur')).not.toBeNull();
    expect(html.querySelector('.dash-pill')).toBeNull();
  });

  it('le « Réessayer » de n’importe quelle tuile en échec remonte un seul événement au consommateur', () => {
    const fixture = preparer();
    fixture.componentRef.setInput('kpis', [{ label: 'À réceptionner', value: 0, error: true }] satisfies KpiTile[]);
    let emis = 0;
    fixture.componentInstance.reessayer.subscribe(() => emis++);
    fixture.detectChanges();

    const bouton = (fixture.nativeElement as HTMLElement).querySelector('.cnm-stat--error button') as HTMLButtonElement;
    bouton.click();

    expect(emis).toBe(1);
  });
});
