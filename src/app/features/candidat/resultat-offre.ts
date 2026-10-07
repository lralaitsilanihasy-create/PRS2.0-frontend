import { ChangeDetectionStrategy, Component, OnInit, inject, input, signal } from '@angular/core';
import { Observable } from 'rxjs';

import { dateFr } from '../../core/interim/interim-libelles';
import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur, telechargerBlob, validerFichier } from '../../core/securite/fichiers-surs';
import { Explication, ResultatOffre } from '../../models';
import { CandidatResultatService } from '../../services';
import { dateHeureFr } from './libelles-candidat';

const MESSAGES: Readonly<Record<string, string>> = {
  QUESTION_OBLIGATOIRE: 'Votre question est obligatoire.',
  NON_INFORME: 'Le résultat n’est pas encore communiqué.',
  OFFRE_RETENUE: 'Votre offre est retenue : les explications sont réservées aux candidats non retenus.',
  TYPE_INVALIDE: 'Choisissez le type de pièce.',
  DATE_DELIVRANCE_OBLIGATOIRE: 'La date de délivrance est obligatoire.',
  PIECE_PERIMEE: 'La pièce est trop ancienne : la situation fiscale doit dater de moins de six mois, la sociale de moins de trois mois.',
  FICHIER_OBLIGATOIRE: 'Le fichier est obligatoire.',
  FORMAT_INVALIDE: 'Le fichier doit être un PDF, une image JPEG ou PNG.',
  NON_ATTRIBUTAIRE: 'Seul l’attributaire dépose ces pièces.',
  DELAI_DEPASSE: 'Le délai de quinze jours est passé.',
  DEJA_SIGNE: 'Le marché est déjà signé.',
  LOT_RETIRE: 'Le marché a été retiré.',
};

/**
 * ⚠️ Attribution, tranches 2b et 2c (V80, V81) — le **résultat** d'une offre, côté candidat (« Mes offres ») : retenue ou non, les
 * motifs du rejet, l'attributaire et le montant, sa lettre (la lire vaut accusé de lecture) ; non retenu, il peut demander des
 * explications écrites (art. 52-II). Attributaire : il dépose ses pièces fiscale et sociale sous quinze jours (art. 20-I), en suit la
 * vérification, puis lit le marché signé — ce qui vaut réception de la notification (art. 54). Rien ne s'affiche avant l'information.
 */
