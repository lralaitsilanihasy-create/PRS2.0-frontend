import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DOCUMENT, computed, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import {
  PhraseIncorrecte,
  dechiffrer,
  desenvelopper,
  envelopper,
  exporterClePublique,
  formaterEmpreinte,
  genererPaire,
  genererPhrase,
} from '../../core/securite/cles-detenteur';
import { telechargerBlob } from '../../core/securite/fichiers-surs';
import { Depositaire, Detenteur, Enveloppe } from '../../models';
import { CeremonieService } from '../../services';
import { ModaleDirective } from '../../shared/a11y/modale.directive';
import { fermerAvecAnimation } from '../../shared/a11y/fermeture-animee';
import { LIBELLES_ETAT_PART, classePart } from '../cao/libelles-cao';
import { dateHeureFr } from '../candidat/libelles-candidat';

/** Qui regarde la part de secours : son détenteur (le dépositaire) ou le responsable de la procédure. */
export type VuePartSecours = 'depositaire' | 'responsable';

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

const LIBELLES_COMPTE: Readonly<Record<string, string>> = {
  A_INVITER: 'Compte à inviter',
  INVITE: 'Invitation envoyée',
  ACTIF: 'Compte actif',
  ARCHIVE: 'Compte archivé',
};

/**
 * **La part de secours** (ADR-0013, S3). ⚠️ V71 (décision du pilote, 05/10) : la clé de secours naît **sur le poste du
 * dépositaire**, et lui seul voit sa phrase — générée, montrée une fois, imprimée sur le pli qu'il garde.
 * - Chez le **dépositaire** (\`/depositaire\`) : générer et publier sa clé (ou remplacer une clé qui n'est pas la sienne,
 *   \`cleARemplacer\`), la vérifier par le défi avec la phrase de son pli, la déclarer perdue.
 * - Chez le **responsable** : l'état de la part et du compte du dépositaire, en lecture. Pour une clé de l'**ancien geste**
 *   (\`generePar = RESPONSABLE\`, avant le 05/10), il garde la vérification et la perte ; le remplacement passe au dépositaire.
 */
