# Demande backend — 2026-09-28 — Import du DAO : pré-remplir la fiche en lisant le document « à l'envers »

**Origine** : demande du pilote du 28/09 (« importer le document DAO pour alimenter les données de la fiche à la place
de la saisie si on a ce document ; sinon, on procède à la saisie »), plan `docs/plan-2026-09-28-import-dao.md`,
décisions du pilote du 28/09 : **suivre les recommandations**, avec les **ancrages tirés des modèles du lot D**. Cela
renverse partiellement la décision du 22/09 (« DAO = formulaire, jamais un import de PDF ») : **la fiche reste le
formulaire et la seule source de vérité** ; l'import **propose**, la PRMP retient, et rien n'est écrit sans elle.

**Le lot 0 (mesure) est fait côté front**, sur le contrat-cadre : `scripts/import-dao/` (README). Le prototype
`lire.mjs` est **la spécification de l'algorithme** ; la mesure (`mesurer.mjs`, aller-retour sur les documents de la
fiche 27, puis avec un bruit simulé : typographie, paragraphes fusionnés, paragraphes ajoutés) donne, sur 9 passes :
**0 valeur fausse en confiance haute** (315 justes), 0 fausse en moyenne (213 justes), 7 fausses en basse (sur 19),
toutes les réponses de cadrage déduites justes, rappel de 87 à 98 %. Critère Q10 du plan tenu. Limite : aucun DAO réel
d'une autre autorité disponible (pilote, 28/09).

## B1 — `POST /api/fiches-marche/{idDmc}/import` : lire, ne rien écrire

- **Entrée** : multipart, part `fichier`, **`.docx` seulement** au premier lot (Q1 : Word d'abord ; le PDF texte
  viendra ensuite). Autre type → **415** « Seul un fichier Word (.docx) peut être importé pour l'instant. » ; `.docm`
  (macros) refusé ; taille ≤ 10 Mo (multipart existant) ; lecture POI sans exécution, garde contre les archives
  piégées (ratio de décompression de POI).
- **Qui** : la PRMP propriétaire et son UGPM, comme la saisie. **Quand** : la version courante est un **brouillon**
  (sinon 409 `FICHE_VALIDEE`, code stable).

> ⚠️ **Livraison backend du 2026-09-28 (§B1, entrée et gardes).** Deux précisions sur ce qui est livré :
> - **Refus du fichier.** Le 415 porte le code stable `FORMAT_NON_SUPPORTE`. Le message demandé est gardé mot pour mot.
>   Une phrase lui est ajoutée quand le nom est bon mais le contenu non : fichier vide, fichier illisible comme document
>   Word, paquet à macros (`vbaProject.bin`, ou type de contenu autre que celui d'un document), archive piégée.
> - **L'Administrateur n'importe pas (403).** La saisie d'un bloc l'admet, mais la demande ne nomme que la PRMP
>   propriétaire et son UGPM. Le reste suit la saisie : périmètre, mandat actif, forme outillée (409
>   `FORME_NON_OUTILLEE`). Les gardes de la fiche passent avant celles du fichier : un `.pdf` sur une fiche validée rend
>   409. Une fiche jamais enregistrée est lue comme un brouillon vide.
- **Avec quoi** : les **modèles du lot D** que la fiche produit, d'après sa forme et sa catégorie (contrat-cadre /
  fournitures et services : `DPAC-CC`, `AE-CC`) — les fichiers `modeles/dao/*.txt` déjà chargés. Aucun modèle pour cette
  forme → **422** `MODELE_ABSENT` « L'import n'est pas encore possible pour ce type de marché : saisissez la fiche. »
  Un DAO en **un seul fichier** (avis, DPAC, AE à la suite) est la règle : chaque modèle y cherche sa partie.
