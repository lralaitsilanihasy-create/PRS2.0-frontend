# Fiche DAO ↔ dossier réel 2463 — correspondance (générée le 2026-09-27)

*Généré par `node scripts/correspondance-2463.mjs` — ne pas éditer à la main. Source des faits : `docs/jeu-donnees-2463-faits.md` ;*
*valeurs et natures : `scripts/demo-dao-valeurs.mjs` (section E) ; référentiel et fiche : l'API ; documents produits : `C:/Users/LANTO/eclipse-workspace/PRS20/docs/export/2463/documents`.*
*Fiche 16 (ligne 303092, 00001/PPM-AGPM/CNM/2026), version 2 validée.*

| nature | sens |
|---|---|
| **[R]** | repris tel quel du dossier `DAO_2463_MAT_INFO_VERSION_FINAL_1.pdf`, page et clause citées |
| **[D]** | déduit d'une valeur du dossier, calcul écrit dans la fiche des faits |
| **[H]** | hypothèse : le dossier est muet ou en blanc ; jamais présentée comme venant du dossier (§10 de la fiche des faits) |
| imprimé | le texte [R] se retrouve **tel quel** dans le PDF produit de son document maître (oui / non ; « · » = valeur courte ou non textuelle, non vérifiée) |

## Le cadrage

| question | réponse | nature | source |
|---|---|---|---|
| alloti | OUI | **[R]** | DPAO 1.1 p.17 |
| nbLots | 5 | **[R]** | p.1, DPAO 1.1 p.17 |
| variantes | NON | **[R]** | DPAO 1.1 p.17 |
| groupement | NON | **[R]** | DPAO 2 p.17, CCAP art. 4 p.49 |
| provenance | NATIONAL | **[R]** | DPAO 6.5.1 p.18 |
| typePrix | UNITAIRES | **[D]** | bordereaux des prix p.40-44 |
| prixRevisable | NON | **[R]** | DPAO 6.5.2 p.18, CCAP 8.2 p.50 |
| garantieSoumission | OUI | **[R]** | DPAO 6.6 p.18 |
| avance | OUI | **[H]** | CCAP 9.1.a p.50 en blanc — §7 |
| tauxAvance | 20 | **[H]** | plafond CCAG art. 9.1 p.74 — §7 |
| penalites | PLAFOND_DIFFERENT | **[R]** | CCAP art. 11 p.50-51 |

## B02 — Objet, allotissement & forme du marché

| code | information | valeur | nature | source (page, clause) | imprimé |
|---|---|---|---|---|---|
| `B02-AU-02` | Attribution des lots | Lot par lot (attribution divisible) | **[R]** | DPAO 1.1 p.17 : « Chaque lot est indivisible. Toute offre partielle est irrecevable. » | · |
| `B02-AU-04` | Durée de validité du marché à commande (mois) | 12 | **[R]** | DPAO 1.2 p.17, CCAP 10.b p.50 | · |
| `B02-AU-05` | Date d'effet du marché à commande | 2027-01-28 | **[H]** | §8 : notification / date d'effet | · |
| `B02-AU-07` | Nombre maximum de lots attribuables à un même candidat | 2 | **[R]** | DPAO 1.1 p.17 : « ne peut prétendre qu'à deux lots au maximum » | · |
| `B02-OB-02` | Type de fournitures à livrer et services connexes à réaliser | L'appel d'offres porte sur un marché à commandes des matériels et mobiliers de logements dont les quantités m… | **[R]** | p.1). [R] DPAO 1.2 p.17, tel quel | oui |
| `B02-OB-03` | Numéro du dossier d'appel d'offres | AOO n° 2463-MI/MESupReS/PRMP/UGPM.2026 | **[R]** | p.1, AE p.36 | oui |

## B03 — Candidats : groupement, sous-traitance, qualifications

