# Jeu de données MEN travaux – faits tirés du dossier réel

Source : `Documents Types/Travaux/ExemplesDAO/daolance.DAO_2026_4SDC_vf.pdf` (200 pages imprimées ; pagination
imprimée en pied de page, qui saute de 129 à 142). Premier DAO de **travaux** réel, écrit par une autre autorité que la
nôtre (fourni le 01/10/2026). Comparaison champ par champ avec la fiche :
`docs/correspondance-2026-10-01-fiche-dao-travaux-vs-dao-men.md`.

Trois natures, comme pour le 2463 (`docs/jeu-donnees-2463-faits.md`) :
  [R] repris tel quel du dossier
  [D] déduit d'une valeur du dossier, calcul indiqué
  [H] hypothèse : le dossier est muet ou en blanc ; valeur choisie pour le jeu,
      à ne jamais présenter comme venant du dossier

Règle : une valeur [H] ne remplace jamais une valeur [R]. Si une valeur manque ci-dessous, on l'ajoute ici en [H]
avant de l'utiliser, on ne l'invente pas dans le code. Ce jeu est la **source unique** pour toute démonstration, recette
ou banc qui rejoue ce DAO.

## 1. Autorité contractante et acteurs
- Autorité contractante : Ministère de l'Éducation Nationale (MEN)     [R] p.1, DPAO 1 p.21
- Unité : Unité de Gestion et de la Passation des Marchés (UGPM)         [R] p.1
- PRMP : Madame RASOARIVELO Lalanirina Heriline                         [R] DPAO 1 p.21, AE p.38, CCAP p.58
- Adresse : Porte 203A, 2ème étage, MEN Anosy, Antananarivo 101          [R] DPAO 1, 5.2, 7.2 p.21-26
- Courriel, téléphone de la PRMP : non donnés                            → §10
- Maître d'œuvre : MEN selon l'AE, DPFI selon le CCAP                    [R] AE p.38 ; CCAP 2.2.3 p.58 — §9
- Maître d'ouvrage délégué : non applicable                              [R] CCAP 2.2.2 p.58
- Comptable assignataire : Trésorerie Ministérielle Chargée de l'Enseignement   [R] AE art. 4 p.41

## 2. Identification du marché
- Référence DAO : en blanc, « N° - -DAOO/MEN/PRMP/-Tvx-PI-2026 »          [R] p.1 (trois autres formes : §9) → §10
- Mode : appel d'offres ouvert (articles 35 et 63 du Code)               [R] p.1, AE p.38
- Nature : travaux ; forme : quantité fixe                               [R] p.3 ; [D] ni commande ni contrat-cadre
- Objet : « TRAVAUX DE CONSTRUCTION DE BATIMENTS SCOLAIRES REPARTIS EN DEUX (02) LOTS »   [R] p.1
- Cadre du projet : « développement de l'éducation fondamentale et de l'enseignement secondaire »   [R] DPAO 1 p.21
- Financement : PIP ; compte 2432 ; imputation 00 81 0 110 00000         [R] AE p.38, CCAP p.55
- Exercice : 2026                                                        [D] n° du DAO, DPAO 6.2 (carte fiscale 2026)

## 3. Lots
| lot | désignation | lieu de visite | [R] |
|---|---|---|---|
| 1 | Travaux de construction d'un bâtiment scolaire à quatre (04) salles dans la région Diana, CISCO Antsiranana I, EPP SCAMA | CISCO Antsiranana | p.1, DPAO 1.1 p.21, 6.9.2 p.25 |
| 2 | Travaux de construction d'un bâtiment scolaire dans la région Analamanga, CISCO Antananarivo Avaradrano, EPP Isahafa, commune Anosy Avaratra | CISCO Antananarivo Avaradrano | idem |

- Attribution : « un ou plusieurs lots », deux au maximum ; chaque lot indivisible, offre partielle irrecevable   [R] DPAO 1.1 p.21
- Variantes : non ; tranches : non ; groupement : non                    [R] DPAO 1.1, 2 p.21-22
- Évaluation : « sur la Totalité des Travaux », attribution « pour le ou les lots considérés »   [R] DPAO 9.4.3 p.27 → [D] par lot
- Délais non cumulables                                                  [R] DPAO 11 p.27

