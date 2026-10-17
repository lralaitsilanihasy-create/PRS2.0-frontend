# Demande backend — 2026-10-17 — Charte des DAO générés : le volet travaux

## Contexte

La charte des DAO générés (demande du 16/10, close le 17/10 : 51aa7ed, 4e071c4, 80f4595) a été établie et recettée sur des
fournitures. Le pilote a demandé de la compléter à partir de deux DAO de **travaux réels**, déposés dans
`Documents Types/Travaux/ExemplesDAO/` :

- **routes Ankily – Mahasoa** (Ministère des Travaux Publics) : 152 pages, lot unique, bordereau et détail quantitatif par
  séries (000, 500, 600) ;
- **bâtiments scolaires** (Ministère de l'Éducation nationale) : 187 pages, deux lots, détail quantitatif par chapitres
  (0, I à XIV) et récapitulation générale par lot.

Les deux suivent le plan ARMP 1.1 à 2.3 que le DAO complet reproduit déjà. Ils portent en plus, pour les travaux, une garde
localisée, un détail quantitatif structuré et des **formulaires techniques du candidat**. Le CCAP du document type
(`CCAP-T`) cite ces formulaires comme pièces du marché sans en donner le modèle : planning d'exécution, liste du personnel
cadre, liste du matériel, liste des plans, sous-détail des prix unitaires.

**Maquette** : `docs/maquette-2026-10-17-charte-dao-travaux.html`, dix feuilles A4 annotées : garde, page courante,
bordereau, détail quantitatif, récapitulation, sous-détail des prix, personnel, matériel, planning, plan de charge.

## Arbitrages du pilote (17/10)

1. **En-tête courant à la partie en cours, pour toutes les catégories** : la partie à gauche, le n° du DAO à droite.
2. **Bordereau des travaux** : le prix en lettres sur sa propre ligne, sous la désignation.
3. **Détail quantitatif** : un sous-total par série et une récapitulation par lot.
4. **Formulaires techniques du candidat intégrés au DAO complet des travaux**, avec le personnel et le matériel
   pré-remplis depuis la fiche.

La règle de fond de la charte reste inchangée : le texte des documents types ne bouge pas. Les formulaires de T5 à T7 ne
figurent pas dans les documents types. Leur texte est repris des deux DAO réels ; il ne contient aucune clause, seulement
des consignes au candidat.

## T1 — La garde des travaux

- **Imputation et compte sur deux lignes.**
  - « IMPUTATION BUDGETAIRE : » `B01-AC-16` (lignes d'imputation du plan, sans les montants entre parenthèses) ;
  - « COMPTE : » `B01-AC-17`.
- ⚠️ **Correctif valable pour toutes les catégories.** La garde livrée le 16/10 imprime « IMPUTATION BUDGETAIRE : » suivie
  de `B01-AC-17`, qui est le **compte** (« 6111 » sur la fiche de la ligne 303337). La maquette de la charte avait fait la
  même confusion.
- **Localisation par lot**, sous l'objet : le lieu des travaux et, pour un ouvrage linéaire, les coordonnées GPS de début et
  de fin. Voir la question Q1.
- **« MARCHES PUBLICS DE TRAVAUX »** en bas de garde, comme le document type.

## T2 — L'en-tête courant à la partie en cours (toutes catégories)

- À gauche, l'intitulé court de la partie en cours :
  - « Instructions aux candidats » ;
  - « Données particulières de l'appel d'offres » ;
  - « Formulaires de soumission » ;
  - « Cadre d'acte d'engagement » ;
  - « Cahier des prescriptions spéciales » ;
  - « Cahier des clauses administratives générales ».
  
  Pour le contrat-cadre et les prestations intellectuelles, les intitulés de leurs propres sections.
- À droite, « DAO n° … », selon la règle de R1 du 16/10.
- Le pied ne change pas. La garde et les séparateurs restent sans en-tête ni pied.
- Règle 6 de B4, du 16/10 : l'intitulé de partie est aussi le titre du séparateur. Il doit donc se distinguer d'une ligne du
  corps, par exemple par une casse différente. À vérifier par la relecture.

## T3 — Le bordereau des prix unitaires des travaux

- La désignation, puis, **sur la ligne suivante de la même cellule**, « {article défini} {unité} à : …………… Ariary » (« Le
  mètre cube à : … », « Le forfait à : … »). La règle de l'article défini, et `libelleBordereau` quand il est saisi, restent
  ceux du 16/10.
- Colonnes : N° prix · DESIGNATION DES OUVRAGES ET PRIX UNITAIRE EN TOUTES LETTRES · UNITE · PRIX UNITAIRE EN CHIFFRES.
- Les lignes de série (000, 500…) sont inchangées : gras sur fond grisé, sans unité.
- **Relecture** : la lecture des articles écarte déjà « , le mètre cube à … » ; elle doit écarter de même une **ligne** « Le
  mètre cube à : … Ariary » de la désignation. Les deux DAO réels de la mesure (MTP) en ont la forme.

## T4 — Le détail quantitatif et estimatif structuré

- Après chaque série, une ligne **« Sous-total {code} — {libellé} »** : italique gras sur fond grisé, montant vide.
- Après le tableau de chaque lot, une **récapitulation** :
  - une ligne par série, avec sa colonne de montant ;
  - total hors taxes, TVA (`FICHE_TAUX_TVA`), total toutes taxes comprises ;
  - puis « Arrêté le montant du lot k à la somme de … » ;
  - enfin « Fait à …, le … » et « Le candidat ».
- Un **prix forfaitaire** (décomposition du prix forfaitaire, `ANNEXE-FORFAIT` de l'AE-T) suit la même structure : séries,
  sous-totaux, récapitulation.
- **Relecture** : une ligne de sous-total n'est pas un article. Elle n'a ni numéro de prix ni unité, comme une ligne de
  série.

## T5 — Le sous-détail des prix et le coefficient K1

- Annexe au cadre d'acte d'engagement, pour chaque lot : **cadre du sous-détail des prix** et **mode de calcul du
  coefficient de majoration K1**, d'après le DAO routier (p. 45-46).
- Contenu du sous-détail : désignation, unité, quantité, rendement journalier, durée ; puis les composantes (personnel,
  matériel, matériaux, outillage) avec leurs totaux partiels ; le total des déboursés secs « D » ; et la formule
  « (D × K1) / R ».
- La consigne « prix à sous-détailler » cite les prix d'installation de chantier et les prix marqués d'un astérisque au
  détail quantitatif. Voir la question Q2.

## T6 — Le personnel et le matériel affectés, pré-remplis

**Liste du personnel affecté aux lots** (annexe aux spécifications techniques).
- Une ligne par poste du **personnel exigé** de la fiche (`GET …/personnel`), avec le nombre, le diplôme, l'expérience et
  le domaine.
- Une colonne « Nom proposé » par lot, quand le personnel est exigé par lot ; une seule sinon.
- Puis le **modèle de curriculum vitae**.

**Liste du matériel affecté aux lots.**
- Une ligne par engin du **matériel exigé** (`GET …/materiel`), avec la caractéristique, le nombre et le minimum en propre
  (« — » quand il est nul).
- Les colonnes du candidat : statut proposé (propriété, location longue durée, à louer) et localisation.
- Puis le **modèle d'engagement de location de matériel**.

**Règles communes.**
- Les colonnes du candidat restent vides.
- Une liste vide (rien d'exigé) imprime le cadre sans ligne pré-remplie.
- Mention finale : « Je certifie sincères et véritables les indications portées ci-dessus », lieu, date, signature et
  cachet.

## T7 — Plannings, plan de charge, liste des plans

- **Plannings** : les cinq modèles du DAO routier, avec leurs consignes (p. 99-100) :
  - 8-a général d'exécution ;
  - 8-b mobilisation du personnel et du matériel ;
  - 8-c approvisionnement des matériaux ;
  - 8-d échéancier de paiement ;
  - 8-e intervention pendant le délai de garantie.
  
  La grille du planning général compte autant de colonnes (semaines ou mois) que le **délai d'exécution** de la fiche. Ses
  lignes sont les **séries** du détail quantitatif du lot.
- **Plan de charge** : les marchés en cours de l'entreprise (désignation, montant, avancement, délai, début, fin), ou
  « NEANT ».
- **Liste des plans** : annexe des spécifications techniques. Elle reprend les titres des plans joints au dossier, ou
  « Néant » s'il n'y en a pas. Voir la question Q3.

## Hypothèses

- **H1** — Les formulaires de T5 à T7 sont des textes fixes du serveur, comme les fiches A1 à A4 du candidat. Le front les
  vérifiera par rapport à la maquette.
- **H2** — Les listes de T6 viennent des ressources déjà servies (`…/personnel`, `…/materiel`) de la **version validée**.
- **H3** — T2 vaut pour toutes les catégories. T1 (localisation), T3, T4 (structure) et T5 à T7 ne valent que pour les
  travaux, sauf le correctif de l'imputation, qui vaut partout.

## Questions

- **Q1** — La fiche ne porte aucune **localisation des travaux**. Faut-il un champ par lot (lieu, PK, coordonnées GPS de
  début et de fin), ou existe-t-il une localité de la ligne du plan qui puisse servir de reprise ?
- **Q2** — Le **marquage par astérisque** des prix à sous-détailler (T5) suppose une case « à sous-détailler » sur
  l'article du besoin. Faut-il l'ajouter, ou s'en tenir à « tous les prix d'installation de chantier et les prix que
  désigne le DPAO » ?
- **Q3** — La **liste des plans** (T7) : d'où vient-elle ? Les plans sont aujourd'hui joints au Word des spécifications
  (B2 du 06/10). Faut-il un champ « titres des plans », ou une liste vide à compléter ?

## Ce que le front fera, dès la livraison

- Recette sur une fiche de travaux allotie : comparaison à la maquette, puis réimport du PDF produit dans sa propre fiche
  (articles, séries, sous-totaux exclus).
- Contrôle de T2 sur une fiche de fournitures et sur un contrat-cadre.
- Annotation de cette demande en place si la livraison s'en écarte.