| code | information | valeur | nature | source (page, clause) | imprimé |
|---|---|---|---|---|---|
| `B03-CQ-01` | Identification et situation juridique : pièces exigées | Photocopie certifiée conforme à l'original de la Carte d'Immatriculation Fiscale 2026 ou 2025 validée, datée … | **[R]** | DPAO 6.1 | oui |
| `B03-CQ-02` | Capacité technique exigée | Une fiche de renseignements relative à sa capacité technique (modèle A2), signée avec la mention « certifiée … | **[R]** | DPAO 6.3 | oui |
| `B03-CQ-03` | Capacité financière exigée | Une fiche de renseignements relative à sa capacité financière (modèle A3), signée avec la mention « certifiée… | **[R]** | DPAO 6.3 | oui |
| `B03-CQ-04` | Marchés similaires : certificats de bonne fin ou PV de réception exigés | Non exigé : la clause 6.3 du DPAO ne demande que les fiches d'identification, de capacité technique et de cap… | **[D]** | §10 | oui |
| `B03-CQ-05` | Autorisation du fabricant exigée | NON | **[R]** | sommaire p.2 : « Modèle d'attestation du fabricant – Non utilisé » | · |
| `B03-CQ-06` | Qualifications particulières exigées | Aucune qualification particulière au-delà des pièces de la clause 6.1 et des fiches de la clause 6.3 du DPAO. | **[D]** | §10 | oui |
| `B03-CQ-07` | Communautés locales et ONG admises à candidater | Non prévu par le DPAO. | **[D]** | §10 | · |
| `B03-CQ-08` | Préférence nationale accordée | NON | **[R]** | DPAO 9.5 p.19 | · |
| `B03-NA-01` | Nantissement autorisé | OUI | **[R]** | AE art. 4 p.38 | · |
| `B03-NA-02` | Conditions du nantissement | Est désigné comme comptable assignataire des paiements le Trésorier ministériel chargé de l'Enseignement ; le… | **[R]** | AE art. 4 p.38 | oui |
| `B03-NA-03` | Comptable assignataire des paiements | Trésorier ministériel chargé de l’Enseignement | **[R]** | AE art. 4 p.38 | oui |
| `B03-ST-01` | Sous-traitance autorisée | NON | **[R]** | AE art. 3 p.38 | · |

## B04 — Dossier, remise & ouverture des offres

