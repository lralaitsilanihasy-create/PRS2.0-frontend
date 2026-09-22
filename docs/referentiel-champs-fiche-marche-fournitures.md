# Référentiel des champs de la fiche marché — fournitures (quantité fixe, à commande)

**Date** : 2026-09-23 · **Source** : fichier de correspondance « DAO Fournitures et Services », carte des informations
du 23/09 (37 pages), modèles *Quantité fixe* (158 informations) et *À commande* (165). · **Fichier chargeable** :
`docs/referentiel-champs-fiche-marche-fournitures.csv` (format de l'import du serveur : UTF-8, séparateur `;`, en-têtes =
noms JSON, listes séparées par des virgules ; chargé le 23/09 sur la base locale par l'API Administrateur, 116 champs,
0 rejet).

Ce document dit **comment** chaque ligne du fichier est devenue un champ, pour que le pilote corrige ce qui doit l'être
depuis l'écran Administrateur « Champs de la fiche marché » ou dans le CSV. Le contrat-cadre n'est pas chargé : ses
74 informations sans document attendent les décisions 1 et 2 de l'esquisse.

## Règles de conversion

1. **Une ligne du fichier = un champ**, sauf quand plusieurs lignes sont les **branches d'un même choix** (« Prix ferme »
   / « Prix révisable », « Garantie bancaire » / « Chèque de banque »…) : elles deviennent **un seul champ** de type
   `LISTE` ou `OUI_NON`, ou sont déjà portées par une **question de cadrage**. C'est le sens de l'esquisse : les réponses
   de cadrage évitent les « choisir et supprimer les mentions inutiles ». Conséquence : certaines rubriques comptent
   moins de champs que d'informations annoncées (B05-GS 4 / 6, B08-PA 8 / 13) — le compte de l'esquisse est
   indicatif, pas une cible.
2. **Le document maître** est la colonne où le fichier porte « AS » ; **les reprises** sont les colonnes marquées « x ».
3. **Les 22 informations « S » (PPM)** ne sont pas dans le CSV : le serveur les relit de la ligne du plan (champs
   `B01-AC-*`, `B02-LV-01..03`, `B02-OB-01` semés par la migration V35).
4. **Le type** est déduit du libellé : montant → `MONTANT` (en lettres servies), « nombre de jours / mois » → `NOMBRE`,
   « % » → `POURCENTAGE`, date → `DATE`, choix → `LISTE`/`OUI_NON`, le reste `TEXTE_LONG` (clauses) ou `TEXTE` (courts).
5. **La condition d'affichage** vient des questions de cadrage (`alloti`, `groupement`, `provenance`, `typePrix`,
   `prixRevisable`, `garantieSoumission`, `avance`, `penalites`) : un champ qui n'a de sens que dans une branche est
   conditionné à cette branche.
6. **Obligatoire** : oui pour ce qu'un DAO ne peut omettre (adresses, dates, délais, montants, choix structurants) ; non
   pour les clauses optionnelles (« s'il y en a », dérogations, précisions).
7. **Contrôles** : les champs qui portent une règle du catalogue B4 sont nommés avec leur rôle (`DATES_ORDRE:REMISE`,
   `VALIDITE_GARANTIE_SUP_OFFRE:GARANTIE` / `:OFFRE`, `FORFAIT_60_40:RECEPTION` / `:PV`, `AVANCE_SUP_5_GARANTIE:GARANTIE`,
   `PENALITES_PLAFOND_15:TAUX` / `:DEROGATION`, `INTERETS_MORATOIRES_TAUX:TAUX`, `DELAI_PAIEMENT_75:DELAI`,
   `MONTANT_POSITIF`). Trois champs ont été **ajoutés** pour que les règles aient leurs deux rôles : durée de validité de
   la garantie de soumission (B05-GS-04), délai de paiement (B08-PA-08), plafond et dérogation des pénalités (B09-PR-02/03).
8. **Types de marché** : les 151 informations communes valent `QUANTITE_FIXE,A_COMMANDE` ; les dix propres au marché à
   commande valent `A_COMMANDE` seul (B02-AU-03..06, B05-TP-02..03, B06-EO-12, B09-OM-03) — invisibles au lot 1, prêtes
   pour le lot 3.

## Lignes écartées ou chargées inactives

| Fichier (quantité fixe) | Décision |
|---|---|
| 27 « ? INONA NO SORATANA ETO », 28 « ?? » (lots et variantes) | **écartées** : pas de libellé, points à confirmer par l'équipe |
| 93 Attribution du marché, 94 Appel d'offres infructueux, 95 Notification | chargées **inactives** (`B06-SD-01..03`, sans document — décision 4 de l'esquisse) |
| 107 Trimestriellement | chargée **inactive** (`B08-SD-01`) ; la périodicité trimestrielle est une option de `B08-PA-05` |
| 128 « (fa ngah moa azo ajuster-na ny prix ??) » | **écartée** : note de l'équipe, pas une information |
| 154 Délai de garantie, 156 Indemnité de résiliation (doublons) | fusionnées : `B09-DG-02` étendue de la garantie, `B10-IR-02` modalités de l'indemnité |
| 32 Rythme de commande (à commande) | chargée **inactive** (`B02-AU-06`, sans document) |

## Décisions prises le 23/09 (le pilote a laissé le choix)

1. **Une branche d'un même choix = un champ** (liste ou oui/non), ou une question de cadrage : maintenu. Les comptes de
   l'esquisse restent indicatifs ; l'écran Administrateur n'alerte que sur une rubrique vide.
2. **Lignes sans document et points d'interrogation** : chargées inactives ou écartées, comme listé ci-dessus ; l'Administrateur
   réactive ou crée ce qu'il veut depuis l'écran « Champs de la fiche marché ».
3. **Contrat-cadre** : différé au **lot 4**, avec pour défaut la répartition proposée par l'esquisse (règles de consultation
   → DPAC, clauses contractuelles → AE, pas de CCAP propre). Il ne peut pas être chargé avant : la migration n'a pas de
   rubriques pour le bloc B07 et le cadrage refuse ce type au lot 1.

## Points laissés au pilote (sans urgence)

- **B03-CQ-01 Identification et situation juridique** : la note de l'équipe suggère un **téléversement** plutôt qu'une saisie
  (« mety upload ») ; chargé en `TEXTE_LONG` (liste des pièces exigées), à passer en `PIECE` au lot 2 si confirmé.
- **B04-CO-01 Documents et pièces constituant l'offre** : idem, la note parle d'un formulaire à cocher.
- **B05-TP « Type de prix » (AE, 4 attendus)** : entièrement porté par la question de cadrage `typePrix` ; les lignes
  « selon bordereau de prix » / « aux quantités réellement livrées » sont des rédactions, pas des saisies.
- **B08-AV « Avance » (9 attendus)** : « Avance forfaitaire prévue », « applicable ou pas », « % du montant » sont portées
  par le cadrage (`avance`, `tauxAvance`) ; « Remboursement ?? », « Précompte ?? » chargées comme champs optionnels
  (`B08-AV-05`, `B08-AV-06`) en attendant la confirmation.
- **Garantie de bonne exécution, retenue de garantie, acompte** : chargées en `OUI_NON` + précision, car le fichier ne
  tranche pas (« Requise ou pas », « Pratiqué ou pas », « ACOMPTE ??? »).
