# Demande backend — Outiller le contrat-cadre (lot 4)

**Date** : 2026-09-23 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : demande du pilote, « prépare le lot
pour le contrat cadre et à commande », puis remise du **fichier de correspondance, partie contrat-cadre**. Le marché
à commande fait l'objet d'une demande séparée (`-23-marche-a-commande.md`).

> ⚠️ **Première rédaction corrigée en place le 23/09.** Ce document disait que le lot ne pouvait pas démarrer, faute
> de matière et de deux décisions. Le pilote a remis le fichier : **la matière existe, et les deux décisions y sont
> écrites**. Le lot est prêt.

## Constat (mesuré sur la base locale le 23/09)

| type | champs applicables | dont actifs | dont propres au type |
|---|---|---|---|
| `QUANTITE_FIXE` | 143 | 139 | 0 |
| `A_COMMANDE` | 151 | 146 | 8 |
| `CONTRAT_CADRE` | **35** | **35** | **0** |

Trente-cinq champs contre cent trente-neuf, aucun qui lui soit propre, et le bloc **`B07` « Contrat-cadre
(réservé) » porte zéro rubrique**. Une fiche de contrat-cadre ouverte aujourd'hui ne montrerait rien de ce qui fait
un contrat-cadre : ni accord-cadre, ni marchés subséquents, ni remise en concurrence.

## La matière est convertie et prête à charger

`docs/referentiel-champs-fiche-marche-contrat-cadre.csv` — **114 champs**, 37 rubriques, même format que les 116
des fournitures chargés le 23/09. La conversion est documentée ligne à ligne dans
`referentiel-champs-fiche-marche-contrat-cadre.md` : règles appliquées, fusions, lignes écartées, anomalies du
fichier source.

| bloc | champs |
|---|---|
| B02 Objet, allotissement & forme du contrat-cadre | 13 |
| B03 Candidats | 12 |
| B04 Dossier, remise & ouverture des offres | 20 |
| B05 Prix et montants | 6 |
| B06 Évaluation, attribution & notification | 10 |
| **B07 Marchés subséquents** | **26** |
| B08 Paiements, avances & garanties | 13 |
| B09 Exécution du marché | 10 |
| B10 Modifications, résiliation & litiges | 4 |

## Les deux décisions, tranchées par le fichier

### Décision 1 — le deuxième document est le **DPAC**, et il n'y a **pas de CCAP**

Le fichier le dit dans son sous-titre : « Contrat-cadre et marchés subséquents. **Le deuxième document est le
DPAC.** » Ses colonnes l'écrivent : PPM 22 source, **DPAC 3 à saisir, AE 79 à saisir, CCAP 0 à saisir**.

La colonne CCAP n'est pas incomplète, elle est **vide par construction** : dans un contrat-cadre, **l'acte
d'engagement est le contrat**, c'est lui qui porte les clauses. D'où 79 informations à l'AE, contre 15 à 18 dans les
deux autres modèles.

**Un contrat-cadre produit donc DPAC + AE, jamais de CCAP.** Le lot 2a n'a rien à changer : la sélection suit
`documentMaitre`, et `DPAC` y est déjà géré.

### Décision 2 — les 74 informations sans document se répartissent selon leur nature

Elles ne sont pas un mystère : à deux exceptions près, ce sont des rubriques qui existent **à l'identique** dans les
deux autres modèles, où elles sont rattachées au DPAO. Le fichier a omis de cocher la colonne DPAC, qui remplace le
DPAO ici.

- **Clause de consultation → `DPAC`** : tout B04, la monnaie en devise de B05, tout B06.
- **Clause contractuelle → `AE`** : la durée et la reconduction du contrat, B07, B08, B09, B10.

Après répartition : **34 champs au DPAC, 80 à l’AE**.

