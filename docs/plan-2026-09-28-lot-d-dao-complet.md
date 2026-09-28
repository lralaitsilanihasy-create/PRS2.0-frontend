# Plan — 2026-09-28 — Lot D : le DAO complet sur les documents types officiels

**Statut : feu vert du pilote le 28/09. Première tranche (contrat-cadre) décrite et vérifiée côté front ; moteur
demandé au backend (`docs/demande-backend-2026-09-28-lot-d-dao-complet.md`). Questions au pilote : §5.**

## 1. Ce que change le lot D

Aujourd'hui, la validation d'une fiche produit ses documents (DPAO ou DPAC, AE, CCAP) sous forme de **listes
« libellé : valeur »**, bloc par bloc (lot 2a). Le lot D les remplace par **le document type de l'ARMP, rempli** :

- son **texte fixe**, lu dans le document type, jamais retapé ;
- ses **trous remplis** par la fiche (`{{CODE}}`) ;
- parmi les rédactions qu'il propose (« Choix 1 / Choix 2 », « choisir entre … / … »), **la seule retenue** d'après
  le cadrage et les réponses de la fiche ;
- ses **instructions et exemples retirés**, comme le modèle le demande (« les commentaires … doivent être supprimés
  du contrat finalisé ») ;
- ce qui se remplit **après** le DAO — par le candidat, ou à la notification — reste entre chevrons.

La chaîne est celle des formulaires du candidat (27/09), qui a fait ses preuves : `scripts/modeles-dao/` (README).

## 2. Découpage

| tranche | documents | source | état |
|---|---|---|---|
| **D1 — contrat-cadre** | DPAC, AE (valant CCAP) | « Document type Contrat-cadre — Fournitures & Prestations de services » | ✅ front : `DPAC-CC` (133 paragraphes, 14 conditions), `AE-CC` (263 paragraphes, 53 conditions), vérifiés ; ⏳ backend : moteur (B1), jetons (B2), production (B3), 9 champs (B4) |
| D2 — fournitures, quantité fixe et à commande | DPAO (doc 2), AE (doc 4), CCAP (doc 5) | les six documents types « Fournitures » déjà remis | à décrire après D1 : même moteur, sections imbriquées (DPAO) |
| D3 — pièces fixes | Instructions aux candidats (doc 1), CCAG (doc 6) | idem | **jointes telles quelles** (l'audit du 27/09 : 0 et 2 trous) — un document produit sans jeton, ou le `.doc` officiel en pièce |
| D4 — avis spécifique | avis d'appel d'offres | partie « Avis spécifiques » des documents types | après D2 ; les jetons de la remise électronique y sont prêts (plan du 27/09, Q5) |
| D5 — travaux, prestations intellectuelles | selon leurs documents types | **à remettre par le pilote** | — |

## 3. D1 en chiffres

| | DPAC | AE |
|---|---|---|
| paragraphes | 133 | 263 |
| conditions déclarées | 14 | 53 |
| trous remplis par la fiche (jetons) | 50 | 50 |
| choix (rédaction du modèle gardée mot pour mot) | 10 | 16 |
| instructions retirées dans une ligne | 5 | 41 |
| lignes entières retirées (sommaire, « Choix n », exemples) | 41 | 63 |
| fidélité du décalque au modèle (`verifier.mjs`) | 174 / 174 | 378 / 378 |

Décalques de relecture : `docs/modeles-dao/DPAC-CC.docx`, `AE-CC.docx` — toutes les rédactions y figurent, entre
leurs marqueurs `{{SI:…}}` / `{{FINSI:…}}` ; les déclarations de conditions sont en tête de `scripts/modeles-dao/modeles/*.txt`.

**Décisions prises en décrivant** (toutes réversibles dans `decrire.mjs`) :

- **Art. 7.4 de l'AE (délais d'exécution)** : le modèle propose, pour chaque cas, deux phrases (« à compter de la
  notification » / « de l'ordre de service ») avec deux trous. La fiche a un seul texte libre par cas (`B07-DE-02`,
  `B07-DE-03`) : le paragraphe est ce texte, la PRMP y écrit la phrase. Idem pour une dérogation aux pénalités du
  CCAG (`B07-PE-03`, « rédiger librement la rubrique »).
