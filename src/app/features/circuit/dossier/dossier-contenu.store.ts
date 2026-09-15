import { Injectable, Signal, computed, inject, signal } from '@angular/core';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';

import { AuthService } from '../../../core/auth/auth.service';
import { ActionDossier, Capm, Chronometrage, DiffDossier, Dossier, Marche, MarchePrevision, ModePassation, PieceJointeDossier, Ppm, ServiceBeneficiaire, TypeChangementLigne, VersionArchivee } from '../../../models';
import {
  CapmService,
  CompteService,
  DossierService,
  EntiteContractService,
  LocaliteService,
  MarcheService,
  MarchePrevisionService,
  MiseAJourPpmService,
  ModePassationService,
  NatureService,
  PieceJointeDossierService,
  PpmService,
  ReferenceLookupService,
  ServiceBeneficiaireService,
  SoaBeneficiaireService,
  TypeDossierService,
} from '../../../services';
import { calculerFichePresentation } from '../../../shared/prmp/fiche-presentation';
import { calculerAgpm } from '../../../shared/prmp/agpm';
import { VueVersionArchivee, vueVersionArchivee } from '../version-archivee-vue';

/** Profils admis par le serveur aux lectures du versionnement (`LECTURE_CIRCUIT`, `MiseAJourPpmController`). */
const PROFILS_LECTURE_VERSIONS: readonly string[] = [
  'PRMP',
  'PRESIDENT',
  'CHEF_COMMISSION',
  'SECRETAIRE',
  'MEMBRE',
  'VERIFICATEUR',
  'ASSISTANT_CONTROLEUR',
  'ADMINISTRATEUR',
];

/** Versions archivées du dossier et, s'il a été rectifié, le diff de son dernier cycle. */
interface VersionsEtRectification {
  versionsArchivees: VersionArchivee[];
  diffRectification: DiffDossier | null;
}

/** Statuts où un cycle de rectification a pu avoir lieu (sondage du diff de rectification). */
const STATUTS_RECTIFIABLES: readonly string[] = ['EN_ATTENTE_DECISION_PRMP', 'EN_VERIFICATION', 'OBSERVATIONS_LEVEES', 'DECISION_TRANSMISE_SIGMP', 'CLOTURE'];

/**
 * Contenu d'un dossier en LECTURE SEULE, partagé par les blocs de `features/circuit/dossier/`.
 * Contenu reconstruit via les listes scopées (GET /api/ppms, /api/marches) filtrées par
 * idDossier (1 appel chacun, pas de N+1) ; libellés via référentiels en cache. Aucune action.
 *
 * `@Injectable()` sans `providedIn` : le composant HÔTE le fournit (`providers`), une instance par
 * dossier affiché ; les blocs l'injectent. L'hôte appelle `charger()` une fois, dans son `ngOnInit`.
 * Découpé de `DossierConsultation` (lot L4-F1) sans rien changer : mêmes requêtes, même vague.
 */
@Injectable()
export class DossierContenuStore {
  private readonly ppmService = inject(PpmService);
  private readonly modeService = inject(ModePassationService);
  private readonly capmService = inject(CapmService);
  private readonly miseAJourService = inject(MiseAJourPpmService);
  private readonly marcheService = inject(MarcheService);
  private readonly serviceBenefService = inject(ServiceBeneficiaireService);
  private readonly previsionService = inject(MarchePrevisionService);
  private readonly pieceService = inject(PieceJointeDossierService);
  private readonly dossierService = inject(DossierService);
  private readonly lookups = inject(ReferenceLookupService);
  private readonly auth = inject(AuthService);

  /** Le dossier affiché : le signal de l'hôte (une entrée), lu tel quel — il reste réactif. */
  private readonly source = signal<Signal<Dossier> | null>(null);
  readonly dossier = computed<Dossier>(() => {
    const source = this.source();
    if (!source) {
      throw new Error('DossierContenuStore : charger() doit précéder toute lecture du dossier.');
    }
    return source();
  });

