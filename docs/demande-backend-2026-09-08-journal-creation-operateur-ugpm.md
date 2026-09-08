# Signalement backend — Le journal attribue la CRÉATION à la PRMP au lieu de l'UGPM créatrice

> ✅ **CLÔTURÉ le 08/09** — backend livré (`7794f88`, 830 tests) et **contre-recetté en réel** sur
> #100305 (rétroactif, sans réimport) : la ligne `CREATION` porte désormais `nomOperateur` =
> « RALAITSILANIHASY Lantonirina Annick » (l'UGPM `creePar`), la `SOUMISSION` reste la PRMP. Front : rien
> à changer.
>
> ✅ **2ᵉ TOUR CLÔTURÉ le 08/09** — backend livré (`4b391a5`, 832 tests) + note front (`356dee3`). ①
> **Ordre uniformisé** en « NOM Prénoms » (source unique `ActeurDirectory.nomCanonique`, toutes les
> lignes, rétroactif) — **contre-recetté réel sur #100305** : SOUMISSION « La Personne Randrianarivo » →
> **« Randrianarivo La Personne »**, RÉCEPTION « Secretaire ANT Rasoa » → **« Rasoa Secretaire ANT »**,
> les 3 lignes enfin identiques. ② **Auteur réel étendu** à toute ligne (dérivé de l'auteur DE LA LIGNE,
> pas de `creeParNom`) — appliqué en général mais **NON REJOUABLE en recette** : une UGPM ne peut ni
> resoumettre ni transmettre de compléments (`/soumettre`, `/resoumettre`, `/transmettre-complements*` =
> `hasRole('PRMP')`, 403), la création reste son seul geste consigné. Front : rien à changer.
> ⚠️ **Question d'HABILITATION ouverte, distincte du journal** : faut-il qu'une UGPM puisse resoumettre /
> transmettre des compléments pour sa PRMP ? Tant que non, ② n'a pas d'effet visible.

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

---

## Arbitrages rendus par le pilote — 2026-09-08 (2ᵉ tour, à traiter par le backend)

Le pilote a tranché les deux points de la note de livraison. **Aucun impact front attendu** (la colonne
« Opérateur » affiche `nomOperateur` tel que servi). Les deux corrections sont côté backend.

### ① Uniformiser l'ordre des noms — **OUI**

Toutes les lignes du journal doivent afficher les noms d'opérateur selon **une seule et même
convention**, quelle que soit la source (`creeParNom` de l'annuaire des unités, ou l'annuaire des PRMP).
Aujourd'hui la CRÉATION rend « NOM Prénoms » et la SOUMISSION « Prénoms Nom » pour une même personne :
c'est cette double convention dans un même tableau qui est refusée.

- **Convention cible suggérée : « NOM Prénoms »** (nom de famille en tête), qui est la forme
  administrative usuelle des documents officiels — mais le choix de la convention canonique vous revient,
  du moment qu'elle est **identique sur toutes les lignes** du journal. À appliquer à la lecture (comme
  le reste de la fusion), donc rétroactif.

### ② Étendre la dérivation à TOUS les gestes d'un agent UGPM — **OUI (auteur réel)**

Le journal doit nommer **l'auteur réel de chaque geste**, pas l'opérateur sous mandat. Toute action
consignée effectuée par un agent UGPM (`RESOUMISSION`, `MISE_A_JOUR`, et toute autre du même ordre) doit
porter le **nom de l'UGPM** qui l'a réellement faite, exactement comme la `CREATION` le fait désormais —
et non le nom de sa PRMP de tutelle. C'est le prolongement cohérent du constat d'origine, sur les lignes
que la première livraison n'avait pas couvertes.

- Même mécanique que ① : dérivation à la lecture, rétroactive, mêmes replis (auteur réel connu →
  jamais remplacé par un login brut).
- `idPrmpOperateur` : on garde le raisonnement de la 1ʳᵉ livraison (PRMP de tutelle, pour ne pas allumer
  le marqueur « opérateur ≠ attributaire ») — **seul le nom affiché change de source.**

> Contre-recette du 2ᵉ tour : sur un dossier créé + soumis par la même PRMP, les deux lignes affichent le
> même ordre de nom ; sur un dossier resoumis / mis à jour par une UGPM, ces lignes portent le nom de
> l'UGPM (`creeParNom`) et non celui de la PRMP.

---

## Note de livraison backend — 2ᵉ tour — 2026-09-08 (`PRS20`, commit `4b391a5`)

Les deux arbitrages sont livrés, sans migration, **rien à changer côté front**. Contrat :
`docs/regles-gestion.md` (§ journal du dossier) et `docs/api-endpoints.md` (§ Journal des actions).
Suite : **832 tests verts**.

### ① Convention canonique retenue : « NOM Prénoms »

C'est celle que vous suggériez, et celle que servait déjà `creeParNom`. Elle vit désormais à **un seul
endroit** (`ActeurDirectory.nomCanonique`) où passent les **trois** annuaires — unités, PRMP,
contrôleurs — ainsi que le nom d'affichage du login. Le défaut ne venait pas d'un annuaire fautif mais
de l'**absence de source unique** : c'est elle qui manquait, pas une correction dans chacun.

Dérivée à la lecture, donc **rétroactive** : une ligne écrite « Prénoms Nom » se relit « NOM Prénoms »,
sans reprise de données et sans rien réécrire en base.

### ② L'auteur réel, sur toutes les lignes — avec une nuance de mécanique

