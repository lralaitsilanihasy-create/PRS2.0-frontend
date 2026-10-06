# Demande backend — 2026-10-06 — Le DAO complet : un seul document, sur le plan et la mise en page des DAO réels

> Demande du pilote (06/10) : « Est-ce qu'on peut avoir le document de DAO en version intégrale, mais non pas divisé, et qui a la même
> structure et même mise en page que les DAO qu'on a téléversés ? » Arbitrages du même jour :
> - **les spécifications techniques** : la PRMP joint un **Word**, inséré à sa place ;
> - **le DAO complet seul** : il remplace les documents séparés.

**Le constat.** La fiche produit aujourd'hui des documents **séparés**, remplis depuis la fiche sur les documents types de l'ARMP
(lot D, `scripts/modeles-dao/`) : DPAO (ou DPAC, DPIC), acte d'engagement, CCAP (ou CPS), formulaires du candidat, bordereau des
prix ou DQE. Ils sont servis par `GET /api/fiches-marche/{idDmc}/documents`.

Les DAO réels déposés dans le dépôt sont, eux, **un seul document**, qui suit l'ordre des six documents types de l'ARMP :
- `Documents Types/Travaux/ExemplesDAO/daolance.DAO_2026_4SDC_vf.pdf` (travaux, 187 pages) ;
- `NatureMarches/DAO_Fournitures/Fourniture_a_commande.pdf` (fournitures, 86 pages).

| Ordre | Partie (DAO réel) | Source |
|---|---|---|
| 0 | Page de garde, sommaire général | **à produire** |
| 1 | Instructions aux candidats | **texte fixe** — document type n° 1 |
| 2 | Données particulières (DPAO / DPAC / DPIC) | produit (lot D) |
| 3 | Formulaires de soumission (lettre, fiches de renseignements, modèles de garantie, BP / DQE) | produits (formulaires du candidat, V45 / V59) |
| 4 | Acte d'engagement et ses annexes | produit (lot D) |
| 5 | Cahier des prescriptions spéciales (CCAP / CPS) et ses annexes | produit (lot D) |
| 5 bis | **Spécifications techniques** (devis descriptif, prescriptions, plans) | **Word joint par la PRMP** (B2) |
| 6 | Cahier des clauses administratives générales | **texte fixe** — document type n° 6 |

Les noms ci-dessous sont **proposés** : le backend fait autorité, et ce document sera corrigé en place si la livraison s'en écarte.

---

## B1 — Le document « DAO complet »

- **Un document par version validée de la fiche**, en **Word** et en **PDF**, produit à la validation comme les autres. Il remplace
  les documents séparés dans `GET …/documents` (arbitrage « le DAO complet seul »). L'**avis** spécifique reste un document à part.
