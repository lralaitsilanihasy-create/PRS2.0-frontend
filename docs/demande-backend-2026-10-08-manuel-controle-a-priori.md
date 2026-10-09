# Demande backend — 2026-10-08 — Le référentiel du contrôle aligné sur le Manuel de contrôle a priori (CNM, février 2026)

**Date** : 2026-10-08 · **Émetteur** : front · **Origine** : demande du pilote du 08/10 — « ajuster l'application et les grilles de
contrôle pour chaque type de dossiers » d'après le *Manuel de contrôle a priori des marchés publics*, version février 2026
(`docs/Manuel_de_controle/MANUEL DE CONTROLE A PRIORI.pdf`, 79 pages ; chapitres 1 à 3 ; le chapitre 4 et les annexes annoncés au
sommaire ne figurent pas dans le PDF reçu).

**Conventions** : noms et codes **PROPOSÉS** ; le backend les fixe et corrige ce document en place (encadré ⚠️ daté). Les grilles
ci-dessous transposent les tableaux « Principaux points de vérification » du manuel : un point = une question à laquelle le Membre
répond conforme / non conforme, avec observation.

---

## Le constat — l'application face au manuel

Le référentiel lu sur DBPRS20 le 08/10 (lecture seule) :

| Élément | Aujourd'hui | Manuel |
|---|---|---|
| Familles | DDP, DMC, DDM | les mêmes, plus les **actes de gestion contractuelle** (ch. 3) et la **déclaration sans suite** |
| Sous-types | 7 : PPM, PPM-AGPM, DAO, DAOR, MAOO, MAOR, MPI | 23 codes de numérotation (p. 7) : PPM, PPM.AGPM, DAOO, Dpréqual, DAOOpréqual, DAOOI, DAOR, DAORI, DC, DP, RJ, MAOO, MAOOpréqual, MAOOI, MAOR, MAORI, AVN1…, DR, INDEMN, PENAL, SURSIS, DSS, TEXTMP |
| Pièces exigées | **par famille** (DMC : 9, DDM : 7, DDP : 6), identiques pour tous les sous-types | **par type de dossier**, listes distinctes (DAO fournitures ≠ DAO travaux ≠ DC ≠ marché PI ≠ avenant…) |
| Grilles | PPM 9 points, PPM-AGPM 13, DAO 12, MAOO = MAOR = MPI 9 points (les mêmes), **DAOR 0** | une grille par type ; DAO distinct pour fournitures et travaux ; contrat-cadre, DAOR, DC, gré à gré, marché PI, avenant, DSS, actes d'exécution |
| Circuit | réception, dispatch, examen, projet de PV, visa, double signature, lettre de renvoi signée du Président / Chef de commission, vérification, SIGMP, archivage ; délais en heures ouvrées | **conforme** (ch. 1, IV et V) — voir B6 pour les valeurs des délais |

