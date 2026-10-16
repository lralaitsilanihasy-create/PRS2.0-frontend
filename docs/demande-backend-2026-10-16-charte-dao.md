# Demande backend — 2026-10-16 — Une charte unique pour les DAO générés

## Contexte

Le DAO complet (demande du 06/10, V73-V75, assemblage par Word) a le **plan** des DAO réels : page de garde, sommaire
général, 1.1 à 1.3, 2.1 à 2.3, instructions aux candidats et CCAG reproduits. Il n'a pas encore leur **présentation** :

- **Chaque partie garde la mise en forme de son document d'origine** : le règlement, l'acte d'engagement, l'IC et le CCAG
  n'ont ni la même police ni les mêmes titres (constat de la livraison du 06/10, B1 : « les styles des fichiers Word de
  l'ARMP ne sont pas encore appliqués aux parties produites »). Le dossier change d'aspect d'une partie à l'autre.
- **Le besoin n'est pas imprimé.** Le bordereau des prix, le DQE et le tableau de conformité sont des classeurs `xlsx` à
  part ; les spécifications techniques n'existent dans le DAO que si la PRMP a joint un Word (B2 du 06/10). Un DAO produit
  par l'application puis relu par l'import (demande « import-specifications » du 16/10) ne rend donc **aucun article**.

Le front a comparé les documents types de l'ARMP, les DAO réels du MEF (6114, 6213) et celui de PAOSITRA (297), puis
générés deux DAO de démonstration sur ce modèle (`Documents Types/Fournitures et services/ExemplesDAO/`, fiches 1 et 2).
Ces deux DAO sont **relus juste** par l'import : 40/40 et 28 à 32 champs sur l'acte d'engagement, et 12 et 14 articles sur
12 et 14.

**Maquette** : `docs/maquette-2026-10-16-charte-dao.html`, dix feuilles A4 annotées : garde, sommaire, séparateur, page
courante, bordereau, spécifications, liste et calendrier, ligne allotie, DQE de travaux, récapitulatif de la charte.

## Arbitrages du pilote (16/10)

1. **Police : Arial**, pour tout le dossier, comme dans les DAO réels du MEF et de PAOSITRA.
2. **Instructions aux candidats et CCAG reproduits en entier** : c'est déjà le cas, rien ne change.
3. **Les tableaux du besoin sont imprimés dans le document**, en plus des classeurs `xlsx`, qui restent fournis.
4. **L'emblème est l'emblème national**, le même pour toutes les autorités : celui que le DAO complet imprime déjà
   (`/modeles/images/embleme.png`). Aucun emblème propre à une autorité ou à un ministère.
5. **Travaux : deux tableaux**, le bordereau des prix unitaires puis le détail quantitatif et estimatif (B3).
6. **Destination et délai de livraison : aucun champ nouveau.** Ils viennent des champs existants en appel d'offres de
   fournitures ; le contrat-cadre n'imprime pas de liste ni de calendrier, sauf un cas (B3).

**Règle de fond, inchangée** : le **texte** des documents types et son ordre ne bougent pas. Il a une valeur juridique,
et c'est lui que l'import relit. Seule la présentation change.

## B1 — La charte typographique, appliquée à toutes les parties

Ces valeurs sont aussi celles de la feuille 10 de la maquette.