  /** Le chronométrage a-t-il quelque chose à montrer ? (conditionne son bouton dans la bande) */
  readonly chronoDispo = computed(() => {
    const c = this.chronoDossier();
    return !!c && !!(c.etapes.length || c.etapeCourante || c.datePrevisionnelleFin || c.debutCompteur);
  });
  /**
   * ⚠️ Demande pilote (2026-09-06) — chronométrage et journal sont des restitutions INTERNES CNM :
   * masquées pour la PRMP et son UGPM (leur suivi des dates vit sur « Suivi des dossiers CNM »).
   */
  readonly restitutionsVisibles = computed(() => !['PRMP', 'UGPM'].includes(this.auth.role() ?? ''));

  /** La référence PPM interne (ex. « 00018/MLF/PPM/2026 ») n'est montrée qu'aux profils PRMP, UGPM et Secrétaire. */
  readonly montrerReferencePpm = computed(() => ['PRMP', 'UGPM', 'SECRETAIRE'].includes(this.auth.role() ?? ''));

  /**
   * Lecture du versionnement (diff de mise à jour, diff de rectification, versions archivées) : seuls
   * les profils que le serveur y admet (`LECTURE_CIRCUIT` de `MiseAJourPpmController`). L'UGPM et le
   * Chargé de publication en sont exclus : les leur demander ne produisait qu'un 403 muet à chaque
   * ouverture (lot L4-F2, plan §8.2). Le rendu ne change pas : ces réponses ne leur montraient rien.
   */
  readonly lectureVersionsPermise = computed(() => PROFILS_LECTURE_VERSIONS.includes(this.auth.role() ?? ''));

  /**
   * ⚠️ Demande pilote (2026-09-12) — l'historique des versions (cycles de RECTIFICATION du dossier) est
   * réservé au **Vérificateur SEULEMENT** : c'est son outil pour suivre comment le plan a été corrigé au
   * fil des observations. Masqué pour tous les autres profils. Onglet (et contenu) visibles seulement s'il
   * y a ≥1 version archivée ET que le rôle est VÉRIFICATEUR.
   */
  readonly historiqueVersionsVisible = computed(
    () => this.versionsArchivees().length > 0 && this.auth.role() === 'VERIFICATEUR',
  );

  readonly ppm = signal<Ppm | null>(null);
  /** Versionnement : idDetail → type de changement vs la version précédente (surlignage du tableau). */
  readonly changements = signal<Map<number, TypeChangementLigne> | null>(null);
  /** Titre de la légende du surlignage (« Mise à jour : » ou « Rectification : » selon la source). */
  readonly legendeChangements = signal('Mise à jour :');
  /** idDetail → détail humain « champ : avant → après ; … » (infobulle des lignes surlignées). */
  readonly detailsChangements = signal<Map<number, string> | null>(null);
  /** Le diff de rectification a été appliqué — il prime sur le diff de versions (course des sondages). */
  private diffRectifApplique = false;

  /** Applique un diff (versions OU rectification) au tableau : types par ligne + infobulles de détail. */
  private appliquerDiff(diff: DiffDossier, legende: string): void {
    const types = new Map<number, TypeChangementLigne>();
    const details = new Map<number, string>();
    for (const l of diff.lignes) {
      if (l.idDetail == null) continue;
      types.set(l.idDetail, l.type);
      if (l.champs?.length) {
        details.set(l.idDetail, l.champs.map((c) => `${c.champ} : ${c.avant ?? '—'} → ${c.apres ?? '—'}`).join(' ; '));
      }
    }
    this.changements.set(types);
    this.detailsChangements.set(details);
    this.legendeChangements.set(legende);
  }
  /** Journal MÉTIER des actions (spec « Mandats PRMP ») — vide si le backend ne le sert pas encore. */
  readonly journal = signal<ActionDossier[]>([]);
  /**
   * ⚠️ Demande pilote (2026-09-13) — le JOURNAL DES ACTIONS n'est PLUS filtré par profil : tous les
   * profils voient le journal complet (constat : le Membre ne voyait que 3 lignes — Création,
   * Soumission, Réception — les dispatch/réattributions rang 5 lui étaient masqués, alors que le
   * chronométrage, lui, tracait bien tous les passages). REMPLACE la visibilité hiérarchique du
   * 2026-09-04 sur le journal. (Le chronométrage conserve sa propre règle, cf. `tacheChronoVisiblePour`.)
   */
  readonly journalVisible = computed(() => this.journal());
  /** Chronométrage du dossier (2026-09-01) — `null` si le backend ne le sert pas (section masquée). */
  readonly chronoDossier = signal<Chronometrage | null>(null);

