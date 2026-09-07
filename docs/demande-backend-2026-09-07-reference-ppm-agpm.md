# Demande au backend `PRS20` — 7 septembre 2026 — PPM-AGPM pour tout appel d'offres + référence dossier ET numéro de PV reflétant le sous-type

> ✅ **LIVRÉ le 07/09 (migration V21) et CONTRE-RECETTÉ en réel.** Trois causes distinctes corrigées :
> (1) le drapeau `declencheAgpm` reste la source de vérité (administrable) — V21 le pose sur TOUTE la
> famille « appel d'offres » (ouvert, restreint, préqualification…) et un mode créé à la volée le dérive
> de son libellé ; l'appel à manifestation d'intérêt en est exclu. (2) La référence initiale du PPM
> codait `PPM` en dur (posée à la création, avant tout marché) ; (3) elle était reprise telle quelle par
> la réception. Le segment de type est désormais **recomposé à chaque bascule du sous-type, sans
> consommer de numéro**, repéré par sa valeur (pas sa position — les deux formats de réf. sont couverts).
> **Périmètre/cohérence** : la référence suit le sous-type **tant qu'aucun PV n'est signé, puis gèle**
> (document imprimé/cité) ; dossier + réf. PPM + réception + PV mis à jour **d'un seul geste** (seul écart
> résiduel : rectification d'un dossier déjà passé en commission). `refePv` dérive bien du `refeDossier`
> (insertion « /PV », **sans** recomposer de code) — confirmé. Reprise V21 sur #100299 (PV « projet
> accepté ») vérifiée en réel côté front : dossier=`00002/MTP/PPM-AGPM/2026`, PV=`00002/MTP/PPM-AGPM/PV/2026`,
> ancien segment disparu, et la **jointure PV↔dossier retombe exactement** sur la réf. du dossier
> (écran Projets de PV : les deux références alignées). 11 tests backend (dont les 4 de la recette, la
> bascule dans les deux sens sans consommation de numéro, le gel après signature, la recomposition à l'unité).
>
> ⚠️ **RÉOUVERTURE PARTIELLE (précision pilote 07/09) — AMI À RÉINTÉGRER SOUS SEUIL.** V21 a exclu
> l'appel à manifestation d'intérêt en bloc ; or l'AMI **doit déclencher l'AGPM au-delà d'un seuil de
> montant** (valeur à déterminer par le pilote). Voir « Suite » ci-dessous.

**Date** : 2026-09-07 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : constat pilote sur
#100299 — le dossier est de sous-type **PPM-AGPM** mais sa référence porte le segment **PPM**.

## Constat

`GET /api/dossiers` pour #100299 :

```json
{ "refeDossier": "00002/MTP/PPM/2026", "idTypeDossier": "DDP", "idSousType": "PPM-AGPM" }
```

Le référentiel `sous-type-dossiers` distingue bien deux sous-types DDP :

```
PPM       → « Plan de Passation de Marché »
PPM-AGPM  → « Plan de Passation de Marché et Avis Général de Passation de Marché »
```

Le dossier déclenche l'AGPM → son sous-type dérivé est `PPM-AGPM`, et l'onglet « Projet d'AGPM » est
présent. Or le **générateur de référence a utilisé le code de base `PPM`** et non le code du sous-type
réel — la référence ne distingue pas un plan simple d'un plan avec AGPM, alors que les deux sous-types
ont des grilles de contrôle (7 vs 8 points) et des modèles de PV différents.

## Demande 1 — la règle de déclenchement : TOUT appel d'offres (précision pilote 07/09)

⚠️ **Point le plus important.** Le sous-type `PPM-AGPM` (et `agpmRequis` / `declencheAgpm`) doit être
dérivé dès qu'au moins un marché du plan est passé par **appel d'offres, quelle que soit la variante** :
ouvert, **restreint**, **avec préqualification**, en deux étapes, etc. — **pas seulement l'appel
d'offres ouvert**. L'AGPM (Avis Général de Passation de Marché) est requis pour les procédures
d'appel d'offres en général.

Côté données, la dérivation semble pilotée par le **drapeau `declencheAgpm` porté par chaque mode**
(référentiel des modes de passation, administrable). Aujourd'hui seul « Appel d'offres ouvert » paraît
flagué. Merci donc de **flaguer `declencheAgpm = true` sur tous les modes d'appel d'offres** (restreint,
avec préqualification, etc.) — ou d'ajuster la logique de dérivation pour couvrir toute la famille
« appel d'offres » — de sorte que ces plans deviennent `PPM-AGPM`. Les modes hors appel d'offres
(consultation des prix, gré à gré / entente directe…) restent `PPM`.

## Demande 2 — la référence reflète le sous-type dérivé (arbitrage pilote 07/09)

Le **segment de type de la référence** d'un dossier de planification (DDP) doit reprendre le **code
du sous-type dérivé** :

- plan déclenchant l'AGPM (≥1 marché en appel d'offres, toutes variantes) → sous-type `PPM-AGPM` →
  référence **`00002/MTP/PPM-AGPM/2026`** ;