> ⚠️ **23/09 — « Point à trancher » du backend : tranché, et corrigé DANS LE CSV.** Quatre reflets de cadrage semés
> par V35 pour les trois types doublaient ceux du fichier : allotissement, forme de prix, forme du groupement,
> avance. **Ce sont les miens qui partent** — `B02-FC-01`, `B02-AL-01`, `B03-GC-01`, `B08-FI-01` — et non ceux de V35.
>
> **Pourquoi ce sens-là.** Les douze reflets de V35 forment une famille cohérente : les douze réponses de cadrage,
> aux mêmes codes et dans les mêmes rubriques pour les trois types. En restreindre quatre au seul contrat-cadre
> donnerait, sur une fiche de contrat-cadre, huit réponses à leur place habituelle et quatre ailleurs — deux règles
> de placement pour une seule famille. Et la manœuvre demanderait quatre corrections à la main dans l’écran
> Administrateur, alors que **V39 n’est pas encore appliquée sur DBPRS20** : corriger le CSV ne coûte rien.
>
> Le CSV passe donc de 118 à **114 champs**, avec un seul reflet de cadrage, `B02-AL-03` (`attributaires`), que
> V35 ne sème pas. Les conditions ne sont pas touchées : elles lisent le **cadrage**, jamais un champ.
>
> **Une suite pour le backend** : la rubrique **`B02-FC` « Forme du contrat-cadre » n’a plus aucun champ** et doit
> être retirée de V39, qui n’a encore été appliquée nulle part. Les 38 rubriques passent à **37**. Aucune autre
> rubrique ne se vide.
>
> **Sur l’allotissement déduit du plan** : la demande `-23-allotissement-depuis-le-plan.md` reste entière. Le front
> impose déjà la réponse du plan ; côté serveur, `alloti` demeure une réponse de cadrage, ce qui suffit au
> contrat-cadre — `B02-AL-02` est conditionné à `alloti = OUI`, quelle que soit la façon dont la réponse arrive.

## Demande

### B1 — Charger le référentiel du contrat-cadre

Chargement du CSV par l'API Administrateur, comme les 116 du 23/09. **`B07` reçoit ses huit rubriques** : il existe
aujourd'hui avec zéro rubrique, ce qui le rend invisible.

> ⚠️ **Livraison backend du 2026-09-23 — B1 : les rubriques par migration, les champs par l'import.** (1) Une rubrique
> ne se crée pas par l'API (blocs et rubriques sont figés par migration depuis V35 ; `POST` d'un champ exige sa
> rubrique) : les **38 rubriques** sont créées par **V39**, réservées au contrat-cadre, rangs 51+ dans les blocs
> partagés et 1 à 8 dans B07, document maître = celui de la majorité de leurs champs, compte attendu = nombre de
> champs du fichier (total 118). **Libellés déduits de la conversion** (à renommer par migration si le pilote les nomme
> autrement) : B02 *Objet et étendue du contrat-cadre* (OE), *Personne responsable et délégation* (SG), *Procédure de
> passation* (PC), *Forme du contrat-cadre* (FC), *Durée du contrat-cadre* (DC), *Allotissement et attributaires* (AL) ;
> B03 *Titulaire*, *Groupement*, *Sous-traitance* ; B04 *Dossier de consultation*, *Présentation des candidatures et
> des offres*, *Remise des offres* (RQ), *Renseignements complémentaires*, *Calendrier prévisionnel* ; B05 *Unité
> monétaire*, *Montant indicatif du contrat-cadre*, *Prix des marchés subséquents* ; B06 *Examen des candidatures*
> (SC), *Sélection des offres* (SO), *Critères d'attribution*, *Notification* ; B07 *Passation*, *Forme*,
> *Attribution des marchés subséquents*, *Termes non couverts par le contrat-cadre*, *Pièces contractuelles*, *Durée
> et reconduction*, *Délais d'exécution*, *Pénalités* ; B08 *Financement et sûretés*, *Facturation et paiement* ; B09
> *Exécution administrative*, *Vérification et admission*, *Garanties particulières*, *Assurance* (AU) ; B10 *Voies de
> recours* (VR), *Modifications en cours d'exécution*, *Résiliation*. Le bloc **B07** prend le nom « **Marchés
> subséquents** » (il s'appelait « Contrat-cadre (réservé) »). (2) Le CSV **tel quel aurait perdu trois lignes** à
> l'import : `B02-FC-01`, `B02-AL-03` et `B03-GC-01` sont des `LISTE` de source `CADRAGE` sans options, et la règle
> exigeait des options pour toute `LISTE`. Elle ne les exige plus pour un reflet de cadrage (ses options sont celles
> de la question). Vérifié sur une copie du fichier : **118 créés, 0 rejet**. (3) **Le chargement sur DBPRS20 reste
> à faire** (API Administrateur, ou import au démarrage du backend) : V39 ne sème que les rubriques.

### B2 — Étendre les champs du PPM au contrat-cadre

Les 22 informations du PPM ne sont pas dans le CSV : le serveur les relit de la ligne du plan. Il faut **ajouter
`CONTRAT_CADRE` aux `typesMarche`** des champs PPM déjà semés (`B01-AC-*`, `B02-LV-*`, `B02-OB-01`), sans quoi une
fiche de contrat-cadre n'aurait aucune information reprise.

> ⚠️ **Livraison backend du 2026-09-23 — B2 : rien à faire, c'était déjà le cas.** Les champs `PPM` (**23** depuis le
> lot 1c, `B01-AC-19` compris) et les 12 reflets de `CADRAGE` sont semés par V35 avec les **trois** types de marché —
> ce sont précisément les « 35 champs applicables » du constat. Une fiche de contrat-cadre sert ses 23 informations
> reprises (recette, cas 4).

