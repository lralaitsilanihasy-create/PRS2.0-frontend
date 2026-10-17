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

> ⚠️ **2026-10-16, livraison backend (B1) :** la charte est livrée sur le DAO complet. Le contrat est dans `docs/api-endpoints.md`
> du backend, § *Le DAO complet en un seul document*, encadré « la charte des DAO générés ». La mise en œuvre et les écarts :
> - **Mise en œuvre (H1)** : les parties produites par l'application n'ont pas de styles nommés, leur mise en forme est posée
>   directement. Un jeu de styles appliqué dans Word ne les aurait donc pas touchées. La charte est posée en deux temps :
>   - **avant Word**, sur chaque partie (`CharteDao`, POI) : article = paragraphe gras « ARTICLE n… », sous-article = les autres
>     sous-titres gras ;
>   - **dans Word**, pour le style Normal, les titres intégrés (titre 1 = article, titre 2 = sous-article), les marges, l'en-tête
>     et le pied.
> - **Polices de symboles** : elles gardent la leur (cases à cocher, puces en Wingdings ou Symbol), sinon leurs caractères
>   deviendraient des carrés. Une formule des IC garde Cambria Math.
> - **Capitales** : elles ne sont pas forcées sur les articles et les titres des modèles, déjà écrits en capitales. Forcer la
>   casse par la mise en forme changerait le texte que l'import relit.
> - **Tableaux des modèles** : ils reçoivent les filets noirs de 0,5 pt et des lignes insécables. En revanche, **ni en-tête
>   grisé ni première ligne répétée** : rien ne distingue leur ligne d'en-tête d'une ligne « clé / valeur ». Les tableaux du
>   besoin (B3) ont l'en-tête complet.
> - **Autres documents générés** : non traités, ils restent pour un lot distinct.

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

> ⚠️ **2026-10-16, livraison backend (B2, B5) :** livré tel que demandé, avec trois précisions.
> - La garde ne porte plus les lignes « UNITÉ DE GESTION DE LA PASSATION DES MARCHÉS », « Imputation administrative »
>   (services bénéficiaires) et « Compte ». L'**imputation budgétaire** est `B01-AC-17`. Une ligne non allotie porte « Objet : …,
>   en un lot unique », comme la maquette.
> - Une page de séparation précède chaque **section** (titre de niveau 2) ; elle rappelle la partie en cours, même quand la
>   section ne l'ouvre pas (1.2, 2.2…). Les titres de niveau 3 et 4 (« A. - Modèles… », « Lot 1 », annexes) passent sur la page
>   suivante.
> - L'emblème national reste celui de l'assemblage, centré en tête de la garde, et les séparateurs n'en ont pas.

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