| code | information | valeur | nature | source (page, clause) | imprimé |
|---|---|---|---|---|---|
| `B04-CD-01` | Modèles de fiches de renseignements joints au dossier (A1, A2…) | A1,A2,A3,A4 | **[R]** | sommaire p.2, DPAO 5.1 : modèles de fiches de renseignements joints | · |
| `B04-CD-02` | Modèle de garantie de soumission joint au dossier | C1 et C2 | **[R]** | DPAO 5.1 : modèles de garantie de soumission joints (p.33-34) | · |
| `B04-CO-01` | Documents et pièces constituant l'offre | Documents ou pièces à remettre en sus de ceux mentionnés à la clause 6.2 des IC : photocopie certifiée confor… | **[R]** | DPAO 6.1 | oui |
| `B04-DE-01` | Adresse pour les demandes d'éclaircissement | Personne Responsable des Marchés Publics — Attention de : Monsieur LERAVO Norbert Fidelys — Porte 204, 2ème E… | **[R]** | DPAO 5.2 | oui |
| `B04-DE-02` | Délai d'envoi des demandes par les candidats (jours avant la date limite) | 10 | **[R]** | DPAO 5.2 | · |
| `B04-DE-03` | Délai de réponse du représentant de la PRMP (jours) | 5 | **[R]** | DPAO 5.2 | · |
| `B04-LA-01` | Langue de l'offre autre que le français admise | NON | **[D]** | §10 : le DPAO ne prévoit aucune langue en plus du français | · |
| `B04-LR-01` | Nom complet de la PRMP destinataire des offres | Monsieur LERAVO Norbert Fidelys, Personne Responsable des Marchés Publics | **[R]** | DPAO 7.2 | oui |
| `B04-LR-02` | Adresse de remise des offres | Porte 204, 2ème Etage - MESupReS, Fiadanana - Antananarivo, code postal 101. | **[R]** | DPAO 7.2 | oui |
| `B04-LR-03` | Date limite de remise des offres | 2026-11-09 | **[H]** | §8 (le dossier laisse la date en pointillés | · |
| `B04-LR-04` | Heure limite de remise des offres | Dix (10) heures | **[R]** | DPAO 7.2 | · |
| `B04-OP-01` | Lieu de l'ouverture des plis | Bureau : Porte 204, 2ème Etage - MESupReS | **[R]** | DPAO 8 | oui |
| `B04-OP-02` | Date de l'ouverture des plis | 2026-11-09 | **[R]** | DPAO 8 : « le même jour que la date limite fixée pour la remise des offres » | · |
| `B04-OP-03` | Heure de l'ouverture des plis | DIX HEURES (10H) | **[R]** | DPAO 8 | · |
| `B04-RO-01` | Nombre de copies de l'offre | 1 | **[R]** | DPAO 7.1 : « UNE (01) copie » | · |
| `B04-RO-02` | Mention et numéro à porter sur les plis | AOO N° 2461/MT /MESupReS/PRMP/UGPM.2026 — Offre relative à « FOURNITURE ET LIVRAISON DES MATERIELS INFORMATIQ… | **[R]** | DPAO 7.1 p.18, tel quel | oui |
| `B04-RO-03` | Présentation des plis (plis séparés par lot, enveloppes intérieures originale et copie) | Les offres devront être dans des plis séparés présentées pour chacun des lots. Outre l'original de l'offre, l… | **[R]** | DPAO 7.1 | oui |
| `B04-VE-01` | Remise des offres ou propositions par voie électronique admise | NON | **[R]** | DPAO 7.3 | · |
| `B04-VO-01` | Délai de validité des offres (jours) | 75 | **[R]** | DPAO 6.4 | · |

## B05 — Prix, montants & garantie de soumission

| code | information | valeur | nature | source (page, clause) | imprimé |
|---|---|---|---|---|---|
| `B05-CP-02` | Décomposition des prix des fournitures nationales (EXW hors TVA, transports intérieurs, assurance, services) | Pour les Fournitures acquises sur le territoire national, le prix comprend : i) le prix des fournitures EXW, … | **[R]** | DPAO 6.5.1 | oui |
| `B05-GS-02` | Forme de la garantie de soumission | Caution personnelle et solidaire d'un organisme agréé par le MEF,Garantie bancaire,Chèque de banque | **[R]** | DPAO 6.6 p.18 : « dans l'une des formes suivantes : soit une garantie bancaire, soit une caution personnelle et solidaire, soit un chèque de banque libellé au nom du Receveur Général d'Antananarivo ». Liste à choix multiples depuis le 26/09 (demande-backend-2026-09-26-forme-garantie-soumission-choix-multiple.md) : options dans l'ordre du référentiel, séparées par des virgules | · |
| `B05-GS-03#1` | Montant de la garantie de soumission (Ariary) — lot 1 | 1600000 | **[R]** | DPAO 6.6 p.18 : les montants EXACTS de la garantie de soumission. | · |
| `B05-GS-03#2` | Montant de la garantie de soumission (Ariary) — lot 2 | 2170000 | **[R]** | DPAO 6.6 p.18 : les montants EXACTS de la garantie de soumission. | · |
| `B05-GS-03#3` | Montant de la garantie de soumission (Ariary) — lot 3 | 1600000 | **[R]** | DPAO 6.6 p.18 : les montants EXACTS de la garantie de soumission. | · |
| `B05-GS-03#4` | Montant de la garantie de soumission (Ariary) — lot 4 | 2170000 | **[R]** | DPAO 6.6 p.18 : les montants EXACTS de la garantie de soumission. | · |
| `B05-GS-03#5` | Montant de la garantie de soumission (Ariary) — lot 5 | 1600000 | **[R]** | DPAO 6.6 p.18 : les montants EXACTS de la garantie de soumission. | · |
| `B05-GS-04` | Durée de validité de la garantie de soumission (jours) | 105 | **[R]** | modèles C1/C2 p.33-34 : « jusqu'au 105ème jour » | · |
| `B05-MO-01` | Monnaie de l'offre | Ariary | **[R]** | CCAP 9.3, AE art. 2 | · |
| `B05-TP-02#1` | Montant minimum annuel du marché (Ariary) — lot 1 | 40000000 | **[D]** | §5 : montant minimum = maximum ÷ 2 (les quantités min valent la moitié des max sur tous les bordereaux). | · |
| `B05-TP-02#2` | Montant minimum annuel du marché (Ariary) — lot 2 | 54250000 | **[D]** | §5 : montant minimum = maximum ÷ 2 (les quantités min valent la moitié des max sur tous les bordereaux). | · |
| `B05-TP-02#3` | Montant minimum annuel du marché (Ariary) — lot 3 | 40000000 | **[D]** | §5 : montant minimum = maximum ÷ 2 (les quantités min valent la moitié des max sur tous les bordereaux). | · |
| `B05-TP-02#4` | Montant minimum annuel du marché (Ariary) — lot 4 | 54250000 | **[D]** | §5 : montant minimum = maximum ÷ 2 (les quantités min valent la moitié des max sur tous les bordereaux). | · |
| `B05-TP-02#5` | Montant minimum annuel du marché (Ariary) — lot 5 | 40000000 | **[D]** | §5 : montant minimum = maximum ÷ 2 (les quantités min valent la moitié des max sur tous les bordereaux). | · |
| `B05-TP-03#1` | Montant maximum annuel du marché (Ariary) — lot 1 | 80000000 | **[D]** | §5 : montant maximum = garantie ÷ 2 % (le dossier laisse les montants en blanc, AE p.38). | · |
| `B05-TP-03#2` | Montant maximum annuel du marché (Ariary) — lot 2 | 108500000 | **[D]** | §5 : montant maximum = garantie ÷ 2 % (le dossier laisse les montants en blanc, AE p.38). | · |
| `B05-TP-03#3` | Montant maximum annuel du marché (Ariary) — lot 3 | 80000000 | **[D]** | §5 : montant maximum = garantie ÷ 2 % (le dossier laisse les montants en blanc, AE p.38). | · |
| `B05-TP-03#4` | Montant maximum annuel du marché (Ariary) — lot 4 | 108500000 | **[D]** | §5 : montant maximum = garantie ÷ 2 % (le dossier laisse les montants en blanc, AE p.38). | · |
| `B05-TP-03#5` | Montant maximum annuel du marché (Ariary) — lot 5 | 80000000 | **[D]** | §5 : montant maximum = garantie ÷ 2 % (le dossier laisse les montants en blanc, AE p.38). | · |

