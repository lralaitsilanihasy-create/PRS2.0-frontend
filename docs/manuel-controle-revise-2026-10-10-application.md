# Manuel de contrôle a priori — révision pour l'application (2026-10-10)

**Proposition à valider par le pilote avant tout développement.** Le manuel (CNM, février 2026) est repris type de dossier par type de dossier ; à chaque pièce et à chaque contrôle sont appliquées les quatre règles de transformation : pièce remplacée par un écran quand ses données sont dans l'application ; contrôle réaffecté à l'écran et aux données ; contrôle classé automatique (A) ou laissé au contrôleur (B) ; règle de validation qui empêche l'erreur dès la saisie.

Sources : relevé littéral des chapitres 1 à 3 du manuel (le PDF fourni s'arrête au folio 79 : le chapitre 4 et les annexes manquent — **à confirmer : fournir la fin du manuel**) ; code des deux dépôts (lecture seule) et contrats d'API. Aucune pièce ni aucun contrôle n'est ajouté au manuel ; les numéros Pn, Dn, Cn, In, Tn sont ceux du relevé.

## 0. Cadre

### 0.1 Deux réserves qui valent pour tout le document

- **Les données n'existent que pour une procédure conduite dans l'application** (plan saisi ou importé, fiche DAO validée, remise électronique, évaluation et attribution en ligne). Pour une procédure papier, ou pour les sous-types sans fiche (`DPREQUAL`, `DP`, `RJ`, `MGG`), l'application ne détient que des fichiers : les pièces restent à joindre et les contrôles reviennent au contrôleur. **À confirmer (Q1)** : la révision ne vaut qu'en ligne.
- **Le contrôleur n'a pas encore accès à ces écrans.** Les écrans de l'AMI, de la séance, de l'évaluation et de l'attribution sont réservés à la CAO, au responsable de la procédure, à la PRMP et à l'UGPM ; seule la fiche DAO est déjà servie en lecture aux profils CNM. Chaque « remplacement par un écran » suppose d'ouvrir cet écran, **en lecture seule et figé à la soumission**, au Membre, au Chef de commission, au Président et au Vérificateur (aujourd'hui, rien n'est figé hors la version de la fiche DAO).

### 0.2 Conventions

- **Données déjà dans l'application ?** : **Oui** (saisies, calculées ou générées), **Partiel** (une partie seulement ; le manque est nommé), **Non** (document externe), **à confirmer**.
- **Remplacement** : le nom de l'écran existant (route entre parenthèses), ou « Pièce jointe » quand la pièce est conservée.
- **Contrôle** : **A** = exécuté par l'application seule, affiché « contrôle automatique : conforme / non conforme » (avec les valeurs) ; **B** = contrôleur. Une exigence partiellement automatisable est découpée « A : … ; B : … ». **A (construction)** = les deux éléments comparés sont produits de la même donnée : l'application affiche la valeur et « conforme » — l'incohérence n'est plus possible. **A (à outiller)** = la règle est écrite, mais une donnée manque encore (nommée) ; tant qu'elle manque, le contrôle reste B.
- **Règle de validation à la saisie** : où et comment l'erreur est empêchée (champ obligatoire, format, plage, cohérence entre champs, blocage du passage à l'étape suivante). **[existe]** = la règle est déjà codée. Les blocages existants sont nommés par leur code serveur.
- **Erreur évitée** : ce que le contrôle du manuel visait à détecter.

### 0.3 Les écrans de l'application cités

| Écran | Route | Ce qu'il porte |
|---|---|---|
| Écran Dossier de planification | `/circuit/dossier/:id` (Membre : `/membre/examiner/:id`) — onglets Fiche de présentation, Plan, AGPM, Pièces, Versions, Journal | lignes du plan (objet, nature, compte, mode, montant, financement, lots, tranches, bénéficiaires), dates prévisionnelles par étape, en-tête (exercice, référence, signataire, date), justifications (modes dérogatoires, délais aménagés), fiche de présentation dérivée, projet d'AGPM dérivé, versions archivées, diff de mise à jour, PV signés |
| Écran Pré-contrôle du PPM | panneau de l'écran Dossier de planification (`/prmp/verifier-ppm`) | signalements du moteur (fractionnement, mode sous le seuil, dates, lots, mention délai réduit) et pistes IA |
| Écran Fiche DAO | `/prmp/dao/:idDmc` (lecture CNM : `…/dao/:idDmc`) — étapes Ligne du PPM, Cadrage, Saisie par bloc, Reprises, Contrôles, Validation PRMP, Documents | 23 valeurs du plan, cadrage, blocs B01–B14 (clés `Bxx-YY-nn`, `#n` par lot), besoin et quantités (DQE), matériel, personnel, pièces de l'offre, sous-critères, bilan des contrôles, versions figées, documents générés (DPAO/DPAC/DPIC, AE, CCAP/CPS, formulaires, DAO complet) |
| Écran Avis spécifique / Lettres d'invitation | étape Documents de la fiche DAO | avis et lettres générés, informations de publication (date, n° et date du JMP, supports) ou d'envoi (date, lieu, candidats) |
| Écran Commission d'appel d'offres | `/prmp/dao/:idDmc/cao` | décision de désignation (référence, date, PDF), membres (identité, origine, fonction), président, comptes |
| Écran Retraits du DAO / Reçus / Dépôts | `/prmp/dao/:idDmc/retraits`, `…/recus`, `…/depots` | registre des retraits (horodaté), reçus des frais (déposés, validés), registre des dépôts (n°, entreprise, lot, horodatage, empreinte, état) |
| Écran Séance d'ouverture | `/procedure/:idDmc/seance` | ouverture (heure serveur), présents, autres personnes, part de secours, lecture des offres (montants, délai, validité, rabais, garantie, intégrité, pièces, alertes), PV généré, signatures électroniques |
| Écran Évaluation | `/procedure/:idDmc/evaluation` — étapes Conformité, Montants, Offres anormales, Qualification, Rapport ; PI : Évaluation technique, Séance financière, Évaluation financière, Négociation | déclarations d'impartialité, grille de conformité (9 vérifications par offre), corrections et montants évalués, indicateurs de prix, qualification, classement, demandes aux candidats et réponses, rapport généré et signé |
| Écran AMI / Présélection | `/prmp/dao/:idDmc/ami` et `/procedure/:idDmc/ami` | AMI (objet, date limite, critères, publications déclarées), expressions (horodatées, empreintes), notes par critère, liste arrêtée, rapport signé |
| Écran Attribution | section « Attribution » de l'écran Évaluation | lots, dossier de marché, projet de marché, attribution, lettres (produites, envoyées, lues), délai d'attente, recours, pièces de l'attributaire, signature, enregistrement, notification, avis d'attribution, infructuosité, reprises |
| Page du dossier de marché / Encart Actes de gestion / Page de l'acte | circuit, `page-dossier` | marché (montant initial, catégorie, dates de réception et de solde), cumul des avenants et plafond, actes, pièces exigées |
| Encart Déclaration sans suite | fiche DAO (étape Documents) et écran Évaluation | demande (motifs), dossier DSS, avis, déclaration |
| Page du dossier (circuit) / Écran Résultat examen | circuit | dates de dépôt, de réception (numéro), de dispatch, d'examen, de PV ; frise ; journal ; PV signés |
| Écran Calendrier des jalons | `/prmp/calendrier` | dates prévues et réelles par ligne |

## 1. Plan de passation — PPM / PPM-AGPM (ch. 2-I)

