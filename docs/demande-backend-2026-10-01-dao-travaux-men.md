# Demande backend — DAO de travaux : ce que le premier DAO réel (MEN) a montré

**Date** : 2026-10-01 · **Émetteur** : front · **Origine** : le pilote a fourni un DAO de travaux réel, écrit par une
autre autorité (`Documents Types/Travaux/ExemplesDAO/daolance.DAO_2026_4SDC_vf.pdf` — Ministère de l'Éducation
nationale, appel d'offres ouvert, deux lots). Feu vert du pilote le 01/10 (« ok pour les propositions »).
**Comparaison champ par champ** : `docs/correspondance-2026-10-01-fiche-dao-travaux-vs-dao-men.md` (166 informations,
78 trouvées, 27 contradictions ou valeurs que le champ ne contient pas, 13 informations sans champ).

Trois sujets : le DPAO-T corrigé à recopier (B1), le référentiel des travaux (B2), la lecture du PDF à aligner (B3).

## B1 — Recopier le DPAO-T

`scripts/modeles-dao/modeles/DPAO-T.txt` (décalque `docs/modeles-dao/DPAO-T.docx`), fidélité **253 / 253**, 38
conditions (mise à jour du 01/10 après-midi : personnel clé et liquidité, ci-dessous). Ce qui change par rapport au fichier du 30/09 :

| clause | avant | après | pourquoi |
|---|---|---|---|
| 6.2, 2° | liste de six pièces imprimée d'office (carte professionnelle, État 211 bis, extrait RCS, non-faillite, NIF, carte statistique) | `{{B03-CQ-01}}` | le MEN exige d'autres pièces ; `B03-CQ-01` était saisi et jamais imprimé |
| 6.3, 4° | « au cours des trois dernières années » | « au cours des `{{B03-QT-12.lettres}}` dernières années » | durée que l'acheteur adapte (MEN : cinq) |
| 6.3 b | « au cours des **trois (5)** dernières années » | « au cours des `{{B03-QT-12.lettres}} ({{B03-QT-12}})` dernières années » | coquille du document type ARMP |
| 6.3 b | `{{B03-QT-08}}` | `{{B03-QT-08.parLot}}` | seuil par lot (MEN : 247,5 M / 180 M) |
| 6.3 d | « …y compris au moins < par exemple >ans d'expérience en tant que directeur » imprimé tel quel | retiré | trou sans champ, oublié le 29/09 |
| 6.7 | `{{B05-GQ-03.lettres}} ({{B05-GQ-03}})` | section `GARANTIE-LOTS` : `{{B05-GQ-03.parLot}}` ; section `GARANTIE-UNIQUE` : la rédaction d'avant | montant par lot (MEN : 9,9 M / 7,2 M) — comme `B05-GS-03` en fournitures |
| 11 | `{{B09-DL-01}}` | `{{B09-DL-01.parLot}}` | délai par lot |
| 6.3, après (d) | — | section `PERSONNEL-CLE` : « (e) proposer le personnel clé suivant : `{{B03-QT-13}}` » ; section `LIQUIDITE` : « (f) justifier d’une liquidité ou d’une ligne de crédit délivrée par une banque primaire, d’un montant minimum de : `{{B03-QT-14.parLot}}` » | champs neufs de B2.1 ; paragraphes déclarés en `ajouts` (le document type n'a pas de clause) |

Conditions ajoutées : `GARANTIE-LOTS` = `garantieSoumission = OUI et alloti = OUI`, `GARANTIE-UNIQUE` =
`garantieSoumission = OUI et alloti != OUI`, `PERSONNEL-CLE` = `B03-QT-13 renseigne`, `LIQUIDITE` =
`B03-QT-14 renseigne`. Les deux dernières sont fausses tant que les champs ne sont pas servis : rien ne s'imprime.

Le modèle est sans risque **avant même B2** : `{{CODE.parLot}}` imprime la valeur seule pour un champ que la ligne ne
saisit pas par lot (contrat du lot D2, §B1.3) ; un jeton sans valeur s'imprime en pointillés (R2).

> Côté description (`decrire.mjs`), un cinquième sort de trou est né : **`adapte`**, du texte fixe d'un exemple que le
> document type invite à adapter (« choisir parmi les exemples suivants en les adaptant »), remplacé par un jeton et
> tracé. Rien à faire au backend : le modèle recopié est le seul contrat.

> ⚠️ **Livraison backend du 2026-10-01 (§B1).** DPAO-T recopié tel quel (38 conditions) ; le comparateur donne **253/253**
> sur le rendu brut du serveur.
> **Un écart, corrigé côté moteur :** sur une ligne allotie, `LIQUIDITE` = `B03-QT-14 renseigne` restait **faux**. La
> liquidité y est saisie par lot (`B03-QT-14#1`, `#2`), et la condition lisait le code nu : le paragraphe (f) ne
> s'imprimait jamais. Désormais, dans un document commun d'une ligne allotie, la condition d'un champ saisi par lot lit
> ses valeurs par lot réunies. Le modèle n'a pas à changer.

## B2 — Référentiel des travaux (quantité fixe et à commande)

### B2.1 — Champs à créer

| code | libellé | type | doc. | remarques |
|---|---|---|---|---|
| `B03-QT-12` | Période de référence des marchés similaires (années) | `NOMBRE` | DPAO | obligatoire ; **`valeurDefaut` = 5** (Q1, arbitrée le 01/10). `B03-QT-11` est déjà pris (doublon retiré le 29/09) |
| `B03-QT-13` | Personnel clé exigé (fonctions, diplômes, années d'expérience, justificatifs) | `TEXTE_LONG` | DPAO | MEN : conducteur de travaux ingénieur BTP 3 ans, chef de chantier technicien supérieur 3 ans, CV avec photo, diplôme certifié |
| `B03-QT-14` | Liquidité ou ligne de crédit bancaire minimale (Ariary) | `MONTANT` | DPAO | **`parLot`** ; MEN : 99 M / 72 M |

`B03-QT-13` et `B03-QT-14` sont **déjà imprimés** par le DPAO-T de B1 (paragraphes (e) et (f), sous condition
`renseigne`). Banc : DPAO-T 31/32 en cadrage « tout oui », les deux champs relus, Q10 tenu.

> ⚠️ **Livraison backend du 2026-10-01 (§B2.1).** Les trois champs sont créés, conformes : `B03-QT-12` à 5 par défaut,
> `B03-QT-14` par lot, avec le contrôle `MONTANT_POSITIF` comme les autres montants. Le défaut est recopié au premier
> enregistrement de la fiche (V47), et le DPAO validé imprime « au cours des cinq (5) dernières années ».

### B2.2 — Champs existants à modifier

| code | changement | raison (MEN) |
|---|---|---|
| `B03-CQ-01` | `valeurDefaut` = la liste du document type, une pièce par ligne : « une photocopie certifiée de la Carte Professionnelle de l'année en cours / une photocopie certifiée de l'Etat 211 bis datée de moins de TROIS (03) mois / une photocopie certifiée de l'Extrait du Registre de Commerce / un certificat de non faillite datée de moins de 2 mois / une photocopie certifiée du Numéro d'Identification Fiscale (NIF) / une photocopie certifiée de la carte statistique » | le texte imprimé d'office devient la valeur proposée |
| `B05-GQ-03`, `B03-QT-08`, `B09-DL-01` | `parLot = true` (travaux) | trois valeurs par lot dans le DAO du MEN |
| `B05-GQ-02`, `B05-GE-03` | `LISTE` → **`LISTE_MULTIPLE`**, comme `B05-GS-02` en fournitures | le MEN admet les trois formes ensemble, pour la soumission comme pour la bonne exécution |
| `B05-GE-04` | option ajoutée : « Libérée à 100 % à la réception provisoire » | CCAP 7.1 du MEN ; aucune des deux options actuelles ne convient |
| `B06-EO-07` « Traitement des offres anormalement hautes ou basses » | ouvert à la catégorie `TRAVAUX` | DPAO 9.4.5 du MEN (moyenne + 20 % / seconde moyenne − 10 %) |
| `B02-AU-07` « Nombre maximum de lots attribuables à un même candidat » | ouvert à la catégorie `TRAVAUX` | DPAO 1.1 du MEN : « ne peut prétendre qu'à deux (02) lots au maximum » |

**Conséquence front, après livraison (T-5)** : dans le DPAO-T, les conditions `GARANTIE-BANCAIRE`, `-CAUTION`,
`-CHEQUE` passent de `B05-GQ-02 = …` à `B05-GQ-02 contient …` (grammaire déjà servie, déjà lue par l'import) ; même
chose pour les formes de bonne exécution dans le CCAP-T. Les fiches existantes : une valeur `LISTE` unique reste une
`LISTE_MULTIPLE` valide à un élément — rien à migrer, à confirmer de votre côté.

> ⚠️ **Livraison backend du 2026-10-01 (§B2.2).** Conforme, avec trois précisions :
> - **`B03-CQ-01`** : ce champ est commun aux trois catégories (un seul enregistrement par code), donc son défaut est
>   aussi proposé aux fiches de fournitures et de prestations intellectuelles, qui ne l'impriment pas. Le défaut tient sur
>   plusieurs lignes : le fichier de correspondance (une cellule par ligne) l'écrit avec la séquence `\n`, que l'import
>   lit comme un saut de ligne, et la colonne `VALEUR_DEFAUT` passe de 200 à 1 000 caractères (V58). En Word, un saut de
>   ligne dans une valeur était rendu comme une espace : il est désormais un vrai saut de ligne. **Les deux copies du
>   fichier (`docs/` du front et tests du serveur) sont mises à jour à l'identique.**
> - **`B02-AU-07` et `B06-EO-07`** : actifs, servis aux **travaux seulement**, puisqu'ils avaient été retirés des fournitures
>   le 29/09. Ils passent du fichier des fournitures à celui des travaux, et V58 ouvre leurs rubriques aux travaux.
>   **Aucun modèle ne les imprime** : ils seront saisis sans effet sur le DAO tant que le DPAO-T ne les cite pas (1.1 et
>   9.4.5 au MEN).
> - **`LISTE_MULTIPLE`** : confirmé, rien à migrer. Les valeurs existantes, toutes à un seul élément, restent valides
>   (DBPRS20 : 7 et 7 valeurs, sans virgule). Les trois champs devenus par lot ont 7 valeurs chacun sous le code nu :
>   lisibles hors allotissement, à ressaisir par lot sur une ligne allotie.

### B2.3 — Moteur : `.lettres` sur un `NOMBRE`

`{{B03-QT-12.lettres}}` doit donner le nombre en lettres, **en minuscules et sans unité** : « cinq », pour imprimer
« au cours des cinq (5) dernières années ». Aujourd'hui `.lettres` n'est employé que sur des `MONTANT`. Si un
`NOMBRE` décimal arrive (ce n'est pas le cas ici), la valeur seule.

> ⚠️ **Livraison backend du 2026-10-01 (§B2.3).** Déjà servi : `.lettres` d'un `NOMBRE` entier donne le cardinal en
> minuscules, sans unité (« cinq ») ; un décimal reste la valeur seule.

### Q1 — Valeur par défaut de `B03-QT-12` — ✅ arbitrée : 5

Le document type dit « trois dernières années » au 4° et « trois (5) » au b). **Recommandation : 5**, le chiffre entre
parenthèses faisant foi dans l'usage (et c'est le choix du MEN). À défaut de réponse, pas de valeur par défaut :
l'acheteur saisit.

> ✅ **Arbitrage du pilote du 2026-10-01** : la recommandation est suivie. `valeurDefaut` = **5** ; le DPAO-T imprime
> alors « au cours des cinq (5) dernières années » tant que l'acheteur ne change rien.

## B3 — Import du DAO : aligner `LectureDao` sur la lecture du front

Prototype : `scripts/import-dao/lire.mjs` et `PdfLignes.java` ; spécification à jour dans
`scripts/import-dao/README.md` (section « Premier DAO de travaux réel »). Cinq règles :

1. **Frontière des colonnes mesurée par page** (PDF) : l'abscisse de départ la plus fréquente d'un morceau qui suit,
   sur la même ligne de base (±1,5 pt), un morceau d'une autre colonne (saut > 12 pt), retenue si vue au moins 3 fois ;
   sinon 240 comme avant. Dans le DAO du MEN la colonne des données commence à x ≈ 183 : sous la valeur fixe de 240,
   libellés et valeurs se mêlaient (« …délai de : 9.1. Relations entre PRMP… »).
2. **Rangée = même ligne de base à 1,5 pt près** (PDF) : la clause passe avant sa donnée, même posée 0,5 pt plus bas.
3. **« MOTS (n) »** : pour un `NOMBRE`, `MONTANT`, `POURCENTAGE`, une valeur écrite « CENT VINGT (120) »,
   « Cinq (05) », « neuf cent mille Ariary (Ar 9 900 000) » vaut le nombre entre parenthèses, si rien d'autre que des
   lettres ne le précède.
4. **Point final facultatif** quand du texte fixe le précède (« …sera de CENT VINGT (120) jours », sans point).
5. **Case en blanc** : des pointillés autour d'une unité seule (« ........ Jours …. ») ne sont pas une valeur. Les
   caractères d'usage privé (U+E000-U+F8FF, glyphes de police Symbol — l'astérisque de renvoi) sont ignorés pour ce test.

Et dans l'extraction des lignes : **la fin d'un morceau est celle de sa dernière lettre**. Une espace finale, retirée
du texte mais comptée dans la largeur, faisait coller le morceau suivant.

**Mesures** (front) :

| | avant | après |
|---|---|---|
| DAO du MEN, DPAO-T reconnu | 27 / 160, valeurs mêlées aux libellés | 45 / 156, valeurs propres ; délai de validité **120 (haute, juste)** ; délais 10 / 05 / 05, lieu d'ouverture, pièces de l'offre. Une fausse valeur **basse** : `B03-CQ-01` reçoit « Garantie de soumission 3°- Liste du personnel… » (le 2° du MEN n'est pas une liste de pièces) |
| DAO du MEN, AE-T | « Jours …. » proposé pour `B09-DL-01` | plus rien de faux proposé |
| 2463 (`NatureMarches/DAO_Fournitures/Fourniture_a_commande.pdf`) | — | **+3 valeurs justes** (B04-DE-02 = 10, B04-DE-03 = 05, B06-EP-01 = 03), aucune perdue |
| banc synthétique, rendu propre (18 passes) | — | rappel identique, DPAO-T 27/28 → 29/30 (les deux jetons ajoutés), 0 fausse valeur haute |
| banc, graines 3, 6, 11 | — | 0 fausse valeur haute ; une ou deux fausses valeurs moyennes ou basses de plus sur le DPAO-T, venues du paragraphe désormais fait du seul jeton `{{B03-CQ-01}}` (le bruit y glisse un paragraphe ajouté) |

Limite connue, non traitée : « soumission » et « doit » sont posés sans aucun écart dans ce PDF ; c'est indiscernable
géométriquement d'un mot coupé (« Soix|ante »). Le texte lu porte « soumissiondoit ».

> ⚠️ **Livraison backend du 2026-10-01 (§B3).** Les cinq règles et le correctif d'extraction sont portés à l'identique
> (`LecturePdf`, `LectureDao`). Parité mesurée sur 18 documents réels (le 2463, nos rendus bruts, les fiches 27 et 38, et
> le DAO du MEN, gardé hors dépôt) :
> - **extraction identique**, paragraphe par paragraphe, dont les 3 302 paragraphes du MEN ;
> - **lectures identiques**, sur les 14 modèles, sans types de champ (985 lignes) puis avec les types des référentiels
>   (818 lignes) ;
> - on y retrouve vos mesures : DPAO-T du MEN à **45** paragraphes, délai de validité **120 (haute)** ; sur le 2463,
>   `B04-DE-02 = 10`, `B04-DE-03 = 05`, `B06-EP-01 = 03` ; « Jours …. » n'est plus proposé.

## Ce qui ne relève pas du backend

Le CCAP du MEN n'est reconnu qu'à 5 paragraphes sur 422 : il suit une version plus ancienne du document type, réécrite
partout. Comme pour le 2463, seule une **lecture par clause** le traiterait — décision du pilote, pas une demande ici.

## B4 — Après la livraison (front, 01/10 au soir) : à recopier et à porter

**Contre-recette du référentiel : conforme.** `GET /api/champs-fiche-marche?typeMarche=QUANTITE_FIXE&categorie=TRAVAUX`
sert 171 champs ; `B03-QT-12` (`NOMBRE`, défaut 5), `B03-QT-13`, `B03-QT-14` (`parLot`), `parLot` sur `B03-QT-08`,
`B05-GQ-03`, `B09-DL-01`, `LISTE_MULTIPLE` sur `B05-GQ-02` et `B05-GE-03`, la troisième option de `B05-GE-04`, la liste
par défaut de `B03-CQ-01` sur six lignes, `B02-AU-07` et `B06-EO-07` servis. L'import du serveur sur le PDF du MEN n'a
pas été rejoué (les fiches de travaux sont validées : 409 `FICHE_VALIDEE` ; ouvrir une révision écrit en base) — votre
mesure de parité fait foi.

### B4.1 — Recopier le DPAO-T une seconde fois

`scripts/modeles-dao/modeles/DPAO-T.txt`, fidélité **260 / 260**, **40 conditions**. Depuis votre copie (253) :

| clause | changement | condition |
|---|---|---|
| 1.1 | la phrase du document type « mais ne peut prétendre qu'à `{{B02-AU-07.lettres}} ({{B02-AU-07}})` lots » (retirée le 29/09 faute de champ) | `LIMITE-LOTS` = `alloti = OUI et B02-LT-02 = Divisible et B02-AU-07 renseigne` |
| 6.7 | `GARANTIE-BANCAIRE`, `-CAUTION`, `-CHEQUE` : `B05-GQ-02 = …` → **`B05-GQ-02 contient …`** (option entière) | — |
| 9.4.5 (rangée neuve) | « 9.4.5. Offres anormalement basses ou anormalement hautes » \| `{{B06-EO-07}}` — rangée déclarée en `ajouts`, le document type des travaux n'a pas de clause | `OFFRES-ANORMALES` = `B06-EO-07 renseigne` |

Le CCAP-T n'a pas à changer : ses formes de bonne exécution étaient déjà en `contient` (fragments « bancaire »,
« caution », « chèque »).

> ⚠️ **Livraison backend du 2026-10-01 (§B4.1).** Conforme. DPAO-T recopié tel quel (40 conditions), **260/260** sur le
> rendu brut du serveur ; CCAP-T inchangé (573/573). Rendu contrôlé sur une ligne allotie en deux lots divisibles :
> - « mais ne peut prétendre qu’à deux (2) lots » ;
> - la rangée 9.4.5 et son texte ;
> - avec `B05-GQ-02` = « Garantie bancaire,Chèque de banque », les deux formes retenues seulement.
>
> Sur une ligne non allotie, la phrase de la limite de lots ne s'imprime pas.

### B4.2 — `LectureDao` : la réponse déduite d'un terme `contient`

Spécification : `scripts/import-dao/README.md`, règle 6. Un terme `CODE contient Option` d'une section attestée ajoute
l'option à la liste du champ quand c'est une option **entière** du référentiel ; la valeur est la suite des options dans
l'ordre du référentiel, séparées par des virgules. Sans cette règle, passer le DPAO-T en `contient` fait perdre la
déduction de `B05-GQ-02` (le lecteur ne déduisait que les termes `=`). Banc du front : 70 réponses déduites, toutes
justes, dont `B05-GQ-02` = « Caution personnelle et solidaire,Garantie bancaire,Chèque de banque » en cadrage
« tout oui ».

> ⚠️ **Livraison backend du 2026-10-01 (§B4.2).** Conforme. `InfoChamp` porte maintenant les options du référentiel ;
> `ConditionsModele.contenus` donne les termes `contient` d'une section retenue ; un terme `=` contraire sur le même champ
> est un conflit.
> Une réponse déduite qui porte un **code de champ** (`B05-GQ-02`) sort, comme les autres, en `reponsesChamps` (proposée en
> confiance moyenne), et non dans le cadrage : c'est l'écart de sortie déjà connu de l'import.
> **Parité refaite**, cette fois avec les options et les réponses déduites, des deux côtés, sur les mêmes 18 documents :
> extraction identique et **1 022 lignes de lecture identiques**. Sur le rendu brut du DPAO-T, `B05-GQ-02` = « Caution
> personnelle et solidaire,Garantie bancaire,Chèque de banque ».
> Test : `LectureDaoTest.reponseDeduiteDUnTermeContient`. Il couvre l'ordre du référentiel (et non celui du document),
> le fragment qui ne dit rien et le conflit avec un terme `=`.

### B4.3 — Pour information : un défaut ancien révélé par le banc

Le banc contrôle désormais les réponses déduites. Graine 6, CCAP-T, cadrage « tout oui » : `B05-GE-01 = OUI` est déduit
alors que le rendu dit NON — sous bruit, un paragraphe atteste une section de bonne exécution. La lecture d'avant le
01/10 fait la même erreur : ce n'est pas une régression. Le front l'instruit ; `LectureDao` partageant la logique,
vous verrez le correctif passer par une demande dédiée.

> ⚠️ **Réponse backend du 2026-10-01 (§B4.3).** Noté. La parité mesurée ici porte sur des documents propres ; le
> défaut sous bruit se lira de la même façon des deux côtés tant que la logique est partagée. J'attends la demande dédiée.

### B4.4 — Les 7 valeurs sous le code nu (votre point ouvert) : traité à l'écran

Sur une ligne allotie, l'écran **ne renvoie plus** la clé nue d'un champ `parLot` à l'enregistrement d'un bloc (votre
refus l'aurait bloqué), et la montre à côté de chaque lot vide comme « Ancienne valeur, non reprise — à ressaisir »,
comme une révision le fait depuis V46. Rien à faire au serveur.
