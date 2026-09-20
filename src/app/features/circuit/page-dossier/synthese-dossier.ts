import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { Subscription } from 'rxjs';

import { FaitsDossier } from '../../../models/assistant-ia.model';
import { AssistantIaService } from '../../../services/assistant-ia.services';
import { Icone } from '../../../shared/ui/icone';
import { Bloc, Segment, analyserReponse } from '../../../layout/assistant-ia/rendu-reponse';

/**
 * Les quatre sections que le serveur dicte au modèle (`DialogueSyntheseDossier.TITRES`). Elles sont
 * répétées ici pour une seule raison : n'accepter comme sous-titre que ce qui en est un.
 */
const TITRES = new Set([
  'Où en est ce dossier',
  'Ce qui a été demandé à la PRMP',
  'Les délais',
  'Ce qui reste à faire',
]);

/** La synthèse ne cite aucun extrait : il n'y a donc aucun numéro de citation à reconnaître. */
const AUCUNE_CITATION: ReadonlySet<number> = new Set<number>();

/** Un bloc prêt à afficher : le titre de section extrait du gras de tête, quand il y en a un. */
export type BlocAffiche =
  | { type: 'paragraphe'; titre: string | null; segments: Segment[] }
  | { type: 'liste'; ordonnee: boolean; elements: Segment[][] };

/** Sort le titre de section d'un paragraphe qui commence par lui ; laisse le reste intact. */
export function titrer(bloc: Bloc): BlocAffiche {
  if (bloc.type !== 'paragraphe') {
    return bloc;
  }
  const [premier, ...reste] = bloc.segments;
  if (premier?.type !== 'gras' || !TITRES.has(premier.texte.trim())) {
    return { type: 'paragraphe', titre: null, segments: bloc.segments };
  }
  // Le texte qui suit le titre garde l'espace qui l'en séparait : on le retire.
  const suite = reste.length && reste[0].type === 'texte'
    ? [{ type: 'texte' as const, texte: reste[0].texte.replace(/^\s+/, '') }, ...reste.slice(1)]
    : reste;
  return { type: 'paragraphe', titre: premier.texte.trim(), segments: suite };
}

/**
 * ⚠️ **Synthèse d'un dossier par l'assistant** (assistant IA, lot 2, étape 4 ;
 * `backend/docs/plan-assistant-ia.md` §4, lot 2).
 *
 * Deux partis pris d'affichage, qui sont la doctrine du lot rendue visible :
 *
 * 1. **Les faits d'abord, la prose ensuite.** Ce que le serveur a lu arrive avant la première seconde
 *    de calcul et s'affiche tout de suite ; la rédaction se remplit au fil du flux. Le lecteur voit
 *    donc, dans cet ordre, ce qui est établi puis ce qui est rédigé — *les faits sont du serveur, la
 *    prose est du modèle*.
 * 2. **Rien ne se déclenche tout seul.** Un modèle qui tournerait à chaque ouverture de dossier
 *    coûterait cher et n'apporterait rien à qui ne l'a pas demandé.
 *
 * ⚠️ Le texte du modèle n'est **jamais** injecté en HTML : il passe par le découpage sûr du lot 1
 * (`rendu-reponse`), qui ne reconnaît que les paragraphes, les listes et le gras.
 */
