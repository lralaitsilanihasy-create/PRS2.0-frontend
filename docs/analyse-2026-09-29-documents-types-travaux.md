# Analyse des documents types ARMP — Travaux (DPAO, AE, CCAP) et contrat-cadre de travaux

**Date** : 2026-09-29 · **Mode** : lecture seule · **Sources** : `Documents Types/Travaux/` (docs 2, 4, 5), référentiels servis (marché ordinaire : 183 champs ; contrat-cadre : 158), classeur `NatureMarches/DAO_Travaux.xlsx` (feuilles « A tranche_Alloti » et « Contrat-cadre », converties le 24/09). Plan : `docs/plan-2026-09-29-lot-d4-travaux.md`.

Partie A — DPAO et acte d'engagement ; partie B — CCAP ; partie C — contrat-cadre de travaux (correspondance des codes).

---

# Partie A — DPAO et acte d'engagement du marché ordinaire


Sources : `tx-dpao.txt` (72 lignes physiques, tableau « Clause des IC | Données particulières »), `tx-ae.txt` (450 lignes).
Référentiel : `ref-travaux-QUANTITE_FIXE.csv` (identique octet pour octet à `ref-travaux-A_COMMANDE.csv` — le
référentiel servi ne distingue donc pas les deux types de marché de travaux).

**Notation** : `L33§4` = ligne 33 du fichier, 4ᵉ paragraphe (compté à partir de 0, séparateur U+001E) de la cellule
« Données particulières » (c1). `L56c0§2` = paragraphe de la cellule de gauche. Pour l'AE, `L169` = ligne seule.

---

## PARTIE 1 — DPAO (1.2 Données particulières de l'appel d'offres)

### 1. Structure et parties à retirer

| lignes | contenu | sort |
|---|---|---|
| L7, L11, L16 | bandeaux « DOSSIER TYPE D'APPEL D'OFFRES », « MARCHES PUBLICS DE TRAVAUX », « PREMIERE PARTIE… » | retirer (comme DPAO-F : seul le TITRE L22 reste) |
| L22 | titre « 1.2. - DONNEES PARTICULIERES DE L'APPEL D'OFFRES » | TITRE |
| L26 | phrase d'introduction + appel de note `[note:1]` | garder, **retirer l'appel `[note:1]`** |
| L27 | note 1 (« Des indications pour leur rédaction… doivent ensuite être supprimés ») | retirer entière |
| L30 | en-tête du tableau | garder |
| L31 / L32 | **l'intitulé de clause « 1. Maître de l'Ouvrage… » est seul sur sa rangée (L31, cellule droite vide) et les données sont sur la rangée suivante (L32, cellule gauche vide)** | garder la structure (différent de DPAO-F où intitulé et données partagent la rangée) |
| L40, L43, L64 | rangées-titres de section (5., 6., 9.) | garder |
| L46c0§0, L50c0 | paragraphes vides en tête de cellule gauche ; L47, L48, L50 = rangées de continuation (c0 vide) de la clause 6.3 | garder |
| L56c0 | « 6.9.1 Réunion préparatoire » et « 6.9.2 Visite des lieux » séparés par ~11 paragraphes vides (alignement visuel) | garder tels quels (le rendu n'aligne plus rien, mais ne pas les fusionner) |
| toutes les `<…>` d'instruction | cf. tableau §3 (« retire ») | retirer |
| aucun sommaire | — | — |

Pas de sommaire ni de bloc « Note aux utilisateurs » dans ce fichier (la note est en bas de page, L27).

### 2. Points de choix

| # | lignes | choix | qui choisit | remarque |
|---|---|---|---|---|
| C1 | L32§4-5 | le marché s'inscrit (ou non) dans un projet plus vaste | `B02-OT-01 renseigne` | idem condition PROJET de DPAO-F |
| C2 | L33 (toute la rubrique « Lots ») | présence de la rubrique | `alloti` | |
| C3 | L33§4 **ou** L33§7-11 | « Le lot X faisant partie de N lots… » (le marché ne porte que sur UN lot) / « Les lots suivants… » | **AUCUNE** | le DAO de l'application porte sur tous les lots du plan → recommandation : garder seulement la 2ᵉ rédaction (comme DPAO-F), retirer L33§4 |
| C4 | L33§15 / L33§18 | « peut soumissionner pour un ou plusieurs lots » / « ne peut soumissionner que pour la totalité des lots » | `B02-LT-02` (Divisible \| Totalité des lots) — sûr | |
| C5 | L33§20 | limitation du nombre de lots attribuables « mais ne peut prétendre qu'à ….lots » | **AUCUNE** (pas de champ « nombre maximal de lots par attributaire ») | ne peut suivre que C4 = Divisible ; se colle à L33§15 |
| C6 | L36§4-8 | variantes non prises en considération / autorisées | `variantes` | pas de sous-choix d'évaluation (≠ fournitures, B02-VA-01 inutile ici) |
| C7 | L36§10-21 | rubrique « Tranches » | `tranches` | |
| C8 | L36§17 | tranche conditionnelle 2 | `B02-LT-05 renseigne` (à déclarer) | le modèle s'arrête à TC2 ; au-delà, aucun champ |
| C9 | L37 | groupement « conjoint ou solidaire » / « obligatoirement solidaire » | `groupement` + `formeGroupement` (B03-GT-01) — sûr | l'instruction dit « en cas de décomposition en lots » et les deux rédactions parlent de « lots distincts » → question Q4 |
| C10 | L41§1 | « - modèle de garantie de soumission » | `garantieSoumission = OUI` (probable) | |
| C11 | L44§10 | « 4°- Garantie de soumission » | `garantieSoumission = OUI` | |
| C12 | L44§11 | « 5°- <le cas échéant> Certificat de visite des lieux » | **AUCUNE** (pas de champ « visite obligatoire ») | lié à C20 |
| C13 | L46§10-13 | communautés locales / ONG admises | `B03-QT-05 = OUI` — sûr | |
| C14 | L47§5-17 | critères a) à d) « choisir parmi les exemples » | aucun choix réel : B03-QT-07…10 sont `obligatoire = oui` → les 4 critères sont toujours gardés | |
| C15 | L48 | préférence nationale : pièces justificatives | `B06-PN-01 = OUI` **ou** `B03-QT-11 = OUI` — doublon | question Q5 |
| C16 | L50 (rangée entière) | qualification des membres d'un groupement | `groupement = OUI` | |
| C17 | L50§2-7 | sous-bloc « groupements conjoints » | `formeGroupement = CONJOINT_OU_SOLIDAIRE` (probable) | le sous-bloc solidaire (L50§10-21) vaut dans les deux formes |
| C18 | L52 | prix fermes / révisables | `prixRevisable` (B05-VR-01) — sûr | |
| C19 | L53 | monnaie : a) tout Ariary / b) Ariary + annexe devises / c) part en devises | `B05-MN-01` (Ariary \| Devises) — **2 options pour 3 rédactions** | a) = Ariary sûr ; b) et c) indiscernables → question Q6 |
| C20 | L54 | garantie de soumission non demandée / demandée | `garantieSoumission` (B05-GQ-01) — sûr | |
| C21 | L54§6-8 | formes admises (bancaire / caution / chèque) | `B05-GQ-02` (probable ; LISTE à choix unique alors que le texte énumère les trois — sections « contient ») | |
| C22 | L55 | clause Langue présente / absente | `B04-LG-01 renseigne` | |
| C23 | L55§3-4 / L55§7 | « La langue de l'offre est : X » / « le français ou X » | **AUCUNE** (un seul champ texte) | recommandation : garder la 2ᵉ (comme DPAO-F) |
| C24 | L56§1 / L56§4-7 | pas de réunion préparatoire / réunion | `B04-RP-01` — sûr | |
| C25 | L56§10-13 | visite des lieux obligatoire | **AUCUNE** | L56§11 renvoie aux « lieux, date et heures indiqués ci-dessus » = ceux de la réunion → n'a de sens que si C24 = OUI |
| C26 | L60§0, L60§10 | mentions propres à l'allotissement | `alloti` | |
| C27 | L62 | remise papier / électronique | `modeRemise` (B04-SE-01) — sûr | électronique = clause à fournir par le juriste (L62§4 n'est qu'une instruction), comme DPAO-F |
| C28 | L66 (rangée) + L66§3 / L66§6 | évaluation par lot / sur l'ensemble des lots | `alloti` + `B06-EV-01` — sûr | |
| C29 | L67§3-4 / L67§7 | pas de préférence / préférence de x % | `B06-PN-01` — sûr | |
| C30 | L68§2-3 | délais non cumulables | `alloti = OUI` et `B09-DL-05 = OUI` — sûr | |

Pas de choix sur la sous-traitance, l'avance ni la forme des prix (typePrix) dans ce DPAO.

### 3. Trous de l'acheteur

| ligne | texte du trou | champ proposé | certitude |
|---|---|---|---|
| L32§1 | `<insérer la dénomination de l'Autorité Contractante >` | B01-AC-01 | sûr |
| L32§5 | `<préciser, le cas échéant, si le marché fait partie d'un projet…>` | B02-OT-01 | sûr |
| L32§7 | `<décrire la consistance des travaux à exécuter >` | B02-OT-02 | sûr |
| L33§4 | `<insérer la description du lot>` (rédaction « un seul lot ») | B02-LV-02.parLot | probable (rédaction à retirer, C3) |
| L33§4 | `<nombre de lots >` | B02-LV-01 | sûr (même remarque) |
| L33§4, L33§7 | `<insérer la description du projet global>` | B02-OB-01 (objet, PPM) — **B02-LT-01 « Description du projet global » est conditionné `alloti = NON`, soit l'inverse du seul endroit où le texte l'emploie** | probable ; anomalie à signaler (Q2) |
| L33§8-11 | `<insérer la description du lot>` ×3 + « …. » | B02-LV-02 (liste des lots, un paragraphe) | sûr |
| L33§20 | `….lots` (nombre maximal de lots par candidat) | — | aucun champ |
| L36§15 | `- tranche ferme: <compléter selon le projet, l'objet de la tranche…>` | B02-LT-03 | sûr (le libellé dit « objet et montant » ; le texte ne demande que l'objet et l'étendue) |
| L36§16 | `- tranche conditionnelle 1: <compléter selon le projet…>` | B02-LT-04 | sûr |
| L36§17 | `- tranche conditionnelle 2: <compléter selon le projet…>` | B02-LT-05 | sûr |
| L41§0 | `A1, A2,….` (sans chevrons) | B04-CD-01 (liste multiple A1…A4) | sûr |
| L41§1 | `- modèle de garantie de soumission` (sans trou visible) | B04-CD-02 (C1 \| C2 \| C1 et C2) | probable |
| L41§2 | `2.5 - Plan` (sans trou visible) | B04-CD-03 « Plans joints au dossier » | probable |
| L42§4 | `Attention de : <insérer le nom du responsable>` | B01-AC-05 | probable |
| L42§5 | `Rue : <insérer le nom de la rue>` | B01-AC-02 (adresse entière) | probable |
| L42§6 | `Etage/numéro de Bureau : <insérer l'étage…>` | — | aucun champ |
| L42§7 | `Ville : <insérer le nom de la ville>` | — | aucun champ |
| L42§8 | `Code postal : <insérer le numéro du code postal>` | — | aucun champ |
| L42§9 | `Numéro de télécopie : <insérer le numéro>` | — (B01-AC-07 = téléphone, pas télécopie) | aucun champ |
| L42§10 | `Adresse électronique : <insérer l'adresse>` | B01-AC-06 | sûr |
| L42§14 | `<nombre de jours supérieur ou égal à six>` | B04-EQ-01 | sûr |
| L42§18 | `<nombre de jours sus mentionné diminué du délai de réponse…>` | B04-EQ-02 | sûr |
| L44§1 | `<énumérer ces documents ou pièces>` | B04-PI-01 « Documents et pièces constitutifs de l'offre » | probable (B03-CQ-01 « pièces exigées » concurrent) |
| L46§1 | `<indiquer ici les renseignements…>` | instruction → retire | — |
| L46§13 | `<indiquer les formulaires … dispensés de produire>` | — (B03-QT-05 n'est qu'un OUI_NON) | aucun champ |
| L47§1, L47§3 (fin) | `<Indiquer ici les qualifications…>`, `<choisir parmi les exemples…>` | instructions → retire | — |
| L47§7 | `<insérer un montant, Généralement de 2,5 à 5 fois…>` | B03-QT-07 (.lettres ? le texte ne dit pas « en lettres ») | sûr |
| L47§11 | `<Indiquer le type de travaux correspondant à la principale…>` | B03-QT-08 | sûr |
| L47§14 | `<indiquer une liste de ces gros matériels et équipements essentiels>` | B03-QT-09 — **libellé discordant** : le champ dit « Forme sous laquelle l'entrepreneur disposera du matériel », alors que la forme est ce que le *candidat* indique ; le trou est la *liste* du matériel | probable (libellé à corriger, Q7) |
| L47§16 | `<par exemple cinq à dix>` ans | B03-QT-10 | sûr |
| L47§16 | `< par exemple >ans d'expérience en tant que directeur` | — | aucun champ |
| L47§17 | `<Ajouter, si nécessaire, les conditions … personnel clé>` | B03-QT-06 « Qualifications particulières requises » | probable |
| L50§7 | `<préciser … que le mandataire doit … coordination ou de la solidarité…>` (groupement conjoint) | B03-GT-04 « Groupement conjoint : conditions particulières » | probable |
| L50§11 | `<la solidarité des membres… il est conseillé…>` | instruction → retire | — |
| L50§16 | `<préciser les conditions … que chacun des membres doit satisfaire>` | B03-GT-03 « Qualification des membres d'un groupement » | probable |
| L50§17 | `<Pour les marchés qui font intervenir des disciplines…>` | instruction → retire | — |
| L50§21 | `<préciser … que le mandataire doit … coordination>` (groupement solidaire) | B03-GT-05 « Groupement solidaire : conditions particulières » | probable |
| L51§0 | `<nombre>` jours | B04-DV-01 | sûr |
| L53§7 | `<nom de la ou des devises>` | — | aucun champ |
| L53§15 | `<préciser la devise convertible>` | — | aucun champ |
| L54§8 | `chèque de banque libéllé au nom de …..` | — (bénéficiaire ; B01-AC-01 envisageable mais non prouvé) | aucun champ |
| L54§11 | `<insérer montant en chiffres et en lettres>` | B05-GQ-03.lettres (B05-GQ-03) ; `.parLot` si alloti | sûr |
| L55§4 | `<indiquer la langue de l'offre différente du français>` | B04-LG-01 | sûr (rédaction à retirer, C23) |
| L55§7 | `<préciser la deuxième langue de l'offre>` | B04-LG-01 | sûr |
| L56§5 | `<adresse complète>` | B04-RP-02 (lieu, date et heure en un seul champ) | sûr — voir piège P8 |
| L56§6 | `le <date à fixer au moins 21 jours avant…>` | B04-RP-02 (même champ) | probable |
| L56§7 | `à < heures>` | B04-RP-02 (même champ) | probable |
| L56§9 | `< préciser les modalités d'accès des Candidats aux lieux…>` | B04-VL-01 | sûr |
| L59c1 | « Une (01) copie » (texte **fixe**) | contredit L60§2 (nombre de copies à insérer) | aucun champ — Q8 |
| L60§2 | `<insérer le nombre de copies> copies` | B04-FP-01 | sûr |
| L60§5 | `<insérer les mentions et/ou le numéro … sur l'enveloppe…>` | B04-FP-02 | sûr |
| L60§6 | `Le nom et l'adresse du Maître de l'ouvrage :…….` (points, sans chevrons) | B01-AC-01 + B01-AC-02 | probable |
| L60§10 | `- <en cas d'allotissement> la référence et le numéro du lot…` | section `alloti` ; B04-FP-03 n'a **pas** de trou (texte fixe) | — |
| L61§1 | `Attention : <insérer le nom complet de la PRMP…>` | B01-AC-05 | sûr |
| L61§2 | `Lieu :Adresse: <insérer le nom de la rue et le numéro…>` | B01-AC-02 | probable |
| L61§3 | `Étage/Numéro de bureau : <…>` | — | aucun champ |
| L61§4 | `Ville : <insérer le nom de la ville>` | — | aucun champ |
| L61§5 | `Code postal : <insérer le numéro du code postal>` | — | aucun champ |
| L61§9 | `Date : <insérer le jour, mois, année>` | B04-OV-02 (date) | sûr |
| L61§10 | `Heure : <insérer l'heure en utilisant les 24 heures>` | B04-OV-02 (heure) — **le champ est de type DATE, pas DATE_HEURE** | probable (Q9) |
| L62§0, L62§4 | `<s'il n'est pas possible…>`, `<Dans le cas où il est possible…>` | instructions → retire ; électronique = clause du juriste (B04-SE-02…17) | — |
| L63§0 | `Lieu : (insérer le lieu)` — **parenthèses, pas chevrons** | B04-OV-01 | sûr |
| L63§2 | `Heure : (insérer l'heure)` — parenthèses | B04-OV-02 (heure) si l'ouverture suit immédiatement la limite | probable (Q9) |
| L65§1 | `<insérer nombre de jours> jours` | B06-RC-01 | sûr |
| L67§7 | `<pourcentage inférieur ou égal à 10% >` | B06-PN-02 (.chiffres + « % ») | sûr |
| L68§0 | `….. <délai>` (points **et** chevrons : un seul trou en deux morceaux) | B09-DL-01 (TEXTE_LONG « commencement des travaux et fin du marché » — libellé plus large que « un délai ») ; `.parLot` si alloti | probable |

