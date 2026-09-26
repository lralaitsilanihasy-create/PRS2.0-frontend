# Plan — reconstituer les modèles A1 à A4 et C1/C2 du candidat

*26/09/2026, **décisions du pilote intégrées le soir même**. Source officielle : le dossier d'appel d'offres*
*`AOO n° 2463-MI/MESupReS/PRMP/UGPM.2026`, **pages 20 à 34** (`NatureMarches/DAO_Fournitures/Fourniture_a_commande.pdf`).*
*À relire avant toute mise en production.*

## La règle, telle qu'elle a été posée

> « Reprends le texte à l'identique : mêmes libellés, même ordre, même numérotation, même ponctuation.
> Tu ne reformules rien et tu ne complètes rien. »

Deux conséquences qui commandent tout le reste :

1. **Les six modèles sont des décalques.** Rien n'est réécrit « en mieux », aucune tournure n'est modernisée,
   aucune faute de la source n'est corrigée — elles sont **relevées** dans le tableau de fidélité, pas réparées.
2. **Deux sortes de trous seulement deviennent des champs** : les *blancs* (pointillés, crochets, cases vides)
   et les *valeurs propres au dossier 2463* déjà écrites dans le modèle (le « 105ème jour », la référence de
   l'AOO, le bénéficiaire). Sans cela le modèle ne servirait qu'à ce dossier-là.

## Ce que couvre le plan

| | |
|---|---|
| **six modèles** | A1 (trois fiches a/b/c), A2 (deux fiches a/b), A3 (trois fiches a/b/c), A4, C1, C2 |
| **pages de la source** | 22 à 34 — les pages 20 et 21 sont des pages de garde de la *première partie*, pas des modèles |
| **produits** | un `.docx` par sigle (6 fichiers), un tableau de correspondance par modèle, un rapport de fidélité |
| **hors périmètre** | le remplissage lui-même (backend), la mise en production (après votre relecture) |

## Cinq écarts trouvés **dans la source** — **tranchés le 26/09**

| # | constat | page | décision |
|---|---|---|---|
| S1 | Le sommaire de la partie (p. 21) nomme les garanties **`B1` / `B2`** ; le sommaire du dossier (p. 2) et les modèles eux-mêmes (p. 33, 34) les nomment **`C1` / `C2`**. Le dossier se contredit. | 21 vs 2-4, 32, 33, 34 | **`C1` / `C2`.** Raison décisive relevée par le pilote : le sommaire général numérote **trois** familles — **A** fiches de renseignements, **B** attestation du fabriquant (« Non utilisé »), **C** garanties. **La lettre B est prise** ; le « B– MODELE DE GARANTIE » de la p. 21 est un vestige. Titres repris **des modèles eux-mêmes**, pas de la forme abrégée du sommaire : « C 1. Modèle de garantie bancaire de soumission » et « C 2. Modèle de caution personnelle et solidaire de soumission ». L'écart de la p. 21 est inscrit au tableau de correspondance comme **écart assumé, avec son motif** — le comparateur ne bloque pas, la trace reste. |
| S2 | La page 22 porte une **« Note aux Utilisateurs »** entre chevrons `<…>` : elle s'adresse à l'acheteur, pas au candidat. | 22 | **Hors du modèle A1 — mais son contenu n'est pas perdu.** C'est une **règle de cadrage** : l'obligation de remplir les fiches de capacités techniques ou financières peut être réduite selon le montant du marché, ou lorsque des communautés et des ONG sont susceptibles de candidater. Elle devient une **nouvelle question de cadrage — « quelles fiches de renseignements sont exigées ? »** — qui commande la **présence même de A2 et A3** dans le dossier généré. Le texte de la note devient l'**aide contextuelle** de cette question. |
| S3 | A1-b porte la mention **« (non applicable) »** : c'est la réponse du **2463**, pas le modèle. | 24 | **Conditionnée au cadrage `groupement`**, sur la **valeur existante** (non autorisé · conjoint ou solidaire · obligatoirement solidaire) — **pas** sur un booléen créé pour l'occasion. Comportement exact, tel que le 2463 le montre : **le titre est conservé**, la mention « (non applicable) » vient **sous le titre**, et les champs sont **omis**. À l'écran, la section est **masquée**. |
| S4 | Le titre de A4 porte un **appel de note « ¹ »** — mais la page ne porte **aucune note**. Vérifié sur le texte brut, filigrane retiré. | 31 | **Gardé tel quel.** On ne complète pas la source. → **errata**. |
| S5 | La consigne de A1-c est **tronquée** : « [Le formulaire ci-dessous doit être rempli par le] » — la phrase s'interrompt. Vérifié par le pilote en mode brut **et** en mise en page. | 25 | **Reproduite telle quelle**, et — le point important — **ce n'est pas un trou à remplir** : c'est un crochet de consigne inachevé, pas un champ. Le décalqueur ne doit pas le confondre avec les `[…]` qui, eux, sont des blancs. → **errata**. |

## Les six modèles, trou par trou

Légende de la colonne **rempli par** : **fiche** = la valeur vient de la fiche DAO à la génération ·
**candidat** = le blanc reste blanc, c'est lui qui l'écrit · **dérivé** = calculé par le serveur à partir de champs.

### A1 — Identification du candidat (p. 23-25)

| # | blanc ou valeur, page | champ du modèle | code de la fiche | rempli par |
|---|---|---|---|---|
| A1.1 | `Date: ________` (p. 23) | date de la fiche | — | candidat |
| A1.2 | `N° D'appel d'offre et titre: _______` (p. 23) | référence et objet | `B02-OB-03` + `B02-OB-01` | **fiche** |
| A1.3 | `Page [numéro] de [nombre total] pages` (p. 23, 25, 28, 30) | pagination | — | candidat |
| A1.4 | nom ou raison sociale, forme juridique, n° d'immatriculation, compte bancaire et banque (p. 23) | 4 champs | — | candidat |
| A1.5 | personne habilitée : nom, adresse, adresse électronique (p. 23) | 3 champs | — | candidat |
| A1.6 | « Copies certifiées conformes… : Certificat d'immatriculation (NIF), Certificat d'existence…, Certificat de non faillite » (p. 23) | liste des pièces exigées | `B03-CQ-01` | **fiche** — le DPAO §6.1 fixe la liste, elle ne doit pas être figée au 2463 |
| A1.7 | description de procédure de redressement judiciaire (p. 23) | zone libre | — | candidat |
| A1.8 | **« (non applicable) »** (p. 24) | section A1-b | cadrage `groupement` | **fiche** (cf. S3) |
| A1.9 | membres du groupement, nature, date de constitution, adresse, chef de file (nom, adresse, télécopie, adresse électronique), statuts `_______` ×2 (p. 24) | 9 champs | — | candidat |
| A1.10 | nom légal du candidat, date, `N° d'appel d'offres et titre` (p. 25) | 3 champs | `B02-OB-03` + `B02-OB-01` pour le 3ᵉ | mixte |
| A1.11 | **« pendant la période de [nombre d'années] ans »** ×2 (p. 25) | **durée des antécédents juridiques**, défaut **5 ans** | à créer (bloc Candidats) — cf. **N3** | **fiche** |
| A1.12 | tableaux « marchés non exécutés » et « litiges en instance » : année, fraction, identification, montant, autorité contractante, motif (p. 25) | 2 tableaux, 4 lignes vides | — | candidat |

### A2 — Capacités techniques (p. 26-27)

| # | blanc, page | champ | rempli par |
|---|---|---|---|
| A2.1 | tableau `NATURE · DESCRIPTION · DATE D'ACQUISITION · STATUT` (p. 26) | 4 colonnes, lignes vides | candidat |
| A2.2 | « Décrire ci-après les éléments principaux justifiant de la capacité technique » + la note entre crochets (p. 27) | zone libre | candidat |

⚠️ A2 ne porte **aucune** valeur du dossier : c'est un décalque pur. Son seul enjeu est la fidélité du tableau
(quatre colonnes, en-têtes en capitales) et de la note explicative.

### A3 — Capacités financières (p. 28-30)

| # | blanc ou valeur, page | champ | code | rempli par |
|---|---|---|---|---|
| A3.1 | nom, date, `No. d'appel d'offres et titre`, pagination (p. 28 et p. 30) | 4 champs ×2 fiches | `B02-OB-03` + `B02-OB-01` | mixte |
| A3.2 | tableau « Renseignements financiers », **trois** années : total actif, total passif, patrimoine net, disponibilités, engagements, recettes totales, bénéfices avant impôts (p. 28) | 7 lignes × 3 colonnes | — | candidat |
| A3.3 | « Antécédents pour les **trois** dernières années » (p. 28) | **durée des antécédents financiers**, défaut **3 ans** | à créer (bloc Candidats) — cf. **N3** | **fiche** |
| A3.4 | page 29 « Documents financiers » a) à d) | texte figé, aucun blanc | — | — |
| A3.5 | `Exercice du......... au.........` ×3, deux tableaux (p. 30) | 6 couples de dates | — | candidat |
| A3.6 | lignes **« Fournitures »** / **« Prestations intellectuelles »** des tableaux de chiffre d'affaires (p. 30) | ventilation du chiffre d'affaires — **travaux, fournitures, services, prestations intellectuelles**, le second tableau visant les **prestations similaires à l'objet du marché** | **type de marché** de la fiche | **fiche** |
| A3.7 | A3-c : note explicative (p. 30) | zone libre | — | candidat |

