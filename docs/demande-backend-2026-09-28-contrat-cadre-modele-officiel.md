# Demande backend — 2026-09-28 — Aligner le référentiel du contrat-cadre sur le modèle officiel ARMP

**Origine** : le pilote a remis le 28/09 le modèle officiel « Document type Contrat-cadre — Fournitures & Prestations
de services » (ARMP 2019, 33 pages). Le front l'a confronté au référentiel servi
(`GET /api/champs-fiche-marche?typeMarche=CONTRAT_CADRE&categorie=FOURNITURES_SERVICES`, 176 champs) :
`docs/analyse-2026-09-28-modele-officiel-contrat-cadre.md`, écarts E1-E14. Le pilote a suivi les recommandations le
28/09 : **corriger E1-E13 en un lot**, sortir de la fiche les informations du candidat, **une seule réponse** pour la
voie électronique ; le plafond de durée attend le juriste ; la production des documents au format du modèle attend le
lot D.

**Portée** : contrat-cadre, fournitures et services. Rien ne change pour la quantité fixe et le marché à commande,
sauf là où un champ partagé est **ouvert** au contrat-cadre (B6). Aucune fiche de contrat-cadre n'existe à notre
connaissance sur DBPRS20 (vidée le 25/09, resemée du seul 2463 à commande) : à vérifier avant les désactivations ;
s'il en existe, les valeurs orphelines restent en base et ne sont pas recopiées à la révision (règle de `B04-VE-01`,
27/09).

**Règle de retrait** (la même que le 27/09) : un champ propre au contrat-cadre qui disparaît passe `actif = false`,
jamais de `DELETE` ; un champ partagé perd `CONTRAT_CADRE` de ses `typesMarche`.

## B1 — La date limite porte son heure (E1)

- `B04-CP-02` « Date et heure limites de remise des offres » : `DATE` → **`DATE_HEURE`** (type livré par V50).
- Une valeur déjà saisie en `AAAA-MM-JJ` doit rester lisible (lue comme `AAAA-MM-JJT00:00`, ou refusée au prochain
  enregistrement avec un 400 nominatif — au choix du backend, à dire ici).
- `DATES_ORDRE` compare `B04-CP-02` (date-heure) aux autres dates `B04-CP-*` sur la date seule.

## B2 — Les trois étapes propres au calendrier de consultation (E2)

Art. 2 du DPAC, « Calendrier prévisionnel de la consultation » :

| code | libellé | type | obligatoire | maître |
|---|---|---|---|---|
| `B04-CP-06` | Envoi des demandes d'offres optimisées | DATE | non | DPAC |
| `B04-CP-07` | Date limite de réception des offres optimisées | DATE | non | DPAC |
| `B04-CP-08` | Envoi des courriers de rejet aux candidats non retenus | DATE | non | DPAC |

Ordre contrôlé par `DATES_ORDRE` quand les dates sont saisies : `B04-CP-02` < `06` < `07` ≤ `08` ≤ `B04-CP-05`.

## B3 — La voie électronique n'a qu'une réponse (E4)

- `B04-RQ-04` « Transmission électronique des offres admise » et `B04-RQ-05` « Modalités d'envoi par voie
  électronique » : **`actif = false`**. La question de cadrage `modeRemise` (`B04-SE-01`) et la rubrique `B04-SE` y
  répondent déjà, pour le contrat-cadre comme pour les autres formes.
- À l'impression du DPAC (lot D, plus tard) : l'option 1 / option 2 de l'art. 5.2 et la clause de re-matérialisation
  suivront `modeRemise` ; rien à faire aujourd'hui, le DPAC produit est la liste « libellé : valeur ».

## B4 — Une seule réponse au rythme de remise en concurrence (E5, E9)

