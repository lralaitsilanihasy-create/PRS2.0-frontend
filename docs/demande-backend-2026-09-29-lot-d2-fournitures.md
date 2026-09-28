# Demande backend — 2026-09-29 — Lot D2 : les documents des fournitures sur leurs documents types officiels

**Origine** : lot D (feu vert du pilote du 28/09), suite annoncée au plan `docs/plan-2026-09-28-lot-d-dao-complet.md`
(D2) et confirmée par le pilote le 28/09 (« oui » : D2 d'abord, puis la lecture du PDF). Après le contrat-cadre (D1,
livré, `docs/demande-backend-2026-09-28-lot-d-dao-complet.md`), les **fournitures, quantité fixe et à commande** :
leurs trois documents produits sont décrits et vérifiés côté front.

| fichier de commande | document | source ARMP | fidélité du décalque |
|---|---|---|---|
| `scripts/modeles-dao/modeles/DPAO-F.txt` | Données particulières de l'appel d'offres | doc 2 « Données Particulières d'Appel d'Offres » | 234 / 234 |
| `scripts/modeles-dao/modeles/AE-F.txt` | Acte d'engagement (un par lot si la ligne est allotie) | doc 4 « Cadre d'acte d'engagement » | 455 / 455 |
| `scripts/modeles-dao/modeles/CCAP-F.txt` | Cahier des prescriptions spéciales — CCAP et annexes | doc 5 « Cahier des Prescriptions Spéciales » | 456 / 456 |

Un seul modèle par document pour les deux formes : ce qui n'appartient qu'à l'une (« 1.2 Marché à commandes », délais,
durée de validité, stock) est sous condition `typeMarche`. Les **Spécifications techniques** du doc 5 ne sont pas dans
`CCAP-F` : le serveur les produit déjà depuis le besoin (liste des fournitures, tableau de conformité). Les
**Instructions aux candidats** (doc 1) et le **CCAG** (doc 6) sont des textes fixes : à joindre tels quels, hors de
cette demande.

## B1 — Trois extensions du moteur (ADR-0011)

Le DPAO est un **tableau** « Clause des IC | Données particulières » dont les rédactions au choix sont DANS les
cellules ; certaines rangées n'existent que pour une forme. Le moteur de D1 ne connaît les marqueurs qu'en paragraphe.

1. **Marqueurs dans une cellule** : un paragraphe de cellule (RS) exactement `{{SI:NOM}}` / `{{FINSI:NOM}}` ouvre et
   ferme une section **à l'intérieur de la cellule**, même pile, même évaluation ; jamais imprimé.
2. **Marqueurs de rangée** : une ligne de tableau (`LIGNE`) dont la première cellule est exactement `{{SI:NOM}}` (resp.
   `{{FINSI:NOM}}`) et les autres vides ouvre (ferme) une section de **rangées** ; la ligne-marqueur n'est jamais
   imprimée. (Même idée que la plage `A3B-NATURES`, généralisée.)
3. **`{{CODE.parLot}}`** : dans un document COMMUN (DPAO, CCAP), la valeur d'un champ saisi **par lot**, énumérée
   « Lot n° 1 : v1 ; Lot n° 2 : v2 » (chaque valeur formatée comme `{{CODE}}`) ; sur une ligne non allotie, la valeur
   seule. Utilisé pour `B09-LL-01` (lieu de livraison), `B05-GS-03` (garantie de soumission), `B06-EO-12` (délai
   maximum). Dans un document de lot (AE), `{{CODE}}` donne déjà la valeur du lot.

Et, pour l'**import du DAO** (`LectureDao`, ADR-0012), qui lit ces mêmes modèles à l'envers : les deux nouveaux
marqueurs y délimitent les sections comme au rendu (un paragraphe de cellule reconnu atteste la section de sa
cellule ; une rangée reconnue, celle de sa rangée), et `{{CODE.parLot}}` y est lu comme une énumération « Lot n° k :
valeur » rendant `CODE#k`. Ainsi l'import s'ouvre aux fournitures (`FORMES_IMPORTABLES` du front : `QUANTITE_FIXE`,
`A_COMMANDE` ajoutées à la livraison).

Et une précision d'évaluation : les clés **`typeMarche`** et **`categorie`** de la fiche sont lisibles par les
conditions (comme le front les injecte dans le cadrage effectif). Le découpage des termes ne coupe pas une valeur qui
contient « et » (« Caution personnelle et solidaire », « Ariary et devise pour la part importée ») — acquis de D1.

## B2 — Sept champs que les modèles demandent et que la fiche n'a pas

Fournitures et services, quantité fixe et à commande, saisie, facultatifs.

