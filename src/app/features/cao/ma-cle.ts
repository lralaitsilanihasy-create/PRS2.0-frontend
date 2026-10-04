import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../../core/auth/auth.service';
import { ApiError, codeErreur } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import {
  CopieCle,
  LONGUEUR_MIN_PHRASE,
  PhraseIncorrecte,
  dechiffrer,
  desenvelopper,
  empreinteCourte,
  envelopper,
  exporterClePublique,
  fichierCopie,
  formaterEmpreinte,
  genererPaire,
  lireCopie,
} from '../../core/securite/cles-detenteur';
import { telechargerBlob } from '../../core/securite/fichiers-surs';
import { Ceremonie, Detenteur, Enveloppe } from '../../models';
import { CeremonieService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { dateHeureFr } from '../candidat/libelles-candidat';
import { LIBELLES_ETAT_CEREMONIE, LIBELLES_ETAT_PART, classeCeremonie, classePart } from './libelles-cao';

/**
 * **Ma clé** — la part d'un membre de la commission d'appel d'offres (lot 2b, ADR-0013). Tout le travail cryptographique se
 * fait ICI, dans son navigateur (`core/securite/cles-detenteur.ts`) : la paire naît, la clé privée s'enveloppe sous sa
 * phrase secrète, et seule l'enveloppe part au serveur. Trois gestes :
 * - **publier** (ou remplacer, S4) sa clé — puis garder sa copie hors ligne ;
 * - **vérifier** sa part (S2) : un défi chiffré par le serveur pour la clé publique publiée, déchiffré ici avec la clé
 *   déverrouillée par la phrase. Réussi, il prouve deux choses : la phrase est la bonne, et la clé publiée est bien
 *   celle de ce membre — c'est son contrôle contre un serveur qui aurait glissé une clé ;
 * - **déclarer sa part perdue** : la perte la plus probable est l'oubli de la phrase.
 * La phrase ne quitte jamais le navigateur ; l'écran ne la garde pas une fois le geste fait.
 */
@Component({
  selector: 'app-ma-cle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EtatErreur],
  template: `
    <section class="mc" aria-labelledby="mc-titre">
      <h2 id="mc-titre" class="mc__h2">Ma part de clé</h2>

      @if (chargement()) {
        <p class="text-muted" role="status">Chargement de la cérémonie…</p>
      } @else if (refuse()) {
        <div class="alert alert-info" role="status"><span>La cérémonie n'est servie qu'aux membres de cette commission.</span></div>
      } @else if (erreur()) {
        <app-etat-erreur message="La cérémonie n'a pas pu être chargée." (reessayer)="charger()" />
      } @else if (ceremonie(); as c) {
        <p class="mc__ligne">
          <span class="badge" [class]="'badge ' + classeCeremonie(c.etat)">Cérémonie {{ ceremonies[c.etat] }}</span>
          <span class="text-sm text-muted">{{ c.n }} parts, quorum {{ c.quorum ?? '—' }}{{ c.dateCloture ? ' · close le ' + dateHeure(c.dateCloture) : c.dateCeremoniePrevue ? ' · prévue le ' + dateHeure(c.dateCeremoniePrevue) : '' }}</span>
        </p>
        @for (a of c.avertissements; track a.regle) { <p class="alert alert-warning" role="status"><span>{{ a.message }}</span></p> }

        @if (moi(); as m) {
          <div class="card mc__carte">
            <p class="mc__ligne">
              <span class="badge" [class]="'badge ' + classePart(m.etatPart)">{{ parts[m.etatPart] }}</span>
              @if (m.derniereVerification) { <span class="text-sm text-muted">vérifiée le {{ dateHeure(m.derniereVerification) }}</span> }
              @if (m.remplacements) { <span class="text-sm text-muted">· remplacée {{ m.remplacements }} fois</span> }
            </p>
            @if (m.empreinte) {
              <p class="mc__empreinte"><span class="form-label">Empreinte de ma clé publiée</span><code class="cnm-mono">{{ formater(m.empreinte) }}</code></p>
            }
            @if (erreurAction(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }

            @if (resultat(); as r) {
              <div class="alert alert-success mc__resultat" role="status">
                <span><strong>Votre clé est publiée.</strong> Son empreinte : <code class="cnm-mono">{{ formater(r.empreinte) }}</code> — c'est celle que la liste ci-dessous doit montrer à votre nom.</span>
                <span>Gardez une copie hors ligne de votre clé enveloppée : elle ne sert qu'avec votre phrase, et elle vous dépanne si le serveur ne peut plus vous la rendre.</span>
                <button type="button" class="btn btn-secondary btn-sm" (click)="telechargerCopie()">Enregistrer ma copie</button>
              </div>
            }

            <!-- Publier ou remplacer : la phrase, deux fois, douze caractères au moins. -->
            @if (mode() === 'aucun') {
              <div class="mc__actions">
                @if (m.etatPart === 'ABSENTE') {
                  <button type="button" class="btn btn-primary" [disabled]="travail()" (click)="ouvrir('publier')">Générer et publier ma clé</button>
                } @else {
                  @if (m.etatPart !== 'PERDUE') {
                    <button type="button" class="btn btn-primary" [disabled]="travail()" (click)="ouvrir('verifier')">Vérifier ma part</button>
                    <button type="button" class="btn btn-outline" [disabled]="travail()" (click)="telechargerCopie()">Enregistrer ma copie</button>
                  }
                  <button type="button" class="btn btn-outline" [disabled]="travail()" (click)="ouvrir('remplacer')">Remplacer ma clé</button>
                  @if (m.etatPart !== 'PERDUE') {
                    @if (!confirmerPerte()) {
                      <button type="button" class="btn btn-outline" [disabled]="travail()" (click)="confirmerPerte.set(true)">Déclarer ma part perdue…</button>
                    } @else {
                      <span class="mc__confirm">Vous ne retrouverez pas cette clé : le responsable en est averti, et vous devrez la remplacer.
                        <button type="button" class="btn btn-sm btn-danger" [disabled]="travail()" (click)="declarerPerdue()">Confirmer la perte</button>
                        <button type="button" class="btn btn-sm btn-outline" (click)="confirmerPerte.set(false)">Annuler</button>
                      </span>
                    }
                  }
                }
              </div>
            } @else if (mode() === 'publier' || mode() === 'remplacer') {
              <form class="cnm-form mc__form" (submit)="$event.preventDefault(); genererEtPublier()" novalidate [attr.aria-label]="mode() === 'publier' ? 'Publier ma clé' : 'Remplacer ma clé'">
                <p class="text-sm">
                  Choisissez une <strong>phrase secrète</strong> : {{ minPhrase }} caractères au moins, quatre mots ou plus recommandés. Elle
                  protège votre clé privée ; elle ne quitte jamais ce navigateur, et personne ne pourra vous la redonner.
                  @if (mode() === 'remplacer') { <strong>Remplacer</strong> rend l'ancienne clé inutile pour les offres à venir. }
                </p>
                <label class="form-group">
                  <span class="form-label">Phrase secrète</span>
                  <input class="form-control" type="password" autocomplete="new-password" [value]="phrase()" (input)="phrase.set($any($event.target).value)" />
                </label>
                <label class="form-group">
                  <span class="form-label">Confirmer la phrase</span>
                  <input class="form-control" type="password" autocomplete="new-password" [value]="phrase2()" (input)="phrase2.set($any($event.target).value)" />
                </label>
                @if (erreurPhrase(); as e) { <span class="form-error">{{ e }}</span> }
                <div class="mc__actions">
                  <button type="submit" class="btn btn-primary" [disabled]="travail()">{{ travail() ? 'Génération…' : mode() === 'publier' ? 'Générer et publier' : 'Générer et remplacer' }}</button>
                  <button type="button" class="btn btn-outline" [disabled]="travail()" (click)="fermer()">Annuler</button>
                </div>
              </form>
            } @else if (mode() === 'verifier') {
              <form class="cnm-form mc__form" (submit)="$event.preventDefault(); verifier()" novalidate aria-label="Vérifier ma part">
                <p class="text-sm">
                  Le serveur chiffre un défi pour votre clé publiée ; votre phrase déverrouille votre clé ici, qui le déchiffre.
                  Réussi, le défi prouve que votre phrase est la bonne et que la clé publiée est bien la vôtre. Rien de secret
                  n'est transmis.
                </p>
                <label class="form-group">
                  <span class="form-label">Phrase secrète</span>
                  <input class="form-control" type="password" autocomplete="current-password" [value]="phrase()" (input)="phrase.set($any($event.target).value)" />
                </label>
                <label class="form-group">
                  <span class="form-label">Ma copie hors ligne (facultatif — à défaut, l'enveloppe gardée par le serveur)</span>
                  <input class="form-control" type="file" accept="application/json,.json" (change)="choisirCopie($event)" />
                  @if (copie()) { <span class="form-hint">Copie lue : empreinte {{ courte(copie()!.empreinte) }}.</span> }
                </label>
                <div class="mc__actions">
                  <button type="submit" class="btn btn-primary" [disabled]="travail()">{{ travail() ? 'Vérification…' : 'Vérifier' }}</button>
                  <button type="button" class="btn btn-outline" [disabled]="travail()" (click)="fermer()">Annuler</button>
                </div>
              </form>
            }
          </div>
        } @else {
          <div class="alert alert-info" role="status"><span>Vous ne figurez pas parmi les détenteurs de cette procédure.</span></div>
        }

        <h3 class="mc__h3">Les {{ c.n }} détenteurs et leurs empreintes</h3>
        <ul class="mc__liste">
          @for (d of c.detenteurs; track $index) {
            <li class="mc__det" [class.mc__det--moi]="d.im && d.im === monIm()">
              <span class="mc__det-nom">{{ d.nom }}{{ d.role === 'SECOURS' ? ' (part de secours)' : '' }}{{ d.im && d.im === monIm() ? ' — vous' : '' }}</span>
              <span class="badge" [class]="'badge ' + classePart(d.etatPart)">{{ parts[d.etatPart] }}</span>
              <code class="cnm-mono mc__det-emp" [title]="d.empreinte ? formater(d.empreinte) : ''">{{ d.empreinte ? courte(d.empreinte) : '—' }}</code>
            </li>
          }
        </ul>
      }
    </section>
  `,
  styles: `
    .mc { display: flex; flex-direction: column; gap: 0.75rem; }
    .mc__h2 { margin: 0; font-size: 1.05rem; }
    .mc__h3 { margin: 0.5rem 0 0; font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-500); }
    .mc__ligne { margin: 0; display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .mc__carte { padding: 1rem 1.25rem; display: flex; flex-direction: column; gap: 0.75rem; }
    .mc__empreinte { margin: 0; display: flex; flex-direction: column; gap: 0.2rem; }
    .mc__empreinte code { font-size: var(--text-sm); word-break: break-all; }
    .mc__resultat { display: flex; flex-direction: column; gap: 0.4rem; align-items: flex-start; }
    .mc__actions { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
    .mc__confirm { display: inline-flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; font-size: var(--text-sm); }
    .mc__form { display: flex; flex-direction: column; gap: 0.6rem; }
    .mc__liste { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.35rem; }
    .mc__det { display: grid; grid-template-columns: 1fr auto auto; gap: 0.75rem; align-items: center; padding: 0.4rem 0.6rem; border: 1px solid var(--n-200); border-radius: var(--radius-md); font-size: var(--text-sm); }
    .mc__det--moi { border-color: var(--p-300); background: var(--p-50); }
    .mc__det-nom { font-weight: 600; }
    .mc__det-emp { font-size: var(--text-xs); }
    @media (max-width: 600px) { .mc__det { grid-template-columns: 1fr; } }
  `,
})
export class MaCle implements OnInit {
  readonly idDmc = input.required<number>();

  private readonly service = inject(CeremonieService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly parts = LIBELLES_ETAT_PART;
  readonly ceremonies = LIBELLES_ETAT_CEREMONIE;
  readonly classePart = classePart;
  readonly classeCeremonie = classeCeremonie;
  readonly dateHeure = dateHeureFr;
  readonly formater = formaterEmpreinte;
  readonly courte = empreinteCourte;
  readonly minPhrase = LONGUEUR_MIN_PHRASE;

  readonly chargement = signal(true);
  readonly refuse = signal(false);
  readonly erreur = signal(false);
  readonly ceremonie = signal<Ceremonie | null>(null);
  readonly monIm = computed(() => this.auth.ref());
  readonly moi = computed<Detenteur | null>(() => this.ceremonie()?.detenteurs.find((d) => d.role === 'MEMBRE' && d.im === this.monIm()) ?? null);

  readonly mode = signal<'aucun' | 'publier' | 'remplacer' | 'verifier'>('aucun');
  readonly phrase = signal('');
  readonly phrase2 = signal('');
  readonly erreurPhrase = signal<string | null>(null);
  readonly erreurAction = signal<string | null>(null);
  readonly travail = signal(false);
  /** L'enveloppe qu'on vient de publier, le temps d'en enregistrer la copie ; effacée au prochain geste. */
  readonly resultat = signal<{ empreinte: string; enveloppe: Enveloppe } | null>(null);
  readonly copie = signal<CopieCle | null>(null);
  readonly confirmerPerte = signal(false);

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

  ouvrir(mode: 'publier' | 'remplacer' | 'verifier'): void {
    this.mode.set(mode);
    this.phrase.set('');
    this.phrase2.set('');
    this.erreurPhrase.set(null);
    this.erreurAction.set(null);
    this.resultat.set(null);
    this.copie.set(null);
    this.confirmerPerte.set(false);
  }

  fermer(): void {
    this.mode.set('aucun');
    this.phrase.set('');
    this.phrase2.set('');
    this.erreurPhrase.set(null);
  }

  /** La paire naît ici ; seule l'enveloppe part. La phrase est effacée dès le geste fait. */
  async genererEtPublier(): Promise<void> {
    const phrase = this.phrase();
    if (phrase.length < LONGUEUR_MIN_PHRASE) {
      this.erreurPhrase.set(`${LONGUEUR_MIN_PHRASE} caractères au moins.`);
      return;
    }
    if (phrase !== this.phrase2()) {
      this.erreurPhrase.set('Les deux phrases diffèrent.');
      return;
    }
    this.erreurPhrase.set(null);
    this.erreurAction.set(null);
    this.travail.set(true);
    try {
      const paire = await genererPaire();
      const { clePublique, empreinte } = await exporterClePublique(paire.publicKey);
      const enveloppe = await envelopper(paire.privateKey, phrase);
      const corps = { clePublique, empreinte, enveloppe };
      const appel = this.mode() === 'remplacer' ? this.service.remplacerCle(this.idDmc(), corps) : this.service.publierCle(this.idDmc(), corps);
      await firstValueFrom(appel);
      this.resultat.set({ empreinte, enveloppe });
      this.toast.success(this.mode() === 'remplacer' ? 'Votre clé est remplacée.' : 'Votre clé est publiée.', 'C’est fait');
      this.fermer();
      this.charger();
    } catch (e) {
      this.erreurAction.set(this.motif(e));
    } finally {
      this.travail.set(false);
    }
  }

  /** S2 — le défi : déverrouiller ici, déchiffrer ici, ne renvoyer que le clair. */
  async verifier(): Promise<void> {
    const phrase = this.phrase();
    if (!phrase) {
      this.erreurPhrase.set('La phrase secrète est obligatoire.');
      return;
    }
    this.erreurPhrase.set(null);
    this.erreurAction.set(null);
    this.travail.set(true);
    try {
      const enveloppe = this.copie()?.enveloppe ?? (await firstValueFrom(this.service.maCle(this.idDmc())));
      const privee = await desenvelopper(enveloppe, phrase);
      const defi = await firstValueFrom(this.service.ouvrirDefi(this.idDmc()));
      let clair: string;
      try {
        clair = await dechiffrer(privee, defi.chiffre);
      } catch {
        throw new Error('Le défi ne se déchiffre pas avec cette clé : la clé publiée pour vous n’est pas celle de cette enveloppe. Signalez-le au responsable de la procédure.');
      }
      await firstValueFrom(this.service.repondreDefi(this.idDmc(), defi.idDefi, clair));
      this.toast.success('Votre part est vérifiée : votre phrase et votre clé publiée s’accordent.', 'C’est fait');
      this.fermer();
      this.charger();
    } catch (e) {
      this.erreurAction.set(this.motif(e));
    } finally {
      this.travail.set(false);
    }
  }

  choisirCopie(ev: Event): void {
    const fichier = (ev.target as HTMLInputElement).files?.[0];
    if (!fichier) {
      this.copie.set(null);
      return;
    }
    void fichier.text().then((texte) => {
      const copie = lireCopie(texte);
      this.copie.set(copie);
      this.erreurAction.set(copie ? null : 'Ce fichier n’est pas une copie de clé de PRS.');
    });
  }

  telechargerCopie(): void {
    const r = this.resultat();
    const nom = (empreinte: string) => `cle-prs-procedure-${this.idDmc()}-${empreinte.slice(0, 8)}.json`;
    if (r) {
      telechargerBlob(fichierCopie({ idDmc: this.idDmc(), role: 'MEMBRE', empreinte: r.empreinte, enveloppe: r.enveloppe }), nom(r.empreinte));
      return;
    }
    const empreinte = this.moi()?.empreinte ?? '';
    this.service.maCle(this.idDmc()).subscribe({
      next: (enveloppe) => telechargerBlob(fichierCopie({ idDmc: this.idDmc(), role: 'MEMBRE', empreinte, enveloppe }), nom(empreinte)),
      error: (e: ApiError) => this.erreurAction.set(this.motif(e)),
    });
  }

  declarerPerdue(): void {
    if (this.travail()) return;
    this.travail.set(true);
    this.erreurAction.set(null);
    this.service.declarerPerdue(this.idDmc()).subscribe({
      next: () => {
        this.travail.set(false);
        this.confirmerPerte.set(false);
        this.toast.info('Votre part est déclarée perdue ; le responsable de la procédure en est averti. Remplacez votre clé.', 'Part perdue');
        this.charger();
      },
      error: (e: ApiError) => {
        this.travail.set(false);
        this.erreurAction.set(this.motif(e));
      },
    });
  }

  /** Notre mot pour un code connu ; le message du serveur ou de l'erreur sinon. */
  private motif(e: unknown): string {
    if (e instanceof PhraseIncorrecte) return e.message;
    const api = e as Partial<ApiError> & { status?: number };
    switch (codeErreur(api as ApiError)) {
      case 'CEREMONIE_CLOSE':
      case 'CLE_EXISTANTE':
        return 'Votre clé est déjà publiée, ou la cérémonie est close : passez par « Remplacer ma clé ».';
      case 'DEFI_ECHOUE':
        return 'Le défi a échoué : la clé déverrouillée n’est pas celle publiée pour vous. Signalez-le au responsable de la procédure.';
      case 'DEFI_EXPIRE':
        return 'Le défi a expiré (cinq minutes) : recommencez.';
      case 'CLE_ABSENTE':
        return 'Aucune clé publiée pour vous : publiez-la d’abord.';
      case 'CLE_INVALIDE':
      case 'EMPREINTE_INVALIDE':
      case 'ENVELOPPE_INVALIDE':
        return `Le serveur a refusé la clé générée (${codeErreur(api as ApiError)}) : réessayez, et signalez-le si cela se reproduit.`;
    }
    if (api.status === 404) return 'Aucune enveloppe gardée pour vous sur le serveur : utilisez votre copie hors ligne, ou remplacez votre clé.';
    if (api.status === 403) return 'Ce geste est réservé au membre détenteur de cette part.';
    return (e as Error)?.message || 'Le geste n’a pas abouti.';
  }
}