### A4 — Antécédents pour des marchés de même nature (p. 31)

| # | blanc, page | champ | rempli par |
|---|---|---|---|
| A4.1 | identification du marché, valeur approximative, `_____ %`, nom et coordonnées de l'acheteur, lieu d'exécution, date de début, date de fin | 7 champs | candidat |
| A4.2 | **appel de note `1`** sur le titre | note de bas de page | ⚠️ **la note n'existe pas** dans la source (cf. S4) — l'appel est décalqué sans son texte |

### C1 — Garantie bancaire de soumission (p. 33)

| # | blanc ou valeur | champ du modèle | code de la fiche | rempli par |
|---|---|---|---|---|
| C1.1 | `A : (Nom et adresse de l'Acheteur)` | autorité contractante et son adresse | `B01-AC-01` + adresse de l'entité | **fiche** |
| C1.2 | `[nom du candidat]` | candidat | — | candidat |
| C1.3 | `[date]` de l'offre | date de l'offre | — | candidat |
| C1.4 | `[titre du Marché]` | objet | `B02-OB-01` | **fiche** |
| C1.5 | `[Nom de l'Organisme ayant lancé l'Appel d'offres]` | autorité contractante | `B01-AC-01` | **fiche** |
| C1.6 | `[montant de la garantie en chiffres et en lettres]` — **deux occurrences** | montant de la garantie **du lot** | `B05-GS-03#n` + `enLettres` | **fiche** |
| C1.7 | **« trentième (30ème) jour »** | délai après la validité des offres | `B05-GS-04 − B04-VO-01` | **dérivé** |
| C1.8 | **« cent cinquième (105ème) jour »** | validité de la garantie | `B05-GS-04` | **fiche** |
| C1.9 | signature, nom de la banque, cachet | 3 champs | — | candidat |

