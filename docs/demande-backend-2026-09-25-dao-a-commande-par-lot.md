# Demande backend — la fiche DAO « à commande » au niveau d'un dossier réel

*Front → backend, 25/09/2026. Suite de `docs/analyse-2026-09-25-dao-reel-fourniture-a-commande.md`, tirée d'un DAO
réellement publié (MESupReS, AOO n° 2461/MT/…/2026, matériels informatiques, cinq lots, à commande, 87 pages).*

Jusqu'ici le référentiel venait du **fichier de correspondance**. Ce dossier-ci est le produit fini, données
particulières remplies et acte d'engagement compris. Il confirme l'essentiel de la fiche et découvre quatre
besoins, dont un qui corrige une livraison d'aujourd'hui.

---

## B1 — Rétablir une reprise retirée ce matin

`B02-AU-04` « Durée de validité du marché à commande (mois) » : nous avons fait retirer sa reprise `AE` ce matin
(demande du 25/09, §B1), parce que le fichier de correspondance ne la marque qu'au DPAO. **Le dossier réel la
porte** :

> **ACTE D'ENGAGEMENT — ARTICLE 5 - DURÉE - DELAIS**, 5.3 Durée de validité :
> « La durée de validité est fixée à **douze (12) mois** à compter de la date d'effet. »

| champ | aujourd'hui | à livrer |
|---|---|---|
| `B02-AU-04` | maître `DPAO`, sans reprise | maître `DPAO` + reprise **`AE`** |

Les trois autres retraits du matin sont **confirmés** par le même dossier et ne bougent pas : l'acte d'engagement
réel ne porte ni l'attribution des lots (`B02-AU-02`), ni le montant de la garantie de soumission (`B05-GS-03`), et
il porte des **montants** minimum et maximum — déjà servis par `B05-TP-02` et `B05-TP-03` — et non des quantités
(`B02-AU-03`).

## B2 — Quatre informations qui varient **par lot**

C'est le besoin de fond. Le dossier réel porte cinq lots, et :

- **cinq montants de garantie de soumission** distincts (1 600 000 Ar pour les lots 1, 3 et 5 ; 2 170 000 Ar pour
  les lots 2 et 4) ;
- un **acte d'engagement par lot**, avec son propre numéro de dossier et, à son article 2, le **montant minimum** et
  le **montant maximum** *du lot* ;
- un **délai de livraison** fixé lot par lot dans le bon de commande.

La fiche ne sait porter qu'une valeur par information. Pour un marché non alloti c'est exact ; pour un marché
alloti — le cas courant — c'est faux.

**Mécanisme demandé** — le plus léger que nous ayons trouvé, et qui n'oblige à rien ailleurs :

1. un attribut **`parLot: true`** sur le champ, servi dans le référentiel comme les autres attributs ;
2. les valeurs de ces champs sont enregistrées sous la clé **`CODE#n`**, où `n` est le rang du lot (1, 2, 3…) :
   `B05-GS-03#1`, `B05-GS-03#2`… La clé nue (`B05-GS-03`) reste valable et vaut « lot unique » pour un marché non
   alloti ;
3. le **nombre de lots** est celui du plan de passation, déjà servi (`clePpm = NB_LOTS_PPM`, champ `B02-LV-01`) : le
   serveur n'a rien à inventer, et refuse un rang hors de ce nombre (400 nominatif, comme les autres erreurs de
   champ) ;
4. un champ `parLot` **obligatoire** l'est pour **chaque** lot : le bilan des contrôles compte une ligne par lot
   manquant, avec le rang dans le message ;
5. à la **génération**, la valeur est reprise dans le document du lot concerné ; l'acte d'engagement étant établi
   par lot, il est produit **une fois par lot**, comme le dossier réel.