@Component({
  selector: 'app-synthese-dossier',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone],
  template: `
    @if (!absent()) {
      <section class="sd" aria-labelledby="sd-titre">
        <header class="sd__tete">
          <h2 class="sd__titre" id="sd-titre">Synthèse de l'assistant</h2>
          @if (!demarree()) {
            <button type="button" class="btn btn-secondary btn-sm" (click)="demander()"
              title="L'assistant résume ce dossier à partir de ce que vous avez le droit d'y lire : où il en est, ce qui a été demandé à la PRMP, les délais, ce qui reste à faire.">
              <app-icone nom="message" [taille]="16" />Résumer ce dossier
            </button>
          } @else if (!enCours()) {
            <button type="button" class="btn btn-outline btn-sm" (click)="demander()">Refaire la synthèse</button>
          }
        </header>

        @if (!demarree()) {
          <p class="sd__invite">
            Un résumé de ce dossier, rédigé à la demande. Il ne remplace ni la lecture des pièces ni
            l'examen : il dit où en est le dossier, et ce qui a été demandé.
          </p>
        }

        @if (erreur(); as e) {
          <p class="sd__erreur" role="status">{{ e }}</p>
        }

        @if (faits(); as f) {
          <!-- Les faits AVANT la prose, et dépliables : c'est ce que le serveur a lu, et exactement ce
               que le modèle a reçu. On peut donc vérifier la synthèse sans quitter l'écran. -->
          <details class="sd__faits" [open]="!texte()">
            <summary class="sd__faits-titre">
              Ce que l'assistant a lu<span class="sd__compte">{{ f.sections.length }} {{ f.sections.length > 1 ? 'rubriques' : 'rubrique' }}</span>
            </summary>
            @for (section of f.sections; track section.titre) {
              <div class="sd__section">
                <b>{{ section.titre }}</b>
                <ul>
                  @for (ligne of section.lignes; track ligne) {
                    <li>{{ ligne }}</li>
                  }
                </ul>
              </div>
            }
            @if (f.outilsRefuses.length) {
              <p class="sd__refuses">
                Non lu pour votre profil, ou sans objet sur ce dossier : {{ f.outilsRefuses.join(', ') }}.
              </p>
            }
          </details>
        }

        @if (enCours() && !texte()) {
          <p class="sd__attente" role="status"><span class="spinner" aria-hidden="true"></span>L'assistant rédige…</p>
        }

        @if (blocs().length) {
          <div class="sd__texte">
            @for (bloc of blocs(); track $index) {
              @switch (bloc.type) {
                @case ('paragraphe') {
                  <!-- Le titre de section, que le modèle met en gras en tête de paragraphe, devient un
                       vrai sous-titre : sans cela, « Les délais » coulerait dans la phrase qui suit. -->
                  @if (bloc.titre) {
                    <h3 class="sd__soustitre">{{ bloc.titre }}</h3>
                  }
                  @if (bloc.segments.length) {
                    <p>
                      @for (s of bloc.segments; track $index) {
                        @if (s.type === 'gras') {
                          <b>{{ s.texte }}</b>
                        } @else if (s.type === 'texte') {
                          {{ s.texte }}
                        }
                      }
                    </p>
                  }
                }
                @case ('liste') {
                  <ul>
                    @for (element of bloc.elements; track $index) {
                      <li>
                        @for (s of element; track $index) {
                          @if (s.type === 'gras') {
                            <b>{{ s.texte }}</b>
                          } @else if (s.type === 'texte') {
                            {{ s.texte }}
                          }
                        }
                      </li>
                    }
                  </ul>
                }
              }
            }
          </div>
        }

        @if (mention(); as m) {
          <p class="sd__mention">{{ m }}</p>
        }
      </section>
    }
  `,
  styles: `
    .sd {
      border: 1px solid var(--n-200);
      border-radius: var(--radius-lg);
      background: #fff;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .sd__tete {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .sd__titre {
      margin: 0;
      font-size: var(--text-md, 15px);
      font-weight: 700;
      color: var(--n-700);
    }
    .sd__invite,
    .sd__refuses,
    .sd__mention {
      margin: 0;
      font-size: var(--text-sm);
      color: var(--n-500);
      line-height: 1.5;
    }
    .sd__erreur {
      margin: 0;
      padding: 8px 10px;
      border-radius: var(--radius-md, 6px);
      background: var(--warning-bg);
      border: 1px solid var(--warning-bdr);
      color: var(--warning-text);
      font-size: var(--text-sm);
    }
    .sd__attente {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      font-size: var(--text-sm);
      color: var(--n-500);
    }
    .sd__faits {
      border: 1px solid var(--n-200);
      border-radius: var(--radius-md, 6px);
      padding: 8px 10px;
      font-size: var(--text-sm);
    }
    .sd__faits-titre {
      cursor: pointer;
      font-weight: 600;
      color: var(--n-600, var(--n-500));
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .sd__compte {
      font-size: var(--text-xs);
      font-weight: 400;
      color: var(--n-500);
    }
    .sd__section {
      margin-top: 8px;
      color: var(--n-600, var(--n-500));
    }
    .sd__section ul,
    .sd__texte ul {
      margin: 2px 0 0;
      padding-left: 18px;
    }
    .sd__section li {
      line-height: 1.5;
    }
    /* La prose du modèle : lisible, et visiblement distincte des faits qui la précèdent. */
    .sd__texte {
      font-size: var(--text-sm);
      color: var(--n-700);
      line-height: 1.6;
    }
    .sd__texte p {
      margin: 0 0 8px;
    }
    .sd__soustitre {
      margin: 10px 0 2px;
      font-size: var(--text-sm);
      font-weight: 700;
      color: var(--n-700);
    }
    .sd__texte > :first-child.sd__soustitre {
      margin-top: 0;
    }
    .sd__mention {
      border-top: 1px solid var(--n-200);
      padding-top: 8px;
      font-size: var(--text-xs);
    }
  `,
})
export class SyntheseDossier {
  private readonly service = inject(AssistantIaService);
  private readonly destroy = inject(DestroyRef);