### C2 — Caution personnelle et solidaire (p. 34)

| # | blanc ou valeur | champ du modèle | code de la fiche | rempli par |
|---|---|---|---|---|
| C2.1 | `[dénomination sociale de la banque ou de l'organisme de caution, et le siège social]` | garant | — | candidat |
| C2.2 | `[nom et adresse complète du Candidat]` | candidat | — | candidat |
| C2.3 | `[date fixée pour la remise des offres]` | date limite de remise | `B04-LR-03` (+ `B04-LR-04`) | **fiche** |
| C2.4 | `[date d'expiration de la validité de l'offre]` | fin de validité | `B04-LR-03 + B04-VO-01` jours | **dérivé** |
| C2.5 | `[intitulé ou objet résumé du marché et références de l'appel d'offres]` | objet et référence | `B02-OB-01` + `B02-OB-03` | **fiche** |
| C2.6 | `[dénomination et adresse complète de l'Autorité contractante]` | bénéficiaire | `B01-AC-01` + adresse | **fiche** |
| C2.7 | `[insérer le montant en chiffres et en lettres de la garantie de soumission]` | montant **du lot** | `B05-GS-03#n` + `enLettres` | **fiche** |
| C2.8 | **« trentième (30ème) »** et **« cent cinquième (105ème) »** | idem C1.7 et C1.8 | `B05-GS-04`, `B04-VO-01` | **dérivé / fiche** |
| C2.9 | a) b) c) — les trois cas de mise en jeu | texte figé | — | — |
| C2.10 | `Fait à [Lieu], le [date]`, signature, nom de la banque, `Adresse____`, cachet | 5 champs | — | candidat |

