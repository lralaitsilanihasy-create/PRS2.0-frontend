# Démonstration des fiches DAO — travaux et prestations intellectuelles

*Proposition du 24/09/2026, à arbitrer par le pilote.*

## 1. Ce qu'on peut montrer aujourd'hui, et ce qui manque

Les deux lignes de démonstration existent et s'ouvrent correctement :

| ligne | objet | montant | lots | fiche |
|---|---|---|---|---|
| 303070 | [DÉMO] Travaux de réhabilitation du bâtiment administratif | 450 000 000 Ar | Lot 1 gros œuvre et étanchéité (300 M) · Lot 2 second œuvre et réseaux (150 M) | `/prmp/dao/6` |
| 303071 | [DÉMO] Étude de faisabilité et assistance à maîtrise d'ouvrage | 120 000 000 Ar | Lot 1 étude de faisabilité (70 M) · Lot 2 AMO (50 M) | `/prmp/dao/7` |

Mais **les deux fiches sont vides** — 0 information sur 134 pour les travaux, 0 sur 85 pour les prestations
intellectuelles — et leur **cadrage a été posé par mes scripts de recette**, qui cochent la première réponse venue.
La fiche 7 annonce ainsi « variantes autorisées » et « groupement conjoint ou solidaire » : personne n'a décidé cela.

Montrer un formulaire vide démontre la charpente, pas le produit. Ce qu'il manque pour une démonstration, ce sont
**deux dossiers nourris, cohérents, qui vont jusqu'au bout de la chaîne** — jusqu'au dossier déposé à la Commission.

## 2. Ce que je propose

Deux scénarios, chacun **choisi pour montrer ce qui n'existe que dans sa catégorie**. Le reste (le rail, les reprises,
les contrôles, le versionnement) est commun aux trois et se démontre déjà avec les fournitures.

### A. Travaux — réhabilitation du bâtiment administratif

Ce que ce dossier met en scène, et qu'aucun autre ne peut montrer :

- **la question des tranches**, posée aux seuls travaux : une tranche ferme (gros œuvre, 300 M) et une tranche
  conditionnelle (second œuvre, 150 M), avec son délai d'affermissement ;
- le **bloc B11 « Annexes et formulaires »** et ses **6 formulaires en pièces jointes** — l'arbitrage du 24/09 rendu
  visible : les FAR ne sont pas des champs à saisir, ce sont des documents qu'on joint ;
- les **43 informations d'exécution** du bloc B09 : réception provisoire et définitive, garantie de parfait
  achèvement, pénalités, ordres de service — le cœur d'un marché de travaux ;
- l'**avance forfaitaire contre garantie**, et le contrôle qui l'accompagne.

Cadrage proposé, réponse par réponse :

| question | réponse | pourquoi cette réponse dans la démonstration |
|---|---|---|
| Allotissement | **2 lots** (imposé par le plan) | montre que l'allotissement vient du PPM et se verrouille |
| Tranches | **Oui** | la question propre aux travaux ; ouvre les rubriques de tranche ferme et conditionnelle |
| Variantes | **Non** | garde la démonstration lisible ; la rubrique se ferme sous les yeux du public |
| Groupement | **Oui, conjoint ou solidaire** | deux lots de métiers différents : le cas réel |
| Provenance | **Territoire national** | |
| Type de prix | **Prix unitaires** | usage des travaux, contre le forfait des prestations intellectuelles |
| Prix révisable | **Oui** | un chantier de plusieurs mois ; ouvre la formule de révision |
| Garantie de soumission | **Oui** | 9 000 000 Ar, soit 2 % |
| Avance | **Oui, 20 %** | contre garantie à première demande — déclenche le contrôle `AVANCE_SUP_5_GARANTIE` |
| Pénalités | **Selon le CCAG** | 1/1000 par jour, plafond 15 % — contrôle `PENALITES_PLAFOND_15` |

Valeurs marquantes proposées :

