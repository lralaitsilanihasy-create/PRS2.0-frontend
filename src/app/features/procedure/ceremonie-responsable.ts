import { ChangeDetectionStrategy, Component, DOCUMENT, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import {
  PhraseIncorrecte,
  dechiffrer,
  desenvelopper,
  empreinteCourte,
  envelopper,
  exporterClePublique,
  formaterEmpreinte,
  genererPaire,
  genererPhrase,
} from '../../core/securite/cles-detenteur';
import { telechargerBlob } from '../../core/securite/fichiers-surs';
import { Ceremonie, Depositaire, Detenteur, Enveloppe } from '../../models';
import { CeremonieService } from '../../services';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { fermerAvecAnimation } from '../../shared/a11y/fermeture-animee';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { LIBELLES_ETAT_CEREMONIE, LIBELLES_ETAT_PART, classeCeremonie, classePart } from '../cao/libelles-cao';
import { dateHeureFr } from '../candidat/libelles-candidat';

/** Ce que le pli de secours porte, le temps de l'imprimer ; effacé dès la clé publiée. */
interface PliSecours {
  phrase: string;
  empreinte: string;
  clePublique: string;
  enveloppe: Enveloppe;
}

function echapper(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);
}

/**
 * Section **« Cérémonie des clés »** de l'écran du responsable de la procédure (lot 2b, ADR-0013 §1, §5) : l'état, les `n`
 * détenteurs et leurs empreintes, les avertissements (S1, marge), **clore** (409 nomme les manquants) et **rouvrir** (S4,
 * refusé dès la première offre), et la **part de secours** (S3) : la paire naît dans le navigateur du responsable, en
 * présence du dépositaire ; la phrase est **générée**, affichée une fois et **imprimée sur le pli** avec l'empreinte et
 * l'enveloppe ; seule l'enveloppe part au serveur. À l'ouverture (lot 4), le pli n'apportera que la phrase.
 */
