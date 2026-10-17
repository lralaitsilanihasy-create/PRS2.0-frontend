# Demande backend — 2026-10-17 — L'import du DAO propose aussi les réponses de cadrage que le texte dit en clair

## Contexte

Le pilote a importé le DAO de la fiche « Fourniture de consomptibles informatiques (CONTRAT - CADRE) » (ligne 303339) :
`PDF_generes/DAO_CC_303339_consomptibles_informatiques_charte_application.pdf`.

Après l'application, l'étape Cadrage reste **bloquée** : six questions sont sans réponse, et la fiche ne passe pas aux blocs.
Le serveur a enregistré ce cadrage :

```json
{ "attributaires": "MULTI", "typePrix": "UNITAIRES", "alloti": "NON", "groupement": "OUI", "tauxAvance": 20 }
```

La question du pilote : *« les questions à répondre dans le cadrage ne sont-elles pas à puiser dans le DAO à importer ? »*

La lecture ne déduit une réponse de cadrage que des **sections conditionnelles** du document type (`LectureDao`, règle 5 du `README` du prototype : « chaque section dont un paragraphe à
texte fixe a été reconnu donne les termes `cle = valeur` de sa condition »). Or :

| Question (clé) | Modèles du contrat-cadre (DPAC-CC, AE-CC) | Champ de la fiche conditionné (contrat-cadre) |
|---|---|---|
| `typePrix`, `attributaires`, `alloti`, `groupement`, `modeRemise` | des sections en dépendent → réponse déduite | — |
| `variantes` | **aucune** section | aucun |
| `formeGroupement` | **aucune** section | aucun |
| `provenance` | **aucune** section | aucun |
| `prixRevisable` | **aucune** section | aucun |
| `garantieSoumission` | **aucune** section | aucun (mais lue par `ControlesFicheMarche` et `EvaluationService`) |
| `avance` | **aucune** section | `B08-AV-02`, `B08-FI-02` (`avance = OUI`) |

Ces six questions ne peuvent donc **jamais** être proposées par l'import d'un contrat-cadre, alors que le front exige une
réponse à chacune avant d'ouvrir les blocs.

**Et le texte ne les dit pas non plus.** Le front a cherché dans ce DAO « variante », « solidaire », « ferme », « révisable »,
« garantie de soumission ». Ces mots n'apparaissent que dans les **instructions aux candidats** et le **CCAG**, des textes
généraux qui ne tranchent rien :
- « Les DPAO indiquent si les prix sont fermes ou révisables » ;
- « si les variantes sont autorisées » ;
- « soit sous forme de groupement solidaire » ;
- « Si elle est requise par les DPAO, une garantie de soumission ».

Le DPAC-CC et l'AE-CC n'ont aucune clause qui y réponde. **Pour un contrat-cadre, la correction est donc B2, pas B1.** B1
sert aux DAO externes et aux autres formes, dont les données particulières disent souvent ces réponses en clair.

**Le front a déjà corrigé deux choses de son côté (17/10)** :
- l'étape Cadrage nomme les questions restées sans réponse, avec un lien vers chacune ;
- un complément retenu emporte sa question : retenir `tauxAvance` envoie aussi `avance: "OUI"` dans `PUT …/import/appliquer`.

## B1 — Lire par clause les réponses qu'aucune section ne tranche

Pour chaque question de cadrage posée à la fiche et qu'aucune section reconnue ne tranche, la lecture **cherche dans le
texte la clause qui y répond**, par mots-clés, comme la lecture par clause le fait déjà pour les valeurs (`source: "clause"`,
règles R-a et R-b de `LectureDao`, et les listes de matériel et de pièces). Cela vaut aussi pour les DAO externes, qui
n'emploient pas nos modèles.

Les tournures ci-dessous sont des **hypothèses** du front. C'est la mesure sur les DAO réels (§ Mesure) qui les arrête.