Instructions pures (sort `retire`, aucune donnée) : L33§2, L33§6, L33§13, L33§17, L33§20 (préfixe), L36§2, L36§4, L36§7,
L36§12, L37§0, L37§2, L37§5, L44§11 (`<le cas échéant>`), L46§1, L46§10, L47§1, L47§3 (fin), L48§0, L50§2, L50§11,
L50§17, L52§0, L52§3, L53§0, L53§2, L53§5, L53§12, L54§0, L54§3, L55§0, L55§2, L55§6, L56§0, L56§3, L56§10, L60§0
(préfixe), L60§10 (préfixe), L62§0, L62§4, L66§2, L66§5, L67§0, L67§2, L67§6, L68§2.

### 4. Blancs du candidat / de la notification

Aucun dans le DPAO : c'est une pièce entièrement remplie par l'acheteur. Seules les mentions fixes adressées au candidat
(« certifiées exactes et sincères », certificat de visite à joindre) restent.

### 5. Champs `documentMaitre = DPAO` sans aucun trou dans ce DPAO

- **Identification (PPM)** : B01-AC-03 (ministère), B01-AC-04 (commission), B01-AC-07 (téléphone PRMP — le texte
  demande une *télécopie*), B01-AC-08 (réf. PPM), B01-AC-09 (exercice), B01-AC-12 (nature), B01-AC-13 (mode de
  passation), B01-AC-14 (montant estimatif), B01-AC-15 (financement), B01-AC-16 (bénéficiaires), B01-AC-18 (calendrier),
  B01-AC-19 (forme du marché) — aucun trou ; leur place est l'Avis d'appel d'offres, pas les DPAO.
- **Lots / objet** : B02-LT-01 (projet global, cf. anomalie de condition), B02-LV-03 (montant par lot), B02-OB-03
  (n° du DAO — pourrait nourrir L60§5 mais B04-FP-02 le couvre déjà).
- **Qualification** : B03-CQ-01, B03-CQ-09, B03-CQ-10 (durées d'antécédents : le texte fixe dit « trois dernières
  années » L46§8), B03-QT-01, B03-QT-02, B03-QT-03, B03-QT-04 (les quatre fiches L46§5-8 sont du texte **fixe** sans
  trou ; DPAO-F avait *ajouté* « Niveau exigé : {{…}} » après chacune — même ajout possible ici, à déclarer en
  `ajouts`), B03-QT-11 (doublon de B06-PN-01), B03-GT-01 (choix, pas trou).
- **Offre** : B04-FP-03 (texte fixe L60§10), B04-LG-02 (traduction exigée), B04-SE-02 … B04-SE-17 (seize champs de la
  remise électronique : aucun trou, L62§4 n'est qu'une instruction — ils ne vivent que dans la clause à fournir par le
  juriste, comme dans DPAO-F), B05-GQ-02 (choix), B05-VR-01 (choix), B05-MN-01 (choix).
- B04-PI-01 si l'on préfère B03-CQ-01 pour L44§1 (l'un des deux reste orphelin).

### 6. Tranches et lots

- **Lots** : valeurs par lot utiles dans le DPAO → B02-LV-02 (liste, déjà un texte unique), **B05-GQ-03.parLot**
  (précédent GARANTIE-LOTS des fournitures), **B09-DL-01.parLot** (le délai d'exécution varie en pratique par lot ;
  la phrase L68§3 « délais non cumulables » le suppose). B04-FP-03 : texte fixe, rien à rendre par lot.
- **Tranches** : le DPAO les *définit* seulement (objet et étendue, L36§15-17) ; il n'y a **pas** de valeur « par
  tranche » à rendre avec un suffixe : un champ par tranche existe déjà (LT-03/04/05), plafonné à TF + 2 TC par le
  modèle lui-même. Les délais d'affermissement sont renvoyés au CCAP (L36§21). Un suffixe `.parTranche` n'est pas
  nécessaire pour le DPAO.
- **Lots × tranches** : si un marché est alloti *et* à tranches, les tranches sont-elles communes à tous les lots ou
  propres à chaque lot ? Le modèle ne le dit pas (L36 parle « des travaux ») → Q3.

### 7. Pièges pour l'import (DPAO)

- **P1 — jumeaux mot pour mot** :
  - L42§7 = L61§4 « Ville : <insérer le nom de la ville> » et L42§8 = L61§5 « Code postal : <insérer le numéro du code
    postal> » (même trou, deux clauses : éclaircissements / remise des offres) ;
  - L50§6 = L50§19 « Le mandataire doit satisfaire au moins aux conditions de qualifications suivants: », et leurs trous
    L50§7 / L50§20 commencent par le même texte (« <préciser les conditions de qualification minimales que le
    mandataire doit éventuellement satisfaire au titre de sa mission de coordination ») — à désigner par rang ;
  - L33§8, §9, §10 : trois fois `<insérer la description du lot>` (et une 4ᵉ dans L33§4) ;
  - L36§15-17 : même trou « <compléter selon le projet, l'objet de la tranche et son étendue> » ×3, distingués par le
    seul préfixe « tranche ferme / conditionnelle 1 / 2 » ;
  - L42§14 et L42§18 finissent par la même phrase fixe « jours avant la date limite fixée pour la remise des offres
    figurant à la clause 7.2 ci-dessous. » ;
  - L37§3 / L37§6 partagent le préfixe « Les groupements entre Candidats soumissionnant pour des lots distincts » ;
  - L62§2 (papier) reprend le texte que l'import doit reconnaître tel quel ; pas de jumeau ailleurs.
  - Variantes d'orthographe des marqueurs : `<soit:>`, `<soit>`, `<soit :>`, `<ou>` — à retirer tous.
- **P2 — paragraphes réduits une fois l'instruction retirée** :
  - L44§3 « 2° - » : numéro seul (la liste suit en L44§4-9 ; la numérotation saute de 2° à 4°, pas de 3°) → le garder
    (ce n'est pas une instruction) mais le signaler comme ligne à lettre seule, à ne pas confondre ;
  - L56§6 « le <date…> » et L56§7 « à < heures> » se réduisent à « le » et « à » si l'on range adresse+date+heure dans
    le seul B04-RP-02 → **retirer ces deux paragraphes entiers** et poser `{{B04-RP-02}}` en L56§5 (leçon PI : paragraphe
    réduit = retiré entier) ;
  - L33§11 « …. » seul (suite de la liste des lots) → retiré entier, B02-LV-02 porte la liste ;
  - L67§4 « nationaux » seul (fin de phrase coupée) → garder, c'est du texte ;
  - L47§13 « (c) » et L47§16 « (d) » : lettres **entre parenthèses** alors que a) et b) n'en ont pas — ne pas « corriger »
    (texte officiel reproduit tel quel) ; l'import doit tolérer les deux formes ;
  - L53§3/6/13 « a) / b) / c) » : une seule rédaction gardée → la lettre reste (« b) Les prix… ») ; texte officiel, à
    laisser, mais le rendu montrera « b) » sans « a) » ;
  - L60§0 « <en cas d'allotissement> : les offres… » : après retrait il reste « : les offres » → retirer aussi « : »
    (sort `typo`/`retire` à tracer) ; L33§20 « <…insérer> mais ne peut prétendre… » commence par « mais ».
- **P3 — deux données collées** :
  - L61§2 « Lieu :Adresse: <…> » deux libellés collés sans espace ;
  - L68§0 « ….. <délai> » : un trou en deux morceaux (points + chevrons) ;
  - L47§16 deux trous dans la même phrase, le second collé à « ans » (« < par exemple >ans ») ;
  - L41§0-2 « 1.3 - modèles… : A1, A2,…. » / « 2.5 - Plan » : numéro de section et trou séparés par un tiret, le trou est
    une ellipse sans chevrons ;
  - L36§15-17 « - tranche ferme: <…> » : tiret de liste + libellé + trou ; si LT-03 contient lui-même « objet – montant »
    (libellé « Objet et montant »), l'import ne saura pas couper.
- **P4 — trous hors chevrons** : L54§8 « au nom de ….. », L60§6 « :……. », L63§0/§2 « (insérer …) » entre parenthèses —
  l'extracteur de trous `<…>` ne les voit pas.
- **P5 — cellule gauche fragmentée** : L56c0 (6.9.1 / 6.9.2 séparés par des paragraphes vides), L66c0 (9.4 / 9.4.3),
  L46c0 (paragraphe vide initial), L31/L32 (intitulé et données sur deux rangées).
- **P6 — contradiction fixe/trou** : L59 « Une (01) copie » fixe vs L60§2 nombre de copies saisi.
- **P7 — clause de visite** : L56§11 renvoie à « ci-dessus » (la réunion) ; si pas de réunion, le renvoi est vide.
- **P8 — un champ pour trois trous** : B04-RP-02 (L56§5-7) et B04-OV-02 (L61§9-10, L63§2) : l'import devra lire une
  date et une heure dans deux paragraphes différents pour un seul champ.