### B3 — Ouvrir le type `CONTRAT_CADRE`

La liste des formes outillées s'étend, les 409 `FORME_NON_OUTILLEE` cessent pour ce type, et `blocsASaisir` ouvre
**B07** — cette règle est déjà écrite et testée côté front depuis le lot 1.

### B4 — Les rubriques servies doivent suivre le type de marché

`GET /api/champs-fiche-marche?typeMarche=` filtre déjà les **champs**. Il ne filtre pas les **rubriques** des blocs.
Or le contrat-cadre ajoute 38 rubriques à des blocs partagés : sans filtrage, une fiche à quantité fixe afficherait
des rubriques vides, puisque l'écran garde ouverte une rubrique sans champ — c'est ainsi qu'il signale un référentiel
à compléter.

**Une rubrique n'est servie que si au moins un de ses champs vaut pour le type demandé.**

> ⚠️ **Livraison backend du 2026-09-23 — B3 et B4 livrés, avec quatre compléments.** (1) **B4, une nuance** : la règle
> s'ajoute au filtre existant sur les `typesMarche` de la rubrique, et une rubrique qui n'a encore **aucun champ pour
> aucun type** reste servie — sans quoi l'écran perdrait le signal « référentiel à compléter » que ce paragraphe décrit.
> (2) **« Le lot 2a n'a rien à changer » était inexact** : les 35 champs partagés (repris du plan, reflets de V35) ont
> le **DPAO** pour maître et des reprises au **CCAP** ; tels quels, un contrat-cadre aurait produit DPAO et CCAP. La
> sélection applique donc au contrat-cadre la règle de répartition du fichier : **DPAO → DPAC, CCAP → AE**. Vérifié :
> un contrat-cadre produit **DPAC et AE, jamais de DPAO ni de CCAP**. (3) **`attributaires` était un nombre** côté
> serveur (lot 1) : il vaut désormais **`MONO` ou `MULTI`** (400 sinon), ce que lisent les conditions du fichier
> (`attributaires = MULTI`) ; vérifié : `MONO` ferme `B07-MA-03`, `MULTI` l'ouvre. (4) Le fichier donne le rôle
> **`DATES_ORDRE:NOTIFICATION`**, que le catalogue ne connaissait pas : la notification devient la cinquième date
> contrôlée (attribution < notification).
>
> **Point à trancher, non fait** : quatre reflets de cadrage de V35 valent aussi pour le contrat-cadre et **doublent**
> ceux du fichier — allotissement (`B02-LV-04` / `B02-AL-01`), forme de prix (`B05-TP-01` / `B02-FC-01`), forme du
> groupement (`B03-GR-02` / `B03-GC-01`), avance (`B08-AV-01` / `B08-FI-01`). La même réponse s'affiche donc deux
> fois dans une fiche et dans les documents du contrat-cadre. Remède sans code : restreindre les quatre de V35 à
> `QUANTITE_FIXE,A_COMMANDE` par l'écran Administrateur (ou une ligne de CSV). Laissé au pilote, le référentiel étant
> son acte. Par ailleurs, le fichier suppose l'allotissement **déduit du plan (lot 1d)** : cette demande
> (`-23-allotissement-depuis-le-plan.md`) n'est pas traitée par cette livraison.