## B06 — Évaluation, attribution & notification

| code | information | valeur | nature | source (page, clause) | imprimé |
|---|---|---|---|---|---|
| `B06-AN-02` | Recours gracieux et recours en attribution | Tout candidat écarté peut demander par écrit les motifs du rejet de sa candidature ou de son offre ; la Perso… | **[H]** | paraphrase des IC — §10 | oui |
| `B06-EO-01` | Évaluation des offres portant sur plusieurs lots | Par lot | **[R]** | DPAO 9.4 | · |
| `B06-EO-02` | Critères additionnels d'évaluation | Non applicable. | **[R]** | DPAO 9.4 : « Critère additionnel : non applicable » | · |
| `B06-EO-04` | Impôts, droits et taxes pris en compte dans l'évaluation | Le prix du Marché est supposé comprendre l'ensemble des impôts, droits et taxes de toute nature dus par le Fo… | **[R]** | CCAP 8.1 p.50 | oui |
| `B06-EO-05` | Détermination du montant évalué de l'offre | Les offres seront évaluées par lot et le marché portera sur le lot ou les lots attribués au candidat qualifié… | **[R]** | DPAO 9.4 | oui |
| `B06-EO-06` | Comparaison des offres | Après évaluation, la Personne Responsable des Marchés Publics compare toutes les offres substantiellement con… | **[H]** | paraphrase des IC — §10 | oui |
| `B06-EO-07` | Traitement des offres anormalement hautes ou basses | Afin d'identifier le caractère anormalement bas ou haut d'une offre, la CAO effectuera les calculs suivants :… | **[R]** | DPAO 9.4.5 | oui |
| `B06-EO-08` | Vérification a posteriori de la qualification du candidat moins-disant | La Personne Responsable des Marchés Publics vérifie, avant attribution, que le candidat ayant présenté l'offr… | **[H]** | paraphrase des IC — §10 | oui |
| `B06-EO-12#1` | Délai maximum de livraison (jours) — lot 1 | 30 | **[R]** | DPAO 12 p.19, CCAP 10.a p.50 : « fixé dans le bon de commande, sans toutefois dépasser TRENTE (30) JOURS ». | · |
| `B06-EO-12#2` | Délai maximum de livraison (jours) — lot 2 | 30 | **[R]** | DPAO 12 p.19, CCAP 10.a p.50 : « fixé dans le bon de commande, sans toutefois dépasser TRENTE (30) JOURS ». | · |
| `B06-EO-12#3` | Délai maximum de livraison (jours) — lot 3 | 30 | **[R]** | DPAO 12 p.19, CCAP 10.a p.50 : « fixé dans le bon de commande, sans toutefois dépasser TRENTE (30) JOURS ». | · |
| `B06-EO-12#4` | Délai maximum de livraison (jours) — lot 4 | 30 | **[R]** | DPAO 12 p.19, CCAP 10.a p.50 : « fixé dans le bon de commande, sans toutefois dépasser TRENTE (30) JOURS ». | · |
| `B06-EO-12#5` | Délai maximum de livraison (jours) — lot 5 | 30 | **[R]** | DPAO 12 p.19, CCAP 10.a p.50 : « fixé dans le bon de commande, sans toutefois dépasser TRENTE (30) JOURS ». | · |
| `B06-EP-01` | Délai de réponse des candidats aux demandes de la PRMP (jours) | 3 | **[R]** | DPAO 9.1 | · |