### Comptes DPAO

- **Trous de l'acheteur : 61** — **28 sûrs**, **19 probables**, **14 sans champ** (L33§20, L42§6-9, L46§13, L47§16 2ᵉ trou,
  L53§7, L53§15, L54§8, L59 fixe, L61§3-5).
- **Points de choix : 30** (C1-C30), dont **5 sans clé ni champ** (C3, C5, C12, C23, C25).
- Instructions pures à retirer : ~45 paragraphes ; lignes retirées entières : L7, L11, L16, L27 (+ `[note:1]` en L26).

---

## PARTIE 2 — AE (2.1 Cadre d'acte d'engagement)

### 1. Structure et parties à retirer

| lignes | contenu | sort |
|---|---|---|
| L3, L7, L12, L19 | bandeaux « DOSSIER TYPE… », « MARCHES PUBLICS DE TRAVAUX », « DEUXIEME PARTIE : MARCHE », « 2.1. CADRE D'ACTE D'ENGAGEMENT » | retirer |
| L23-27 | « Note aux utilisateurs à supprimer dans le DAO définitif » | retirer entière. ⚠️ L27 dit que les commentaires **entre parenthèses** s'adressent au candidat et **ne doivent pas être supprimés** : règle à respecter partout (« (en chiffre et en lettres) », « (cocher la case correspondante) »…) |
| L31, L34 | « MARCHÉ PUBLIC DE TRAVAUX », « ACTE D'ENGAGEMENT (A.E) » | TITRE / CENTRE (comme AE-F) |
| L38-75 | en-tête : autorité contractante, marché, procédure, imputation, PRMP, MOD, MOE, cadre de notification (tableau L75) | garder |
| L80-148 | A. Engagement du candidat — individuel (L86-96) / groupement (L99-148) | garder / section |
| L154-237 | Art. 2 Prix — 4 blocs (unitaire, forfaitaire, unitaires + tranches, forfaitaire + tranches) | sections |
| L240-250 | Art. 3 Sous-traitance | voir A11 |
| L253-259 | Art. 4 Nantissement | garder |
| L263-299 | Art. 5 Durée - délais | sections |
| L302-353 | Art. 6 Paiements (domiciliation, avance) | sections |
| L359-376 | signature, liste des annexes | garder |
| L378-391 | B. Acceptation et notification (tableaux) | garder (blancs de la notification) |
| L393-450 | annexes : Annexe 1 (3 variantes), révision, sous-traitance, état des sommes versées | sections |
| L169§0, L172, L183, L210 « Dans le cas d'un marché à… » | étiquettes de variante **non chevronnées** | retirer (sort `retire`, comme les « Choix n ») ; L306/L317/L330 « Dans le cas d'un entrepreneur unique / groupement… » à garder si plusieurs cas de domiciliation restent (A16) |

Pas de sommaire.

### 2. Points de choix

| # | lignes | choix | qui choisit |
|---|---|---|---|
| A1 | L45 | intitulé du marché, avec ou sans « lot n° » | `alloti` (AE produit par lot, `{{LOT}}`) |
| A2 | L51-55 | procédure : AOO art. 18 / pré-qualification art. 19 / deux étapes art. 20 / restreint art. 21 | `B01-AC-13` (mode de passation, PPM) — probable (précédent AE-F, conditions `contient`) |
| A3 | L66 | Maître d'ouvrage délégué « le cas échéant » | **AUCUNE** (pas de champ) |
| A4 | L69 | Maître d'œuvre « le cas échéant » | `B02-MW-01 renseigne` — mais B02-MW-01 est `obligatoire = oui` (contradiction avec « le cas échéant ») |
| A5 | L86-96 / L99-148 | engagement individuel / en groupement | `groupement` (NON → retirer L99-148) ; OUI → les deux restent, le candidat utilise l'un |
| A6 | L102-104 | groupement conjoint / solidaire (case à cocher du candidat) | candidat ; `formeGroupement = SOLIDAIRE_OBLIGATOIRE` pourrait retirer L102-103 — probable |
| A7 | L158 / L160-163 | Ariary seul / paiements en autre monnaie | `B05-MN-01` — sûr |
| A8 | L165-166 | prix révisables | `prixRevisable` — sûr |
| A9 | L169 / L172-179 / L183-207 / L210-237 | prix unitaires / forfaitaire / unitaires avec tranches / forfaitaire avec tranches | `typePrix` × `tranches` — sûr |
| A10 | L204-207, L232-235 | « Tranche conditionnelle … » (TC2) | `B02-LT-05 renseigne` — probable |
| A11 | L242-250 | pas de sous-traitance / sous-traitance (« **Rayer** les dispositions inapplicables ») | **le candidat** — B03-SU-01 existe mais l'acheteur ne peut pas le savoir au DAO |
| A12 | L269-282 | point de départ différé : OS de commencer (L271-273) / tranches (L276-282) | `tranches` pour L276-282 (sûr) ; L269 « <Insérer si… postérieur> » → `B09-DT-01`, mais **ses options n'ont pas l'OS** (approbation / affermissement TC / notification TF) — Q14 |
| A13 | L286 / L290 | délai d'exécution / date de fin du marché | **AUCUNE** |
| A14 | L292-293 | « La période de préparation est comprise dans le délai » | `B09-PT-01 = OUI` (champ CCAP) — probable |
| A15 | L297-299 | date de réception au plus tard | `B09-DL-04 renseigne` — sûr |
| A16 | L306-315 / L317-327 / L330-340 | domiciliation : entrepreneur unique / groupement solidaire / conjoint | `groupement` + `formeGroupement` (précédent AE-F) ; `B08-DB-01` concurrent — Q19 |
| A17 | L345-346 / L348-353 | pas d'avance / avance (le candidat coche « refuse / ne refuse pas ») | `avance` — sûr ; L353 : `groupement = OUI` |
| A18 | L370 / L371-372 | Annexe 1 forfaitaire / unitaires | `typePrix` — sûr |
| A19 | L373, L424-427 | annexe « paramètres de la formule de révision » | `prixRevisable = OUI` — sûr |
| A20 | L374, L429-433 | annexe « demande d'acceptation des sous-traitants » | comme A11 (candidat) — garder |
| A21 | L393-397 / L402-407 / L413-417 | Annexe 1 : forfaitaire / unitaires / **unitaires avec prix partiels et forfaitaires** (mixte) | `typePrix` — la 3ᵉ variante n'a pas d'option connue (options de B05-PT-01 vides dans le CSV) — Q16 |

### 3. Trous de l'acheteur

