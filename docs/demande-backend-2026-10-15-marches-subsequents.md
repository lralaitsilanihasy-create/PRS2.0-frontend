# Demande backend — 2026-10-15 — marchés subséquents, remises en concurrence et bons de commande

## Contexte (décision du pilote, 15/10)

L'application s'arrête aujourd'hui à l'attribution du contrat-cadre (et du marché à commandes). Le pilote ouvre le chantier de la
suite : la lettre d'invitation, les remises en concurrence des titulaires, les marchés subséquents et les bons de commande. Il a
demandé que chaque règle se réfère aux **textes** : la **loi n° 2016-055 du 25 janvier 2017** portant Code des marchés publics, et
le **décret n° 2019-1064 du 28 mai 2019** précisant les modalités du contrat-cadre (art. 67 de la loi), remis par le pilote le 15/10.

Textes lus :
- **Loi, définition** de l'accord-cadre : il établit « les règles relatives aux **bons de commande** à émettre ou les termes
  régissant les **marchés à passer** au cours d'une période donnée, notamment en ce qui concerne les prix ».
- **Loi, art. 67** (contrats-cadres) : choix des titulaires séparé de l'attribution des commandes ; remise en concurrence à la
  survenance du besoin ou selon une périodicité ; montant défini dans chaque marché ; règle des lots (IV).
- **Loi, art. 30** (marchés à commandes) : trois ans au plus ; minimum et maximum en quantité ; exécution par bons de commande ;
  obligation de commander le minimum, obligation du titulaire d'honorer jusqu'au maximum.
- **Loi, art. 33** (dématérialisation) : la voie électronique est **complémentaire** de la voie postale.
- **Loi, art. 13** (commission de réception) : réception **obligatoire**, contradictoire, **procès-verbal signé** par la commission
  de réception présidée par la PRMP.
- **Décret 2019-1064** : art. 5-6 (marchés subséquents ; le contrat-cadre complété ou affiné sans modification substantielle),
  art. 10 (délais de soumission du contrat-cadre), art. 15 (notification, contestation, avis d'attribution), art. 17 (un seul
  titulaire qualifié), art. 18-23 (mise en œuvre, durée, exclusivité, obligations des titulaires), **art. 24-33 (passation des
  marchés subséquents)**, art. 34 (pas de minimum).

## Les quatre arbitrages, tirés des textes

| Question | Réponse retenue | Fondement |
|---|---|---|
| Contrôle a priori de la Commission | **Aucun** : le marché subséquent ne fait l'objet « ni de publicité, ni de plan de passation des marchés, ni de contrôle a priori de la Commission des Marchés ». Tout est journalisé et **lisible** par la Commission. | Décret art. 25 |
| Réponses des titulaires | **En ligne** (espace entreprise) **et** voie postale enregistrée par l'UGPM ; la réponse est une **facture pro forma, un devis** ou le document convenu au contrat-cadre. | Loi art. 33 ; décret art. 27 |
| Bons de commande | **Les deux formes** : bon de commande « réglementaire » du marché subséquent **et** marché à commandes, un seul module. | Loi, définition et art. 30 ; décret art. 33 |
| Suivi de l'exécution | **Émission, notification et réception** (PV de la commission de réception) ; facturation et paiement hors chantier. | Loi art. 13 |

## B0 — Corrections sur la passation du contrat-cadre lui-même (existant)

1. **Délai de remise des offres** (décret art. 10) : **dix (10) jours au moins** en appel d'offres, **cinq (5) jours calendaires** en
   consultation. Le paramètre `PUBLICITE_CONTRAT_CADRE` (V106) vaut **30 jours**, « valeur à confirmer » : le régler à 10 (et 5 pour
   la consultation, ce qui suppose un second paramètre ou une distinction par mode). Le ligne 303339 du plan du MEF (10 jours entre
   lancement et remise) est donc **conforme**.
2. **Publicité** (décret art. 9) : en plus des art. 32-33 de la loi, publication au minimum sur le site de l'acheteur et celui de
   l'ARMP, au bureau du contrôle financier, à la Chambre de commerce, et par un média écrit ou audiovisuel local. À refléter dans
   les supports de l'avis du contrat-cadre (`publication.supports`) — au moins comme rappel à l'impression.
