# Demande backend — Import du DAO : une passe « par clause » après la lecture par le modèle (premier temps)

**Date** : 2026-10-03 · **Émetteur** : front · **Origine** : note de décision
`docs/note-decision-2026-10-03-lecture-par-clause.md`, option **A** (lecture hybride) retenue par le pilote le 03/10.
Prototype : `scripts/import-dao/clauses.mjs`, branché dans `lire()` (`scripts/import-dao/lire.mjs`, `completerParClause`).

## B1 — La passe par clause

Après la lecture par le modèle d'un **DPAO** (DPAO-T pour les travaux, DPAO-F pour les fournitures ; aucun autre
document), une seconde passe s'exécute sur les mêmes paragraphes. Elle ne remplace rien.

1. **Section** : la passe ne cherche que dans la section des données particulières, qui commence au paragraphe portant
   « Les données particulières ci-après complètent ». À défaut, elle prend le premier titre numéroté « n.n. - Données
   particulières… », et cherche dans les 700 paragraphes suivants. Sans section trouvée, la passe ne fait rien.
2. **Catalogue** (premier temps, 5 informations) : une ancre, une forme de valeur, et une fenêtre de paragraphes.

| information | travaux | fournitures | ancre | forme de la valeur | fenêtre |
|---|---|---|---|---|---|
| validité des offres | `B04-VO-01` | `B04-VO-01` | « validité des offres » | durée : mots de nombre + `(n)` ou `n`, puis « jours » ou « mois » | 3 |
| garantie de soumission | `B05-GQ-03` | `B05-GS-03` | « garantie de soumission » | montant | 2 |
| délai d'exécution | `B09-DL-01` | — | « délai d'exécution » | durée | 3 |
| liquidité | `B03-QT-14`, ou `B03-QT-15` si « % » | — | « liquidité » ou « ligne de crédit » | montant ou pourcentage | 2 |
| lieu d'ouverture des plis | `B04-OV-01` | `B04-OP-01` | « ouverture des plis » | « Lieu : … » ou « Bureau : … » (6 à 80 caractères) | 3 |

   - Les expressions exactes sont celles de `CATALOGUE` dans `clauses.mjs`.
   - On prend la première ancre dont la fenêtre porte une valeur de la bonne forme.
3. **Par lot** (garantie, liquidité) : dans la fenêtre, deux montants ou plus rattachés à un lot donnent `CODE#n`.
   - On essaie d'abord la forme « Lot n° 1 : … 1 600 000 », où le montant peut suivre un long « en lettres » : jusqu'à
     120 caractères sans chiffre.
   - Si cette forme ne donne pas au moins deux lots, on essaie « (Ar 99 000 000) pour le lot n°1 » ou « 9 900 000 Ar
     (lot 1) ».
   - L'ordre compte : essayée en premier, la seconde forme appariait chaque montant au lot de la ligne suivante.
4. **Garde-fous** :
   - pas de proposition pour un champ déjà proposé par la lecture du modèle (code nu), ni pour un champ que le
     référentiel ne sert pas ;
   - la valeur passe par la même conversion (`valeurSaisie`) ; une durée lue pour un `NOMBRE` perd son unité ;
   - la confiance est toujours **`moyenne`**, et la source **`clause`**.