**Ce qui est déjà juste** : le circuit (étapes 1 à 6 du manuel), la double signature du PV, la lettre de renvoi signée par le seul
Président ou Chef de commission (anonymat de l'examinateur), la numérotation `n° / sous-type / commission / année`, la grille DAO
tirée de la fiche, la grille du PPM et de sa fiche de présentation.

---

## B1 — Les sous-types de dossier du manuel

Le code d'affichage est celui du tableau de numérotation du manuel (p. 7) ; il entre dans la référence du dossier.

| Code (manuel) | Libellé | Famille | Aujourd'hui | Proposition |
|---|---|---|---|---|
| PPM | Plan de passation des marchés | DDP | existe | inchangé |
| PPM.AGPM | PPM et avis général de passation | DDP | `PPM-AGPM` | inchangé (le point du manuel devient un tiret) |
| DAOO | Dossier d'appel d'offres ouvert | DMC | `DAO` | Q1 : renommer `DAO` en `DAOO` (références comprises) ou garder `DAO` avec le libellé « ouvert » |
| Dpréqual | Dossier de pré-qualification | DMC | — | **à créer** |
| DAOOpréqual | DAO ouvert avec pré-qualification | DMC | — | **à créer** |
| DAOOI | DAO ouvert international | DMC | — | **à créer** (Q2) |
| DAOR | Dossier d'appel d'offres restreint | DMC | existe, grille vide | grille B3 |
| DAORI | DAO restreint international | DMC | — | **à créer** (Q2) |
| DC | Dossier de consultation (prestations intellectuelles) | DMC | — (la fiche PI passe en `DAO`) | **à créer** ; une fiche de prestations intellectuelles produit un dossier `DC` |
| DP | Demande de proposition (bailleur) | DMC | — | **à créer** |
| RJ | Rapport justificatif (gré à gré) | DMC | — | **à créer** |
| MAOO | Marché sur appel d'offres ouvert | DDM | existe | grille B3 |
| MAOOpréqual | Marché sur AO ouvert avec pré-qualification | DDM | — | **à créer** |
| MAOOI | Marché sur AO ouvert international | DDM | — | **à créer** (Q2) |
| MAOR | Marché sur appel d'offres restreint | DDM | existe (libellé « Ouvert Restreint ») | libellé : « Marché sur appel d'offres restreint » ; grille B3 |
| MAORI | Marché sur AO restreint international | DDM | — | **à créer** (Q2) |
| MPI | Marché de prestations intellectuelles | DDM | existe | grille B3 propre (deux enveloppes) |
| MGG | Marché de gré à gré (projet de marché) | DDM | — | **à créer** (le manuel le traite au ch. 2-II-G sans code propre ; Q3) |
| AVN | Avenant (n° 1, n° 2…) | **DGC** (nouvelle) | — | **à créer** ; le rang de l'avenant entre dans la référence |
| DR | Décision de résiliation | DGC | — | **à créer** |
| INDEMN | Décision d'octroi d'indemnité | DGC | — | **à créer** |
| PENAL | Décision de remise de pénalité | DGC | — | **à créer** |
| SURSIS | Décision de sursis d'exécution | DGC | — | **à créer** |
| DSS | Décision de déclaration sans suite | DMC | — | **à créer** (rattachée à la procédure qu'elle abandonne) |
| TEXTMP | Projet de textes en marchés publics | — | — | **hors périmètre** proposé : examen collégial (ch. 1, II) — Q4 |

- **Famille DGC « Acte de gestion contractuelle »** (ch. 3) : un dossier DGC est rattaché au **marché initial** qu'il concerne
  (dossier DDM au PV favorable) ; la Commission n'examine que les actes des contrats qu'elle a contrôlés a priori.
- Un avenant, une résiliation, une indemnité… se déposent par la PRMP **depuis le marché** (pas de saisie libre de l'objet).

> ⚠️ **Backend, 2026-10-08 — B1 livré (tranche M1, V94)** ; contrat : `docs/api-endpoints.md`, § *… tranche M1*. Le chantier est
> découpé : **M1** sous-types (B1) ; **M2** pièces (B2) ; **M3** grilles (B3) ; **M4** motifs-types (B4) ; **M5** garde-fous, dépôt des
> actes DGC depuis le marché, délais (B5, B6). Arbitrages du pilote du 08/10 en plus de Q1-Q4 : codes **sans accent** ; sous-type
> **déduit du mode du plan** ; **DSS garde sa famille propre**.
> - **Codes** : `DAOO` (ex-`DAO`, références comprises : « …/DAOO/… »), **`DPREQUAL`**, **`DAOOPREQUAL`**, `DAOOI`, `DAOR`, `DAORI`, `DC`,
>   `DP`, `RJ` (DMC) ; `MAOO`, **`MAOOPREQUAL`**, `MAOOI`, `MAOR`, `MAORI`, `MPI`, `MGG` (DDM) ; `AVN`, `DR`, `INDEMN`, `PENAL`, `SURSIS`
>   (**DGC**, nouvelle famille). `PPM.AGPM` reste **`PPM-AGPM`**. Le **type de DMC** « DAO » (`typeDmcCode`) ne change pas.
> - **Écart sur DSS** : la déclaration sans suite n'est **pas** en famille DMC mais dans sa **famille propre `DSS`** (V93, arbitrage du
>   pilote à la tranche 2d-3 : ni les points ni les pièces du DAO ne s'y appliquent) ; son lien à la procédure est tenu par la demande
>   de sans suite (`GET /api/fiches-marche/{idDmc}/sans-suite`).
> - **Dossier produit par la fiche** : `DC` pour une fiche de prestations intellectuelles ; sinon selon le mode du plan (`DAOOI` /
>   `DAORI` international, `DAOOPREQUAL` pré-qualification, `DAOR` restreint, `DAOO`) ; le dossier de marché suit la même règle.
> - Un `idSousType` `DAO` envoyé à `POST /api/saisies/dossier` est encore accepté et lu `DAOO` ; le front passe à `DAOO`.
> - D'ici M2 et M3, les nouveaux sous-types prennent les pièces et les points **de leur famille** ; DGC n'en a aucun.

## B2 — Les pièces exigées, par sous-type

Les pièces deviennent **par sous-type** (aujourd'hui par famille). Une pièce produite par l'application (DAO complet, rapport de
présélection, projet de marché, PV d'ouverture, rapport d'évaluation) reste jointe d'office. `*` = obligatoire.

| Sous-type | Pièces (manuel) |
|---|---|
| PPM / PPM.AGPM | Fiche de présentation datée et signée* ; projet d'AGPM / PPM imprimé du SIGMP* ; publication des AGPM / PPM antérieurs et leurs PV (mise à jour)* ; décision du Gouvernement ou justificatif (délais aménagés, modes dérogatoires) ; budget, programme d'emploi |
| DAOO fournitures | Fiche de présentation signée* ; calendrier annuel de passation mis à jour et signé* ; AGPM signé, contrôlé, avec PV CNM* ; publication de l'AGPM dans les journaux* ; projet d'avis spécifique imprimé du SIGMP* ; canevas de rapport d'évaluation* ; bordereau des prix estimatifs signé* ; projet de DAO* (DAO complet) |
| DAOO travaux | idem, avec le **DQE signé** au lieu du bordereau des prix |
| Dpréqual | Fiche de présentation* ; calendrier* ; AGPM signé avec publication* ; PPM signé contrôlé* ; projet d'avis spécifique (SIGMP)* ; projet de dossier de pré-qualification* |
| DAOR / DAORI | Fiche* ; calendrier* ; AGPM et PV CNM* ; publication AGPM* ; **projet de lettre d'invitation (SIGMP)*** ; **PV de validation de la liste restreinte par la CAO*** ; canevas de rapport* ; bordereau ou DQE signé* ; projet de DAO* |
| Contrat-cadre (DAOO de forme contrat-cadre) | Fiche* ; calendrier* ; AGPM et publication* ; projet d'avis spécifique (SIGMP)* ; projet de DAO* |
| DC | Fiche* ; calendrier* ; AGPM et PV CNM* ; journal de publication de l'AGPM* ; **journal de publication de l'AMI*** ; **documents d'évaluation de l'AMI : PV d'ouverture, rapport, PV de validation*** ; projet de lettre d'invitation (SIGMP)* ; **projet de décision autorisant la liste restreinte*** ; canevas de rapport* ; tableau des coûts estimatifs signé* ; projet de DC* |
| RJ | Rapport justificatif signé* ; PPM contrôlé portant la prestation* ; projet de décision autorisant le gré à gré* ; pièces d'appui |
| MGG | Fiche* ; décision autorisant le gré à gré signée* ; PPM signé* ; **PV de validation du choix du titulaire et du montant par la CAO*** ; projet de marché* |
| MAOO / contrat-cadre | Fiche* ; **journal de 1re publication de l'avis** (ou lettres d'invitation avec accusé, pré-qualification)* ; décision portant liste des pré-qualifiés (pré-qualification) ; AGPM publié* ; PV CNM sur le DAO* ; PV d'ouverture* ; rapport d'évaluation* ; PV de validation CAO* ; bordereau ou DQE signé* ; projet de marché* |
| MAOR | Fiche* ; **décision autorisant l'AO restreint*** ; **lettres d'invitation avec accusé de réception*** ; AGPM publié* ; PV CNM sur le DAO* ; PV d'ouverture* ; rapport* ; PV de validation* ; bordereau ou DQE* ; projet de marché* |
| MPI | Fiche* ; lettres d'invitation avec accusé* ; décision autorisant la liste restreinte* ; AGPM publié* ; PV CNM sur le DC* ; PV d'ouverture des propositions techniques* ; rapport d'évaluation technique* ; PV de validation technique* ; lettres de notification des résultats techniques et d'information de l'ouverture financière, avec accusé* ; PV d'ouverture des propositions financières* ; rapport d'évaluation finale* ; PV de validation finale* ; tableau des coûts signé* ; projet de marché* |
| AVN | Fiche* ; marché initial signé et approuvé (et avenants antérieurs)* ; PV de la Commission sur le marché* ; accord de l'Autorité contractante et du titulaire* ; **élément déclencheur*** ; PV de validation des nouveaux prix par la CAO (nouveaux prix) ; pièces d'appui (ordres de service, relevés météo…) ; projet d'avenant* |
| DSS | Fiche* ; AGPM ou PPM contrôlé* ; projet de décision* ; justificatifs des motifs d'intérêt général* |
| INDEMN / SURSIS / PENAL / DR | Fiche* ; AGPM ou PPM contrôlé* ; PV de la Commission sur le marché* ; marché initial* ; projet de décision* ; justificatifs (correspondances, calcul de l'indemnité ou du nombre de jours, constats, mises en demeure)* |

> ⚠️ **Backend, 2026-10-08 — B2 livré (tranche M2, V95)** ; contrat : `docs/api-endpoints.md`, § *… tranche M2*. Arbitrages du pilote
> du 08/10 : pièces « * » **exigées dès M2** ; **plans `PPM` / `PPM-AGPM` inchangés** ; sans fiche, les pièces qui dépendent de la
> catégorie sont **servies sans obligation**.
> - **Lecture** : `GET /api/type-piece-jointes?sousType={code}` (la liste du sous-type, à défaut celle de sa famille) et **`GET
>   /api/dossiers/{id}/pieces-exigees`** (obligation résolue pour ce dossier, par la catégorie et la forme de sa fiche). Le DTO gagne
>   **`categorie`** et **`forme`** (`CONTRAT_CADRE` | `AUTRE`). Le dépôt reste `idTypePiece` ; aucun contrôle de famille à l'upload.
> - **Une liste propre remplace celle de la famille** (les 9 pièces DMC communes ne s'ajoutent pas à DAOO). Sous-types sans liste
>   (`DP`) : pièces de la famille. Soumission et recevabilité lisent la même liste.
> - **Écarts** : DAOOI, DAOOPREQUAL reprennent la liste DAOO ; DAORI celle de DAOR ; MAOOI et MAOOPREQUAL celle de MAOO (MAOOPREQUAL
>   avec la décision des pré-qualifiés), MAORI celle de MAOR. « Documents d'évaluation de l'AMI » (DC) = `RAPPORT_PRESELECTION`, joint
>   d'office, plus `PV_AMI` (PV d'ouverture et de validation). « Bordereau ou DQE » du marché = `DEVIS_ESTIMATIF`, joint d'office. Le DSS
>   garde en plus `MOTIFS_SANS_SUITE` produit par le serveur. Les pièces jointes d'office sont reprises par leur code.
> - **Effet** : un brouillon `DAOO` existant doit maintenant porter sa liste avant d'être soumis.

> ✅ **Front, 2026-10-09 — M2 branché (tranche MC1)** :
> - **Créer un dossier** : les pièces de la famille à l'entrée, puis celles du **sous-type** choisi (`?sousType=`) ; un fichier déjà
>   choisi pour une pièce encore attendue est gardé.
> - **Recevabilité** (Secrétaire) et **Compléter les pièces** (PRMP) lisent `GET /api/dossiers/{id}/pieces-exigees` (repli : la famille,
>   si la route ne répond pas) — le filtre par famille d'avant perdait les pièces de la bibliothèque du manuel, qui n'en ont pas.
> - **Page dossier, onglet Pièces** : en brouillon, « Pièces exigées pour soumettre », chaque pièce marquée jointe, obligatoire
>   manquante ou facultative — ce que la soumission refuserait se voit avant.
> - Le modèle `TypePieceJointe` lit `categorie` et `forme`.

## B3 — Les grilles de contrôle, par sous-type

**Mécanisme proposé** : un point peut porter, en plus de son sous-type (nullable = commun, comme aujourd'hui), une **condition** sur
la **catégorie** de la fiche (FOURNITURES_SERVICES, TRAVAUX, PRESTATIONS_INTELLECTUELLES) et sur la **forme** (CONTRAT_CADRE) :
la grille effective (`GET /api/points-ctrls?sousType=`, ou par dossier) ne sert que les points qui s'appliquent. Les points
existants sont gardés (références d'examens passés) ; ceux que le manuel ne connaît pas restent, ceux qu'il ajoute sont créés.
Libellés courts ; la description (la question) reprend le manuel.

### PPM / PPM.AGPM (ch. 2-I) — compléter la grille existante

| Point | Question (description) | Portée |
|---|---|---|
| *existants 1, 2, 3, 6, 7, 8, 9 à 14, 16* | gardés | |
| Motifs de la mise à jour | Les motifs de la mise à jour du PPM sont-ils conformes au CMP ? | FICHE |
| Mode de passation | Le mode respecte-t-il les textes ? Pour un contrat-cadre : prestations répétitives et indéterminées, durée, ou urgence ? | LIGNE |
| Dates prévisionnelles et délais aménagés | Les dates sont-elles cohérentes avec le mode et les délais ? Un délai aménagé est-il appuyé (décision du Gouvernement, situation imprévisible, infructuosité, urgence, AGPM publié 3 mois avant, PI < 100 M Ar HT) et l'objet porte-t-il « délai réduit » ? | LIGNE |
| Mentions de l'objet | L'objet est-il explicite : type et quantité (sauf à commande), site et consistance (travaux), domaine (PI), immatriculation (véhicules), lots et tranches, « relance », « délai réduit », « contrôle a priori » ? | LIGNE |
| Fractionnement illicite (précision) | Le point 3 précise la base d'appréciation : compte PCOP/PCG, une seule RN ou un périmètre irrigué pour les travaux, TDR identiques pour les PI, en distinguant source de financement, forme et entretien / réhabilitation. | DOSSIER |

### DAOO — commun fournitures et travaux (ch. 2-II-A et B)

Les 12 points actuels de la grille DAO (20 à 32, tirés de la fiche) sont **gardés** ; ils couvrent les DPAO, l'AE et le CCAP. Points
à **ajouter** :

| Point | Question | Condition |
|---|---|---|
| Fiche de présentation cohérente | Chaque point de la fiche (objet, mode, allotissement, montant estimé) est-il cohérent avec l'AGPM et le DAO ; la date de disponibilité du DAO est-elle en retard sur l'AGPM ? | — |
| Délai de remise des offres | Le délai minimum est-il respecté (30 jours ; 15 jours en délai aménagé, art. 3.a du décret 2019-1310) ? | — |
| AGPM contrôlé et publié | L'AGPM a-t-il reçu l'avis de la CNM avant sa publication, et une copie du journal accompagne-t-elle le dossier ? | — |
| Avis spécifique conforme | L'avis (imprimé du SIGMP) suit-il le modèle et reprend-il l'objet, le nombre de lots maximum, la forme des prix, l'adresse de consultation et d'achat, la date et l'heure de remise et d'ouverture, le coût du DAO et les trois formes de paiement, les trois formes et le montant de la garantie ? | — |
| Conformité aux documents types | Le DAO est-il conforme, clause par clause, au document type et au modèle de DAO de la catégorie ? | — |
| Offres anormales et quantités | Les seuils d'offre anormale sont-ils au plus 20 % (haute) et 10 % (basse), et la modification des quantités au plus 20 % ? | — |
| Remise et ouverture des plis | Heure et lieu de remise cohérents avec l'avis ; ouverture à l'heure limite, au même lieu (ou très proche) ? | — |
| Formulaires de soumission | Les formulaires existent-ils et sont-ils cohérents avec le DAO ; la déclaration des bénéficiaires effectifs est-elle jointe ? | — |
| Qualifications particulières proportionnées | Les qualifications particulières sont-elles pertinentes et proportionnées (indicatif : chiffre d'affaires 1 à 1,5 fois l'estimation, marché similaire du même ordre, liquidité ≤ 30 % de l'offre) ? | — |
| Quantités fixes ou à commande | La rédaction distingue-t-elle bien quantités fixes et à commande (DPAO 1.2, AE art. 2 et 5, CCAP art. 6, 10, 12.1, 14, 21) ; à commande, la proportion min / max est-elle identique d'un article à l'autre ? | FOURNITURES_SERVICES |
| Spécifications neutres | Les spécifications sont-elles neutres et optimales : ni marque ni technologie précise, sans critère superflu ? | FOURNITURES_SERVICES |
| Visite des lieux | Visite cohérente avec l'avis (obligatoire ou non, organisée ou non) ; si obligatoire et organisée, au moins une période ou deux dates ? | TRAVAUX |
| Prix unitaires ou forfaitaires | La forme de prix est-elle tenue partout (AE art. 2, annexes : BPU, DQE, coefficient K, sous-détails, état des sommes à des tiers — DQE seul au forfait ; CCAP art. 12.1 et 16) ? | TRAVAUX |
| Garantie décennale | Pour une construction neuve, la garantie décennale est-elle prévue (CCAP art. 8, partie C) ? | TRAVAUX |
| Spécifications et DQE | Les chapitres II (matériaux) et III (mode d'exécution) sont-ils cohérents avec le DQE ; le chapitre IV distingue-t-il mode d'évaluation (prix unitaires) et devis descriptif (forfait) ? | TRAVAUX |
| Personnel et matériel exigés | Le personnel exigé se limite-t-il à l'encadrement (conducteur des travaux, chef de chantier), le matériel aux engins essentiels ? | TRAVAUX |

### Contrat-cadre (ch. 2-II-E) — en plus de la grille DAOO, condition forme = CONTRAT_CADRE

| Point | Question |
|---|---|
| Recours justifié | Le besoin est-il répétitif et indéterminé (ou une situation d'urgence sur une période) ? Sinon, proposer le marché à commandes. |
| Critères d'élimination et d'attribution | Les pièces de candidature, les critères d'élimination et les critères d'attribution sont-ils cohérents et pertinents ? Ni pièce administrative comme critère d'élimination ou d'attribution, ni spécification technique comme critère d'attribution. |
| Critères de conformité de l'offre | Objectifs, réalistes, en rapport avec l'objet (attestation du fabricant, autorisation sectorielle, certificat de normes, service après-vente, garantie commerciale, garantie de soumission). |
| Pourcentages | Les pourcentages du règlement de la consultation (9.1) et de l'AE / CCAP (art. 19) sont-ils cohérents ? Travaux : prix d'installation et de repli de chantier supprimés ? |
| Délais de remise | Délais de remise (contrat-cadre et marchés subséquents) suffisants pour une concurrence saine ? |

### Dpréqual (ch. 2-II-C)

| Point | Question |
|---|---|
| Recours à la pré-qualification | L'importance ou la complexité des prestations justifie-t-elle une pré-qualification ? |
| Critères de qualification pertinents | Moyens humains et matériels, capacité financière, références : proportionnés à l'objet et au montant (mêmes repères indicatifs que le DAOO) ? |
| Pièces d'appui | AGPM publié, PPM contrôlé, avis spécifique du SIGMP joints ? |

DAOOpréqual : la grille DAOO (le manuel : « contrôle d'un appel d'offres ouvert classique »).

### DAOR / DAORI (ch. 2-II-D) — grille DAOO, plus :

| Point | Question |
|---|---|
| Motif de l'appel d'offres restreint | Le motif relève-t-il de l'un des quatre cas (urgence avérée, caractère confidentiel, prestataire défaillant, petit nombre de prestataires) et est-il pertinent ? |
| Constitution de la liste restreinte | Les critères de choix sont-ils neutres et optimaux, et la liste conforme au motif : capacités et garanties (urgence) ; plus enquête de moralité (confidentiel) ; participants à l'AO (défaillant) ; liste d'un organisme professionnel reconnu — OMERT, OMH, chambre de commerce (petit nombre) ? Au moins trois candidats. |
| PV de la CAO sur la liste | Le PV de validation de la liste restreinte par la CAO est-il joint et cohérent ? |
| Lettre d'invitation | La lettre d'invitation (SIGMP) est-elle conforme et cohérente avec le DAO ? |
| Délai de remise | Le délai respecte-t-il les articles 2 et 3 du décret 2019-1310 ? |

### DC — prestations intellectuelles (ch. 2-II-F)

| Point | Question |
|---|---|
| Fiche de présentation cohérente | Objet, mode (clause 1 des DPIC), allotissement, montant estimé : cohérents avec l'AGPM et le DC ; retard de disponibilité du DC ? |
| Délai de remise des propositions | Le délai minimum est-il respecté ? |
| AGPM contrôlé et publié | Avis de la CNM avant publication, journal joint ? |
| AMI : délai et ouverture | Le délai de remise des manifestations d'intérêt est-il respecté (sinon : relancer l'AMI) ; la date et l'heure d'ouverture sont-elles celles de l'AMI ? |
| AMI : PV d'ouverture | Quorum et qualité des signataires (président de la CAO ou son représentant, membres désignés, candidats présents) ? |
| AMI : rapport et PV de validation | L'évaluation suit-elle les critères publiés (neutres : expérience générale et spécifique) ; le PV de validation est-il cohérent, son quorum atteint ? |
| Décision autorisant la liste restreinte | La liste est-elle celle des documents d'évaluation, les considérants pertinents ? |
| Lettre d'invitation | Conforme au modèle (SIGMP) : objet, heure de remise et d'ouverture, liste des candidats, mode de sélection, adresse, coût du DC et trois formes de paiement ? |
| Conformité aux documents types | Le DC est-il conforme, clause par clause, au document type ? |
| Mode de sélection adapté | Le mode convient-il à l'objet : qualité seule (grande complexité), qualité-coût (complexité moyenne), budget déterminé (classique, qualifications moyennes), moindre coût (classique, qualifications assez élevées), qualification du consultant (qualifications très élevées) ? |
| Forme de rémunération | La rémunération convient-elle (prix unitaires pour contrôle, surveillance, formation ; forfait pour audits et études) ; frais remboursables et frais divers pertinents ? |
| Critères et personnel clé | Pondération des critères et sous-critères cohérente ; qualifications du personnel clé cohérentes avec les TDR et neutres (qualification générale, expérience générale, expérience spécifique) ? |
| Remise et ouverture | Dates, heures et lieu cohérents avec la lettre d'invitation ; ouverture des propositions techniques à l'heure limite, au même lieu ? |
| Acte d'engagement et délais | Prix (unitaires / forfait, national / international) ; délais cohérents entre DPIC, AE, CCAP et TDR ; annexes conformes à la clause 7.2.2 ? |
| CCAP : modalités de règlement | Cohérentes avec les livrables des TDR (nombre, périodicité) et la forme de rémunération ? |
| TDR cohérents | Profil du consultant, livrables, délai : sans incohérence majeure avec le reste du dossier ? |

### RJ — rapport justificatif du gré à gré (ch. 2-II-G)

| Point | Question |
|---|---|
| Motif de l'article 39-II | Le motif relève-t-il d'un cas autorisé — prestations secrètes, urgence impérieuse (décret 2022-800 : phénomène extérieur, imprévisible, irrésistible), droit d'exclusivité, marché complémentaire, qualification unique / continuité (PI) ? |
| Pièces à l'appui du motif | Les pièces exigées pour ce cas sont-elles jointes : pièce d'une autorité autre que la PRMP (secret) ; comptes rendus, photos, décision présidentielle ou gouvernementale (urgence) ; attestation d'exclusivité d'un organisme compétent, pas du candidat (exclusivité) ; marché initial et preuve de la circonstance imprévue (complémentaire) ? |
| Marché complémentaire : conditions cumulatives | Marché initial passé par appel d'offres ; prestations nouvelles nécessaires à la suite d'une circonstance imprévue ; inséparables du marché principal ; cumul ≤ 1/3 du marché principal, avenants non compris ? |
| PPM et décision | La prestation figure-t-elle au PPM contrôlé ; le projet de décision est-il joint ? |

### MGG — projet de marché de gré à gré (ch. 2-II-G)

| Point | Question |
|---|---|
| Choix du titulaire justifié | Capacités juridique (NIF, STAT, RCS), technique (marchés similaires, matériel, personnel clé) et financière (liquidité, chiffre d'affaires) justifiées ? |
| Montant justifié | Par comparaison à un marché similaire passé par AO ouvert (extrait), par l'analyse des sous-détails signés, ou par la consultation d'au moins trois candidats (lettres avec accusé, proformas, pièces administratives) ? Des prix exorbitants appellent une négociation consignée au PV. |
| PV de validation de la CAO | Cohérent et pertinent ; quorum et qualité des signataires (président de la CAO ou son représentant, membres désignés) ? |

### MAOO et contrat-cadre (ch. 2-III-C) — compléter la grille 33 à 41

| Point | Question |
|---|---|
| *existants 33 à 41* | gardés |
| Délai de remise des offres | Décompté de la 1re publication de l'avis (journal ou site de l'ARMP) : suffisant ? Date de 1re publication clairement établie ? |
| PV d'ouverture : date et heure | Cohérentes avec l'avis ? (Le PV ne se modifie jamais ; une erreur de transcription se prouve par le registre et une déclaration des membres.) |
| PV d'ouverture : quorum et signataires | Président de la CAO ou son représentant, membres désignés, candidats présents ? |
| Conformité des documents essentiels | AE daté et signé, validité de l'offre (décomptée de la date limite), délai, garantie de soumission (montant, forme, validité), attestation du fabricant et catalogues (fournitures), certificat de visite (travaux) ? |
| Spécifications techniques | Les spécifications proposées sont-elles conformes, sans réserve, divergence ni omission substantielle ? |
| Moralité des prix | Le rapport mentionne-t-il expressément la vérification de la moralité des prix unitaires par la CAO (circulaire, point XII-2) ? |
| Qualification : activités et critères | Les activités du candidat (NIF, STAT) couvrent-elles l'objet ; les seuls critères du DAO validé ont-ils été appliqués (fiches de renseignement ignorées hors qualifications particulières) ? |
| PV de validation cohérent | Les résultats du PV sont-ils ceux du rapport ; quorum et signataires ? |
| Validité de l'offre retenue | L'offre de l'attributaire est-elle encore valide, ou sa prorogation obtenue avant expiration ? |

### MAOR (ch. 2-III-D) — grille MAOO, plus :

| Point | Question |
|---|---|
| Décision autorisant l'AO restreint | Jointe et signée de l'Autorité contractante ? |
| Réception des lettres d'invitation | Tous les candidats de la liste ont-ils reçu la lettre (accusés) ; le délai de remise, décompté de la **dernière** réception, est-il respecté ? |

### MPI — marché de prestations intellectuelles (ch. 2-III-E) — grille propre (remplace 33 à 41)

| Point | Question |
|---|---|
| Lettres d'invitation | Délai de remise décompté de la dernière réception : respecté ? |
| PV d'ouverture technique | Date et heure cohérentes avec la lettre ; quorum et signataires ? |
| Documents essentiels | Lettre de soumission, pouvoir (groupement), personnel clé avec CV, méthodologie, calendrier, programme de travail : présents ? |
| Notation technique transparente | Notation selon les critères, sous-critères et pondérations des DPIC, conforme aux TDR ; détail des notes de chaque membre au rapport ; rejet sous le score minimum ? |
| PV de validation technique | Cohérent avec le rapport ; quorum et signataires ? |
| Notification des résultats techniques | Lettres aux non retenus et information de l'ouverture financière aux retenus, avec accusé ? |
| PV d'ouverture financière | Quorum et signataires ? |
| Évaluation finale | Corrections selon les IC, rabais pris en compte, frais remboursables exclus, moralité des prix mentionnée, classement selon la méthode ? |
| PV de validation finale | Cohérent avec les rapports technique et financier ; quorum et signataires ? |
| Proposition financière acceptable | Montant au plus 20 % au-dessus de l'estimation, avec une attestation de disponibilité des fonds (DAF ou ORDSEC) ; plus d'une proposition conforme ? |
| Négociation | Qualité technique seule : négociation avec le premier classé, personnel clé confirmé, sans changement substantiel ? |

### AVN — avenant (ch. 2-IV)

| Point | Question |
|---|---|
| Fiche de présentation cohérente | Objet, historique du marché, motif et consistance de l'avenant cohérents avec l'accord des parties et le marché initial ? |
| Avenant recevable | Marché initial signé et approuvé ; avant la réception définitive (travaux), provisoire (fournitures, services), avant le solde ; ni avance modifiée ; augmentation ≤ 1/3 du prix initial ? |
| Élément déclencheur | Le motif résulte-t-il d'une circonstance indépendante de la volonté des parties, attestée par une autorité autre que la PRMP (relevés météo, attestation des TP…) — pas d'avenant de convenance ? |
| Avenant nécessaire | La modification dépasse-t-elle ce que le marché permet (variations du CPS / CCAP, calendrier, lieu, nature des prix, statut du titulaire) ? |
| Accord des parties | L'accord reflète-t-il toutes les modifications (délais, prix, montant) ? |
| Nouveaux prix | Prix appréciés par la CAO (sous-détails ou marchés similaires), pièces cohérentes ; quorum et signataires du PV ? |
| Délai de présentation | Projet présenté avant l'expiration du délai d'exécution, ou écart justifié ? |

### DSS — déclaration sans suite (ch. 2-V)

| Point | Question |
|---|---|
| Fiche de présentation | Historique de la mise en concurrence et motif cohérents avec les pièces ? |
| Motif d'intérêt général | Motif pertinent (intérêt public, commun, des finances publiques), appuyé de documents signés, pas de simple allégation ? |
| Recevabilité | Décision avant toute signature du marché ? (Avis à rendre sous cinq jours ; un refus oblige à reprendre la procédure.) |

### INDEMN, SURSIS, PENAL, DR — actes de gestion contractuelle (ch. 3)

| Sous-type | Points |
|---|---|
| tous | Fiche de présentation cohérente (historique du marché, motif) · Marché contrôlé a priori par la Commission (PV joint) · Pièces signées, pas de simple allégation |
| INDEMN | Cas d'indemnisation fondé (minimum de commande non atteint, résiliation aux torts de l'administration, ajournement, imprévision, diminution de la masse — 4 % au plus) · Calcul de l'indemnité justifié et **accepté par les deux parties** |
| SURSIS | Difficultés exceptionnelles, imprévisibles, non imputables au titulaire · Demande dans les **10 jours** de l'apparition des causes, avant l'expiration du délai contractuel · Nombre de jours justifié |
| PENAL | Pièces justificatives et **accord formel de la PRMP** · Calcul du nombre de jours et du montant des pénalités justifié |
| DR | Motif de résiliation fondé (faute grave, carence, liquidation, intérêt général ; défaut de paiement > 6 mois, ajournement > 3 mois ; force majeure ; garantie de bonne exécution non fournie ; manquement au code d'éthique) · **Mise en demeure motivée** et information préalable du titulaire (résiliation à ses torts) · Indemnité prévue (résiliation aux torts de l'administration) |

> ⚠️ **Backend, 2026-10-08 — B3 livré (tranche M3, V96)** ; contrat : `docs/api-endpoints.md`, § *… tranche M3*. Arbitrages du pilote du
> 08/10 : les **5 points des plans** sont ajoutés ; un point conditionné reste **servi, à examiner**, sans fiche.
> - **Mécanisme proposé, tenu** : `PointsCtrlDto` gagne **`categorie`** et **`forme`** (`CONTRAT_CADRE` | `AUTRE`). En plus : chaque
>   sous-type porte une **grille de base** (DAOR = DAOO + ses points ; DAORI ← DAOR ; MAOOI, MAOOPREQUAL, MAOR ← MAOO ; MAORI ← MAOR) et
>   une **grille propre** (MPI, MGG, DC, RJ, DPREQUAL, DP, AVN, DSS : sans les points communs de la famille — « MPI remplace 33 à 41 »).
> - `GET /api/points-ctrls?sousType=` sert la grille du sous-type (conditions non résolues) ; **nouveau `GET /api/dossiers/{id}/grille`**
>   (conditions résolues par la fiche du dossier) — **à utiliser par l'écran d'examen** : la complétude de l'examen est jugée sur elle.
> - Les points sont **semés au démarrage** (un point existant n'est jamais réécrit) ; libellé court, question du manuel en description
>   (≤ 255 caractères, quelques questions condensées). **Écart** : la « précision du point 3 » (fractionnement) est un point à part,
>   « Fractionnement illicite (base d'appréciation) » ; DAOOI et DAORI reçoivent un point « Publicité internationale » (Q2), MAOOI
>   « Publicité internationale de l'avis ».
> - **Effet** : les examens en cours voient leur grille s'enrichir (plans : +3 points par ligne).

> ✅ **Front, 2026-10-09 — M3 branché (tranche MC2)** :
> - **Examen** : la grille vient de `GET /api/dossiers/{id}/grille` (conditions de la fiche résolues) — celle sur laquelle le serveur juge
>   la complétude ; repli, si la route ne répond pas : `?sousType=`, puis la liste.
> - **Administration des points** : champs « Catégorie (vide = toutes) » et « Forme (vide = toutes) », codes du serveur.

## B4 — Les motifs-types de la conclusion

Le manuel liste, pour chaque type, les **motifs de renvoi** (lettre de demande de compléments) et les **motifs d'avis non
favorable**. Proposé : un référentiel de **motifs-types** par sous-type, que le Membre insère dans son projet de PV ou de lettre de
renvoi (texte modifiable) — par exemple pour MAOO : « délai de remise des offres insuffisant », « PV d'ouverture non valide :
quorum non atteint », « offre partielle », « candidat non qualifié »… ; pour un DAO : « incohérence de l'objet entre l'AGPM et le
DAO : mettre à jour le PPM / AGPM ou modifier le DAO ». Q5 : utile au pilote ?

> ⚠️ **Backend, 2026-10-09 — B4 livré (tranche M4, V97)** ; contrat : `docs/api-endpoints.md`, § *… tranche M4*. Arbitrages du 09/10 :
> référentiel **administrable** (écriture Administrateur), **semé du manuel** (un motif existant n'est jamais réécrit) ; le **front
> insère le texte** (le serveur n'écrit rien dans le PV ni la lettre) ; les motifs **suivent l'héritage des grilles** de B3.
> - Nouveau référentiel **`/api/motifs-types`** (`?sousType=` : motifs actifs avec l'héritage ; `?typeDossier=` : administration, inactifs
>   compris ; `?nature=RENVOI|AVIS_DEFAVORABLE`) et **`GET /api/dossiers/{id}/motifs-types?nature=`** (conditions résolues par la fiche du
>   dossier ; sans fiche, servis) — **à utiliser par l'écran d'examen** : `RENVOI` pour la lettre de renvoi, `AVIS_DEFAVORABLE` pour le PV.
> - `MotifTypeDto` : `libelle` (la liste) et `texte` (ce qui s'insère ; « … » marque l'endroit à préciser), `categorie`, `forme`, `actif`.
> - **Écart** : les plans n'ont pas de motifs au manuel (aucun semé) ; pour un acte de gestion, les motifs communs DGC (2 avis
>   défavorables, 1 renvoi) s'ajoutent à ceux du sous-type, sauf l'avenant (grille propre). Les « principales incohérences » en tableau
>   du manuel ne sont pas reprises comme motifs.

## B5 — Garde-fous du manuel à porter par le serveur

- **Avenant** : refusé après la réception définitive (travaux) / provisoire (fournitures, services) ou le solde, et si
  l'augmentation cumulée dépasse le tiers du prix initial (alerte bloquante à la soumission, la date de réception étant déclarée).
- **DSS** : refusée après la signature du marché ; **avis sous cinq jours** (délai standard propre).
- **Actes de gestion contractuelle** : seulement sur un marché contrôlé a priori par la Commission (dossier DDM au PV favorable).
- **Irrégularité grave** (ch. 1, II) : le Membre peut joindre au dossier un **rapport d'irrégularité**, porté sans délai à la
  connaissance du Président (notification), annexé au dossier de contrôle — Q6.

> ⚠️ **Backend, 2026-10-09 — B5 livré pour l'avenant et les actes de gestion, et dépôt des actes depuis le marché (§B1) : tranche M5a,
> V98** ; contrat : `docs/api-endpoints.md`, § *… tranche M5a*. Arbitrages du 09/10 : M5 en deux sous-tranches (**M5b** : délais, §B6) ;
> montant initial et catégorie **lus** (attribution en ligne, fiche), **sinon déclarés** au dépôt ; cumul = avenants **déjà soumis, hors
> avis défavorable**, en HT.
> - **Dépôt depuis le marché** : `GET` / `POST /api/dossiers/{idMarche}/actes-gestion` (le marché, ses actes, cumul et plafond ; dépôt d'un
>   acte `AVN`, `DR`, `INDEMN`, `PENAL`, `SURSIS` → dossier DGC **en brouillon**, qui suit ensuite le circuit ordinaire) ; `GET` / `PUT
>   /api/actes-gestion/{idDossier}` (l'acte ; ses déclarations, en brouillon). Marché = dossier **DDM au dernier PV signé favorable**
>   (`FAV`, `FAVR`), sinon 409 `MARCHE_NON_CONTROLE`.
> - **Écart** : la saisie libre d'un acte (`POST /api/saisies/dossier` avec `AVN`, `DR`…) est désormais **refusée** (400
>   `ACTE_DEPUIS_LE_MARCHE`) — l'écran « Créer dossier » doit écarter la famille DGC et renvoyer vers le marché.
> - **Avenant** : rang automatique, porté par la référence (`…/AVN2/…`) ; refusé (au dépôt, au `PUT`, à la soumission) après la réception
>   définitive (travaux) ou provisoire (autres catégories) et après le solde, dates **déclarées** par la PRMP (une date à venir ne bloque
>   pas), et au-delà du tiers du montant initial HT (409 `AVENANT_PLAFOND`, `details.cumulHt` / `plafondHt`). Le « ni avance modifiée »
>   du manuel reste un point de la grille (examen), pas un contrôle serveur.
> - **DSS** : le refus après la signature existait déjà (`MARCHE_SIGNE`, tranche 2d-3) ; son délai propre vient avec M5b. **Q6** reste
>   ouverte.

## B6 — Les délais (ch. 1, V)

Le manuel fixe : numérotation le jour même ou le lendemain ; **examen 48 h** ouvrées (hors week-end et jours chômés) à compter de
la réception par l'examinateur, **5 jours ouvrés au plus** ; signature dans les 24 h ; réponse de la Commission sous **72 h**
après la numérotation, sans dépasser 5 jours ouvrables. Proposé : les délais standards (écran « Délais standards ») reçoivent ces
valeurs par défaut, **par sous-type** si le serveur le permet (le manuel dit le délai « différencié selon le type de dossier » —
PPM, DAO, DC, marché, avenant), et l'examen alerte au-delà de 5 jours ouvrés. Q7 : 48 h = 16 heures ouvrées (deux jours de 8 h) ?

> ⚠️ **Backend, 2026-10-09 — B6 livré (tranche M5b, V99)** ; contrat : `docs/api-endpoints.md`, § *… tranche M5b*. Arbitrages du 09/10 :
> **aucune valeur posée d'office** — l'examen garde son réglage (40 heures ouvrées en recette ; les 16 heures de Q7 restent à régler par
> l'Administrateur s'il le souhaite) et la table par sous-type naît vide ; alerte au **Membre, au Chef de commission et au Président**.
> - **Délais par sous-type** : `GET /api/delais-standards/sous-types/{sousType}` (effectif, standard de l'étape, `surcharge`), `PUT` /
>   `DELETE /api/delais-standards/sous-types/{sousType}/{etape}` (Administrateur) — à ajouter à l'écran « Délais standards ». La date
>   annoncée et le délai de l'étape en cours de « À faire » suivent le sous-type.
> - **Alerte** : au-delà de 40 heures ouvrées en examen (5 jours ouvrés), notification `EXAMEN_EN_DEPASSEMENT` (objet : le dossier), une
>   par passage, suivi horaire.
> - **Écart** : les autres valeurs du manuel (numérotation le jour même ou le lendemain, signature sous 24 h, réponse sous 72 h) ne sont
>   pas posées d'office non plus ; elles se règlent sur l'écran existant. La DSS garde son échéance de 5 jours (tranche 2d-3).

## Questions

| # | Question | À qui |
|---|---|---|
| Q1 | Renommer le sous-type `DAO` en `DAOO` (références des dossiers existants comprises), ou garder `DAO` avec le libellé « appel d'offres ouvert » ? | pilote, backend |
| Q2 | Les variantes internationales (DAOOI, DAORI, MAOOI, MAORI) : sous-types propres (le manuel les numérote à part), ou un attribut « international » ? | pilote |
| Q3 | Le projet de marché de gré à gré : code `MGG` (le manuel ne lui en donne pas) ? | pilote |
| Q4 | Les projets de textes (TEXTMP), examinés collégialement : hors périmètre de l'application ? | pilote |
| Q5 | Un référentiel de motifs-types de renvoi et d'avis défavorable, à insérer dans le PV ou la lettre ? | pilote |
| Q6 | Le rapport d'irrégularité grave : dans l'application, ou hors ligne ? | pilote |
| Q7 | Délais : valeurs par défaut du manuel, par sous-type ; 48 h lues comme 16 heures ouvrées ? | pilote |

> ⚠️ **Arbitrages du pilote, 2026-10-08** :
> - **Q1** — le sous-type `DAO` est **renommé `DAOO`**, références des dossiers existants comprises (migration des données : dossiers,
>   points de contrôle, pièces, références imprimées).
> - **Q2** — les variantes internationales sont des **sous-types propres** : `DAOOI`, `DAORI`, `MAOOI`, `MAORI` (et leurs grilles :
>   celles de la variante nationale, la publicité internationale en plus — un journal national et un journal de portée
>   internationale, décret 2019-1310 art. 2.1).
> - **Q3** — le projet de marché de gré à gré prend le code **`MGG`**.
> - **Q4** — les projets de textes (`TEXTMP`) restent **hors de l'application** (examen collégial).
> - **Q5** — **oui** au référentiel de motifs-types (B4), à insérer dans le projet de PV et la lettre de renvoi.
> - **Q7** — **oui** : délais du manuel par défaut, par sous-type ; 48 h = **16 heures ouvrées**.
> - **Q6** (rapport d'irrégularité grave) reste ouverte.

## Ce que le front fera, et quand

- **Dès B1** : les nouveaux sous-types et la famille DGC paraissent d'eux-mêmes dans « Créer dossier » (liste servie) ; un écran de
  dépôt d'**acte de gestion contractuelle** (avenant, résiliation, indemnité, pénalité, sursis) **depuis le marché** (référence et
  rang de l'avenant) ; la déclaration sans suite depuis la procédure ; le rapport justificatif et le marché de gré à gré.
- **Dès B2** : les pièces du dépôt et de la recevabilité lues **par sous-type**.
- **Dès B3** : rien à changer à l'examen (la grille effective est servie) ; l'écran d'administration des points de contrôle reçoit
  les conditions de catégorie et de forme.
- **Dès B4** : l'insertion des motifs-types dans le projet de PV et la lettre de renvoi.
- La présentation « L'application de bout en bout » et la partie « Contrôler » sont mises à jour avec ce référentiel.