  // ── Historique des versions (⚠️ demande pilote 2026-09-06, backend 6d9ba29) ──
  /**
   * Versions ARCHIVÉES du dossier (`GET /dossiers/{id}/versions-archivees`) : la version remplacée à
   * chaque cycle de rectification. Chargées DANS la vague, en silence : vide = jamais rectifié (ou
   * hors périmètre), l'onglet n'apparaît pas. La version courante n'en fait pas partie.
   */
  readonly versionsArchivees = signal<VersionArchivee[]>([]);
  /** La plus récente en tête — même sens de lecture que la chaîne des mises à jour et le journal. */
  readonly versionsArchiveesRecentesDAbord = computed(() => [...this.versionsArchivees()].sort((a, b) => b.numero - a.numero));
  /**
   * ⚠️ 2026-09-08 (constat pilote) — la version COURANTE est l'état PRODUIT par la DERNIÈRE
   * rectification : sa date et son auteur sont ceux de la version archivée la plus récente (le geste
   * qui a remplacé la précédente et créé la courante). `null` si le dossier n'a jamais été rectifié.
   */
  readonly derniereRectification = computed(() => this.versionsArchiveesRecentesDAbord()[0] ?? null);
  /*
   * La version affichée et son sous-onglet vivent ici, pas dans le bloc `DossierVersions` : le bloc est
   * démonté dès qu'on quitte l'onglet Historique, et la sélection doit survivre à l'aller-retour.
   */
  /** Numéro de la version archivée affichée dans l'onglet ; `null` = la version courante (le dossier). */
  readonly versionAffichee = signal<number | null>(null);
  readonly versionChargement = signal(false);
  readonly versionErreur = signal(false);
  /** Contenu de la version archivée affichée, projeté pour le tableau partagé. */
  readonly versionVue = signal<VueVersionArchivee | null>(null);
  /** Une version archivée est immuable : chargée une fois, gardée pour la durée de la consultation. */
  private readonly versionsChargees = new Map<number, VueVersionArchivee>();
  /**
   * ⚠️ Demande pilote (2026-09-06) — COMPOSANTES de la version archivée : sous-onglet actif
   * (plan / fiche / AGPM) et documents DÉRIVÉS des lignes figées, par les mêmes fonctions pures
   * que le dossier courant. Rouvert sur le plan à chaque changement de version.
   */
  readonly ongletVersion = signal<'plan' | 'fiche' | 'agpm'>('plan');
  readonly ficheVersion = computed(() => {
    const vue = this.versionVue();
    return vue ? calculerFichePresentation(vue.marches, vue.previsions, this.modesRef(), this.capmsRef()) : null;
  });
  readonly agpmVersion = computed(() => {
    const vue = this.versionVue();
    return vue
      ? calculerAgpm(
          vue.marches,
          vue.previsions,
          this.modesRef(),
          this.capmsRef(),
          new Map([...this.natureMap()].map(([k, v]) => [Number(k), v])),
        )
      : [];
  });

  /** Sélecteur de version (change) : « courante » → version du dossier, sinon la version archivée choisie. */
  choisirVersion(val: string): void {
    if (val === 'courante') {
      this.afficherVersionCourante();
      return;
    }
    const num = Number(val);
    const v = this.versionsArchivees().find((x) => x.numero === num);
    if (v) this.afficherVersion(v);
  }

