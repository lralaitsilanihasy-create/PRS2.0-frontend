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

> ⚠️ **Livraison backend du 2026-09-29 (§B1).** Conforme : `FormulairesCandidat` (rendu), `LectureDao` (import),
> ADR-0011 complété. Cinq précisions :
> - **Rangée-marqueur** : la première cellule doit être un seul paragraphe, exactement le marqueur, et les autres cellules
>   vides, comme dans `unites()` du front. La plage historique `A3B-NATURES`, dont le marqueur est collé au texte d'une
>   cellule, garde sa lecture. Un paragraphe de cellule qui n'est que le marqueur n'ouvre jamais une plage de rangées.
> - **Une cellule dont tout est omis garde sa place**, vide : la rangée ne perd pas de colonne.
> - **`categorie` absente** vaut `FOURNITURES_SERVICES`, comme partout ailleurs.
> - **`{{CODE.parLot}}`** : un lot sans valeur s'imprime en pointillés dans l'énumération. Dans un document de lot, ou pour
>   un champ que la ligne ne saisit pas par lot, c'est la valeur seule.
> - **Import, sortie** : une valeur lue sous « Lot n° k » est servie avec `code` = le code nu et **`lot` = k**. Le front
>   l'applique sous `CODE#k`. Une valeur par lot sur une ligne non allotie, un lot hors du plan, ou une valeur sans lot
>   pour un champ par lot portent une anomalie. Une réponse déduite `typeMarche` ou `categorie` n'est jamais une réponse
>   de cadrage, puisque la forme se lit au plan. Si elle contredit le plan, elle est rendue en `divergences`.

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

> ⚠️ **Livraison backend du 2026-09-29 (§B2).** Les sept champs sont dans le fichier de correspondance des fournitures
> (`docs/referentiel-champs-fiche-marche-fournitures.csv`, copie de test identique) et dans
> `docs/referentiel/2026-09-29-lot-d2-champs-fournitures.sql` pour DBPRS20. Deux écarts :
> - **La rubrique `B02-VA` n'existait pas.** Les rubriques sont figées par migration, d'où **V52** (« Offres variantes »,
>   bloc B02, rangée juste après `B02-LV`). Le script de DBPRS20 se lance donc après le redémarrage qui l'applique.
> - **`B10-IR-03` n'a pas de condition au référentiel.** Une condition de champ ne lit que le cadrage, pas un autre champ :
>   « `B10-IR-01 = OUI` » reste côté modèle, comme demandé.
>
> Le référentiel sert désormais 179 champs en quantité fixe et 184 à commande (172 et 177 avant).

## B3 — Production

- À la validation d'une fiche **`QUANTITE_FIXE` ou `A_COMMANDE` / `FOURNITURES_SERVICES`** : **DPAO** (un),
  **CCAP** (un, titre « Cahier des prescriptions spéciales ») et **AE** (un par lot sur une ligne allotie, sinon un)
  rendus depuis `modeles/dao/DPAO-F.txt`, `CCAP-F.txt`, `AE-F.txt`, à la place du lot 2a pour ces types. Les pièces
  dérivées du besoin (liste des fournitures, bordereau, tableau de conformité) sont inchangées.
- `{{DERIVE.fin-validite-offre}}` (AE) : `B04-LR-03 + B04-VO-01` — le calcul existant.
- Ce qui reste entre chevrons se remplit après le DAO (le candidat : identification, prix, bordereaux, domiciliation,
  signatures ; la banque : modèles de garanties ; la notification) : ces chevrons s'impriment tels quels.
- Cases, flèches et autres glyphes de police symbolique : même traitement qu'en D1 (ZapfDingbats au PDF).

