# Demande backend — 2026-10-29 — Contrat-cadre, tranche 4b : suivre le décret n° 2019-1064

## Contexte

Tranche 4b du plan du 29/10 sur les formes de marché. Ces points attendaient un arbitrage (A2 à A5) ; le pilote a décidé le 29/10 de
**suivre les textes en vigueur**. Lecture faite dans `D:\TEXTES MP` (décret n° 2019-1064 du 28 mai 2019 sur le contrat-cadre, loi
n° 2016-055) — à valider par le juriste ; ce sont des demandes de lecture, pas un avis juridique.

## B1 — Les quantités du besoin d'un contrat-cadre sont indicatives (A2)

Décret, art. 6 : le contrat-cadre comporte « les conditions de base sur le prix, même à titre indicatif, la consistance globale de la
prestation » ; art. 8 : le montant est la valeur maximale estimée « alors même qu'il n'a pas de visibilité […] à la quantité qui sera
effectivement commandée » ; art. 11 : les offres sont « données à titre indicatif » ; art. 34 : pas de minimum.

Aujourd'hui `BesoinFiche` traite le besoin du contrat-cadre comme celui d'une quantité fixe (quantité ferme). Demandé :

- la quantité d'un article de contrat-cadre est dite **indicative** (libellé du référentiel du besoin, et texte des documents DPAC-CC et
  AE-CC : « quantités indicatives, sans engagement de l'acheteur public ») ;
- aucune règle n'en fait un engagement (pas de minimum, art. 34) ; le total estimé reste comparé au montant du plan (art. 8).

## B2 — Le contrat-cadre se passe aussi par appel d'offres restreint ou par consultation (A4)

Décret, art. 7 : la passation du contrat-cadre « peut s'effectuer soit par voie d'appel d'offres tel que prévu aux articles 35 et 38 du
Code [appel d'offres ouvert, appel d'offres restreint], soit par consultation d'entrepreneurs, de fournisseurs ou prestataires de
service comme il est fixé à l'article 41 du code ». Art. 10 : délai de remise de 10 jours (appel d'offres) ou 5 jours calendaires
(consultation) — déjà contrôlé (`DelaisPublicite`).

Aujourd'hui seul l'appel d'offres ouvert a son sous-type de contrat-cadre (`DAOO-CC`, `MAOO-CC` ; « Q3 », `SousTypesDossier`). Demandé :

- les sous-types du contrat-cadre en **appel d'offres restreint** et en **consultation** (dossier de consultation et dossier de marché),
  avec leur grille d'examen (à partir de `DAOO-CC`, adaptée à la procédure) ;
- art. 14 (consultation) : la CAO analyse d'abord les candidatures, puis seulement les offres des candidats retenus — l'évaluation en
  deux temps existe-t-elle déjà pour la consultation hors contrat-cadre ? Le dire.

## B3 — La remise en concurrence d'un contrat-cadre alloti (A3)

Décret, art. 31 : « si la passation des marchés subséquents est effectuée lors de la survenance du besoin, la remise en concurrence ne
concerne que les titulaires des lots pour lesquels un besoin est constaté ; si [elle] est effectuée selon une périodicité prédéfinie, la
remise en concurrence des titulaires des lots porte sur tous les lots ». Demandé : au rythme « Selon le calendrier fixé ci-après »
(`B02-PC-02`), une remise porte sur **tous les lots** du contrat-cadre (une remise commune, une réponse par lot et par titulaire) ; au
rythme « Au fur et à mesure des besoins », la remise reste par lot, comme aujourd'hui.

## B4 — Les hypothèses du lot MS (A5) au regard des textes

