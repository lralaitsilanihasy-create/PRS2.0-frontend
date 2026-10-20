# Demande backend — 2026-10-19 — Ce que la page et la liste du dossier de marché ont encore besoin de lire

## Contexte

Suite de la demande « dossier-marche-contrat-cadre » (V137). Le pilote a relu la page du dossier de marché 100383 (produits
d'entretien, ligne 303338, procédure 13-CC/MEF/SG/PRMP.2026, sous-type `MAOO-CC`) et l'écran « Dossier de marché — choisir la
procédure ». Trois informations manquent au front ; il ne les reconstitue pas pour ne pas multiplier les appels.

## B1 — Le montant initial du marché né d'une attribution

`GET /api/dossiers/100383/actes-gestion` sert `montantInitialHt: null` et `sourceMontantInitial: null`. L'attribution le connaît
pourtant : 179 570 562 Ar HT pour l'offre retenue au rang 1.

Demande : pour un dossier de marché né d'une attribution, servir le montant de l'attribution, avec `sourceMontantInitial =
"ATTRIBUTION"` (valeur déjà prévue par le contrat).

**Question Q1 — le contrat-cadre multi-attributaire.** 13-CC a trois titulaires et trois offres indicatives (179 570 562,
193 083 400 et 204 668 404 Ar HT). Quel montant initial retenir pour le plafond des avenants (le tiers du montant initial) ? Le front
propose : `null` pour un contrat-cadre multi-attributaire, le plafond se lisant alors sur chaque marché subséquent, et l'écran dit
« contrat-cadre : montants par titulaire ». À trancher avec le juriste si besoin.

> ⚠️ **2026-10-19, livré (backend), avec une valeur de plus**
> - **Une fois le lot attribué**, la source est `ATTRIBUTION`, avec le montant attribué. **Avant**, la source est la nouvelle valeur
>   **`PROPOSITION`**, avec le montant de l'offre proposée par le rapport : il n'est pas encore attribué, et l'étiqueter
>   `ATTRIBUTION` serait faux. À défaut des deux, la source est `DECLARE`, comme avant. Le front ajoute `PROPOSITION` à son contrat.
> - **Q1 : livré comme le front le propose.** Un contrat-cadre à plusieurs titulaires, retenus ou seulement proposés, a un montant
>   initial `null` et une source `null`. La PRMP peut toujours en déclarer un. Le plafond reste à trancher avec le juriste.
> - **Sur 100383**, le rapport propose trois titulaires : `null`, donc l'écran affiche « contrat-cadre : montants par titulaire ».

## B2 — Le dossier de marché sur les lignes de `GET /api/dmcs/eligibles`

L'écran « Dossier de marché — choisir la procédure » (front, 19/10) liste les procédures menées en ligne dont le dossier de mise en
concurrence est clôturé. Il ne sait pas si le dossier de marché existe déjà : 13-CC y reste proposée alors que 100383 est créé et
soumis. Le lire par l'attribution de chaque fiche ferait un appel par ligne.

Demande : sur chaque ligne, `dossiersMarche: [{ lot, idDossier, refeDossier, statut }]` (vide tant qu'aucun lot n'a son dossier),
lu sur `t_attribution` comme `procedure` (V137).

> ⚠️ **2026-10-19, livré (backend), tel que demandé**
> - **Le champ** : `dossiersMarche: [{ lot, idDossier, refeDossier, statut }]`, rangé par lot. `refeDossier` est nul avant la réception.
> - **Les cas vides** : une liste vide tant qu'aucun lot n'a son dossier ; `null` sur une ligne sans fiche.
> - **Le coût** : une requête pour toute la liste.
> - **Sur 13-CC** : `[{ 1, 100383, null, "SOUMIS" }]`.

## B3 — L'objet du marché dans `procedure`

La page d'un dossier titre par sa référence, à défaut « Dépôt du 19/10 ». Pour un dossier de marché, l'objet parlerait mieux tant que
la référence n'est pas donnée : « Fourniture de produits d'entretien et des petits matériels (Contrat cadre) — lot 1 ».

Demande : `procedure.designationMarche` (la désignation de la ligne du plan, celle de la fiche), et `procedure.intituleLot` pour un
marché alloti.

> ⚠️ **2026-10-19, livré (backend), avec une précision**
> - **`designationMarche`** : la désignation de la fiche validée, à défaut celle de la ligne du plan.
> - **`intituleLot`** : « Lot n°01 : désignation », d'après les lots du plan. C'est la règle déjà appliquée par le projet de marché.
> - **Précision** : l'intitulé est **nul si la ligne n'a pas plusieurs lots**. La ligne de 13-CC (303338) n'en a qu'un : `intituleLot`
>   y est nul. Le « — lot 1 » du titre proposé se compose avec `procedure.lot` si l'écran le veut.

## B4 — Le PV de la Commission sur le dossier de mise en concurrence ne s'ouvre pas

La pièce `PV_CNM_DMC` de 100383 est servie avec `lien = /api/pv-examens/64/document`. Ce document ne s'ouvre pour personne :

| Compte | Réponse |
|---|---|
| PRMP001 (PRMP du dossier 100382) | 403 « PV hors de votre périmètre (seuls les PV signés de vos dossiers sont consultables) » |
| SECANT1, MEMANT1 | 404 « Aucun document pour le PV : 64 » |

Le PV n° 63 (articles de bureau, dossier 100381) est dans le même cas. Le PV n° 61, celui du plan de passation, s'ouvre pour les trois
comptes.

Ces deux PV ont été menés **par l'API** en recette, sans passer par les écrans. Le front suppose qu'une étape qui produit le PDF a été
sautée.

Questions :
- **Q2 — Quand le PDF d'un PV est-il produit ?** Si c'est par un geste d'écran, le serveur peut-il le produire à la signature, pour qu'un
  PV signé ait toujours son document ?
- **Q3 — Le 403 de la PRMP.** Vient-il de l'absence de document, ou de l'état du PV (dossier clôturé, PV archivé) ? Un PV signé d'un
  dossier clôturé doit rester lisible par sa PRMP.
- **Q4 — Le lien servi.** Tant que le document n'existe pas, `PV_CNM_DMC` peut-il être servi sans `lien`, pour que l'écran dise « PV
  sans document » au lieu de proposer « Ouvrir » ?

> ⚠️ **2026-10-19, réponses (backend)** — aucune étape n'a été sautée : il y avait deux causes dans le serveur.
> - **Q2 — le document n'existe pour aucun PV de ce genre.** Un PV d'examen n'a de PDF que pour un **plan de passation** : ce sont les
>   seuls modèles Word officiels fournis par le métier. Le PV d'un dossier de mise en concurrence ou de marché n'en a jamais, qu'il soit
>   mené par l'API ou par les écrans. En recette, les PV 62, 63 et 64 n'ont pas de document, le 61 (le plan) en a un. Produire ce
>   document demande un modèle du métier, ou l'accord du pilote pour un PDF générique construit à partir des données du PV. Rien n'est
>   produit tant que le pilote n'a pas tranché.
> - **Q3 — un vrai défaut, corrigé.** L'accès de la PRMP à un PV signé se vérifiait par le PPM du dossier. Un dossier de mise en
>   concurrence ou de marché n'en a pas : sa PRMP n'ouvrait donc ni le détail ni le document. Elle est désormais reconnue comme
>   **propriétaire du dossier** (`t_dossier.ID_PRMP`). PRMP001 lit les PV 63 et 64. Leur document répond 404, comme aux comptes de la
>   Commission.
> - **Q4 — oui.** `PV_CNM_DMC` n'a de `lien` que si le PV a son PDF, ou un modèle pour le produire : pour 100383, `lien` est nul. La
>   pièce porte aussi **`idPv`** (64 pour 100383), pour ouvrir le PV par ses données (`GET /api/pv-examens/{id}`) et dire « PV sans
>   document ».

## Côté front

Fait le 19/10, sans attendre :
- **Les pièces fournies par l'application** (fiche de présentation, PV de la Commission sur le dossier de mise en concurrence, PV de
  validation) restent visibles après la soumission, dans un groupe « Fournies par l'application » qui les ouvre par leur `lien`.
  La page ne lisait la liste des pièces exigées qu'en brouillon.
- **La carte « Actes de gestion du marché »** ne s'affiche plus avant un PV favorable (`avisMarche` `FAV` ou `FAVR`), sauf s'il porte
  déjà des actes.
- **La liste des procédures** propose « Ouvrir l'attribution », sans présumer que le dossier de marché reste à créer.

À faire après la livraison : la liste dira « Dossier de marché créé » (ou soumis) avec son lien (B2), la page titrera par l'objet
(B3), la carte des actes affichera le montant (B1).
