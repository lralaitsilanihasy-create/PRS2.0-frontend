# Demande backend — 2026-10-18 — Le sous-type « Contrat Cadre » (`DAOO-CC`), produit par la fiche DAO

## Contexte

Le référentiel « Sous-types de dossier » porte un sous-type de la famille `DMC` qu'aucune migration ne crée. Il a été ajouté à la
main depuis l'écran d'administration :

| Code | Libellé |
|---|---|
| `DAOO-CC` | Dossier d'Appel d'Offre Ouvert - Contrat Cadre |

Aucun dossier ne l'utilise aujourd'hui. Le front a proposé de le supprimer, puisque le contrat-cadre est déjà une **forme** portée
par la fiche (V95 : `FORME = CONTRAT_CADRE`). **Le pilote a arbitré le 18/10 : le contrat-cadre garde son sous-type distinct.**

En l'état, ce sous-type est incohérent avec le reste :
- **À « Créer dossier »,** il prend le chemin du formulaire manuel, puisque ce n'est pas un sous-type produit par une fiche. L'écran
  affiche alors les pièces par défaut de la famille :
  - DAO complet ;
  - CCTP ;
  - estimation du coût ;
  - garantie de soumission.

  Ce n'est pas la liste du manuel pour un contrat-cadre (page 32).
- **Le serveur accepterait de créer ce dossier à la main,** alors qu'il refuse la création directe des autres sous-types d'appel
  d'offres (409 `DOSSIER_PAR_FICHE`).
- **Une fiche de contrat-cadre produit un dossier `DAOO`.** Exemple : les consomptibles informatiques (ligne 303339) ont donné le
  dossier 100380, de sous-type `DAOO`. Le sous-type `DAOO-CC` n'est donc jamais atteint par le chemin normal.

## B1 — `DAOO-CC` est un sous-type produit par la fiche

- **Le sous-type déduit.** Une ligne en appel d'offres ouvert dont la forme est le contrat-cadre produit un dossier `DAOO-CC`, et
  non `DAOO`. La forme est lue sur le plan (la fiche de présentation sert déjà « Forme du marché : Contrat-cadre (plan : Contrat
  cadre) »), à défaut sur `typeMarche` de la fiche.
- **Les lignes éligibles.** `GET /api/dmcs/eligibles` sert `sousType = "DAOO-CC"` pour ces lignes, et `?sousType=DAOO-CC` les
  filtre. L'écran « Créer dossier » renvoie déjà vers `/prmp/dao?sousType=DAOO-CC`.
- **La création directe.** Elle est refusée, comme pour `DAOO` : 409 `DOSSIER_PAR_FICHE`.
- **Le référentiel.** Le sous-type est créé par une migration, avec un code stable et son libellé, pour survivre à une
  réinitialisation de la base. Le libellé est à harmoniser : le front propose « Dossier d'appel d'offres ouvert — contrat-cadre ».

> ⚠️ **2026-10-18, livré (backend, V131)** — tel que demandé.
> - **V131** crée `DAOO-CC`, ou reprend la ligne ajoutée à la main en recette : libellé « Dossier d'appel d'offres ouvert —
>   contrat-cadre », famille `DMC`, `GRILLE_BASE = DAOO`.
> - **La contrainte** `ck_dossier_dmc_dao` (V94), qui limitait les sous-types d'un dossier né d'une fiche, admet `DAOO-CC`.
> - **La forme** est lue sur le plan (la forme de la ligne), à défaut sur `typeMarche` de la fiche. Les lignes éligibles la
>   lisent sur le plan.
> - **`DAOO-CC`** rejoint les sous-types produits par une fiche : `POST /api/saisies/dossier` et la création brute de
>   l'Administrateur renvoient 409 `DOSSIER_PAR_FICHE`.

## B2 — La liste des pièces de `DAOO-CC` : celle du manuel, page 32

Le manuel donne, pour le contrat-cadre :
- une fiche de présentation signée par la PRMP ;
- une copie du calendrier annuel mis à jour et signé ;
- l'AGPM signé et contrôlé par la Commission, avec au moins une copie de sa publication ;
- le projet d'avis spécifique ;
- tout autre document utile ;
- le projet de DAO.

Il ne demande **ni canevas de rapport d'évaluation, ni bordereau estimatif.**

Demande : la liste propre à `DAOO-CC` dans `t_piece_sous_type`, dans l'ordre suivant :

| Ordre | Code |
|---|---|
| 1 | `FICHE_PRESENTATION` |
| 2 | `CALENDRIER` |
| 3 | `AGPM_CONTROLE` |
| 4 | `PUBLICATION_AGPM` |
| 5 | `AVIS_SPECIFIQUE` |
| 6 | `DAO_COMPLET` |
| 7 | `AUTRE_DOCUMENT` (facultatif, V130) |

