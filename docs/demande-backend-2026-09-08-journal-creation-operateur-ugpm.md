# Signalement backend — Le journal attribue la CRÉATION à la PRMP au lieu de l'UGPM créatrice

> ✅ **CLÔTURÉ le 08/09** — backend livré (`7794f88`, 830 tests) et **contre-recetté en réel** sur
> #100305 (rétroactif, sans réimport) : la ligne `CREATION` porte désormais `nomOperateur` =
> « RALAITSILANIHASY Lantonirina Annick » (l'UGPM `creePar`), la `SOUMISSION` reste la PRMP. Front : rien
> à changer. ⚠️ **Deux points laissés à l'arbitrage du pilote** (voir la note de livraison en bas) :
> (1) incohérence d'ORDRE des mots (« NOM Prénoms » en création vs « Prénoms Nom » en soumission pour la
> même personne) ; (2) les AUTRES gestes d'un agent UGPM (RESOUMISSION, MISE_A_JOUR) portent encore le nom
> de sa PRMP de tutelle — même écart, non étendu sans décision.

**Date** : 2026-09-08 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : constat pilote — un
dossier **créé par une UGPM** puis **soumis par la PRMP** apparaît dans le journal des actions avec la
CRÉATION attribuée à la **PRMP**, pas à l'UGPM.

## Constat (dossier #100305)

Le `DossierDto` porte la bonne donnée :

```json
{
  "idDossier": 100305,
  "creePar": "UGPM002", "creeParNom": "RALAITSILANIHASY Lantonirina Annick",   // l'UGPM
  "soumisPar": "PRMP001", "soumisParNom": "Randrianarivo La Personne",          // la PRMP
  "idPrmp": "IMP001"
}
```

Mais `GET /api/dossiers/100305/journal` dérive :

```
CREATION    nomOperateur = "La Personne Randrianarivo"  (idPrmpOperateur = IMP001)   ← la PRMP, FAUX
SOUMISSION  nomOperateur = "La Personne Randrianarivo"                               ← la PRMP, correct
RECEPTION   nomOperateur = "Secretaire ANT Rasoa"                                     ← correct
```