  afficherVersionCourante(): void {
    this.versionAffichee.set(null);
    this.versionVue.set(null);
    this.versionErreur.set(false);
    this.versionChargement.set(false);
    this.ongletVersion.set('plan');
  }

  /** Affiche une version archivée : depuis le cache si déjà lue, sinon un GET (indicateur + reprise). */
  afficherVersion(v: VersionArchivee): void {
    this.versionAffichee.set(v.numero);
    this.versionErreur.set(false);
    this.ongletVersion.set('plan');
    const connue = this.versionsChargees.get(v.numero);
    if (connue) {
      this.versionVue.set(connue);
      this.versionChargement.set(false);
      return;
    }
    this.versionVue.set(null);
    this.versionChargement.set(true);
    this.miseAJourService.versionArchivee(this.dossier().idDossier, v.numero).subscribe({
      next: (detail) => {
        const vue = vueVersionArchivee(detail, this.dossier().idDossier, this.ppm()?.idPpm ?? 0);
        this.versionsChargees.set(v.numero, vue);
        // L'utilisateur a pu cliquer ailleurs pendant la lecture : ne pas écraser sa sélection.
        if (this.versionAffichee() === v.numero) {
          this.versionVue.set(vue);
          this.versionChargement.set(false);
        }
      },
      error: () => {
        if (this.versionAffichee() === v.numero) {
          this.versionChargement.set(false);
          this.versionErreur.set(true);
        }
      },
    });
  }

  reessayerVersion(): void {
    const numero = this.versionAffichee();
    const v = numero == null ? undefined : this.versionsArchivees().find((x) => x.numero === numero);
    if (v) this.afficherVersion(v);
  }

  /** Référentiels COMPLETS des calculs dérivés (les lookups ne portent que des libellés). */
  private readonly modesRef = signal<ModePassation[]>([]);
  private readonly capmsRef = signal<Capm[]>([]);
  /** Documents dérivés — mêmes fonctions pures que le détail PPM, l'examen et l'aperçu. */
  readonly ficheDoc = computed(() =>
    calculerFichePresentation(this.marches(), this.previsions(), this.modesRef(), this.capmsRef()),
  );
  readonly agpmDoc = computed(() =>
    calculerAgpm(
      this.marches(),
      this.previsions(),
      this.modesRef(),
      this.capmsRef(),
      new Map([...this.natureMap()].map(([k, v]) => [Number(k), v])),
    ),
  );
  readonly libelleVersionFiche = computed(() => {
    const n = this.ppm()?.numMaj ?? 0;
    return n > 0 ? `Mise à jour n° ${n}` : 'Initial';
  });
  readonly marches = signal<Marche[]>([]);
  readonly pieces = signal<PieceJointeDossier[]>([]);
  /** Une seule vague de rendu : le corps s'affiche quand TOUT est chargé (données + référentiels). */
  readonly loading = signal(true);
  private readonly modeMap = signal<Map<string, string>>(new Map());
  private readonly natureMap = signal<Map<string, string>>(new Map());
  private readonly typeMap = signal<Map<string, string>>(new Map());
  private readonly localiteMap = signal<Map<string, string>>(new Map());
  private readonly entiteMap = signal<Map<string, string>>(new Map());
  /** Services bénéficiaires des marchés du dossier (lecture seule), passés au tableau partagé. */
  readonly serviceBenefs = signal<ServiceBeneficiaire[]>([]);
  private readonly soaMap = signal<Map<string, string>>(new Map());
  private readonly compteMap = signal<Map<string, string>>(new Map());
  /** idDetail → ses services bénéficiaires. */
  private readonly benefParDetail = computed(() => {
    const map = new Map<number, ServiceBeneficiaire[]>();
    for (const b of this.serviceBenefs()) {
      const list = map.get(b.idDetail) ?? [];
      list.push(b);
      map.set(b.idDetail, list);
    }
    return map;
  });
  /** Dates prévisionnelles des marchés du dossier (lecture seule), passées au tableau partagé. */
  readonly previsions = signal<MarchePrevision[]>([]);
  private readonly capmMap = signal<Map<string, string>>(new Map());
  /** idDetail → ses dates prévisionnelles (triées par ordre CAPM). */
  private readonly prevParDetail = computed(() => {
    const map = new Map<number, MarchePrevision[]>();
    for (const p of this.previsions()) {
      const list = map.get(p.idDetail) ?? [];
      list.push(p);
      map.set(p.idDetail, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => (a.ordre ?? 0) - (b.ordre ?? 0));
    }
    return map;
  });