### DQE (annexe 1 de l'AE, p.44-46 ; **identique au lot 2**, p.48-50 — §9)
Prix global et forfaitaire, quantités [R] ; prix en blanc (à remplir par le candidat).

| n° | désignation | unité | quantité |
|---|---|---|---|
| 0.1 | Installation de chantier | fft | 1 |
| 0.2 | Repli de chantier et fourniture de plaque inaugurale | fft | 1 |
| 1.1 | Débroussaillage et décapage des terres végétales | m² | 332,18 |
| 1.2 | Fouille en rigole ou en tranchée, réglage du nivellement | m³ | 48,86 |
| 1.3 | Remblai de terre en provenance de déblai | m³ | 46,36 |
| 2.1 | Béton de propreté 150 kg/m³ | m³ | 5,18 |
| 2.2 | Béton armé 350 kg/m³ avec adjuvant (infrastructure) | m³ | 15,16 |
| 2.3 | Coffrage en bois ordinaire (infrastructure) | m² | 181,97 |
| 2.4 | Armatures (infrastructure) | kg | 1 516,44 |
| 2.5 | Hérissonnage en pierres sèches (ép. 0,15 m) | m³ | 41,72 |
| 2.6 | Maçonnerie de moellons 300 kg/m³ | m³ | 44,59 |
| 2.7 | Béton de forme 250 kg/m³ (ép. 0,08 m) | m³ | 28,28 |
| 3.1 | Béton armé 350 kg/m³ avec adjuvant (superstructure) | m³ | 17,65 |
| 3.2 | Coffrage en bois ordinaire (superstructure) | m² | 211,77 |
| 3.3 | Armatures (superstructure) | kg | 1 764,72 |
| 4.1 | Maçonnerie de parpaing ép. 20 cm | m² | 296,16 |
| 4.2 | Maçonnerie de parpaing ép. 10 cm | m² | 37,50 |
| 4.3 | Enduit intérieur 350 kg/m³ | m² | 419,91 |
| 4.4 | Enduit extérieur 350 kg/m³ | m² | 324,88 |
| 4.5 | Chape 400 kg/m³ | m² | 306,68 |
| 4.6 | Carreaux grès cérame | m² | 255,68 |
| 5.1 | Étanchéité bicouche autoprotégée | m² | 98,40 |
| 5.2 | DEP en PVC Φ100 | ml | 34,00 |
| 5.5 | Pannes C 120x50x20 acier galvanisé | ml | 472,00 |
| 5.6 | Échantignoles métalliques | U | 48 |
| 5.7 | Liernes en tige filetée galvanisée 10 mm | U | 495 |
| 5.8 | Cornières CAE 50*5 | ml | 72,00 |
| 5.9 | Tôles nervurées prélaquées 50/100 | m² | 334,74 |
| 5.10 | Faîtières TPG 50/100, développement 50 cm | ml | 41,00 |
| 5.11 | Plafond en volige de pin 8 cm | m² | 255,56 |
| 5.12 | Charpente non assemblée pour plafond | m³ | 4,73 |
| 5.13 | Solin TPG 50/100 | ml | 17,53 |
| 5.14 | Fermes métalliques en fer cornière | kg | 1 004,73 |
| 6.1 | Grille anti-effraction | m² | 48,84 |
| 6.2 | Main courante | ml | 7,60 |
| 6.3 | Écriteau EPP | fft | 1 |
| 7.1 | Fenêtre 200/150 | U | 16 |
| 7.2 | Portes 100/210 | U | 5 |
| 7.3 | Imposte 60/150 | U | 1 |
| 7.4 | Fenêtre 110/150 | U | 1 |
| 8.1 | Placard encastré | U | 4 |
| 8.2 | Porte-craie | U | 4 |
| 9.1 | Regard 60 x 60 | U | 10 |
| 9.2 | Raccordement regard en buse Φ100 | fft | 1 |
| 10.1 | Peinture ardoisée | m² | 26,40 |
| 10.2 | Peinture acrylique en phase aqueuse, deux couches | m² | 419,91 |
| 10.3 | Peinture hydrofuge en phase aqueuse, deux couches | m² | 324,88 |
| 10.4 | Peinture glycéro en phase solvant | m² | 304,40 |
| 10.5 | Peinture spéciale sol | m² | 59,30 |
| 10.6 | Peinture d'éveil | fft | 1 |
| 11.1 | Tableau à interrupteur différentiel modulaire | U | 1 |
| 11.2 | Gaine ICT-A encastrable | fft | 1 |
| 11.3 | Câblage | fft | 1 |
| 11.4 | Tube fluo 120 | U | 16 |
| 11.5 | Hublot plafonnier | U | 10 |
| 11.6 | Prise 2P+T | U | 10 |
| 11.7 | Interrupteur | U | 10 |

