# Fiche DAO Travaux ↔ DAO réel du MEN — correspondance (01/10/2026)

**Document confronté** : `Documents Types/Travaux/ExemplesDAO/daolance.DAO_2026_4SDC_vf.pdf` — Ministère de l'Éducation
nationale, appel d'offres ouvert, **travaux de construction de bâtiments scolaires, deux lots** (lot 1 : EPP SCAMA,
CISCO Antsiranana I ; lot 2 : EPP Isahafa, CISCO Antananarivo Avaradrano), financement PIP, 200 pages imprimées.
**Référentiel** : `GET /api/champs-fiche-marche?typeMarche=QUANTITE_FIXE&categorie=TRAVAUX` — 166 informations, plus les
questions de cadrage. Pages = numéros imprimés en pied de page du DAO.

| marque | sens |
|---|---|
| ✅ | le DAO donne la valeur, reprise telle quelle (clause et page citées) |
| ∅ | le DAO prévoit l'information mais la laisse **en blanc** (pointillés) |
| — | le DAO est **muet** |
| ⚠ | le DAO se **contredit**, ou sa valeur **ne tient pas** dans le champ de la fiche |
| fermé | section fermée par le cadrage (sans objet pour ce DAO) |

## Bilan

| | nombre |
|---|---|
| Informations de la fiche (QF travaux) | 166 |
| Fermées par le cadrage (tranches, groupement, remise électronique, préférence, devises…) | 34 |
| **Valeur trouvée dans le DAO** ✅ | 78 |
| Prévues mais en blanc ∅ | 5 |
| DAO muet — | 22 |
| Contradiction ou valeur qui ne tient pas dans le champ ⚠ (une ligne « ✅ ⚠ » compte ici) | 27 |
| **Informations du DAO sans champ dans la fiche** (§ « Ce que la fiche ne sait pas porter ») | 13 |