- **Le plan** est celui du tableau ci-dessus, dans l'ordre des documents types et avec leur numérotation de sections. Si la fiche est
  allotie, les parties par lot (acte d'engagement, BP / DQE) se suivent, lot par lot, à leur place.
- **La mise en page** est celle des documents types :
  - styles, polices, marges et tableaux des fichiers Word de l'ARMP, déjà repris par les modèles du lot D (`modeles-docx/`) ;
  - chaque partie commence sur une nouvelle page ;
  - **en-tête** : « DAO n° {B02-OB-03} — {objet} » ; **pied de page** : « page n / N », la numérotation est continue.
- **La page de garde** (proposition, alignée sur les DAO réels) : le ministère ou l'entité, la PRMP, « Dossier d'appel d'offres », le
  mode de passation, le numéro du DAO, l'objet, les lots, la source de financement, la date.
- **Le sommaire général** : les parties et leurs pages. En Word, c'est un champ table des matières, mis à jour à l'ouverture ; dans le
  PDF, il porte les numéros de page.
- **Les textes fixes** (Instructions aux candidats, CCAG) sont **recopiés tels quels** des documents types, par catégorie :
  `Documents Types/{Fournitures et services | Travaux | Prestations_Intellectuelles}/1-…Instructions…` et `…/6-…Clauses
  Administratives Générales…`. Ils sont fournis en `.doc` : le backend les convertit une fois en `.docx`, comme il l'a fait pour les
  modèles du lot D. Aucun jeton, aucune condition.
- **Les prestations intellectuelles** suivent le même plan, sous le titre « **Dossier de consultation** » : IC-PI, DPIC, formulaires,
  AE-PI, CPS-PI, CCAG-PI. **Le contrat-cadre** place son DPAC au rang 2.

## B2 — Les spécifications techniques, jointes par la PRMP

| Méthode | URL | Accès | Corps / réponse |
|---|---|---|---|
| GET | `/api/fiches-marche/{idDmc}/specifications` | lecture de la fiche | `{ nomFichier, taille, deposeLe, deposePar }` ou 404 |
| PUT | `/api/fiches-marche/{idDmc}/specifications` | PRMP et UGPM de la fiche | multipart `fichier` (**.docx** seulement, type lu sur le contenu ; taille max proposée 20 Mo) → 200 |
| DELETE | `/api/fiches-marche/{idDmc}/specifications` | idem | 204 |
| GET | `/api/fiches-marche/{idDmc}/specifications/fichier` | lecture de la fiche | le .docx |

- Le fichier est rattaché à la **version** de la fiche, comme le besoin : il est figé à la validation (409 sur une version validée) et
  **recopié** à la révision.
- **Inséré au rang 5 bis**, après le CCAP / CPS et avant le CCAG, sous le titre « Spécifications techniques ». Ses titres rejoignent
  le sommaire général ; ses styles sont ramenés à ceux du DAO quand ils entrent en conflit (sinon la mise en page du document joint
  est gardée).
- **Sans fichier**, la partie n'apparaît pas. Proposition : un **avertissement** au contrôle de la fiche (`SPECIFICATIONS_ABSENTES`,
  non bloquant) pour les fournitures et les travaux, car un DAO réel en porte toujours.

## B3 — Où le DAO complet est servi

- **`GET …/documents`** : le DAO complet, en `.docx` et en `.pdf`, et l'avis. Plus les documents séparés.
- **Le dossier DAO soumis à la Commission** : le DAO complet y est joint à la place des documents séparés.
- **Le retrait par les candidats** (`GET /api/procedures-en-ligne/{idDmc}/documents`) : le DAO complet, en `.docx` et `.pdf`, sous
  la garde des frais (V72). Le candidat y trouve l'acte d'engagement et les formulaires à remplir, qu'il recopie depuis le Word.
- **Les versions déjà validées** (fiches 40 à 48) : le DAO complet est produit à la **première demande**, puis gardé. Sinon, la règle
  est la production à la validation.

## Hypothèses

- **H1** — Les jetons, conditions et sections des documents du lot D ne changent pas : le DAO complet **assemble**, il ne réécrit
  rien. Les preuves `decrire.mjs` / `verifier.mjs` restent valables partie par partie.
- **H2** — Les formulaires du candidat restent aussi saisis **en ligne** (lot 5) : leur place dans le DAO complet est la version
  imprimable, comme dans les DAO réels.

## Questions

1. **Q1** : la conversion `.doc` → `.docx` des Instructions aux candidats et des CCAG garde-t-elle fidèlement la mise en page (tableaux,
   numérotation) ? Sinon, le pilote fournira des `.docx` ouverts dans Word.
2. **Q2** : le PDF du DAO complet porte-t-il les numéros de page du sommaire (calcul serveur), ou faut-il un renvoi « voir sommaire du
   Word » ?
3. **Q3** : une taille maximale du DAO complet à fixer (le Word des spécifications avec plans peut être lourd) ?

## Ce que le front fera, dès la livraison

- **Fiche, étape 7 (Documents)** : le DAO complet en tête (Word, PDF), à la place des documents séparés.
- **Fiche, bloc des pièces** (proposition) : « Spécifications techniques », pour déposer, remplacer, retirer et télécharger le Word ;
  l'avertissement du contrôle s'il manque.
- **Page de la procédure (candidat)** : « Dossier d'appel d'offres complet », Word et PDF, sous la garde des frais.
