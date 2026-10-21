import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  ViewEncapsulation,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Editor } from '@tiptap/core';
import { Node as NoeudPm } from '@tiptap/pm/model';

import { ApiError } from '../../../../core/errors/api-error';
import { validerFichier } from '../../../../core/securite/fichiers-surs';
import { CatalogueModelePv, ChampModelePv, ConditionModelePv, DocumentPage, NoeudPage, ReglagesPage, SchemaModelePv } from '../../../../models';
import { ModelePvService } from '../../../../services';
import { expressionProposee } from '../modeles-pv-libelles';
import { cheminVersZone, depuisServeur, docVide, enveloppe } from './conversion-page';
import { extensionsPage } from './extensions-page';

type Zone = 'entete' | 'corps' | 'piedDePage';
const ZONES: readonly Zone[] = ['entete', 'corps', 'piedDePage'];
const TAILLES = [8, 9, 10, 11, 12, 13, 14, 16, 18, 20];
const TYPES_IMAGE = ['image/png', 'image/jpeg'];
/** Les règles usuelles, proposées au cadrage même si elles ne sont pas encore déclarées (« Déclarer ce que la page utilise »). */
const REGLES_USUELLES: Readonly<Record<string, string>> = {
  FAVORABLE: 'Si l’avis est favorable',
  AVEC_RESERVES: 'Si l’avis est favorable avec réserves',
  DEFAVORABLE: 'Si l’avis est défavorable',
  CENTRALE: 'Si la commission est centrale',
  REGIONALE: 'Si la commission est régionale',
  OBS_GENERALE: 'Si une observation générale est saisie',
};

/**
 * ⚠️ 21/10 (option C', décision du pilote) — l'éditeur d'une version page : le texte ET la mise en page, sans Word, sur une feuille
 * A4 en trois zones (en-tête, corps, pied de page). Les trous sont des étiquettes (variables, champs) et des cadres (passages
 * conditionnels), insérés depuis le catalogue ; la ligne de tableau répétée se marque depuis la barre. Rien n'est enregistré sans
 * « Enregistrer » : le brouillon (`PUT …/document`) ou une nouvelle version (`POST …/versions`).
 */
