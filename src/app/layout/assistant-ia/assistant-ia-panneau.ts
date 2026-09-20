import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Subscription } from 'rxjs';

import { EtatAssistantIa, EvenementAssistantIa, FaitsDossier, SourceAssistantIa, TourAssistantIa } from '../../models/assistant-ia.model';
import { AssistantIaService } from '../../services/assistant-ia.services';
import { Icone } from '../../shared/ui/icone';
import { Bloc, analyserReponse } from './rendu-reponse';

/** Un échange question → réponse, dans l'ordre de la conversation. */
export interface Echange {
  id: number;
  question: string;
  sources: SourceAssistantIa[];
  /**
   * ⚠️ Lot 4 — ce que le SERVEUR a lu quand la question portait sur des données. Exclusif de
   * `sources` : une réponse s'appuie sur des extraits du manuel OU sur des données, jamais les deux.
   */
  faits?: FaitsDossier;
  texte: string;
  /** `attente` : rien reçu ; `en-cours` : la réponse s'écrit ; `arrete` : interrompue par l'utilisateur. */
  statut: 'attente' | 'en-cours' | 'termine' | 'erreur' | 'arrete';
  erreur?: string;
}

/** Longueur maximale d'une question — la même borne que le serveur (`QuestionIaRequest`). */
export const LONGUEUR_MAX_QUESTION = 1000;

/** Tours renvoyés au serveur pour garder le fil — la même borne que lui (`AssistantIaService`). */
const TOURS_ENVOYES = 3;

/**
 * Panneau de l'assistant IA local — lot 1 (`backend/docs/plan-assistant-ia.md`).
 *
 * Un panneau latéral, pas une modale : on pose une question sans quitter l'écran en cours, et on peut
 * continuer à travailler à côté. Il reste monté tant que la session dure, pour que la conversation
 * survive à une fermeture ; il disparaît avec la coquille, à la déconnexion.
 *
 * Ce que l'écran doit rendre visible, parce que c'est ce qui en fait une aide et pas un décideur
 * (plan, §5) : chaque réponse montre ses sources, chaque citation `[n]` ouvre l'extrait qu'elle cite,
 * et la mention du bas rappelle que l'assistant ne remplace ni le contrôleur ni la Commission.
 */
@Component({
  selector: 'app-assistant-ia-panneau',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Icone, NgTemplateOutlet],
  templateUrl: './assistant-ia-panneau.html',
  styleUrl: './assistant-ia-panneau.scss',
  host: {
    // Échap ferme le panneau depuis n'importe lequel de ses éléments : l'événement remonte jusqu'à
    // l'hôte. Posé ici plutôt que sur <aside>, qui n'est pas un élément interactif.
    '(keydown.escape)': 'fermer.emit()',
  },
})
export class AssistantIaPanneau {
  private readonly service = inject(AssistantIaService);

  readonly ouvert = input.required<boolean>();
  readonly etat = input<EtatAssistantIa | null>(null);
  readonly fermer = output<void>();

  private readonly zoneSaisie = viewChild<ElementRef<HTMLTextAreaElement>>('zoneSaisie');
  private readonly corps = viewChild<ElementRef<HTMLElement>>('corps');

  readonly longueurMax = LONGUEUR_MAX_QUESTION;
  /** Questions d'amorce : elles montrent ce que l'assistant sait faire, et répondent bien (batterie du 2026-09-18). */
  readonly exemples = [
    'Quelles sont les seules formes de fractionnement autorisées ?',
    'Quel doit être le montant de la garantie de soumission ?',
    'Qui signe la lettre de renvoi, et pourquoi ?',
    'Peut-on conclure un avenant après la réception définitive des travaux ?',
  ];

  readonly saisie = signal('');
  readonly echanges = signal<Echange[]>([]);
  /** Extrait déplié sous une réponse (un seul à la fois). */
  readonly sourceOuverte = signal<{ echange: number; numero: number } | null>(null);
  /** Message de la région live : fin de réponse ou erreur — jamais chaque morceau de texte. */
  readonly annonce = signal('');

  readonly enCours = computed(() => {
    const dernier = this.echanges().at(-1);
    return !!dernier && (dernier.statut === 'attente' || dernier.statut === 'en-cours');
  });
  readonly peutEnvoyer = computed(() => {
    const q = this.saisie().trim();
    return !this.enCours() && q.length > 0 && q.length <= this.longueurMax;
  });

  private abonnement: Subscription | null = null;
  private prochainId = 1;

  constructor() {
    // À l'ouverture, le curseur va dans la zone de saisie : c'est le seul geste attendu.
    effect(() => {
      if (this.ouvert()) {
        setTimeout(() => this.zoneSaisie()?.nativeElement.focus());
      }
    });
    inject(DestroyRef).onDestroy(() => this.abonnement?.unsubscribe());
  }