**Compte** : 19 trous alimentés par la fiche ou dérivés, une cinquantaine laissés au candidat.
Les deux garanties portent à elles seules 15 des 19 — ce sont elles qui font le travail.

## Six `.docx`, un par sigle — et le cartouche commun

**Tranché le 26/09 : un fichier par sigle** (A1, A2, A3, A4, C1, C2). La source traite A1 comme **une** fiche à
trois volets a/b/c, et A3 de même : la découper en neuf serait un remodelage, pas un décalque.

Chaque volet reste néanmoins **identifiable** — section propre, **ancre stable**, entrée distincte au tableau de
correspondance. Le rendu en neuf fichiers devient alors une **option de sortie**, pas une refonte.

> **Le critère qui ferait basculer vers un fichier séparé** : une fiche qui **part seule**, signée par un tiers.
> C'est le cas des deux garanties, émises par la banque — et elles sont déjà séparées.

**Le cartouche est commun.** Cinq volets répètent le même en-tête (p. 23, 25, 28, 30, 31) :

| ligne du cartouche | rempli par |
|---|---|
| nom ou raison sociale du candidat | candidat |
| date | candidat |
| **n° d'appel d'offres et titre** | **fiche** — `B02-OB-03` + `B02-OB-01` |
| `Page x de y` | pagination du document généré |

Il est traité comme un **en-tête réutilisable** : écrit une fois, référencé cinq fois. Une correction s'y fait
en un endroit, et les cinq volets suivent.

## Ce que le backend doit livrer en plus (§B8 de la demande, mis à jour)

| # | besoin | pourquoi |
|---|---|---|
| **N1** | **Un formateur d'ordinaux**, forme longue **et** forme abrégée (« cent cinquième (105ème) »), gérant **premier/première**, **testé unitairement**. `NombreEnLettres` ne produit que des **cardinaux**. | **Neuf occurrences** dans la source (relevé ci-dessous), dont **une calculée**. |
| **N2** | **Dates et jours dérivés** : fin de validité de l'offre = `B04-LR-03 + B04-VO-01` ; délai de garantie = `B05-GS-04 − B04-VO-01`. **Calculés, jamais stockés comme des saisies**, affichés **avec leur règle**, **recalculés** si la date de référence change. | Elles ne sont saisies nulle part, et ce n'est pas au candidat de les calculer. |
| **N3** | **Deux champs de durée** au bloc Candidats : **antécédents juridiques** (litiges, marchés non exécutés, redressement) défaut **5 ans**, et **antécédents financiers** défaut **3 ans**. Défauts **administrables**, valeur retenue **portée par la fiche**. | La source les paramètre déjà — et **se contredit** : A1-c titre « au cours des cinq dernières années » puis écrit deux fois « pendant la période de [nombre d'années] ans ». |
| **N4** | **Deux sections conditionnées** : A1-b par le cadrage `groupement` (cf. S3) ; **A3-b par le type de marché** — la ventilation du chiffre d'affaires (travaux, fournitures, services, prestations intellectuelles) et le second tableau visant les **prestations similaires à l'objet du marché**. | Le modèle doit valoir pour les trois catégories et pour un groupement admis. |
| ~~N5~~ | ~~L'adresse de l'autorité contractante~~ — **tombe : le champ existe déjà.** | Voir la vérification ci-dessous. |

### N1 — le relevé exhaustif des ordinaux de la source

Neuf occasions où la source écrit un ordinal **porteur d'une règle** (les « 2ème étage » des adresses n'en sont
pas : ils viennent d'une chaîne d'adresse, rien ne les calcule).

| page | texte de la source | forme | valeur |
|---|---|---|---|
| 33 (C1) | « jusqu'au **trentième (30ème)** jour suivant l'expiration de la période de validité des offres » | longue + abrégée | 30 |
| 33 (C1) | « soit jusqu'au **cent cinquième (105ème)** jour à compter de la date limite » | longue + abrégée | **105 = calculé** |
| 34 (C2) | « expire le **trentième (30ème)** jour suivant l'expiration de la période de validité » | longue + abrégée | 30 |
| 34 (C2) | « soit le **cent cinquième (105ème)** jour à compter de la date limite » | longue + abrégée | **105 = calculé** |
| 38 (AE) | « les conditions d'établissement des prix sont celles existant le **quinzième (15ème)** jour précédant la date limite » | longue + abrégée | 15 |
| 53 (CCAP, annexe) | « demeurera valable jusqu'au **trentième (30ème)** jour suivant la date de délivrance du certificat de réception définitive » | longue + abrégée | 30 |
| 54 (CCAP, annexe) | idem | longue + abrégée | 30 |
| 9 (IC) | « évalués au **quinzième** jour précédant la date limite » | **longue seule** | 15 |
| 13 (IC) | « le **quinzième** jour précédant la date limite » | **longue seule** | 15 |