@Component({
  selector: 'app-ceremonie-responsable',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur, ModaleDirective],
  template: `
    <section class="cr" aria-labelledby="cr-titre">
      <h2 id="cr-titre" class="cr__h2">Cérémonie des clés</h2>

      @if (chargement()) {
        <p class="text-muted" role="status">Chargement de la cérémonie…</p>
      } @else if (refuse()) {
        <div class="alert alert-info" role="status"><span>La cérémonie n'est servie qu'au responsable de la procédure et aux membres de la commission.</span></div>
      } @else if (erreur()) {
        <app-etat-erreur message="La cérémonie n'a pas pu être chargée." (reessayer)="charger()" />
      } @else if (ceremonie(); as c) {
        <div class="cr__etat">
          <span class="badge" [class]="'badge ' + classeCeremonie(c.etat)">{{ ceremonies[c.etat] }}</span>
          <span class="text-sm text-muted">{{ c.n }} parts (membres + secours), quorum {{ c.quorum ?? '—' }}{{ c.dateCloture ? ' · close le ' + dateHeure(c.dateCloture) : c.dateCeremoniePrevue ? ' · prévue le ' + dateHeure(c.dateCeremoniePrevue) : '' }}</span>
          @if (c.premierDepot) { <span class="badge badge-warning">Des offres sont déposées</span> }
        </div>
        @for (a of c.avertissements; track a.regle) { <p class="alert alert-warning" role="status"><span>{{ a.message }}</span></p> }
        @if (erreurAction(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }

        <div class="table-card">
          <table class="cr__table">
            <caption class="cnm-sr-only">Les détenteurs de parts et l'état de leur clé</caption>
            <thead><tr><th scope="col">Détenteur</th><th scope="col">Part</th><th scope="col">Empreinte de la clé publiée</th><th scope="col">Dernière vérification</th></tr></thead>
            <tbody>
              @for (d of c.detenteurs; track $index) {
                <tr>
                  <td>{{ d.nom }}@if (d.role === 'SECOURS') { <span class="text-xs text-muted"> — part de secours (dépositaire)</span> }</td>
                  <td><span class="badge" [class]="'badge ' + classePart(d.etatPart)">{{ parts[d.etatPart] }}</span>@if (d.remplacements) { <span class="text-xs text-muted"> · remplacée {{ d.remplacements }}×</span> }</td>
                  <td><code class="cnm-mono" [title]="d.empreinte ? formater(d.empreinte) : ''">{{ d.empreinte ? courte(d.empreinte) : '—' }}</code></td>
                  <td class="nowrap">{{ d.derniereVerification ? dateHeure(d.derniereVerification) : '—' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="cr__actions">
          @if (c.etat !== 'CLOSE') {
            <button type="button" class="btn btn-primary" [disabled]="travail()" (click)="cloturer()">{{ travail() ? '…' : 'Clore la cérémonie' }}</button>
            <span class="text-sm text-muted">Possible quand les {{ c.n }} clés sont publiées : les clés publiques sont alors servies aux candidats.</span>
          } @else if (!c.premierDepot) {
            @if (!confirmerReouverture()) {
              <button type="button" class="btn btn-outline" [disabled]="travail()" (click)="confirmerReouverture.set(true)">Rouvrir la cérémonie…</button>
            } @else {
              <span class="cr__confirm">Toutes les parts seront à republier, et les paramètres internes redeviennent modifiables.
                <button type="button" class="btn btn-sm btn-danger" [disabled]="travail()" (click)="rouvrir()">Confirmer la réouverture</button>
                <button type="button" class="btn btn-sm btn-outline" (click)="confirmerReouverture.set(false)">Annuler</button>
              </span>
            }
          } @else {
            <span class="text-sm text-muted">Des offres sont scellées : la cérémonie ne se rouvre plus. Une part perdue se remplace par son détenteur ; la marge et la part de secours couvrent le reste.</span>
          }
        </div>

        <!-- La part de secours (S3) : les gestes du responsable, en présence du dépositaire. -->
        <div class="card cr__secours">
          <h3 class="cr__h3">Part de secours</h3>
          @if (secours(); as s) {
            <p class="cr__etat">
              <span>Dépositaire : <strong>{{ s.nom }}</strong></span>
              <span class="badge" [class]="'badge ' + classePart(s.etatPart)">{{ parts[s.etatPart] }}</span>
            </p>
            <div class="cr__actions">
              @if (s.etatPart === 'ABSENTE') {
                <button type="button" class="btn btn-primary" [disabled]="travail() || !depositaire()" (click)="ouvrirSecours('publier')">Générer la clé de secours…</button>
                @if (!depositaire()) { <span class="text-sm text-muted">Désignez d'abord le dépositaire, ci-dessus.</span> }
              } @else {
                @if (s.etatPart !== 'PERDUE') { <button type="button" class="btn btn-primary" [disabled]="travail()" (click)="ouvrirVerifSecours()">Vérifier la part de secours…</button> }
                <button type="button" class="btn btn-outline" [disabled]="travail()" (click)="ouvrirSecours('remplacer')">Remplacer la clé de secours…</button>
                @if (s.etatPart !== 'PERDUE') {
                  @if (!confirmerPerteSecours()) {
                    <button type="button" class="btn btn-outline" [disabled]="travail()" (click)="confirmerPerteSecours.set(true)">Déclarer la part de secours perdue…</button>
                  } @else {
                    <span class="cr__confirm">Le pli est perdu ou illisible ?
                      <button type="button" class="btn btn-sm btn-danger" [disabled]="travail()" (click)="perdueSecours()">Confirmer la perte</button>
                      <button type="button" class="btn btn-sm btn-outline" (click)="confirmerPerteSecours.set(false)">Annuler</button>
                    </span>
                  }
                }
              }
            </div>
          } @else {
            <p class="text-sm text-muted">La part de secours paraît ici une fois le dépositaire désigné.</p>
          }
        </div>
      }

      <!-- Génération de la clé de secours : la phrase générée s'affiche une fois, et part sur le pli, jamais au serveur. -->
      @if (secoursOuvert()) {
        <div class="modal-backdrop" [class.closing]="fermeture()">
          <div class="modal cnm-form cr__modal" role="dialog" aria-modal="true" aria-label="Clé de secours" appModale (appModaleFermer)="fermerSecours()">
            <header class="modal-header">
              <span class="modal-title">{{ modeSecours() === 'remplacer' ? 'Remplacer la clé de secours' : 'Clé de secours' }}</span>
              <button type="button" class="btn-close" aria-label="Fermer" (click)="fermerSecours()">✕</button>
            </header>
            <div class="modal-body cr__corps">
              @if (erreurSecours(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
              @if (!pli()) {
                <p>La clé de secours naît sur ce poste, <strong>en présence du dépositaire</strong>{{ depositaire()?.nom ? ' (' + depositaire()!.nom + ')' : '' }}. Sa phrase secrète est <strong>générée</strong>, affichée une seule fois, et imprimée sur le pli que le dépositaire scelle et conserve. Le serveur ne reçoit que l'enveloppe.</p>
                <button type="button" class="btn btn-primary" [disabled]="travail()" (click)="genererSecours()">{{ travail() ? 'Génération…' : 'Générer la clé et la phrase' }}</button>
              } @else {
                <p class="form-label">Phrase secrète du pli — à imprimer, jamais à retaper ici</p>
                <p class="cr__phrase cnm-mono">{{ pli()!.phrase }}</p>
                <p class="form-label">Empreinte de la clé</p>
                <p class="cnm-mono cr__emp">{{ formater(pli()!.empreinte) }}</p>
                <div class="cr__actions">
                  <button type="button" class="btn btn-secondary" (click)="imprimerPli()">Imprimer le pli</button>
                  <button type="button" class="btn btn-outline" (click)="enregistrerPli()">Enregistrer le pli (.txt)</button>
                </div>
                <label class="cr__case"><input type="checkbox" [checked]="pliImprime()" (change)="pliImprime.set($any($event.target).checked)" /> Le pli est imprimé, scellé, et remis au dépositaire.</label>
              }
            </div>
            <footer class="modal-footer">
              <button type="button" class="btn btn-outline" [disabled]="travail()" (click)="fermerSecours()">Annuler</button>
              @if (pli()) { <button type="button" class="btn btn-primary" [disabled]="travail() || !pliImprime()" (click)="publierSecours()">{{ travail() ? 'Publication…' : modeSecours() === 'remplacer' ? 'Remplacer la clé' : 'Publier la clé de secours' }}</button> }
            </footer>
          </div>
        </div>
      }

      <!-- Vérification de la part de secours (S2) : l'enveloppe vient du serveur, le pli n'apporte que la phrase. -->
      @if (verifSecoursOuverte()) {
        <div class="modal-backdrop" [class.closing]="fermeture()">
          <div class="modal cnm-form cr__modal" role="dialog" aria-modal="true" aria-label="Vérifier la part de secours" appModale (appModaleFermer)="fermerVerifSecours()">
            <header class="modal-header">
              <span class="modal-title">Vérifier la part de secours</span>
              <button type="button" class="btn-close" aria-label="Fermer" (click)="fermerVerifSecours()">✕</button>
            </header>
            <form (submit)="$event.preventDefault(); verifierSecours()" novalidate>
              <div class="modal-body cr__corps">
                @if (erreurSecours(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
                <p class="text-sm">Le dépositaire ouvre son pli et dicte la phrase ; elle déverrouille ici l'enveloppe gardée par le serveur, qui déchiffre un défi. Rien de secret n'est transmis, et le pli se rescelle.</p>
                <label class="form-group">
                  <span class="form-label">Phrase du pli</span>
                  <input class="form-control" type="password" autocomplete="off" [value]="phraseVerif()" (input)="phraseVerif.set($any($event.target).value)" />
                </label>
              </div>
              <footer class="modal-footer">
                <button type="button" class="btn btn-outline" [disabled]="travail()" (click)="fermerVerifSecours()">Annuler</button>
                <button type="submit" class="btn btn-primary" [disabled]="travail()">{{ travail() ? 'Vérification…' : 'Vérifier' }}</button>
              </footer>
            </form>
          </div>
        </div>
      }
    </section>
  `,
  styles: `
    .cr { display: flex; flex-direction: column; gap: 0.75rem; }
    .cr__h2 { margin: 0.5rem 0 0; font-size: 1.05rem; }
    .cr__h3 { margin: 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .cr__etat { margin: 0; display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; font-size: 0.9rem; }
    .cr__table { width: 100%; border-collapse: collapse; font-size: var(--text-sm); }
    .cr__table th, .cr__table td { text-align: left; padding: 0.45rem 0.7rem; border-bottom: 1px solid var(--n-200); vertical-align: top; }
    .cr__table th { color: var(--n-500); font-weight: 600; }
    .cr__actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .cr__confirm { display: inline-flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; font-size: var(--text-sm); }
    .cr__secours { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .cr__modal { max-width: 40rem; }
    .cr__corps { display: flex; flex-direction: column; gap: 0.6rem; }
    .cr__phrase { margin: 0; padding: 0.6rem 0.8rem; background: var(--n-100); border-radius: var(--radius-md); font-size: 1.1rem; letter-spacing: 0.02em; user-select: all; }
    .cr__emp { margin: 0; font-size: var(--text-sm); word-break: break-all; }
    .cr__case { display: flex; gap: 0.5rem; align-items: center; font-size: var(--text-sm); }
  `,
})
export class CeremonieResponsable implements OnInit {
  readonly idDmc = input.required<number>();
  /** Le dépositaire désigné dans les paramètres internes ; sans lui, pas de clé de secours (409 `DEPOSITAIRE_ABSENT`). */
  readonly depositaire = input<Depositaire | null>(null);
  /** Un geste a changé l'état : le parent relit les paramètres internes (part de secours, journal). */
  readonly changement = output<void>();

