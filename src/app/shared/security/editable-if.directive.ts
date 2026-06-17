import { Directive, ElementRef, Renderer2, effect, inject, input } from '@angular/core';
import { NgControl } from '@angular/forms';

import { PermissionsService } from '../../core/auth/permissions.service';
import { Capability } from '../../core/auth/permissions';

/**
 * Rend un contrôle éditable uniquement si le profil courant possède la capacité ;
 * sinon il passe en lecture seule (readonly/disabled) avec la classe `is-readonly`.
 *
 * Fonctionne avec un contrôle Reactive Forms (désactivation propre via NgControl)
 * comme avec un champ natif (`<input>`, `<select>`, `<textarea>`, `<button>`).
 *
 * Usage : `<input formControlName="complet" [appEditableIf]="'RECEPTION_WRITE'" />`.
 *
 * Confort UX : le backend reste l'autorité et refusera (403) une écriture interdite.
 */
@Directive({ selector: '[appEditableIf]' })
export class EditableIfDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly permissions = inject(PermissionsService);
  private readonly ngControl = inject(NgControl, { optional: true, self: true });

  readonly appEditableIf = input.required<Capability>();

  constructor() {
    effect(() => {
      this.apply(this.permissions.can(this.appEditableIf()));
    });
  }

  private apply(editable: boolean): void {
    const node = this.el.nativeElement;

    if (this.ngControl?.control) {
      // Reactive Forms : désactivation propre (exclu de value, inclus dans getRawValue).
      if (editable) {
        this.ngControl.control.enable({ emitEvent: false });
      } else {
        this.ngControl.control.disable({ emitEvent: false });
      }
    } else {
      // Contrôle natif : readonly pour la saisie texte, disabled sinon.
      const useDisabled = this.usesDisabledAttribute(node);
      const attr = useDisabled ? 'disabled' : 'readonly';
      if (editable) {
        this.renderer.removeAttribute(node, attr);
      } else {
        this.renderer.setAttribute(node, attr, attr);
      }
    }

    if (editable) {
      this.renderer.removeClass(node, 'is-readonly');
    } else {
      this.renderer.addClass(node, 'is-readonly');
    }
  }

  /** `readonly` n'a pas d'effet sur select/checkbox/radio/button : on utilise `disabled`. */
  private usesDisabledAttribute(node: HTMLElement): boolean {
    const tag = node.tagName.toLowerCase();
    if (tag === 'select' || tag === 'button') {
      return true;
    }
    if (tag === 'input') {
      const type = (node as HTMLInputElement).type.toLowerCase();
      return type === 'checkbox' || type === 'radio';
    }
    return false;
  }
}