La **CRÉATION** est attribuée à la **PRMP** (via `idPrmp`/l'attribution PRMP), alors que le dossier a
été **créé par l'UGPM** (`creePar = UGPM002`). La SOUMISSION, elle, est correctement rattachée à
`soumisPar` (la PRMP).

## Demande

Dans la dérivation du journal (fusion à la lecture), l'événement **`CREATION`** doit prendre son
opérateur dans **`creePar` / `creeParNom`** (le créateur réel — l'UGPM quand c'est elle qui a saisi le
brouillon), **pas** dans l'attribution PRMP du dossier. La donnée existe déjà sur le dossier
(`creePar`/`creeParNom`), il s'agit juste de l'utiliser pour cette ligne.

- `SOUMISSION` reste sur `soumisPar`/`soumisParNom` (déjà correct).
- Rétroactif comme le reste de la fusion (les dossiers déjà créés par une UGPM doivent se corriger à
  la relecture).
- Visibilité : la création reste un acte de rang 0 (visible de tous), qu'elle soit d'une PRMP ou
  d'une UGPM.

## Côté front — rien à changer

Le front affiche `nomOperateur` tel que servi par le journal (colonne « Opérateur »). Dès que la
dérivation renseigne le créateur réel, la colonne affichera l'UGPM sans adaptation.

## Recette de contre-vérification

1. UGPM crée un dossier (login UGPM) puis la PRMP le soumet.
2. `GET /dossiers/{id}/journal` : la ligne `CREATION` doit porter `nomOperateur` = **le nom de l'UGPM**
   (`creeParNom`), et `SOUMISSION` = le nom de la PRMP (`soumisParNom`).

---

## Note de livraison backend — 2026-09-08 (`PRS20`, commit `7794f88`)

Livré sans migration, **rien à changer côté front** comme annoncé. Contrat : `docs/regles-gestion.md`
(§ journal du dossier) et `docs/api-endpoints.md` (§ Journal des actions). Suite : **830 tests verts**.

### Ce qui change

`nomOperateur` **et** `auteur` de la ligne `CREATION` sont désormais dérivés du `CREE_PAR` du dossier,
résolu par le **même annuaire** que `creeParNom`. Le journal et le `DossierDto` servent donc la même
chaîne, au caractère près — la colonne « Opérateur » affichera l'UGPM sans adaptation.

| Ligne du 100305 | Avant | Maintenant |
|---|---|---|
| `CREATION` · `nomOperateur` | « La Personne Randrianarivo » (la PRMP) | **« RALAITSILANIHASY Lantonirina Annick »** (l'UGPM) |
| `CREATION` · `auteur` | `UGPM002` | `UGPM002` (inchangé — la donnée était déjà juste) |
| `CREATION` · `idPrmpOperateur` | `IMP001` | `IMP001` (**inchangé**, voir ci-dessous) |
| `SOUMISSION` | la PRMP | la PRMP (**inchangé**) |

**Dérivé à la lecture, donc rétroactif** : les dossiers déjà créés se corrigent d'eux-mêmes. Rien n'est
réécrit en base, aucune reprise de données. Le 100305 est correct dès la prochaine ouverture du journal
— j'ai remonté la chaîne en base pour le vérifier : `CREE_PAR = UGPM002` → compte de type UGPM →
unité `303230` → « RALAITSILANIHASY Lantonirina Annick ».

### Pourquoi `idPrmpOperateur` ne bouge pas

C'est la PRMP de **tutelle**, sous l'autorité de laquelle l'UGPM a saisi, et c'est ce qui donne son sens
au couple opérateur/mandat. Y mettre l'UGPM allumerait votre marqueur « opérateur ≠ attributaire », qui
signale qu'une **autre PRMP** a agi — un contresens ici. Seul le nom, qui est ce que l'utilisateur lit,
a changé de source.

**Replis, dans l'ordre** : le `CREE_PAR` du dossier, puis le login consigné sur la ligne (dossier
antérieur à la colonne), puis le nom stocké. Un nom connu n'est **jamais** remplacé par un login brut.

### Deux points à connaître

- ⚠️ **Ordre des mots.** Sur un dossier créé *et* soumis par la même PRMP, `CREATION` adopte désormais
  l'ordre « NOM Prénoms » de `creeParNom`, tandis que `SOUMISSION` garde l'ordre « Prénoms Nom » de
  l'annuaire des PRMP. Même personne, deux conventions d'affichage dans le même tableau. C'est le prix
  de l'alignement demandé entre le journal et `creeParNom` ; dites-le si vous voulez que j'uniformise —
  c'est un choix d'affichage, pas une règle.
- ⚠️ **Les autres actions d'un agent UGPM portent encore le nom de sa PRMP.** Une `RESOUMISSION` ou une
  `MISE_A_JOUR` faite par l'UGPM est nommée au nom de la tutelle : c'est le **même écart** que celui que
  vous avez signalé, sur des lignes que vous n'avez pas signalées. Je ne l'ai pas étendu sans arbitrage —
  la correction serait du même ordre. À trancher par le pilote : le journal doit-il nommer l'auteur réel
  de **chaque** geste, ou l'opérateur responsable sous mandat ?

### Tests

`JournalCreationOperateurIntegrationTest`, quatre tests : l'UGPM crée et le journal la nomme (avec la
cohérence journal ↔ `creeParNom` vérifiée sur la même réponse) ; l'UGPM crée et la PRMP soumet, deux
opérateurs distincts ; une ligne écrite **avant** le correctif se corrige à la relecture sans que la base
bouge ; et les replis, qui conservent le nom stocké quand le créateur est inconnu ou absent.
