# Jeu de données MTP travaux routiers : faits tirés du dossier réel

Source : `Documents Types/Travaux/ExemplesDAO/DAO_Travaux_routiers.pdf` (152 pages, dont le CCAG des travaux en
fin de dossier). C'est le premier DAO de **travaux routiers** réel, fourni le 02/10/2026. Le PDF porte un filigrane
nominatif : **il ne se commite pas**, comme celui du MEN.

Trois natures, comme pour `docs/jeu-donnees-men-travaux-faits.md` :
- [R] repris tel quel du dossier ;
- [D] déduit d'une valeur du dossier, calcul indiqué ;
- [H] hypothèse : le dossier est muet ou en blanc. Une [H] n'est jamais présentée comme venant du dossier.

## 1. Identification
- Autorité contractante : Ministère des Travaux Publics (MTP), PRMP et UGPM                           [R] p.1, DPAO 1 p.15
- Référence : AOO N°019-2026/MTP/PRMP/UGPM-TR ; « lancé le …… 2026 » (en blanc)                         [R] p.1
- Objet : « Travaux d'entretien progressif des routes reliant Ankily et Mahasoa »                         [R] p.1
- Axe : RP 303-F, du PK 0+000 (carrefour RNP 7) au PK 25+000 (CR Mahasoa) ; coordonnées GPS de début et de fin   [R] p.1, DQE p.43
- Financement : ressources propres internes (RPI) ; imputation 00-61-0-D10-00000 ; compte 2441           [R] p.1
- Lot **unique et indivisible** ; variantes non ; tranches non ; **groupement non autorisé**              [R] DPAO 1.1, 2 p.15
- Type de prix : **prix unitaires** (BPU et DQE en annexe I de l'AE, quantités réellement exécutées prises en attachement)   [R] AE art. 2 p.38, CCAP 11.3 p.56
- Prix fermes et non révisables                                                                           [R] DPAO 6.5 p.18
- Remise électronique : **non autorisée** (plis papier, original et 2 copies, clé USB en PDF, Word et Excel)   [R] DPAO 7.1, 7.3 p.19

## 2. BPU et DQE (annexe 1 de l'AE, p.42-44)
Le prix de chaque article s'écrit en lettres au BPU (« Le mètre cube à : …… Ariary ») ; les lettres font foi (IC 9.3 a).

| n° | désignation | unité | quantité |
|---|---|---|---|
| 001 | Installation et repli de chantier | fft | 1 |
| 502 | Aménagement de déviation | fft | 1 |
| 510 | Démolition maçonnerie | m³ | 55,20 |
| 520 | Déblai pour fouille | m³ | 2 054,50 |
| 529 | Maçonnerie de moellons | m³ | 2 825,00 |
| 540 | Béton B2 dosé à 250 kg/m³ de ciment | m³ | 195,00 |
| 542 | Béton B3 dosé à 350 kg/m³ de ciment | m³ | 192,00 |
| 543 | Béton B4 dosé à 400 kg/m³ de ciment | m³ | 210,00 |
| 545 | Acier pour armature | kg | 48 240,00 |
| 550 | Fossé maçonné 40 × 40 cm | ml | 3 000,00 |
| 560 | Dalot mixte maçonnerie-BA 70 × 80 cm | ml | 30,00 |
| 584 | Blocage 10/15 kg | m³ | 300,60 |
| 620 | Remblai d'emprunt | m³ | 1 520,00 |
| 630 | Couche de roulement en matériaux sélectionnés | m³ | 15 500,00 |
| 621 | Réglage de plateforme | m² | 17 100,00 |
| 632 | Pavage | m² | 15 200,00 |
| 677 | Chaussée en béton légèrement armé | m³ | 400,00 |

- Récapitulation par séries : 000 installation, 500 ouvrages, 600 chaussées                                 [R] p.44
- Le prix 001 est plafonné à **10 % du montant des travaux** ; il est payé 60 % au démarrage et 40 % après la réception provisoire   [R] CPS série 000 p.86
- **K1** (annexe 2) : K1 = (1 + A1/100) × (1 + A2/100) / (1 − A3/100 × (1 + T/100)), avec T = TVA de 20 %. A1 = a1 à a4 (agence, chantier, études et laboratoire, assurances) ; A2 = a5 à a8 (bénéfice, aléas techniques, aléas de révision, frais financiers) ; A3 = a9 (siège), nul pour un siège à Madagascar ; arrondi à la deuxième décimale par défaut   [R] p.45
- **Sous-détail des prix** (annexe 3) : à fournir pour les prix d'installation, pour les prix de laboratoire et pour les prix marqués d'un astérisque au BDE ; prix = D × K1 / R, où R est la production journalière de l'atelier   [R] p.46

## 3. Qualifications (DPAO 6.3, p.17-18)
- Liquidité ou ligne de crédit bancaire ≥ **10 % du montant de l'offre**, émise entre le lancement et la date limite   [R]
- Chiffre d'affaires en travaux routiers : moyenne des **3 meilleures des 5 dernières années** ≥ **5 000 000 000 Ar**   [R]
- Références : « au plus trois (03) » marchés de travaux routiers sur les **10 dernières années**, en entrepreneur principal, d'un montant **total** ≥ **2 500 000 000 Ar**   [R]
- Matériel :

| matériel | nombre | statut exigé |
|---|---|---|
| Camions bennes ≥ 10 000 kg | 6 | au moins 4 en propre |
| Camion-citerne ou citerne à eau ≥ 5 000 l | 2 | au moins 1 en propre |
| Pelle mécanique ou hydraulique | 1 | en propre |
| Chargeuse | 1 | en propre |
| Niveleuse | 1 | en propre |
| Compacteur lourd ≥ 10 t | 1 | en propre |
| Compacteur léger ≥ 2,5 t | 1 | en propre |
| Bétonnière ≥ 500 l | 2 | en propre |
| Pervibrateurs | 2 | en propre |
| Véhicule de liaison 4×4 | 1 | en propre |

  Pour le matériel loué, l'engagement de location (annexe 4) est à joindre ; pour le matériel en propre, carte grise ou acte de vente. Le lieu de parcage doit être indiqué (annexe 3)   [R] p.18, 97
- Personnel :
  - conducteur de travaux : ingénieur BTP ou génie civil, au moins **5 ans** en travaux routiers ;
  - chef de chantier : ingénieur ou technicien supérieur BTP/GC, au moins **3 ans** en travaux routiers ;
  - pour chacun, CV et diplôme certifié   [R] p.18

## 4. Offre (DPAO 6.2, 6.4, 6.7, 11)
- Pièces 01 à 04 : carte professionnelle 2026 (copie légalisée par le centre fiscal), carte statistique, registre du commerce, certificat de non-faillite, chacune **de moins de 3 mois**   [R] p.16
- Pièces 05 à 10 :
  - 05 : quittance ARMP pour l'achat du dossier ;
  - 06 : garantie de soumission (B1 ou B2) ;
  - 07 : liste du personnel ;
  - 08 : liste du matériel ;
  - 09 : plannings d'exécution et d'intervention pendant la garantie ;
  - 10 : plan de charge   [R] p.16
- Plannings exigés (annexe 5) : 8-a planning général, 8-b mobilisation du personnel et du matériel, 8-c approvisionnement des matériaux, 8-d échéancier de paiement, 8-e intervention pendant le délai de garantie   [R] p.99
- Fiches A1 à A4 « certifiées exactes et sincères » ; AE annexes 4 (sommes versées aux tiers) et 5 (bénéficiaires effectifs)   [R]
- Validité des offres : **75 jours**                                                                            [R] DPAO 6.4
- Garantie de soumission : **100 500 000 Ar**, en faveur du « Receveur Général d'Antananarivo ». Formes : chèque de banque (verser au Trésor et joindre l'ordre de recette), caution bancaire personnelle et solidaire, ou garantie bancaire. Validité jusqu'au **105e jour** suivant la date limite   [R] DPAO 6.7, B1 p.33 ; [D] 75 + 30 (IC 6.7)
- Délai d'exécution : au plus **six (6) mois** à compter du lendemain de l'OS de commencer                        [R] DPAO 11, AE 5.2
- Éclaircissements : demandes 10 jours avant la date limite, réponse 5 jours avant ; réponse du candidat aux demandes de la PRMP sous 2 jours   [R]
- Offres anormales : même règle que le MEN (+20 % / −10 % autour des deux moyennes)                                [R] DPAO 9.4.4