| Élément | Règle |
|---|---|
| Police | Arial (repli Liberation Sans), noir seul |
| Corps | 10,5 pt, justifié, interligne 1,3, 1,8 mm après chaque paragraphe |
| Marges | haut 22 mm, droite 20 mm, bas 20 mm, gauche 24 mm |
| Partie | 13 pt, gras, capitales, centré |
| Section (1.1 … 2.3) | 12 pt, gras, centré, sur la page de séparation (B2) |
| Article | 11 pt, gras, capitales, filet bas de 0,5 pt |
| Sous-article | 10,5 pt, gras, souligné |
| Tableau | 9,5 pt, filets de 0,5 pt, en-tête gras sur fond gris #E3E3E3, **répété sur chaque page** ; une ligne ne se coupe jamais |
| En-tête courant | 8,5 pt : « DAO n° … » à gauche (le numéro déjà imprimé aujourd'hui, `B02-OB-03`), objet à droite, filet bas |
| Pied courant | 8,5 pt : autorité et PRMP, « Fiche v{n} validée le {date} », « page n / N » (numérotation continue) |

- **Périmètre** : toutes les parties produites (DPAO, DPAC, DPIC, AE, CCAP, CPS, formulaires) et les textes fixes (IC,
  CCAG). Le Word joint par la PRMP (B2 du 06/10) garde son contenu, mais ses styles homonymes sont ramenés à la charte,
  comme c'est déjà la règle.
- **Proposition de mise en œuvre** (à l'appréciation du backend) : un jeu de styles nommés (« Corps DAO », « Article DAO »,
  « Sous-article DAO », « Tableau DAO »…) appliqué après chaque `InsertFile` dans `assembler-dao.ps1`, en faisant
  correspondre les styles des documents types à ceux-là. On évite ainsi de retoucher les modèles un par un.
- **Même charte pour les autres documents générés** de la fiche et de la procédure : avis spécifique, lettres d'invitation,
  projet de marché, marchés subséquents. Ils peuvent passer dans un second temps, comme lot distinct.

## B2 — Page de garde et pages de séparation

- **Page de garde** (feuille 1) : de haut en bas, l'emblème national (B5), le bloc de l'autorité centré, en capitales et séparé
  par des tirets (ministère, entité, PRMP), « DOSSIER D'APPEL D'OFFRES {mode} », « N° … », « Lancé le … », l'objet suivi
  des lots, puis « FINANCEMENT » et « IMPUTATION BUDGETAIRE » à gauche. Ni en-tête ni pied.
  Différence avec l'existant : l'**imputation** (comptes budgétaires du plan, `B01-AC-17`) s'ajoute, et la date imprimée est celle de lancement
  (`B04-CP-01`) quand elle est saisie, à défaut celle de validation.
- **Une page de séparation devant chaque section du sommaire** (feuille 3), comme dans les DAO réels : le bloc de l'autorité,
  « DOSSIER D'APPEL D'OFFRES … », le n°, « Lancé le », l'objet, puis l'intitulé de la partie et celui de la section. Ni
  en-tête ni pied. Les titres « Partie DAO 1 » à « Partie DAO 4 » que lit le sommaire restent posés sur cette page.
- Le sommaire général ne change pas (V74), sauf qu'il gagne les entrées des tableaux de B3.

## B3 — Les tableaux du besoin, générés depuis le bloc B12

Ils sont générés depuis `GET …/articles`, **un tableau par lot** dans l'ordre des lots du plan. Chaque lot commence sur
une nouvelle page, sous le titre « Lot k : {intitulé au plan} ». Sur une ligne non allotie, le tableau n'a pas de titre de
lot. Les intitulés de colonnes sont **fixes**, au mot près, parce que l'import les reconnaît (B4).

| Tableau | Place au sommaire | Colonnes |
|---|---|---|
| **Cadre du bordereau des prix** (fournitures, services) | 2.1, Annexe 1 de l'AE | N° · DESIGNATION DES ARTICLES ET PRIX UNITAIRE EN TOUTES LETTRES · UNITE · QUANTITE · PRIX UNITAIRE · MONTANT EN ARIARY |
| **Spécifications techniques** (fournitures, services) | 2.2 | N° · DESIGNATIONS · SPECIFICATIONS MINIMUMS REQUISES · PROPOSITIONS DU CANDIDAT |
| **Liste des fournitures et calendrier de livraison** (fournitures ; contrat-cadre : voir plus bas) | 2.2, annexe aux spécifications | N° · Fournitures · Destination finale · Délai de livraison au plus tard · Délai offert par le candidat |
| **Bordereau des prix unitaires** (travaux) | à sa place dans le document type des travaux | N° prix · DESIGNATION DES OUVRAGES ET PRIX UNITAIRE EN TOUTES LETTRES · UNITE · PRIX UNITAIRE EN CHIFFRES |
| **Détail quantitatif et estimatif** (travaux) | à sa place dans le document type des travaux, après le bordereau | N° prix · DESIGNATION DES OUVRAGES · UNITE · QUANTITE · PRIX UNITAIRE · MONTANT EN ARIARY |

Règles de contenu :

- **Désignation au bordereau** : « {désignation}, {article défini} {unité} à ….Ariary ». Exemples : « la rame », « la boîte »,
  « le paquet », « le rouleau », et « l'unité » par défaut.
- **Quantité** : `quantite` ; pour un marché à commandes, deux colonnes **MIN** et **MAX** remplacent QUANTITE, à partir de
  `quantiteMin` et `quantiteMax`. Les colonnes de prix et de montant restent vides : c'est au candidat de les remplir.
- **Une caractéristique par ligne**, au format « {libelle} : {exigence} ». La colonne du candidat reste vide.
- **Travaux** : lignes de série (`serie`, `serieLibelle`, par exemple 000 INSTALLATION DE CHANTIER) en gras sur fond gris,
  **sans unité** ; `numeroPrix` dans la première colonne ; lignes de total HT, TVA et TTC en bas du DQE.
- **Liste des fournitures et calendrier de livraison** — sources, sans champ nouveau (arbitrage du pilote du 16/10) :
  - **appel d'offres de fournitures, à quantité fixe ou à commandes** : destination finale = `B09-LL-01` (« Lieu de
    livraison », saisi par lot, déjà imprimé dans le DPAO § 6.6 et le CCAP) ; délai au plus tard = `B09-DX-01` jours
    (« Délai d'exécution », déjà imprimé dans le CCAP), écrit « {n} jours à compter du lendemain de la notification de l'ordre
    de service ». Chaque article du lot reprend ces deux valeurs ;
  - **contrat-cadre** : le tableau **n'est pas produit**. Le modèle AE-CC ne porte aucun lieu de livraison, et il renvoie les
    quantités, les lieux et les délais à chaque bon de commande ou marché subséquent (`B07-TN`) ;
  - **une exception** : contrat-cadre à marchés subséquents **uniques non fractionnés** dont le délai est **fixé par
    l'autorité contractante** (condition `DELAI-AC` de l'AE-CC). Le tableau est alors produit, avec « Fixée par chaque
    marché subséquent » en destination et `B07-DE-02` en délai.