@Component({
  selector: 'app-editeur-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Le contenu de la feuille est produit par Tiptap, hors du gabarit : ses styles sont globaux, tous préfixés par « .edp ».
  encapsulation: ViewEncapsulation.None,
  template: `
    <div class="edp" [class.edp--figee]="figee()" [style.--edp-barre.px]="hauteurBarre()">
      <div #barre class="edp__barre" role="toolbar" aria-label="Mise en forme et enregistrement">
        @if (!figee()) {
          <span class="edp__grp" role="group" aria-label="Historique">
            <button type="button" (click)="cmd((c) => c.undo())" aria-label="Annuler" title="Annuler">↶</button>
            <button type="button" (click)="cmd((c) => c.redo())" aria-label="Rétablir" title="Rétablir">↷</button>
          </span>
          <span class="edp__grp" role="group" aria-label="Texte">
            <span class="edp__grp-t" aria-hidden="true">Texte</span>
            <select aria-label="Style du paragraphe" class="edp__moyen" (change)="style($any($event.target).value)">
              @for (st of styles; track st.cle) { <option [value]="st.cle" [selected]="etat().style === st.cle">{{ st.libelle }}</option> }
            </select>
            <select aria-label="Police" class="edp__moyen" (change)="police($any($event.target).value)">
              <option value="" [selected]="!etat().police">Police</option>
              @for (p of polices(); track p) { <option [value]="p" [selected]="etat().police === p">{{ p }}</option> }
            </select>
            <select aria-label="Taille" class="edp__etroit" (change)="taille($any($event.target).value)">
              <option value="" [selected]="!etat().taille">Taille</option>
              @for (t of tailles; track t) { <option [value]="t" [selected]="etat().taille === t">{{ t }}</option> }
            </select>
            <button type="button" (click)="pas(1)" aria-label="Agrandir le texte" title="Agrandir le texte">A<sup>+</sup></button>
            <button type="button" (click)="pas(-1)" aria-label="Réduire le texte" title="Réduire le texte">A<sup>−</sup></button>
            <button type="button" [class.on]="etat().gras" (click)="cmd((c) => c.toggleBold())" aria-label="Gras" title="Gras (Ctrl+B)"><b>G</b></button>
            <button type="button" [class.on]="etat().italique" (click)="cmd((c) => c.toggleItalic())" aria-label="Italique" title="Italique (Ctrl+I)"><i>I</i></button>
            <button type="button" [class.on]="etat().souligne" (click)="cmd((c) => c.toggleUnderline())" aria-label="Souligné" title="Souligné (Ctrl+U)"><u>S</u></button>
            <select aria-label="Couleur du texte" class="edp__etroit" [style.color]="etat().couleur || null" (change)="couleur($any($event.target).value)">
              <option value="" [selected]="!etat().couleur">Couleur</option>
              <option value="-">automatique</option>
              @for (c of couleurs(); track c[0]) { <option [value]="c[0]" [style.color]="c[0]" [selected]="etat().couleur === c[0]">■ {{ c[1] }}</option> }
            </select>
            <button type="button" (click)="cmd((c) => c.unsetAllMarks())" aria-label="Effacer la mise en forme" title="Effacer la mise en forme du texte sélectionné">⌫ forme</button>
          </span>
          <span class="edp__grp" role="group" aria-label="Paragraphe">
            <span class="edp__grp-t" aria-hidden="true">Paragraphe</span>
            @for (a of alignements; track a.cle) {
              <button type="button" [class.on]="etat().alignement === a.cle" (click)="cmd((c) => c.setTextAlign(a.cle))" [attr.aria-label]="a.libelle" [title]="a.libelle">{{ a.icone }}</button>
            }
            <button type="button" (click)="cmd((c) => c.toggleBulletList())" aria-label="Liste à puces" title="Liste à puces">•</button>
            <button type="button" (click)="cmd((c) => c.toggleOrderedList())" aria-label="Liste numérotée" title="Liste numérotée">1.</button>
            <button type="button" (click)="retrait(-5)" aria-label="Diminuer le retrait" title="Diminuer le retrait (5 mm)">⇤</button>
            <button type="button" (click)="retrait(5)" aria-label="Augmenter le retrait" title="Augmenter le retrait (5 mm)">⇥</button>
            <select aria-label="Retrait de première ligne" class="edp__etroit" (change)="paragraphe({ retraitPremiereLigne: +$any($event.target).value || null })">
              @for (r of retraitsPremiere; track r) { <option [value]="r" [selected]="etat().premiereLigne === r">{{ r ? '1re ligne ' + r + ' mm' : '1re ligne' }}</option> }
            </select>
            <select aria-label="Interligne" class="edp__etroit" (change)="paragraphe({ interligne: +$any($event.target).value || null })">
              @for (i of interlignes; track i.v) { <option [value]="i.v" [selected]="etat().interligne === i.v">{{ i.libelle }}</option> }
            </select>
            <select aria-label="Espacement des paragraphes" class="edp__moyen" (change)="espacement($any($event.target).value)">
              @for (e of espacements; track e.cle) { <option [value]="e.cle" [selected]="etat().espacement === e.cle">{{ e.libelle }}</option> }
            </select>
          </span>
          <span class="edp__grp" role="group" aria-label="Tableau">
            <span class="edp__grp-t" aria-hidden="true">Tableau</span>
            <button type="button" (click)="cmd((c) => c.insertTable({ rows: 2, cols: 2, withHeaderRow: false }))" aria-label="Insérer un tableau" title="Insérer un tableau">▦</button>
            @if (etat().tableau) {
              <button type="button" (click)="cmd((c) => c.addRowAfter())" title="Ajouter une ligne">+ ligne</button>
              <button type="button" (click)="cmd((c) => c.addColumnAfter())" title="Ajouter une colonne">+ col.</button>
              <button type="button" (click)="cmd((c) => c.deleteRow())" title="Supprimer la ligne">− ligne</button>
              <button type="button" (click)="cmd((c) => c.deleteColumn())" title="Supprimer la colonne">− col.</button>
              <button type="button" (click)="cmd((c) => c.mergeOrSplit())" aria-label="Fusionner ou scinder les cellules" title="Fusionner ou scinder les cellules">⊞</button>
              <select aria-label="Fond de la cellule" class="edp__etroit" (change)="fond($any($event.target).value)">
                <option value="">Fond</option><option value="-">aucun</option>
                @for (f of fonds(); track f[0]) { <option [value]="f[0]">{{ f[1] }}</option> }
              </select>
              <select aria-label="Ligne répétée" (change)="repeter($any($event.target).value)">
                <option value="">Ligne répétée</option><option value="-">non répétée</option>
                @for (l of listes(); track l.nom) { <option [value]="l.nom">une par {{ l.libelle }}</option> }
              </select>
              <button type="button" (click)="cmd((c) => c.deleteTable())" aria-label="Supprimer le tableau" title="Supprimer le tableau">✕</button>
            }
          </span>
          <span class="edp__grp" role="group" aria-label="Insérer">
            <span class="edp__grp-t" aria-hidden="true">Insérer</span>
            <button type="button" (click)="cmd((c) => c.setHardBreak())" title="Saut de ligne, sans nouveau paragraphe (Maj+Entrée)">Saut de ligne</button>
            <button type="button" (click)="cmd((c) => c.insererSautDePage())" title="Saut de page">Saut de page</button>
            <button type="button" (click)="emblemeInserer()" title="Insérer l’emblème">Emblème</button>
            <label class="edp__fichier" title="Insérer une image (PNG ou JPEG)">Image
              <input type="file" accept="image/png,image/jpeg" class="cnm-sr-only" (change)="imageDeposer($event)" />
            </label>
            <button type="button" (click)="cmd((c) => c.insertContent({ type: 'numeroPage' }))" title="Numéro de page">N° de page</button>
          </span>
        }
        <span class="edp__fin">
          @if (nbBloquants() > 0) {
            <button type="button" class="badge badge-danger edp__bloquants" (click)="voirRapport.emit()" title="Voir le rapport de contrôle">{{ nbBloquants() }} bloquant(s)</button>
          } @else {
            <span class="badge badge-success">Sans blocage</span>
          }
          <span class="edp__etat" role="status">{{ modifie() ? 'Non enregistré' : 'Enregistré' }}</span>
          @if (!figee()) {
            <button type="button" class="btn btn-primary btn-sm" [disabled]="enregistrement() || !modifie()" (click)="enregistrer.emit(document())">
              {{ enregistrement() ? 'Enregistrement…' : 'Enregistrer' }}
            </button>
          }
          <button type="button" class="btn btn-secondary btn-sm" [disabled]="enregistrement()" (click)="nouvelleVersion.emit(document())" title="Enregistrer comme nouvelle version">Nouvelle version</button>
        </span>
      </div>
      @if (message(); as m) { <p class="form-error" role="alert">{{ m }}</p> }

      <div class="edp__plan">
        <div class="edp__defile">
          <div class="edp__feuille" [style.font-family]="reglages().police || 'Times New Roman'" [style.font-size.pt]="reglages().taille || 12"
               [style.padding-top.mm]="reglages().marges?.haut ?? 25" [style.padding-bottom.mm]="reglages().marges?.bas ?? 20"
               [style.padding-left.mm]="reglages().marges?.gauche ?? 25" [style.padding-right.mm]="reglages().marges?.droite ?? 25"
               [class.edp__feuille--paysage]="reglages().orientation === 'paysage'">
            <div class="edp__zone edp__zone--entete" [class.edp__zone--active]="zoneActive() === 'entete'">
              <span class="edp__zone-t">En-tête — {{ surPremiere() ? 'première page seulement' : 'chaque page' }}</span>
              <div #entete></div>
            </div>
            <div class="edp__zone" [class.edp__zone--active]="zoneActive() === 'corps'"><div #corps></div></div>
            <div class="edp__zone edp__zone--pied" [class.edp__zone--active]="zoneActive() === 'piedDePage'">
              <span class="edp__zone-t">Pied de page — chaque page</span>
              <div #pied></div>
            </div>
          </div>
        </div>

        <aside class="edp__panneau" aria-label="Insérer et régler">
          @if (!figee()) {
            <div class="edp__ongl" role="tablist" aria-label="Panneau">
              @for (o of onglets; track o.cle) {
                <button type="button" role="tab" [attr.aria-selected]="panneau() === o.cle" [class.on]="panneau() === o.cle" (click)="panneau.set(o.cle)">{{ o.libelle }}</button>
              }
            </div>
            @switch (panneau()) {
              @case ('inserer') {
                <section>
                  <div class="edp__titre-ligne">
                    <h4>Valeurs du dossier</h4>
                    <label class="edp__format">Format
                      <select aria-label="Format de la valeur" [value]="format()" (change)="format.set($any($event.target).value)">
                        <option value="">tel quel</option>
                        @for (f of formats(); track f) { <option [value]="f">{{ f }}</option> }
                      </select>
                    </label>
                  </div>
                  @for (g of groupes(); track g.nom) {
                    <details class="edp__det" [open]="$index < 3">
                      <summary>{{ g.nom }} <span class="edp__nb">{{ g.variables.length }}</span></summary>
                      <div class="edp__puces">
                        @for (vr of g.variables; track vr.code) {
                          <button type="button" class="edp__puce" [title]="vr.code + (vr.exemple ? ' — ex. ' + vr.exemple : '')" (click)="insererVariable(vr.code)">{{ libelleCourt(vr.libelle) }}</button>
                        }
                      </div>
                    </details>
                  }
                </section>
                <section>
                  <h4>Champs du formulaire</h4>
                  <div class="edp__puces">
                    @for (c of champsProposes(); track c.code) {
                      <button type="button" class="edp__puce edp__puce--champ" (click)="cmd((x) => x.insererChamp(c.code))">{{ c.libelle }}</button>
                    }
                  </div>
                  <p class="edp__aide">Un champ nouveau se déclare dans l’onglet « Champs saisis ».</p>
                </section>
              }
              @case ('passages') {
                <section>
                  <h4>Passage conditionnel</h4>
                  <p class="edp__aide">Sélectionnez dans la page quelques mots ou des paragraphes entiers, puis la règle : le passage ne s’imprimera que si elle est vraie.</p>
                  <div class="edp__puces edp__puces--col">
                    @for (r of reglesProposees(); track r.nom) {
                      <button type="button" class="edp__puce edp__puce--bloc" [title]="r.nom" (click)="encadrer(r.nom)">{{ r.libelle }}</button>
                    }
                  </div>
                  @if (etat().cadre) { <button type="button" class="edp__lien" (click)="cmd((c) => c.retirerCadre())">Retirer le cadre autour du curseur</button> }
                </section>
              }
              @case ('page') {
                <section>
                  <h4>La page</h4>
                  <div class="edp__reglages">
                    <label>Police par défaut
                      <select [value]="reglages().police || 'Times New Roman'" (change)="regler({ police: $any($event.target).value })">
                        @for (p of polices(); track p) { <option [value]="p" [selected]="p === (reglages().police || 'Times New Roman')">{{ p }}</option> }
                      </select>
                    </label>
                    <label>Taille
                      <select [value]="'' + (reglages().taille || 12)" (change)="regler({ taille: +$any($event.target).value })">
                        @for (t of tailles; track t) { <option [value]="'' + t" [selected]="t === (reglages().taille || 12)">{{ t }}</option> }
                      </select>
                    </label>
                    <label class="edp__large">Orientation
                      <select [value]="reglages().orientation || 'portrait'" (change)="regler({ orientation: $any($event.target).value })">
                        <option value="portrait" [selected]="reglages().orientation !== 'paysage'">portrait</option><option value="paysage" [selected]="reglages().orientation === 'paysage'">paysage</option>
                      </select>
                    </label>
                    @for (m of marges; track m.cle) {
                      <label>Marge {{ m.libelle }} (mm)
                        <input type="number" min="0" max="60" [value]="reglages().marges?.[m.cle] ?? m.defaut" (change)="marge(m.cle, +$any($event.target).value)" />
                      </label>
                    }
                    <label class="edp__case"><input type="checkbox" [checked]="surPremiere()" (change)="surPremiere.set($any($event.target).checked); modifie.set(true)" /> En-tête sur la première page seulement</label>
                  </div>
                </section>
              }
            }
          } @else {
            <p class="edp__aide">Version figée : elle se lit seulement. Pour la changer, enregistrez-la comme nouvelle version.</p>
          }
        </aside>
      </div>
    </div>
  `,
  styles: `
    .edp { display: flex; flex-direction: column; gap: 0.6rem; }
    /* La barre reste visible pendant qu'on descend dans la feuille : collée sous la barre de l'application (48 px). */
    .edp__barre { position: sticky; top: 48px; z-index: 5; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 8px 10px;
      background: #fff; border: 1px solid var(--n-200); border-radius: 10px; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.06); }
    .edp__grp { display: inline-flex; gap: 2px; align-items: center; border: 1px solid var(--n-200); border-radius: 8px; padding: 2px 4px; background: #fff; }
    .edp__grp-t { font: 600 10px 'Segoe UI', sans-serif; letter-spacing: 0.04em; text-transform: uppercase; color: var(--n-500); padding: 0 4px 0 2px; }
    .edp__grp select.edp__etroit { max-width: 6.5rem; }
    .edp__grp select.edp__moyen { max-width: 9rem; }
    .edp__grp sup { font-size: 9px; }
    .edp__fin { margin-left: auto; display: inline-flex; gap: 8px; align-items: center; flex-wrap: wrap; }
    .edp__bloquants { cursor: pointer; border: 0; font: inherit; }
    .edp__bloquants:focus-visible { outline: 2px solid var(--p-700); outline-offset: 2px; }
    .edp__grp button, .edp__fichier { border: 0; background: transparent; min-width: 28px; height: 28px; padding: 0 6px; border-radius: 6px; cursor: pointer; font: inherit; font-size: 13px; color: var(--n-800); display: inline-flex; align-items: center; }
    .edp__grp button:hover, .edp__fichier:hover { background: var(--n-100); }
    .edp__grp button.on { background: var(--p-50); color: var(--p-700); }
    .edp__grp button:focus-visible, .edp__fichier:focus-within, .edp__puce:focus-visible { outline: 2px solid var(--p-700); outline-offset: 1px; }
    .edp__grp select { height: 28px; border: 0; background: transparent; font: inherit; font-size: 13px; max-width: 9rem; }
    .edp__plan { display: grid; grid-template-columns: minmax(0, 1fr) 19rem; gap: 1rem; align-items: start; }
    /* Tout s'affiche, sans défilement interne (demande du pilote, 21/10) : la page défile comme le reste de l'application.
       Seule une fenêtre plus étroite que la feuille A4 la fait défiler en largeur. */
    .edp__defile { overflow-x: auto; background: var(--n-100); border-radius: 10px; padding: 16px; }
    .edp__feuille { width: 210mm; min-height: 297mm; margin: 0 auto; background: #fff; box-shadow: 0 1px 4px rgba(15, 23, 42, 0.15); color: #000; line-height: 1.25; display: flex; flex-direction: column; }
    .edp__feuille--paysage { width: 297mm; min-height: 210mm; }
    .edp__zone { position: relative; border: 1px dashed transparent; border-radius: 4px; }
    .edp__zone--entete, .edp__zone--pied { border-color: var(--n-200); min-height: 14mm; margin: 0 0 6mm; }
    .edp__zone--pied { margin: auto 0 0; }
    .edp__zone--active { border-color: var(--p-300, #7dd3fc); }
    .edp__zone-t { position: absolute; top: -9px; right: 6px; background: #fff; padding: 0 4px; font: 600 10.5px 'Segoe UI', sans-serif; color: var(--n-500); }
    .edp .ProseMirror { outline: none; min-height: 1.5em; }
    .edp .ProseMirror p { margin: 0 0 4pt; }
    .edp .ProseMirror table { border-collapse: collapse; width: 100%; margin: 4pt 0; table-layout: fixed; }
    .edp .ProseMirror td, .edp .ProseMirror th { border: 1px solid #000; padding: 3pt 5pt; vertical-align: top; }
    .edp .ProseMirror table[data-sans-bordures] td, .edp .ProseMirror table[data-sans-bordures] th,
    .edp .ProseMirror td[data-sans-bordures], .edp .ProseMirror th[data-sans-bordures] { border: 1px dotted #d0d8e8; }
    .edp .ProseMirror .selectedCell { background: #e0f2fe; }
    .edp .pg-var, .edp .pg-champ { display: inline-block; padding: 0 5px; border-radius: 9px; font: 11px/16px 'Segoe UI', sans-serif; white-space: nowrap; vertical-align: 1px; }
    .edp .pg-var { background: #e0f2fe; color: #075985; border: 1px solid #7dd3fc; }
    .edp .pg-champ { background: #fef9c3; color: #854d0e; border: 1px solid #fde68a; }
    .edp .ProseMirror-selectednode.pg-var, .edp .ProseMirror-selectednode.pg-champ { outline: 2px solid #0369a1; }
    .edp .pg-bloc { position: relative; border: 1.5px dashed #7dd3fc; border-radius: 5px; padding: 14px 6px 2px; margin: 8px 0 6px; }
    .edp .pg-bloc::before { content: attr(data-libelle); position: absolute; top: -9px; left: 8px; background: #fff; padding: 0 5px; font: 600 10.5px 'Segoe UI', sans-serif; color: #0369a1; }
    .edp .pg-bloc[data-bloc='DEFAVORABLE'] { border-color: #fecaca; } .edp .pg-bloc[data-bloc='DEFAVORABLE']::before { color: #991b1b; }
    .edp .pg-bloc[data-bloc='AVEC_RESERVES'] { border-color: #fde68a; } .edp .pg-bloc[data-bloc='AVEC_RESERVES']::before { color: #854d0e; }
    .edp .pg-bloc[data-bloc='FAVORABLE'] { border-color: #a7f3d0; } .edp .pg-bloc[data-bloc='FAVORABLE']::before { color: #065f46; }
    .edp .pg-bloc-ligne { border-bottom: 2px dashed #0369a1; background: #f0f9ff; }
    .edp .pg-saut { margin: 8px 0; border-top: 2px dashed #94a3b8; text-align: center; font: 600 10.5px 'Segoe UI', sans-serif; color: #586586; padding-top: 2px; }
    .edp tr.pg-repetee { outline: 1.5px dashed #0369a1; outline-offset: -2px; }
    .edp tr.pg-repetee > :first-child::before { content: '↻ une ligne par élément de ' attr(data-liste); display: block; font: 600 10px 'Segoe UI', sans-serif; color: #0369a1; }
    .edp .pg-image img { max-width: 100%; }
    /* Le panneau reste à côté de la feuille pendant qu'on la parcourt (sous la barre d'outils). */
    /* Sous la barre d’outils, quelle que soit sa hauteur (une ou deux lignes selon la largeur) : --edp-barre la suit. */
    .edp__panneau { position: sticky; top: calc(48px + var(--edp-barre, 52px) + 12px); display: flex; flex-direction: column; gap: 0.8rem; font-size: 13px; background: #fff;
      border: 1px solid var(--n-200); border-radius: 10px; padding: 10px 12px; }
    .edp__ongl { display: flex; gap: 4px; border-bottom: 1px solid var(--n-200); padding-bottom: 8px; }
    .edp__ongl button { flex: 1; border: 1px solid var(--n-200); background: #fff; border-radius: 999px; padding: 4px 8px; font: 600 12px 'Segoe UI', sans-serif; color: var(--n-700); cursor: pointer; }
    .edp__ongl button.on { background: var(--n-800); border-color: var(--n-800); color: #fff; }
    .edp__ongl button:focus-visible { outline: 2px solid var(--p-700); outline-offset: 1px; }
    .edp__titre-ligne { display: flex; justify-content: space-between; align-items: center; gap: 6px; }
    .edp__det { margin: 4px 0; }
    .edp__det summary { cursor: pointer; font-size: 12px; font-weight: 600; color: var(--n-700); padding: 2px 0; }
    .edp__nb { font-weight: 400; color: var(--n-500); }
    .edp__puces--col { flex-direction: column; align-items: flex-start; }
    .edp__large { grid-column: 1 / -1; }
    .edp__panneau h4 { margin: 0 0 4px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: var(--p-700); }
    .edp__groupe { margin: 6px 0 3px; font-size: 11.5px; font-weight: 600; color: var(--n-700); }
    .edp__puces { display: flex; flex-wrap: wrap; gap: 4px; }
    .edp__puce { border: 1px solid #7dd3fc; background: var(--p-50); color: var(--p-800, #075985); border-radius: 10px; font: 12px 'Segoe UI', sans-serif; padding: 1px 8px; cursor: pointer; }
    .edp__puce--champ { border-color: #fde68a; background: #fef9c3; color: #854d0e; }
    .edp__puce--bloc { border-style: dashed; background: #fff; }
    .edp__aide { margin: 4px 0; font-size: 12px; color: var(--n-500); }
    .edp__lien { border: 0; background: none; padding: 0; margin-top: 4px; color: var(--p-700); text-decoration: underline; cursor: pointer; font: inherit; font-size: 12px; }
    .edp__format { display: flex; gap: 6px; align-items: center; font-size: 12px; color: var(--n-700); }
    .edp__reglages { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
    .edp__reglages label { display: flex; flex-direction: column; gap: 2px; font-size: 11.5px; color: var(--n-700); }
    .edp__reglages input, .edp__reglages select { font: inherit; font-size: 12.5px; padding: 3px 5px; border: 1px solid var(--n-400, #667299); border-radius: 6px; }
    .edp__reglages .edp__case { grid-column: 1 / -1; flex-direction: row; align-items: center; gap: 6px; }
    .edp__etat { font-size: 12.5px; color: var(--n-500); }
    @media (max-width: 1100px) { .edp__plan { grid-template-columns: 1fr; } .edp__panneau { position: static; } }
  `,
})
export class EditeurPage implements AfterViewInit, OnDestroy {
  private readonly service = inject(ModelePvService);

