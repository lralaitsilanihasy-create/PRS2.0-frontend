import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { ApiError, codeErreur, corpsErreur, erreursParChamp } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur, telechargerBlob } from '../../core/securite/fichiers-surs';
import { ChampFiche, DisponibiliteAvis, DocumentFiche, PublicationAvis } from '../../models';
import { ChampFicheMarcheService, FicheMarcheService } from '../../services/fiche-marche.services';
import { ModaleDirective } from '../a11y/modale.directive';
import { avisImprimes, champsVidesAvis, horodatage, jjmmaaaa, messageIndisponible } from './avis-specifique-modele';

type CleSaisie = keyof PublicationAvis;

/**
 * ⚠️ **Avis spécifique d'appel d'offres** (plan du 30/09, lot AV-3 ; demande backend livrée, V56).
 *
 * Une fois l'examen terminé — PV signé FAV, ou FAVR après la levée des réserves —, la PRMP imprime l'avis à publier.
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
  imports: [ModaleDirective],
  templateUrl: './avis-specifique.html',
  styleUrl: './avis-specifique.scss',
})
export class AvisSpecifique implements OnInit {
  private readonly fiches = inject(FicheMarcheService);
  private readonly referentiel = inject(ChampFicheMarcheService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly idDmc = input.required<number>();
  /** Lecture seule (fiche consultée par un autre profil, version figée) : la liste reste, le bouton disparaît. */
  readonly lecture = input(false);

  readonly etat = signal<DisponibiliteAvis | null>(null);
  readonly documents = signal<DocumentFiche[]>([]);
  readonly imprimes = computed(() => avisImprimes(this.documents()));
  readonly visible = computed(() => {
    const e = this.etat();
    return !!e && e.raison !== 'CATEGORIE_SANS_AVIS';
  });
  readonly attente = computed(() => (this.etat()?.disponible ? null : messageIndisponible(this.etat()?.raison ?? null)));

  // ── La modale ──
  readonly ouverte = signal(false);
  readonly preparation = signal(false);
  readonly envoi = signal(false);
  readonly saisie = signal<PublicationAvis>({ datePublication: '', jmpNumero: '', jmpDate: '', supports: '' });
  readonly erreurs = signal<Partial<Record<CleSaisie, string>>>({});
  readonly refus = signal<string | null>(null);
  readonly vides = signal<ChampFiche[]>([]);
  /** ⚠️ 30/09 (§B7.5) — seules les deux dates sont exigées : le numéro du JMP et les supports peuvent rester vides, comme sur l'avis réel. */
  readonly complete = computed(() => this.saisie().datePublication.trim() !== '' && this.saisie().jmpDate.trim() !== '');
  readonly occupe = signal(false);

  readonly jj = jjmmaaaa;
  readonly horodatage = horodatage;

  ngOnInit(): void {
    this.charger();
  }

  /** Disponibilité et avis déjà produits, en une seule vague. Un refus de lecture tait l'encart. */
  private charger(): void {
    const id = this.idDmc();
    forkJoin({
      etat: this.fiches.disponibiliteAvis(id).pipe(catchError(() => of(null))),
      docs: this.fiches.documents(id).pipe(catchError(() => of([] as DocumentFiche[]))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ etat, docs }) => {
        this.etat.set(etat);
        this.documents.set(docs);
      });
  }

  /**
   * Ouvre la modale : les informations de la dernière impression sont reprises (une réimpression après correction
   * garde sa publication), et la fiche est relue pour prévenir des informations vides que l'avis imprimerait en
   * pointillés.
   */
  ouvrir(): void {
    const dernier = this.imprimes()[0]?.publication;
    this.saisie.set(dernier ? { ...dernier } : { datePublication: '', jmpNumero: '', jmpDate: '', supports: '' });
    this.erreurs.set({});
    this.refus.set(null);
    this.vides.set([]);
    this.ouverte.set(true);
    this.preparation.set(true);
    this.fiches
      .lire(this.idDmc())
      .pipe(
        switchMap((f) =>
          this.referentiel.referentiel(f.typeMarche ?? undefined, f.categorie ?? null).pipe(
            map((r) => champsVidesAvis(r.champs, f.valeurs ?? {}, f.cadrage ?? {}, f.nbLots ?? 0, f.saisieParLot === true)),
          ),
        ),
        catchError(() => of([] as ChampFiche[])),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((vides) => {
        this.vides.set(vides);
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
      jmpNumero: this.saisie().jmpNumero.trim(),
      jmpDate: this.saisie().jmpDate.trim(),
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
          this.refus.set('L’impression a échoué. Réessayez.');
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
