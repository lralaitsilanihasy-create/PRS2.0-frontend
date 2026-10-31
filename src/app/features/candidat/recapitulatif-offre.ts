import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ActeEngagementSaisi, TotauxOffre } from '../../core/securite/scellement';
import { EnveloppeOffre, LotBesoin, PieceAttendue } from '../../models';
import { SaisieOffre, calculerTotaux, montantLigne, quantites } from './offre-financiere';
import { maintenantServeur } from '../../core/horloge/heure-serveur';

/**
 * ⚠️ 19/10 (pilote, « copie-offre-candidat ») — le **récapitulatif de l'offre** : ce que le candidat a saisi, mis en forme pour être
 * relu. C'est le clair de la copie chiffrée (V136) et le contenu du PDF enregistré sur le poste. Il dit ce qu'il est : **la saisie du
 * candidat, pas l'original scellé** — seule l'empreinte de l'accusé fait foi. Les fichiers n'y sont pas : leur nom, leur taille et
 * leur empreinte suffisent à les reconnaître.
 */
export interface RecapitulatifOffre {
  v: 1;
  genereLe: string;
  procedure: { idDmc: number; reference: string | null; objet: string | null; lot: number | null };
  entreprise: { nif: string; raisonSociale: string };
  groupement: { nif: string; raisonSociale: string; mandataire: boolean }[] | null;
  enveloppe: EnveloppeOffre | null;
  acteEngagement: Partial<ActeEngagementSaisi>;
  garantie: { code: string; montant: number | null; emetteur: string } | null;
  bordereau: { lignes: LigneRecapitulatif[]; totaux: TotauxOffre } | null;
  conformite: ConformiteRecapitulatif[];
  fichiers: FichierRecapitulatif[];
}

export interface LigneRecapitulatif {
  ordre: number;
  designation: string;
  unite: string | null;
  quantite: number;
  prixUnitaire: number | null;
  montant: number | null;
  dateLivraison: string | null;
}

export interface ConformiteRecapitulatif {
  ordre: number;
  designation: string;
  marque: string;
  modele: string;
  caracteristiques: { libelle: string; exigence: string; proposee: string; conforme: boolean | null }[];
}

export interface FichierRecapitulatif {
  code: string;
  libelle: string;
  nom: string;
  taille: number;
  sha256: string;
}

export interface ElementsRecapitulatif {
  procedure: RecapitulatifOffre['procedure'];
  entreprise: RecapitulatifOffre['entreprise'];
  groupement: RecapitulatifOffre['groupement'];
  enveloppe: EnveloppeOffre | null;
  acteEngagement: Partial<ActeEngagementSaisi>;
  garantie: RecapitulatifOffre['garantie'];
  lot: LotBesoin | null;
  saisie: SaisieOffre;
  tauxTva: number;
  travaux: boolean;
  fichiers: { code: string; nom: string; taille: number; sha256: string }[];
  piecesAttendues: readonly PieceAttendue[];
  maintenant?: string;
}

/** Le récapitulatif, construit depuis la saisie telle qu'elle est scellée. Pure : pas d'appel, pas de date implicite en test. */
export function construireRecapitulatif(e: ElementsRecapitulatif): RecapitulatifOffre {
  const lignes: LigneRecapitulatif[] = (e.lot?.articles ?? []).map((a, i) => ({
    ordre: a.ordre ?? i + 1,
    designation: a.designation,
    unite: a.unite ?? null,
    quantite: quantites(a).q,
    prixUnitaire: e.saisie.prix[a.idArticle] ?? null,
    montant: montantLigne(a, e.saisie.prix[a.idArticle]),
    dateLivraison: e.saisie.dates[a.idArticle] || null,
  }));
  const conformite: ConformiteRecapitulatif[] = (e.lot?.articles ?? []).map((a, i) => {
    const c = e.saisie.conformite[a.idArticle];
    return {
      ordre: a.ordre ?? i + 1,
      designation: a.designation,
      marque: c?.marque ?? '',
      modele: c?.modele ?? '',
      caracteristiques: (a.caracteristiques ?? []).map((k) => ({
        libelle: k.libelle,
        exigence: k.exigence ?? '',
        proposee: c?.caracteristiques[k.idCaracteristique!]?.proposee ?? '',
        conforme: c?.caracteristiques[k.idCaracteristique!]?.conforme ?? null,
      })),
    };
  });
  const libelleDe = (code: string): string => e.piecesAttendues.find((p) => p.code === code)?.libelle ?? code;
  return {
    v: 1,
    genereLe: e.maintenant ?? maintenantServeur().toISOString(),
    procedure: e.procedure,
    entreprise: e.entreprise,
    groupement: e.groupement,
    enveloppe: e.enveloppe,
    acteEngagement: e.acteEngagement,
    garantie: e.garantie,
    bordereau: e.lot ? { lignes, totaux: calculerTotaux(e.lot, e.saisie, e.tauxTva, e.travaux) } : null,
    conformite,
    fichiers: e.fichiers.map((f) => ({ code: f.code, libelle: libelleDe(f.code), nom: f.nom, taille: f.taille, sha256: f.sha256 })),
  };
}