  envoyer(texte: string = this.saisie()): void {
    const question = texte.trim();
    if (!question || question.length > this.longueurMax || this.enCours()) {
      return;
    }
    const id = this.prochainId++;
    // ⚠️ L'historique est relevé AVANT d'ajouter le tour courant : ce sont les échanges déjà aboutis.
    const historique = this.historique();
    this.echanges.update((liste) => [...liste, { id, question, sources: [], texte: '', statut: 'attente' }]);
    this.saisie.set('');
    this.annonce.set('');
    this.defiler(true);
    this.abonnement = this.service.poser(question, historique).subscribe({
      next: (evenement) => this.appliquer(id, evenement),
      complete: () => this.cloturer(id),
    });
  }

  /**
   * Les derniers échanges **aboutis**, pour que le serveur garde le fil (lot 4). Une réponse en
   * erreur, interrompue ou en cours n'en fait pas partie : elle n'apprendrait rien au modèle, et une
   * réponse à moitié écrite l'induirait en erreur.
   *
   * <p>On en renvoie trois — la même borne que le serveur, qui la réapplique de toute façon : envoyer
   * toute la conversation ferait grossir chaque requête sans rien changer à ce qui est lu.</p>
   */
  private historique(): TourAssistantIa[] {
    return this.echanges()
      .filter((e) => e.statut === 'termine' && e.texte.trim().length > 0)
      .slice(-TOURS_ENVOYES)
      .map((e) => ({ question: e.question, reponse: e.texte }));
  }

  /** Entrée envoie, Maj+Entrée va à la ligne. */
  entree(evenement: KeyboardEvent): void {
    if (evenement.shiftKey || evenement.isComposing) {
      return;
    }
    evenement.preventDefault();
    this.envoyer();
  }

  /** Interrompt la réponse en cours : la requête est coupée, le serveur cesse de calculer. */
  arreter(): void {
    this.abonnement?.unsubscribe();
    this.abonnement = null;
    const dernier = this.echanges().at(-1);
    if (dernier && (dernier.statut === 'attente' || dernier.statut === 'en-cours')) {
      this.maj(dernier.id, { statut: 'arrete' });
      this.annonce.set('Réponse interrompue.');
    }
  }

  /** Nouvelle conversation. */
  effacer(): void {
    this.arreter();
    this.echanges.set([]);
    this.sourceOuverte.set(null);
    this.annonce.set('Conversation effacée.');
    this.zoneSaisie()?.nativeElement.focus();
  }

  basculerSource(echange: number, numero: number): void {
    this.sourceOuverte.update((o) => (o?.echange === echange && o.numero === numero ? null : { echange, numero }));
  }

  estOuverte(echange: number, numero: number): boolean {
    const o = this.sourceOuverte();
    return o?.echange === echange && o.numero === numero;
  }

  blocs(e: Echange): Bloc[] {
    return analyserReponse(e.texte, new Set(e.sources.map((s) => s.numero)));
  }

  /**
   * Réponse terminée qui ne cite aucun de ses extraits — typiquement une question hors des documents,
   * à laquelle l'assistant répond qu'il ne sait pas. Ses extraits sont alors repliés.
   */
  aucuneCitation(e: Echange): boolean {
    if (e.statut !== 'termine') {
      return false;
    }
    return !this.blocs(e).some((b) =>
      (b.type === 'paragraphe' ? [b.segments] : b.elements).some((l) => l.some((s) => s.type === 'citation')),
    );
  }

  libelleSource(e: Echange, numero: number): string {
    const s = e.sources.find((x) => x.numero === numero);
    return s ? `${s.document}, ${s.reference}` : '';
  }

  private appliquer(id: number, evenement: EvenementAssistantIa): void {
    switch (evenement.type) {
      case 'sources':
        this.maj(id, { sources: evenement.sources, statut: 'en-cours' });
        break;
      case 'faits':
        this.maj(id, { faits: evenement.faits, statut: 'en-cours' });
        break;
      case 'texte':
        this.echanges.update((liste) =>
          liste.map((e) => (e.id === id ? { ...e, texte: e.texte + evenement.texte, statut: 'en-cours' } : e)),
        );
        this.defiler(false);
        break;
      case 'fin':
        this.maj(id, { statut: 'termine' });
        this.annonce.set("Réponse de l'assistant terminée.");
        break;
      case 'erreur':
        this.maj(id, { statut: 'erreur', erreur: evenement.message });
        this.annonce.set(evenement.message);
        break;
    }
  }

  /** Flux terminé : une réponse restée sans `fin` ni `erreur` a été coupée en route. */
  private cloturer(id: number): void {
    const e = this.echanges().find((x) => x.id === id);
    if (e && (e.statut === 'attente' || e.statut === 'en-cours')) {
      const message = "La réponse s'est interrompue. Réessayez.";
      this.maj(id, { statut: 'erreur', erreur: message });
      this.annonce.set(message);
    }
    this.abonnement = null;
  }

  private maj(id: number, changement: Partial<Echange>): void {
    this.echanges.update((liste) => liste.map((e) => (e.id === id ? { ...e, ...changement } : e)));
  }

  /** Suit la réponse qui s'écrit, sauf si l'utilisateur est remonté lire plus haut. */
  private defiler(force: boolean): void {
    const el = this.corps()?.nativeElement;
    if (!el) {
      return;
    }
    const enBas = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (force || enBas) {
      setTimeout(() => (el.scrollTop = el.scrollHeight));
    }
  }
}
