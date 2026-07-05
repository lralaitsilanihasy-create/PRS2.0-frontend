import { AfterViewInit, Directive, ElementRef, HostListener, inject } from '@angular/core';

/**
 * Auto-dimensionne un `<textarea>` à la hauteur de son contenu (retour à la ligne visible en entier,
 * sans barre de défilement). Se recalcule à la saisie et après l'initialisation de la vue (utile quand
 * la valeur est posée par le formulaire, ex. import PPM). À poser sur `<textarea appAutosize>`.
 */
@Directive({
  selector: 'textarea[appAutosize]',
  standalone: true,
})
export class AutosizeDirective implements AfterViewInit {
  private readonly el = inject<ElementRef<HTMLTextAreaElement>>(ElementRef).nativeElement;

  ngAfterViewInit(): void {
    this.ajuster();
    // La valeur du formulaire peut être écrite juste après l'init de la vue (import) : re-mesure au tick suivant.
    queueMicrotask(() => this.ajuster());
  }

  @HostListener('input')
  onInput(): void {
    this.ajuster();
  }

  private ajuster(): void {
    this.el.style.height = 'auto';
    this.el.style.height = this.el.scrollHeight + 'px';
  }
}
