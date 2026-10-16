import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiError } from '../../core/errors/api-error';
import { dateFr } from '../../core/interim/interim-libelles';
import { ouvrirBlobSur, telechargerBlob, validerFichier } from '../../core/securite/fichiers-surs';
import { NatureReponseRemise, RemiseTitulaire } from '../../models';
import { RemisesTitulaireService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { ariary } from '../evaluation/libelles-evaluation';
import { NATURES_REPONSE, refusRemise } from '../remises/remise-detail';
import { dateHeureFr } from './libelles-candidat';

const RESULTATS: Readonly<Record<string, { texte: string; classe: string }>> = {
  EN_COURS: { texte: 'En cours', classe: 'badge-info' },
  RETENU: { texte: 'Vous êtes retenu', classe: 'badge-success' },
  NON_RETENU: { texte: 'Non retenu', classe: 'badge-neutral' },
  INFRUCTUEUSE: { texte: 'Infructueuse', classe: 'badge-danger' },
};

/**
 * ⚠️ Lot MS-2 (V125, 16/10) — **les remises en concurrence** reçues par le titulaire d'un contrat-cadre (décret n° 2019-1064,
 * art. 21-27) : sa lettre d'invitation, sa réponse (devis, facture pro forma ou document convenu) jusqu'à l'échéance — une
 * nouvelle réponse remplace la précédente —, puis le résultat. Participer est une obligation du titulaire (art. 22).
 */
@Component({
  selector: 'app-remises-titulaire',
  imports: [EtatErreur],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rt">
      <h1 class="rt__h1">Remises en concurrence</h1>
      <p class="text-sm text-muted rt__intro">Les marchés subséquents des contrats-cadres dont vous êtes titulaire. Le titulaire est tenu de répondre aux remises en concurrence (décret n° 2019-1064, art. 22) ; votre réponse peut être remplacée jusqu’à l’échéance.</p>
      @if (chargement()) {
        <p class="text-muted" role="status">Chargement des remises…</p>
      } @else if (erreur(); as m) {
        <app-etat-erreur [message]="m" aide="La liste n’a pas pu être lue." (reessayer)="charger()" />
      } @else {
        @for (r of remises(); track r.id) {
          <article class="card rt__carte" [attr.aria-label]="'Remise n° ' + r.numero">
            <header class="rt__tete">
              <h2 class="rt__h2">Remise n° {{ r.numero }} — {{ r.objet }}</h2>
              <span class="badge" [class]="resultat(r.resultat).classe">{{ resultat(r.resultat).texte }}</span>
            </header>
            <p class="text-sm rt__meta">
              @if (r.objetContrat) { Contrat-cadre : {{ r.objetContrat }}{{ r.dateContrat ? ' (du ' + date(r.dateContrat) + ')' : '' }} · }
              Réponse avant le <strong>{{ dateHeure(r.echeance) }}</strong>{{ r.echeancePassee ? ' (passée)' : '' }} · délai d’exécution {{ r.delaiExecution || '—' }}{{ r.lieuLivraison ? ' · livraison : ' + r.lieuLivraison : '' }}
            </p>
            <div class="rt__actions">
              <button type="button" class="btn btn-outline btn-sm" (click)="ouvrir(service.lettre(r.id))">Lettre d’invitation (PDF)</button>
              <button type="button" class="btn btn-ghost btn-sm" (click)="enregistrer(service.lettre(r.id, 'docx'), 'lettre-remise-' + r.id + '.docx')">Word</button>
            </div>
            @if (r.maReponse; as m) {
              <p class="text-sm rt__meta">Votre réponse : {{ nature(m.nature) }}{{ m.montantHt != null ? ' — ' + ariary(m.montantHt) + ' HT' : '' }}, reçue le {{ dateHeure(m.recueLe) }}{{ m.fichier ? ' (' + m.fichier + ')' : '' }}.</p>
            } @else if (r.echeancePassee) {
              <p class="text-sm rt__alerte">Aucune réponse avant l’échéance.</p>
            }
            @if (r.motif && r.resultat !== 'EN_COURS') { <p class="text-sm rt__meta">{{ r.motif }}</p> }

            @if (!r.echeancePassee && r.resultat === 'EN_COURS') {
              <details class="rt__details" [open]="!r.maReponse">
                <summary>{{ r.maReponse ? 'Remplacer ma réponse…' : 'Répondre' }}</summary>
                <div class="rt__form">
                  <div class="rt__ligne">
                    <label class="form-group"><span class="form-label">Nature</span>
                      <select class="form-control" (change)="poser(r.id, 'nature', $any($event.target).value)">
                        <option value="">—</option>
                        @for (n of natures; track n) { <option [value]="n" [selected]="champ(r.id, 'nature') === n">{{ nature(n) }}</option> }
                      </select>
                    </label>
                    <label class="form-group"><span class="form-label">Montant HT (Ariary)</span><input class="form-control" type="number" min="0" step="1" [value]="champ(r.id, 'ht')" (input)="poser(r.id, 'ht', $any($event.target).value)" /></label>
                    <label class="form-group"><span class="form-label">Montant TTC (facultatif)</span><input class="form-control" type="number" min="0" step="1" [value]="champ(r.id, 'ttc')" (input)="poser(r.id, 'ttc', $any($event.target).value)" /></label>
                    <label class="form-group"><span class="form-label">Délai proposé (facultatif)</span><input class="form-control" type="text" [value]="champ(r.id, 'delai')" (input)="poser(r.id, 'delai', $any($event.target).value)" /></label>
                  </div>
                  <label class="form-group"><span class="form-label">Votre réponse (PDF, JPEG, PNG)</span><input class="form-control" type="file" accept="application/pdf,image/jpeg,image/png" (change)="choisir(r.id, $any($event.target))" /></label>
                  @if (refus()[r.id]; as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
                  <div><button type="button" class="btn btn-primary btn-sm" [disabled]="!complete(r.id) || occupe() === r.id" (click)="repondre(r)">{{ r.maReponse ? 'Remplacer ma réponse' : 'Envoyer ma réponse' }}</button></div>
                </div>
              </details>
            }
          </article>
        } @empty { <p class="text-muted">Aucune remise en concurrence ne vous est adressée.</p> }
        @if (erreurDoc(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
      }
    </section>
  `,
  styles: `
    .rt { display: flex; flex-direction: column; gap: 0.8rem; }
    .rt__h1 { margin: 0; font-size: 1.3rem; }
    .rt__intro { margin: 0; }
    .rt__carte { padding: 0.8rem 1rem; display: flex; flex-direction: column; gap: 0.45rem; }
    .rt__tete { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .rt__h2 { margin: 0; font-size: 1rem; flex: 1 1 auto; }
    .rt__meta { margin: 0; }
    .rt__alerte { margin: 0; color: var(--warning-text); }
    .rt__actions { display: flex; gap: 0.3rem; flex-wrap: wrap; }
    .rt__details summary { cursor: pointer; font-size: var(--text-sm); font-weight: 600; }
    .rt__form { display: flex; flex-direction: column; gap: 0.45rem; padding-top: 0.4rem; }
    .rt__ligne { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: flex-end; }
  `,
})
export class RemisesTitulaire implements OnInit {
  readonly service = inject(RemisesTitulaireService);

  readonly ariary = ariary;
  readonly date = dateFr;
  readonly dateHeure = dateHeureFr;
  readonly natures = Object.keys(NATURES_REPONSE) as NatureReponseRemise[];

  readonly chargement = signal(true);
  readonly erreur = signal<string | null>(null);
  readonly erreurDoc = signal<string | null>(null);
  readonly remises = signal<RemiseTitulaire[]>([]);
  readonly occupe = signal<number | null>(null);
  readonly refus = signal<Record<number, string>>({});
  private readonly champs = signal<Record<string, string>>({});
  private readonly fichiers = signal<Record<number, File | null>>({});

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service.lister().subscribe({
      next: (l) => {
        this.remises.set(l);
        this.chargement.set(false);
      },
      error: () => {
        this.chargement.set(false);
        this.erreur.set('Les remises en concurrence n’ont pas pu être chargées.');
      },
    });
  }

  resultat(r: string): { texte: string; classe: string } {
    return RESULTATS[r] ?? { texte: r, classe: 'badge-neutral' };
  }

  nature(n: string): string {
    return NATURES_REPONSE[n as NatureReponseRemise] ?? n;
  }

  champ(id: number, cle: string): string {
    return this.champs()[id + ':' + cle] ?? '';
  }

  poser(id: number, cle: string, valeur: string): void {
    this.champs.update((c) => ({ ...c, [id + ':' + cle]: valeur }));
  }

  choisir(id: number, champ: HTMLInputElement): void {
    const f = champ.files?.[0] ?? null;
    const erreur = f ? validerFichier(f) : null;
    if (erreur) {
      champ.value = '';
      this.refus.update((r) => ({ ...r, [id]: erreur }));
    }
    this.fichiers.update((x) => ({ ...x, [id]: erreur ? null : f }));
  }

  complete(id: number): boolean {
    return !!this.champ(id, 'nature') && Number(this.champ(id, 'ht')) > 0 && !!this.fichiers()[id];
  }

  repondre(r: RemiseTitulaire): void {
    const f = this.fichiers()[r.id];
    if (!f) return;
    const ttc = this.champ(r.id, 'ttc');
    this.occupe.set(r.id);
    this.refus.update((x) => ({ ...x, [r.id]: '' }));
    this.service.repondre(r.id, {
      nature: this.champ(r.id, 'nature') as NatureReponseRemise,
      montantHt: Number(this.champ(r.id, 'ht')),
      montantTtc: ttc ? Number(ttc) : null,
      delai: this.champ(r.id, 'delai').trim() || null,
    }, f).subscribe({
      next: (maj) => {
        this.occupe.set(null);
        this.remises.update((l) => l.map((x) => (x.id === maj.id ? maj : x)));
        this.champs.update((c) => Object.fromEntries(Object.entries(c).filter(([k]) => !k.startsWith(r.id + ':'))));
        this.fichiers.update((x) => ({ ...x, [r.id]: null }));
      },
      error: (e: ApiError) => {
        this.occupe.set(null);
        this.refus.update((x) => ({ ...x, [r.id]: refusRemise(e) }));
      },
    });
  }

  ouvrir(appel: Observable<Blob>): void {
    appel.subscribe({ next: (b) => ouvrirBlobSur(b), error: (e: ApiError) => this.erreurDoc.set(e.status === 404 ? 'La lettre n’est pas disponible.' : refusRemise(e)) });
  }

  enregistrer(appel: Observable<Blob>, nom: string): void {
    appel.subscribe({ next: (b) => telechargerBlob(b, nom), error: (e: ApiError) => this.erreurDoc.set(refusRemise(e)) });
  }
}
