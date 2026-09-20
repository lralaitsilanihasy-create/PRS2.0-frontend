import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';


import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import {
  AVERTISSEMENT_ECARTEMENT,
  MOTIF_ECARTEMENT_MIN,
  ResumePreControle,
  Signalement,
} from '../../models';
import { PreControleService } from '../../services';
import { ModaleDirective } from '../a11y/modale.directive';
import { EtatErreur } from '../ui/etat-erreur';

/**
 * Panneau du **pré-contrôle du PPM** (assistant IA, lot 3 — `backend/docs/plan-assistant-ia.md` §4).
 *
 * Le même panneau sert les deux côtés du circuit : la PRMP avant de soumettre, le contrôleur avant
 * d'examiner. C'est **le serveur** qui décide de ce que chacun voit — y compris de masquer à la PRMP
 * l'écartement d'un contrôleur —, si bien que l'écran n'a aucune règle de visibilité à tenir.
 *
 * <h2>Ce que l'écran doit rendre visible, parce que c'est ce qui en fait une aide</h2>
 * <ul>
 *   <li><strong>un fait et une piste ne se présentent pas pareil</strong> : la source `REGLE` porte sa
 *       base légale dans le constat, la source `IA` est annoncée comme une piste de l'assistant ;</li>
 *   <li><strong>l'avertissement avant d'écarter</strong> : la fenêtre le dit en toutes lettres, et le
 *       serveur refuse l'écartement si l'écran ne confirme pas l'avoir montré. Sans cela il n'y a pas
 *       de dissuasion, seulement un piège ;</li>
 *   <li><strong>rien ne s'efface</strong> : les signalements écartés et ceux qui ne ressortent plus
 *       restent affichés, avec leur motif et ce que le constat disait ;</li>
 *   <li><strong>le pré-contrôle ne décide rien</strong> : la mention du bas le rappelle, et aucun bouton
 *       de cet écran ne conditionne une soumission.</li>
 * </ul>
 *
 * Les règles tournent sur un **bouton explicite** — jamais à chaque frappe (plan, 3.d) — et à la
 * soumission, côté serveur.
 */
