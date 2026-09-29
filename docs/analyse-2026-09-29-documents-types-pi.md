# Analyse des documents types ARMP — Prestations intellectuelles (DPIC, AE, CPS)

**Date** : 2026-09-29 · **Mode** : lecture seule · **Entrées** : `pi-dpic.txt` (781 lignes), `pi-ae.txt` (363),
`pi-cps.txt` (509), avec `pi-ic.txt` et `pi-formulaires.txt` pour le contexte. Référentiel :
`docs/referentiel-champs-fiche-dao-prestations-intellectuelles.csv` (107 lignes de données : 48 `DPIC`, 19 `AE`,
21 `CCAP`, 19 `DPAO` remappés vers `DPIC`, dont 4 inactifs : `B02-CL-04`, `B09-FC-01`, `B04-VE-01`, `B04-VE-02`).

Conventions du rapport :
- « ligne » = numéro de ligne du `.txt` correspondant ; dans une cellule, les paragraphes sont séparés par U+001E (¶).
- Les codes **hors CSV** cités (`B01-AC-01`, `B01-AC-05`, `B01-AC-17`, `B02-OB-01`, `B02-OB-03`) sont des informations
  **reprises du plan**, communes aux trois catégories (ce sont eux que `DPAO-F`/`AE-F`/`CCAP-F` emploient) ; ils ne sont
  pas créés ici, seulement signalés comme candidats. `tauxAvance` est le complément de cadrage de `avance`.
- Clés de cadrage disponibles (front, `QUESTIONS_CADRAGE`) : `alloti`/`nbLots`, `variantes`, `groupement`,
  `formeGroupement` (`CONJOINT_OU_SOLIDAIRE`, `SOLIDAIRE_OBLIGATOIRE`), `typePrix`, `prixRevisable`,
  `garantieSoumission`, `modeRemise`, `avance`/`tauxAvance`, `penalites` (`CCAG`, `PLAFOND_DIFFERENT`, `NON`) ;
  plus `typeMarche` et `categorie` injectés.

---

## 1. DPIC — Données particulières des instructions aux candidats (`pi-dpic.txt`)

### 1.1 Structure

Le fichier n'est **pas** le seul tableau des DPIC : c'est toute la **première partie** du dossier de consultation,
moins les formulaires.

| lignes | partie | nature | sort dans le document finalisé |
|---|---|---|---|
| 1-69 | page de garde (AC, PRMP, projet, marché) + paragraphe art. 26 (l. 69 : « Les cinq premiers candidats sont retenus ») | paragraphes | garder, trous à remplir |
| 74-116 | sommaire général | liste | garder (fixe) — ⚠️ liste PF1-PF5, alors que `pi-ic.txt` l. 101-107 et `pi-formulaires.txt` annoncent PF1-PF6 |
| 121-191 | **1.1 Lettre d'invitation** | paragraphes, 5 points numérotés | garder, trous (dont la liste restreinte) |
| 195-713 | 1.2 Instructions aux candidats (IC) | paragraphes, sommaire l. 214-260 | **texte fixe**, identique à `pi-ic.txt` (diff : seulement le sommaire PF et la pagination) ; note l. 209 « Note aux utilisateurs » **à supprimer** |
| 717-777 | **1.3 DPIC proprement dites** | **tableau** 2 colonnes « Clause des IC ‖ Données particulières », 25 rangées (dont 4 rangées-titres pleine largeur : 736, 739, 759, 768) | c'est le cœur à décrire |

Parties « à supprimer du document finalisé » :
- l. 726 : note 1 (« Les textes en italique et entre crochets doivent ensuite être supprimés ») et l'appel `[note:1]` l. 725 ;
- l. 209 : note aux utilisateurs des IC ;
- toutes les instructions `<…>` des cellules, en particulier les longues notes l. 749 (« Donner ici la liste… Le Client
  supprime… »), l. 752 (début), l. 755 (début), l. 763 (branche électronique), l. 769 (trois phrases de conseil sur les
  sous-critères), l. 770 (« A utiliser lorsque les TdR exigent… »), l. 772 (début), l. 777 (début).

Particularités de mise en page :
- rangée 744 (branche **a)** du mode de rémunération) porte l'intitulé de clause « 7.2.2. Proposition Financière » ;
  la rangée 748 (branches **b), c), d)**) et la rangée 749 (frais) ont une **première cellule vide**. Supprimer la
  rangée 744 par un marqueur de rangée ferait perdre l'intitulé de la clause : il faut des **marqueurs de cellule**
  dans 744, pas de rangée.
- rangée 769-771 : la grille de notation est une seule cellule dont les points sont alignés par **espaces et
  tabulations** ; la cellule de la rangée 770 contient un **saut de ligne dans un paragraphe** (la ligne 771 « <de 0 à
  10> ¶ … Total des points pour les cinq critères:100 … » est la suite physique de la 770).

### 1.2 Points de choix

