# Demande backend — 2026-10-17 — L'import déduit aussi les valeurs de champs que le DAO dit par une rédaction choisie

## Contexte

Le pilote a importé dans la fiche des consomptibles informatiques (ligne 303339) le DAO
`PDF_generes/DAO_CC_303339_consomptibles_informatiques_charte_application.pdf`, puis il a appliqué les propositions.

Après l'application, quatre informations **obligatoires** restaient à saisir. Trois d'entre elles sont pourtant dites par le
DAO, ou s'en déduisent :

| Champ | Type | Comment le DAO le dit | Pourquoi l'import ne le propose pas |
|---|---|---|---|
| `B09-AU-01` Assurance exigée du titulaire | OUI_NON | Par la **rédaction retenue** : section `ASSURANCE-NON` ou `ASSURANCE-OUI` de l'AE-CC | La lecture déduit d'une section reconnue les termes de **cadrage** de sa condition, pas les termes de **champ** |
| `B09-EA-01` Modalités d'exécution communes aux marchés subséquents | OUI_NON | Section `EXECUTION-SANS` ou `EXECUTION-COMMUNE` de l'AE-CC | Même cause |
| `B04-CD-01` Fiches de renseignements jointes (A1…A4) | LISTE_MULTIPLE | Par la **présence** des formulaires A1 à A4 dans le DAO, qui sont des titres de partie (« A1 : IDENTIFICATION DU CANDIDAT »…) | Aucun jeton ni aucune section : le champ choisit des documents, il ne s'imprime pas |
| `B07-DE-01` Délais d'exécution des marchés subséquents uniques | LISTE | **Nulle part** : les sections `DELAI-*` n'existent que si `B07-FS-01 = Marchés uniques non fractionnés`. Ici, les marchés sont fractionnés par bons de commande | Rien à lire : c'est le référentiel qui est en cause (B3) |

## B1 — Une section reconnue propose aussi les valeurs de champ de sa condition

Aujourd'hui, une section dont un paragraphe à **texte fixe** est reconnu donne les termes `cle = valeur` de sa condition. C'est
la règle 5 de la lecture par modèle inversé. Seuls les termes de **cadrage** deviennent des réponses.

Demande : un terme dont la clé est un **code de champ** (`B09-AU-01 = NON`) devient une **proposition** de ce champ :
- `source: "section"`, avec l'extrait du paragraphe reconnu ;
- confiance `moyenne` : à vérifier, jamais cochée d'office. Une rédaction peut avoir été reprise d'un autre DAO ;
- **conjonction** : `DELAI-AC: B07-FS-01 = … et B07-DE-01 = …` propose chacun de ses termes, comme la règle des réponses
  de cadrage le fait déjà ;
- **deux sections contraires reconnues** (`ASSURANCE-OUI` et `ASSURANCE-NON`) donnent un **conflit**, pas une proposition ;
- la proposition passe par la validation habituelle (`normaliser`, conditions du cadrage). Un refus devient une anomalie de la
  proposition.

Sur le DAO de la ligne 303339, cela donnerait `B09-AU-01 = NON` et `B09-EA-01 = NON`.

> ⚠️ **2026-10-17, livré côté backend (B1), avec un écart de diagnostic.**
> - **Le mécanisme demandé existait déjà.** Une section reconnue propose les termes de champ de sa condition (`reponsesChamps`), en
>   confiance `moyenne`, avec l'extrait « rédaction retenue (section … de AE-CC) ». Sur ce DAO, `B07-FS-01 = Marchés fractionnés…`
>   était déjà proposé depuis `FS-FRACTIONNE`. Le champ `source` vaut `modele`, pas `section`.
> - **La cause réelle** : `ASSURANCE-NON` et `EXECUTION-SANS` ne contiennent que « Sans objet ». Or une section n'était attestée que
>   par un paragraphe d'au moins 20 lettres fixes qui lui soit propre (règle 7).
> - **Nouvelle règle 10 de `LectureDao`, l'attestation par encadrement.** Une section faite seulement de texte court, sans jeton ni
>   paragraphe distinctif, est attestée à deux conditions :
>   - la dernière unité reconnue avant elle et la première après elle sont reconnues ;
>   - entre les deux, le document porte exactement son texte, paragraphe pour paragraphe : normalisé, ponctuation finale
>     ignorée, reste de ponctuation seul écarté.
>
>   Un paragraphe de plus suffit à l'écarter : au 6114, « Sans objet » est suivi de « Les dispositions de l'article 17 du CCAG
>   Fournitures sont applicables », et l'assurance n'y est pas proposée.
> - **À reporter dans `lire.mjs`** (fonction `encadrees` de `LectureDao`) pour garder la parité.
> - **Conflit** : deux sections contraires attestées donnent un conflit, comme avant (règle de l'étape 3, inchangée).

## B2 — `B04-CD-01` déduit des formulaires présents

Quand le DAO contient les titres des fiches de renseignements, proposer `B04-CD-01` = la liste des fiches trouvées. C'est le
cas des formulaires du candidat que l'application génère (`modeles/candidat/A1.txt`…`A4.txt`, titre `TITRE`), comme de ceux
d'un DAO externe. Exemple : `A1,A2,A3,A4`. La proposition se fait :
- en `source: "clause"`, confiance `moyenne` ;
- uniquement sur un **titre** de formulaire, jamais sur une simple mention dans les instructions aux candidats. Les règles
  d'exclusion des IC et du CCAG livrées le 17/10 (demande « cadrage-depuis-dao ») s'appliquent.

> ⚠️ **2026-10-17, livré côté backend (B2)** : `CadrageParClause.fiches`, en `source: "clause"` et confiance `moyenne`, proposé
> seulement si aucun modèle n'a déjà dit `B04-CD-01`.
> - **Un titre** : un paragraphe court qui commence par « A1 » à « A4 » et porte le mot de sa fiche (IDENTIFICATION, CAPACITÉS
>   TECHNIQUES, CAPACITÉS FINANCIÈRES, ANTÉCÉDENTS : « A4 » seul peut être un format de papier). Il est suivi de son contenu ou de
>   son sous-titre (« A1 - a) … »).
> - **Écarté** :
>   - une ligne de sommaire, suivie du titre d'une autre fiche ou d'un en-tête de partie ;
>   - un paragraphe qui porte le code d'une autre fiche, comme une ligne de sommaire collée (297) ;
>   - toute mention dans les IC, le CCAG ou le sommaire.
> - **Dans la partie « Formulaires »**, « A1 : IDENTIFICATION… » vaut aussi au milieu d'un paragraphe. L'extraction du DAO de 303337
>   y colle plusieurs titres ; les deux-points distinguent ce titre de la ligne de sommaire « A1 - … ».
> - **À reporter dans le prototype** si le front lit aussi `B04-CD-01`.

