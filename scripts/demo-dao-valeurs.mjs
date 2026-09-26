// Les deux dossiers de démonstration, tels qu'arbitrés le 24/09/2026
// (docs/proposition-2026-09-24-demonstration-dao-travaux-prestations.md).
// Aucune valeur n'est mise au hasard : chacune se tient avec les autres et passe les contrôles du serveur.

// ——————————————————————————————————————————————————————————————————————————————
// A. TRAVAUX — Réhabilitation du réseau d'adduction d'eau potable (950 000 000 Ar, 2 lots)
// ——————————————————————————————————————————————————————————————————————————————

export const CADRAGE_TRAVAUX = {
  alloti: 'OUI',
  nbLots: '2',
  tranches: 'OUI',
  variantes: 'NON',
  groupement: 'OUI',
  formeGroupement: 'CONJOINT_OU_SOLIDAIRE',
  provenance: 'NATIONAL',
  typePrix: 'UNITAIRES',
  prixRevisable: 'OUI',
  garantieSoumission: 'OUI',
  avance: 'OUI',
  tauxAvance: '20',
  penalites: 'CCAG',
};

export const VALEURS_TRAVAUX = {
  // — B02 Objet, allotissement & forme du marché —
  'B02-LT-02': 'Divisible',
  'B02-LT-03':
    "Tranche ferme — lot 1 : captage et adduction (réhabilitation de l'ouvrage de captage, pose de 12 kilomètres de "
    + "conduites en fonte ductile, regards de visite et ventouses, station de pompage intermédiaire). "
    + 'Montant : 620 000 000 Ariary.',
  'B02-LT-04':
    "Tranche conditionnelle 1 — lot 2 : stockage et distribution (réservoir semi-enterré de 500 m³, conduites de "
    + "distribution, douze bornes-fontaines et branchements particuliers). Montant : 330 000 000 Ariary. "
    + "L'affermissement est notifié par ordre de service au plus tard six mois après la notification de la tranche ferme ; "
    + "à défaut, l'entrepreneur est libéré de ses obligations sur cette tranche.",
  'B02-MW-01':
    "Direction des Infrastructures et du Patrimoine de la JIRAMA — 149, rue Rainandriamampandry, Ambohijatovo, "
    + 'Antananarivo 101 — téléphone 020 22 200 01 — infrastructures@jirama.mg',
  'B02-MW-02':
    "Décision n° 045-DG/JIRAMA du 12 janvier 2026 confiant la maîtrise d'œuvre de l'opération à la Direction des "
    + "Infrastructures et du Patrimoine, sous l'autorité du Directeur Général.",
  'B02-MW-03': "Compte 6021 — budget d'investissement 2026, ligne « Réhabilitation des bâtiments administratifs »",
  'B02-OT-01':
    "Programme national d'amélioration de la desserte en eau potable (2026-2028), dont le présent marché constitue la "
    + 'première tranche opérationnelle.',
  'B02-OT-02':
    "Réhabilitation du réseau d'adduction d'eau potable : reprise de l'ouvrage de captage et de la station de pompage, "
    + 'pose de 12 kilomètres de conduites en fonte ductile, construction d’un réservoir semi-enterré de 500 m³, '
    + 'renouvellement des conduites de distribution, création de douze bornes-fontaines et de branchements '
    + "particuliers, et remise en état des tranchées et des voiries traversées.",

  // — B03 Candidats : groupement, sous-traitance, qualifications —
  'B03-GT-02':
    "Chaque membre du groupement est identifié par sa dénomination sociale, son siège social, son numéro "
    + "d'identification fiscale, son numéro statistique et le nom de son représentant. Le mandataire du groupement est "
    + "désigné dans l'acte d'engagement et produit le mandat écrit des autres membres.",
  'B03-GT-03':
    "Les qualifications exigées sont appréciées sur l'ensemble du groupement pour la capacité financière, et membre par "
    + 'membre pour la capacité technique correspondant aux travaux que chacun exécute. Le mandataire justifie à lui seul '
    + "d'au moins la moitié du chiffre d'affaires minimum exigé.",
  'B03-GT-04':
    "Groupement conjoint : l'acte d'engagement précise la répartition des travaux entre les membres et le montant "
    + 'correspondant à chacun. Le mandataire est solidaire de chacun des membres pour ses obligations contractuelles.',
  'B03-GT-05':
    "Groupement solidaire : chaque membre est engagé pour la totalité du marché et peut être appelé à exécuter les "
    + 'obligations des autres membres défaillants, sans que la répartition interne des travaux soit opposable au client.',
  'B03-NT-01':
    "Comptable assignataire : Agence Comptable de la JIRAMA, 149 rue Rainandriamampandry, Antananarivo 101. "
    + 'Montant maximal susceptible d’être nanti : 450 000 000 Ariary.',
  'B03-QT-01':
    "Le candidat produit : statuts à jour, registre du commerce, numéro d'identification fiscale et numéro statistique, "
    + "attestation de régularité fiscale et attestation de la Caisse Nationale de Prévoyance Sociale de moins de trois mois, "
    + "et une déclaration sur l'honneur de n'être sous le coup d'aucune interdiction de soumissionner.",
  'B03-QT-02':
    "Le candidat dispose d'une équipe permanente d'au moins vingt personnes, d'un directeur des travaux et d'un "
    + 'conducteur de travaux à plein temps sur le chantier, et du matériel de travaux hydrauliques nécessaire '
    + '(engins de terrassement, matériel de soudure et de pose de conduites, groupe électrogène, pompes '
    + "d'épuisement).",
  'B03-QT-03':
    "Le candidat justifie d'une capacité financière permettant de préfinancer trois mois de travaux, attestée par une "
    + "ligne de crédit bancaire ou par les états financiers certifiés des trois derniers exercices.",
  'B03-QT-04':
    "Au moins deux marchés de réseaux d'eau potable ou d'assainissement d'un montant unitaire supérieur à "
    + '400 000 000 Ariary, achevés au cours des trois dernières années, justifiés par des attestations de bonne '
    + 'exécution.',
  'B03-QT-05': 'NON',
  'B03-QT-06':
    "Pour le lot 1, une qualification en travaux de captage et de pose de conduites sous pression ; pour le lot 2, une "
    + "qualification en ouvrages de stockage et réseaux de distribution d'eau potable.",
  'B03-QT-07': '700000000',
  'B03-QT-08':
    "Réhabilitation ou extension d'un réseau d'adduction d'eau potable comprenant captage, conduites et ouvrage de "
    + "stockage, exécutée en qualité d'entrepreneur principal au cours des cinq dernières années.",
  'B03-QT-09':
    "L'entrepreneur indique, pour chaque matériel essentiel, s'il en est propriétaire, s'il le prend en location ou s'il "
    + 'y accède par crédit-bail, et joint les justificatifs correspondants.',
  'B03-QT-10': '10',
  'B03-QT-11': 'OUI',
  'B03-SU-01': 'OUI',
  'B03-SU-02':
    "La sous-traitance est admise dans la limite de 30 % du montant du marché. Le candidat indique dans son offre la "
    + 'nature des prestations sous-traitées, leur montant et le nom des sous-traitants proposés, qui restent soumis à '
    + "l'acceptation écrite de la personne responsable des marchés publics.",

  // — B04 Dossier, remise & ouverture des offres —
  'B04-CD-01':
    "Fiche de renseignements A1 (identification du candidat), A2 (références de marchés similaires), A3 (moyens "
    + 'humains), A4 (moyens matériels) et A5 (situation financière), jointes au dossier et à remplir intégralement.',
  'B04-CD-02': 'Modèle de garantie bancaire de soumission joint au dossier, à reprendre sans modification.',
  'B04-CD-03':
    "Plans joints au dossier : plan de situation au 1/5000, profil en long du tracé au 1/2000, plans des ouvrages de "
    + "captage et de la station de pompage au 1/100, plan de coffrage du réservoir au 1/50, et carnet de détails des "
    + 'regards et des bornes-fontaines.',
  'B04-DV-01': '90',
  'B04-EQ-01': '15',
  'B04-EQ-02': '7',
  'B04-FP-01': '3',
  'B04-FP-02': "Appel d'offres ouvert n° 00003/PPM-AGPM/CNM/2026 — Réhabilitation du réseau d'adduction d'eau potable",
  'B04-FP-03': 'Lot 1 — captage et adduction / Lot 2 — stockage et distribution (un pli par lot)',
  'B04-LG-02':
    "Toute pièce rédigée dans une autre langue que le français est accompagnée d'une traduction française certifiée, "
    + 'seule la version française faisant foi.',
  'B04-OV-01':
    "Salle de réunion de la Direction Générale de la JIRAMA, 149 rue Rainandriamampandry, Antananarivo 101, en séance "
    + 'publique.',
  'B04-OV-02': '2026-10-30',
  'B04-PI-01':
    "L'offre comprend : la lettre de soumission, l'acte d'engagement, le bordereau des prix unitaires, le détail "
    + 'quantitatif et estimatif, le cadre du sous-détail des prix, les fiches de renseignements A1 à A5, la garantie de '
    + "soumission, le planning prévisionnel d'exécution, la note méthodologique, et les pièces administratives exigées.",
  'B04-RP-01': 'OUI',
  'B04-RP-02':
    "Réunion préparatoire et visite conjointe du tracé le 12 octobre 2026 à 9 heures, au départ de la station de "
    + "pompage. La présence n'est pas obligatoire mais vivement recommandée ; un procès-verbal est adressé à tous les "
    + 'candidats ayant retiré le dossier.',
  'B04-VL-01':
    "Les candidats accèdent au tracé et aux ouvrages tous les jours ouvrables de 8 heures à 16 heures jusqu'à cinq "
    + "jours avant la date limite de remise des offres, sur demande écrite adressée au maître d'œuvre. Le candidat "
    + 'supporte seul les frais et les risques de sa visite.',

  // — B05 Prix, montants & garantie de soumission —
  'B05-AG-01':
    "Aucune autre garantie n'est exigée en dehors de la garantie de soumission, de la garantie de bonne exécution, de la "
    + 'garantie de restitution d’avance et de la retenue de garantie.',
  'B05-GA-01': 'OUI',
  'B05-GA-02':
    "L'avance forfaitaire n'est versée que contre une garantie de restitution d'avance à première demande, d'un montant "
    + "égal à celui de l'avance, libérée au fur et à mesure du remboursement de l'avance sur les acomptes mensuels.",
  'B05-GE-01': 'OUI',
  'B05-GE-03': 'Garantie bancaire',
  'B05-GE-04': 'Libérée à 50 % puis au terme du délai de garantie',
  'B05-GQ-02': 'Garantie bancaire',
  'B05-GQ-03': '19000000',
  'B05-MN-01': 'Ariary',
  'B05-RG-01': 'OUI',
  'B05-RG-02': '5',

  // — B06 Évaluation, attribution & notification —
  'B06-EV-01': 'Par lot',
  'B06-PN-01': 'OUI',
  'B06-PN-02': '10',
  'B06-RC-01': '7',

  // — B08 Paiements, avances & garanties financières —
  'B08-AF-02': '190000000',
  'B08-AF-03': '20',
  'B08-AF-04': '100',
  'B08-AF-05': '0',
  'B08-AP-01': 'OUI',
  'B08-AP-02':
    "Les acomptes sur approvisionnements portent sur les matériaux approvisionnés sur le chantier, constatés "
    + 'contradictoirement par le maître d’œuvre, dans la limite de 80 % de leur valeur et sous déduction lors du décompte '
    + 'qui suit leur mise en œuvre.',
  'B08-DB-01': "Groupement d'entrepreneurs solidaires",
  'B08-EF-01': '30',
  'B08-MO-01': '9.5',
  'B08-MR-01': 'NON',
  'B08-MR-02':
    "Les décomptes mensuels sont établis par l'entrepreneur à la fin de chaque mois, sur la base des quantités "
    + "réellement exécutées et constatées contradictoirement avec le maître d'œuvre, et transmis en trois exemplaires.",
  'B08-MR-03':
    "Le règlement s'effectue par application des prix unitaires du bordereau aux quantités réellement exécutées, "
    + 'sous déduction de la retenue de garantie et du remboursement de l’avance.',
  'B08-RE-01':
    "Le maître d'œuvre dispose de quinze jours pour vérifier le décompte, l'ordonnancement intervient dans les trente "
    + 'jours suivants, et le paiement est effectué par virement au compte bancaire indiqué dans l’acte d’engagement.',
  'B08-RE-02': 'NON',

  // — B09 Exécution du marché & livraison —
  'B09-AC-01':
    "L'entrepreneur assure ses installations de chantier, ses engins et ses matériels pour leur valeur de remplacement, "
    + "et justifie de cette assurance avant tout commencement d'exécution.",
  'B09-AC-02':
    "Assurance de responsabilité civile couvrant les dommages corporels et matériels causés aux tiers en cours de "
    + 'chantier et après réception, à hauteur de 200 000 000 Ariary par sinistre.',
  'B09-AC-03':
    "Assurance de responsabilité civile décennale couvrant les dommages compromettant la solidité de l'ouvrage ou le "
    + "rendant impropre à sa destination, pour la durée légale de dix ans à compter de la réception définitive.",
  'B09-CH-01':
    "Les travaux sont exécutés sur un réseau demeurant en service : l'entrepreneur organise son chantier par tronçons "
    + 'successifs, maintient la desserte des abonnés par des dispositifs provisoires, et annonce toute coupure au moins '
    + 'quarante-huit heures à l’avance.',
  'B09-CH-03':
    "Les travaux bruyants sont exécutés entre 12 heures et 14 heures ou en dehors des heures ouvrables, selon le "
    + "calendrier arrêté chaque semaine avec le maître d'œuvre.",
  'B09-DC-01':
    "Par ordre de priorité décroissante : l'acte d'engagement et ses annexes, le cahier des clauses administratives "
    + 'particulières, le cahier des clauses techniques particulières, le bordereau des prix unitaires et le détail '
    + "quantitatif et estimatif, les plans, le cahier des clauses administratives générales, et l'offre de l'entrepreneur.",
  'B09-DL-01':
    "Le délai d'exécution est de douze mois, dont huit mois pour la tranche ferme. Il court à compter de la date de "
    + "notification de l'ordre de service prescrivant de commencer les travaux, et s'achève à la réception provisoire "
    + 'prononcée sans réserve.',
  'B09-DL-02': '21',
  'B09-DL-03':
    "Mois 1 : installation de chantier et piquetage. Mois 2 à 8 : captage, station de pompage et pose des conduites "
    + "d'adduction (tranche ferme). Mois 9 à 12 : réservoir, conduites de distribution, bornes-fontaines et "
    + 'branchements (tranche conditionnelle). Un planning détaillé est remis pendant la période de préparation.',
  'B09-DL-04': '2027-09-30',
  'B09-DL-05': 'OUI',
  'B09-DT-01': "À la notification de l'approbation à l'entrepreneur",
  'B09-FM-01': 'OUI',
  'B09-FM-02':
    "Sont réputés cas de force majeure les cyclones classés par le service météorologique national, les précipitations "
    + "supérieures à 100 millimètres en vingt-quatre heures et les vents dépassant 120 kilomètres par heure, dès lors "
    + "qu'ils empêchent la poursuite des travaux.",
  'B09-GT-01': '12',
  'B09-MA-01':
    "L'augmentation de la masse des travaux ne peut excéder 20 % du montant du marché ; au-delà, l'entrepreneur peut "
    + "demander la résiliation s'il n'accepte pas de poursuivre.",
  'B09-MA-02': "La diminution de la masse des travaux n'ouvre droit à aucune indemnité tant qu'elle reste inférieure à 15 %.",
  'B09-MA-03':
    "Au-delà de 15 % de diminution, l'entrepreneur a droit à une indemnité calculée sur la marge non réalisée, "
    + 'justifiée par ses sous-détails de prix.',
  'B09-MA-04':
    "Le changement dans l'importance des diverses natures d'ouvrage ouvre droit à révision des prix unitaires concernés "
    + "lorsqu'il excède le tiers des quantités portées au détail quantitatif et estimatif.",
  'B09-MD-01':
    "Le délai d'exécution est prolongé par ordre de service en cas d'intempéries dépassant le nombre de journées "
    + "prévisibles, de travaux supplémentaires prescrits, ou de retard imputable au maître de l'ouvrage. La demande est "
    + 'présentée dans les quinze jours suivant le fait générateur.',
  'B09-MD-02': '15',
  'B09-NE-01':
    "Les notifications à l'entrepreneur sont faites par ordre de service remis contre décharge au conducteur de travaux, "
    + "ou adressé par lettre recommandée avec accusé de réception au siège social indiqué dans l'acte d'engagement.",
  'B09-OD-01': 'OUI',
  'B09-OD-02':
    "Le personnel de l'entrepreneur est soumis au contrôle d'accès du site, porte un badge nominatif, et s'interdit toute "
    + "captation d'image ou communication d'information relative aux installations techniques de la JIRAMA.",
  'B09-PE-01': 'OUI',
  'B09-PE-02': '1',
  'B09-PM-01':
    "Le maître de l'ouvrage fournit les compteurs électriques et les équipements de comptage d'eau, pris en charge "
    + "contradictoirement par l'entrepreneur qui en assure la garde et la mise en œuvre.",
  'B09-PT-01': 'OUI',
  'B09-PT-02': '21',
  'B09-PT-03': '15',
  'B09-PT-04':
    "Un plan d'hygiène et de sécurité est remis pendant la période de préparation : organisation des secours, port des "
    + 'équipements de protection individuelle, balisage des zones à risque et protection des usagers du bâtiment.',
  'B09-PV-01': 'NON',
  'B09-RP-01': 'OUI',
  'B09-RP-02':
    "Les opérations préalables comprennent la reconnaissance des ouvrages exécutés, les essais de fonctionnement des "
    + "installations, la constatation des imperfections, et la remise des plans de récolement et des notices d'entretien.",
  'B09-RP-03': '20',
  'B09-RP-04':
    "La réception est prononcée par la personne responsable des marchés publics au vu du procès-verbal des opérations "
    + "préalables établi par le maître d'œuvre. Elle est prononcée séparément pour la tranche ferme et pour la tranche "
    + 'conditionnelle, chacune faisant courir son propre délai de garantie.',
  'B09-VQ-01':
    "Les matériaux et produits font l'objet d'une vérification qualitative avant mise en œuvre : agrément des "
    + "échantillons par le maître d'œuvre, présentation des certificats des conduites et des pièces de raccordement, "
    + "essais de pression sur chaque tronçon posé, et analyse bactériologique avant mise en service.",
  'B09-VX-01': '15',

  // — B10 Modifications, résiliation & litiges —
  'B10-PC-01':
    "Les différends sont d'abord soumis au règlement amiable prévu par le code des marchés publics. À défaut d'accord "
    + 'dans les trente jours, le litige est porté devant le Tribunal administratif d’Antananarivo.',
  'B10-RE-01':
    "Le marché peut être résilié aux torts de l'entrepreneur en cas d'abandon de chantier, de retard supérieur au "
    + "plafond des pénalités, de sous-traitance non autorisée ou de manquement grave persistant quinze jours après mise "
    + 'en demeure restée sans effet.',

  // — B11 Annexes et formulaires (les six formulaires sont des pièces jointes, non saisis) —
  'B11-AN-02':
    "Annexe 2 — bordereau des prix unitaires et détail quantitatif et estimatif, établi lot par lot et distinguant la "
    + 'tranche ferme de la tranche conditionnelle.',
  'B11-AN-03':
    "Annexe 3 — paramètres de la formule de révision des prix : P = P0 (0,15 + 0,85 × I/I0), I étant l'indice national "
    + 'du coût de la construction publié par l’INSTAT.',
  'B11-AN-04': "Annexe 4 — demande d'acceptation des sous-traitants et d'agrément de leurs conditions de paiement.",
  'B11-AN-05': 'Annexe 5 — état des sommes versées à des tiers au titre de la sous-traitance.',
};

