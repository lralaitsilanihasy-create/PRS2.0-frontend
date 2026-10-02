# Fiche DAO Travaux ↔ DAO réel de travaux routiers du MTP — correspondance (02/10/2026)

**Document confronté** : `Documents Types/Travaux/ExemplesDAO/DAO_Travaux_routiers.pdf` — Ministère des Travaux Publics,
appel d'offres ouvert N°019-2026/MTP/PRMP/UGPM-TR, **travaux d'entretien progressif des routes reliant Ankily et
Mahasoa** (RP 303-F, PK 0+000 à 25+000), lot unique, prix unitaires, ressources propres internes. Le PDF compte 152 pages,
CCAG compris ; il porte un filigrane nominatif et **ne se commite pas**. Faits relevés : `docs/jeu-donnees-mtp-routier-faits.md`.

**Référentiel** : `GET /api/champs-fiche-marche?typeMarche=QUANTITE_FIXE&categorie=TRAVAUX` du 02/10, soit **177 champs**
(166 au 01/10, plus les champs créés depuis). Méthode et marques : celles de
`docs/correspondance-2026-10-01-fiche-dao-travaux-vs-dao-men.md`. Les pages citées sont celles imprimées en pied de page.

| marque | sens |
|---|---|
| ✅ | le DAO donne la valeur, reprise telle quelle (clause et page citées) |
| ∅ | le DAO prévoit l'information mais la laisse **en blanc** |
| — | le DAO est **muet** |
| ⚠ | le DAO se **contredit**, ou sa valeur **ne tient pas** dans le champ |
| s.o. | sans objet pour ce DAO (option non retenue : devises, régie, prix forfaitaire…) |
| fermé | fermé par le cadrage |

## Bilan

| | nombre |
|---|---|
| Champs de la fiche (QF travaux) | 177 |
| Fermés par le cadrage (allotissement, tranches, groupement, remise électronique) | 32 |
| Sans objet pour ce DAO | 11 |
| **Valeur trouvée dans le DAO** ✅ | 85 |
| Prévus mais en blanc ∅ | 3 |
| DAO muet — | 32 |
| Contradiction ou valeur qui ne tient pas dans le champ ⚠ | 14 |
| **Informations du DAO sans champ dans la fiche** (§ « Ce que la fiche ne sait pas porter ») | 14 |

**Lecture du bilan.**
- Sur les 134 champs ouverts et utiles, le DAO en renseigne proprement 85 (63 %), à peu près comme le MEN (59 %).
- Les ⚠ ne disent pas la même chose que pour le MEN. Le DAO routier est **cohérent**, mais il **calcule** ses exigences :
  - liquidité en pourcentage de l'offre ;
  - chiffre d'affaires en moyenne des meilleures années ;
  - références en montant cumulé.

  La fiche n'a que des montants fixes pour les recevoir.
- La seconde moitié du problème, ce sont les **listes** : DQE, matériel, plannings. La fiche ne les porte qu'en texte libre
  ou en pièce jointe.

## Le cadrage

