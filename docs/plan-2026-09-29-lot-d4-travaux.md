# Plan — 2026-09-29 — Lot D4 : la fiche DAO des travaux au format officiel (documents produits et import)

**Statut : proposition du front, rien de codé. À arbitrer par le pilote (§6).** Analyse ligne par ligne :
`docs/analyse-2026-09-29-documents-types-travaux.md` (parties A : DPAO et AE, B : CCAP, C : contrat-cadre).

> ⚠️ **Arbitrage du pilote, 2026-09-29 — les quatre recommandations retenues ; T-0 et T-2 lancés.** Q1 : les codes du
> contrat-cadre de travaux sont **harmonisés** sur ceux du contrat-cadre de fournitures (une seule description). Q2 : les
> deux délais d'affermissement sont créés. Q3 : les tranches sont communes à tous les lots. Q5 : décalque fidèle,
> coquilles listées pour le juriste. Les autres questions suivent la recommandation par défaut.
>
> ⚠️ **T-0 et la part front de T-2 livrés le 2026-09-29.** `DPAO-T` (34 conditions, 247/247), `AE-T` (30, 363/363),
> `CCAP-T` avec ses six annexes (70, 570/570) ; `DPAC-CC` et `AE-CC` choisissent désormais « CCAG Travaux » par la
> catégorie (179/179, 408/408). Import mesuré au banc : DPAO-T 92-93 %, AE-T 100 %, CCAP-T 56-68 %, **aucune fausse valeur
> haute** (sans bruit, huit graines). Demande backend T-1/T-2 : `docs/demande-backend-2026-09-29-lot-d4-travaux.md`
> (six champs et deux options à créer, corrections du référentiel, harmonisation des codes du contrat-cadre).

## 1. Ce qui existe, ce qui manque

La fiche DAO des travaux existe depuis le 24/09, tirée du classeur `NatureMarches/DAO_Travaux.xlsx`, et **distingue déjà
les deux cas** des deux feuilles du classeur :

| feuille du classeur | fiche DAO | champs servis | documents produits |
|---|---|---|---|
| « A tranche_Alloti » | **marché ordinaire de travaux** ; tranches et lots sont des réponses de cadrage | 183 | DPAO, AE, CCAP |
| « Contrat-cadre » | **contrat-cadre de travaux** | 158 | DPAC, AE (qui porte les clauses) — pas de CCAP |

Ce qui manque, comme hier pour les prestations intellectuelles : des documents produits **au format du document type
ARMP** (aujourd'hui des listes « libellé : valeur ») et **l'import** d'un DAO de travaux (Word ou PDF).

## 2. Ce que disent les documents

### Le marché ordinaire — les documents types déposés (`Documents Types/Travaux/`)

| | DPAO | AE | CCAP | total |
|---|---|---|---|---|
| trous de l'acheteur, rattachés sûrement | 28 | 8 | ≈ 45 | ≈ 81 |
| — probablement | 19 | 7 | ≈ 28 | ≈ 54 |
| — sans champ | 14 | 17 (dont 11 numéros d'annexe ou de tranche, dérivables) | ≥ 13 | ≈ 44 |
| rédactions au choix | 30 | 21 | ≈ 40 | ≈ 91 |

Les instructions aux candidats (doc 1) et le CCAG (doc 6) se joignent tels quels ; le formulaire de soumission (doc 3)
est au candidat.

Constats qui pèsent sur le plan :

1. **Les six « formulaires à remplir » attendus depuis le 24/09 sont dans le CCAP officiel**, en annexes : formule de
   révision, garantie bancaire et caution de bonne exécution, garantie bancaire et caution de restitution d'avance,
   cadre du bordereau des prix et du détail quantitatif. Le CCAP produit les contiendra, chacune sous sa condition
   (révision, forme de la garantie, avance) : les six champs `PIECE` (`B11-FR-01` à `-06`) n'attendent plus de modèle.
2. **Les tranches ne demandent pas d'extension du moteur** : le modèle officiel s'arrête à une tranche ferme et deux
   conditionnelles, qui ont déjà chacune leur champ (`B02-LT-03` à `-05`). Il manque seulement **les deux délais
   d'affermissement** des tranches conditionnelles. Les lots, eux, ont déjà `.parLot`.
3. **Le travail est le plus gros du lot D** (CCAP de 999 lignes, 32 articles, 6 annexes) et le plus piégeux pour l'import :
   neuf « Non applicable » identiques, des blocs de tranches identiques mot pour mot dans l'AE, des paragraphes qui se
   réduisent à « le » ou « 2° - » une fois l'instruction retirée. Les règles de lecture ajoutées le 29/09 (jumeaux,
   coupe, paragraphes réduits) couvrent ces cas ; le banc synthétique le mesurera.
4. **Défauts du référentiel relevés** (à corriger au backend) : la condition de `B02-LT-01` (projet global) est
   **inversée** (`alloti = NON`, alors que le DPAO ne l'emploie qu'en allotissement) ; `B04-OV-02` est une `DATE` alors
   que le texte exige l'heure ; `B09-DT-01` n'a pas l'option « ordre de service de commencer les travaux » ; deux
   doublons (préférence nationale `B03-QT-11` / `B06-PN-01` ; imputation `B02-MW-03` / `B01-AC-17`) ; une douzaine de
   champs maîtres « AE » sont en fait des données du candidat ; quelques champs sans place (`B08-MO-01`, `B10-RE-01`…).
5. **Quantité fixe et à commande ont le même référentiel** pour les travaux : le document type n'a pas de variante « à
   commande ». Un seul jeu de modèles sert les deux.

### Le contrat-cadre de travaux — le document type du contrat-cadre, déjà décrit

Il n'y a **pas** de document type propre, et il n'en faut pas : le document type « Contrat-cadre — Fournitures &
Prestations de services » prévoit lui-même les travaux, à **sept** endroits, par des choix « CCAG Fournitures / CCAG
Travaux <choisir> » (CCAG applicable, pénalités, sous-traitance, vérifications, garantie, résiliation). Les modèles
`DPAC-CC` et `AE-CC` ont gardé la mention des fournitures sans condition : il suffit de la conditionner à la catégorie.

**Mais les codes diffèrent** : la conversion du 24/09, faite avant l'axe des catégories, a recodé le contrat-cadre de
travaux (`B04-CP-*` → `B04-CT-*`, `B02-SG-*` → `B02-SW-*`, `B08-FP-*` → `B08-FT-*`…). Sur les 88 champs des modèles :
**15 même code, 47 même libellé sous un autre code, 15 douteux, 11 sans équivalent** (surtout les champs ajoutés au
contrat-cadre des fournitures le 28/09 : reconduction, préavis, fautes ouvrant la résiliation…).

## 3. Ce qu'attendre de l'import

Même règle qu'ailleurs : un DAO produit par l'application ou resté proche du document type se lit bien ; un DAO
rédigé librement se lit peu ; **aucune valeur fausse n'est jamais cochée d'office** (critère Q10, mesuré au banc).

## 4. Découpage proposé

| lot | contenu | qui | dépend de |
|---|---|---|---|
| **T-0** | Décrire `DPAO-T`, `AE-T`, `CCAP-T` (avec ses six annexes) dans `scripts/modeles-dao/` ; trous sans champ en blanc visible ; fidélité vérifiée ; mesure au banc (sans bruit et bruité). | front | Q2, Q3, Q5 |
| **T-1** | Backend : recopie, `ModelesDao.COUVERTURES` (travaux, quantité fixe et à commande), production des trois documents ; corrections du référentiel (§2, point 4) et champs décidés en §6. | backend | T-0 |
| **T-2** | Contrat-cadre de travaux : les sept choix « CCAG Travaux » conditionnés à la catégorie dans `DPAC-CC` / `AE-CC` (front) ; **harmonisation des codes** du référentiel (backend, Q1) ; les 11 champs sans équivalent créés pour les travaux. | front + backend | Q1 |
| **T-3** | Ouvrir l'import aux travaux (une ligne, `IMPORTABLES`) ; contre-recette sur un PDF produit. | front | T-1, T-2 |

## 5. Ce qui n'est pas dans ce lot

- Les **spécifications techniques** et le **bordereau rempli** : pièces de l'acheteur (le CCAP n'en donne que le cadre).
- La combinaison **lots × tranches** (tranches différentes par lot) : hors lot, si la Commission n'en a pas l'usage (Q3).