3. **Après l'évaluation** (décret art. 15) : résultat notifié à **tous** les candidats, **dix jours francs** de contestation, puis
   signature et notification ; **avis d'attribution** publié dans les mêmes formes que l'avis, dans les **trente jours** de la
   notification. À vérifier contre les gestes d'attribution existants.
4. **Un seul titulaire qualifié** (décret art. 17) : l'acheteur **peut** déclarer la procédure infructueuse (art. 56 de la loi). À
   proposer au rapport d'évaluation d'un contrat-cadre multi-attributaire qui n'en dégage qu'un.
5. **Durée** (décret art. 19) : **deux ans au plus**, sauf cas exceptionnels dûment justifiés (investissements amortissables). C'est
   le point « plafond de durée du contrat-cadre » qui attendait le juriste : le décret le tranche. Contrôle à la validation de la
   fiche (`B02-DC-01`, `B07-DU-05`) : au-delà de 24 mois, une justification est exigée.

> ⚠️ **2026-10-15, livraison backend de B0 : points 1, 2 et 5 livrés ; 3 vérifié ; 4 reporté.**
> 1. **Délais livrés, rendus bloquants.** Ce ne sont plus deux paramètres : ce sont deux **délais légaux**, n° 10
>    `PUBLICITE_CONTRAT_CADRE_AO` (10 jours) et n° 11 `PUBLICITE_CONTRAT_CADRE_CONSULTATION` (5 jours). Ils sont **bloquants**
>    comme ceux de la loi, à la validation (`DELAI_PUBLICITE`) et à l'impression de l'avis (409). Ils s'appliquent au mode
>    « consultation », puis à tout autre mode. V121 désactive `PUBLICITE_CONTRAT_CADRE`. `GET /api/delais-legaux` sert onze
>    délais.
> 2. **Livré en rappel.** `GET …/avis-specifique/disponibilite` porte `supportsMinimaux` : les cinq supports de l'art. 9,
>    une liste vide hors contrat-cadre. Rien n'est exigé ; le front l'affiche près de la saisie des `supports`.
> 3. **Vérifié, conforme pour un titulaire.** Les dix jours francs et l'avis d'attribution sous trente jours sont les délais
>    légaux n° 6 et 8, déjà appliqués à l'attribution. **Écart :** l'évaluation s'arrête à la première offre qualifiée et
>    l'attribution désigne **un** attributaire par lot. Le contrat-cadre **multi-attributaire**, qui doit retenir plusieurs
>    titulaires, n'existe donc pas encore. Il manque aussi la notification « à tous les candidats » des titulaires multiples.
> 4. **Reporté pour la même raison.** Le constat « un seul titulaire qualifié » suppose l'évaluation à plusieurs titulaires.
>    Il viendra avec elle, en tête de MS-1 ou dans une tranche à part, à arbitrer.
> 5. **Livré.** Règle bloquante `DUREE_CONTRAT_CADRE_MAX`, qui lit `B02-DC-01`, `B02-DC-02` et `B07-DU-05` (× 12 mois).
>    Au-delà de 24 mois, la justification **`B02-DC-05`** est exigée. C'est un champ nouveau, facultatif, imprimé par aucun
>    document. Script `docs/referentiel/2026-10-15-duree-contrat-cadre.sql`.
>
> **Front (15/10) :** `supportsMinimaux` est affiché en rappel dans la modale d'impression de l'avis, sous la saisie des
> supports (encadré absent hors contrat-cadre, rien d'exigé).
>
> ⚠️ **2026-10-15, arbitrage du pilote sur les points 3 et 4 : une tranche à part, AVANT MS-1** (tranche « MT —
> plusieurs titulaires »). Elle reprend l'évaluation et l'attribution **existantes** du contrat-cadre : retenir plusieurs offres
> qualifiées par lot, rapport et proposition d'attribution à plusieurs titulaires, notification des titulaires à tous les
> candidats, et le constat « un seul titulaire qualifié » (décret art. 17, point 4). MS-1 n'en dépend pas pour démarrer : il
> lit une liste de titulaires, d'un ou de plusieurs. Le nouvel ordre est donné en H5.
> D'ici la livraison de MT, le cadrage « Multi-attributaire » reste sélectionnable alors que l'attribution ne désigne qu'un
> titulaire : **demandé**, un avertissement non bloquant à la validation de la fiche qui le dit.
>
> ⚠️ **2026-10-15, livré avec B0 :** l'avertissement **`MULTI_ATTRIBUTAIRE_NON_OUTILLE`** apparaît au bilan
> (`bilanControles.avertissements`), bloc `B07`, `champs` vide. Il se déclenche dès que le cadrage porte
> `attributaires = MULTI` et ne bloque jamais la validation. Il sera retiré à la livraison de MT.

## Lot MS-1 — Le contrat-cadre (ou le marché à commandes) en vigueur

- À la notification, un objet **« contrat en vigueur »** : titulaire(s) — liste **fermée**, aucun nouvel opérateur (décret art. 18) ;
  acheteurs parties au contrat ; lot(s) ; période de validité (`B02-DC-02`), reconductions (`B07-DU-04`, `B07-DU-07`) dans la durée
  maximale (deux ans sauf justification pour le contrat-cadre, décret art. 19 ; trois ans pour le marché à commandes, loi art. 30) ;
  montant (valeur maximale estimée, décret art. 8 ; minimum et maximum pour le marché à commandes) ; bordereau indicatif de l'offre ;
  forme et rythme des marchés subséquents (`B07-FS-01`, `B02-PC-02`).
- **Pas de minimum** pour le contrat-cadre ni ses marchés subséquents (décret art. 34) ; l'alerte « minimum non atteint » ne vaut que
  pour le **marché à commandes** (loi art. 30-II).
- Échéances et reconduction signalées (« À faire ») ; plus aucune remise en concurrence ni commande après l'échéance.

## Lot MS-2 — La remise en concurrence et le marché subséquent

- **Création** par la PRMP ou l'UGPM, à la survenance du besoin ou au calendrier du contrat (décret art. 24).
- **Qui est consulté** : **tous** les titulaires (décret art. 21 — un titulaire non consulté peut former un recours) ; contrat
  **alloti** : à la survenance du besoin, les titulaires des seuls lots concernés ; à la périodicité, tous les lots (décret art. 31).
- **La lettre d'invitation** (annexe 1 du document type ARMP), produite par l'application, porte (décret art. 26) : les
  **caractéristiques détaillées** du besoin, les **critères d'évaluation**, la **date et l'heure limites**, qui tiennent compte du
  délai de préparation des offres ; elle invite à proposer les **prix** et les **conditions d'exécution** (délai, lieu de livraison).
  Visite des lieux admise pour l'entretien de matériels ou d'immeubles (décret art. 27).
- **Réponses** (décret art. 27) : facture pro forma, devis, ou document convenu ; en ligne ou enregistrées depuis le papier ;
  fermées jusqu'à l'échéance.
- **Évaluation** par la **CAO réunie en collège restreint**, selon les critères du contrat-cadre affinés dans la lettre (décret
  art. 28) ; **rapport d'évaluation simplifié** de la CAO (décret art. 33).
- **Attribution** par la **PRMP sur proposition de la CAO**, à **un seul** titulaire (décret art. 29 ; art. 20 : « saupoudrage »
  interdit) ; information des non retenus (décret art. 30).
- **Pièces du marché subséquent** : la lettre, le rapport simplifié et **toutes les offres** reçues, jointes aux pièces de dépense
  (décret art. 33).
- **Obligations des titulaires** (décret art. 22-23) :
  - ne pas participer expose à la **résiliation** et à l'**exclusion** d'un contrat-cadre futur — l'application trace chaque absence
    de réponse, la décision reste à la PRMP ;
  - après **deux** remises en concurrence dont les offres dépassent de **plus de 30 % le prix moyen du marché**, l'acheteur est
    délié de l'exclusivité **pour cet achat** — l'application le signale (le prix moyen de référence est celui que le contrat-cadre
    définit : un champ du formulaire, à prévoir) ;
  - **absence répétée d'offres raisonnables** : résiliation à l'égard des titulaires fautifs (décision de la PRMP).
- **Mono-attributaire** (un seul opérateur, décret art. 18) : la consultation porte sur lui seul ; complétude de l'offre initiale
  dans le délai `B07-MA-01`, sous le plafond d'augmentation `B05-PM-04`.

## Lot MS-3 — Les bons de commande

- **Contrat-cadre** : le **bon de commande réglementaire** est passé avec le titulaire retenu au marché subséquent (décret art. 33),
  aux prix de son offre. **Marché à commandes** : bons émis au fil des besoins, aux prix du bordereau (loi art. 30).
- Contenu : articles, quantités, lieu, délai, montant ; PDF ; notification au titulaire (espace entreprise, courriel), accusé tracé.
- Contrôles : marché à commandes — cumul **au plus le maximum**, alerte avant l'échéance si le **minimum** n'est pas atteint (loi
  art. 30-II) ; contrat-cadre — cumul face au montant maximal estimé (décret art. 8), signalé ; aucun bon après l'échéance.

## Lot MS-4 — La réception

- Livraison déclarée, puis **réception** par la commission de réception (loi art. 13) : réception, ajournement, réfaction ou rejet
  (CCAG fournitures, art. 22), **PV signé** de ses membres sous la présidence de la PRMP ; provisoire, puis définitive au terme du
  délai de garantie (`B09-GP-03`) s'il y en a un.
- Retard : pénalités calculées à titre indicatif selon le contrat (`B07-PE-*`), sans retenue automatique.

## Questions et hypothèses

- **Q1 — tranchée par le pilote (15/10) : la commission de réception est désignée par décision de la PRMP, comme la CAO.** Même
  mécanisme que la désignation de la CAO existante (décision de la PRMP, référence et date, membres et président ; la PRMP ou son
  représentant la préside, loi art. 13-IV), par contrat en vigueur, saisie par la PRMP ou son UGPM ; les membres signent le PV de
  réception, chacun avec son compte. Lot MS-4.
- **Q2 — tranchée par le pilote (15/10) : un champ du formulaire du contrat-cadre** porte les **règles de détermination du prix
  moyen du marché** (décret art. 23) : texte long, obligatoire pour un contrat-cadre multi-attributaire (la règle des 30 % suppose
  une remise en concurrence), imprimé dans le contrat-cadre valant acte d'engagement, à l'article qui traite des marchés subséquents
  (art. 4 ou 9 du type, au choix du backend), avec la clause du décret : « après deux mises en concurrence ayant donné lieu à la
  présentation d'offres supérieures de 30 % au prix moyen du marché […], l'acheteur public est, pour cet achat, délié de
  l'exclusivité contractuelle […] et peut procéder à cet achat en recourant à une mise en concurrence en dehors du contrat-cadre ».
  À la remise en concurrence (MS-2), l'écart de chaque offre au prix moyen est montré, et la deuxième remise consécutive au-delà de
  30 % est signalée. Ce champ est à ajouter au référentiel dès le point B0 (il sert au DAO avant les marchés subséquents).

  > ⚠️ **2026-10-15, livré (champ et impression) avec `demande-backend-2026-10-15-formulaire-type-contrat-cadre.md`.**
  > Code `B07-MA-07`. Il s'imprime à l'art. 4 de l'AE-CC, avec les deux clauses de l'art. 23 du décret. L'écart au
  > prix moyen, montré à la remise en concurrence, reste à faire avec MS-2.
- H1 — La CAO « en collège restreint » est la CAO déjà désignée pour le contrat-cadre, réduite (quorum propre à fixer) ; à
  confirmer par le juriste.
- H2 — Les titulaires sont les entreprises des offres retenues, avec leurs comptes candidats ; un titulaire sans compte reçoit la
  lettre par courriel et sa réponse est enregistrée par l'UGPM.
- H3 — Les achats sous le seuil réglés directement par bon de commande (loi, titre préliminaire, V) sont hors de ce chantier.
- H4 — Facturation, mandatement et paiement (loi art. 72, 74) restent hors de l'application.
- H5 — Ordre de livraison proposé : B0, puis MS-1, MS-2, MS-3, MS-4 (le bon de commande du contrat-cadre suit l'attribution du
  marché subséquent, décret art. 33).
  > ⚠️ 15/10 (arbitrage du pilote) — l'ordre devient : **B0, MT (plusieurs titulaires), MS-1, MS-2, MS-3, MS-4**.

## Ce que le front fera

Espace PRMP / UGPM : « Contrats en vigueur » (titulaires, échéances, consommation), remises en concurrence (création, lettre,
suivi des réponses), bons de commande (émission, plafonds, notification), réception (déclaration, PV). Espace CAO : évaluation en
collège restreint et rapport simplifié. Espace entreprise : invitations reçues, dépôt de devis, bons de commande notifiés.
Commission : lecture. Le contrat de chaque lot sera repris de la réponse du backend.