| question | réponse du DAO | | source |
|---|---|---|---|
| alloti / nbLots | NON, lot unique et indivisible | ✅ | DPAO 1.1 p.15 |
| tranches | NON | ✅ | DPAO 1.1 p.15 ; CCAP art. 5 |
| variantes | NON | ✅ | DPAO 1.1, 9.4 |
| groupement | NON | ✅ | DPAO 2 ; CCAP art. 4 |
| garantieSoumission | OUI | ✅ | DPAO 6.7 p.18 |
| typePrix | UNITAIRES | ✅ | AE art. 2 p.38 ; CCAP 11.3 p.56 ; art. 16 p.57 — cohérent partout (le MEN se contredisait) |
| prixRevisable | NON | ✅ | DPAO 6.5 ; CCAP 11.4 |
| avance / tauxAvance | OUI, 20 % | ✅ | CCAP 14.1 p.56 ; AE 6.2 |
| penalites | régime particulier : 1/1000 par jour, plafond 15 %, résiliation au plafond | ✅ | CCAP art. 23 p.57-58 |
| modeRemise | PAPIER (« n'est pas autorisé ») | ✅ | DPAO 7.3 p.19 |

**Fermés par ce cadrage (32)** :
- alloti = NON : `B02-AU-07`, `B02-LT-01`, `B02-LT-02`, `B04-FP-03`, `B06-EV-01`, `B09-DL-05` ;
- tranches = NON : `B02-LT-03` à `-07`, `B09-RP-01` ;
- groupement = NON : `B03-GT-01`, `-03`, `-04`, `-05` ;
- remise PAPIER : `B04-SE-02` à `-17`.

## B01 — Identification et données du PPM (lues du plan, contrôlées ici)

| code | information | DAO | | source |
|---|---|---|---|---|
| `B01-AC-01` | Autorité contractante | Ministère des Travaux Publics | ✅ | p.1 |
| `B01-AC-02` | Adresse | MTP Anosy, 2e étage, porte 221, Antananarivo 101 | ✅ | DPAO 1 p.15 |
| `B01-AC-03` | Ministère de rattachement | MTP | ✅ | p.1 |
| `B01-AC-04` | Commission des marchés | | — | |
| `B01-AC-05` | PRMP | nommée | ✅ | DPAO 1 p.15 ; AE p.36 |
| `B01-AC-06` / `-07` | Courriel, téléphone de la PRMP | | — | |
| `B01-AC-08` / `-10` / `-11` | Plan, version, dossier de planification | | — | |
| `B01-AC-09` | Exercice | 2026 | ✅ | référence du DAO ; carte professionnelle 2026 |
| `B01-AC-12` | Nature | travaux | ✅ | p.1 |
| `B01-AC-13` | Mode | appel d'offres ouvert, articles 35 et 63 du Code | ✅ | p.1 ; AE p.36 |
| `B01-AC-14` | Montant estimatif | non publié | — | la garantie de 100 500 000 Ar ne dit pas le taux |
| `B01-AC-15` | Financement | ressources propres internes | ✅ | p.1 |
| `B01-AC-16` | Service bénéficiaire | | — | |
| `B01-AC-17` | Compte budgétaire | imputation 00-61-0-D10-00000, compte 2441 | ⚠ | p.1 ; l'AE p.36 écrit « Imputation budgétaire : Ressource Propre Interne (RPI) », la source à la place de l'imputation (l'import lit cette ligne-là) |
| `B01-AC-18` | Dates prévisionnelles | « lancé le …… » ; date limite en blanc | ∅ | p.1 ; DPAO 7.2 |
| `B01-AC-19` | Forme | quantité fixe | ✅ | prix unitaires sur quantités estimatives, ni commande ni contrat-cadre |

## B02 — Objet, allotissement et forme

| code | information | DAO | | source |
|---|---|---|---|---|
| `B02-LV-01` | Nombre de lots | 1 | ✅ | DPAO 1.1 |
| `B02-LV-02` | Désignation des lots | lot unique = l'objet | ✅ | |
| `B02-LV-03` | Montant par lot | | — | |
| `B02-OB-01` | Objet | « Travaux d'entretien progressif des routes reliant Ankily et Mahasoa » | ✅ | p.1 |
| `B02-OB-03` | Numéro du DAO | N°019-2026/MTP/PRMP/UGPM-TR | ✅ | p.1 |
| `B02-OT-01` | Projet plus vaste | « l'entretien des routes à Madagascar » | ✅ | CCAP 1.1 p.54 (lu en confiance haute par l'import) |
| `B02-OT-02` | Consistance des travaux | 17 prestations en trois séries | ✅ | CPS chap. I p.61 |
| `B02-MW-01` | Maître d'œuvre | « sera désigné par une décision du maître de l'ouvrage » ; tâches assurées par les agents du MTP | ⚠ | CCAP 1.2.3 p.54 ; AE p.36 « Maître d'œuvre : …… » en blanc. Champ obligatoire, mais le maître d'œuvre n'est pas connu au DAO |
| `B02-MW-02` | Lien contractuel MO / MOE | | — | |
| `B02-MW-04` | Maître d'ouvrage délégué | Néant | ✅ | CCAP 1.2.2 — champ laissé vide |

## B03 — Candidats : qualifications

| code | information | DAO | | source |
|---|---|---|---|---|
| `B03-CQ-01` | Pièces administratives | pièces 01 à 04, chacune de moins de 3 mois | ✅ | DPAO 6.2 p.16 |
| `B03-CQ-09` | Antécédents juridiques (années) | 5 | ✅ | fiche A1-b p.24 (marchés non exécutés et litiges, 5 ans) |
| `B03-CQ-10` | Antécédents financiers (années) | 3 | ✅ | fiche A3 p.27 (états financiers des trois dernières années) |
| `B03-NT-01` | Comptable assignataire | Payeur Général d'Antananarivo | ✅ | AE art. 4 p.38 |
| `B03-QT-05` | ONG et communautés admises | | — | |
| `B03-QT-06` | Qualifications particulières | a) à e) de la clause 6.3 | ⚠ | DPAO 6.3 p.17-18 : chaque critère a son champ, sauf leur calcul (voir ci-dessous) |
| `B03-QT-07` | Chiffre d'affaires annuel minimum « pour des travaux de construction » | **moyenne des 3 meilleures des 5 dernières années, en travaux routiers**, ≥ 5 000 000 000 Ar | ⚠ | DPAO 6.3 b. Le libellé dit « construction », le DAO dit « routiers » ; le champ ne porte ni la règle de calcul ni la période |
| `B03-QT-08` | Projet comparable | **au plus 3 marchés routiers, total ≥ 2 500 000 000 Ar**, en entrepreneur principal | ⚠ | DPAO 6.3 c. Un montant **cumulé** sur plusieurs marchés, quand le champ (par lot) attend un projet ; « au plus trois » se lit « en trois marchés au plus » |
| `B03-QT-09` | Forme de disposition du matériel | 10 engins, chacun avec un nombre et un minimum en propre ; location sur engagement | ⚠ | DPAO 6.3 d p.17-18. Un tableau, que le champ texte recopie sans pouvoir le contrôler |
| `B03-QT-10` | Expérience du directeur des travaux (années) | 5 (conducteur de travaux, en travaux routiers) | ✅ | DPAO 6.3 e p.18 |
| `B03-QT-12` | Période de référence (années) | 10 | ⚠ | DPAO 6.3 c (10 ans) contre 6.3, point 4 (« trois dernières années ») |
| `B03-QT-13` | Personnel clé | conducteur de travaux (ingénieur BTP ou génie civil, 5 ans routiers) ; chef de chantier (ingénieur ou TS, 3 ans) ; CV et diplôme certifié | ✅ | DPAO 6.3 e p.18 |
| `B03-QT-14` | Liquidité minimale (Ariary) | **10 % du montant de l'offre** | ⚠ | DPAO 6.3 a. Un pourcentage de l'offre de chaque candidat, quand le champ est un montant fixe |