| # | ligne(s) | rédactions alternatives | clé proposée |
|---|---|---|---|
| D-C1 | 148-158 (lettre) et 732 | mode de sélection : qualité+coût / budget prédéterminé / moindre coût parmi les qualifiés / qualité seule | `B02-MS-01` (LISTE, 4 options, libellés conformes) |
| D-C2 | 735 | groupements **et** sous-traitance entre candidats de la liste restreinte : non autorisés / autorisés | `groupement` (cadrage) — ⚠️ une seule phrase pour deux notions ; `B03-SP-01` (sous-traitance autorisée, OUI_NON) couvre l'autre moitié : conflit possible (groupement OUI + sous-traitance NON n'a pas de rédaction) |
| D-C3 | 740 | contenu : PT + PF sous enveloppes distinctes / PT seule | `B04-NP-01` (LISTE, conforme) — à mettre en cohérence avec `B02-MS-01` = « Qualité technique exclusivement » |
| D-C4 | 743 | « 2° <le cas échéant:> fiche PT3 (capacités professionnelles) » | AUCUNE — à créer |
| D-C5 | 743 | paragraphe « points que le Client souhaite voir développer… » facultatif | `B04-QT-03` renseigné |
| D-C6 | 743 | « <indiquer ici, le cas échéant:> calendriers PT6 et PT7 » | AUCUNE — à créer |
| D-C7 | 744, 748 | mode de rémunération a) forfait / b) temps passé / c) résultat / d) pourcentage | `B05-PF-01` (4 options, conformes) |
| D-C8 | 744 | « <ajouter le cas échéant> : budget disponible… propositions supérieures rejetées » | dérivable de `B02-MS-01` = « Budget prédéterminé… » (ou `B05-PF-02` renseigné) |
| D-C9 | 748 | durée prévisionnelle en jours / semaines / mois | AUCUNE (l'unité vit dans le texte de `B05-PF-03`) |
| D-C10 | 748 | « <Ajouter, le cas échéant:> montant global maximum » | `B05-PF-04` renseigné |
| D-C11 | 748 | « <compléter le cas échéant> aléa d'exécution » | `B05-PF-05` renseigné |
| D-C12 | 748 c) | « rémunération finale <ou> honoraire de succès » | AUCUNE (dans le texte de `B05-PF-06`) |
| D-C13 | 748 c) | « le cas échéant une rémunération au temps passé… prestations supplémentaires » | AUCUNE — à créer |
| D-C14 | 748 d) | pourcentage fixe <ou> barème dégressif <ou> barème en usage de la profession | `B05-PF-08` / `-09` / `-10` renseignés (aucune liste qui tranche) |
| D-C15 | 749 | listes d'exemples de frais remboursables et de frais divers, que le Client élague ou complète | `B05-PF-11`, `B05-PF-12` renseignés |
| D-C16 | 752 | langue : autre langue que le français / français ou seconde langue (et, implicite, français seul = rien) | `B04-LP-01` — ⚠️ options `Français`, `Français et une seconde langue` : la branche « une autre langue seulement » n'a pas d'option |
| D-C17 | 754 | prix fermes / révisables | `prixRevisable` (cadrage, `B05-RP-01`) |
| D-C18 | 755 | clause présente seulement si devise admise ; puis « tous les prix en devise <ou> seulement la part étrangère » | `B05-MP-01` renseigné ; sous-choix AUCUNE |
| D-C19 | 756 | réunion préparatoire : non / oui (lieu, date, heure) | `B04-RU-01` |
| D-C20 | 763 | remise électronique impossible / conditions de la remise électronique | `modeRemise` (cadrage, `B04-SE-01`) ; `B04-VE-01` est inactif |
| D-C21 | 770 | critère (iv) transfert de connaissances utilisé ou non, et sous-critères a)-c) facultatifs | `B06-TP-05` (> 0) probable ; sous-critères AUCUNE |
| D-C22 | 769-770 | subdivision des critères (ii), (iii), (iv) en sous-critères, nombre de postes du personnel clé | AUCUNE — à créer (liste variable) |
| D-C23 | 772 | paragraphe de conversion des devises « Dans le cas où… exprimées en devises » | `B05-MP-01` renseigné |
| D-C24 | 772, 775 | formule Sf et poids T/F : seulement pour la sélection qualité-coût | dérivable de `B02-MS-01` |
| D-C25 | 777 | délai de renvoi de l'AE différent des 10 jours des IC | `B02-SP-01` renseigné — ⚠️ le champ est **obligatoire** alors que la rangée est facultative |

**25 points de choix**, dont 14 portés par une clé sûre, 5 dérivables d'une clé existante, 6 sans clé.

### 1.3 Trous