> ⚠️ **2026-10-16, livraison backend (B3) :** les tableaux sont produits par le serveur (`TableauxBesoin`, POI) depuis le besoin de
> la version validée (H2), aux colonnes demandées au mot près. Les écarts :
> - **Titres au sommaire** :
>   - « Annexe 1 : Cadre du bordereau des prix » à la suite de l'acte d'engagement (après tous les lots de l'AE) ;
>   - en 2.2, « Spécifications techniques », puis « Annexe : Liste des fournitures et calendrier de livraison » ;
>   - en travaux, « Annexe : Bordereau des prix unitaires » puis « Annexe : Détail quantitatif et estimatif », à la suite de
>     l'acte d'engagement : le plan actuel des travaux n'a pas d'autre place désignée.
> - **Pas de titre en double** : le premier lot suit le titre du sommaire. Le titre propre du tableau (« ANNEXE 1 — CADRE DU
>   BORDEREAU DES PRIX »…) n'est répété qu'en tête des lots suivants.
> - **Article défini** :
>   - un petit lexique des unités courantes donne « la rame », « la boîte », « le paquet », « le rouleau », « le mètre cube »,
>     « le forfait »… ;
>   - « l' » s'emploie devant une voyelle, et « l'unité » pour une unité inconnue ou abrégée (« U ») ;
>   - en travaux, le **libellé du bordereau** (`libelleBordereau`, « Le mètre cube ») est employé quand il est saisi.
> - **Liste des fournitures** : avec un besoin, elle **remplace dans le DAO** le document `LF` actuel, qui reste produit à part.
> - **TVA** du DQE : le paramètre `FICHE_TAUX_TVA`.

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

> ⚠️ **2026-10-16, livraison backend (B4) :** les six règles sont appliquées.
> - **Règle 1** : pas de césure, et un trait d'union **entre deux lettres** devient insécable (U+2011). Le caractère change donc
>   dans le document. L'import le ramène à « - », dans le texte d'origine comme dans le texte normalisé : une valeur relue reste
>   celle de la fiche.
> - **Recette côté backend** (`DaoCompletWordTest.charte`, Word, en local) : un DAO de 40 articles sur deux lots, au bordereau
>   qui passe la page, est relu par la lecture des articles. On retrouve **40 sur 40**, avec leur lot, leur quantité et leurs
>   deux caractéristiques, et aucun écart de désignation.
> - **Reste à faire, côté front** : la relecture de **toutes les valeurs saisies** sur une fiche réelle, telle que proposée.

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

> ⚠️ **2026-10-16, livraison backend (B6) :** pas de rattrapage, donc pas de migration. Un DAO complet déjà produit est gardé.
> La charte vaut pour ceux assemblés après la livraison, y compris par le rattrapage planifié d'une version validée qui n'en a
> pas encore. Pour la recette des fiches 1 et 2, il faut donc une **nouvelle validation** (ou une révision validée).

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

## R — Recette du front, 16/10 (fiche 2, ligne 303337, contrat-cadre de fournitures)

**Déroulé.** La fiche 2 est remplie par le chemin de l'écran :
- import de son DAO de démonstration (`ExemplesDAO/DAO_CC_303337_articles_de_bureau_07-CC_2027.pdf`) : 65 valeurs
  appliquées, toutes égales à celles du DAO, et 14 articles écrits avec la trace de l'import ;
- complément des champs obligatoires que la lecture n'a pas proposés ;
- prix unitaires estimés calés sur le montant du plan (432 494 495 Ar) ;
- validation de la version 1, en 54 s, assemblage Word compris.

Le DAO complet produit (`DAO_COMPLET_00001-PPM-AGPM-CNM-2026_303337_v1.pdf`, 86 pages) a été comparé à la maquette, puis
relu par l'import.

**Ce qui est conforme.**
- **Page de garde** : emblème national, bloc de l'autorité entre tirets, « Lancé le 18/01/2027 » (`B04-CP-01`),
  « Objet : …, en un lot unique », « FINANCEMENT : RPI », « IMPUTATION BUDGETAIRE : 6111 ».
- **Séparateurs** devant chaque section : sans emblème, sans en-tête ni pied, la partie rappelée.
- **Charte du texte** : police Arial ; articles en gras sur filet ; en-tête courant et pied « page n / 86 ».
- **Tableaux du besoin** :
  - annexe 1 de l'AE (p. 47) et spécifications techniques (p. 49), aux colonnes de B3 ;
  - désignations « …, la rame à ….Ariary », « le paquet », « l'unité » ;
  - mention « Les quantités sont indicatives » ;
  - en contrat-cadre, ni liste ni calendrier.
- **Relecture (B4)** :
  - **articles** : 14 sur 14, avec unité, quantité et caractéristiques, sans écart ;
  - **champs** : 40 sur 40 au DPAC et 28 sur 28 à l'AE. Trois valeurs ne diffèrent que par le trait d'union insécable
    U+2011, que l'import du serveur ramène à « - » ;
  - **cadrage** : 11 valeurs relues ;
  - **trois valeurs non imprimées**, et c'est normal : `B02-PC-03`, `B07-DE-01` à `DE-03`, qui appartiennent à des
    sections conditionnelles inactives en marchés fractionnés ;
  - **identification de la PRMP** (`B02-SG-01` à `SG-03`) : imprimée mais non proposée par la lecture, déjà le cas sur le
    DAO de démonstration. C'est une limite de la lecture par modèle inversé, pas de la charte.

**Constats à reprendre.**

- **R1 — Le numéro du DAO d'un contrat-cadre.** La garde, l'en-tête courant et les séparateurs impriment « N° 00001/PPM-
  AGPM/CNM/2026 », c'est-à-dire la référence du plan, repli prévu quand `B02-OB-03` est vide. Or un contrat-cadre porte son
  numéro en `B02-OE-01` (« 07-CC/MEF/SG/PRMP.2027 »), que le DPAC imprime bien à la p. 31 (« NUMÉRO : … »).
  Proposition : pour un contrat-cadre, prendre `B02-OE-01`, puis `B02-OB-03`, puis la référence du plan. Le nom de fichier
  du DAO complet suit la même règle.

  > ⚠️ **2026-10-16, corrigé côté backend (R1) :** la proposition est retenue telle quelle. Pour un contrat-cadre, la garde,
  > l'en-tête courant, les séparateurs et le nom du fichier prennent `B02-OE-01`, puis `B02-OB-03`, puis la référence du plan.
  > Les autres formes sont inchangées : `B02-OB-03`, puis le plan.
- **R2 — Le pied de page est collé.** « MINISTERE DE L'ECONOMIE ET DES FINANCES — PRMPFiche v1 validée le 16/10/2026 » :
  il manque la séparation entre l'autorité et la version. La maquette en fait trois zones : gauche, centre, droite.

  > ⚠️ **2026-10-16, corrigé côté backend (R2) :** la cause, ce sont les tabulations. Avec un nom long, le texte de l'autorité
  > dépassait la tabulation centrale, et la version s'y collait. L'en-tête et le pied sont désormais des **tableaux sans filets
  > intérieurs** :
  > - en-tête : deux zones, « DAO n° … » à gauche (40 %) et l'objet à droite (60 %) ;
  > - pied : trois zones, l'autorité à gauche (42 %), la version au centre (36 %), « page n / N » à droite (22 %).
  >
  > Un nom long passe à la ligne dans sa zone. Le filet bas de l'en-tête et le filet haut du pied sont conservés.
- **R3 — Les cellules des tableaux du besoin.**
  - Le texte est **justifié** et les cellules n'ont **pas de marge intérieure**. Dans l'en-tête, on lit
    « DESIGNATION   DES   ARTICLES   ET   PRIX » collé à « UNITE », ainsi que « PROPOSITIONS        DU ». Dans le corps,
    une désignation qui passe à la ligne s'étire (« Calculatrice   de   bureau   12 ») et le texte touche les filets.
  - Charte (B1) : cellules alignées à gauche, marges intérieures de 1 mm (haut, bas) et de 1,5 mm (gauche, droite). Les
    quantités peuvent être alignées à droite.
  - La relecture n'en souffre pas (14 sur 14), c'est la lisibilité à l'impression qui est en cause.

  > ⚠️ **2026-10-16, corrigé côté backend (R3) :**
  > - **Alignement** : les cellules sont alignées à gauche, les colonnes QUANTITE, MIN et MAX à droite.
  > - **Marges intérieures** : 1 mm en haut et en bas, 1,5 mm à gauche et à droite.
  > - **Cause du justifié** : l'alignement à gauche était bien écrit, mais Word l'écartait à l'insertion. Il retire en effet une
  >   mise en forme identique au style Normal du fichier inséré, puis applique le Normal justifié du DAO. Les parties produites
  >   déclarent donc un Normal justifié, et l'alignement à gauche est conservé. Le même effet touchait les sous-titres des
  >   modèles alignés à gauche, corrigés du même coup.
  > - **Effet sur la relecture** : la marge haute a fait apparaître un cas. Sur une cellule grisée, Word ne trace pas le filet
  >   vertical dans cette marge, et la ligne d'en-tête était lue comme une seule cellule (0 article relu en recette). La lecture
  >   tolère désormais jusqu'à 6 points, selon la hauteur de la ligne, au lieu de 3. On retrouve 40 articles sur 40 au test du
  >   backend, et la parité est intacte sur les cinq DAO de la mesure.
- **R4 — Le sommaire n'a pas de section 1.3 « Formulaires de soumission ».** Le sommaire passe de 1.2 (DPAC) à 2.1. Le
  plan de l'ARMP, repris au 06/10, place les formulaires A1 à A4, C1 et C2 en 1.3. Est-ce voulu pour le contrat-cadre ?
  S'il n'a pas de formulaires, le front le note. Sinon, il faut les assembler, et le DAO de démonstration de la fiche 2 les
  porte.

  > ⚠️ **2026-10-16, corrigé côté backend (R4) : ce n'était pas voulu.** L'assemblage était juste. C'est le référentiel qui
  > limitait les deux champs déclencheurs à la quantité fixe et au marché à commandes :
  > - `B04-CD-01` : modèles de fiches de renseignements A1 à A4 ;
  > - `B04-CD-02` : modèle de garantie de soumission C1, C2.
  >
  > Un contrat-cadre ne produisait donc jamais ses formulaires. Les deux champs valent désormais aussi pour le contrat-cadre.
  > La correction touche le fichier de correspondance des travaux (commun aux trois catégories) et sa copie
  > `docs/referentiel-champs-fiche-dao-travaux.csv` du front, modifiée à l'identique. Le script est
  > `docs/referentiel/2026-10-16-formulaires-contrat-cadre.sql`, à appliquer sur DBPRS20. Les champs apparaissent au bloc B04 de
  > la fiche du contrat-cadre (document maître DPAC).
  >
  > La fiche 2, déjà validée, reste sans formulaires : il faut une **révision** qui renseigne les deux champs, puis une nouvelle
  > validation.

**Hors charte, pour information.** L'acte d'engagement (p. 38) imprime sa page de garde à plat : « Cadre réservé à
l'autorité contractante Numéro du contrat-cadre <indiquer…> » forme un paragraphe ordinaire, et non le cadre du document
type. Ce n'est pas une régression de la charte. Le front le signale seulement pour un lot de mise en page des modèles.

## R bis — Contre-recette du front, 17/10 (backend 4e071c4)

**Déroulé.**
- Révision de la fiche 2, puis renseignement de `B04-CD-01` (« A1,A2,A3,A4 ») et de `B04-CD-02` (« C1 »). Aucun point
  bloquant.
- Validation de la version 2 en 81 s.
- DAO complet produit : `DAO_COMPLET_07-CC-MEF-SG-PRMP-2027_303337_v2.pdf`, 97 pages.
- Relecture par l'import du serveur. La fiche 2 est validée et l'import y est refusé (409), comme il se doit : la relecture
  passe donc par la fiche 1, de même forme, en lecture seule.

**Résultats.**
- **R1 — corrigé.** « N° 07-CC/MEF/SG/PRMP.2027 » figure sur la garde, l'en-tête courant et les séparateurs, et dans le nom
  du fichier. Les classeurs `xlsx` gardent la référence du plan dans leur nom, ce qui n'était pas demandé.
- **R2 — corrigé.** Le pied a trois zones. L'autorité passe à la ligne dans la sienne (« … FINANCES / — PRMP »), ce qui est
  acceptable.
- **R3 — corrigé en partie.**
  - Corrigé : les marges intérieures, et les quantités alignées à droite.
  - Pas corrigé : les cellules de plusieurs lignes restent **justifiées**. On le voit dans l'en-tête du bordereau
    (« DESIGNATION   DES   ARTICLES   ET   PRIX »), dans celui des spécifications (« PROPOSITIONS      DU ») et dans les
    désignations longues (« Chemise cartonnée à rabats, le paquet à », « Calculatrice   de   bureau   12 »). Voir R5.
- **R4 — corrigé.** Le sommaire porte la 1.3 « Formulaires de soumission » : A1 à A4, B (non utilisé) et C1.
- **Relecture (B4) par l'import du serveur :**
  - **14 articles sur 14**, identiques au besoin de la fiche 2, sans écart ni anomalie ;
  - **68 valeurs proposées sur 68**, égales à celles de la fiche.
- **Prototype du front** (`scripts/import-dao/lire-specs.mjs`) aligné sur la tolérance de R3 (de 3 à 6 points selon la
  hauteur de la ligne). Il relit 14 articles sur 14 sur ce DAO. Sur les cinq DAO de la mesure, la parité est intacte :
  136 articles et les trois mêmes écarts réels.

**Deux points restants, mineurs.**
- **R5 — Le justifié dans les cellules de plusieurs lignes** (tableaux du besoin). L'alignement à gauche ne tient que sur
  les cellules d'une ligne. Proposition : poser l'alignement à gauche sur **chaque paragraphe** de la cellule, et pas
  seulement sur le premier, ou passer par un style de cellule distinct du Normal. Les tableaux des formulaires (A1-c,
  p. 39) montrent le même effet, ainsi que des cellules sans marge intérieure. Ce sont des tableaux de modèles, hors B3 :
  à traiter s'il n'y a qu'une règle à étendre.

  > ⚠️ **2026-10-17, corrigé côté backend (R5) :** l'alignement à gauche était bien posé sur chaque paragraphe de cellule. Le
  > défaut venait de mon correctif de R3 : le style Normal des parties produites était créé **sans** son alignement justifié.
  > POI recopie un style au moment de l'ajout, et l'alignement était posé après. Word continuait donc d'écarter l'alignement à
  > gauche à l'insertion. Il est maintenant posé avant l'ajout.
  > - **Formulaires et autres tableaux de modèles** : ils sont traités par la même règle étendue. Leurs cellules sont alignées à
  >   gauche explicitement, un centrage voulu par le modèle étant gardé, et reçoivent les marges intérieures de la charte
  >   (1 mm, 1,5 mm).
  > - **Vérifié dans Word**, après insertion : alignement à gauche gardé, marge de 4,25 pt. L'en-tête des spécifications
  >   (« PROPOSITIONS DU CANDIDAT ») n'est plus étiré.
  > - **Relecture inchangée** : 40 articles sur 40 au test du backend, parité intacte sur les cinq DAO réels.
- **R6 — Le numéro de l'appel d'offres dans les formulaires.** La fiche A1-c (p. 39) imprime « No. d'appel d'offres et
  titre : ……… — Fourniture d'articles de bureau (CONTRAT - CADRE) ». Le titre est rempli, mais pas le numéro, alors qu'il
  est connu. Proposition : le numéro de R1 (`B02-OE-01` en contrat-cadre, sinon `B02-OB-03`).

  > ⚠️ **2026-10-17, corrigé côté backend (R6) :** la proposition est retenue, au rendu des jetons. Pour un contrat-cadre, le
  > jeton `{{B02-OB-03}}` vide prend la valeur de `B02-OE-01`. La règle vaut pour les formulaires A1 et A3 (« No. d'appel
  > d'offres et titre ») et pour tout modèle qui cite ce jeton. Les autres formes gardent `B02-OB-03`.
  >
  > Les modèles `modeles/candidat/*.txt`, copies de ceux du front, **ne changent pas**. Le moteur de rendu du front, contrôlé
  > par `verifier.mjs`, doit appliquer la même règle pour rester identique sur un contrat-cadre.

## R ter — Contre-recette de R5 et R6, 17/10 (backend 80f4595) : demande close

Fiche 2 révisée, puis version 3 validée en 80 s. DAO complet de 98 pages
(`DAO_COMPLET_07-CC-MEF-SG-PRMP-2027_303337_v3.pdf`).

- **R5 — corrigé.** Les cellules de plusieurs lignes sont alignées à gauche et gardent leurs marges intérieures : l'en-tête
  du bordereau, l'en-tête des spécifications, les désignations longues. Les tableaux des formulaires (A1-c, p. 39) le
  sont aussi.
- **R6 — corrigé.** « No. d'appel d'offres et titre : 07-CC/MEF/SG/PRMP.2027 — Fourniture d'articles de bureau (CONTRAT -
  CADRE) » apparaît dans les trois formulaires qui le citent.
- **Relecture par l'import du serveur** : 14 articles sur 14, identiques au besoin, et 68 valeurs proposées sur 68, égales à
  celles de la fiche. Le prototype du front relit lui aussi 14 articles sur 14.
- **Côté front, la règle de R6** :
  - les deux `verifier.mjs` (`scripts/modeles-dao`, `scripts/modeles-candidat`) jugent un rendu **brut**, sans substituer
    les jetons : la règle ne peut pas les faire diverger ;
  - le seul affichage du numéro par le front, l'en-tête des écrans de procédure (`entete-procedure.ts`), applique désormais
    la même règle : pour un contrat-cadre, `B02-OE-01`, puis `B02-OB-03`, puis la référence du plan
    (`numeroProcedure`, avec son test).
