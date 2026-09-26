# D'où vient chaque information de la fiche DAO — correspondance avec le dossier réel

*25/09/2026, mis à jour le 26/09. Fiche marché **13** (ligne 303089, jeu rejoué sur base vide) ↔ dossier d'appel d'offres*
*`AOO n° 2463-MI/MESupReS/PRMP/UGPM.2026`, 86 pages, déposé par le pilote.*
*Chaque information portée à la fiche est ici rattachée à sa **page** et à sa **clause** dans le dossier.*

## Comment lire ce document

La colonne **source** donne la page du PDF et la clause : `DPAO §6.6, p. 18` renvoie aux Données
Particulières de l'Appel d'Offres, clause 6.6, page 18 ; `CCAP art. 11, p. 50` au Cahier des Clauses
Administratives Particulières ; `AE art. 5.2, p. 38` à l'acte d'engagement ; `IC §9.4.5, p. 13` aux
Instructions aux Candidats ; `BP lot n, p. 40-44` aux cadres de bordereaux des prix.

La colonne **nature** dit ce qu'on a fait de la source :

| | |
|---|---|
| **repris** | la valeur est celle du dossier, mot pour mot ou au chiffre près |
| **reformulé** | même règle, rédigée pour tenir dans le champ (le dossier est parfois un paragraphe entier) |
| **déduit** | le dossier ne donne pas la valeur, elle se calcule à partir de ce qu'il donne — le calcul est écrit |
| **hypothèse** | le dossier est **muet ou en blanc** sur ce point : la valeur est un choix de notre jeu de données, signalé comme tel |

Le dossier compte **86 pages**. La fiche en couvrait trois parties — les données particulières (p. 16-19), l'acte
d'engagement (p. 35-39) et le cahier des clauses administratives particulières (p. 47-52).

⚠️ **Depuis le soir du 25/09, elle en couvre six.** Le bloc **`B12 — Besoin`** porte les articles, leurs quantités
et leurs caractéristiques exigées : le dossier en tire aussi les **bordereaux des prix** (p. 40-44), les **tableaux
de conformité technique** (p. 57-61) et la **liste des fournitures et calendrier de livraison** (p. 62-66). Les
formulaires **A1 à A4** et les garanties **C1/C2** (p. 22-34) sont générés sur un gabarit provisoire, en attendant
les modèles officiels. Ce qui reste hors fiche est listé en fin de document.

---

## Le cadrage — les onze questions posées avant la saisie

