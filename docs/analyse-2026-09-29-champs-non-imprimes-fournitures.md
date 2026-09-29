# Fournitures (lot D2) — les 52 champs de la fiche qu'aucun document produit n'imprime

**Date** : 2026-09-29 · **Origine** : constat du backend à la livraison D2 (V52, commit 9910f2f) — 52 champs du
référentiel des fournitures (quantité fixe et à commande) ne figurent dans aucun des trois modèles DPAO-F, AE-F, CCAP-F.
**Statut** : proposition du front, **à arbitrer par le pilote**. Rien n'est demandé au backend avant l'arbitrage.

Méthode : chaque code est cherché dans les trois modèles (`scripts/modeles-dao/modeles/*-F.txt`), dans les six
formulaires du candidat (`scripts/modeles-candidat/modeles/`), puis le **sujet** du champ est cherché dans le texte du
document type ARMP : soit le document type en parle en texte fixe (le champ ne changerait rien au document), soit il
n'en parle pas du tout (le champ n'a pas de place).

## Synthèse

| Groupe | Nb | Constat | Recommandation |
|---|---|---|---|
| G1 — Données du candidat | 5 | Le document type laisse ces blancs **au candidat** (son compte bancaire, ses montants) ou à la notification | Retirer de la fiche (`actif = non`) |
| G2 — Déjà dit par le document type | 16 | Texte fixe ou rédaction choisie par un **autre** champ | Retirer de la fiche (`actif = non`) |
| G3 — Imprimés dans un formulaire du candidat | 4 | A1, A3, C1/C2 les impriment : le constat ne comptait que les trois documents du DAO | Rien à faire |
| G4 — Remise électronique | 16 | Relèvent de la clause 7.3 « à fournir par le juriste », qui n'en nomme que neuf autres | Transmettre la liste au juriste avec la question en cours |
| G5 — Sans place dans le document type | 11 | Le document type des fournitures n'a pas la clause | Q-a à Q-c ci-dessous |
| **Total** | **52** | | |

Un champ qui ne change rien au document produit **trompe la PRMP** : elle croit régler une clause qui reste celle du
document type. D'où la recommandation de retrait pour G1 et G2 plutôt que de les garder « pour mémoire ». Un champ
retiré (`actif = non`) garde ses valeurs déjà saisies : rien n'est perdu, il n'est plus proposé.

Avant tout retrait, le backend vérifie qu'aucun contrôle de la fiche ni aucun point de la grille de la Commission ne
lit ce champ (une grille qui le lirait le rendrait utile, et il resterait).

## G1 — Données du candidat ou de la notification (5)

| Code | Libellé | Où le document type le traite |
|---|---|---|
| B08-PA-01 | Domiciliation bancaire du fournisseur | AE 6.1 : « titulaire du compte, établissement, agence, numéro… » laissés en blanc — remplis par le candidat |
| B08-PA-02 | Domiciliation bancaire de chaque membre du groupement | AE 6.1, cas du groupement : idem |
| B05-TP-02 | Montant minimum annuel du marché | AE art. 2 (à commande) : « (montant) » — l'engagement du candidat, prix × quantités minimales |
| B05-TP-03 | Montant maximum annuel du marché | AE art. 2 (à commande) : idem, quantités maximales |
| B02-AU-05 | Date d'effet du marché à commande | AE 5.1 : « prend effet à compter de la notification » — inconnue au stade du DAO |

## G2 — Déjà dit par le document type (16)