// ——————————————————————————————————————————————————————————————————————————————
// B. PRESTATIONS INTELLECTUELLES — Étude du schéma directeur d'assainissement (120 000 000 Ar, 2 lots)
// ——————————————————————————————————————————————————————————————————————————————

export const CADRAGE_PI = {
  alloti: 'OUI',
  nbLots: '2',
  variantes: 'NON',
  groupement: 'OUI',
  formeGroupement: 'SOLIDAIRE_OBLIGATOIRE',
  provenance: 'NATIONAL',
  typePrix: 'FORFAITAIRE',
  prixRevisable: 'NON',
  garantieSoumission: 'NON',
  avance: 'OUI',
  tauxAvance: '20',
  penalites: 'CCAG',
};

export const VALEURS_PI = {
  // — B02 Objet, allotissement & forme du marché —
  'B02-CL-01':
    'JIRO SY RANO MALAGASY (JIRAMA) — 149, rue Rainandriamampandry, Ambohijatovo, Antananarivo 101, Madagascar.',
  'B02-CL-02': 'RANDRIANARIVO La Personne Responsable des Marchés Publics',
  'B02-CL-03': 'Décision n° 012-DG/JIRAMA du 5 janvier 2026 portant délégation de signature en matière de marchés publics.',
  'B02-MS-01': 'Meilleure proposition financière parmi les candidats ayant obtenu la note technique minimale',
  'B02-OP-01':
    "Programme national d'assainissement des centres urbains (2026-2030) : la présente mission en établit le schéma "
    + 'directeur et en prépare la première phase.',
  'B02-OP-02':
    "Étude du schéma directeur d'assainissement (lot 1) et assistance à maîtrise d'ouvrage pour la préparation de la "
    + "première phase de travaux (lot 2), comprenant le diagnostic des réseaux existants, le relevé topographique, la "
    + "modélisation hydraulique, l'évaluation des coûts et l'appui à la passation.",
  'B02-OP-03': '2026-12-01',
  'B02-SP-01': '15',

  // — B03 Candidats : groupement, sous-traitance, qualifications —
  'B03-NP-01': '120000000',
  'B03-SP-01': 'NON',
  'B03-TP-01': 'À compléter par le consultant attributaire dans son acte d’engagement',
  'B03-TP-02': "À compléter par le consultant attributaire (siège social)",
  'B03-TP-03': "À compléter par le consultant attributaire (numéro d'identification fiscale)",
  'B03-TP-04': 'À compléter par le consultant attributaire (nom du représentant)',
  'B03-TP-05': "Représentant légal de l'entreprise",

  // — B04 Dossier, remise & ouverture des offres —
  'B04-AI-01':
    "Le client met à disposition du consultant : les plans des réseaux existants, les données d'exploitation et de "
    + "pluviométrie, l'accès aux ouvrages pendant les heures ouvrables, un bureau équipé pour les réunions, et un "
    + 'interlocuteur unique à la Direction Technique.',
  'B04-DP-01': '90',
  'B04-EP-01':
    "Personne Responsable des Marchés Publics de la JIRAMA, 149 rue Rainandriamampandry, Ambohijatovo, "
    + 'Antananarivo 101 — téléphone 020 22 200 01.',
  'B04-EP-02': 'marches.publics@jirama.mg',
  'B04-EP-03': '15',
  'B04-FL-01': '3',
  'B04-FL-02':
    "Consultation n° 00001/PPM-AGPM/CNM/2026 — Étude de faisabilité et assistance à maîtrise d'ouvrage — "
    + '« À n’ouvrir qu’en séance »',
  'B04-FL-03':
    'Personne Responsable des Marchés Publics de la JIRAMA, 149 rue Rainandriamampandry, Ambohijatovo, Antananarivo 101.',
  'B04-LH-01':
    "Bureau de la Personne Responsable des Marchés Publics, Direction Générale de la JIRAMA, 149 rue "
    + 'Rainandriamampandry, Antananarivo 101, contre décharge.',
  'B04-LH-02': '2026-10-20',
  'B04-LP-01': 'Français',
  'B04-NP-01': 'Une proposition technique et une proposition financière sous enveloppes distinctes',
  'B04-QT-01':
    "Bureau d'études ou groupement justifiant de cinq années d'expérience en assainissement et en assistance à maîtrise "
    + "d'ouvrage, d'au moins trois schémas directeurs achevés en cinq ans, et d'une équipe comprenant un ingénieur "
    + 'hydraulicien, un spécialiste en assainissement, un topographe, un environnementaliste et un spécialiste des '
    + 'marchés publics.',
  'B04-QT-02':
    "La proposition technique comprend : la compréhension des termes de référence, la méthodologie détaillée, le plan de "
    + "travail et le calendrier, la composition de l'équipe avec les curriculum vitæ du personnel clé, les références de "
    + 'missions comparables, et les moyens matériels affectés à la mission.',
  'B04-QT-03':
    "Le client attend une attention particulière sur la modélisation des eaux pluviales en saison cyclonique, sur le "
    + "phasage des travaux en milieu urbain dense, et sur le transfert de compétences aux agents de la Direction "
    + 'Technique.',
  'B04-RU-01': 'OUI',
  'B04-RU-02':
    'Réunion préparatoire le 28 septembre 2026 à 9 heures, salle de réunion de la Direction Générale de la JIRAMA, '
    + '149 rue Rainandriamampandry, Antananarivo — soit vingt-deux jours avant la date limite de remise.',
  'B04-VE-01': 'NON',

  // — B05 Prix, montants & garantie de soumission —
  'B05-PF-01': 'Prix forfaitaire',
  'B05-PF-02': '120000000',
  'B05-PF-11':
    "Sont remboursables sur justificatifs : les déplacements hors d'Antananarivo liés à la mission, les frais de "
    + "reprographie des rapports en cinq exemplaires, et les frais d'essais et de sondages prescrits par le client.",
  'B05-PF-12':
    'Les frais de fonctionnement courants (bureau, communications, informatique, assurances) sont réputés inclus dans le '
    + 'forfait et ne donnent lieu à aucun remboursement séparé.',

  // — B06 Évaluation, attribution & notification —
  'B06-CS-01':
    "Les propositions sont classées par ordre décroissant de la note technique. La proposition financière n'est ouverte "
    + "que pour les candidats ayant obtenu au moins 70 points sur 100 à l'évaluation technique ; le marché est attribué au "
    + 'candidat ayant présenté la proposition financière la moins-disante parmi ceux-là.',
  'B06-NG-01':
    'Les négociations se tiennent au bureau de la Personne Responsable des Marchés Publics, Direction Générale de la '
    + "JIRAMA, 149 rue Rainandriamampandry, Antananarivo 101, dans les dix jours suivant la notification du classement.",
  'B06-OF-01':
    "Les propositions financières des seuls candidats ayant atteint la note technique minimale sont ouvertes en séance "
    + 'publique, en présence des candidats concernés invités par écrit au moins sept jours à l’avance ; les propositions '
    + 'financières des candidats écartés leur sont restituées sans avoir été ouvertes.',
  'B06-TP-01': '100',
  'B06-TP-02': '20',
  'B06-TP-03': '30',
  'B06-TP-04': '35',
  'B06-TP-05': '10',
  'B06-TP-06': '5',

  // — B08 Paiements, avances & garanties financières —
  'B08-AI-02': 'NON',
  'B08-DP-01': 'Groupement de consultants solidaires',
  'B08-IP-01': '9.5',
  'B08-RP-01':
    "Les prestations d'une durée inférieure à trois mois sont réglées en une seule fois, après remise et acceptation du "
    + 'rapport final, dans les trente jours suivant la réception de la facture.',
  'B08-RP-03':
    'Les prestations sont réglées par étapes : 20 % à la notification (avance), 30 % à la remise du rapport de '
    + "diagnostic, 30 % à la remise de l'étude de faisabilité, et 20 % à l'acceptation du rapport final de la mission "
    + "d'assistance.",

  // — B09 Exécution du marché & livraison —
  'B09-AI-01': 'OUI',
  'B09-AI-02':
    "Le client fournit pendant l'exécution : les archives techniques des réseaux, les relevés d'exploitation, l'accès "
    + 'aux ouvrages, et la désignation d’un correspondant technique permanent.',
  'B09-AP-01': '50000000',
  'B09-DK-01':
    "Sont contractuels, par ordre de priorité : l'acte d'engagement, les données particulières des instructions aux "
    + 'consultants, le cahier des clauses administratives particulières, les termes de référence, et la proposition '
    + 'technique et financière du consultant.',
  'B09-DP-01': "Le marché prend effet à la date de notification de son approbation au consultant.",
  'B09-DP-02':
    "Le délai d'exécution est de six mois : trois mois pour le diagnostic et le schéma directeur (lot 1), trois mois "
    + "pour l'assistance à maîtrise d'ouvrage jusqu'à l'attribution des travaux de première phase (lot 2).",
  'B09-DP-03': 'Nombre de mois',
  'B09-DP-04': '6',
  'B09-MF-01': 'NON',
  'B09-MS-01': 'OUI',
  'B09-MV-01': '30',
  'B09-NC-01': "À compléter par le consultant attributaire : adresse détaillée, téléphone et adresse électronique.",
  'B09-OP-01':
    "Chaque livrable est remis en trois exemplaires papier et sous forme numérique. Le client dispose de quinze jours "
    + "pour l'agréer, formuler des observations ou le rejeter par écrit ; le silence gardé au-delà vaut agrément.",
  'B09-PP-01': 'OUI',
  'B09-UR-01':
    "Les résultats des prestations, rapports, plans et bases de données deviennent la propriété du client, qui peut les "
    + "utiliser et les reproduire librement. Toute publication ou communication à un tiers par le consultant est soumise "
    + "à l'accord écrit préalable du client.",

  // — B10 Modifications, résiliation & litiges —
  'B10-IN-01': '10',
  'B10-PP-01':
    "Les différends sont d'abord soumis au règlement amiable prévu par le code des marchés publics. À défaut d'accord "
    + 'dans les trente jours, le litige est porté devant le Tribunal administratif d’Antananarivo.',
};