| ligne | texte du trou | champ proposé | certitude |
|---|---|---|---|
| 45 | <indiquer le nom et l'adresse> (autorité contractante) | `B02-CL-01` | sûr |
| 49 | <indiquer le nom> (PRMP ou délégué) | `B02-CL-02` (ou `B01-AC-05`, plan) | probable |
| 58 | <indiquer, le cas échéant le nom du projet> | `B02-OP-01` | sûr |
| 63 | <indiquer les références et l'intitulé ou l'objet principal du Marché> | `B02-OB-03` + `B02-OB-01` (plan) / `B02-OP-02` | probable |
| 123 | <En tête de l'Autorité Contractante> | `B02-CL-01` | probable |
| 126 | Référence: <insérer intitulé et références du Marché> | idem l. 63 | probable |
| 127 | <insérer : lieu et date> (de la lettre) | — | aucun champ |
| 129 | < insérer : Nom et adresse du Consultant> | — (un par consultant invité) | aucun champ |
| 142 | <insérer : liste des 5 candidats invités à remettre une proposition> | — (liste restreinte) | aucun champ |
| 148 | <indiquer le mode de sélection, soit:> | `B02-MS-01` | sûr |
| 182 | <insérer l'adresse> (accusé de réception de la lettre) | `B04-EP-01` | probable |
| 191 | <Insérer nom et signature de la PRMP ou de son délégué> | `B02-CL-02` (signature : hors fiche) | probable |
| 732 | <insérer la dénomination et l'adresse du client> | `B02-CL-01` | sûr |
| 732 | <préciser… si le marché fait partie d'un projet ou opération plus vaste> | `B02-OP-01` | sûr |
| 732 | <décrire l'objet principal du Marché> | `B02-OP-02` | sûr |
| 732 | La date prévue pour le début des prestations est le <insérer la date> | `B02-OP-03` | sûr |
| 732 | <indiquer le mode de sélection, soit:> | `B02-MS-01` | sûr |
| 737 | Attention de : <insérer le nom du responsable> | `B04-EP-01` (adresse fusionnée) | sûr |
| 737 | Rue : <insérer le nom de la rue> | `B04-EP-01` | sûr |
| 737 | Étage/numéro de Bureau : <insérer l'étage et le numéro du bureau> | `B04-EP-01` | sûr |
| 737 | Ville : <insérer le nom de la ville> | `B04-EP-01` | sûr |
| 737 | Code postal : <insérer le numéro du code postal> | `B04-EP-01` | sûr |
| 737 | Numéro de télécopie : <insérer le numéro> | `B04-EP-01` | probable |
| 737 | Adresse électronique : <insérer l'adresse électronique> | `B04-EP-02` | sûr |
| 737 | <nombre de jours supérieur ou égal à dix> jours avant la date limite | `B04-EP-03` | sûr |
| 737 | <nombre de jours… pas inférieur à six (6) jours> (réponse de la PRMP) | — | aucun champ |
| 738 | <énumérer les intrants à fournir par le client> | `B04-AI-01` | sûr |
| 743 | <points que le Client souhaite… développer et volume indicatif en pages A4> | `B04-QT-03` | sûr |
| 744 | le budget disponible est de: <montant> | `B05-PF-02` (« Montant du forfait ») | probable |
| 748 | <soit:> <nombre> jours, / semaines / mois | `B05-PF-03` | sûr |
| 748 | le montant global maximum de Prestations est de: <montant> | `B05-PF-04` | sûr |
| 748 | montant supplémentaire pour aléa d'exécution de <montant> | `B05-PF-05` | sûr |
| 748 | <indiquer un montant ou le mode de calcul… pourcentage de la cession…> | `B05-PF-06` | sûr |
| 748 | qui sera dû lors de <indiquer l'événement déclenchant la rémunération finale> | `B05-PF-07` | sûr |
| 748 | <indiquer la nature des montants servant de base à la rémunération> | `B05-PF-08` | sûr |
| 748 | égale à <pourcentage> | `B05-PF-08` (le libellé réunit nature **et** pourcentage) | probable |
| 748 | <prévoir un barème dégressif en fonction du volume des montants…> | `B05-PF-09` | sûr |
| 748 | barème en usage <indiquer la profession et les références du barème> | `B05-PF-10` | sûr |
| 749 | liste des frais remboursables (exemples à élaguer) | `B05-PF-11` | sûr |
| 749 | <spécifier le mode de transport et le tarif/classe> | `B05-PF-11` (fondu dans la liste) | probable |
| 749 | liste des frais divers (exemples à élaguer) | `B05-PF-12` | sûr |
| 752 | <indiquer la langue de l'offre différente du français> | `B04-LP-02` | probable |
| 752 | La langue de l'offre est le français ou <préciser la deuxième langue> | `B04-LP-02` | sûr |
| 753 | Le délai de validité des Propositions sera de <nombre> jours | `B04-DP-01` | sûr |
| 755 | Les prix… sont exprimés <nom de la devise convertible> | `B05-MP-01` (TEXTE_LONG « devise et conditions ») | probable |
| 755 | …Personnel étranger… exprimés en <nom de la devise convertible> | `B05-MP-01` | probable |
| 756 | <insérer l'adresse complète> (réunion préparatoire) | `B04-RU-02` | sûr |
| 756 | le <insérer la date à fixer au moins 21 jours avant…> | `B04-RU-02` | sûr |
| 756 | à < insérer l'heure> | `B04-RU-02` | sûr |
| 760 | le nombre de copies demandé est de : <insérer le nombre de copies> | `B04-FL-01` | sûr |
| 760 | <insérer le nom et/ou le numéro qui doit apparaître sur l'enveloppe…> | `B04-FL-02` | sûr |
| 760 | Attention : <insérer le nom complet de la personne> | `B04-FL-03` | sûr |
| 760 | Adresse: <insérer le nom de la rue et le numéro de l'immeuble> | `B04-FL-03` | sûr |
| 760 | Étage/Numéro de bureau : <insérer l'étage et le numéro de bureau> | `B04-FL-03` | sûr |
| 760 | Ville : <insérer la Ville> | `B04-FL-03` | sûr |
| 760 | Code postal :<insérer le Code postal> | `B04-FL-03` | sûr |
| 761 | Attention : <insérer le nom complet de la personne> | `B04-LH-01` | sûr |
| 761 | Adresse: <insérer le nom de la rue et le numéro de l'immeuble> | `B04-LH-01` | sûr |
| 761 | Étage/Numéro de bureau : <…> | `B04-LH-01` | sûr |
| 761 | Ville : <insérer la Ville> | `B04-LH-01` | sûr |
| 761 | Code postal : <insérer le Code postal> | `B04-LH-01` | sûr |
| 761 | …remise des Propositions sont les suivantes : <insérer la date et heure> | `B04-LH-02` | sûr |
| 761 | Date : <insérer le jour, mois, année> | `B04-LH-02` (partie date) | sûr |
| 761 | Heure : <insérer l'heure en utilisant les 24 heures> | `B04-LH-02` — ⚠️ type `DATE`, sans heure | probable |
| 763 | <…indiquer ici les conditions et modalités de transmission des Propositions…> | `B04-SE-02` à `B04-SE-17` (clause à rédiger, comme `DPAO-F` l. 77) | probable |
| 769 | (i) Expérience des Candidats pertinente pour la mission: <de 0 à 10> | `B06-TP-02` | sûr |
| 769 | a) Approche technique et méthodologie: <Indiquer nombre de points> | — | aucun champ |
| 769 | b) Plan de travail: <Indiquer nombre de points> | — | aucun champ |
| 769 | c) Organisation et personnel: <Indiquer nombre de points> | — | aucun champ |
| 769 | Total des points pour le critère (ii): <de 20 à 50> | `B06-TP-03` | sûr |
| 769 | a) Chef de mission <Indiquer nombre de points> | — | aucun champ |
| 769 | b) <Indiquer le poste ou la discipline> (et c), d)) — 3 trous | — | aucun champ (×3) |
| 769 | b)-d) <Indiquer nombre de points> — 3 trous | — | aucun champ (×3) |
| 769 | Total des points pour le critère (iii) : <de 30 à 60> | `B06-TP-04` | sûr |
| 769 | 1) Qualifications générales < pondération entre 20 et 30%> (et 2), 3)) — 3 trous | — | aucun champ (×3) |
| 770 | a)-c) Pertinence / Modalité / Qualifications des formateurs <indiquer les points> — 3 trous | — | aucun champ (×3) |
| 770 | Total des points pour le critère (iv): <de 0 à 10> | `B06-TP-05` | sûr |
| 771 | (v) Participation de ressortissants nationaux… <de 0 à 10> | `B06-TP-06` | sûr |
| 771 | Le score technique minimum T(s) requis pour être admis est : <nombre > Points | — | aucun champ |
| 772 | <date correspondant au quinzième jour précédant la date limite…> | — (dérivable de `B04-LH-02` − 15 j) | aucun champ |
| 775 | T = <entre 0,6 et 0,8> | — (au mieux `B06-CS-01` en texte) | aucun champ |
| 775 | F = <entre 0,4 et 0,2> | — (idem) | aucun champ |
| 776 | Adresse: <insérer le nom de la rue et le numéro de l'immeuble> | `B06-NG-01` | sûr |
| 776 | Étage/Numéro de bureau : <…> | `B06-NG-01` | sûr |
| 776 | Ville : <insérer la Ville> | `B06-NG-01` | sûr |
| 777 | …dans un délai de <nombre de jours> jours à compter de sa réception | `B02-SP-01` | sûr |

**DPIC : 94 trous — 55 sûrs, 15 probables, 24 sans champ.** (Les 24 sans champ : 3 dans la lettre d'invitation,
1 délai de réponse de la PRMP, **17 dans la grille de notation**, le score minimum, la date de conversion, T et F.)