## 4. Qualifications (DPAO 6.2-6.3 p.22-24)
- Pièces administratives : carte d'immatriculation fiscale 2026 de moins de 3 mois (copie certifiée) ; carte
  statistique « de moins de deux (03) mois » (copie certifiée) ; certificat de non-faillite de moins de 3 mois
  (original) ; extrait du RCS de moins de 3 mois (original)                    [R] DPAO 6.2 1°
- Autres pièces de l'offre : garantie de soumission ; liste du personnel ; liste du matériel avec justificatifs (carte
  grise, acte de vente, contrat de location) ; planning d'exécution ; quittance de l'ARMP pour l'achat du DAO ;
  attestation de visite ; méthodologie d'exécution                             [R] DPAO 6.2 2°-4°
- Fiches : identification et situation juridique ; capacités techniques ; marchés similaires sur les cinq dernières
  années avec certificat de bonne fin ou PV de réception                      [R] DPAO 6.3
- Référence technique : un (01) marché de construction, réhabilitation ou extension de bâtiment, en entrepreneur
  principal, sur les cinq (05) dernières années, certifié par l'Administration, d'au moins
  **247 500 000 Ar (lot 1) / 180 000 000 Ar (lot 2)**                       [R] DPAO 6.3 a p.23
- Période de référence : 5 ans                                                [R] DPAO 6.3 4° et a
- Matériel minimum (propriété ou location justifiée) : 1 bétonnière ≥ 350 l ; 1 camion ou camionnette ≥ 2,5 t ;
  1 voiture de liaison 4x4 ; 1 pervibrateur ; 1 groupe électrogène ≥ 3 kVA   [R] DPAO 6.3 b p.23
- Personnel par lot : 1 conducteur de travaux (diplôme d'ingénieur BTP ou équivalent — génie civil, industriel,
  rural, architecture —, 3 ans d'expérience, CV avec photo, diplôme certifié) ; 1 chef de chantier (technicien supérieur
  BTP ou équivalent, 3 ans, mêmes justificatifs)                               [R] DPAO 6.3 c p.24
- Référence financière : liquidité ou ligne de crédit d'une banque primaire, datée entre le lancement et la remise,
  d'au moins **99 000 000 Ar (lot 1) / 72 000 000 Ar (lot 2)**               [R] DPAO 6.3 d p.24
- Préférence nationale : non                                                  [R] DPAO 9.5 p.27
- ONG et communautés locales : non prévues                                    [D] DPAO 6.3 muet

## 5. Garanties et montants
- Garantie de soumission : **9 900 000 Ar (lot 1) / 7 200 000 Ar (lot 2)**    [R] DPAO 6.7 p.24
- Formes admises (soumission) : garantie bancaire, caution personnelle et solidaire, chèque de banque au nom du
  Receveur général d'Antananarivo (quittance de déclaration de recette à joindre)   [R] DPAO 6.7 p.24