// ——————————————————————————————————————————————————————————————————————————————
// C. FOURNITURES À COMMANDE — [DÉMO] Fourniture de consommables informatiques, 2 lots
//
// ⚠️ Transcrit d'un dossier RÉEL : `NatureMarches/DAO_Fournitures/Fourniture_a_commande.pdf` (MESupReS, AOO
// n° 2461/MT/…/2026, matériels informatiques en cinq lots, à commande). Les clauses, délais, méthodes et formes
// sont ceux du dossier ; l'acheteur et l'objet, eux, viennent de la ligne du plan de démonstration (JIRAMA) et le
// marché est ramené à ses **deux** lots. Les quatre informations qui varient par lot portent des valeurs
// distinctes, dont les deux montants de garantie du dossier d'origine (1 600 000 et 2 170 000 Ariary).
// ——————————————————————————————————————————————————————————————————————————————

export const CADRAGE_AC = {
  alloti: 'OUI',
  nbLots: '2',
  variantes: 'NON',
  groupement: 'NON',
  provenance: 'NATIONAL',
  typePrix: 'UNITAIRES',
  prixRevisable: 'NON',
  garantieSoumission: 'OUI',
  avance: 'OUI',
  tauxAvance: '20',
  penalites: 'CCAG',
};

/** Les quatre informations qui varient d'un lot à l'autre — clés `CODE#1`, `CODE#2` posées par le script. */
export const VALEURS_AC_PAR_LOT = {
  'B05-GS-03': { 1: '1600000', 2: '2170000' },
  'B05-TP-02': { 1: '40000000', 2: '54000000' },
  'B05-TP-03': { 1: '80000000', 2: '108500000' },
  'B06-EO-12': { 1: '30', 2: '30' },
};