Trous annoncés par les IC mais **sans rangée** au tableau DPIC (donc ni trou ni champ) : « lieu sûr à préciser dans
le DPIC » pour les propositions financières (IC l. 599) ; solidaires ou conjoints « dans le cas de marchés comportant
deux ou plusieurs lots, les DPIC précisent » (l. 316) ; **date** des négociations (l. 651 : « date et adresse », la
rangée 776 ne donne que l'adresse) ; plafond de rémunération au pourcentage (l. 499).

### 1.4 Ce qui ne relève pas de l'acheteur

Rien dans le tableau DPIC. Dans la lettre d'invitation : le nom et l'adresse **du consultant destinataire** (l. 129)
relèvent de l'acheteur mais varient **par destinataire** (une lettre par consultant de la liste restreinte). La
signature (l. 191) est manuscrite.

### 1.5 Champs `DPIC` (et `DPAO` remappés) sans place

| champ | explication |
|---|---|
| `B06-TP-01` Total des points | le modèle fige « Total des points pour les cinq critères:100 » (l. 771) ; le seul nombre libre voisin est le **score minimum**, qui n'est pas ce champ |
| `B06-OF-01` Modalités d'ouverture des propositions financières | la rangée 772 n'a qu'une date de conversion et la formule Sf, figée ; aucun trou « modalités » (au mieux : substitut de la cellule entière) |
| `B06-CS-01` Modalités de classement | la rangée 775 attend deux **nombres** T et F, pas un texte ; le champ ne tient qu'en remplaçant toute la cellule |
| `B04-QT-01` Qualifications exigées | le paragraphe « Qualifications » (743) est un texte fixe à option PT3 ; aucun trou libre |
| `B04-QT-02` Description attendue de la proposition technique | idem : liste fixe (PT4, PT5, méthodologie) ; seuls les « points particuliers » ont un trou (`B04-QT-03`) |
| `B04-VE-01`, `B04-VE-02` (maître `DPAO`, inactifs) | remplacés par `modeRemise` / `B04-SE-*` ; leur place (763) est tenue par le cadrage |

`B04-SE-02` à `B04-SE-17` n'ont qu'une place **à rédiger** (l'instruction 763 ne détaille rien) — même situation que
`DPAO-F` l. 77 (`[[CLAUSE À FOURNIR PAR LE JURISTE…]]`).

---

## 2. AE — Acte d'engagement (`pi-ae.txt`)

### 2.1 Structure

| lignes | partie | nature |
|---|---|---|
| 1-19 | titre « 2.1 Cadre d'acte d'engagement » | paragraphes |
| 23-27 | **Note aux utilisateurs à supprimer dans le DC définitif** (l. 27 : les `<…>` sont pour l'acheteur et se suppriment ; les `(…)` sont pour le candidat et **se gardent**) | à supprimer |
| 31-65 | page de garde (AC, marché, art. 26, imputation budgétaire, PRMP, date du marché ‖ cadre « exemplaire unique ») | paragraphes + un tableau 2 cellules (l. 65) |
| 70-138 | A. Engagement du candidat — art. 1 : **candidat individuel** (76-86) **ou** membres d'un **groupement** conjoint/solidaire (89-138) ; texte de l'art. 9 du Code reproduit (86, 138) | paragraphes à ¶ (cellules), blancs à la suite des étiquettes |
| 143-163 | art. 2 Prix : conditions générales, révision (149-150), **quatre rédactions selon la rémunération** : temps passé (153), forfait (156), résultat (159), pourcentage (163) | paragraphes |
| 169-179 | art. 3 Sous-traitance (« Rayer les dispositions inapplicables », soit/soit) | paragraphes |
| 182-186 | art. 4 Nantissement | paragraphes |
| 190-208 | art. 5 Durée — délais (5.1 date d'effet, 5.2 délai d'exécution, mois <ou> date) | paragraphes |
| 211-261 | art. 6 Paiements : 6.1 domiciliation (3 cas : unique / solidaires / conjoints), 6.2 avance (soit/soit, individuel / groupement) | paragraphes |
| 267-293 | lieu, date, signatures ; **liste des annexes** (278-286, numéros `<  >`) ; documents contractuels (289-293) | paragraphes |
| 297-309 | B. Acceptation (PRMP), approbation, visa, notification | tableau |
| 311-357 | annexes (cadres vides : rémunération forfaitaire, temps passé, frais remboursables, frais divers, proposition technique, formule de révision, demande d'acceptation des sous-traitants, **état des sommes versées aux tiers** — tableau 3 colonnes l. 355-357) | titres + tableau |

Particularité de procédure (IC 10.3, `pi-dpic.txt` l. 675) : en PI, c'est **le Client** qui prépare le projet d'AE
**après négociation**, avec les termes techniques et financiers convenus. Au stade du dossier de consultation, l'AE
est un **cadre** : ses montants et l'identité du titulaire sont nécessairement blancs.

### 2.2 Points de choix

| # | ligne(s) | alternatives | clé proposée |
|---|---|---|---|
| A-C1 | 76 / 89 | candidat individuel / groupement | `groupement` (la partie groupement n'a d'objet que si `groupement = OUI`) |
| A-C2 | 79 / 83 | agissant pour son propre compte / pour une personne morale | candidat — `B03-TP-05` ne correspond pas (options « Représentant légal » / « Ayant reçu pouvoir ») |
| A-C3 | 92-95 | groupement conjoint / solidaire (« cocher la case ») | candidat ; l'acheteur peut restreindre par `formeGroupement = SOLIDAIRE_OBLIGATOIRE` |
| A-C4 | 149-150 | paragraphe de révision des prix | `prixRevisable` (`B05-RP-01`, reprise AE) |
| A-C5 | 153 / 156 / 159 / 163 | temps passé / forfait / résultat / pourcentage | `B05-PF-01` (reprise AE) |
| A-C6 | 163 | barème de la profession <soit> barème de la clause « 6.2.1 des DPIC » | dérivable : `B05-PF-10` renseigné / `B05-PF-09` renseigné |
| A-C7 | 173-179 | sous-traitance non envisagée / annexe de sous-traitance | `B03-SP-01` (si NON, seule la 1re branche) ; sinon le candidat raye |
| A-C8 | 196-198 | délai courant à compter de l'OS de commencer (« <Insérer le cas échéant> ») | AUCUNE (le texte de `B09-DP-01` ne tranche pas) |
| A-C9 | 202-206 | durée en mois <ou> date de fin | `B09-DP-03` (options conformes) |
| A-C10 | 215-248 | domiciliation : consultant unique / groupement solidaire / conjoint | `B08-DP-01` (options conformes) — ou dérivé de `groupement` + `formeGroupement` |
| A-C11 | 253-258 | le CCAP ne prévoit pas d'avance / prévoit une avance | `avance` (`B08-AI-01`) |
| A-C12 | 258, 261 | refuse / ne refuse pas l'avance | `B08-AI-02` — mais c'est un choix **du candidat** |
| A-C13 | 258 / 261 | formulation individuelle / groupement | `groupement` |
| A-C14 | 278 / 279 | annexe 1 forfait / temps passé | `B05-PF-01` |
| A-C15 | 283 | annexe de formule de révision | `prixRevisable` |
| A-C16 | 284 | annexe de demande d'acceptation des sous-traitants | `B03-SP-01` |

**16 points de choix**, 13 portés par une clé (dont 2 choix réellement du candidat), 1 dérivable, 2 sans clé ou
hors acheteur.

### 2.3 Trous (acheteur)

| ligne | texte du trou | champ proposé | certitude |
|---|---|---|---|
| 39 | AUTORITE CONTRACTANTE : <indiquer le nom > | `B02-CL-01` (ou `B01-AC-01`, plan) | probable |
| 45 | <l'intitulé principal du Marché, le cas échéant le projet…, ou le numéro et l'objet du lot> | `B02-OB-01` (plan) / `B02-OP-02` + `B02-OP-01` | probable |
| 54 | Imputation budgétaire : <à préciser> | `B01-AC-17` (plan, hors CSV) | probable |
| 59 | PRMP ou son Délégué : <insérer le nom> | `B02-CL-02` | sûr |
| 86 | …Invitation à soumettre une proposition datée du <date> | — | aucun champ |
| 138 | idem (groupement) | — | aucun champ |
| 153 | …figurant en Annexe <N° de l'Annexe> (temps passé) | — (numérotation) | aucun champ |
| 156 | …figurant en Annexe <N° de l'Annexe> (forfait) | — | aucun champ |
| 159 | …figurant en Annexe <N° de l'Annexe> (résultat) | — | aucun champ |
| 179 | l'Annexe n° <préciser n°>… nature et montant des prestations sous-traitées | `B03-SP-02` | sûr |
| 179 | L'Annexe n° <préciser n°> constitue une demande d'acceptation… | `B03-SP-04` | sûr |
| 198 | <Insérer le cas échéant> : délai à compter de l'OS de commencer | `B09-DP-01` | probable |
| 202 | La durée globale du marché est de <nombre à préciser> mois | `B09-DP-04` | sûr |
| 206 | Le marché prendra fin <date à préciser> | `B09-DP-04` | sûr |
| 280-285 | Annexe n° <  > (six numéros d'annexes) | — (numérotation automatique) | aucun champ (×6) |
| 286 | Autres pièces contractuelles : <à préciser selon les cas> | `B09-DK-01` (maître CCAP) | probable |

**AE : 21 trous d'acheteur — 5 sûrs, 5 probables, 11 sans champ** (dont 9 numéros d'annexe, dérivables par le rendu).

### 2.4 Ce qui ne relève pas de l'acheteur (à laisser en blanc)

- l. 65 : date du marché (« à compléter lors de la notification ») et cadre « exemplaire unique ».
- l. 77-83, 101-136 : identité du candidat individuel ou de chaque membre et du mandataire (nom, prénom, domicile,
  RC, n° statistique, NIF, télécopieur, courriel). ⚠️ **`B03-TP-01` à `B03-TP-05`** (maître AE, `SAISIE`,
  obligatoires) visent précisément ces blancs : ils n'ont de sens qu'à l'AE du marché conclu, pas au dossier de
  consultation.
- l. 92-95 : case conjoint/solidaire à cocher.
- l. 153, 156, 159 : montants HT, TVA, TTC « (en chiffre et en lettres) » ; l. 159 b) et 163 : rémunération
  conditionnelle ou proportionnelle « (le Consultant indique ici…) ». ⚠️ `B05-PF-02` (montant du forfait, reprise AE)
  ne trouverait ici qu'un blanc du candidat.
- l. 171-179 : choix de la branche (« Rayer ») et « (montant en chiffres et en lettres) TVA incluse » → `B03-SP-03`
  vise ce blanc du candidat.
- l. 184-186 : montant maximal nanti « (en lettres et en chiffres…) » → `B03-NP-01` vise ce blanc du candidat.
- l. 217-248 : coordonnées bancaires (titulaire du compte, banque, agence, numéro, code).
- l. 258, 261 : refuse / ne refuse pas l'avance → `B08-AI-02`.
- l. 269-272 : lieu, date, signature « lu et approuvé ».
- l. 297-309 : acceptation, approbation, visa, notification (autorités, à la conclusion).
- l. 311-357 : contenu des annexes (propositions négociées), état des sommes versées aux tiers.

### 2.5 Champs `AE` sans place

| champ | explication |
|---|---|
| `B02-CL-03` Délégation de la PRMP (décision et date) | le modèle PI ne mentionne que « PRMP ou son Délégué : <insérer le nom> » (l. 58-59) ; aucun trou pour la décision de délégation |
| `B02-CL-04` Acte de nomination (inactif) | aucun trou — conforme à son inactivité |
| `B09-DP-02` Délai d'exécution des prestations | l'AE ne porte que la durée globale (5.2) et renvoie au calendrier de la proposition technique (l. 208) ; le CCAP art. 15 renvoie aux TdR (l. 359) — aucun trou nulle part |

Champs avec une place **qui n'est pas celle de l'acheteur** : `B03-TP-01`…`-05`, `B03-SP-03`, `B03-NP-01`,
`B08-AI-02` (et, en reprise, `B05-PF-02`). `B08-DP-01` a une place de choix légitime, mais sa valeur dépend de
l'attributaire (unique ou groupement), pas du dossier.

---

## 3. CPS — Cahier des prescriptions spéciales (`pi-cps.txt`)

### 3.1 Structure

| lignes | partie | nature |
|---|---|---|
| 1-81 | page de garde (AC, marché, art. 26, PRMP) et composition du CPS | paragraphes |
| 87-97 | présentation du CCAP ; **note 1 (l. 97) à supprimer** avec l'appel `[note:1]` l. 96 | paragraphes |
| 106-139 | table des matières (avec numéros de page) | à régénérer ou supprimer |
| 144-414 | **CCAP, 21 articles** suivant le CCAG ; art. 21 = tableau « Article du CCAG ‖ Article du CCAP » (l. 413-414, une rangée vide) | paragraphes + 1 tableau |
| 417-428 | annexe : exemple de formule de révision (entre crochets, avec accolades) | paragraphes |
| 430-458 | annexe : garantie bancaire de restitution d'avance (blancs de la banque, lignes `____`) | paragraphes |
| 460-490 | annexe : caution personnelle et solidaire de restitution d'avance | paragraphes |
| 493-505 | **Termes de référence** : une seule instruction listant les rubriques a) à f) | **tout le contenu est à fournir** |

Instructions à supprimer : toutes les `<…>` (notamment l. 172, 178, 191-193, 226, 274, 276, 280, 284 — longue, 304,
312, 358, 363, 373, 382, 386, 392, 397, 399 — arbitrage, 421, 499-505).

### 3.2 Points de choix

| # | ligne(s) | alternatives | clé proposée |
|---|---|---|---|
| P-C1 | 178-186 | (si plusieurs lots) consultants groupés **solidaires** / **conjoints** | `formeGroupement` via `B03-GP-01` — ⚠️ les options de cadrage sont « conjoint **ou** solidaire au choix » / « solidaire obligatoire » ; le CCAP veut « solidaires » / « conjoints » **imposés** ; condition aussi sur `alloti` |
| P-C2 | 201-207 | mesures de sécurité : non applicable / applicables | `B09-MS-01` |
| P-C3 | 206-207 | dispositions communiquées à la notification / en annexe n° | AUCUNE — à créer |
| P-C4 | 211-215 | assistance du client : non applicable / intrants | `B09-AI-01` |
| P-C5 | 226-230 | clause de monnaie (paiement en devises possible) | `B05-MP-01` renseigné (reprise CCAP) |
| P-C6 | 235-253 | prix fermes + actualisation / révisables (annexe) | `prixRevisable` (`B05-RP-01`, reprise CCAP) |
| P-C7 | 257-261 | avance non applicable / applicable | `avance` (`B08-AI-01`, reprise CCAP) |
| P-C8 | 263-268 | taux unique / taux en monnaie nationale + taux en devises | AUCUNE (dérivable de `B05-MP-01` renseigné) |
| P-C9 | 276-292 | règlement : < 3 mois en une fois / temps passé mensuel / par étapes | `B08-RP-01`, `-02`, `-03` renseignés (et cohérence `B05-PF-01`) |
| P-C10 | 286-287 | 1er versement au commencement <ou> à la prise d'effet | AUCUNE (dans le texte de `B08-RP-03`) |
| P-C11 | 304-312 | polices d'assurance exigées (liste à choisir), « dans certains cas seules les assurances de base » | AUCUNE — à créer |
| P-C12 | 317-330 | matériel confié : non applicable / garantie de restitution | `B09-MF-01` |
| P-C13 | 323-330 | garantie bancaire / caution / chèque | `B09-MF-02` (options conformes) |
| P-C14 | 337-341 | frais de stockage compris dans les prix / à la charge du client | AUCUNE |
| P-C15 | 343-346 | EXW… ; importés CIP <soit> CIF | AUCUNE (`provenance` n'est posée qu'aux fournitures) |
| P-C16 | 358-359 | point de départ = OS de commencement | AUCUNE (probable : texte de `B09-DP-01`) |
| P-C17 | 365-371 | pénalités non applicables / fixées | `penalites` (cadrage) **et** `B09-PP-01` (OUI_NON) — doublon à arbitrer |
| P-C18 | 373-375 | plafond différent des 10 % du CCAG | `penalites = PLAFOND_DIFFERENT` — ⚠️ l'aide du cadrage et le contrôle `PENALITES_PLAFOND_15` parlent de 15 % |
| P-C19 | 386-388 | délai de vérification différent de 30 jours | AUCUNE |
| P-C20 | 392-394 | indemnité de résiliation différente de 4 % | `B10-IN-01` renseigné |
| P-C21 | 397-407 | arbitrage international (CNUDCI) — le modèle n'offre **que** cette rédaction, « à valider », pour consultant étranger | AUCUNE (tribunaux malgaches implicites) |
| P-C22 | 403 | tribunal arbitral de trois membres / arbitre unique (+ clause du président) | AUCUNE |
| P-C23 | 422-428 | révision des rémunérations en devises et/ou en monnaie locale | `prixRevisable` + `B05-MP-01` renseigné |
| P-C24 | 430-490 | annexes garantie bancaire / caution de restitution d'avance | `avance` ; le choix de la forme : AUCUNE |

**24 points de choix**, 13 portés par une clé (dont 1 doublon et 1 incompatible), 2 dérivables (P-C8, P-C23), 9 sans
clé.

### 3.3 Trous

| ligne | texte du trou | champ proposé | certitude |
|---|---|---|---|
| 37 | <indiquer le nom et l'adresse> (AC) | `B02-CL-01` | sûr |
| 46-48 | <références et intitulé principal du Marché, le projet… ou le lot> | `B02-OB-03` + `B02-OB-01` (plan) / `B02-OP-01` | probable |
| 62 | PRMP ou son DELEGUE : <Insérer le nom> | `B02-CL-02` | probable |
| 152 | <préciser le nom de l'opération, le cas échéant> | `B02-OP-01` | sûr |
| 155 | <indiquer l'objet … des travaux> (objet) | `B02-OP-02` | sûr |
| 155 | <… et le lieu d'exécution …> | — | aucun champ |
| 163 | <Préciser les nom et coordonnées de l'Autorité Contractante> | `B02-CL-01` | sûr |
| 166 | Représentant de la PRMP : <Préciser les nom et coordonnées> | `B02-CL-02` (+ `B02-CL-03`) | probable |
| 172 | <mentionner la ville ou le lieu choisi par le Client…> (élection de domicile) | — | aucun champ |
| 174 | …seront valablement effectuées à l'adresse mentionnée ci-après: (blanc) | `B09-NC-01` | sûr |
| 191-193 | <Enumérer… les documents… qu'il est souhaitable de rendre contractuel…> | `B09-DK-01` | sûr |
| 197 | …dans un délai de <nombre de jours> jours suivants… | `B09-MV-01` | sûr |
| 207 | Soit : mentionnées en Annexe <n°> au présent CCAP | — | aucun champ |
| 215 | Le Client fournit les intrants suivants : <énumérer les intrants…> | `B09-AI-02` | sûr |
| 228 | Les prix en devises seront exprimés en <nom de la devise convertible> | `B05-MP-01` | probable |
| 248 | <indiquer la nature des indices et les sources où ils peuvent être trouvés> | — | aucun champ |
| 264 | <pourcentage> du montant total des travaux à exécuter | `tauxAvance` (cadrage) | probable |
| 267 | <pourcentage> du montant en monnaie nationale | `tauxAvance` (cadrage) | probable |
| 268 | <pourcentage> du montant en devises | — | aucun champ |
| 278 | règlement en une seule fois (< 3 mois) | `B08-RP-01` | sûr |
| 282 | décompte mensuel remis au plus tard <nombre de jours> avant… | `B08-RP-02` (paragraphe entier) | sûr |
| 286-292 | échéancier a) à f) (pourcentages, rapports, libération de garantie) | `B08-RP-03` | sûr |
| 298 | …augmenté de < au moins un> point(s) | `B08-IP-01` — ⚠️ le champ est un **taux (%)** contrôlé `INTERETS_MORATOIRES_TAUX`, le trou est un **nombre de points** au-dessus du taux directeur | probable |
| 306 | Assurance automobile… couverture minimum de <insérer le montant > | `B09-AP-01` | probable |
| 307 | Assurance des risques causés au tiers… <insérer le montant> | — | aucun champ |
| 308 | Assurance professionnelle… <insérer le montant> par sinistre | — | aucun champ |
| 308 | …et une couverture annuelle de <insérer le montant> | — | aucun champ |
| 330 | chèque de banque établi à l'ordre de <à préciser> | — | aucun champ |
| 343 | EXW, CIF … <préciser suivant le cas soit:> sortie usine, fabrique… | — | aucun champ |
| 345 | CIP <insérer le lieu de destination finale> | — | aucun champ |
| 346 | CIF port de <insérer le nom du port> | — | aucun champ |
| 349-354 | <Préciser les documents à fournir…> ; <nombre> exemplaires de la facture | `B09-FC-01` (**inactif**) | probable |
| 371 | <millièmes> du montant du Marché ou de la tranche | — | aucun champ |
| 371 | …dans la limite de <pourcentage> du montant global | — | aucun champ |
| 375 | Le montant des pénalités est limité à <pourcentage> du prix global | — | aucun champ |
| 378 | <dispositions spécifiques… propriété industrielle… intellectuelle…> | `B09-UR-01` | sûr |
| 382-384 | <modalités de vérification ou d'agrément… ou renvoyer aux TdR> | `B09-OP-01` | sûr |
| 388 | …dans un délai de <indiquer le nombre de jours:> jours | — | aucun champ |
| 394 | …s'élèvera à <pourcentage> du montant hors TVA… | `B10-IN-01` | sûr |
| 401-407 | clause de règlement des litiges (arbitrage CNUDCI) | `B10-PP-01` (clause entière) | sûr |
| 403 | …qualifications dans le domaine <à préciser> | `B10-PP-01` (fondu) | probable |
| 405 | L'autorité de nomination sera : <par exemple> … | `B10-PP-01` (fondu) | probable |
| 407 | le siège de l'arbitrage sera : <Antananarivo ou une autre ville> | `B10-PP-01` (fondu) | probable |
| 413-414 | tableau « Article du CCAG ‖ Article du CCAP » (rangées à remplir) | `B10-DP-01` | sûr |
| 423 | …taux indiqués à l'Annexe <  > à l'Acte d'Engagement (devises) | — | aucun champ |
| 426 | …taux indiqués à l'Annexe <  > à l'Acte d'Engagement (Ariary) | — | aucun champ |
| 426 | ajustée tous les (nombre) mois | — | aucun champ |
| 438 | <dénomination de l'autorité contractante> (garantie bancaire) | `B02-CL-01` | probable |
| 466 | <dénomination de l'autorité contractante> (caution) | `B02-CL-01` | probable |
| 499-505 | Termes de référence : contexte, objectifs, champ, formation, rapports et calendrier, données fournies par le Client | — | aucun champ |