@Component({
  selector: 'app-part-secours',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective, NgTemplateOutlet],
  template: `
    <div class="card ps">
      <h3 class="ps__h3">Part de secours</h3>
      @if (erreurAction(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
      @if (secours(); as s) {
        <p class="ps__etat">
          <span>Dépositaire : <strong>{{ depositaire()?.nom ?? s.nom }}</strong></span>
          <span class="badge" [class]="'badge ' + classePart(s.etatPart)">{{ parts[s.etatPart] }}</span>
          @if (s.derniereVerification) { <span class="text-sm text-muted">vérifiée le {{ dateHeure(s.derniereVerification) }}</span> }
          @if (vue() === 'responsable' && depositaire()?.compte; as c) { <span class="badge badge-neutral">{{ comptes[c.etat] ?? c.etat }}</span> }
          @if (s.generePar === 'RESPONSABLE') { <span class="text-xs text-muted">clé générée chez le responsable (avant le 05/10)</span> }
        </p>

        @if (vue() === 'depositaire') {
          <div class="ps__actions">
            @if (aGenerer()) {
              <button type="button" class="btn btn-primary" [disabled]="travail()" (click)="ouvrirSecours(s.etatPart === 'ABSENTE' ? 'publier' : 'remplacer')">Générer ma clé de secours…</button>
              @if (cleARemplacer() && s.etatPart !== 'ABSENTE') { <span class="text-sm text-muted">La clé publiée n'est pas la vôtre : générez la vôtre pour la remplacer.</span> }
            } @else {
              @if (s.etatPart !== 'PERDUE') { <button type="button" class="btn btn-primary" [disabled]="travail()" (click)="ouvrirVerif()">Vérifier ma part…</button> }
              <button type="button" class="btn btn-outline" [disabled]="travail()" (click)="ouvrirSecours('remplacer')">Remplacer ma clé…</button>
              @if (s.etatPart !== 'PERDUE') { <ng-container [ngTemplateOutlet]="perte" /> }
            }
          </div>
        } @else if (s.generePar === 'RESPONSABLE' && s.etatPart !== 'ABSENTE') {
          <div class="ps__actions">
            @if (s.etatPart !== 'PERDUE') {
              <button type="button" class="btn btn-primary" [disabled]="travail()" (click)="ouvrirVerif()">Vérifier la part de secours…</button>
              <ng-container [ngTemplateOutlet]="perte" />
            }
            <span class="text-sm text-muted">Pour la remplacer, le dépositaire génère désormais sa propre clé, depuis son espace.</span>
          </div>
        } @else {
          <p class="text-sm text-muted ps__note">La clé de secours se génère sur le poste du dépositaire, depuis son espace : personne d'autre ne voit sa phrase.{{ s.etatPart === 'ABSENTE' ? ' Elle n’est pas encore publiée.' : '' }}</p>
        }
      } @else {
        <p class="text-sm text-muted">La part de secours paraît ici une fois le dépositaire désigné.</p>
      }
    </div>

    <ng-template #perte>
      @if (!confirmerPerte()) {
        <button type="button" class="btn btn-outline" [disabled]="travail()" (click)="confirmerPerte.set(true)">Déclarer la part perdue…</button>
      } @else {
        <span class="ps__confirm">Le pli est perdu ou illisible ?
          <button type="button" class="btn btn-sm btn-danger" [disabled]="travail()" (click)="declarerPerdue()">Confirmer la perte</button>
          <button type="button" class="btn btn-sm btn-outline" (click)="confirmerPerte.set(false)">Annuler</button>
        </span>
      }
    </ng-template>

    <!-- Génération : la phrase générée s'affiche une fois, ici seulement, et part sur le pli — jamais au serveur. -->
    @if (secoursOuvert()) {
      <div class="modal-backdrop" [class.closing]="fermeture()">
        <div class="modal cnm-form ps__modal" role="dialog" aria-modal="true" aria-label="Ma clé de secours" appModale (appModaleFermer)="fermerSecours()">
          <header class="modal-header">
            <span class="modal-title">{{ mode() === 'remplacer' ? 'Remplacer la clé de secours' : 'Ma clé de secours' }}</span>
            <button type="button" class="btn-close" aria-label="Fermer" (click)="fermerSecours()">✕</button>
          </header>
          <div class="modal-body ps__corps">
            @if (erreurSecours(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
            @if (!pli()) {
              <p>Votre clé de secours naît <strong>sur ce poste</strong>. Sa phrase secrète est <strong>générée</strong> et affichée une seule fois : imprimez le pli, scellez-le et conservez-le. Vous seul la connaîtrez ; le serveur ne reçoit que l'enveloppe.</p>
              <button type="button" class="btn btn-primary" [disabled]="travail()" (click)="generer()">{{ travail() ? 'Génération…' : 'Générer la clé et la phrase' }}</button>
            } @else {
              <p class="form-label">Phrase secrète du pli — à imprimer, jamais à retaper ici</p>
              <p class="ps__phrase cnm-mono">{{ pli()!.phrase }}</p>
              <p class="form-label">Empreinte de la clé</p>
              <p class="cnm-mono ps__emp">{{ formater(pli()!.empreinte) }}</p>
              <div class="ps__actions">
                <button type="button" class="btn btn-secondary" (click)="imprimerPli()">Imprimer le pli</button>
                <button type="button" class="btn btn-outline" (click)="enregistrerPli()">Enregistrer le pli (.txt)</button>
              </div>
              <label class="ps__case"><input type="checkbox" [checked]="pliImprime()" (change)="pliImprime.set($any($event.target).checked)" /> J'ai imprimé le pli ; je le scelle et le conserve.</label>
            }
          </div>
          <footer class="modal-footer">
            <button type="button" class="btn btn-outline" [disabled]="travail()" (click)="fermerSecours()">Annuler</button>
            @if (pli()) { <button type="button" class="btn btn-primary" [disabled]="travail() || !pliImprime()" (click)="publier()">{{ travail() ? 'Publication…' : mode() === 'remplacer' ? 'Remplacer la clé' : 'Publier ma clé de secours' }}</button> }
          </footer>
        </div>
      </div>
    }

    <!-- Vérification (S2) : l'enveloppe vient du serveur, le pli n'apporte que la phrase. -->
    @if (verifOuverte()) {
      <div class="modal-backdrop" [class.closing]="fermeture()">
        <div class="modal cnm-form ps__modal" role="dialog" aria-modal="true" aria-label="Vérifier la part de secours" appModale (appModaleFermer)="fermerVerif()">
          <header class="modal-header">
            <span class="modal-title">Vérifier la part de secours</span>
            <button type="button" class="btn-close" aria-label="Fermer" (click)="fermerVerif()">✕</button>
          </header>
          <form (submit)="$event.preventDefault(); verifier()" novalidate>
            <div class="modal-body ps__corps">
              @if (erreurSecours(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
              <p class="text-sm">{{ vue() === 'depositaire' ? 'La phrase de votre pli' : 'La phrase du pli, dictée par le dépositaire,' }} déverrouille ici l'enveloppe gardée par le serveur, qui déchiffre un défi. Rien de secret n'est transmis.</p>
              <label class="form-group">
                <span class="form-label">Phrase du pli</span>
                <input class="form-control" type="password" autocomplete="off" [value]="phraseVerif()" (input)="phraseVerif.set($any($event.target).value)" />
              </label>
            </div>
            <footer class="modal-footer">
              <button type="button" class="btn btn-outline" [disabled]="travail()" (click)="fermerVerif()">Annuler</button>
              <button type="submit" class="btn btn-primary" [disabled]="travail()">{{ travail() ? 'Vérification…' : 'Vérifier' }}</button>
            </footer>
          </form>
        </div>
      </div>
    }
  `,
  styles: `
    .ps { padding: 0.9rem 1.1rem; display: flex; flex-direction: column; gap: 0.6rem; }
    .ps__h3 { margin: 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .ps__etat { margin: 0; display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; font-size: 0.9rem; }
    .ps__note { margin: 0; }
    .ps__actions { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .ps__confirm { display: inline-flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; font-size: var(--text-sm); }
    .ps__modal { max-width: 40rem; }
    .ps__corps { display: flex; flex-direction: column; gap: 0.6rem; }
    .ps__phrase { margin: 0; padding: 0.6rem 0.8rem; background: var(--n-100); border-radius: var(--radius-md); font-size: 1.1rem; letter-spacing: 0.02em; user-select: all; }
    .ps__emp { margin: 0; font-size: var(--text-sm); word-break: break-all; }
    .ps__case { display: flex; gap: 0.5rem; align-items: center; font-size: var(--text-sm); }
  `,
})
export class PartSecours {
  readonly idDmc = input.required<number>();
  readonly secours = input<Detenteur | null>(null);
  readonly depositaire = input<Depositaire | null>(null);
  readonly vue = input.required<VuePartSecours>();
  /** Dépositaire : une clé active qui n'est pas la sienne (ancien geste ou ancien dépositaire) — il génère la sienne. */
  readonly cleARemplacer = input(false);
  /** Un geste a changé l'état : le parent relit. */
  readonly changement = output<void>();

