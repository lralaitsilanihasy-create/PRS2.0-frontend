# Plan — reconstituer les modèles A1 à A4 et C1/C2 du candidat

*26/09/2026. Source officielle arrêtée par le pilote : le dossier d'appel d'offres*
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

## Trois écarts trouvés **dans la source** — à trancher avant de décalquer

| # | constat | page | ce que je propose |
|---|---|---|---|
| S1 | Le sommaire de la partie (p. 21) nomme les garanties **`B1` / `B2`** ; le sommaire du dossier (p. 2) et les modèles eux-mêmes (p. 33, 34) les nomment **`C1` / `C2`**. Le dossier se contredit. | 21 vs 2, 33, 34 | garder **`C1` / `C2`** — deux occurrences sur trois, et ce sont les titres portés par les modèles. L'écart est noté au rapport de fidélité, il n'est pas corrigé dans le décalque de la page 21. |
| S2 | La page 22 porte une **« Note aux Utilisateurs »** entre chevrons `<…>` : elle s'adresse à l'acheteur (« l'obligation… peut être réduite en fonction du montant »), pas au candidat. | 22 | **ne pas** la mettre dans le modèle A1 : elle appartient à la page de section du DAO, pas à la fiche que le candidat remplit. À confirmer par vous. |
| S4 | Le titre de A4 porte un **appel de note « ¹ »** — mais la page ne porte **aucune note** : après « Date de fin : `_____` » il n'y a plus que le filigrane. Vérifié sur le texte brut de la page, filigrane retiré. | 31 | garder l'appel **tel quel** (on ne complète rien) et le signaler au rapport de fidélité. Le supprimer serait une correction — c'est à vous de la demander. |
| S3 | A1-b porte la mention **« (non applicable) »** : c'est la réponse du **2463**, pas le modèle. Le cadrage de la fiche porte déjà `groupement = NON`. | 24 | faire de A1-b une section **conditionnée par le cadrage** : « (non applicable) » quand `groupement = NON`, le formulaire complet sinon. La mention devient donc un champ, pas un texte figé. |

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
| A1.11 | **« pendant la période de [nombre d'années] ans »** ×2 (p. 25) | durée des antécédents | **aucun champ n'existe** | à créer — cf. B-nouveau 1 |
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
| A3.3 | « Antécédents pour les **trois** dernières années » (p. 28) | nombre d'exercices | **aucun champ** | à créer — cf. B-nouveau 1 |
| A3.4 | page 29 « Documents financiers » a) à d) | texte figé, aucun blanc | — | — |
| A3.5 | `Exercice du......... au.........` ×3, deux tableaux (p. 30) | 6 couples de dates | — | candidat |
| A3.6 | lignes **« Fournitures »** / **« Prestations intellectuelles »** des tableaux de chiffre d'affaires (p. 30) | intitulés de ligne | **catégorie de la fiche** | **fiche** — un DAO de travaux ne demande pas un chiffre d'affaires de fournitures |
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

## Ce que le backend doit livrer en plus (§B8 de la demande, mis à jour)

| # | besoin | pourquoi |
|---|---|---|
| **N1** | **Les ordinaux en toutes lettres** : « trentième (30ème) », « cent cinquième (105ème) ». `NombreEnLettres` produit aujourd'hui des **cardinaux** (« cent cinq »). | Les deux garanties les écrivent deux fois chacune. Sans ordinal, le modèle ment ou reste figé au 2463. |
| **N2** | **Deux dates dérivées** : fin de validité de l'offre (`B04-LR-03 + B04-VO-01` jours) et délai de garantie (`B05-GS-04 − B04-VO-01`). | Elles ne sont saisies nulle part, et le candidat ne doit pas les calculer. |
| **N3** | **Un champ « durée des antécédents »** (A1-c et A3 : « cinq dernières années », « trois dernières années »). | Aucun champ ne les porte ; les figer au 2463 ferait mentir le modèle pour un autre dossier. |
| **N4** | **A1-b conditionnée** par le cadrage `groupement` (cf. S3), et **A3-b** par la catégorie (cf. A3.6). | Le modèle doit valoir pour les trois catégories et pour un groupement admis. |
| **N5** | **L'adresse de l'autorité contractante** dans le jeu servi à la génération (C1.1, C2.6). | `B01-AC-01` ne porte que le nom. |

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

## L'ordre des gestes, et le verrou

1. Relever la **note de bas de page de A4** (p. 31) et les trois points S1-S3 → **vos réponses**.
2. Écrire les six `.docx` et leurs tableaux de correspondance.
3. Lancer la vérification de fidélité, corriger, relancer jusqu'à zéro écart inexpliqué.
4. **Vous relisez les six Word.** Rien ne part en production avant.
5. Alors seulement : la demande backend N1-N5, puis la génération réelle en remplacement du gabarit provisoire filigrané.

⚠️ Aujourd'hui le serveur produit déjà A1-A4 et C1/C2 **sur un gabarit provisoire filigrané « MODÈLE PROVISOIRE –
NON OFFICIEL »**. Ce gabarit reste en place tant que l'étape 4 n'est pas franchie : il vaut mieux un document qui
annonce qu'il n'est pas officiel qu'un document officiel approximatif.

## Ce qui reste à trancher par vous

| # | question |
|---|---|
| Q1 | **S1** — garder `C1`/`C2` et signaler la contradiction de la page 21, ou suivre `B1`/`B2` ? |
| Q2 | **S2** — la « Note aux Utilisateurs » de la page 22 entre-t-elle dans le modèle A1 ? |
| Q3 | **S3** — A1-b conditionnée par le cadrage, ou décalquée avec son « (non applicable) » ? |
| Q4 | **N3** — « cinq dernières années » et « trois dernières années » : champs de la fiche, ou paramètres administrables comme le taux de TVA ? |
| Q5 | A1, A2, A3 portent plusieurs fiches (a, b, c). Un `.docx` par **sigle** (6 fichiers, ce que le serveur produit aujourd'hui), ou un par **fiche** (9 fichiers) ? |
| Q6 | **S4** — l'appel de note « ¹ » de A4, sans note : on le garde tel quel, ou on le retire ? |