  /** Le document de la version affichée (nul : page vierge). */
  readonly documentInitial = input<DocumentPage | null>(null);
  readonly catalogue = input<CatalogueModelePv | null>(null);
  readonly schema = input<SchemaModelePv | null>(null);
  readonly conditions = input<ConditionModelePv[]>([]);
  readonly champs = input<ChampModelePv[]>([]);
  readonly figee = input(false);
  readonly enregistrement = input(false);
  /** Le nombre de points bloquants du rapport, rappelé dans la barre. */
  readonly nbBloquants = input(0);
  /** Amène au rapport de contrôle (sous l'éditeur). */
  readonly voirRapport = output<void>();
  /** Enregistre le brouillon (`PUT …/document`). */
  readonly enregistrer = output<DocumentPage>();
  /** Enregistre comme nouvelle version (`POST …/versions`). */
  readonly nouvelleVersion = output<DocumentPage>();

  private readonly hEntete = viewChild.required<ElementRef<HTMLElement>>('entete');
  private readonly hCorps = viewChild.required<ElementRef<HTMLElement>>('corps');
  private readonly hPied = viewChild.required<ElementRef<HTMLElement>>('pied');
  private readonly hBarre = viewChild.required<ElementRef<HTMLElement>>('barre');
  /** La hauteur de la barre d'outils, suivie pour coller le panneau juste dessous. */
  readonly hauteurBarre = signal(52);
  private observateur: ResizeObserver | null = null;
  private editeurs: Partial<Record<Zone, Editor>> = {};