## 6. Questions au pilote

Les quatre premières conditionnent le travail ; les autres ont une recommandation par défaut, à revoir à la relecture
des décalques.

| # | Question | Recommandation |
|---|---|---|
| **Q1** | Contrat-cadre de travaux : **harmoniser les codes** (le contrat-cadre de travaux reprend les codes de celui des fournitures, une seule description sert les deux) ou garder deux jeux de codes avec une table de correspondance ? | **Harmoniser.** Un seul modèle, une seule lecture, un seul contrôle ; et c'est le moment — DBPRS20 est vide, aucune valeur à migrer. |
| **Q2** | Délais d'affermissement des deux tranches conditionnelles : les créer ? | **Oui**, deux champs (le modèle officiel s'arrête à deux tranches conditionnelles). |
| **Q3** | Un marché à la fois alloti et à tranches : tranches communes à tous les lots ? | **Oui** en T-0 ; des tranches par lot seulement si la Commission le demande. |
| **Q5** | Texte officiel : décalque fidèle (coquilles et renvois erronés compris, ex. « article 16 » pour l'article 5 ; « Une (01) copie » puis « nombre de copies ») ou corrigé ? | **Fidèle**, comme pour les autres catégories, avec la liste au juriste. La phrase contradictoire des copies est retirée avec sa raison. |
| Q4 | Prix « mixtes » (troisième variante de l'annexe 1 du CCAP) ? | Ajouter l'option **Mixte** à la question du type de prix, pour les travaux. |
| Q6 | Maître d'ouvrage délégué (AE, CCAP) : aucun champ. | **Créer** (nom, coordonnées, date du mandat). |
| Q7 | Taux de la garantie de bonne exécution, plafond des pénalités, visite des lieux obligatoire : aucun champ. | **Créer** ; les pénalités par la question du cadrage `penalites`, comme ailleurs (plafond du CCAG des travaux). |
| Q8 | Travaux de bâtiment (clause CPC/TBM, responsabilité décennale) : aucune clé. | Un **oui/non** « travaux de bâtiment », qui commande aussi la décennale. |
| Q9 | Monnaie (trois rédactions pour deux réponses), délai ou date de fin, sous-traitance au choix du candidat. | Ariary → a), devises → c), b) retirée ; **délai** plutôt que date ; la sous-traitance reste au candidat. |
| Q10 | Champs du référentiel sans place ou mal placés (données du candidat maîtres « AE », doublons, `B08-MO-01`…). | La règle arbitrée pour les fournitures et les PI : retirer pour la catégorie, après vérification serveur ; les doublons fusionnés. |

## 7. Ce que le pilote rend

Un « oui » (ou ses corrections) sur Q1, Q2, Q3 et Q5 suffit à lancer T-0 et T-2 ; les autres questions partent avec la
demande au backend de T-1.