- **Comment** : l'algorithme de `scripts/import-dao/lire.mjs`, tel quel (README, §L'algorithme) — normalisation,
  paragraphes à texte fixe dans l'ordre avec curseur, reconnaissance en tête d'un paragraphe fusionné, coupe au début
  d'un paragraphe suivant du modèle, jetons seuls entre voisins (ambigus signalés), réponses déduites des sections
  attestées par du texte fixe, valeurs remises en forme de saisie, conflits. **Mêmes niveaux de confiance**, mêmes
  règles (une valeur de texte ouverte à droite n'est jamais haute).
- **Chaque valeur passe par la validation de la saisie** (`normaliser`) : une valeur refusée devient une anomalie de la
  proposition (`message` du 400 habituel), jamais une proposition valide.
- **Ce qui n'est jamais proposé** : les champs repris du plan (`source = PPM`) — le plan fait foi (Q6) : une valeur lue
  qui en diffère est rendue en **divergence** (« le DAO dit … ; le plan dit … ») ; les champs calculés ; les paramètres
  internes (`INT-SE-*`) ; les pièces.
- **Sortie** `ImportDaoResult` :

```json
{
  "fichier": "DAO-contrat-cadre.docx", "empreinte": "sha256…",
  "modeles": [{ "sigle": "DPAC-CC", "unites": 141, "reconnues": 118 }, { "sigle": "AE-CC", "unites": 263, "reconnues": 214 }],
  "cadrage": [{ "cle": "attributaires", "valeur": "MULTI", "section": "MULTI", "actuelle": null }],
  "propositions": [{ "code": "B04-CP-02", "lot": null, "valeur": "2026-11-20T10:00", "brut": "20/11/2026 10:00",
                     "confiance": "haute", "extrait": "DATE ET HEURE LIMITES DE REMISE DES OFFRES : 20/11/2026 10:00",
                     "actuelle": null, "anomalies": [] }],
  "ambigus": [{ "candidats": ["B07-DE-02", "B07-DE-03"], "texte": "Le délai de livraison …" }],
  "divergences": [{ "code": "B01-AC-01", "document": "…", "plan": "…" }],
  "conflits": [{ "code": "B05-MT-01", "valeurs": ["…", "…"] }],
  "nonTrouves": ["B04-DS-07"],
  "avertissements": ["peu de texte du modèle reconnu (12 %) : ce document ne suit pas le document type"]
}
```

  `actuelle` : la valeur déjà saisie dans la fiche (l'écran ne coche jamais d'office une case qui écraserait une
  saisie, Q8). `extrait` : le paragraphe du document où la valeur a été lue. Avertissement « hors gabarit » quand moins
  de 30 % des paragraphes d'un modèle sont reconnus.

> ⚠️ **Livraison backend du 2026-09-28 (§B1, algorithme et sortie).** `lire.mjs` est porté tel quel (`LectureDao`). La
> parité est vérifiée sur les DPAC et AE `.docx` de la fiche 27 : même découpage en 351 paragraphes, et mêmes
> propositions, confiances, réponses, ambigus et non-trouvés que `lire.mjs`. Six écarts de sortie, tous au service de B2 :
> - **Une réponse déduite dont la clé est un code de champ n'est pas du cadrage.** `B07-FS-01`, `B02-DC-03`, `B07-PE-01`
>   en sont des exemples. `lire.mjs` les range dans `cadrage`, mais `PUT …/cadrage` les refuserait comme clés inconnues.
>   Elles sont rendues dans `propositions`, en confiance `moyenne`, avec `brut` = la valeur et `extrait` = « rédaction
>   retenue (section NOM de SIGLE) ». `cadrage` ne porte que de vraies clés de cadrage, chacune validée comme par
>   `PUT …/cadrage`. Une réponse refusée passe aux `avertissements`. Les termes se découpent comme au rendu (ADR-0011) :
>   un « et » dans une valeur ne coupe pas.
> - **Un conflit n'est jamais un choix, cadrage compris.** `lire.mjs` garde la première réponse d'une clé en conflit.
>   Ici, elle sort de `cadrage` et va seulement dans `conflits`. Pour une clé de cadrage, `conflits[].code` porte la clé.
>   Les conflits d'un modèle à l'autre du même fichier (DPAC et AE) y vont aussi.
> - **`anomalies`** porte, en plus des refus de `normaliser`, deux autres motifs. Le premier est la condition
>   d'affichage fausse sur le cadrage de la fiche complété des réponses déduites (« ne s'applique pas avec ce cadrage »).
>   Le second est un champ par lot d'une ligne allotie. `valeur` est la forme normalisée quand `normaliser` l'accepte :
>   `OUI` pour « Oui », l'option telle que le référentiel la sert, un nombre sans zéros de queue.
> - **`nonTrouves` ne liste que les champs saisissables.** Les reprises du plan, les reflets, les calculés et les pièces
>   n'y sont pas, puisque la PRMP n'a rien à y saisir. `lire.mjs` y mettait par exemple `B01-AC-01`.
> - **Un avertissement « hors gabarit » par modèle**, préfixé du sigle : « AE-CC : peu de texte du modèle reconnu (12 %) :
>   ce document ne suit pas le document type ». Le pourcentage est arrondi.
> - **`cadrage[].valeur` est typée** comme après `PUT …/cadrage` : `nbLots` ou `tauxAvance` sont des nombres.
>   `modeRemise = PAPIER` est déduit de la rédaction « papier », même quand la fiche source ne le porte pas (défaut V50).

