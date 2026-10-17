# Demande backend — 2026-10-17 — L'import vérifie que le DAO est bien celui de la ligne de la fiche

## Contexte

Le pilote demande que l'import d'un DAO soit sécurisé : le document importé doit être celui du marché de la fiche, et
pas celui d'une autre ligne. Les DAO importés **viennent souvent d'autres applications** (Word d'un ministère, outil d'un
bailleur, ancien système) : le contrôle ne peut donc pas reposer sur une marque propre à l'application, ni sur nos modèles.

**Aujourd'hui** (`ImportDaoService.lire`) :
- une valeur reprise du plan (source `PPM`) que le DAO dit autrement devient une `divergence`. Le plan fait foi et la
  valeur n'est jamais proposée ;
- l'écran liste les divergences tout en bas de la revue, sous « Le DAO contredit le plan ». **« Appliquer » reste actif.**
  Le DAO des articles de bureau (ligne 303337), importé dans la fiche des consomptibles informatiques (ligne 303339),
  laisse appliquer une quarantaine de valeurs d'un autre marché : dates, numéro, conditions ;
- une valeur du plan **absente** du DAO n'est pas contrôlée : rien ne prouve que le document concerne cette ligne.

**Arbitrages du pilote, 17/10** :
- le contrôle repose sur **quelques informations pertinentes**, reprises de la ligne du plan ;
- il ajoute un **test de discrimination** contre les autres lignes de la même autorité ;
- un **avertissement** signale un DAO dont la date limite de remise des offres est périmée.

## B1 — Le verdict d'identité, calculé à l'import

`POST …/import` rend un nouvel objet `identite` :

```json
"identite": {
  "verdict": "CONFORME | NON_PROUVE | ETRANGER",
  "criteres": [
    { "critere": "OBJET", "plan": "Fourniture de consomptibles informatiques (CONTRAT - CADRE)",
      "etat": "RETROUVE | CONTREDIT | INTROUVABLE", "extrait": "… passage du document …", "page": 1 }
  ],
  "voisine": { "idDetail": 303337, "objet": "Fourniture d'articles de bureau (CONTRAT - CADRE)" },
  "motif": "phrase prête à afficher"
}
```

### B1.1 — Les critères

Ils sont pris dans les valeurs du plan de la fiche (`valeursPpm`) :

| Critère | Code | Toujours ? |
|---|---|---|
| `OBJET` | `B02-OB-01` | oui |
| `AUTORITE` | `B01-AC-01` (et `B01-AC-03` si elle diffère) | oui |
| `MODE` | `B01-AC-13` | oui |
| `FORME` | `B01-AC-19` | seulement pour un contrat-cadre |
| `LOTS` | `B02-LV-01`, `B02-LV-02` | seulement pour une ligne allotie |

Le montant, l'imputation, le compte, le financement et les dates **n'entrent pas** dans le verdict. Ils restent proposés ou
signalés comme aujourd'hui.

### B1.2 — Chercher les valeurs du plan, plutôt que lire des champs

Un DAO externe n'emploie pas nos libellés : « Objet : », « OBJET DU MARCHÉ : », un titre de garde, une phrase de l'avis.
Le contrôle part donc du plan, qui est sûr, et **cherche chaque valeur dans tout le texte**, en priorité sur les premières
pages (garde, avis, données particulières). La recherche ne dépend pas de la reconnaissance des modèles : elle vaut aussi
pour un document où `reconnues` est faible.

- **Normalisation** : celle de `LectureDao.norm`, sans accents, casse, guillemets ni ponctuation.
- **Objet** : les mentions entre parenthèses (« (CONTRAT - CADRE) ») sont facultatives, car un DAO les omet souvent.
  L'objet est retrouvé si ses mots significatifs apparaissent dans une même phrase du document, dans l'ordre, à au plus un mot
  près. Les mots vides sont exclus, comme dans `motsDe` de `lire-specs.mjs`.
