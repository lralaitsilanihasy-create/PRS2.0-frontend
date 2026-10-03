# Demande backend — Les pièces de l'offre ouvertes aux fournitures

**Date** : 2026-10-03 · **Émetteur** : front · **Origine** : extension du lot 4 du chantier b
(`demande-backend-2026-10-03-pieces-offre-travaux.md`, close, livrée en V61), retenue par le pilote le 03/10 (choix
« A »). Elle répond à l'hypothèse **H4** de cette demande : « les fournitures ont la même clause 6.2 ; une extension
ultérieure ne changerait que le périmètre ».

## Le constat qui motive le choix A

Le DPAO **officiel** des fournitures n'est pas construit comme celui des travaux. Sa clause 6.2 n'a qu'une rubrique,
« Documents ou pièces à remettre en sus de ceux mentionnés à la clause 6.2. des IC », que remplit `B04-CO-01`. Il n'a
**aucune place pour les pièces administratives**.

`B03-CQ-01` (« Identification et situation juridique : pièces exigées ») est pourtant servi aux fournitures, en quantité
fixe et à commande, avec la liste du document type pour valeur par défaut. Il ne s'imprimait que dans l'ancienne fiche
A1, recopiée du dossier 2463. Depuis le passage aux modèles officiels (27/09), **il ne s'imprime plus nulle part** : la
PRMP le saisit pour rien. Le dossier réel 2463 exige pourtant ces pièces, et datées (« Carte d'Immatriculation Fiscale
2026 ou 2025 validée, datée… », correspondance du 27/09, DPAO 6.1).

**Choix A du pilote** : un paragraphe « Pièces administratives » est **ajouté** à la clause 6.2 du DPAO des fournitures,
sur le patron du 2° des travaux. La liste des pièces s'ouvre aux fournitures, et `B03-CQ-01` retrouve une place.

---

## B1 — `/pieces` et le bloc `B14` ouverts aux fournitures

- `GET|PUT /api/fiches-marche/{idDmc}/pieces` s'ouvre à **FOURNITURES_SERVICES**, en **quantité fixe et à commande**.
  Le contrat, les règles et les 400 sont ceux de V61.
- Le bloc `B14` « Pièces de l'offre » (`rendu = 'PIECES'`, rubriques `B14-AD` et `B14-OF`) est servi au référentiel des
  fournitures pour ces deux types de marché.
- **Contrat-cadre de fournitures : hors périmètre (H1)**. Il ne sert ni `B04-CO-01` ni `B03-CQ-01`, et son DPAC n'a pas
  cette clause. `PIECES_HORS_PERIMETRE` y reste.
- **L'écran ne change pas** : la grille, l'aperçu, « Reprendre les pièces du document type » et « Coller une liste »
  sont les mêmes qu'aux travaux.

> ⚠️ **Livraison backend du 2026-10-03 (§B1, V62).** Conforme : `/pieces` et le bloc `B14` sont ouverts aux fournitures, en
> quantité fixe et à commande, avec le contrat et les règles de V61. Le contrat-cadre de fournitures reste à 409
> `PIECES_HORS_PERIMETRE` (H1).
>
> **Écart :** le **contrat-cadre de travaux sort aussi du périmètre**. Son DPAC n'a pas davantage de place pour ces pièces,
> et `B04-PI-01` ne lui est pas servi. `B14` n'y est plus servi, et `PUT /pieces` y répond 409. Aucune liste n'était
> saisie sur un contrat-cadre.

## B2 — Les contrôles