**CPS : 50 trous — 16 sûrs, 14 probables, 20 sans champ.**

### 3.4 Ce qui ne relève pas de l'acheteur

- Annexe garantie bancaire (l. 435-456) : nom et siège du titulaire, n° du marché, nom et siège de la **banque**,
  montant de la garantie (« Le Garant doit insérer… », l. 444), numéro de compte, signature, date, cachet —
  **banque**, à l'exécution.
- Annexe caution (l. 464-490) : organisme de caution, titulaire, n° et date du marché, montant, lieu/date, signature
  — **organisme de caution**, à l'exécution.
- Dans ces deux annexes, seule la dénomination de l'autorité contractante (l. 438, 466) et l'objet du marché
  pourraient être pré-remplis par l'acheteur.

### 3.5 Champs `CCAP` sans place

Aucun des 21 champs de maître `CCAP` n'est sans place : tous ont un trou ou une section. Deux réserves :
`B09-FC-01` (inactif) a pourtant une place (l. 349-354) — l'art. 14 est un texte **de fournitures** (« Fournisseur »,
EXW/CIP/CIF, certificat d'origine) importé tel quel dans le modèle PI ; `B03-GP-01` a une place mais des valeurs
incompatibles (P-C1). Reprises sans place dans le CCAP : **`B02-SP-01`** (délai de renvoi de l'AE, reprise
`AE,CCAP` : absent de l'AE comme du CCAP) et **`B09-DP-02`** (voir 2.5).

---

## 4. Synthèse transverse

### 4.1 Comptes

| | DPIC | AE | CPS | total |
|---|---|---|---|---|
| trous d'acheteur | 94 | 21 | 50 | **165** |
| — sûrs | 55 | 5 | 16 | **76** |
| — probables | 15 | 5 | 14 | **34** |
| — sans champ | 24 | 11 | 20 | **55** |
| points de choix | 25 | 16 | 24 | **65** |

Champs du CSV **sans place** : **10 sur 107** — `B06-TP-01`, `B06-OF-01`, `B06-CS-01`, `B04-QT-01`, `B04-QT-02`,
`B04-VE-01`*, `B04-VE-02`*, `B02-CL-03`, `B02-CL-04`*, `B09-DP-02` (* inactifs). S'y ajoutent **8 champs dont la
seule place est un blanc du candidat** (`B03-TP-01` à `-05`, `B03-SP-03`, `B03-NP-01`, `B08-AI-02`) et **16 champs
`B04-SE-02` à `-17`** dont la place est une clause électronique à rédiger (comme aux fournitures).

Écarts de valeur relevés (champ existant mais options ou type inadaptés) : `B04-LP-01` (pas d'option « autre langue
seulement »), `B04-LH-02` (type `DATE`, l'heure est exigée l. 761), `B08-IP-01` (points vs %), `B03-GP-01` /
`formeGroupement` (conjoint/solidaire imposés), `B03-TP-05` (propre compte / personne morale), `B09-PP-01` vs
cadrage `penalites` (doublon ; plafond CCAG PI 10 % vs contrôle 15 %), `B02-SP-01` et `B08-RP-01` obligatoires alors
que leur rédaction est facultative (« dans le cas où… », « pour les prestations d'une durée inférieure à trois mois »).

### 4.2 Extensions du moteur de rendu à prévoir

Au-delà de `{{CODE}}`, `.chiffres`, `.lettres`, `.parLot`, sections de paragraphe, de cellule et de rangée :

1. **Grille de notation à lignes variables** (769-771) : critères (i)-(v), sous-critères libres, **un nombre variable
   de postes du personnel clé** (libellé + points), sous-pondérations en %, critère (iv) facultatif avec ses propres
   sous-critères. Il faut une **répétition** (bloc de paragraphes ou de rangées répété pour chaque élément d'un champ
   multi-valué, p. ex. `{{POUR:POSTES}}…{{FINPOUR:POSTES}}`) et un type de champ **tableau/liste de couples**
   (libellé, points) — rien de tel au référentiel.
2. **Contrôles arithmétiques** entre champs (pas du rendu, mais nécessaires au même endroit) : somme des critères =
   100, plages (0-10, 20-50, 30-60), sous-pondérations = 100 %, **T + F = 1** avec T ∈ [0,6 ; 0,8], somme des
   pourcentages de l'échéancier (286-291) = 100.
3. **Nombres décimaux à virgule** (T = 0,8 ; F = 0,2) — un format décimal, distinct de `.chiffres` (entiers).
4. **Échappement des accolades** : la formule de révision l. 427 se termine par `}}` (« {ou Rl= Rlo X [ 0,15+0,85
   Il/Ilo] }} »), l. 424 par `] }` ; un modèle qui la décalque tel quel ferait lire au moteur une fin de jeton. Il
   faut un échappement littéral (ou réécrire la formule).
5. **Sous-formats de date/heure** : `B04-LH-02` doit s'imprimer trois fois (« date et heure », « Date : jour, mois,
   année », « Heure : 24 h ») — sous-formats `.date` / `.heure` (et un type `DATE_HEURE`).
6. **Dates dérivées** : « quinzième jour précédant la date limite » (772) — un `{{DERIVE.…}}` calculé sur
   `B04-LH-02`, comme `DERIVE.fin-validite-offre` aux fournitures.
7. **Document multiplié par destinataire** : la lettre d'invitation (121-191) est adressée à chaque consultant de la
   liste restreinte (l. 129) et énumère les cinq invités (l. 142) — un rendu **par élément d'une liste** (analogue au
   document par lot de l'AE, mais par consultant) et l'énumération d'une liste multi-valuée.
8. **Numérotation automatique des annexes** (AE 153-159, 179, 278-286 ; CCAP 207, 423, 426) : les numéros dépendent
   des annexes retenues par les conditions — un compteur (`{{NUM:…}}`) plutôt que des champs.
9. **Listes éditables** (frais remboursables et frais divers 749, assurances 306-310, documents contractuels 191-193,
   échéancier 286-292) : un `TEXTE_LONG` multi-lignes doit s'imprimer **un paragraphe (puce) par ligne** si le moteur
   ne le fait pas déjà.
10. **Condition sur la valeur d'une LISTE à libellé long contenant virgule et « et »** (`B02-MS-01` : « Qualité
    technique, expérience et proposition financière ») : la section « budget disponible » (744), la formule Sf (772) et
    les poids T/F (775) se conditionnent sur ce libellé. À vérifier : les options du CSV sont séparées par `,` alors que
    la première option contient `, ` — risque de découpage en cinq options.