> ⚠️ **Livraison backend du 2026-09-29 (§B3).** Conforme : `ModelesDao.COUVERTURES` associe `DPAO-F`, `CCAP-F` et `AE-F`
> à la quantité fixe et au marché à commande, en fournitures et services. Chaque fichier n'est chargé qu'une fois. Le
> libellé du CCAP est « Cahier des prescriptions spéciales » pour ces formes, et reste « Cahier des clauses
> administratives particulières » pour les autres catégories. Les travaux et les prestations intellectuelles restent au
> lot 2a.
>
> **Point à arbitrer, signalé et non tranché ici.** Le lot 2a imprimait chaque champ saisi de la fiche dans une liste
> « libellé : valeur ». Les trois modèles, eux, n'impriment et ne testent que leurs trous. Depuis D2, **52 champs saisis des
> fournitures n'apparaissent plus dans aucun document produit** : ni jeton, ni condition dans DPAO-F, CCAP-F ou AE-F.
> Certains sont sans doute voulus : domiciliation bancaire, remise électronique portée par la clause du juriste, ouverture
> des plis. D'autres portent un engagement :
> - `B05-TP-02` et `B05-TP-03`, montants minimum et maximum annuels du marché à commande, qu'imprimait l'AE du lot 2a ;
> - `B08-PA-04` (termes de paiement) et `B08-PA-08` (délai de paiement) ;
> - `B08-AC-01` et `-02` (acomptes), `B08-AV-03`, `-05` et `-06` (avance) ;
> - `B06-EO-03` à `-08`, la méthode d'évaluation ;
> - `B03-CQ-01` à `-04`, `-09` et `-10`, les qualifications ;
> - `B03-NA-01` et `-02` (nantissement) et `B03-ST-02` (sous-traitance).
>
> La liste complète : `B02-AU-05`, `-07` ; `B03-CQ-01` à `-04`, `-09`, `-10` ; `B03-NA-01`, `-02` ; `B03-ST-02` ;
> `B04-OP-02`, `-03`, `-10` à `-13` ; `B04-RO-03` ; `B04-SE-03`, `-06`, `-10`, `-11`, `-15`, `-16`, `-17` ; `B05-CP-03` ;
> `B05-GS-04`, `-10` à `-14` ; `B05-TP-02`, `-03` ; `B06-AN-02` ; `B06-EO-03` à `-08` ; `B08-AC-01`, `-02` ; `B08-AV-03`,
> `-05`, `-06` ; `B08-PA-01`, `-02`, `-04`, `-08` ; `B09-DG-02` ; `B10-IR-02`.
>
> Le document type décide de ce qui s'imprime (ADR-0011), donc c'est aux modèles d'ajouter un trou s'il le faut. Le
> backend n'a rien retiré ni ajouté.

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

> ⚠️ **Livraison backend du 2026-09-29 (§B4).** Conforme.
> - `ModelesDaoTest` charge les trois fichiers : 42, 22 et 65 conditions, aucune section non déclarée, cinq modèles.
> - `ModelesDaoFournituresTest` (3, pur) couvre les deux scénarios demandés, rédaction par rédaction, ainsi que les
>   marqueurs de cellule et de rangée et les clés `typeMarche` et `categorie`.
> - **Rendu brut** : `node verifier.mjs DPAO-F AE-F CCAP-F DPAC-CC AE-CC --dossier=C:/Users/LANTO/rendus-dao` donne
>   234/234, 455/455 et 456/456, et le contrat-cadre reste à 174/174 et 378/378. Tout est identique, sans manquant ni
>   inventé.
>
> Les tests qui vérifiaient le rendu « libellé : valeur » du lot 2a (`FicheMarcheDocumentsIntegrationTest`) portent
> désormais sur une ligne de **travaux**, qui garde ce rendu. Ceux qui lisaient les fournitures en lot 2a lisent
> maintenant les documents types. Suite complète : 1428 tests, dont une assertion de la remise électronique mise à jour
> dans la foulée.

## Ce que le backend rend

B1 à B4, `docs/api-endpoints.md` (marqueurs de cellule et de rangée, `.parLot`), `docs/regles-gestion.md`, ADR-0011
complété, script du référentiel pour DBPRS20, et un encadré ⚠️ daté ici pour tout écart.

## B5 — Import : quatre règles de lecture ajoutées le 29/09 (à reporter dans `LectureDao`)

