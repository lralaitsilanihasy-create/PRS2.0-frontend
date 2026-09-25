// Les deux dossiers de démonstration, tels qu'arbitrés le 24/09/2026
// (docs/proposition-2026-09-24-demonstration-dao-travaux-prestations.md).
// Aucune valeur n'est mise au hasard : chacune se tient avec les autres et passe les contrôles du serveur.

// ——————————————————————————————————————————————————————————————————————————————
// A. TRAVAUX — [DÉMO] Travaux de réhabilitation du bâtiment administratif (450 000 000 Ar, 2 lots)
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
    "Tranche ferme — lot 1 : gros œuvre et étanchéité du bâtiment administratif (reprise des fondations et du dallage, "
    + "réfection de la charpente et de la couverture, étanchéité des terrasses et des descentes d'eaux pluviales). "
    + 'Montant : 300 000 000 Ariary.',
  'B02-LT-04':
    "Tranche conditionnelle 1 — lot 2 : second œuvre et réseaux (cloisons, menuiseries intérieures et extérieures, "
    + "peinture, installation électrique, plomberie sanitaire et réseaux informatiques). Montant : 150 000 000 Ariary. "
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
    "Programme pluriannuel de remise à niveau du siège administratif de la JIRAMA (2026-2028), dont le présent marché "
    + 'constitue la première phase.',
  'B02-OT-02':
    "Réhabilitation du bâtiment administratif R+2 d'une surface de 1 850 m² : reprise structurelle des poteaux et "
    + "planchers dégradés, réfection complète de la charpente et de la couverture en bac acier, étanchéité des deux "
    + 'terrasses, remplacement des cloisons et des menuiseries, reprise des installations électriques et sanitaires, '
    + "création d'un réseau informatique structuré, peinture intérieure et extérieure, et remise en état des abords "
    + 'immédiats (voirie piétonne et évacuation des eaux pluviales).',

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
    + 'conducteur de travaux à plein temps sur le chantier, et du matériel de gros œuvre nécessaire (bétonnière, '
    + 'échafaudages, engins de levage).',
  'B03-QT-03':
    "Le candidat justifie d'une capacité financière permettant de préfinancer trois mois de travaux, attestée par une "
    + "ligne de crédit bancaire ou par les états financiers certifiés des trois derniers exercices.",
  'B03-QT-04':
    "Au moins deux marchés de réhabilitation de bâtiment d'un montant unitaire supérieur à 200 000 000 Ariary, achevés "
    + 'au cours des trois dernières années, justifiés par des attestations de bonne exécution.',
  'B03-QT-05': 'NON',
  'B03-QT-06':
    "Pour le lot 1, une qualification en travaux de gros œuvre et étanchéité ; pour le lot 2, une qualification en "
    + "installations électriques courants forts et courants faibles délivrée par l'organisme compétent.",
  'B03-QT-07': '350000000',
  'B03-QT-08':
    "Réhabilitation d'un bâtiment administratif ou assimilé, en site occupé, comprenant gros œuvre, couverture et "
    + "étanchéité, exécutée en qualité d'entrepreneur principal au cours des cinq dernières années.",
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
    "Plans joints au dossier : plan de masse au 1/500, plans des trois niveaux au 1/100, coupes et façades au 1/100, "
    + "plan de charpente et de couverture au 1/50, schéma de principe des réseaux électriques et sanitaires.",
  'B04-DV-01': '90',
  'B04-EQ-01': '15',
  'B04-EQ-02': '7',
  'B04-FP-01': '3',
  'B04-FP-02': "Appel d'offres ouvert n° 00001/PPM-AGPM/CNM/2026 — Réhabilitation du bâtiment administratif",
  'B04-FP-03': 'Lot 1 — gros œuvre et étanchéité / Lot 2 — second œuvre et réseaux (un pli par lot)',
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
    "Réunion préparatoire et visite conjointe du site le 12 octobre 2026 à 9 heures, au bâtiment administratif de la "
    + "JIRAMA, 149 rue Rainandriamampandry, Antananarivo. La présence n'est pas obligatoire mais vivement recommandée ; "
    + "un procès-verbal est adressé à tous les candidats ayant retiré le dossier.",
  'B04-VL-01':
    "Les candidats accèdent au site tous les jours ouvrables de 8 heures à 16 heures jusqu'à cinq jours avant la date "
    + "limite de remise des offres, sur demande écrite adressée au maître d'œuvre. Le candidat supporte seul les frais et "
    + 'les risques de sa visite.',

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
  'B05-GQ-03': '9000000',
  'B05-MN-01': 'Ariary',
  'B05-RG-01': 'OUI',
  'B05-RG-02': '5',

  // — B06 Évaluation, attribution & notification —
  'B06-EV-01': 'Par lot',
  'B06-PN-01': 'OUI',
  'B06-PN-02': '10',
  'B06-RC-01': '7',

  // — B08 Paiements, avances & garanties financières —
  'B08-AF-02': '90000000',
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
    "Les travaux sont exécutés dans un bâtiment administratif demeurant en activité : l'entrepreneur organise son "
    + 'chantier par zones successives, maintient les circulations et les issues de secours, et limite les nuisances '
    + 'sonores aux plages horaires convenues.',
  'B09-CH-03':
    "Les travaux bruyants sont exécutés entre 12 heures et 14 heures ou en dehors des heures ouvrables, selon le "
    + "calendrier arrêté chaque semaine avec le maître d'œuvre.",
  'B09-DC-01':
    "Par ordre de priorité décroissante : l'acte d'engagement et ses annexes, le cahier des clauses administratives "
    + 'particulières, le cahier des clauses techniques particulières, le bordereau des prix unitaires et le détail '
    + "quantitatif et estimatif, les plans, le cahier des clauses administratives générales, et l'offre de l'entrepreneur.",
  'B09-DL-01':
    "Le délai d'exécution est de huit mois, dont cinq mois pour la tranche ferme. Il court à compter de la date de "
    + "notification de l'ordre de service prescrivant de commencer les travaux, et s'achève à la réception provisoire "
    + 'prononcée sans réserve.',
  'B09-DL-02': '21',
  'B09-DL-03':
    "Mois 1 : installation de chantier et dépose. Mois 2 à 5 : reprises structurelles, charpente, couverture et "
    + 'étanchéité (tranche ferme). Mois 6 à 8 : cloisons, menuiseries, électricité, plomberie, réseaux et peinture '
    + '(tranche conditionnelle). Un planning détaillé est remis pendant la période de préparation.',
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
    + "échantillons par le maître d'œuvre, présentation des procès-verbaux d'essais des bétons et des aciers, et contrôle "
    + "de conformité aux normes visées au cahier des clauses techniques particulières.",
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
// B. PRESTATIONS INTELLECTUELLES — [DÉMO] Étude de faisabilité et AMO (120 000 000 Ar, 2 lots)
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
    "Programme pluriannuel de remise à niveau du siège administratif de la JIRAMA (2026-2028) : la présente mission en "
    + 'prépare et en accompagne les travaux.',
  'B02-OP-02':
    "Étude de faisabilité de la réhabilitation du siège administratif (lot 1) et assistance à maîtrise d'ouvrage pour la "
    + "préparation, la passation et le suivi des travaux (lot 2), comprenant le diagnostic technique du bâti, "
    + "l'évaluation des coûts, l'étude des variantes d'aménagement et l'appui au suivi du chantier.",
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
    "Le client met à disposition du consultant : les plans d'archives du bâtiment, les rapports de diagnostic antérieurs, "
    + "l'accès au site pendant les heures ouvrables, un bureau équipé pour les réunions, et un interlocuteur unique à la "
    + 'Direction des Infrastructures et du Patrimoine.',
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
    "Bureau d'études ou groupement justifiant de cinq années d'expérience en études de bâtiment et en assistance à "
    + "maîtrise d'ouvrage, d'au moins trois missions comparables achevées en cinq ans, et d'une équipe comprenant un "
    + 'architecte, un ingénieur structure, un économiste de la construction et un spécialiste des marchés publics.',
  'B04-QT-02':
    "La proposition technique comprend : la compréhension des termes de référence, la méthodologie détaillée, le plan de "
    + "travail et le calendrier, la composition de l'équipe avec les curriculum vitæ du personnel clé, les références de "
    + 'missions comparables, et les moyens matériels affectés à la mission.',
  'B04-QT-03':
    "Le client attend une attention particulière sur le diagnostic structurel du bâtiment en site occupé, sur le "
    + "phasage des travaux permettant la continuité du service, et sur le transfert de compétences aux agents de la "
    + 'Direction des Infrastructures.',
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
    "Le client fournit pendant l'exécution : les archives techniques du bâtiment, les relevés de consommation, l'accès "
    + 'aux locaux et aux installations, et la désignation d’un correspondant technique permanent.',
  'B09-AP-01': '50000000',
  'B09-DK-01':
    "Sont contractuels, par ordre de priorité : l'acte d'engagement, les données particulières des instructions aux "
    + 'consultants, le cahier des clauses administratives particulières, les termes de référence, et la proposition '
    + 'technique et financière du consultant.',
  'B09-DP-01': "Le marché prend effet à la date de notification de son approbation au consultant.",
  'B09-DP-02':
    "Le délai d'exécution est de six mois : deux mois pour le diagnostic et l'étude de faisabilité (lot 1), quatre mois "
    + "pour l'assistance à maîtrise d'ouvrage jusqu'à l'attribution des travaux (lot 2).",
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