  readonly tailles = TAILLES;
  readonly alignements = [
    { cle: 'left', libelle: 'Aligner à gauche', icone: '⟸' },
    { cle: 'center', libelle: 'Centrer', icone: '≡' },
    { cle: 'right', libelle: 'Aligner à droite', icone: '⟹' },
    { cle: 'justify', libelle: 'Justifier', icone: '☰' },
  ];
  readonly marges: readonly { cle: 'haut' | 'bas' | 'gauche' | 'droite'; libelle: string; defaut: number }[] = [
    { cle: 'haut', libelle: 'haute', defaut: 25 },
    { cle: 'bas', libelle: 'basse', defaut: 20 },
    { cle: 'gauche', libelle: 'gauche', defaut: 25 },
    { cle: 'droite', libelle: 'droite', defaut: 25 },
  ];

  readonly zoneActive = signal<Zone>('corps');
  readonly onglets: readonly { cle: 'inserer' | 'passages' | 'page'; libelle: string }[] = [
    { cle: 'inserer', libelle: 'Insérer' },
    { cle: 'passages', libelle: 'Passages' },
    { cle: 'page', libelle: 'Page' },
  ];
  readonly panneau = signal<'inserer' | 'passages' | 'page'>('inserer');
  readonly reglages = signal<ReglagesPage>({ format: 'A4' });
  readonly surPremiere = signal(false);
  readonly modifie = signal(false);
  readonly format = signal('');
  readonly message = signal<string | null>(null);
  readonly etat = signal({
    gras: false, italique: false, souligne: false, alignement: '', tableau: false, cadre: false,
    style: 'p', police: '', taille: 0, couleur: '', interligne: 0, premiereLigne: 0, espacement: '',
  });
  readonly styles = [
    { cle: 'p', libelle: 'Normal' },
    { cle: 'h1', libelle: 'Titre 1' },
    { cle: 'h2', libelle: 'Titre 2' },
    { cle: 'h3', libelle: 'Titre 3' },
  ];
  readonly retraitsPremiere = [0, 5, 10, 15];
  readonly interlignes = [
    { v: 0, libelle: 'Interligne' },
    { v: 1, libelle: 'simple' },
    { v: 1.15, libelle: '1,15' },
    { v: 1.5, libelle: '1,5' },
    { v: 2, libelle: 'double' },
  ];
  /** Espacement avant / après, en points. */
  readonly espacements = [
    { cle: '', libelle: 'Espacement', avant: null, apres: null },
    { cle: '0-0', libelle: 'aucun', avant: 0, apres: 0 },
    { cle: '0-6', libelle: '6 pt après', avant: 0, apres: 6 },
    { cle: '0-12', libelle: '12 pt après', avant: 0, apres: 12 },
    { cle: '6-6', libelle: '6 pt avant et après', avant: 6, apres: 6 },
    { cle: '12-12', libelle: '12 pt avant et après', avant: 12, apres: 12 },
  ] as const;

