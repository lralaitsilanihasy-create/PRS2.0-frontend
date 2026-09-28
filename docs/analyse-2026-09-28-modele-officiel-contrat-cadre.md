# Analyse — 2026-09-28 — Le modèle officiel du contrat-cadre (fournitures et services) face à la fiche DAO

**Source** : `Documents Types/Fournitures et services/Document type Contrat-cadre-Fournitures & Prestations de
services.doc` (ARMP, « Documents-types Fournitures et services 2019 », 33 pages), remis par le pilote le 28/09,
converti par Word et lu en entier. **Confronté à** : le référentiel servi par le serveur local le 28/09
(`GET /api/champs-fiche-marche?typeMarche=CONTRAT_CADRE&categorie=FOURNITURES_SERVICES` → 11 blocs, **176 champs**),
lui-même converti le 23/09 du **classeur de correspondance** (`docs/referentiel-champs-fiche-marche-contrat-cadre.md`),
jamais encore du modèle officiel.

**Statut : constat. Rien n'est modifié** ni dans le référentiel ni dans le code ; les corrections proposées (§4)
attendent l'arbitrage du pilote (§5).

## 1. Ce que contient le modèle officiel

| Partie | Pages | Rôle | Produit par la fiche aujourd'hui ? |
|---|---|---|---|
| **Avis spécifique** d'appel d'offres ouvert | 2 | publicité (9 points) | non — comme pour les autres formes, l'avis n'est pas produit |
| **Données particulières d'appel à concurrence** = *Règlement de la consultation* (12 articles + calendrier) | ≈ 8 | le **DPAC** | oui, sous forme « libellé : valeur » bloc par bloc |
| **Contrat-cadre valant acte d'engagement et CCAP** (préambule + 20 articles + renvois) | ≈ 15 | l'**AE** | oui, même forme |
| **Lettre d'invitation pour le marché subséquent** + annexe 1 (9 articles) + annexe 2 (clauses techniques) | ≈ 4 | la remise en concurrence **après** attribution | non — hors du DAO (voir §3, E14) |

**Première confirmation** : le titre même de la troisième partie, « contrat-cadre **valant acte d'engagement et
CCAP** », tranche en faveur de la décision 1 du 23/09 — pas de CCAP séparé, l'AE porte les clauses. Le couple de
documents produits **DPAC + AE** est juste.

**Deuxième confirmation** : les options de liste du référentiel reprennent fidèlement les « Choix » du modèle (forme
des marchés subséquents, délais d'exécution 1.1 / 1.2 / 1.3, pénalités 1 / 2.1 / 2.2, vérification CCAG / clause
libre, qualité du représentant…). Le classeur de correspondance avait bien été tiré de ce modèle.

## 2. Couverture, article par article

Légende : ✅ couvert · ⚠️ couvert avec un écart (§3) · ❌ absent · — rédaction fixe du modèle, rien à saisir.

### Données particulières (DPAC)