## B08 — Paiements, avances & garanties financières

| code | information | valeur | nature | source (page, clause) | imprimé |
|---|---|---|---|---|---|
| `B08-AC-01` | Acomptes prévus | NON | **[R]** | CCAP 9.1.b | · |
| `B08-AV-04` | Forme de la garantie de restitution d'avance | Garantie bancaire | **[H]** | §7 : garantie de restitution bancaire | · |
| `B08-AV-05` | Modalités de remboursement de l'avance | L'avance forfaitaire est remboursée par précompte sur les sommes dues au titulaire, au fur et à mesure des li… | **[H]** | §7 / §10 : remboursement par précompte | oui |
| `B08-AV-06` | Précompte sur les sommes dues (%) | 20 | **[H]** | §10 : précompte 20 % | · |
| `B08-GB-01` | Garantie de bonne exécution exigée | NON | **[R]** | CCAP 12.1 : « Non applicable » | · |
| `B08-IM-01` | Taux des intérêts moratoires dus au fournisseur (%) | 9 | **[H]** | §10 : le CCAP 9.4 dit « taux directeur de la BCM … augmenté d'un (01) point » | · |
| `B08-PA-01` | Domiciliation bancaire du fournisseur | L'Acheteur se libérera des sommes dues au titre du présent marché en en faisant porter le montant au crédit d… | **[R]** | AE art. 6.1 | oui |
| `B08-PA-03` | Établissement des décomptes, factures ou mémoires | Les factures seront établies en quatre (04) exemplaires : un original et 3 copies portant, outre les mentions… | **[R]** | CCAP 9.2 | oui |
| `B08-PA-04` | Termes de paiement | Les factures seront établies à la livraison. | **[R]** | CCAP 9.2 | oui |
| `B08-PA-05` | Périodicité des paiements (prix unitaires) | À la livraison | **[R]** | CCAP 9.2 | · |
| `B08-PA-08` | Délai de paiement (jours) | 30 | **[H]** | §10 | · |
| `B08-RG-01` | Retenue de garantie pratiquée | NON | **[R]** | CCAP 12.2 : « Aucune retenue de garantie ne sera pratiquée » | · |