  readonly polices = computed(() => this.schema()?.polices ?? ['Times New Roman', 'Arial']);
  readonly couleurs = computed(() => Object.entries(this.schema()?.couleurs ?? {}));
  readonly fonds = computed(() => Object.entries(this.schema()?.fonds ?? {}));
  readonly formats = computed(() => this.schema()?.formats ?? this.catalogue()?.formats ?? []);
  readonly groupes = computed(() => (this.catalogue()?.groupes ?? []).filter((g) => g.variables.length));
  readonly listes = computed(() => this.catalogue()?.listes ?? []);
  private readonly libellesVariables = computed(() => {
    const m = new Map<string, string>();
    for (const g of this.catalogue()?.groupes ?? []) for (const v of g.variables) m.set(v.code, this.libelleCourt(v.libelle));
    return m;
  });

  /** Le libellé seul : l'explication du catalogue (« (|lettres : … ) », « : favorable, … ») reste dans l'infobulle. */
  libelleCourt(libelle: string): string {
    return libelle.replace(/\s*(\(|:).*$/, '').trim() || libelle;
  }
  readonly champsProposes = computed(() => {
    const c = this.champs().map((x) => ({ code: x.code, libelle: x.libelle }));
    for (const [code, libelle] of [['motif_defavorable', 'Motif de l’avis défavorable'], ['observation_generale', 'Observation générale']]) {
      if (!c.some((x) => x.code === code)) c.push({ code, libelle });
    }
    return c;
  });
  readonly reglesProposees = computed(() => {
    const r = this.conditions().map((c) => ({ nom: c.nom, libelle: c.libelle || REGLES_USUELLES[c.nom] || `Si ${c.nom}` }));
    for (const [nom, libelle] of Object.entries(REGLES_USUELLES)) if (!r.some((x) => x.nom === nom) && expressionProposee(nom)) r.push({ nom, libelle });
    return r;
  });

  constructor() {
    // Une autre version : on recharge les trois zones et les réglages.
    effect(() => {
      const d = this.documentInitial();
      if (this.editeurs.corps) this.charger(d);
    });
    effect(() => {
      const f = this.figee();
      for (const e of Object.values(this.editeurs)) e?.setEditable(!f);
    });
  }

  ngAfterViewInit(): void {
    const ctx = {
      libelleVariable: (code: string) => this.libellesVariables().get(code) ?? code,
      libelleChamp: (code: string) => this.champsProposes().find((c) => c.code === code)?.libelle ?? code,
      libelleCondition: (nom: string) => this.reglesProposees().find((r) => r.nom === nom)?.libelle ?? `Si ${nom}`,
      urlImage: (id: number) => this.service.urlImage(id),
    };
    const hotes: Record<Zone, HTMLElement> = { entete: this.hEntete().nativeElement, corps: this.hCorps().nativeElement, piedDePage: this.hPied().nativeElement };
    for (const z of ZONES) {
      const e = new Editor({ element: hotes[z], extensions: extensionsPage(ctx), content: docVide(), editable: !this.figee() });
      e.on('focus', () => {
        this.zoneActive.set(z);
        this.majEtat();
      });
      e.on('selectionUpdate', () => this.majEtat());
      e.on('update', () => {
        this.modifie.set(true);
        this.majEtat();
      });
      this.editeurs[z] = e;
    }
    this.charger(this.documentInitial());
    if (typeof ResizeObserver !== 'undefined') {
      this.observateur = new ResizeObserver(([e]) => this.hauteurBarre.set(Math.round(e.target.getBoundingClientRect().height)));
      this.observateur.observe(this.hBarre().nativeElement);
    }
  }

  ngOnDestroy(): void {
    this.observateur?.disconnect();
    for (const e of Object.values(this.editeurs)) e?.destroy();
  }

  private charger(d: DocumentPage | null): void {
    this.reglages.set({ format: 'A4', ...(d?.page ?? {}) });
    this.surPremiere.set(!!d?.enteteSurPremiereSeulement);
    this.editeurs.entete?.commands.setContent(depuisServeur(d?.entete), { emitUpdate: false });
    this.editeurs.corps?.commands.setContent(depuisServeur(d?.corps), { emitUpdate: false });
    this.editeurs.piedDePage?.commands.setContent(depuisServeur(d?.piedDePage), { emitUpdate: false });
    this.modifie.set(false);
    this.message.set(null);
  }

  /** Le document à enregistrer, depuis les trois zones. */
  document(): DocumentPage {
    const json = (z: Zone) => (this.editeurs[z]?.getJSON() as NoeudPage | undefined) ?? docVide();
    return enveloppe(this.reglages(), json('entete'), json('corps'), json('piedDePage'), this.surPremiere());
  }

  /** Marque le document comme enregistré (appelé par la fiche après un enregistrement réussi). */
  marquerEnregistre(): void {
    this.modifie.set(false);
  }

  private get actif(): Editor | undefined {
    return this.editeurs[this.zoneActive()];
  }

  // `ChainedCommands` n'est pas exporté sous un nom stable : on le tire de l'éditeur.
  cmd(f: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>): void {
    const e = this.actif;
    if (!e) return;
    f(e.chain().focus()).run();
  }

  police(p: string): void {
    if (p) this.cmd((c) => c.setFontFamily(p));
  }

  style(cle: string): void {
    if (cle === 'p') this.cmd((c) => c.setParagraph());
    else this.cmd((c) => c.setHeading({ level: Number(cle.slice(1)) as 1 | 2 | 3 }));
  }

  /** Agrandit ou réduit le texte sélectionné d'un cran de la liste des tailles. */
  pas(sens: 1 | -1): void {
    const actuelle = this.etat().taille || this.reglages().taille || 12;
    const i = TAILLES.findIndex((t) => t >= actuelle);
    const j = Math.min(TAILLES.length - 1, Math.max(0, (i < 0 ? TAILLES.length - 1 : i) + sens));
    this.cmd((c) => c.setFontSize(`${TAILLES[j]}pt`));
  }

  /** Pose des attributs de paragraphe (titres compris), sur tous les paragraphes de la sélection. */
  paragraphe(attrs: Record<string, number | null>): void {
    this.cmd((c) => c.updateAttributes('paragraph', attrs).updateAttributes('heading', attrs));
  }

  retrait(pasMm: number): void {
    const e = this.actif;
    if (!e) return;
    const actuel = Number(e.getAttributes('paragraph')['retrait'] ?? e.getAttributes('heading')['retrait'] ?? 0) || 0;
    const r = Math.max(0, Math.min(60, actuel + pasMm));
    this.paragraphe({ retrait: r || null });
  }

  espacement(cle: string): void {
    const e = this.espacements.find((x) => x.cle === cle);
    if (e && cle) this.paragraphe({ espaceAvant: e.avant, espaceApres: e.apres });
  }

  taille(t: string): void {
    if (t) this.cmd((c) => c.setFontSize(`${t}pt`));
  }

  couleur(c: string): void {
    if (c === '-') this.cmd((x) => x.unsetColor());
    else if (c) this.cmd((x) => x.setColor(c));
  }

  fond(f: string): void {
    if (f) this.cmd((c) => c.setCellAttribute('fond', f === '-' ? null : f));
  }

  repeter(liste: string): void {
    if (liste) this.cmd((c) => c.repeterLigne(liste === '-' ? null : liste));
  }

  insererVariable(code: string): void {
    this.cmd((c) => c.insererVariable(code, this.format() || null));
  }

  encadrer(condition: string): void {
    const e = this.actif;
    if (!e) return;
    if (e.state.selection.empty) {
      this.message.set('Sélectionnez d’abord le passage à encadrer.');
      return;
    }
    this.message.set(null);
    e.chain().focus().encadrer(condition).run();
  }

  regler(r: Partial<ReglagesPage>): void {
    this.reglages.update((x) => ({ ...x, ...r }));
    this.modifie.set(true);
  }

  marge(cle: 'haut' | 'bas' | 'gauche' | 'droite', valeur: number): void {
    if (!Number.isFinite(valeur) || valeur < 0 || valeur > 60) return;
    this.reglages.update((x) => ({ ...x, marges: { haut: 25, bas: 20, gauche: 25, droite: 25, ...(x.marges ?? {}), [cle]: valeur } }));
    this.modifie.set(true);
  }

  emblemeInserer(): void {
    this.service.embleme().subscribe({
      next: (i) => this.cmd((c) => c.insererImagePage(i.idImage, 25)),
      error: (e: ApiError) => this.message.set(e.message || 'L’emblème n’a pas pu être chargé.'),
    });
  }

  imageDeposer(ev: Event): void {
    const champ = ev.target as HTMLInputElement;
    const f = champ.files?.[0];
    champ.value = '';
    if (!f) return;
    const refus = validerFichier(f, TYPES_IMAGE, 2);
    if (refus) {
      this.message.set(refus);
      return;
    }
    this.service.deposerImage(f).subscribe({
      next: (i) => this.cmd((c) => c.insererImagePage(i.idImage, 40)),
      error: (e: ApiError) => this.message.set(e.message || 'L’image n’a pas été acceptée.'),
    });
  }

  /** Amène le curseur sur le nœud désigné par le chemin d'un point du rapport (`corps/1/1`). */
  allerA(chemin: string | null | undefined): void {
    const c = cheminVersZone(chemin);
    const e = c ? this.editeurs[c.zone] : undefined;
    if (!c || !e) return;
    let noeud: NoeudPm = e.state.doc;
    let base = 0;
    let debut = 0;
    for (const [k, r] of c.rangs.entries()) {
      if (r >= noeud.childCount) return;
      let decalage = 0;
      for (let j = 0; j < r; j++) decalage += noeud.child(j).nodeSize;
      debut = base + decalage;
      noeud = noeud.child(r);
      if (k < c.rangs.length - 1) base = debut + 1;
    }
    this.zoneActive.set(c.zone);
    const chaine = e.chain().focus();
    (noeud.isInline && noeud.isAtom ? chaine.setNodeSelection(debut) : chaine.setTextSelection(debut + 1)).scrollIntoView().run();
  }

  private majEtat(): void {
    const e = this.actif;
    if (!e) return;
    const $f = e.state.selection.$from;
    let cadre = false;
    for (let d = $f.depth; d > 0; d--) if (['bloc', 'blocEnLigne'].includes($f.node(d).type.name)) cadre = true;
    const align = ['left', 'center', 'right', 'justify'].find((a) => e.isActive({ textAlign: a })) ?? '';
    const ts = e.getAttributes('textStyle');
    const para = e.isActive('heading') ? e.getAttributes('heading') : e.getAttributes('paragraph');
    const niveau = e.isActive('heading') ? Number(e.getAttributes('heading')['level']) : 0;
    const avant = para['espaceAvant'] as number | null | undefined;
    const apres = para['espaceApres'] as number | null | undefined;
    this.etat.set({
      gras: e.isActive('bold'), italique: e.isActive('italic'), souligne: e.isActive('underline'), alignement: align, tableau: e.isActive('table'), cadre,
      style: niveau ? `h${niveau}` : 'p',
      police: (ts['fontFamily'] as string) ?? '',
      taille: parseFloat(String(ts['fontSize'] ?? '')) || 0,
      couleur: (ts['color'] as string) ?? '',
      interligne: Number(para['interligne'] ?? 0) || 0,
      premiereLigne: Number(para['retraitPremiereLigne'] ?? 0) || 0,
      espacement: avant == null && apres == null ? '' : `${avant ?? 0}-${apres ?? 0}`,
    });
  }
}
