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

> ⚠️ **Livraison backend du 2026-09-30 (§B1).** Conforme. `AVIS-F` et `AVIS-T` sont recopiés tels quels, avec 17 et 19
> conditions. Le comparateur donne 73/73 et 79/79 sur le rendu brut du serveur. Un modèle par catégorie couvre les trois
> formes (`ModelesDao.AVIS`). Ils sont volontairement **hors de `ModelesDao.COUVERTURES`**, que lisent la production à la
> validation et l'import : l'avis ne se produit qu'à la demande, et un DAO importé ne se lit pas contre l'avis. Type de
> document `AVIS`, libellé « Avis spécifique d'appel d'offres », en .docx et en .pdf.

## B2 — Jetons nouveaux `{{AVIS.*}}` : les informations de publication

Ce ne sont pas des données du DAO. Elles sont saisies par la PRMP au moment d'imprimer (décision Q4), transmises dans le
corps de la requête (B3), **non écrites dans la fiche**, et conservées avec le document produit (trace).

| Jeton | Contenu | Rendu |
|---|---|---|
| `{{AVIS.date-publication}}` | date de publication de l'avis | JJ/MM/AAAA |
| `{{AVIS.jmp-numero}}` | numéro du Journal des Marchés Publics de l'avis général | tel quel |
| `{{AVIS.jmp-date}}` | date de ce JMP | JJ/MM/AAAA |
| `{{AVIS.supports}}` | autres supports de publication et leurs dates | tel quel |

> ⚠️ **Livraison backend du 2026-09-30 (§B2).** Conforme. Les quatre jetons sont rendus depuis le corps de la requête,
> les dates au format JJ/MM/AAAA, les deux autres tels quels. Absents, ils s'impriment en pointillés (R2), ce qui ne se
> produit pas par la route, qui les exige. Rien n'est écrit dans la fiche : le test `impression` le vérifie sur les
> valeurs stockées. La trace est gardée avec chaque document produit, dans la colonne `PUBLICATION` (JSON, **V56**),
> et rendue dans `publication` sur la liste des documents.

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

> ⚠️ **Livraison backend du 2026-09-30 (§B3).** Conforme, avec quatre précisions :
> - **La raison du 409 est dans `details.raison`**, la forme commune des erreurs métier qui portent un complément,
>   comme `details.statut` de `DOSSIER_EN_EXAMEN`. Le corps porte aussi `code: AVIS_INDISPONIBLE` et `idDossier`.
> - **Statuts « réserves levées »** : `OBSERVATIONS_LEVEES`, `DECISION_TRANSMISE_SIGMP`, `CLOTURE`. Ils sont lus sur la
>   navette réelle :
>   - le vérificateur pose `OBSERVATIONS_LEVEES` à la levée ;
>   - pour un FAVR, la transmission à SIGMP n'est acceptée qu'à partir de `OBSERVATIONS_LEVEES`
>     (`TransmissionSigmpService`, cas 2) ;
>   - l'archivage, qui pose `CLOTURE`, n'est accepté qu'après la transmission.
>
>   Aucun autre chemin ne mène un FAVR à ces statuts. En particulier, `EN_ATTENTE_DECISION_PRMP` (observations
>   maintenues) donne `RESERVES_NON_LEVEES`.
> - **Ordre des gardes** : la catégorie d'abord (`CATEGORIE_SANS_AVIS` même sans dossier), puis dossier, PV, avis et
>   réserves. Une sixième raison, `FICHE_NON_VALIDEE`, sert de garde-fou (dossier sans version validée) ; elle ne doit
>   pas se produire.
> - **« Même si une révision est ouverte »** : le code lit bien la dernière version **validée**. Mais une révision n'est
>   possible que quand le dossier est rendu à la PRMP (`DOSSIER_EN_EXAMEN` sinon, lot C). Or `OBSERVATIONS_LEVEES`,
>   `DECISION_TRANSMISE_SIGMP` et `CLOTURE` sont tenus par la Commission. Un avis disponible et une révision ouverte
>   ne coexistent donc pas en pratique. Le cas réel est celui d'une fiche révisée et revalidée pendant la rectification,
>   puis de la levée : l'avis se lit alors sur la v2 (test `ficheRevisee`).
>
> Chaque impression produit une nouvelle paire, dont le nom porte l'horodatage (`AVIS_<plan>_<ligne>_v2_20261005-143000.pdf`).
> Pour le permettre, V56 lève pour ce type l'unicité « type, extension, lot par version » de V43 et ajoute `AVIS` à la
> liste fermée des types. L'impression est inscrite au journal du dossier (`AVIS_SPECIFIQUE_IMPRIME`). Accès : PRMP et
> UGPM au périmètre de la fiche, mandat actif exigé pour imprimer ; l'Administrateur et la Commission reçoivent 403.

