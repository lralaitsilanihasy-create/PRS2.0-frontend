import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { horodatage, jjmmaaaa } from '../../../shared/prmp/avis-specifique-modele';

/**
 * ⚠️ 18/10 (pilote, « revoir le contenu des onglets », puis « retirer ce qui n'est pas pertinent ») — les vues dédiées des écrans
 * figés de la procédure : la ligne du plan, l'avis et les lettres, la commission (CAO). Elles ne gardent que ce que la Commission
 * contrôle sur un DAO ; identifiants internes, états toujours identiques à la soumission et historiques sont écartés. La trace
 * complète reste l'instantané serveur (empreinte) et son export PDF. Fonctions pures exportées pour les tests.
 */

type Json = Record<string, unknown>;
const texte = (v: unknown): string => (v === null || v === undefined || v === '' ? '' : String(v));

/** « code (montant) ; code (montant) » → rangées. */
export function beneficiairesFiges(s: string): { code: string; montant: string }[] {
  return s.split(' ; ').map((x) => x.trim()).filter(Boolean).map((x) => {
    const m = /^(.*?)\s*\(([^)]*)\)\s*$/.exec(x);
    return m ? { code: m[1], montant: m[2] } : { code: x, montant: '' };
  });
}

/** « étape : date ; étape : date » → rangées (la date est après le DERNIER « : », les libellés en contiennent). */
export function etapesFigees(s: string): { etape: string; date: string }[] {
  return s.split(' ; ').map((x) => x.trim()).filter(Boolean).map((x) => {
    const i = x.lastIndexOf(' : ');
    if (i < 0) return { etape: x, date: '' };
    const d = x.slice(i + 3).trim();
    return { etape: x.slice(0, i), date: /^\d{4}-\d{2}-\d{2}$/.test(d) ? jjmmaaaa(d) : d };
  });
}

/**
 * Les étapes du calendrier qui concernent le DAO, dans l'ordre (même choix que la fiche de présentation du serveur,
 * section CALENDRIER_PLAN) : établissement, transmission à la CNM, lancement, remise des offres, ouverture des plis. Le libellé
 * est coupé au premier « : ». « Remise en forme du DAO » n'est pas une remise des offres.
 */
const ETAPES_DAO: readonly { cle: string; libelle: string; debut: RegExp }[] = [
  { cle: 'etablissement', libelle: 'Établissement du DAO', debut: /^Établissement du DAO/i },
  { cle: 'transmission', libelle: 'Transmission à la CNM', debut: /^Transmission du DAO/i },
  { cle: 'lancement', libelle: 'Lancement (avis spécifique)', debut: /^Lancement/i },
  { cle: 'remise', libelle: 'Remise des offres', debut: /^Remise des offres/i },
  { cle: 'ouverture', libelle: 'Ouverture des plis', debut: /^Ouverture des plis/i },
];
export function etapesDuDao(etapes: readonly { etape: string; date: string }[]): { cle: string; libelle: string; date: string }[] {
  return ETAPES_DAO.flatMap((e) => {
    const trouvee = etapes.find((x) => e.debut.test(x.etape));
    return trouvee ? [{ cle: e.cle, libelle: e.libelle, date: trouvee.date }] : [];
  });
}