Sur les 132 informations ouvertes par ce cadrage, le DAO en renseigne proprement 78 (59 %). Les ⚠ sont le résultat le
plus utile : ils disent où **la fiche ne peut pas reproduire ce DAO** (valeurs par lot, choix multiples, formules) et où
**le DAO lui-même est incohérent** (type de prix, période de préparation, maître d'œuvre, règlement).

## Le cadrage

| question | réponse du DAO | | source |
|---|---|---|---|
| alloti / nbLots | OUI, 2 | ✅ | p.1 ; DPAO 1.1 p.21 |
| tranches | NON | ✅ | DPAO 1.1 « Tranches : Non applicable » p.21 ; CCAP art. 5 p.59 |
| variantes | NON | ✅ | DPAO 1.1 p.21 ; DPAO 9.4 « Variante : Non applicable » p.27 |
| groupement | NON | ✅ | DPAO 2 « Non applicable » p.22 ; CCAP art. 4 p.58 |
| garantieSoumission | OUI | ✅ | DPAO 6.7 p.24 |
| typePrix | FORFAITAIRE **ou** UNITAIRES | ⚠ | AE art. 2 p.40 : « prix global et forfaitaire… découpage en centième par corps d'états » ; CCAP 11.3 p.61 : « traité sur la base des prix unitaires du bordereau » ; CCAP art. 16 p.62 : forfaitaire ; Devis descriptif, préambule 2 p.104 : quantités « à titre provisoire », règlement aux quantités réelles. Par l'ordre de priorité du CCAG (3.1.2 : AE avant CCAP), **FORFAITAIRE** |
| prixRevisable | NON | ✅ | DPAO 6.5.3 p.24 ; CCAP 11.4 p.61 |
| avance / tauxAvance | OUI, 20 % au plus | ✅ | CCAP 14.1 p.61 ; AE 6.2 p.41 (le candidat accepte ou refuse) |
| penalites | régime du CCAG | ⚠ | CCAP art. 23 p.63 renvoie à « l'Article 20.6 du CCAG » — **cet article n'existe pas** (le CCAG s'arrête à 20.5, p.177) ; le régime est donc celui de 20.1 et 20.4 |
| modeRemise | PAPIER | ✅ | DPAO 7.3 p.26 |

## B01 — Identification & données du PPM

Ces informations viennent du plan de passation, pas de la saisie : la colonne dit ce que le DAO en écrit, pour contrôle.

| code | information | valeur du DAO | | source |
|---|---|---|---|---|
| `B01-AC-01` | Autorité contractante | Ministère de l'Éducation Nationale | ✅ | DPAO 1 p.21 ; AE p.38 |
| `B01-AC-02` | Adresse de l'autorité contractante | Porte 203A, 2ème étage, MEN Anosy, Antananarivo 101 | ✅ | DPAO 1 et 5.2 p.21-22 |
| `B01-AC-03` | Ministère de rattachement | Ministère de l'Éducation Nationale | ✅ | p.1 |
| `B01-AC-04` | Commission des marchés compétente | — | — | |
| `B01-AC-05` | PRMP | Madame RASOARIVELO Lalanirina Heriline | ✅ | DPAO 1 p.21 ; AE p.38 ; CCAP 2.3.2 p.58 |
| `B01-AC-06` | Courriel de la PRMP | — | — | DPAO 5.2 donne bureau et code postal, pas de courriel |
| `B01-AC-07` | Téléphone de la PRMP | — | — | |
| `B01-AC-08` | Référence du plan de passation | — | — | |
| `B01-AC-09` | Exercice budgétaire | 2026 | ✅ | n° du DAO, DPAO 6.2 (« carte fiscale de l'année 2026 ») ; ⚠ p.1 écrit « Exercice budgétaire : 00-81-0-110-00000 », qui est l'**imputation** (AE p.38) |
| `B01-AC-10` | Version du plan | — | — | |
| `B01-AC-11` | Référence du dossier de planification | — | — | |
| `B01-AC-12` | Nature du marché | Travaux | ✅ | p.1, p.3 |
| `B01-AC-13` | Mode de passation | Appel d'offres ouvert | ✅ | p.1 ; AE p.38 (« articles 35 et 63 du Code ») |
| `B01-AC-14` | Montant estimatif | — | — | Non écrit. Les seuils sont dans un rapport constant par lot (garantie = 4 %, liquidité = 40 % de la référence technique 247,5 M / 180 M) : la référence technique **pourrait** être l'estimation — hypothèse, à confirmer |
| `B01-AC-15` | Source de financement | PIP | ⚠ | p.1, AE p.38, CCAP p.55 : PIP ; panneau de chantier, Spécifications p.73 : **« RPI »** |
| `B01-AC-16` | Service(s) bénéficiaire(s) | EPP SCAMA (lot 1), EPP Isahafa (lot 2) | ✅ | p.1 |
| `B01-AC-17` | Compte(s) budgétaire(s) | Compte 2432, imputation 00 81 0 110 00000 | ✅ | AE p.38 ; CCAP p.55 |
| `B01-AC-18` | Dates prévisionnelles | — | ∅ | date limite de remise en blanc (DPAO 7.2 p.26) |
| `B01-AC-19` | Forme du marché | Quantité fixe | ✅ | déduit : ni commande ni contrat-cadre ; DQE à quantités fixées |

## B02 — Objet, allotissement & forme du marché

| code | information | valeur du DAO | | source |
|---|---|---|---|---|
| `B02-LT-01` | Description du projet global | Travaux de construction de bâtiments scolaires répartis en deux (02) lots | ✅ | DPAO 1.1 p.21 |
| `B02-LT-02` | Attribution des lots | Divisible (« un ou plusieurs lots ») | ✅ | DPAO 1.1 p.21 — s'y ajoutent « chaque lot est indivisible » et « deux lots au maximum », sans champ |
| `B02-LT-03` à `-07` | Tranches | | fermé | |
| `B02-LV-01` | Nombre de lots | 2 | ✅ | p.1 |
| `B02-LV-02` | Désignation des lots | Lot 01 : bâtiment scolaire à quatre (04) salles, région Diana, CISCO Antsiranana I, EPP SCAMA. Lot 02 : bâtiment scolaire, région Analamanga, CISCO Antananarivo Avaradrano, EPP Isahafa, commune Anosy Avaratra | ✅ | p.1 ; DPAO 1.1 p.21 |
| `B02-LV-03` | Montant par lot | — | — | voir B01-AC-14 |
| `B02-MW-01` | Maître d'œuvre | Ministère de l'Éducation Nationale **ou** Direction du Patrimoine Foncier et des Infrastructures (DPFI) | ⚠ | AE p.38 : MEN ; CCAP 2.2.3 p.58 : DPFI |
| `B02-MW-02` | Lien contractuel MO ↔ maître d'œuvre | — | — | |
| `B02-MW-04` | Maître d'ouvrage délégué | Non applicable | ✅ | CCAP 2.2.2 p.58 |
| `B02-OB-01` | Objet de l'appel d'offres | Travaux de construction de bâtiments scolaires répartis en deux (02) lots | ✅ | p.1 |
| `B02-OB-03` | Numéro du DAO | en blanc, sous **quatre formes différentes** | ∅ ⚠ | p.1 « N° - -DAOO/MEN/PRMP/-Tvx-PI-2026 » ; p.28 « N° -……….-26/MEN/PRMP/-Tvx-PI » ; p.54 « N° -2026 /PRMP/Tvx-PI » ; p.55 « -2026/MEN/PRMP/Tvx-PI » |
| `B02-OT-01` | Projet ou opération plus vaste | Développement de l'éducation fondamentale et de l'enseignement secondaire | ✅ | DPAO 1 « Cadre du projet » p.21 (CCAP 1.1 p.58 : « Éducation pour tous ») |
| `B02-OT-02` | Consistance des travaux | Construction d'un bâtiment scolaire par lot ; détail au DQE (11 corps d'état, 0 à XI) | ✅ | DPAO 1.1 ; Annexe 1 de l'AE p.44-51 |

## B03 — Candidats : groupement, sous-traitance, qualifications

| code | information | valeur du DAO | | source |
|---|---|---|---|---|
| `B03-CQ-01` | Pièces juridiques exigées | Carte d'immatriculation fiscale 2026 < 3 mois (copie certifiée) ; carte statistique « de moins de deux (03) mois » ; certificat de non-faillite < 3 mois (original) ; extrait RCS < 3 mois (original) | ✅ ⚠ | DPAO 6.2 1° p.22 — « deux (03) » incohérent. ⚠ Le texte fixe de **notre** DPAO-T imprime une autre liste (carte professionnelle, État 211 bis, NIF…) : une fiche ne reproduirait pas ces exigences |
| `B03-CQ-09` | Durée des antécédents juridiques | 5 ans | ✅ | formulaire A1-b p.31 (« cinq dernières années ») |
| `B03-CQ-10` | Durée des antécédents financiers | — | — ⚠ | le formulaire **A3 est annoncé** (sommaire p.2 et p.29) **mais absent** du document (p.33 → p.34 : A2 puis A4) |
| `B03-GT-01` à `-05` | Groupement | | fermé | |
| `B03-NT-01` | Comptable assignataire et montant nanti | Trésorerie ministérielle chargée de l'Enseignement ; montant nanti à remplir par le candidat | ✅ | AE art. 4 p.41 |
| `B03-QT-05` | ONG admises | NON (muet) | — | DPAO 6.3 ne le prévoit pas |
| `B03-QT-06` | Qualifications particulières | Personnel : un conducteur de travaux (ingénieur BTP ou équivalent, 3 ans, CV avec photo, diplôme certifié) et un chef de chantier (technicien supérieur BTP, 3 ans) ; référence financière : liquidité ou ligne de crédit d'une banque primaire, datée entre lancement et remise, **99 000 000 Ar (lot 1) / 72 000 000 Ar (lot 2)** | ✅ ⚠ | DPAO 6.3 c-d p.23-24 — montants **par lot**, champ unique |
| `B03-QT-07` | Chiffre d'affaires annuel minimum | — | — | **remplacé** par la liquidité / ligne de crédit (QT-06) |
| `B03-QT-08` | Projet comparable réalisé | Un (01) marché de construction, réhabilitation ou extension de bâtiment, en entrepreneur principal, sur les cinq (05) dernières années, avec certificat de bonne fin ou PV de réception, **≥ 247 500 000 Ar (lot 1) / ≥ 180 000 000 Ar (lot 2)** | ✅ ⚠ | DPAO 6.3 a p.23 — par lot. ⚠ Notre DPAO-T imprime « au cours des **trois (5)** dernières années » : coquille du texte fixe, à corriger chez nous |
| `B03-QT-09` | Matériel : forme de disposition | Propriété (carte grise, facture) ou location (lettre d'engagement) ; minimum : 1 bétonnière ≥ 350 l, 1 camion ou camionnette ≥ 2,5 t, 1 voiture de liaison 4x4, 1 pervibrateur, 1 groupe électrogène ≥ 3 kVA | ✅ | DPAO 6.3 b p.23 |
| `B03-QT-10` | Années d'expérience du directeur des travaux | 3 | ✅ | DPAO 6.3 c p.24 (« conducteur de travaux ») |

## B04 — Dossier, remise & ouverture des offres

| code | information | valeur du DAO | | source |
|---|---|---|---|---|
| `B04-CD-01` | Fiches de renseignements jointes | A1, A2, A3, A4 annoncées ; **A3 absente** | ⚠ | sommaire p.2, p.29 ; formulaires p.30-34 |
| `B04-CD-02` | Modèle de garantie de soumission | C1 et C2 (garantie bancaire, caution personnelle et solidaire) | ✅ | formulaires B1-B2 p.35-36 |
| `B04-CD-03` | Plans joints | Vue en plan, façade principale, façade postérieure, plan de fondation, façades latérales droite et gauche, plan de toiture (bâtiment à 4 salles, 1/100) | ✅ ⚠ | Annexe 1 p.119-126 — un seul jeu de plans pour les deux lots |
| `B04-DS-05` | Prix du dossier (par lot) | — | — | DPAO 6.2 3° exige la « quittance de l'ARMP pour l'achat du DAO » sans en donner le montant |
| `B04-DS-07` à `-11` | Adresse de consultation du dossier | Bureau de la PRMP, porte 203A, 2ème étage, MEN Anosy (nom, bureau, localité) ; pas de fonction distincte ni de courriel | ✅ partiel | DPAO 5.2 p.22 ; 6.9.2 NB p.25 |
| `B04-EQ-01` | Délai d'envoi des demandes d'éclaircissement | 10 jours | ✅ | DPAO 5.2 p.22 |
| `B04-EQ-02` | Délai de réponse de la PRMP | 5 jours | ✅ | DPAO 5.2 p.22 |
| `B04-FP-01` | Nombre de copies | 1 | ✅ | DPAO 7.1 p.26 |
| `B04-FP-02` | Mention et n° du DAO sur les plis | « la référence du présent Appel d'Offres » | ∅ | DPAO 7.1 p.26 — numéro en blanc (B02-OB-03) |
| `B04-FP-03` | N° du lot sur les plis | « le numéro de lot auquel se rapporte l'offre » | ✅ | DPAO 7.1 p.26 |
| `B04-LG-01` | Langue si autre que le français | — (français) | — | IC 6.8 p.10 |
| `B04-LG-02` | Traduction exigée | traduction des passages pertinents, qui fait foi | ✅ | IC 6.8 p.10 |
| `B04-OV-01` | Lieu d'ouverture des plis | Bureau de la PRMP, 2ème étage, porte 203A, MEN Anosy, Antananarivo | ✅ | DPAO 8 p.26 |
| `B04-OV-02` | Date et heure limites de remise | « ……………..…2026 / Heure : à...........heures 30 minutes » | ∅ | DPAO 7.2 p.26 ; heure d'ouverture aussi en blanc (DPAO 8) |
| `B04-PI-01` | Pièces constitutives de l'offre | 1° pièces administratives (CQ-01) ; 2° garantie de soumission ; 3° liste du personnel, liste du matériel avec justificatifs, planning d'exécution, quittance ARMP, attestation de visite ; 4° méthodologie d'exécution | ✅ | DPAO 6.2 p.22-23 |
| `B04-RP-01` | Réunion préparatoire prévue | NON | ✅ | DPAO 6.9.1 p.25 |
| `B04-RP-02` | Lieu, date, heure de la réunion | | fermé | |
| `B04-SE-01` | Mode de remise | Papier | ✅ | DPAO 7.3 p.26 |
| `B04-SE-02` à `-17` | Remise électronique | | fermé | |
| `B04-VL-01` | Modalités de visite des lieux | À partir du 15ème jour du lancement ; lot 1 CISCO Antsiranana, lot 2 CISCO Antananarivo Avaradrano ; attestation visée par le Chef CISCO, d'établissement ou ZAP, à joindre avec 2 photos du site ; canevas à retirer au bureau de la PRMP | ✅ | DPAO 6.9.2 p.25 |
| `B04-VL-02` | Visite obligatoire | OUI | ✅ | DPAO 6.9.2 p.25 |
| `B04-VO-01` | Délai de validité des offres | 120 jours | ✅ | DPAO 6.4 p.24 (garanties B1/B2 : 150e jour, p.35-36, cohérent) |

## B05 — Prix, montants & garantie de soumission

| code | information | valeur du DAO | | source |
|---|---|---|---|---|
| `B05-AG-01` | Autres garanties | Non applicable | ✅ | CCAP 7.4 p.60 |
| `B05-GA-01` | Garantie de restitution d'avance | OUI | ✅ | CCAP 7.3 p.59 ; 14.1 p.61 |
| `B05-GE-01` | Garantie de bonne exécution requise | OUI **et** « non utilisé » | ⚠ | CCAP 7.1 p.59 : 2 % ; CCAP p.56 : modèles de bonne exécution « (non utilisé) » ; CCAG 4.1.1 p.152 : obligatoire au-delà de six mois seulement (ici 120 j) |
| `B05-GE-02` | Part en devises | | fermé | Ariary seul |
| `B05-GE-03` | Formes admises (bonne exécution) | chèque de banque au Receveur général, caution personnelle et solidaire, **et** garantie bancaire | ⚠ | CCAP 7.1 p.59 — **trois formes admises ensemble, le champ est une liste à choix unique** |
| `B05-GE-04` | Libération | à 100 % dans les 30 jours du PV de réception **provisoire** | ⚠ | CCAP 7.1 p.59 — aucune des deux options du référentiel (« 50 % puis… », « 100 % à la réception définitive ») |
| `B05-GE-05` | Taux | 2 % | ✅ | CCAP 7.1 p.59 |
| `B05-GQ-01` | Garantie de soumission exigée | OUI | ✅ | DPAO 6.7 p.24 |
| `B05-GQ-02` | Formes admises (soumission) | garantie bancaire, caution personnelle et solidaire, **et** chèque de banque au nom du Receveur général d'Antananarivo (quittance à joindre) | ⚠ | DPAO 6.7 p.24 — **trois formes, liste à choix unique** ; nos sections GARANTIE-BANCAIRE / -CAUTION / -CHEQUE sont exclusives l'une de l'autre |
| `B05-GQ-03` | Montant | **9 900 000 Ar (lot 1) / 7 200 000 Ar (lot 2)** | ⚠ | DPAO 6.7 p.24 — **par lot**, le champ n'est pas `parLot` |
| `B05-MN-01` | Monnaie | Ariary | ✅ | AE art. 2 p.40 ; CCAP 12.2 p.61 |
| `B05-PT-01` | Type de prix | voir le cadrage | ⚠ | |
| `B05-RG-01` | Retenue de garantie | OUI | ✅ | CCAP 7.2 p.59 ; art. 16 p.62 |
| `B05-RG-02` | Taux | 3 % (libérée à 100 % 30 jours après la réception définitive) | ✅ | CCAP 7.2 p.59 |
| `B05-VR-01` | Ferme ou révisable | Ferme | ✅ | DPAO 6.5.3 p.24 |

## B06 — Évaluation, attribution & notification

| code | information | valeur du DAO | | source |
|---|---|---|---|---|
| `B06-EV-01` | Évaluation sur plusieurs lots | « évaluées sur la Totalité des Travaux » et « le Marché portera sur le ou les lots attribués… pour le ou les lots considérés » | ⚠ | DPAO 9.4.3 p.27 — mêle les deux options « Par lot » / « Sur l'ensemble des lots » ; le sens de l'attribution penche pour **Par lot** |
| `B06-PN-01` | Préférence nationale | NON | ✅ | DPAO 9.5 p.27 |
| `B06-PN-02` | Taux de préférence | | fermé | |
| `B06-RC-01` | Délai de réponse aux demandes de la PRMP | 5 jours | ✅ | DPAO 9.1 p.26 |

## B08 — Paiements, avances & garanties financières

| code | information | valeur du DAO | | source |
|---|---|---|---|---|
| `B08-AF-01` | Avance forfaitaire | OUI | ✅ | CCAP 14.1 p.61 |
| `B08-AF-02` | Montant de l'avance | — | — | 20 % au plus du montant du marché |
| `B08-AF-03` | Pourcentage du montant total | 20 % (au maximum) | ✅ | CCAP 14.1 p.61 |
| `B08-AF-04` / `-05` | Part en monnaie nationale / devises | — (tout en Ariary) | — | |
| `B08-AP-01` | Acomptes sur approvisionnements | NON | ✅ | CCAP art. 13 p.61 |
| `B08-AP-02` | Décomptes d'approvisionnement | | fermé | |
| `B08-EF-01` | Délai de l'estimation des engagements financiers (jours) | « à la demande de ce dernier » | ⚠ | CCAP art. 3 p.58 — pas un nombre |
| `B08-MO-01` | Taux des intérêts moratoires | taux directeur de la BCM + 1 point | ⚠ | CCAP art. 15 p.62 — une formule, le champ attend un pourcentage |
| `B08-MR-01` | Règlement en une fois | OUI **et** décompte mensuel | ⚠ | CCAP art. 16 p.62 « en une seule fois » ; CCAP 12.1 p.61 « Le décompte est mensuel » ; le CCAG 11.1 p.161 ne permet le règlement unique qu'en dessous de **trois mois** (ici 120 jours) |
| `B08-RE-01` | Modalités de règlement | prix forfaitaire réglé par corps d'état terminé, en centièmes, retenue 3 % | ∅ | CCAP art. 16 p.62 — **pourcentages par corps d'état en blanc** ; la liste (0 à X) ne suit pas les corps d'état du DQE (0 à XI) |
| `B08-RE-02` | Travaux en régie | NON | ✅ | CCAP 12.2 p.61 |
| `B08-RE-03` | Conditions des travaux en régie | | fermé | |

## B09 — Exécution du marché & livraison

| code | information | valeur du DAO | | source |
|---|---|---|---|---|
| `B09-AC-01` | Assurance installations et engins | « tous risques chantier » (ouvrages et biens du MO) | ✅ | CCAP art. 8 c p.60 |
| `B09-AC-02` | Responsabilité civile | RC tiers, illimitée pour les dommages corporels ; minimum par sinistre 500 000 Ar (corporels, sans franchise), 1 000 000 Ar (matériels et immatériels), franchise ≤ 500 000 Ar | ✅ ⚠ | CCAP art. 8 a p.60 — « illimitée » et « minimum 500 000 Ar » côte à côte |
| `B09-AC-03` | Responsabilité décennale | souscrite avant le commencement des travaux | ✅ | CCAP art. 8 d p.60 |
| `B09-BT-01` | Travaux de bâtiment (CPC, TBM, décennale) | OUI | ✅ | CCAP art. 6 i p.59 (arrêtés 738/1961, 3635 et 3634/1964) |
| `B09-CH-01` | Établissement existant et en activité | travaux en milieu occupé, maintien de l'activité des services, protection des personnes et des ouvrages | ✅ | CCAP 11.1 p.61 |
| `B09-CH-02` | Délai impératif | — | — | |
| `B09-CH-03` | Contrainte d'horaire | travail possible hors heures normales, en plusieurs postes, pour tenir les délais | ✅ | CCAP 11.1 p.61 |
| `B09-CH-04` | Clés en main | — | — | |
| `B09-CH-05` | Prestations fournies par le MO | — | — | CCAP art. 25 « Non applicable » |
| `B09-DC-01` | Documents contractuels | d) plans, note de calcul ; e) non applicable ; f) DQE ; i) CPC et TBM ; j) liste du personnel et CV, liste du matériel, planning, norme décret 2019-1957 | ✅ ⚠ | CCAP art. 6 p.59 — lettres a, b, c, g, h absentes (AE, CCAP, spécifications, bordereau, CCAG) |
| `B09-DL-01` | Délai d'exécution | 120 jours au plus par lot, à compter du lendemain de la notification de l'OS de commencer | ✅ ⚠ | DPAO 11 p.27 — par lot (égaux ici) ; AE 5.2 p.41 et CCAP art. 21 p.63 laissés en blanc pour le candidat |
| `B09-DL-04` | Date de réception de l'ouvrage | — | — | |
| `B09-DL-05` | Délais non cumulables | OUI | ✅ | DPAO 11 p.27 |
| `B09-DT-01` | Point de départ du marché | À la notification de l'approbation à l'entrepreneur | ✅ | AE 5.1 p.41 |
| `B09-FM-01` | Force majeure retenue | OUI | ✅ | CCAP art. 20 p.63 |
| `B09-FM-02` | Seuils de force majeure | vent > 120 km/h ; pluie > 14 mm plus de 14 jours sur 30 jours consécutifs, moyenne de ces pluies > 20 mm | ✅ | CCAP art. 20 p.63 |
| `B09-GT-01` | Délai de garantie | 12 mois | ✅ | CCAP art. 29 p.64 |
| `B09-MA-01` | Augmentation dans la masse | 20 % sans avenant | ✅ | CCAP art. 17 p.62 |
| `B09-MA-02` | Diminution sans indemnité | 20 % | ✅ | CCAP art. 18 p.62 (dérogation au CCAG 16, déclarée art. 31) |
| `B09-MA-03` | Diminution ouvrant droit à indemnité | au-delà de 20 % | ✅ | CCAP art. 18 p.62 |
| `B09-MA-04` | Changement des natures d'ouvrage | 30 % | ✅ | CCAP art. 19 p.62 |
| `B09-MD-01` | Prolongation ou report du délai | par la PRMP, sans avenant, 20 jours cumulés au plus | ✅ | CCAP art. 22 p.63 |
| `B09-MD-02` | Journées d'intempéries prévisibles | 5 | ✅ | CCAP art. 22 p.63 |
| `B09-NE-01` | Notifications à l'entrepreneur | à défaut de domicile élu : « La Mairie de ………… » | ∅ | CCAP art. 2 p.58 |
| `B09-OD-01` | Discrétion et sécurité | NON | ✅ | CCAP art. 9 p.60 |
| `B09-OD-02` / `-03` | Mesures de sécurité | | fermé | |
| `B09-PE-02` | Taux des pénalités | 1/2000e par jour (CCAG 20.1), plafond 20 % (CCAG 20.4) | ⚠ | CCAP art. 23 p.63 renvoie à un article 20.6 inexistant |
| `B09-PM-01` | Matériaux fournis par le MO | Non applicable | ✅ | CCAP art. 25 p.63 |
| `B09-PR-01` | Régime des pénalités | voir le cadrage | ⚠ | |
| `B09-PT-01` | Période de préparation prévue | OUI **et** NON | ⚠ | AE 5.2 p.41 : « comprise dans le délai d'exécution » ; CCAP art. 26 p.64 : « Il n'est pas prévu de période de préparation » |
| `B09-PT-02` | Durée de la période de préparation | — | — | |
| `B09-PT-03` | Délai du programme d'exécution | 7 jours après l'OS de commencer | ✅ | Spécifications 3.2.3 p.84 |
| `B09-PT-04` | Plan d'hygiène et de sécurité | remis 2 jours après le démarrage ; en outre PAQ, ITP, plan HSE, PGE en trois exemplaires | ✅ | CCAP art. 26 p.64 ; Spécifications 3.2.3 p.85 |
| `B09-PV-01` | Contrôle des prix de revient | NON | ✅ | CCAP art. 10 p.61 |
| `B09-PV-02` | Éléments contrôlés | | fermé | |
| `B09-RP-01` | Réception par tranches | | fermé | CCAP 28.1 « Non applicable » |
| `B09-RP-03` | Début des opérations préalables | 20 jours après l'avis de l'entrepreneur | ✅ | CCAP 28.2 a p.64 |
| `B09-RP-04` | Modalités de réception | commission désignée par décision du MO, vaut réception provisoire ; définitive dans la même forme à l'issue du délai de garantie | ✅ | CCAP 28.2 b p.64 |
| `B09-VQ-01` | Vérification qualitative des matériaux | exécutée par le maître d'œuvre | ✅ | CCAP art. 24 p.63 |
| `B09-VX-01` | Délai de visa des documents d'exécution | 3 jours **ou** 7 jours | ⚠ | CCAP art. 27 p.64 : trois (03) jours ; Spécifications 3.2.3 p.84 et 3.2.5 p.88 : sept (07) jours |

