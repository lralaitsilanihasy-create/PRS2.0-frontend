# Référentiel des champs de la fiche DAO — travaux et réhabilitation

**Date** : 2026-09-24 · **Source** : `NatureMarches/DAO_Travaux.xlsx`, remis par le pilote — deux feuilles,
416 lignes d'information, 144 rubriques. · **Analyse préalable** : `analyse-2026-09-24-dao-travaux.md`.

**Fichiers chargeables**, au format d'import de l'API Administrateur (UTF-8, séparateur `;`, en-têtes = noms JSON,
listes séparées par des virgules), avec la colonne **`categories`** ajoutée au lot 5 :

| fichier | formes de marché | champs |
|---|---|---|
| `referentiel-champs-fiche-dao-travaux.csv` | quantité fixe et à commande | **140** |
| `referentiel-champs-fiche-dao-travaux-contrat-cadre.csv` | contrat-cadre | **117** |

**257 champs, 96 rubriques**, tous de catégorie `TRAVAUX`.

## Ce que donne la conversion

| | travaux ordinaires | contrat-cadre de travaux |
|---|---|---|
| champs | 140 | 117 |
| rubriques | 57 | 39 |
| obligatoires | 77 | 75 |
| inactifs | 1 | 1 |
| DPAO / DPAC | 50 | 37 |
| AE | 18 | 80 |
| CCAP | 72 | 0 |
| dont type `PIECE` | 6 | 0 |

**Le contrat-cadre de travaux ne produit pas de CCAP**, comme celui des fournitures : quatre-vingts de ses champs
vont à l'acte d'engagement, qui est le contrat. La règle prise le 23/09 vaut donc pour les deux catégories.

## Règles de conversion (les mêmes que pour les deux fichiers précédents)

1. **Une ligne du classeur = un champ**, sauf quand plusieurs lignes sont les **branches d'un même choix** : elles
   deviennent un seul champ `LISTE` ou `OUI_NON`. Les 416 lignes donnent 257 champs.
2. **Le document maître** est la colonne portant `AS` ; **les reprises** sont les colonnes portant `x`.
3. **Les 22 informations du plan ne sont pas dans les CSV** : le serveur les relit de la ligne, et elles valent
   déjà pour les trois catégories depuis le lot 5.
4. **Le type** est déduit du libellé : montant → `MONTANT`, « nombre de jours / mois / heures » → `NOMBRE`,
   « % » ou « millièmes » → `POURCENTAGE`, date → `DATE`, choix → `LISTE` / `OUI_NON`, `FAR` → **`PIECE`**,
   le reste `TEXTE_LONG` (clauses) ou `TEXTE` (courts).
5. **La condition d'affichage** ne référence que des **réponses de cadrage** : `alloti`, `groupement`,
   `attributaires`, `avance`, et **`tranches`**, la question propre aux travaux livrée au lot 5.
6. **Contrôles** réemployés du catalogue existant : `DATES_ORDRE` sur les cinq dates du contrat-cadre et sur la
   remise des offres, `MONTANT_POSITIF`, `AVANCE_SUP_5_GARANTIE`, `DELAI_PAIEMENT_75`,
   `INTERETS_MORATOIRES_TAUX`, `PENALITES_PLAFOND_15`.