export const VALEURS_AC = {
  // — B02 Objet, allotissement & forme du marché —
  'B02-AU-02': 'Lot par lot (attribution divisible)',
  'B02-AU-03':
    "Les quantités minimales et maximales de chaque lot sont spécifiées au Cahier des Prescriptions Spéciales. "
    + 'Lot 1 — ordinateurs et matériels divers pour le siège : minimum 40 unités, maximum 80 unités. '
    + 'Lot 2 — ordinateurs et matériels pour les directions régionales : minimum 54 unités, maximum 110 unités.',
  'B02-AU-04': '12',
  'B02-AU-05': '2026-12-15',
  'B02-AU-07': '1',
  'B02-OB-02':
    "Fourniture et livraison de consommables et matériels informatiques : ordinateurs de bureau et portables, "
    + "imprimantes, onduleurs, consommables d'impression et accessoires réseau, avec installation, mise en service et "
    + "garantie constructeur. Les services connexes comprennent le transport jusqu'à la destination finale, le "
    + "déballage, le montage et la formation des utilisateurs à la prise en main des équipements.",
  'B02-OB-03': "AOO n° 2461/MT/JSRM/PRMP/UGPM.2026",

  // — B03 Candidats : groupement, sous-traitance, qualifications —
  'B03-CQ-01':
    "Photocopie certifiée conforme de la carte d'immatriculation fiscale de l'exercice en cours, de l'extrait du "
    + "registre du commerce et de la carte statistique, chacune datée de moins de trois mois, et certificat de non "
    + 'faillite de moins de trois mois.',
  'B03-CQ-02':
    "Fiche de renseignements A2 : moyens humains et matériels, références en fourniture de matériels informatiques, "
    + "capacité à assurer le service après-vente et la maintenance sur le territoire national.",
  'B03-CQ-03':
    "Fiche de renseignements A3 : chiffre d'affaires des trois derniers exercices et attestation bancaire de capacité "
    + 'financière permettant de préfinancer une commande.',
  'B03-CQ-04':
    "Fiche de renseignements A4 : antécédents du candidat pour des marchés de même nature au cours des trois dernières "
    + 'années, justifiés par des certificats de bonne fin ou des procès-verbaux de réception.',
  'B03-CQ-05': 'NON',
  'B03-CQ-06':
    "Agrément du fabricant ou du distributeur agréé pour les matériels proposés, et engagement de disponibilité des "
    + 'pièces détachées pendant la durée de la garantie.',
  'B03-CQ-07': "Sans objet pour ce marché.",
  'B03-CQ-08': 'NON',
  'B03-NA-01': 'OUI',
  'B03-NA-02':
    "Le nantissement de la créance est admis dans les conditions du Code des marchés publics ; le titulaire en informe "
    + "l'autorité contractante et le comptable assignataire.",
  'B03-NA-03': 'Trésorier ministériel chargé de l’Énergie et des Hydrocarbures',
  'B03-ST-01': 'NON',

  // — B04 Dossier, remise & ouverture des offres —
  'B04-CD-01':
    "Modèles de fiches de renseignements A1 (identification du candidat), A2 (capacités techniques), A3 (capacités "
    + 'financières) et A4 (antécédents pour des marchés de même nature).',
  'B04-CD-02':
    "Modèles de garantie de soumission joints au dossier : B1 — garantie bancaire, B2 — caution personnelle et "
    + 'solidaire.',
  'B04-CO-01':
    "Outre les pièces mentionnées aux instructions aux candidats : photocopie certifiée conforme de la carte "
    + "d'immatriculation fiscale de l'exercice en cours, extrait du registre du commerce et carte statistique de moins "
    + "de trois mois, certificat de non faillite de moins de trois mois, et garantie de soumission.",
  'B04-DE-01':
    "Personne Responsable des Marchés Publics de la JIRAMA — 149, rue Rainandriamampandry, Ambohijatovo, "
    + 'Antananarivo 101 — marches.publics@jirama.mg',
  'B04-DE-02': '10',
  'B04-DE-03': '5',
  'B04-LA-01': 'NON',
  'B04-LR-01': 'RANDRIANARIVO La Personne Responsable des Marchés Publics',
  'B04-LR-02':
    "Bureau de la Personne Responsable des Marchés Publics, 2ᵉ étage, porte 204 — Direction Générale de la JIRAMA, "
    + '149 rue Rainandriamampandry, Ambohijatovo, Antananarivo 101.',
  'B04-LR-03': '2026-11-16',
  'B04-LR-04': '10 h 00',
  'B04-OP-01': "Salle de réunion, 2ᵉ étage, porte 204 — Direction Générale de la JIRAMA, en séance publique.",
  'B04-OP-02': '2026-11-16',
  'B04-OP-03': '10 h 00',
  'B04-RO-01': '1',
  'B04-RO-02': "AOO n° 2461/MT/JSRM/PRMP/UGPM.2026 — « Ne pas ouvrir avant la date et l'heure d'ouverture des plis »",
  'B04-RO-03':
    "Les offres sont présentées en plis séparés pour chacun des lots. L'enveloppe extérieure porte la mention de "
    + "l'appel d'offres, le numéro et l'intitulé du lot, et ne comporte aucune indication permettant d'identifier le "
    + 'candidat. Elle contient deux enveloppes intérieures fermées et scellées à la cire, portant les mêmes mentions '
    + "ainsi que le nom et l'adresse du candidat : l'une marquée ORIGINAL, l'autre COPIE.",
  'B04-VE-01': 'NON',
  'B04-VO-01': '75',

  // — B05 Prix, montants & garantie de soumission —
  'B05-CP-02':
    "Pour les fournitures acquises sur le territoire national, le prix comprend : le prix des fournitures EXW (magasin "
    + "de vente) hors TVA ; le prix des transports intérieurs, l'assurance et les autres services locaux afférents à la "
    + 'livraison des fournitures jusqu’à leur destination finale.',
  'B05-GS-02': 'Garantie bancaire',
  'B05-GS-04': '105',
  'B05-MO-01': 'Ariary',
  'B06-AN-01': 'Garantie bancaire',
  'B06-AN-02':
    "Tout candidat écarté peut demander par écrit les motifs du rejet de sa candidature ou de son offre ; la Personne "
    + 'Responsable des Marchés Publics répond dans les vingt jours. Le recours gracieux puis le recours devant '
    + "l'organe de régulation s'exercent dans les conditions du Code des marchés publics.",
  'B06-EO-01': 'Par lot',
  'B06-EO-02': "Aucun critère additionnel n'est retenu.",
  'B06-EO-04':
    "Ne sont pas pris en compte dans l'évaluation : la taxe sur la valeur ajoutée applicable à Madagascar sur la vente "
    + "des fournitures et des services connexes, ni les droits et taxes dus en douane sur les fournitures importées.",
  'B06-EO-05':
    "Le montant évalué de l'offre est le prix de l'offre, corrigé des erreurs arithmétiques et des rabais offerts. "
    + "Les offres sont évaluées par lot ; le marché porte sur le lot ou les lots attribués au candidat qualifié ayant "
    + "présenté l'offre conforme pour l'essentiel et évaluée économiquement la plus avantageuse.",
  'B06-EO-06':
    "Après évaluation, la Personne Responsable des Marchés Publics compare toutes les offres substantiellement "
    + "conformes pour déterminer l'offre évaluée la moins-disante, lot par lot.",
  'B06-EO-07':
    "La Commission calcule une première moyenne des offres évaluées, puis écarte comme anormalement hautes celles qui "
    + "la dépassent de plus de 20 %. Elle calcule ensuite une seconde moyenne après neutralisation de ces offres, et "
    + "déclare anormalement basses celles qui lui sont inférieures de plus de 10 %. Le rejet est prononcé après avis "
    + 'motivé de la Commission et explications demandées au candidat.',
  'B06-EO-08':
    "La Personne Responsable des Marchés Publics vérifie, avant attribution, que le candidat ayant présenté l'offre "
    + "évaluée la moins-disante possède bien les qualifications requises et n'est frappé d'aucune exclusion.",
  'B06-EP-01': '3',

  // — B08 Paiements, avances & garanties financières —
  'B08-AC-01': 'NON',
  'B08-AV-04': 'Garantie bancaire',
  'B08-AV-05':
    "L'avance forfaitaire est remboursée par précompte sur les sommes dues au titulaire, au fur et à mesure des "
    + "livraisons, de sorte qu'elle soit entièrement remboursée lorsque le montant des paiements atteint 80 % du "
    + 'montant du marché.',
  'B08-AV-06': '20',
  'B08-GB-01': 'OUI',
  'B08-GB-02': '5',
  'B08-IM-01': '9.5',
  'B08-PA-01':
    "L'acheteur se libère des sommes dues en en faisant porter le montant au crédit du compte bancaire indiqué par le "
    + "titulaire dans l'acte d'engagement (titulaire du compte, établissement, agence, numéro et code).",
  'B08-PA-03':
    "Les factures sont établies en trois exemplaires, après chaque livraison, et accompagnées du bon de commande, du "
    + 'bon de livraison et du procès-verbal de réception signé.',
  'B08-PA-04':
    "Le paiement intervient sur présentation de la facture et du procès-verbal de réception, après service fait, par "
    + 'virement au compte du titulaire.',
  'B08-PA-05': 'À la livraison',
  'B08-PA-08': '30',
  'B08-RG-01': 'NON',

  // — B09 Exécution du marché & livraison —
  'B09-AS-01': "À la charge du fournisseur jusqu'à la livraison",
  'B09-CR-01': 'NON',
  'B09-DG-01': '12',
  'B09-DG-02':
    "La garantie couvre le remplacement ou la réparation, sans frais pour l'acheteur, de tout matériel présentant un "
    + 'défaut de fabrication ou de fonctionnement, pièces et main-d’œuvre comprises.',
  'B09-DI-01':
    "Les matériels reconnus non conformes aux spécifications techniques sont refusés et remplacés par le titulaire "
    + "dans un délai de dix jours, à ses frais ; le procès-verbal d'inspection en fait mention.",
  'B09-DX-01': '30',
  'B09-DX-02':
    "Le délai court à compter du lendemain de la date de notification de chaque bon de commande, et non de la "
    + 'notification du marché.',
  'B09-DX-03':
    "Les commandes sont passées par bons de commande successifs pendant la durée de validité du marché, selon les "
    + "besoins de l'acheteur et dans la limite des quantités maximales de chaque lot.",
  'B09-EM-01':
    "Chaque emballage porte la référence du marché, le numéro du lot, la désignation du matériel, la quantité et la "
    + "mention de l'acheteur destinataire.",
  'B09-EM-02':
    "Chaque livraison est accompagnée du bon de livraison, de la facture, des certificats de garantie et des notices "
    + "d'utilisation en français.",
  'B09-IV-01':
    "Les matériels sont vérifiés à la livraison en présence du titulaire : contrôle de conformité aux spécifications "
    + 'techniques, essais de mise en service et vérification des accessoires.',
  'B09-LF-01':
    "Les livraisons s'effectuent en une ou plusieurs fois, sur bon de commande, aux heures ouvrables et sur rendez-vous "
    + 'pris au moins deux jours ouvrables à l’avance.',
  'B09-LF-02':
    "Bon de livraison, facture, certificats de garantie, notices d'utilisation et procès-verbal de mise en service.",
  'B09-LL-01':
    "Direction des Infrastructures et du Patrimoine de la JIRAMA — 149, rue Rainandriamampandry, Ambohijatovo, "
    + 'Antananarivo 101 (lot 1) ; directions régionales désignées au bon de commande (lot 2).',
  'B09-MC-01': 'NON',
  'B09-OM-01': '15',
  'B09-OM-02': '20',
  'B09-OM-03': '12',
  'B09-PC-01':
    "Le bon de commande, le bordereau des prix unitaires et les spécifications techniques complètent les pièces "
    + 'contractuelles du marché.',
  'B09-PC-02':
    "Annexe 1 : cadre du bordereau des prix. Annexe 2 : état des sommes versées à des tiers. Annexe 3 : formulaire de "
    + 'déclaration des bénéficiaires effectifs.',
  'B09-PS-01': 'NON',
  'B09-RT-01': "Transport par le fournisseur jusqu'à la destination finale",
  'B09-SK-01': 'NON',

  // — B10 Modifications, résiliation & litiges —
  'B10-AR-01':
    "Les différends sont d'abord soumis au règlement amiable prévu par le Code des marchés publics ; à défaut d'accord "
    + "dans les trente jours, le litige est porté devant le Tribunal administratif d'Antananarivo.",
  'B10-IR-01': 'OUI',
  'B10-IR-02':
    "En cas de résiliation du fait de l'acheteur, le titulaire est indemnisé des fournitures livrées et acceptées, et "
    + 'des approvisionnements constitués pour les commandes déjà notifiées.',
};

