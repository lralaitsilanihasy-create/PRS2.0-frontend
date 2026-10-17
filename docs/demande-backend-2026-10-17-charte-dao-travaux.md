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

> ⚠️ **2026-10-17, livré côté backend (T1, tranche A)** :
> - « IMPUTATION BUDGETAIRE : » reprend les lignes d'imputation du plan (`B01-AC-16`, sans leurs montants) et « COMPTE : » le
>   compte (`B01-AC-17`). Le correctif vaut pour toutes les catégories.
> - « MARCHES PUBLICS DE TRAVAUX » termine la garde des travaux.
> - ~~**Pas encore** : la localisation par lot, qui attend ses champs (Q1).~~
>
> ⚠️ **Livrée avec la tranche B (17/10)** :
> - **Position** : sous la ligne de chaque lot, ou sous l'objet d'une ligne non allotie.
> - **Contenu** : « {lieu}, {PK} » (`B02-OT-03`, `B02-OT-04`) en 10 pt, puis « Coordonnées GPS : début … — fin … »
>   (`B02-OT-05`, `B02-OT-06`) en 9 pt.
> - **Sans valeur** : rien n'est imprimé.

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

> ⚠️ **2026-10-17, livré côté backend (T2)**, pour toutes les catégories.
> - **Intitulé court** : il est **dérivé du titre de la section**, sans son numéro, son sigle ni son champ d'application, en
>   minuscules sauf l'initiale. La casse le distingue du titre du séparateur.
> - **Exemples** : « Instructions aux candidats », « Données particulières de l'appel d'offres » (« … d'appel à concurrence »
>   en contrat-cadre), « Formulaires de soumission », « Cadre d'acte d'engagement » (« Contrat-cadre valant acte d'engagement
>   et CCAP » en contrat-cadre), « Cahier des prescriptions spéciales », « Cahier des clauses administratives générales ».
> - **Sommaire** : sa page porte « Sommaire général ».
> - **Mise en œuvre** : chaque section du sommaire pose son propre en-tête, et les parties insérées à sa suite le reprennent.
>   Le pied est inchangé ; la garde et les séparateurs restent sans en-tête ni pied.
> - **Écart** : l'**objet** ne figure plus dans l'en-tête courant, puisque la partie et le n° l'occupent.

## T3 — Le bordereau des prix unitaires des travaux

- La désignation, puis, **sur la ligne suivante de la même cellule**, « {article défini} {unité} à : …………… Ariary » (« Le
  mètre cube à : … », « Le forfait à : … »). La règle de l'article défini, et `libelleBordereau` quand il est saisi, restent
  ceux du 16/10.
- Colonnes : N° prix · DESIGNATION DES OUVRAGES ET PRIX UNITAIRE EN TOUTES LETTRES · UNITE · PRIX UNITAIRE EN CHIFFRES.
- Les lignes de série (000, 500…) sont inchangées : gras sur fond grisé, sans unité.
- **Relecture** : la lecture des articles écarte déjà « , le mètre cube à … » ; elle doit écarter de même une **ligne** « Le
  mètre cube à : … Ariary » de la désignation. Les deux DAO réels de la mesure (MTP) en ont la forme.

> ⚠️ **2026-10-17, livré côté backend (T3).**
> - **Impression** : la ligne de prix est un second paragraphe de la cellule, l'initiale en capitale (« Le forfait à : ……………
>   Ariary »).
> - **Relecture** : `LectureTableaux` retire de la désignation une suite « {article} {unité de 1 à 4 mots} à : … ». Le DAO
>   routier réel (`ExemplesDAO/DAO_Travaux_routiers.pdf`) se relit en 17 articles, et aucune désignation ne garde sa ligne de
>   prix. Parité des cinq DAO de la mesure inchangée.
> - **À reporter** dans `lire-specs.mjs` : le motif de cette ligne.

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

> ⚠️ **2026-10-17, livré côté backend (T4).**
> - **Sous-totaux** : « Sous-total {code} — {LIBELLÉ} » après chaque série, en italique gras sur gris, sans n° ni unité. Ils
>   sont exclus de la relecture.
> - **Récapitulation** sous chaque lot : tableau `SERIE · DESIGNATION · MONTANT EN ARIARY`, une ligne par série, puis total
>   HT, TVA et TTC. Viennent ensuite « Arrêté le montant du lot k à la somme de … » (« du marché » sur une ligne non allotie),
>   « Fait à …, le … » et « Le candidat ».
> - **Écart** : les lignes de total ne sont plus au pied du détail quantitatif ; elles passent dans la récapitulation.
> - **Prix global et forfaitaire** (cadrage `typePrix = FORFAITAIRE`) : la même structure s'intitule « Annexe : Décomposition
>   du prix global et forfaitaire ».
> - **Constat de la relecture** : le DAO des bâtiments scolaires (`daolance.DAO_2026_4SDC_vf.pdf`) ne rend **aucun article**.
>   Son détail quantitatif numérote ses chapitres en chiffres romains (I à XIV), que la lecture des tableaux, comme le
>   prototype, ne reconnaît pas comme numéros. C'est à traiter à part si le pilote le veut.