| Code | Libellé | Texte du document type qui le règle déjà |
|---|---|---|
| B03-NA-01, B03-NA-02 | Nantissement autorisé / conditions | AE art. 4 : nantissement toujours possible, plafond = montant diminué de la sous-traitance (comptable assignataire : B03-NA-03, imprimé) |
| B03-ST-02 | Conditions de la sous-traitance | AE art. 3 : conditions dans l'annexe **du candidat** (le choix oui/non : B03-ST-01, imprimé) |
| B04-OP-02, B04-OP-03 | Date / heure d'ouverture des plis | DPAO 8 : « les mêmes que la date et l'heure limites fixées pour la remise des offres » |
| B04-RO-03 | Présentation des plis | DPAO 7.1 en texte fixe, avec B04-RO-01 (copies) et B04-RO-02 (mentions), imprimés |
| B08-AC-01, B08-AC-02 | Acomptes prévus / modalités | CCAP 9.1b : « par application des prix unitaires… aux quantités réellement livrées » |
| B08-AV-03 | Modalités de l'avance en cas de groupement | AE 6.2 : chaque membre du groupement refuse ou accepte, rien à régler par l'AC |
| B08-AV-05, B08-AV-06 | Remboursement de l'avance / précompte | CCAP 9.1a : précompte dès 60 %, terminé à 80 % — en texte fixe |
| B08-PA-04 | Termes de paiement | CCAP 9.2 : livraison / mensuel / trimestriel, **rédaction choisie** par un autre champ (conditions PAIEMENT-*) |
| B10-IR-02 | Modalités de l'indemnité de résiliation | CCAP art. 23 : le pourcentage B10-IR-03 (imprimé) est la seule variable |
| B06-EO-04 | Impôts, droits et taxes pris en compte | CCAP 8.1 : « les prix… sont supposés comprendre l'ensemble des impôts, droits et taxes » |
| B06-EO-05, B06-EO-06 | Montant évalué / comparaison des offres | DPAO 9.4.3 : rédaction choisie par l'évaluation par lot ou d'ensemble (conditions EVALUATION-*) |

## G3 — Imprimés dans un formulaire du candidat (4) — rien à faire

B03-CQ-01 (A1), B03-CQ-09 (A1), B03-CQ-10 (A3), B05-GS-04 (C1 et C2).

## G4 — Remise électronique : la clause du juriste (16)

La clause 7.3 du DPAO-F est un encart « CLAUSE À FOURNIR PAR LE JURISTE » qui nomme déjà neuf champs (B04-SE-02, -04,
-05, -07, -08, -09, -12, -13, -14). Seize autres champs de la remise électronique n'y sont pas :

- séance d'ouverture : B04-OP-10, B04-OP-11, B04-OP-12, B04-OP-13 ;
- dépôt : B04-SE-03, B04-SE-06, B04-SE-10, B04-SE-11, B04-SE-15, B04-SE-16, B04-SE-17 ;
- garantie de soumission remise en ligne : B05-GS-10, B05-GS-11, B05-GS-12, B05-GS-13, B05-GS-14.

**Recommandation** : joindre cette liste à la question déjà ouverte auprès du juriste ; il dit lesquels sa clause
imprime. Ceux qu'il écarte passent en G2.

## G5 — Sans place dans le document type des fournitures (11)

| Code | Libellé |
|---|---|
| B03-CQ-02 | Capacité technique exigée |
| B03-CQ-03 | Capacité financière exigée |
| B03-CQ-04 | Marchés similaires : certificats exigés |
| B02-AU-07 | Nombre maximum de lots attribuables à un même candidat |
| B05-CP-03 | Part en devises des fournitures importées |
| B06-EO-03 | Conversion en Ariary des offres en devise |
| B06-EO-07 | Traitement des offres anormalement hautes ou basses |
| B06-EO-08 | Vérification a posteriori de la qualification du moins-disant |
| B06-AN-02 | Recours gracieux et recours en attribution |
| B08-PA-08 | Délai de paiement (jours) |
| B09-DG-02 | Étendue de la garantie |

**Q-a — Les critères de qualification (B03-CQ-02, -03, -04).** Le DPAO 6.3 énumère les fiches que le candidat remplit
(« capacités techniques », « capacité financière », « marchés similaires… au cours des trois dernières années ») mais
**n'a aucune place pour le niveau exigé**. Or c'est ce niveau que la Commission contrôle. *Recommandation* : ajouter
trois trous à la fin des points 2°, 3° et 4° du DPAO 6.3 (« Niveau exigé : {{B03-CQ-02}} »…). Ce serait un **ajout
déclaré** au document type, tracé comme les autres ajouts du modèle, et le seul de ce lot qui s'écarte de l'ARMP.