> ⚠️ **Livraison backend du 2026-10-03 (§B1).** Conforme : `LectureClauses` porte `clauses.mjs` (section, catalogue,
> par lot dans l'ordre, passages), et `LectureDao.completerParClause` porte `completerParClause`. Les expressions sont les
> vôtres : `\s` y est la classe des blancs de JavaScript, `\b` une frontière ASCII, et la casse est ignorée en Unicode.
> **Un écart, au service d'import** : une valeur `clause` n'est ajoutée qu'**après la lecture de tous les modèles**, pour
> un champ qu'**aucun** n'a proposé. Une validité lue à l'AE par le modèle n'est donc pas doublée d'une validité lue au
> DPAO par clause : votre `lire()`, document par document, ne connaît pas ce cas, et en ferait un conflit.

## B2 — Les passages de listes

Les listes ne sont pas découpées par la passe : l'essai donnait 1 liste juste sur 6. La passe repère le **passage**, et
l'écran le propose dans « Coller une liste », où la PRMP vérifie l'aperçu.

- `passages: [{ liste: 'MATERIEL' | 'PERSONNEL' | 'PIECES', texte, paragraphe }]`, nouveau dans `ImportDaoResult`.
- Le texte va de l'ancre à la clause suivante, sur 25 paragraphes au plus, lignes séparées par `\n`. Les ancres et les
  fins sont celles de `PASSAGES` dans `clauses.mjs`.
  - `MATERIEL` et `PERSONNEL` : travaux seulement ;
  - `PIECES` : travaux et fournitures. C'est « Documents ou pièces à remettre en sus… », jusqu'à la clause 6.3.

> ⚠️ **Livraison backend du 2026-10-03 (§B2).** Conforme : `passages` dans `ImportDaoResult`, au format
> `{ liste, texte, paragraphe }`, texte de l'ancre à la fin (25 paragraphes au plus), lignes séparées par `\n`.

## B3 — Le contrat de `POST …/import`

- `PropositionImport` reçoit **`source`** : `'modele'` (la lecture actuelle) ou `'clause'`. L'écran l'affiche : une valeur
  trouvée par clause est dite « trouvée par ses mots-clés, à vérifier ».
- `ImportDaoResult.passages` : voir B2. Vide par défaut.
- Rien d'autre ne change : `appliquer` reçoit les lignes retenues comme aujourd'hui. Les passages ne s'appliquent pas :
  ils se collent dans la liste.

> ⚠️ **Livraison backend du 2026-10-03 (§B3).** Conforme : `source` (`modele` | `clause`) sur chaque proposition, et
> `passages`, vide par défaut. `appliquer` ne change pas.

## Mesures du front (DAO réels, `lire()` avec le référentiel de la forme du marché)

| DAO | valeurs proposées avant → après | ajouts de la passe | justes |
|---|---|---|---|
| MTP routier, DPAO-T | 1 → **4** | garantie 100 500 000, délai « Six (06) mois », liquidité 10 %, lieu (déjà lu) | 3 sur 3 |
| MEN, DPAO-T | 9 → **12** | délai « CENT VINGT (120) Jours », liquidité lot 1 = 99 000 000, lot 2 = 72 000 000 | 3 sur 3 |
| 2463, DPAO-F | 9 → **14** | garantie des 5 lots (1 600 000 / 2 170 000 en alternance) | 5 sur 5 |

- Passages repérés : le matériel du MTP (son tableau), les pièces du MEN (rangées au 1°) et du 2463.
- **Banc** (propre, 12 graines, `--defauts --quantite-fixe`) : **identique ligne pour ligne**, Q10 tenu sur 14 passes.
  La passe n'y ajoute rien, puisque le modèle y trouve tout. Le banc passe désormais par `lire()`, le point d'entrée de
  l'import réel.
- **Manques connus** : la garantie du MEN ; la validité du MTP et du 2463 (« soixante-quinze (75j) » n'a pas d'unité
  complète) ; les passages du personnel. C'est la matière du second temps, si la mesure tient.

**Recette attendue** : la parité habituelle sur les 20 documents, où seules les propositions de source `clause` et les
passages s'ajoutent, plus les trois DAO réels ci-dessus avec les mêmes ajouts.

> ⚠️ **Livraison backend du 2026-10-03 — recette.**
> - **Parité** sur les 20 documents, `lire()` des deux côtés : extraction identique, **1 185 lignes identiques**, dont
>   23 propositions `clause` et 16 passages.
>   - Le référentiel du banc a été complété de `B03-QT-15` à `B03-QT-20`. Sans eux, la liquidité de 10 % du MTP était
>     écartée, des deux côtés.
> - **DAO réels**, les mêmes ajouts que les vôtres :
>   - MTP : `B05-GQ-03` = 100 500 000, `B09-DL-01` = « Six (06) mois », `B03-QT-15` = 10, et le passage du matériel ;
>   - MEN : `B09-DL-01` = « CENT VINGT (120) Jours », `B03-QT-14#1` = 99 000 000, `#2` = 72 000 000, et le passage des
>     pièces ;
>   - 2463 : `B05-GS-03#1` à `#5` (1 600 000 / 2 170 000), et le passage des pièces.
> - `LectureClausesTest` : section (les IC sont ignorées), catalogue des travaux, par lot sous ses deux formes, garde-fous
>   (déjà lu, champ non servi, pas de section, hors DPAO), passage des pièces arrêté à la 6.3.
> - `ImportDaoIntegrationTest.allerRetourFournitures` : sur un DAO conforme, toutes les propositions sont `modele`, et le
>   passage des pièces est rendu.
> - Ni migration ni script.