## T5 — Le sous-détail des prix et le coefficient K1

- Annexe au cadre d'acte d'engagement, pour chaque lot : **cadre du sous-détail des prix** et **mode de calcul du
  coefficient de majoration K1**, d'après le DAO routier (p. 45-46).
- Contenu du sous-détail : désignation, unité, quantité, rendement journalier, durée ; puis les composantes (personnel,
  matériel, matériaux, outillage) avec leurs totaux partiels ; le total des déboursés secs « D » ; et la formule
  « (D × K1) / R ».
- La consigne « prix à sous-détailler » cite les prix d'installation de chantier et les prix marqués d'un astérisque au
  détail quantitatif. Voir la question Q2.

> ⚠️ **2026-10-17, livré côté backend (T5, tranche B).**
> - **Annexes de l'acte d'engagement** : après le détail quantitatif, deux annexes de la section 2.1 :
>   « Annexe : Mode de calcul du coefficient de majoration des déboursés K1 » (TVA = `FICHE_TAUX_TVA`) et « Annexe : Cadre
>   du sous-détail des prix ». Elles ne sont pas numérotées « Annexe 2 » et « Annexe 3 » comme dans la maquette, faute de
>   numérotation des annexes existantes.
> - **Consignes** : la consigne 1 cite, **par lot**, les n° des prix à sous-détailler (série d'installation de chantier, et
>   prix marqués `sousDetail`), par exemple « Prix à sous-détailler, lot 1 : n° 001, 540*. ».
> - **Astérisque** : il est imprimé au n° de prix (« 540* ») du bordereau et du détail quantitatif. `LectureTableaux` le
>   retire du code à la relecture. **À reporter dans `lire-specs.mjs`** : la première cellule est lue sans son astérisque final.
> - **Cadre du sous-détail** : deux tableaux séparés, celui de la tâche et celui des composantes (lignes d'exemple du DAO
>   routier, totaux partiels, « D »). Il se termine par « Prix de vente à l'unité = (« D » × « K1 ») / « R » ».

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

> ⚠️ **2026-10-17, livré côté backend (T6).** Ces formulaires sont les annexes 2 à 4 de la section « Spécifications
> techniques » (2.2). En travaux, cette section est désormais toujours présente.
> - **Annexe 2, personnel** : `Poste · Nombre exigé · Diplôme et expérience exigés · Nom proposé[ — lot k]`. Les exigences
>   s'impriment ainsi : « Ingénieur des travaux publics ; 10 ans d'expérience (travaux routiers) ». La colonne par lot apparaît
>   si un poste est exigé par lot sur une ligne allotie. Suivent la note d'identité (P/NP, diplôme, années d'expérience) et le
>   **modèle de CV** (DAO routier, p. 96).
> - **Annexe 3, matériel** : les notas 1 à 3 du DAO routier, puis le tableau
>   `Matériel exigé · Caractéristique · Nombre · Dont en propre · Statut proposé (…) · Localisation`.
>   - « Nombre » vaut « n par lot » quand l'engin est exigé par lot.
>   - **Écart** : le tableau du DAO réel a une colonne par lot ; ici, une seule liste (maquette).
> - **Annexe 4, engagement de location** (p. 98). « vis-à-vis de la Commune Rurale de … » devient « vis-à-vis de l'autorité
>   contractante ».
> - **Liste vide** : le cadre est imprimé avec des lignes vides.

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

> ⚠️ **2026-10-17, livré côté backend (T7).**
> - **Annexe 1, liste des plans** : `N° · Titre du plan`, à partir du champ **existant** `B04-CD-03` « Plans joints au
>   dossier » (voir Q3), ou « Néant. ».
> - **Annexe 5, plannings** : les consignes du DAO routier (1. Modèles, 2. Modalités, 2-1 à 2-4), puis les modèles :
>   - **8-a**, un par lot : lignes = séries de son détail quantitatif, plus « Repli de chantier » ; colonnes = la durée du
>     délai d'exécution du lot ;
>   - **8-b**, pré-rempli avec les postes et les engins exigés ;
>   - **8-c**, avec une liste indicative (ciment, gravier, sable, moellons, fer à béton, bois de coffrage) ;
>   - **8-d**, une ligne par période et un total ;
>   - **8-e**, sur le délai de garantie `B09-GT-01`.
>
>   Les consignes du DAO réel ne donnent pas de modalités pour l'échéancier 8-d : il n'en a pas. Les modèles 8-b à 8-e sont
>   communs aux lots : le candidat y reporte son lot.
> - **Écart sur la grille.** `B09-DL-01` est un **texte libre** : la durée en est lue, par exemple « six (06) mois » → 6
>   colonnes, « 120 jours » → 4, « 2 ans » → 24 mois.
>   - Une colonne par mois jusqu'à 12 mois, par trimestre jusqu'à 36, par semestre au-delà.
>   - Une portée hebdomadaire comme celle du DAO réel (1 case = 1 semaine) ne tient pas en largeur A4.
>   - Sans durée chiffrée, la grille compte 12 colonnes mensuelles.
> - **Annexe 6, plan de charge** : le tableau du DAO routier, avec une colonne « Maître d'ouvrage », puis « NEANT » et la
>   mention de certification.
> - **Recette par Word** : une fiche de travaux à deux lots donne un DAO de 94 pages ; les grilles tiennent en largeur et le PDF
>   se relit en 12 articles sur 12.