| Clé | Réponse | Tournures typiques |
|---|---|---|
| `variantes` | `NON` | « les variantes ne sont pas autorisées / admises / acceptées », « aucune variante n'est autorisée », « variantes : non » |
| | `OUI` | « les variantes sont autorisées / admises » |
| `formeGroupement` | `SOLIDAIRE_OBLIGATOIRE` | « groupement solidaire » imposé : « le groupement devra être solidaire », « … obligatoirement solidaire » |
| | `CONJOINT_OU_SOLIDAIRE` | « groupement conjoint ou solidaire » |
| `provenance` | `NATIONAL` | « fournitures disponibles sur le territoire national », « prix EXW », livraison sur le territoire |
| | `IMPORTEES` | « CIP », « CIF », « fournitures importées », « origine étrangère » |
| `prixRevisable` | `NON` | « prix fermes », « fermes et non révisables », « non actualisables » |
| | `OUI` | « prix révisables », « formule de révision », « indice d'actualisation » (attention à `B05-PM-06`, indice des contrats-cadres) |
| `garantieSoumission` | `NON` | « garantie de soumission : néant / non exigée / sans objet » |
| | `OUI` | « garantie de soumission d'un montant de … », « caution de soumission » |
| `avance` | `OUI` / `NON` | `B08-AV-02` lu (taux) → `OUI` ; « aucune avance », « avance : néant » → `NON` |

### B1.1 — Règles

- **Une réponse par clause n'est jamais sûre** : confiance `moyenne`, jamais cochée d'office par l'écran. Elle est rendue
  dans `cadrage[]` avec deux champs nouveaux, facultatifs :
  - `source` : `"section"` (règle actuelle), `"clause"` (B1) ou `"reflet"` (déduite d'un champ, comme `avance` depuis
    `B08-AV-02`) ;
  - `extrait` : la phrase du DAO.
- **Les textes généraux ne comptent jamais.** Ce sont les instructions aux candidats, le CCAG, et les phrases au conditionnel
  ou renvoyant aux DPAO : « les DPAO indiquent si… », « si les variantes sont autorisées », « lorsqu'une telle garantie est
  requise ». Seules comptent les **données particulières** (DPAO, DPAC, DPIC), l'acte d'engagement et le CCAP, et une phrase
  **affirmative**. C'est le premier piège : sur le DAO de la ligne 303339, une lecture naïve proposerait des réponses tirées
  des instructions aux candidats.
- **Une négation l'emporte** sur le mot-clé qu'elle porte : « ne sont pas autorisées ».
- **Deux tournures contraires dans le même DAO** donnent un **conflit** (`conflits`), jamais une réponse.
- **Une section reconnue l'emporte** sur une clause : la règle actuelle reste prioritaire.
- **La réponse est validée** comme aujourd'hui (`fiches.cadrageValide`), et un refus devient un avertissement.

> ⚠️ **2026-10-17, livré côté backend (B1)**, au contrat demandé (`cadrage[].source`, `cadrage[].extrait`), avec trois
> précisions :
> - **Les parties.** La partie en cours est celle du dernier titre de partie vu : un paragraphe court qui commence par le titre,
>   numéro de partie ou de section admis devant.
>   - **Admises** : données particulières (DPAO, DPAC, DPIC, règlement de la consultation), acte d'engagement (« contrat-cadre
>     valant acte d'engagement » compris), CCAP, cahier des prescriptions spéciales.
>   - **Exclues** : IC, CCAG, formulaires et modèles, spécifications techniques, bordereau, sommaire, et tout ce qui précède le
>     premier titre.
>   - Un sigle seul (« DPAO. … ») n'ouvre pas une partie : sur le DAO de 303337, une phrase des IC commençait ainsi.
> - **Les tournures, arrêtées par la mesure.**
>   - `provenance` exige une affirmation sur les fournitures du marché (« les fournitures sont importées », Incoterm CIP, CIF ou
>     EXW). « Pour les fournitures acquises sur le territoire national, le prix comprend… » (2463) est une règle de prix, pas une
>     réponse.
>   - `garantieSoumission = OUI` se lit aussi sur « une garantie de soumission doit être fournie », même sans montant dans la phrase
>     (2463).
>   - `variantes = NON` se lit aussi sur « ne sont pas prises en considération » (2463, 297).
>   - `avance` n'est lue par clause qu'en `NON`. Le `OUI` vient du reflet (B1.2).
> - **Au contrat-cadre**, seules `garantieSoumission` et `avance` sont cherchées (B2). En prestations intellectuelles, pas
>   `provenance`.