⚠️ **Le 105 n'est pas littéral.** Le DPAO fixe la validité des offres à **soixante-quinze (75) jours**
(`B04-VO-01`) ; la garantie court **trente jours de plus**. Si la validité change, **le nombre et son ordinal
changent**. C'est le cas d'école qui interdit d'écrire « cent cinquième » dans le gabarit.

⚠️ **Deux formes, pas une** : avec doublet (« quinzième (15ème) ») et **en lettres seules** (« au quinzième
jour »). Le formateur doit servir les deux séparément.

**Vecteurs de test proposés** (le genre compte : « la première », « le premier »).

| n | forme longue | abrégée | ce qu'il éprouve |
|---|---|---|---|
| 1 | premier · **première** | 1er · 1re | le seul irrégulier, et son féminin |
| 2 | deuxième | 2ème | le cas ordinaire |
| 4 | quatrième | 4ème | chute du « e » final |
| 5 | cinquième | 5ème | **cinq → cinqu** |
| 9 | neuvième | 9ème | **neuf → neuv** |
| 15 | quinzième | 15ème | occurrence réelle (AE, IC) |
| 21 | vingt et unième | 21ème | « un » → « unième », **jamais** « vingt et premier » |
| 30 | trentième | 30ème | occurrence réelle (C1, C2, CCAP) |
| 71 | soixante et onzième | 71ème | la dizaine composée |
| 75 | soixante-quinzième | 75ème | la validité des offres du 2463 |
| 80 | quatre-vingtième | 80ème | chute du « s » de « quatre-vingts » |
| 100 | centième | 100ème | la centaine ronde |
| **105** | **cent cinquième** | **105ème** | **l'occurrence du dossier** |
| 1000 | millième | 1000ème | le millier |

⚠️ **L'abrégé s'écrit « ème » dans la source**, là où la typographie soignée écrirait « 105ᵉ ». On **décalque la
source** : `N + "ème"`. Le cas de 1 (« 1er » / « 1re ») ne se présente nulle part — il est spécifié par
prudence, pas par besoin.

### N5 — **vérifié le 26/09 : le champ existe, il n'y a rien à créer**

Le pilote demandait de vérifier avant de créer un champ, pour ne pas se retrouver avec deux adresses. Vérifié
sur le référentiel servi (`GET /api/champs-fiche-marche?typeMarche=A_COMMANDE&categorie=FOURNITURES_SERVICES`) :

```
B01-AC-01 | B01-AC | TEXTE | PPM | clePpm ENTITE   | Autorité contractante
B01-AC-02 | B01-AC | TEXTE | PPM | clePpm ADRESSE  | Adresse de l'autorité contractante   ← il est là
```

Et l'entité contractante **porte bien une adresse** en base : les huit entités en ont une, et celle du MESupReS
a été créée avec « Fiadanana, 2ème étage porte 204 — Antananarivo 101 ».

⚠️ **Un maillon reste à éprouver** : que `valeursPpm` serve effectivement `B01-AC-02` **non vide** à la
génération. Il ne peut pas l'être aujourd'hui — la base a été vidée, il n'existe plus une seule fiche. C'est la
**première vérification du prochain rejeu** du jeu 2463, et elle tient en une ligne.

## La vérification de fidélité

Elle n'est pas déclarative : c'est une comparaison de textes, automatisée, et son résultat est un fichier.

1. Le texte de la source est déjà extrait page par page (`PAGE 22` à `PAGE 34`).
2. Chaque `.docx` reconstitué est relu par la même méthode que les 14 modèles de PV — `unzip` du `word/document.xml`,
   texte des `<w:t>` — sans dépendance nouvelle.
3. Le comparateur normalise ce qui n'a pas de sens typographique (espaces multiples, césures de fin de ligne du PDF,
   apostrophes droites ou courbes) et **rien d'autre** : accents, majuscules, ponctuation et ordre sont comparés tels quels.