## B09 — Exécution du marché & livraison

| code | information | valeur | nature | source (page, clause) | imprimé |
|---|---|---|---|---|---|
| `B09-AS-01` | Assurance des fournitures | À la charge du fournisseur jusqu'à la livraison | **[R]** | CCAP art. 16 p.51 : « Le Fournisseur assure toute dommage pendant le transport jusqu'à la destination finale » (fiche des faits §7) | · |
| `B09-CR-01` | Contrôle des prix de revient applicable | NON | **[R]** | CCAP art. 19 | · |
| `B09-DG-01` | Délai de garantie (mois) | 2 | **[R]** | CCAP art. 22 : DEUX (02) MOIS | · |
| `B09-DG-02` | Étendue de la garantie | Les fournitures doivent être garanties contre tout risque de fabrication ou de matière pendant DEUX (02) MOIS… | **[R]** | CCAP art. 22 | oui |
| `B09-DI-01` | Décision après inspection et essais | Sur demande du fournisseur, pour chaque commande, la réception prononcée à la livraison par une commission de… | **[R]** | CCAP art. 21 | oui |
| `B09-DX-01` | Délai d'exécution (jours) | 30 | **[R]** | CCAP 10.a | · |
| `B09-DX-02` | Point de départ du délai s'il diffère de la date de notification | À compter du lendemain de la date de notification de chaque bon de commande. | **[R]** | CCAP 10.a | oui |
| `B09-DX-03` | Modalités et période de passation des commandes | Le délai de livraison est fixé dans le bon de commande sans toutefois dépasser TRENTE (30) JOURS à compter du… | **[R]** | CCAP 10.a et 10.b | oui |
| `B09-EM-01` | Marquage requis sur les emballages | Emballage d’origine. | **[R]** | CCAP art. 15 | · |
| `B09-EM-02` | Documents requis dans les emballages | Aucun document particulier n'est exigé dans les emballages (CCAP art. 15 : emballage d'origine). | **[D]** | §10 | oui |
| `B09-IV-01` | Inspections, vérifications et essais | Les vérifications et inspections des fournitures sont effectuées au lieu de destination finale, au moment de … | **[R]** | CCAP art. 20 | oui |
| `B09-LF-01` | Modalités de livraison des fournitures | Les fournitures seront livrées au : lot n° 1 : MINISTERE FIADANANA ; lot n° 2 : AMBATONDRAZAKA ; lot n° 3 : A… | **[R]** | CCAP art. 17 | oui |
| `B09-LF-02` | Documents à fournir par le fournisseur à la livraison | Cinq (05) exemplaires de la facture du Fournisseur indiquant la description des Fournitures, leurs quantités,… | **[R]** | CCAP art. 17 | oui |
| `B09-LL-01#1` | Lieu de livraison — lot 1 | MINISTERE FIADANANA | **[R]** | CCAP art. 1 et 17 p.49, 51 | · |
| `B09-LL-01#2` | Lieu de livraison — lot 2 | AMBATONDRAZAKA | **[R]** | CCAP art. 1 et 17 p.49, 51 | · |
| `B09-LL-01#3` | Lieu de livraison — lot 3 | AMBATONDRAZAKA | **[R]** | CCAP art. 1 et 17 p.49, 51 | · |
| `B09-LL-01#4` | Lieu de livraison — lot 4 | FORT DAUPHIN | **[R]** | CCAP art. 1 et 17 p.49, 51 | · |
| `B09-LL-01#5` | Lieu de livraison — lot 5 | FORT DAUPHIN | **[R]** | CCAP art. 1 et 17 p.49, 51 | · |
| `B09-MC-01` | Matériels, objets et approvisionnements confiés au fournisseur | NON | **[R]** | CCAP art. 13 : « Sans objet » | · |
| `B09-OM-01` | Délai de communication par le fournisseur sur l'ajustement de prix ou de délai (jours) | 10 | **[R]** | CCAP art. 6 | · |
| `B09-OM-02` | Variation maximale des volumes ou quantités (%) | 20 | **[R]** | CCAP art. 6 | · |
| `B09-OM-03` | Délai de validité du marché (mois) | 12 | **[R]** | CCAP art. 6 et 10.b | · |
| `B09-PC-01` | Pièces contractuelles supplémentaires | Aucune pièce supplémentaire : l'ordre de priorité des pièces contractuelles est celui fixé par l'article 6 du… | **[D]** | §10 | oui |
| `B09-PC-02` | Annexes de l'acte d'engagement (cadre du bordereau de prix, état des sommes versées à des tiers, déclaration des bénéficiaires effectifs) | Annexe n° 1 : cadre du bordereau de prix. Annexe n° 2 : état des sommes versées à des tiers. Annexe n° 3 : fo… | **[R]** | AE p.38 | oui |
| `B09-PR-02` | Plafond des pénalités de retard (%) | 10 | **[R]** | CCAP art. 11 p.50-51 : « plafonné à dix pour cent (10%) du montant du Marché » | · |
| `B09-PR-03` | Dérogation au CCAG justifiant le plafond des pénalités | CCAP art. 11 : « En cas de retard dans l'exécution de chaque commande, il est appliqué une pénalité journaliè… | **[R]** | + | oui |
| `B09-PS-01` | Mesures de sécurité applicables | NON | **[R]** | CCAP art. 7 | · |
| `B09-RT-01` | Responsabilité du transport | Transport par le fournisseur jusqu'à la destination finale | **[R]** | CCAP art. 16 | · |
| `B09-SK-01` | Stockage des fournitures à la charge du fournisseur | OUI | **[R]** | CCAP art. 14 : « Quantité minimale prévue dans le bordereau de prix » | · |

