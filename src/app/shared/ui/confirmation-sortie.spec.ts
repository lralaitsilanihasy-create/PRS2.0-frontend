import { TestBed } from '@angular/core/testing';

import { ConfirmationSortie } from './confirmation-sortie';

describe('ConfirmationSortie', () => {
  it('dialogue accessible : nom, message relié, « Rester » focalisé ; Échap et ✕ valent « Rester »', () => {
    const fixture = TestBed.createComponent(ConfirmationSortie);
    fixture.componentRef.setInput('titre', "Quitter l'examen sans enregistrer ?");
    fixture.componentRef.setInput('message', 'Les résultats saisis seront perdus.');
    document.body.appendChild(fixture.nativeElement);
    const rester = vi.fn();
    const quitter = vi.fn();
    fixture.componentInstance.rester.subscribe(rester);
    fixture.componentInstance.quitter.subscribe(quitter);
    fixture.detectChanges();

    const racine = fixture.nativeElement as HTMLElement;
    const dialogue = racine.querySelector('[role="alertdialog"]') as HTMLElement;
    expect(dialogue.getAttribute('aria-modal')).toBe('true');
    expect(dialogue.getAttribute('aria-label')).toBe("Quitter l'examen sans enregistrer ?");
    expect(document.getElementById(dialogue.getAttribute('aria-describedby') as string)?.textContent).toBe('Les résultats saisis seront perdus.');
    expect(document.activeElement?.textContent?.trim()).toBe("Rester sur l'écran");
    expect(racine.querySelector('.btn-close')?.getAttribute('aria-label')).toBe("Fermer et rester sur l'écran");

    dialogue.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    (racine.querySelector('.btn-close') as HTMLButtonElement).click();
    expect(rester).toHaveBeenCalledTimes(2);
    expect(quitter).not.toHaveBeenCalled();

    (racine.querySelector('.btn-danger') as HTMLButtonElement).click();
    expect(quitter).toHaveBeenCalledTimes(1);
    fixture.nativeElement.remove();
  });
});