11. **Marqueurs de cellule dans la rangée 744** plutôt que de rangée (l'intitulé de clause 7.2.2 y est porté), et
    tolérance au **saut de ligne à l'intérieur d'un paragraphe** (770-771).

### 4.3 Difficultés prévisibles pour l'import (lecture inverse)

- **Grille de notation** : nombres alignés par espaces et tabulations (769), libellés de postes inventés par
  l'acheteur, nombre de postes variable, sous-critères renommés ; pas d'ancre fixe entre deux nombres (« <Indiquer
  nombre de points> » disparaît) — la lecture par ancrage de texte fixe ne suffira pas.
- **Adresses en cinq ou six morceaux** fusionnées en un seul champ (`B04-EP-01`, `B04-FL-03`, `B04-LH-01`,
  `B06-NG-01`) et **trois blocs d'adresse aux mêmes étiquettes** (« Attention : », « Adresse: », « Étage/Numéro de
  bureau : », « Ville : ») — ancres ambiguës, à désambiguïser par l'intitulé de rangée ; l'import doit recomposer
  l'adresse.
- **Listes longues et élaguées** (frais 749, assurances, documents contractuels, TdR) : le modèle dit expressément que
  le Client « supprime… ou en ajoute d'autres » — le texte fixe entre les trous n'est plus stable.