## B10 — Modifications, résiliation & litiges

| code | information | valeur | nature | source (page, clause) | imprimé |
|---|---|---|---|---|---|
| `B10-AR-01` | Arbitrage et règlement des litiges | Aucune clause particulière au CCAP : le règlement des différends suit le CCAG. | **[D]** | §10 | oui |
| `B10-DD-01` | Dérogations aux documents généraux | Article 22 du CCAP (délai de garantie de deux mois) dérogeant à l'article 23 du CCAG — seule dérogation récap… | **[R]** | CCAP art. 24 | oui |
| `B10-IR-01` | Indemnité de résiliation prévue | OUI | **[R]** | CCAP art. 23 p.52 | · |
| `B10-IR-02` | Modalités de l'indemnité de résiliation | Les dispositions de l'article 32 du CCAG s'appliquent. | **[R]** | CCAP art. 23 | oui |

## Bilan

- Informations saisies : **126** — [R] 96, [D] 18, [H] 12.
- Textes [R] vérifiés dans les PDF produits : **41 imprimés tels quels**, 0 non retrouvés.
- Les anomalies du dossier réel sont **conservées** (fiche des faits §9) : mention « AOO N° 2461/MT » sur les plis (`B04-RO-02`), « matériels et mobiliers de logements » (`B02-OB-02`), article 24 du CCAP sans le plafond de 10 %, une destination au DPAO 6.5.1 contre cinq au CCAP.
- Ce que la fiche ne porte pas, et pourquoi : fiche des faits §10 (valeurs exigées par le modèle, absentes du dossier) et §11 (hypothèses du circuit : compte PRMP, sigle, référence).

*Remplace `correspondance-2026-09-25-fiche-dao-vs-dossier-2463.md` (fiche 13, avant la fiche des faits et les modèles officiels).*
