# Demande au backend `PRS20` — 7 septembre 2026 — La référence doit refléter le sous-type PPM-AGPM

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

Le dossier déclenche l'AGPM (marchés en appel d'offres ouvert) → son sous-type dérivé est
`PPM-AGPM`, et l'onglet « Projet d'AGPM » est présent. Or le **générateur de référence a utilisé le
code de base `PPM`** et non le code du sous-type réel — la référence ne distingue pas un plan simple
d'un plan avec AGPM, alors que les deux sous-types ont des grilles de contrôle (7 vs 8 points) et des
modèles de PV différents.

## Demande (arbitrage pilote 07/09 : « refléter le sous-type »)

Le **segment de type de la référence** d'un dossier de planification (DDP) doit reprendre le **code
du sous-type dérivé** :

- plan déclenchant l'AGPM → sous-type `PPM-AGPM` → référence **`00002/MTP/PPM-AGPM/2026`** ;
- plan simple → sous-type `PPM` → référence `00002/MTP/PPM/2026` (inchangé).

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

1. Créer un DDP avec au moins un marché en **appel d'offres ouvert** (déclenche l'AGPM) → sous-type
   dérivé `PPM-AGPM` → à la réception, la référence doit être `…/PPM-AGPM/…`.
2. Créer un DDP **sans** mode déclencheur → sous-type `PPM` → référence `…/PPM/…` (inchangé).
