# Demande backend — Le type de marché se déduit du plan, il ne se redemande pas (lot 1c)

**Date** : 2026-09-23 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : question puis décision du pilote —
« Pourquoi on a le type de marché à quantité fixe alors qu'on a *Fourniture et livraison des pneus pour véhicules
(CONTRAT CADRE) 10* ? », puis « **le type de marché doit être déduit du plan** ». Suite de
`demande-backend-2026-09-22-fiche-marche-dao.md` (lot 1) et `-23-fiche-marche-dossier.md` (lot 1b), livrés et recettés.

## Constat (vérifié sur la base locale le 23/09)

`t_marche.FORME_MARCHE` (`Marche.formeMarche`, enum `A_COMMANDE` · `CONTRAT_CADRE` · `QUANTITE_FIXE`) **existe déjà**,
il est **saisi**, et il porte exactement les trois types de marché de l'esquisse. Sur les sept lignes éligibles du plan
de test, il est renseigné **sept fois sur sept**, et il concorde avec la désignation :

| ligne | `FORME_MARCHE` | désignation |
|---|---|---|
| 302873, 302874 | `QUANTITE_FIXE` | Fourniture de matériels pour équipements de protection |
| 302880, 302882, 302884, 302886, 302896 | `CONTRAT_CADRE` | … **(CONTRAT CADRE)** … |

Or la fiche marché **redemande** ce type en première question de cadrage, et le front le pré-remplit à
`QUANTITE_FIXE` faute de mieux. Résultat : cinq fiches sur sept se préparent aujourd'hui sous un type **faux**, sous un
titre qui dit le contraire. C'est une double saisie doublée d'une contradiction — exactement ce que la fiche marché
devait supprimer.

## Demande

### B1 — `typeMarche` devient une donnée reprise, plus une réponse

- **`FicheMarcheDto.typeMarche` est dérivé de `FORME_MARCHE`** de la **ligne courante** de la filiation (même lecture
  que `valeursPpm`, règles du lot 1b), à chaque lecture. Il n'est plus stocké dans le cadrage.
- **Le cadrage cesse de porter `typeMarche`** : la clé est **ignorée** si le front l'envoie encore (tolérance d'une
  version, plutôt qu'un 400 qui casserait les fiches en cours), et elle disparaît de la liste des clés admises.
  `cadrageComplet` ne l'attend plus : **neuf questions** au lieu de dix.
- **Un champ `PPM` de plus au référentiel** : `B01-AC-19` « Forme du marché » (`TEXTE`, source `PPM`,
  `clePpm = FORME_MARCHE`, document maître `DPAO`, repris dans `AE` et `CCAP`), pour qu'il figure dans les 22
  informations reprises et, demain, dans les documents générés. Les comptes de l'esquisse passent de 22 à 23 repris.
- **Ligne sans `FORME_MARCHE`** (plans anciens) : `typeMarche` nul, la fiche reste lisible, et la création est refusée
  (B2) avec un message qui nomme le champ à compléter dans le plan.

  > ⚠️ **Livraison backend du 2026-09-23 — B1 livré tel que demandé, avec trois précisions.** (1) `B01-AC-19` sert le
  > **libellé** (« À quantité fixe », « Contrat cadre », « Marché à commande ») ; le code est `typeMarche`. Semé par
  > **V37** (idempotent), rubrique Acheteur à 19. (2) Ligne sans forme : refus sous le **même code**
  > `FORME_NON_OUTILLEE`, message « … complétez le champ « Forme du marché » de la ligne … » — pas de code de plus. Le
  > cas est théorique aujourd'hui : la reprise V3 a rempli toutes les lignes anciennes, **0 ligne sur 100** est sans
  > forme sur DBPRS20 ; le serveur lit la colonne brute (le défaut `QUANTITE_FIXE` du modèle ne décide pas). (3)
  > `t_fiche_marche.TYPE_MARCHE` reste en base : c'est désormais **le type sous lequel la version a été saisie**, figé à
  > sa création — c'est lui que compare `typeChange`, et lui que sert `GET …/versions`.

### B2 — Une ligne dont la forme n'est pas outillée ne se prépare pas

Au lot 1, seule la **quantité fixe** est outillée. Aujourd'hui les lignes contrat-cadre sont offertes comme éligibles
et produisent une fiche fausse. Il faut que le refus soit **explicite et précoce** :

- **`GET /api/dmcs/eligibles`** porte, pour chaque ligne, **`formeMarche`** et **`formeOutillee: boolean`**. Les lignes
  non outillées **restent listées** — la PRMP doit voir qu'elles existent et pourquoi elles attendent — mais le front
  les affiche désactivées, avec leur forme.
- **`POST /api/dmcs/par-marche/{idDetail}`** → 409 à code stable **`FORME_NON_OUTILLEE`**, message nominatif :
  « Cette ligne est un contrat-cadre ; la fiche marché ne prend en charge que les marchés à quantité fixe pour le
  moment. » Placé **après** `MODE_NON_DAO` et **avant** `PV_NON_SIGNE` dans l'ordre des gardes du lot 1b.