**Q-b — Les huit autres** (B02-AU-07, B05-CP-03, B06-EO-03, -07, -08, B06-AN-02, B08-PA-08, B09-DG-02). Le document
type les laisse au Code des marchés, au CCAG ou à des clauses voisines déjà imprimées : devise (CCAP 9.3, rédaction
DEVISE), intérêts moratoires (CCAP 9.4, B08-IM-01), garantie (CCAP art. 22, B09-DG-03 et -04). *Recommandation* :
retirer (`actif = non`), comme G2.

**Q-c — Le fax de l'autorité contractante.** Hors des 52 : le CCAP 3 garde « Télécopie : <insérer le n° > » en blanc,
sans champ. *Recommandation* : retirer la ligne du modèle (retrait motivé : aucun champ, moyen de communication
désuet), plutôt que créer un champ.

## Une omission du modèle, relevée au passage (à corriger côté front)

CCAP-F, article 6, cas du marché **à commande** : « … dans la limite de ………..% en sus du maximum ou en dessous du
minimum » est resté en pointillés : le modèle D2 ne l'a pas décrit. Le CCAP à commande produit aujourd'hui porte donc ce
blanc. Le champ existe : **B09-OM-02** « Variation maximale des volumes ou quantités (%) », déjà imprimé à l'article 6
pour la quantité fixe. Il suffit que le modèle le pose aussi dans la phrase à commande, et d'élargir la condition
`VARIATION-QUANTITES` (aujourd'hui `typeMarche = QUANTITE_FIXE et B09-OM-02 renseigne`). Correction du modèle et
recopie par le backend à faire **avec** les décisions ci-dessus, en une seule livraison.

> ⚠️ **Arbitrage du pilote, 2026-09-29 : « oui » aux cinq décisions.** Modèles corrigés le même jour
> (`decrire.mjs` : DPAO-F 237/237, CCAP-F 460/460, conditions du CCAP-F 65 → 67) et demande au backend :
> `docs/demande-backend-2026-09-29-champs-non-imprimes-fournitures.md`. Deux faits relevés en corrigeant :
> - **Erreur du modèle D2, article 3 du CCAP** : le bloc des coordonnées du **Fournisseur** recevait celles de la PRMP
>   (la plage de l'article couvrait les deux blocs). Corrigée : le bloc du Fournisseur reste en blanc.
> - Les 29 codes retirés n'ont pas de `categories` : le retrait est demandé **pour les fournitures seulement**, et après
>   vérification qu'aucune règle serveur ne les lit (B04-OP-02 est calculé en remise électronique).

> ⚠️ **Livraison et second arbitrage, 2026-09-29.** Le backend a retiré 25 champs sur 29 (f7d27df). Quatre restent,
> parce qu'une règle serveur les lit : B04-OP-02 et B04-OP-03 (calculés en remise électronique, à trancher avec le
> juriste), B05-TP-03 (base de `GARANTIE_TAUX`) et B08-PA-08 (`DELAI_PAIEMENT_75`). Le pilote a validé :
> **B05-TP-03 gardé, facultatif, libellé « estimé »**, et **B08-PA-08 retiré** (demande, §B6). **Correction** :
> B05-TP-03 n'est pas une donnée du candidat (G1) mais l'estimation de l'acheteur, par lot, qui sert à apprécier la
> garantie de soumission.

## Décisions attendues du pilote

1. G1 et G2 (21 champs) : retrait de la fiche — **oui / non**.
2. G4 (16 champs) : joindre la liste à la question du juriste — **oui / non**.
3. Q-a : trois trous ajoutés au DPAO 6.3 pour les niveaux de qualification — **oui / non**.
4. Q-b : retrait des huit autres — **oui / non**.
5. Q-c : retrait de la ligne « Télécopie » du CCAP — **oui / non**.