- **Art. 7.1 de l'AE (durée)** : « <préciser la durée — cette durée ne peut excéder 2 ans> » reçoit `B02-DC-02`
  (première période de validité), cohérent avec le DPAC art. 2. Le plafond attend le juriste (analyse du 28/09, § 6).
- **Art. 10 de l'AE (avance)** : les § 10.1 à 10.4 ne s'impriment que si le cadrage prévoit une avance ; le § 10.5
  (sous-traitant) que si `B08-FI-05` = Oui.
- **Remise électronique (DPAC art. 5.2)** : les conditions de transmission ne sont écrites nulle part dans le modèle —
  `[[CLAUSE À FOURNIR PAR LE JURISTE : …]]`, visible, comme C1 / C2 le 27/09.
- **Le CCAG** : ce modèle est celui des fournitures et services ; partout où il écrit « CCAG Fournitures / CCAG
  Travaux <choisir> », la mention des fournitures est gardée, sans condition.

## 4. Ce que le modèle n'imprime pas

**47 informations de la fiche du contrat-cadre ne correspondent à aucun trou** du DPAC ni de l'AE. La plupart sont
normales : reprises du plan (B01 et lots du plan, 17), reflets du cadrage, dates de notification (remplies après), durées
d'antécédents (servent aux formulaires A1 / A3). Restent **dix informations obligatoires** que la PRMP saisit et
qu'aucun document n'imprime, parce que le modèle écrit la chose en dur :

| code | libellé | ce que le modèle écrit à la place |
|---|---|---|
| `B04-DS-02` | Langue du dossier et des offres | art. 8 : « en langue française », fixe |
| `B04-DS-03` | Modalités d'acquisition du dossier | art. 3.3 : texte fixe (adresse et montant, eux, sont imprimés) |
| `B06-SC-01` | Modalités d'ouverture des plis | art. 6.1.1 : texte fixe |
| `B06-SO-04` | Comparaison des offres | art. 6.2 §4 : titre fixe ; le contenu est `B06-SO-05`, imprimé |
| `B07-DU-01` | Entrée en vigueur du contrat-cadre | art. 7.1 : « à compter de sa notification », fixe |
| `B07-DU-06` | Durée totale du contrat-cadre (mois) | doublon de `B02-DC-01` (durée maximale, reconductions comprises) |
| `B07-MA-03` | Attribution après remise en concurrence (non alloti) | art. 4 choix 2.1 : texte fixe |
| `B07-PI-01` | Pièces contractuelles | art. 6 : liste fixe |
| `B08-FP-03` | Délai de paiement (jours) | art. 15.3 : « 75 jours », fixe (le contrôle `DELAI_PAIEMENT_75` le vérifie) |
| `B10-RS-01` | Résiliation sans faute | art. 18.1 : texte fixe ; le préavis et les fautes sont les nouveaux `B10-RS-02` / `03` |

Et onze facultatives dans le même cas : `B04-DS-06`, `B06-SO-01`…`03`, `B07-DE-04`, `B08-FI-04`, `B08-FP-05`,
`B09-AU-02`, `B09-EA-03`, `B03-SS-01` et `B03-SS-02`.

## 5. Questions au pilote

| # | Question | Recommandation |
|---|---|---|
| **Q1** | Les documents au format du modèle **remplacent**-ils les listes « libellé : valeur » dans le dossier soumis à la Commission ? | **Oui**, pour les formes décrites (repli sur le lot 2a pour les autres). La fiche reste consultable à l'écran telle quelle — c'est elle que la Commission contrôle point par point. |
| **Q2** | Les dix informations obligatoires que rien n'imprime (§4) ? | **Les rendre facultatives** (pas les supprimer : elles peuvent servir à un contrôle) ; `B07-DU-06` désactivée (doublon). À trancher avant la prochaine demande backend. |
| **Q3** | Les délais d'exécution (AE art. 7.4) en texte libre, ou en champs structurés (prestations, délai, point de départ) ? | **Texte libre** pour D1 ; à structurer si la Commission le demande. |
| **Q4** | Ordre de la suite : fournitures (D2) avant l'avis spécifique (D4) ? | **Oui** : c'est la forme la plus employée (le 2463 est un marché à commande). |
| **Q5** | Relecture des décalques `docs/modeles-dao/*.docx` par le juriste ? | **Oui**, avant la recette du backend : c'est lui qui dira si une rédaction retenue ou retirée est juste. |