| question | réponse | source | nature |
|---|---|---|---|
| Marché alloti | **Oui, 5 lots** | page de garde, p. 1 ; DPAO §1.1, p. 17 | repris |
| Variantes autorisées | **Non** | DPAO §1.1, p. 17 — « Les variantes ne sont pas prises en considération » | repris |
| Groupement | **Non** | DPAO §2, p. 17 — « Non applicable » | repris |
| Provenance des fournitures | **Territoire national** | DPAO §6.5.1, p. 18 — prix EXW magasin de ventes + transports intérieurs | repris |
| Type de prix | **Prix unitaires** | AE art. 2, p. 38 — « par application des prix unitaires du Bordereau des Prix » | repris |
| Prix révisable | **Non** | DPAO §6.5.2, p. 18 — « Les prix sont fermes et non révisables » | repris |
| Garantie de soumission | **Oui** | DPAO §6.6, p. 18 | repris |
| Avance forfaitaire | **Oui, 20 %** | AE art. 6.2, p. 38 (le fournisseur accepte ou refuse l'avance) ; **CCAP §9.1.a, p. 50, est laissé EN BLANC** | hypothèse |
| Pénalités de retard | **Plafond différent du CCAG** | CCAP art. 11, p. 50 — 1/1000 par jour, plafond **10 %** (CCAG : 15 %) | repris |
| Forme du marché | **À commande** | page de garde, p. 1 ; DPAO §1.2, p. 17 | repris |
| Catégorie | **Fournitures et services** | page de garde, p. 1 ; CCAG applicable aux marchés de fournitures, p. 67 | repris |

---

## B02 — Objet, allotissement & forme du marché

| information | valeur portée | source | nature |
|---|---|---|---|
| `B02-OB-02` Type de fournitures et services connexes | ordinateurs Core i3/i5, onduleurs, imprimantes, photocopieuses, duplicopieurs ; transport, assurance, mise en service | Spécifications techniques, p. 57-61 ; objet p. 1 | reformulé |
| `B02-OB-03` Numéro du dossier | `AOO n° 2463-MI/MESupReS/PRMP/UGPM.2026` | page de garde, p. 1 ; AE, p. 36 | repris |
| `B02-AU-02` Attribution des lots | Lot par lot (attribution divisible) | DPAO §1.1, p. 17 — « Chaque lot est indivisible » ; DPAO §9.4.3, p. 19 — attribution par lot | repris |
| `B02-AU-07` Nombre maximum de lots par candidat | **2** | DPAO §1.1, p. 17 — « ne peut prétendre qu'à deux lots au maximum » | repris |
| ~~`B02-AU-03` Quantités minimum et maximum~~ | ⚠️ **champ désactivé le 25/09** — les quantités sont désormais portées **article par article** par le bloc `B12`, plus par une phrase de renvoi | DPAO §1.2, p. 17 ; BP lots 1 à 5, p. 40-44 | *remplacé par le besoin* |
| `B02-AU-04` Durée de validité du marché (mois) | **12** | DPAO §1.2, p. 17 ; CCAP art. 10.b, p. 50 ; AE art. 5.3, p. 38 | repris |
| `B02-AU-05` Date d'effet du marché | 28/01/2027 | AE art. 5.1, p. 38 — « à compter de la notification » ; la date vient du **calendrier prévisionnel du plan** (notification, étape 129) | déduit |

## B03 — Candidats : groupement, sous-traitance, qualifications

| information | valeur portée | source | nature |
|---|---|---|---|
| `B03-CQ-01` Pièces d'identification et situation juridique | carte d'immatriculation fiscale 2026 ou 2025, registre du commerce, carte statistique, certificat de non-faillite — chacun de moins de 3 mois | DPAO §6.1, p. 17 | repris |
| `B03-CQ-02` Capacité technique | fiche de renseignements A2 | DPAO §6.3, p. 17-18 ; formulaire A2, p. 26-27 | repris |
| `B03-CQ-03` Capacité financière | fiche de renseignements A3 | DPAO §6.3, p. 18 ; formulaire A3, p. 28-30 | repris |
| `B03-CQ-04` Marchés similaires | fiche de renseignements A4 | formulaire A4, p. 31 ; sommaire, p. 2 | repris |
| `B03-CQ-05` Autorisation du fabricant exigée | **Non** | sommaire, p. 2 — « Modèle d'attestation du fabriquant – **Non utilisé** » | repris |
| `B03-CQ-06` Qualifications particulières | agrément du fabricant ou du distributeur agréé | IC §6.3, p. 8 (faculté ouverte) ; le dossier ne l'exige pas | hypothèse |
| `B03-CQ-07` Communautés locales et ONG | sans objet | IC §6.3, p. 8 ; non repris au DPAO | hypothèse |
| `B03-CQ-08` Préférence nationale accordée | **Non** | DPAO §9.5, p. 19 — « Il n'est pas accordé de préférence aux candidats Nationaux » | repris |
| `B03-NA-01` Nantissement autorisé | Oui | AE art. 4, p. 38 — montant maximal de la créance nantissable | repris |
| `B03-NA-02` Conditions du nantissement | conditions du Code des marchés publics, information du comptable assignataire | AE art. 4, p. 38 ; IC §6.6.1.d, p. 9 | reformulé |
| `B03-NA-03` Comptable assignataire | **Trésorier ministériel chargé de l'Enseignement** | AE art. 4, p. 38 | repris |
| `B03-ST-01` Sous-traitance autorisée | **Non** | AE art. 3, p. 38 — « Il n'est pas envisagé de sous-traiter » | repris |

## B04 — Dossier, remise & ouverture des offres

| information | valeur portée | source | nature |
|---|---|---|---|
| `B04-CD-01` Fiches de renseignements jointes | **A1, A2, A3, A4** — liste à choix multiples depuis le 25/09 : elle **commande la génération** des quatre fiches | DPAO §5.1, p. 17 ; sommaire, p. 2 ; formulaires p. 22-31 | repris |
| `B04-CD-02` Modèle de garantie de soumission | **C1 et C2** — liste depuis le 25/09 : elle commande la génération des garanties, **un exemplaire par lot** | sommaire, p. 2 ; modèles p. 33-34 | repris |
| `B04-CO-01` Documents constituant l'offre | pièces du DPAO §6.1 en sus de celles des instructions | DPAO §6.1, p. 17 ; IC §6.2, p. 7-8 | reformulé |
| `B04-DE-01` Adresse des demandes d'éclaircissement | PRMP LERAVO Norbert Fidelys, porte 204, 2ᵉ étage, Fiadanana, Antananarivo 101 — prmp.mesupres@gmail.com | DPAO §5.2, p. 17 | repris |
| `B04-DE-02` Délai d'envoi des demandes (jours) | **10** | DPAO §5.2, p. 17 | repris |
| `B04-DE-03` Délai de réponse de la PRMP (jours) | **5** | DPAO §5.2, p. 17 | repris |
| `B04-LA-01` Autre langue que le français admise | Non | IC §6.9, p. 10 (français par défaut) ; le DPAO ne prévoit rien | déduit |
| `B04-LR-01` Destinataire des offres | Monsieur LERAVO Norbert Fidelys | DPAO §7.2, p. 18 | repris |
| `B04-LR-02` Adresse de remise | porte 204, 2ᵉ étage, MESupReS, Fiadanana, Antananarivo 101 | DPAO §7.2, p. 18 | repris |
| `B04-LR-03` Date limite de remise | 09/11/2026 | DPAO §7.2, p. 18 — **date laissée en pointillés** dans le dossier publié ; la date vient du calendrier du plan (remise des offres, étape 112) | déduit |
| `B04-LR-04` Heure limite | **10 h 00** | DPAO §7.2, p. 18 — « Heure : Dix (10) heures » | repris |
| `B04-OP-01` Lieu de l'ouverture des plis | bureau porte 204, 2ᵉ étage, MESupReS | DPAO §8, p. 18-19 | repris |
| `B04-OP-02` Date d'ouverture | 09/11/2026 | DPAO §8, p. 19 — « le même jour que la date limite fixée pour la remise des offres » | déduit |
| `B04-OP-03` Heure d'ouverture | **10 h 00** | DPAO §8, p. 19 — « DIX HEURES (10H) » | repris |
| `B04-RO-01` Nombre de copies | **1** | DPAO §7.1, p. 18 — « UNE (01) copie » | repris |
| `B04-RO-02` Mention à porter sur les plis | référence de l'AOO + « Ne pas ouvrir avant… » | DPAO §7.1, p. 18 | repris |
| `B04-RO-03` Présentation des plis | plis **séparés par lot** ; enveloppe extérieure anonyme ; deux enveloppes intérieures **scellées à la cire**, ORIGINAL et COPIE | DPAO §7.1, p. 18 | repris |
| `B04-VE-01` Voie électronique admise | **Non** | DPAO §7.3, p. 18 — « n'est pas autorisée dans le cadre de cet appel d'offres » | repris |
| `B04-VO-01` Délai de validité des offres (jours) | **75** | DPAO §6.4, p. 18 — « soixante-quinze (75j) jours » | repris |

## B05 — Prix, montants & garantie de soumission

| information | valeur portée | source | nature |
|---|---|---|---|
| `B05-CP-02` Décomposition des prix nationaux | prix EXW (magasin de ventes) + transports intérieurs, assurance et services locaux jusqu'à la destination finale | DPAO §6.5.1, p. 18 | repris |
| `B05-MO-01` Monnaie de l'offre | Ariary | CCAP art. 9.3, p. 50 ; AE art. 2, p. 38 | repris |
| `B05-GS-02` Forme de la garantie de soumission | garantie bancaire *(le dossier admet aussi la caution solidaire et le chèque de banque)* | DPAO §6.6, p. 18 | repris (une des trois formes) |
| `B05-GS-04` Validité de la garantie (jours) | **105** | modèles C1 et C2, p. 33-34 — « jusqu'au cent cinquième (105ᵉ) jour à compter de la date limite » | repris |
| `B05-GS-03#1` Garantie de soumission — lot 1 | **1 600 000 Ar** | DPAO §6.6, p. 18 | repris |
| `B05-GS-03#2` — lot 2 | **2 170 000 Ar** | DPAO §6.6, p. 18 | repris |
| `B05-GS-03#3` — lot 3 | **1 600 000 Ar** | DPAO §6.6, p. 18 | repris |
| `B05-GS-03#4` — lot 4 | **2 170 000 Ar** | DPAO §6.6, p. 18 | repris |
| `B05-GS-03#5` — lot 5 | **1 600 000 Ar** | DPAO §6.6, p. 18 | repris |
| `B05-TP-03#1…5` Montant maximum annuel | 80 M / 108,5 M / 80 M / 108,5 M / 80 M Ar | **AE art. 2, p. 38 : le montant est laissé en blanc** (il est offert par le candidat). Calcul : garantie de soumission ÷ 2 % — 1 600 000 ÷ 0,02 = 80 000 000 ; 2 170 000 ÷ 0,02 = 108 500 000 | déduit |
| `B05-TP-02#1…5` Montant minimum annuel | 40 M / 54 M / 40 M / 54 M / 40 M Ar | **BP lots 1 à 5, p. 40-44** : les quantités MIN valent la moitié des MAX (15/30, 8/16, 13/26, 3/6, 1/2) — le minimum est donc la moitié du maximum | déduit |

## B06 — Évaluation, attribution & notification

| information | valeur portée | source | nature |
|---|---|---|---|
| `B06-EO-01` Évaluation des offres sur plusieurs lots | **Par lot** | DPAO §9.4.3, p. 19 | repris |
| `B06-EO-02` Critères additionnels | aucun | DPAO §9.4, p. 19 — « non applicable » | repris |
| `B06-EO-04` Impôts et taxes écartés de l'évaluation | TVA et droits de douane | IC §9.4.2, p. 13 | reformulé |
| `B06-EO-05` Détermination du montant évalué | prix corrigé des erreurs, des rabais et de la préférence | IC §9.4.3, p. 13 | reformulé |
| `B06-EO-06` Comparaison des offres | l'offre évaluée la moins-disante | IC §9.4.4, p. 13 ; DPAO §9.4.3, p. 19 (« économiquement avantageuse ») | reformulé |
| `B06-EO-07` Offres anormalement hautes ou basses | 1ʳᵉ moyenne, écart **> 20 %** = anormalement haute ; 2ᵈᵉ moyenne après neutralisation, écart **< 10 %** = anormalement basse | DPAO §9.4.5, p. 19 | repris |
| `B06-EO-08` Vérification a posteriori du moins-disant | examen des pièces de qualification avant attribution | IC §9.4.6, p. 13 | reformulé |
| `B06-AN-02` Recours | motifs du rejet communiqués sous 20 jours ; recours gracieux puis organe de régulation | IC §10.1, p. 14 et §10.5, p. 15 | reformulé |
| `B06-EP-01` Délai de réponse des candidats (jours) | **3** | DPAO §9.1, p. 19 — « TROIS (03) jours au maximum » | repris |
| `B06-EO-12#1…5` Délai maximum de livraison (jours) | **30** pour chacun des cinq lots | DPAO §12, p. 19 ; CCAP art. 10.a, p. 50 ; AE art. 5.2, p. 38 ; annexe 1 aux spécifications, p. 62-66 | repris |

## B08 — Paiements, avances & garanties financières

| information | valeur portée | source | nature |
|---|---|---|---|
| `B08-AC-01` Acomptes prévus | **Non** | CCAP §9.1.b, p. 50 — « Acompte : Non applicable » | repris |
| `B08-AV-04` Forme de la garantie de restitution d'avance | garantie bancaire | annexes 3 et 4 au CCAP, p. 55-56 | repris |
| `B08-AV-05` Modalités de remboursement de l'avance | précompte sur les sommes dues | CCAG art. 9.1, p. 74 ; **CCAP §9.1.a, p. 50, est en blanc** | hypothèse |
| `B08-AV-06` Précompte (%) | 20 | idem — découle du taux d'avance retenu | hypothèse |
| `B08-GB-01` Garantie de bonne exécution exigée | **Non** | CCAP art. 12.1, p. 51 — « Non applicable » | repris |
| `B08-RG-01` Retenue de garantie | **Non** | CCAP art. 12.2, p. 51 — « Aucune retenue de garantie ne sera pratiquée » | repris |
| `B08-IM-01` Taux des intérêts moratoires (%) | 9 | CCAP §9.4, p. 50 — « taux directeur de la Banque Centrale **augmenté d'un (01) point** ». Le champ attend un pourcentage : 9 % vaut pour un taux directeur de 8 % | adapté |
| `B08-PA-01` Domiciliation bancaire | crédit du compte indiqué à l'acte d'engagement | AE art. 6.1, p. 38 ; CCAG art. 9, p. 74 | reformulé |
| `B08-PA-03` Établissement des factures | **quatre exemplaires** (un original, trois copies) avec nom et adresse, compte bancaire, références du marché, montant hors taxe, montant dû en Ariary, date | CCAP §9.2, p. 50 | repris |
| `B08-PA-04` Termes de paiement | factures établies à la livraison | CCAP §9.2, p. 50 | repris |
| `B08-PA-05` Périodicité des paiements | à la livraison | CCAP §9.2, p. 50 | repris |
| `B08-PA-08` Délai de paiement (jours) | 30 | CCAG art. 9.4, p. 74 (délai global de 75 jours) | hypothèse |

## B09 — Exécution du marché & livraison

| information | valeur portée | source | nature |
|---|---|---|---|
| `B09-DX-03` Modalités de passation des commandes | bons de commande successifs pendant douze mois ; contenu du bon ; seuls les bons signés par l'Ordonnateur Secondaire sont honorés | CCAP art. 10.a, p. 50 | repris |
| `B09-DX-01` Délai d'exécution (jours) | 30 | CCAP art. 10.a, p. 50 | repris |
| `B09-DX-02` Point de départ du délai | lendemain de la notification du bon de commande | CCAP art. 10.a, p. 50 ; DPAO §12, p. 19 | repris |
| `B09-OM-03` Délai de validité du marché (mois) | **12** | CCAP art. 6 et 10.b, p. 49-50 | repris |
| `B09-OM-01` Délai de communication d'un ajustement (jours) | **10** | CCAP art. 6, p. 49 | repris |
| `B09-OM-02` Variation maximale des quantités (%) | **20** | CCAP art. 6, p. 49-50 — « dans la limite de vingt pour cent (20 %) en sus du maximum ou en dessous du minimum » | repris |
| `B09-LL-01#1…5` Lieu de livraison, **par lot** | lot 1 Ministère (Fiadanana) · lots 2 et 3 Ambatondrazaka · lots 4 et 5 Fort-Dauphin — une cellule par lot depuis le 25/09, là où une seule phrase les empilait | CCAP art. 1 et 17, p. 49 et 51 ; annexe 1 aux spécifications, p. 62-66 | repris |
| `B09-LF-01` Modalités de livraison | livraison aux destinations finales ci-dessus | CCAP art. 17, p. 51 | reformulé |
| `B09-LF-02` Documents à la livraison | **cinq exemplaires** de la facture (description, quantités, prix unitaires, montant total, date d'expédition, référence, identification, répartition par colis) + bon de livraison ou récépissé du transporteur | CCAP art. 17, p. 51 | repris |
| `B09-EM-01` Marquage des emballages | emballage d'origine | CCAP art. 15, p. 51 | repris |
| `B09-EM-02` Documents dans les emballages | bon de livraison, facture, certificats et notices | CCAG art. 16.2, p. 79 | reformulé |
| `B09-RT-01` Responsabilité du transport | transport par le fournisseur jusqu'à la destination finale | CCAP art. 16, p. 51 | repris |
| `B09-AS-01` Assurance des fournitures | selon l'incoterm | CCAP art. 18, p. 51 | repris |
| `B09-SK-01` Stockage à la charge du fournisseur | **Oui** | CCAP art. 14, p. 51 — « Quantité minimale prévue dans le bordereau de prix » | repris |
| `B09-MC-01` Matériels confiés au fournisseur | Non | CCAP art. 13, p. 51 — « Sans objet » | repris |
| `B09-PS-01` Mesures de sécurité applicables | Non | CCAP art. 7, p. 50 — « Non applicable » | repris |
| `B09-CR-01` Contrôle des prix de revient | Non | CCAP art. 19, p. 51 — « Non applicable » | repris |
| `B09-IV-01` Inspections, vérifications et essais | au lieu de destination finale, au moment de la livraison, frais à la charge du fournisseur | CCAP art. 20, p. 52 | repris |
| `B09-DI-01` Décision après inspection | réception provisoire à la livraison, définitive à l'issue du délai de garantie ; décision sous **deux jours** | CCAP art. 21, p. 52 | repris |
| `B09-DG-01` Délai de garantie (mois) | **2** | CCAP art. 22, p. 52 — dérogation à l'article 23 du CCAG | repris |
| `B09-DG-02` Étendue de la garantie | remède aux défauts de fabrication ou de matière pendant le délai | CCAP art. 22, p. 52 | reformulé |
| `B09-PR-02` Plafond des pénalités (%) | **10** | CCAP art. 11, p. 50 | repris |
| `B09-PR-03` Justification de la dérogation | plafond ramené à 10 % là où le CCAG retient 15 % — marché à commandes, retard apprécié commande par commande | CCAP art. 11, p. 50 ; CCAG art. 12.1, p. 77 ; la **justification** est notre rédaction | reformulé |
| `B09-PC-01` Pièces contractuelles supplémentaires | bon de commande, bordereau des prix unitaires, spécifications techniques | CCAP art. 5, p. 49 ; CCAG art. 6.1, p. 71 | reformulé |
| `B09-PC-02` Annexes de l'acte d'engagement | annexe 1 cadre du bordereau de prix ; annexe 2 état des sommes versées à des tiers ; annexe 3 **déclaration des bénéficiaires effectifs** | AE, p. 38 ; annexes p. 40-46 ; sommaire p. 2 | repris |

## B10 — Modifications, résiliation & litiges

| information | valeur portée | source | nature |
|---|---|---|---|
| `B10-IR-01` Indemnité de résiliation prévue | Oui | CCAP art. 23, p. 52 — « Les dispositions de l'article 32 du CCAG s'appliquent » | repris |
| `B10-IR-02` Modalités de l'indemnité | indemnisation des fournitures livrées et acceptées et des approvisionnements | CCAG art. 32.2, p. 84 | reformulé |
| `B10-AR-01` Arbitrage et règlement des litiges | règlement amiable puis tribunal administratif | CCAG art. 34 à 36, p. 85-86 | reformulé |
| `B10-DD-01` Dérogations aux documents généraux | dérogation à l'article 23 du CCAG (délai de garantie), portée par l'article 22 du CCAP | CCAP art. 24, p. 52 — le tableau des dérogations | repris |

---

## B12 — Besoin par lot *(nouveau, 25/09)*

Le besoin n'est pas fait de champs : c'est une ressource à part — **12 articles** et **58 caractéristiques
exigées**, saisis lot par lot. Il alimente **trois pièces** du dossier : le bordereau des prix, le tableau de
conformité technique et la liste des fournitures.

| lot | articles et quantités min/max | caractéristiques exigées | source |
|---|---|---|---|
| **1** | ordinateur de bureau complet Core i5 (15/30) · onduleur (10/20) | 8 et 2 exigences | BP lot 1, **p. 40** ; spécifications lot 1, **p. 57** |
| **2** | kit Core i3 + onduleur + imprimante jet d'encre (8/16) · kit Core i5 + onduleur (13/26) | 7 et 6 | BP lot 2, **p. 41** ; spécifications lot 2, **p. 58** |
| **3** | imprimante laser multifonction A4 (3/6) · photocopieuse A4/A3 (1/2) · duplicopieur A4 (1/2) | 4, 4 et 3 | BP lot 3, **p. 42** ; spécifications lot 3, **p. 59** |
| **4** | *identique au lot 2* | idem | BP lot 4, **p. 43** ; spécifications lot 4, **p. 60** |
| **5** | *identique au lot 3* | idem | BP lot 5, **p. 44** ; spécifications lot 5, **p. 61** |

Les quantités sont **reprises** des bordereaux ; les caractéristiques sont **reprises** des spécifications
techniques — 8 Go de mémoire, SSD 500 Go, moniteur 22 pouces au minimum, clavier AZERTY, Windows 10
Professionnel 64 bits en français, onduleur 390 W / 1200 VA, et ainsi de suite.

⚠️ **Les lots 4 et 5 répètent mot pour mot les lots 2 et 3** dans le dossier publié : c'est le cas réel qui
justifie le geste « Dupliquer depuis le lot n ».

## Ce que la fiche ne couvre pas, et pourquoi

⚠️ **Cette liste s'est réduite le 25/09 au soir.** Cinq pièces qui y figuraient — les fiches A1 à A4, les
garanties C1/C2, les bordereaux des prix, les tableaux de conformité et la liste des fournitures — sont
désormais **générées par la fiche**, avec la part du candidat laissée en blanc. Le tableau ci-dessous garde ce
qui reste hors de la chaîne, et raye ce qui en est sorti.

| partie du dossier | pages | d'où elle vient |
|---|---|---|
| Instructions aux candidats | 3-15 | texte **invariable**, le même pour tous les appels d'offres — il n'a pas à être saisi |
| ~~Formulaires A1 à A4, garanties C1/C2~~ | 20-34 | ✅ **générés**, un exemplaire par lot, en-tête et montant pré-remplis — sur **gabarit provisoire filigrané** en attendant les modèles officiels |
| ~~Cadres de bordereaux des prix, lot par lot~~ | 40-44 | ✅ **générés** : un classeur par lot, quantités du bloc B12, colonne « prix unitaire HT » seule déverrouillée, totaux, TVA et TTC en formules |
| Annexes 2 et 3 de l'AE (sommes versées à des tiers, bénéficiaires effectifs) | 45-46 | modèles officiels ; la fiche les **annonce** (`B09-PC-02`) sans les produire |
| Annexes 1 à 4 du CCAP (modèles de garanties) | 53-56 | modèles officiels |
| ~~Spécifications techniques, lot par lot~~ | 57-61 | ✅ **générées** en tableau de conformité : une ligne par caractéristique exigée, colonnes « proposé », « marque », « modèle » et « conforme » laissées au candidat |
| ~~Liste des fournitures et calendrier~~ | 62-66 | ✅ **générée** : articles et quantités du besoin, lieu (B09-LL-01#n) et délai (B06-EO-12#n) de chaque lot |
| CCAG fournitures | 67-86 | texte réglementaire annexé |

## Les trois points où le dossier ne dit pas tout

1. **L'avance forfaitaire.** Le CCAP, §9.1.a page 50, porte le titre « Avance » suivi d'un **blanc**, alors
   que l'acte d'engagement (art. 6.2, p. 38) demande au candidat s'il l'accepte ou la refuse. Notre jeu
   retient 20 % — le plafond du CCAG (art. 9.1, p. 74). **À faire confirmer** : c'est la seule valeur de la
   fiche qui ne s'appuie sur rien dans le dossier.
2. **Les montants du marché.** L'acte d'engagement laisse le minimum et le maximum en blanc : ils viennent de
   l'offre. Nous les avons déduits des garanties de soumission, qui valent 2 % du maximum — le calcul est
   écrit ci-dessus, et il retombe exactement sur les quantités des bordereaux.
3. **Les dates.** Le dossier publié laisse la date limite de remise en pointillés (§7.2, p. 18) ; seules les
   **heures** sont fixées. Les dates de la fiche viennent du calendrier prévisionnel du plan de passation,
   comme le veut le contrôle `DATES_ORDRE`.

## Où en est la fiche 13

⚠️ **26/09** — la base ayant été vidée puis rejouée, c'est désormais la **fiche 13** (ligne 303089, plan
`00005/PPM-AGPM/CNM/2026`) qui porte ce dossier. Les correspondances ci-dessus sont inchangées : elles
portent sur des **codes de champ**, pas sur des identifiants.

| | à la première validation | **aujourd'hui** |
|---|---|---|
| informations | 114 | **115** |
| besoin | — | **12 articles, 58 caractéristiques exigées** |
| pièces produites | 7 | **48 pièces, 86 fichiers** — DPAO, CCAP, 5 actes d’engagement, la liste des fournitures, 5 bordereaux, 5 tableaux de conformité, 20 fiches A1-A4 et 10 garanties C1/C2 |
| contrôles au bilan | 0 | **0** |

Vérifié sur trois pièces ouvertes : le **bordereau du lot 2** porte les deux kits avec leurs quantités, la
colonne « prix unitaire HT » laissée au candidat, et les lignes Total HT, **TVA (20 %)** et Total TTC en
formules ; la **garantie C1 du lot 2** annonce « à concurrence d’un montant de : **2 170 000 Ariary (deux
millions cent soixante-dix mille ariary)** » et une validité « jusqu’au **cent cinquième (105ème) jour** » ; le
**tableau de conformité du lot 3** aligne une ligne par caractéristique exigée.

## Deux valeurs corrigées après relecture du dossier

La version 1 de la fiche portait une **forme de garantie de bonne exécution** et un **taux de 5 %** hérités du
jeu de démonstration précédent, alors que le CCAP écrit « non applicable » (art. 12.1, p. 51). Ils ont été
retirés : la fiche est en **version 2**, 112 informations. La date d'effet du marché a été alignée sur la
notification du calendrier prévisionnel.
