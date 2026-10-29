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