## Hypothèses

- **H1** — Les formulaires de T5 à T7 sont des textes fixes du serveur, comme les fiches A1 à A4 du candidat. Le front les
  vérifiera par rapport à la maquette.
- **H2** — Les listes de T6 viennent des ressources déjà servies (`…/personnel`, `…/materiel`) de la **version validée**.
- **H3** — T2 vaut pour toutes les catégories. T1 (localisation), T3, T4 (structure) et T5 à T7 ne valent que pour les
  travaux, sauf le correctif de l'imputation, qui vaut partout.

> ⚠️ **2026-10-17** : H1, H2 et H3 sont tenues.
> - Les formulaires sont des textes fixes du serveur (`FormulairesTravaux`).
> - Les listes viennent de `…/personnel` et `…/materiel` de la version validée.
> - T5 à T7 ne valent qu'en travaux ; les fournitures n'en ont aucun.

## Questions

- **Q1** — La fiche ne porte aucune **localisation des travaux**. Faut-il un champ par lot (lieu, PK, coordonnées GPS de
  début et de fin), ou existe-t-il une localité de la ligne du plan qui puisse servir de reprise ?
- **Q2** — Le **marquage par astérisque** des prix à sous-détailler (T5) suppose une case « à sous-détailler » sur
  l'article du besoin. Faut-il l'ajouter, ou s'en tenir à « tous les prix d'installation de chantier et les prix que
  désigne le DPAO » ?
- **Q3** — La **liste des plans** (T7) : d'où vient-elle ? Les plans sont aujourd'hui joints au Word des spécifications
  (B2 du 06/10). Faut-il un champ « titres des plans », ou une liste vide à compléter ?

> ⚠️ **2026-10-17, propositions du backend, acceptées le même jour** (réalisation avec la tranche B) :
> - **Q1** : des champs **facultatifs par lot**, en travaux : lieu, PK et coordonnées GPS de début et de fin. Ils entrent au
>   référentiel par le CSV et un script, sans migration. Aucune localité du plan n'est utilisable telle quelle.
> - **Q2** : **rien à ajouter**. L'article du besoin porte déjà la case `sousDetail` (V59). Les prix ainsi marqués reçoivent
>   l'astérisque, en plus des prix d'installation de chantier.
> - **Q3** : un champ facultatif « titres des plans », un titre par ligne ; vide, la liste imprime « Néant ».
>
> ⚠️ **2026-10-17, livraison (tranche B)** :
> - **Q1 livré** : `B02-OT-03` (lieu), `B02-OT-04` (PK), `B02-OT-05` et `B02-OT-06` (GPS de début et de fin).
>   - Ce sont des textes facultatifs par lot, en travaux à quantité fixe et à commandes.
>   - Ils sont ajoutés au CSV des travaux et à sa copie `docs/referentiel-champs-fiche-dao-travaux.csv`, et chargés sur une
>     base existante par `docs/referentiel/2026-10-17-localisation-travaux.sql`.
>   - Leur document maître est AUCUN : seule la garde les imprime, sous l'objet ou sous la ligne du lot.
> - **Q3, écart à la proposition** : **aucun champ nouveau**. Le champ **`B04-CD-03` « Plans joints au dossier »** existait
>   déjà : facultatif, en travaux, il est déjà imprimé au CCAP-T sous « Liste des Plans ». La liste de l'annexe 1 en
>   reprend les lignes ; à saisir un titre par ligne.

## Ce que le front fera, dès la livraison

- Recette sur une fiche de travaux allotie : comparaison à la maquette, puis réimport du PDF produit dans sa propre fiche
  (articles, séries, sous-totaux exclus).
- Contrôle de T2 sur une fiche de fournitures et sur un contrat-cadre.
- Annotation de cette demande en place si la livraison s'en écarte.