## B2 — `PUT /api/fiches-marche/{idDmc}/import/appliquer` : écrire ce que la PRMP a retenu, d'un seul coup

- **Corps** : `{ "cadrage": { "attributaires": "MULTI", … }, "valeurs": { "B04-CP-02": "2026-11-20T10:00", … },
  "fichier": "…", "empreinte": "sha256…" }` — uniquement les lignes cochées.
- **Fusion, pas remplacement** : le cadrage reçoit les clés envoyées, les autres restent ; les valeurs sont écrites
  **champ par champ, tous blocs confondus**, un code absent n'est pas effacé (contrairement à `PUT …/blocs/{bloc}`).
- **Atomique** : tout est validé d'abord (même `normaliser`, mêmes conditions d'affichage que la saisie) ; un refus
  rend la liste nominative `[{champ, message}]` et **rien** n'est écrit.
- **Journal** du dossier : `FICHE_IMPORTEE`, détail « fiche pré-remplie par import de <fichier> (<empreinte courte>) :
  n valeurs, m réponses de cadrage ».
- Réponse : la fiche, comme après une saisie. Mêmes droits et mêmes conditions (brouillon) que B1.

> ⚠️ **Livraison backend du 2026-09-28 (§B2).** Conforme : fusion, atomicité, journal au détail demandé mot pour mot, la
> fiche en réponse. Quatre précisions :
> - **Un champ fermé par sa condition est un 400, pas un silence.** La condition est évaluée sur le cadrage fusionné.
>   `PUT …/blocs` ignore un tel champ, parce que l'écran y renvoie tout le bloc. Ici, la PRMP l'a coché : le refus le lui
>   dit (« ne s'applique pas à cette fiche (condition : …) »). Même chose, en 400, pour une valeur ou une réponse vide
>   (« l'import n'efface rien ») et pour un corps sans rien à appliquer.
> - **`fichier` et `empreinte` sont exigés**, en 400 nominatif. L'empreinte fait 64 caractères hexadécimaux. Les 12
>   premiers vont au journal.
> - **`FICHE_IMPORTEE` a le rang 26**, juste avant `FICHE_MARCHE_VALIDEE` (27) d'un même instant. Une fiche jamais
>   enregistrée est créée, avec ses défauts recopiés, puis reçoit l'import. En remise électronique, les cibles calculées se
>   reposent comme à l'enregistrement d'un bloc.
> - **Une valeur importée est une saisie ordinaire.** Si elle remplace une valeur calculée, elle perd la marque
>   « calculée ».

## B3 — Ce que l'import ne fait pas

- Le fichier **n'est pas conservé** (Q7) : lu en mémoire, oublié ; seuls le nom et l'empreinte vont au journal.
- Pas d'OCR : un `.docx` fait d'images ne donne rien (avertissement « hors gabarit »).
- Les champs par lot (`CODE#n`) : aucun dans les deux modèles du contrat-cadre ; la règle viendra avec les fournitures
  (lot D2), où le lot sera lu dans l'intitulé (« Lot n° 1 : … »).

> ⚠️ **Livraison backend du 2026-09-28 (§B3).** Conforme. Le fichier est lu en mémoire puis oublié, et rien n'est
> journalisé à la lecture. `lot` vaut toujours `null`. Un champ par lot d'une ligne allotie, s'il apparaissait, serait
> proposé avec une anomalie, jamais sous une clé `CODE#n`.

## B4 — Tests

- **Aller-retour** : une fiche de contrat-cadre validée, ses DPAC et AE `.docx` concaténés en un seul fichier, importés
  dans une fiche **vierge** d'une autre ligne de contrat-cadre : les propositions redonnent les valeurs saisies (hors
  reprises du plan), les réponses déduites redonnent le cadrage ; `B07-DE-02` / `B07-DE-03` rendus **ambigus**.
