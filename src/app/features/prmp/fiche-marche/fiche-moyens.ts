import { ChangeDetectionStrategy, Component, WritableSignal, computed, effect, inject, input, output, signal } from '@angular/core';

import { ApiError, erreursParChamp } from '../../../core/errors/api-error';
import { ToastService } from '../../../core/notifications/toast.service';
import { MaterielExige, PersonnelExige } from '../../../models';
import { FicheMarcheService } from '../../../services/fiche-marche.services';
import { empreinte, ListeASauver } from './liste-a-sauver';
import { ligneMateriel, lignePersonnel, minimumIncoherent } from './moyens';

/** Une ligne d'écran : l'entrée et sa clé locale, qui survit au remplacement de l'objet à chaque frappe. */
type Ligne<T> = T & { cle: number };

/**
 * ⚠️ **Matériel et personnel exigés** des travaux (lot 3 du chantier b — livré le 03/10, V60, bloc `B13`,
 * `demande-backend-2026-10-03-materiel-personnel-travaux`). Deux listes de la fiche, pas de champs : le bloc les déclare
 * (`rendu = 'MOYENS'`). Chacune s'enregistre seule (`PUT` remplace la liste), et chaque entrée montre la ligne que le
 * DPAO imprimera à la clause 6.3 — la PRMP relit la phrase, pas seulement des cases.
 *
 * Les champs texte `B03-QT-09` (matériel) et `B03-QT-13` (personnel) restent au bloc B03, en complément (Q4 du plan).
 */