> ⚠️ **Livré le 2026-09-25 (backend, V43) — le mécanisme tel quel, avec ces précisions :**
>
> - **« Alloti » = plus d'un lot au plan.** Le serveur le dit : **`FicheMarcheDto.nbLots`** (lots de la ligne
>   courante, 0 si aucun) et **`saisieParLot`** (`nbLots > 1`). L'écran n'a pas à le déduire de `B02-LV-01` ni du
>   cadrage `alloti` (qui reste une réponse de la PRMP et ouvre ses rubriques, sans décider des clés).
> - **Point 2** — ligne allotie : la **clé nue** d'un champ `parLot` est **refusée** (400 nominatif) — elle ne dirait
>   pas de quel lot il s'agit. Ligne non allotie : clé nue ; `CODE#1` est admis et **enregistré sous la clé nue**,
>   `CODE#2` refusé. `#n` sur un champ qui n'est pas `parLot` : 400. Le rang suit l'ordre des lots du plan.
> - **Point 4** — ligne du bilan par lot manquant : `champs: ["B05-TP-02#3"]`, message « « Montant minimum annuel du
>   marché (Ariary) » (lot 3) est obligatoire. » ; `MONTANT_POSITIF` suit la même règle. `enLettres` est servi sous
>   les mêmes clés (`B05-TP-02#2`).
> - **Point 5** — sur une ligne allotie, l'acte d'engagement est produit **une fois par lot**, avec la valeur de son
>   lot, **même si aucun champ par lot n'est encore saisi** (le dossier réel en compte un par lot). Les documents
>   communs (DPAO, CCAP…) portent **une ligne par lot** (« Délai maximum de livraison (jours) — lot 2 : 20 »).
>   **`DocumentFicheDto.lot`** (`null` : document commun), `libelle` « Acte d'engagement — lot 2 », fichier
>   `AE_<plan>_<ligne>_lot2_v1.pdf`. Tous les PDF sont joints au dossier soumis.
> - Si le nombre de lots du plan change après la saisie, les valeurs de l'autre forme restent enregistrées mais ne
>   comptent plus (ni bilan, ni documents) : l'écran les redemande.

**Les quatre champs concernés** (aucun autre, vérifié sur le dossier réel — le reste du DAO est commun aux lots) :

| champ | libellé | type |
|---|---|---|
| `B05-GS-03` | Montant de la garantie de soumission (Ariary) | MONTANT |
| `B05-TP-02` | Montant minimum annuel du marché (Ariary) | MONTANT |
| `B05-TP-03` | Montant maximum annuel du marché (Ariary) | MONTANT |
| `B06-EO-12` | Délai maximum de livraison (jours) | NOMBRE |

⚠️ Si ce mécanisme vous paraît trop lourd pour ce lot-ci, dites-le : le repli est de traiter les quatre champs en
texte libre (« lot 1 : … ; lot 2 : … »), au prix d'une saisie non contrôlable et de documents qui répéteront les
cinq montants dans chacun des cinq actes d'engagement. Nous préférons le mécanisme ci-dessus, mais la décision de
calendrier vous appartient.

**Côté front** : l'écran rendra ces champs sous forme d'un petit tableau, une ligne par lot, alimenté par le nombre
de lots du plan ; un marché non alloti gardera l'apparence actuelle, un seul champ. Rien ne sera livré tant que le
contrat n'est pas servi — comme au lot 1, l'écran retombera sur la valeur unique si `parLot` est absent.

## B3 — Sept informations du dossier réel que le référentiel ne collecte pas

Aucune ne figure au fichier de correspondance des fournitures ; ce sont des manques de la **source**, que le dossier
réel révèle. Quatre existent déjà ailleurs : il suffit d'**étendre leurs catégories**, sans créer de code.

### Réemploi — étendre `categories` à `FOURNITURES_SERVICES`

| champ existant | libellé | remarque |
|---|---|---|
| `B04-CD-01` | Modèles de fiches de renseignements joints au dossier (A1, A2…) | libellé déjà neutre (clause 5.1 du dossier réel) |
| `B04-CD-02` | Modèle de garantie de soumission joint au dossier | idem — `B04-CD-03` (plans) reste aux seuls travaux |
| `B04-VE-01` | Remise par voie électronique admise | ⚠️ son libellé dit « propositions » (prestations intellectuelles) : à neutraliser en « **offres ou propositions** » |
| `B04-VE-02` | Conditions et modalités de transmission électronique | idem |

### Créations