Le nom est dérivé de l'auteur **de chaque ligne**, et non du `creeParNom` du dossier. Le résultat est le
même dans le cas que vous décrivez, mais il reste juste quand deux agents différents interviennent :
prendre `creeParNom` à la lettre aurait nommé le **créateur** sur toutes les lignes, y compris sur un
geste posé par quelqu'un d'autre. La `CREATION` garde sa source propre (`CREE_PAR`), qui fait foi même
quand la ligne est muette.

L'auteur d'une ligne n'a pas toujours la même forme : *login* pour une action consignée, *matricule* de
contrôleur pour un événement dérivé ou une copie figée, *identifiant de PRMP* pour une demande de
retrait. Les trois annuaires sont donc interrogés, chacun **une seule fois** par lecture de journal.
Sans résolution, le nom stocké est conservé — jamais remplacé par un identifiant brut.
`idPrmpOperateur` ne bouge pas, comme au 1ᵉʳ tour.

### ⚠️ La contre-recette (2) ne pourra pas être jouée telle quelle

**Une UGPM ne peut pas resoumettre ni mettre à jour** : `/soumettre`, `/resoumettre` et
`/transmettre-complements*` portent `@PreAuthorize("hasRole('PRMP')")` et répondent **403** à une unité.
La **création** est aujourd'hui son seul geste consigné. Il n'existe donc aucun chemin, dans l'interface
comme dans l'API, pour produire un dossier « resoumis par une UGPM ».

L'arbitrage ② est néanmoins appliqué **en général** — la dérivation porte sur l'auteur de la ligne, pas
sur son type. Concrètement : elle corrige déjà les lignes de cette forme présentes en base, et elle
vaudra sans retouche le jour où les droits s'ouvriront. Le test de non-régression l'éprouve sur la forme
des lignes (`RESOUMISSION` et `MISE_A_JOUR` dont l'auteur est l'UGPM) **et** vérifie le 403.

> ⚠️ **Point à arbitrer, s'il vous intéresse** : faut-il qu'une UGPM puisse resoumettre ou transmettre
> des compléments pour la PRMP dont elle dépend ? C'est une décision sur les **habilitations**, pas sur
> le journal — dites-le et je la traite comme une demande à part entière.

### Ce que vous verrez changer sans l'avoir demandé

- Sur un dossier créé **et** soumis par la même PRMP, la ligne de soumission passe de « Prénoms Nom » à
  « NOM Prénoms ». C'est l'effet voulu de ① : les deux lignes s'écrivent enfin pareil.
- Les lignes de **contrôleur** (dispatch, réattribution, réception…) et les **événements dérivés** (visa,
  signatures, vérification, SIGMP) adoptent la même convention. Ils étaient dans l'ancien ordre eux
  aussi ; les laisser aurait reconduit le défaut sur les deux tiers du tableau.
- Le nom d'auteur des **versions archivées** (`/versions-archivees`) suit la même convention, la
  résolution étant partagée — mais là il est **stocké**, pas dérivé : seules les versions archivées à
  partir de maintenant portent le nouvel ordre, les précédentes gardent celui qu'elles ont figé. C'est
  cohérent avec le principe d'une version archivée, immuable par construction. Aucune autre donnée ne bouge.

### Tests

`JournalOperateurReelIntegrationTest` (renommé — son sujet déborde la seule création), six tests : les
deux points de la contre-recette, la rétroactivité sur une ligne écrite avant le correctif, les replis,
et la cohérence journal ↔ `creeParNom`. Un test existant sur la reprise de traitement par une PRMP
successeur encodait l'ancien ordre : mis à jour, avec la raison en commentaire — c'est la meilleure
preuve que la convention a changé partout.

---

## Clôture — habilitation UGPM tranchée, 2026-09-08 (`PRS20`, commit `e9db492`)

Le pilote a répondu à la question laissée ouverte en fin de 2ᵉ tour : **on garde création seule**.
L'UGPM saisit et crée le dossier ; les **actes formels** — soumission, resoumission, transmission de
compléments — restent à la PRMP. La formule retenue : **« l'UGPM saisit, la PRMP engage »**.

**Aucun code n'a bougé.** Les `hasRole('PRMP')` de `/soumettre`, `/resoumettre` et
`/transmettre-complements*` restent en place, et une UGPM continue d'y recevoir **403**. Le commit ne
touche que les deux documents de référence : c'est un enregistrement de décision, pas une livraison.

- La décision est écrite dans `docs/regles-gestion.md` et `docs/api-endpoints.md`, et la règle du
  **2026-08-26** qui posait déjà ce partage est marquée **reconfirmée**. La question s'était reposée
  d'elle-même en étendant le journal ; mieux vaut une trace qui dit pourquoi elle a été refermée dans le
  même sens qu'un silence laissant croire à un oubli.
- ⚠️ **La dérivation « auteur réel » reste en place, dormante.** Elle porte sur l'auteur de chaque ligne
  et non sur le type d'action : elle corrige déjà les lignes de cette forme présentes en base, et
  vaudrait sans retouche si ce partage des rôles évoluait un jour. Une consigne est posée aux deux
  endroits : **ne pas la spécialiser à `CREATION`** pour « simplifier » — ce serait reconduire
  exactement le défaut d'origine.
- **Conséquence pour la recette** : le point (2) de la contre-recette du 2ᵉ tour n'est pas jouable, et
  ne le sera pas. Il n'existe aucun chemin pour produire un dossier resoumis par une UGPM. Le point (1)
  — ordre de nom identique sur toutes les lignes — reste, lui, entièrement vérifiable à l'écran.

**Chantier journal clos des deux côtés.** Récapitulatif des trois livraisons : `7794f88` (la création
porte son auteur réel), `4b391a5` (ordre uniforme + auteur réel sur toutes les lignes), `e9db492`
(habilitation tranchée, documentation).
