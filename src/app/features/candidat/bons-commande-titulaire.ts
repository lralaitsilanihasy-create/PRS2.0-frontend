import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';

import { ApiError } from '../../core/errors/api-error';
import { ouvrirBlobSur, telechargerBlob } from '../../core/securite/fichiers-surs';
import { BonCommande, ReceptionsBon } from '../../models';
import { BonsCommandeTitulaireService } from '../../services';
import { EtatErreur } from '../../shared/ui/etat-erreur';
import { ariary } from '../evaluation/libelles-evaluation';
import { DECISIONS_RECEPTION, ETATS_RECEPTION_BON, lignesALivrer, livraisonAttendue, refusReception } from '../receptions/receptions-bon';
import { QuantitesLignes, SaisieQuantites, quantiteSaisie, quantitesValides } from '../receptions/quantites-lignes';
import { dateFr } from '../../core/interim/interim-libelles';
import { dateHeureFr } from './libelles-candidat';
import { EtatVideCandidat } from './etat-vide-candidat';

/**
 * ⚠️ Lot MS-3 (V126, 16/10) — **les bons de commande** reçus par le titulaire (contrat-cadre ou marché à commandes). La première
 * ouverture du bon vaut **accusé de réception** : la PRMP en est avertie, et le délai de livraison court du lendemain de la
 * notification. Un bon annulé reste lisible avec son motif.
 */
