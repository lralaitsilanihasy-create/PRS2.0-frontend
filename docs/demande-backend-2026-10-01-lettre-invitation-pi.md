# Demande backend — Lettres d'invitation des prestations intellectuelles (01/10/2026, lot AV-4)

> Plan : `docs/plan-2026-10-01-lettre-invitation-pi.md`, accepté par le pilote le 01/10 (Q1 à Q5 selon les
> recommandations). C'est le pendant de l'avis spécifique (`demande-backend-2026-09-30-avis-specifique.md`) pour les
> prestations intellectuelles. Leur procédure n'a pas d'avis public : les candidats de la **liste restreinte** reçoivent
> chacun une **lettre d'invitation**.

## B1 — Recopier le modèle `LETTRE-PI`

- `scripts/modeles-dao/modeles/LETTRE-PI.{txt,json}`, tiré de la source `pi-ic` (`extraire.mjs`) : « 1.1. LETTRE D'INVITATION » du
  volume 1 du dossier type PI.
- Décalque vérifié dans les deux sens : `docs/modeles-dao/LETTRE-PI.docx` (**43/43**).
- Comme l'avis, le modèle est **hors des couvertures** : il ne se produit pas à la validation et l'import ne le lit pas.
- Catégorie `PRESTATIONS_INTELLECTUELLES`, formes `QUANTITE_FIXE` et `A_COMMANDE`.
- En-tête commun avec l'avis : `{{IMAGE:embleme}}`, autorité, PRMP, UGPM, puis le titre « LETTRE D’INVITATION »
  (ligne `TITRE` dans le corps, pas de `TITRE` en tête, comme l'avis).
- Le mode de sélection reprend les quatre rédactions du document type, sous les conditions du DPIC sur `B02-MS-01`
  (`SFQC`, `BUDGET`, `MOINDRE-COUT`, `QUALITE-SEULE`).
- Les paragraphes portent déjà leur numéro (« 1. » à « 5. ») dans le texte officiel : pas de `{{NUM}}`.

## B2 — Jetons `{{LETTRE.*}}` : saisis à l'impression, jamais écrits dans la fiche

| Jeton | Contenu | Rendu |
|---|---|---|
| `{{LETTRE.lieu}}` | lieu d'envoi | tel quel |
| `{{LETTRE.date}}` | date d'envoi | JJ/MM/AAAA |
| `{{LETTRE.destinataire}}` | le candidat de **cette** lettre | son nom, puis son adresse à la ligne |
| `{{LETTRE.candidats}}` | la liste restreinte entière | un candidat par ligne, « - Nom », dans l'ordre saisi |

## B3 — Produire les lettres à la demande

`POST /api/fiches-marche/{idDmc}/lettres-invitation`, corps :

```json
{ "dateEnvoi": "2026-10-05", "lieu": "Antananarivo",
  "candidats": [ { "nom": "Cabinet A", "adresse": "Lot II A 12, Antananarivo" }, { "nom": "Bureau B", "adresse": "…" } ] }
```

- **Accès** : comme l'avis (PRMP et UGPM du périmètre, mandat actif exigé pour imprimer ; 403 aux autres).
- **400 nominatif** : `dateEnvoi`, `lieu`, `candidats` (au moins un, décision Q4 : pas de nombre imposé),
  `candidats[i].nom`, `candidats[i].adresse`.
- **Garde** : la même que l'avis, PV signé FAV ou FAVR après la levée des réserves. 409 `LETTRE_INDISPONIBLE` avec
  `details.raison`, mêmes raisons que l'avis, plus `CATEGORIE_SANS_LETTRE` pour les fournitures et les travaux.
- **Rendu** : sur la dernière version **validée**, **une lettre par candidat** (Q1), en .docx et en PDF. Chaque lettre a
  son destinataire, et toutes ont la même liste. Le type de document est `LETTRE_INVITATION`. Le nom du fichier porte
  l'horodatage **et le rang du candidat** (`LETTRE_<plan>_<ligne>_v2_20261005-143000_01.pdf`). Réponse 201 avec tous
  les `DocumentFiche` produits.
- **Trace** : la saisie (`dateEnvoi`, `lieu`, `candidats`) est gardée avec chaque document, dans `publication` comme
  pour l'avis, pour que l'écran la reprenne à la réimpression.
- **Journal** : `LETTRES_INVITATION_IMPRIMEES` sur le dossier DAO, avec le nombre de candidats.

## B4 — Disponibilité

`GET /api/fiches-marche/{idDmc}/lettres-invitation/disponibilite`, **même forme** que celle de l'avis
(`disponible`, `raison`, `idAvis`, `statutPv`, `statutDossier`, `idDossierSoumis`). `CATEGORIE_SANS_LETTRE` hors PI.
Les lettres produites apparaissent dans `GET /{idDmc}/documents` (type `LETTRE_INVITATION`), du plus récent au plus
ancien, comme les avis.

## B5 — Statut « Lancé » (décision Q5)

La **première** impression des lettres fait passer la ligne et sa filiation de `PREVU` à `LANCE`, exactement comme la
première impression de l'avis (`demande-backend-2026-09-30-statut-lance-avis.md` §B2) : statut manuel conservé,
journal `LIGNE_LANCEE`. `MarcheDto.avisImprimeLe` vaut alors la date de cette première impression : le nom reste, il
désigne « la publication ». Dites dans votre encadré si vous préférez un champ distinct.

## B6 — Tests

- Rendu ≡ modèle (43), avec chacune des quatre rédactions du mode de sélection.
- Garde : les raisons, dont `CATEGORIE_SANS_LETTRE`.
- 400 nominatifs, dont une liste vide.
- Deux candidats : deux paires de documents, chacune avec son destinataire et la même liste.
- Première impression : `PREVU → LANCE` ; réimpression sans effet.

## Ce que le backend rend

Commit(s) qui referment B1 à B6, les tests, et un encadré ⚠️ daté ici pour tout écart. Côté front ensuite (lot
AV-4.3) : l'encadré « Lettres d'invitation » à la place de l'avis pour une fiche PI, la modale de la liste restreinte,
et la liste des lettres.
