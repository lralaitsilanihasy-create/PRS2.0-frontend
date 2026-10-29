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

## Réponses tirées des textes (front, 2026-10-29 — à valider par le juriste)

Lecture des textes du dossier `D:\TEXTES MP` (loi n° 2016-055, circulaire de régulation des marchés publics LFI 2024, manuel de
procédures internes des Commissions des Marchés), à la demande du pilote. Ce sont des réponses de lecture, pas un avis juridique.

- **Q1 — Le visa est-il requis ?** Oui, sauf exception. Circulaire 2024 (§ XV) : les contrats « nécessitent un visa du Contrôle
  Financier, sauf ceux bénéficiant d'une exception de contrôle préalable dans le cadre du CHED ». Le manuel de la CNM place le contrôle
  de « tout projet de marché et tout projet d'avenant préalablement au visa du Contrôle Financier ». → B1 : le visa est une étape
  normale ; une case « dispensé (exception CHED) » suffit à couvrir l'exception.
- **Q2 — L'approbation attend-elle le visa ?** Oui. Circulaire 2024 (p. 31) : « les marchés soumis à enregistrement sont ceux étant déjà
  signés par les deux parties, visés par le contrôle financier et approuvés par l'Autorité d'approbation ou son représentant », et
  l'enregistrement est « l'ultime opération avant la notification » (loi, art. 54). → voir **B4** ci-dessous.
- **Q3 et Q4 — Le document de décision d'attribution.** Il est requis. Circulaire 2024 (§ « documents utilisés en matière d'attribution »,
  c°) : la « décision d'attribution provisoire » est un « acte réglementaire formel (sous forme de décision) pris par la PRMP, qui
  consiste à matérialiser son choix sur l'attributaire du marché, après validation du procès-verbal d'évaluation de la CAO » ; elle « ne
  fait pas nécessairement l'objet de publicité ». Sa date est la date d'attribution du plan de passation. Aucun modèle officiel trouvé
  dans le dossier : texte provisoire du serveur (Q4).
- **Q5 — Le délai d'information.** Aucun nombre de jours. Loi, art. 52-I : la PRMP avise les candidats « dès qu'elle a fait son
  choix » ; les dix jours francs courent de la plus tardive de la lettre et de l'affichage (circulaire 2024, a° et b°), ce que le
  serveur fait déjà. → **B3 ajusté** : pas de paramètre de délai ; un rappel « à informer » à la PRMP dès la décision d'attribution, et
  tant que l'information n'est pas faite.

## B4 — L'ordre de fin de chaîne (nouveau, issu des textes)

Aujourd'hui : signature → approbation et enregistrement **dans un ordre libre** → notification (409 `MARCHE_NON_APPROUVE`,
`NON_ENREGISTRE`). Les textes (circulaire 2024, p. 31 ; loi, art. 54) imposent : **signature → visa du contrôleur financier →
approbation → enregistrement → notification**. Demandé : refuser l'enregistrement avant l'approbation (par exemple 409
`MARCHE_NON_APPROUVE` sur `…/enregistrement`), et l'approbation avant le visa une fois B1 livré (409 `NON_VISE`, sauf dispense CHED).

## B5 — Contrat-cadre : l'information des titulaires non retenus d'un marché subséquent (à vérifier)

Décret n° 2019-1064, art. 30 : « Les titulaires du contrat-cadre qui n'ont pas été retenus sont informés, par l'acheteur public, du
résultat de l'attribution du marché subséquent. » Le front n'a pas vérifié que l'attribution d'une remise (`POST /api/remises/{id}/
attribution`) notifie les titulaires non retenus : le dire, et l'ajouter s'il manque.

## ⚠️ Décision du pilote (2026-10-29) : « suivre les textes en vigueur »

B1 à B5 deviennent des demandes fermes, selon les réponses ci-dessus :

- **B1 — Visa du contrôleur financier** : étape requise entre la signature et l'approbation ; une dispense « exception de contrôle
  préalable (CHED) » se déclare au même geste (motif obligatoire).
- **B2 — Décision d'attribution provisoire** : document produit au geste « Attribuer » (acte formel de la PRMP, non publié), joint au
  dossier de marché ; texte provisoire tant qu'aucun modèle officiel n'est fourni.
- **B3 — Information des candidats** : pas de paramètre de délai ; un rappel « Informer les candidats » à la PRMP dès la décision
  d'attribution et jusqu'à l'information (loi, art. 52-I : « dès qu'elle a fait son choix »).
- **B4 — Ordre de fin de chaîne** : signature → visa (ou dispense) → approbation → enregistrement → notification, chaque étape refusée
  avant la précédente.
- **B5 — Titulaires non retenus d'un marché subséquent** : informés à l'attribution de la remise (décret n° 2019-1064, art. 30).

## ⚠️ Décision du pilote (2026-10-29) sur Q4

**Q4 (modèle officiel de la décision d'attribution)** : aucun modèle trouvé dans les textes lus. **Décidée** : le serveur produit son
propre texte (B2), sur le modèle du projet de marché ; s'il le rend administrable (modèle de document), l'Administrateur pourra le
remplacer le jour où un modèle officiel sera fourni.