- Validité des garanties de soumission : 150e jour après la date limite        [R] B1/B2 p.35-36
- Garantie de bonne exécution : 2 % ; chèque de banque, caution, garantie bancaire ; libérée à 100 % 30 jours après
  la réception provisoire                                                      [R] CCAP 7.1 p.59 (modèles « non utilisé » : §9)
- Retenue de garantie : 3 %, libérée à 100 % 30 jours après la réception définitive   [R] CCAP 7.2 p.59
- Avance forfaitaire : 20 % au plus, garantie de restitution (caution, garantie bancaire ou chèque)   [R] CCAP 14.1 p.61
- Autres garanties : non applicable                                           [R] CCAP 7.4 p.60
- Montant estimatif : non écrit                                               → §10
- Ratios constants entre lots : garantie = 4 %, liquidité = 40 % de la référence technique   [D] 9,9/247,5 = 7,2/180 = 0,04 ; 99/247,5 = 72/180 = 0,40

## 6. Consultation (DPAO p.21-27)
- Éclaircissements : demandes au plus tard 10 jours avant la date limite ; réponse 5 jours avant   [R] DPAO 5.2 p.22
- Validité des offres : 120 jours                                             [R] DPAO 6.4 p.24
- Prix : fermes et non révisables ; en Ariary                                 [R] DPAO 6.5.3 ; AE art. 2
- Type de prix : global et forfaitaire                                        [R] AE art. 2 p.40 (contredit : §9)
- Réunion préparatoire : aucune                                               [R] DPAO 6.9.1 p.25
- Visite des lieux : obligatoire, à partir du 15e jour du lancement ; attestation visée par le Chef CISCO, le chef
  d'établissement ou le chef ZAP, avec deux photos du site ; canevas à retirer chez la PRMP   [R] DPAO 6.9.2 p.25
- Plis : un pli par lot ; original + une (01) copie ; référence de l'AO, n° du lot, « NE PAS OUVRIR… » ; enveloppes
  intérieures cachetées à la cire                                             [R] DPAO 7.1 p.26
- Remise : papier, bureau de la PRMP ; date en blanc, « à ……heures 30 minutes »   [R] DPAO 7.2-7.3 p.26 → §10
- Ouverture : bureau de la PRMP, porte 203A, MEN Anosy, le même jour ; heure en blanc   [R] DPAO 8 p.26 → §10
- Délai de réponse aux éclaircissements pendant l'évaluation : 5 jours        [R] DPAO 9.1 p.26
- Offres anormales : moyenne (estimation + offres conformes) ; haute si > moyenne + 20 % ; seconde moyenne des offres
  restantes ; basse si < seconde moyenne − 10 %                               [R] DPAO 9.4.5 p.27

## 7. Exécution (AE p.38-43 ; CCAP p.58-66)
- Délai : 120 jours au plus par lot, à compter du lendemain de la notification de l'OS de commencer   [R] DPAO 11 p.27
- Point de départ du marché : notification de l'approbation                   [R] AE 5.1 p.41
- Période de préparation : comprise (AE) / non prévue (CCAP)                  [R] AE 5.2 ; CCAP art. 26 — §9
- Plan d'hygiène et de sécurité : 2 jours après le démarrage ; PAQ, ITP, HSE, PGE en 3 exemplaires   [R] CCAP art. 26 ; Spéc. p.85
- Programme d'exécution : 7 jours après l'OS                                  [R] Spéc. 3.2.3 p.84
- Visa des documents d'exécution : 3 jours (CCAP) / 7 jours (Spécifications)  [R] CCAP art. 27 ; Spéc. 3.2.3, 3.2.5 — §9
- Sous-traitance : non envisagée                                              [R] AE art. 3 p.40
- Règlement : en une seule fois (art. 16) / décompte mensuel (12.1) ; pourcentages par corps d'état en blanc   [R] §9
- Intérêts moratoires : taux directeur BCM + 1 point                          [R] CCAP art. 15 p.62
- Acomptes sur approvisionnements, travaux en régie, contrôle des prix de revient, discrétion : non applicable   [R] CCAP art. 13, 12.2, 10, 9
- Masse des travaux : +20 % / −20 % sans avenant, indemnité au-delà de −20 % ; natures d'ouvrage ±30 %   [R] CCAP art. 17-19 p.62
- Force majeure : vent > 120 km/h ; pluie > 14 mm plus de 14 jours sur 30 consécutifs, moyenne > 20 mm   [R] CCAP art. 20 p.63
- Prolongation par la PRMP sans avenant : 20 jours cumulés ; intempéries prévisibles : 5 jours   [R] CCAP art. 22 p.63
- Pénalités : renvoi au CCAG 20.6 (inexistant) → 1/2000e par jour, plafond 20 %   [R] CCAP art. 23 ; [D] CCAG 20.1, 20.4
- Assurances : RC tiers (illimitée pour les dommages corporels), accidents du travail, tous risques chantier,
  décennale ; minimum par sinistre 500 000 Ar (corporels), 1 000 000 Ar (matériels et immatériels), franchise ≤ 500 000 Ar   [R] CCAP art. 8 p.60