  readonly estPpm = computed(() => this.dossier().idTypeDossier === 'DDP');
  readonly typeLabel = computed(() => {
    const id = this.dossier().idTypeDossier;
    return id ? this.typeMap().get(id) ?? id : '—';
  });
  readonly localiteLabel = computed(() => {
    const id = this.dossier().idLocalite;
    return id ? this.localiteMap().get(id) ?? id : '—';
  });
  readonly entiteLabel = computed(() => {
    const id = this.dossier().idEntiteContract;
    return id != null ? this.entiteMap().get(String(id)) ?? '#' + id : '—';
  });

  /** Lance la vague unique pour le dossier de l'hôte (appelé une fois, dans son `ngOnInit`). */
  charger(dossier: Signal<Dossier>): void {
    this.source.set(dossier);
    const id = this.dossier().idDossier;
    const lectureVersions = this.lectureVersionsPermise();
    // Dossier issu d'une mise à jour → diff vs version précédente pour surligner les lignes changées.
    // Appel SILENCIEUX (hors vague principale) : 403/409 → pas de surlignage, l'affichage reste complet.
    // Pas demandé aux profils que le serveur refuse (UGPM : 403 assuré).
    if (this.dossier().idDossierParent != null && lectureVersions) {
      this.miseAJourService.diff(id, true).subscribe({
        // Le diff de RECTIFICATION prime (changement le plus récent) : ne pas l'écraser si les deux
        // sondages répondent (ordre d'arrivée non garanti).
        next: (diff) => {
          if (!this.diffRectifApplique) this.appliquerDiff(diff, 'Mise à jour :');
        },
        error: () => {},
      });
    }
    // UNE SEULE VAGUE : données + référentiels joints dans un même forkJoin — le corps ne s'affiche
    // qu'une fois complet (pas de spinners successifs, pas de libellés qui « clignotent »). Chaque
    // source de données est tolérante à l'échec (of(...)) : le toast centralisé signale l'erreur,
    // le reste du modal s'affiche quand même. Les lookups (shareReplay) sont mis en cache : les
    // rouvrir — ou le tableau partagé qui les redemande — les résout alors de façon synchrone.
    // ⚠️ Audit 2026-09-14 (C2) — journal et chronométrage sont des vues INTERNES CNM : pour la PRMP et
    // son UGPM, on ne les DEMANDE pas (le serveur répond 403 au journal et sert un chronométrage sans
    // acteurs) au lieu de les charger pour les masquer ensuite.
    const restitutions = this.restitutionsVisibles();
    const commun = {
      typeMap: this.lookups.lookup(TypeDossierService, 'idTypeDossier', ['libelleType']).pipe(catchError(() => of(new Map<string, string>()))),
      localiteMap: this.lookups.lookup(LocaliteService, 'idLocalite', ['libelleLocalite']).pipe(catchError(() => of(new Map<string, string>()))),
      entiteMap: this.lookups.lookup(EntiteContractService, 'idEntiteContract', ['libelleEntite']).pipe(catchError(() => of(new Map<string, string>()))),
      // Pièces jointes du dossier (tous types) — GET /api/piece-jointe-dossiers?dossier={id}.
      pieces: this.pieceService.getByDossier(id).pipe(catchError(() => of([] as PieceJointeDossier[]))),
      // ⚠️ Journal des actions (spec « Mandats PRMP ») : DANS la vague. Chargé à part, sa section
      // s'ajoutait après coup et faisait grandir le panneau déjà affiché (+52 px mesurés) — le
      // mouvement se superposait à l'animation d'ouverture, d'où une entrée « brusque ».
      // Silencieux : un dossier sans journal (ou un backend antérieur) n'affiche pas la section.
      journal: restitutions
        ? this.dossierService.journal(id).pipe(catchError(() => of([] as ActionDossier[])))
        : of([] as ActionDossier[]),
      // Chronométrage (2026-09-01) : DANS la vague, silencieux — un échec cache la section, sans dialogue.
      chrono: restitutions
        ? this.dossierService.chronometrage(id, true).pipe(catchError(() => of(null as Chronometrage | null)))
        : of(null as Chronometrage | null),
    };
    if (!this.estPpm()) {
      forkJoin(commun).subscribe(({ typeMap, localiteMap, entiteMap, pieces, journal, chrono }) => {
        this.typeMap.set(typeMap);
        this.localiteMap.set(localiteMap);
        this.entiteMap.set(entiteMap);
        this.pieces.set(pieces);
        this.journal.set(journal);
        this.chronoDossier.set(chrono);
        this.loading.set(false);
      });
      return;
    }
    forkJoin({
      ...commun,
      modeMap: this.lookups.lookup(ModePassationService, 'idMode', ['libelle']).pipe(catchError(() => of(new Map<string, string>()))),
      soaMap: this.lookups.lookup(SoaBeneficiaireService, 'soaCode', ['libelle']).pipe(catchError(() => of(new Map<string, string>()))),
      compteMap: this.lookups.lookup(CompteService, 'numCompte', ['libelle']).pipe(catchError(() => of(new Map<string, string>()))),
      capmMap: this.lookups.lookup(CapmService, 'idCapm', ['libelleProcessus']).pipe(catchError(() => of(new Map<string, string>()))),
      // Natures : utilisées par le tableau partagé — préchargées ici pour que son premier rendu soit complet.
      natureMap: this.lookups.lookup(NatureService, 'idNature', ['libelle']).pipe(catchError(() => of(new Map<string, string>()))),
      // Référentiels COMPLETS des documents dérivés (onglets fiche / AGPM, 2026-09-03).
      modesRef: this.modeService.list().pipe(catchError(() => of([] as ModePassation[]))),
      capmsRef: this.capmService.list().pipe(catchError(() => of([] as Capm[]))),
      ppms: this.ppmService.list().pipe(catchError(() => of([] as Ppm[]))),
      marches: this.marcheService.list().pipe(catchError(() => of([] as Marche[]))),
      benefs: this.serviceBenefService.list().pipe(catchError(() => of([] as ServiceBeneficiaire[]))),
      previsions: this.previsionService.list().pipe(catchError(() => of([] as MarchePrevision[]))),
      // ⚠️ Historique des versions (2026-09-06) : DANS la vague, silencieux — vide si jamais rectifié
      // ou hors périmètre (403), l'onglet n'apparaît alors pas. Le contenu d'une version se lit à la demande.
      // Pas demandé aux profils que le serveur refuse (UGPM) : l'onglet leur est de toute façon masqué.
      // ⚠️ 2026-08-15 — phase de vérification : diff du DERNIER cycle de RECTIFICATION (état
      // pré-correction figé au premier PUT saisies/ppm → état courant), pour que le vérificateur (et
      // tout profil qui consulte) voie ce que la PRMP a changé ; il PRIME sur le diff de versions
      // (changement le plus récent). Le serveur le calcule contre la dernière version archivée
      // d'origine RECTIFICATION et répond 409 sans elle : il n'est donc demandé qu'APRÈS les versions
      // archivées, et seulement si l'une d'elles est une rectification (lot L4-F2 : plus de 409 muet à
      // chaque ouverture d'un dossier jamais rectifié). Toujours DANS la vague : pas de surlignage tardif.
      versions: lectureVersions
        ? this.miseAJourService.versionsArchivees(id, true).pipe(
            catchError(() => of([] as VersionArchivee[])),
            switchMap((versionsArchivees) =>
              STATUTS_RECTIFIABLES.includes(this.dossier().statut ?? '') && versionsArchivees.some((v) => v.origine === 'RECTIFICATION')
                ? this.miseAJourService.diffRectification(id, true).pipe(
                    map((diffRectification): VersionsEtRectification => ({ versionsArchivees, diffRectification })),
                    catchError(() => of<VersionsEtRectification>({ versionsArchivees, diffRectification: null })),
                  )
                : of<VersionsEtRectification>({ versionsArchivees, diffRectification: null }),
            ),
          )
        : of<VersionsEtRectification>({ versionsArchivees: [], diffRectification: null }),
    }).subscribe(({ typeMap, localiteMap, entiteMap, pieces, journal, chrono, modeMap, natureMap, modesRef, capmsRef, soaMap, compteMap, capmMap, ppms, marches, benefs, previsions, versions }) => {
      this.versionsArchivees.set(versions.versionsArchivees);
      const diffRectif = versions.diffRectification;
      if (diffRectif && diffRectif.lignes.some((l) => l.type !== 'INCHANGEE')) {
        this.diffRectifApplique = true;
        this.appliquerDiff(diffRectif, 'Rectification :');
      }
      this.typeMap.set(typeMap);
      this.localiteMap.set(localiteMap);
      this.entiteMap.set(entiteMap);
      this.pieces.set(pieces);
      this.journal.set(journal);
      this.chronoDossier.set(chrono);
      this.modeMap.set(modeMap);
      this.natureMap.set(natureMap);
      this.modesRef.set(modesRef);
      this.capmsRef.set(capmsRef);
      this.soaMap.set(soaMap);
      this.compteMap.set(compteMap);
      this.capmMap.set(capmMap);
      this.ppm.set(ppms.find((p) => p.idDossier === id) ?? null);
      const mine = marches.filter((m) => m.idDossier === id);
      this.marches.set(mine);
      // Bénéficiaires + dates : ne garder que ceux des marchés du dossier (pas de filtre par dossier côté API).
      const detailIds = new Set(mine.map((m) => m.idDetail));
      this.serviceBenefs.set(benefs.filter((b) => detailIds.has(b.idDetail)));
      this.previsions.set(previsions.filter((p) => detailIds.has(p.idDetail)));
      this.loading.set(false);
    });
  }