  private readonly service = inject(CeremonieService);
  private readonly toast = inject(ToastService);
  private readonly document = inject(DOCUMENT);

  readonly parts = LIBELLES_ETAT_PART;
  readonly comptes = LIBELLES_COMPTE;
  readonly classePart = classePart;
  readonly dateHeure = dateHeureFr;
  readonly formater = formaterEmpreinte;

  readonly travail = signal(false);
  readonly erreurAction = signal<string | null>(null);
  readonly confirmerPerte = signal(false);
  readonly secoursOuvert = signal(false);
  readonly mode = signal<'publier' | 'remplacer'>('publier');
  readonly pli = signal<PliSecours | null>(null);
  readonly pliImprime = signal(false);
  readonly erreurSecours = signal<string | null>(null);
  readonly verifOuverte = signal(false);
  readonly phraseVerif = signal('');
  readonly fermeture = signal(false);

  /** Le dépositaire n'a pas encore SA clé : aucune publiée, ou celle qui l'est n'est pas la sienne. */
  readonly aGenerer = computed(() => this.secours()?.etatPart === 'ABSENTE' || this.cleARemplacer());

  private apres(message: string): void {
    this.travail.set(false);
    this.toast.success(message);
    this.changement.emit();
  }

  ouvrirSecours(mode: 'publier' | 'remplacer'): void {
    this.mode.set(mode);
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

  async generer(): Promise<void> {
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
      'PHRASE SECRÈTE (à saisir vous-même pour apporter la part, si la séance d’ouverture la demande) :',
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

  publier(): void {
    const p = this.pli();
    if (!p || this.travail() || !this.pliImprime()) return;
    this.travail.set(true);
    this.erreurSecours.set(null);
    const corps = { clePublique: p.clePublique, empreinte: p.empreinte, enveloppe: p.enveloppe };
    const appel = this.mode() === 'remplacer' ? this.service.remplacerSecours(this.idDmc(), corps) : this.service.publierSecours(this.idDmc(), corps);
    appel.subscribe({
      next: () => {
        this.pli.set(null);
        this.secoursOuvert.set(false);
        this.apres('Votre clé de secours est publiée. Sa phrase ne vit plus que sur votre pli.');
      },
      error: (e: ApiError) => {
        this.travail.set(false);
        this.erreurSecours.set(this.motif(e));
      },
    });
  }

  ouvrirVerif(): void {
    this.phraseVerif.set('');
    this.erreurSecours.set(null);
    this.fermeture.set(false);
    this.verifOuverte.set(true);
  }

  fermerVerif(): void {
    fermerAvecAnimation(this.fermeture, () => {
      this.verifOuverte.set(false);
      this.phraseVerif.set('');
    });
  }

  async verifier(): Promise<void> {
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
      this.verifOuverte.set(false);
      this.apres('La part de secours est vérifiée.');
    } catch (e) {
      this.travail.set(false);
      this.erreurSecours.set(this.motif(e));
    }
  }

  declarerPerdue(): void {
    if (this.travail()) return;
    this.travail.set(true);
    this.erreurAction.set(null);
    this.confirmerPerte.set(false);
    this.service.declarerPerdue(this.idDmc(), 'SECOURS').subscribe({
      next: () =>
        this.apres(this.vue() === 'depositaire' ? 'Votre part de secours est déclarée perdue : générez une nouvelle clé.' : 'La part de secours est déclarée perdue : le dépositaire génère une nouvelle clé.'),
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
      case 'GESTE_DU_DEPOSITAIRE':
        return 'La clé de secours se génère désormais chez le dépositaire, depuis son espace.';
      case 'DEPOSITAIRE_ABSENT':
        return 'Aucun dépositaire avec une adresse n’est désigné pour cette procédure.';
      case 'CEREMONIE_CLOSE':
      case 'CLE_EXISTANTE':
        return 'Une clé de secours est déjà publiée : passez par « Remplacer ».';
      case 'DEFI_ECHOUE':
        return 'Le défi a échoué : la clé déverrouillée n’est pas celle publiée pour la part de secours.';
      case 'DEFI_EXPIRE':
        return 'Le défi a expiré (cinq minutes) : recommencez.';
      case 'CLE_ABSENTE':
        return 'Aucune clé de secours publiée.';
    }
    if (api.status === 404) return 'Aucune enveloppe de secours gardée par le serveur.';
    if (api.status === 403) return 'Ce geste revient au détenteur de la clé de secours.';
    return (e as Error)?.message || 'Le geste n’a pas abouti.';
  }
}
