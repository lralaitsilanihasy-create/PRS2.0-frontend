# Demande backend — 2026-10-29 — Chaîne d'attribution : visa du contrôleur financier, décision d'attribution, délai d'information

## Contexte

En préparant la présentation des trois formes de marché (quantité fixe, à commandes, contrat-cadre), le pilote a fait vérifier la
chaîne qui suit l'évaluation des offres. Elle est **commune aux trois formes**, et l'ordre imposé par le serveur est correct :

dossier de marché + projet de marché (`AttributionService.creerDossier`, l. 1013-1075) → contrôle de la CNM → décision
d'attribution par la PRMP (`AttributionService.attribuer`, l. 264-311) → information des candidats (`informer`, l. 395) → délai
d'attente de 10 jours francs (`DelaiAttenteCalcul`, l. 38-52) → signature → approbation et enregistrement → notification
(`AttributionExecutionService`, l. 793-996) → avis d'attribution.

Le **calendrier type** du plan de passation (rubrique `B01-AC-18`, lu sur le jeu 2463) énumère :

> … Remise en forme du projet de marché ; **Décision d'attribution de marché** ; Information des candidats non retenus ; Mise au
> point des composants du marché et signature du marché ; **Visa du marché par le Contrôleur financier** ; Approbation du marché ;
> Enregistrement ; Notification du marché au titulaire …

Trois écarts entre ce calendrier et le code. Le front ne peut rien construire pour eux sans contrat serveur.

## B1 — Le visa du marché par le contrôleur financier

Aucune étape dans le code : une recherche de « contrôleur financier » dans `src/main` ne donne aucun résultat. Le marché passe de la
signature (`SIGNE`) à l'approbation et à l'enregistrement sans trace de visa.

Demandé, sur le modèle de l'approbation (`approuver`, l. 879) :

- un geste de la PRMP (ou de son UGPM, comme les autres gestes d'exécution) qui enregistre le visa d'un lot : date, référence
  facultative et scan du marché visé (nouvelle nature de pièce, par exemple `VISA_CF`) ;
- la date du visa se situe entre la signature et aujourd'hui (400 `DATE_INVALIDE`) ; 409 `DEJA_VISE`, `NON_SIGNE` ;
- le visa dans `AttributionDto` (comme `Approbation` et `Enregistrement`), pour que le front l'affiche dans le suivi du lot.

**À trancher (pilote ou juriste)** :

- **Q1** — Le visa est-il obligatoire pour tout marché, ou seulement pour certains (selon l'autorité contractante, le budget, le
  montant…) ? S'il ne l'est pas toujours, à quoi le reconnaît-on ?
- **Q2** — L'approbation doit-elle être refusée sans le visa (409 `NON_VISE`), comme la notification est refusée sans
  l'enregistrement ? Le calendrier type place le visa entre la signature et l'approbation.

## B2 — Le document « décision d'attribution »

Aujourd'hui la décision est un **geste sans document** : l'état passe à `ATTRIBUE` ; l'offre, la date, l'auteur, le motif
facultatif, les montants HT et TTC et le délai sont enregistrés, et une ligne `ATTRIBUTION` va dans la trace. Aucune pièce n'est
produite, ni jointe au dossier de marché, ni téléchargeable.

Demandé :

- à l'attribution, le serveur produit la **décision d'attribution** du lot en PDF (Word si le modèle le permet), sur le modèle des
  lettres d'information : signée électroniquement par la PRMP, horodatée. Elle porte l'objet, le lot, l'attributaire (ou les
  titulaires retenus d'un contrat-cadre), le montant, le délai, et la référence de l'avis de la Commission sur le dossier de marché ;
- une route de lecture, par exemple `GET /api/attributions/{idDmc}/lots/{lot}/decision` (PDF ; 404 tant que le lot n'est pas
  attribué), ouverte aux mêmes lecteurs que le projet de marché (`projet`, l. 1080) ;
- de préférence, un modèle de document administrable, comme le projet de marché depuis V140 (nature `PROJET_MARCHE`), pour que
  l'Administrateur ajuste le texte sans livraison.

**À trancher** :

- **Q3** — Le document est-il joint au dossier de marché, envoyé à l'attributaire, ou seulement conservé dans le suivi du lot ?
- **Q4** — Un modèle officiel existe-t-il ? Si oui, le pilote le fournit ; sinon, le serveur propose un texte provisoire, comme pour
  l'avis d'attribution (Q7 du lot 2b).

## B3 — Un délai pour informer les candidats après la décision

`informer` n'impose que l'ordre (409 `NON_ATTRIBUE`, `DEJA_INFORME`) et une date d'affichage comprise entre l'attribution et
aujourd'hui. Aucun délai ne court entre la décision d'attribution et l'information, et aucune alerte ne le rappelle à la PRMP. Seul
le délai d'attente de 10 jours francs, qui part de l'information, est contrôlé.

Demandé, **si un texte fixe ce délai** :

- un paramètre de délai, sur le modèle de `RECEPTION_LETTRE` (`DelaiAttenteCalcul.joursReception`) : nombre de jours, actif ou non ;
- l'échéance dans `AttributionDto.Information` (par exemple `informerAvantLe`), nulle avant l'attribution ;
- un rappel à la PRMP : notification et entrée dans « À faire » à l'approche de l'échéance, puis une fois dépassée. Le geste
  `informer` n'est pas bloqué après l'échéance : une information tardive vaut mieux que pas d'information.

**À trancher** :

- **Q5** — Quel texte fixe ce délai, et combien de jours, ouvrés ou calendaires ? Sans texte, B3 reste sans objet et le front n'affiche rien.

## Ce que fera le front

Une fois les contrats livrés : le visa dans la frise et le panneau de suivi du lot (entre la signature et l'approbation) ; le bouton
« Décision d'attribution » à côté du projet de marché ; l'échéance d'information dans le panneau du lot et sa ligne dans « À faire ».
Rien n'est construit avant la réponse.