## B04 — Dossier, remise et ouverture

| code | information | DAO | | source |
|---|---|---|---|---|
| `B04-CD-01` | Fiches de renseignements | A1, A2, A3, A4 | ✅ | DPAO 5.1, 6.3 |
| `B04-CD-02` | Modèle de garantie de soumission | B1 (garantie bancaire), B2 (caution) | ⚠ | DPAO 6.7 ; les options de la fiche s'appellent « C1 / C2 », le DAO dit « B1 / B2 » |
| `B04-CD-03` | Plans joints | « Néant » | ✅ | ST annexe 1 p.94 — champ vide |
| `B04-DS-05` | Prix du dossier | quittance ARMP exigée, montant non donné | — | DPAO 6.2, pièce 05 |
| `B04-DS-07` à `-11` | Adresse de consultation du dossier | | — | seule l'adresse des éclaircissements est donnée (5.2) |
| `B04-EQ-01` | Délai des demandes d'éclaircissement | 10 jours | ✅ | DPAO 5.2 p.16 |
| `B04-EQ-02` | Délai de réponse de la PRMP | 5 jours | ✅ | DPAO 5.2 |
| `B04-FP-01` | Nombre de copies | 2 | ✅ | DPAO 7.1 p.19 |
| `B04-FP-02` | Mention sur les plis | « AVIS D'APPEL D'OFFRES OUVERT N°019-2026/MTP/PRMP/UGPM-TR (lancé le ……) » | ✅ | DPAO 7.1 |
| `B04-LG-01` / `-02` | Langue, traduction | | — | français par défaut (IC 6.8) |
| `B04-OV-01` | Lieu d'ouverture | MTP Anosy, 2e étage, porte 221 | ✅ | DPAO 8 p.20 |
| `B04-OV-02` | Date et heure limites | en blanc | ∅ | DPAO 7.2, 8 |
| `B04-PI-01` | Pièces de l'offre | pièces 05 à 10, plus une clé USB (PDF, Word, Excel) | ✅ | DPAO 6.2, 7.1 |
| `B04-RP-01` / `-02` | Réunion préparatoire | | — | DPAO muet |
| `B04-SE-01` | Mode de remise | PAPIER | ✅ | DPAO 7.3 |
| `B04-VL-01` / `-02` | Visite des lieux | | — | **DPAO muet** alors qu'IC 6.9.2 lui renvoie les modalités. Pour 25 km de route, c'est un manque du dossier |
| `B04-VO-01` | Validité des offres | 75 jours | ✅ | DPAO 6.4 p.18 |