## 5. Exécution (CCAP p.54-60)
- Garantie de bonne exécution 2 %, libérée à 100 % à la réception provisoire ; retenue de garantie 2 % ; avance 20 % garantie à 100 %   [R]
- Décomptes mensuels ; projet de décompte au plus tard 10 jours ouvrables avant la fin du mois suivant   [R] art. 16
- Masse ±15 % ; natures d'ouvrage ±25 % ; prolongation sans avenant 20 jours ; intempéries : 15 jours consécutifs   [R]
- Pénalités : 1/1000 par jour, plafond 15 % (marché résilié au plafond)                                          [R] art. 23
- Force majeure : vent > 120 km/h ; plus de 10 jours de pluie > 14 mm sur 30 jours consécutifs, moyenne > 20 mm   [R] art. 20
- Délai de garantie 12 mois ; réception par phase applicable ; visa en 7 jours ; notifications au bureau de la commune rurale d'Ankily   [R]

## 6. Anomalies du dossier (cas de test, à ne pas corriger dans les données)
1. **Unité** : le prix 620 « Remblai d'emprunt » est en m³ au DQE, mais le BPU le libelle « Le mètre carré à ».
2. **Période des références** : trois ans dans les fiches d'information (6.3, 4.) contre dix ans dans les critères (6.3 c).
3. **« Au plus trois marchés »** pour un minimum de montant total : il faut lire « au moins » ou « en trois marchés au plus ». La maquette retient la seconde lecture.
4. **Sous-détail** : il est exigé pour les prix « marqués d'un astérisque au BDE », mais **aucun** prix n'en porte. Seul le prix 001 est donc concerné.
5. **Bétons** : le BPU donne B2 = 250 kg (540), la définition des prix B1 = 250 kg (540), le tableau des essais B2 = 300 kg (541).
6. **Annexe 4** : l'engagement de location engage le candidat « vis-à-vis de la Commune Rurale de Sabotsy Namehana », reste d'un autre dossier.
7. **Spécifications techniques** : elles décrivent l'entretien de routine, les enrobés, les enduits et les ponts, que le DQE ne contient pas.
8. **Garantie de soumission** : 100 500 000 Ar, sans estimation publiée, donc sans moyen d'en vérifier le taux.

## 7. Hypothèses de la maquette [H]
- Remise électronique, alors que le DAO l'interdit (7.3) ; date limite 27/11/2026 à 09 h 00 ; candidat et prix d'exemple fictifs.