- `B02-PC-02` « Rythme de passation des marchés subséquents » (DPAC, repris AE) reste **la** réponse.
- `B07-PS-01` « Fait générateur de la passation des marchés subséquents » (même alternative, art. 9 du DPAC) et
  `B07-MA-05` (paragraphe commun 2.3 de l'AE art. 4 : survenance / périodicité — même alternative encore) :
  **`actif = false`**. La périodicité se dit dans `B02-PC-03` « Calendrier de remise en concurrence ».
- `B07-MA-04` : les options « Option 1 / Option 2 » deviennent **« Titulaires des lots correspondant à l'objet du
  marché »** / **« Titulaires de tous les lots »** (codes inchangés si une valeur existe ; sinon `LOTS_CORRESPONDANTS` /
  `TOUS_LES_LOTS`).

## B5 — Les informations du candidat sortent de la fiche (E8)

Le modèle les laisse au candidat (renvois (2) à (9) de l'AE) ; la PRMP ne les connaît pas quand elle prépare le DAO,
et leur caractère obligatoire bloque aujourd'hui la validation de toute fiche de contrat-cadre.

- **`actif = false`** : `B03-TI-01`…`05` (titulaire), `B03-GC-02`…`06` (membre du groupement), `B08-FP-06`…`09`
  (banque, titulaire du compte, codes, clé RIB).
- Ces informations rejoindront l'**acte d'engagement rempli par le candidat** (formulaires en ligne, maquette du
  27/09) — rien à construire dans ce lot.

## B6 — Deux champs existants ouverts au contrat-cadre (E6)

Ils existent pour la quantité fixe ; il suffit d'ajouter `CONTRAT_CADRE` à leurs `typesMarche` (catégorie
fournitures et services) :

- `B04-VO-01` « Délai de validité des offres (jours) » — AE art. 20 et lettre d'invitation art. 8 ; maître DPAO → DPAC
  par la répartition du contrat-cadre, repris dans l'AE.
- `B06-AN-02` « Recours gracieux et recours en attribution » — DPAC art. 11 « Voies et délais de recours » (instance
  chargée des recours ; ce n'est pas la juridiction des litiges `B10-VR-01`) ; maître à mettre au **DPAC** pour le
  contrat-cadre (il est CCAP pour la quantité fixe, qui deviendrait AE) — si un champ ne peut avoir qu'un maître pour
  toutes les formes, un champ propre `B06-AN-03` au DPAC est préférable ; au choix du backend, à dire ici.

## B7 — Signataire du contrat-cadre et nomination de la PRMP (E7)

| code | libellé | type | obligatoire | maître | défaut |
|---|---|---|---|---|---|
| `B02-SG-03` | Personne habilitée à signer le contrat-cadre (nom, délégation, date de la décision) | TEXTE_LONG | oui | AE | — |
| `B02-SG-04` | Acte de nomination de la PRMP (nature, numéro, date) | TEXTE | oui | AE | le **mandat PRMP actif** (`refArrete`, `dateDebut`) s'il en existe un — pré-rempli, modifiable |

Si le mécanisme `valeurDefaut` (`PARAM:<CLE>`, V50) ne sait pas lire un mandat, le défaut peut attendre : le champ
reste saisi à la main.

## B8 — Critères pondérés, plafond d'augmentation, catalogue (E10)

| code | libellé | type | obligatoire | condition | maître |
|---|---|---|---|---|---|
| `B07-MA-06` | Critères et sous-critères pondérés de la remise en concurrence | TEXTE_LONG | oui | `attributaires = MULTI` | AE |
| `B05-PM-04` | Plafond d'augmentation des prix à chaque complétude ou remise en concurrence (%) | POURCENTAGE | non | — | AE |
| `B05-PM-05` | Catalogue joint au contrat-cadre | OUI_NON | non | — | AE |

`B05-PM-04` est facultatif : le modèle le laisse « à remplir par le candidat si ce pourcentage est un critère ».

## B9 — Unités et préavis (E11, E12)

- `B07-DU-03` : libellé « Durée des marchés subséquents (**jours**) » — le modèle, art. 7.2, écrit « <préciser le
  nombre de jours> jours ».
- `B07-DU-07` « Préavis de la décision de reconduction (mois) », NOMBRE, facultatif, AE (art. 7.3). Pas de condition :
  `B02-DC-03` « reconductible » est une saisie, pas une clé de cadrage, et ne peut pas conditionner l'affichage.

## B10 — Avance et pénalités saisies une fois (E13)

En contrat-cadre, le CCAP devient l'AE : les reflets de cadrage et les champs propres de l'AE s'impriment dans le
même document, deux fois.

- **Avance** — la question de cadrage `avance` reste (elle conditionne `B08-FI-02`…`04`) et son complément
  `tauxAvance` (`B08-AV-02`) reste **la** réponse. `B08-FI-03` « Montant de l'avance (% …, maximum 20 %) » :
  **`actif = false`** ; son contrôle `AVANCE_SUP_5_GARANTIE:TAUX` se reporte sur `tauxAvance`, comme pour les autres
  formes (à vérifier côté backend : où ce contrôle porte-t-il pour la quantité fixe ?).
- **Pénalités** — la question de cadrage `penalites` (CCAG / plafond différent / non) ne sait pas dire « fixées dans
  les marchés subséquents » ; la rubrique `B07-PE` du contrat-cadre, si. Pour le contrat-cadre : `B09-PR-01` perd
  `CONTRAT_CADRE` de ses `typesMarche`, et la question `penalites` **n'est plus posée** (front, ce lot). Le serveur
  ne la réclame pas pour un contrat-cadre, si son bilan la réclame aujourd'hui.

## B11 — En attente, pas dans ce lot

- **E3 — plafond de durée** : l'AE art. 7.1 dit « cette durée ne peut excéder 2 ans », l'exemple du DPAC art. 2 dit
  36 mois. Question posée au juriste (analyse, § 6). Le contrôle `DUREE_CONTRAT_CADRE_MAX` sur `B02-DC-01` viendra
  avec sa réponse.
- **Production du DPAC et de l'AE au format du modèle** : lot D.

## Ce que le front fait dans ce lot

- La question de cadrage `penalites` n'est plus posée pour un contrat-cadre (B10) ; la réponse éventuelle est
  retirée du cadrage envoyé, comme pour toute question qui cesse d'être posée.
- Rien d'autre : types, conditions, options, désactivations et défauts sont lus du référentiel.

## Tests attendus

- Référentiel du contrat-cadre : `B04-CP-02` en `DATE_HEURE` ; `B04-CP-06`…`08`, `B02-SG-03`/`04`, `B07-MA-06`,
  `B05-PM-04`/`05`, `B07-DU-07` servis ; `B04-RQ-04`/`05`, `B07-PS-01`, `B07-MA-05`, `B03-TI-*`, `B03-GC-*`,
  `B08-FP-06`…`09`, `B08-FI-03` absents ; `B04-VO-01` et le champ de recours présents ; `B09-PR-01` absent.
- Quantité fixe et à commande : référentiel inchangé (même nombre de champs, `B09-PR-01` et `B04-VO-01` toujours là).
- Fiche de contrat-cadre : validation possible sans aucune information du candidat ; `DATES_ORDRE` refuse
  `B04-CP-07` avant `B04-CP-06`.

## Ce que le backend rend

B1 à B10, `docs/api-endpoints.md` si le contrat change (il ne devrait pas : référentiel seulement),
`docs/regles-gestion.md` (§ fiche marché, contrat-cadre), et un encadré ⚠️ daté ici pour tout écart.
