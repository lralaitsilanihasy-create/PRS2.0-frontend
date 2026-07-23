import { Injectable, inject } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';

import { Capm, FormeMarche, SaisieImportMarche } from '../../models';

/**
 * Fabrique **partagée** des sous-formulaires d'une ligne de marché PPM (marché, bénéficiaire, lot,
 * processus/CAPM), avec un compteur d'`uid` **stable** (clé de ligne pour le track/binding, jamais
 * l'index). Utilisée par la grille de saisie (`PpmSaisieGrid`) et les écrans qui la portent, afin de
 * construire les mêmes structures des deux côtés (soumission ET réimport dans le détail PPM).
 */
@Injectable({ providedIn: 'root' })
export class PpmFormFactory {
  private readonly fb = inject(FormBuilder);
  private uid = 0;
  private nextUid(): number {
    return ++this.uid;
  }

  /** Groupe bénéficiaire { soaCode, numCompte, ancMontBenef, nouvMontBenef } (uid stable). */
  ligneBeneficiaire(b?: { soaCode?: string; numCompte?: string; ancMontBenef?: number; nouvMontBenef?: number }): FormGroup {
    return this.fb.group({
      uid: [this.nextUid()],
      soaCode: [b?.soaCode ?? ''],
      numCompte: [b?.numCompte ?? ''],
      ancMontBenef: [b?.ancMontBenef ?? (null as number | null)],
      nouvMontBenef: [b?.nouvMontBenef ?? (null as number | null)],
    });
  }

  /** Groupe lot { designationLot*, montLot, qteLot, uniteLot } (désignation obligatoire, uid stable). */
  ligneLot(l?: { designationLot?: string; montLot?: number | null; qteLot?: number | null; uniteLot?: string }): FormGroup {
    return this.fb.group({
      uid: [this.nextUid()],
      designationLot: [l?.designationLot ?? '', Validators.required],
      montLot: [l?.montLot ?? (null as number | null)],
      qteLot: [l?.qteLot ?? (null as number | null)],
      uniteLot: [l?.uniteLot ?? ''],
    });
  }

  /** Groupe processus prévisionnel { idCapm*, dateDebut*, dateFin? } (uid stable ; date de fin optionnelle). */
  processusGroup(p?: { idCapm?: number | null; dateDebut?: string; dateFin?: string }): FormGroup {
    return this.fb.group({
      uid: [this.nextUid()],
      idCapm: [p?.idCapm ?? null, Validators.required],
      dateDebut: [p?.dateDebut ?? '', Validators.required],
      dateFin: [p?.dateFin ?? ''],
    });
  }

  /** Ligne de marché complète (au moins un bénéficiaire ; nature/mode en saisie libre ; forme = défaut). */
  ligneMarche(): FormGroup {
    return this.fb.group({
      uid: [this.nextUid()],
      designationMarche: [''],
      montEstim: [null as number | null],
      nouvMontEstim: [null as number | null],
      numCompte: [null as string | null],
      financement: [''],
      statut: ['PREVU'],
      natureLibelle: [''],
      modeLibelle: [''],
      formeMarche: ['QUANTITE_FIXE' as FormeMarche],
      beneficiaires: this.fb.array([this.ligneBeneficiaire()]),
      lots: this.fb.array([] as FormGroup[]),
      processus: this.fb.array([] as FormGroup[]),
    });
  }

  /**
   * Montant à retenir pour le **lot-objet** dérivé d'un marché : le nouveau montant estimatif s'il est
   * renseigné (marché révisé), sinon le montant estimatif initial ; `undefined` si les deux sont vides.
   */
  montantLotObjet(montEstim: unknown, nouvMontEstim: unknown): number | undefined {
    if (nouvMontEstim != null && nouvMontEstim !== '') return Number(nouvMontEstim);
    return montEstim != null && montEstim !== '' ? Number(montEstim) : undefined;
  }

  /**
   * Construit une ligne de marché **entièrement pré-remplie** depuis une ligne d'import PDF/xlsx
   * (bénéficiaires, lots, processus résolus par libellé CAPM) — logique unique partagée par tous les
   * appelants (même mapping qu'à la saisie).
   */
  construireMarcheDepuisImport(m: SaisieImportMarche, capms: Capm[]): FormGroup {
    const g = this.ligneMarche();
    g.patchValue({
      designationMarche: m.designationMarche ?? '',
      montEstim: m.montEstim ?? null,
      nouvMontEstim: m.nouvMontEstim ?? null,
      numCompte: m.beneficiaires?.[0]?.numCompte ?? null,
      financement: m.financement ?? '',
      natureLibelle: m.natureLibelle ?? '',
      modeLibelle: m.modeLibelle ?? '',
      formeMarche: m.formeMarche ?? ('QUANTITE_FIXE' as FormeMarche),
    });
    const benefArr = g.get('beneficiaires') as FormArray;
    benefArr.clear();
    for (const b of m.beneficiaires ?? []) {
      benefArr.push(this.ligneBeneficiaire({ soaCode: b.soaCode, numCompte: b.numCompte, ancMontBenef: b.ancMontBenef, nouvMontBenef: b.nouvMontBenef }));
    }
    if (!benefArr.length) benefArr.push(this.ligneBeneficiaire());
    const lotArr = g.get('lots') as FormArray;
    for (const lt of m.lots ?? []) {
      if (!lt.designationLot) continue;
      lotArr.push(this.ligneLot({ designationLot: lt.designationLot, montLot: lt.montLot, qteLot: lt.qteLot, uniteLot: lt.uniteLot }));
    }
    const procArr = g.get('processus') as FormArray;
    for (const p of m.previsions ?? []) {
      const idCapm = capms.find((c) => (c.libelleProcessus ?? '').toUpperCase() === (p.processus ?? '').toUpperCase())?.idCapm ?? null;
      procArr.push(this.processusGroup({ idCapm, dateDebut: p.dateDebut, dateFin: '' }));
    }
    return g;
  }
}