// ——————————————————————————————————————————————————————————————————————————————
// D. FOURNITURES À QUANTITÉ FIXE — Mobilier de bureau des directions régionales, 85 000 000 Ar, NON alloti
//
// ⚠️ Cette fiche portait, depuis le 22/09, le texte d'essai de la recette de la chaîne (« Recette fiche marché
// 2026-09-22 — texte jetable »), et ses documents l'imprimaient. Elle devient la quatrième démonstration : la
// forme la plus courante — fournitures et services à quantité fixe, un seul lot — que les trois autres ne
// montraient pas. Les clauses suivent le dossier réel du classeur `NatureMarches/DAO_Fournitures`.
// ——————————————————————————————————————————————————————————————————————————————

export const CADRAGE_QF = {
  alloti: 'NON',
  variantes: 'NON',
  groupement: 'NON',
  provenance: 'NATIONAL',
  typePrix: 'UNITAIRES',
  prixRevisable: 'NON',
  garantieSoumission: 'OUI',
  avance: 'OUI',
  tauxAvance: '10',
  penalites: 'CCAG',
};

export const VALEURS_QF = {
  // — B02 Objet, allotissement & forme du marché —
  'B02-AU-01':
    "Le marché n'est pas alloti : il porte sur un ensemble mobilier homogène destiné aux directions régionales, dont "
    + "la cohérence de gamme et de finition doit être appréciée d'un seul tenant.",
  'B02-OB-02':
    "Fourniture et livraison de mobilier de bureau : bureaux et retours, fauteuils de travail et sièges visiteurs, "
    + "armoires et caissons de rangement, tables de réunion et vestiaires, conformes aux spécifications techniques. "
    + 'Les services connexes comprennent le transport jusqu’aux directions régionales, le déballage, le montage sur '
    + "place et l'enlèvement des emballages.",
  'B02-OB-03': 'AOO n° 2470/MT/JSRM/PRMP/UGPM.2026',

  // — B03 Candidats —
  'B03-CQ-01':
    "Photocopie certifiée conforme de la carte d'immatriculation fiscale de l'exercice en cours, de l'extrait du "
    + 'registre du commerce et de la carte statistique, chacune de moins de trois mois, et certificat de non '
    + 'faillite de moins de trois mois.',
  'B03-CQ-02':
    "Fiche de renseignements A2 : moyens humains et matériels, capacité de stockage et de transport vers les régions, "
    + 'et références en fourniture de mobilier de bureau.',
  'B03-CQ-03':
    "Fiche de renseignements A3 : chiffre d'affaires des trois derniers exercices et attestation bancaire de "
    + 'capacité financière.',
  'B03-CQ-04':
    "Fiche de renseignements A4 : deux marchés de même nature au moins, achevés au cours des trois dernières "
    + 'années, justifiés par des certificats de bonne fin ou des procès-verbaux de réception.',
  'B03-CQ-05': 'OUI',
  'B03-CQ-06':
    "Le mobilier proposé est conforme aux normes EN 527 (tables de travail), EN 1335 (sièges de bureau) et EN 14073 "
    + "(mobilier de rangement) ; les fiches techniques et les certificats correspondants sont joints à l'offre.",
  'B03-CQ-07': "Sans objet pour ce marché.",
  'B03-CQ-08': 'OUI',
  'B03-NA-01': 'OUI',
  'B03-NA-02':
    "Le nantissement de la créance est admis dans les conditions du Code des marchés publics ; le titulaire en "
    + "informe l'autorité contractante et le comptable assignataire.",
  'B03-NA-03': 'Trésorier ministériel chargé de l’Énergie et des Hydrocarbures',
  'B03-ST-01': 'NON',

  // — B04 Dossier, remise & ouverture des offres —
  'B04-CD-01':
    "Modèles de fiches de renseignements A1 (identification du candidat), A2 (capacités techniques), A3 (capacités "
    + 'financières) et A4 (antécédents pour des marchés de même nature).',
  'B04-CD-02':
    "Modèles de garantie de soumission : B1 — garantie bancaire, B2 — caution personnelle et solidaire.",
  'B04-CO-01':
    "Lettre de soumission, acte d'engagement, bordereau des prix unitaires et détail quantitatif et estimatif, "
    + "fiches de renseignements A1 à A4, garantie de soumission, certificats de conformité des équipements, et "
    + 'pièces administratives de moins de trois mois.',
  'B04-DE-01':
    "Personne Responsable des Marchés Publics de la JIRAMA — 149, rue Rainandriamampandry, Ambohijatovo, "
    + 'Antananarivo 101 — marches.publics@jirama.mg',
  'B04-DE-02': '10',
  'B04-DE-03': '5',
  'B04-LA-01': 'NON',
  'B04-LR-01': 'RANDRIANARIVO La Personne Responsable des Marchés Publics',
  'B04-LR-02':
    "Bureau de la Personne Responsable des Marchés Publics, Direction Générale de la JIRAMA, 149 rue "
    + 'Rainandriamampandry, Ambohijatovo, Antananarivo 101, contre décharge.',
  // ⚠️ Le contrôle DATES_ORDRE compare au calendrier PRÉVISIONNEL du plan : cette ligne y porte une attribution
  // au 27/03/2026. La remise et l'ouverture doivent donc la précéder, sans quoi la fiche est invalidable.
  'B04-LR-03': '2026-02-16',
  'B04-LR-04': '10 h 00',
  'B04-OP-01': 'Salle de réunion de la Direction Générale de la JIRAMA, en séance publique.',
  'B04-OP-02': '2026-02-16',
  'B04-OP-03': '10 h 00',
  'B04-RO-01': '1',
  'B04-RO-02': "AOO n° 2470/MT/JSRM/PRMP/UGPM.2026 — « Ne pas ouvrir avant la date et l'heure d'ouverture des plis »",
  'B04-RO-03':
    "L'enveloppe extérieure porte la mention de l'appel d'offres et ne comporte aucune indication permettant "
    + "d'identifier le candidat. Elle contient deux enveloppes intérieures fermées et scellées, portant les mêmes "
    + "mentions ainsi que le nom et l'adresse du candidat : l'une marquée ORIGINAL, l'autre COPIE.",
  'B04-VE-01': 'NON',
  'B04-VO-01': '90',

  // — B05 Prix, montants & garantie de soumission —
  'B05-CP-02':
    "Le prix comprend : le prix des fournitures EXW (magasin de vente) hors TVA ; le prix des transports "
    + "intérieurs, l'assurance et les autres services locaux afférents à la livraison jusqu'à leur destination "
    + 'finale.',
  'B05-GS-02': 'Garantie bancaire',
  'B05-GS-03': '1700000',
  'B05-GS-04': '120',
  'B05-MO-01': 'Ariary',

  // — B06 Évaluation, attribution & notification —
  'B06-AN-01': 'Garantie bancaire',
  'B06-AN-02':
    "Tout candidat écarté peut demander par écrit les motifs du rejet de son offre ; la Personne Responsable des "
    + 'Marchés Publics répond dans les vingt jours. Le recours gracieux puis le recours devant l’organe de '
    + 'régulation s’exercent dans les conditions du Code des marchés publics.',
  'B06-EO-02': "Aucun critère additionnel n'est retenu.",
  'B06-EO-04':
    "Ne sont pas pris en compte dans l'évaluation : la taxe sur la valeur ajoutée applicable à Madagascar sur la "
    + 'vente des fournitures et des services connexes, ni les droits et taxes dus en douane.',
  'B06-EO-05':
    "Le montant évalué de l'offre est le prix de l'offre, corrigé des erreurs arithmétiques et des rabais offerts, "
    + 'et ajusté de la marge de préférence nationale lorsque le candidat y a droit.',
  'B06-EO-06':
    "La Personne Responsable des Marchés Publics compare les offres substantiellement conformes pour déterminer "
    + "l'offre évaluée la moins-disante.",
  'B06-EO-07':
    "La Commission calcule une première moyenne des offres évaluées, puis écarte comme anormalement hautes celles "
    + 'qui la dépassent de plus de 20 %. Elle calcule ensuite une seconde moyenne après neutralisation de ces '
    + 'offres, et déclare anormalement basses celles qui lui sont inférieures de plus de 10 %.',
  'B06-EO-08':
    "La Personne Responsable des Marchés Publics vérifie, avant attribution, que le candidat ayant présenté l'offre "
    + "évaluée la moins-disante possède les qualifications requises et n'est frappé d'aucune exclusion.",
  'B06-EO-09': '10',
  'B06-EO-10': '20',
  'B06-EO-11': '45',
  'B06-EP-01': '3',

  // — B08 Paiements, avances & garanties financières —
  'B08-AC-01': 'NON',
  'B08-AV-04': 'Garantie bancaire',
  'B08-AV-05':
    "L'avance forfaitaire de 10 % est versée contre garantie bancaire de restitution, et remboursée par précompte "
    + 'sur les sommes dues au fur et à mesure des livraisons.',
  'B08-AV-06': '10',
  'B08-GB-01': 'OUI',
  'B08-GB-02': '5',
  'B08-IM-01': '9.5',
  'B08-PA-01':
    "L'acheteur se libère des sommes dues en en faisant porter le montant au crédit du compte bancaire indiqué par "
    + "le titulaire dans l'acte d'engagement.",
  'B08-PA-03':
    'Les factures sont établies en trois exemplaires après chaque livraison, accompagnées du bon de livraison et '
    + 'du procès-verbal de réception signé.',
  'B08-PA-04':
    "Le paiement intervient après service fait, sur présentation de la facture et du procès-verbal de réception, "
    + 'par virement au compte du titulaire.',
  'B08-PA-05': 'À la livraison',
  'B08-PA-08': '30',
  'B08-RG-01': 'OUI',
  'B08-RG-02': '5',

  // — B09 Exécution du marché & livraison —
  'B09-AS-01': "À la charge du fournisseur jusqu'à la livraison",
  'B09-AS-02': "La responsabilité du fournisseur cesse à la réception prononcée sans réserve.",
  'B09-CR-01': 'NON',
  'B09-DG-01': '12',
  'B09-DG-02':
    "La garantie couvre le remplacement ou la réparation sans frais de tout élément présentant un défaut de "
    + 'fabrication, de finition ou de stabilité.',
  'B09-DI-01':
    "Le mobilier reconnu non conforme est refusé et remplacé par le titulaire dans un délai de dix jours, à ses "
    + "frais ; le procès-verbal d'inspection en fait mention.",
  'B09-DX-01': '45',
  'B09-EM-01':
    "Chaque emballage porte la référence du marché, la désignation de l'article, ses dimensions, la quantité et la "
    + "direction régionale destinataire.",
  'B09-EM-02':
    'Chaque livraison est accompagnée du bon de livraison, de la facture, des fiches techniques et des notices de '
    + 'montage en français.',
  'B09-IV-01':
    "Le mobilier est vérifié à la livraison en présence du titulaire : contrôle des références et des dimensions, "
    + 'vérification des quantités, essai de stabilité et contrôle des finitions sur échantillon.',
  'B09-LF-01':
    'La livraison s’effectue en une seule fois, aux heures ouvrables, sur rendez-vous pris au moins deux jours '
    + 'ouvrables à l’avance.',
  'B09-LF-02':
    "Bon de livraison, facture, certificats de conformité aux normes et notices d'utilisation.",
  'B09-LL-01':
    'Directions régionales désignées au bordereau de livraison, transport et montage sur place compris ; le magasin '
    + "central d'Antananarivo sert de point de regroupement.",
  'B09-MC-01': 'NON',
  'B09-OM-01': '15',
  'B09-OM-02': '20',
  'B09-PC-01':
    'Le bordereau des prix unitaires, le détail quantitatif et estimatif et les spécifications techniques '
    + 'complètent les pièces contractuelles du marché.',
  'B09-PC-02':
    "Annexe 1 : cadre du bordereau de prix. Annexe 2 : état des sommes versées à des tiers. Annexe 3 : formulaire "
    + 'de déclaration des bénéficiaires effectifs.',
  'B09-PS-01': 'NON',
  'B09-RT-01': "Transport par le fournisseur jusqu'à la destination finale",
  'B09-SK-01': 'NON',

  // — B10 Modifications, résiliation & litiges —
  'B10-AR-01':
    "Les différends sont d'abord soumis au règlement amiable prévu par le Code des marchés publics ; à défaut "
    + "d'accord dans les trente jours, le litige est porté devant le Tribunal administratif d'Antananarivo.",
  'B10-DD-01': 'Néant.',
  'B10-IR-01': 'OUI',
  'B10-IR-02':
    "En cas de résiliation du fait de l'acheteur, le titulaire est indemnisé des fournitures livrées et acceptées "
    + 'et des approvisionnements constitués.',
};