Les règles déjà livrées s'y appliquent :
- **Pièces fournies par l'application** (B1 du 17/10) : fiche de présentation, calendrier, AGPM contrôlé.
- **Reprise d'office de la publication de l'AGPM** (V118).
- **Pièces jointes d'office** par la fiche : projet d'avis et DAO complet.

> ⚠️ **2026-10-18, livré avec un ajout (backend, V131)** — la liste est reprise des lignes de `DAOO` qui valent pour le
> contrat-cadre, avec les mêmes conditions (`PAPIER` pour les trois premières, `FACULTATIVE_EN_LIGNE` pour l'avis), dans l'ordre
> demandé. **Un ajout** : `DESCRIPTIF_PLANS`, en 7, limité aux **travaux** (`CATEGORIE = TRAVAUX`). Un contrat-cadre de travaux
> est possible (`DPAC-CC` et `AE-CC` couvrent les travaux), et ses plans sont une pièce du DAO, comme en `DAOO`.
> `AUTRE_DOCUMENT` passe donc en 8. Ni canevas, ni bordereau, ni DQE.

## B3 — Ce qui dépend du sous-type, à étendre à `DAOO-CC`

Le front demande au backend de vérifier, et d'étendre au besoin, ce qui est réglé par sous-type pour `DAOO` :
- **Les points de contrôle** du manuel (grille effective `GET …?sousType=`). Le manuel (p. 32-33) ajoute pour le contrat-cadre les
  critères d'élimination et d'attribution, et leur cohérence avec les pièces de candidature.
- **Les modèles de PV** de la Commission.
- **Les délais de traitement** et le chronométrage.
- **Le référencement des dossiers** et le sous-type cité dans les documents produits.

> ⚠️ **2026-10-18, vérifié (backend)** — rien d'autre à coder.
> - **Points de contrôle et motifs-types** : `DAOO-CC` les hérite de `DAOO` par sa grille de base, comme `DAOOI`. Ils sont filtrés
>   par la forme de la fiche, et `DAOO` porte déjà les 5 points propres au contrat-cadre (`FORME = CONTRAT_CADRE`, manuel p. 32-33).
> - **Modèles de PV** : aucun ne dépend de `DAOO`.
> - **Délais** : aucun sous-type n'a de délai propre aujourd'hui, donc `DAOO-CC` prend les délais standards, comme `DAOO`.
>   L'Administrateur peut lui en donner (`tr_delai_sous_type`).
> - **Référence** : le segment de la référence est le sous-type, donc `…/DAOO-CC/…`.
> - **Dossier de marché** : l'attribution d'un contrat-cadre produit toujours un `MAOO`.

## Questions

- **Q1 — Les dossiers existants.** Le dossier 100380 (consomptibles informatiques, contrat-cadre) a été soumis en `DAOO`. Le
  front propose de **ne pas le requalifier** : les dossiers déjà soumis gardent leur sous-type. En revanche, le front propose que
  les brouillons d'un contrat-cadre passent en `DAOO-CC` à leur prochaine production par la fiche.
- **Q2 — Une forme qui change.** Si une nouvelle version de la fiche change la forme du marché (contrat-cadre vers autre forme, ou
  l'inverse), le sous-type d'un dossier en brouillon suit-il ? Le front propose oui en brouillon, jamais après la soumission.
- **Q3 — Les autres modes.** Faut-il prévoir le contrat-cadre en appel d'offres restreint ou international (`DAOR-CC`,
  `DAOOI-CC`) ? Le front ne le propose pas tant que le référentiel ne les porte pas.

> ⚠️ **2026-10-18, réponses (backend)**
> - **Q1 — d'accord.** Un dossier déjà soumis garde son sous-type : le dossier 100380 reste en `DAOO`. Un brouillon passe en
>   `DAOO-CC` à la prochaine validation de sa fiche, ou à son rattachement.
> - **Q2 — d'accord.** À la validation d'une nouvelle version, et au rattachement (`PUT /api/dossiers/{id}/fiche-marche`), un
>   dossier en `BROUILLON` reprend le sous-type de sa fiche, dans les deux sens. Après la soumission, jamais.
> - **Q3 — d'accord, rien n'est créé.** Un contrat-cadre en appel d'offres restreint ou international garde `DAOR` ou `DAOOI`.

## Côté front

Déjà fait le 18/10, en attente de B1 :
- `DAOO-CC` est ajouté aux sous-types produits par une fiche.
- « Créer dossier » propose désormais « Choisir la ligne du plan de passation » au lieu du formulaire manuel, avec sa présentation
  (DPAC, acte d'engagement du contrat-cadre, CCAP).
- La liste des lignes est filtrée sur `sousType = "DAOO-CC"`. Elle restera vide tant que le serveur ne le déduit pas.