- **Autorité** : forme longue (`B01-AC-01` ou `B01-AC-03`), ou son sigle quand le référentiel des entités en porte un.
- **Mode** : le libellé du mode (« appel d'offres ouvert »), aussi dans un intitulé (« DOSSIER D'APPEL D'OFFRES OUVERT »).
- **Lots** : le nombre de lots et la désignation de chacun, rapprochés comme la lecture des tableaux le fait déjà
  (`LOT_HORS_PLAN`).

### B1.3 — Contredit, et pas seulement introuvable

Ne pas trouver une valeur ne prouve rien : elle est peut-être formulée autrement. `CONTREDIT` exige un **indice positif** :
- **objet** : la ligne « Objet », l'intitulé de l'avis ou l'objet de la garde porte un texte qui ne ressemble pas à celui
  du plan ;
- **autorité** : la garde ou l'avis nomme une autre autorité, et celle du plan n'apparaît nulle part ;
- **mode et forme** : c'est la règle actuelle (`typeMarche`, `categorie`, divergences des valeurs `PPM`) ;
- **lots** : le DAO compte plus de lots que le plan, ou porte une désignation de lot sans rapport.

### B1.4 — Le test de discrimination (lignes voisines)

Une même autorité passe souvent des marchés aux objets proches (« … pour la DAAF », « … pour la DGI »), et un
rapprochement tolérant accepterait alors la mauvaise ligne. L'objet lu au DAO est donc comparé à **toutes les lignes des
plans de la même autorité**, pour le même exercice et l'exercice précédent :
- si une autre ligne lui ressemble **nettement plus** que celle de la fiche → `OBJET` est `CONTREDIT`, et `voisine` nomme
  cette ligne ;
- si une autre ligne lui ressemble **autant** → `OBJET` ne peut pas être `RETROUVE`. Il passe à `INTROUVABLE`, avec la voisine
  nommée dans le motif ;
- pour une ligne allotie, la désignation des lots départage avant de conclure.

### B1.5 — Le verdict

| Verdict | Condition |
|---|---|
| `ETRANGER` | au moins un critère est `CONTREDIT` |
| `NON_PROUVE` | aucun critère `CONTREDIT`, au moins un `INTROUVABLE` |
| `CONFORME` | tous les critères applicables sont `RETROUVE` |

Un PDF sans texte (un scan) est déjà refusé : il le reste, sans verdict.

## B2 — Le serveur fait respecter le verdict

Le verdict doit tenir même si on contourne l'écran :
- **`ETRANGER`** : `PUT …/import/appliquer`, et `PUT …/articles` porteur de la trace de l'import (`importFichier`,
  `importEmpreinte`), sont refusés pour cette empreinte : **409 `DAO_ETRANGER`**, avec le motif ;
- **`NON_PROUVE`** : ces mêmes appels exigent une attestation de la PRMP, sinon **409 `ATTESTATION_REQUISE`**.
  L'attestation est un nouveau champ du corps, `attestation: true`, portée par `AppliquerImportCorps` et par le
  `PUT …/articles` de l'import ;
- **journal** : `FICHE_IMPORTEE` note le verdict, et l'attestation avec son auteur ;
- **`CONFORME`** : rien ne change.

**H1 (à confirmer)** : aujourd'hui, l'application de l'import ne renvoie pas le fichier, seulement son nom et son
empreinte. Le serveur doit donc **garder le verdict** de chaque import, au moins pour la fiche, l'empreinte et l'utilisateur.
Le front suppose une conservation courte : le temps de la revue, quelques heures au plus. Au-delà, l'import est à refaire,
avec le refus 409 `IMPORT_EXPIRE`. Le backend choisit le moyen.

## B3 — Avertissement : DAO périmé

La date limite de remise des offres lue au DAO (`B04-CP-02`) peut être déjà passée, ou antérieure à l'exercice du plan
(`B01-AC-09`). Dans ce cas, un avertissement s'ajoute en tête des `avertissements`, sous un code dédié pour que l'écran
le place en évidence, sur le modèle `DAO_PERIME : …`.

Ce n'est **pas** un refus : un DAO relancé sur la même ligne, après un premier lancement infructueux, est légitime, et ses
dates seront corrigées dans la fiche.

## B4 — Facultatif : la marque des DAO produits par l'application

Le DAO complet (Word et PDF) peut porter dans ses propriétés de document la ligne du plan, la fiche et la version. Réimporté,
il est alors jugé d'emblée : `CONFORME` sur sa ligne, `ETRANGER` ailleurs, sans recherche. Cette marque ne remplace pas
B1, puisque la plupart des DAO importés viennent d'ailleurs.

## Mesure — condition de livraison

Sur les DAO réels déjà disponibles :
- 2463, 297, 6114, 6213, MTP Ankily, routiers, MEN 4SDC ;
- les deux DAO de démonstration des lignes 303337 et 303339 ;
- `PDF_generes/DAO_CC_303339_consomptibles_informatiques_charte_application.pdf`.

Deux résultats sont attendus :
1. **sur sa propre ligne**, chaque DAO est `CONFORME` ou `NON_PROUVE`, **jamais `ETRANGER`**. La livraison donne le détail
   des critères `INTROUVABLE` ;
2. **sur une autre ligne**, au moins les lignes 303336 à 303339 entre elles (même autorité, même mode, objets voisins),
   chaque DAO est **`ETRANGER`**, avec `voisine` juste quand c'est le test de discrimination qui tranche.

Un DAO jugé `ETRANGER` sur sa propre ligne est un bloquant, comme une fausse valeur en confiance haute pour la lecture
(critère Q10 du plan de l'import).

## Ce que le front fera, dès la livraison

- **En tête de la revue** : une pastille par critère, verte (retrouvé), rouge (contredit, avec l'extrait et la page) ou
  grise (introuvable), puis le verdict en une phrase.
- **`ETRANGER`** : bandeau rouge, toutes les cases désactivées, « Appliquer » retiré, seul « Fermer » reste.
- **`NON_PROUVE`** : bandeau orange et case « J'atteste que ce DAO est celui de la ligne {n} » ; « Appliquer » reste
  inactif tant qu'elle n'est pas cochée, puis `attestation: true` est envoyé.
- **`DAO_PERIME`** : avertissement placé sous le verdict.
- Recette sur les mêmes DAO, résultat reporté dans cette demande.