## B3 — Question : `B07-DE-01` exigé même quand il ne sert pas

`B07-DE-01` est obligatoire et sans condition. Pourtant, il ne sert qu'aux marchés subséquents **uniques non fractionnés** :
les trois sections `DELAI-*` de l'AE-CC exigent `B07-FS-01 = Marchés uniques non fractionnés`. Il en va de même pour la liste
des fournitures et le calendrier (`DaoCompletService.tableaux`, condition `DELAI-AC`).

**Q1** : le champ doit-il porter la condition `B07-FS-01 = Marchés uniques non fractionnés` (référentiel des champs) ? Sans
cela, la PRMP doit répondre à une question sans effet sur son DAO. Le pilote l'a fait ici sur la ligne 303339.

> ⚠️ **2026-10-17, réponse du backend à Q1 : pas sous cette forme ; option 2 livrée.**
> - **Pourquoi pas une condition** : la grammaire des conditions d'affichage, la même au serveur (`ConditionCadrage`) et au front
>   (`evaluerCondition`), n'admet qu'une **clé de cadrage** et une **valeur sans espaces** (`^[A-Za-z_][A-Za-z0-9_]*\s*(=|!=)\s*[A-Za-z0-9_]+$`).
>   `B07-FS-01 = Marchés uniques non fractionnés` y serait un terme illisible, donc faux : le champ ne s'afficherait plus jamais.
> - **Livré (option 2)** : le champ reste affiché, mais il **ne bloque plus le bilan** (`ControlesFicheMarche.sansObjet`) quand
>   `B07-FS-01` dit d'autres marchés que des marchés uniques non fractionnés. Il bloque toujours quand `B07-FS-01` est vide.
> - **À décider côté front** : retirer l'astérisque d'obligation de `B07-DE-01` dans ce cas, ou ne rien changer.
> - **Si le front veut masquer le champ (option 1)** : il faut étendre la grammaire des deux côtés (codes de champ, valeurs entre
>   guillemets), dans une demande à part.

## Mesure — condition de livraison

- **DAO de la ligne 303339** : `B09-AU-01 = NON`, `B09-EA-01 = NON` et `B04-CD-01 = A1,A2,A3,A4` sont proposés.
- **Les sept DAO réels de la mesure de l'import** : on relève par champ les propositions de B1 et de B2, justes et fausses.
  **Aucune fausse proposition** : c'est le critère bloquant, comme le critère Q10 du plan de l'import.

> ⚠️ **2026-10-17, mesure du backend** (`ChampsDeduitsRecetteTest`) : **11 propositions, aucune fausse.** L'attendu vient du jeu
> 2463 vérifié pour `B04-CD-01`, et de la lecture à la main du passage pour les autres.
>
> | DAO | B1 (encadrement) | B2 (`B04-CD-01`) |
> |---|---|---|
> | 2463 | — | `A1,A2,A3,A4` |
> | 297 | `B05-MO-01 = Ariary` (section `ARIARY` du DPAO-F) | — (ligne de sommaire collée, écartée) |
> | 6114 | `B09-EA-01 = NON` | — |
> | 6213 | `B09-AU-01 = NON` | — |
> | Ankily-Mahasoa | — | `A1,A2,A3,A4` |
> | DAO complet 303337 (v3) | `B09-AU-01 = NON` | `A1,A2,A3,A4` |
> | DAO de 303339 | `B09-AU-01 = NON`, `B09-EA-01 = NON` | `A1,A2,A3,A4` |
>
> - **Écartées en cours de mesure, deux listes partielles fausses** : A1 seul (297) et A2 à A4 sans A1 (303337).
> - **Le DAO de 303339 lu pour un contrat-cadre** donne les trois valeurs attendues (`ImportDaoIntegrationTest.cadrageDuDao303339`).
>   Il ne reste alors à saisir que `B07-DE-01`, qui ne bloque plus la validation (Q1, option 2).

## Ce que le front fera, dès la livraison

- Rien de nouveau à l'écran : les propositions passent par la revue actuelle (« à vérifier », extrait du document).
- Si Q1 est accepté, le champ disparaît de la saisie quand les marchés subséquents sont fractionnés. Le front s'appuie sur les
  conditions du référentiel servi, il n'y a rien à coder.
- Recette sur le DAO de la ligne 303339.