## B10 — Modifications, résiliation & litiges

| code | information | valeur du DAO | | source |
|---|---|---|---|---|
| `B10-DR-01` | Dérogations aux documents généraux | CCAG art. 16 ↔ CCAP art. 18 | ✅ ⚠ | CCAP art. 31 p.66 — incomplet : CCAP 28.2 a déroge aussi « par dérogation au CCAG » (art. 41.3), et l'art. 16 (règlement unique) s'écarte du CCAG 11.1 |
| `B10-PC-01` | Procédure contentieuse | — | — | le CCAP n'en dit rien ; CCAG art. 50 p.199-200 s'applique |

## Ce que la fiche ne sait pas porter

Informations écrites dans ce DAO pour lesquelles le référentiel QF travaux n'a **aucun champ** :

| # | information du DAO | source | piste |
|---|---|---|---|
| 1 | **Offres anormalement basses ou hautes** : moyenne (estimation + offres conformes) ; haute si > moyenne + 20 % ; seconde moyenne ; basse si < seconde moyenne − 10 % | DPAO 9.4.5 p.27 | champ neuf (texte ou deux pourcentages) |
| 2 | **Liquidité / ligne de crédit minimale par lot** | DPAO 6.3 d p.24 | champ neuf, `parLot` |
| 3 | **Personnel clé exigé** (fonctions, diplômes, années, CV, diplôme certifié) | DPAO 6.3 c p.24 | aujourd'hui noyé dans QT-06 |
| 4 | **Nombre maximum de lots par candidat** (2) — existe en fournitures (`B02-AU-07`), pas en travaux | DPAO 1.1 p.21 | ouvrir B02-AU-07 aux travaux |
| 5 | « Chaque lot est indivisible et toute offre partielle est irrecevable » | DPAO 1.1 p.21 | |
| 6 | **Valeurs par lot** : garantie de soumission, référence technique, liquidité, délai | DPAO 6.3, 6.7, 11 | `parLot` sur B05-GQ-03, B03-QT-08, B09-DL-01 |
| 7 | **Plusieurs formes admises** pour une même garantie (soumission, bonne exécution) | DPAO 6.7 ; CCAP 7.1 | B05-GQ-02 et B05-GE-03 en `LISTE_MULTIPLE` |
| 8 | Quittance de la déclaration de recette (garantie par chèque) | DPAO 6.7 p.24 | |
| 9 | Attestation de visite : visa du Chef CISCO / établissement / ZAP, deux photos, canevas chez la PRMP | DPAO 6.9.2 p.25 | B04-VL-01 (texte) le porte à peine |
| 10 | Méthodologie d'exécution et planning exigés dans l'offre | DPAO 6.2 3°-4° p.23 | dans B04-PI-01 (texte) |
| 11 | **Géoréférencement GPS** des ouvrages avant réception provisoire (précision 5 m, report sur Google Earth) | CCAP 28.2 a p.64 | |
| 12 | Panneau de chantier (4 m × 3,20 m, mentions imposées) et plaque inaugurale en marbre (60 × 40 × 3 cm, fond noir granite, gravure dorée) | Spécifications p.73 ; Devis 0.2 p.107 | spécifications : pièce jointe |
| 13 | Imputation budgétaire (`00 81 0 110 00000`) distincte du compte (2432) | AE p.38 | `B01-AC-17` (repris du plan) porte les deux ; `B02-MW-03` a été retiré le 29/09 comme doublon — rien à faire |
| 14 | **DQE par lot** (quantités, 11 corps d'état) | Annexe 1 de l'AE p.44-51 | pièce jointe au dossier (pas de bloc BESOIN pour les travaux) |

## Incohérences du DAO lui-même

À l'usage de la Commission. Elles ne viennent pas de la fiche.

1. **Type de prix** : forfaitaire (AE art. 2, CCAP art. 16) contre prix unitaires (CCAP 11.3, Devis préambule 2).
2. **DQE du lot 2 identique à celui du lot 1**, jusqu'au total « RÉFÉRENCE 04 SALLES » (p.48-50), alors que l'objet du
   lot 2 ne parle pas de quatre salles et que ses seuils sont plus bas (180 M contre 247,5 M).
3. **Récapitulation générale** (p.47, p.51) : corps d'état XII Plomberie, XIII Clôture, XIV Aménagement extérieur,
   **absents du DQE**. Le Devis descriptif (p.107-118) décrit une cantine, une bibliothèque, une infirmerie, une fosse
   septique, une clôture, un portail et cite « l'Association Fert » : il a été repris d'un autre projet.
4. **Couverture** : tôles de 63/100 (Spécifications 2.2.20 et 2.9.3.2) contre 50/100 (DQE 5.9, Devis 5.5).
5. **Maître d'œuvre** : MEN (AE) contre DPFI (CCAP 2.2.3).
6. **Période de préparation** : comprise (AE 5.2) contre non prévue (CCAP art. 26).
7. **Garantie de bonne exécution** : exigée à 2 % (CCAP 7.1), modèles marqués « non utilisé » (p.56), et déclaration
   de recette à joindre « dans l'offre » alors que la garantie se constitue après notification.
8. **Règlement unique** (CCAP art. 16) incompatible avec un délai de 120 jours (CCAG 11.1) et contredit par le
   décompte mensuel (CCAP 12.1).
9. **Pénalités** : renvoi au CCAG 20.6, qui n'existe pas.
10. **Délai de visa** : 3 jours (CCAP art. 27) contre 7 jours (Spécifications 3.2.3 et 3.2.5).
11. **Formulaire A3** annoncé, absent ; formulaire B1 renvoie à la clause 6.7 pour la correction des erreurs de calcul
    (c'est 9.3).
12. **Pièces** : « carte statistique datée de moins de deux (03) mois ».
13. **Financement** : PIP partout, « RPI » sur le panneau de chantier.
14. **Numéro du DAO** en blanc, sous quatre formes ; date et heure limites en blanc ; « La Mairie de ………… » en blanc.
15. **Références** : CCAP art. 30 cite la loi 2004-009 (ancien Code) et le décret 2006-347 (IC 9.4.5) ; l'AE cite
    l'article 21 du Code, les IC l'article 9 pour les mêmes exclusions.
16. **Pagination** : 129 → 142.

## Ce qu'il faudrait changer chez nous

Cette comparaison fait aussi apparaître trois défauts de **notre** côté :

- **DPAO-T, texte fixe 6.3 b** : « au cours des **trois (5)** dernières années ». Coquille du document type ARMP, et
  durée que l'acheteur adapte. ✅ 01/10 : devient `{{B03-QT-12.lettres}} ({{B03-QT-12}})`, comme au 4° de la clause 6.3.
- **DPAO-T, texte fixe 6.2 2°** : une liste de pièces administratives imprimée d'office (carte professionnelle, État
  211 bis, NIF…). Une autorité qui exige autre chose, comme le MEN, ne peut pas la remplacer. ✅ 01/10 : c'est
  désormais `{{B03-CQ-01}}`, dont la liste du document type devient la valeur par défaut.
- ✅ 01/10, trouvé en chemin : « y compris au moins < par exemple >ans d'expérience en tant que directeur » s'imprimait
  tel quel (6.3 d). L'exemple est retiré.
- **Valeurs par lot et formes multiples** (§ ci-dessus, lignes 6 et 7) : sans elles, la fiche ne peut pas produire un
  DAO multi-lots comme celui-ci. → `docs/demande-backend-2026-10-01-dao-travaux-men.md`.
