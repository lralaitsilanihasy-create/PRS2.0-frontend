import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, of } from 'rxjs';

import { ApiError, codeErreur, corpsErreur, erreursParChamp } from '../../core/errors/api-error';
import { ToastService } from '../../core/notifications/toast.service';
import { ouvrirBlobSur, telechargerBlob } from '../../core/securite/fichiers-surs';
import { CandidatInvite, DisponibiliteAvis, DocumentFiche, Preselection, RetenuAmi } from '../../models';
import { AmiService } from '../../services/ami.services';
import { FicheMarcheService } from '../../services/fiche-marche.services';
import { ModaleDirective } from '../a11y/modale.directive';
import { erreurCandidat, horodatage, jjmmaaaa, lettresImprimees, messageIndisponible } from './avis-specifique-modele';

/** Une ligne de la liste restreinte en cours de saisie (`id` : clé de suivi stable). */
interface LigneCandidat extends CandidatInvite {
  id: number;
  erreurNom?: string;
  erreurAdresse?: string;
  erreurEmail?: string;
}

const ERREUR_DE = { nom: 'erreurNom', adresse: 'erreurAdresse', email: 'erreurEmail' } as const;

/**
 * ⚠️ **Lettres d'invitation des prestations intellectuelles** (plan du 01/10, lot AV-4.3 ; demande backend livrée, V57).
 *
 * Le pendant de l'avis spécifique pour une fiche PI : les candidats de la LISTE RESTREINTE reçoivent chacun une lettre.
 * Même déclencheur (PV signé FAV, ou FAVR après la levée des réserves), lu du serveur. La modale saisit la date d'envoi,
 * le lieu et la liste (nom, adresse sur une ou plusieurs lignes), au moins un candidat (Q4) ; une impression produit une
 * paire .pdf/.docx PAR candidat (Q1). La première impression fait passer la ligne « Lancé » (Q5) — c'est le serveur.
 *
 * Posé à côté de l'avis à l'étape 7 de la fiche DAO et dans l'encart « Fiche DAO » de la page du dossier : muet hors
 * prestations intellectuelles (`CATEGORIE_SANS_LETTRE`) et quand le serveur ne répond pas (403, route absente).
 */
