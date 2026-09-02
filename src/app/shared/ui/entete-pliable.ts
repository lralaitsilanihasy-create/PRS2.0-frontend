import { Injectable, signal } from '@angular/core';

const CLE_STOCKAGE = 'cnm.entete.replie';

/**
 * ⚠️ Demande pilote (2026-09-02) — l'en-tête d'identité des modals de consultation (le bloc de
 * lignes « Référence PRMP / Entité contractante / Exercice / … » du Détail PPM et de la
 * Consultation dossier) peut être MASQUÉ pour rendre l'écran au contenu.
 *
 * État UNIQUE et PARTAGÉ entre tous les affichages de la même sorte : replier l'en-tête dans un
 * modal le replie partout — c'est une préférence de lecture, pas un état d'écran. Persisté en
 * `localStorage` (comme le profil d'affichage : préférence locale au poste, jamais une donnée).
 */
@Injectable({ providedIn: 'root' })
export class EnTetePliable {
  /** `true` = bloc d'identité masqué (les chips, le titre et le sous-titre restent). */
  readonly replie = signal(this.lire());

  basculer(): void {
    this.replie.update((v) => !v);
    try {
      localStorage.setItem(CLE_STOCKAGE, this.replie() ? '1' : '0');
    } catch {
      /* stockage indisponible (navigation privée…) : préférence de session seulement */
    }
  }

  /** Libellé du bouton — le même partout, pour que le geste se reconnaisse d'un modal à l'autre. */
  libelle(): string {
    return this.replie() ? "▸ Afficher l'en-tête" : "▾ Masquer l'en-tête";
  }

  private lire(): boolean {
    try {
      return localStorage.getItem(CLE_STOCKAGE) === '1';
    } catch {
      return false;
    }
  }
}