// ——————————————————————————————————————————————————————————————————————————————
// E. LE DOSSIER RÉEL — MESupReS, AOO n° 2463-MI/MESupReS/PRMP/UGPM.2026
//    « Fourniture et livraison des matériels informatiques répartis en CINQ (5) lots (à commande) »
//
// Transcription FIDÈLE du dossier publié (DPAO, CCAP et acte d'engagement), pour la ligne semée par
// `scripts/jeu-donnees-dao-2463.mjs`. Ce qui le distingue du jeu « à commande » précédent :
//   · CINQ lots, donc cinq cellules pour chacune des quatre informations « par lot » ;
//   · un plafond de pénalités à 10 % — DÉROGATION au CCAG (15 %), assumée et justifiée au CCAP ;
//   · aucune garantie de bonne exécution, aucune retenue de garantie (CCAP art. 12) ;
//   · un délai de garantie de DEUX mois — seconde dérogation, la seule que le CCAP récapitule ;
//   · deux lots au maximum par candidat, chaque lot indivisible.
// ——————————————————————————————————————————————————————————————————————————————

export const CADRAGE_2463 = {
  alloti: 'OUI',
  nbLots: '5',
  variantes: 'NON',
  groupement: 'NON', // « Groupements : non applicable » (DPAO, clause 2)
  provenance: 'NATIONAL',
  typePrix: 'UNITAIRES',
  prixRevisable: 'NON',
  garantieSoumission: 'OUI',
  avance: 'OUI',
  tauxAvance: '20',
  penalites: 'PLAFOND_DIFFERENT', // 10 % au lieu des 15 % du CCAG
};

/**
 * Les cinq informations qui varient d'un lot à l'autre, pour les cinq lots du dossier réel.
 * ⚠️ Source unique des faits : docs/jeu-donnees-2463-faits.md — [R] repris tel quel (page citée), [D] déduit, [H] hypothèse.
 */
export const VALEURS_2463_PAR_LOT = {
  // [R] DPAO 6.6 p.18 : les montants EXACTS de la garantie de soumission.
  'B05-GS-03': { 1: '1600000', 2: '2170000', 3: '1600000', 4: '2170000', 5: '1600000' },
  // [D] §5 : montant minimum = maximum ÷ 2 (les quantités min valent la moitié des max sur tous les bordereaux).
  'B05-TP-02': { 1: '40000000', 2: '54250000', 3: '40000000', 4: '54250000', 5: '40000000' },
  // [D] §5 : montant maximum = garantie ÷ 2 % (le dossier laisse les montants en blanc, AE p.38).
  'B05-TP-03': { 1: '80000000', 2: '108500000', 3: '80000000', 4: '108500000', 5: '80000000' },
  // [R] DPAO 12 p.19, CCAP 10.a p.50 : « fixé dans le bon de commande, sans toutefois dépasser TRENTE (30) JOURS ».
  'B06-EO-12': { 1: '30', 2: '30', 3: '30', 4: '30', 5: '30' },
  // [R] CCAP art. 1 et 17 p.49, 51 — les destinations finales, dans les mots du dossier.
  'B09-LL-01': { 1: 'MINISTERE FIADANANA', 2: 'AMBATONDRAZAKA', 3: 'AMBATONDRAZAKA', 4: 'FORT DAUPHIN', 5: 'FORT DAUPHIN' },
};

/**
 * Les informations communes aux cinq lots. Le jeu « à commande » du 25/09 (VALEURS_AC) était déjà tiré de ce
 * dossier ; tout ce qui s'en écarte est repris ici, dans les mots du dossier quand il parle.
 * ⚠️ Rien n'est inventé dans le code : une valeur que le dossier ne donne pas a sa ligne [H] ou [D] dans
 * docs/jeu-donnees-2463-faits.md (§10). Les anomalies du dossier (§9) sont CONSERVÉES : ce sont des cas de test.
 */