@Component({
  selector: 'app-instantane-plan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="iv">
      <!-- ⚠️ 01/11 (pilote, maquette « Écrans figés », variante A) — l'objet en une ligne, puis une bande « en bref » des faits clés
           (au lieu du grand cadre bleu) ; le calendrier en jalons reliés. -->
      <p class="iv__ligne">@if (ligne()['idDetail']) { Ligne n° {{ ligne()['idDetail'] }} · }{{ v()['OBJET'] || ligne()['designationMarche'] }}</p>
      <dl class="iv__bref">
        <div><dt>Montant estimatif</dt><dd>{{ v()['MONTANT_ESTIMATIF'] }} Ar</dd></div>
        @if (ligne()['nouvMontEstim']) { <div><dt>Nouveau montant</dt><dd>{{ ligne()['nouvMontEstim'] }} Ar</dd></div> }
        <div><dt>Mode</dt><dd>{{ v()['MODE'] || '—' }}</dd></div>
        <div><dt>Forme · catégorie</dt><dd>{{ v()['FORME_MARCHE'] || '—' }}@if (v()['NATURE']) { <span>{{ v()['NATURE'] }}</span> }</dd></div>
        <div><dt>Financement</dt><dd>{{ v()['FINANCEMENT'] || '—' }}@if (v()['COMPTES']) { <span>compte {{ v()['COMPTES'] }}</span> }</dd></div>
      </dl>

      <div class="iv__deux">
        <div class="iv__bloc">
          <h4 class="iv__titre">Autorité contractante</h4>
          <dl class="iv__lignes">
            <div><dt>Entité</dt><dd>{{ v()['ENTITE'] }}</dd></div>
            <div><dt>Ministère</dt><dd>{{ v()['MINISTERE'] }}</dd></div>
            <div><dt>PRMP</dt><dd>{{ v()['PRMP'] }}</dd></div>
          </dl>
        </div>
        <div class="iv__bloc">
          <h4 class="iv__titre">Plan de passation</h4>
          <dl class="iv__lignes">
            <div><dt>Référence</dt><dd>{{ v()['PPM_REFERENCE'] }}</dd></div>
            <div><dt>Exercice</dt><dd>{{ v()['PPM_EXERCICE'] }}@if (versionPlan()) { · mise à jour n° {{ versionPlan() }}}</dd></div>
            @if (lots()) { <div><dt>Lots</dt><dd>{{ lots() }}</dd></div> }
          </dl>
        </div>
      </div>

      @if (justifications().length) {
        <div class="iv__bloc">
          <h4 class="iv__titre">Justifications</h4>
          <dl class="iv__lignes">@for (j of justifications(); track j.l) { <div><dt>{{ j.l }}</dt><dd>{{ j.v }}</dd></div> }</dl>
        </div>
      }

      @if (etapes().length) {
        <div class="iv__bloc">
          <h4 class="iv__titre">Calendrier prévu pour le DAO</h4>
          <ol class="iv__jalons">
            @for (e of etapes(); track e.cle) {
              <li><span class="iv__jalon-d">{{ e.date }}</span><span class="iv__jalon-l">{{ e.libelle }}</span></li>
            }
          </ol>
        </div>
      }

      @if (beneficiaires().length) {
        <div class="iv__bloc">
          <h4 class="iv__titre">Imputations budgétaires <span class="iv__compte">{{ beneficiaires().length }}</span></h4>
          <ul class="iv__imputations">
            @for (b of beneficiaires(); track b.code) {
              <li><span class="iv__code">{{ b.code }}</span><span class="iv__mt">{{ b.montant }}</span></li>
            }
          </ul>
        </div>
      }
    </section>
  `,
  styleUrl: './instantanes-procedure.scss',
})
export class InstantanePlanVue {
  readonly donnees = input.required<Json>();
  readonly v = computed(() => (this.donnees()['valeurs'] ?? {}) as Record<string, string>);
  readonly ligne = computed(() => (this.donnees()['ligne'] ?? {}) as Json);
  readonly versionPlan = computed(() => Number(this.donnees()['versionPpm'] ?? 0));
  /** Un seul lot : rien à dire ; plusieurs : leurs montants. */
  readonly lots = computed(() => (this.v()['NB_LOTS_PPM'] && this.v()['NB_LOTS_PPM'] !== '1' ? `${this.v()['NB_LOTS_PPM']} — ${this.v()['LOTS_MONTANTS'] ?? ''}` : ''));
  readonly justifications = computed(() => [
    { l: 'Mode dérogatoire', v: texte(this.ligne()['justifModeDerogatoire']) },
    { l: 'Délai aménagé', v: texte(this.ligne()['justifDelaiAmenage']) },
  ].filter((j) => j.v));
  readonly beneficiaires = computed(() => beneficiairesFiges(texte(this.v()['BENEFICIAIRES'])));
  readonly etapes = computed(() => etapesDuDao(etapesFigees(texte(this.v()['DATES_PREVISIONNELLES']))));
}

interface PublicationFigee { datePublication?: string | null; jmpNumero?: string | null; jmpDate?: string | null; supports?: string | null }
interface DocumentFige { idDocument: number; libelle?: string; extension?: string; version?: number | null; dateGeneration?: string; publication?: PublicationFigee | null }
interface DisponibiliteFigee { raison?: string | null; supportsMinimaux?: string[]; idAvis?: string | null; statutPv?: string | null }

/** Le projet de la version la plus récente (PDF et Word de la même version), ou null. */
export function projetCourant(projets: readonly DocumentFige[]): { version: number; date: string; formats: string } | null {
  if (!projets.length) return null;
  const version = Math.max(...projets.map((p) => p.version ?? 0));
  const docs = projets.filter((p) => (p.version ?? 0) === version);
  return {
    version,
    date: horodatage(docs[0].dateGeneration ?? null),
    formats: [...new Set(docs.map((d) => ((d.extension ?? '').toUpperCase() === 'DOCX' ? 'Word' : (d.extension ?? '').toUpperCase())))].sort().join(' et '),
  };
}

@Component({
  selector: 'app-instantane-avis',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="iv">
      <!-- ⚠️ 01/11 (pilote, maquette « Écrans figés », variante A) — la bande « en bref » : l'avis de la CNM sur le DAO, la publication
           (date, journal), le projet d'avis et les lettres ; puis les supports et les documents. -->
      <dl class="iv__bref">
        @if (avis().idAvis; as a) {
          <div [class.iv__bref-ok]="a === 'FAV' || a === 'FAVR'"><dt>Avis de la CNM sur le DAO</dt><dd>{{ libelleAvis(a) }}@if (avis().statutPv === 'SIGNE') { <span>PV signé</span> }</dd></div>
        }
        @if (publication(); as pub) {
          <div><dt>Publié le</dt><dd>{{ jj(pub.datePublication) }}</dd></div>
          @if (pub.jmpNumero) { <div><dt>Journal des marchés publics</dt><dd>n° {{ pub.jmpNumero }}@if (pub.jmpDate) { <span>du {{ jj(pub.jmpDate) }}</span> }</dd></div> }
        } @else if (projet(); as p) {
          <div><dt>Projet d’avis</dt><dd>Version {{ p.version }}<span>produit le {{ p.date }} · {{ p.formats }}</span></dd></div>
        } @else {
          <div><dt>Avis</dt><dd>Ni projet ni publication<span>à la soumission</span></dd></div>
        }
        <div><dt>Lettres d’invitation</dt><dd>{{ lettresUtiles() ? 'Après le PV favorable' : 'Sans objet' }}@if (!lettresUtiles()) { <span>catégorie sans lettre</span> }</dd></div>
      </dl>
      @if (publication()?.supports; as s) {
        <div class="iv__bloc">
          <h4 class="iv__titre">Publication</h4>
          <p class="iv__note">{{ s }}</p>
        </div>
      }
      @if (projet() && publication()) {
        <p class="iv__note">Projet d’avis : version {{ projet()!.version }}, produit le {{ projet()!.date }} · le document se lit à la pièce « Projet d’avis spécifique » du dossier.</p>
      }

      @if (supports().length) {
        <div class="iv__bloc">
          <h4 class="iv__titre">Supports de publication minimaux</h4>
          <ul class="iv__supports">@for (s of supports(); track s) { <li>{{ s }}</li> }</ul>
        </div>
      }

      @if (documents().length) {
        <div class="iv__bloc">
          <h4 class="iv__titre">Avis déjà imprimés</h4>
          <ul class="iv__supports">@for (d of documents(); track d.idDocument) { <li>{{ d.libelle }} · {{ quand(d.dateGeneration) }}</li> }</ul>
        </div>
      }

      @if (lettresUtiles()) {
        <p class="iv__note">Les lettres d’invitation s’impriment, une par candidat de la liste restreinte, après le PV favorable de la Commission.</p>
      }
    </section>
  `,
  styleUrl: './instantanes-procedure.scss',
})
export class InstantaneAvisVue {
  readonly donnees = input.required<Json>();
  readonly avis = computed(() => (this.donnees()['avis'] ?? {}) as DisponibiliteFigee);
  /** Les lettres ne concernent pas les fournitures et travaux (`CATEGORIE_SANS_LETTRE`) : la section se tait. */
  readonly lettresUtiles = computed(() => ((this.donnees()['lettres'] ?? {}) as DisponibiliteFigee).raison !== 'CATEGORIE_SANS_LETTRE');
  readonly documents = computed(() => (this.donnees()['documents'] ?? []) as DocumentFige[]);
  readonly projet = computed(() => projetCourant((this.donnees()['projets'] ?? []) as DocumentFige[]));
  readonly supports = computed(() => this.avis().supportsMinimaux ?? []);
  /** ⚠️ 01/11 — la publication du dernier avis imprimé (date, journal, supports), s'il y en a une. */
  readonly publication = computed(() => this.documents().map((d) => d.publication).find((p) => !!p?.datePublication) ?? null);
  readonly jj = (d?: string | null): string => (d ? jjmmaaaa(d.slice(0, 10)) : '—');
  libelleAvis(a: string): string { return ({ FAV: 'Favorable', FAVR: 'Favorable avec réserves', DEF: 'Défavorable' } as Record<string, string>)[a] ?? a; }
  quand(d?: string): string { return horodatage(d ?? null); }
}