- **Travaux : deux tableaux** (arbitrage du pilote du 16/10), comme le document type : le **bordereau des prix unitaires**
  porte le prix en lettres (« {désignation}, {article défini} {unité} à ….Ariary »), sans quantité ; le **DQE** reprend les mêmes
  n° de prix et désignations, avec la quantité et le montant. Les deux tableaux ont les mêmes lignes de série.
- **Pied du bordereau** : « Arrêté le montant du marché à la somme de … », « Fait à …, le … », « Le candidat ». Pour un
  contrat-cadre, la mention « Les quantités sont indicatives » s'ajoute.
- **Un Word de spécifications joint par la PRMP** (B2 du 06/10) se place **après** le tableau des spécifications : il le
  complète, il ne le remplace pas.
- **Besoin vide** : les tableaux ne sont pas produits. L'avertissement actuel du bloc B12 (« le besoin n'a aucun article »)
  suffit.

## B4 — Règles de lisibilité à la relecture

Ces règles viennent de la mise au point de la lecture sur les cinq DAO réels et les deux DAO de démonstration. Si elles
manquent, le DAO de l'application ne se réimporte plus, ou se réimporte mal.

1. **Aucune coupure de mot** : pas de césure automatique, et un mot à trait d'union ne se coupe pas en fin de ligne.
   Sinon, « mono-⏎attributaire » se relit « monoattributaire » et le paragraphe n'est plus reconnu.
2. **Un paragraphe ne se coupe pas entre deux pages** (« lignes solidaires ») : la lecture ne recolle pas un paragraphe
   d'une page sur l'autre.
3. **Une ligne de tableau ne se coupe pas entre deux pages**, et l'en-tête du tableau est répété : la lecture rattache
   ainsi la suite au même tableau.
4. **Les intitulés de colonnes de B3, au mot près.**
5. **Une caractéristique par ligne de cellule**, « Libellé : exigence » : une exigence en prose qui passe à la ligne
   se relit en deux morceaux.
6. **L'en-tête et le pied courants ne reprennent pas une ligne du corps** : une ligne répétée au même endroit sur
   plusieurs pages est écartée comme en-tête courant.

Contrôle proposé, en recette : passer le PDF produit dans l'import de sa propre fiche. Il doit retrouver toutes les
valeurs saisies et tous les articles du besoin.

## B5 — L'emblème national, inchangé

- La page de garde garde l'**emblème national** déjà posé par l'assemblage (`/modeles/images/embleme.png`), centré
  au-dessus du bloc de l'autorité. Il n'y a **ni dépôt ni emblème par autorité** (arbitrage du pilote du 16/10).
- Les pages de séparation (B2) ne portent pas d'emblème. L'avis spécifique, les lettres d'invitation et le projet de
  marché, quand ils passeront à la charte (B1), portent le même emblème national.
- Rien à développer ici, sauf le placement de l'emblème dans la nouvelle page de garde.

## B6 — Rien ne change pour les versions déjà validées

La charte s'applique aux DAO complets produits **après** la livraison, comme pour V74. Une version déjà validée garde son
DAO, sauf si le backend choisit de relancer sa production, comme il l'a fait le 06/10. Le front n'a pas besoin de ce
rattrapage.

## Hypothèses

- **H1** — Le jeu de styles (B1) s'applique dans l'assemblage Word, sans modifier les modèles `.docx` un par un.
- **H2** — Les tableaux de B3 sont produits par le serveur (POI ou Word), à partir du besoin de la **version validée**,
  comme le reste du DAO complet.

## Questions

Aucune : les questions Q1 (destination et délai), Q2 (tableaux de travaux) et Q3 (emblème) ont été tranchées par le
pilote le 16/10, avant l'envoi (arbitrages 4 à 6).

## Ce que le front fera, dès la livraison

- Recette des fiches 1 et 2, plus une fiche allotie et une fiche de travaux : comparaison à la maquette, puis réimport du
  PDF produit dans sa propre fiche (contrôle de B4).
- Annotation de cette demande en place si la livraison s'en écarte.