- **Fusion** : deux paragraphes collés (« Nom du Responsable : X Fonction : Y ») → `B04-DS-07` = X en confiance
  moyenne, `B04-DS-08` = Y relu. **Ajout** : un paragraphe étranger inséré avant un jeton seul → confiance basse,
  jamais haute. Aucune valeur fausse en confiance haute sur ces cas.
- **Refus** : `.pdf` → 415 ; fiche validée → 409 `FICHE_VALIDEE` ; quantité fixe → 422 `MODELE_ABSENT` ; document hors
  gabarit → 200 avec avertissement et presque rien de proposé.
- **Appliquer** : fusion (un champ non envoyé garde sa valeur) ; un refus sur une valeur → 400 nominatif et rien
  d'écrit ; journal `FICHE_IMPORTEE`.

> ⚠️ **Livraison backend du 2026-09-28 (§B4).** Tests dans `ImportDaoIntegrationTest` (5) et `LectureDaoTest` (4, pur).
> Un écart de forme :
> - **Le fichier unique de l'aller-retour** est fait des paragraphes et cellules du DPAC puis de l'AE produits, un
>   paragraphe Word par unité. Ce sont exactement les unités que lit l'algorithme. Le DPAC tel que produit, avec son
>   tableau de calendrier, est aussi importé seul pour couvrir la lecture des tableaux.
>
> Ce que les tests vérifient :
> - Aucune valeur fausse en haute ni en moyenne, au moins 40 justes.
> - Les valeurs typées reviennent en forme de saisie, par exemple `B04-CP-02` = `2026-04-10T10:00` en haute.
> - Chaque réponse déduite égale le cadrage de la source. `B07-DE-02` / `B07-DE-03` sont ambigus.
> - L'objet du plan est en divergence, et aucune reprise du plan n'est proposée.
> - Fusion : `B04-DS-07` en moyenne, `B04-DS-08` relu. Ajout : `B04-PO-01` en basse.
> - Refus : `.pdf`, `.docm` et un faux `.docx` → 415 ; Administrateur → 403 ; quantité fixe → 422 ; fiche validée →
>   409, pour la lecture comme pour l'application.
> - Hors gabarit : 200, deux avertissements, au plus deux propositions.
> - Appliquer : un refus nominatif pour une valeur mal typée, une reprise du plan et un champ fermé par le cadrage, sans
>   rien d'écrit. Puis la fusion : une valeur et une clé de cadrage non envoyées gardent les leurs. Puis le détail exact
>   du journal. Une fiche virtuelle est créée à l'application.

## Ce que le backend rend

B1 à B4, `docs/api-endpoints.md` (deux routes, `ImportDaoResult`), `docs/regles-gestion.md` (§ fiche marché : l'import
propose, la PRMP décide ; le plan fait foi), **ADR-0012** (renversement partiel du 22/09 : l'import propose, la fiche
décide ; la lecture par modèle inversé), et un encadré ⚠️ daté ici pour tout écart. Le front écrira l'écran (lot 2 du
plan : invitation à l'étape Cadrage, bouton « Réimporter », modale de revue) contre ce contrat.