| information | valeur | ce qu'elle démontre |
|---|---|---|
| Date et heure limites de remise des offres | 30/10/2026 à 10 h 00 | contrôle `DATES_ORDRE:REMISE` |
| Délai de validité des offres | 90 jours | cohérence avec la garantie de soumission |
| Garantie de soumission | 9 000 000 Ar | contrôle `MONTANT_POSITIF` |
| Avance forfaitaire | 90 000 000 Ar, 20 % | contrôle `AVANCE_SUP_5_GARANTIE` |
| Taux des pénalités journalières | 1/1000, plafond 15 % | contrôle `PENALITES_PLAFOND_15` |
| Intérêts moratoires | taux directeur + 2 points | contrôle `INTERETS_MORATOIRES_TAUX` |
| Délai d'exécution | 8 mois, tranche ferme 5 mois | |
| Garantie de parfait achèvement | 12 mois | |

### B. Prestations intellectuelles — étude de faisabilité et assistance à maîtrise d'ouvrage

Ce que ce dossier met en scène, et qu'aucun autre ne peut montrer :

- le **DPIC** — on ne consulte pas des candidats, on consulte des consultants : le rail, les pastilles et la phrase
  d'en-tête changent de vocabulaire d'un bout à l'autre de l'écran ;
- la **sélection qualité-coût et ses deux enveloppes** : évaluation technique d'abord, ouverture des propositions
  financières ensuite, classement pondéré — trois rubriques qui n'existent nulle part ailleurs ;