@Component({
  selector: 'app-bons-commande-titulaire',
  imports: [EtatErreur, EtatVideCandidat, QuantitesLignes],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="bt">
      <!-- ⚠️ 18/10 (pilote) — même en-tête que les autres pages de l'espace. -->
      <header class="page-header">
        <div class="page-subtitle">Espace candidat</div>
        <h1 class="page-title">Bons de commande</h1>
      </header>
      <p class="page-role">Les commandes de l’administration au titre de vos contrats-cadres et marchés à commandes. Ouvrir un bon en accuse réception.</p>
      @if (chargement()) {
        <p class="text-muted" role="status">Chargement des bons…</p>
      } @else if (erreur(); as m) {
        <app-etat-erreur [message]="m" aide="La liste n’a pas pu être lue." (reessayer)="charger()" />
      } @else {
        @for (b of bons(); track b.id) {
          <article class="card bt__carte" [class.bt__annule]="b.etat === 'ANNULE'" [attr.aria-label]="'Bon de commande n° ' + b.numero">
            <header class="bt__tete">
              <h2 class="bt__h2">Bon n° {{ b.numero }}{{ b.objet ? ' — ' + b.objet : '' }}</h2>
              @if (b.etat === 'ANNULE') { <span class="badge badge-danger">Annulé</span> }
              @else if (b.accuseLe) { <span class="badge badge-success">Reçu le {{ dateHeure(b.accuseLe) }}</span> }
              @else { <span class="badge badge-warning">Nouveau</span> }
            </header>
            <p class="text-sm bt__meta">{{ ariary(b.montantHt) }} HT{{ b.montantTtc != null ? ' · ' + ariary(b.montantTtc) + ' TTC' : '' }} · {{ b.lignes.length }} article{{ b.lignes.length > 1 ? 's' : '' }} · émis le {{ dateHeure(b.emisLe) }}{{ b.delaiLivraison ? ' · livraison : ' + b.delaiLivraison : '' }}{{ b.lieuLivraison ? ', ' + b.lieuLivraison : '' }}</p>
            @if (b.etat === 'ANNULE') { <p class="text-sm bt__meta">Annulé le {{ dateHeure(b.annuleLe) }} : {{ b.motifAnnulation }}</p> }
            <div class="bt__actions">
              <button type="button" class="btn btn-outline btn-sm" (click)="ouvrir(b)">Ouvrir le bon (PDF)</button>
              <button type="button" class="btn btn-ghost btn-sm" (click)="enregistrer(b)">Word</button>
              @if (b.etat === 'EMIS') {
                <button type="button" class="btn btn-ghost btn-sm" [attr.aria-expanded]="ouvert() === b.id" (click)="basculer(b.id)">Livraison et réception</button>
              }
            </div>
            <!-- ⚠️ Lot MS-4 (V127) — la livraison déclarée par le titulaire, et les procès-verbaux signés de la commission de réception. -->
            @if (ouvert() === b.id) {
              @if (receptions(); as d) {
                <div class="bt__reception">
                  <p class="text-sm bt__meta"><span class="badge" [class]="etatReception(d.etatReception).classe">{{ etatReception(d.etatReception).texte }}</span>
                    {{ d.garantieJusquau ? ' Garantie jusqu’au ' + date(d.garantieJusquau) + '.' : '' }}</p>
                  @for (r of d.receptions; track r.id) {
                    <p class="text-sm bt__meta">Réception {{ r.type === 'DEFINITIVE' ? 'définitive' : 'provisoire' }}{{ r.dateLivraison ? ' — livraison du ' + date(r.dateLivraison) : '' }} :
                      @if (r.etat === 'SIGNE' && r.decision) {
                        <strong>{{ decisions[r.decision] }}</strong>{{ r.motif ? ' — ' + r.motif : '' }}
                        <button type="button" class="btn btn-ghost btn-sm" (click)="ouvrirPv(b, r.id)">Procès-verbal signé (PDF)</button>
                      } @else { en cours auprès de la commission de réception. }
                    </p>
                  }
                  @if (livraisonAttendue(d.etatReception)) {
                    <!-- ⚠️ 29/10 (« bons-reception », §B3 ; V148) — ce que la livraison apporte, ligne par ligne (prérempli : tout le reliquat). -->
                    @if (lignesALivrer(d).length) {
                      <app-quantites-lignes [lignes]="lignesALivrer(d)" [saisie]="saisie()" (saisieChange)="saisie.set($event)" colonne="Quantité livrée" titre="Quantités livrées par article" />
                    }
                    <div class="bt__ligne">
                      <label class="form-group"><span class="form-label">Livré le</span><input class="form-control" type="date" [value]="dateLivraison()" (input)="dateLivraison.set($any($event.target).value)" /></label>
                      <label class="form-group bt__large"><span class="form-label">Observations (facultatives)</span><input class="form-control" type="text" [value]="observations()" (input)="observations.set($any($event.target).value)" /></label>
                      <button type="button" class="btn btn-primary btn-sm" [disabled]="occupe() || !(lignesALivrer(d).length === 0 || quantitesValides(lignesALivrer(d), saisie()))" (click)="declarer(b, d)">Déclarer la livraison</button>
                    </div>
                  }
                  @if (refus(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
                </div>
              } @else { <p class="text-sm text-muted" role="status">Chargement…</p> }
            }
          </article>
        } @empty { <app-etat-vide-candidat icone="clip" titre="Aucun bon de commande ne vous est adressé" texte="Les commandes émises au titre de vos contrats-cadres et marchés à commandes paraissent ici ; ouvrir un bon en accuse réception." /> }
        @if (erreurDoc(); as e) { <div class="alert alert-danger" role="alert">{{ e }}</div> }
      }
    </section>
  `,
  styles: `
    .bt { display: flex; flex-direction: column; gap: 0.8rem; }
    .bt > .page-header { margin-bottom: 0; }
    .bt > .page-role { margin-top: -0.4rem; }
    .bt__carte { padding: 0.8rem 1rem; display: flex; flex-direction: column; gap: 0.4rem; }
    .bt__annule { opacity: 0.8; }
    .bt__tete { display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap; }
    .bt__h2 { margin: 0; font-size: 1rem; flex: 1 1 auto; }
    .bt__meta { margin: 0; }
    .bt__actions { display: flex; gap: 0.3rem; flex-wrap: wrap; }
    .bt__reception { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.5rem 0.7rem; border-left: 3px solid var(--p-300); background: var(--n-50, #f8fafc); }
    .bt__ligne { display: flex; gap: 0.5rem; align-items: flex-end; flex-wrap: wrap; }
    .bt__large { flex: 1 1 16rem; }
  `,
})
export class BonsCommandeTitulaire implements OnInit {
  readonly service = inject(BonsCommandeTitulaireService);

  readonly ariary = ariary;
  readonly dateHeure = dateHeureFr;
  readonly chargement = signal(true);
  readonly erreur = signal<string | null>(null);
  readonly erreurDoc = signal<string | null>(null);
  readonly bons = signal<BonCommande[]>([]);

  // ⚠️ Lot MS-4 — la livraison et les réceptions du bon déplié.
  readonly date = dateFr;
  readonly decisions = DECISIONS_RECEPTION;
  readonly livraisonAttendue = livraisonAttendue;
  readonly ouvert = signal<number | null>(null);
  readonly receptions = signal<ReceptionsBon | null>(null);
  readonly dateLivraison = signal('');
  readonly observations = signal('');
  readonly occupe = signal(false);
  readonly refus = signal<string | null>(null);
  /** ⚠️ V148 — les quantités livrées saisies. */
  readonly saisie = signal<SaisieQuantites>({});
  readonly lignesALivrer = lignesALivrer;
  readonly quantitesValides = quantitesValides;

  etatReception(e: string): { texte: string; classe: string } {
    return ETATS_RECEPTION_BON[e] ?? { texte: e, classe: 'badge-neutral' };
  }

  basculer(id: number): void {
    this.ouvert.set(this.ouvert() === id ? null : id);
    this.receptions.set(null);
    this.refus.set(null);
    this.saisie.set({});
    if (this.ouvert() === id) this.lireReceptions(id);
  }

  private lireReceptions(id: number): void {
    this.service.receptions(id).subscribe({
      next: (d) => this.receptions.set(d),
      error: (e: ApiError) => this.refus.set(refusReception(e)),
    });
  }

  declarer(b: BonCommande, d: ReceptionsBon): void {
    this.occupe.set(true);
    this.refus.set(null);
    const lignes = lignesALivrer(d);
    this.service.declarerLivraison(b.id, {
      dateLivraison: this.dateLivraison() || null,
      observations: this.observations().trim() || null,
      ...(lignes.length ? { lignes: lignes.map((l) => ({ rang: l.rang, quantiteLivree: quantiteSaisie(l, this.saisie()) })) } : {}),
    }).subscribe({
      next: (r) => {
        this.occupe.set(false);
        this.receptions.set(r);
        this.dateLivraison.set('');
        this.observations.set('');
        this.saisie.set({});
      },
      error: (e: ApiError) => {
        this.occupe.set(false);
        this.refus.set(refusReception(e));
      },
    });
  }

  ouvrirPv(b: BonCommande, idReception: number): void {
    this.service.pvSigne(b.id, idReception).subscribe({
      next: (blob) => ouvrirBlobSur(blob),
      error: (e: ApiError) => this.refus.set(e.status === 404 ? 'Le procès-verbal n’est pas encore signé.' : refusReception(e)),
    });
  }

  ngOnInit(): void {
    this.charger();
  }

  charger(): void {
    this.chargement.set(true);
    this.erreur.set(null);
    this.service.lister().subscribe({
      next: (l) => {
        this.bons.set(l);
        this.chargement.set(false);
      },
      error: () => {
        this.chargement.set(false);
        this.erreur.set('Les bons de commande n’ont pas pu être chargés.');
      },
    });
  }

  /** La première lecture pose l'accusé côté serveur : on relit la liste pour l'afficher. */
  ouvrir(b: BonCommande): void {
    this.service.document(b.id).subscribe({
      next: (blob) => {
        ouvrirBlobSur(blob);
        if (!b.accuseLe && b.etat !== 'ANNULE') this.charger();
      },
      error: (e: ApiError) => this.erreurDoc.set(e.status === 404 ? 'Le bon n’est pas disponible.' : e.message || 'Le bon n’a pas pu être ouvert.'),
    });
  }

  enregistrer(b: BonCommande): void {
    this.service.document(b.id, 'docx').subscribe({
      next: (blob) => {
        telechargerBlob(blob, `bon-commande-${b.numero}.docx`);
        if (!b.accuseLe && b.etat !== 'ANNULE') this.charger();
      },
      error: (e: ApiError) => this.erreurDoc.set(e.message || 'Le bon n’a pas pu être enregistré.'),
    });
  }
}