| code | libellé | type | maître | trou du modèle |
|---|---|---|---|---|
| `B02-VA-01` | Offres variantes prises en considération | LISTE : « Offre de base évaluée la moins-disante » / « Toutes les offres conformes aux spécifications » (condition `variantes = OUI`) | DPAO | DPAO 1.1 « Lorsque les variantes sont autorisées, insérer l'un des deux paragraphes suivants » |
| `B05-CP-04` | Transport intérieur jusqu'à la destination finale à la charge du fournisseur (fournitures importées) | OUI_NON (condition `provenance = IMPORTEES`) | DPAO | DPAO 6.6 « <indiquer ici au cas où l'Acheteur souhaite que le Fournisseur assure le transport intérieur…> » |
| `B05-CP-05` | Lieu (CIP) ou port (CIF) de destination des fournitures importées | TEXTE (condition `provenance = IMPORTEES`) | DPAO | DPAO 6.6 et CCAP art. 17 « CIP <lieu> / CIF <port> » |
| `B05-VP-03` | Indices d'actualisation des prix fermes (nature et sources) | TEXTE_LONG (condition `prixRevisable = NON`) | CCAP | CCAP art. 8.2 « <indiquer la nature des indices et les sources…> » |
| `B09-DG-03` | Pénalité pour non-respect des garanties contractuelles (% du prix initial) | POURCENTAGE | CCAP | CCAP art. 22 « <taux de la pénalité> » |
| `B09-DG-04` | Délai accordé pour remédier aux défauts pendant la garantie | TEXTE | CCAP | CCAP art. 22 « <durée> » |
| `B10-IR-03` | Taux de l'indemnité de résiliation (%, si différent des 4 % du CCAG) | POURCENTAGE (facultatif, sous `B10-IR-01 = OUI` côté modèle) | CCAP | CCAP art. 23 « <pourcentage> % » |

Les options de `B02-VA-01` s'écrivent **exactement** ainsi : les conditions du DPAO les citent.

## B3 — Production

- À la validation d'une fiche **`QUANTITE_FIXE` ou `A_COMMANDE` / `FOURNITURES_SERVICES`** : **DPAO** (un),
  **CCAP** (un, titre « Cahier des prescriptions spéciales ») et **AE** (un par lot sur une ligne allotie, sinon un)
  rendus depuis `modeles/dao/DPAO-F.txt`, `CCAP-F.txt`, `AE-F.txt`, à la place du lot 2a pour ces types. Les pièces
  dérivées du besoin (liste des fournitures, bordereau, tableau de conformité) sont inchangées.
- `{{DERIVE.fin-validite-offre}}` (AE) : `B04-LR-03 + B04-VO-01` — le calcul existant.
- Ce qui reste entre chevrons se remplit après le DAO (le candidat : identification, prix, bordereaux, domiciliation,
  signatures ; la banque : modèles de garanties ; la notification) : ces chevrons s'impriment tels quels.
- Cases, flèches et autres glyphes de police symbolique : même traitement qu'en D1 (ZapfDingbats au PDF).

## B4 — Tests

- Chargement : trois fichiers, 42 / 22 / 65 conditions, aucune non déclarée ; marqueurs de cellule et de rangée lus.
- **Quantité fixe, non allotie, nationale, prix unitaires fermes, garantie de soumission, sans avance** puis **à
  commande, allotie (2 lots), importée CIP, prix révisables, avance 15 % en garantie bancaire, groupement conjoint ou
  solidaire** : dans chaque document, les rédactions retenues et elles seules — par exemple, DPAO : « Les prix sont fermes
  et non révisables » vs « Les prix sont révisables » ; la rangée « 1.2 Marché à commandes » présente dans le second
  seulement ; garantie de soumission « Lot n° 1 : … ; Lot n° 2 : … » ; CCAP : article 10 « délai de livraison fixé à … »
  vs « fixé dans le bon de commande » ; annexe « garantie bancaire de restitution d'avance » dans le second seulement ;
  AE : « Bordereau des prix pour les fournitures locales » (quantité fixe) vs le bordereau des importées, deux AE « lot
  n° 1 » / « lot n° 2 ».
- **Rendu brut** des trois fichiers dans un dossier de test : `node verifier.mjs DPAO-F AE-F CCAP-F --dossier=…`.
- Contrat-cadre inchangé (D1).

## Ce que le backend rend

B1 à B4, `docs/api-endpoints.md` (marqueurs de cellule et de rangée, `.parLot`), `docs/regles-gestion.md`, ADR-0011
complété, script du référentiel pour DBPRS20, et un encadré ⚠️ daté ici pour tout écart.