@Component({
  selector: 'app-resultat-offre',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (resultat(); as r) {
      <section class="ro" aria-label="Résultat de l'appel d'offres">
        <h3 class="ro__h3">
          Résultat{{ r.lot ? ' — lot ' + r.lot : '' }}
          <span class="badge" [class.badge-success]="r.retenu && !r.retire" [class.badge-neutral]="!r.retenu" [class.badge-danger]="r.retire">{{ r.retire ? 'Marché retiré' : r.retenu ? 'Votre offre est retenue' : 'Offre non retenue' }}</span>
        </h3>
        @if (!r.retenu && r.motifRejet) { <p class="text-sm">Motif : {{ r.motifRejet }}</p> }
        <p class="text-sm">Attributaire : <strong>{{ r.attributaire }}</strong>{{ r.montant != null ? ' — ' + montant(r.montant) + ' hors taxes' : '' }}{{ r.delai ? ' · délai ' + r.delai : '' }}</p>
        <p class="text-sm text-muted">Informé le {{ dateHeure(r.dateInformation) }} · affichage au siège le {{ date(r.dateAffichage) }} · signature possible à partir du {{ date(r.signableLe) }}</p>
        @if (r.lettreDisponible) {
          <div class="ro__actions">
            <button type="button" class="btn btn-outline btn-sm" (click)="ouvrir(service.lettre(idOffre()))">Lire la lettre (PDF)</button>
            <button type="button" class="btn btn-ghost btn-sm" (click)="enregistrer(service.lettre(idOffre(), 'docx'), 'lettre-resultat.docx')">Word</button>
          </div>
        }

        @if (!r.retenu) {
          @for (e of explications(); track e.id) {
            <div class="ro__fil">
              <p class="text-sm"><strong>Votre demande</strong> ({{ dateHeure(e.demandeeLe) }}) : « {{ e.question }} »</p>
              @if (e.etat === 'REPONDUE') {
                <p class="text-sm"><strong>Réponse de la PRMP</strong> ({{ dateHeure(e.reponduLe) }}) : {{ e.reponse }}</p>
                @if (e.reponseNom) { <button type="button" class="btn btn-ghost btn-sm ro__btn" (click)="ouvrir(service.fichierExplication(idOffre(), e.id))">{{ e.reponseNom }}</button> }
              } @else { <p class="text-sm text-muted">En attente de la réponse écrite de la PRMP.</p> }
            </div>
          }
          <details class="ro__details">
            <summary>Demander des explications écrites (art. 52-II)…</summary>
            <label class="form-group"><span class="form-label">Votre question</span><textarea class="form-control" rows="2" [value]="question()" (input)="question.set($any($event.target).value)"></textarea></label>
            <button type="button" class="btn btn-outline btn-sm ro__btn" [disabled]="!question().trim() || occupe()" (click)="demander()">Envoyer la demande</button>
          </details>
        }

        @if (r.retenu && r.piecesAttributaire; as pa) {
          <div class="ro__pieces">
            <p class="text-sm"><strong>Vos pièces fiscale et sociale</strong>, à déposer avant le <strong>{{ date(pa.echeance) }}</strong> (art. 20-I) : situation fiscale de moins de six mois, situation sociale cotisante de moins de trois mois. Sans elles, le marché vous est retiré.</p>
            @for (p of pa.pieces; track p.id) {
              <p class="text-sm">
                {{ p.type === 'FISCALE' ? 'Fiscale' : 'Sociale' }}, délivrée le {{ date(p.dateDelivrance) }} — {{ p.nom }} :
                @if (p.conforme === true) { <span class="badge badge-success">conforme</span> }
                @else if (p.conforme === false) { <span class="badge badge-danger">non conforme — {{ p.motif }}</span> }
                @else { <span class="badge badge-warning">en vérification</span> }
              </p>
            }
            @if (!pa.delaiDepasse && !r.dateSignature && !r.retire) {
              <div class="ro__ligne">
                <label class="form-group"><span class="form-label">Pièce</span>
                  <select class="form-control" (change)="type.set($any($event.target).value)">
                    <option value="FISCALE" [selected]="type() === 'FISCALE'">Situation fiscale</option>
                    <option value="SOCIALE" [selected]="type() === 'SOCIALE'">Situation sociale</option>
                  </select>
                </label>
                <label class="form-group"><span class="form-label">Délivrée le</span><input class="form-control" type="date" [value]="dateDelivrance()" (input)="dateDelivrance.set($any($event.target).value)" /></label>
                <label class="form-group ro__large"><span class="form-label">Fichier (PDF, JPEG, PNG)</span><input #champPiece class="form-control" type="file" accept="application/pdf,image/jpeg,image/png" (change)="choisir($any($event.target))" /></label>
                <button type="button" class="btn btn-primary btn-sm" [disabled]="!dateDelivrance() || !fichier() || occupe()" (click)="deposer(champPiece)">Déposer</button>
              </div>
            }
          </div>
        }

        @if (r.marcheDisponible) {
          <div class="ro__marche">
            <p class="text-sm">Marché signé le {{ date(r.dateSignature) }}{{ r.dateNotification ? ', notifié le ' + date(r.dateNotification) : '' }}{{ r.notificationRecueLe ? ' — reçu le ' + dateHeure(r.notificationRecueLe) + ' : il prend effet à cette date' : '' }}.</p>
            <button type="button" class="btn btn-primary btn-sm ro__btn" (click)="lireMarche()">Lire le marché signé</button>
            @if (r.dateNotification && !r.notificationRecueLe) { <p class="text-xs text-muted">Le lire vaut réception de la notification.</p> }
          </div>
        }
        @if (erreur(); as e) { <p class="form-error" role="alert">{{ e }}</p> }
      </section>
    }
  `,
  styles: `
    .ro { display: flex; flex-direction: column; gap: 0.35rem; border-top: 1px solid var(--n-200); padding-top: 0.5rem; }
    .ro__h3 { margin: 0; font-size: 0.9rem; display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .ro p { margin: 0; }
    .ro__actions, .ro__ligne { display: flex; gap: 0.5rem; align-items: flex-end; flex-wrap: wrap; }
    .ro__large { flex: 1 1 16rem; }
    .ro__btn { align-self: flex-start; }
    .ro__fil, .ro__pieces, .ro__marche { display: flex; flex-direction: column; gap: 0.3rem; padding: 0.4rem 0.6rem; background: var(--n-100); border-left: 3px solid var(--n-300); }
    .ro__details summary { cursor: pointer; font-size: var(--text-sm); font-weight: 600; }
  `,
})
export class ResultatOffreCandidat implements OnInit {
  readonly idOffre = input.required<string>();

  readonly service = inject(CandidatResultatService);
  private readonly toast = inject(ToastService);
  readonly date = dateFr;
  readonly dateHeure = dateHeureFr;

  readonly resultat = signal<ResultatOffre | null>(null);
  readonly explications = signal<Explication[]>([]);
  readonly question = signal('');
  readonly type = signal<'FISCALE' | 'SOCIALE'>('FISCALE');
  readonly dateDelivrance = signal('');
  readonly fichier = signal<File | null>(null);
  readonly occupe = signal(false);
  readonly erreur = signal<string | null>(null);

  ngOnInit(): void {
    this.charger();
  }

  /** 404 avant l'information des candidats : rien à montrer. */
  charger(): void {
    this.service.resultat(this.idOffre()).subscribe({
      next: (r) => {
        this.resultat.set(r);
        if (!r.retenu) this.service.explications(this.idOffre()).subscribe({ next: (l) => this.explications.set(l), error: () => undefined });
      },
      error: () => this.resultat.set(null),
    });
  }

  montant(v: number): string {
    return `${new Intl.NumberFormat('fr-FR').format(v)} Ar`;
  }

  demander(): void {
    this.occupe.set(true);
    this.erreur.set(null);
    this.service.demanderExplication(this.idOffre(), this.question().trim()).subscribe({
      next: (e) => {
        this.occupe.set(false);
        this.question.set('');
        this.explications.update((l) => [...l, e]);
        this.toast.success('Votre demande est transmise à la PRMP ; sa réponse sera écrite.');
      },
      error: (e: ApiError) => this.echec(e),
    });
  }

  choisir(champ: HTMLInputElement): void {
    const f = champ.files?.[0] ?? null;
    const erreur = f ? validerFichier(f) : null;
    if (erreur) champ.value = '';
    this.erreur.set(erreur);
    this.fichier.set(erreur ? null : f);
  }

  /** Le champ fichier est vidé après le dépôt : il ne doit pas montrer un fichier que l'écran a déjà envoyé. */
  deposer(champ?: HTMLInputElement): void {
    const f = this.fichier();
    if (!f) return;
    this.occupe.set(true);
    this.erreur.set(null);
    this.service.deposerPiece(this.idOffre(), this.type(), this.dateDelivrance(), f).subscribe({
      next: (pa) => {
        this.occupe.set(false);
        this.fichier.set(null);
        if (champ) champ.value = '';
        this.resultat.update((r) => (r ? { ...r, piecesAttributaire: pa } : r));
        this.toast.success('Votre pièce est déposée ; la PRMP la vérifie.');
      },
      error: (e: ApiError) => this.echec(e),
    });
  }

  /** Lire le marché signé après la notification vaut réception : on relit ensuite le résultat (date d'effet). */
  lireMarche(): void {
    this.service.marche(this.idOffre()).subscribe({
      next: (b) => {
        ouvrirBlobSur(b);
        this.charger();
      },
      error: (e: ApiError) => this.echec(e),
    });
  }

  ouvrir(appel: Observable<Blob>): void {
    appel.subscribe({ next: (b) => ouvrirBlobSur(b), error: (e: ApiError) => this.echec(e) });
  }

  enregistrer(appel: Observable<Blob>, nom: string): void {
    appel.subscribe({ next: (b) => telechargerBlob(b, nom), error: (e: ApiError) => this.echec(e) });
  }

  private echec(e: ApiError): void {
    this.occupe.set(false);
    this.erreur.set(MESSAGES[codeErreur(e) ?? ''] ?? (e.status === 413 ? 'Le fichier dépasse la taille admise.' : e.message || 'Le geste n’a pas abouti.'));
  }
}
