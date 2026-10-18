import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, output, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { ApiError, codeErreur, corpsErreur, erreursParChamp } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur, telechargerBlob } from '../../core/securite/fichiers-surs';
import { ChampFiche, DisponibiliteAvis, DocumentFiche, PublicationAgpm, PublicationAvis } from '../../models';
import { DossierService } from '../../services';
import { ChampFicheMarcheService, FicheMarcheService } from '../../services/fiche-marche.services';
import { ParametreCompteDaoService } from '../../services/parametres.services';
import { ModaleDirective } from '../a11y/modale.directive';
import { avisImprimes, champsVidesAvis, horodatage, jjmmaaaa, messageDaoCompletAbsent, messageDelaiPublicite, messageIndisponible } from './avis-specifique-modele';
import { MentionsDocumentVue } from './mentions-document';

type CleSaisie = 'datePublication' | 'supports';

/**
 * ⚠️ **Avis spécifique d'appel d'offres** (plan du 30/09, lot AV-3 ; demande backend livrée, V56).
 *
 * Une fois l'examen terminé — PV signé FAV, ou FAVR après la levée des réserves —, la PRMP imprime l'avis à publier.
 * ⚠️ V118 (15/10) — le numéro et la date du Journal des Marchés Publics de l'avis général ne se saisissent plus : ils se lisent sur la
 * publication de l'AGPM déposée sur le plan, montrée dans la modale.
 * La règle est lue du serveur (`…/disponibilite`), jamais réécrite ici. Les informations de PUBLICATION (date de
 * l'avis, JMP de l'avis général, supports) se saisissent à l'impression : ce ne sont pas des données du DAO (Q4).
 * Chaque impression produit une nouvelle paire .pdf/.docx ; les précédentes restent listées.
 *
 * Posé à l'étape 7 de la fiche DAO et dans l'encart « Fiche DAO » de la page du dossier (Q5). Muet quand le serveur
 * ne répond pas (403 hors PRMP/UGPM, route absente) et pour les prestations intellectuelles (lettre d'invitation, AV-4).
 */
@Component({
  selector: 'app-avis-specifique',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective, MentionsDocumentVue],
  templateUrl: './avis-specifique.html',
  styleUrl: './avis-specifique.scss',
})
export class AvisSpecifique implements OnInit {
  private readonly fiches = inject(FicheMarcheService);
  private readonly referentiel = inject(ChampFicheMarcheService);
  private readonly compte = inject(ParametreCompteDaoService);
  private readonly toast = inject(ToastService);
  private readonly dossiers = inject(DossierService);
  private readonly destroyRef = inject(DestroyRef);

  readonly idDmc = input.required<number>();
  /** Lecture seule (fiche consultée par un autre profil, version figée) : la liste reste, le bouton disparaît. */
  readonly lecture = input(false);
  /** ⚠️ 18/10 (pilote) — sur la page d'un dossier, le projet se lit dans son onglet : la carte n'en propose plus le PDF. */
  readonly projetDansOnglet = input(false);
  /** ⚠️ 18/10 (pilote) — sur la page du dossier né d'une fiche : seulement l'impression de l'avis (après le PV favorable) et les avis imprimés. */
  readonly impressionSeule = input(false);
  /**
   * ⚠️ 18/10 (pilote) — `?imprimer=avis` (bouton du tableau de suivi, notification) : la fenêtre d'impression s'ouvre dès la
   * lecture, si le document est imprimable. La demande est lue une fois, au chargement : la page la retire ensuite de l'URL.
   */
  readonly ouvrirDEmblee = input(false);
  /** La demande d'ouverture a été lue (servie ou non). */
  readonly ouvertureTraitee = output<void>();

  readonly etat = signal<DisponibiliteAvis | null>(null);
  readonly documents = signal<DocumentFiche[]>([]);
  readonly imprimes = computed(() => avisImprimes(this.documents()));
  /** Muet pour les prestations intellectuelles (lettre, AV-4) et ⚠️ R3c pour l'appel d'offres restreint (`MODE_SANS_AVIS` : lettre AOR). */
  readonly visible = computed(() => {
    const e = this.etat();
    return !!e && e.raison !== 'CATEGORIE_SANS_AVIS' && e.raison !== 'MODE_SANS_AVIS'
      && (!this.impressionSeule() || !!e.disponible || this.imprimes().length > 0);
  });
  readonly attente = computed(() => (this.etat()?.disponible ? null : messageIndisponible(this.etat()?.raison ?? null)));
  /** ⚠️ R3b (V103) — le projet d'avis se lit dès la validation de la fiche, avant tout PV ; le refus du serveur est nommé. */
  readonly refusProjet = signal<string | null>(null);