## B05 — Prix, garanties

| code | information | DAO | | source |
|---|---|---|---|---|
| `B05-AG-01` | Autres garanties | Non applicable | ✅ | CCAP 7.4 — vide |
| `B05-GA-01` | Garantie de restitution d'avance | OUI, 100 % de l'avance | ✅ | CCAP 7.3, 14.1 |
| `B05-GE-01` | Garantie de bonne exécution | OUI | ✅ | CCAP 7.1 |
| `B05-GE-02` | Part en devises | | s.o. | Ariary |
| `B05-GE-03` | Formes (bonne exécution) | garantie bancaire, caution, chèque de banque | ✅ | CCAP 7.1 p.55 |
| `B05-GE-04` | Libération | à 100 % à la réception provisoire | ✅ | CCAP 7.1 |
| `B05-GE-05` | Taux | 2 % | ✅ | CCAP 7.1 |
| `B05-GQ-01` | Garantie de soumission | OUI | ✅ | DPAO 6.7 |
| `B05-GQ-02` | Formes (soumission) | chèque de banque, caution bancaire personnelle et solidaire, garantie bancaire | ✅ | DPAO 6.7 p.18 |
| `B05-GQ-03` | Montant | 100 500 000 Ar | ✅ | DPAO 6.7 |
| `B05-GQ-04` | Bénéficiaire des chèques | Receveur Général d'Antananarivo | ✅ | DPAO 6.7 ; CCAP 7.1, 7.2 |
| `B05-MN-01` | Monnaie | Ariary | ✅ | AE art. 2 ; CCAP 11.2 |
| `B05-PT-01` | Type de prix | UNITAIRES | ✅ | cadrage |
| `B05-RG-01` / `-02` | Retenue de garantie | OUI, 2 % | ✅ | CCAP 7.2 p.55 |
| `B05-VR-01` | Prix fermes | OUI | ✅ | cadrage |
| `B05-VR-02` | Indices d'actualisation | aucun | ✅ | CCAP 11.4 — vide |

## B06 — Évaluation

| code | information | DAO | | source |
|---|---|---|---|---|
| `B06-EO-07` | Offres anormales | moyenne des offres ; haute au-delà de +20 % ; seconde moyenne ; basse en deçà de −10 % | ✅ | DPAO 9.4 p.20 |
| `B06-PN-01` | Préférence nationale | NON | ✅ | DPAO 9.5 |
| `B06-PN-02` | Taux | | s.o. | |
| `B06-RC-01` | Réponse aux éclaircissements de la PRMP | 2 jours | ✅ | DPAO 9.1 p.20 |