- **Collège restreint** (art. 28 : « L'évaluation des offres est effectuée par la CAO, réunie en collège restreint ») : les textes lus
  n'en fixent pas la composition. L'hypothèse H1 (le président évalue) **reste** ; question au juriste.
- **Prix moyen** (art. 23 : « les règles de détermination de ce prix du marché y étant précisées » dans le contrat-cadre) : le prix
  moyen se détermine selon la règle écrite au contrat (`B07-MA-07`) — la saisie par la commission est conforme ; rien à changer.
- **Pénalité de retard** : la loi (art. sur l'exécution, IV) renvoie aux cahiers des clauses administratives générales, absents du
  dossier : l'hypothèse de 1 ‰ par jour **reste**, jamais retenue, jusqu'à lecture des CCAG.
- **Information des titulaires non retenus d'un marché subséquent** (art. 30) : demandée dans `demande-backend-2026-10-29-chaine-
  attribution.md`, B5.

## Ce que fera le front

- B1 : rien (libellés servis par le référentiel ; documents produits par le serveur).
- B2 : la fiche et le dossier suivent les sous-types servis ; les écrans du contrat-cadre ne dépendent pas de la procédure.
- B3 : l'écran de la remise (`remise-detail.ts`, `remises-titulaire.ts`, `remises-cao.ts`) montrera les lots d'une remise commune.

Rien n'est construit avant la réponse.

## ⚠️ Décision du pilote (2026-10-29) : collège restreint

**Composition du collège restreint** (décret n° 2019-1064, art. 28) : aucun texte trouvé (dossier `D:\TEXTES MP`, portail CNLEGIS non
interrogeable automatiquement, recherche web). Le pilote retient l'hypothèse H1 comme **règle** : le président de la CAO évalue la
remise. Rien à changer au serveur.

> ⚠️ **2026-10-30 — B1, B2 (en partie), B3 livrés (PRS20, V151-V152) ; B4 sans changement. Précisions :**
> - **B1** : le DPAC-CC (art. 1) et l'AE-CC (art. 2) portent une phrase nouvelle : « Les quantités du besoin sont indicatives, sans
>   engagement de l'acheteur public : le contrat-cadre n'impose aucun minimum de commande (décret n° 2019-1064, art. 6, 8 et 34). »
>   (modèles `modeles/dao/DPAC-CC.txt` et `AE-CC.txt` : copies du front à resynchroniser). La liste des fournitures (`LF`) et le
>   bordereau estimatif titrent « Quantité indicative » en contrat-cadre ; la liste le rappelle sous chaque tableau. **Pas de libellé
>   servi au référentiel du besoin** : les colonnes du besoin sont celles du front (« Quantité » → « Quantité indicative » si
>   `typeMarche = CONTRAT_CADRE`). Aucune règle n'en fait un minimum ; le total estimé reste comparé au plan.
> - **B2 — appel d'offres restreint** : sous-types **`DAOR-CC`** (dossier) et **`MAOR-CC`** (marché), sur le modèle de `DAOO-CC` /
>   `MAOO-CC` : pièces de `DAOR` / `MAOR`, grille de `DAOO` / `MAOO` (avec les variantes contrat-cadre de V133-V135), forme imposée.
>   Produits d'office par la fiche et l'attribution.
> - **B2 — consultation : écart.** L'application **n'a pas de sous-type de consultation en fournitures et travaux** (le Manuel ne
>   l'outille pas ; `DC` est la consultation de prestations intellectuelles) : le mode « consultation » produit `DAOO`, donc `DAOO-CC` en
>   contrat-cadre, comme avant. Créer `DC…-CC` demande d'abord le sous-type de consultation hors contrat-cadre et sa grille : à trancher
>   par le pilote (codes, pièces, grille).
> - **B2 — art. 14 (candidatures puis offres) : n'existe pas** hors prestations intellectuelles (enveloppes technique puis financière)
>   et AMI (présélection). L'évaluation des fournitures et travaux examine les offres, puis qualifie l'attributaire.
> - **B3** : au rythme « Selon le calendrier fixé ci-après », `POST /api/contrats-en-vigueur/{id}/remises` lance une remise **par lot**
>   (chaque contrat en vigueur de la procédure au même rythme), reliées par **`idGroupe`** ; `RemiseDto` + `idGroupe`, `lots[{ idRemise,
>   idContrat, lot, numero, mode, etat }]` (en fin d'objet). Évaluation, décision et réponses restent **par lot**. Un lot non consultable
>   bloque le tout (409 `SANS_TITULAIRE` / `REMISE_EN_COURS`, `details.lot`).

> ⚠️ **2026-10-30 — front livré :**
> - **B1** : la grille du besoin de la fiche titre « Quantité indicative » (colonne et nom accessible du champ) quand
>   `typeMarche = CONTRAT_CADRE` ; copies `scripts/modeles-dao/modeles/DPAC-CC.txt` et `AE-CC.txt` resynchronisées.
> - **B2** : `DAOR-CC` rejoint les sous-types produits par la fiche (présentation à la PRMP), `MAOR-CC` ceux produits par
>   l'attribution (`MAOR-CC` ← `DAOR-CC`) ; les actes de gestion lisent « montants par titulaire » pour `MAOO-CC` comme `MAOR-CC`.
> - **B3** : au lancement, au rythme « Selon le calendrier fixé ci-après », la PRMP est prévenue que la remise part pour tous les lots ;
>   la remise affiche « Remise commune à tous les lots » avec la remise de chaque lot (`lots[]`) ; `SANS_TITULAIRE` /
>   `REMISE_EN_COURS` nomment le lot (`details.lot`).
> - **Écart consultation** : rien côté front, en attente du pilote.