### B5 — Les fiches contrat-cadre déjà créées

> ⚠️ **Livraison backend du 2026-09-23 — B5.** Seul le DMC 3 porte une fiche (version 1, brouillon, vide) ; le DMC 4
> n'en a pas. La fiche du DMC 3 redevient écrivable, marquée `typeChange` ; **reprendre son cadrage** aligne son type de
> saisie sur le plan et éteint le drapeau. Aucune suppression faite.

Sur DBPRS20, les DMC 3 et 4 portent des fiches gelées par le lot 1c. À l'ouverture du type, elles redeviennent
écrivables avec un cadrage à reprendre : leurs réponses ont été saisies sous un autre type. Aucune reprise de
données n'est demandée.

## Tests attendus (recette backend)

1. `GET /api/champs-fiche-marche?typeMarche=CONTRAT_CADRE` sert **B07 avec ses rubriques** et les 114 champs.
2. Le même appel pour `QUANTITE_FIXE` ne sert **aucune** des 37 rubriques du contrat-cadre (B4).
2 bis. Une réponse de cadrage n’apparaît **qu’une fois** sur une fiche de contrat-cadre : douze reflets de V35, plus
   `B02-AL-03`. Aucune rubrique servie n’est vide.
3. Un contrat-cadre ouvre **B07** dans ses blocs à saisir ; un marché à quantité fixe et un marché à commande, non.
4. `attributaires = MONO` ferme les rubriques de remise en concurrence ; `MULTI` les ouvre.
5. Une fiche de contrat-cadre sert ses **22 informations reprises** du plan (B2).
6. `POST …/valider` produit **DPAC et AE** — jamais de DPAO ni de CCAP pour ce type.
7. Ligne à `FORME_MARCHE = CONTRAT_CADRE` → `formeOutillee = true`, et les écritures cessent de répondre 409.

## Côté front

**Rien à écrire, et c'est voulu.** L'écran est piloté par la donnée depuis le lot 1 : blocs, rubriques, champs,
conditions et documents viennent tous du référentiel. Le jour où le contrat-cadre est chargé et ouvert, la fiche se
dessine seule, avec B07 en plus, et la **page courte** livrée le 23/09 disparaît d'elle-même pour ce type.

Un seul changement, déjà demandé au lot 3 : `FicheMarcheDto.typeOutille` servi par le serveur, pour que le front
cesse de tenir sa propre liste des types outillés.

## Ce qui reste à trancher par le pilote

1. **Ligne 6 du fichier**, note de l'équipe « Tsy PRMP ihany ve ireo ? » — la personne responsable des marchés
   passés sur la base du contrat-cadre est-elle simplement la PRMP ? Si oui, `B02-SG-01` devient un champ **PPM**
   repris, et non une saisie.
2. **Ligne 4**, l'acte de nomination : chargée **inactive**, faute de document au fichier.
3. **Ligne 91**, « ?????? » : écartée, non identifiable.

Ces trois points ne bloquent pas le lot : deux champs sur cent dix-huit.