- **Termes de référence** : texte libre de plusieurs pages, sans structure imposée (seulement six rubriques
  indicatives) ; aucun champ ne les reçoit.
- **Formules** (Sf = 100 x Fm / F ; PI = Po (In / Io) ; Rf = Rfo X [0,15+0,85 If/Ifo]) : coefficients modifiables,
  mise en forme mathématique souvent en objets Word ou en image dans un PDF.
- **Décimaux et unités** (T = 0,8, « <nombre> jours / semaines / mois », millièmes, points vs %).
- **Double occurrence du mode de sélection** (lettre 148-158 et DPIC 732) : deux lectures à concilier (divergence).
- **Branches `<soit:>` laissées toutes deux**, ou instructions en italique non supprimées — plus fréquent ici, les
  cellules 744/748 portant quatre branches et leurs sous-options.
- **Textes empruntés** (art. 14 du CCAP, rédigé pour des fournitures) : présents ou supprimés selon l'acheteur.
- **Formats** : les documents types sont en `.doc` (conversion Word préalable, cf. `extraire-pi.mjs`) ; un dossier réel
  arrivera plutôt en PDF.

### 4.4 Questions au pilote

1. **Périmètre du DPIC produit** : seulement le tableau 1.3 (l. 721-777), ou toute la première partie — page de garde,
   **lettre d'invitation**, IC (texte fixe, joint tel quel comme aux fournitures) ?
