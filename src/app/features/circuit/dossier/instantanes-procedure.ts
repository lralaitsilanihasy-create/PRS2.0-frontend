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
      <div class="iv__tete">
        <p class="iv__sur">La ligne du plan, telle que soumise</p>
        <h3 class="iv__objet">{{ v()['OBJET'] || ligne()['designationMarche'] }}</h3>
        <div class="iv__puces">
          @for (p of puces(); track p) { <span class="iv__puce">{{ p }}</span> }
        </div>
        <div class="iv__chiffres">
          <div class="iv__chiffre"><span class="iv__chiffre-l">Montant estimatif</span><span class="iv__chiffre-v">{{ v()['MONTANT_ESTIMATIF'] }} <small>Ar</small></span></div>
          @if (ligne()['nouvMontEstim']) {
            <div class="iv__chiffre"><span class="iv__chiffre-l">Nouveau montant</span><span class="iv__chiffre-v">{{ ligne()['nouvMontEstim'] }} <small>Ar</small></span></div>
          }
          <div class="iv__chiffre"><span class="iv__chiffre-l">Financement</span><span class="iv__chiffre-v">{{ v()['FINANCEMENT'] }}</span></div>
          <div class="iv__chiffre"><span class="iv__chiffre-l">Compte</span><span class="iv__chiffre-v">{{ v()['COMPTES'] }}</span></div>
        </div>
      </div>

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
          <ol class="iv__frise">
            @for (e of etapes(); track e.cle) {
              <li class="iv__jalon"><span class="iv__jalon-d">{{ e.date }}</span><span class="iv__jalon-l">{{ e.libelle }}</span></li>
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
  readonly puces = computed(() => [this.v()['MODE'], this.v()['FORME_MARCHE'], this.v()['NATURE']].filter(Boolean));
  /** Un seul lot : rien à dire ; plusieurs : leurs montants. */
  readonly lots = computed(() => (this.v()['NB_LOTS_PPM'] && this.v()['NB_LOTS_PPM'] !== '1' ? `${this.v()['NB_LOTS_PPM']} — ${this.v()['LOTS_MONTANTS'] ?? ''}` : ''));
  readonly justifications = computed(() => [
    { l: 'Mode dérogatoire', v: texte(this.ligne()['justifModeDerogatoire']) },
    { l: 'Délai aménagé', v: texte(this.ligne()['justifDelaiAmenage']) },
  ].filter((j) => j.v));
  readonly beneficiaires = computed(() => beneficiairesFiges(texte(this.v()['BENEFICIAIRES'])));
  readonly etapes = computed(() => etapesDuDao(etapesFigees(texte(this.v()['DATES_PREVISIONNELLES']))));
}

interface DocumentFige { idDocument: number; libelle?: string; extension?: string; version?: number | null; dateGeneration?: string }
interface DisponibiliteFigee { raison?: string | null; supportsMinimaux?: string[] }

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
      @if (projet(); as p) {
        <div class="iv__tete">
          <p class="iv__sur">Le projet d’avis spécifique soumis</p>
          <h3 class="iv__objet">Version {{ p.version }} de la fiche DAO</h3>
          <p class="iv__note">Produit le {{ p.date }} · {{ p.formats }} · le document se lit à la pièce « Projet d’avis spécifique » du dossier.</p>
        </div>
      } @else {
        <p class="iv__vide">Aucun projet d’avis n’était produit à la soumission.</p>
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
        <div class="iv__bloc">
          <h4 class="iv__titre">Lettres d’invitation</h4>
          <p class="iv__note">Elles s’impriment, une par candidat de la liste restreinte, après le PV favorable de la Commission.</p>
        </div>
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
  quand(d?: string): string { return horodatage(d ?? null); }
}

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
        <div class="iv__tete">
          <p class="iv__sur">La commission d’appel d’offres</p>
          <h3 class="iv__objet">{{ membres().length }} membre{{ membres().length > 1 ? 's' : '' }}@if (decision()) { · décision {{ decision() }}}</h3>
        </div>
        <ul class="iv__membres">
          @for (m of membres(); track $index) { <li><span class="iv__nom">{{ m.nom }}</span><span class="iv__qualite">{{ m.qualite }}</span></li> }
        </ul>
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
    return [texte(d['numero'] ?? d['reference']), d['date'] ? 'du ' + jjmmaaaa(texte(d['date'])) : ''].filter(Boolean).join(' ');
  });
  readonly membres = computed(() => ((this.donnees()['membres'] ?? []) as Json[]).map((m) => ({
    nom: texte(m['nom'] ?? m['nomComplet'] ?? m['im']),
    qualite: m['president'] ? 'Président' : texte(m['qualite'] ?? m['role']) || 'Membre',
  })));
  readonly anomalies = computed(() => ((this.donnees()['anomalies'] ?? []) as Json[]).map((a) => texte(a['message'] ?? a['regle'])));
}