@Component({
  selector: 'app-fiche-moyens',
  standalone: true,
  templateUrl: './fiche-moyens.html',
  styleUrl: './fiche-moyens.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FicheMoyens implements ListeASauver {
  private readonly fiches = inject(FicheMarcheService);
  private readonly toast = inject(ToastService);

  readonly idDmc = input.required<number>();
  /** Fiche figée ou lecteur de la Commission : les listes se lisent, elles ne se modifient pas. */
  readonly lecture = input<boolean>(false);
  /** Une liste vient d'être enregistrée : la page mère relit son bilan de contrôles. */
  readonly enregistre = output<void>();

  readonly chargement = signal(true);
  readonly materiel = signal<Ligne<MaterielExige>[]>([]);
  readonly personnel = signal<Ligne<PersonnelExige>[]>([]);
  readonly savingMateriel = signal(false);
  readonly savingPersonnel = signal(false);
  /** Erreurs servies par le serveur, par chemin (`materiel[0].nombre`, `personnel[1].poste`). */
  readonly erreurs = signal<Map<string, string>>(new Map());
  private cles = 0;

  /** ⚠️ 03/10 — l'empreinte de chaque liste telle que servie ou enregistrée : la page la compare avant de quitter le bloc. */
  private readonly refMateriel = signal('[]');
  private readonly refPersonnel = signal('[]');
  readonly materielModifie = computed(() => empreinte(this.chargeMateriel()) !== this.refMateriel());
  readonly personnelModifie = computed(() => empreinte(this.chargePersonnel()) !== this.refPersonnel());
  readonly modifie = computed(() => this.materielModifie() || this.personnelModifie());

  readonly apercuMateriel = computed(() => this.materiel().map((m) => ligneMateriel(m)));
  readonly apercuPersonnel = computed(() => this.personnel().map((p) => lignePersonnel(p)));

  constructor() {
    effect(() => {
      const id = this.idDmc();
      this.chargement.set(true);
      let restants = 2;
      const fini = () => {
        if (--restants === 0) this.chargement.set(false);
      };
      // Une route pas encore servie (contrat demandé) laisse une liste vide, pas un écran en erreur.
      this.fiches.materiel(id).subscribe({
        next: (l) => (this.materiel.set(l.map((m) => this.cle(m))), this.refMateriel.set(empreinte(this.chargeMateriel())), fini()),
        error: () => (this.materiel.set([]), this.refMateriel.set('[]'), fini()),
      });
      this.fiches.personnel(id).subscribe({
        next: (l) => (this.personnel.set(l.map((p) => this.cle(p))), this.refPersonnel.set(empreinte(this.chargePersonnel())), fini()),
        error: () => (this.personnel.set([]), this.refPersonnel.set('[]'), fini()),
      });
    });
  }

  private cle<T>(x: T): Ligne<T> {
    return { ...x, cle: ++this.cles };
  }

  minimumIncoherent(m: MaterielExige): boolean {
    return minimumIncoherent(m);
  }

  erreurDe(liste: 'materiel' | 'personnel', rang: number, champ: string): string | null {
    return this.erreurs().get(`${liste}[${rang}].${champ}`) ?? null;
  }

  // ── Gestes communs aux deux listes ──────────────────────────────────────────────────────────

  /** Les deux listes partagent leurs gestes : on les manipule comme des lignes à clé, champ par champ. */
  private liste(nom: 'materiel' | 'personnel'): WritableSignal<Ligne<Record<string, unknown>>[]> {
    return (nom === 'materiel' ? this.materiel : this.personnel) as unknown as WritableSignal<Ligne<Record<string, unknown>>[]>;
  }

  ajouterMateriel(): void {
    this.materiel.update((l) => [...l, this.cle<MaterielExige>({ designation: '', caracteristique: null, nombre: 1, minimumEnPropre: null, parLot: false })]);
  }

  ajouterPersonnel(): void {
    this.personnel.update((l) => [
      ...l,
      this.cle<PersonnelExige>({ poste: '', nombre: 1, diplome: null, experienceAnnees: null, domaineExperience: null, justificatifs: null, parLot: false }),
    ]);
  }

  supprimer(nom: 'materiel' | 'personnel', cle: number): void {
    this.liste(nom).update((l) => l.filter((x) => x.cle !== cle));
  }

  deplacer(nom: 'materiel' | 'personnel', cle: number, pas: -1 | 1): void {
    const l = [...this.liste(nom)()];
    const i = l.findIndex((x) => x.cle === cle);
    const j = i + pas;
    if (i < 0 || j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    this.liste(nom).set(l);
  }

  saisirTexte(nom: 'materiel' | 'personnel', cle: number, champ: string, ev: Event): void {
    const valeur = (ev.target as HTMLInputElement).value;
    this.liste(nom).update((l) => l.map((x) => (x.cle === cle ? { ...x, [champ]: valeur } : x)));
  }

  saisirNombre(nom: 'materiel' | 'personnel', cle: number, champ: string, ev: Event): void {
    const brut = (ev.target as HTMLInputElement).value;
    const valeur = brut === '' ? null : Number(brut);
    this.liste(nom).update((l) => l.map((x) => (x.cle === cle ? { ...x, [champ]: valeur } : x)));
  }

  basculer(nom: 'materiel' | 'personnel', cle: number, champ: string, ev: Event): void {
    const coche = (ev.target as HTMLInputElement).checked;
    this.liste(nom).update((l) => l.map((x) => (x.cle === cle ? { ...x, [champ]: coche } : x)));
  }

  // ── Enregistrement : chaque liste seule ─────────────────────────────────────────────────────

  /** Ce que le `PUT` du matériel envoie, dans l'ordre affiché, sans les clés d'écran. */
  private chargeMateriel(): MaterielExige[] {
    return this.materiel().map((m) => ({
      designation: m.designation.trim(),
      caracteristique: m.caracteristique?.trim() || null,
      nombre: m.nombre,
      minimumEnPropre: m.minimumEnPropre ?? null,
      parLot: !!m.parLot,
    }));
  }

  private chargePersonnel(): PersonnelExige[] {
    return this.personnel().map((p) => ({
      poste: p.poste.trim(),
      nombre: p.nombre,
      diplome: p.diplome?.trim() || null,
      experienceAnnees: p.experienceAnnees ?? null,
      domaineExperience: p.domaineExperience?.trim() || null,
      justificatifs: p.justificatifs?.trim() || null,
      parLot: !!p.parLot,
    }));
  }

  enregistrerMateriel(): void {
    if (this.savingMateriel() || this.lecture()) return;
    void this.envoyerMateriel(true);
  }

  enregistrerPersonnel(): void {
    if (this.savingPersonnel() || this.lecture()) return;
    void this.envoyerPersonnel(true);
  }

  /** ⚠️ 03/10 — tout enregistrer avant de quitter le bloc : chaque liste modifiée (`ListeASauver`). */
  async sauver(): Promise<boolean> {
    if (this.lecture()) return true;
    if (this.materielModifie() && !(await this.envoyerMateriel(false))) return false;
    if (this.personnelModifie() && !(await this.envoyerPersonnel(false))) return false;
    return true;
  }

  /** Le `PUT` du matériel ; l'abonnement met l'écran à jour à la réponse même, la promesse dit l'issue. */
  private envoyerMateriel(annoncer: boolean): Promise<boolean> {
    this.savingMateriel.set(true);
    return new Promise((resoudre) =>
      this.fiches.enregistrerMateriel(this.idDmc(), this.chargeMateriel()).subscribe({
        next: (l) => {
          this.materiel.set(l.map((m) => this.cle(m)));
          this.refMateriel.set(empreinte(this.chargeMateriel()));
          this.savingMateriel.set(false);
          this.effacerErreurs('materiel');
          if (annoncer) this.toast.success('Matériel exigé enregistré.');
          this.enregistre.emit();
          resoudre(true);
        },
        error: (e: ApiError) => (this.echec('materiel', e, this.savingMateriel), resoudre(false)),
      }),
    );
  }

  private envoyerPersonnel(annoncer: boolean): Promise<boolean> {
    this.savingPersonnel.set(true);
    return new Promise((resoudre) =>
      this.fiches.enregistrerPersonnel(this.idDmc(), this.chargePersonnel()).subscribe({
        next: (l) => {
          this.personnel.set(l.map((p) => this.cle(p)));
          this.refPersonnel.set(empreinte(this.chargePersonnel()));
          this.savingPersonnel.set(false);
          this.effacerErreurs('personnel');
          if (annoncer) this.toast.success('Personnel exigé enregistré.');
          this.enregistre.emit();
          resoudre(true);
        },
        error: (e: ApiError) => (this.echec('personnel', e, this.savingPersonnel), resoudre(false)),
      }),
    );
  }

  private effacerErreurs(nom: 'materiel' | 'personnel'): void {
    this.erreurs.update((m) => new Map([...m].filter(([k]) => !k.startsWith(nom + '['))));
  }

  private echec(nom: 'materiel' | 'personnel', e: ApiError, saving: WritableSignal<boolean>): void {
    saving.set(false);
    const m = erreursParChamp(e);
    this.erreurs.update((avant) => new Map([...[...avant].filter(([k]) => !k.startsWith(nom + '[')), ...m]));
    if (!m.size) this.toast.error(e?.message ?? `La liste n'a pas pu être enregistrée.`);
  }
}