## B4 — Dire si l'avis est disponible (pour afficher le bouton sans réécrire la règle)

`GET /api/fiches-marche/{idDmc}/avis-specifique/disponibilite` renvoie :

```json
{ "disponible": false, "raison": "RESERVES_NON_LEVEES", "idAvis": "FAVR", "statutPv": "SIGNE", "statutDossier": "EN_VERIFICATION", "idDossierSoumis": 123 }
```

- Mêmes raisons que B3. Même accès.
- Les avis déjà produits apparaissent dans `GET /{idDmc}/documents` (type `AVIS`), du plus récent au plus ancien.
- La page du dossier connaît `idDmc` (`Dossier.idDmc`) : elle utilise les mêmes routes.

> ⚠️ **Livraison backend du 2026-09-30 (§B4).** Conforme. Même accès, mêmes raisons, 200 dans tous les cas. `raison`
> vaut `null` quand l'avis est disponible, et `statutPv` vaut `SIGNE` dès qu'un PV signé existe.
> `GET /{idDmc}/documents` ajoute les avis, du plus récent au plus ancien :
> - sans `?version`, ceux de **toutes** les versions, y compris pendant une révision ouverte ;
> - avec `?version`, ceux de la version demandée.
>
> L'avis n'est **jamais joint au dossier** comme pièce `DAO_COMPLET`. Le test le vérifie par un détachement suivi d'un
> rattachement.

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

> ⚠️ **Livraison backend du 2026-09-30 (§B5).** Conforme. Fichiers de correspondance (contrat-cadre, fournitures,
> travaux) et script `docs/referentiel/2026-09-30-avis-specifique.sql`, à passer **après** le redémarrage (V56).
> - `B04-DS-05` et `-07` à `-10` sont servis aux trois formes. `B04-DS-11` est créé (TEXTE, facultatif, document maître
>   `DPAC` comme ses voisins, les six formes).
> - `B05-GS-03` et `B05-GQ-03` sont servis au contrat-cadre, sous `garantieSoumission = OUI`. Ils restent
>   **obligatoires sous cette condition**, comme en quantité fixe : c'est « la même règle » demandée. Un contrat-cadre qui
>   répond Oui à la garantie devra donc saisir le montant avant de valider.
> - **Rubriques** : le référentiel ne sert une rubrique qu'aux formes et catégories qu'elle déclare. V56 élargit donc
>   `B04-DS` (aux trois formes) et `B05-GQ` (au contrat-cadre). `B05-GS` couvrait déjà les trois.
> - La question `garantieSoumission` n'est pas posée par le serveur, qui accepte toute clé de cadrage : c'est l'écran
>   qui choisit les questions par forme. Si le contrat-cadre ne la pose pas, le montant n'est jamais demandé et l'avis
>   omet le paragraphe de la garantie.

## B6 — Tests attendus

- Rendu ≡ modèle pour `AVIS-F` et `AVIS-T` (73 et 79 unités).
- Garde : les cinq raisons, dont un PV `FAVR` avant puis après la levée des réserves.
- Une fiche révisée après la levée des réserves : l'avis se lit sur la dernière version **validée**.
- Deux impressions successives : deux paires de documents, la première toujours consultable.
- Jetons `AVIS.*` : dates au format JJ/MM/AAAA, absents du stockage de la fiche.

> ⚠️ **Livraison backend du 2026-09-30 (§B6).** Tests :
> - `ModelesDaoTest` (chargement : 13 modèles, les deux avis hors des couvertures ; rendu brut → 73/73 et 79/79) ;
> - `ModelesAvisTest` (pur : travaux à prix mixte, garantie et e-mail ; contrat-cadre de fournitures ; pointillés) ;
> - `AvisSpecifiqueIntegrationTest` :
>   - `garde` : les raisons, dont FAVR avant puis après la levée, sur les trois statuts et `EN_ATTENTE_DECISION_PRMP`,
>     et 403 hors PRMP/UGPM ;
>   - `impression` : 400 nominatif ; 201 ; dates JJ/MM/AAAA dans le .docx ; rien dans la fiche ; deux impressions
>     = quatre documents, du plus récent au plus ancien ; jamais joint ;
>   - `ficheRevisee` : avis sur la v2 ; révision refusée après la levée.

