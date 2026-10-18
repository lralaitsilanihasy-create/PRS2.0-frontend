# Demande backend — 2026-10-18 — La grille d'examen du DAO pour une fiche de travaux

## Contexte

Suite de `demande-backend-2026-10-18-grille-contrat-cadre.md` (V133, V134). À sa Q2, le backend avait relevé que la grille du DAO,
rédigée sur le DAO de fournitures, cite des informations qu'une fiche de **travaux** ne porte pas. Il proposait un lot à part, sur
avis du pilote. **Le pilote a donné son accord le 18/10.**

Depuis le 18/10, l'examen relie chaque point aux informations de la fiche qu'il cite : un code absent de la fiche n'y mène nulle
part, et l'écran le compte « sans objet pour cette fiche ».

**Le constat, mesuré après V134.** Le front a lu `GET /api/points-ctrls?sousType=DAOO` et `?sousType=DAOO-CC`, puis il a
confronté chaque code cité au référentiel servi pour une fiche de travaux :
`GET /api/champs-fiche-marche?typeMarche=…&categorie=TRAVAUX` (blocs, rubriques et champs).

| Forme du marché | Codes cités absents d'une fiche de travaux | Points touchés |
|---|---|---|
| Quantités fixes | 33 sur 48 | 10 |
| À commandes | 33 sur 48 (les mêmes) | 10 |
| Contrat-cadre | 5 sur 61 | 3 |

Le contrat-cadre est presque couvert : les variantes de V133 donnent déjà le code des travaux entre parenthèses
(« travaux : B05-GQ-03 »). **L'écart tient aux points des marchés à quantités fixes et à commandes** (forme `AUTRE`).

### Quantités fixes et à commandes (points de forme `AUTRE` et points communs)

| Point | Codes absents d'une fiche de travaux |
|---|---|
| Allotissement | `B02-AU-02` |
| Montants et estimation | `B05-TP-03` |
| Garantie de soumission | `B05-GS-02`, `B05-GS-03`, `B05-GS-04` |
| Délais de la consultation | `B04-DE-02`, `B04-DE-03`, `B04-LR-03`, `B04-LR-04`, `B04-OP-02`, `B04-OP-03` |
| Candidats : pièces et capacités | `B04-CO-01`, `B03-CQ-02`, `B03-CQ-03` |
| Évaluation et attribution | `B06-EO-01`, `B06-EO-02`, `B03-CQ-08`, `B06-EO-09` |
| Paiements, avance et garanties financières | `B08-PA-05`, `B08-IM-01` |
| Pénalités, garantie et dérogations | `B09-PR-02`, `B09-PR-03`, `B09-DG-01`, `B09-DG-04`, `B10-DD-01` |
| Exécution et livraison | `B06-EO-12`, `B09-LL-01`, `B09-DX-03`, `B09-RT-01`, `B09-IV-01`, `B09-DI-01` |
| Cohérence des mentions du dossier | `B04-RO-02`, `B02-OB-02` |

### Contrat-cadre (points de forme `CONTRAT_CADRE`)

| Point | Codes absents d'une fiche de travaux |
|---|---|
| Allotissement | `B02-AL-03` |
| Garantie de soumission | `B05-GS-01`, `B05-GS-10`, `B05-GS-03` |
| Paiements, avance et garanties financières | `B08-FP-03` |

## B1 — Les points citent aussi le code des travaux

Le front propose la **même méthode qu'en V133** : pour chaque code cité qui n'existe qu'en fournitures, le texte du point donne
**aussi** le code des travaux entre parenthèses (« travaux : … »), quand il en existe un. Pas de nouveaux points : la règle de B2 du
18/10 (« au moins une catégorie ») l'admet déjà, et un même point reste le même point quelle que soit la catégorie de la fiche.
L'écran ne propose que les codes que la fiche porte : chaque fiche verra les siens.

Si une notion n'a pas d'équivalent en travaux, le texte le dit (« sans objet en travaux »). S'il en faut un, un point propre aux
travaux s'ajoute ; le choix revient au backend.