- Réception : opérations préalables 20 jours après l'avis ; coordonnées GPS des ouvrages (précision 5 m, Google Earth)
  avant la réception provisoire ; commission désignée par décision du MO   [R] CCAP 28.2 p.64
- Délai de garantie : 12 mois                                                 [R] CCAP art. 29 p.64
- Notifications à défaut de domicile élu : « La Mairie de ………… »             [R] CCAP art. 2 p.58 → §10
- Documents contractuels : plans et note de calcul, DQE, CPC (arrêté 738/1961), TBM (arrêtés 3635 et 3634/1964),
  liste du personnel et CV, liste du matériel, planning, norme décret 2019-1957   [R] CCAP art. 6 p.59
- Dérogation déclarée : CCAG art. 16 ↔ CCAP art. 18                            [R] CCAP art. 31 p.66

## 8. Calendrier
Le dossier laisse toutes les dates en blanc. Valeurs du jeu : §10.

## 9. Anomalies du dossier réel (à conserver comme cas de test, pas à corriger dans les données)
1. Type de prix : forfaitaire (AE art. 2, CCAP art. 16) / prix unitaires (CCAP 11.3, Devis préambule 2).
2. DQE du lot 2 identique au lot 1, jusqu'au total « RÉFÉRENCE 04 SALLES ».
3. Récapitulation générale : corps d'état XII-XIV absents du DQE ; devis descriptif d'un autre projet (cantine,
   bibliothèque, fosse septique, clôture, « Association Fert »).
4. Couverture : tôles 63/100 (Spécifications) / 50/100 (DQE, Devis).
5. Maître d'œuvre : MEN (AE) / DPFI (CCAP).
6. Période de préparation : comprise (AE) / non prévue (CCAP).
7. Garantie de bonne exécution exigée à 2 %, modèles « non utilisé », déclaration de recette « dans l'offre ».
8. Règlement unique pour un délai de 120 jours (CCAG 11.1 : moins de trois mois) / décompte mensuel.
9. Pénalités : CCAG 20.6 inexistant.
10. Visa des documents d'exécution : 3 jours / 7 jours.
11. Formulaire A3 annoncé, absent ; formulaire B1 renvoie à 6.7 au lieu de 9.3.
12. « carte statistique datée de moins de deux (03) mois ».
13. Financement : PIP / « RPI » sur le panneau de chantier.
14. N° du DAO sous quatre formes (p.1, 19, 28, 54-55), toutes en blanc.
15. « Exercice budgétaire : 00-81-0-110-00000 » en page de garde : c'est l'imputation.
16. Références anciennes : loi 2004-009 (CCAP art. 30), décret 2006-347 (IC 9.4.5) ; exclusions citées article 21
    (AE) / article 9 (IC).

## 10. Compléments — ce que la fiche exige et que le dossier ne donne pas
Toutes [H]. ✅ **Validées par le pilote le 2026-10-01** (« je suis votre recommandation ») : ces valeurs sont celles du
jeu, les contradictions du §9 sont tranchées comme ci-dessous. Elles restent des hypothèses : jamais présentées comme
venant du dossier.