@Component({
  selector: 'app-pre-controle-panneau',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective, EtatErreur],
  templateUrl: './pre-controle-panneau.html',
  styleUrl: './pre-controle-panneau.scss',
})
export class PreControlePanneau {
  private readonly service = inject(PreControleService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  /** Le plan à vérifier. */
  readonly idPpm = input.required<number>();

  /**
   * Titre affiché — le même panneau s'appelle « Pré-contrôle de mon plan » côté PRMP et « Points
   * signalés par le pré-contrôle » côté contrôleur.
   */
  readonly titre = input('Pré-contrôle du plan');

  /** À `false`, le panneau ne propose pas de relancer les règles (lecture d'un plan déjà soumis). */
  readonly verificationPossible = input(true);

  readonly resume = signal<ResumePreControle | null>(null);
  readonly chargement = signal(false);
  readonly erreur = signal(false);
  readonly enCours = signal(false);

  /** Le signalement dont la fenêtre d'écartement est ouverte, et le motif en cours de frappe. */
  readonly aEcarter = signal<Signalement | null>(null);
  readonly motif = signal('');

  /** La phrase « où regarder d'abord » rendue par la dernière analyse de l'assistant ; non enregistrée. */
  readonly syntheseIa = signal<string | null>(null);

  /** Vrai dès qu'un 404 a dit que l'assistant n'est pas activé : on cesse de le proposer. */
  readonly assistantAbsent = signal(false);

  readonly avertissement = AVERTISSEMENT_ECARTEMENT;
  readonly motifMin = MOTIF_ECARTEMENT_MIN;

  /**
   * Les profils qui peuvent écarter — les mêmes que côté serveur. L'**Assistant contrôleur** en est
   * exclu : il prépare le travail de l'examinateur, il ne tranche pas. L'écran ne fait que cacher le
   * bouton ; c'est le serveur qui refuse (403).
   */
  readonly peutEcarter = computed(() =>
    this.auth.hasRole('PRMP', 'UGPM', 'PRESIDENT', 'CHEF_COMMISSION', 'MEMBRE', 'VERIFICATEUR'),
  );

  readonly signalements = computed(() => this.resume()?.signalements ?? []);

  /** Vrai quand le plan n'a aucun signalement du tout — à distinguer d'un échec de chargement. */
  readonly aucunSignalement = computed(() => this.resume() !== null && this.signalements().length === 0);

  /**
   * La phrase du bandeau, écrite à partir des compteurs **servis par le serveur** : deux écrans ne
   * doivent pas compter différemment.
   */
  readonly phraseResume = computed(() => {
    const r = this.resume();
    if (!r) {
      return '';
    }
    if (r.nbOuverts === 0 && r.nbEcartes === 0 && r.nbLeves === 0) {
      return 'Aucun point signalé sur ce plan.';
    }
    const morceaux: string[] = [];
    morceaux.push(
      r.nbOuverts === 0
        ? 'Aucun point à regarder'
        : r.nbOuverts === 1
          ? '1 point à regarder'
          : `${r.nbOuverts} points à regarder`,
    );
    if (r.nbPrioritaires > 0) {
      morceaux.push(r.nbPrioritaires === 1 ? 'dont 1 prioritaire' : `dont ${r.nbPrioritaires} prioritaires`);
    }
    if (r.nbEcartes > 0) {
      morceaux.push(r.nbEcartes === 1 ? '1 écarté' : `${r.nbEcartes} écartés`);
    }
    if (r.nbLeves > 0) {
      morceaux.push(r.nbLeves === 1 ? '1 levé par vos corrections' : `${r.nbLeves} levés par vos corrections`);
    }
    return morceaux.join(', ') + '.';
  });

  /** Le motif saisi est-il recevable ? Même borne que le serveur — inutile d'aller chercher un 400. */
  readonly motifRecevable = computed(() => this.motif().trim().length >= MOTIF_ECARTEMENT_MIN);

  constructor() {
    // Le plan peut changer sous le panneau (navigation d'un dossier à l'autre) : on relit alors.
    effect(() => {
      const id = this.idPpm();
      if (id != null) {
        this.charger(id);
      }
    });
  }

  /** Lecture seule : ce que le serveur a déjà enregistré, sans relancer les règles. */
  charger(idPpm = this.idPpm()): void {
    this.chargement.set(true);
    this.erreur.set(false);
    this.service.lire(idPpm).subscribe({
      next: (r) => {
        this.resume.set(r);
        this.chargement.set(false);
      },
      error: () => {
        this.chargement.set(false);
        this.erreur.set(true);
      },
    });
  }

  /** « Vérifier le plan » : relance les règles côté serveur. Idempotent, et sans effet sur le circuit. */
  verifier(): void {
    if (this.enCours()) {
      return;
    }
    this.enCours.set(true);
    this.service.verifier(this.idPpm()).subscribe({
      next: (r) => {
        this.resume.set(r);
        this.enCours.set(false);
        this.toast.success(this.phraseResume() || 'Vérification faite.');
      },
      error: () => this.enCours.set(false),
    });
  }

  /**
   * « Demander une piste à l'assistant » — ce que les règles ne peuvent pas voir : un même besoin sous
   * deux libellés, un objet trop vague, une nature qui ne colle pas.
   *
   * <p>Geste séparé de la vérification, et c'est volontaire : il fait travailler un modèle partagé par
   * tous les utilisateurs, il prend quelques secondes, et il ne rend que des <strong>pistes</strong>. Le
   * bouton disparaît si le serveur dit l'assistant absent (404) — les points signalés par les règles, eux,
   * restent là.</p>
   */
  analyser(): void {
    if (this.enCours()) {
      return;
    }
    this.enCours.set(true);
    this.service.analyser(this.idPpm()).subscribe({
      next: (a) => {
        this.resume.set(a.resume);
        this.syntheseIa.set(a.synthese);
        this.enCours.set(false);
        this.toast.success(a.synthese ?? "L'assistant n'a rien trouvé à signaler sur ce plan.");
      },
      error: (e: ApiError) => {
        this.enCours.set(false);
        // 404 : l'assistant n'est pas activé sur ce serveur — on cesse de le proposer, sans rien casser.
        if (e?.status === 404) {
          this.assistantAbsent.set(true);
        }
      },
    });
  }

  ouvrirEcartement(s: Signalement): void {
    this.motif.set('');
    this.aEcarter.set(s);
  }

  fermerEcartement(): void {
    this.aEcarter.set(null);
    this.motif.set('');
  }

  /**
   * Écarte le signalement. `avertissementLu: true` est envoyé parce que la fenêtre ci-contre a
   * **effectivement affiché** l'avertissement — c'est la condition que le serveur vérifie, et la
   * raison pour laquelle ce drapeau n'est jamais posé ailleurs que dans cette fenêtre.
   */
  confirmerEcartement(): void {
    const s = this.aEcarter();
    if (!s || !this.motifRecevable() || this.enCours()) {
      return;
    }
    this.enCours.set(true);
    this.service.ecarter(s.id, { motif: this.motif().trim(), avertissementLu: true }).subscribe({
      next: () => {
        this.enCours.set(false);
        this.fermerEcartement();
        this.toast.success('Signalement écarté, avec votre motif.');
        this.charger();
      },
      error: (e: ApiError) => {
        this.enCours.set(false);
        // 409 : déjà écarté par l'autre côté, ou plan soumis (écartements figés). L'état affiché est
        // périmé — on le relit plutôt que de laisser l'écran mentir.
        if (e?.status === 409) {
          this.fermerEcartement();
          this.charger();
        }
      },
    });
  }

  /** Reprend son propre écartement, tant que le plan n'est pas soumis. */
  reprendre(s: Signalement): void {
    if (this.enCours()) {
      return;
    }
    this.enCours.set(true);
    this.service.reprendre(s.id).subscribe({
      next: () => {
        this.enCours.set(false);
        this.toast.success('Écartement reprise : le point redevient à regarder.');
        this.charger();
      },
      error: () => {
        this.enCours.set(false);
        this.charger();
      },
    });
  }

  // ------------------------------------------------------------------ libellés

  libelleGravite(s: Signalement): string {
    return s.gravite === 'PRIORITAIRE' ? 'Prioritaire' : 'À vérifier';
  }

  libelleSource(s: Signalement): string {
    return s.source === 'IA' ? 'Piste de l’assistant' : 'Règle';
  }

  /** Ce qu'une source veut dire, en une phrase — l'utilisateur ne doit pas avoir à le deviner. */
  titreSource(s: Signalement): string {
    return s.source === 'IA'
      ? 'Suggestion de l’assistant : à apprécier, ce n’est pas un constat opposable.'
      : 'Constat établi par une règle, avec le texte qui le fonde.';
  }

  libelleStatut(s: Signalement): string {
    if (s.statut === 'ECARTE') {
      return 'Écarté';
    }
    return s.statut === 'LEVE_MODIFICATION' ? 'Levé par vos corrections' : 'À regarder';
  }

  libelleAuteur(s: Signalement): string {
    const e = s.ecartement;
    if (!e) {
      return '';
    }
    return e.typeActeur === 'PRMP' ? 'Écarté par la PRMP' : 'Écarté par le contrôle';
  }

  /** Vrai si l'utilisateur courant peut reprendre cet écartement : le sien, et le plan non soumis. */
  reprisePossible(s: Signalement): boolean {
    return (
      s.statut === 'ECARTE' &&
      !s.fige &&
      s.ecartement != null &&
      s.ecartement.refActeur != null &&
      s.ecartement.refActeur === this.auth.ref()
    );
  }

  montant(valeur: number | null): string {
    return valeur == null ? '—' : `${valeur.toLocaleString('fr-FR')} Ar HT`;
  }

  /** Texte saisi dans la zone de motif — le gabarit n'a pas à connaître le type de l'événement. */
  valeurSaisie(evenement: Event): string {
    return (evenement.target as HTMLTextAreaElement).value;
  }
}