  readonly idDossier = input.required<number>();

  readonly faits = signal<FaitsDossier | null>(null);
  readonly texte = signal('');
  readonly mention = signal<string | null>(null);
  readonly erreur = signal<string | null>(null);
  readonly enCours = signal(false);
  readonly demarree = signal(false);
  /** L'assistant n'est pas activé sur ce serveur (404) : le bloc disparaît entièrement. */
  readonly absent = signal(false);

  /**
   * Le texte du modèle, découpé en blocs sûrs, puis **titré**. Aucune citation ici : la synthèse n'en
   * porte pas.
   *
   * ⚠️ Un gras de tête ne devient un sous-titre que s'il est l'un des **quatre titres attendus**. Le
   * modèle remplit les sections, il ne les invente pas : un titre qu'il aurait imaginé reste du texte
   * en gras, à sa place dans la phrase.
   */
  readonly blocs = computed<BlocAffiche[]>(() =>
    analyserReponse(this.texte(), AUCUNE_CITATION).map((bloc) => titrer(bloc)),
  );

  private abonnement: Subscription | null = null;

  constructor() {
    this.destroy.onDestroy(() => this.abonnement?.unsubscribe());
  }

  demander(): void {
    if (this.enCours()) {
      return;
    }
    this.abonnement?.unsubscribe();
    this.faits.set(null);
    this.texte.set('');
    this.mention.set(null);
    this.erreur.set(null);
    this.demarree.set(true);
    this.enCours.set(true);
    this.abonnement = this.service.synthetiserDossier(this.idDossier()).subscribe({
      next: (e) => {
        switch (e.type) {
          case 'faits':
            this.faits.set(e.faits);
            break;
          case 'texte':
            this.texte.update((t) => t + e.texte);
            break;
          case 'fin':
            this.mention.set(e.mention);
            break;
          case 'erreur':
            // 404 : l'assistant n'est pas activé sur ce serveur. Le bloc s'efface au lieu de proposer
            // un geste qui échouera toujours — même règle qu'au pré-contrôle du PPM (lot 3).
            if (e.statut === 404) {
              this.absent.set(true);
            } else {
              this.erreur.set(e.message);
            }
            break;
        }
      },
      complete: () => this.enCours.set(false),
      error: () => this.enCours.set(false),
    });
  }
}