## B08 — Paiements

| code | information | DAO | | source |
|---|---|---|---|---|
| `B08-AF-01` / `-03` | Avance forfaitaire | OUI, 20 % | ✅ | CCAP 14.1 |
| `B08-AF-02` | Montant de l'avance | | — | |
| `B08-AF-04` / `-05` | Parts en monnaie nationale et en devises | | s.o. | Ariary seul |
| `B08-AP-01` | Acomptes sur approvisionnements | NON | ✅ | CCAP art. 13 |
| `B08-AP-02` | Modalités | | s.o. | |
| `B08-EF-01` | Estimation des engagements du MO | Non applicable | ✅ | CCAP art. 3 — vide |
| `B08-MO-01` | Taux des intérêts moratoires (%) | taux directeur de la BCM + 1 point | ⚠ | CCAP art. 15. Une formule, que le champ `POURCENTAGE` ne reçoit pas (même cas pour le MEN) |
| `B08-MR-01` | Règlement en une fois | NON, décomptes mensuels | ✅ | CCAP 12.1, art. 16 |
| `B08-MR-05` | Délai du projet de décompte | 10 jours ouvrables | ✅ | CCAP art. 16 p.57 |
| `B08-MR-06` | Découpage du forfait | | s.o. | prix unitaires |
| `B08-RE-01` | Règlement des comptes | acomptes mensuels, prix unitaires sur les quantités prises en attachement | ✅ | CCAP 12.1 |
| `B08-RE-02` | Travaux en régie | NON | ✅ | CCAP 12.2 |
| `B08-RE-03` / `-04` | Conditions et plafond de la régie | | s.o. | |

## B09 — Exécution