| code proposé | libellé | type | rubrique | document | condition |
|---|---|---|---|---|---|
| `B02-AU-06` | Nombre maximum de lots attribuables à un même candidat | NOMBRE | B02-AU | DPAO | `alloti = OUI` |
| `B02-OB-03` | Numéro du dossier d'appel d'offres | TEXTE | B02-OB | DPAO, repris dans AE | — |
| `B03-NA-03` | Comptable assignataire des paiements | TEXTE | B03-NA | AE | `nantissement = OUI` si la condition existe, sinon aucune |
| `B04-RO-03` | Présentation des plis (plis séparés par lot, enveloppes intérieures originale et copie) | TEXTE_LONG | B04-RO | DPAO | — |
| `B09-PC-02` | Annexes de l'acte d'engagement (cadre du bordereau de prix, état des sommes versées à des tiers, **déclaration des bénéficiaires effectifs**) | TEXTE_LONG | B09-PC | AE | — |

⚠️ La **déclaration des bénéficiaires effectifs** est une annexe obligatoire de l'acte d'engagement réel, et elle
n'apparaît dans **aucun** de nos trois fichiers de correspondance. Nous la signalons aussi à l'auteur du fichier.

> ⚠️ **Livré le 2026-09-25 (backend) — trois écarts :**
>
> - **`B02-AU-07`, pas `B02-AU-06`** : le code proposé est déjà pris dans le fichier des fournitures (« Rythme de
>   commande (bons de commande) », inactif, document `AUCUN`). Le nombre maximum de lots par candidat est
>   `B02-AU-07`.
> - **`B04-VE-01` et `-02` ont pour maître le `DPAO`**, plus le `DPIC` : un maître `DPIC` aurait fait produire un DPIC à
>   une fiche de fournitures. Pour les prestations intellectuelles, rien ne change — la substitution de catégorie
>   (DPAO → DPIC) les y remet. Libellés neutralisés : « Remise des offres ou propositions par voie électronique
>   admise », « Conditions et modalités de transmission électronique des offres ou propositions ». Les rubriques
>   `B04-CD` et `B04-VE` sont ouvertes aux fournitures (V43) ; `B04-CD-01` reste **obligatoire**, désormais aussi en
>   fournitures.
> - **Types de marché** des cinq créations (non précisés) : `QUANTITE_FIXE,A_COMMANDE`, comme leurs voisines du
>   fichier des fournitures ; aucune n'est obligatoire. `B03-NA-03` n'a **pas de condition** : il n'existe pas de clé
>   de cadrage `nantissement` (le nantissement est une saisie, `B03-NA-01`).
>
> Fichiers corrigés : `referentiel-champs-fiche-marche-fournitures.csv` (créations, `B02-AU-04`, `B06-EO-11`, colonne
> `parLot`), `…-fiche-dao-travaux.csv` (`B04-CD-01`, `-02`), `…-fiche-dao-prestations-intellectuelles.csv`
> (`B04-VE-01`, `-02`). DBPRS20 alignée par `PRS20/docs/referentiel/2026-09-25-dao-a-commande-par-lot.sql`.

## B4 — Un doublon à retirer

`B06-EO-11` « Délai de livraison (jours) » et `B06-EO-12` « Délai maximum de livraison (jours) » se recouvrent. Le
dossier réel n'a qu'une règle :

> « Le délai de livraison est fixé dans le **bon de commande**, sans toutefois dépasser **trente (30) jours** à
> compter du lendemain de la date de notification de ce bon. » (clause 12)

Pour un marché à commande, seul le **plafond** se fixe au DAO. À livrer : `B06-EO-11` restreint aux
`typesMarche = QUANTITE_FIXE` (où le délai est unique et se fixe bien au dossier), `B06-EO-12` conservé pour les
trois formes.

> ⚠️ **Livré le 2026-09-25 (backend)** — `B06-EO-11` est réservé à la quantité fixe. `B06-EO-12` n'est pas « conservé
> pour les trois formes » : il n'a jamais valu que pour le marché **à commande** (`typesMarche = A_COMMANDE`), et il y
> reste — le contrat-cadre a son propre fichier, sans délai de livraison. Chaque forme garde donc un seul délai :
> quantité fixe `B06-EO-11`, à commande `B06-EO-12` (par lot).

## Vérification

- `node scripts/coherence-dao.mjs A_COMMANDE` doit rester muet sur les documents (les ajouts du §B3 n'étant pas au
  classeur, ils apparaîtront en « champs servis sans ligne » : c'est attendu, et noté ici pour que le prochain
  lecteur ne les prenne pas pour une dérive).
- La recette réelle se fera sur une ligne allotie du plan de test, avec au moins deux lots, jusqu'à la génération —
  l'acte d'engagement doit alors être produit une fois par lot.