  // ── La modale ──
  readonly ouverte = signal(false);
  readonly preparation = signal(false);
  readonly envoi = signal(false);
  readonly saisie = signal<{ datePublication: string; supports: string }>({ datePublication: '', supports: '' });
  /** ⚠️ V118 — la publication de l'AGPM du plan, citée par l'avis ; `null` : non déposée (ou illisible). */
  readonly journalPlan = signal<PublicationAgpm | null>(null);
  readonly erreurs = signal<Partial<Record<CleSaisie, string>>>({});
  readonly refus = signal<string | null>(null);
  readonly vides = signal<ChampFiche[]>([]);
  /** §B8 — le compte bancaire de l'ARMP n'est pas réglé : l'avis imprimera des pointillés à sa place. */
  readonly compteNonRegle = signal(false);
  /** ⚠️ V118 — seule la date de l'avis est exigée ; sans publication de l'AGPM sur le plan, le serveur refuserait. */
  readonly complete = computed(() => this.saisie().datePublication.trim() !== '' && this.journalPlan() !== null);
  readonly occupe = signal(false);

  readonly jj = jjmmaaaa;
  readonly horodatage = horodatage;

  ngOnInit(): void {
    this.charger();
  }

  /** Disponibilité et avis déjà produits, en une seule vague. Un refus de lecture tait l'encart. */
  private charger(): void {
    const id = this.idDmc();
    const demande = this.ouvrirDEmblee();
    forkJoin({
      etat: this.fiches.disponibiliteAvis(id).pipe(catchError(() => of(null))),
      docs: this.fiches.documents(id).pipe(catchError(() => of([] as DocumentFiche[]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ etat, docs }) => {
        this.etat.set(etat);
        this.documents.set(docs);
        if (demande) {
          if (etat?.disponible && !this.lecture()) this.ouvrir();
          this.ouvertureTraitee.emit();
        }
      });
  }

  /**
   * Ouvre la modale : les informations de la dernière impression sont reprises (une réimpression après correction
   * garde sa publication), et la fiche est relue pour prévenir des informations vides que l'avis imprimerait en
   * pointillés.
   */
  ouvrir(): void {
    const dernier = this.imprimes()[0]?.publication;
    this.saisie.set({ datePublication: dernier?.datePublication ?? '', supports: dernier?.supports ?? '' });
    this.journalPlan.set(null);
    this.erreurs.set({});
    this.refus.set(null);
    this.vides.set([]);
    this.ouverte.set(true);
    this.preparation.set(true);
    this.compteNonRegle.set(false);
    // Une seule vague : les champs vides de la fiche, le compte bancaire de l'ARMP (§B8 : non réglé = pointillés), et (V118) la
    // publication de l'AGPM du plan, lue depuis le dossier soumis.
    const idDossier = this.etat()?.idDossierSoumis ?? null;
    forkJoin({
      journal: idDossier == null ? of(null) : this.dossiers.publicationAgpm(idDossier).pipe(catchError(() => of(null))),
      vides: this.fiches.lire(this.idDmc()).pipe(
        switchMap((f) =>
          this.referentiel.referentiel(f.typeMarche ?? undefined, f.categorie ?? null).pipe(
            map((r) => champsVidesAvis(r.champs, f.valeurs ?? {}, f.cadrage ?? {}, f.nbLots ?? 0, f.saisieParLot === true)),
          ),
        ),
        catchError(() => of([] as ChampFiche[])),
      ),
      compte: this.compte.lire().pipe(catchError(() => of(null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ journal, vides, compte }) => {
        this.journalPlan.set(journal);
        this.vides.set(vides);
        this.compteNonRegle.set(!!compte && !(compte.banque && compte.titulaire && compte.numeroCompte));
        this.preparation.set(false);
      });
  }

  fermer(): void {
    if (this.envoi()) return;
    this.ouverte.set(false);
  }

  poser(cle: CleSaisie, valeur: string): void {
    this.saisie.update((s) => ({ ...s, [cle]: valeur }));
    if (this.erreurs()[cle]) this.erreurs.update((e) => ({ ...e, [cle]: undefined }));
  }

  imprimer(): void {
    if (this.envoi() || !this.complete()) return;
    this.envoi.set(true);
    this.refus.set(null);
    const corps: PublicationAvis = {
      datePublication: this.saisie().datePublication.trim(),
      supports: this.saisie().supports.trim(),
    };
    this.fiches
      .imprimerAvis(this.idDmc(), corps)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (produits) => {
          this.envoi.set(false);
          this.ouverte.set(false);
          this.documents.update((d) => [...produits, ...d]);
          this.etat.update((e) => (e && e.daoComplet === 'A_ASSEMBLER' ? { ...e, daoComplet: 'PRODUIT' } : e));
          this.toast.success('Avis spécifique imprimé : il est en tête de la liste, en PDF et en Word.');
        },
        error: (e: ApiError | HttpErrorResponse) => {
          this.envoi.set(false);
          const parChamp = erreursParChamp(e);
          if (e.status === 400 && parChamp.size) {
            this.erreurs.set(Object.fromEntries(parChamp) as Partial<Record<CleSaisie, string>>);
            return;
          }
          if (e.status === 409 && codeErreur(e) === 'AVIS_INDISPONIBLE') {
            // La situation a changé depuis l'ouverture (réserves rouvertes, PV rectifié) : on relit l'état du serveur.
            const raison = corpsErreur<{ details?: { raison?: string } }>(e)?.details?.raison ?? null;
            this.refus.set(messageIndisponible(raison) ?? 'L’avis spécifique n’est plus disponible pour ce dossier.');
            this.charger();
            return;
          }
          // ⚠️ R6a (V106) — le délai de publicité de la loi (30 j, 45 j international, 10 j consultation) bloque l'impression.
          if (e.status === 409 && codeErreur(e) === 'DELAI_PUBLICITE') {
            this.refus.set(messageDelaiPublicite(e));
            return;
          }
          // ⚠️ R9a (V111) — le DAO complet, assemblé à l'impression s'il manque, n'a pas pu l'être.
          if (e.status === 409 && codeErreur(e) === 'DAO_COMPLET_ABSENT') {
            this.refus.set(messageDaoCompletAbsent(e, 'avis'));
            return;
          }
          this.refus.set('L’impression a échoué. Réessayez.');
        },
      });
  }

  /** ⚠️ R3b — le projet d'avis (filigrane « PROJET », sans publication), PDF ouvert ou Word enregistré ; rien n'est écrit côté serveur. */
  projet(format: 'pdf' | 'docx'): void {
    if (this.occupe()) return;
    this.occupe.set(true);
    this.refusProjet.set(null);
    this.fiches.projetAvis(this.idDmc(), format).subscribe({
      next: (blob) => {
        this.occupe.set(false);
        if (format === 'pdf') ouvrirBlobSur(blob);
        else telechargerBlob(blob, `projet-avis-${this.idDmc()}.docx`);
      },
      error: (e: ApiError) => {
        this.occupe.set(false);
        const raison = corpsErreur<{ details?: { raison?: string } }>(e)?.details?.raison ?? null;
        this.refusProjet.set(raison === 'FICHE_NON_VALIDEE' ? 'Le projet d’avis se lit dès qu’une version de la fiche est validée.' : (messageIndisponible(raison) ?? 'Le projet d’avis n’a pas pu être produit.'));
      },
    });
  }

  /** Ouvre (PDF) ou enregistre un avis, toujours par `fichiers-surs` (règle de l'audit). */
  obtenir(d: DocumentFiche, ouvrir: boolean): void {
    if (this.occupe()) return;
    this.occupe.set(true);
    this.fiches.contenuDocument(d.idDocument).subscribe({
      next: (blob) => {
        this.occupe.set(false);
        if (ouvrir) ouvrirBlobSur(blob);
        else telechargerBlob(blob, d.nomFichier);
      },
      error: () => {
        this.occupe.set(false);
        this.toast.error('Avis indisponible — réessayez.');
      },
    });
  }

  format(d: DocumentFiche): string {
    return (d.extension ?? d.nomFichier.split('.').pop() ?? '').toUpperCase();
  }
}