7. **Types de marché** : la feuille « A tranche_Alloti » vaut `QUANTITE_FIXE,A_COMMANDE` — les travaux n'ont pas de
   forme propre, les tranches étant une réponse de cadrage (décision A de l'analyse). La feuille « Contrat-cadre »
   vaut `CONTRAT_CADRE`.
8. **Catégorie** : `TRAVAUX` pour les 257.

## Les rubriques à semer par migration

Une rubrique ne se crée pas par l'API : le backend l'a rappelé au lot 5, le `POST` d'un champ exige sa rubrique.
Voici les **96 rubriques** et le **bloc `B11`** à créer avant l'import des champs.

**Bloc neuf** : `B11` « Annexes et formulaires », rang 11, catégories `TRAVAUX`. Les dix autres blocs existent.

Les rangs partent de 61 pour se ranger après les rubriques des fournitures, qui occupent 1 à 60 ; `B11` numérote
les siennes à partir de 61 également, il n'a pas d'autre occupant.

| code | bloc | libellé | rang | document maître | nb attendu | types de marché |
|---|---|---|---|---|---|---|
| `B02-CT` | B02 | Contrôle technique | 61 | DPAC | 2 | CONTRAT_CADRE |
| `B02-DK` | B02 | Décomposition et durée de la consultation | 62 | DPAC | 5 | CONTRAT_CADRE |
| `B02-LT` | B02 | Lots, variantes et tranches | 63 | DPAO | 5 | QUANTITE_FIXE,A_COMMANDE |
| `B02-MC` | B02 | Maîtrise d’œuvre | 64 | DPAC | 2 | CONTRAT_CADRE |
| `B02-MW` | B02 | Maîtrise d'ouvrage et maîtrise d'œuvre | 65 | AE | 3 | QUANTITE_FIXE,A_COMMANDE |
| `B02-OC` | B02 | Objet et étendue du contrat-cadre | 66 | DPAC | 2 | CONTRAT_CADRE |
| `B02-OT` | B02 | Objet et consistance des travaux | 67 | DPAO | 2 | QUANTITE_FIXE,A_COMMANDE |
| `B02-SN` | B02 | Signature et engagement des parties | 68 | AE | 3 | CONTRAT_CADRE |
| `B02-SW` | B02 | Personne responsable et délégation | 69 | AE | 3 | CONTRAT_CADRE |
| `B03-GM` | B03 | Membres du groupement | 61 | AE | 6 | CONTRAT_CADRE |
| `B03-GT` | B03 | Groupement | 62 | DPAO | 5 | QUANTITE_FIXE,A_COMMANDE |
| `B03-NT` | B03 | Nantissement | 63 | AE | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B03-QT` | B03 | Capacité et qualifications des candidats | 64 | DPAO | 11 | QUANTITE_FIXE,A_COMMANDE |
| `B03-SM` | B03 | Sous-traitance des marchés subséquents | 65 | AE | 2 | CONTRAT_CADRE |
| `B03-SU` | B03 | Sous-traitance | 66 | AE | 2 | QUANTITE_FIXE,A_COMMANDE |
| `B03-TT` | B03 | Titulaire | 67 | AE | 5 | CONTRAT_CADRE |
| `B04-CD` | B04 | Composition du dossier | 61 | DPAO | 3 | QUANTITE_FIXE,A_COMMANDE |
| `B04-CT` | B04 | Calendrier prévisionnel | 62 | DPAC | 5 | CONTRAT_CADRE |
| `B04-DK` | B04 | Dossier de consultation | 63 | DPAC | 4 | CONTRAT_CADRE |
| `B04-DV` | B04 | Délai de validité des offres | 64 | DPAO | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B04-EQ` | B04 | Demande d'éclaircissement | 65 | DPAO | 2 | QUANTITE_FIXE,A_COMMANDE |
| `B04-FP` | B04 | Remise des offres — forme des plis | 66 | DPAO | 3 | QUANTITE_FIXE,A_COMMANDE |
| `B04-LG` | B04 | Langue | 67 | DPAO | 2 | QUANTITE_FIXE,A_COMMANDE |
| `B04-OV` | B04 | Ouverture des plis | 68 | DPAO | 2 | QUANTITE_FIXE,A_COMMANDE |
| `B04-PI` | B04 | Contenu de l'offre | 69 | DPAO | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B04-PT` | B04 | Présentation des candidatures et des offres | 70 | DPAC | 1 | CONTRAT_CADRE |
| `B04-RN` | B04 | Renseignements complémentaires | 71 | DPAC | 1 | CONTRAT_CADRE |
| `B04-RP` | B04 | Réunion préparatoire | 72 | DPAO | 2 | QUANTITE_FIXE,A_COMMANDE |
| `B04-RT` | B04 | Conditions de remise des plis | 73 | DPAC | 3 | CONTRAT_CADRE |
| `B04-VL` | B04 | Visite des lieux | 74 | DPAO | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B04-VS` | B04 | Visites sur site | 75 | DPAC | 2 | CONTRAT_CADRE |
| `B04-VT` | B04 | Délai de validité des offres | 76 | DPAC | 1 | CONTRAT_CADRE |
| `B05-AG` | B05 | Autres garanties | 61 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B05-GA` | B05 | Garantie de restitution d'avance | 62 | CCAP | 2 | QUANTITE_FIXE,A_COMMANDE |
| `B05-GE` | B05 | Garantie de bonne exécution | 63 | CCAP | 4 | QUANTITE_FIXE,A_COMMANDE |
| `B05-GQ` | B05 | Garantie de soumission | 64 | DPAO | 3 | QUANTITE_FIXE,A_COMMANDE |
| `B05-MC` | B05 | Montant du contrat-cadre | 65 | AE | 2 | CONTRAT_CADRE |
| `B05-MN` | B05 | Monnaie | 66 | DPAO | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B05-PT` | B05 | Type de prix | 67 | AE | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B05-PX` | B05 | Prix des marchés subséquents | 68 | AE | 3 | CONTRAT_CADRE |
| `B05-RG` | B05 | Retenue de garantie | 69 | CCAP | 2 | QUANTITE_FIXE,A_COMMANDE |
| `B05-UT` | B05 | Unité monétaire | 70 | DPAC | 1 | CONTRAT_CADRE |
| `B05-VR` | B05 | Variation des prix | 71 | DPAO | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B06-ET` | B06 | Examen des candidatures et des offres | 61 | DPAC | 4 | CONTRAT_CADRE |
| `B06-EV` | B06 | Évaluation des offres | 62 | DPAO | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B06-PN` | B06 | Marge de préférence nationale | 63 | DPAO | 2 | QUANTITE_FIXE,A_COMMANDE |
| `B06-RC` | B06 | Relations avec les candidats | 64 | DPAO | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B07-AT` | B07 | Modalités d'attribution des marchés subséquents | 61 | AE | 5 | CONTRAT_CADRE |
| `B07-DT` | B07 | Durée et reconduction | 62 | AE | 7 | CONTRAT_CADRE |
| `B07-FT` | B07 | Forme des marchés subséquents | 63 | AE | 2 | CONTRAT_CADRE |
| `B07-NC` | B07 | Termes non couverts par le contrat-cadre | 64 | AE | 2 | CONTRAT_CADRE |
| `B07-OM` | B07 | Objet des marchés subséquents | 65 | AE | 2 | CONTRAT_CADRE |
| `B07-PJ` | B07 | Pièces contractuelles | 66 | AE | 1 | CONTRAT_CADRE |
| `B07-PT` | B07 | Passation des marchés subséquents | 67 | DPAC | 3 | CONTRAT_CADRE |
| `B07-PY` | B07 | Pénalités de retard | 68 | AE | 3 | CONTRAT_CADRE |
| `B07-XE` | B07 | Délais d'exécution des marchés subséquents | 69 | AE | 4 | CONTRAT_CADRE |
| `B08-AF` | B08 | Avances | 61 | CCAP | 5 | QUANTITE_FIXE,A_COMMANDE |
| `B08-AP` | B08 | Acomptes sur approvisionnements | 62 | CCAP | 2 | QUANTITE_FIXE,A_COMMANDE |
| `B08-AT` | B08 | Financement et sûretés des marchés subséquents | 63 | AE | 5 | CONTRAT_CADRE |
| `B08-DB` | B08 | Domiciliation bancaire | 64 | AE | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B08-EF` | B08 | Engagements financiers du maître de l’ouvrage | 65 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B08-FT` | B08 | Facturation et paiement | 66 | AE | 9 | CONTRAT_CADRE |
| `B08-MO` | B08 | Intérêts moratoires | 67 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B08-MR` | B08 | Modalités de règlement des comptes | 68 | CCAP | 4 | QUANTITE_FIXE,A_COMMANDE |
| `B08-RE` | B08 | Règlement des comptes | 69 | CCAP | 3 | QUANTITE_FIXE,A_COMMANDE |
| `B09-AC` | B09 | Assurances | 61 | CCAP | 3 | QUANTITE_FIXE,A_COMMANDE |
| `B09-AT` | B09 | Assurance | 62 | AE | 3 | CONTRAT_CADRE |
| `B09-CH` | B09 | Conditions de chantier et prix du marché | 63 | CCAP | 5 | QUANTITE_FIXE,A_COMMANDE |
| `B09-DC` | B09 | Documents contractuels | 64 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B09-DL` | B09 | Délai d'exécution | 65 | AE | 5 | QUANTITE_FIXE,A_COMMANDE |
| `B09-DT` | B09 | Date d'effet | 66 | AE | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B09-FM` | B09 | Cas de force majeure | 67 | CCAP | 2 | QUANTITE_FIXE,A_COMMANDE |
| `B09-GQ` | B09 | Garanties contractuelles particulières | 68 | AE | 2 | CONTRAT_CADRE |
| `B09-GT` | B09 | Délai de garantie | 69 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B09-MA` | B09 | Masse des travaux | 70 | CCAP | 4 | QUANTITE_FIXE,A_COMMANDE |
| `B09-MD` | B09 | Modification des délais d'exécution | 71 | CCAP | 2 | QUANTITE_FIXE,A_COMMANDE |
| `B09-NE` | B09 | Notifications à l'entrepreneur | 72 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B09-OD` | B09 | Obligation de discrétion et mesures de sécurité | 73 | CCAP | 3 | QUANTITE_FIXE,A_COMMANDE |
| `B09-PE` | B09 | Pénalités et retenues | 74 | CCAP | 2 | QUANTITE_FIXE,A_COMMANDE |
| `B09-PM` | B09 | Matériaux fournis par le maître de l’ouvrage | 75 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B09-PT` | B09 | Préparation des travaux | 76 | CCAP | 4 | QUANTITE_FIXE,A_COMMANDE |
| `B09-PV` | B09 | Contrôle des prix de revient | 77 | CCAP | 2 | QUANTITE_FIXE,A_COMMANDE |
| `B09-RP` | B09 | Réception provisoire | 78 | CCAP | 4 | QUANTITE_FIXE,A_COMMANDE |
| `B09-VQ` | B09 | Vérification qualitative des matériaux | 79 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B09-VT` | B09 | Vérification et admission des prestations | 80 | AE | 2 | CONTRAT_CADRE |
| `B09-VX` | B09 | Visa des documents d'exécution | 81 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B09-XM` | B09 | Modalités d’exécution administrative | 82 | AE | 3 | CONTRAT_CADRE |
| `B10-DR` | B10 | Dérogations aux documents généraux | 61 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B10-LT` | B10 | Litiges | 62 | DPAC | 1 | CONTRAT_CADRE |
| `B10-MC` | B10 | Modifications relatives au titulaire | 63 | AE | 2 | CONTRAT_CADRE |
| `B10-PC` | B10 | Procédure contentieuse | 64 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B10-RE` | B10 | Résiliation aux torts de l’entrepreneur | 65 | CCAP | 1 | QUANTITE_FIXE,A_COMMANDE |
| `B10-RT` | B10 | Résiliations | 66 | AE | 2 | CONTRAT_CADRE |
| `B11-AN` | B11 | Annexes de l'acte d'engagement | 61 | AE | 6 | QUANTITE_FIXE,A_COMMANDE |
| `B11-AT` | B11 | Annexes du contrat-cadre | 62 | AE | 2 | CONTRAT_CADRE |
| `B11-FR` | B11 | Formulaires à remplir | 63 | CCAP | 6 | QUANTITE_FIXE,A_COMMANDE |

96 rubriques · 257 champs

## Lignes écartées, fusionnées ou chargées inactives

| feuille et ligne | décision |
|---|---|
| travaux L21 « Maître d'ouvrage : nom et coordonnées » | **écartée** : reprise sans document maître, c'est l'autorité contractante du plan |
| travaux L34 « Tranches : si comprennent plusieurs tranches » | devient la **question de cadrage `tranches`**, livrée au lot 5 |
| travaux L38 « Groupement : si autorisé » | portée par le reflet de cadrage `groupement` déjà semé |
| travaux L44, L100 à L103 | **écartées** : reprises sans maître (adresse, nom, date et heure de remise déjà au plan) |
| travaux L48, L79, L112, L126 | **écartées** : en-têtes de rubrique, pas des informations |
| travaux L65, L66 (prix unitaire / forfaitaire) | fusionnées, portées par le reflet de cadrage `typePrix` |
| travaux L67, L68 (prix ferme / révisable) | fusionnées, portées par le reflet de cadrage `prixRevisable` |
| travaux L69, L70 (Ariary / devises) | fusionnées en une liste `B05-MN-01` |
| travaux L71 à L76 (garantie de soumission) | fusionnées en `B05-GQ-01/02/03`, la première portée par le cadrage |
| travaux L77 à L85 (garantie de bonne exécution) | fusionnées en `B05-GE-01` à `B05-GE-04` |
| travaux L107 à L109 (évaluation sur plusieurs lots) | fusionnées en une liste `B06-EV-01` |
| travaux L110, L111 (préférence nationale) | fusionnées en `B06-PN-01` + `B06-PN-02` |
| travaux L113 à L115 (date d'effet) | fusionnées en une liste `B09-DT-01` |
| travaux L127 à L129 (domiciliation) | fusionnées en une liste `B08-DB-01` |
| travaux L146 à L149, L152 à L157, L167 à L171, L174 à L177 | fusionnées, branche par branche, dans leur rubrique |
| travaux L191 « autres pièces contractuelles » | chargée **inactive** (`B11-AN-06`) : aucun document au classeur |
| travaux L192 à L197 | les six **`FAR`**, chargés en type **`PIECE`** (arbitrage du pilote du 24/09) |
| contrat-cadre L5, L6, L9 | marquées « ? » ; `B02-SW-03` chargé **inactif**, les deux autres écartées |
| contrat-cadre L31, L42, L61, L64, L68, L71 à L79, L84, L86, L88, L89, L92, L94, L97, L98, L100, L104, L106, L110, L111, L113, L115, L121, L129, L135, L138, L145, L148, L156, L159, L162, L167, L172, L176, L181, L188, L216, L221 | **écartées** : en-têtes de rubrique |
| contrat-cadre L45 à L60 | les deux groupements, solidaire et conjoint, fusionnés en une rubrique `B03-GM` de six champs, la forme étant portée par le cadrage |
| contrat-cadre L62, L63 (variantes) | portées par le reflet de cadrage `variantes` |
| contrat-cadre L123, L124 (mono ou multi-attributaire) | fusionnées, portées par le cadrage `attributaires` |
| contrat-cadre L180 « ?????? » | **écartée** : point non identifiable |
| contrat-cadre L189 « choisir et supprimer les mentions inutiles » | **écartée** : mention de gabarit |
| contrat-cadre L222, L223 (Annexe I et II) | chargées en `B11-AT-01/02`, sans contenu précisé au classeur |

**Trois codes de rubrique ont été choisis pour éviter une collision** avec le référentiel déjà chargé :
`B09-XM` au lieu de `B09-EM` (les modalités d'exécution des fournitures occupent `EM`), et les préfixes propres
aux travaux partout ailleurs. Un code de champ est unique dans tout le référentiel.

## Ce qui reste à trancher par le pilote

1. **Le titulaire du contrat-cadre de travaux** (lignes 10 à 15) est marqué `x` au classeur, donc repris, sans
   document maître. Il a été chargé avec l'acte d'engagement pour maître, comme au contrat-cadre de fournitures.
2. **Les six modèles de formulaires à remplir** restent à créer ; le champ les annonce dès maintenant.
3. **Les modèles Word** du DPAO, du DPAC, de l'acte d'engagement et du CCAP des travaux, pour le lot 2b.