| ligne | texte du trou | champ proposé | certitude |
|---|---|---|---|
| L39 | `<indiquer le nom >` | B01-AC-01 | sûr |
| L45 | `<Indiquer: l'intitulé principal du Marché, …` | B02-OB-01 | sûr |
| L45 | `… le cas échéant le projet dans le cadre duquel le marché est passé, …` | B02-OT-01 | probable |
| L45 | `… ou le numéro et l'objet du lot compris dans le projet >` | `lot n° {{LOT}}` + B02-LV-02.parLot | probable |
| L58 | `Imputation budgétaire : <à préciser>` | B02-MW-03 (SAISIE, AE) — **B01-AC-17 « Compte(s) budgétaire(s) » (PPM, AE) concurrent**, employé par AE-F | sûr (doublon : Q12) |
| L63 | `<insérer le nom>` (PRMP) | B01-AC-05 | sûr |
| L66 | `<préciser le nom du mandataire, le cas échéant>` (MOD) | — | aucun champ |
| L69 | `<préciser le nom du Maître d'œuvre , le cas échéant>` | B02-MW-01 | sûr |
| L96 | `Dossier d'Appel d'Offres N° du` — **aucun marqueur** entre « N° » et « du » | B02-OB-03 | sûr |
| L96 | `du <date>` (date du DAO) | — | aucun champ |
| L96 | `jusqu'au <date>.` (fin de validité) | `{{DERIVE.fin-validite-offre}}` (précédent AE-F) | probable |
| L148 | `N° du` / `du <date>` / `jusqu'au <date>` (groupement) | B02-OB-03 / — / DERIVE.fin-validite-offre | sûr / aucun / probable |
| L156 | `soit le…………` (J-15 avant la date limite) | nouveau dérivé (date limite B04-OV-02 − 15 j) | probable (aucun champ direct) |
| L169, L174 | `Annexe <N° de l'Annexe>` | constante « 1 » (L370-371) | aucun champ (dérivable) |
| L174, L212 | `prévu à l'article…. du CCAP` | numéro d'article du CCAP travaux (constante du modèle CCAP) | aucun champ (dérivable) |
| L204, L232 | `Tranche conditionnelle … :` | « 2 » si B02-LT-05 renseigné | aucun champ (dérivable) |
| L237 | `<compléter avec les montants des autres tranches s'il y a lieu>` | instruction → retire | — |
| L250 (×2) | `l'Annexe n° <préciser n°>` | numérotation des annexes | aucun champ (dérivable) |
| L255 | `Comptable Assignataire de paiement le……………….` | B03-NT-01 (« Comptable assignataire **et** montant maximal nanti » : un champ pour deux choses) | probable |
| L282 | `<préciser pour chaque tranche les dates ou le délai … notification du marché >` | — (délais d'affermissement par TC) | aucun champ |
| L286 | `Le délai d'exécution est fixé à <insérer délai>` | B09-DL-01 (.parLot) | probable |
| L290 | `Le marché prendra fin <date à préciser>.` | — | aucun champ |
| L299 | `le <date de fin de marché prévue> au plus tard` | B09-DL-04 | sûr |
| L373-375 | `Annexe n° <  > :` ×3 | numérotation | aucun champ (dérivable) |
| L376 | `Autres pièces contractuelles : <à préciser selon les cas>` | — (AE-F employait B09-PC-02, absent du référentiel travaux) | aucun champ |

Instructions pures à retirer : L51 (« <préciser selon le cas : » — **chevron ouvert, fermé à la fin de L55**), L160,
L162, L165, L237, L269, L271, L276, L288, L292, L297, L345, L348, L370-371 (préfixes `<Dans le cas…>`), L373 (préfixe
`<en cas de prix révisables:>`), L400, L410.

### 4. Blancs du candidat / de la notification (à laisser)

- **Notification** : L75 (date de notification — chevron sur deux paragraphes —, cadre « exemplaire unique »), L382
  (acceptation « à : le : »), L385-386 (approbation, visa financier), L391 (reçu notification, avis de réception).
- **Candidat** : identification L87-93, L102-105 (case conjoint/solidaire), L111-146 (membres, mandataire) ; montants
  HT/TVA/TTC et taux « (….%) » L169, L176-179, L186-235 ; montant sous-traité L250 ; montant maximal nanti L257-259 ;
  comptes bancaires L309-313, L321-325, L335-340 ; refus/acceptation de l'avance L350, L353 ; lieu, date, signature
  L359-364 ; contenu des annexes L393-450 (DQE, BPU, paramètres de révision L427, demande d'acceptation, état des
  sommes L439-448).
- Parenthèses « (en chiffre et en lettres) », « (cocher la case correspondante) », « (Compléter pour chacun des
  membres…) », « (A compléter par le Candidat) » : **consignes au candidat, à garder** (L27).

### 5. Champs `documentMaitre = AE` sans aucun trou dans cet AE

- **B01-AC-17** (si B02-MW-03 est retenu pour L58 — l'un des deux reste orphelin).
- **B03-GT-02** « Identification de chacun des membres du groupement » : donnée **du candidat** (L111-146) ; un champ
  SAISIE `obligatoire = oui` de l'acheteur est incohérent.
- **B03-SU-01 / B03-SU-02** : déclaration du candidat (il raye, L242).
- **B05-PT-01** (typePrix) et **B09-DT-01** : choix, pas de trou.
- **B08-DB-01** « Titulaire du paiement » : choix (A16), valeur connue seulement à l'attribution.
- **B09-DL-02** « Période de préparation (jours) » : L293 dit seulement qu'elle est « comprise dans le délai ».
- **B09-DL-03** « Calendrier prévisionnel » : L295 le renvoie « en annexe au CCAP ».
- **B11-AN-01 … B11-AN-05** : ce sont les annexes **remplies par le candidat** (L397, L407, L427, L433, L439) ; au mieux
  des interrupteurs de présence, jamais des trous de l'acheteur.

### 6. Tranches et lots (AE)

- **Lots** : l'AE est produit **par lot** (`{{LOT}}`, précédent AE-F). À résoudre pour le lot de l'AE :
  B02-LV-02.parLot (objet, L45), B09-DL-01.parLot (délai, L286), B09-DL-04.parLot (réception, L299) si les lots ont des
  calendriers distincts ; imputation (B02-MW-03) par lot à confirmer.
- **Tranches** : les montants par tranche (L191-207, L219-235) sont **du candidat**. Ce qui manque à l'acheteur, c'est,
  **par tranche conditionnelle**, la date limite ou le délai de notification de l'affermissement (L282) — et, si le
  pilote le veut, un délai d'exécution par tranche (L286 n'en porte qu'un). Le DPAO plafonne à TF + TC1 + TC2 : **deux
  champs nommés** (affermissement TC1, TC2) suffisent ; un suffixe générique `.parTranche` n'est pas nécessaire.
- AE par lot **et** à tranches : les blocs L183-237 valent-ils pour chaque lot ? (même question Q3 que le DPAO).

### 7. Pièges pour l'import (AE)

- **P1 — jumeaux** :
  - **blocs entiers identiques** : L185-207 (unitaires + tranches) et L212-235 (forfaitaire + tranches) partagent « Dont
    : », « Tranche ferme », « Tranche conditionnelle 1: », « Tranche conditionnelle … : » et toutes les lignes « montant
    hors taxes : (en lettres et en chiffre) » / « TVA (…%) » / « Soit un montant total TTC… » ; L177-179 = L187-189 =
    L215-217 ; L174 ≈ L212 ; « Le montant du marché est estimé à : » en L169 **et** L186 ;
  - L96 et L148 : « Dossier d'Appel d'Offres N° du <date> » et « jusqu'au <date>. » (individuel / groupement) ;
  - comptes bancaires L309-313 = L321-325 ;
  - « N° de Registre de Commerce : », « N° statistique : », « Identification fiscale : » ×4 (L89, L93, L111, L118-146) ;
  - « ANNEXE 1 » ×3 (L393, L402, L413), « CADRE DU BORDEREAU DES PRIX ET » / « CADRE DU DETAIL QUANTITATIF ET
    ESTIMATIF » ×2 (L404-405 = L415-416), « ANNEXE » ×3 (L424, L429, L435) ;
  - « l'Annexe n° <préciser n°> » ×2 dans la même cellule L250 ; « Annexe n° 1 : » ×2 (L370-371) ; « Annexe n° < > : »
    ×3 (L373-375) ; « à : le : » ×5 (L361, L382, L386 ×2, L391).
- **P2 — paragraphes réduits** :
  - **« Ou » seul** (L350§3, L353§5) et « OU : » (L91, L103) sont des alternatives **du candidat, à garder**, alors que
    « <ou> » seul (L160, L288, L400, L410) est une instruction **à retirer** : un import qui normalise la casse ou ôte
    les chevrons les confond ;
  - L114 « 2. » seul (numéro du 2ᵉ membre) ; L191/L219 « Dont : » ;
  - L169§0 « Dans le cas d'un marché à prix unitaire : » est dans la **même ligne** que son texte, alors que L172, L183,
    L210 sont des lignes séparées : l'étiquette doit être retirée des deux façons.
- **P3 — chevrons à cheval sur plusieurs paragraphes** : L51 « <préciser selon le cas : » … L55 « …article 21 du Code
  des Marchés Publics> » — le contenu de l'instruction **est** l'ensemble des options à garder ; L75 « <date de
  notification à compléter¶ lors de la notification> ». Un détecteur `<…>` par paragraphe ne les voit pas.
- **P4 — deux données collées par un tiret** : L45 en marché alloti rendu « {{B02-OB-01}} — lot n° {{LOT}} » (précédent
  AE-F) : si l'objet contient lui-même un tiret long, l'import ne sait plus où couper — préférer deux paragraphes ou un
  séparateur que l'objet ne peut pas contenir. Même risque au DPAO L36§15-17 (« - tranche ferme: {{B02-LT-03}} », champ
  « objet et montant »).
- **P5 — trous sans marqueur** : « N° du » (L96, L148 : le trou est l'espace entre « N° » et « du »), « soit le………… »
  (L156), « article…. » (L174, L212), « TVA (….%) », « le………………. » (L255).
- **P6 — coquilles officielles** (à reproduire telles quelles) : L148 « adopté par 2006-343 » (sans « décret n° »),
  L353 « Pariculières », L194/L222 « (…. ;%) », L169 « prix unitaire » vs L183 « unitaires », L441 « Nom etadresse ».

### Comptes AE

- **Trous de l'acheteur : 32** — **8 sûrs** (L39, L45 objet, L58, L63, L69, L96 N°, L148 N°, L299), **7 probables**
  (L45 projet, L45 lot, L96 et L148 fin de validité, L156, L255, L286), **17 sans champ** dont **11 dérivables**
  (numéros d'annexe, d'article du CCAP, de tranche) et **6 vraiment manquants** (L66 MOD, L96 et L148 date du DAO, L282
  affermissement, L290 date de fin, L376 autres pièces).
- **Points de choix : 21** (A1-A21), dont **2 sans clé** (A3, A13) et **3 laissés au candidat** (A6, A11, A20).

---

## Comptes globaux

| | DPAO | AE | total |
|---|---|---|---|
| trous sûrs | 28 | 8 | **36** |
| trous probables | 19 | 7 | **26** |
| trous sans champ | 14 | 17 (11 dérivables) | **31** |
| points de choix | 30 (5 sans clé) | 21 (2 sans clé, 3 au candidat) | **51** |

## Questions pour le pilote (avec recommandation)

| # | question | recommandation |
|---|---|---|
| Q1 | DPAO L33 : « Le lot X faisant partie de N lots » ou « Les lots suivants… » ? | la 2ᵉ seule (le DAO couvre tous les lots), comme DPAO-F |
| Q2 | B02-LT-01 « Description du projet global » conditionné `alloti = NON`, alors que le texte ne l'emploie qu'en allotissement | demande backend : `alloti = OUI` ; en attendant B02-OB-01 |
| Q3 | lots **et** tranches : tranches communes ou propres à chaque lot ? | communes (L36 parle « des travaux ») ; `.parLot` sur LT-03/04/05 plus tard si besoin |
| Q4 | clause Groupements (L37) réservée aux marchés allotis (« lots distincts ») ? | la rendre dès `groupement = OUI`, comme DPAO-F |
| Q5 | préférence nationale en double : B03-QT-11 et B06-PN-01 | B06-PN-01 seul pilote L48 et L67 ; B03-QT-11 à retirer (backend) |
| Q6 | monnaie : 3 rédactions, 2 options (B05-MN-01), noms de devise sans champ | Ariary → a), Devises → c) ; b) retirée ; champ « devise(s) » demandé |
| Q7 | B03-QT-09 : libellé « forme de disposition du matériel » ≠ trou « liste du matériel essentiel » | renommer « Gros matériels et équipements essentiels exigés » |
| Q8 | L59 « Une (01) copie » fixe contredit L60 « <nombre> copies » | retirer la phrase L59 (retrait tracé : contradiction avec 7.1) |
| Q9 | B04-OV-02 de type DATE porte date **et** heure (L61§9-10, L63§2) | demande backend : DATE_HEURE ; heure d'ouverture = heure limite |
| Q10 | visite des lieux obligatoire (L44§11, L56§10-13) sans champ | champ OUI_NON demandé ; en attendant, paragraphes retirés |
| Q11 | adresses éclatées (étage, ville, code postal, télécopie — L42, L61) | un seul paragraphe « Adresse : {{B01-AC-02}} », lignes éclatées retirées (précédent DPAO-F) |
| Q12 | AE L58 : B02-MW-03 ou B01-AC-17 ? | B02-MW-03 (libellé exact), prérempli par B01-AC-17 |
| Q13 | sous-traitance (AE L242) : c'est le candidat qui raye | garder les deux rédactions ; B03-SU-01/02 hors fiche de l'acheteur |
| Q14 | point de départ (AE L269-282) : B09-DT-01 sans option « OS de commencer » | clause OS rendue hors tranches, clause tranches si `tranches = OUI` (cf. DEPART-OS des PI) ; options à aligner |
| Q15 | AE L286 délai / L290 date de fin | délai (B09-DL-01), L290 retirée |
| Q16 | Annexe 1 « prix unitaires comprenant des prix partiels et forfaitaires » : quelle option de typePrix ? | demander au backend si MIXTE existe ; sinon retirer la variante |
| Q17 | délais d'affermissement des TC (AE L282) sans champ | deux champs nommés (TC1, TC2), pas de `.parTranche` |
| Q18 | Maître d'ouvrage délégué (AE L66) et « autres pièces contractuelles » (L376) sans champ | demande backend (deux champs facultatifs) ; en attendant, retirés si vides |
| Q19 | B08-DB-01 « Titulaire du paiement » saisi par l'acheteur alors que connu à l'attribution | domiciliation pilotée par `groupement`/`formeGroupement` ; B08-DB-01 retiré de la saisie |

---

# Partie B — CCAP du marché ordinaire


Source : `tx-ccap.txt` (999 lignes réelles ; une ligne = un paragraphe, TAB = cellule, U+001E = paragraphe de cellule).
Référentiel : `ref-travaux-QUANTITE_FIXE.csv`, 72 champs `documentMaitre = CCAP` (dont 6 PIECE B11-FR-01..06).
Méthode : alignée sur `modeles/CCAP-F.txt` (`{{CODE}}`, `{{SI:NOM}}…{{FINSI:NOM}}`, CONDITION en tête).
Lecture seule — aucun fichier du dépôt modifié.

---

## Tranche 1 — lignes 1 à 196 (page de garde, sommaire, notes)

