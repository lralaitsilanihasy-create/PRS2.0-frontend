# Demande au backend `PRS20` — 7 septembre 2026 — PPM-AGPM pour tout appel d'offres + référence dossier ET numéro de PV reflétant le sous-type

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