- **`PIECES_OFFRE_EXIGEES`** s'étend aux fournitures, avec `B04-CO-01` pour texte : la liste `OFFRE` **ou**
  `B04-CO-01`, qui devient **facultatif** (aujourd'hui obligatoire). Même logique qu'aux travaux avec `B04-PI-01`.
- **`PIECES_EN_DOUBLE`** s'étend aux fournitures (fin de H4) : l'avertissement porte sur `B03-CQ-01` égal à sa valeur
  par défaut alors que la liste `ADMINISTRATIVE` est remplie.

> ⚠️ **Livraison backend du 2026-10-03 (§B2).** Conforme, **H2** comprise :
> - **`PIECES_OFFRE_EXIGEES`** lit `B04-CO-01` aux fournitures, devenu facultatif, avec le rôle
>   `PIECES_OFFRE_EXIGEES:TEXTE`. Message : « Les pièces de l'offre ne sont pas dites : remplissez la liste des pièces de
>   l'offre, ou « Documents et pièces constituant l'offre ». »
> - **`PIECES_EN_DOUBLE`** s'étend aux fournitures.

## B3 — Le DPAO-F (recopié par le front)

Rédigé dans `scripts/modeles-dao/modeles/DPAO-F.txt` / `.json` (`verifier.mjs` : 251 sur 251). ⚠️ **Ne pas le recopier
avant la validation du pilote**, que je noterai ici. La cellule 6.2 devient :

```
Documents ou pièces à remettre en sus de ceux mentionnés à la clause 6.2. des IC :
{{SI:PIECES-OFFRE-LISTE}} {{PIECES.offre}}                   — PIECES.offre renseigne
{{SI:PIECES-OFFRE-TEXTE}} {{B04-CO-01}}                      — B04-CO-01 renseigne
{{SI:PIECES-ADM}} Pièces administratives à joindre à l'offre :   — PIECES.administratives renseigne ou B03-CQ-01 renseigne
{{SI:PIECES-ADM-LISTE}} {{PIECES.administratives}}           — PIECES.administratives renseigne
{{SI:PIECES-ADM-TEXTE}} {{B03-CQ-01}}                        — B03-CQ-01 renseigne
```

- « Pièces administratives à joindre à l'offre : » est un **ajout** au document type, déclaré comme tel au comparateur.
- **Effet sur les fiches existantes** : `B03-CQ-01` a une valeur par défaut. Les fiches de fournitures qui ne l'ont pas
  vidé imprimeront désormais le paragraphe, avec la liste du document type. C'est l'effet voulu : ces pièces étaient
  exigées sans être dites.

> ⚠️ **Livraison backend du 2026-10-03 (§B3).** DPAO-F **recopié** tel que commité en `ae93f90`, 47 conditions déclarées.
> `verifier.mjs DPAO-F` sur le rendu brut du serveur : 251 sur 251.

## Hypothèses

- **H1** — Le contrat-cadre de fournitures reste hors périmètre.
- **H2** — `B04-CO-01` devient facultatif, sous la règle `PIECES_OFFRE_EXIGEES`, comme `B04-PI-01` en V61.

**Recette attendue** : une fiche de fournitures (quantité fixe) avec les pièces administratives du 2463 et deux
pièces de l'offre. Le DPAO imprime les deux listes à la clause 6.2. Sans liste ni texte de pièces de l'offre, la fiche
est refusée par `PIECES_OFFRE_EXIGEES`, et `PIECES_EN_DOUBLE` avertit tant que `B03-CQ-01` garde son défaut.

**Banc de l'import** : aucune fausse valeur. `B04-CO-01` et `B03-CQ-01` deviennent **ambigus** pour la lecture, comme
aux travaux : chacun suit le paragraphe du seul jeton de sa liste.

> ✅ **2026-10-03 — texte validé par le pilote, tel quel** (« Pièces administratives à joindre à l'offre : »).
> `DPAO-F.txt` est **à recopier** tel que commité en `ae93f90`, avec la livraison de B1 et B2. Le pilote autorise la
> recette sur une fiche de fournitures en brouillon de DBPRS20.

> ⚠️ **Livraison backend du 2026-10-03 — recette.**
> - `FicheDaoTravauxIntegrationTest.piecesDesFournitures`, sur une fiche de fournitures à quantité fixe :
>   - `B14` servi, pas en contrat-cadre ; `B04-CO-01` facultatif ;
>   - sans liste ni texte, la fiche est refusée par `PIECES_OFFRE_EXIGEES` ;
>   - avec les pièces administratives du 2463 (datées de moins de 3 mois) et deux pièces de l'offre, le contrôle passe ;
>   - `PIECES_EN_DOUBLE` avertit sur `B03-CQ-01`, qui garde son défaut ;
>   - une fois validée, le **DPAO imprime à la clause 6.2** : les pièces de l'offre, « Pièces administratives à joindre à
>     l'offre : », les deux pièces datées, puis la liste du document type portée par `B03-CQ-01`.
> - Le 409 du contrat-cadre est vérifié sur le contrat-cadre de travaux.
> - **Livraison** : migration **V62** et script `docs/referentiel/2026-10-03-pieces-offre-fournitures.sql`, passé à blanc
>   sur DBPRS20 (`B04-CO-01` n'y a aucune valeur saisie). Les deux copies du fichier de correspondance des fournitures sont
>   mises à jour à l'identique.

> ⚠️ **Défaut de lecture révélé par le DPAO-F — une règle à ajouter à `lire.mjs`** (arbitrage du 03/10 : livré tel quel,
> la règle vient de vous, je la porterai ensuite).
> - **Constat** : un DPAO-F exporté puis réimporté, sur une fiche à quantité fixe dont `B03-CQ-01` garde son défaut, n'est
>   plus reconnu qu'à **25 unités sur 142** (65 sans ce texte). C'est le cas de la plupart des fiches de fournitures. L'import
>   avertit : « peu de texte du modèle reconnu (10 %) ».
> - **Cause** : la clause 1.2 (marché à commande) finit par l'unité « `{{B02-AU-04}} mois.` », dont le seul texte fixe est
>   « mois. ». Elle n'est pas imprimée en quantité fixe : la lecture la cherche donc dans sa fenêtre et l'accroche à la
>   ligne « … datée de moins de TROIS (03) mois » du défaut de `B03-CQ-01`, désormais imprimé à la clause 6.2. Le curseur
>   saute au-delà de la 6.2, et toutes les unités qui précèdent sont perdues.
> - **Pas propre au DPAO-F** : tout document qui contient un paragraphe finissant par « mois » après une clause 1.2 absente
>   déclenche le même saut. Le DPAO-T n'a pas d'unité aussi pauvre, et sa lecture ne bouge pas (79 sur 169, avec ou sans ce
>   texte).
> - **Règle proposée (règle 9)** : une unité dont le texte fixe compte moins de 8 lettres, le seuil qui interdit déjà la
>   confiance haute (règle 2), ne se cherche que tout près du curseur, dans la fenêtre courte des textes répétés
>   (`FENETRE_REPETE`), et jamais par réancrage. Dites-moi si vous la retenez, ou une autre : je la porterai dans
>   `LectureDao` avec la parité vérifiée.
> - En attendant, `ImportDaoIntegrationTest.allerRetourFournitures` vide `B03-CQ-01` de sa fiche source, avec un
>   commentaire qui renvoie à ce défaut.

> ✅ **Réponse du front, 2026-10-03 — règle 9 retenue, sous une forme élargie** (`scripts/import-dao/lire.mjs`, étape 1 ;
> `scripts/import-dao/README.md`, règle 9).
> - **Votre forme**, une unité pauvre cherchée tout près du curseur seulement, **perdait des accroches justes** au DAO du
>   MTP : « Date : `{{B04-OV-02}}` », « Lieu : `{{B04-OV-01}}` » et « `{{B06-RC-01}}` jours », de 4 à 42 paragraphes plus loin
>   (DPAO-T 8 → 5 reconnus, la valeur `B04-OV-01` perdue).
> - **Forme retenue** : une unité de moins de 8 lettres fixes se cherche comme les autres, mais **au-delà des 3
>   paragraphes** qui suivent le curseur, elle ne se reconnaît que dans un **paragraphe de 60 caractères au plus** (une
>   étiquette et sa valeur, jamais le bout d'une phrase). Une unité **sans aucune lettre** (« 1 ») ne se reconnaît que
>   dans ces 3 paragraphes : au CCAP du MEN, « 1 » s'accrochait 48 paragraphes plus loin. Réancrage : inchangé (une unité
>   pauvre n'est jamais distinctive). Constantes `PRES = 3`, `COURT = 60`.
> - **Mesures** :
>   - **votre cas**, reproduit au banc (`--defauts --quantite-fixe` : DPAO-F en quantité fixe, `B03-CQ-01` à son
>     défaut) : rappel 33 % → **90 %** et 39 % → **93 %**, 1 fausse valeur → 0. Sur 12 graines : Q10 tenu partout ;
>   - banc ordinaire, propre et 12 graines : **identique ligne pour ligne** ;
>   - MEN : CCAP-T 58 → **71**, avec 3 réponses déduites nouvelles et justes (`B05-GE-01`, `avance`, `B05-GA-01`), et une
>     valeur fausse nouvelle en confiance basse (`B10-DR-01`) ;
>   - MTP : DPAO-T 8 → 7 (`B04-OV-01` gardé) ; 2463 : inchangé.
> - **Demandé** : porter la règle dans `LectureDao`, avec la parité habituelle. Les lignes qui changent sont celles du
>   CCAP-T du MEN et du DPAO-T du MTP. Ensuite, votre `allerRetourFournitures` peut garder `B03-CQ-01` à son défaut. Le
>   banc a deux options nouvelles pour la parité : `--defauts` et `--quantite-fixe`.

> ✅ **Contre-recette du front, 2026-10-03 (JAR de 16:13) : fiche 33**, fournitures à commande, 1 lot, avec le jeu du
> 2463 (lot 1) et `B03-CQ-01` à sa valeur par défaut ; écriture avec l'accord du pilote.
> - **Avant les pièces** : un seul bloquant, `PIECES_OFFRE_EXIGEES` (`B04-CO-01` non saisi), avec le message attendu.
> - **Écran** : le bloc `B14` est servi (10e bloc). Les pièces administratives du 2463 sont collées par « Coller une
>   liste » : 4 pièces, « photocopie certifiée conforme à l'original », « datée de moins de 3 mois ». Deux pièces de l'offre
>   sont saisies aussi. L'écran signale le double emploi, et `PUT /pieces` répond 200.
>   - Un défaut du découpage, côté front, a été trouvé et corrigé pendant la recette : « Photocopie certifiée… » se
>     lisait « copie certifiée… » et laissait « Photo » dans le libellé.
> - **Contrôle** : 0 bloquant ; **`PIECES_EN_DOUBLE`** avertit, avec le message attendu.
> - **Validation v1**. Le DPAO, clause 6.2, imprime :
>   - les 2 pièces de l'offre ;
>   - « Pièces administratives à joindre à l'offre : » ;
>   - les 4 pièces du 2463 ;
>   - puis la liste du document type portée par `B03-CQ-01` : c'est le double emploi annoncé.
> - **Réimport de ce DPAO-F** (à commande, sur la fiche 35, en lecture seule) : 84 unités sur 142, au serveur comme au
>   prototype avec la règle 9. Le défaut de lecture ne touche que la quantité fixe, mesurée au banc.
>
> **Demande close**, sauf le portage de la règle 9 dans `LectureDao` (encadré ci-dessus).

> ⚠️ **Livraison backend du 2026-10-03 — règle 9 portée dans `LectureDao`, parité identique, mais le cas réel n'est pas
> couvert.**
> - **Portage** : `PRES = 3`, `COURT = 60`, unité pauvre = moins de 8 lettres fixes (`ANCRE_HAUTE`) ; sans lettre, les 3
>   paragraphes seulement.
> - **Parité** sur 20 documents : les 19 habituels, plus un DPAO-F en quantité fixe que génère le serveur, avec `B03-CQ-01`
>   à son défaut. Extraction identique, **1 138 lignes de lecture identiques**.
> - **Le cas qui a motivé la règle n'est pas réglé, ni chez vous ni chez moi** : ce DPAO-F reste lu à **25 unités sur 142**,
>   des deux côtés (`lireParagraphes` sur les mêmes paragraphes : 25).
>   - Le défaut réel de `B03-CQ-01` (fichier de correspondance, recopié à la création) contient « un certificat de non
>     faillite datée de moins de 2 mois ». La ligne fait **54 caractères**, sous le seuil de 60, et `{{B02-AU-04}} mois.`
>     s'y accroche : valeur lue « un certificat de non faillite datée de moins de 2 ».
>   - Votre banc `--defauts --quantite-fixe` mesurait sans doute un autre texte, ou une autre disposition.
> - **Piste**, à votre main : `B02-AU-04` est un `NOMBRE`. Une unité pauvre ne devrait se reconnaître loin du curseur que
>   si la valeur capturée a la forme de son type (« 6 », « six (06) »), ce qui n'est jamais le cas d'un bout de phrase. Ou
>   bien un seuil plus court.
> - **En attendant**, `allerRetourFournitures` garde `B03-CQ-01` vidé, avec un commentaire qui renvoie à ce défaut.

> ✅ **Réponse du front, 2026-10-03 — votre piste retenue, avec un complément** (`lire.mjs`, étape 1 ; README, règle 9,
> « Suite »).
> - **Vous aviez raison** : mon banc imprimait le défaut de `B03-CQ-01` en un seul paragraphe, de plus de 60 caractères.
>   Il le rend maintenant **ligne par ligne**, comme votre rendu Word, et retrouve votre mesure : 33 % de rappel.
> - **Votre piste seule ne suffisait pas** : en quantité fixe, `B02-AU-04` n'est pas servi au référentiel, et son type est
>   inconnu de la lecture. D'où un second signe, tiré du texte.
> - **Règle complétée** : loin du curseur (au-delà de `PRES`), une unité pauvre ne se reconnaît que si **chaque valeur
>   capturée a la forme de son type** :
>   - `NOMBRE`, `MONTANT`, `POURCENTAGE` (ou suffixe `.chiffres`) : un nombre, au sens de `valeurSaisie` (« 6 », « six
>     (06) ») ;
>   - `DATE`, `DATE_HEURE` (sans suffixe) : une année 19xx ou 20xx. Le MTP écrit sa date en toutes lettres, et le format
>     strict perdait « Date : … » ;
>   - **type inconnu** : un jeton suivi d'une unité (« mois », « jours », « ans », « années », « semaines », « heures »,
>     « % ») attend un nombre.
>
>   Le seuil `COURT` reste, et les unités sans lettre restent limitées aux 3 paragraphes qui suivent le curseur.
> - **Mesures** :
>   - cas réel (`banc --defauts --quantite-fixe`) : 33 % → **90 %** et 39 % → **93 %**, 0 fausse valeur, Q10 tenu sur
>     12 graines ;
>   - banc ordinaire (propre et 12 graines) et DAO réels (MEN, MTP, 2463) : **identiques** à la règle 9 portée ;
>   - le DPAO-F à commande de la fiche 33 n'est pas concerné (84 sur 142).
> - **Demandé** : porter ce complément dans `LectureDao`, avec la parité sur vos 20 documents. Ensuite,
>   `allerRetourFournitures` peut garder `B03-CQ-01` à son défaut.

> ⚠️ **Livraison backend du 2026-10-03 — suite de la règle 9 portée** (`LectureDao.valeursALaFormeDuType`, à la même place
> qu'à l'étape 1 de `lire.mjs`, avant la règle R-c).
> - **Parité** sur les 20 documents : extraction identique, **1 145 lignes de lecture identiques**.
> - **Cas réel** : le DPAO-F en quantité fixe, avec `B03-CQ-01` à son défaut, passe de 25 à **66 unités sur 142**, autant
>   que sans ce texte (65). `B02-AU-04` n'est plus proposé.
> - `ImportDaoIntegrationTest.allerRetourFournitures` garde maintenant `B03-CQ-01` à son défaut, sans avertissement de
>   lecture.
> - Ni migration ni script.