| code | information | DAO | | source |
|---|---|---|---|---|
| `B09-AC-01` | Assurance des engins | à la charge de l'entrepreneur, véhicules assurés | ✅ | CCAP 8 A p.55 |
| `B09-AC-02` | Responsabilité civile | RC d'exploitation, accidents du travail, polices sous 15 jours | ✅ | CCAP 8 B p.55-56 |
| `B09-AC-03` | Responsabilité décennale | | — | CCAP muet (la fiche l'exige, obligatoire) |
| `B09-BT-01` | Travaux de bâtiment | NON | ✅ | route |
| `B09-CH-01` à `-05` | Sujétions particulières | | — | |
| `B09-DC-01` | Documents contractuels | plan, BPU, DQE, sous-détail, CPC (arrêté 738/1961), listes du personnel et du matériel, planning | ✅ | CCAP art. 6 p.54-55 |
| `B09-DL-01` | Délai d'exécution | **au plus six (6) mois**, à compléter par le candidat | ⚠ | DPAO 11 ; AE 5.2 ; CCAP 21 « …… ». Un plafond offert au candidat, pas un délai fixé |
| `B09-DL-04` | Date de réception | | — | |
| `B09-DT-01` | Point de départ du marché | notification de l'approbation | ✅ | AE 5.1 |
| `B09-FM-01` / `-02` | Force majeure | OUI ; vent > 120 km/h ; plus de 10 jours de pluie > 14 mm sur 30 jours, moyenne > 20 mm | ✅ | CCAP art. 20 p.57 |
| `B09-GT-01` | Délai de garantie | 12 mois | ✅ | CCAP art. 29 p.59 |
| `B09-MA-01` / `-02` | Masse +/− sans avenant | 15 % | ✅ | CCAP art. 17, 18 |
| `B09-MA-03` | Diminution ouvrant droit à indemnité | « …… de la masse initiale » | ∅ | CCAP art. 32, texte tronqué |
| `B09-MA-04` | Natures d'ouvrage | 25 % | ✅ | CCAP art. 19 |
| `B09-MD-01` | Prolongation sans avenant | vingt (20) jours | ✅ | CCAP art. 22 |
| `B09-MD-02` | Intempéries prévisibles | quinze (15) jours **consécutifs** | ⚠ | CCAP art. 22. « Consécutifs » ne tient pas dans un nombre |
| `B09-NE-01` | Notifications | bureau de la commune rurale d'Ankily | ✅ | CCAP art. 2 |
| `B09-OD-01` | Discrétion | NON (« Sans objet ») | ✅ | CCAP art. 9 |
| `B09-OD-02` / `-03` | Mesures de sécurité | | s.o. | |
| `B09-PE-02` / `-03` | Pénalités | 1/1000 par jour, plafond 15 % | ✅ | CCAP art. 23 |
| `B09-PM-01` | Matériaux fournis par le MO | Non applicable | ✅ | CCAP art. 25 — vide |
| `B09-PR-01` | Régime des pénalités | particulier | ✅ | cadrage |
| `B09-PT-01` | Période de préparation | NON | ✅ | CCAP art. 26 ; mais AE 5.2 : « La période de préparation est comprise dans le délai » (texte type non retouché) |
| `B09-PT-02` | Durée de la préparation | | s.o. | |
| `B09-PT-03` | Programme d'exécution | 7 jours | ⚠ | CCAP art. 26 (7 jours) contre ST 3-1 p.69 (21 jours) |
| `B09-PT-04` | Plan d'hygiène et de sécurité | | — | |
| `B09-PV-01` / `-02` | Contrôle des prix de revient | NON | ✅ | CCAP art. 10 |
| `B09-RP-03` | Opérations préalables | sept (07) jours | ✅ | CCAP 28.2 a (lu en confiance haute) |
| `B09-RP-04` | Modalités de réception | commission désignée par décision du MO, copie au Contrôle financier | ✅ | CCAP 28.2 b |
| `B09-VQ-01` | Vérification des matériaux | par l'autorité de contrôle | ✅ | CCAP art. 24 |
| `B09-VX-01` | Visa des documents d'exécution | sept (07) jours | ✅ | CCAP art. 27 |

## B10 — Dérogations, litiges

| code | information | DAO | | source |
|---|---|---|---|---|
| `B10-DR-01` | Dérogations | « Néant » | ⚠ | CCAP art. 32 : tableau « Néant », mais précédé de deux paragraphes tronqués (décompte, masse) qui ne dérogent à rien |
| `B10-PC-01` | Procédure contentieuse | « Les dispositions du CCAG s'appliquent » | ✅ | CCAP art. 31 |

## Ce que la fiche ne sait pas porter

| # | information du DAO | source | piste |
|---|---|---|---|
| 1 | **BPU et DQE** : 17 articles, unités, quantités, séries 000 / 500 / 600, prix à écrire en lettres | AE annexe 1 p.42-44 | **chantier b** : un DQE porté par la fiche, à prix unitaires comme au forfait |
| 2 | **Matériel exigé en tableau** : 10 types, nombre, minimum en propre, lieu de parcage | DPAO 6.3 d ; ST annexes 3-4 | liste structurée (type, caractéristique, nombre, minimum en propre) au lieu de `B03-QT-09` en texte |
| 3 | **Liquidité relative** : 10 % du montant de l'offre | DPAO 6.3 a | `B03-QT-14` en pourcentage **ou** montant |
| 4 | **Chiffre d'affaires calculé** : moyenne des 3 meilleures années sur 5, en travaux routiers | DPAO 6.3 b | `B03-QT-07` : libellé élargi (« dans le domaine du marché »), plus le nombre d'années et de meilleures années |
| 5 | **Références cumulées** : au plus 3 marchés, total ≥ 2,5 Md, 10 ans | DPAO 6.3 c | `B03-QT-08` : nombre maximal de marchés et montant cumulé |
| 6 | **K1** : formule et composantes a.1 à a.9 imposées | AE annexe 2 p.45 | modèle fixe ; seule l'exigence de l'annexe est à porter |
| 7 | **Sous-détail des prix** : prix d'installation, prix de laboratoire, prix « marqués d'un astérisque » | AE annexe 3 p.46 | un drapeau par article du DQE (« sous-détail exigé ») — lié au point 1 |
| 8 | **Prix d'installation plafonné** à 10 % des travaux, payé 60 % au démarrage et 40 % après la réception | CPS série 000 p.86 | plafond et échelonnement d'un article du DQE |
| 9 | **Plannings exigés** : 8-a à 8-e, et plan de charge | ST annexes 5-6 ; DPAO 6.2, pièces 09-10 | liste de pièces typées (aujourd'hui dans `B04-PI-01` en texte) |
| 10 | **Copie électronique** sur clé USB, en PDF, Word et Excel, avec la remise papier | DPAO 7.1 | `B04-FP-*` : support et formats de la copie électronique |
| 11 | **Retenue de garantie** restituée à la réception provisoire contre une caution, libérée à la réception définitive | CCAP 7.2 | modalité de remplacement de la retenue |
| 12 | **Localisation linéaire** : axe, PK de début et de fin, coordonnées GPS | p.1 ; DQE p.43 | champs de localisation d'un ouvrage linéaire |
| 13 | **Réception par phase**, sans tranches | CCAP 28.1 | `B09-RP-01` n'est ouvert qu'aux tranches |
| 14 | **Résiliation au plafond des pénalités** | CCAP art. 23 | clause du régime des pénalités |

## Incohérences du DAO lui-même

Elles sont reprises de `docs/jeu-donnees-mtp-routier-faits.md`, §6 :
1. unité du prix 620 : m³ au DQE, mètre carré au bordereau ;
2. références sur 3 ans dans les fiches, sur 10 ans dans les critères ;
3. « au plus trois » marchés pour un minimum de montant ;
4. sous-détail exigé pour des prix « marqués d'un astérisque », mais aucun n'est marqué ;
5. dosage des bétons B1 et B2 incohérent entre BPU, définition des prix et essais ;
6. annexe 4 adressée à la commune de Sabotsy Namehana ;
7. spécifications techniques décrivant des travaux absents du DQE (enrobés, ponts, entretien de routine) ;
8. programme d'exécution exigé en 7 jours au CCAP et en 21 jours aux spécifications ;
9. AE qui comprend une période de préparation que le CCAP exclut.

Les points 2, 3 et 8 touchent un champ de la fiche (⚠ ci-dessus) ; le point 9 est noté sous `B09-PT-01`, où le CCAP, plus précis, est retenu.

## Ce que la comparaison a fait apparaître chez nous

- **Import du PDF : défaut corrigé** (règle 8, `docs/demande-backend-2026-10-02-lecture-reancrage.md`). Le sommaire de
  ce DAO bloquait toute la lecture du DPAO (1 paragraphe reconnu sur 161). Une fois corrigé :
  - CCAP : 65 paragraphes reconnus ;
  - DPAO : 8 seulement. Ce DPAO suit une **version antérieure** du document type ARMP, et la mise en page en colonnes
    recolle mal certains libellés (« Demandes Afin », espaces perdues). La lecture par modèle ne fera pas mieux sur ce
    dossier ; c'est l'argument de la « lecture par clause » restée à décider le 29/09.
- **Fiche** :
  - la majorité des ⚠ tiennent à des exigences **calculées**, que la fiche ne sait pas porter (liquidité relative,
    moyenne de chiffre d'affaires, montant cumulé) ;
  - le reste, ce sont des **listes** : DQE, matériel, plannings (lignes 1, 2, 7, 9 du tableau ci-dessus). Les deux
    rejoignent le chantier b ;
  - à corriger à peu de frais :
    - le libellé de `B03-QT-07` (« construction ») ;
    - les options « C1 / C2 » de `B04-CD-02` (le dossier type dit B1 / B2) ;
    - le caractère obligatoire de `B02-MW-01` (maître d'œuvre désigné après le DAO) et de `B09-AC-03` (décennale, sans
      objet pour une route).