  private readonly service = inject(CeremonieService);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);

  readonly parts = LIBELLES_ETAT_PART;
  readonly ceremonies = LIBELLES_ETAT_CEREMONIE;
  readonly classePart = classePart;
  readonly classeCeremonie = classeCeremonie;
  readonly dateHeure = dateHeureFr;
  readonly formater = formaterEmpreinte;
  readonly courte = empreinteCourte;

  readonly chargement = signal(true);
  readonly refuse = signal(false);
  readonly erreur = signal(false);
  readonly ceremonie = signal<Ceremonie | null>(null);
  readonly secours = computed<Detenteur | null>(() => this.ceremonie()?.detenteurs.find((d) => d.role === 'SECOURS') ?? null);

  readonly travail = signal(false);
  readonly erreurAction = signal<string | null>(null);
  readonly confirmerReouverture = signal(false);
  readonly confirmerPerteSecours = signal(false);

  readonly secoursOuvert = signal(false);
  readonly modeSecours = signal<'publier' | 'remplacer'>('publier');
  readonly pli = signal<PliSecours | null>(null);
  readonly pliImprime = signal(false);
  readonly erreurSecours = signal<string | null>(null);
  readonly verifSecoursOuverte = signal(false);
  readonly phraseVerif = signal('');
  readonly fermeture = signal(false);

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.refuse.set(false);
    this.erreur.set(false);
    this.service.lire(this.idDmc()).subscribe({
      next: (c) => {
        this.ceremonie.set(c);
        this.chargement.set(false);
      },
      error: (e: { status?: number }) => {
        this.chargement.set(false);
        if (e.status === 403) this.refuse.set(true);
        else this.erreur.set(true);
      },
    });
  }

  private apres(message: string): void {
    this.travail.set(false);
    this.toast.success(message);
    this.charger();
    this.changement.emit();
  }

  cloturer(): void {
    if (this.travail()) return;
    this.travail.set(true);
    this.erreurAction.set(null);
    this.service.cloturer(this.idDmc()).subscribe({
      next: () => this.apres('Cérémonie close : les clés publiques sont publiées aux candidats.'),
      error: (e: ApiError) => {
        this.travail.set(false);
        this.erreurAction.set(this.motif(e));
      },
    });
  }

  rouvrir(): void {
    if (this.travail()) return;
    this.travail.set(true);
    this.erreurAction.set(null);
    this.confirmerReouverture.set(false);
    this.service.rouvrir(this.idDmc()).subscribe({
      next: () => this.apres('Cérémonie rouverte : chaque membre republie sa clé, puis vous la reclorez.'),
      error: (e: ApiError) => {
        this.travail.set(false);
        this.erreurAction.set(this.motif(e));
      },
    });
  }

  // ── Part de secours ────────────────────────────────────────────────────────────────────────────────────────

  ouvrirSecours(mode: 'publier' | 'remplacer'): void {
    this.modeSecours.set(mode);
    this.pli.set(null);
    this.pliImprime.set(false);
    this.erreurSecours.set(null);
    this.fermeture.set(false);
    this.secoursOuvert.set(true);
  }

  fermerSecours(): void {
    fermerAvecAnimation(this.fermeture, () => {
      this.secoursOuvert.set(false);
      this.pli.set(null); // la phrase ne survit pas à la fenêtre
    });
  }

  async genererSecours(): Promise<void> {
    this.travail.set(true);
    this.erreurSecours.set(null);
    try {
      const phrase = genererPhrase();
      const paire = await genererPaire();
      const { clePublique, empreinte } = await exporterClePublique(paire.publicKey);
      const enveloppe = await envelopper(paire.privateKey, phrase);
      this.pli.set({ phrase, empreinte, clePublique, enveloppe });
    } catch (e) {
      this.erreurSecours.set((e as Error)?.message || 'La génération a échoué.');
    } finally {
      this.travail.set(false);
    }
  }

  /** Le texte du pli : la phrase, l'empreinte, et l'enveloppe en base64 en dernier recours (si le serveur en perdait la copie). */
  private textePli(p: PliSecours): string {
    const d = this.depositaire();
    return [
      'PRS 2.0 — PLI SCELLÉ DE LA PART DE SECOURS',
      `Procédure n° ${this.idDmc()}`,
      `Dépositaire : ${d?.nom ?? '—'}${d?.organisme ? ` (${d.organisme})` : ''}`,
      `Imprimé le ${new Date().toLocaleString('fr-FR')}`,
      '',
      'PHRASE SECRÈTE (à dicter à la séance d’ouverture, puis resceller) :',
      p.phrase,
      '',
      'EMPREINTE DE LA CLÉ PUBLIQUE (SHA-256) :',
      formaterEmpreinte(p.empreinte),
      '',
      'ENVELOPPE DE LA CLÉ PRIVÉE (dernier recours si le serveur ne peut plus la rendre ; inutile sans la phrase) :',
      `kdf=${p.enveloppe.kdf} iterations=${p.enveloppe.iterations} algorithme=${p.enveloppe.algorithme}`,
      `sel=${p.enveloppe.sel}`,
      `iv=${p.enveloppe.iv}`,
      `chiffre=${p.enveloppe.chiffre}`,
    ].join('\n');
  }

  /** Impression dans un cadre isolé : notre propre texte, échappé — pas un fichier téléversé. */
  imprimerPli(): void {
    const p = this.pli();
    if (!p) return;
    const html =
      '<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Pli de secours</title>' +
      '<style>body{font:12pt/1.5 ui-monospace,Consolas,monospace;margin:2cm;white-space:pre-wrap;word-break:break-all}h1{font-size:14pt}</style>' +
      `</head><body><h1>Pli scellé de la part de secours</h1>${echapper(this.textePli(p))}</body></html>`;
    const cadre = this.document.createElement('iframe');
    cadre.setAttribute('aria-hidden', 'true');
    cadre.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
    cadre.onload = () => {
      cadre.contentWindow?.focus();
      cadre.contentWindow?.print();
      setTimeout(() => cadre.remove(), 60_000);
    };
    cadre.srcdoc = html;
    this.document.body.appendChild(cadre);
  }

  enregistrerPli(): void {
    const p = this.pli();
    if (!p) return;
    telechargerBlob(new Blob([this.textePli(p)], { type: 'text/plain;charset=utf-8' }), `pli-secours-procedure-${this.idDmc()}.txt`);
  }

  publierSecours(): void {
    const p = this.pli();
    if (!p || this.travail() || !this.pliImprime()) return;
    this.travail.set(true);
    this.erreurSecours.set(null);
    const corps = { clePublique: p.clePublique, empreinte: p.empreinte, enveloppe: p.enveloppe };
    const appel = this.modeSecours() === 'remplacer' ? this.service.remplacerSecours(this.idDmc(), corps) : this.service.publierSecours(this.idDmc(), corps);
    appel.subscribe({
      next: () => {
        this.pli.set(null);
        this.secoursOuvert.set(false);
        this.apres('La clé de secours est publiée. La phrase ne vit plus que sur le pli.');
      },
      error: (e: ApiError) => {
        this.travail.set(false);
        this.erreurSecours.set(this.motif(e));
      },
    });
  }

  ouvrirVerifSecours(): void {
    this.phraseVerif.set('');
    this.erreurSecours.set(null);
    this.fermeture.set(false);
    this.verifSecoursOuverte.set(true);
  }

  fermerVerifSecours(): void {
    fermerAvecAnimation(this.fermeture, () => {
      this.verifSecoursOuverte.set(false);
      this.phraseVerif.set('');
    });
  }

  async verifierSecours(): Promise<void> {
    const phrase = this.phraseVerif().trim();
    if (!phrase) {
      this.erreurSecours.set('La phrase du pli est obligatoire.');
      return;
    }
    this.travail.set(true);
    this.erreurSecours.set(null);
    try {
      const enveloppe = await firstValueFrom(this.service.enveloppeSecours(this.idDmc()));
      const privee = await desenvelopper(enveloppe, phrase);
      const defi = await firstValueFrom(this.service.ouvrirDefi(this.idDmc(), 'SECOURS'));
      let clair: string;
      try {
        clair = await dechiffrer(privee, defi.chiffre);
      } catch {
        throw new Error('Le défi ne se déchiffre pas avec cette enveloppe : la clé de secours publiée n’est pas celle du pli.');
      }
      await firstValueFrom(this.service.repondreDefi(this.idDmc(), defi.idDefi, clair));
      this.phraseVerif.set('');
      this.verifSecoursOuverte.set(false);
      this.apres('La part de secours est vérifiée.');
    } catch (e) {
      this.travail.set(false);
      this.erreurSecours.set(this.motif(e));
    }
  }

  perdueSecours(): void {
    if (this.travail()) return;
    this.travail.set(true);
    this.erreurAction.set(null);
    this.confirmerPerteSecours.set(false);
    this.service.declarerPerdue(this.idDmc(), 'SECOURS').subscribe({
      next: () => this.apres('La part de secours est déclarée perdue : remplacez-la avec le dépositaire.'),
      error: (e: ApiError) => {
        this.travail.set(false);
        this.erreurAction.set(this.motif(e));
      },
    });
  }

  private motif(e: unknown): string {
    if (e instanceof PhraseIncorrecte) return e.message;
    const api = e as Partial<ApiError> & { status?: number };
    switch (codeErreur(api as ApiError)) {
      case 'CLES_INCOMPLETES':
        return api.message || 'Des clés manquent : la cérémonie ne se clôt pas.';
      case 'DEPOT_EXISTANT':
        return 'Des offres sont scellées : la cérémonie ne se rouvre plus.';
      case 'DEPOSITAIRE_ABSENT':
        return 'Désignez d’abord le dépositaire de la part de secours, puis enregistrez.';
      case 'CEREMONIE_CLOSE':
      case 'CLE_EXISTANTE':
        return 'La clé de secours est déjà publiée : passez par « Remplacer la clé de secours ».';
      case 'DEFI_ECHOUE':
        return 'Le défi a échoué : la clé déverrouillée n’est pas celle publiée pour la part de secours.';
      case 'DEFI_EXPIRE':
        return 'Le défi a expiré (cinq minutes) : recommencez.';
      case 'CLE_ABSENTE':
        return 'Aucune clé de secours publiée.';
    }
    if (api.status === 404) return 'Aucune enveloppe de secours gardée par le serveur.';
    if (api.status === 403) return 'Ce geste est réservé au responsable de la procédure.';
    return (e as Error)?.message || 'Le geste n’a pas abouti.';
  }
}