- les **négociations** avec le consultant classé premier, absentes d'un appel d'offres de fournitures ;
- la **rémunération** en trois formes (forfait, temps passé, aléa d'exécution sur accord écrit) ;
- l'**utilisation des résultats** et la propriété des livrables.

Cadrage proposé :

| question | réponse | pourquoi |
|---|---|---|
| Allotissement | **2 lots** (imposé par le plan) | |
| Variantes | **Non** | ⚠️ corrige le « Oui » posé au hasard par mon script |
| Groupement | **Oui, obligatoirement solidaire** | un bureau d'études et un assistant, un seul responsable devant le client — et la démonstration montre ainsi l'autre forme de groupement que celle des travaux |
| Provenance | **Territoire national** | |
| Type de prix | **Forfait** | ⚠️ corrige les « prix unitaires » posés au hasard ; c'est la forme des prestations intellectuelles |
| Prix révisable | **Non** | mission de 6 mois |
| Garantie de soumission | **Non** | usage des prestations intellectuelles — montre une rubrique qui se ferme |
| Avance | **Oui, 20 %** | |
| Pénalités | **Oui** | plafond 15 % |

Valeurs marquantes proposées :

| information | valeur | ce qu'elle démontre |
|---|---|---|
| Mode de sélection | **Qualité-coût** (80 / 20) | la rubrique propre aux consultants |
| Date et heure limites de remise des propositions | 20/10/2026 à 10 h 00 | contrôle `DATES_ORDRE:REMISE` |
| Note technique minimale | 70 sur 100 | ouvre l'ouverture des propositions financières |
| Montant du forfait | 120 000 000 Ar | contrôle `MONTANT_POSITIF` |
| Date de début des prestations | 01/12/2026 | |
| Durée de la mission | 6 mois | |
| Assurance exigée du consultant | 50 000 000 Ar | |
| Utilisation des résultats | propriété du client, publication soumise à accord | |

## 3. Le déroulé, environ huit minutes par catégorie

1. **Le choix de la ligne** (`/prmp/dao`) : la colonne annonce les trois catégories ; on voit d'un coup d'œil qu'une
   ligne de travaux et une ligne d'études ne mènent pas au même dossier.
2. **L'en-tête de la fiche** : la catégorie et la forme en pastilles, et la phrase qui nomme les documents —
   « le DPAO, l'acte d'engagement et le CCAP » d'un côté, « les données particulières des **instructions aux
   consultants** » de l'autre. C'est le moment où la différence se voit.
3. **Le cadrage** : on déroule les réponses ci-dessus et on montre une rubrique qui s'ouvre (les tranches) et une qui
   se ferme (la garantie de soumission des prestations intellectuelles).
4. **La saisie bloc par bloc** : 10 blocs pour les travaux, 9 pour les études ; on s'arrête sur le bloc B11 des
   annexes (les 6 formulaires en pièces jointes) et sur le bloc B06 de l'évaluation en deux enveloppes.
5. **Les reprises** : la même information saisie une fois se retrouve dans deux ou trois documents — l'argument
   central du chantier.
6. **Les contrôles** : on lève le dernier écart devant le public (par exemple un taux de pénalités à 20 %, refusé).
7. **La validation** : la fiche se fige en version 1, et **produit son dossier**.
8. **Le dossier** côté Commission : on le retrouve avec sa fiche rattachée, prêt à être soumis.

## 4. Ce que je fais au feu vert

Un script `demo-dao.mjs` dans le scratchpad, qui garnit les deux fiches **par l'API, comme le ferait une PRMP** —
aucun code applicatif touché, aucune donnée inventée en base :

- il pose le cadrage arbitré, puis les 134 et 85 informations, bloc par bloc ;
- il lève les contrôles et **valide** les deux fiches (version 1), puis crée leur dossier ;
- il est **rejouable** : relancé, il remet les deux dossiers dans le même état ;
- une option `--vider` les ramène à zéro, pour rejouer la démonstration devant un autre public.

Compter une demi-journée, l'essentiel étant d'écrire 219 valeurs qui se tiennent entre elles.

## 5. Trois points à trancher

1. **Jusqu'où va la démonstration ?** S'arrêter à « prêt à valider » (la fiche reste modifiable, on peut la montrer
   plusieurs fois), ou aller jusqu'à la **version 1 figée et au dossier créé** — plus parlant, mais la fiche n'est
   plus modifiable et la démonstration se rejoue par `--vider`. *Ma recommandation : aller jusqu'au dossier, avec
   `--vider` pour recommencer.*
2. **Les six formulaires en pièces jointes** (FAR des travaux) : y joindre de vrais PDF de démonstration, ou les
   laisser vides en montrant seulement l'emplacement ? *Ma recommandation : deux PDF sur six, assez pour montrer le
   geste sans fabriquer des documents officiels qui n'existent pas.*
3. **Le cadrage actuel des fiches 6 et 7**, posé au hasard par mes scripts de recette : je le remplace par celui de ce
   document. Sauf avis contraire, c'est ce que je ferai.

⚠️ **Un point vérifié, sans risque pour la démonstration** : le contrôle `DATES_ORDRE:REMISE` se compare aux dates
prévisionnelles du plan (`B01-AC-18`), **vides** sur les deux lignes de démonstration — il ne bloquera donc pas la
validation, contrairement aux lignes réelles du plan de test dont le calendrier est passé (point ouvert du 23/09).

---

## 6. ⚠️ Livraison — 24/09/2026, feu vert du pilote

Les deux dossiers de démonstration sont **garnis, contrôlés, validés en version 1, et ont produit leur dossier** sur
le serveur de développement. Tout est passé par l'API, comme le ferait une PRMP : aucun code applicatif n'a été
touché pour les remplir, aucune écriture directe en base.

| | travaux (fiche 6) | prestations intellectuelles (fiche 7) |
|---|---|---|
| informations posées | **115** sur 127 | **68** sur 85 |
| contrôles restants | **0** | **0** |
| version | 1, figée le 24/09/2026 | 1, figée le 24/09/2026 |
| dossier produit | **100335** | **100334** |
| documents annoncés | DPAO · AE · CCAP | **DPIC** · AE · CCAP |

**Les informations laissées vides ne sont pas des oublis** : ce sont exactement celles que le cadrage a fermées.
Chez les travaux : la seconde tranche conditionnelle (il n'y en a qu'une), la langue étrangère, la part en devises,
le règlement d'un marché à prix forfaitaires (celui-ci est à prix unitaires), les travaux en régie, le contrôle des
prix de revient. Chez les prestations intellectuelles : les trois champs de sous-traitance (elle n'est pas admise),
la transmission électronique (elle n'est pas ouverte), et les sept champs des rémunérations au temps passé, au
résultat et au barème (la mission est au forfait). **C'est le meilleur moment de la démonstration** : ouvrir la
tranche, puis montrer que le reste du formulaire s'est tu.

### ⚠️ 25/09 — les documents sont RÉELLEMENT produits, et la démonstration peut les ouvrir

En vérifiant la dernière étape, constat que je n’attendais pas : **la validation produit les documents et les joint
au dossier**, sans rien demander. Les deux dossiers de démonstration les portent déjà :

L'étape 7 de la fiche liste **six fichiers** — chacun des trois documents en **`.docx` et en `.pdf`** — avec
« Ouvrir » et « Enregistrer » ; les PDF sont en plus **joints au dossier** comme pièces, avec la pastille « fiche DAO » :

| dossier | pièces jointes au dossier (produites à la validation) |
|---|---|
| 100335 (travaux) | `DPAO_00001-PPM-AGPM-CNM-2026_303070_v1.pdf` (8 ko) · `CCAP_…_v1.pdf` (9 ko) · `AE_…_v1.pdf` (5 ko) |
| 100334 (études) | **`DPIC`**`_00001-PPM-AGPM-CNM-2026_303071_v1.pdf` (7 ko) · `CCAP_…_v1.pdf` (4 ko) · `AE_…_v1.pdf` (3 ko) |

Leur contenu est celui de la fiche, section par section : les 23 informations du plan, puis les 115 saisies, montants
en toutes lettres compris (« 450 000 000 Ariary (quatre cent cinquante millions ariary) »). Chaque pièce porte la
pastille « fiche DAO » sur la page du dossier, et s’ouvre d’un clic.

**Ce que cela change pour la démonstration** : l'étape 7 n'est plus une promesse. On valide, on ouvre le document
produit devant le public — c'est là que « une information saisie une fois » devient visible — et on retrouve les
mêmes fichiers joints au dossier, prêts pour la Commission.

⚠️ **Et cela corrige ce que j'annonçais le 24/09** : les modèles Word officiels ne sont pas le blocage du lot 2, la
génération fonctionne et sort déjà du `.docx` comme du `.pdf`. Ce que les modèles apporteront, c'est la **mise en
forme réglementaire** — l'ordre et l'habillage des articles — pas la fonction.

### Comment jouer la démonstration

- **Travaux** : `/prmp/dao/6` · **Prestations intellectuelles** : `/prmp/dao/7` (profil PRMP001).
- Les dossiers produits : `/prmp/dossier/100335` (travaux) et `/prmp/dossier/100334` (études). Chacun porte
  l'encart « Fiche DAO — Validée version 1 », avec son compte d'informations et le lien de retour vers la fiche.
- La fiche s'ouvre sur l'**étape 6**, validée : on y voit la version figée, son auteur, sa date et son compte
  d'informations. Cliquer l'étape 3 pour parcourir les blocs remplis, l'étape 4 pour les reprises, l'étape 7 pour les
  documents.
- Pour montrer la saisie en train de se faire : **« Ouvrir une nouvelle version »** rouvre un brouillon modifiable
  sans rien perdre ; la version 1 reste dans l'historique.
- Pour tout remettre à zéro et rejouer devant un autre public :
  ```bash
  node demo-dao.mjs --vider     # rouvre une version et efface les valeurs
  node demo-dao.mjs             # garnit, contrôle, valide, crée le dossier
  ```
  Les deux scripts vivent dans le dépôt : `scripts/demo-dao.mjs` (le geste) et `scripts/demo-dao-valeurs.mjs`
  (les 183 valeurs et les deux cadrages). `node scripts/demo-dao.mjs 6` ne joue qu'une des deux fiches. Ils parlent
  au serveur sur `localhost:8080`, avec le compte PRMP001 — donc backend démarré.

### Les trois arbitrages, appliqués

1. **Jusqu'où** : jusqu'à la version 1 figée et au dossier créé, comme recommandé. Les deux dossiers existent en
   brouillon, chacun portant sa fiche.
2. **Les six formulaires en pièces jointes** : ⚠️ **techniquement impossible aujourd'hui**, et ce n'est pas un
   oubli. Les champs de type `PIECE` n'ont **aucune voie de dépôt** — l'écran l'annonce lui-même : « Pièce jointe —
   au dossier, après validation (lot 2) ». Et le référentiel des pièces d'un dossier DMC (8 types : DAO complet,
   CCAG, CCTP, avis d'appel d'offres, estimation, garantie de soumission, avis de non-objection, rapport
   d'évaluation) **n'a aucun type « formulaire à remplir »** : y déposer un modèle de garantie bancaire sous le type
   « Estimation du coût des travaux » serait un faux. Deux issues, au choix du pilote : attendre le lot 2, ou
   demander au backend **un type de pièce « Formulaires à remplir (FAR) »** — un ajout d'une ligne au référentiel.
   En attendant, la démonstration montre les six lignes à leur place dans le bloc B11, ce qui est déjà l'arbitrage du
   24/09 rendu visible.
3. **Le cadrage posé au hasard** par les scripts de recette a été remplacé par celui de ce document.

### Deux défauts que la démonstration a révélés

- ✅ **Corrigé** : le résumé du cadrage affichait « Pénalités selon le **ccag** ». La mise en minuscule portait sur
  tout le libellé et mangeait le sigle ; elle ne porte plus que sur la première lettre. Un test le retient.
- ⚠️ **À trancher par le pilote** : la pastille « **Fournitures** territoire national » s'affiche sur une fiche de
  travaux comme sur une fiche d'études, parce que la question du cadrage demande « D'où viennent les **fournitures**
  ? ». Sur des travaux, il s'agit des **matériaux** ; sur une mission d'études, la question n'a probablement pas
  lieu d'être. Proposition : faire suivre l'intitulé à la catégorie (« les fournitures » / « les matériaux »), et
  dire si la question doit disparaître pour les prestations intellectuelles. Rien n'est changé sans votre mot :
  c'est une question de fond, pas de forme.

---

## 7. ⚠️ 25/09 — un troisième dossier : le marché à commande, lot par lot

Le pilote a fourni un **dossier d'appel d'offres réellement publié** (MESupReS, matériels informatiques en cinq
lots, à commande — `NatureMarches/DAO_Fournitures/Fourniture_a_commande.pdf`). La démonstration en tire un
troisième dossier, et c'est le seul des trois qui montre ce qu'un **allotissement** fait à la fiche.

| | Fournitures à commande — fiche [`/prmp/dao/5`](http://localhost:4200/prmp/dao/5) |
|---|---|
| ligne | 303069, « [DÉMO] Fourniture de consommables informatiques (marché à commande) », **2 lots** |
| informations posées | **99**, dont **8 cellules par lot** |
| contrôles restants | 0 |
| version | 2, validée le 25/09 *(la version 1 avait servi à recetter le mécanisme par lot)* |
| dossier produit | **100336** |
| documents | DPAO · CCAP · **Acte d'engagement — lot 1** · **Acte d'engagement — lot 2** |

**Ce que ce dossier montre, et qu'aucun des deux autres ne peut montrer :**

- les quatre informations qui varient d'un lot à l'autre se saisissent **une fois par lot**, dans une cellule
  étiquetée « Lot 1 », « Lot 2 » — garantie de soumission, montant minimum annuel, montant maximum annuel, délai
  maximum de livraison ;
- la validation produit **deux actes d'engagement**, et chacun porte **les chiffres de son lot** :

  | | lot 1 | lot 2 |
  |---|---|---|
  | garantie de soumission | 1 600 000 Ar | 2 170 000 Ar |
  | montant minimum annuel | 40 000 000 Ar | 54 000 000 Ar |
  | montant maximum annuel | 80 000 000 Ar | 108 500 000 Ar |

  *(les deux montants de garantie sont ceux du dossier réel)* ;
- le DPAO et le CCAP, eux, restent **communs** et portent une ligne par lot là où c'est utile.

**Le contenu vient du dossier réel** : délai d'envoi des demandes d'éclaircissement (10 jours) et délai de réponse
de la PRMP (5 jours), validité des offres de **75 jours**, prix fermes et non révisables, décomposition EXW +
transports intérieurs + assurance, remise en **plis séparés par lot** avec double enveloppe scellée, voie
électronique **non admise**, ouverture le jour même à 10 h, délai de réponse des candidats de 3 jours, méthode des
**deux moyennes** pour les offres anormalement hautes ou basses (20 % puis 10 %), pas de préférence nationale, et
délai de livraison **fixé au bon de commande sans dépasser 30 jours**. L'acheteur et l'objet, eux, restent ceux de
la ligne du plan de démonstration : on ne réécrit pas le plan pour une démonstration.

**Pour le jouer** : `node scripts/demo-dao.mjs 5` garnit ce seul dossier ; sans argument, les trois. Le déroulé est
celui du §3, avec un arrêt de plus à l'étape 3 sur un champ par lot, et un autre à l'étape 7 devant les deux actes
d'engagement.
