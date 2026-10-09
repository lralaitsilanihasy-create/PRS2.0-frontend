import { ChangeDetectionStrategy, Component, inject, input, output, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ApiError, codeErreur } from '../../core/errors/api-error';
import { PhraseIncorrecte, dechiffrer, desenvelopper } from '../../core/securite/cles-detenteur';
import { Enveloppe, RoleDetenteur, Seance, SeanceFinanciere } from '../../models';
import { CeremonieService, EvaluationPiService, SeanceService } from '../../services';

/**
 * **Apporter mes parts** à la séance d'ouverture (lot 4, ADR-0013 §1). Le détenteur — un membre de la CAO, ou le responsable
 * pour la **part de secours** (`role = SECOURS`, pli ouvert devant la séance, motif obligatoire) — saisit sa phrase ; **dans ce
 * navigateur**, sa clé se déverrouille et déchiffre sa part de chaque offre ; seules les parts claires partent, toutes ensemble.
 * Une offre scellée avant un remplacement de clé (S4) désigne l'ancienne clé : son enveloppe archivée est servie avec la part, et
 * la même phrase est essayée (celle de l'époque, le plus souvent la même).
 *
 * ⚠️ Lot 3 PI, PI-d1 (V88) — `[financiere]="true"` : la **seconde séance**, celle des enveloppes financières des propositions
 * qualifiées ; mêmes clés de la cérémonie, autres parts (`/seance/financiere/**`) ; l'issue sort par `apporteFinanciere`.
 */