  /*
   * Libellés unitaires ci-dessous : plus appelés par aucun gabarit depuis que le plan passe par le
   * tableau partagé (`PpmMarchesTable`). Déplacés tels quels au découpage (L4-F1), sans les retirer :
   * les référentiels qu'ils lisent restent dans la vague, qui ne change pas.
   */
  modeLabel(id?: number): string {
    return id === null || id === undefined ? '—' : this.modeMap().get(String(id)) ?? `#${id}`;
  }
  montant(v?: number): string {
    return v === null || v === undefined ? '—' : new Intl.NumberFormat('fr-FR').format(v);
  }
  /** Services bénéficiaires d'un marché (lecture seule). */
  benefsDe(idDetail: number): ServiceBeneficiaire[] {
    return this.benefParDetail().get(idDetail) ?? [];
  }
  /** Libellé du service bénéficiaire (code SOA + libellé si connu). */
  soaLabel(code?: string): string {
    if (!code) return '—';
    const lib = this.soaMap().get(code);
    return lib ? `${code} · ${lib}` : code;
  }
  /** Libellé du compte budgétaire (numéro + libellé si connu). */
  compteLabel(num?: string): string {
    if (!num) return '—';
    const lib = this.compteMap().get(num);
    return lib ? `${num} · ${lib}` : num;
  }
  /** Dates prévisionnelles d'un marché (triées par ordre CAPM). */
  datesDe(idDetail: number): MarchePrevision[] {
    return this.prevParDetail().get(idDetail) ?? [];
  }
  /** Libellé du processus CAPM (LANCEMENT / OUVERTURE / ATTRIBUTION…). */
  capmLabel(id?: number): string {
    return id === null || id === undefined ? '—' : this.capmMap().get(String(id)) ?? `#${id}`;
  }
}