### Structure
- 1-17 : bandeau « DOSSIER TYPE D'APPEL D'OFFRES / MARCHES PUBLICS DE TRAVAUX / 2.2 CAHIER DES PRESCRIPTIONS SPECIALES » → **à retirer** (identification du fascicule du dossier type, pas du DAO produit) — même choix que CCAP-F (qui commence au CENTRE « MARCHÉ PUBLIC DE FOURNITURES »).
- 22 : « MARCHÉ PUBLIC DE TRAVAUX » → CENTRE ; 28 : TITRE.
- 33-66 : page de garde (AC, marché, procédure, PRMP, MOD, MŒ).
- 71-93 : composition du CPS (liste d'annexes) — texte fixe à garder.
- 99 : SOUS_TITRE CCAP ; 108 : préambule (appel de note `[note:1]`) ; 193 : second préambule — garder.
- **À retirer** : 109 (texte de la note 1), 118 (encadré « NOTE AUX UTILISATEURS A SUPPRIMER DANS LE DAO DEFINITIF »), 125-188 (TABLE DES MATIERES, numéros de page).
- 85-89 : « Annexe (à numéroter) : Liste de plans / Planning… / personnel cadre / matériels » — indentation par espaces ; « (à numéroter) » est une instruction → retirer la parenthèse, garder les quatre intitulés.
- 80-81 : « Annexe: Cadre de Bordereau de prix et de Détail quantitatif » + « et estimatif » coupé sur **deux paragraphes** (piège de rapprochement : réunir ou garder les deux lignes fixes).

### Points de choix
- 50-55 : procédure — AUCUNE clé de cadrage ; comme CCAP-F, choix par `B01-AC-13` (Mode de passation) : AOO / PREQUALIFICATION / DEUX-ETAPES / RESTREINT. Les 4 phrases 52-55 sont dans **une** instruction `<préciser selon le cas : …>` (ouvre en 51, ferme en 55 par `>`).
- 44-45 : « le cas échéant, le projet… ou le numéro et l'objet du lot » → `{{SI:PROJET}}` (B02-OT-01 renseigné) et `{{SI:ALLOTI}}` possibles, mais une seule instruction ; recommandation : `{{B02-OB-03}} — {{B02-OB-01}}` comme CCAP-F.
- 62, 66 : « le cas échéant » → sections conditionnelles possibles (MOD / MŒ renseignés).

### Trous de l'acheteur
| ligne | texte | champ proposé | certitude |
|---|---|---|---|
| 34 | `<indiquer le nom et l'adresse>` | B01-AC-01 (+ B01-AC-02 adresse) | sûr (AC) / probable (adresse) |
| 43-45 | `<indiquer les références et l'intitulé principal du Marché…>` (3 lignes) | B02-OB-03 — B02-OB-01 (+ B02-OT-01 si projet) | sûr |
| 51-55 | `<préciser selon le cas : …>` | choix par B01-AC-13 (pas un trou, une section) | sûr (même règle que CCAP-F) |
| 59 | `<Insérer le nom>` (PRMP) | B01-AC-05 | sûr |
| 62 | `MAITRE D'OUVRAGE DELEGUE : <préciser le nom du mandataire, le cas échéant>` | aucun champ (pas de « maître d'ouvrage délégué » au référentiel) | aucun champ |
| 66 | `MAITRE D'ŒUVRE : <préciser le nom du Maître d' oeuvre, le cas échéant>` | B02-MW-01 (documentMaitre AE, « nom et coordonnées ») | probable |

### Blancs à laisser
- Aucun (entrepreneur/banque/notification) dans cette tranche.

### Pièges
- 62 et 66 : libellé fixe + trou **dans le même paragraphe** (« MAITRE D'ŒUVRE : <…> ») — l'import doit couper après « : ».
- 58 : « PRMP) ou son DELEGUE: » (casse différente de CCAP-F « OU SON DELEGUE: ») — ne pas copier la ligne de CCAP-F.
- 75-79 : cinq intitulés d'annexe presque identiques (« Modèle de garantie bancaire de … » / « Modèle de caution … de … ») : ne différent que par « bonne exécution » / « restitution d'avance ».
- 76 : espace final (« bonne exécution ␣ »).

---

## Tranche 2 — lignes 197 à 400 (articles 1 à 11.1)

### Structure
- Art. 1 (197-257) : 1.1 Objet (199-224), 1.2 Intervenants (227-257 : 1.2.1 MO, 1.2.2 MOD, 1.2.3 MŒ).
- Art. 2 Notifications (259-263) · Art. 3 Engagements financiers (265-269) · Art. 4 Groupements (271-280) · Art. 5 Tranches conditionnelles (281-287) · Art. 6 Documents contractuels (288-304) · Art. 7 Garanties (306-362 : 7.1 à 7.4) · Art. 8 Assurances (363-370) · Art. 9 Discrétion/sécurité (372-380) · Art. 10 Contrôle des prix de revient (381-388) · Art. 11 Prix (389-…), 11.1 Contenu (391-397).
- **À retirer (instructions pures)** : 207, 218, 252 (`<ou>`), 254, 267, 273, 275, 278, 287, 294-296, 299, 310 (partie `<…>`), 314, 318, 327, 333, 337, 343, 346, 351, 354, 359, 362, 368, 374, 377, 383, 386, 395 ; dans les cellules 370/397 les sous-paragraphes `<ajouter si…>`, `<cas où…>`, `<si le délai…>`, `<si une contrainte…>`, `<pour la fourniture…>`, `<préciser si le MO fournit…>`.
- **Exemples « à adapter »** : 368 annonce que 370 (A-, B-, C- assurances) est « un exemple à adapter » ; 395 annonce que 397 (sujétions) est un exemple ; 267 « par exemple: » → 269 est un exemple.
- Erreur du document type : 224 renvoie à « l'article 16 du CCAP » pour les délais d'affermissement ; ils sont à l'**article 5** (l'article 16 traite du règlement des comptes, l. 488). Texte fixe — ne pas corriger sans arbitrage.

### Points de choix
| lignes | choix | clé / champ |
|---|---|---|
| 201 | phrase « dans le cadre de <opération> » | `{{SI:PROJET}}` sur B02-OT-01 renseigné (sûr ; CCAP-F utilise B02-AU-01) |
| 207-213 | bloc lots | `alloti` (`{{SI:ALLOTI}}`) |
| 218-224 | bloc tranches | `tranches` (`{{SI:TRANCHES}}`) |
| 237-244 | MOD | aucun champ au référentiel → AUCUNE clé (champ à créer, ou section retirée) |
| 249-257 | MŒ désigné `<ou>` pas de MŒ | B02-MW-01 renseigné / vide (probable) |
| 273-280 | solidaire / conjoint | `groupement` + `formeGroupement` (SOLIDAIRE_OBLIGATOIRE → 276 ; CONJOINT_OU_SOLIDAIRE → 276 + 280, comme CCAP-F) ; groupement = NON → article vide (à arbitrer) |
| 281-287 | tranches conditionnelles | `tranches` ; article entier sous `{{SI:TRANCHES}}` (sinon « Non applicable » à ajouter ?) |
| 299-304 | CPC / TBM bâtiment | AUCUNE clé (« en cas de construction ou réhabilitation de bâtiment ») → OUI_NON à créer, ou laissé dans B09-DC-01 |
| 310-311 / 314-323 | GBE non requise / requise | B05-GE-01 (sûr) |
| 318-323 | taux différencié devises/Ariary | B05-GE-02 renseigné (probable) |
| 327-331 | forme(s) de la GBE | B05-GE-03 (LISTE ; le texte dit « un ou plusieurs » → LISTE_MULTIPLE souhaitable) |
| 333-338 | libération 50 % / 100 % | B05-GE-04 (LISTE, 2 options = les 2 phrases ; sûr) |
| 343-347 | retenue non / oui | B05-RG-01 (sûr) ; `<ajouter le cas échéant:> ou une caution` → AUCUN champ |
| 351-355 | restitution d'avance non / oui | B05-GA-01 (sûr ; cohérence avec `avance`) ; « ou une caution » → AUCUN champ |
| 359-362 | autres garanties | B05-AG-01 renseigné / vide (sûr) |
| 370 C- | RC décennale (bâtiment) | B09-AC-03 renseigné (probable) |
| 374-380 | discrétion non / oui ; notification / annexe | B09-OD-01, B09-OD-02, B09-OD-03 (sûr, schéma SECURITE-* de CCAP-F) |
| 383-388 | contrôle des prix de revient non / oui | B09-PV-01 (+ B09-PV-02) (sûr) |
| 397 | cinq sujétions optionnelles | B09-CH-01 à B09-CH-05 renseigné / vide (sûr) |

### Trous de l'acheteur
| ligne | texte | champ proposé | certitude |
|---|---|---|---|
| 201 | `<préciser le nom de l'opération, le cas échéant>` | B02-OT-01 | sûr |
| 204 | `<indiquer l'objet et le lieu d'exécution des travaux >` | B02-OB-01 (lieu : aucun champ ; B02-OT-02 ?) | probable |
| 209 | `Ces travaux comprennent <nombre > lots :` | B02-LV-01 | sûr |
| 211-213 | `- Lot n°1 : <…>` / `Lot n°2` / `- etc.` | B02-LV-02 (la liste entière remplace 211-213) | sûr |
| 221 | `- tranche ferme <compléter…>` | B02-LT-03 | sûr |
| 222 | `- tranche conditionnelle 1 <…>` | B02-LT-04 | sûr |
| 223 | `- tranche conditionnelle 2 <…>` | B02-LT-05 | sûr |
| 231 | `<Préciser les nom et coordonnées du Maître de l'ouvrage>` | B01-AC-01 (+ B01-AC-02) | probable |
| 234 | `<Préciser les nom et coordonnées>` (PRMP) | B01-AC-05 (+ B01-AC-06/07) | sûr |
| 239 | `<à compléter, le cas échéant>` (MOD) | — | aucun champ |
| 241 | `…au mandat du <date à compléter selon le projet> est:` | — | aucun champ |
| 242 | `<Préciser les nom et coordonnées>` (MOD) | — | aucun champ |
| 249 | `<indiquer les référence du lien contractuel …>` | B02-MW-02 | sûr |
| 249 | `en date <à préciser>` | — (date du contrat de MŒ, peut tenir dans B02-MW-02) | aucun champ |
| 250 | `<Préciser le nom et les coordonnées du Maître d'œuvre >` | B02-MW-01 | sûr |
| 256 | `…assurées par <préciser l'autorité désignée par la PRMP>` | — | aucun champ |
| 263 | `<mentionner l'adresse de notification …>` | B09-NE-01 | sûr |
| 269 | `…effectuée: <nombre> jours avant la fin de chaque trimestre…` | B08-EF-01 | sûr |
| 283 | TC1 `<nombre de jours ou de mois>` | — (délai d'affermissement) | aucun champ |
| 285 | TC2 `<nombre de jours ou de mois>` | — | aucun champ |
| 294-296 | `<Enumérer: …>` documents contractuels | B09-DC-01 | sûr |
| 300, 304 | `…remise des offres soit le` (date absente, fin de §) | B04-OV-02 − 15 j (calcul) | aucun champ |
| 316 | `<insérer le pourcentage … ≤ 5%>` | — (taux de GBE absent du référentiel travaux) | aucun champ |
| 321 | `<insérer le pourcentage>` partie devises | B05-GE-02 | probable |
| 323 | `<insérer le pourcentage>` partie Ariary | — | aucun champ |
| 329 | `…Annexe <numéro> …` (GB) | constante = n° de l'annexe B11-FR-02 | aucun champ (constante) |
| 330 | `…Annexe <numéro> …` (caution) | constante = n° de l'annexe B11-FR-03 | aucun champ (constante) |
| 331 | `chèque de banque établi à l'ordre de <à préciser>` | — (B03-NT-01 comptable assignataire ?) | aucun champ |
| 347 | `Une retenue de garantie de <maximum 5 %>` | B05-RG-02 | sûr |
| 362 | garanties spécifiques (rien après l'instruction) | B05-AG-01 | sûr |
| 370 A- | § installations et engins (exemple) | B09-AC-01 (bloc entier) | probable |
| 370 B- | `délai de <nombre de jours> jours` + 3 × `<préciser le montant>` | B09-AC-02 (bloc entier) | probable — aucun champ atomique |
| 370 C- | `<nombre de jours>` + 3 × `<préciser le montant>` | B09-AC-03 (bloc entier) | probable — aucun champ atomique |
| 380 | `mentionnées en Annexe <n°> au présent CCAP` | B09-OD-03 | probable |
| 388 | `<préciser … éléments … soumis à contrôle …>` | B09-PV-02 | sûr |
| 397 | `pendant la période de <début> heures à <fin> heures` | B09-CH-03 (bloc) | probable |
| 397 | `…énumérées à l'Annexe <numéro> du CCAP` | B09-CH-05 | probable |
| 397 | sujétions 1, 2, 4 (texte fixe) | B09-CH-01/02/04 : TEXTE_LONG — remplace-t-il l'exemple ou l'active-t-il ? | probable |

### Blancs à laisser
- Aucun blanc d'entrepreneur / banque / notification dans cette tranche.

### Pièges
- **370 et 397 sont chacun UN paragraphe-cellule** (tableau à une cellule, 20+ sous-paragraphes séparés par U+001E) : tout l'article 8 et toutes les sujétions de 11.1 tiennent dans une ligne. Découper par U+001E pour poser les sections A/B/C et les 5 sujétions.
- 276 : phrase identique à CCAP-F au mot « Entrepreneurs »/« Fournisseurs » près ; 344, 352, 360, 375, 384 : cinq « Non applicable » **identiques** (384 avec un point) — rapprocher par article, jamais par texte seul.
- 310 : instruction close par `>.` ; 327 : `:>:`.
- 212 : chevron fermé par `)` (« < préciser … du lot). ») — un analyseur de `<…>` ne trouve pas la fermeture.
- 211-213 : liste d'exemples (Lot n°1, Lot n°2, etc.) à remplacer par B02-LV-02.
- 347, 355 : `<ajouter le cas échéant:>` **au milieu** d'une phrase fixe (option « ou une caution »).
- 379-380 : options commençant par « Soit : » sans chevron.
- 300-304 : « soit le » en fin de paragraphe, date manquante (blanc sans chevron) ; espaces multiples ; « du31.12.64 » collé.
- 249 : deux trous dans une même phrase (référence + date).

---

## Tranche 3 — lignes 398 à 598 (articles 11.2 à 26)

### Structure
- 11.2 Monnaie (403-410) · 11.3 Type de prix (412-418) · 11.4 Variations dans les prix (420-439)
- Art. 12 Règlement des comptes (441-454 : 12.1, 12.2 régie) · Art. 13 Acomptes sur approvisionnements (456-463) · Art. 14 Avances (466-481) · Art. 15 Intérêts moratoires (483-485) · Art. 16 Modalités de règlement (488-509) · Art. 17 Augmentation (512-516) · Art. 18 Diminution (517-523) · Art. 19 Natures d'ouvrage (524-528) · Art. 20 Force majeure (530-540) · Art. 21 Délai d'exécution (541-549) · Art. 22 Modification des délais (551-559) · Art. 23 Pénalités (561-571) · Art. 24 Vérification qualitative (573-575) · Art. 25 Matériaux fournis par le MO (577-579) · Art. 26 Préparation (581-596).
- **À retirer** : 405, 414, 417, 422, 438, 445 (sauf si remplacé par le trou), 449, 453, 458, 461, 470, 473, 476, 479, 492, 495, 498, 502, 514, 519, 522, 526, 531, 539, 543, 546, 563, 565, 568, 583, 586, 594 ; dans la cellule 454 le sous-§ `<Lorsque l'on souhaite fixer un pourcentage…>`.
- **Exemples** : 461 « par exemple: » → 463 (cellule) est un exemple ; 534 « par exemple » ; 504-509 grille de découpage forfaitaire (pointillés) = exemple de tableau.
- Titre 599 « Article 27 » ouvre la tranche suivante.

### Points de choix
| lignes | choix | clé / champ |
|---|---|---|
| 405-410 | paiement en devises possible | B05-MN-01 = Devises (DPAO) — probable ; AUCUNE clé de cadrage |
| 414-418 | forfaitaire / unitaire | `typePrix` (B05-PT-01) — sûr |
| 418 | `<ajouter le cas échéant :> décomposé dans le Sous Détail des Prix Unitaires` | AUCUN champ (option intra-phrase) |
| 422-439 | ferme (actualisé) / révisable | `prixRevisable` — sûr (FERME / REVISABLE de CCAP-F) |
| 449-454 | régie non / oui | B08-RE-02 (+ B08-RE-03) — sûr |
| 454 dernier sous-§ | seuil de régie < 3 % | AUCUN champ (option « lorsque l'on souhaite ») |
| 458-463 | approvisionnements non / oui | B08-AP-01 (+ B08-AP-02) — sûr |
| 470-481 | avance non / oui ; taux unique / taux monnaie+devises | `avance` (B08-AF-01) ; sous-choix : B08-AF-03 renseigné vs B08-AF-04/05 renseignés — probable |
| 492-493 | règlement en une fois (≤ 3 mois) | B08-MR-01 — sûr |
| 495-496 | décomptes mensuels : délai | B08-MR-02 renseigné — probable |
| 498-509 | prix unitaires / forfaitaires | `typePrix` — sûr (B08-MR-03 / B08-MR-04 portent le texte) |
| 522-523 | seuil d'indemnisation différent de 25 % | B09-MA-03 renseigné / vide — probable |
| 526-528 | seuil natures d'ouvrage différent de 30 % | B09-MA-04 renseigné / vide — probable |
| 531-540 | force majeure oui / non | B09-FM-01 (+ B09-FM-02) — sûr |
| 543-549 | délai compté après OS / dates limites | AUCUNE clé ; B09-DT-01 (point de départ, AE) ne distingue pas « délai » / « dates limites » — à créer ou choix sur B09-DL-04 renseigné ? |
| 563-571 | pénalités non / oui | B09-PE-01 — sûr ; (clé `penalites` absente de ce référentiel travaux) |
| 583-591 | préparation non / oui | B09-PT-01 — sûr |
| 594-596 | plan d'hygiène et de sécurité | B09-PT-04 renseigné — sûr |

### Trous de l'acheteur
| ligne | texte | champ proposé | certitude |
|---|---|---|---|
| 406 | `…payés en <nom de la devise>` | — (B05-MN-01 ne donne que « Devises ») | aucun champ |
| 434 | `<indiquer la nature des indices et les sources…>` | — (B05-VP-03 de CCAP-F absent du réf. travaux ; B11-AN-03 « paramètres de la formule », AE ?) | aucun champ |
| 439 | révision → Annexe « Formule de révision de prix » | B11-FR-01 (PIECE) | sûr (renvoi) |
| 445 | `<préciser ici les modalités de règlement du prix…>` | B08-RE-01 | sûr |
| 454 | `<Indiquer le taux de charges… frais généraux… marge>` (salaires) | B08-RE-03 (bloc) | probable |
| 454 | `<Indiquer le taux de frais généraux admis et le taux de marge admis>` (autres frais) | B08-RE-03 (bloc) | probable |
| 454 | `…atteint <pourcentage> du montant du Marché` | — | aucun champ |
| 463 | exemple décomptes d'approvisionnement | B08-AP-02 | sûr |
| 477 | `<pourcentage> du montant total des travaux à exécuter` | B08-AF-03 | sûr |
| 480 | `<pourcentage> du montant en monnaie nationale…` | B08-AF-04 | sûr |
| 481 | `<pourcentage> du montant en devises…` | B08-AF-05 | sûr |
| (474) | montant en Ariary : pas de trou au texte | B08-AF-02 | champ sans trou |
| 496 | `au plus tard < nombre de jours> jours ouvrables…` | B08-MR-02 (TEXTE_LONG) | probable (pas de NOMBRE dédié) |
| 500 | règlement prix unitaires (texte fixe) | B08-MR-03 | probable (champ = texte de remplacement ?) |
| 503-509 | découpage forfaitaire en centièmes (4 lignes de pointillés) | B08-MR-04 | probable |
| 514/516 | `<pourcentage inférieur à 20%>` augmentation | B09-MA-01 | sûr |
| 520 | `<pourcentage inférieur à 20%>` diminution | B09-MA-02 | sûr |
| 523 | `au delà de <pourcentage> …ouvre droit à indemnisation` | B09-MA-03 | sûr |
| 528 | `<pourcentage inférieur à 30%>` | B09-MA-04 | sûr |
| 534 | `<à préciser, par exemple, niveau de précipitations, force du vent…>` | B09-FM-02 | sûr |
| 536 | `<préciser le niveau>` ×2 + `<préciser le lieu d'observation>` | B09-FM-02 (bloc) | probable |
| 544 | `Le délai d'exécution est fixé à <insérer délai>` | B09-DL-01 (DPAO, TEXTE_LONG) | probable |
| 548 | `Date limite de commencement des travaux <date>` | — (B09-DL-01 ?) | aucun champ |
| 549 | `Date limite d'achèvement des travaux <date>` | B09-DL-04 (« date de réception », AE) ? | probable faible |
| 555 | `…période cumulé de <indiquer le nombre de jours>` | B09-MD-01 (TEXTE_LONG « conditions ») | probable |
| 559 | `au delà de <nombre> jours d'intempéries` | B09-MD-02 | sûr |
| 571 | `<millièmes> du montant du Marché ou de la tranche` | B09-PE-02 | sûr |
| 571 | `dans la limite de <pourcentage> du montant global…` | — (plafond absent du référentiel) | aucun champ |
| 575 | `<Indiquer … modalités de vérification…>` | B09-VQ-01 | sûr |
| 579 | `<Indiquer … matériaux et produits… stockage>` | B09-PM-01 | sûr |
| 588 | `<préciser le nombre de jours … deux mois …> à compter…` | B09-PT-02 (réf. aussi B09-DL-02, AE) | sûr |
| 591 | `<… au minimum de 10> jours avant l'expiration…` | B09-PT-03 | sûr |
| 596 | `<… au minimum de 10> jours avant l'expiration…` (PHS) | B09-PT-04 | sûr |

### Champs sans trou constatés
- **B08-MO-01** (taux des intérêts moratoires, obligatoire) : l. 485 est un **texte fixe** (« taux directeur de la BCM … augmenté de un point ») — aucun trou. Soit le champ remplace la phrase, soit il est à retirer.
- **B08-AF-02** (montant de l'avance, obligatoire si avance) : le texte ne demande qu'un pourcentage.

### Blancs à laisser
- Aucun (ni entrepreneur, ni banque).

### Pièges
- 423 (« Les prix sont fermes et non révisables. ») et 424-436 : **quasi identiques** à CCAP-F mais 431 diffère (« du mois de la date de la notification du marché l'acte portant… » — « ou » manquant) et 432 (« au mois d'établissement ») ; 439 « révisés … l'Annexe du présent » ≠ CCAP-F « révisables … l'Annexe au présent ». Ne pas reprendre le texte de CCAP-F.
- 422, 438 : option marquée `<Soit>:` (deux-points hors chevron) ; 565, 568 : `<soit> :`.
- 459, 471, 540 : trois nouveaux « Non applicable » identiques (450 aussi).
- 516 / 520 / 528 : trois phrases fixes presque identiques (« Le changement … peut être demandé par ordre de service sans nécessité de conclure un avenant lorsque ces changements n'entraîne pas de … ») — seuls « variations » / « diminution » / « quantités » changent.
- 514 / 519 : instructions identiques au mot près (« augmentation » / « diminution »).
- 591 et 596 : **trous au texte identique** (`<préciser le nombre de jours qui doit être au minimum de 10> jours avant l'expiration de la période de préparation.`) mappés sur deux champs différents (B09-PT-03 / B09-PT-04) — rapprochement uniquement par la ligne-titre précédente (590 / 595).
- 477 et 480-481 : paragraphes commençant par `<pourcentage>` (trou en tête de paragraphe).
- 504-509 : pointillés (`…………%`) = blancs sans chevron ; 508-509 « 5% » / « 100% » collés aux pointillés.
- 454, 463, 536 : cellules à sous-paragraphes (U+001E).
- 571 : deux trous dans une phrase (millièmes + plafond) ; la clé `penalites` (NON / CCAG / PLAFOND_DIFFERENT) des fournitures n'existe pas ici — le plafond est un trou sans champ.

---

## Tranche 4 — lignes 599 à 800 (articles 27 à 32, annexe révision des prix, annexe GB de bonne exécution)

### Structure
- Art. 27 Visa (599-601) · Art. 28 Réception provisoire (603-625 : 28.1 tranches, 28.2 a) début des opérations, b) modalités) · Art. 29 Délai de garantie (627-634) · Art. 30 Résiliation aux torts (635-653, texte fixe en 3 points a-e / a-f) · Art. 31 Procédure contentieuse (654-666) · Art. 32 Dérogations (668-674, tableau à 2 colonnes, **vide**).
- 679-759 : **Annexe « Modèle de formule de révision des prix »** (= PIECE B11-FR-01) : texte explicatif fixe 688-709, tableau des paramètres 719-727, instruction 729-731, texte candidat 733-735, tableau « Origine des indices » Ariary 743-747 et devises 756-759.
- 766-794 : **Annexe « Modèle de garantie bancaire de bonne exécution »** (= PIECE B11-FR-02).
- 796-… : Annexe « Modèle de Caution Personnelle et solidaire de bonne exécution » (B11-FR-03), suite en tranche 5.
- **À retirer** : 607, 615, 623, 629 (« Lorsqu'il est nécessaire de modifier le délai d'un (1) an <indiquer :> » — phrase entière d'instruction), 656, 658, 729-731, 741, 744 (texte de la note 2), 780 (instruction au garant — à garder si la pièce est reproduite telle quelle).
- 625 et 634 : **le même paragraphe deux fois** (« Sur demande de l'Entrepreneur, la réception prononcée par une Commission… ») — dans 28.2 b) et dans 29 ; doublon du document type, à garder deux fois ou signaler.
- 648 : phrase répétée dans le texte (« du fait de cesser la trouble… ») ; 640 « à constitué » ; 641 « Lorsqu' les » — coquilles fixes.

### Points de choix
| lignes | choix | clé / champ |
|---|---|---|
| 605-609 | réception par tranches | B09-RP-01 (condition `tranches = OUI`) — sûr |
| 609 | `<soit> à l'article 1 … <soit> par les Spécifications Techniques` | AUCUN champ (option intra-phrase) — recommandation : figer « à l'article 1 » quand tranches = OUI |
| 615-617 | dérogation au délai de 20 jours | B09-RP-03 renseigné (obligatoire au réf. → toujours présente) |
| 623-624 | repliement hors réception | AUCUN champ (option « le cas échéant ») |
| 629-632 | délai de garantie ≠ 1 an | B09-GT-01 (obligatoire → paragraphe toujours présent) |
| 635-653 | résiliation | AUCUNE (texte fixe) ; B10-RE-01 (obligatoire) sans trou |
| 656-666 | arbitrage international (entreprise étrangère) ou tribunaux | AUCUNE clé ; B10-PC-01 (TEXTE_LONG) remplace 656-666 entier — recommandé |
| 662 | trois membres / arbitre unique | AUCUN champ |
| 668-674 | dérogations | B10-DR-01 renseigné |
| 679-759 | annexe révision | `prixRevisable = OUI` (annexe inutile si prix ferme) |
| 739-759 | Ariary / devises | B05-MN-01 = Devises (probable) |
| 766-794 | annexe GB bonne exécution | B05-GE-01 = OUI et B05-GE-03 contient « Garantie bancaire » |

### Trous de l'acheteur
| ligne | texte | champ proposé | certitude |
|---|---|---|---|
| 601 | `…est donné dans un délai de < nombre de jours>` | B09-VX-01 | sûr |
| 617 | `…de l'avis de l'Entrepreneur est de <jours>.` | B09-RP-03 | sûr |
| 621 | `…décrites en annexe <n°> aux Spécifications Techniques :` | B09-RP-04 | probable |
| (613-617) | opérations préalables | B09-RP-02 (TEXTE_LONG, obligatoire) | aucun trou dédié — champ sans trou |
| 632 | `<Insérer le nombre de mois ou d'années>` | B09-GT-01 (NOMBRE en mois ; le texte admet « années ») | sûr |
| 662 | `…qualifications dans le domaine <à préciser>` | B10-PC-01 (bloc) | probable |
| 664 | `L'autorité de nomination sera : <par exemple> le Président …` | B10-PC-01 (bloc) | probable |
| 666 | `…le siège de l'arbitrage sera : <Antananarivo ou une autre ville…>` | B10-PC-01 (bloc) | probable |
| 674 | tableau « Article des CCAG / Article du CCAP » vide | B10-DR-01 | sûr |
| 715 | `Section(s) des Travaux : <L'indication de sections différentes…>` | — (dans la PIECE B11-FR-01) | aucun champ |
| 721-725 | colonne (2) fourchettes des paramètres (X ≥ 0,15, a, b, c…) | B11-FR-01 (PIECE) ; cf. B11-AN-03 (AE) | probable |
| 743 | `Valeur de base au mois de <mois>` | calcul : mois de (B04-OV-02 − 15 j) | aucun champ |
| 745-747 | codes / descriptions / publications des indices (Ariary) | B11-FR-01 (PIECE) | probable |

### Blancs à laisser (candidat, banque)
- 720-727 colonnes (3)/(4) : valeurs du **Candidat** ; 733 le dit. 754-759 tableau devises : **Candidat**. 756 « [mois](1) ».
- 769-771 : `<nom du Titulaire>`, `<adresse complète du Titulaire>`, `marché n° <intitulé…>`, `<dénomination de l'Autorité Contractante>` → **à laisser** (remplis à la notification / par la banque). NB : `<dénomination de l'AC>` et l'objet du marché pourraient être pré-remplis (B01-AC-01, B02-OB-01) mais le modèle se remplit après attribution — recommandation : laisser.
- 777 `<nom de la Banque>`, `<adresse du siège social>` ; 779 `<insérer le montant…>` ; 789-794 signature, nom, adresse, date, cachet (soulignés `____`) → **banque**.

### Pièges
- 625 = 634 (paragraphe identique dans deux articles).
- 609, 662 : `<soit>` / `<soit :>` **au milieu de la phrase** (deux options dans un même paragraphe).
- 664 : `<par exemple>` suivi d'un exemple en texte clair (« le Président de la Cour d'Arbitrage de la CCI ») — l'exemple doit tomber avec l'instruction.
- 743, 756 : cellules de tableau avec U+001E ; 743 porte un appel `([note:2])` dont la note 744 est un paragraphe à retirer.
- 719-727, 745-747, 757-759 : tableaux à cellules vides (TAB seuls) — ne pas les prendre pour des lignes vides.
- 747, 759 : cellule « (  ) » (parenthèses vides = ligne d'exemple).
- 789-792 : blancs en soulignés `____` collés au libellé.
- 780 : instruction entre chevrons **adressée au Garant**, pas à l'acheteur — ne pas la prendre pour un trou de l'acheteur.

---

## Tranche 5 — lignes 801 à 999 (cautions, GB restitution d'avance, BPU/DQE, notes Spécifications techniques)

### Structure
- 796-824 : Caution personnelle et solidaire de **bonne exécution** (B11-FR-03).
- 827-855 : Garantie bancaire de **restitution d'avance** (B11-FR-04).
- 857-887 : Caution personnelle et solidaire de **restitution d'avance** (B11-FR-05).
- 892-981 : **Cadre de bordereau des prix et DQE** (B11-FR-06) : 900-961 « Notes aux utilisateurs … à ne pas reproduire dans les documents définitifs » → **à retirer** ; 967-972 tableau BORDEREAU DES PRIX ; 976-981 tableau DQE.
- 986-993 : SPECIFICATIONS TECHNIQUES — 988-993 notes « ne doivent pas figurer dans les documents définitifs » → **à retirer** (y compris la « Clause modèle : Equivalence des normes » l. 990, reproductible au choix dans les ST — hors CCAP).
- 997-998 : « Annexe aux Spécifications Techniques / Liste des Plans » (titre seul, contenu = B04-CD-03 plans, DPAO).
- 894 : astérisque « estimatif* » sans note correspondante.

### Points de choix
| lignes | choix | clé / champ |
|---|---|---|
| 796-824 | caution de bonne exécution jointe | B05-GE-01 = OUI et B05-GE-03 contient « Caution » |
| 827-855 / 857-887 | modèles de restitution d'avance | `avance` = OUI (et B05-GA-01 = OUI) ; caution seulement si l'option « ou une caution » (355) est retenue — aucun champ ne le dit |
| 970, 979 | colonnes « Autre(s) monnaie(s) » / « Part en devises » | B05-MN-01 = Devises (probable) ; sinon colonnes figées |
| 981 | `<soit> Forfait <soit unité de mesure>` | `typePrix` (FORFAITAIRE → « Forfait ») — probable |

### Trous de l'acheteur
| ligne | texte | champ proposé | certitude |
|---|---|---|---|
| 971 | `Poste <numéro>- <intitulé>` (BPU) | B11-FR-06 (PIECE) / B11-AN-02 (AE) | probable |
| 980 | `Poste <numéro>- <intitulé>` (DQE) | B11-FR-06 (PIECE) / B11-AN-02 (AE) | probable |
| 981 | `<soit> Forfait <soit unité de mesure>` | `typePrix` | probable |

Les modèles de garantie/caution (796-887) ne contiennent **aucun trou de l'acheteur**.

### Blancs à laisser (caution, banque, titulaire, notification)
- 800 / 861 `< indiquer la dénomination sociale de l'organisme de caution…>` → caution.
- 803 / 863 : `<nom et adresse du Titulaire>`, `Marché n° <numéro>`, `<dénomination de l'AC>`, `en date du <date de conclusion>`, `<intitulé ou objet résumé>` → notification / caution (5 trous par paragraphe).
- 806 / 865 montant ; 816 / 875 `Fait à ___ le ___` ; 819-824, 850-855, 881-887 signature, nom, adresse, date, cachet.
- 832-835, 839, 841, 844 (n° de compte, banque du titulaire) → banque / titulaire.
- 841 : instruction au Garant `<Le Garant doit insérer…>` collée **à la fin** du paragraphe.
- 972 pointillés, 970-981 prix, quantités → **Candidat**.

### Pièges
- **803 ≈ 863** et **809 ≈ 867**, **813 = 872**, **811 ≈ 869 ≈ 846** : paragraphes au texte fixe presque identiques entre les quatre modèles — le rapprochement doit se faire par annexe (titre 797 / 828 / 858), jamais par texte.
- 786, 813, 848, 872 : clause « régie par la loi malgache » identique quatre fois.
- 830-832 : « ATTENDU QUE » isolé sur son paragraphe (≠ 769 où il est collé au trou).
- 971 / 980 : `<numéro>- <intitulé>` — **deux trous collés par un tiret**.
- 981 : cellule à paragraphes U+001E avec un chevron **non fermé** (`<soit ¶ unité de mesure>` : ouvre sur un paragraphe, ferme sur le suivant).
- 953-959 : liste d'exemples de tableaux (« Tableau 4 - etc. ») dans les notes à retirer.
- 988, 990, 993 : trois paragraphes-cellules géants (notes) ; 990 contient une clause modèle entre guillemets typographiques.

---

## Synthèse finale

### Champs CCAP du référentiel (72) sans aucun trou dans le texte
| champ | constat |
|---|---|
| B05-GA-02 Conditions de la garantie de restitution | 355 est un texte fixe ; le champ ne peut que le remplacer |
| B08-AF-02 Montant de l'avance (Ariary), obligatoire si avance | le texte (474-481) ne demande que des pourcentages |
| B08-MO-01 Taux des intérêts moratoires, **obligatoire** | 485 est fixe (« taux directeur BCM + 1 point ») |
| B09-RP-02 Opérations préalables à la réception, obligatoire | 613-617 n'a qu'un trou de délai (B09-RP-03) |
| B10-RE-01 Conditions de résiliation, obligatoire | 635-653 entièrement fixe |
| (faibles) B08-MR-03, B08-MR-04 | 500 et 503 sont fixes ; seuls les pointillés 504-507 appellent une saisie |
| (faibles) B09-CH-01, -02, -04 | sujétions à texte fixe : le champ sert d'interrupteur, pas de texte |
| (faible) B09-MD-01 TEXTE_LONG | le trou 555 est un **nombre de jours** |

### Les six PIECE et leur annexe
| PIECE | annexe (lignes) | condition d'inclusion proposée |
|---|---|---|
| B11-FR-01 Formule de révision | 679-759 | `prixRevisable = OUI` |
| B11-FR-02 GB bonne exécution | 766-794 | B05-GE-01 = OUI et B05-GE-03 = Garantie bancaire |
| B11-FR-03 Caution bonne exécution | 796-824 | B05-GE-01 = OUI et B05-GE-03 = Caution personnelle et solidaire |
| B11-FR-04 GB restitution d'avance | 827-855 | avance = OUI et B05-GA-01 = OUI |
| B11-FR-05 Caution restitution d'avance | 857-887 | idem + option « ou une caution » (355) — **aucun champ** |
| B11-FR-06 Cadre BPU/DQE | 892-981 (notes 900-961 retirées) | toujours |
Hors PIECE : « Liste des plans » 997-998 (annexe aux ST), plans/planning/personnel/matériels (85-89).

### Ce que les TRANCHES demandent au moteur
- 218-224 : objet de chaque tranche → B02-LT-03/04/05 (**une valeur par tranche**, déjà au réf., 2 TC au plus ; « etc. » 287 laisse entendre plus).
- 283, 285 : **délai d'affermissement par tranche conditionnelle** — aucun champ ; il faut un champ par TC (ou une valeur « .parTranche » comme `.parLot` de CCAP-F).
- 571 : pénalités « du montant du Marché ou de la tranche considérée » — une seule valeur suffit (le texte est générique).
- 605-609 : B09-RP-01 (conditionné `tranches = OUI`) ; « délais d'exécution distincts » → la durée par tranche n'existe pas au CCAP (B09-DL-01 unique).
- B09-DT-01 (AE) prévoit déjà « décision d'affermissement » comme point de départ.
- Recommandation : liste répétée par tranche (TF, TC1, TC2…) portant objet + montant + délai d'affermissement + délai d'exécution, sur le modèle de `parLot`.

### Pièges pour l'import
1. Paragraphes à texte fixe identique : « Non applicable » ×9 (344, 352, 360, 375, 384, 450, 459, 471, 540) ; 625 = 634 ; 516/520/528 ; 591/596 (trous identiques → B09-PT-03 vs PT-04) ; 803/863, 809/867, 811/846/869, 786/813/848/872. **Ancrer par titre d'article / d'annexe.**
2. Paragraphes réduits à une option : `<soit>` / `<soit :>` / `<Soit>:` / `<soit> :` / `<ou>` (252) seuls sur leur ligne ; « Soit : » sans chevron (379-380) ; options intra-phrase (347, 355, 418, 609, 662).
3. Champs collés : `Poste <numéro>- <intitulé>` (971, 980) ; libellé + trou (62, 66, 548-549) ; trou en tête de § (477, 480-481) ; deux trous par phrase (249, 571, 536).
4. Listes d'exemples : Lots 211-213, tranches 221-223, assurances 370, sujétions 397, approvisionnements 463, découpage forfaitaire 504-509, arbitrage 660-666, tableaux 953-959.
5. Chevrons mal fermés : 212 (`)`), 981 (fermé au paragraphe suivant) ; `>.` (310), `:>:` (327).
6. Paragraphes-cellules (U+001E) : 118, 370, 397, 454, 463, 536, 743, 756, 969-981, 988-993.
7. Blancs sans chevron : « soit le » (300, 304), pointillés (504-507, 972), soulignés (789-792, 816…).
8. Coquille de renvoi : 224 « article 16 » au lieu de l'article 5.

### Comptes
- 999 lignes (dont ~560 vides) ; 210 chevrons `<` au total (1-196 : 7 ; 197-397 : 79 ; 398-598 : 63 ; 599-800 : 31 ; 801-999 : 30).
- Trous de l'acheteur recensés : ~86 (dont ~45 sûrs, ~28 probables, ~13+ sans champ), hors blancs des modèles de garantie.
- Points de choix : ~40 sections conditionnelles, dont 5 portées par une clé de cadrage (`alloti`, `tranches`, `groupement`/`formeGroupement`, `typePrix`, `prixRevisable`, `avance`) et le reste par des OUI_NON / LISTE du référentiel.
- 72 champs CCAP : 5 sans trou certain, ~6 faibles ; 6 PIECE ↔ 6 annexes.
- Sections à retirer : notes 109, 118, 125-188, 900-961, 988-993 et ~65 instructions.

### Questions pour le pilote (avec recommandation)
1. **Maître d'ouvrage délégué** (62, 237-244) : aucun champ. → Créer B02-MOD-01 (nom et coordonnées) + date du mandat, section conditionnelle « renseigné ».
2. **Délais d'affermissement des TC** (283, 285) : aucun champ. → Valeur par tranche (liste répétée comme `parLot`).
3. **Taux de la garantie de bonne exécution** (316, 323) : absent du référentiel travaux. → Créer un POURCENTAGE (≤ 5 %), B05-GE-02 gardé pour la part devises.
4. **Plafond des pénalités** (571) : absent. → Ajouter un POURCENTAGE, ou reprendre la clé `penalites` des fournitures.
5. **B08-MO-01, B10-RE-01, B09-RP-02, B08-AF-02, B05-GA-02** sans trou : → B08-MO-01 : remplacer 485 par le champ **ou** le rendre non obligatoire (préférence : garder le texte fixe BCM + 1 et supprimer le champ) ; B10-RE-01 : non obligatoire, texte fixe gardé ; B08-AF-02 : non affiché au CCAP (utile à l'AE).
6. **Assurances (370) et arbitrage (656-666)** : blocs d'exemple à trous chiffrés. → Pré-remplir les TEXTE_LONG B09-AC-01/02/03 et B10-PC-01 avec l'exemple ARMP à compléter, pas de champs atomiques.
7. **Clause bâtiment CPC/TBM (299-304)** : → OUI_NON « travaux de bâtiment » à créer (il commande aussi la RC décennale 370 C-).
8. **Forme de la GBE** « un ou plusieurs » (327) vs LISTE mono-valeur B05-GE-03 → passer en LISTE_MULTIPLE.
9. **Option « ou une caution »** (347, 355) : → la déduire de B05-GE-03 (contient Caution) plutôt que créer un champ.
10. **Renvoi erroné « article 16 »** (224) : → corriger en « article 5 » avec encadré de dérogation au document type, ou garder à l'identique (décision du pilote).
11. **Délai vs dates limites** (543-549) : → choix par B09-DT-01 / B09-DL-04 ; sinon champ LISTE à créer.


---

# Partie C — Contrat-cadre de travaux : correspondance des codes

Jetons des modèles DPAC-CC et AE-CC (codes du contrat-cadre de fournitures) rapprochés, par libellé, des champs du contrat-cadre de travaux. `=` même code ; `✓` même libellé, autre code ; `?` douteux ; `✗` aucun équivalent.

```
= B01-AC-01 | ? || même code : Autorité contractante  ⚠️ libellés différents
= B01-AC-02 | ? || même code : Adresse de l'autorité contractante  ⚠️ libellés différents
= B01-AC-05 | ? || même code : Personne responsable des marchés publics  ⚠️ libellés différents
= B01-AC-12 | ? || même code : Nature du marché  ⚠️ libellés différents
= B01-AC-13 | ? || même code : Mode de passation  ⚠️ libellés différents
? B02-AL-02 | Numéro et désignation des lots || B02-LV-02 (0.67) Désignation des lots du plan
✓ B02-DC-01 | Durée maximale du contrat-cadre (mois) || B02-DK-03 (1.00) Durée maximale de validité du contrat-cadre (mois)
✓ B02-DC-02 | Durée de validité du contrat-cadre (mois) || B02-DK-03 (1.00) Durée maximale de validité du contrat-cadre (mois)
✗ B02-DC-04 | Conditions de reconduction de la période de validité || B02-DK-03 (0.25) Durée maximale de validité du contrat-cadre (mois)  — ex æquo B04-VT-01
✗ B02-LV-05 | ? || B01-AC-01 (0.00) Autorité contractante  — ex æquo B01-AC-02
= B02-OB-01 | ? || même code : Objet de l'appel d'offres  ⚠️ libellés différents
? B02-OE-01 | Numéro de l'appel d'offres, de la consultation ou du contrat-cadre || B02-OB-01 (0.67) Objet de l'appel d'offres  — ex æquo B02-OC-01
? B02-PC-01 | Référence de l'article du code des marchés publics de la procédure choisie || B08-AT-04 (0.57) Remboursement de l'avance (article 72.III du code des marchés publics)
? B02-PC-03 | Calendrier de remise en concurrence des titulaires || B07-AT-03 (0.50) Attribution après remise en concurrence (non alloti, multi-attributaire)
✓ B02-SG-01 | Personne responsable des marchés passés sur la base du contrat-cadre || B02-SW-01 (1.00) Personne responsable des marchés passés sur la base du contrat-cadre
✓ B02-SG-02 | Délégation de la personne responsable (décision et date) || B02-SW-02 (1.00) Délégation de la personne responsable (décision et date)
? B02-SG-03 | Acte de nomination de la PRMP (nature, numéro, date) || B01-AC-06 (0.50) Courriel de la PRMP  — ex æquo B01-AC-07
✓ B02-SG-04 | Personne habilitée à signer le contrat-cadre (nom, délégation, date de la décision) || B02-SW-02 (0.80) Délégation de la personne responsable (décision et date)
✓ B04-CP-01 | Date de lancement de la mise en concurrence || B04-CT-01 (1.00) Date de lancement de la mise en concurrence
✓ B04-CP-02 | Date et heure limites de remise des offres || B04-CT-02 (1.00) Date et heure limites de remise des offres
✓ B04-CP-03 | Date de début de la séance d'évaluation des offres et candidatures || B04-CT-03 (1.00) Date de début de la séance d'évaluation des offres et candidatures
✓ B04-CP-04 | Date d'attribution du contrat-cadre || B04-CT-04 (1.00) Date d'attribution du contrat-cadre
✓ B04-CP-05 | Date de notification du contrat-cadre au(x) titulaire(s) || B04-CT-05 (1.00) Date de notification du contrat-cadre au titulaire
? B04-CP-06 | Envoi des demandes d'offres optimisées || B07-PT-02 (0.50) Adresse d'envoi des demandes aux titulaires
? B04-CP-07 | Date limite de réception des offres optimisées || B04-SE-15 (0.50) Date limite des demandes d'assistance
✗ B04-CP-08 | Envoi des courriers de rejet aux candidats non retenus || B04-SE-14 (0.25) Assistance aux candidats (contact, horaires)  — ex æquo B07-PT-02
? B04-DS-01 | Contenu du dossier de consultation || B04-DK-01 (0.67) Pièces ajoutées au dossier de consultation  — ex æquo B04-DK-03
✓ B04-DS-04 | Adresse de retrait du dossier de consultation || B04-DK-03 (1.00) Adresse de retrait du dossier de consultation
✓ B04-DS-05 | Montant à payer pour le dossier de consultation (Ariary) || B04-DK-04 (1.00) Montant à payer pour le dossier de consultation (Ariary)
✓ B04-DS-07 | Adresse de consultation du dossier : nom du responsable || B04-DK-03 (0.75) Adresse de retrait du dossier de consultation
✓ B04-DS-08 | Adresse de consultation du dossier : fonction || B04-DK-03 (0.75) Adresse de retrait du dossier de consultation
✓ B04-DS-09 | Adresse de consultation du dossier : bureau, n° de porte, étage || B04-DK-03 (0.75) Adresse de retrait du dossier de consultation
✓ B04-DS-10 | Adresse de consultation du dossier : localité || B04-DK-03 (0.75) Adresse de retrait du dossier de consultation
✗ B04-PO-01 | Pièces constitutives de la candidature (capacités technique et professionnelle) || B02-CT-01 (0.25) Contrôle technique prévu pour l'opération  — ex æquo B02-CT-02
✗ B04-PO-02 | Pièces constitutives de l'offre || B04-DK-01 (0.33) Pièces ajoutées au dossier de consultation  — ex æquo B04-PT-01
✓ B04-RC-01 | Adresse à laquelle adresser les demandes d'informations || B04-RN-01 (1.00) Adresse à laquelle adresser les demandes d'informations complémentaires
? B04-RC-02 | Délai de réponse aux demandes d'informations (jours) || B08-FT-03 (0.67) Délai de paiement (jours)
✓ B04-RQ-01 | Modalités de remise des offres sous support papier || B04-RT-01 (1.00) Modalités de remise des offres sous support papier
✓ B04-RQ-02 | Objet du contrat-cadre à porter sur le pli || B02-OC-01 (1.00) Objet du contrat-cadre
? B04-RQ-03 | Adresse exacte de remise des offres || B04-SE-01 (0.67) Mode de remise des offres
= B04-SE-02 | Adresse de la plateforme de dépôt || même code : Adresse de la plateforme de dépôt
= B04-SE-04 | Heure de référence || même code : Heure de référence
= B04-SE-05 | Niveau de signature électronique exigé || même code : Niveau de signature électronique exigé
= B04-SE-07 | Formats de fichiers acceptés || même code : Formats de fichiers acceptés
= B04-SE-08 | Taille maximale par fichier (Mo) || même code : Taille maximale par fichier (Mo)
= B04-SE-09 | Taille maximale par offre (Mo) || même code : Taille maximale par offre (Mo)
= B04-SE-12 | Seuil d'indisponibilité déclenchant la prorogation (heures) || même code : Seuil d'indisponibilité déclenchant la prorogation (heures)
= B04-SE-13 | Durée de la prorogation (jours ouvrables) || même code : Durée de la prorogation (jours ouvrables)
= B04-SE-14 | Assistance aux candidats (contact, horaires) || même code : Assistance aux candidats (contact, horaires)
✗ B04-VO-01 | ? || B01-AC-01 (0.00) Autorité contractante  — ex æquo B01-AC-02
✓ B05-MT-01 | Montant indicatif du contrat-cadre hors taxes (Ariary) || B05-MC-01 (1.00) Montant indicatif du contrat-cadre hors taxes (Ariary)
✓ B05-MT-02 | Montant indicatif du contrat-cadre toutes taxes comprises (Ariary) || B05-MC-02 (1.00) Montant indicatif du contrat-cadre toutes taxes comprises (Ariary)
✓ B05-PM-03 | Contenu des prix || B05-PX-03 (1.00) Contenu des prix
? B05-PM-04 | Plafond d'augmentation des prix à chaque complétude ou remise en concurrence (%) || B05-PX-03 (0.50) Contenu des prix
✓ B05-UM-01 | Monnaie en devise (appel d'offres international) || B05-UT-01 (1.00) Monnaie en devise (appel d'offres international)
✗ B06-AN-03 | Voies et délais de recours (instance chargée des recours) || B02-CT-02 (0.25) Personne chargée du contrôle technique
✓ B06-CA-01 | Critères d'attribution du contrat-cadre et modalités d'appréciation || B06-ET-02 (1.00) Critères d'attribution du contrat-cadre et modalités d'appréciation
✗ B06-SC-02 | Critères d'élimination des candidatures || B04-CT-03 (0.33) Date de début de la séance d'évaluation des offres et candidatures  — ex æquo B06-ET-02
✗ B06-SO-05 | Critères et mécanisme de jugement des offres || B02-OB-01 (0.33) Objet de l'appel d'offres  — ex æquo B04-SE-01
✓ B07-DE-02 | Délai d'exécution fixé par l'autorité contractante || B01-AC-01 (1.00) Autorité contractante  — ex æquo B07-XE-02
✓ B07-DE-03 | Délai d'exécution à l'initiative des candidats || B07-XE-03 (1.00) Délai d'exécution à l'initiative des candidats
✓ B07-DU-03 | Durée des marchés subséquents (jours) || B07-DT-02 (0.75) Durée des marchés subséquents fixée dans le contrat-cadre  — ex æquo B07-DT-03
✓ B07-DU-04 | Nombre de reconductions du contrat-cadre || B07-DT-05 (1.00) Nombre de reconductions  — ex æquo B07-DT-06
✓ B07-DU-05 | Nombre d'années maximum du contrat-cadre, reconductions comprises || B07-DT-05 (1.00) Nombre de reconductions  — ex æquo B07-DT-06
✗ B07-DU-07 | Préavis de la décision de reconduction (mois) || B02-DK-03 (0.25) Durée maximale de validité du contrat-cadre (mois)  — ex æquo B02-SW-02
✓ B07-FS-02 | Interlocuteur du titulaire (service, direction, coordonnées) || B07-FT-02 (1.00) Interlocuteur du titulaire (service, direction, coordonnées)
✓ B07-MA-01 | Délai de complétude de l'offre initiale (mono-attributaire) || B07-AT-01 (1.00) Délai de complétude de l'offre initiale (mono-attributaire)
? B07-MA-06 | Critères et sous-critères pondérés de la remise en concurrence || B04-RT-01 (0.40) Modalités de remise des offres sous support papier  — ex æquo B07-AT-03
✓ B07-PE-03 | Pénalités dérogeant au CCAG : rédaction libre || B07-PY-03 (1.00) Pénalités dérogeant au CCAG : rédaction libre
✓ B07-PS-02 | Adresse d'envoi des demandes aux titulaires || B07-PT-02 (1.00) Adresse d'envoi des demandes aux titulaires
✓ B07-PS-03 | Délai de réponse des titulaires (heures) || B07-PT-03 (1.00) Délai de réponse des titulaires (heures)
✓ B07-TN-01 | Termes non couverts par le contrat-cadre (mono-attributaire) || B07-NC-01 (1.00) Termes non couverts par le contrat-cadre (mono-attributaire)
✓ B07-TN-02 | Termes non couverts par le contrat-cadre (multi-attributaire) || B07-NC-02 (1.00) Termes non couverts par le contrat-cadre (multi-attributaire)
✗ B08-AV-02 | ? || B01-AC-01 (0.00) Autorité contractante  — ex æquo B01-AC-02
✓ B08-FI-02 | Modalités de versement de l'avance (délai de paiement en jours calendaires) || B08-AT-02 (1.00) Modalités de versement de l'avance (délai en jours calendaires)  — ex æquo B08-FT-03
✓ B08-FP-01 | Présentation des demandes de paiement || B08-FT-01 (1.00) Présentation des demandes de paiement
✓ B08-FP-02 | Adresse de facturation (service responsable de la vérification des demandes de paiement) || B08-FT-02 (0.83) Adresse de facturation (service chargé de la vérification des demandes)
✓ B08-FP-04 | Taux des intérêts moratoires (%, au moins un point) || B08-FT-04 (1.00) Taux des intérêts moratoires (%, au moins un point)
✓ B09-AU-03 | Délai de remise de l'attestation d'assurance (jours) || B09-AT-03 (1.00) Délai de remise de l'attestation d'assurance (jours)
✓ B09-EA-02 | Contenu des modalités générales d'exécution communes || B09-XM-02 (1.00) Contenu des modalités générales d'exécution communes
✓ B09-GP-02 | Nature des garanties particulières || B09-GQ-02 (1.00) Nature des garanties particulières
? B09-GP-03 | Délai de garantie des prestations (mois) || B08-FT-05 (0.50) Règlement des prestations
✓ B09-VA-02 | Clause libre de vérification et d'admission || B09-VT-02 (1.00) Clause libre de vérification et d'admission
✓ B10-MT-01 | Changement de dénomination sociale du titulaire : service acheteur || B03-TT-01 (1.00) Dénomination sociale du titulaire  — ex æquo B10-MC-01
✓ B10-MT-02 | Changement de contractant en cours d'exécution : service acheteur || B10-MC-02 (1.00) Changement de contractant en cours d'exécution : service acheteur
? B10-RS-02 | Préavis de résiliation sans faute (mois avant la date anniversaire) || B10-RT-01 (0.60) Résiliation sans faute du contrat-cadre
? B10-RS-03 | Fautes du titulaire ouvrant la résiliation du contrat-cadre || B02-OC-01 (0.67) Objet du contrat-cadre  — ex æquo B07-DT-04
✓ B10-VR-01 | Juridiction compétente pour les litiges nés du contrat-cadre || B10-LT-01 (1.00) Juridiction compétente pour les litiges nés du contrat-cadre```