| code | information | valeur du jeu | [H] — raison |
|---|---|---|---|
| `B02-OB-03` | Numéro du DAO | 001-DAOO/MEN/PRMP/Tvx-PI-2026 | forme de la p.1, numéro choisi |
| `B01-AC-06` | Courriel de la PRMP | prmp.men@education.gov.mg | fictif, domaine du MEN supposé |
| `B01-AC-07` | Téléphone de la PRMP | +261 20 22 000 00 | fictif |
| `B01-AC-04` | Commission des marchés | Commission nationale des marchés (CNM) | dossier muet ; ministère central |
| `B01-AC-14` / `B02-LV-03` | Montant estimatif | lot 1 : 247 500 000 Ar ; lot 2 : 180 000 000 Ar | seuil de référence technique, cohérent avec les ratios constants du §5 — à confirmer |
| `B04-OV-02` | Date et heure limites de remise | 2026-11-20 09:30 | « 30 minutes » [R], heure et date choisies |
| — | Heure d'ouverture | 2026-11-20 09:30 | même jour [R], même heure |
| `B04-DS-05` | Prix du dossier (par lot) | 100 000 Ar par lot | quittance ARMP exigée [R], montant non donné |
| `B09-NE-01` | Mairie pour les notifications | Commune urbaine d'Antsiranana (lot 1) ; Commune Anosy Avaratra (lot 2) | lieux des lots [R] |
| `B03-QT-07` | Chiffre d'affaires minimum | non exigé | remplacé par la liquidité [R] |
| `B02-MW-01` | Maître d'œuvre retenu pour la fiche | Direction du Patrimoine Foncier et des Infrastructures (DPFI) | contradiction §9.5 ; le CCAP nomme une direction technique |
| `B05-PT-01` | Type de prix retenu | Prix global forfaitaire | contradiction §9.1 ; AE prioritaire (CCAG 3.1.2) |
| `B09-PT-01` | Période de préparation retenue | non | contradiction §9.6 ; CCAP art. 26, plus précis |
| `B08-MR-01` | Règlement en une fois retenu | non (décomptes mensuels) | contradiction §9.8 ; conforme au CCAG 11.1 |
| `B09-VX-01` | Délai de visa retenu | 3 jours | contradiction §9.10 ; CCAP prioritaire sur les Spécifications |
| `B08-RE-01` | Pourcentages par corps d'état | à saisir par le candidat | en blanc [R] |

### 10.1 Imposé par la fiche à la recette du 2026-10-02 (fiche 40, ligne 303288 du plan 00004)

La fiche refusait la validation sans ces cinq valeurs. Elles ont été saisies pour la recette : **ce ne sont pas des
informations du dossier**, et la plupart ne devraient pas être exigées (`demande-backend-2026-10-02-recette-dao-men.md`, §B2).

| code / contrôle | valeur saisie | [H] — constat |
|---|---|---|
| `B03-CQ-10` | 5 | durée des antécédents financiers : le MEN n'en demande pas, **et aucun modèle de travaux ne l'imprime** |
| `B03-QT-07` | 247 500 000 Ar | chiffre d'affaires : le MEN n'en exige pas (ligne ci-dessus) ; il s'imprimait en critère a) du DPAO |
| `B09-DL-04` | 2026-10-30 | date de réception de l'ouvrage : inconnaissable au stade du DAO ; l'AE-T ne l'imprime que renseignée |
| `B10-PC-01` | renvoi à l'article 50 du CCAG | procédure contentieuse : le CCAP du MEN n'en dit rien de propre |
| `DATES_ORDRE` | `B04-OV-02` = 2026-05-27 09:30 (au lieu du 2026-11-20 ci-dessus) | la date limite doit suivre le calendrier du plan de la ligne de recette, pas celui du MEN |

Le plan n'a aucune ligne de travaux à deux lots : la ligne de recette en a cinq, et les lots 3 à 5 reprennent les
valeurs du lot 2.
