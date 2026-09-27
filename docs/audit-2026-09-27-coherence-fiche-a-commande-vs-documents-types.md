# Audit de cohérence — fiche DAO « A_COMMANDE / FOURNITURES_SERVICES » contre les documents types officiels (2026-09-27)

*Généré par `node scripts/audit-documents-types.mjs` — ne pas éditer à la main. Gabarits : `Documents Types/Fournitures et services` (ARMP, .doc), référentiel : l'API.*
*Le rattachement d'une information à une clause se fait sur les mots de son libellé : c'est un premier tri, à relire ; les deux listes « trous sans information » et « informations sans trou » sont ce que l'audit met en évidence.*

## Vue d'ensemble

| gabarit | clauses | trous à remplir | informations de la fiche rattachées | trous sans information | informations sans trou |
|---|---|---|---|---|---|
| Données particulières (doc 2) | 23 | 95 | 74 | 2 clauses | 13 |
| Cadre d'acte d'engagement (doc 4) | 7 | 40 | 29 | 1 clauses | 4 |
| CPS — CCAP et spécifications (doc 5) | 25 | 202 | 73 | 1 clauses | 2 |
| Instructions aux candidats (doc 1) — texte fixe | — | 0 | — | — | — |
| CCAG (doc 6) — texte fixe | — | 2 | — | — | — |

## Données particulières (doc 2)

### Clause par clause

