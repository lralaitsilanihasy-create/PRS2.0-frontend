import { Directive, ElementRef, HostListener, forwardRef, inject } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

/**
 * Affiche un champ montant avec **séparateur de milliers** (format fr-FR) tout en conservant une
 * **valeur numérique** dans le `FormControl`. À poser sur un `<input type="text" appMontantFr>`
 * (pas `type="number"`, qui interdit les espaces de groupement).
 *
 * UX : à l'édition (focus) on montre la valeur brute (chiffres seuls, saisie facile) ; à la sortie
 * (blur) on reformate avec les espaces ; à chaque frappe la valeur numérique est propagée au form.
 */
@Directive({
  selector: 'input[appMontantFr]',
  standalone: true,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => MontantFrDirective), multi: true }],
})
export class MontantFrDirective implements ControlValueAccessor {
  private readonly el = inject<ElementRef<HTMLInputElement>>(ElementRef).nativeElement;
  private valeur: number | null = null;
  private onChange: (v: number | null) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(v: number | null): void {
    this.valeur = v ?? null;
    this.el.value = this.format(this.valeur);
  }
  registerOnChange(fn: (v: number | null) => void): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }
  setDisabledState(disabled: boolean): void {
    this.el.disabled = disabled;
  }

  @HostListener('input')
  onInput(): void {
    this.valeur = this.parse(this.el.value);
    this.onChange(this.valeur);
  }
  @HostListener('focus')
  onFocus(): void {
    // Saisie facile : chiffres bruts (sans espaces de groupement).
    this.el.value = this.valeur == null ? '' : String(this.valeur);
  }
  @HostListener('blur')
  onBlur(): void {
    this.el.value = this.format(this.valeur);
    this.onTouched();
  }

  /** Parse une saisie libre (espaces, virgule décimale) en nombre, ou `null` si vide/invalide. */
  private parse(saisie: string): number | null {
    const nettoye = saisie
      .replace(/[\s  ]/g, '')
      .replace(',', '.')
      .replace(/[^0-9.]/g, '');
    if (nettoye === '') return null;
    const n = Number(nettoye);
    return isNaN(n) ? null : n;
  }
  /**
   * Formate un nombre avec séparateur de milliers = **espace normale visible** (et virgule décimale),
   * ou '' si absent. On groupe manuellement pour éviter l'espace fine insécable (U+202F) de
   * `Intl.NumberFormat('fr-FR')`, peu ou pas visible selon la police/rendu.
   */
  private format(v: number | null): string {
    if (v == null) return '';
    const [ent, dec] = Math.abs(v).toString().split('.');
    const groupe = ent.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (v < 0 ? '-' : '') + groupe + (dec ? ',' + dec : '');
  }
}