/** L'origine d'un membre de la commission, en clair. */
const ORIGINES_MEMBRE: Readonly<Record<string, string>> = {
  ENTITE_CONTRACTANTE: 'Entité contractante',
  EXPERT_OBJET: 'Expert de l’objet',
};

@Component({
  selector: 'app-instantane-cao',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="iv">
      @if (!membres().length) {
        <div class="iv__tete iv__tete--neutre">
          <p class="iv__sur">La commission d’appel d’offres</p>
          <h3 class="iv__objet">Pas encore désignée à la soumission</h3>
          <p class="iv__note">Elle se désigne avant l’ouverture des plis ; ses membres apparaîtront aux soumissions suivantes.</p>
        </div>
      } @else {
        <!-- ⚠️ 01/11 (pilote, maquette « Écrans figés », variante A) — la décision en une ligne, la bande « en bref », puis les membres
             avec leur origine et leur fonction. -->
        @if (decision()) { <p class="iv__ligne">{{ decision() }}</p> }
        <dl class="iv__bref">
          @if (dateDecision()) { <div><dt>Décision</dt><dd>{{ dateDecision() }}@if (decisionJointe()) { <span>décision jointe</span> }</dd></div> }
          <div><dt>Membres</dt><dd>{{ membres().length }}@if (president(); as p) { <span>président : {{ p }}</span> }</dd></div>
          <div [class.iv__bref-ok]="donnees()['etat'] === 'COMPLETE'"><dt>Composition</dt><dd>{{ donnees()['etat'] === 'COMPLETE' ? 'Complète' : 'À compléter' }}<span>{{ anomalies().length ? anomalies().length + ' constat(s)' : 'aucun constat' }}</span></dd></div>
        </dl>
        <div class="table-responsive">
          <table class="cnm-table iv__table" aria-label="Membres de la commission d’appel d’offres">
            <thead><tr><th scope="col">Membre</th><th scope="col">Rôle</th><th scope="col">Origine</th><th scope="col">Fonction ou domaine</th></tr></thead>
            <tbody>
              @for (m of membres(); track $index) {
                <tr><td>{{ m.nom }}</td><td>{{ m.qualite }}</td><td>{{ m.origine || '—' }}</td><td>{{ m.fonction || '—' }}</td></tr>
              }
            </tbody>
          </table>
        </div>
        @if (anomalies().length) {
          <div class="iv__bloc iv__bloc--alerte">
            <h4 class="iv__titre">Constats</h4>
            <ul class="iv__supports">@for (a of anomalies(); track $index) { <li>{{ a }}</li> }</ul>
          </div>
        }
      }
    </section>
  `,
  styleUrl: './instantanes-procedure.scss',
})
export class InstantaneCaoVue {
  readonly donnees = input.required<Json>();
  readonly decision = computed(() => {
    const d = this.donnees()['decision'] as Json | string | null | undefined;
    if (!d) return '';
    if (typeof d === 'string') return d;
    // ⚠️ 01/11 — la référence servie est déjà une phrase complète (« Décision n° … du 06/07/2026 portant … ») : telle quelle.
    const ref = texte(d['numero'] ?? d['reference']);
    if (ref) return /^d[ée]cision/i.test(ref) ? ref : `Décision ${ref}${d['date'] && !ref.includes(jjmmaaaa(texte(d['date']))) ? ' du ' + jjmmaaaa(texte(d['date'])) : ''}`;
    return d['date'] ? 'Décision du ' + jjmmaaaa(texte(d['date'])) : '';
  });
  readonly membres = computed(() => ((this.donnees()['membres'] ?? []) as Json[]).map((m) => ({
    nom: [texte(m['nom'] ?? m['nomComplet'] ?? m['im']), texte(m['prenom'])].filter(Boolean).join(' '),
    qualite: m['president'] ? 'Président' : texte(m['qualite'] ?? m['role']) || 'Membre',
    origine: ORIGINES_MEMBRE[texte(m['origine'])] ?? texte(m['origine']).replace(/_/g, ' ').toLowerCase(),
    fonction: [texte(m['fonction']), texte(m['service']), texte(m['organisme']), texte(m['domaine'])].filter(Boolean).join(' · '),
  })));
  /** ⚠️ 01/11 — la date de la décision, son fichier, le président (bande « en bref »). */
  readonly dateDecision = computed(() => {
    const d = this.donnees()['decision'];
    return d && typeof d === 'object' && (d as Json)['date'] ? jjmmaaaa(texte((d as Json)['date'])) : '';
  });
  readonly decisionJointe = computed(() => {
    const d = this.donnees()['decision'];
    return !!d && typeof d === 'object' && (d as Json)['fichier'] === true;
  });
  readonly president = computed(() => this.membres().find((m) => m.qualite === 'Président')?.nom ?? '');
  readonly anomalies = computed(() => ((this.donnees()['anomalies'] ?? []) as Json[]).map((a) => texte(a['message'] ?? a['regle'])));
}