> ⚠️ **2026-10-18, livré (backend, V135)** — la méthode proposée, sans nouveau point.
> - Chaque parenthèse des 10 points `AUTRE` donne aussi le code des travaux : `B02-LT-02`, `B02-LV-03`, `B05-GQ-02/03`,
>   `B04-EQ-01/02`, `B04-OV-01/02`, `B04-PI-01`, `B03-QT-07/08/13/14`, `B06-EV-01`, `B06-PN-01/02`, `B08-AF-01`, `B05-GA-01`,
>   `B08-AP-01`, `B08-MR-05`, `B05-GE-01/05`, `B05-RG-01/02`, `B09-PR-01`, `B09-PE-02/03`, `B09-GT-01`, `B10-DR-01`, `B09-DL-01`,
>   `B02-OT-03`, `B09-VQ-01`, `B09-RP-04`, `B04-FP-02`, `B02-OT-02`.
> - **Une notion que la fiche de travaux ne porte pas** est marquée « travaux : non saisi », plutôt que « sans objet » : la notion
>   existe en travaux, c'est la fiche qui ne la porte pas. C'est le cas de la validité de la garantie (`B05-GS-04`), des critères
>   additionnels (`B06-EO-02`), des intérêts moratoires (`B08-IM-01`) et de la passation des commandes (`B09-DX-03`).
> - L'inverse existe aussi : `B06-EO-07` (offres anormales) n'existe qu'en travaux, il est marqué « fournitures : non saisi ».
> - **Contrat-cadre** : seule la notion « garantie exigée et forme de remise » (`B05-GS-01`, `B05-GS-10`) n'a pas d'équivalent dans
>   la fiche d'un contrat-cadre de travaux ; elle est marquée « travaux : non saisi ». Les 4 autres codes du tableau ont déjà leur
>   code des travaux entre parenthèses depuis V133.
> - Un texte n'est remplacé que s'il est encore celui de V133. La description passe de 255 à 1000 caractères : plusieurs textes
>   dépassaient la limite une fois complétés (jusqu'à 365).
## B2 — Le bilan par catégorie

Aujourd'hui, `GET /api/points-ctrls/controle-codes` accepte un code présent dans **au moins une** catégorie du point : il ne voit pas
qu'un point de fournitures et de travaux ne mène à rien sur une fiche de travaux.

Demande : le bilan signale aussi, pour chaque point, les **catégories** (et formes) pour lesquelles **aucun** des codes d'une même
notion n'existe, par exemple avec un motif `SANS_EQUIVALENT_CATEGORIE`. Après B1, ce bilan doit être vide pour les fournitures et
les travaux. L'enregistrement par l'Administrateur n'est pas bloqué : c'est une alerte.

> ⚠️ **2026-10-18, livré (backend)** — `GET /api/points-ctrls/controle-codes` sert un nouveau tableau `alertes` :
> `[{ idPointCtrl, libelPointCtrl, idSousType, formePoint, codes, forme, categorie, motif: "SANS_EQUIVALENT_CATEGORIE" }]`.
> - **Une notion** est une parenthèse du texte ; un code hors parenthèse en forme une à lui seul.
> - Elle est en alerte pour une forme (`CONTRAT_CADRE` ou `AUTRE`) et une catégorie quand **aucun** de ses codes n'y existe, sauf
>   si la parenthèse porte « travaux : non saisi » (ou « fournitures : non saisi »).
> - On ne regarde que les catégories que le point examine : fournitures et travaux pour les appels d'offres (`DAOO` et ceux qui en
>   héritent), prestations intellectuelles pour `DC`. Sans cette borne, les quelques codes communs aux prestations
>   intellectuelles auraient donné de fausses alertes.
> - **Un code de bloc ou de rubrique** compte comme présent là où le référentiel sert ce bloc ou cette rubrique, même s'ils n'ont
>   aucun champ. C'est le cas de `B12` et du DQE `B12-DQ` en travaux.
> - Une alerte ne bloque pas l'enregistrement. Les écarts de B2 (`points`) restent bloquants (400 `CODES_ABSENTS`).
> - **Mesuré sur la recette** : 11 alertes avant V135 (10 en travaux, 1 en fournitures), **aucune après**, et aucun écart.

## Questions

- **Q1 — Le DQE et les spécifications.** La grille commune cite `B12` (le besoin). En travaux, le besoin se lit au DQE estimatif et
  aux spécifications déposées en PDF (V119). Le point « Spécifications techniques » doit-il citer autre chose pour une fiche de
  travaux ?
- **Q2 — La recette.** La base de recette n'a aucune ligne de travaux éligible : le front ne pourra pas vérifier à l'écran. Le
  backend peut-il fournir un bilan par catégorie (B2) que le front lira, à défaut de dossier ?

> ⚠️ **2026-10-18, réponses (backend)**
> - **Q1** : en travaux, le bloc « Besoin » (`B12`) est servi, avec la rubrique du DQE `B12-DQ` (V59, par séries), mais sans le
>   champ `B12-BE-01`, réservé aux fournitures. « Spécifications techniques » cite donc « (B12 ; travaux : DQE, B12-DQ, descriptif
>   et plans joints en PDF) ». Les spécifications déposées en PDF sont une pièce (`DESCRIPTIF_PLANS`), pas une information de la
>   fiche : elles n'ont pas de code à citer.
> - **Q2 — oui** : `GET /api/points-ctrls/controle-codes?categorie=TRAVAUX` (ou `FOURNITURES_SERVICES`) donne les alertes d'une
>   seule catégorie. Il est vide en recette après V135. Une catégorie inconnue donne un 400.

## Côté front

Rien à coder : les boutons des références suivent les codes servis, et un code absent de la fiche reste compté « sans objet pour
cette fiche ».