@Component({
  selector: 'app-apport-parts',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="cnm-form ap" (submit)="$event.preventDefault(); apporter()" novalidate [attr.aria-label]="role() === 'SECOURS' ? 'Apporter la part de secours' : 'Apporter mes parts'">
      @if (role() === 'SECOURS' && parDepositaire()) {
        <p class="text-sm">La séance demande votre part de secours. Saisissez la phrase de votre pli : elle déverrouille votre clé sur ce poste, qui déchiffre la part de chaque offre. Seules ces parts partent — jamais votre phrase.</p>
      } @else if (role() === 'SECOURS') {
        <p class="text-sm">Le dépositaire ouvre son pli devant la séance et dicte la phrase. L'emploi de la part de secours est consigné au procès-verbal, avec son motif.</p>
        <label class="form-group">
          <span class="form-label">Motif de l'emploi de la part de secours</span>
          <input class="form-control" type="text" [value]="motif()" (input)="motif.set($any($event.target).value)" />
        </label>
      } @else {
        <p class="text-sm">Votre phrase déverrouille votre clé sur ce poste ; elle y déchiffre votre part de chaque offre. Seules ces parts partent — jamais votre phrase ni votre clé.</p>
      }
      <label class="form-group">
        <span class="form-label">{{ role() === 'SECOURS' ? 'Phrase du pli' : 'Ma phrase secrète' }}</span>
        <input class="form-control" type="password" autocomplete="off" [value]="phrase()" (input)="phrase.set($any($event.target).value)" />
      </label>
      @if (erreur(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
      <div class="ap__actions">
        <button type="submit" class="btn btn-primary" [disabled]="travail()">{{ travail() ? etape() : role() === 'SECOURS' ? 'Apporter la part de secours' : 'Apporter mes parts' }}</button>
      </div>
    </form>
  `,
  styles: `
    .ap { display: flex; flex-direction: column; gap: 0.6rem; }
    .ap__actions { display: flex; gap: 0.5rem; }
  `,
})
export class ApportParts {
  readonly idDmc = input.required<number>();
  readonly role = input<RoleDetenteur>('MEMBRE');
  /** ⚠️ V71 — la part de secours apportée par le dépositaire lui-même, de son espace : sans motif (celui de la demande vaut). */
  readonly parDepositaire = input(false);
  readonly apporte = output<Seance>();
  /** ⚠️ PI-d1 — la seconde séance (enveloppes financières). */
  readonly financiere = input(false);
  readonly apporteFinanciere = output<SeanceFinanciere>();

  private readonly seance = inject(SeanceService);
  private readonly ceremonie = inject(CeremonieService);
  private readonly pi = inject(EvaluationPiService);

  readonly phrase = signal('');
  readonly motif = signal('');
  readonly travail = signal(false);
  readonly etape = signal('');
  readonly erreur = signal<string | null>(null);

  async apporter(): Promise<void> {
    const phrase = this.phrase().trim();
    const secours = this.role() === 'SECOURS';
    if (!phrase) {
      this.erreur.set('La phrase est obligatoire.');
      return;
    }
    if (secours && !this.parDepositaire() && !this.motif().trim()) {
      this.erreur.set('Le motif est obligatoire : il est imprimé au procès-verbal.');
      return;
    }
    this.erreur.set(null);
    this.travail.set(true);
    try {
      this.etape.set('Récupération des parts…');
      const parts = await firstValueFrom(this.financiere() ? this.pi.mesPartsFinancieres(this.idDmc(), this.role()) : this.seance.mesParts(this.idDmc(), this.role()));
      const enveloppe = await firstValueFrom(secours ? this.ceremonie.enveloppeSecours(this.idDmc()) : this.ceremonie.maCle(this.idDmc()));
      this.etape.set('Déverrouillage de la clé…');
      const cles = new Map<Enveloppe, CryptoKey>();
      const cleDe = async (e: Enveloppe): Promise<CryptoKey> => {
        if (!cles.has(e)) cles.set(e, await desenvelopper(e, phrase));
        return cles.get(e)!;
      };
      this.etape.set(`Déchiffrement de ${parts.length} part(s)…`);
      const claires: { idOffre: string; partClaire: string }[] = [];
      for (const p of parts) claires.push({ idOffre: p.idOffre, partClaire: await dechiffrer(await cleDe(p.enveloppe ?? enveloppe), p.part) });
      this.etape.set('Envoi…');
      // ⚠️ V71 : le dépositaire apporte sans motif — c'est celui de la demande du responsable qui va au PV.
      const motif = secours && !this.parDepositaire() ? this.motif().trim() : undefined;
      if (this.financiere()) {
        const sf = await firstValueFrom(this.pi.apporterPartsFinancieres(this.idDmc(), claires, this.role(), motif));
        this.phrase.set('');
        this.apporteFinanciere.emit(sf);
      } else {
        const s = await firstValueFrom(this.seance.apporterParts(this.idDmc(), claires, this.role(), motif));
        this.phrase.set('');
        this.apporte.emit(s);
      }
    } catch (e) {
      this.erreur.set(this.motifErreur(e));
    } finally {
      this.travail.set(false);
    }
  }

  private motifErreur(e: unknown): string {
    if (e instanceof PhraseIncorrecte) return 'Cette phrase ne déverrouille pas la clé. Vérifiez-la (majuscules, espaces) et réessayez.';
    const api = e as Partial<ApiError>;
    switch (codeErreur(api as ApiError)) {
      case 'SEANCE_NON_OUVERTE':
        return 'La séance n’est pas encore ouverte : les parts ne sont servies qu’à l’ouverture.';
      case 'PARTS_INCOMPLETES':
        return 'Il manque des parts : rechargez et réessayez.';
      case 'PART_INVALIDE':
        return 'Une part a été refusée par le serveur. Signalez-le au responsable de la procédure.';
      case 'CLE_ABSENTE':
        return 'Aucune clé publiée pour vous dans cette procédure.';
      case 'MOTIF_ABSENT':
        return 'Le motif est obligatoire pour la part de secours.';
      case 'SECOURS_NON_DEMANDE':
        return 'La séance n’a pas demandé la part de secours : attendez la demande du responsable de la procédure.';
    }
    if (api.status === 403) return 'Vous ne détenez pas de part pour cette procédure.';
    return (e as Error)?.message || api.message || 'L’apport des parts n’a pas abouti.';
  }
}