4. Sortie : `docs/fidelite-2026-09-26-modeles-candidat.md` — une ligne par écart, avec la page, le texte attendu,
   le texte produit, et la raison (champ substitué, écart de la source, faute à signaler).
5. **Un écart non expliqué bloque la livraison.** Un champ substitué n'est pas un écart : il est attendu, et le
   comparateur le sait par le tableau de correspondance.

## L'errata à la PRMP — **un seul envoi**

Quatre constats, à soumettre ensemble et non au fil de l'eau :

| # | constat | page |
|---|---|---|
| E1 | Les garanties sont nommées **`B1` / `B2`** au sommaire de la partie, **`C1` / `C2`** partout ailleurs — et la lettre **B** est déjà prise par l'attestation du fabriquant. | 21 |
| E2 | Le titre de A4 porte un **appel de note « ¹ » sans note**. | 31 |
| E3 | La consigne de A1-c est **tronquée** : « [Le formulaire ci-dessous doit être rempli par le] ». | 25 |
| E4 | A1-c **se contredit** : ses tableaux sont titrés « au cours des **cinq** dernières années », son corps écrit deux fois « pendant la période de **[nombre d'années]** ans ». | 25 |

Aucun n'est corrigé dans les décalques : ils sont reproduits tels quels, et c'est l'errata qui porte la demande.

## L'ordre des gestes, et le verrou

1. Relever la **note de bas de page de A4** (p. 31) et les trois points S1-S3 → **vos réponses**.
2. Écrire les six `.docx` et leurs tableaux de correspondance.
3. Lancer la vérification de fidélité, corriger, relancer jusqu'à zéro écart inexpliqué.
4. **Vous relisez les six Word.** Rien ne part en production avant.
5. Alors seulement : la demande backend N1-N5, puis la génération réelle en remplacement du gabarit provisoire filigrané.

⚠️ Aujourd'hui le serveur produit déjà A1-A4 et C1/C2 **sur un gabarit provisoire filigrané « MODÈLE PROVISOIRE –
NON OFFICIEL »**. Ce gabarit reste en place tant que l'étape 4 n'est pas franchie : il vaut mieux un document qui
annonce qu'il n'est pas officiel qu'un document officiel approximatif.

## Ce qui reste à faire, dans l'ordre demandé

Le pilote a fixé le point de départ : **la vérification de `B01-AC-02`** (faite, ci-dessus) **et le formateur
d'ordinaux** — « les deux garanties en dépendent, et ce sont elles qui portent l'essentiel du travail ».

1. ✅ **`B01-AC-02`** — le champ existe, l'entité porte l'adresse. Reste le maillon `valeursPpm`, au prochain rejeu.
2. ✅ **Le formateur d'ordinaux** — **il existe déjà.** Vérifié dans le code du backend :
   `NombreEnLettres.ordinal(long)` (livré le 25/09 au titre de ce même §B8), et le **doublet** « cent cinquième
   (105ème) » est assemblé par `FormulairesCandidat.validiteGarantie()`. Un test unitaire existe.
   Restent quatre points étroits, écrits dans la demande : le **« trentième (30ème) »** de la même phrase,
   qui n'est pas produit ; le **féminin** « première » (aucune occurrence dans la source) ; l'**élargissement
   des vecteurs de test** ; et un **arbitrage** — 105 est aujourd'hui **saisi** (`B05-GS-04`), pas calculé.
   **Recommandation : garder 105 saisi et dériver le 30**, le contrôle `VALIDITE_GARANTIE_SUP_OFFRE` tenant déjà
   la cohérence. La PRMP doit pouvoir écrire ce que son dossier dit.
3. Les six `.docx` et leurs tableaux de correspondance.
4. Le comparateur de fidélité, puis les corrections jusqu'à zéro écart inexpliqué.
5. **Relecture du pilote**, puis seulement la mise en production.

⚠️ **Deux chantiers naissent des décisions du 26/09, hors du décalque lui-même** : la **question de cadrage
« quelles fiches de renseignements sont exigées ? »** (S2), qui commande la présence de A2 et A3, et les **deux
champs de durée** (N3). Ils touchent le référentiel et le cadrage : ce sont des lots à part, à ouvrir après la
relecture des Word.