| clause | trous du gabarit | informations de la fiche (maître en gras) |
|---|---|---|
| 1.2. - DONNEES PARTICULIERES DE L'APPEL D'OFFRES | — | **`B02-OB-03`** Numéro du dossier d'appel d'offres · **`B05-MO-01`** Monnaie de l'offre · **`B06-EO-06`** Comparaison des offres |
| 1. Acheteur et objet de l'appel d'offres | <insérer la dénomination de l'Autorité Contractante> ; <préciser, le cas échéant, si le marché fait partie d'un projet ou d'u ; <décrire le type de fournitures à livrer et de services connexes à réa ; <en cas de décomposition en lots, indiquer si le marché concerne un ou | **`B02-OB-02`** Type de fournitures à livrer et services connexes à réaliser · **`B02-OB-01`** Objet de l'appel d'offres · **`B01-AC-01`** Autorité contractante · **`B01-AC-02`** Adresse de l'autorité contractante · **`B05-CP-03`** Part en devises des fournitures importées · **`B01-AC-12`** Nature du marché · **`B01-AC-16`** Service(s) bénéficiaire(s) · **`B02-AU-02`** Attribution des lots · **`B05-CP-00`** Provenance des fournitures |
| 1.1 Lots et variantes | <en cas de décomposition en lots, indiquer si le marché concerne un ou ; <insérer la description du lot> ; < nombre de lots > ; <insérer la description du projet global> ; <insérer la description du projet global> ; <insérer la description du lot> ; <insérer la description du lot> ; <insérer la description du lot> ; <en cas de décomposition en lots indiquer si les candidats peuvent rép ; <Insérer l'une des deux options suivantes : > ; <soit:> ; <soit:> ; <Lorsque les variantes sont autorisées, insérer l'un des deux paragrap ; <soit> ; <soit> | **`B02-AU-01`** Description du projet global (marché non alloti) · **`B02-AU-07`** Nombre maximum de lots attribuables à un même candidat · **`B02-LV-01`** Nombre de lots du plan · **`B02-LV-05`** Nombre de lots · **`B06-EO-08`** Vérification a posteriori de la qualification du candidat mo · **`B02-LV-06`** Variantes admises · **`B03-GR-01`** Groupement autorisé |
| 1.2 Marché à commandes | <s'il s'agit d'un marché à commandes, préciser :> ; <insérer la description des fournitures> ; <insérer la durée, sans dépasser trois ans> | **`B02-AU-04`** Durée de validité du marché à commande (mois) |
| 2. Groupements | < en cas de décomposition en lots préciser la forme du groupement, en ; <soit:> ; <soit:> | **`B03-GR-02`** Forme du groupement |
| 5.1Composiition du DAO 1.3 : - Modèles de fiches de renseignements | — | **`B04-CD-01`** Modèles de fiches de renseignements joints au dossier (A1, A · **`B01-AC-13`** Mode de passation |
| 5.2. Demandes d'éclaircissements | <insérer le nom du responsable> ; <insérer le nom de la rue> ; <insérer l'étage et le numéro du bureau> ; <insérer le nom de la ville> ; <insérer le numéro du code postal> ; <insérer le numéro de télécopie> ; <insérer l'adresse électronique> ; <nombre de jours supérieur ou égal à six> ; <nombre de jours sus mentionné diminué du délai de réponse estimé par  | **`B04-DE-02`** Délai d'envoi des demandes par les candidats (jours avant la · **`B06-EP-01`** Délai de réponse des candidats aux demandes de la PRMP (jour · **`B04-DE-03`** Délai de réponse du représentant de la PRMP (jours) · **`B04-DE-01`** Adresse pour les demandes d'éclaircissement · **`B01-AC-05`** Personne responsable des marchés publics · **`B01-AC-06`** Courriel de la PRMP · **`B01-AC-07`** Téléphone de la PRMP |
| 6.2. Contenu des offres | <énumérer ces documents ou pièces> | **`B04-CO-01`** Documents et pièces constituant l'offre |
| 6.3. Capacités et qualifications des candidats | <indiquer ici les renseignements que les Candidats auront à soumettre ; <Si des qualifications particulières sont requises des Candidats par l ; <indiquer ici, ces qualifications> ; <Si les communautés locales et/ou les ONG sont admises à participer à ; <indiquer les formulaires ou informations que ces communautés et ONG s ; <Si une préférence nationale est accordée, indiquer ici:> | **`B03-CQ-07`** Communautés locales et ONG admises à candidater · **`B03-CQ-08`** Préférence nationale accordée · **`B03-CQ-01`** Identification et situation juridique : pièces exigées · **`B03-CQ-04`** Marchés similaires : certificats de bonne fin ou PV de récep · **`B03-CQ-06`** Qualifications particulières exigées · **`B05-MO-02`** Devise admise pour la part importée · **`B06-EO-09`** Marge de préférence nationale (%) · **`B03-CQ-02`** Capacité technique exigée · **`B03-CQ-03`** Capacité financière exigée |
| 6.5. Délai de validité des offres | <nombre> | **`B04-VO-01`** Délai de validité des offres (jours) |
| 6.6. Contenu et décomposition des prix | <indiquer le lieu d'utilisation des Fournitures> ; <Les exemples suivants sont à adapter, le cas échéant, en fonction de ; <soit> ; <indiquer le lieu de destination qui peut être différent du lieu de de ; <soit> ; <indiquer le port de destination> ; <indiquer ici au cas où l'Acheteur souhaite que le Fournisseur assure  | **`B05-CP-02`** Décomposition des prix des fournitures nationales (EXW hors  · **`B05-CP-01`** Incoterm des fournitures importées · **`B09-LL-01`** Lieu de livraison |
| 6.6.3. Caractère ferme ou révisable des prix | <soit:> ; <soit:> | **`B05-VP-01`** Prix ferme ou révisable |
| 6.7. Monnaie | <soit:> ; <soit:> ; <insérer le nom de la devise> | **`B06-EO-03`** Conversion en Ariary des offres en devise |
| 6.8. Garantie de soumission | <soit:> ; <soit:> ; <soit:> ; <insérer le montant en chiffres et en lettres> | **`B05-GS-03`** Montant de la garantie de soumission (Ariary) · **`B04-CD-02`** Modèle de garantie de soumission joint au dossier · **`B05-GS-02`** Forme de la garantie de soumission · **`B05-GS-01`** Garantie de soumission exigée · **`B05-GS-04`** Durée de validité de la garantie de soumission (jours) · **`B02-LV-03`** Montant par lot (Ariary) |
| 6.9. Langue | <Dans le cas où une langue autre que le français peut être utilisée po ; <soit:> ; <indiquer la langue de l'offre différente du français> ; <soit:> ; <préciser la deuxième langue de l'offre> | **`B04-LA-01`** Langue de l'offre autre que le français admise · **`B04-LA-02`** Langue admise en plus du français |
| 7.1. Forme des plis | <En cas d'allotissement, les offres devront être présentées séparément ; <insérer le nombre de copies> ; <insérer les mentions et/ou le numéro du DAO qui doit apparaître sur l ; <insérer le numéro du lot auquel se rapporte l'offre> | **`B04-RO-02`** Mention et numéro à porter sur les plis · **`B04-RO-01`** Nombre de copies de l'offre · **`B04-RO-03`** Présentation des plis (plis séparés par lot, enveloppes inté · **`B01-AC-19`** Forme du marché |
| 7.2. Lieu, date et heure de la remise des offres | <insérer le nom complet de la PRMP ou de son représentant> ; <insérer le nom de la rue et le numéro de l'immeuble> ; <insérer le numéro de l'étage et du bureau> ; <insérer le nom de la ville> ; <insérer le numéro du code postal> ; <insérer le jour, mois, année> ; <insérer l'heure en utilisant les 24 heures> | **`B04-LR-03`** Date limite de remise des offres · **`B04-LR-04`** Heure limite de remise des offres · **`B04-LR-01`** Nom complet de la PRMP destinataire des offres · **`B04-LR-02`** Adresse de remise des offres |
| 7.3. Remise des offres par voie électronique | <s'il n'est pas possible d'envoyer l'offre par voie électronique, indi ; <Dans le cas où il est possible de remettre les offres par voie électr | **`B04-VE-01`** Remise des offres ou propositions par voie électronique admi · **`B04-VE-02`** Conditions et modalités de transmission électronique des off |
| 8. Ouverture des plis Lieu : <indiquer avec précision le lieu où se déroule l'ouverture des plis> | — | **`B04-OP-01`** Lieu de l'ouverture des plis · **`B04-OP-02`** Date de l'ouverture des plis · **`B04-OP-03`** Heure de l'ouverture des plis |
| 9.1. - Relations entre les Candidats et l'Acheteur ou la PRMP | <insérer le nombre de jours> | — |
| 9.4.3. Détermination du montant évalué de l'offre | <soit:> ; <soit:> ; <indiquer ici les critères additionnels d'évaluation à prendre en cons ; <choisir un ou plusieurs des critères additionnels suivants:> ; <spécifier un pourcentage du montant des fournitures concernées> ; <Insérer l'un des textes ci-dessous> ; <soit :> ; <soit :> | **`B06-EO-05`** Détermination du montant évalué de l'offre · **`B06-EO-01`** Évaluation des offres portant sur plusieurs lots · **`B06-EO-02`** Critères additionnels d'évaluation · **`B06-EO-04`** Impôts, droits et taxes pris en compte dans l'évaluation |
| 9.5. Préférence nationale | <insérer l'une des options suivantes > ; <soit :> ; <soit :> ; <préciser le pourcentage de préférence inférieur ou égal à 10% > | — |
| 12. Délai de livraison | <Pour le cas d'un marché à quantités fixes> ; <préciser le délai de livraison> ; <insérer le nombre de jours> ; <préciser par lot en cas d'allotissement> ; <Pour le cas d'un Marché à commandes> ; <préciser le délai de livraison maximum> | **`B06-EO-12`** Délai maximum de livraison (jours) · **`B02-LV-04`** Marché alloti · **`B06-EO-10`** Variation maximale des quantités à l'attribution (%) |

### Trous sans information de la fiche

- **9.1. - Relations entre les Candidats et l'Acheteur ou la PRMP** — <insérer le nombre de jours>
- **9.5. Préférence nationale** — <insérer l'une des options suivantes > ; <soit :> ; <soit :> ; <préciser le pourcentage de préférence inférieur ou égal à 10% >

### Informations de la fiche sans clause rattachée dans ce gabarit

- `B01-AC-03` Ministère ou organisme de rattachement (PPM) — rubrique « Acheteur »
- `B01-AC-04` Commission des marchés compétente (PPM) — rubrique « Acheteur »
- `B01-AC-08` Référence du plan de passation (PPM) — rubrique « Acheteur »
- `B01-AC-09` Exercice budgétaire (PPM) — rubrique « Acheteur »
- `B01-AC-14` Montant estimatif (Ariary) (PPM) — rubrique « Acheteur »
- `B01-AC-15` Source de financement (PPM) — rubrique « Acheteur »
- `B01-AC-18` Dates prévisionnelles (calendrier de passation) (PPM) — rubrique « Acheteur »
- `B02-LV-02` Désignation des lots du plan (PPM) — rubrique « Lots et variantes »
- `B03-CQ-05` Autorisation du fabricant exigée (SAISIE) — rubrique « Capacité et qualifications des candidats »
- `B03-CQ-09` Durée des antécédents juridiques (années) (SAISIE) — rubrique « Capacité et qualifications des candidats »
- `B03-CQ-10` Durée des antécédents financiers (années) (SAISIE) — rubrique « Capacité et qualifications des candidats »
- `B05-VP-02` Formule de révision des prix (SAISIE) — rubrique « Variation des prix »
- `B06-EO-07` Traitement des offres anormalement hautes ou basses (SAISIE) — rubrique « Évaluation des offres, montant évalué »

## Cadre d'acte d'engagement (doc 4)

### Clause par clause

| clause | trous du gabarit | informations de la fiche (maître en gras) |
|---|---|---|
| ARTICLE 1 - CONTRACTANT(S) | <date> ; <date> | `B01-AC-05` Personne responsable des marchés publics · `B02-OB-01` Objet de l'appel d'offres · `B02-OB-03` Numéro du dossier d'appel d'offres · `B01-AC-19` Forme du marché · `B03-GR-02` Forme du groupement |
| ARTICLE 1. - CONTRACTANTS : | <date> ; <date> | — |
| ARTICLE 2 - PRIX | <N° de l'Annexe> | **`B05-TP-02`** Montant minimum annuel du marché (Ariary) · **`B05-TP-03`** Montant maximum annuel du marché (Ariary) · `B01-AC-14` Montant estimatif (Ariary) · `B02-LV-03` Montant par lot (Ariary) · **`B05-TP-01`** Type de prix |
| ARTICLE 3 - SOUS-TRAITANCE | <préciser n°> ; <préciser n°> | **`B03-ST-02`** Conditions de la sous-traitance · **`B03-ST-01`** Sous-traitance autorisée · **`B03-NA-02`** Conditions du nantissement |
| ARTICLE 4 - NANTISSEMENT | — | **`B03-NA-01`** Nantissement autorisé |
| ARTICLE 5 - DURÉE - DELAI | <Insérer si le point de départ des délais de réalisation de tout ou pa ; <soit:> ; <Préciser les Fournitures ou Services Connexes dont le délai de réalis ; <soit:> ; <soit :> ; <soit :> ; <mentionner le délai global> ; <soit :> ; ………… | **`B02-AU-05`** Date d'effet du marché à commande · `B05-CP-02` Décomposition des prix des fournitures nationales (EXW hors  · `B02-AU-04` Durée de validité du marché à commande (mois) · `B05-CP-03` Part en devises des fournitures importées · `B09-DX-01` Délai d'exécution (jours) · `B05-CP-00` Provenance des fournitures |
| ARTICLE 6 - PAIEMENTS | <Soit> ; <Soit> ; <Dans le cas d'un prix forfaitaire > ; <dans le cas d'un marché à prix unitaires> ; <à préciser selon les cas> ; <lieu> ; <port> ; <port> ; <port> ; …………… ; …………… ; …………… ; …………… ; …………… ; …………… ; …………… ; …………… ; …………… ; …………… ; …………… ; …………… ; <dans le cas d'un marché à prix forfaitaire> ; …………………… ; …………… | **`B09-PC-02`** Annexes de l'acte d'engagement (cadre du bordereau de prix,  · **`B08-PA-02`** Domiciliation bancaire de chaque membre du groupement · `B01-AC-02` Adresse de l'autorité contractante · `B01-AC-12` Nature du marché · **`B08-PA-01`** Domiciliation bancaire du fournisseur · `B09-LL-01` Lieu de livraison · `B01-AC-01` Autorité contractante · `B02-LV-04` Marché alloti · `B08-AV-02` Taux de l'avance (%) |

### Trous sans information de la fiche

- **ARTICLE 1. - CONTRACTANTS :** — <date> ; <date>

### Informations de la fiche sans clause rattachée dans ce gabarit

- `B01-AC-17` Compte(s) budgétaire(s) (PPM) — rubrique « Acheteur »
- `B03-NA-03` Comptable assignataire des paiements (SAISIE) — rubrique « Nantissement »
- `B08-AV-03` Modalités de l'avance en cas de groupement (SAISIE) — rubrique « Avance »
- `B09-OM-02` Variation maximale des volumes ou quantités (%) (SAISIE) — rubrique « Ordres de modification et avenants »

## CPS — CCAP et spécifications (doc 5)

### Clause par clause

| clause | trous du gabarit | informations de la fiche (maître en gras) |
|---|---|---|
| Article 1. - Objet du Marché | <préciser le nom de l'opération, le cas échéant> ; <indiquer l'intitulé ou l'objet principal du Marché> ; <indiquer le lieu où l'Autorité Contractante prend livraison des Fourn ; <si le Marché comprend plusieurs lots préciser le nombre de lots et ; <nombre > ; <préciser l'intitulé et/ou l'objet du lot> ; <compléter en fonction du projet> | `B01-AC-01` Autorité contractante · `B09-LL-01` Lieu de livraison · **`B09-PS-02`** Mesures communiquées par l'Autorité contractante |
| Article 2. - Acheteur (CCAG Article 2.1) | <Indiquer la dénomination complète de l'Autorité Contractante> | — |
| Article 3. -Communication à la Personne Responsable des Marchés Publics, et notification au fournisseur (CCAG Article 4 | <insérer le nom> ; <insérer le n° > ; <insérer l'adresse complète> ; <insérer le nom> ; <insérer le n° > ; <insérer l'adresse complète> | `B01-AC-05` Personne responsable des marchés publics |
| Article 4. - Groupements (CCAG Article 5) | <Préciser si les fournisseurs groupés seront considérés comme solidair ; <soit :> ; <soit :> | `B03-GR-01` Groupement autorisé · `B03-GR-02` Forme du groupement |
| Article 5. - Pièces contractuelles (CCAG Article 6) | <indiquer les pièces supplémentaires telles que plans, dessins, photog | **`B09-PC-01`** Pièces contractuelles supplémentaires |
| Article 6. - Ordres de modification et avenants (CCAG Article 6.2) | <Si la Personne Responsable des Marchés Publics souhaite prévoir un dé ; <nombre> ; <soit> ; <Préciser, le cas échéant, pour les Marchés à quantité fixes, les vari ; <soit> ; <Cas de Marchés à commandes :> ; …… ; <validité du marché> ; ……… | **`B09-OM-01`** Délai de communication par le fournisseur sur l'ajustement d · `B09-OM-02` Variation maximale des volumes ou quantités (%) · **`B09-OM-03`** Délai de validité du marché (mois) · `B04-VO-01` Délai de validité des offres (jours) · **`B08-PA-08`** Délai de paiement (jours) |
| Article 7. - Protection du secret - Mesure de sécurité (CCAG Article 7) | <soit :> ; <soit :> ; <soit :> ; <soit :> | **`B09-PS-03`** Mesures mentionnées en annexe du CCAP · **`B09-PS-01`** Mesures de sécurité applicables |
| Article 8. - Contenu et caractère des prix (CCAG article 8) | <préciser en cas de fournitures importées les dérogations éventuelles ; <Soit> ; <indiquer la nature des indices et les sources où ils peuvent être tro ; <Soit> ; <Dans le cas où le Marché comporte plusieurs lots, indiquer les modali | `B05-CP-01` Incoterm des fournitures importées · `B05-CP-03` Part en devises des fournitures importées · `B01-AC-12` Nature du marché · `B05-VP-01` Prix ferme ou révisable · `B05-VP-02` Formule de révision des prix · `B01-AC-19` Forme du marché · `B01-AC-15` Source de financement · `B05-CP-00` Provenance des fournitures · `B05-TP-01` Type de prix · **`B08-AC-02`** Modalités des acomptes |
| Article 9. - Modalités de règlement du Marché (CCAG Article 9) | <Soit> ; <Soit:> ; <pourcentage> ; <si l'avance dépasse 5% du montant du Marché, ajouter:> ; < Soit:> ; < Soit:> ; <Indiquer les modalités d'établissement des décomptes, factures ou mém ; <par exemple :> ; <par exemple> ; <dans le cas de prix unitaires, préciser la périodicité:> ; <dans le cas de prix forfaitaire, préciser les termes de paiement, par ; <pourcentage, par exemple 60% ou 70% ou 80%> ; <pourcentage, par exemple 40%, ou 30% ou 20%> ; <Prévoir, le cas échéant, les dispositions relatives à la monnaie d'ex ; <devises> ; <au moins un point> | **`B08-PA-03`** Établissement des décomptes, factures ou mémoires · **`B08-PA-05`** Périodicité des paiements (prix unitaires) · **`B08-AV-05`** Modalités de remboursement de l'avance · `B05-MO-02` Devise admise pour la part importée · **`B08-IM-01`** Taux des intérêts moratoires dus au fournisseur (%) · **`B08-PA-04`** Termes de paiement · `B05-MO-01` Monnaie de l'offre · **`B08-AV-01`** Avance accordée · **`B08-AV-02`** Taux de l'avance (%) · **`B08-AV-06`** Précompte sur les sommes dues (%) · **`B08-PA-07`** Part réglée sur présentation du PV de réception (%) · `B01-AC-17` Compte(s) budgétaire(s) |
| Article 10. - Délai d'exécution (CCAG Article 11.1.) | <soit :> ; …………… ; <soit :> ; …………… ; <Si le point de départ des délais est différent de la date de notifica ; <par exemple : le premier ordre de services de début d'exécution> ; <préciser la durée> ; <date> | **`B09-DX-02`** Point de départ du délai s'il diffère de la date de notifica · **`B09-DX-01`** Délai d'exécution (jours) · **`B09-DX-03`** Modalités et période de passation des commandes |
| Article 11. - Pénalités de retard (CCAG Article 12) | <Préciser, en fonction de l'importance du Marché et des délais d'exécu ; <soit> ; <soit> ; <si un plafond différent de celui de 15% prévu par le CCAG, indiquer l ; <pourcentage> | **`B09-PR-02`** Plafond des pénalités de retard (%) · **`B09-PR-03`** Dérogation au CCAG justifiant le plafond des pénalités · **`B09-PR-01`** Régime des pénalités de retard |
| Article 12. - Garantie de bonne exécution (CCAG Article 13) | <Soit :> ; <Si une garantie d'exécution est requise, insérer ici :> ; <insérer le pourcentage> ; <Soit> ; <Soit> ; <Soit> ; <à préciser> ; <Si un délai de garantie contractuelle est prévu et qu'une retenue de ; <Soit :> ; <Si une retenue de garantie est demandée, insérer la mention suivante ; <insérer le pourcentage sans dépasser 5%> | **`B08-GB-01`** Garantie de bonne exécution exigée · **`B08-RG-01`** Retenue de garantie pratiquée · **`B09-DG-02`** Étendue de la garantie |
| Article 13. - Matériels, objets et approvisionnements confiés au Fournisseur (CCAG Article 14) | <soit> ; <soit> | **`B09-MC-01`** Matériels, objets et approvisionnements confiés au fournisse |
| Article 14. - Stockage des fournitures (CCAG Article 15.1.) | <soit> ; <soit> ; <compléter par des indications pratiques sur la nature et les quantité ; <soit > | **`B09-SK-01`** Stockage des fournitures à la charge du fournisseur |
| Article 15. - Emballage (CCAG Article 15.2.) | <Préciser le cas échéant les spécifications particulières auxquelles l ; <Insérer le marquage éventuellement requis> ; <Insérer la liste des documents requis> | **`B09-EM-01`** Marquage requis sur les emballages · **`B09-EM-02`** Documents requis dans les emballages · **`B08-PA-06`** Part réglée à la réception des fournitures (%) |
| Article 16. - Responsabilité du transport (CCAG Article 16) | <soit> ; <soit> ; <soit> ; <indiquer les responsabilités respectives de l'Autorité contractante e | **`B09-RT-02`** Responsabilités respectives de l'Autorité contractante et du · **`B09-AS-02`** Terme de la responsabilité d'assurance du fournisseur · **`B09-RT-01`** Responsabilité du transport |
| Article 17. - Livraison des fournitures (CCAG Article 16) | <Préciser les modalités de livraison des fournitures, si possible en s ; <préciser suivant le cas soit:> ; <soit> ; <insérer le lieu de destination finale> ; <soit> ; <insérer le nom du port> ; <Préciser les documents à fournir par le Fournisseur, par exemple> ; <nombre> | **`B09-LF-02`** Documents à fournir par le fournisseur à la livraison · **`B09-LF-01`** Modalités de livraison des fournitures |
| Article 18. - Assurance (CCAG Article 17) | <Soit> ; <Soit> ; <préciser qui est responsable de l'assurance des Fournitures et jusqu' | **`B09-AS-01`** Assurance des fournitures |
| Article 19. - Contrôle des prix de revient (CCAG Article 19) | <Soit> ; <Soit> ; <Préciser, le cas échéant, les éléments spécifiques du prix de revient | **`B09-CR-01`** Contrôle des prix de revient applicable |
| Article 20. - Inspections, vérifcations et essais (CCAG Article 21) | <préciser le lieu, par exemple dans les usines du Fournisseur et/ou au ; <décrire les fréquences et types de contrôle ou procédures utilisés po ; < préciser, le cas échéant si l'Acheteur prend en charge certains coût | **`B09-IV-01`** Inspections, vérifications et essais |
| Article 21. - Décisions après inspection et essais (CCAG Article 22) | <Si délai donné à la commission de réception pour prendre sa décision ; <soit :> ; <soit :> ; <nombre> | **`B09-DI-01`** Décision après inspection et essais |
| Article 22. - Délai de garantie (CCAG Article 23) | <Soit> ; <Soit, préciser les garanties demandées, par exemple:> ; <nombre de mois> ; <Soit> ; <nombre d'heures> ; <nombre de mois> ; <nombre de mois> ; <Soit> ; <Soit> ; <taux de la pénalité> ; <durée> | **`B09-DG-01`** Délai de garantie (mois) · **`B08-RG-02`** Taux de la retenue de garantie (%) |
| Article 23. - Indemnité de résiliation (CCAG Article 32) | <Si la Personne Responsable des Marchés Publics souhaite fixer un taux ; <pourcentage> | **`B10-IR-01`** Indemnité de résiliation prévue · **`B10-IR-02`** Modalités de l'indemnité de résiliation |
| Article 24. -Arbitrage (CCAG Article 36.3) | <Exemple : clause d'arbitrage CNUDCI : application des règles établies ; <soit : de trois membres, soit : d'un arbitre unique> ; <à préciser> ; <Antananarivo ou un autre lieu à préciser> | **`B10-AR-01`** Arbitrage et règlement des litiges |
| Article 25 - Dérogations aux documents généraux | _____ ; _____ ; _____ ; <nom du Fournisseur > ; <adresse complète du Fournisseur > ; <intitulé ou objet résumé du marché> ; <dénomination de l'autorité contractante> ; <nom de la Banque> ; <adresse du siège social> ; <insérer le montant en chiffres et en lettres de la garantie> ; <Le Garant doit insérer un montant représentant le montant de la garan ; __________________________________________ ; _________________________________________________________________ ; ______________________________________________________________________ ; ______________________________________________________________________ ; < indiquer la dénomination sociale de l'organisme de caution, le siège ; <indiquer le nom et l'adresse complète du Fournisseur du Marché> ; <indiquer le numéro du Marché> ; <dénomination de l'autorité contractante> ; <indiquer la date de conclusion du Marché> ; <intitulé ou objet résumé du marché> ; <indiquer le montant en chiffre et en lettres de la garantie de bonne ; _________ ; __________ ; __________________________________________ ; _______________________________________________________________ ; ______________________________________________________________________ ; ______________________________________________________________________ ; <nom du Fournisseur > ; <adresse complète du Fournisseur > ; <intitulé ou objet résumé du marché> ; <dénomination de l'autorité contractante> ; <nom de la Banque> ; <adresse du siège social> ; <insérer le montant en chiffres et en lettres de la garantie> ; <Le Garant doit insérer un montant représentant le montant de l'avance ; <insérer le numéro du compte bancaire> ; <insérer les noms et adresse de la banque> ; __________________________________________ ; _________________________________________________________________ ; ______________________________________________________________________ ; ______________________________________________________________________ ; < indiquer la dénomination sociale de l'organisme de caution, le siège ; <indiquer le nom et l'adresse complète du Fournisseur du Marché> ; <indiquer le numéro du Marché> ; <dénomination de l'autorité contractante> ; <indiquer la date de conclusion du Marché> ; <intitulé ou objet résumé du marché> ; <indiquer le montant en chiffres et en lettres de l'avance prévue par ; _________ ; __________ ; __________________________________________ ; _______________________________________________________________ ; ______________________________________________________________________ ; ______________________________________________________________________ ; <Le cas échéant, la PRMP résume les spécifications et normes requises ; <Insérer une description détaillée de la nature des spécifications et ; ______________________________________________________________________ ; <insérer le numéro de l'article> ; <insérer le nom> ; <insérer les ST et les normes> ; <Ce tableau est rempli par la PRMP lorsque des Services Connexes tels ; <insérer la description du service> ; <insérer le nombre d'articles a fournir> ; <unité de mesure> ; <lieu de réalisation du service> ; <insérer la date> ; <à indiquer par le Candidat> ; <Insérer la description des Fournitures> ; <insérer la quantité des articles à fournir> ; <insérer l'unité de mesure > ; <insérer le lieu de livraison finale, selon les DPAO> ; <insérer la date> ; <insérer la date> ; <insérer la date offerte par le Candidat> | **`B08-GB-02`** Montant de la garantie de bonne exécution (% du marché) · **`B06-AN-01`** Forme de la garantie de bonne exécution exigée à la notifica · `B01-AC-02` Adresse de l'autorité contractante · `B05-CP-02` Décomposition des prix des fournitures nationales (EXW hors  · **`B08-AV-04`** Forme de la garantie de restitution d'avance · **`B10-DD-01`** Dérogations aux documents généraux · `B02-OB-01` Objet de l'appel d'offres · `B05-GS-02` Forme de la garantie de soumission · `B01-AC-16` Service(s) bénéficiaire(s) |

### Trous sans information de la fiche

- **Article 2. - Acheteur (CCAG Article 2.1)** — <Indiquer la dénomination complète de l'Autorité Contractante>

### Informations de la fiche sans clause rattachée dans ce gabarit

- `B06-AN-02` Recours gracieux et recours en attribution (SAISIE) — rubrique « Attribution et notification du marché »
- `B08-AC-01` Acomptes prévus (SAISIE) — rubrique « Acompte »

## Formulaires de soumission (doc 3) contre nos modèles

| modèle | décalque du 2463 (26/09) : lignes retrouvées | part | modèle ARMP (27/09) : lignes retrouvées | part |
|---|---|---|---|---|
| A1 | 50 / 52 | 96 % | 56 / 56 | 100 % |
| A2 | 5 / 6 | 83 % | 6 / 6 | 100 % |
| A3 | 33 / 36 | 92 % | 38 / 38 | 100 % |
| A4 | 6 / 7 | 86 % | 9 / 10 | 90 % |
| C1 | 9 / 17 | 53 % | 16 / 17 | 94 % |
| C2 | 17 / 19 | 89 % | 19 / 19 | 100 % |

*Les décalques du 2463 s'écartaient du document type ; depuis l'arbitrage du 27/09 (« Ajuster par rapport aux officiels »), les six modèles servis sont décrits depuis le document type lui-même — la preuve fine, dans les deux sens, est `scripts/modeles-candidat/verifier-armp.mjs`. La mesure ci-dessus est grossière (un fragment de texte entre deux jetons, retrouvé ou non dans le texte extrait du .doc) ; ses fragments non retrouvés pour le jeu ARMP :*

- A4 — « Etablir une fiche par marché. Indiquer les marchés publics ainsi que les principaux marchés exécutés »
- C1 — « Ariary), que nous nous engageons à régler intégralement à l’Autorité Contractante dans les condition »

## Lecture

- Un **trou sans information** est un manque possible de la fiche — ou un trou que la fiche remplit par une information rattachée ailleurs (le rattachement est lexical) : à confirmer clause par clause.
- Une **information sans trou** est soit une donnée que le gabarit ne demande pas (à garder si elle sert au contrôle, à retirer sinon), soit un libellé trop éloigné des mots du gabarit pour être rapproché automatiquement.
- Les textes fixes (IC : 0 trous, CCAG : 2) sont les documents à reprendre tels quels pour le DAO complet (lot D) : leurs trous sont les seules mentions à servir.
