# Demande backend — Avis spécifique d'appel d'offres (30/09/2026)

> Plan : `docs/plan-2026-09-30-avis-specifique.md` (arbitrage du pilote du 30/09 : Q1 à Q5).
> Besoin : une fois l'examen du dossier DAO terminé et le PV **favorable** (FAV), ou **favorable avec réserves** (FAVR)
> **après la levée des réserves**, la PRMP imprime l'**avis spécifique d'appel d'offres** de ce DAO.
> Les prestations intellectuelles (lettre d'invitation) feront l'objet d'une demande séparée (lot AV-4).

## B1 — Recopier deux modèles et les couvrir

| Sigle | Catégorie | Formes | Fichiers front |
|---|---|---|---|
| `AVIS-F` | FOURNITURES_SERVICES | QUANTITE_FIXE, A_COMMANDE, CONTRAT_CADRE | `scripts/modeles-dao/modeles/AVIS-F.{txt,json}` |
| `AVIS-T` | TRAVAUX | QUANTITE_FIXE, A_COMMANDE, CONTRAT_CADRE | `scripts/modeles-dao/modeles/AVIS-T.{txt,json}` |

- Source : « AVIS SPECIFIQUES » en tête du document type du contrat-cadre, le seul modèle d'avis des documents types.
- `AVIS-T` est le même modèle **adapté** aux travaux (décision Q2 du pilote). Les textes adaptés sont déclarés en ajouts
  dans le `.json` : « pour exécuter les travaux suivants : », « Les travaux sont répartis en… », prix mixte.
- Décalques vérifiés dans les deux sens : `docs/modeles-dao/AVIS-F.docx` (73/73) et `AVIS-T.docx` (79/79).
- Conditions utilisées : `typeMarche`, `alloti`, `typePrix` (dont MIXTE en travaux), `modeRemise`, `garantieSoumission`,
  et `B04-DS-11 renseigne`. Aucune syntaxe nouvelle.
- Le document se range parmi les documents de la fiche sous le **type `AVIS`**, en .docx et en PDF comme les autres.

## B2 — Jetons nouveaux `{{AVIS.*}}` : les informations de publication

Ce ne sont pas des données du DAO. Elles sont saisies par la PRMP au moment d'imprimer (décision Q4), transmises dans le
corps de la requête (B3), **non écrites dans la fiche**, et conservées avec le document produit (trace).

| Jeton | Contenu | Rendu |
|---|---|---|
| `{{AVIS.date-publication}}` | date de publication de l'avis | JJ/MM/AAAA |
| `{{AVIS.jmp-numero}}` | numéro du Journal des Marchés Publics de l'avis général | tel quel |
| `{{AVIS.jmp-date}}` | date de ce JMP | JJ/MM/AAAA |
| `{{AVIS.supports}}` | autres supports de publication et leurs dates | tel quel |

## B3 — Produire l'avis à la demande

`POST /api/fiches-marche/{idDmc}/avis-specifique`, corps :

```json
{ "datePublication": "2026-10-05", "jmpNumero": "123", "jmpDate": "2026-01-15", "supports": "le quotidien … du 06/10/2026" }
```

**Accès.** PRMP propriétaire de la fiche et son UGPM, comme pour les documents. Les quatre champs sont obligatoires :
400 nominatif (`champ`, `message`) s'il en manque un.

**Rendu.** Sur la **dernière version VALIDÉE** de la fiche, même si une révision est ouverte : c'est le DAO examiné, ou
corrigé par la levée des réserves. Réponse 201 avec les `DocumentFiche` produits (docx et pdf, type `AVIS`,
`dateGeneration`). Chaque impression produit une **nouvelle paire** ; les précédentes restent consultables.

**Garde**, avec un 409 à code stable **`AVIS_INDISPONIBLE`** qui porte une `raison` :

| Raison | Cas |
|---|---|
| `SANS_DOSSIER` | la fiche n'a pas de dossier soumis (`idDossierSoumis` nul) |
| `PV_NON_SIGNE` | aucun PV à `statutPv = SIGNE` pour ce dossier |
| `AVIS_NON_FAVORABLE` | PV signé à `DEF` ou `NSP` |
| `RESERVES_NON_LEVEES` | PV `FAVR` et dossier pas encore à `OBSERVATIONS_LEVEES` ou au-delà (`DECISION_TRANSMISE_SIGMP`, `CLOTURE`) |
| `CATEGORIE_SANS_AVIS` | prestations intellectuelles, en attendant AV-4 |

- Avec un PV `FAV`, l'avis est disponible dès que le PV est signé. Avec un PV `FAVR`, il l'est seulement après la levée
  des réserves (décision Q1 du pilote). Merci de fixer la liste exacte des statuts « réserves levées » selon la navette
  réelle, et de la citer dans votre encadré.
- Cas d'un dossier remplacé par une version postérieure : l'avis se lit sur le dossier soumis **courant** de la fiche.

## B4 — Dire si l'avis est disponible (pour afficher le bouton sans réécrire la règle)

`GET /api/fiches-marche/{idDmc}/avis-specifique/disponibilite` renvoie :

```json
{ "disponible": false, "raison": "RESERVES_NON_LEVEES", "idAvis": "FAVR", "statutPv": "SIGNE", "statutDossier": "EN_VERIFICATION", "idDossierSoumis": 123 }
```

- Mêmes raisons que B3. Même accès.
- Les avis déjà produits apparaissent dans `GET /{idDmc}/documents` (type `AVIS`), du plus récent au plus ancien.
- La page du dossier connaît `idDmc` (`Dossier.idDmc`) : elle utilise les mêmes routes.

## B5 — Référentiel : ce que l'avis imprime et que les marchés ordinaires n'ont pas

| Code | Aujourd'hui | Demande |
|---|---|---|
| `B04-DS-05` « Montant à payer pour le dossier de consultation (Ariary) » | contrat-cadre seul | servi aussi aux **quantités fixes et à commande**, fournitures et travaux ; **facultatif** |
| `B04-DS-07` à `-10` « Adresse de consultation du dossier » (nom, fonction, bureau, localité) | contrat-cadre seul | idem, facultatifs |
| `B04-DS-11` « Adresse de consultation du dossier : e-mail » | n'existe pas | **nouveau**, TEXTE, facultatif, les six formes, rubrique DS |
| `B05-GS-03` « Montant de la garantie de soumission » | fournitures QF/AC | servi aussi au **contrat-cadre de fournitures** (même règle par lot, condition `garantieSoumission = OUI`) |
| `B05-GQ-03` « Montant de la garantie de soumission » | travaux QF/AC | servi aussi au **contrat-cadre de travaux** |

- Ces champs sont facultatifs pour ne bloquer la validation d'aucune fiche existante. S'ils sont vides, l'avis imprime
  des pointillés (règle R2) et la modale d'impression du front prévient la PRMP avant d'imprimer.
- Le numéro de l'appel d'offres est `B02-OB-03` en marché ordinaire et `B02-OE-01` en contrat-cadre, l'objet
  `B02-OB-01`, l'acheteur `B01-AC-01` et la PRMP `B01-AC-05`.
- Remise des offres :
  - fournitures QF/AC : `B04-LR-02`, `LR-03` et `LR-04` ;
  - travaux QF/AC : `B01-AC-02` et `B04-OV-02` (comme dans le DPAO-T) ;
  - contrat-cadre : `B04-RQ-03` et `B04-CP-02`.
  
  Tous sont déjà servis.

## B6 — Tests attendus

- Rendu ≡ modèle pour `AVIS-F` et `AVIS-T` (73 et 79 unités).
- Garde : les cinq raisons, dont un PV `FAVR` avant puis après la levée des réserves.
- Une fiche révisée après la levée des réserves : l'avis se lit sur la dernière version **validée**.
- Deux impressions successives : deux paires de documents, la première toujours consultable.
- Jetons `AVIS.*` : dates au format JJ/MM/AAAA, absents du stockage de la fiche.

## Ce que le backend rend

Commit(s) qui referment B1 à B6, le script du référentiel pour DBPRS20 (B5), les tests, et un encadré ⚠️ daté ici pour
tout écart. Côté front ensuite (lot AV-3) : le bouton « Imprimer l'avis spécifique » à l'étape 7 de la fiche DAO et sur
la page du dossier, la modale des informations de publication, et la liste des avis produits.
