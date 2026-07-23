import { Injectable, inject } from '@angular/core';
import { FormArray, FormBuilder, FormGroup, Validators } from '@angular/forms';

import { Capm, FormeMarche, SaisieImportMarche, SaisieMarcheLigne, SaisieMarcheLot } from '../../models';

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

  /**
   * Une ligne de marché (valeur brute du formulaire) est-elle **non vide** ? (`statut`, valeur par
   * défaut, exclu). Sert à filtrer les lignes avant l'envoi au serveur.
   */
  ligneNonVide(l: Record<string, unknown>): boolean {
    return !!(
      l['designationMarche'] ||
      l['montEstim'] != null ||
      l['nouvMontEstim'] != null ||
      l['numCompte'] ||
      l['financement'] ||
      l['natureLibelle'] ||
      l['modeLibelle']
    );
  }

  /**
   * Convertit une ligne de marché (valeur brute du formulaire) en **ligne de saisie** pour le serveur
   * (`SaisieMarcheLigne`) — mapping **unique** partagé par la soumission ET le réimport : bénéficiaires
   * et lots non vides seulement, règle du **lot-objet par défaut** (sans lot explicite, lot unique =
   * objet, tronqué à 200, montant = nouveau montant estimatif ou montant estimatif), dates de fin vides
   * omises. Le libellé nature/mode est envoyé tel quel (résolu-ou-créé au POST).
   */
  payloadDepuisMarche(l: Record<string, unknown>): SaisieMarcheLigne {
    const beneficiaires = ((l['beneficiaires'] as Record<string, unknown>[]) ?? [])
      .filter((b) => b['soaCode'] || b['numCompte'] || b['ancMontBenef'] != null || b['nouvMontBenef'] != null)
      .map((b) => ({
        soaCode: (b['soaCode'] as string)?.trim() || undefined,
        numCompte: (b['numCompte'] as string)?.trim() || undefined,
        ancMontBenef: (b['ancMontBenef'] as number) ?? undefined,
        nouvMontBenef: (b['nouvMontBenef'] as number) ?? undefined,
      }));
    const lotsSaisis: SaisieMarcheLot[] = ((l['lots'] as Record<string, unknown>[]) ?? [])
      .filter((lt) => (lt['designationLot'] as string)?.trim())
      .map((lt) => ({
        designationLot: (lt['designationLot'] as string).trim(),
        montLot: (lt['montLot'] as number) ?? undefined,
        qteLot: (lt['qteLot'] as number) ?? undefined,
        uniteLot: (lt['uniteLot'] as string)?.trim() || undefined,
      }));
    const objet = (l['designationMarche'] as string)?.trim();
    const lots: SaisieMarcheLot[] = lotsSaisis.length
      ? lotsSaisis
      : objet
        ? [{ designationLot: objet.slice(0, 200), montLot: this.montantLotObjet(l['montEstim'], l['nouvMontEstim']) }]
        : [];
    return {
      designationMarche: (l['designationMarche'] as string) || undefined,
      montEstim: (l['montEstim'] as number) ?? undefined,
      nouvMontEstim: (l['nouvMontEstim'] as number) ?? undefined,
      numCompte: (l['numCompte'] as string) ?? undefined,
      financement: (l['financement'] as string) || undefined,
      statut: (l['statut'] as string) || 'PREVU',
      natureLibelle: (l['natureLibelle'] as string)?.trim() || undefined,
      modeLibelle: (l['modeLibelle'] as string)?.trim() || undefined,
      formeMarche: (l['formeMarche'] as FormeMarche) || undefined,
      beneficiaires: beneficiaires.length ? beneficiaires : undefined,
      lots: lots.length ? lots : undefined,
      processus: ((l['processus'] as Record<string, unknown>[]) ?? []).map((p) => ({
        idCapm: p['idCapm'] as number,
        dateDebut: p['dateDebut'] as string,
        dateFin: (p['dateFin'] as string) || undefined,
      })),
    };
  }
}