Mesurées sur le dossier réel 2463 (voir le plan d'import, encadré du 29/09) ; `scripts/import-dao/lire.mjs` les porte :
1. un paragraphe du modèle dont le texte fixe n'a **aucune lettre** (« {{CODE}}. ») est un **jeton seul** (lu entre
   ses voisins), jamais un motif ;
2. une ancre de **moins de 8 lettres** de texte fixe ne donne jamais la confiance **haute** (moyenne au plus) ;
3. un paragraphe n'**atteste** ses sections que s'il a au moins **20 lettres** de texte fixe et qu'**aucun paragraphe de
   même texte** n'existe hors de ces sections ;
4. **PDF** (`.pdf` accepté, 415 levé pour ce type) : `scripts/import-dao/PdfLignes.java` — texte horizontal dans le
   cadre de la page, matrice non inclinée (filigrane écarté) ; morceaux d'une ligne recollés, colonnes séparées sur un
   saut d'abscisse ; paragraphes par interligne ; en-têtes, pieds (même texte au même endroit sur ≥ 3 pages) et numéros
   de page écartés. Un PDF sans texte (scanné) : 422 « document sans texte : saisissez la fiche ».

> ⚠️ **Livraison backend du 2026-09-29 (§B5).** Les quatre règles sont portées : `LectureDao` pour les règles 1 à 3,
> `LecturePdf` pour la règle 4. `PdfLignes.java` et `paragraphesPdf` sont portés tels quels, positions arrondies au
> dixième comme la sortie TSV. PDFBox 3.0.3 était déjà une dépendance, donc `pom.xml` ne change pas.
>
> **Parité mesurée le 29/09** contre `lire.mjs` (commit d56ebd1) sur trois entrées : les DPAC et AE `.docx` de la
> fiche 27, le PDF réel du 2463 et le rendu brut des trois modèles D2. L'extraction est identique : 350, 1544 et 1147
> unités. La lecture est identique sur la fiche 27 et sur le 2463. Sur le rendu brut, qui contient toutes les rédactions
> à la fois, les seules différences sont les écarts déjà documentés le 28/09 : une clé en conflit n'est pas gardée en
> cadrage.
>
> Quatre écarts :
> - **Le texte fixe sans lettre d'un jeton seul n'est pas la valeur.** Dans « {{B05-GS-03.parLot}}. », le point du modèle
>   restait collé à la dernière valeur. « Lot n° 2 : 500 000 Ariary. » ne se lisait plus comme un montant, et le lot 2 était
>   perdu. Le point est retiré de la valeur lue. Cela ne change rien sur la fiche 27 ni sur le 2463 ; sur le rendu brut, une
>   seule valeur perd son point. **À reporter dans `lire.mjs`.**
> - **Message du 415** : « Seul un fichier Word (.docx) ou PDF (.pdf) peut être importé. » Un faux PDF, chiffré ou
>   endommagé, rend 415 avec « Ce fichier ne se lit pas comme un document PDF. »
> - **PDF scanné** : 422 avec le code stable `DOCUMENT_SANS_TEXTE` et le message « Document sans texte : saisissez la
>   fiche. », avec une majuscule initiale comme les autres messages.
> - **Travaux et prestations intellectuelles** : sans modèle, ils rendent toujours 422 `MODELE_ABSENT`.
>
> **Constat à reporter au front : la lecture PDF sur nos propres PDF.** Sur le DPAC en PDF que le serveur produit
> (OpenPDF), la lecture ne reconnaît que 31 unités, contre 118 sur le `.docx`. La première lettre de chaque ligne est
> détachée (« M ARCHE DE », « A ttestations… ») et les lignes d'un paragraphe ne sont pas rejointes. `lire.mjs` donne
> exactement la même chose, ce n'est donc pas un effet du portage. Aucune valeur n'est fausse en confiance haute. Une
> valeur de texte en confiance moyenne peut en revanche garder la lettre détachée. Les seuils semblent réglés sur la mise
> en page du 2463 ; à mesurer côté front avant de s'y fier sur d'autres PDF.
>
> **Lecture « par clause » des DAO adaptés** : recommandée par le front, elle attend la décision du pilote et n'est pas
> livrée ici.