- plan sans appel d'offres → sous-type `PPM` → référence `00002/MTP/PPM/2026` (inchangé).

## Demande 3 — le numéro de PV reflète aussi le sous-type (précision pilote 07/09)

Le **numéro de PV** doit lui aussi refléter le sous-type. Aujourd'hui, pour #100299 :

```
refePv = "00002/MTP/PPM/PV/2026"   (attendu : "00002/MTP/PPM-AGPM/PV/2026")
```

Le contrat dit que `refePv` = `refeDossier` avec « /PV » inséré avant l'année. Donc **corriger la
référence du dossier (Demande 2) doit propager automatiquement** le sous-type au PV — À CONDITION que
la dérivation lise le `refeDossier` corrigé et ne recompose pas un code `PPM` indépendamment. Merci de
le **confirmer** (idéalement dériver `refePv` du `refeDossier` déjà généré).

⚠️ **Contrainte de cohérence — les deux DOIVENT bouger ensemble.** Le front relie un PV à son dossier
en reconstruisant la référence : `refePv.replace('/PV/', '/')` doit retomber sur `refeDossier`
(fallback pour les profils dont la chaîne est servie vide, ex. PRMP). Si le dossier passait à
`…/PPM-AGPM/…` mais que le PV restait `…/PPM/…` (ou l'inverse), **cette jointure casserait**. Le
round-trip reste exact tant que les deux portent le même segment — vérifié côté front, rien à y changer.

Point à trancher côté backend : le **périmètre temporel**.
- Les **nouvelles** références (à la génération, à la réception) : à corriger.
- Les références **déjà attribuées** (comme #100299) sont probablement **immuables** (imprimées /
  officielles) — les laisser telles quelles, sauf si le pilote demande explicitement une migration.
  Merci d'indiquer ce que vous retenez.

## Suite (07/09) — l'AMI déclenche l'AGPM AU-DELÀ D'UN SEUIL (réouverture)

V21 a exclu l'appel à manifestation d'intérêt du déclenchement. **Correction pilote : l'AMI EST une
procédure déclenchant l'AGPM, mais seulement au-delà d'un SEUIL de montant** (contrairement aux autres
appels d'offres, déclencheurs sans condition).

- L'AMI ne peut donc pas être un simple `declencheAgpm` booléen : c'est un **déclenchement
  conditionnel au montant**. Un marché passé par AMI déclenche l'AGPM **ssi son montant ≥ seuil**.
- ✅ **Décidé (pilote 07/09) — seuil ADMINISTRABLE** : la valeur du seuil est un **paramètre
  configurable** (pas une constante en dur), fixé et ajusté par le pilote depuis l'administration,
  sans redéploiement. (La valeur numérique elle-même sera saisie dans l'admin, pas dans le code.)
- ✅ **Décidé (pilote 07/09) — base de comparaison = le montant estimé de CHAQUE marché AMI**
  (comparaison **par marché**, cohérente avec la dérivation par marché déjà en place — PAS le total
  du dossier).
- Modes hors appel d'offres (consultation des prix, gré à gré) : toujours `PPM`, inchangés.

Conséquence : un plan comportant un marché AMI **au-dessus du seuil** devient `PPM-AGPM` (référence et
PV compris, via la mécanique déjà livrée) ; en-dessous du seuil, il reste `PPM`.

## Côté front — rien à changer

Le front **affiche `refeDossier` verbatim** et ne le découpe jamais (vérifié : aucun `split('/')`
sur la référence). Un segment contenant un tiret (`PPM-AGPM`) passe sans adaptation. La distinction
est déjà visible côté front par le champ `idSousType` (libellé « … et Avis Général … ») et l'onglet
« Projet d'AGPM ».

## Recette de contre-vérification

1. Créer un DDP avec au moins un marché en **appel d'offres ouvert** → `PPM-AGPM` → réf. `…/PPM-AGPM/…`.
2. Créer un DDP avec au moins un marché en **appel d'offres restreint** (et un autre **avec
   préqualification**) → `PPM-AGPM` aussi → réf. `…/PPM-AGPM/…` (c'est le cœur de la précision).
3. Créer un DDP **sans aucun appel d'offres** (consultation des prix, gré à gré) → sous-type `PPM` →
   référence `…/PPM/…` (inchangé).
4. Sur un dossier `PPM-AGPM`, produire le projet de PV → **`refePv = …/PPM-AGPM/PV/…`** (cohérent avec
   le dossier), et la jointure PV↔dossier (`refePv.replace('/PV/','/')`) retombe sur le `refeDossier`.