2. **Liste restreinte et manifestation d'intérêt** : où sont saisis les consultants présélectionnés (l. 142 : « liste
   des 5 candidats ») ? Faut-il une lettre par consultant ? Le modèle ne connaît que quatre modes (SFQC, budget
   déterminé, moindre coût, qualité seule) : la sélection **fondée sur les qualifications** et le **consultant
   individuel** sont-ils hors périmètre ?
3. **Grille de notation** : créer un champ tableau (sous-critères, postes du personnel clé, sous-pondérations) ou se
   limiter aux cinq totaux `B06-TP-02` à `-06` ? Créer le **score technique minimum**, **T** et **F** ?
   `B06-TP-01` (total), `B06-OF-01` et `B06-CS-01` : que doivent-ils porter, puisque le modèle n'a pas de trou pour eux ?
4. **Cohérences** : « qualité technique exclusivement » ⇒ « uniquement une proposition technique », sans formule Sf ni
   poids T/F — déduire (une seule question) ou contrôler (deux questions) ? `B05-PF-02` « Montant du forfait » est-il
   le **budget disponible** de la sélection à budget déterminé ?
5. **Groupement** : la rangée DPIC 735 traite groupement **et** sous-traitance d'une seule phrase — quelle clé
   commande ? Le CCAP art. 3 impose « solidaires » ou « conjoints » alors que `formeGroupement` offre « au choix » ou
   « solidaire obligatoire » : faut-il une troisième valeur ? `alloti` a-t-il un sens en PI ?
6. **Langue** : ajouter l'option « une autre langue que le français » à `B04-LP-01` ?
7. **Pénalités** : garder `B09-PP-01` ou le cadrage `penalites` ? Le plafond du CCAG PI est de **10 %** (l. 373) alors
   que le contrôle s'appelle `PENALITES_PLAFOND_15` ; créer les champs millièmes / plafond (l. 371, 375) ?
8. **Assurances** : un seul montant (`B09-AP-01`) pour quatre couvertures — créer les autres ? **Avance** : taux en
   devises (l. 268) ? **Intérêts moratoires** : `B08-IP-01` est-il un taux ou un nombre de points ?
9. **Art. 14 du CCAP** (fourniture de matériel, texte de fournitures) et `B09-FC-01` inactif : garder l'article ?
10. **Procédure contentieuse** : le modèle ne propose que l'arbitrage CNUDCI (« à valider », pour consultant
    étranger) — faut-il une branche « tribunaux malgaches » et une clé ?
11. **Termes de référence** : pièce téléversée par l'acheteur, champ texte, ou hors du document produit ?
12. **AE au stade du dossier** : les champs `B03-TP-*`, `B03-SP-03`, `B03-NP-01`, `B08-AI-02` visent des blancs du
    candidat ; les imprimer seulement dans l'AE du marché conclu (IC 10.3 : le Client prépare l'AE après négociation) ?
    `B08-DP-01` et `B02-SP-01` : choix de dossier ou d'attribution ? `B02-SP-01` et `B08-RP-01` doivent-ils rester
    obligatoires ?
13. **Champs manquants simples** : date de la lettre d'invitation (AE 86, 138), délai de réponse de la PRMP (DPIC 737),
    date des négociations (IC l. 651), lieu d'exécution (CCAP 155), ville d'élection de domicile (CCAP 172), délai de
    vérification (CCAP 388), indices de révision (CCAP 248) — à créer ou à laisser en blanc ?
14. **Coquilles du modèle officiel** : « clause 6.2.1 des DPIC » (AE 159, 163 — la clause est 7.2.2), « indiqué dans
    les DPAO » (IC l. 408), « article 160 du CCAG » (CCAP 363), « montant total des **travaux** » (CCAP 264),
    « Maître d'œuvre » (CCAP 206), « objet et lieu d'exécution des **travaux** » (CCAP 155), sommaire PF1-PF5 vs
    PF1-PF6 : décalque fidèle ou correction ?
15. `B04-LH-02` : passer en `DATE_HEURE` (l'heure est exigée au format 24 h) ?