| Article du modèle | Trou à remplir | Champ(s) |
|---|---|---|
| Page de garde | nature, numéro, objet, procédure, PRMP, **date et heure** limites | `B01-AC-12`, `B02-OE-01`, `B02-OB-01`, `B01-AC-13`, `B01-AC-05` ✅ ; `B04-CP-02` ⚠️ E1 |
| Art. 1 Objet et étendue | objet détaillé ; mono / multi-attributaire ; procédure et article du code ; rythme de remise en concurrence ; calendrier escompté | `B02-OB-01`, `B02-AL-03` (cadrage), `B02-PC-01`, `B02-PC-02` ⚠️ E5, `B02-PC-03` ✅ |
| Art. 2 Dispositions générales | forme de prix ; montant indicatif HT ; durée maximale, première période, reconduction ; allotissement | `B05-TP-01`, `B05-MT-01`, `B02-DC-01`…`04` ⚠️ E3, `B02-AL-02` ✅ |
| Art. 2 Calendrier prévisionnel de la consultation | réception des offres ; **envoi des demandes d'offres optimisées** ; **réception des offres optimisées** ; envoi des courriers de rejet ; notification prévisionnelle | `B04-CP-02`, `B04-CP-05` ✅ ; ❌ E2 pour les trois autres |
| Art. 3 Dossier de consultation | contenu et pièces ajoutées ; langue ; adresse (nom, fonction, bureau, localité) ; acquisition (adresse, montant) ; modification | `B04-DS-01`…`06` ✅ |
| Art. 4 Présentation des offres | pièces de candidature ; pièces de l'offre | `B04-PO-01`, `B04-PO-02` ✅ |
| Art. 5 Remise des offres | modalités papier, mention du pli, adresse ; **voie électronique admise ou non** | `B04-RQ-01`…`03` ✅ ; `B04-RQ-04` / `05` ⚠️ E4 |
| Art. 6 Examen | ouverture ; critères d'élimination ; procédure de sélection (4 étapes) ; critères et mécanisme de jugement | `B06-SC-01`, `B06-SC-02`, `B06-SO-01`…`05` ✅ (délai de complétude de 10 jours : —) |
| Art. 7 Critères d'attribution | critères, pondérations, modalités | `B06-CA-01` ✅ (texte libre) |
| Art. 8 Langue, monnaie | devise en cas d'AO international | `B04-DS-02`, `B05-UM-01` ✅ |
| Art. 9 Marchés subséquents | rythme ; adresse des devis ; délai en heures | `B07-PS-01` ⚠️ E5, `B07-PS-02`, `B07-PS-03` ✅ |
| Art. 10 Renseignements | adresse ; nombre de jours | `B04-RC-01`, `B04-RC-02` ✅ |
| Art. 11 **Voies et délais de recours** | instance chargée des recours | ❌ E6 |
| Art. 12 Calendrier prévisionnel | avis, date-heure limite, séance, attribution, notification | `B04-CP-01`…`05` ✅ (⚠️ E1 pour l'heure) |

### Contrat-cadre valant AE et CCAP

| Article du modèle | Trou à remplir | Champ(s) |
|---|---|---|
| Page de garde | unique ou lot n° ; numéro ; dates de notification ; nombre de pages | `B02-OE-01`, `B06-NO-01`, `B06-NO-02` ✅ ; lot : cadrage ✅ ; pages : calculé à l'impression — |
| Préambule | personne publique ; **personne habilitée à signer**, délégation et date ; personne responsable des marchés subséquents, délégation ; procédure (AOO art. 35-37 / AOR art. 38 / consultation art. 41) | `B01-AC-01`, `02`, `B02-SG-01`, `B02-SG-02`, `B01-AC-13` ✅ ; signataire du contrat-cadre ❌ E7 |
| Art. 1 Contractants | PRMP, **acte de nomination** (nature, numéro, date) ; titulaire ou groupement | `B01-AC-05` ✅ ; nomination ❌ E7 ; `B03-TI-*`, `B03-GC-*` ⚠️ E8 |
| Art. 2 Objet | objet ; alloti ou non, mono / multi ; lots ; lot du présent contrat | ✅ |
| Art. 3 Forme des subséquents | fractionnés ou non ; service interlocuteur | `B07-FS-01`, `B07-FS-02` ✅ |
| Art. 4 Attribution des subséquents | mono : délai de complétude (1.1 / 1.2) ; multi : non alloti / alloti (options 1 / 2) ; **paragraphe commun 2.3** (survenance / périodicité) ; **critères et sous-critères pondérés** | `B07-MA-01`, `02`, `03` ✅ ; `B07-MA-04` / `05` ⚠️ E9 ; critères pondérés ❌ E10 |
| Art. 5 Termes non couverts | mono / multi | `B07-TN-01`, `02` ✅ |
| Art. 6 Pièces contractuelles | liste ; **CCAG applicable** | `B07-PI-01` ✅ ; choix du CCAG : — (fournitures fixé par la catégorie) |
| Art. 7.1 Durée | durée — « ne peut excéder 2 ans » | `B07-DU-01` ✅, contrôle ❌ E3 |
| Art. 7.2 Durée des subséquents | fixée ou non ; **« nombre de jours »** | `B07-DU-02` ✅, `B07-DU-03` ⚠️ E11 (en mois) |
| Art. 7.3 Reconductions | nombre de fois ; maximum en années ; **préavis de décision (mois)** | `B07-DU-04`, `05` ✅ ; préavis ❌ E12 |
| Art. 7.4 Délais d'exécution | 1.1 / 1.2 / 1.3 ; 2 (bons de commande) | `B07-DE-01`…`04` ✅ |
| Art. 7.5 Pénalités | non applicables / contrat-cadre (CCAG ou dérogation) / subséquents | `B07-PE-01`…`03` ✅ ; `B09-PR-01` ⚠️ E13 |
| Art. 8 Montant | HT et TTC, sans minimum ni maximum | `B05-MT-01`, `02` ✅ |
| Art. 9 Prix | mono 1.1 / 1.2 / 1.3 ; multi 2.1 / 2.2 ; plafond d'augmentation X % ; catalogue ; contenu ; actualisation | `B05-PM-01`, `02`, `03` ✅ ; X % et catalogue ❌ E10 ; formule d'actualisation : — |
| Art. 10 Avance | délai de versement ; montant ≤ 20 % TTC ; remboursement ; sous-traitant | `B08-FI-02`…`05` ✅ ; `B08-AV-01` / `02` ⚠️ E13 |
| Art. 11 Sous-traitance | désignation ; paiement direct | `B03-SS-01`, `02` ✅ |
| Art. 12-14 | exécution ; vérification ; garanties (délai de garantie) | `B09-EA-*`, `B09-VA-*`, `B09-GP-*` ✅ |
| Art. 15 Paiement | présentation ; adresse ; délai 75 j ; intérêts ; banque, compte, RIB | `B08-FP-01`…`09` ✅ (⚠️ E8 pour la banque) |
| Art. 16-19 | assurance ; changements ; résiliation (préavis en mois, hypothèses de faute) ; juridiction | `B09-AU-*`, `B10-*` ✅ |
| Art. 20 Signature | **délai de validité des offres** (si le prix est un critère) ; annexes ; mise au point ; lieu, date | validité ❌ E6 ; le reste : candidat ou signature — |

**Bilan** : sur ≈ 95 trous distincts du DPAC et du contrat-cadre, **≈ 80 sont couverts**, dont une dizaine avec un
écart ; **une dizaine manquent** (E2, E6, E7, E10, E12 — dont deux, E6, existent déjà pour la quantité fixe). Au regard du modèle, le référentiel porte en trop les informations du candidat (E8)
et des doublons (E4, E5, E13).

## 3. Les écarts

| # | Écart | Gravité | Proposition |
|---|---|---|---|
| **E1** | `B04-CP-02` « Date **et heure** limites de remise des offres » est de type `DATE` : l'heure, exigée par la page de garde et l'art. 12, ne peut pas être saisie. Le type `DATE_HEURE` existe depuis V50. (La quantité fixe s'en sort par deux champs, `B04-LR-03` DATE + `B04-LR-04` heure en TEXTE.) | haute | Passer `B04-CP-02` en `DATE_HEURE` ; vérifier que `DATES_ORDRE` compare une date-heure à des dates — **backend**. |
| **E2** | Le calendrier de l'art. 2 a trois étapes propres au contrat-cadre, absentes : envoi des demandes d'**offres optimisées**, réception des offres optimisées, envoi des courriers de rejet. | moyenne | Trois `DATE` dans `B04-CP` (`06`…`08`), facultatives, ordonnées par `DATES_ORDRE`. |
| **E3** | L'art. 7.1 de l'AE dit « cette durée **ne peut excéder 2 ans** » ; l'exemple de l'art. 2 du DPAC parle de « 36 mois à compter de la notification ». Le modèle se contredit ; aucun contrôle ne porte sur `B02-DC-01`. | moyenne | **Question au juriste** (Q3) : plafond de 24 mois ou non. Puis contrôle de bilan `DUREE_CONTRAT_CADRE_MAX`. |
| **E4** | Voie électronique : `B04-RQ-04` « Transmission électronique admise » (OUI_NON) et `B04-RQ-05` coexistent avec `B04-SE-01` « Mode de remise » (question de cadrage `modeRemise`, V50). Deux réponses possibles à la même question, qui peuvent se contredire. C'est le cas `B04-VE-01` des fournitures, tranché le 27/09. | haute | Même arbitrage que pour les fournitures : `B04-RQ-04` **dérivé** de `modeRemise` (non saisi), `B04-RQ-05` conditionné par `modeRemise = ELECTRONIQUE`. |
| **E5** | La même alternative « au fur et à mesure / lors de la survenance du besoin » **ou** « selon le calendrier » est posée **trois fois** : `B02-PC-02` (DPAC art. 1), `B07-PS-01` (DPAC art. 9), et le paragraphe commun 2.3 de l'AE art. 4 (qui se retrouve dans `B07-MA-05`, E9). | moyenne | Une seule réponse — `B02-PC-02`, reprise dans l'AE — et les deux autres dérivées. |
| **E6** | Deux informations du modèle n'ont pas de champ : l'**instance chargée des recours** (DPAC art. 11 — ce n'est pas la juridiction des litiges de l'AE, `B10-VR-01`) et le **délai de validité des offres** (AE art. 20, lettre d'invitation art. 8). | haute pour la validité | Les deux champs **existent déjà pour la quantité fixe** : `B04-VO-01` « Délai de validité des offres (jours) » et `B06-AN-02` « Recours gracieux et recours en attribution ». Il suffit d'ajouter `CONTRAT_CADRE` à leurs `typesMarche` (maître DPAO → DPAC par `documentEffectif`, CCAP → AE). |
| **E7** | Le préambule et l'art. 1 demandent la **personne habilitée à signer le contrat-cadre** (délégation, date) et l'**acte de nomination** de la PRMP (nature, numéro, date). Seule la personne responsable des marchés *subséquents* (`B02-SG-01`/`02`) existe. | moyenne | `B02-SG-03` signataire du contrat-cadre et délégation ; `B02-SG-04` acte de nomination de la PRMP (ou repris des mandats PRMP, qui connaissent l'acte ? à vérifier). |
| **E8** | `B03-TI-*` (titulaire), `B03-GC-*` (groupement) et `B08-FP-06`…`09` (banque, RIB) sont **obligatoires** dans la fiche de l'autorité contractante. Le modèle les laisse **au candidat** (« <cocher la case>», renvois (2) à (9)) : l'autorité ne les connaît pas quand elle prépare le DAO. | haute | Les sortir de la fiche (ou les rendre facultatifs, « à remplir par le candidat ») ; ils rejoignent les **formulaires en ligne du candidat** (maquette du 27/09). |
| **E9** | `B07-MA-04` / `B07-MA-05` ont pour options « Option 1 / Option 2 », illisibles sans le modèle sous les yeux ; et le libellé de `MA-05` (« à la fois alloti et non alloti ») lit mal le modèle : le choix 2.3 est le **paragraphe commun** aux deux cas, qui oppose « lors de la survenance du besoin » à « selon une périodicité ». | moyenne | Options rédigées : `MA-04` « Titulaires des lots correspondant à l'objet du marché » / « Titulaires de tous les lots » ; `MA-05` → absorbé par E5, plus la **périodicité** en texte. |
| **E10** | Rien pour les **critères et sous-critères pondérés** de la remise en concurrence (AE art. 4, choix 2.3), ni pour le **plafond d'augmentation des prix « X % »** et le **catalogue** (art. 9). | moyenne | Critères : `TEXTE_LONG` au premier lot. X % : `POURCENTAGE` facultatif (« à remplir par le candidat » si c'est un critère). Catalogue : `OUI_NON`. |
| **E11** | `B07-DU-03` « Durée des marchés subséquents (**mois**) » ; le modèle écrit « <préciser le nombre de **jours**> jours ». | basse | Libellé et unité en jours. |
| **E12** | Préavis de décision de reconduction (« <nombre de mois> mois au moins avant la fin ») et préavis de résiliation sans faute (art. 18.1) : le second est dans le texte libre `B10-RS-01`, le premier nulle part. | basse | `B07-DU-07` préavis de reconduction (mois), conditionné par `B02-DC-03 = OUI`. |
| **E13** | Doublons hérités des blocs communs : `B08-AV-01` / `02` (avance, maître **CCAP**) avec `B08-FI-02` / `03` (avance, AE) ; `B09-PR-01` (régime des pénalités, **CCAP**) avec `B07-PE-01`. En contrat-cadre, le CCAP devient l'AE : la même information s'imprime deux fois, avec deux valeurs possibles. | moyenne | Retirer `B08-AV-*` et `B09-PR-01` du contrat-cadre (`typesMarche`), les réponses de cadrage `avance` / `penalites` alimentant `B08-FI-*` / `B07-PE-*`. |
| **E14** | La **lettre d'invitation au marché subséquent** et ses deux annexes ne sont pas des pièces du DAO : elles naissent **après** l'attribution du contrat-cadre, à chaque besoin. | — | Hors de la fiche DAO. Elles appellent un module « marchés subséquents » à part (non demandé). |

## 4. Ce que le document officiel change pour la suite

1. **Le référentiel du contrat-cadre peut désormais être vérifié contre sa source réelle**, comme les formulaires
   du candidat l'ont été (`verifier-armp.mjs`). Les corrections E1-E13 sont des modifications de **référentiel**
   (écran Administrateur ou CSV) plus trois contrôles de bilan, et une migration seulement si des champs sont
   retirés d'un type (`typesMarche`).
2. **Le DPAC et l'AE produits restent des listes « libellé : valeur »**, alors que le modèle est un règlement en 12
   articles et un contrat en 20. Produire les documents **au format du modèle** (texte fixe + trous remplis + choix
   retenus) est le même chantier que le « DAO complet » (lot D) des fournitures : ce document en est la matière pour
   le contrat-cadre.
3. **Import du DAO** (plan du 28/09) : le modèle officiel donne les **ancrages** du contrat-cadre (article et phrase
   repère de chaque trou), à mettre dans la même colonne d'ancrage (Q5 du plan).

## 5. Questions au pilote

| # | Question | Recommandation |
|---|---|---|
| **Q1** | Corriger le référentiel du contrat-cadre selon E1-E13 ? | **Oui, en un lot** : demande backend unique (référentiel + trois contrôles), le front n'a presque rien à changer (types et conditions déjà gérés). |
| **Q2** | Les informations du candidat (E8 : titulaire, groupement, banque) sortent-elles de la fiche ? | **Oui** : elles vont aux formulaires en ligne du candidat. Dans la fiche, elles bloquent la validation pour une information que la PRMP n'a pas. |
| **Q3** | Durée du contrat-cadre : plafond de 2 ans (AE art. 7.1) ou 36 mois (exemple du DPAC art. 2) ? | **Question au juriste**, avec l'article du code (loi 2016-055) ; le contrôle attend sa réponse. |
| **Q4** | Voie électronique (E4) : même règle que les fournitures ? | **Oui** : `modeRemise` est la seule réponse, `B04-RQ-04` en découle. |
| **Q5** | Produire le DPAC et l'AE au format du modèle ? | **Plus tard**, avec le lot D des fournitures ; ce n'est pas bloquant pour la saisie. |
