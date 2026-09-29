# Plan — 2026-09-29 — Lot D3 : import (PDF) des DAO de prestations intellectuelles

**Statut : proposition du front, rien de codé. À arbitrer par le pilote (§6).** Analyse détaillée, ligne par ligne :
`docs/analyse-2026-09-29-documents-types-pi.md`.

> ⚠️ **Arbitrage du pilote, 2026-09-29 — les trois recommandations retenues ; PI-0 lancé.** Q1 : le DPIC produit est
> **le tableau seul**. Q3 : **les cinq totaux + trois champs** (score technique minimum, poids T, poids F), le détail
> de la grille en blanc visible. Q14 : **décalque fidèle**, coquilles listées pour le juriste. Les douze autres
> questions suivent la recommandation par défaut, à revoir à la relecture des décalques.
>
> ⚠️ **PI-0 livré côté front le 2026-09-29.** `DPIC-PI` (33 conditions, 230/230), `AE-PI` (17, 300/300), `CPS-PI` (30,
> 238/238) dans `scripts/modeles-dao/` ; décalques dans `docs/modeles-dao/`. Import mesuré sur un banc synthétique
> (`scripts/import-dao/banc.mjs`, les fiches de recette ayant disparu avec le vidage) : DPIC 96 %, AE 100 %, CPS 65-77 %,
> critère Q10 tenu sans bruit et sur douze graines. La mesure a fait ajouter **trois règles de lecture** (valables pour
> tous les modèles) et retirer un paragraphe réduit à « d) ». **Correction du §2, point 4** : la formule en `}}` ne gêne
> pas le moteur (le motif des jetons exige `{{`) — aucune extension n'est nécessaire. Le lieu d'exécution s'écrit dans
> l'objet (un champ de moins). Demande PI-1 : `docs/demande-backend-2026-09-29-lot-d3-prestations-intellectuelles.md`
> (sept champs à créer, sept corrections, dont l'option du mode de sélection coupée par sa virgule ; seize champs dont
> le retrait attend le pilote).

## 1. Ce que demande l'import d'un DAO de PI

L'import ne lit pas un DAO « au hasard » : il le compare **au document type officiel décrit en modèle à trous** (lot D)
et ne propose que ce que le texte fixe encadre. Le lecteur PDF existe déjà, et l'écran comme le serveur s'ouvrent
d'eux-mêmes aux formes décrites. **Importer un DAO de PI, c'est donc d'abord décrire ses trois documents types**,
comme on l'a fait pour le contrat-cadre (D1) et les fournitures (D2). Une fois les modèles décrits, deux gains
arrivent ensemble :

- **le DAO produit** par l'application pour une fiche PI devient le document type ARMP rempli (au lieu des listes
  « libellé : valeur » du lot 2a) ;
- **l'import** (Word ou PDF) d'un DAO de PI propose de pré-remplir la fiche, avec les mêmes garde-fous qu'ailleurs
  (rien de faux coché d'office, la PRMP retient ligne par ligne).

Documents remis par le pilote (`Documents Types/Prestations_Intellectuelles/`) — même découpage que les fournitures :

| n° | document | traitement |
|---|---|---|
| 1 | Instructions aux candidats (IC) | **joint tel quel** (texte fixe, comme aux fournitures) |
| 2 | Données particulières des IC (**DPIC**) | **à décrire** — le document de consultation des PI |
| 3 | Formulaire type de soumission | rempli par le candidat — hors lot |
| 4 | Acte d'engagement (**AE**) | **à décrire** |
| 5 | Cahier des prescriptions spéciales (**CPS**, rôle du CCAP) | **à décrire** |
| 6 | CCAG | joint tel quel |

## 2. Ce que disent les trois documents (analyse du 29/09)

| | DPIC | AE | CPS | total |
|---|---|---|---|---|
| trous de l'acheteur | 94 | 21 | 50 | **165** |
| — rapprochés d'un champ de la fiche, sûrement | 55 | 5 | 16 | **76** |
| — probablement (à confirmer en décrivant) | 15 | 5 | 14 | **34** |
| — sans champ | 24 | 11 | 20 | **55** |
| points de choix (rédactions au choix) | 25 | 16 | 24 | **65** |

Constats qui pèsent sur le plan :

1. **Le fichier « DPIC » contient toute la première partie** : page de garde, lettre d'invitation, les IC complètes,
   puis le tableau des données particulières (25 rangées). Seul le tableau est propre à chaque consultation.
2. **La grille de notation** (DPIC 9.3) concentre 17 des 55 trous sans champ : sous-critères, postes du personnel clé,
   sous-pondérations — une liste **de longueur variable** que la fiche ne sait pas porter aujourd'hui (elle n'a que
   les cinq totaux `B06-TP-02` à `-06`). Le score technique minimum et les poids **T** et **F** n'ont pas de champ non
   plus.