export const VALEURS_2463 = {
  ...VALEURS_AC,
  // ⚠️ B02-AU-03 (« Quantités minimum et maximum ») est DÉSACTIVÉ depuis le 25/09 : le besoin (B12) le porte.
  'B02-AU-03': undefined,

  // — Acheteur, objet et références du dossier réel —
  // B02-OB-01 (objet) est un champ PPM : c'est la ligne du plan qui le porte (jeu-donnees-dao-2463.mjs, [R] p.1).
  // [R] DPAO 1.2 p.17, tel quel — ⚠️ anomalie §9 conservée : « matériels et mobiliers de logements » (reste d'un
  // autre dossier) pour un marché de matériels informatiques. C'est un cas de test, pas une coquille à corriger.
  'B02-OB-02':
    "L'appel d'offres porte sur un marché à commandes des matériels et mobiliers de logements dont les quantités "
    + 'minimales et maximales sont spécifiées au Cahier des Prescriptions Spéciales, et pour une durée de validité '
    + 'de douze (12) mois.',
  'B02-OB-03': 'AOO n° 2463-MI/MESupReS/PRMP/UGPM.2026', // [R] p.1, AE p.36
  'B02-AU-02': 'Lot par lot (attribution divisible)', // [R] DPAO 1.1 p.17 : « Chaque lot est indivisible. Toute offre partielle est irrecevable. »
  'B02-AU-04': '12', // [R] DPAO 1.2 p.17, CCAP 10.b p.50
  'B02-AU-05': '2027-01-28', // [H] §8 : notification / date d'effet
  'B02-AU-07': '2', // [R] DPAO 1.1 p.17 : « ne peut prétendre qu'à deux lots au maximum »

  // — Candidats : pièces exigées, capacités, nantissement — (DPAO 6.1 et 6.3 p.17-18, AE art. 3-4 p.38)
  'B03-CQ-01':
    "Photocopie certifiée conforme à l'original de la Carte d'Immatriculation Fiscale 2026 ou 2025 validée, datée de "
    + "moins de 3 mois ; photocopie certifiée conforme à l'original de l'Extrait du Registre de Commerce daté de moins "
    + "de 3 mois ; carte statistique, photocopie certifiée conforme à l'original, datée de moins de 3 mois ; certificat "
    + 'de non faillite daté de moins de 3 mois.', // [R] DPAO 6.1
  'B03-CQ-02': 'Une fiche de renseignements relative à sa capacité technique (modèle A2), signée avec la mention « certifiée exacte et sincère ».', // [R] DPAO 6.3
  'B03-CQ-03': 'Une fiche de renseignements relative à sa capacité financière (modèle A3), signée avec la mention « certifiée exacte et sincère ».', // [R] DPAO 6.3
  'B03-CQ-04': "Non exigé : la clause 6.3 du DPAO ne demande que les fiches d'identification, de capacité technique et de capacité financière.", // [D] §10
  'B03-CQ-05': 'NON', // [R] sommaire p.2 : « Modèle d'attestation du fabricant – Non utilisé »
  'B03-CQ-06': 'Aucune qualification particulière au-delà des pièces de la clause 6.1 et des fiches de la clause 6.3 du DPAO.', // [D] §10
  'B03-CQ-07': 'Non prévu par le DPAO.', // [D] §10
  'B03-CQ-08': 'NON', // [R] DPAO 9.5 p.19
  'B03-NA-01': 'OUI', // [R] AE art. 4 p.38
  'B03-NA-02':
    "Est désigné comme comptable assignataire des paiements le Trésorier ministériel chargé de l'Enseignement ; le "
    + 'montant maximal de la créance qui pourra être nantie par le fournisseur est à compléter par le candidat, en '
    + "lettres et en chiffres, à l'acte d'engagement.", // [R] AE art. 4 p.38
  'B03-NA-03': 'Trésorier ministériel chargé de l’Enseignement', // [R] AE art. 4 p.38
  'B03-ST-01': 'NON', // [R] AE art. 3 p.38

  // — Dossier, remise et ouverture — (DPAO 5 à 8 p.17-19)
  'B04-CD-01': 'A1,A2,A3,A4', // [R] sommaire p.2, DPAO 5.1 : modèles de fiches de renseignements joints
  'B04-CD-02': 'C1 et C2', // [R] DPAO 5.1 : modèles de garantie de soumission joints (p.33-34)
  'B04-CO-01':
    "Documents ou pièces à remettre en sus de ceux mentionnés à la clause 6.2 des IC : photocopie certifiée conforme à "
    + "l'original de la Carte d'Immatriculation Fiscale 2026 ou 2025 validée, datée de moins de 3 mois ; photocopie "
    + "certifiée conforme à l'original de l'Extrait du Registre de Commerce daté de moins de 3 mois ; carte statistique "
    + "(photocopie certifiée conforme à l'original) datée de moins de 3 mois ; certificat de non faillite daté de moins "
    + 'de 3 mois ; garantie de soumission.', // [R] DPAO 6.1
  'B04-DE-01':
    'Personne Responsable des Marchés Publics — Attention de : Monsieur LERAVO Norbert Fidelys — Porte 204, 2ème Etage - '
    + 'MESupReS — Fiadanana - Antananarivo, code postal 101 — E-mail : prmp.mesupres@gmail.com', // [R] DPAO 5.2
  'B04-DE-02': '10', // [R] DPAO 5.2
  'B04-DE-03': '5', // [R] DPAO 5.2
  'B04-LA-01': 'NON', // [D] §10 : le DPAO ne prévoit aucune langue en plus du français
  'B04-LR-01': 'Monsieur LERAVO Norbert Fidelys, Personne Responsable des Marchés Publics', // [R] DPAO 7.2
  'B04-LR-02': 'Porte 204, 2ème Etage - MESupReS, Fiadanana - Antananarivo, code postal 101.', // [R] DPAO 7.2
  'B04-LR-03': '2026-11-09', // [H] §8 (le dossier laisse la date en pointillés — anomalie §9)
  'B04-LR-04': 'Dix (10) heures', // [R] DPAO 7.2
  'B04-OP-01': 'Bureau : Porte 204, 2ème Etage - MESupReS', // [R] DPAO 8
  'B04-OP-02': '2026-11-09', // [R] DPAO 8 : « le même jour que la date limite fixée pour la remise des offres »
  'B04-OP-03': 'DIX HEURES (10H)', // [R] DPAO 8
  'B04-RO-01': '1', // [R] DPAO 7.1 : « UNE (01) copie »
  // [R] DPAO 7.1 p.18, tel quel — ⚠️ anomalie §9 conservée : la mention cite « AOO N° 2461/MT » pour le dossier 2463-MI.
  'B04-RO-02':
    'AOO N° 2461/MT /MESupReS/PRMP/UGPM.2026 — Offre relative à « FOURNITURE ET LIVRAISON DES MATERIELS INFORMATIQUES '
    + 'REPARTIS EN CINQ (5) LOTS (A COMMANDE) » — « Ne pas ouvrir avant la date et l’heure d’ouverture des plis »',
  'B04-RO-03':
    "Les offres devront être dans des plis séparés présentées pour chacun des lots. Outre l'original de l'offre, le pli "
    + "doit comprendre UNE (01) copie. Les enveloppes comportent la mention de l'appel d'offres, l'objet de l'offre, le "
    + "numéro et l'intitulé du lot auquel se rapporte l'offre, « Attention de : Monsieur LERAVO Norbert Fidelys, Porte "
    + "204, 2ème Etage - MESupReS » et « Ne pas ouvrir avant la date et l'heure d'ouverture des plis », à l'exclusion de "
    + "l'indication permettant d'identifier le candidat. Cette enveloppe extérieure contient deux enveloppes intérieures "
    + 'fermées, scellées à la cire, comportant les mêmes mentions ainsi que le nom et l’adresse du candidat : l’une '
    + 'portant la mention ORIGINALE, l’autre la mention COPIE.', // [R] DPAO 7.1
  'B04-VE-01': 'NON', // [R] DPAO 7.3
  'B04-VO-01': '75', // [R] DPAO 6.4

  // — Prix, monnaie, garantie de soumission — (DPAO 6.5-6.6 p.18, CCAP 8-9 p.50)
  'B05-CP-02':
    'Pour les Fournitures acquises sur le territoire national, le prix comprend : i) le prix des fournitures EXW, '
    + '(magasin de ventes) ; ii) le prix des transports intérieurs, assurance et autres services locaux afférents à la '
    + 'livraison des fournitures jusqu’à leur destination finale.', // [R] DPAO 6.5.1
  // [H] §10 : le dossier admet TROIS formes (garantie bancaire, caution personnelle et solidaire, chèque de banque au
  // nom du Receveur Général d'Antananarivo — DPAO 6.6) ; le référentiel n'en retient qu'une → « Garantie bancaire ».
  'B05-GS-02': 'Garantie bancaire',
  'B05-GS-04': '105', // [R] modèles C1/C2 p.33-34 : « jusqu'au 105ème jour »
  'B05-MO-01': 'Ariary', // [R] CCAP 9.3, AE art. 2

  // — Évaluation, attribution — (DPAO 9 p.19)
  'B06-EO-01': 'Par lot', // [R] DPAO 9.4
  'B06-EO-02': 'Non applicable.', // [R] DPAO 9.4 : « Critère additionnel : non applicable »
  'B06-EO-04':
    "Le prix du Marché est supposé comprendre l'ensemble des impôts, droits et taxes de toute nature dus par le "
    + "Fournisseur au titre de la signature et de l'exécution du Marché.", // [R] CCAP 8.1 p.50
  'B06-EO-05':
    'Les offres seront évaluées par lot et le marché portera sur le lot ou les lots attribués au candidat qualifié '
    + 'ayant proposé l’offre conforme pour l’essentiel et évaluée économiquement avantageuse pour le lot ou les lots '
    + 'considérés.', // [R] DPAO 9.4
  'B06-EO-07':
    "Afin d'identifier le caractère anormalement bas ou haut d'une offre, la CAO effectuera les calculs suivants : "
    + "calcul d'une 1ère moyenne des offres soumises sur la base de l'évaluation réalisée en termes monétaires ; "
    + 'identification des offres se situant à un pourcentage supérieur à 20 % — toutes les offres dont l’évaluation '
    + 'excède la moyenne augmentée de ce pourcentage seront déclarées offres anormalement hautes ; calcul d’une 2nde '
    + 'moyenne après neutralisation des offres anormalement hautes ; identification des offres se situant à un '
    + 'pourcentage inférieur à 10 % — toutes les offres dont l’évaluation est inférieure à cette 2nde moyenne diminuée '
    + 'de ce pourcentage seront déclarées offres anormalement basses.', // [R] DPAO 9.4.5
  'B06-EP-01': '3', // [R] DPAO 9.1

  // — Paiements, avances et garanties financières — (AE art. 6 p.38, CCAP 9 et 12 p.50-51)
  'B08-AC-01': 'NON', // [R] CCAP 9.1.b
  'B06-AN-01': undefined, // aucune garantie de bonne exécution exigée : pas de forme à déclarer (CCAP 12.1)
  'B08-GB-02': undefined, // idem
  'B08-GB-01': 'NON', // [R] CCAP 12.1 : « Non applicable »
  'B08-RG-01': 'NON', // [R] CCAP 12.2 : « Aucune retenue de garantie ne sera pratiquée »
  // [H] §10 : le CCAP 9.4 dit « taux directeur de la BCM … augmenté d'un (01) point » ; le référentiel veut un nombre.
  'B08-IM-01': '9',
  'B08-PA-01':
    "L'Acheteur se libérera des sommes dues au titre du présent marché en en faisant porter le montant au crédit du "
    + "compte bancaire indiqué par le fournisseur à l'acte d'engagement : titulaire du compte, établissement bancaire, "
    + 'agence, numéro de compte, code.', // [R] AE art. 6.1
  'B08-PA-03':
    'Les factures seront établies en quatre (04) exemplaires : un original et 3 copies portant, outre les mentions '
    + 'légales, les indications suivantes : le nom et adresse du Fournisseur ; le numéro du compte bancaire tel qu’il '
    + 'est précisé sur l’Acte d’Engagement ; les références du Marché ; le montant hors taxe des fournitures livrées ; '
    + 'le montant dû en Ariary ; la date de facturation.', // [R] CCAP 9.2
  'B08-PA-04': 'Les factures seront établies à la livraison.', // [R] CCAP 9.2
  'B08-PA-05': 'À la livraison', // [R] CCAP 9.2
  'B08-PA-08': '30', // [H] §10

  // — Exécution, livraison, garantie — (CCAP 10 à 23 p.50-52)
  'B09-AS-01': "Selon l'incoterm", // [R] CCAP art. 18 : « conformément aux dispositions de l'Incoterms »
  'B09-CR-01': 'NON', // [R] CCAP art. 19
  'B09-DG-01': '2', // [R] CCAP art. 22 : DEUX (02) MOIS — dérogation à l'article 23 du CCAG (CCAP art. 24)
  'B09-DG-02':
    'Les fournitures doivent être garanties contre tout risque de fabrication ou de matière pendant DEUX (02) MOIS à '
    + 'compter de la date de réception provisoire. Durant ce délai de garantie, le Fournisseur se conforme aux garanties '
    + 'de performance spécifiées en vertu du Marché ; si, pour des raisons imputables au Fournisseur, ces garanties ne '
    + 'sont pas atteintes, il apporte aux fournitures, à ses frais, les changements, modifications et/ou adjonctions '
    + 'nécessaires pour atteindre les garanties contractuelles.', // [R] CCAP art. 22
  'B09-DI-01':
    'Sur demande du fournisseur, pour chaque commande, la réception prononcée à la livraison par une commission de '
    + "réception désignée par une décision de l'Acheteur vaudra réception provisoire de la commande. La réception "
    + "définitive de la commande sera prononcée dans les mêmes formes à l'issue du délai de garantie ; la réception "
    + "définitive de la dernière commande vaudra réception définitive du marché. À l'issue des opérations d'inspection, "
    + "la commission de réception prend sa décision de réception, d'ajournement, de réfaction ou de rejet dans un délai "
    + 'de deux (2) jours.', // [R] CCAP art. 21
  'B09-DX-01': '30', // [R] CCAP 10.a
  'B09-DX-02': 'À compter du lendemain de la date de notification de chaque bon de commande.', // [R] CCAP 10.a
  'B09-DX-03':
    'Le délai de livraison est fixé dans le bon de commande sans toutefois dépasser TRENTE (30) JOURS à compter du '
    + 'lendemain de la date de notification dudit bon de commande. Chaque bon de commande précisera : la nature et la '
    + "description des prestations à réaliser ; les délais d'exécution ; les lieux d'exécution ; le montant du bon de "
    + 'commande ; les délais laissés le cas échéant aux Fournisseurs pour formuler leurs observations. Seuls les bons de '
    + "commande signés par l'Ordonnateur Secondaire pourront être honorés. La durée de validité est de 12 mois à compter "
    + "de la date d'effet.", // [R] CCAP 10.a et 10.b
  'B09-EM-01': 'Emballage d’origine.', // [R] CCAP art. 15
  'B09-EM-02': "Aucun document particulier n'est exigé dans les emballages (CCAP art. 15 : emballage d'origine).", // [D] §10
  'B09-IV-01':
    'Les vérifications et inspections des fournitures sont effectuées au lieu de destination finale, au moment de la '
    + 'livraison. Tous les frais y afférents sont à la charge totale du fournisseur.', // [R] CCAP art. 20
  'B09-LF-01':
    'Les fournitures seront livrées au : lot n° 1 : MINISTERE FIADANANA ; lot n° 2 : AMBATONDRAZAKA ; lot n° 3 : '
    + 'AMBATONDRAZAKA ; lot n° 4 : FORT DAUPHIN ; lot n° 5 : FORT DAUPHIN. Les documents de livraison doivent être reçus '
    + "par la Personne Responsable des Marchés Publics avant l'arrivée des fournitures, faute de quoi le Fournisseur est "
    + "responsable de toute dépense subséquente. La livraison est constatée par la délivrance d'un récépissé au "
    + "Fournisseur ou par la signature d'un double du bulletin de livraison ou de l'état.", // [R] CCAP art. 17
  'B09-LF-02':
    'Cinq (05) exemplaires de la facture du Fournisseur indiquant la description des Fournitures, leurs quantités, '
    + "leurs prix unitaires, le montant total, la date de l'expédition, la référence à la commande ou au Marché, "
    + "l'identification du Fournisseur, l'identification des fournitures livrées et, quand il y a lieu, leur répartition "
    + 'par colis ; le bon de livraison, ou le récépissé du transporteur.', // [R] CCAP art. 17
  'B09-LL-01': undefined, // par lot (VALEURS_2463_PAR_LOT)
  'B09-MC-01': 'NON', // [R] CCAP art. 13 : « Sans objet »
  'B09-OM-01': '10', // [R] CCAP art. 6
  'B09-OM-02': '20', // [R] CCAP art. 6
  'B09-OM-03': '12', // [R] CCAP art. 6 et 10.b
  'B09-PC-01': "Aucune pièce supplémentaire : l'ordre de priorité des pièces contractuelles est celui fixé par l'article 6 du CCAG (CCAP art. 5).", // [D] §10
  'B09-PC-02': 'Annexe n° 1 : cadre du bordereau de prix. Annexe n° 2 : état des sommes versées à des tiers. Annexe n° 3 : formulaire de déclaration des bénéficiaires effectifs.', // [R] AE p.38
  'B09-PS-01': 'NON', // [R] CCAP art. 7
  'B09-RT-01': "Transport par le fournisseur jusqu'à la destination finale", // [R] CCAP art. 16
  'B09-SK-01': 'OUI', // [R] CCAP art. 14 : « Quantité minimale prévue dans le bordereau de prix »

  // — Pénalités : la dérogation du dossier — (CCAP art. 11 p.50-51)
  'B09-PR-02': '10',
  'B09-PR-03':
    "CCAP art. 11 : « En cas de retard dans l'exécution de chaque commande, il est appliqué une pénalité journalière "
    + 'de 1/1000 du montant de la commande. Le montant des pénalités est plafonné à dix pour cent (10 %) du montant du '
    + 'Marché, y compris le montant de ses avenants. » — dérogation au plafond de 15 % du CCAG (art. 12), que le '
    + "tableau des dérogations de l'article 24 du CCAP ne récapitule pas.", // [R] + constat §9

  // — Litiges et dérogations — (CCAP art. 23-24 p.52)
  'B10-AR-01': 'Aucune clause particulière au CCAP : le règlement des différends suit le CCAG.', // [D] §10
  'B10-IR-01': 'OUI',
  'B10-IR-02': "Les dispositions de l'article 32 du CCAG s'appliquent.", // [R] CCAP art. 23
  'B10-DD-01': "Article 22 du CCAP (délai de garantie de deux mois) dérogeant à l'article 23 du CCAG — seule dérogation récapitulée à l'article 24 du CCAP.", // [R] CCAP art. 24
};