const nombre = (v: number | null | undefined): string => (v == null ? '—' : new Intl.NumberFormat('fr-FR').format(v));
const jour = (iso: string | null | undefined): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '—';
};
const echapper = (t: unknown): string => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c);

/** Le récapitulatif en HTML autonome, pour l'impression (« Enregistrer en PDF » du navigateur). Tout est échappé. */
export function htmlRecapitulatif(r: RecapitulatifOffre): string {
  const ae = r.acteEngagement;
  const rab = ae.rabais;
  const rabais = !rab ? 'Aucun' : rab.nature === 'POURCENTAGE' ? `${rab.valeur} %` : `${nombre(rab.valeur)} Ar HT`;
  const lignes = r.bordereau?.lignes.map((l) => `<tr><td>${l.ordre}</td><td>${echapper(l.designation)}</td><td>${echapper(l.unite)}</td><td class="n">${nombre(l.quantite)}</td><td class="n">${nombre(l.prixUnitaire)}</td><td class="n">${nombre(l.montant)}</td><td>${jour(l.dateLivraison)}</td></tr>`).join('') ?? '';
  const conformite = r.conformite.map((c) => `<h3>${c.ordre}. ${echapper(c.designation)} — ${echapper(c.marque || '—')} ${echapper(c.modele)}</h3><table><tr><th>Caractéristique</th><th>Exigé</th><th>Proposé</th><th>Conforme</th></tr>${c.caracteristiques.map((k) => `<tr><td>${echapper(k.libelle)}</td><td>${echapper(k.exigence)}</td><td>${echapper(k.proposee)}</td><td>${k.conforme === null ? '—' : k.conforme ? 'Oui' : 'Non'}</td></tr>`).join('')}</table>`).join('');
  const fichiers = r.fichiers.map((f) => `<tr><td>${echapper(f.libelle)}</td><td>${echapper(f.nom)}</td><td class="n">${nombre(f.taille)} o</td><td class="mono">${echapper(f.sha256)}</td></tr>`).join('');
  const t = r.bordereau?.totaux;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Récapitulatif de l’offre</title>
<style>body{font:10.5pt/1.4 Arial,sans-serif;margin:1.5cm;color:#111}h1{font-size:16pt;margin:0 0 .2cm}h2{font-size:12pt;margin:.6cm 0 .2cm;border-bottom:1px solid #999}h3{font-size:10.5pt;margin:.4cm 0 .1cm}
table{border-collapse:collapse;width:100%;font-size:9.5pt}th,td{border:1px solid #bbb;padding:3px 5px;text-align:left;vertical-align:top}td.n{text-align:right;white-space:nowrap}.mono{font-family:var(--police-texte);font-size:8pt;word-break:break-all}
.avert{border:1px solid #c80;background:#fff7e0;padding:6px 8px;margin:.3cm 0}dl{display:grid;grid-template-columns:max-content 1fr;gap:2px 12px;margin:0}dt{color:#555}dd{margin:0}</style></head><body>
<h1>Récapitulatif de l’offre</h1>
<p>${echapper(r.procedure.objet ?? '')}${r.procedure.lot ? ` — lot ${r.procedure.lot}` : ''} · ${echapper(r.procedure.reference ?? '')} · généré le ${echapper(new Date(r.genereLe).toLocaleString('fr-FR'))}</p>
<p class="avert"><strong>Votre saisie, telle que vous l’avez scellée sur votre poste — pas l’original scellé.</strong> Seule l’empreinte de l’accusé de réception fait foi.</p>
<h2>Le soumissionnaire</h2><dl><dt>Entreprise</dt><dd>${echapper(r.entreprise.raisonSociale)} · NIF ${echapper(r.entreprise.nif)}</dd>${r.groupement ? `<dt>Groupement</dt><dd>${r.groupement.map((g) => `${echapper(g.raisonSociale)} (NIF ${echapper(g.nif)}${g.mandataire ? ', mandataire' : ''})`).join(' ; ')}</dd>` : ''}${r.enveloppe ? `<dt>Enveloppe</dt><dd>${r.enveloppe === 'TECHNIQUE' ? 'Proposition technique' : 'Proposition financière'}</dd>` : ''}</dl>
<h2>L’acte d’engagement</h2><dl><dt>Montant hors taxes</dt><dd>${nombre(ae.montantHt)} Ar</dd><dt>Montant toutes taxes</dt><dd>${nombre(ae.montantTtc)} Ar</dd><dt>Délai</dt><dd>${ae.delai ?? '—'} ${ae.delaiUnite === 'MOIS' ? 'mois' : 'jours'}</dd><dt>Validité de l’offre</dt><dd>${ae.validiteJours ?? '—'} jours</dd><dt>Rabais</dt><dd>${echapper(rabais)}</dd>${r.garantie ? `<dt>Garantie de soumission</dt><dd>code ${echapper(r.garantie.code)} · ${nombre(r.garantie.montant)} Ar · ${echapper(r.garantie.emetteur)}</dd>` : ''}</dl>
${r.bordereau ? `<h2>Le bordereau des prix</h2><table><tr><th>N°</th><th>Désignation</th><th>Unité</th><th>Quantité</th><th>Prix unitaire HT (Ar)</th><th>Montant HT (Ar)</th><th>Livraison</th></tr>${lignes}</table><p>Total HT <strong>${nombre(t?.ht)} Ar</strong> · TVA ${nombre(t?.tva)} Ar · Total TTC <strong>${nombre(t?.ttc)} Ar</strong></p>` : ''}
${r.conformite.length ? `<h2>La conformité technique</h2>${conformite}` : ''}
<h2>Les fichiers joints</h2>${r.fichiers.length ? `<table><tr><th>Pièce</th><th>Fichier</th><th>Taille</th><th>Empreinte SHA-256</th></tr>${fichiers}</table>` : '<p>Aucun.</p>'}
</body></html>`;
}

/** Imprime le récapitulatif par un cadre caché (le navigateur propose « Enregistrer en PDF ») — même geste que le pli de secours. */
export function imprimerRecapitulatif(document: Document, r: RecapitulatifOffre): void {
  const cadre = document.createElement('iframe');
  cadre.setAttribute('aria-hidden', 'true');
  cadre.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  cadre.onload = () => {
    cadre.contentWindow?.focus();
    cadre.contentWindow?.print();
    setTimeout(() => cadre.remove(), 60_000);
  };
  document.body.appendChild(cadre);
  cadre.contentDocument?.open();
  cadre.contentDocument?.write(htmlRecapitulatif(r));
  cadre.contentDocument?.close();
}

/** Le récapitulatif à l'écran, en lecture seule (« Relire mon offre »). */
@Component({
  selector: 'app-recapitulatif-offre',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let r = recap();
    <div class="ro">
      <p class="ro__avert" role="note"><strong>Votre saisie, telle que scellée sur votre poste — pas l’original scellé.</strong> Seule l’empreinte de l’accusé de réception fait foi.</p>
      <h3 class="ro__h3">Le soumissionnaire</h3>
      <p>{{ r.entreprise.raisonSociale }} · NIF <span class="cnm-mono">{{ r.entreprise.nif }}</span>@if (r.groupement) { · groupement : @for (g of r.groupement; track g.nif) { {{ g.raisonSociale }}{{ g.mandataire ? ' (mandataire)' : '' }}{{ $last ? '' : ', ' }} } }</p>
      <h3 class="ro__h3">L’acte d’engagement</h3>
      <dl class="ro__dl">
        <dt>Montant hors taxes</dt><dd>{{ nombre(r.acteEngagement.montantHt) }} Ar</dd>
        <dt>Montant toutes taxes</dt><dd>{{ nombre(r.acteEngagement.montantTtc) }} Ar</dd>
        <dt>Délai</dt><dd>{{ r.acteEngagement.delai ?? '—' }} {{ r.acteEngagement.delaiUnite === 'MOIS' ? 'mois' : 'jours' }}</dd>
        <dt>Validité de l’offre</dt><dd>{{ r.acteEngagement.validiteJours ?? '—' }} jours</dd>
        <dt>Rabais</dt><dd>{{ rabais(r) }}</dd>
        @if (r.garantie) { <dt>Garantie de soumission</dt><dd>code {{ r.garantie.code }} · {{ nombre(r.garantie.montant) }} Ar · {{ r.garantie.emetteur }}</dd> }
      </dl>
      @if (r.bordereau; as b) {
        <h3 class="ro__h3">Le bordereau des prix</h3>
        <div class="cnm-table-wrap">
          <table class="cnm-table ro__table">
            <thead><tr><th scope="col">N°</th><th scope="col">Désignation</th><th scope="col">Unité</th><th scope="col" class="cnm-num">Quantité</th><th scope="col" class="cnm-num">Prix unitaire HT</th><th scope="col" class="cnm-num">Montant HT</th><th scope="col">Livraison</th></tr></thead>
            <tbody>
              @for (l of b.lignes; track l.ordre) {
                <tr><td>{{ l.ordre }}</td><td>{{ l.designation }}</td><td>{{ l.unite || '—' }}</td><td class="cnm-num">{{ nombre(l.quantite) }}</td><td class="cnm-num">{{ nombre(l.prixUnitaire) }}</td><td class="cnm-num">{{ nombre(l.montant) }}</td><td>{{ jour(l.dateLivraison) }}</td></tr>
              }
            </tbody>
          </table>
        </div>
        <p class="text-sm">Total HT <strong>{{ nombre(b.totaux.ht) }} Ar</strong> · TVA {{ nombre(b.totaux.tva) }} Ar · Total TTC <strong>{{ nombre(b.totaux.ttc) }} Ar</strong></p>
      }
      @if (r.conformite.length) {
        <h3 class="ro__h3">La conformité technique</h3>
        @for (c of r.conformite; track c.ordre) {
          <details class="ro__article">
            <summary>{{ c.ordre }}. {{ c.designation }} — {{ c.marque || '—' }} {{ c.modele }} · {{ conformes(c) }}</summary>
            <table class="cnm-table ro__table">
              <thead><tr><th scope="col">Caractéristique</th><th scope="col">Exigé</th><th scope="col">Proposé</th><th scope="col">Conforme</th></tr></thead>
              <tbody>@for (k of c.caracteristiques; track k.libelle) { <tr><td>{{ k.libelle }}</td><td>{{ k.exigence }}</td><td>{{ k.proposee || '—' }}</td><td>{{ k.conforme === null ? '—' : k.conforme ? 'Oui' : 'Non' }}</td></tr> }</tbody>
            </table>
          </details>
        }
      }
      <h3 class="ro__h3">Les fichiers joints</h3>
      @if (r.fichiers.length) {
        <ul class="ro__fichiers">@for (f of r.fichiers; track f.code) { <li><strong>{{ f.libelle }}</strong> · {{ f.nom }} · {{ nombre(f.taille) }} o<br /><span class="cnm-mono ro__sha">{{ f.sha256 }}</span></li> }</ul>
      } @else { <p class="text-sm text-muted">Aucun.</p> }
      <p class="text-xs text-muted">Récapitulatif généré le {{ quand(r.genereLe) }}.</p>
    </div>
  `,
  styles: `
    .ro { display: flex; flex-direction: column; gap: 0.45rem; font-size: var(--text-sm); }
    .ro p { margin: 0; }
    .ro__avert { padding: 0.5rem 0.7rem; border-radius: var(--radius-md); background: var(--examen-fond); border: 1px solid var(--examen-texte); color: var(--examen-texte); }
    .ro__h3 { margin: 0.5rem 0 0; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--n-600); }
    .ro__dl { margin: 0; display: grid; grid-template-columns: max-content 1fr; gap: 0.2rem 0.9rem; }
    .ro__dl dt { color: var(--n-500); }
    .ro__dl dd { margin: 0; font-weight: 500; }
    .ro__table td { white-space: normal; vertical-align: top; }
    .ro__article summary { cursor: pointer; font-weight: 500; padding: 0.3rem 0; }
    .ro__fichiers { margin: 0; padding-left: 1.1rem; }
    .ro__sha { font-size: var(--text-xs); word-break: break-all; }
  `,
})
export class RecapitulatifOffreVue {
  readonly recap = input.required<RecapitulatifOffre>();
  readonly nombre = nombre;
  readonly jour = jour;
  quand(iso: string): string {
    return new Date(iso).toLocaleString('fr-FR');
  }
  rabais(r: RecapitulatifOffre): string {
    const rab = r.acteEngagement.rabais;
    return !rab ? 'Aucun' : rab.nature === 'POURCENTAGE' ? `${rab.valeur} %` : `${nombre(rab.valeur)} Ar HT`;
  }
  conformes(c: ConformiteRecapitulatif): string {
    const oui = c.caracteristiques.filter((k) => k.conforme === true).length;
    return `${oui} / ${c.caracteristiques.length} conforme${oui > 1 ? 's' : ''}`;
  }
}