3. **L'AE est un cadre** : en PI, le Client le prépare **après la négociation** (IC 10.3). Au stade du dossier, les
   montants et l'identité du titulaire restent en blanc — comme les blancs du candidat aux fournitures.
4. **Le CPS écrit une formule qui finit par `}}`** (révision des prix, l. 427) : le moteur la lirait comme une fin de
   jeton. Il faut un échappement — **seule extension du moteur indispensable** au premier lot.
5. Le référentiel PI (107 champs) a des **champs inadaptés** au texte officiel (langue, heure limite en `DATE`,
   intérêts moratoires en % au lieu de points, forme du groupement, plafond de pénalités à 10 % en PI contre un contrôle
   nommé `PENALITES_PLAFOND_15`) et **10 champs sans place** dans aucun des trois documents.

## 3. Ce qu'attendre de l'import

Même règle que pour les fournitures, mesurée le 29/09 :

| DAO importé | valeurs retrouvées (attendu) | valeurs fausses cochées d'office |
|---|---|---|
| PDF ou Word produit par l'application | ~90 % des trous décrits | aucune (critère Q10) |
| vrai DAO resté proche du document type | élevé | aucune |
| vrai DAO **rédigé librement** (comme le 2463) | faible | aucune |

Propre aux PI, l'import aura du mal avec la grille de notation (postes et sous-critères inventés par l'acheteur,
alignés par espaces), les adresses en cinq ou six morceaux, et les formules aux coefficients modifiés. Ces trous-là
restent **proposés « à vérifier » ou non lus**, jamais cochés d'office. La lecture « par clause » (en attente de
décision) aiderait ici comme ailleurs.

## 4. Découpage proposé

| lot | contenu | qui | dépend de |
|---|---|---|---|
| **PI-0** | Décrire `DPIC-PI` (le tableau des données particulières), `AE-PI` (cadre), `CPS-PI` (21 articles + annexes) dans `scripts/modeles-dao/` : texte fixe jamais retapé, les 76 trous sûrs et les 65 choix, les instructions retirées avec leur raison ; **les trous sans champ restent en blanc visible** (« <…> »), à compléter à la main comme aujourd'hui. Fidélité vérifiée (`verifier.mjs`). Mesure de l'import sur le rendu (aller-retour, bruit), critère Q10. | front | Q1, Q3, Q14 |
| **PI-1** | Backend : recopie des trois modèles ; `ModelesDao.COUVERTURES` pour PI (quantité fixe et à commande) ; **échappement des accolades** (formule du CPS) ; production des trois documents ; `LectureDao` inchangée. Référentiel : les corrections et champs décidés en §6. | backend | PI-0 |
| **PI-2** | Front : ouvrir l'import à la catégorie PI (une ligne : `CATEGORIES_IMPORTABLES`) ; contre-recette sur un PDF produit par l'application. | front | PI-1 |
| PI-3 | Plus tard, selon décision : la **grille de notation en tableau** (répétition de longueur variable dans le moteur, contrôles de somme = 100) ; la **lettre d'invitation** et la liste restreinte. | front + backend | Q2, Q3 |

PI-0 à PI-2 donnent des DAO de PI produits au format officiel et leur import (Word et PDF), sans toucher au moteur
au-delà de l'échappement. PI-3 est la vraie extension, à ne lancer que si la Commission en a besoin.

## 5. Ce qui n'est pas dans ce lot