## B7 — Suite du 30/09 : le modèle aligné sur un avis réel (analyse `analyse-2026-09-30-avis-specifique-reel.md`)

Le pilote a transmis un avis réel (Région Analamanga, contrat-cadre de travaux alloti) et validé les propositions de
l'analyse. Les modèles `AVIS-F` et `AVIS-T` sont refaits côté front :
- `scripts/modeles-dao/modeles/AVIS-F.{txt,json}` et `AVIS-T.{txt,json}` ;
- décalques vérifiés dans les deux sens : `docs/modeles-dao/AVIS-F.docx` (**91/91**) et `AVIS-T.docx` (**97/97**).

**B7.1 — Recopier les deux modèles.** Ce qui change :
- **En-tête** : « REPOBLIKAN’I MADAGASIKARA », la devise, l'autorité, « LA PERSONNE RESPONSABLE DES MARCHES PUBLICS »
  et « UNITE DE GESTION DE PASSATION DES MARCHES PUBLICS ». L'emblème viendra plus tard, quand le pilote aura fourni
  l'image.
- **Numéro seul**, « N° … ».
- **Lieu et date en bas** : « à {{B04-DS-10}}, le {{AVIS.date-publication}} ».
- **Guillemets** autour de l'objet et de la forme.
- **Adresse de consultation** en liste, avec ses libellés.
- « retiré auprès de {{B01-AC-01}} ».
- La phrase « La garantie de soumission n’est pas requise. » quand aucune garantie n'est exigée.

**B7.2 — Numérotation des paragraphes (`{{NUM}}`).** Les neuf paragraphes principaux commencent par `{{NUM}} `. Le
moteur les remplace par « 1. », « 2. »… **dans l'ordre des paragraphes imprimés** : une section retirée ne laisse pas
de trou dans la numérotation. Le gras de l'avis réel (autorité, objet) n'est pas demandé.

**B7.3 — Deux suffixes de jeton nouveaux.**

| Suffixe | Où | Rendu |
|---|---|---|
| `.heureLocale` (DATE_HEURE) | `{{B04-CP-02.heureLocale}}`, `{{B04-OV-02.heureLocale}}` | « 12/10/2026 à 09 h 00 (heure locale) » |
| `.lignesParLot` (MONTANT par lot) | `{{B04-DS-05.lignesParLot}}` | une ligne par lot, « - Lot 1 : cent mille ariary (Ar 100 000) », comme l'avis réel |

**B7.4 — `B04-DS-05` saisi par lot.** Sur une ligne allotie, le montant du DAO se saisit **par lot** (`parLot`, clé
`B04-DS-05#n`), comme le montant de la garantie. Le modèle imprime `.lignesParLot` sous `alloti = OUI`, et le montant
unique (`.lettres` et `.chiffres`) sous `alloti = NON`. Le DPAC du contrat-cadre, qui cite aussi `B04-DS-05`, est à
revoir de votre côté : dites dans votre encadré si le jeton unique y devient `.parLot`.

**B7.5 — Numéro du JMP et supports facultatifs.**
- Dans `POST …/avis-specifique`, seules `datePublication` et `jmpDate` restent exigées. `jmpNumero` vide s'imprime en
  pointillés (R2).
- Des `supports` vides retirent « et dans … ». Pour cela, le moteur pose la clé de condition **`supportsPublication`**
  (la valeur saisie) dans le contexte des conditions de l'avis ; le modèle teste `supportsPublication renseigne` et
  `supportsPublication vide`.
- La modale du front ne les exige plus.

**B7.6 — En attente (rien à faire pour l'instant).**
- Articles du Code : « 30, 35 et 67 » (document type) ou « 35, 63 et 67 » (avis réel), question au juriste.
- Régisseur de recettes : celui de l'ARMP ou celui de la Commission compétente, question au pilote.
- QR code de vérification : sujet à part, plus tard.

**B7.7 — Tests.**
- Rendu ≡ modèle (91 et 97).
- Numérotation continue avec et sans garantie, et hors contrat-cadre.
- `.heureLocale` et `.lignesParLot`.
- Impression sans `jmpNumero` ni `supports` : pas de « et dans ».

## Ce que le backend rend

Commit(s) qui referment B1 à B6, le script du référentiel pour DBPRS20 (B5), les tests, et un encadré ⚠️ daté ici pour
tout écart. Côté front ensuite (lot AV-3) : le bouton « Imprimer l'avis spécifique » à l'étape 7 de la fiche DAO et sur
la page du dossier, la modale des informations de publication, et la liste des avis produits.