@Component({
  selector: 'app-lettres-invitation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ModaleDirective],
  templateUrl: './lettres-invitation.html',
  styleUrl: './avis-specifique.scss',
})
export class LettresInvitation implements OnInit {
  private readonly fiches = inject(FicheMarcheService);
  private readonly amis = inject(AmiService);
  private readonly toast = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);

  readonly idDmc = input.required<number>();
  readonly lecture = input(false);

  readonly etat = signal<DisponibiliteAvis | null>(null);
  readonly documents = signal<DocumentFiche[]>([]);
  /** ⚠️ AMI-b — la liste restreinte définitive de l'AMI, s'il y en a une : elle remplace la saisie. */
  readonly listeAmi = signal<RetenuAmi[] | null>(null);
  readonly nombreLettres = computed(() => this.listeAmi()?.length ?? this.candidats().length);
  readonly imprimees = computed(() => lettresImprimees(this.documents()));
  readonly visible = computed(() => {
    const e = this.etat();
    return !!e && e.raison !== 'CATEGORIE_SANS_LETTRE';
  });
  readonly attente = computed(() => (this.etat()?.disponible ? null : messageIndisponible(this.etat()?.raison ?? null)));

  // ── La modale ──
  readonly ouverte = signal(false);
  readonly envoi = signal(false);
  readonly dateEnvoi = signal('');
  readonly lieu = signal('');
  readonly candidats = signal<LigneCandidat[]>([]);
  readonly erreurs = signal<{ dateEnvoi?: string; lieu?: string; candidats?: string }>({});
  readonly refus = signal<string | null>(null);
  readonly occupe = signal(false);
  private prochainId = 1;

  readonly complete = computed(
    () => this.dateEnvoi().trim() !== '' && this.lieu().trim() !== ''
      && (!!this.listeAmi() || (this.candidats().length > 0 && this.candidats().every((c) => c.nom.trim() !== '' && c.adresse.trim() !== ''))),
  );

  readonly jj = jjmmaaaa;
  readonly horodatage = horodatage;

  ngOnInit(): void {
    this.charger();
  }

  private charger(): void {
    const id = this.idDmc();
    forkJoin({
      etat: this.fiches.disponibiliteLettres(id).pipe(catchError(() => of(null))),
      docs: this.fiches.documents(id).pipe(catchError(() => of([] as DocumentFiche[]))),
      // Sans AMI publié (404), ou dispensé : la saisie, comme avant.
      preselection: this.amis.preselection(id).pipe(catchError(() => of(null as Preselection | null))),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ etat, docs, preselection }) => {
        this.etat.set(etat);
        this.documents.set(docs);
        this.listeAmi.set(preselection?.etat === 'DEFINITIVE' && preselection.liste.length ? preselection.liste : null);
      });
  }

  /** La saisie de la dernière impression est reprise : une réimpression après correction garde sa liste. */
  ouvrir(): void {
    const dernier = this.imprimees()[0]?.publication;
    this.dateEnvoi.set(dernier?.dateEnvoi ?? '');
    this.lieu.set(dernier?.lieu ?? '');
    const liste = dernier?.candidats?.length ? dernier.candidats : [{ nom: '', adresse: '' }];
    this.candidats.set(liste.map((c) => ({ id: this.prochainId++, nom: c.nom, adresse: c.adresse, email: c.email ?? '' })));
    this.erreurs.set({});
    this.refus.set(null);
    this.ouverte.set(true);
  }

  fermer(): void {
    if (this.envoi()) return;
    this.ouverte.set(false);
  }

  ajouterCandidat(): void {
    this.candidats.update((l) => [...l, { id: this.prochainId++, nom: '', adresse: '', email: '' }]);
    if (this.erreurs().candidats) this.erreurs.update((e) => ({ ...e, candidats: undefined }));
  }

  retirerCandidat(id: number): void {
    if (this.candidats().length <= 1) return;
    this.candidats.update((l) => l.filter((c) => c.id !== id));
  }

  poserCandidat(id: number, champ: 'nom' | 'adresse' | 'email', valeur: string): void {
    this.candidats.update((l) => l.map((c) => (c.id === id ? { ...c, [champ]: valeur, [ERREUR_DE[champ]]: undefined } : c)));
  }

  poser(champ: 'dateEnvoi' | 'lieu', valeur: string): void {
    (champ === 'dateEnvoi' ? this.dateEnvoi : this.lieu).set(valeur);
    if (this.erreurs()[champ]) this.erreurs.update((e) => ({ ...e, [champ]: undefined }));
  }

  imprimer(): void {
    if (this.envoi() || !this.complete()) return;
    this.envoi.set(true);
    this.refus.set(null);
    const corps = {
      dateEnvoi: this.dateEnvoi().trim(),
      lieu: this.lieu().trim(),
      // ⚠️ PI-a (V84) — l'adresse électronique est facultative : vide, elle part nulle.
      candidats: this.listeAmi() ? [] : this.candidats().map((c) => ({ nom: c.nom.trim(), adresse: c.adresse.trim(), email: c.email?.trim() || null })),
    };
    this.fiches
      .imprimerLettres(this.idDmc(), corps)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (produits) => {
          this.envoi.set(false);
          this.ouverte.set(false);
          this.documents.update((d) => [...produits, ...d]);
          const n = this.listeAmi()?.length ?? corps.candidats.length;
          this.toast.success(`${n} lettre${n > 1 ? 's' : ''} d’invitation imprimée${n > 1 ? 's' : ''} : en tête de la liste, en PDF et en Word.`);
        },
        error: (e: ApiError | HttpErrorResponse) => {
          this.envoi.set(false);
          const parChamp = erreursParChamp(e);
          if (e.status === 400 && parChamp.size) {
            const generales: { dateEnvoi?: string; lieu?: string; candidats?: string } = {};
            const parRang = new Map<number, { nom?: string; adresse?: string; email?: string }>();
            for (const [cle, message] of parChamp) {
              const c = erreurCandidat(cle);
              if (c) parRang.set(c.rang, { ...parRang.get(c.rang), [c.champ]: message });
              else if (cle === 'dateEnvoi' || cle === 'lieu' || cle === 'candidats') generales[cle] = message;
            }
            this.erreurs.set(generales);
            this.candidats.update((l) => l.map((c, i) => ({ ...c, erreurNom: parRang.get(i + 1)?.nom, erreurAdresse: parRang.get(i + 1)?.adresse, erreurEmail: parRang.get(i + 1)?.email })));
            return;
          }
          if (e.status === 409 && codeErreur(e) === 'LETTRE_INDISPONIBLE') {
            const raison = corpsErreur<{ details?: { raison?: string } }>(e)?.details?.raison ?? null;
            this.refus.set(messageIndisponible(raison) ?? 'Les lettres d’invitation ne sont plus disponibles pour ce dossier.');
            this.charger();
            return;
          }
          this.refus.set('L’impression a échoué. Réessayez.');
        },
      });
  }

  /** Ouvre (PDF) ou enregistre une lettre, toujours par `fichiers-surs` (règle de l'audit). */
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
        this.toast.error('Lettre indisponible — réessayez.');
      },
    });
  }

  format(d: DocumentFiche): string {
    return (d.extension ?? d.nomFichier.split('.').pop() ?? '').toUpperCase();
  }
}