- **Travaux** : leurs documents types ne sont pas remis (même démarche dès qu'ils le seront).
- **Contrat-cadre de PI** : il n'existe pas au référentiel.
- Sélection **fondée sur les qualifications** et **consultant individuel** : le document type ne les couvre pas.
- **Termes de référence** : le CPS les réduit à une instruction ; ils restent une pièce de l'acheteur (Q11).

## 6. Questions au pilote

Les trois premières conditionnent PI-0 ; les autres peuvent suivre la recommandation par défaut et être revues à la
relecture des décalques.

| # | Question | Recommandation |
|---|---|---|
| **Q1** | Le DPIC produit : seulement le tableau des données particulières, ou aussi la page de garde et la lettre d'invitation ? | **Le tableau seul** (les IC jointes telles quelles, comme aux fournitures). La lettre d'invitation suppose la liste restreinte : PI-3. |
| **Q3** | Grille de notation : champ tableau (sous-critères, postes, sous-pondérations) ou les cinq totaux actuels ? | **Les cinq totaux** en PI-0, le détail en blanc visible ; **créer trois champs simples** : score technique minimum, poids T, poids F (décimaux). Le tableau : PI-3 si la Commission le demande. |
| **Q14** | Coquilles du document officiel (« clause 6.2.1 des DPIC », « DPAO », « article 160 du CCAG », « travaux » dans un CPS de PI…) : décalque fidèle ou corrigé ? | **Fidèle**, comme pour D1/D2 (on ne retouche pas un texte officiel), avec la liste des coquilles transmise au **juriste**. |
| Q2 | Liste restreinte et manifestation d'intérêt : où saisir les consultants invités ? | Hors PI-0 (PI-3). |
| Q4 | « Qualité technique seule » implique « proposition technique seule » : déduire ou demander deux fois ? `B05-PF-02` (montant du forfait) vaut-il budget disponible en sélection à budget déterminé ? | **Déduire** (une seule question) ; un champ **« Budget disponible »** distinct, posé seulement pour ce mode. |
| Q5 | Groupement : la forme imposée par le CPS (solidaires / conjoints) ne correspond pas aux valeurs du cadrage. | À trancher **avec le juriste**. |
| Q6 | Langue : ajouter « une autre langue que le français » à `B04-LP-01` ? | Oui. |
| Q7 | Pénalités : `B09-PP-01` ou le cadrage `penalites` ? Plafond PI à 10 %. | Le **cadrage** (comme ailleurs), `B09-PP-01` retiré ; le contrôle du plafond **par catégorie** (10 % en PI). |
| Q8 | Assurances (un montant pour quatre couvertures), avance en devises, intérêts moratoires (taux ou points) ? | Intérêts moratoires **en points** (comme le texte) ; le reste en blanc visible en PI-0. |
| Q9 | Art. 14 du CPS (matériel, texte de fournitures) ? | L'imprimer **seulement si** du matériel est confié au consultant (`B09-FC-01` réactivé). |
| Q10 | Contentieux : seul l'arbitrage CNUDCI est prévu ; ajouter « tribunaux malgaches » ? | À trancher **avec le juriste**. |
| Q11 | Termes de référence : pièce, champ, ou hors document ? | **Pièce** téléversée par l'acheteur, hors document produit. |
| Q12 | Les blancs du candidat dans l'AE (8 champs de la fiche les visent) ? | En blanc au stade du dossier, comme aux fournitures ; les 8 champs suivent la règle déjà arbitrée pour les fournitures (retrait s'ils ne servent à aucun contrôle). |
| Q13 | Champs manquants simples (délai de réponse de la PRMP, lieu d'exécution, délai de vérification, date des négociations…) ? | **Créer** ceux que le DPIC et le CPS impriment ; le reste en blanc. |
| Q15 | `B04-LH-02` (heure limite) en `DATE_HEURE` ? | Oui : le texte exige l'heure. |

## 7. Ce que le pilote rend

Un « oui » (ou ses corrections) sur Q1, Q3 et Q14 suffit à lancer PI-0. Les autres questions sont reprises dans la
demande au backend de PI-1, qui partira avec les modèles décrits.