// ——————————————————————————————————————————————————————————————————————————————
// LE BESOIN DU DOSSIER 2463 — bloc B12, douze articles répartis en cinq lots.
//
// Quantités : cadres de bordereaux des prix, pages 40 à 44 du dossier publié.
// Caractéristiques exigées : spécifications techniques, pages 57 à 61.
// Les lots 4 et 5 reprennent à l'identique les lots 2 et 3 — c'est le cas réel qui valide
// le geste « Dupliquer depuis le lot n ».
// ——————————————————————————————————————————————————————————————————————————————

const ORDI_I5_MINISTERE = {
  designation: 'Ordinateur de bureau complet Core i5',
  unite: 'U',
  caracteristiques: [
    ['Processeur', 'Core i5'],
    ['Mémoire vive', '8 Go'],
    ['Stockage', 'SSD 500 Go'],
    ['Moniteur', 'LCD 22 pouces au minimum'],
    ['Clavier', 'AZERTY'],
    ['Souris', 'Souris optique USB'],
    ['Lecteur optique', 'Lecteur / graveur DVD'],
    ["Système d'exploitation", 'Windows 10 ou supérieur, édition Professional 64 bits, français installé'],
  ],
};

const ONDULEUR = {
  designation: 'Onduleur',
  unite: 'U',
  caracteristiques: [
    ['État', 'Matériel neuf sous emballage'],
    ["Capacité d'alimentation en sortie", '390 Watts / 1200 VA au minimum'],
  ],
};

const KIT_I3 = {
  designation: "Kit de matériels informatiques : ordinateur de bureau complet Core i3 + onduleur + imprimante jet d'encre",
  unite: 'U',
  caracteristiques: [
    ['Processeur', 'Core i3'],
    ['Mémoire vive', '8 Go'],
    ['Stockage', 'SSD 500 Go'],
    ['Moniteur', 'LCD 19 pouces au minimum'],
    ["Système d'exploitation", 'Windows 10 ou supérieur, édition Professional 64 bits, français installé'],
    ['Onduleur', 'Matériel neuf sous emballage, 390 Watts / 700 VA au minimum'],
    ['Imprimante', 'Couleur 4-en-1 : impression, numérisation, copie, télécopie — depuis PC, MAC et USB'],
  ],
};

const KIT_I5 = {
  designation: 'Kit de matériels informatiques : ordinateur de bureau complet Core i5 + onduleur',
  unite: 'U',
  caracteristiques: [
    ['Processeur', 'Core i5'],
    ['Mémoire vive', '16 Go'],
    ['Stockage', 'SSD 1 000 Go'],
    ['Moniteur', 'LCD 22 pouces au minimum'],
    ["Système d'exploitation", 'Windows 10 ou supérieur, édition Professional 64 bits, français installé'],
    ['Onduleur', 'Matériel neuf sous emballage, 390 Watts / 700 VA au minimum'],
  ],
};

const IMPRIMANTE_LASER = {
  designation: 'Imprimante laser noir multifonction A4',
  unite: 'U',
  caracteristiques: [
    ['Couleur', 'Noir et blanc'],
    ['Fonctions', 'Impression, copie, scan'],
    ['Format', 'A4'],
    ['État', 'Matériel neuf sous emballage'],
  ],
};

const PHOTOCOPIEUSE = {
  designation: 'Photocopieuse noir A4 et A3',
  unite: 'U',
  caracteristiques: [
    ['Fonctions', 'Impression, copie, scan'],
    ['Format', 'A4 et A3'],
    ['Accessoire', 'Stand avec roulettes'],
    ['État', 'Matériel neuf sous emballage'],
  ],
};

const DUPLICOPIEUR = {
  designation: 'Duplicopieur noir et blanc A4',
  unite: 'U',
  caracteristiques: [
    ['Dimension', 'A4'],
    ['Accessoires', 'Interface USB 2.0'],
    ['État', 'Matériel neuf sous emballage'],
  ],
};

/** `[article, quantité minimum, quantité maximum]`, lot par lot. */
const BESOIN_PAR_LOT = {
  1: [[ORDI_I5_MINISTERE, 15, 30], [ONDULEUR, 10, 20]],
  2: [[KIT_I3, 8, 16], [KIT_I5, 13, 26]],
  3: [[IMPRIMANTE_LASER, 3, 6], [PHOTOCOPIEUSE, 1, 2], [DUPLICOPIEUR, 1, 2]],
  4: [[KIT_I3, 8, 16], [KIT_I5, 13, 26]],
  5: [[IMPRIMANTE_LASER, 3, 6], [PHOTOCOPIEUSE, 1, 2], [DUPLICOPIEUR, 1, 2]],
};

export const ARTICLES_2463 = Object.entries(BESOIN_PAR_LOT).flatMap(([lot, lignes]) =>
  lignes.map(([article, quantiteMin, quantiteMax]) => ({
    lot: Number(lot),
    designation: article.designation,
    unite: article.unite,
    quantiteMin,
    quantiteMax,
    caracteristiques: article.caracteristiques.map(([libelle, exigence]) => ({ libelle, exigence })),
  })),
);