### B1.2 — `avance` au serveur

Quand `B08-AV-02` (reflet de `tauxAvance`) est lu, la réponse `avance = OUI` est proposée avec lui (`source: "reflet"`). Le
front le fait déjà à l'application ; le faire au serveur rend la règle indépendante de l'écran.

> ⚠️ **2026-10-17, livré côté backend (B1.2)**, avec un écart de mécanisme. Le taux d'avance lu revient d'ordinaire **en réponse de
> cadrage** (`tauxAvance`, reflet de `B08-AV-02`), pas en valeur de champ ; `avance = OUI` en est déduite (`source: "reflet"`,
> `extrait` : « Taux de l'avance lu : 20 % »), et à défaut de la valeur de `B08-AV-02`. Conséquence utile : les champs conditionnés
> par `avance = OUI` (`B08-FI-02`, `B08-AV-02`) ne portent plus l'anomalie « ne s'applique pas avec ce cadrage ».

## B2 — Ne plus poser au contrat-cadre les questions qui ne servent à rien

Le front ne trouve aucun usage, **pour un contrat-cadre**, de `variantes`, `formeGroupement`, `provenance` et `prixRevisable` :
- aucune section des modèles DPAC-CC et AE-CC n'en dépend ;
- aucun champ du référentiel ouvert au contrat-cadre n'est conditionné par elles.

`penalites` est déjà exclue du contrat-cadre (`sauf: typeMarche = CONTRAT_CADRE` dans les questions du front).

**Question au backend (Q1)** : ces quatre clés servent-elles ailleurs pour un contrat-cadre ? Par exemple aux formulaires du
candidat, à la soumission en ligne, à l'évaluation ou au manuel de contrôle.
- **Si non**, le front cesse de les poser au contrat-cadre, comme `penalites`. Le serveur confirme qu'un cadrage de
  contrat-cadre **sans** ces clés est complet pour lui (`PUT …/cadrage`, validation, contrôles).
- **`garantieSoumission` reste posée** : `ControlesFicheMarche` et `EvaluationService` la lisent.

> ⚠️ **2026-10-17, réponse du backend à Q1 : non.** B2 est confirmé.
> - **Les quatre clés ne servent à rien au contrat-cadre.** Aucune classe Java ne lit `variantes`, `formeGroupement`, `provenance`
>   ni `prixRevisable`. Elles ne servent que de conditions aux sections et aux champs des modèles de fournitures, de travaux et de
>   prestations intellectuelles. Aucune section du DPAC-CC ni de l'AE-CC, aucun champ ouvert au contrat-cadre n'en dépend.
> - **Le serveur n'exige aucune complétude du cadrage** : `PUT …/cadrage`, la validation et les contrôles ne demandent aucune clé.
>   Un cadrage de contrat-cadre sans ces quatre clés est donc complet pour lui ; le blocage venait du seul écran.
> - **`garantieSoumission` a un troisième lecteur** : `ProceduresEnLigneService` (la soumission en ligne). `avance` est lue par
>   `ControlesFicheMarche`.
> - **Côté import**, ces quatre clés ne sont plus cherchées pour un contrat-cadre.

## Mesure — condition de livraison

- **DAO de la ligne 303339** (`PDF_generes/…_charte_application.pdf`) :
  - `avance = OUI` est proposée, par reflet ;
  - **aucune réponse n'est tirée des instructions aux candidats ni du CCAG**. C'est le test du piège ci-dessus ;
  - `garantieSoumission` n'y est pas dite : elle reste à la PRMP.
- **DAO réels de la mesure de l'import** : 2463, 297, 6114, 6213, MTP Ankily, et le DAO complet v3 de la ligne 303337.
  - Les réponses trouvées par clause, justes et fausses, sont données par question.
  - **Aucune réponse fausse proposée** est le critère bloquant, comme le critère Q10 du plan de l'import.
  - Une réponse non trouvée n'est pas un échec : la PRMP répond elle-même.

> ⚠️ **2026-10-17, mesure du backend** : aucune réponse fausse.
> - **Comment** : `CadrageParClauseRecetteTest` cherche les six clés sur les sept DAO, toutes formes confondues ; ce n'est pas le
>   filtre du contrat-cadre. L'attendu est le cadrage vérifié du jeu 2463 et, pour les autres, la lecture à la main de la phrase et
>   de sa partie.
>
>   | DAO | Réponses par clause (partie) | Fausses |
>   |---|---|---|
>   | 2463 | `variantes = NON`, `prixRevisable = NON`, `garantieSoumission = OUI` (DPAO) ; `provenance = NATIONAL` (CCAP, Incoterm EXW) | 0 |
>   | 297 | `variantes = NON` (DPAO) | 0 |
>   | 6114 | `garantieSoumission = OUI` (5 000 000 Ar, règlement de la consultation), `prixRevisable = NON` (AE et CCAP) | 0 |
>   | 6213 | `prixRevisable = NON` | 0 |
>   | Ankily-Mahasoa | `prixRevisable = NON`, `garantieSoumission = OUI` (100 500 000 Ar) | 0 |
>   | DAO complet 303337 (v3) | `prixRevisable = NON` (contrat-cadre valant AE et CCAP) | 0 |
>   | DAO de 303339 | `prixRevisable = NON` (idem) | 0 |
>
> - **Le 2463 retrouve ses réponses** : quatre des cinq que son cadrage vérifié porte sur ces clés. L'avance y venait d'une
>   hypothèse, pas du texte.
> - **Deux réponses fausses ont été écartées en cours de mesure** (voir l'encadré de B1) : la règle de prix de 2463 et la phrase
>   des IC de 303337.
> - **Le DAO de 303339 lu pour un contrat-cadre** (`ImportDaoIntegrationTest.cadrageDuDao303339`) :
>   - `avance = OUI` par reflet ;
>   - aucune réponse tirée des IC ni du CCAG ;
>   - `prixRevisable` n'est plus cherchée (B2) ;
>   - `garantieSoumission` n'est pas dite et reste à la PRMP.

## Ce que le front fera, dès la livraison

- La table « Réponses de cadrage » de la revue affiche l'extrait d'une réponse `clause`, avec la mention « à vérifier », et ne
  la coche pas d'office.
- Si B2 est confirmé, les quatre questions disparaissent du cadrage d'un contrat-cadre.
- Recette sur le DAO de la ligne 303339 : après application, et B2 livré, il ne reste à répondre à la main que
  `garantieSoumission`, le seul point que ce DAO ne dit pas et qui sert encore.

## Recette du front, 17/10 (backend 6c8e2b5, JAR redémarré)

Le DAO est `PDF_generes/DAO_CC_303339_consomptibles_informatiques_charte_application.pdf`, importé sur la DMC 1 (303339) en
lecture seule.

- **Serveur** :
  - le verdict est `CONFORME`, sans conflit ;
  - cadrage : `attributaires`, `typePrix`, `modeRemise`, `alloti` et `groupement` en `section` ; `tauxAvance` en `reflet` ;
    **`avance = OUI` en `reflet`**, avec l'extrait « Taux de l'avance lu : 20 % » ;
  - **aucune réponse `clause`**, donc rien n'est tiré des IC ni du CCAG. C'est conforme à la mesure.
- **Front (B2 livré)** :
  - `variantes`, `formeGroupement`, `provenance` et `prixRevisable` portent `sauf: typeMarche = CONTRAT_CADRE`, comme
    `penalites` ;
  - à l'étape Cadrage de la fiche 303339, il ne reste que **2 questions à répondre** : `garantieSoumission`, que le DAO ne dit
    pas, et `avance`, que l'import propose ;
  - le rail affiche « 2 à répondre ».
- **Revue de l'import** : « Une avance est-elle prévue ? — Oui », avec « déduite d'une valeur lue » et l'extrait, cochée
  d'office (la fiche est vide sur cette question). Une réponse `clause` porterait « à vérifier — lue dans une clause » et
  ne serait jamais cochée d'office.
- **Tests** : 1 317 tests passent, et le lint ne signale rien.
