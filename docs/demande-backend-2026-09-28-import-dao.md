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

## B3 — Ce que l'import ne fait pas

- Le fichier **n'est pas conservé** (Q7) : lu en mémoire, oublié ; seuls le nom et l'empreinte vont au journal.
- Pas d'OCR : un `.docx` fait d'images ne donne rien (avertissement « hors gabarit »).
- Les champs par lot (`CODE#n`) : aucun dans les deux modèles du contrat-cadre ; la règle viendra avec les fournitures
  (lot D2), où le lot sera lu dans l'intitulé (« Lot n° 1 : … »).

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

## Ce que le backend rend

B1 à B4, `docs/api-endpoints.md` (deux routes, `ImportDaoResult`), `docs/regles-gestion.md` (§ fiche marché : l'import
propose, la PRMP décide ; le plan fait foi), **ADR-0012** (renversement partiel du 22/09 : l'import propose, la fiche
décide ; la lecture par modèle inversé), et un encadré ⚠️ daté ici pour tout écart. Le front écrira l'écran (lot 2 du
plan : invitation à l'étape Cadrage, bouton « Réimporter », modale de revue) contre ce contrat.