- La liste des formes outillées est une **constante du service**, pas une colonne : elle s'allonge au lot 3 (à
  commande) puis au lot 4 (contrat-cadre), sans migration.

  > ⚠️ **Livraison backend du 2026-09-23 — B2 livré, et étendu à la fiche elle-même.** (1) `eligibles` ne liste une ligne
  > non outillée que si elle passe **toutes les autres gardes** (PV signé, mode DAO, version courante…) : « non
  > outillée » est la seule raison qui la désactive. (2) Ajout : une fiche **déjà ouverte** sur une ligne non outillée
  > (ou devenue telle par une mise à jour du plan) se **lit**, mais `PUT cadrage`, `PUT blocs/{bloc}`, `valider` et
  > `reviser` répondent **409 `FORME_NON_OUTILLEE`** — sans quoi B2 se contournait par une fiche ouverte avant la
  > livraison. Constante : `DmcService.FORMES_OUTILLEES`. Le message du contrat-cadre est celui de la demande ; à
  > commande : « Cette ligne est un marché à commande ; … ».

### B3 — Les fiches déjà préparées sous un type faux

Sur la base de développement, cinq fiches ont pu être cadrées en `QUANTITE_FIXE` sur des lignes `CONTRAT_CADRE`
(dont celles de la recette du front). Au premier `GET` après livraison, leur `typeMarche` devient `CONTRAT_CADRE` et
leurs champs de saisie ne correspondent plus à leur type.

- **Règle proposée** : une fiche **brouillon** dont le type dérivé diffère du type sous lequel elle a été saisie est
  servie telle quelle, avec un drapeau **`typeChange: true`** ; le front prévient et propose de repartir (`reviser`
  n'ayant pas de sens ici, la PRMP supprime la fiche). Une fiche **validée** dans ce cas est un cas d'école qui ne
  devrait pas exister en production : la signaler dans le journal applicatif suffit.
- **En développement**, le plus simple reste de supprimer ces cinq fiches et leur DMC : dites-le et le front cesse
  d'y toucher.

  > ⚠️ **Livraison backend du 2026-09-23 — `typeChange` livré comme proposé ; les chiffres sont autres, et la suppression
  > n'existe pas.** Relevé sur DBPRS20 le 23/09 : **une seule fiche** est posée sur une ligne contrat-cadre — la fiche du
  > DMC 3 (ligne 302896), version 1, brouillon, **vide** ; le DMC 4 (ligne 302886, contrat-cadre) n'a pas de fiche. Les
  > quatre versions du DMC 1 (ligne 302873, quantité fixe, rattachée au dossier 100332) ne sont pas concernées.
  > `typeChange` vaut `true` sur la fiche du DMC 3 ; une fiche validée n'est jamais marquée (journal applicatif
  > `[FICHE_MARCHE]`). **Aucun geste de suppression d'une fiche n'existe** (ni au lot 1, ni ici) : « la PRMP supprime la
  > fiche » n'est pas possible depuis l'écran — elle reste lisible et en écriture refusée. Pour la base de
  > développement, la suppression de la fiche du DMC 3 et des DMC 3 et 4 est **proposée au pilote**, à faire par le
  > backend sur son accord (non faite à la livraison).

### Options écartées

- *Deviner le type dans la désignation* (« (CONTRAT CADRE) » dans le texte) : c'est ce que le front fait aujourd'hui,
  **à titre provisoire et pour avertir seulement**. Du texte libre ne décide pas d'un cadrage ; il sert à alerter, pas
  à conclure. Cet avertissement disparaît dès la livraison de B1.
- *Garder la question et la pré-remplir depuis le plan* : une question dont la réponse est déjà connue et non
  modifiable n'est pas une question. Le type se **montre** parmi les informations reprises.
- *Bloquer les lignes non outillées dans `eligibles`* : les faire disparaître laisserait la PRMP chercher pourquoi.
  Elles restent visibles, désactivées, avec leur raison.

## Tests attendus (recette backend)

1. Ligne `QUANTITE_FIXE` : `GET /api/fiches-marche/{idDmc}` → `typeMarche = QUANTITE_FIXE` ; le cadrage renvoyé ne
   contient plus `typeMarche` ; un `PUT cadrage` qui l'envoie encore passe (clé ignorée), et `cadrageComplet` est
   atteint avec les neuf autres réponses.
2. Ligne `CONTRAT_CADRE` : `POST par-marche` → 409 `FORME_NON_OUTILLEE` nommant le contrat-cadre ; `eligibles` la
   liste avec `formeMarche = CONTRAT_CADRE` et `formeOutillee = false`.
3. Ligne sans `FORME_MARCHE` : `typeMarche` nul, `POST par-marche` refusé en nommant le champ du plan.
4. Référentiel : `B01-AC-19` sert « Forme du marché » dans `valeursPpm` ; 23 informations reprises.
5. Filiation : une mise à jour du plan qui change `FORME_MARCHE` change le `typeMarche` servi (même lecture que
   `valeursPpm`, lot 1b) et lève `typeChange` sur la fiche brouillon.
6. Les fiches validées du lot 1 restent lisibles et ne changent pas de version.

## Côté front (dès la livraison)

- La question « Quel type de marché ? » **disparaît** du cadrage ; le type rejoint les informations reprises et le
  résumé du cadrage, en lecture seule, avec sa provenance.
- La liste des lignes éligibles affiche la **forme** de chaque ligne et **désactive** celles qui ne sont pas outillées,
  avec la raison en clair.
- L'avertissement provisoire tiré de la désignation est **retiré**.