| Pièce ou contrôle du manuel | Données déjà dans l'application ? | Remplacement (écran / pièce jointe) | Contrôle : automatique ou contrôleur | Règle de validation à la saisie | Erreur évitée |
|---|---|---|---|---|---|
| **Pièce 1** — Fiche de présentation datée et signée par la PRMP | Oui (dérivée du plan : modes dérogatoires, délais aménagés, contrats-cadres, justifications) ; signature = soumission par la PRMP (**à confirmer Q2**) | Écran Dossier de planification, onglet Fiche de présentation | — | Justifications obligatoires à la soumission **[existe : FicheJustificationsService, 400]** | fiche absente ou incomplète |
| **Pièce 2** — Projet d'AGPM/PPM imprimé du SIGMP | Oui (plan saisi ou importé ; AGPM dérivé) ; « SIGMP » : **à confirmer Q3** | Écran Dossier de planification, onglets Plan et AGPM | — | plan sans ligne non soumissible **[existe : DDP ⇒ PPM]** | — |
| **Pièce 3** — Publication des AGPM/PPM antérieurs et PV (mise à jour) | Partiel : PV antérieurs et versions oui ; journaux non | PV et versions : Écran Dossier de planification (Versions, PV) ; journaux : **Pièce jointe** | — | — | — |
| **Pièce 4** — Décision du Gouvernement ou justificatif (délais aménagés, modes dérogatoires) | Non | **Pièce jointe** (obligatoire si une ligne est en délai aménagé ou mode dérogatoire) | — | Pièce exigée si `JUSTIF_DELAI_AMENAGE` ou `JUSTIF_MODE_DEROGATOIRE` renseigné (règle à ajouter aux pièces exigées) | justificatif manquant |
| **Pièce 5** — Tout document utile | Non | **Pièce jointe** (facultative) | — | — | — |
| P1 — Motifs de la mise à jour conformes au CMP | Oui (motif de la mise à jour, diff figé des lignes) | Écran Dossier de planification (Versions, diff) | **A** : motif renseigné ; **B** : conformité du motif au CMP | Mise à jour : `MOTIF_MAJ` obligatoire ; diff figé à la soumission **[existe]** | mise à jour sans motif |
| P2 — Forme de la fiche de présentation selon le modèle en annexe | Oui (format fixe de l'application) ; modèle de l'annexe **à confirmer Q15** | Écran Dossier de planification | **A (construction)** | — | forme non conforme |
| P3 — Points de la fiche cohérents avec le PPM | Oui (même source) | idem | **A (construction)** | — | incohérence fiche / plan |
| P4 — Forme du PPM (modèle de l'arrêté 7276/2016) | Oui (grille de saisie et import contrôlé) | Écran Dossier de planification, onglet Plan | **A (construction)** | import PDF : lignes rejetées si colonnes manquantes **[existe]** | plan hors format |
| P5 — Nature cohérente avec l'objet | Oui (nature, objet) ; piste IA | Écran Pré-contrôle | **A** : signalement `NATURE_INCOHERENTE` **[existe]** ; **B** : décision | signalement affiché à la PRMP avant soumission **[existe]** | nature erronée |
| P6 — Objet cohérent avec la nature et le compte PCOP/PCG | Oui (compte, nature, objet) | Écran Pré-contrôle | **A** : signalement IA ; **B** : décision | idem | objet / compte incohérents |
| P7 — Objet explicite (type et quantité, site, domaine, immatriculation, lots, tranches, mentions « relance », « délai réduit », « contrôle a priori ») | Partiel : lots et tranches structurés ; mentions = texte de l'objet ; quantités, site, immatriculation = texte | Écran Dossier de planification (ligne, lots, tranches) ; Pré-contrôle | **A** : chaque lot a une désignation ; « délai réduit » présent si délai aménagé **[existe : MENTION_DELAI_REDUIT]** ; « contrôle a priori » présent si ligne sous le seuil soumise ; **B** : type/quantité, site, domaine, immatriculation (piste IA `OBJET_IMPRECIS`) | `DESIGNATION_LOT` obligatoire pour chaque lot ; objet obligatoire ; blocage de la soumission si une ligne en délai aménagé n'a pas la mention | objet imprécis ; mention absente |
| P8 — Mode de passation conforme aux textes | Oui (mode, montant, catégorie de seuil, seuils de l'arrêté) | Écran Dossier de planification ; Pré-contrôle | **A** : montant ≥ seuil du mode **[existe : MODE_SOUS_LE_SEUIL]** ; mode dérogatoire ⇒ justification **[existe]** ; **B** : pertinence de la justification | mode dérogatoire ⇒ `JUSTIF_MODE_DEROGATOIRE` obligatoire **[existe, bloquant]** ; mode sous le seuil ⇒ blocage de la soumission (à passer de signalé à bloquant : **à confirmer Q13**) | mode interdit pour le montant ; dérogation non justifiée |
| P9 — Contrats-cadres : caractère répétitif et indéterminé, durée, urgence | Oui (forme, justification) | Écran Dossier de planification | **B** | forme contrat-cadre ⇒ justification obligatoire | contrat-cadre injustifié |
| P10 — Dates prévisionnelles cohérentes avec le mode et les délais | Oui (dates par étape, mode) ; table des délais minimaux **à confirmer Q6** | Écran Dossier de planification (prévisions) ; Calendrier des jalons | **A** : fin ≥ début, dans l'exercice **[existe : DATES_PREVISION_INCOHERENTES]** ; ouverture − lancement ≥ délai minimal du mode | saisie des prévisions : date de fin ≥ date de début (format), ouverture − lancement ≥ minimum du mode sinon refus ou justification de délai aménagé | calendrier impossible ; délai de remise trop court |
| P11 — Délais aménagés : décision du Gouvernement ou justification | Partiel : justification oui ; décision = pièce | Écran Dossier de planification ; Pièce 4 | **A** : justification présente **[existe]** ; **B** : pertinence, existence de la décision | `JUSTIF_DELAI_AMENAGE` obligatoire **[existe, bloquant]** ; pièce 4 exigée | délai aménagé non justifié |
| P12 — Fractionnement : prestations identiques d'un même compte | Oui (compte, financement, forme, montants) | Écran Pré-contrôle | **A** : groupes signalés **[existe : FRACTIONNEMENT_COMPTE]** ; **B** : fusion exigée ou non | signalement avant soumission **[existe]** ; écartement motivé ou fusion | fractionnement illicite |
| P13 — Règle des art. 27-28 (base d'appréciation) | — | — | (cadre de P12) | — | — |
| P14 — F&S : homogénéité par compte, distinguer fixe/commande/CC/financement | Oui | Écran Pré-contrôle | **A** : signalement ; **B** : décision | idem P12 | — |
| P15 — Travaux routiers : une opération par compte et par route nationale | Non (route nationale non saisie) | Écran Dossier de planification | **B** | — | — |
| P16 — Bâtiments : une opération par compte ; entretien / réhabilitation / construction | Non (nature des travaux non saisie) | idem | **B** | — | — |
| P17 — Hydro-agricole : par compte et périmètre irrigué | Non | idem | **B** | — | — |
| P18 — Autres travaux : une opération par compte | Oui (compte) | Écran Pré-contrôle | **A** : signalement ; **B** : décision | idem P12 | — |
| P19 — PI : homogénéité par compte et TDR identiques | Non (TDR hors application au stade du plan) | — | **B** | — | — |
| P20 — Délais aménagés encadrés par l'art. 3 du décret 2019-1310 | — | — | (cadre de P21-P26) | — | — |
| P21 — a. après AO infructueux : décision d'infructuosité | Partiel : décision d'infructuosité de la procédure précédente si en ligne ; **lien « relance de » absent** | Écran Attribution de la procédure précédente | **A (à outiller : lien de relance)** ; d'ici là **B** | ligne « relance » ⇒ référence de la procédure précédente obligatoire (champ à créer) | relance sans infructuosité constatée |
| P22 — b. urgence : pertinence des motifs | Non | Pièce 4 | **B** | — | — |
| P23 — c. AGPM publié ≥ 3 mois avant l'avis spécifique | Non au stade du plan (date de publication de l'AGPM saisie plus tard, à l'impression de l'avis) | Écran Avis spécifique (au DAO) | **A (à outiller : date de publication de l'AGPM en champ propre)** ; au plan : **B** | à l'impression de l'avis : `jmpDate` obligatoire ; datePublication − jmpDate ≥ 3 mois sinon refus du motif c. | publication AGPM trop récente |
| P24 — d. voie électronique exclusive : non applicable | — | — | non applicable (manuel) | — | — |
| P25 — e. situation imprévisible / décision du Gouvernement | Non | Pièce 4 | **B** | — | — |
| P26 — f. PI < 100 000 000 Ar HT | Oui (nature, montant) | Écran Dossier de planification | **A** : nature PI et montant < 100 000 000 | motif f. sélectionnable seulement si nature PI et montant < 100 000 000 (liste conditionnée) | motif f. invoqué à tort |
| P27 — Mise en garde (réduction des délais non générale) | — | — | B (information) | — | — |
| P28 — Délai réduit ⇒ mise à jour du PPM et mention « délai réduit » dans l'objet | Oui | Écran Pré-contrôle | **A** **[existe : MENTION_DELAI_REDUIT]** | blocage de la soumission sans la mention (à confirmer Q13) | candidats non informés |

## 2. Dossier d'appel d'offres ouvert, fournitures — DAOO (ch. 2-II-A) ; vaut pour DAOOI et la 2e étape de DAOOPREQUAL

| Pièce ou contrôle du manuel | Données déjà dans l'application ? | Remplacement (écran / pièce jointe) | Contrôle : automatique ou contrôleur | Règle de validation à la saisie | Erreur évitée |
|---|---|---|---|---|---|
| **Pièce 1** — Fiche de présentation signée par la PRMP | Oui (bloc B01 + 23 valeurs du plan + cadrage) ; signature = validation de la fiche par la PRMP (**à confirmer Q2**) | Écran Fiche DAO (Ligne du PPM, Cadrage) | — | validation par la PRMP seule, refusée si contrôles bloquants **[existe : CONTROLES_BLOQUANTS]** | — |
| **Pièce 2** — Calendrier annuel de passation mis à jour et signé | Partiel : dates prévues par ligne ; aucun calendrier annuel (**à confirmer Q-pièce**) | **Pièce jointe** ; appui : Écran Calendrier des jalons | — | — | — |
| **Pièce 3** — AGPM signé, soumis au contrôle, avec le PV de la CNM | Oui (plan, PV signé ; un DMC ne se crée pas sans PV favorable du plan) | Écran Dossier de planification (Plan, AGPM, PV) | — | création du DMC refusée sans PV FAV/FAVR du plan **[existe : PV_NON_SIGNE]** | DAO lancé sur un plan non contrôlé |
| **Pièce 4** — Publication de l'AGPM dans les journaux | Partiel : n° et date du JMP saisis à l'impression de l'avis ; le journal non | **Pièce jointe** (journal) ; appui : Écran Avis spécifique | — | `jmpDate` obligatoire à l'impression de l'avis | — |
| **Pièce 5** — Projet d'avis spécifique imprimé du SIGMP/EGP | Oui pour le contenu (généré de la fiche) — **aujourd'hui produit seulement après le PV** ; « SIGMP » **à confirmer Q3** | Écran Avis spécifique (à rendre en « projet » dès la validation de la fiche) | — | — | — |
| **Pièce 6** — Tout document utile | Non | **Pièce jointe** (facultative) | — | — | — |
| **Pièce 7** — Canevas de rapport d'évaluation | Sans objet en ligne (rapport produit par l'application sur un canevas fixe) — **à confirmer Q-pièce** | Écran Évaluation (étape Rapport) | — | — | — |
| **Pièce 8** — Bordereau des prix estimatifs signé par la PRMP | Partiel : désignations, unités, quantités ; **prix unitaires estimés absents** (**à confirmer Q11**) | **Pièce jointe** (prix) ; appui : Écran Fiche DAO (Saisie par bloc, besoin) | — | si Q11 : prix unitaire estimé obligatoire par article, total = montant du lot | — |
| **Pièce 9** — Projet de DAO | Oui (DPAO, AE, CCAP, formulaires, DAO complet générés et figés par version ; spécifications techniques = fichier dans le DAO) | Écran Fiche DAO (Documents) | — | documents produits à la validation **[existe]** | — |
| P1 — Fiche cohérente avec les autres documents | Oui (même source) | Écran Fiche DAO | **A (construction)** | — | incohérence fiche / DAO |
| P2 — Objet de la fiche cohérent avec l'AGPM et le DAO | Oui (objet du DAO `B02-OB-01`, objet du plan) | Écran Fiche DAO (Ligne du PPM) | **A** : égalité normalisée ⇒ conforme ; sinon écart affiché ; **B** : reformulation admise ? | objet du DAO prérempli de l'objet du plan ; modification signalée | objet différent du plan |
| P3 — Mode cohérent avec l'AGPM et la clause 1 des DPAO | Oui (`B01-AC-13` relu du plan ; DPAO générée) | Écran Fiche DAO | **A (construction)** | — | — |
| P4 — Retard de la date de disponibilité du DAO par rapport à l'AGPM | Oui (date de validation de la fiche, prévision de lancement) | Écran Fiche DAO / Dossier de planification | **A** : validation ≤ prévision, sinon retard en jours | — (constat) | retard non relevé |
| P5 — Allotissement cohérent avec DPAO 1.1 et 1.2 | Oui (lots du plan, cadrage, DPAO générée) | Écran Fiche DAO (Cadrage) | **A** : nombre de lots du cadrage = lots du plan ; clauses par construction | `nbLots` prérempli des lots du plan, non modifiable sans mise à jour du plan | DAO alloti autrement que le plan |
| P6 — Montant estimé cohérent avec l'AGPM et par lot | Oui (`B01-AC-14` relu ; montants des lots) | Écran Fiche DAO / Dossier de planification | **A** : Σ lots = montant **[existe : LOTS_SOMME_DIVERGENTE]** | plan : Σ `MONT_LOT` = `MONT_ESTIM` sinon refus de la ligne | montants divergents |
| P7 — Délai minimum de remise des offres | Oui (date limite `B04-LR-03/04`, date de publication prévue ou `B04-SE-17`) ; seuils **à confirmer Q6** | Écran Fiche DAO (bloc B04) / Avis spécifique | **A** : limite − publication ≥ 30 j (15 j si délai aménagé justifié) | validation de la fiche refusée si la date limite est à moins du minimum de la date de publication prévue (règle à ajouter à `ControlesFicheMarche`) | délai de remise insuffisant |
| P8 — Garantie : trois formes ; montant entre 1 et 2 % de l'estimé (par lot) | Oui (`B05-GS-01/02/03#n`, montant du lot) | Écran Fiche DAO (bloc B05) | **A** : 3 formes cochées ; 1 % ≤ montant/estimé ≤ 2 % | `B05-GS-02` : les 3 formes obligatoires si garantie exigée ; `B05-GS-03#n` : plage 1-2 % du montant du lot **[existe : GARANTIE_TAUX à 2 %, à élargir à l'intervalle]** — bloquant | garantie hors plage ; forme manquante |
| P9 — Garantie cohérente avec DPAO 6.8 | Oui (clause générée) | Écran Fiche DAO | **A (construction)** | — | — |
| P10 — AGPM : avis de la CNM avant publication ; copie du journal | Partiel : PV signé oui ; date de publication déclarée ; journal non | Écran Dossier de planification (PV) ; Pièce 4 | **A** : PV signé antérieur à la date de publication déclarée ; **B** : journal | création du DMC sans PV refusée **[existe]** ; `jmpDate` ≥ date de signature du PV sinon refus à l'impression | AGPM publié avant l'avis de la Commission |
| P11 — Avis conforme au modèle type ; objet, lots max, forme des prix, adresse, date/heure limite et ouverture, coût et 3 formes de paiement, agent comptable, 3 formes de garantie et montant | Oui (avis généré des clés de la fiche et du paramètre compte ARMP) ; « modèle type » **à confirmer Q3** | Écran Avis spécifique | **A (construction)** | compte ARMP (`compte-dao`) obligatoire pour imprimer | avis divergent du DAO |
| P12 — Avis imprimé à partir du SIGMP/EGP | Non (pas d'interopérabilité) — **à confirmer Q3** | Pièce jointe (imprimé SIGMP) si maintenu | **B** | — | — |
| P13 — DAO conforme clause par clause aux documents types et modèles | Oui pour les documents générés (modèles officiels ARMP) ; spécifications techniques = fichier | Écran Fiche DAO (Documents) | **A (construction)** pour DPAO, AE, CCAP, IC, formulaires ; **B** : spécifications techniques | — | DAO hors modèle |
| P14 — DAO cohérent avec le reste du dossier | Oui | idem | **A (construction)** | — | — |
| P15 — DPAO 1.1 : allotissement cohérent avec AGPM, fiche, avis | Oui | idem | **A (construction)** (cf. P5) | — | — |
| P16 — DPAO 1.2 marché à commandes : cohérence AE 2, 5.3, cadre de bordereau, CCAP 6, 10, 12.1, 14, 21 | Oui (forme « à commandes », `B05-TP-02/03#n`, quantités min/max, modèles conditionnés) | Écran Fiche DAO | **A** : min et max renseignés, min < max ; clauses par construction | `B05-TP-02/03` obligatoires si à commandes **[existe : OBLIGATOIRE]** ; `QUANTITE_MIN` < `QUANTITE_MAX` **[existe : QUANTITES_ORDRE]** | marché à commandes sans min/max |
| P17 — DPAO 2 groupements : cohérence AE 1, CCAP 4 | Oui (cadrage `groupement`) | idem | **A (construction)** | — | — |
| P18 — DPAO 6.3 : pertinence des qualifications particulières | Oui (`B03-CQ-01..10`, texte libre en fournitures) | Écran Fiche DAO (bloc B03) | **B** (ratios : P43-P45) | — | — |
| P19 — DPAO 6.5 validité des offres cohérente avec les modèles de garantie | Oui (`B04-VO-01`, `B05-GS-04`) | idem | **A** : validité de la garantie > validité de l'offre **[existe : VALIDITE_GARANTIE_SUP_OFFRE]** | bloquant à la validation **[existe]** | garantie expirant avant l'offre |
| P20 — DPAO 6.8 garantie cohérente avec fiche et avis | Oui | idem | **A (construction)** | — | — |
| P21 — DPAO 7.1 forme des plis sans / avec lots | Oui (modèle conditionné) | idem | **A (construction)** | — | — |
| P22 — DPAO 7.2 heures et lieu de remise cohérents avec l'avis | Oui (mêmes clés) | idem | **A (construction)** | — | — |
| P23 — DPAO 8 : heure d'ouverture cohérente avec l'heure limite | Oui (`B04-OP-02/03` vs `B04-LR-03/04` ; électronique : `B04-OP-12`) | idem | **A** : ouverture ≥ limite **[existe : DATES_ORDRE:OUVERTURE]** | bloquant **[existe]** ; fournitures : heures en texte → passer `B04-LR-04`, `B04-OP-03` en format heure (évolution) | ouverture avant la limite |
| P24 — DPAO 8 : lieu d'ouverture = lieu de remise, ou très proche | Oui (`B04-OP-01`, `B04-LR-02`) | idem | **A** : égalité ⇒ conforme ; **B** : « très proche » sinon | lieu d'ouverture prérempli du lieu de remise | lieux différents |
| P25 — DPAO 9.4.3 montant évalué : formulation sans / avec lots | Oui | idem | **A (construction)** | — | — |
| P26 — DPAO 9.4.5 : ≤ 20 % hautes, ≤ 10 % basses | Partiel : `B06-EO-07` en texte libre (**à confirmer Q12**) | Écran Fiche DAO (bloc B06) | **A (à outiller : deux champs %)** ; d'ici là **B** | `B06-EO-07a` ≤ 20, `B06-EO-07b` ≤ 10 (plage, bloquant) | seuils hors norme |
| P27 — DPAO 11 : modification des quantités ≤ 20 % | Oui (`B06-EO-10`, `B09-OM-02`) | idem | **A** | plage ≤ 20 (bloquant) | taux > 20 % |
| P28 — DPAO 12 délai : formulation fixe/commandes, sans/avec lots | Oui | idem | **A (construction)** | — | — |
| P29 — DPAO 12 cohérent avec AE 5.2 | Oui (même clé `B09-DX`) | idem | **A (construction)** | — | — |
| P30 — Formulaires de soumission présents et cohérents | Oui (A1-A4, C1/C2 générés) | Écran Fiche DAO (Documents) | **A (construction)** : présence dans la version | production à la validation **[existe]** | formulaire manquant |
| P31 — AE 1 contractants cohérent avec DPAO 2, CCAP 4 | Oui | idem | **A (construction)** | — | — |
| P32 — AE 2 prix : formulation fixe/commandes, unitaires/forfaitaires, national/international | Oui | idem | **A (construction)** | — | — |
| P33 — AE 5 durée-délais : formulation | Oui | idem | **A (construction)** | — | — |
| P34 — AE 5 cohérent avec DPAO 12 | Oui | idem | **A (construction)** | — | — |
| P35 — Annexe 1 : présentation selon la forme | Oui | idem | **A (construction)** | — | — |
| P36 — Annexe 1, à commandes : proportion min/max identique | Oui (quantités min/max par article) | Écran Fiche DAO (besoin) | **A** : ratio max/min constant par lot | refus de l'article dont le ratio diffère (ou avertissement) | proportions incohérentes |
| P37 — Annexe 1 cohérente avec le bordereau estimatif signé | Partiel (quantités oui, prix non — Q11) | Écran Fiche DAO + Pièce 8 | **A (construction)** pour le cadre ; **B** : prix (fichier) ; si Q11 : **A** | si Q11 : total estimé = montant du plan ± tolérance | cadre ≠ estimation |
| P38 — Annexe 3 : déclaration des bénéficiaires effectifs conforme au modèle | Oui (formulaire généré) | Écran Fiche DAO (Documents) | **A (construction)** | — | formulaire absent |
| P39 — CCAP 6, 10, 12.1, 14, 21 : présentation fixe / commandes | Oui | idem | **A (construction)** | — | — |
| P40 — Spécifications techniques neutres (ni marque ni technologie, sans critère superflu) | Non (fichier .docx) | Écran Fiche DAO (spécifications, fichier) | **B** | — | — |
| P41 — Attention à la formulation fixe / commandes | Oui | idem | **A (construction)** | — | — |
| P42 — Précautions sur les qualifications particulières | Oui (texte) | Écran Fiche DAO (B03) | **B** | — | — |
| P43 — Indicatif : CA exigé entre 1 et 1,5 × estimé | Fournitures : texte (**B**) ; travaux : `B03-QT-07` | Écran Fiche DAO (B03) | fournitures **B** ; travaux **A** **[existe : CA_MOYENNE]** | travaux : plage 1-1,5 × montant du lot (avertissement) | exigence disproportionnée |
| P44 — Indicatif : marché similaire ≈ estimé | fournitures texte ; travaux `B03-QT-19/20` | idem | fournitures **B** ; travaux **A** **[existe : REFERENCES_CUMUL]** | — | — |
| P45 — Indicatif : liquidité ≤ 30 % de l'offre (ou du minimum) | fournitures texte ; travaux `B03-QT-14/15` | idem | fournitures **B** ; travaux **A** **[existe : LIQUIDITE_DOUBLE]** | travaux : ≤ 30 % du montant du lot (avertissement) | — |
| M1 — Objet AGPM ≠ DAO | → P2 | | | | |
| M2 — Confusion commandes / fixes ; parties du DAO manquantes | → P13, P30 : **A (construction)** | | | | |
| M3 — Spécifications orientées ou incomplètes | → P40 : **B** | | | | |

## 3. Dossier d'appel d'offres ouvert, travaux — DAOO travaux (ch. 2-II-B)

Pièces et points **identiques** au tableau 2 (mêmes règles ; clés travaux : `B04-OV-02` date-heure limite, `B04-OV-01` lieu, `B05-GQ-01..04` garantie, `B09-DL-01#n` délai, `B05-PT-01` forme des prix ; pièce 8 = DQE estimatif signé, même statut Partiel — Q11). Points propres :

| Pièce ou contrôle du manuel | Données déjà dans l'application ? | Remplacement | Contrôle | Règle de validation à la saisie | Erreur évitée |
|---|---|---|---|---|---|
| P7 — Délai minimum 30 jours (CMP) ou 15 jours aménagés (décret 2019-1310 art. 3.a) | Oui | Écran Fiche DAO (B04) | **A** | validation refusée sous le minimum (cf. 2-P7) | délai insuffisant |
| P11 — Avis : + visites des lieux et réunions préparatoires obligatoires | Oui (champ de la fiche repris dans l'avis — **clé à confirmer**) | Écran Avis spécifique | **A (construction)** | — | — |
| P20 — DPAO 6.9.2 visite des lieux cohérente avec l'art. 9 de l'avis ; si obligatoire et organisée : ≥ 1 période ou 2 dates | **à confirmer** (champs « visite obligatoire » / dates) | Écran Fiche DAO | **A** si les champs existent | visite obligatoire ⇒ dates obligatoires (≥ 1 période ou 2 dates) | visite obligatoire sans dates |
| P27 — DPAO 11 délai d'exécution : formulation, cohérence AE 5.2 | Oui (`B09-DL-01#n`) | Écran Fiche DAO | **A (construction)** | — | — |
| P31 — Annexes de l'AE selon la forme des prix (BPU, DQE, coefficient K, sous-détails, état des sommes versées / DQE, état) | Oui (modèle AE-T conditionné par `B05-PT-01`) | Écran Fiche DAO (Documents) | **A (construction)** | — | — |
| P32 — Annexes cohérentes avec le DQE estimatif signé | Partiel (Q11) | Écran Fiche DAO + Pièce 8 | **A (construction)** cadre ; **B** prix | cf. 2-P37 | — |
| P34 — CCAP 6 documents contractuels : forme des prix, plans, neuf / réhabilitation | Oui (modèle conditionné) ; existence des plans : fichier | Écran Fiche DAO | **A (construction)** ; **B** : plans | — | — |
| P35 — CCAP 8 : garantie décennale (partie C) pour les constructions neuves | Oui | Écran Fiche DAO (B09/B10) | **A** **[existe : ASSURANCE_DECENNALE]** | bloquant **[existe]** | construction neuve sans décennale |
| P36 — CCAP 12.1, 16 règlement des comptes : unitaires / forfaitaire | Oui | Écran Fiche DAO | **A (construction)** | — | — |
| P37 — ST chap. II et III cohérents avec le cadre du DQE | Non (fichier) | fichier des spécifications | **B** | — | — |
| P38 — ST chap. IV : mode d'évaluation / devis descriptif selon la forme | Non (fichier) | idem | **B** | — | — |
| P44 — Indicatif : personnel d'encadrement seulement | Oui (`t_fiche_personnel`, fonctions) | Écran Fiche DAO (moyens) | **B** (liste affichée) | — | — |
| P45 — Indicatif : matériels essentiels seulement | Oui (`t_fiche_materiel`) | idem | **B** | — | — |
| M2 — Confusion unitaires / forfaitaire ; parties manquantes | → P13, P31 : **A (construction)** | | | | |
| M3 — Spécifications incomplètes ou incohérentes | → P37-P38 : **B** | | | | |

## 4. Pré-qualification — DPREQUAL (1re étape) et DAOOPREQUAL (2e étape) (ch. 2-II-C)

`DPREQUAL` ne peut pas porter de fiche : **aucune donnée** (**à confirmer Q16** : outiller ou laisser en fichiers).

| Pièce ou contrôle du manuel | Données ? | Remplacement | Contrôle | Règle de validation | Erreur évitée |
|---|---|---|---|---|---|
| Pièces 1-2-3-4 (fiche, calendrier, AGPM + publication, PPM contrôlé) | fiche : Non (pas de fiche) ; AGPM/PPM : Oui | Écran Dossier de planification pour AGPM/PPM ; le reste : **Pièce jointe** | — | création refusée sans PV du plan **[existe]** | — |
| Pièce 5 — Projet d'avis spécifique SIGMP | Non (pas de fiche → pas d'avis généré) | **Pièce jointe** | — | — | — |
| Pièce 7 — Projet de dossier de pré-qualification | Non | **Pièce jointe** | — | — | — |
| P1 — Pertinence des critères de pré-qualification (« liste à compléter » [ambigu]) | Non | Pièce jointe | **B** | — | — |
| P2-P6 — Ratios indicatifs (CA 1-1,5 ×, similaire ≈ estimé, liquidité ≤ 30 %, personnel d'encadrement, matériels essentiels) | Non | Pièce jointe | **B** | — | — |
| P7 — 2e étape : contrôle d'un AOO classique | → tableaux 2-3 | | | | |

## 5. Appel d'offres restreint — DAOR / DAORI (ch. 2-II-D)

Points communs : tableaux 2-3. Pièces et points propres :

| Pièce ou contrôle du manuel | Données ? | Remplacement | Contrôle | Règle de validation | Erreur évitée |
|---|---|---|---|---|---|
| Pièce 5 — Projet de lettre d'invitation imprimé du SIGMP | Non pour l'AOR (la lettre n'est générée que pour la PI) — **à confirmer** : générer la lettre AOR ; SIGMP : Q3 | **Pièce jointe** tant que la lettre AOR n'est pas générée | — | — | — |
| Pièce 6 — PV de validation de la liste restreinte par la CAO | Non | **Pièce jointe** | — | — | — |
| Pièce 8 — Bordereau / DQE estimatif signé | Partiel (Q11) | Pièce jointe + Écran Fiche DAO | — | — | — |
| P1 — Pertinence des motifs du recours à l'AO restreint (art. 38) | Partiel : mode « restreint » et justification du plan | Écran Dossier de planification | **A** : justification présente **[existe]** ; **B** : pertinence | mode restreint ⇒ justification obligatoire **[existe]** | AOR injustifié |
| P2 — Constitution de la liste restreinte : critères neutres fondés sur les capacités | Non | Pièce 6 | **B** | — | — |
| P3 — Délai de remise selon les art. 2-3 du décret (« < 20 j selon le cas ») | Oui (date limite) ; seuil **à confirmer Q6** | Écran Fiche DAO | **A** | validation refusée sous le minimum AOR | délai insuffisant |
| P4-P7 — Modalité de constitution de la liste selon le motif (capacités ; moralité ; participants précédents ; organisme professionnel) | Non | Pièce 6 | **B** | — | — |

## 6. Contrats-cadres (ch. 2-II-E)

Points communs : tableaux 2-3 (clés CC : `B02-OE-01`, `B04-CP-02/03`, `B05-PM-01`, `B07-*`, `B08-FI-*`). Pièces : sans canevas ni bordereau. Points propres :

| Pièce ou contrôle du manuel | Données ? | Remplacement | Contrôle | Règle de validation | Erreur évitée |
|---|---|---|---|---|---|
| P1 — Usage non abusif, principes de la commande publique | — | — | **B** | — | — |
| P2 — Justifications du recours au contrat-cadre ; alternative du marché à commandes | Oui (forme, justification du plan, `B07-*`) | Écran Dossier de planification / Fiche DAO | **B** | forme contrat-cadre ⇒ justification obligatoire | — |
| P3 — Délais de remise plus conséquents (conseil) | Oui (délai affiché) | Écran Fiche DAO | **B** | — | — |
| P4 — Attention aux critères d'élimination et d'attribution (DPAC) | Oui (clauses) | Écran Fiche DAO | **B** | — | — |
| P5 — Cohérence pièces de candidature (6.1 T / 4.1 F&S), critères d'élimination, critères d'attribution (8.2-8.4 T ; F&S [ambigu]) | Oui (pièces exigées B14, critères générés de la fiche) | Écran Fiche DAO (pièces, DPAC) | **A (construction)** pour la cohérence ; **B** : pertinence | — | — |
| P6 — Pièces administratives ≠ critères d'élimination ni d'attribution ; ST ≠ critères d'attribution | Oui (catégorie des pièces B14, critères) | Écran Fiche DAO | **A** : aucune pièce administrative citée en critère ; **B** : confirmation | critère d'attribution ne peut référencer une pièce de catégorie administrative (liste filtrée) | critère illégal |
| P7 — Travaux : supprimer les prix d'installation et de repli de chantier | Oui (articles du DQE) | Écran Fiche DAO (DQE) | **A** : aucun libellé « installation » / « repli » | refus de l'article en contrat-cadre travaux (ou avertissement) | prix interdit |
| P8 — Pourcentages du 9.1 RC et de l'art. 19 AE/CCAP travaux [ambigu] | **à confirmer Q17** | Écran Fiche DAO | **B** | — | — |
| P9-P11 — Critères objectifs, réalistes, en rapport avec l'objet (tableaux indicatifs) | Oui (critères affichés) | Écran Fiche DAO | **B** | — | — |

## 7. Dossier de consultation, prestations intellectuelles — DC (ch. 2-II-F)

| Pièce ou contrôle du manuel | Données déjà dans l'application ? | Remplacement (écran / pièce jointe) | Contrôle : automatique ou contrôleur | Règle de validation à la saisie | Erreur évitée |
|---|---|---|---|---|---|
| **Pièces 1-4** — Fiche, calendrier, AGPM + PV, journal AGPM | comme tableau 2 | Écran Fiche DAO ; Pièce jointe (calendrier, journal) ; Écran Dossier de planification | — | — | — |
| **Pièce 5** — Journal de publication de l'AMI | Partiel : publications déclarées [{support, date, référence}] ; journal non | **Pièce jointe** ; appui : Écran AMI | — | au moins une publication datée pour publier l'AMI **[existe]** | — |
| **Pièce 6** — Documents d'évaluation de l'AMI : PV d'ouverture, rapport, PV de validation | PV d'ouverture : **Non** (lecture automatique à la date limite, dépôts horodatés — **à confirmer Q8**) ; rapport : Oui (généré, signé) ; PV de validation : Oui si la signature collégiale du rapport vaut validation (**à confirmer Q4**) | Écran AMI / Présélection | — | rapport joint d'office au dossier DC ; dossier refusé sans liste définitive **[existe : LISTE_NON_ARRETEE]** | — |
| **Pièce 7** — Projet de lettre d'invitation SIGMP | Oui pour le contenu (générée) — produite après le PV ; SIGMP Q3 | Écran Lettres d'invitation (à rendre en projet dès la liste définitive) | — | — | — |
| **Pièce 8** — Projet de décision autorisant la liste restreinte | Non (**à confirmer Q9** : générer le projet depuis la liste) | **Pièce jointe** | — | — | — |
| **Pièce 9** — Canevas de rapport d'évaluation | sans objet en ligne (Q-pièce) | Écran Évaluation | — | — | — |
| **Pièce 10** — Tableau des coûts estimatifs signé | Partiel : budget `B05-PF-13`, montants `B05-PF-02/04/05` ; pas de détail (Q11) | **Pièce jointe** ; appui : Écran Fiche DAO (B05) | — | — | — |
| **Pièce 12** — Projet de dossier de consultation | Oui (DPIC, AE, CPS, DAO complet) ; TDR = fichier | Écran Fiche DAO (Documents) | — | production à la validation **[existe]** | — |
| P1 — Fiche cohérente avec les autres documents | Oui | Écran Fiche DAO | **A (construction)** | — | — |
| P2 — Objet cohérent avec l'AGPM et le DC | Oui | Écran Fiche DAO (Ligne du PPM) | **A** : égalité ⇒ conforme ; **B** : écart | objet prérempli du plan | objet différent |
| P3 — Mode cohérent avec l'AGPM et DPIC 1 | Oui | Écran Fiche DAO | **A (construction)** | — | — |
| P4 — Retard de la date de disponibilité du DC | Oui | Écran Fiche DAO / Dossier de planification | **A** | — | retard non relevé |
| P5 — Allotissement cohérent avec DPIC 1 | Oui | Écran Fiche DAO (Cadrage) | **A** | cf. 2-P5 | — |
| P6 — Montant estimé cohérent avec l'AGPM, par lot | Oui | idem | **A** **[existe : LOTS_SOMME_DIVERGENTE]** | cf. 2-P6 | — |
| P7 — Délai minimum de remise des propositions | Oui (`B04-LH-02`, date d'envoi des lettres) ; seuil PI **à confirmer Q6** | Écran Fiche DAO / Lettres d'invitation | **A** : limite − envoi ≥ seuil | validation refusée sous le minimum ; `dateEnvoi` obligatoire à l'impression | délai insuffisant |
| P8 — AGPM : avis CNM avant publication ; journal | Partiel | Écran Dossier de planification ; Pièce 4 | **A** (PV) ; **B** (journal) | cf. 2-P10 | — |
| P9 — Délai de remise des manifestations d'intérêt ; date et heure d'ouverture cohérentes avec l'AMI | Oui (publié le, date limite, publications) ; seuil AMI **à confirmer Q6** | Écran AMI | **A** : date limite − publication ≥ seuil ; ouverture = date limite (construction) | publication de l'AMI refusée si date limite − date de publication < seuil (règle à ajouter à `AmiService.publier`) | délai AMI insuffisant (⇒ renvoi obligatoire, P41) |
| P10 — PV d'ouverture de l'AMI : quorum et qualité des signataires | Non (pas de séance ni de PV) — **à confirmer Q8** | Écran AMI (registre des expressions horodatées) si Q8 ; sinon **Pièce jointe** | **A (construction)** si Q8 ; sinon **B** | — | — |
| P11 — Rapport cohérent avec les critères de sélection définis | Oui (notes par critère, poids = 100, score et rang calculés) | Écran Présélection | **A (construction)** | poids des critères : Σ = 100 **[existe]** ; note par critère obligatoire, bornée au poids | résultats hors critères |
| P12 — PV de validation cohérent avec les résultats | Oui si Q4 (rapport signé = validation) | Écran Présélection | **A (construction)** si Q4 | — | — |
| P13 — PV de validation : quorum et qualité des signataires | Oui (signataires = membres hors conflit, signatures horodatées, empêchements) ; quorum **à confirmer Q5** | Écran Présélection / CAO | **A** : signataires ⊆ membres, président signataire, tous signés ou empêchés, quorum Q5 | liste définitive seulement quand tous ont signé ou sont empêchés **[existe]** ; président obligatoire (règle à ajouter si Q5) | PV non valide |
| P14 — Liste du projet de décision = liste des documents d'évaluation | Non (décision absente) — Q9 | Pièce 8 ; si Q9 : Écran Présélection (projet généré) | **B** ; si Q9 : **A (construction)** | — | liste divergente |
| P15 — Pertinence des considérants | Non | Pièce 8 | **B** | — | — |
| P16 — Lettre conforme au modèle ; objet, heures limite et d'ouverture, candidats, mode de sélection, adresse, coût et paiement, agent comptable | Oui (générée des clés du DC et de la liste) — Q3 | Écran Lettres d'invitation | **A (construction)** | candidats = liste définitive de l'AMI **[existe]** | lettre divergente du DC |
| P17 — Lettre imprimée du SIGMP/EGP | Non — Q3 | Pièce jointe si maintenu | **B** | — | — |
| P18 — DC conforme clause par clause aux documents types (arrêté 12 579/2007) | Oui (DPIC, AE, CPS générés) ; TDR fichier | Écran Fiche DAO (Documents) | **A (construction)** ; **B** : TDR | — | — |
| P19 — DPIC 1 cohérent avec le reste | Oui | idem | **A (construction)** | — | — |
| P20 — DPIC 1 : allotissement cohérent | Oui | idem | **A** (cf. P5) | — | — |
| P21 — DPIC 1 : mode de sélection cohérent avec l'objet | Oui (`B02-MS-01`) | Écran Fiche DAO (B02) | **B** | — | — |
| P22 — DPIC 2 groupements vs AE 1, CCAP 4 | Oui | idem | **A (construction)** | — | — |
| P23 — DPIC 7.2.2 : forme des prix pertinente (unitaires : contrôle, formation ; forfait : audit, études) | Oui (`B05-PF-01`) | Écran Fiche DAO (B05) | **B** | — | — |
| P24 — DPIC 7.2.2 : frais remboursables et frais divers pertinents | Oui (clauses) | idem | **B** | — | — |
| P25 — DPIC 6.3 : qualifications particulières pertinentes | Oui (texte) | Écran Fiche DAO (B03) | **B** | — | — |
| P26 — DPIC 8.1 forme des plis sans / avec lots | Oui | idem | **A (construction)** | — | — |
| P27 — DPIC 8.2 : dates, heures, lieu de remise cohérents avec la lettre | Oui (mêmes clés) | idem | **A (construction)** | — | — |
| P28 — DPIC 9.2 : heure d'ouverture cohérente avec l'heure limite | Oui | idem | **A** **[existe : DATES_ORDRE]** | bloquant **[existe]** | — |
| P29 — DPIC 9.2 : lieu d'ouverture = lieu de remise ou proche | Oui | idem | **A** égalité ; **B** sinon | lieu prérempli | — |
| P30 — DPIC 9.3 : pondération des critères et sous-critères cohérente | Oui (`B06-TP-02..07`, sous-critères, `B06-CS-02/03`) | Écran Fiche DAO (sous-critères) | **A** **[existe : SOUS_CRITERES_POINTS]** : Σ sous-critères = critère, Σ critères = 100, T+F = 100 | bloquant **[existe]** | pondération incohérente |
| P31 — DPIC 9.3 : qualifications du personnel clé cohérentes avec les TDR, neutres | Partiel (sous-critères oui ; TDR fichier) | Écran Fiche DAO | **B** | — | — |
| P32 — AE 1 contractants vs DPIC 2, CCAP 3 | Oui | idem | **A (construction)** | — | — |
| P33 — AE 2 prix : formulation | Oui | idem | **A (construction)** | — | — |
| P34 — Délais d'exécution cohérents entre DPIC, AE, CCAP et TDR | Oui pour les trois documents générés (`B09-DP-*`) ; TDR fichier | idem | **A (construction)** ; **B** : TDR | — | délais divergents |
| P35 — Annexes de l'AE selon 7.2.2 et la forme de rémunération | Oui | idem | **A (construction)** | — | — |
| P36 — CCAP 10 règlement cohérent avec les livrables des TDR | Partiel (clause oui ; TDR fichier) | idem | **B** | — | — |
| P37 — TDR cohérents avec le reste (profil, livrables, délai) | Non (fichier) | fichier TDR | **B** | — | — |
| P38-P40 — Mode de sélection et rémunération ; référentiels des 5 modes et 4 types | Oui (clauses affichées, référentiels en aide) | Écran Fiche DAO | **B** | — | — |
| P41 — Non-respect du délai de l'AMI ⇒ renvoi obligatoire | Oui | Écran AMI | **A** (= P9) | publication refusée sous le seuil (cf. P9) | — |
| P42 — Critères de l'AMI neutres et objectifs (expérience générale et spécifique) | Oui (critères affichés) | Écran AMI | **B** | — | — |
| M1-M2 (résultats de l'AMI) | → P9/P41 (A), P42 (B) | | | | |
| M3 — Objet AGPM ≠ DC ; M4 — incohérence des documents de l'AMI ; M5 — mode / rémunération vs TDR ; M6 — TDR incomplets | → P2 (A/B) ; P11-P13 (A) ; P21, P23 (B) ; P37 (B) | | | | |

## 8. Gré à gré — rapport justificatif (RJ) et projet de marché (MGG) (ch. 2-II-G)

**Aucune donnée structurée** pour RJ et MGG (ni entité, ni écran). Seule la ligne du plan l'est. **À confirmer Q16.**

| Pièce ou contrôle du manuel | Données ? | Remplacement | Contrôle | Règle de validation | Erreur évitée |
|---|---|---|---|---|---|
| RJ pièce 2 / MGG pièce 3 — PPM contrôlé portant la prestation | Oui (ligne du plan, PV) | Écran Dossier de planification | — | dossier RJ/MGG rattaché à une ligne du plan (`t_dossier_mec`) obligatoire | — |
| RJ pièces 1, 3, 4 — Rapport justificatif signé ; projet de décision ; documents utiles | Non | **Pièce jointe** | — | pièces obligatoires **[existe]** | — |
| MGG pièces 1, 2, 4, 5, 6 — Fiche ; décision signée ; PV de validation du titulaire et du montant ; documents utiles ; projet de marché | Non (fiche : pas de données pour MGG) | **Pièce jointe** | — | pièces obligatoires **[existe]** | — |
| G0-P1 — Achat inscrit au PPM contrôlé | Oui | Écran Dossier de planification | **A** : ligne existante, mode gré à gré, PV FAV/FAVR | création du dossier refusée sans ligne contrôlée (règle à ajouter, comme pour le DMC) | achat hors plan |
| G0-P2 — Envoi en une seule étape (PPM, RJ, projet de marché si seuil atteint) | — | — | **B** | — | — |
| G0-P3 — Avis distinct par document | — | — | (procédure) | — | — |
| RJ-P1 — Pertinence des motifs (art. 39-II) | Non | Pièce jointe | **B** | — | — |
| RJ-P2 à P4, P6 — Secret ; urgence impérieuse ; exclusivité ; qualification unique | Non | Pièce jointe | **B** | — | — |
| RJ-P5 — Marché complémentaire : 4 conditions, dont cumul ≤ ⅓ du marché principal (avenants non compris) | Partiel : montant du marché initial si en ligne ; **montant du gré à gré et lien absents** | Écran Attribution (marché initial) | **A (à outiller : montant et lien au marché initial)** ; d'ici là **B** | montant du RJ obligatoire ; cumul ≤ ⅓ bloquant | dépassement du tiers |
| MGG-P1 à P3 — Titulaire justifié ; montant justifié (similaire, sous-détails, 3 candidats) ; validation CAO sur PV | Non | Pièce jointe | **B** | — | — |
| MGG-P4 à P9 — Contenu du PV et pièces justificatives | Non | Pièce jointe | **B** | — | — |
| MGG-P10 — Signataires du PV : quorum et qualité | Non (fichier) ; CAO désignée : Écran CAO en appui | Pièce jointe | **B** | — | — |
| MGG-P11 — Prix exorbitants ⇒ négociation en PV, renvoi | — | — | **B** | — | — |
| RJ M1-M3 ; MGG C1-C2 | → **B** ; documents manquants : pièces obligatoires **[existe]** | | | | |

## 9. Marché sur appel d'offres ouvert — MAOO / MAOOI / MAOOPREQUAL (ch. 2-III-A à C)

| Pièce ou contrôle du manuel | Données déjà dans l'application ? | Remplacement (écran / pièce jointe) | Contrôle : automatique ou contrôleur | Règle de validation à la saisie | Erreur évitée |
|---|---|---|---|---|---|
| **Pièce 1** — Fiche de présentation signée par la PRMP | Oui (attribution du lot : offre proposée, montant, délai, titulaire, dates) — Q2 | Écran Attribution | — | dossier de marché créé par le serveur avec ces données **[existe]** | — |
| **Pièce 2** — Journal de 1re publication de l'avis (ou lettres avec accusé, pré-qualification) | Partiel : date de publication et supports déclarés ; journal non | **Pièce jointe** (journal) ; appui : Écran Avis spécifique | — | `datePublication` obligatoire à l'impression **[existe]** | — |
| **Pièce 3** — Décision portant liste des pré-qualifiés (MAOOPREQUAL) | Non | **Pièce jointe** | — | — | — |
| **Pièce 4** — AGPM publié | Partiel | **Pièce jointe** (journal) | — | — | — |
| **Pièce 5** — PV de la Commission sur le DAO | Oui (PV signé du dossier DMC) | Écran Résultat examen / Page du dossier DMC | — | dossier de marché créé seulement si le DAO a son PV favorable (chaîne existante) | — |
| **Pièce 6** — PV d'ouverture des plis par la CAO | Oui (séance, lecture, PV généré, signatures électroniques) ; candidats présents en texte libre ; quorum CAO non vérifié (Q5) | **Écran Séance d'ouverture** | — | PV produit seulement séance déchiffrée ; signé par chaque présent ou empêchement constaté **[existe]** | — |
| **Pièce 7** — Rapport d'évaluation des offres | Oui (étapes, décisions, rapport généré, signé par tous) | **Écran Évaluation** | — | rapport produit seulement toutes les étapes arrêtées ; signatures de tous les signataires **[existe]** | — |
| **Pièce 8** — PV de validation par la CAO | Oui si la signature collégiale du rapport vaut validation (**à confirmer Q4**) ; sinon Non | Écran Évaluation (Rapport, signatures) ; sinon **Pièce jointe** | — | — | — |
| **Pièce 9** — Tout document utile | Non | **Pièce jointe** (facultative) | — | — | — |
| **Pièce 10** — Bordereau / DQE estimatif signé | Partiel (Q11) | **Pièce jointe** ; appui : Écran Fiche DAO | — | — | — |
| **Pièce 11** — Projet de marché | Oui (généré, art. 60) | Écran Attribution (projet de marché) | — | projet produit à la création du dossier, refait sur geste **[existe]** | — |
| A-P1-P3 — Objet du contrôle (procédure, attribution conforme au DAO, évaluation régulière) | — | — | (cadre) | — | — |
| A-P4 — Condition préalable : date de 1re publication clairement définie | Oui (`datePublication`) | Écran Avis spécifique | **A** : non vide | obligatoire à l'impression **[existe]** ; soumission du dossier de marché refusée sans date de publication | dossier sans point de départ du délai |
| A-P5 — Condition préalable : documents d'évaluation signés et paraphés | Oui (PV signé, rapport signé) — signature électronique simple **à confirmer Q14** | Écran Séance / Évaluation | **A** : `PV_SIGNE_LE` et `SIGNE_LE` non nuls | dossier de marché créé seulement rapport signé ; PV joint seulement signé **[existe : EVALUATION_NON_CLOSE]** | documents non signés |
| A-P6 — Contrôle sur les documents reçus | — | — | (principe : données figées à la soumission) | — | — |
| A-P7 — Demande des offres originales | Oui (offres déchiffrées consultables) | Écran Séance d'ouverture (offres) | **B** | — | — |
| A-P8-P9 — Vérification d'authenticité ; faux | Non | — | **B** | — | — |
| A-P10-P14 — Formes de publicité obligatoires (affichage, JMP, journal national / international, audiovisuel) | Partiel (supports déclarés) | Pièce 2 ; Écran Avis spécifique | **B** | — | — |
| A-P15 — Publication sur le site de l'ARMP ; délai décompté de là | Non (pas d'interopérabilité) — **à confirmer Q7** | — | **B** | — | — |
| A-P16 — Charge de la preuve | — | — | (principe) | — | — |
| C-P1 — Date de 1re publication → délai de remise des offres | Oui (`datePublication`, `B04-LR-03/04`) ; seuils Q6 | Écran Avis spécifique / Fiche DAO | **A** : limite − publication ≥ 30 j (15 j aménagé) | impression de l'avis refusée si limite − datePublication < minimum (règle à ajouter à `AvisSpecifiqueService`) ; dépôts refusés hors délai **[existe : DELAI_DEPASSE]** | délai insuffisant (D1) |
| C-P2 — Date et heure d'ouverture cohérentes avec l'avis | Oui (`OUVERTE_LE` serveur ; `B04-OP-*` ou limite + délai) | Écran Séance d'ouverture | **A** : écart calculé ; **B** : décision (I1 : « suivant sa conviction ») | ouverture impossible avant la date limite **[existe]** ; écart affiché à l'ouverture | ouverture anticipée ou tardive (D2) |
| C-P3 — PV d'ouverture : quorum et qualité des signataires (président ou représentant, membres désignés, candidats présents) | Oui (signatures, membres, président) ; quorum **Q5** ; candidats présents : texte | Écran Séance / CAO | **A** : signataires ⊆ membres, président signataire, chaque présent signé ou empêché, quorum Q5 ; **B** : candidats présents | PV clos seulement quand tous les présents ont signé ou sont empêchés **[existe]** ; président obligatoire et quorum (règles à ajouter) | PV non valide (D3) |
| C-P4 — Documents essentiels : date et signature de l'AE, validité, délai, montant, garantie (forme, validité), attestation fabricant / catalogues, visite des lieux | Oui (grille de 9 vérifications par offre, lecture de séance, exigences de la fiche) | Écran Évaluation (Conformité) + Séance | **A** : grille complète ; validité ≥ `B04-VO-01` ; délai ≤ `B09-DX` ; garantie ≥ `B05-GS-03#n`, forme ∈ `B05-GS-02`, validité ≥ `B05-GS-04` ; AE signé = dépôt scellé authentifié (construction) ; pièces exigées présentes ; **B** : validité / authenticité des attestations | arrêt de l'étape Conformité refusé tant qu'une vérification manque **[existe]** ; décision « conforme » refusée si validité < exigée, délai > exigé, garantie < exigée (règles à ajouter : la grille propose déjà le constat) | AE non signé (D4), validité insuffisante (D6), délai > demandé (D7), documents absents (D8) |
| C-P5 — Spécifications techniques proposées conformes au DAO | Oui (décision `CONFORMITE_TECHNIQUE`, tableau de conformité de l'offre) | Écran Évaluation (Conformité) | **B** | décision et motif obligatoires **[existe]** | ST divergentes (D9) |
| C-P6 — Correction des erreurs selon les IC | Oui (corrections calculées vs retenues, motif, refus du candidat) | Écran Évaluation (Montants) | **A** : montant retenu = calculé, ou écart motivé | motif obligatoire si le montant retenu diffère de la correction proposée **[existe]** | correction irrégulière (I6) |
| C-P7 — Processus et pourcentages des DPAO (offres anormales) [ambigu] | Partiel : indicateurs de prix oui ; seuils en texte (Q12) | Écran Évaluation (Offres anormales) | **A (à outiller : seuils %)** : statut cohérent avec l'écart ; d'ici là **B** | si Q12 : statut « non suspectée » refusé au-delà du seuil sans motif | offre anormale non traitée |
| C-P8 — Mention de l'effectivité du contrôle de la moralité des prix dans le rapport (circulaire XII-2) | Oui (étape anormales arrêtée ⇒ section du rapport) ; **mention textuelle à confirmer dans le gabarit** | Écran Évaluation (Rapport) | **A (construction)** | rapport produit seulement étape arrêtée **[existe]** | mention absente |
| C-P9 — Ajustements : corrections, rabais, préférence, critères additionnels, variantes | Oui (montant évalué calculé : prix corrigé, rabais, préférence ≤ 15 %, critères) ; variantes : jugement | Écran Évaluation (Montants) | **A (construction)** ; **B** : variantes | — | ajustement oublié |
| C-P10 — Activités habilitées (NIF, STAT) cohérentes avec l'objet | Partiel : NIF vérifié (`VERIF_STATUT`) ; **activités non saisies** | Écran Évaluation (Qualification) | **A** : NIF vérifié ; **A (à outiller : activités)** ; d'ici là **B** | entreprise : NIF obligatoire, unique, vérifié **[existe]** ; activités obligatoires (champ à créer) | titulaire hors activité |
| C-P11 — Critères de qualification du DAO pris en compte (dont particulières) | Oui (décisions juridique / financière / technique ; travaux : CA, liquidité, références de l'offre en formulaires) | Écran Évaluation (Qualification) | **A** : décisions présentes pour l'offre proposée ; travaux : valeurs de l'offre ≥ exigences de la fiche ; **B** : appréciation des pièces | arrêt de la qualification refusé sans décision sur chaque offre retenue **[existe]** ; décision « qualifié » refusée si CA/liquidité/références < exigés (règle à ajouter) | non qualifié retenu (D11) |
| C-P12 — Classement cohérent avec le processus | Oui (rang calculé, départage motivé) | Écran Évaluation (classement) | **A (construction)** | départage : motif obligatoire **[existe]** | classement incohérent |
| C-P13 — PV de validation cohérent avec le rapport | Q4 | Écran Évaluation | **A (construction)** si Q4 ; **B** sinon | — | — |
| C-P14 — PV de validation : quorum et qualité des signataires | Oui (signataires du rapport) ; quorum Q5 | Écran Évaluation (signatures) / CAO | **A** | clôture seulement tous signés ou empêchés **[existe]** | — |
| C-P15 — Absence d'ambiguïté (délai, validité, cautions, délai de livraison, documents essentiels) | Oui (valeurs lues et structurées) | Écran Séance / Évaluation | **A (construction)** | — | — |
| C-P16 — Offre conforme pour l'essentiel (réserve, divergence, omission substantielle) | Oui (décisions, motifs) | Écran Évaluation | **B** | — | — |
| C-P17 — Offre inacceptable (trop chère, crédits, conditions illégales) | Partiel (montant évalué vs estimé) | Écran Évaluation | **A** : écart à l'estimation affiché ; **B** : décision | — | offre inacceptable (D10) |
| C-P18 — Fiches de renseignement non prises en compte sauf qualifications particulières | — | — | **B** | — | — |
| C-P19 — Éclaircissements sans modification de l'offre | Oui (demandes et réponses) | Écran Évaluation (demandes) | **B** | — | — |
| C-P20 — Défaut de réponse dans le délai = réponse négative | Oui (échéance, date de réponse) | Écran Évaluation (demandes) | **A** : réponse après échéance ou absente ⇒ traitée comme négative | réponse du candidat refusée après l'échéance **[existe ?]** — **à confirmer** | réponse tardive prise en compte |
| D1-D11 — Motifs d'avis défavorable | D1 → C-P1 (A) ; D2 → C-P2 (A+B) ; D3 → C-P3 (A) ; D4 → AE signé (A construction) ; D5 offre partielle (prix non complétés, bordereau modifié) → **A** : toutes les lignes du bordereau de l'offre ont un prix, structure = fiche (format verrouillé) — règle : dépôt scellé refusé si une ligne du bordereau est vide (à ajouter aux formulaires en ligne) ; D6 → C-P4 ; D7 → C-P4 ; D8 → C-P4 ; D9 → C-P5 (B) ; D10 → C-P17 ; D11 → C-P11 | | | | |
| C1-C3 — Compléments | C1 reprendre l'évaluation, C2 joindre / authentifier : **B** ; C3 prorogation de validité : **A** : validité de l'offre proposée expirée (limite + validité) sans prorogation ⇒ signalé ; règle : attribution refusée si l'offre a expiré sans prorogation jointe (à ajouter) | | | | |
| I1-I9 — Incohérences habituelles | I1 → C-P2 ; I2 (informations essentielles au PV) → **A (construction)** ; I3 (validité, garantie non précisées) → **A (construction)** ; I4-I8 → C-P5, P4, P6, P11 ; I9 → Q4 | | | | |

## 10. Marché sur appel d'offres restreint — MAOR / MAORI (ch. 2-III-D)

Pièces et points du tableau 9, plus :

| Pièce ou contrôle du manuel | Données ? | Remplacement | Contrôle | Règle de validation | Erreur évitée |
|---|---|---|---|---|---|
| Pièce 2 — Décision autorisant l'AO restreint, signée | Non | **Pièce jointe** | — | — | — |
| Pièce 3 — Lettres d'invitation à tous les candidats, avec accusé de réception | Partiel : lettres (PI seulement aujourd'hui), date d'envoi saisie ; **aucun accusé** (**à confirmer Q10**) | **Pièce jointe** (accusés) ; si Q10 : Écran Lettres d'invitation | — | — | — |
| P1 — Délai décompté depuis la dernière réception des lettres | Non (accusé) — Q10 | Écran Lettres d'invitation si Q10 | **A (à outiller : réception tracée)** ; d'ici là **B** | — | — |
| P2 — Respect du délai de remise des offres | idem | idem | **A (à outiller)** : limite − dernière réception ≥ seuil AOR (Q6) | dépôts ouverts seulement après la dernière réception + seuil (règle à ajouter) | délai insuffisant |
| P3 — Réception effective par tous les candidats de la liste restreinte | idem | idem | **A (à outiller)** : chaque invité a une réception | ouverture de la séance refusée si un invité n'a pas reçu (à confirmer) | candidat non invité |

## 11. Marché de prestations intellectuelles — MPI (ch. 2-III-E)

| Pièce ou contrôle du manuel | Données déjà dans l'application ? | Remplacement (écran / pièce jointe) | Contrôle : automatique ou contrôleur | Règle de validation à la saisie | Erreur évitée |
|---|---|---|---|---|---|
| **Pièce 1** — Fiche de présentation | Oui (attribution) — Q2 | Écran Attribution | — | — | — |
| **Pièce 2** — Lettres d'invitation avec accusé | Partiel (accusé absent — Q10) | Pièce jointe (accusés) ; Écran Lettres d'invitation | — | — | — |
| **Pièce 3** — Décision autorisant la liste restreinte | Non — Q9 | **Pièce jointe** | — | — | — |
| **Pièce 4** — AGPM publié | Partiel | **Pièce jointe** (journal) | — | — | — |
| **Pièce 5** — PV de la Commission sur le DC | Oui | Écran Résultat examen / Page du dossier DC | — | — | — |
| **Pièce 6** — PV d'ouverture des propositions techniques | Oui (1re séance : enveloppes techniques, sans montant, PV signé) | **Écran Séance d'ouverture** | — | **[existe]** | — |
| **Pièce 7** — Rapport d'évaluation des propositions techniques | Oui pour les données (notes par membre et par sous-critère, motifs, moyennes, écarts, arrêt) ; pas de document séparé (section 4 du rapport final, grilles en annexe) | **Écran Évaluation (Évaluation technique)** | — | arrêt technique refusé tant qu'un membre n'a pas noté chaque élément **[existe]** | — |
| **Pièce 8** — PV de validation du rapport technique par la CAO | Partiel : arrêt par le président + signatures du rapport final — **Q4** | Écran Évaluation (technique) ; sinon **Pièce jointe** | — | — | — |
| **Pièce 9** — Lettres de résultats techniques (non retenus) et d'information de l'ouverture financière, avec accusé | Non (aucune lettre aux éliminés ; notification de la séance aux retenus seulement) | **Pièce jointe** ; évolution à confirmer : lettres générées et consultation tracée | — | — | — |
| **Pièce 10** — PV d'ouverture des propositions financières | Partiel : PV généré (présents, montants, notes), **non signé** | **Pièce jointe** (PV signé) tant que la signature électronique de la séance financière n'existe pas ; sinon **Écran Évaluation (Séance financière)** | — | — | — |
| **Pièce 11** — Rapport d'évaluation finale | Oui (rapport unique signé : technique, financière, classement, négociation) | **Écran Évaluation (Rapport)** | — | **[existe]** | — |
| **Pièce 12** — PV de validation finale par la CAO | Q4 | Écran Évaluation (signatures) ; sinon Pièce jointe | — | — | — |
| **Pièce 13** — Tableau des coûts signé | Partiel (Q11) | **Pièce jointe** | — | — | — |
| **Pièce 15** — Projet de marché | Oui (généré) ; **reprend le prix d'avant négociation** (montant négocié non structuré) | Écran Attribution | — | montant négocié obligatoire à la conclusion d'une négociation réussie (champ à créer) | projet de marché au mauvais prix |
| P1 — Dates de réception des lettres → délai de remise des propositions | Non (accusé) — Q10, Q6 | Écran Lettres d'invitation | **A (à outiller)** ; d'ici là **B** | cf. 10-P2 | délai insuffisant (D1) |
| P2 — Date et heure d'ouverture technique cohérentes avec la lettre | Oui (`OUVERTE_LE`, `B04-LH-02`) | Écran Séance d'ouverture | **A** écart ; **B** décision | ouverture impossible avant la limite **[existe]** | D2 |
| P3 — PV d'ouverture technique : quorum et signataires | Oui ; quorum Q5 | Écran Séance / CAO | **A** | cf. 9-C-P3 | D3 |
| P4 — Documents essentiels de la proposition technique présents | Oui (vérification `PIECES` de l'enveloppe technique) | Écran Évaluation (Conformité) | **A** : pièces exigées présentes ; **B** : validité | arrêt refusé sans vérification **[existe]** | document manquant |
| P5 — Notation selon critères, sous-critères, pondérations ; détails individuels dans le rapport | Oui (construction) | Écran Évaluation (technique) | **A (construction)** : grille de chaque membre complète, moyennes, grilles en annexe | note bornée aux points de l'élément ; motif obligatoire ; arrêt refusé si une grille manque **[existe]** | notation hors grille |
| P6 — PV de validation technique cohérent avec le rapport | Q4 | Écran Évaluation (technique, arrêt du président) | **A (construction)** si Q4 | — | — |
| P7 — PV de validation technique : quorum et signataires | Oui (signatures du rapport) ; Q5 | idem | **A** | — | — |
| P8 — PV d'ouverture financière : quorum et signataires | Non (pas de signatures) | Pièce 10 ; évolution : signatures de la séance financière | **A (à outiller : signatures)** ; d'ici là **B** | clôture de la séance financière seulement signée par les présents (à créer) | PV non valide |
| P9 — Correction des erreurs selon les IC | Oui (corrections détaillées, prix corrigé, refus motivé) | Écran Évaluation (financière) | **A** : chaque correction détaillée | correction sans détail refusée **[existe]** | correction irrégulière |
| P10 — Pourcentages fixés dans les DPAO [sic, ambigu] | **à confirmer Q17** | — | **B** | — | — |
| P11 — Mention de la moralité des prix dans le rapport | Oui (construction ; gabarit à vérifier) | Écran Évaluation (Rapport) | **A (construction)** | — | — |
| P12 — Ajustements : corrections et rabais (remboursables exclus) | Oui (Sf, S calculés, remboursables exclus) | Écran Évaluation (financière) | **A (construction)** | — | — |
| P13 — PV de validation finale cohérent avec les rapports | Q4 (document unique) | Écran Évaluation (Rapport) | **A (construction)** si Q4 | — | — |
| P14 — PV de validation finale : quorum et signataires | Oui ; Q5 | idem | **A** | — | — |
| P15 — Absence d'ambiguïté sur les documents essentiels | Oui | Écran Évaluation | **A (construction)** | — | — |
| P16 — Proposition valable pour une période plus courte ⇒ rejetée | Oui (validité lue, `B04-DP-01`) | Écran Évaluation (Conformité) | **A** : validité ≥ exigée pour toute proposition conforme | décision « conforme » refusée si validité < `B04-DP-01` (règle à ajouter) | proposition non conforme retenue |
| P17 — Offre inacceptable (dont proposition > estimation ; D4 : > 20 % inacceptable, ≤ 20 % avec justificatif DAF/ORDSEC) | Oui (prix corrigé, budget `B05-PF-13`, `HORS_BUDGET`) ; justificatif = fichier | Écran Évaluation (financière) / Attribution | **A** : écart à l'estimation ; > 20 % ⇒ non conforme ; **B** : justificatif si ≤ 20 % | attribution refusée si > 20 % ; pièce « disponibilité de fonds » exigée si 0-20 % (règles à ajouter) | D4 |
| P18 — Qualité technique seule : négociation avec le mieux classé | Oui (négociation ouverte avec le rang 1) | Écran Évaluation (Négociation) | **A (construction)** | négociation ouverte seulement avec le 1er classé **[existe]** | — |
| P19 — Éclaircissements écrits sans changement substantiel | Oui (demandes, réponses) | Écran Évaluation | **B** | — | — |
| P20 — Négociations : date, lieu, personnel clé, autorisation écrite, aspects | Partiel (date, lieu, PV généré ; **montant négocié absent**) | Écran Évaluation (Négociation) | **B** | montant négocié obligatoire (à créer) | — |
| D1-D6 — Motifs | D1 → P1 ; D2 → P2 ; D3 → P3 ; D4 → P17 ; D5 non qualifiés → P4-P5 ; D6 une seule proposition conforme → **A** : nombre de propositions qualifiées après l'arrêt technique = 1 ⇒ signalé (le manuel en fait un motif possible) | | | | |
| C1-C3 ; I1-I7 | C1-C2 : **B** ; C3 prorogation : **A** (cf. 9) ; I1 → P2 ; I2, I6 → **A (construction)** (PV générés) ; I3-I4 → P4-P5 ; I5, I7 → Q4 (document unique) | | | | |

## 12. Avenant — AVN (ch. 2-IV)

| Pièce ou contrôle du manuel | Données déjà dans l'application ? | Remplacement (écran / pièce jointe) | Contrôle : automatique ou contrôleur | Règle de validation à la saisie | Erreur évitée |
|---|---|---|---|---|---|
| **Pièce 1** — Fiche de présentation | Partiel : montant HT, rang, faits du marché (montant initial, catégorie, réceptions, solde) ; **objet, motif, nouveau délai absents** | Page de l'acte / Encart Actes de gestion ; complément : Pièce 8 | — | montant initial et catégorie obligatoires **[existe]** ; objet, motif, nouveau délai obligatoires (champs à créer) | fiche incomplète |
| **Pièce 2** — Marché initial signé et approuvé, avenants antérieurs | Oui pour un marché en ligne (scan du marché signé déjà détenu, dates de signature, enregistrement, notification ; avenants antérieurs) ; Non pour MGG ou marché saisi | **Écran Attribution** (marché signé, pièces) et Encart Actes de gestion | — | acte refusé si le marché n'est pas signé dans l'application (règle à ajouter : le serveur n'exige aujourd'hui que le PV favorable) | avenant sur marché non signé (D2) |
| **Pièce 3** — PV de la Commission sur le marché | Oui (PV signé du dossier DDM) | Écran Résultat examen / Page du dossier de marché | — | acte refusé sans PV FAV/FAVR **[existe : MARCHE_NON_CONTROLE]** | — |
| **Pièce 4** — Accord de l'autorité contractante et du titulaire | Non | **Pièce jointe** | — | obligatoire **[existe]** | — |
| **Pièce 5** — Élément déclencheur | Non | **Pièce jointe** | — | obligatoire **[existe]** | absence (C5) |
| **Pièce 6** — PV de validation des nouveaux prix par la CAO et justificatifs | Non | **Pièce jointe** (obligatoire si nouveaux prix) | — | « introduit de nouveaux prix » OUI/NON (champ à créer) ⇒ pièce exigée | — |
| **Pièce 7** — Documents utiles (ordres de service, bulletins météo…) | Non | **Pièce jointe** (facultative) | — | — | — |
| **Pièce 8** — Projet d'avenant | Non (objet, nouveaux prix, nouveau délai non saisis) — **à confirmer** : générer le projet d'avenant comme le projet de marché | **Pièce jointe** | — | — | — |
| P1 — Fiche cohérente avec les autres documents | Partiel | Page de l'acte | **A (construction)** pour montant, rang, marché ; **B** : motif, délai (fichiers) | — | — |
| P2 — Objet de la fiche = objet du marché initial | Oui (lien au dossier de marché) | Page de l'acte / Attribution | **A (construction)** | acte créé depuis le marché, sans saisie libre **[existe : ACTE_DEPUIS_LE_MARCHE]** | avenant sur un autre marché |
| P3 — Historique du marché cohérent avec les pièces | Oui (attribution, signature, notification, avenants, PV) | Écran Attribution / Encart Actes | **A (construction)** | — | — |
| P4 — Motif de l'avenant cohérent avec l'accord des parties | Non | Pièces 4-5 | **B** | — | — |
| P5 — Consistance de l'avenant cohérente avec l'accord | Non | Pièces 4, 8 | **B** | — | — |
| P6 — Élément déclencheur pertinent, extérieur aux parties, d'une autorité autre que la PRMP [ambigu] | Non | Pièce 5 | **B** | — | — |
| P7 — Passation conforme aux textes, notamment en cas d'augmentation | Oui (montant HT, cumul, montant initial) | Encart Actes de gestion | **A** : cumul des avenants ≤ ⅓ du montant initial **[existe : AVENANT_PLAFOND]** | bloquant au dépôt, à la modification et à la soumission **[existe]** | dépassement du tiers |
| P8 — Modifications explicitées (délais, montants) | Partiel (montant oui ; délai non) | Page de l'acte | **A** : montant renseigné ; **B** : délai (Pièce 8) ; **A (à outiller : nouveau délai)** | montant HT obligatoire **[existe]** ; nouveau délai obligatoire si l'avenant porte sur le délai (à créer) | modification imprécise |
| P9 — Appréciation des nouveaux prix par la CAO (sous-détails ou marchés similaires) | Non | Pièce 6 | **B** | — | — |
| P10 — Pièces justificatives pertinentes et cohérentes | Non | Pièces 6-7 | **B** | — | — |
| P11 — PV des nouveaux prix : quorum et qualité des signataires | Non (fichier) ; Écran CAO en appui | Pièce 6 | **B** | — | — |
| P12 — Définition de l'avenant (élément déterminant, non réglable par le contrat) | — | — | **B** | — | — |
| P13 — Aucun avenant après la réception définitive et le règlement du solde | Oui (dates de réception, de solde) | Encart Actes de gestion | **A** **[existe : AVENANT_APRES_RECEPTION, AVENANT_APRES_SOLDE]** | bloquant **[existe]** | avenant tardif (D3-D5) |
| P14-P16 — Avenant obligatoire : masse, délai, nature des prix | — | — | **B** | — | — |
| P17 — Les conditions de l'avance ne peuvent être modifiées par avenant | Non (champ absent) — Q6 du manuel ouverte | Page de l'acte | **A (à outiller : « porte sur l'avance » OUI/NON)** ; d'ici là **B** | avenant « sur l'avance » refusé (à créer) | motif non autorisé (D1) |
| P18 — Avenants des marchés sous le seuil de contrôle non examinés | Oui (montant initial, seuils) | Encart Actes de gestion | **A** : montant initial ≥ seuil de contrôle a priori | création de l'acte refusée sous le seuil (à ajouter) | dossier irrecevable |
| P19-P27 — Cas des CCAG (fournitures 6.2, travaux 3.2, PI 6.2) : cas d'avenant, cas sans avenant, interdiction au-delà d'un tiers | Oui pour le tiers (P7) ; le reste : jugement | Encart Actes | **A** (tiers) ; **B** (cas) | cf. P7 | — |
| P28 — Risque d'avenant de convenance ; pièces à exiger | Non | Pièces 7 | **B** | — | — |
| P29 — Motivation de l'avis | — | — | (procédure) | — | — |
| D1-D5 ; C1-C5 — Motifs et compléments | D1 → P6, P17 ; D2 → Pièce 2 (**A** : marché signé dans l'application) ; D3-D5 → P13 (**A**) ; C1-C2, C3, C5 : **B** / pièces obligatoires **[existe]** ; C4 (avenant présenté après le délai d'exécution) → **A** : date de dépôt de l'acte > notification + délai (+ avenants de délai) ⇒ signalé | | | | |

## 13. Déclaration sans suite — DSS (ch. 2-V)

| Pièce ou contrôle du manuel | Données ? | Remplacement | Contrôle | Règle de validation | Erreur évitée |
|---|---|---|---|---|---|
| **Pièce 1** — Fiche de présentation | Oui (demande : motifs, dates ; procédure et ses étapes) | Encart Déclaration sans suite | — | motifs obligatoires **[existe : MOTIFS_OBLIGATOIRES]** | — |
| **Pièce 2** — AGPM + publication ou PPM contrôlé | Oui (plan, PV) ; journal non | Écran Dossier de planification ; Pièce jointe (journal) | — | — | — |
| **Pièce 3** — Projet de décision | Non (la décision est saisie après l'avis : référence, date) — Q9 | **Pièce jointe** | — | — | — |
| **Pièce 4** — Justificatifs | Non | **Pièce jointe** | — | obligatoire **[existe]** | — |
| *(jointe d'office)* Motifs de la déclaration | Oui (PDF/DOCX générés) | Encart Déclaration sans suite | — | **[existe]** | — |
| P1 — Fiche cohérente | Oui | Encart DSS | **A (construction)** | — | — |
| P2 — Historique de la mise en concurrence cohérent | Oui (avis, dépôts, séance, évaluation, attribution) | Encart DSS / écrans de la procédure | **A (construction)** | — | — |
| P3 — Motif de la décision cohérent avec les pièces | Partiel (motifs saisis ; pièces) | Encart DSS + Pièce 4 | **B** | — | — |
| P4 — Pertinence des motifs d'intérêt général | Oui (motifs) | Encart DSS | **B** | — | — |
| P5 — Faculté de la PRMP (art. 55) | — | — | (cadre) | — | — |
| P6 — Organe de contrôle saisi avant ; avis sous 5 jours ; refus ⇒ reprise | Oui (demandé le, réception, avis constaté le ; déclaration impossible après un avis défavorable) | Encart DSS / Page du dossier | **A** : avis rendu ≤ 5 jours de la réception ; refus ⇒ pas de déclaration **[existe]** | déclaration refusée sans avis favorable **[existe : AVIS_NON_FAVORABLE]** ; délai DSS de 5 jours avec alerte **[existe]** | déclaration sans avis ; avis tardif |
| P7 — Jamais après la signature du marché | Oui | Encart DSS | **A** **[existe : MARCHE_SIGNE]** | bloquant **[existe]** | DSS après signature |
| P8 — Décision notifiée individuellement à tous les candidats, motifs précisés | Oui (notification à chaque déposant, motifs, page publique) | Encart DSS | **A (construction)** | notification automatique à la déclaration **[existe]** | candidat non informé |
| P9-P10 — Droits de l'attributaire ; relance libre | — | — | (cadre) | — | — |
| P11 — Notion d'intérêt général | — | — | **B** | — | — |
| P12 — Analyse sur documents signés | Non | Pièce 4 | **B** | — | — |
| D1 ; C1 | motifs non documentés / fallacieux : **B** ; documents manquants : pièces obligatoires **[existe]** | | | | |

## 14. Actes de gestion contractuelle — INDEMN, SURSIS, PENAL, DR (ch. 3)

Règle commune **G1** (seuls les marchés contrôlés a priori) : **A** **[existe : MARCHE_NON_CONTROLE, bloquant]**. Pièces communes : fiche (Partiel : l'acte ne porte que le lien au marché — **montants, jours, motifs, dates non saisis**), AGPM/PPM contrôlé (Oui, Écran Dossier de planification), PV de la Commission sur le marché (Oui, Écran Résultat examen), marché initial (Oui en ligne, Écran Attribution), projet de décision (Non, **Pièce jointe** — Q9), justificatifs (Non, **Pièce jointe**). Points communs : P1 fiche cohérente → **A (construction)** partiel ; P2 historique du marché → **A (construction)** (Écran Attribution) ; P3 motif de la décision → **B** ; justifications → **B** ; encadré « documents signés » → **B** ; D1, C1 → **B** + pièces obligatoires **[existe]**.

| Acte | Contrôle du manuel | Données ? | Remplacement | Contrôle | Règle de validation à la saisie | Erreur évitée |
|---|---|---|---|---|---|---|
| INDEMN | P4 — Montant des indemnités cohérent, accepté par les deux parties | Non (montant non saisi) | Page de l'acte (champ à créer) + Pièce justificatifs | **A (à outiller : montant)** : montant renseigné ; **B** : acceptation | montant de l'indemnité obligatoire (à créer) | montant absent |
| INDEMN | P6 — Marché à commandes : indemnité si le minimum n'est pas commandé (art. 30-II) | Partiel (minimum `B05-TP-02` ; commandes non suivies) | Écran Fiche DAO | **B** | — | — |
| INDEMN | P7, P9 — Résiliation aux torts de l'AC : indemnité sur le reste à exécuter (CCAG), versée sous 3 mois | Non | Pièces | **B** | — | — |
| INDEMN | P8 — Ajournement : indemnité des frais (art. 77) | Non | Pièces | **B** | — | — |
| INDEMN | P10 — Diminution de la masse : indemnité ≤ 4 % de la diminution | Non (montants non saisis) | Page de l'acte (champs à créer) | **A (à outiller : diminution, indemnité)** : indemnité ≤ 4 % × diminution ; d'ici là **B** | indemnité > 4 % refusée (à créer) | dépassement des 4 % |
| SURSIS | P4 — Nombre de jours cohérent | Non | Page de l'acte (champ à créer) | **A (à outiller : jours, dates)** ; **B** | nombre de jours obligatoire (à créer) | — |
| SURSIS | P6-P8 — Conditions, effet, distinction avec l'ajournement | — | — | **B** | — | — |
| SURSIS | P9 — Demande par lettre contre récépissé dans les 10 jours de l'apparition des causes, durée demandée | Non | Page de l'acte (dates à créer) + Pièce | **A (à outiller)** : demande − causes ≤ 10 j ; **B** : forme de la lettre | date des causes et date de la demande obligatoires ; refus si écart > 10 j (à créer) | demande tardive |
| SURSIS | P10 — Notification écrite de la décision | Non | Pièce | **B** | — | — |
| SURSIS | P11 — Forclusion après le délai contractuel | Partiel (notification + délai du marché en ligne ; causes non saisies) | Page de l'acte / Attribution | **A (à outiller)** : date des causes ≤ fin du délai contractuel | refus si causes postérieures au délai (à créer) | sursis forclos |
| PENAL | P4 — Nombre de jours et montant des pénalités cohérents | Non | Page de l'acte (champs à créer) | **A (à outiller)** : montant = jours × taux (`B09-PR-02` / `B09-PE-02`) × assiette, plafond (`B09-PR-03` / `B09-PE-03`) ; **B** : assiette | jours et montant obligatoires ; montant calculé proposé (à créer) | calcul erroné |
| PENAL | P6-P8 — Nature, calcul (CCAG), demande de remise | — | — | **B** | — | — |
| DR | P5-P7 — Cas de résiliation (PRMP : faute grave, carence après mise en demeure, liquidation, intérêt général ; titulaire : défaut de paiement > 6 mois, ajournement > 3 mois [ambigu : 90 j] ; force majeure) | Non (cas et dates non saisis) | Page de l'acte (champs à créer) | **A (à outiller)** : cas choisi dans une liste ; défaut de paiement : > 6 mois depuis la demande ; ajournement : > 90 j ; **B** : faute grave, intérêt général, force majeure | cas obligatoire (liste) ; dates obligatoires selon le cas (à créer) | cas non prévu |
| DR | P8 — Pas de résiliation aux torts du titulaire sans mise en demeure motivée | Non | Page de l'acte (date à créer) + Pièce | **A (à outiller)** : date de mise en demeure antérieure à la décision ; **B** : motivation | résiliation aux torts refusée sans date de mise en demeure (à créer) | résiliation sans mise en demeure |
| DR | P9 — Indemnité de résiliation aux torts de l'AC (CCAG), 3 mois | Non | Pièces | **B** | — | — |
| DR | P10 — Garantie de bonne exécution non présentée ⇒ résiliation sans mise en demeure | Non (garantie BE non suivie) | Pièces | **B** | — | — |
| DR | P11 — Ajournement > 90 jours ⇒ droit à résiliation | Non | Page de l'acte | **A (à outiller)** (cf. P5-P7) | — | — |
| DR | P12 — Manquement au Code d'éthique (exclusion, résiliation) | Partiel (exclusions ARMP en données) | Écran Entreprise / exclusions | **B** | — | — |
| DR | P13-P14 — Renvoi aux CCAG ; documents signés, information du prestataire et mise en demeure préalable | Non | Pièces | **B** (+ P8) | — | — |

## 15. Règles transversales du chapitre 1 (p. 4-11)

| Règle | Données ? | Écran | Contrôle | Règle de validation à la saisie | Erreur évitée |
|---|---|---|---|---|---|
| T3 — Avis sous forme de PV signé par la Commission, envoi PDF possible | Oui | Écran Résultat examen | **A (construction)** | — | — |
| T4 — La Commission statue sur les documents reçus | — | — | principe : écrans figés à la soumission | — | — |
| T7 — Irrégularité grave : rapport annexé, Président informé | Non (Q6 du manuel, ouverte) | — | **B** | — | — |
| T16-T17 — Réception, numéro unique (chrono / nature / commission / année), fiches de circuit et de dispatching | Oui | Page du dossier (circuit) | **A (construction)** **[existe]** | — | — |
| T18 — Codes de nature des dossiers | Oui (sous-types V94) | Page du dossier | **A (construction)** | — | — |
| T19 — Dispatching ; fiches générées par le PRS | Oui | Page du dossier | **A (construction)** **[existe]** | — | — |
| T20-T24 — Examen, projet de PV ou lettre de renvoi, séance d'instruction, accord | Oui | Écran Examen / Résultat examen | **A (construction)** **[existe]** | avis FAV refusé avec observations, FAVR sans observations **[existe : validerCoherenceAvis]** | avis incohérent |
| T26 — Double signature du PV (agent puis chef) | Oui | Écran Résultat examen | **A (construction)** **[existe]** | — | — |
| T27 — Lettre de renvoi signée du seul Président / Chef de commission | Oui | idem | **A (construction)** **[existe]** | — | — |
| T28 — PV notifié à la date de visa ; délivré après validation du dossier corrigé | Oui | idem | **A (construction)** **[existe]** | — | — |
| T31 — Compléments ⇒ reprise à l'étape 1 | Oui | Page du dossier | **A (construction)** **[existe]** | — | — |
| T32 — Dossier recevable numéroté le jour même ou le lendemain | Oui (date de dépôt, date de réception) | Page du dossier (frise) | **A** : réception − dépôt ≤ 1 jour ouvré | — (délai de la Commission, tableau de bord) | retard de numérotation |
| T33 — Examen : 48 h ; différencié par type ; maximum 5 jours ouvrés | Oui (délais par sous-type — **valeurs vides**, alerte à 40 h) | Page du dossier ; Écran Délais (admin) | **A** : durée d'examen ≤ délai du sous-type ; alerte **[existe : EXAMEN_EN_DEPASSEMENT]** | régler les délais par sous-type (48 h / 5 j) — admin | examen hors délai |
| T34 — PV ou lettre sous 24 h après la séance d'instruction | Oui (acceptation, signature) | Page du dossier | **A** : signature − acceptation ≤ 24 h ouvrées | — | retard de délivrance |
| T35 — Réponse sous 72 h depuis la numérotation, sans dépasser 5 jours ouvrables | Oui (réception, signature du PV ou de la lettre) | Page du dossier | **A** : ≤ 72 h ouvrées, alerte à 5 j | — | réponse hors délai |
| T1-T2, T5-T6, T8-T15, T25, T29-T30 — organisation, huis clos, PPP, archivage, SIGMP | — | — | hors contrôle d'un dossier | — | — |

## 16. Récapitulatif 1 — Pièces restant à joindre (documents externes uniquement, procédure en ligne)

Sous réserve de Q1 (procédure en ligne) et des arbitrages Q2, Q3, Q4, Q8, Q9, Q10, Q11 (une pièce marquée « sauf Qn » disparaît si l'arbitrage est favorable).

| Type de dossier | Pièces restant à joindre |
|---|---|
| PPM / PPM-AGPM | journaux de publication des AGPM/PPM antérieurs (mise à jour) · décision du Gouvernement ou justificatif (délais aménagés, modes dérogatoires) · documents utiles · *(sauf Q3 : imprimé SIGMP du projet d'AGPM/PPM)* |
| DAOO (fournitures, travaux, international) | calendrier annuel de passation *(sauf Q-pièce)* · journal de publication de l'AGPM · bordereau des prix estimatifs / DQE estimatif signé *(sauf Q11)* · spécifications techniques (fichier, déjà dans le DAO) · documents utiles · *(sauf Q2 : fiche de présentation signée ; sauf Q3 : avis imprimé du SIGMP ; sauf Q-pièce : canevas de rapport)* |
| DPREQUAL | toutes (fiche, calendrier, publication, avis, projet de dossier de pré-qualification) — aucune donnée *(Q16)* |
| DAOR / DAORI | les mêmes que DAOO + décision autorisant l'AO restreint (au marché) · projet de lettre d'invitation *(tant que la lettre AOR n'est pas générée ; Q3)* · PV de validation de la liste restreinte par la CAO |
| Contrat-cadre | calendrier · journal AGPM · documents utiles · *(sauf Q2, Q3)* |
| DC (PI) | calendrier · journal AGPM · journal de publication de l'AMI · projet de décision autorisant la liste restreinte *(sauf Q9)* · tableau des coûts estimatifs *(sauf Q11)* · TDR (fichier, déjà dans le DC) · PV d'ouverture de l'AMI *(sauf Q8)* · PV de validation de l'AMI *(sauf Q4)* · documents utiles · *(sauf Q2, Q3)* |
| RJ / MGG | toutes (rapport justificatif, projet de décision, décision signée, fiche, PV de validation du titulaire et du montant, projet de marché, pièces d'appui) — aucune donnée *(Q16)* |
| MAOO / MAOOI / MAOOPREQUAL | journal de 1re publication de l'avis · AGPM publié · décision des pré-qualifiés (MAOOPREQUAL) · bordereau / DQE estimatif *(sauf Q11)* · PV de validation par la CAO *(sauf Q4)* · documents utiles · *(sauf Q2)* |
| MAOR / MAORI | idem + décision autorisant l'AO restreint · accusés de réception des lettres d'invitation *(sauf Q10)* |
| MPI | journal AGPM · accusés de réception des lettres *(sauf Q10)* · décision autorisant la liste restreinte *(sauf Q9)* · lettres de résultats techniques et d'information avec accusés *(tant qu'elles ne sont pas générées)* · PV d'ouverture des propositions financières signé *(tant que la séance financière n'est pas signée électroniquement)* · PV de validation technique et finale *(sauf Q4)* · tableau des coûts *(sauf Q11)* · documents utiles · *(sauf Q2)* |
| AVN | accord des deux parties · élément déclencheur · PV de validation des nouveaux prix et justificatifs (si nouveaux prix) · documents utiles · projet d'avenant *(tant qu'il n'est pas généré)* · marché initial et PV de la Commission **seulement si le marché n'est pas en ligne** (MGG, saisi) |
| DSS | projet de décision *(sauf Q9)* · justificatifs · journal AGPM |
| INDEMN, SURSIS, PENAL, DR | projet de décision *(sauf Q9)* · justificatifs (correspondances, calculs, constats, mise en demeure) · journal AGPM · marché initial et PV **seulement si le marché n'est pas en ligne** |

## 17. Récapitulatif 2 — Check-list résiduelle du contrôleur (contrôles B)

| Type | Contrôles restant au contrôleur |
|---|---|
| PPM | conformité du motif de mise à jour au CMP (P1) · nature / objet / compte : décision sur les signalements (P5, P6, P7 hors mentions) · pertinence de la justification d'un mode dérogatoire (P8) · contrats-cadres (P9) · pertinence des justifications de délai aménagé et existence de la décision du Gouvernement (P11, P22, P25) · fractionnement : décision sur les groupes signalés (P12, P14, P18) ; travaux routiers, bâtiments, hydro-agricole, PI (P15-P17, P19) |
| DAOO (F/T) | objet reformulé par rapport au plan (P2, si écart) · imprimé SIGMP (P12, si maintenu) · spécifications techniques : conformité aux modèles, neutralité, cohérence avec le DQE (P13 partie ST, P40 ; travaux P37-P38, plans P34) · pertinence des qualifications particulières (P18, P42) ; fournitures : ratios CA / similaires / liquidité (P43-P45) ; travaux : personnel et matériels (P44-P45) · lieu d'ouverture « très proche » (P24, si différent) · prix estimatifs vs cadre (P37 / T-P32, tant que Q11) · journal de publication de l'AGPM (P10) · offres anormales : seuils (P26, tant que Q12) |
| DPREQUAL | tout (P1-P6) |
| DAOR | pertinence des motifs du restreint (P1) · constitution de la liste restreinte (P2, P4-P7) |
| Contrat-cadre | usage non abusif (P1) · justification du recours (P2) · délais conseillés (P3) · critères d'élimination et d'attribution : pertinence, confirmation (P4-P6, P9-P11) · pourcentages 9.1 / art. 19 (P8, Q17) |
| DC | objet reformulé (P2) · journaux (P8, pièce 5) · PV d'ouverture de l'AMI (P10, si Q8 non) · considérants de la décision (P15) ; liste vs décision (P14, tant que Q9) · imprimé SIGMP (P17) · TDR (P18, P31, P34, P36, P37) · mode de sélection vs objet (P21) · forme des prix (P23) · frais remboursables (P24) · qualifications (P25) · lieu d'ouverture (P29, si différent) · mode / rémunération (P38-P40) · critères de l'AMI neutres (P42) |
| RJ / MGG | tout, hors l'inscription au plan (G0-P1) |
| MAOO / MAOR | authenticité, originaux, faux (A-P7-P9) · formes de publicité et site ARMP (A-P10-P15) · date et heure d'ouverture : décision sur l'écart (C-P2) · candidats présents (C-P3) · validité / authenticité des attestations et certificats (C-P4) · spécifications techniques des offres (C-P5) · offres anormales : décision (C-P7, tant que Q12) · variantes (C-P9) · activités du titulaire (C-P10, tant que le champ manque) · appréciation des pièces de qualification (C-P11) · offre conforme pour l'essentiel (C-P16) · offre inacceptable (C-P17) · fiches de renseignement (C-P18) · éclaircissements sans modification (C-P19) · PV de validation (C-P13, si Q4 non) · MAOR : délai et réception des invitations (P1-P3, tant que Q10) |
| MPI | délai depuis les invitations (P1, tant que Q10) · ouverture : décision sur l'écart (P2) · validité des documents essentiels (P4) · PV financier (P8, tant que non signé) · pourcentages DPAO (P10, Q17) · justificatif de disponibilité de fonds (P17, 0-20 %) · éclaircissements (P19) · négociations (P20) · PV de validation (P6, P13, si Q4 non) |
| AVN | motif et consistance vs accord (P4, P5) · élément déclencheur (P6) · nouveau délai (P8, tant que le champ manque) · nouveaux prix, pièces justificatives, PV de la CAO (P9-P11) · définition et cas d'avenant (P12, P14-P16, P19-P27) · avance (P17, tant que le champ manque) · avenant de convenance (P28) |
| DSS | motif vs pièces (P3) · pertinence des motifs d'intérêt général (P4, P11) · documents signés (P12) |
| INDEMN / SURSIS / PENAL / DR | motif de la décision (P3) · justifications (P5) · documents signés · INDEMN : acceptation, cas (P4 partie, P6-P9) · SURSIS : conditions, forme de la demande, notification (P6-P8, P9 partie, P10) · PENAL : assiette, nature, demande (P4 partie, P6-P8) · DR : faute grave, intérêt général, force majeure, motivation de la mise en demeure, garantie BE, éthique, CCAG (P5-P7 partie, P8 partie, P9-P10, P12-P14) ; **tous les montants, jours et dates tant que les champs manquent** |
| Transversal | rapport d'irrégularité grave (T7) |

## 18. Récapitulatif 3 — Règles de validation à implémenter, regroupées par écran

**[existe]** = déjà codée (rappelée pour mémoire) ; les autres sont à créer.

**Écran Dossier de planification / Pré-contrôle du PPM**
- `MOTIF_MAJ` obligatoire à la mise à jour ; diff figé **[existe]** (P1).
- `DESIGNATION_LOT` obligatoire pour chaque lot ; Σ `MONT_LOT` = `MONT_ESTIM` **[existe, signalé]** → refus de la ligne (P6, P7).
- Mention « délai réduit » dans l'objet si `JUSTIF_DELAI_AMENAGE` ; mention « contrôle a priori » si ligne sous le seuil soumise → blocage de la soumission (P7, P28 ; Q13).
- `JUSTIF_MODE_DEROGATOIRE`, `JUSTIF_DELAI_AMENAGE` obligatoires **[existe]** ; pièce « décision du Gouvernement » exigée dans ce cas (P11).
- Mode sous le seuil : passer de signalé à bloquant (P8 ; Q13).
- Prévisions : fin ≥ début, dans l'exercice **[existe]** ; ouverture − lancement ≥ délai minimal du mode, sinon refus ou justification (P10 ; Q6).
- Motif f. (PI < 100 M Ar) sélectionnable seulement si nature PI et montant < 100 000 000 (P26).
- Ligne « relance » ⇒ référence de la procédure précédente (P21).
- Fractionnement, nature, objet : signalements avant soumission **[existe]** ; écartement motivé (P5-P7, P12).

**Écran Fiche DAO (validation de la version)**
- Contrôles bloquants existants **[existe]** : OBLIGATOIRE, DATES_ORDRE (remise, ouverture), VALIDITE_GARANTIE_SUP_OFFRE, GARANTIE_TAUX, QUANTITES_ORDRE, ASSURANCE_DECENNALE, SOUS_CRITERES_POINTS, CA_MOYENNE, LIQUIDITE_DOUBLE, REFERENCES_CUMUL, MATERIEL_EXIGE, PIECES_OFFRE_EXIGEES.
- À créer : date limite − date de publication prévue ≥ délai minimal du mode (2-P7, 5-P3, 7-P7 ; Q6) · garantie de soumission : 3 formes obligatoires, montant dans 1-2 % du lot (élargir GARANTIE_TAUX) (2-P8) · seuils des offres anormales en deux champs %, ≤ 20 et ≤ 10 (2-P26 ; Q12) · variation des quantités ≤ 20 % (2-P27) · ratio min/max constant par lot en marché à commandes (2-P36) · lieu d'ouverture prérempli du lieu de remise (2-P24) · objet prérempli de l'objet du plan, modification signalée (2-P2) · heures de remise et d'ouverture en format heure en fournitures (2-P23) · visite obligatoire ⇒ dates (3-P20) · contrat-cadre travaux : refus des prix d'installation / repli (6-P7) · critère d'attribution ne peut citer une pièce administrative (6-P6) · si Q11 : prix unitaire estimé obligatoire par article, total = montant du lot (2-P37) · montant négocié PI obligatoire (11-pièce 15).

**Écran Avis spécifique / Lettres d'invitation**
- `datePublication`, `jmpDate` obligatoires **[existe partiel]** ; `jmpDate` ≥ date de signature du PV du plan (2-P10) ; limite − `datePublication` ≥ délai minimal (9-C-P1) ; datePublication − jmpDate ≥ 3 mois si délai aménagé c. (1-P23).
- Rendre l'avis et la lettre en « projet » dès la validation de la fiche (pièce 5).
- Lettre AOR à générer (5-pièce 5) ; si Q10 : consultation de la lettre tracée comme réception, dépôts ouverts après la dernière réception + seuil (10-P1-P3).

**Écran AMI / Présélection**
- Publication refusée si date limite − date de publication < seuil AMI (7-P9, P41 ; Q6).
- Poids des critères Σ = 100 **[existe]** ; note obligatoire et bornée (7-P11).
- Liste définitive seulement tous signés ou empêchés **[existe]** ; président obligatoire, quorum (7-P13 ; Q5).
- Si Q9 : projet de décision généré depuis la liste (7-P14).

**Écran Commission d'appel d'offres / Séance d'ouverture**
- Décision de désignation obligatoire (référence, date) **[existe]** ; au moins 2 membres et 1 président **[existe]**.
- Ouverture impossible avant la date limite **[existe]** ; écart à l'heure annoncée affiché (9-C-P2).
- PV clos seulement tous les présents signés ou empêchés **[existe]** ; président signataire obligatoire ; quorum de la CAO (9-C-P3 ; Q5).
- Séance financière PI : signatures électroniques des présents avant clôture (11-P8).

**Écran Dépôt des offres (candidat)**
- Dépôt refusé hors délai **[existe : DELAI_DEPASSE]** ; bordereau : aucune ligne sans prix, structure verrouillée (9-D5) ; validité et délai déclarés (lecture).

**Écran Évaluation**
- Conformité : arrêt refusé tant qu'une vérification manque **[existe]** ; décision « conforme » refusée si validité < exigée, délai > exigé, garantie < exigée ou hors forme (9-C-P4) ; PI : validité < `B04-DP-01` ⇒ non conforme (11-P16).
- Montants : motif obligatoire si le montant retenu diffère de la correction calculée **[existe]** (9-C-P6) ; PI : correction détaillée **[existe]** (11-P9).
- Offres anormales : si Q12, statut « non suspectée » refusé au-delà du seuil sans motif (9-C-P7).
- Qualification : décision sur chaque offre retenue **[existe]** ; « qualifié » refusé si CA / liquidité / références de l'offre < exigences (9-C-P11) ; activités de l'entreprise obligatoires (9-C-P10).
- Demandes : réponse refusée après l'échéance (9-C-P20 ; à confirmer).
- Rapport : produit seulement toutes étapes arrêtées, signé de tous **[existe]** ; mention textuelle de la moralité des prix dans le gabarit (9-C-P8, 11-P11).
- PI : grille de chaque membre complète avant l'arrêt **[existe]** (11-P5) ; négociation avec le 1er classé seul **[existe]** (11-P18) ; montant négocié obligatoire (11-P20).

**Écran Attribution**
- Dossier de marché créé seulement rapport signé **[existe]** ; soumission refusée sans date de publication de l'avis (9-A-P4).
- Attribution refusée si l'offre proposée a expiré sans prorogation jointe (9-C3) ; PI : refusée si > 20 % de l'estimation, pièce « disponibilité de fonds » exigée entre 0 et 20 % (11-P17).
- Projet de marché refait avant signature **[existe]**.

**Page de l'acte / Encart Actes de gestion**
- Acte créé depuis le marché, PV favorable exigé **[existe : ACTE_DEPUIS_LE_MARCHE, MARCHE_NON_CONTROLE]** ; marché signé dans l'application exigé (12-pièce 2) ; montant initial ≥ seuil de contrôle (12-P18).
- Avenant : montant HT, montant initial, catégorie obligatoires **[existe]** ; cumul ≤ ⅓ **[existe]** ; après réception / solde refusé **[existe]** ; objet, motif, « porte sur le délai » + nouveau délai, « introduit de nouveaux prix » ⇒ PV exigé, « porte sur l'avance » ⇒ refus (12-pièces 1, 6, 8 ; P8, P17).
- INDEMN : montant, diminution ; indemnité ≤ 4 % de la diminution (14-P4, P10). SURSIS : jours, date des causes, date de la demande ; demande − causes ≤ 10 j ; causes ≤ fin du délai contractuel (14-P4, P9, P11). PENAL : jours, montant ; montant calculé proposé (14-P4). DR : cas (liste), dates selon le cas, date de mise en demeure obligatoire pour une résiliation aux torts du titulaire (14-P5-P8).

**Encart Déclaration sans suite**
- Motifs obligatoires, déclaration refusée après signature d'un marché ou sans avis favorable **[existe]** ; délai de 5 jours avec alerte **[existe]** ; notification automatique **[existe]**.

**Page du dossier (circuit) / administration**
- Délais par sous-type à régler (48 h / 5 j ouvrés) ; alertes T32-T35 au tableau de bord.
- Pièces exigées par sous-type (V95) : retirer les pièces remplacées, conditionner le retrait à « procédure en ligne » ; pièce « décision du Gouvernement » conditionnée aux justifications ; pièce « PV des nouveaux prix » conditionnée à « nouveaux prix ».

## 19. Questions (cas ambigus et arbitrages) — à trancher avant de coder

| # | Question |
|---|---|
| Q1 | La révision ne vaut que pour les procédures conduites dans l'application (plan en données, fiche DAO validée, remise électronique, évaluation et attribution en ligne) ; en mode papier, tout reste à joindre et au contrôleur. Confirmer. |
| Q2 | La validation de la fiche DAO par la PRMP et la soumission du dossier (actes authentifiés par la session) valent-elles « fiche de présentation datée et signée » et « AGPM/PPM signé par la PRMP » ? |
| Q3 | Avis spécifique, lettre d'invitation, projet d'AGPM/PPM « imprimés du SIGMP/EGP » : admettre les documents générés par l'application (modèle ARMP), ou garder l'imprimé SIGMP à joindre ? |
| Q4 | La signature électronique collégiale du rapport (AMI, évaluation, technique, finale) par les membres de la CAO vaut-elle « PV de validation par la CAO » ? Sinon : geste « valider en séance » avec PV généré et signé, ou PV à joindre ? |
| Q5 | Quorum de la CAO pour la séance d'ouverture et la validation : règle à fixer (majorité des membres désignés ? tous ? président ou son représentant obligatoire, et qui est « représentant » ?). |
| Q6 | Table des délais minimaux : AOO national 30 j ; aménagé 15 j ; AOO international ? ; AOR (« < 20 j selon le cas ») ? ; DC (PI) ? ; AMI (art. 32-III) ? ; contrat-cadre ? |
| Q7 | Point de départ du délai : journal déclaré par la PRMP, ou site de l'ARMP (pas d'interopérabilité) ? La date saisie suffit-elle, la preuve étant le journal joint ? |
| Q8 | L'AMI s'ouvre automatiquement à la date limite, sans séance : l'écran AMI (dépôts horodatés, empreintes) tient-il lieu de PV d'ouverture ? |
| Q9 | Décisions signées (liste restreinte, pré-qualifiés, AO restreint, gré à gré, DSS, actes) : générer le projet de décision depuis les données, la décision signée restant à joindre ? |
| Q10 | La première consultation de la lettre d'invitation par le candidat connecté (horodatée) vaut-elle accusé de réception et point de départ du délai ? |
| Q11 | Saisir les prix estimatifs (bordereau, DQE, tableau des coûts) dans la fiche, non publiés ; qui peut les lire ? Sinon la pièce reste à joindre. |
| Q12 | Remplacer le texte libre des offres anormales par deux pourcentages structurés (≤ 20 %, ≤ 10 %). |
| Q13 | Contrôles bloquants (refus de la saisie ou de la soumission) : délai de remise, date de publication absente, rapport non signé, grille incomplète, validité PI, garantie 1-2 %, anormales, quantités 20 %, tiers, réception / solde, seuil de contrôle, DSS après signature, délai AMI, délai AOR/PI, mise en demeure, mention « délai réduit », mode sous le seuil. Confirmer la liste ; le reste est signalé. |
| Q14 | La signature électronique simple (clic authentifié) vaut-elle signature des documents d'évaluation et des PV de la CAO (« dûment signés et paraphés ») ? |
| Q15 | Fournir le chapitre 4 et les annexes du manuel (modèles de PV, de lettre de renvoi, de fiche de présentation, sommaire du rapport). |
| Q16 | Pré-qualification, DP bailleur, gré à gré : les outiller (fiche, critères, titulaire, montant, lien au marché initial) ou les laisser en fichiers ? |
| Q17 | Ambiguïtés du manuel à faire préciser : clause 6.8 vs 6.7 (travaux) ; « liste à compléter » (pré-qualification) ; pourcentages 9.1 RC / art. 19 (contrat-cadre) ; 2-III-C P7 (correction ou anormales) ; 2-III-E P10 « DPAO » pour un DC ; cas f. sans vérification ; « autre autorité de la PRMP » ; ajournement 3 mois vs 90 jours ; critères d'attribution F&S des contrats-cadres ; motifs d'avis défavorable absents en 2-II-G-2. |
| Q-pièce | Calendrier annuel de passation : dériver un document des prévisions de l'exercice ? Canevas de rapport : en ligne, le rapport est produit par l'application — faire valider son canevas une fois et retirer la pièce ? |
| à confirmer (code) | clé de la fiche pour « visite des lieux » (3-P11, P20) ; refus d'une réponse de candidat après l'échéance (9-C-P20) ; mention textuelle de la moralité des prix dans le gabarit du rapport (9-C-P8) ; génération d'une lettre d'invitation AOR (5-pièce 5) ; génération du projet d'avenant (12-pièce 8). |
