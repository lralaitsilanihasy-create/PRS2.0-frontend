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
- décalques vérifiés dans les deux sens : `docs/modeles-dao/AVIS-F.docx` (**91/91**) et `AVIS-T.docx` (**97/97**) — 90/90 et 96/96 depuis l'emblème (B7.8).

**B7.1 — Recopier les deux modèles.** Ce qui change :
- **En-tête** : « REPOBLIKAN’I MADAGASIKARA », la devise, l'autorité, « LA PERSONNE RESPONSABLE DES MARCHES PUBLICS »
  et « UNITE DE GESTION DE PASSATION DES MARCHES PUBLICS ». L'emblème : voir B7.8.
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

**B7.8 — L'emblème (`{{IMAGE:embleme}}`, ajouté le 30/09 après l'accord du pilote).** Le premier paragraphe des deux
modèles, centré, est le repère `{{IMAGE:embleme}}`. Le moteur y insère **l'image de tête des PV** : `word/media/image1.png`
des `templates/PV_*.docx`, 750 × 492 px, avec le sceau, le drapeau, « REPOBLIKAN'I MADAGASIKARA » et la devise. Proposition :
l'extraire une fois en ressource (`modeles/images/embleme.png`), pour que PV et avis partagent la même image. Largeur
conseillée : environ 5 cm, comme en tête de l'avis réel. Les deux lignes de texte « REPOBLIKAN’I MADAGASIKARA » et devise
ont quitté le modèle, puisque l'image les contient. Décalques revérifiés : **AVIS-F 90/90, AVIS-T 96/96** (au lieu de 91
et 97). Un repère `{{IMAGE:…}}` que le moteur ne connaît pas ne doit pas s'imprimer tel quel : paragraphe omis.

**B7.6 — En attente (rien à faire pour l'instant).**
- Articles du Code : « 30, 35 et 67 » (document type) ou « 35, 63 et 67 » (avis réel), question au juriste.
- Régisseur de recettes : celui de l'ARMP ou celui de la Commission compétente, question au pilote.
- QR code de vérification : sujet à part, plus tard.

**B7.7 — Tests.**
- Rendu ≡ modèle (90 et 96).
- L'emblème inséré en tête, centré.
- Numérotation continue avec et sans garantie, et hors contrat-cadre.
- `.heureLocale` et `.lignesParLot`.
- Impression sans `jmpNumero` ni `supports` : pas de « et dans ».

> ⚠️ **Livraison backend du 2026-10-01 (§B7).** Les deux modèles sont recopiés tels quels, avec 22 et 24 conditions.
> Le comparateur donne **90/90 et 96/96** sur le rendu brut du serveur. Le reste :
> - **B7.2 `{{NUM}}`** : une passe finale numérote « 1. », « 2. »… dans l'ordre des paragraphes **imprimés**, sans
>   trou ni doublon quand une section est omise.
> - **B7.3** :
>   - `.heureLocale` rend « 12/10/2026 à 09 h 00 (heure locale) » ;
>   - `.lignesParLot` rend **un paragraphe par lot**, « - Lot 1 : cent mille ariary (Ar 100 000) ». Hors
>     allotissement, la ligne seule, sans le lot.
> - **B7.4** : `B04-DS-05` est saisi par lot (fichier de correspondance et script
>   `docs/referentiel/2026-10-01-avis-montant-dao-par-lot.sql`). Quatre valeurs déjà saisies sous le code nu, celles
>   de la fiche 39, restent lisibles hors allotissement ; sur une ligne allotie, elles sont à ressaisir par lot.
>   **Le DPAC du contrat-cadre n'est pas changé** : il imprime « {{B04-DS-05.lettres}} ({{B04-DS-05}}) ». Sur un
>   contrat-cadre alloti, ce passage s'imprime donc en **pointillés**, puisque la valeur est par lot. Proposition :
>   le DPAC cite `{{B04-DS-05.lignesParLot}}` dans un paragraphe à lui, ou `{{B04-DS-05.parLot}}` dans la phrase.
>   C'est au front de recopier le modèle, puisque la fidélité se mesure de son côté.
> - **B7.5** :
>   - seules `datePublication` et `jmpDate` sont exigées ;
>   - `jmpNumero` vide s'imprime en pointillés ;
>   - des `supports` vides lèvent la clé de condition `supportsPublication`, et « et dans … » disparaît.
> - **B7.8, l'emblème** : l'image de tête des PV (750 × 492) est extraite une fois en ressource,
>   `classpath:modeles/images/embleme.png`, et insérée centrée, à **5 cm** de large, en .docx comme en .pdf. Un
>   repère `{{IMAGE:…}}` inconnu fait omettre son paragraphe.
>   **Un point à vérifier de votre côté** : les deux modèles commencent par la ligne `TITRE` « Avis d’Appel d’Offres
>   Ouvert », imprimée **avant** l'emblème. L'emblème n'est donc pas le premier paragraphe, contrairement à ce que dit
>   B7.8. Je reproduis le modèle tel quel ; si le titre ne doit pas s'imprimer en tête, c'est à corriger dans le modèle.
> - **Le cadrage `alloti`** : tout le corps de l'avis est conditionné sur `alloti = OUI` ou `alloti = NON`. Une
>   fiche sans réponse perdrait donc l'objet et le montant du DAO. L'écran l'impose depuis le plan
>   (`CLES_IMPOSEES_PAR_LE_PLAN`), le serveur ne le déduit pas.
>
> ⚠️ **Mise à jour du 2026-10-01 (après-midi).** Les deux points ci-dessus sont levés **par votre commit 40f2b4a** : le titre
> est descendu sous l'en-tête, et le DPAC du contrat-cadre cite `{{B04-DS-05.parLot}}` sur une ligne allotie. Le serveur
> a recopié AVIS-F, AVIS-T et DPAC-CC tels quels. Le comparateur donne **89/89, 95/95 et 184/184** sur le rendu brut du
> serveur. L'emblème est désormais le **premier** élément de l'avis (test resserré). Le DPAC d'un contrat-cadre alloti
> imprime « Lot n° 1 : 100 000 Ariary ; Lot n° 2 : 150 000 Ariary ».
>
> **Tests (B7.7)** :
> - `ModelesAvisTest` : travaux à quantité fixe avec garantie ; contrat-cadre de fournitures alloti, sans garantie,
>   sans numéro de JMP ni supports ; passe finale (image inconnue omise, numérotation sans trou) ;
> - `AvisSpecifiqueIntegrationTest` : emblème présent dans le .docx, impression minimale.

## B8 — Le prix du DAO se paie sur le compte bancaire unique de l'ARMP (décision du pilote du 01/10)

Le pilote a tranché la question Q7 : le bénéficiaire du paiement est **un compte bancaire unique de l'ARMP**, le même
pour tous les avis, réglé une fois par l'Administrateur.

**B8.1 — Les modèles (faits côté front).** La fin de phrase « libellé au nom de l’Agent comptable de l’ARMP ou au nom
du régisseur de recettes de l’ARMP » devient « à verser sur le compte bancaire de l’ARMP : {{PARAM.compte-dao}} », pour le
montant unique comme pour le montant par lot. Décalques inchangés en nombre : **90/90 et 96/96**.

**B8.2 — Le paramètre.** Un réglage unique, à l'Administrateur seul :
- `GET /api/parametres/compte-dao` → `{ banque, titulaire, numeroCompte, misAJourLe, misAJourPar }`, lisible aussi par
  la PRMP et l'UGPM (la modale d'impression prévient s'il n'est pas réglé) ;
- `PUT /api/parametres/compte-dao` (ADMINISTRATEUR, sinon 403), corps `{ banque, titulaire, numeroCompte }`, les trois
  exigés (400 nominatif), tracé à l'audit.

**B8.3 — Le jeton `{{PARAM.compte-dao}}`.** Rendu « {banque}, compte n° {numeroCompte} au nom de {titulaire} ».
Pointillés s'il n'est pas réglé (R2).

**B8.4 — Tests.** Lecture et écriture, 403 hors Administrateur, rendu du jeton réglé et non réglé.

Côté front, ensuite : un écran « Compte bancaire de l'ARMP (prix des DAO) » dans les référentiels de l'Administrateur,
sur le modèle de l'écran du seuil AGPM, et une alerte dans la modale d'impression si le compte n'est pas réglé.

> ⚠️ **Livraison backend du 2026-10-01 (§B8).** Conforme.
> - `GET /api/parametres/compte-dao` : Administrateur, PRMP et UGPM (403 ailleurs).
> - `PUT /api/parametres/compte-dao` : Administrateur seul (403 sinon), les trois informations exigées (400 nominatif
>   `banque`, `titulaire`, `numeroCompte`). `misAJourLe` et `misAJourPar` viennent du paramètre. Le `PUT` est
>   tracé à l'audit par l'intercepteur commun, comme tout réglage de l'Administrateur.
> - `{{PARAM.compte-dao}}` rend « BNI Madagascar, compte n° … au nom de ARMP », ou des pointillés tant que le compte
>   n'est pas entièrement réglé.
>
> Tests : `ParametreCompteDaoIntegrationTest`, et `AvisSpecifiqueIntegrationTest.publicationMinimaleEtCompte` (avant
> puis après le réglage).

## B9 — Recette à l'écran du 01/10 (accord du pilote) et un constat

**Circuit déroulé sur la fiche 38** (ligne 303121, plan 00004, travaux à quantité fixe) :
1. dossier 100360 produit par la fiche ;
2. soumis, réceptionné, dispatché à MEMANT1 ;
3. examen n° 2 : 12 points de la grille DAO conformes, avis **FAV** ;
4. PV n° 47 soumis, visé par PRES001, signé par MEMANT2.

**Ce qui est conforme :**
- `…/disponibilite` répond `disponible: true` (FAV, SIGNE).
- À l'écran, l'encart de l'étape 7 propose l'impression. La modale prévient de trois informations vides de la fiche
  (montant du DAO, nom du responsable, adresse de consultation).
- L'impression produit la paire `AVIS_00004-PPM-AGPM-CNM-2026_303121_v7_20261001-090452.{docx,pdf}`, listée et
  enregistrable.
- **La ligne 303121 est passée `LANCE`**, avec `avisImprimeLe = 2026-10-01`.
- Le texte imprimé est celui du **premier** modèle : B7 et B8 ne sont pas encore recopiés, c'est attendu.

**Constat — une pièce exigée au dépôt contredit le nouveau circuit.** Le référentiel des pièces du dossier `DMC`
(`/api/type-piece-jointes?typeDossier=DMC`) exige toujours la pièce **n° 9 « Avis d'appel d'offres »** pour soumettre
le dossier. Or l'avis ne s'imprime désormais **qu'après** le PV favorable. Le script de recette a dû déposer un PDF de
remplacement. **Proposition** : retirer la pièce n° 9 des pièces exigées au dépôt d'un dossier DAO, ou la rendre
facultative. À confirmer par le pilote : merci de ne rien changer avant son accord, et de dire si ce référentiel se
règle déjà à l'écran par l'Administrateur.

> ⚠️ **Réponse backend du 2026-10-01 (§B9).** Merci pour la recette.
> **Pièce n° 9 : rien n'est changé.** Le référentiel des types de pièces (`/api/type-piece-jointes`) se règle déjà à
> l'écran par l'Administrateur : `PUT /api/type-piece-jointes/{id}`, réservé à l'Administrateur comme tous les
> référentiels, porte le champ `obligatoire`. Une fois l'accord du pilote donné, l'Administrateur peut rendre la pièce
> facultative sans code. Si vous préférez la retirer du dépôt d'un DAO, ou la ranger après le PV, dites-le-moi et je
> l'écris en script.

## Ce que le backend rend

Commit(s) qui referment B1 à B6, le script du référentiel pour DBPRS20 (B5), les tests, et un encadré ⚠️ daté ici pour
tout écart. Côté front ensuite (lot AV-3) : le bouton « Imprimer l'avis spécifique » à l'étape 7 de la fiche DAO et sur
la page du dossier, la modale des informations de publication, et la liste des avis produits.

> ⚠️ **Réponse du front du 2026-10-01 aux quatre points de la livraison §B7-§B8.**
> 1. **DPAC du contrat-cadre : fait.** La phrase du retrait du règlement de la consultation a deux variantes :
>    - `MONTANT-LOTS` (`alloti = OUI`) imprime `{{B04-DS-05.parLot}}` ;
>    - `MONTANT-UNIQUE` (`alloti != OUI`) imprime le montant unique.
>
>    Décalque `DPAC-CC` **184/184** (au lieu de 179). À recopier : `modeles/DPAC-CC.{txt,json}`.
> 2. **Ordre de l'en-tête : corrigé, le défaut venait du front.** La ligne `TITRE` du fichier de commande s'imprime en
>    tête du document, donc au-dessus de l'emblème. Le titre sortait ainsi deux fois : en `TITRE`, puis dans le corps.
>    - Un modèle **sans titre** n'écrit plus de ligne `TITRE`.
>    - L'avis porte son titre **dans le corps**, sous l'UGPM, sur une ligne de type `TITRE` (même style, à sa place).
>    - Ordre rendu : emblème, autorité, PRMP, UGPM, titre, « N° … ».
>
>    Décalques **AVIS-F 89/89, AVIS-T 95/95** (au lieu de 90 et 96 : le titre n'est plus doublé). Votre lecteur de
>    modèles doit accepter un fichier **sans ligne `TITRE` en tête** et une ligne `TITRE` dans le corps : merci de le
>    confirmer dans votre encadré.
> 3. **Cadrage `alloti` absent : rendu robuste.** Les variantes « lot unique » de l'avis (`*-LOT-UNIQUE`, `DAO-UNIQUE`,
>    `GARANTIE-UNIQUE`) testent désormais `alloti != OUI` au lieu de `alloti = NON`. Une fiche sans réponse imprime
>    donc la variante lot unique, jamais un paragraphe vide. En pratique, l'écran impose la réponse depuis le plan.
> 4. **Pièce n° 9 : en attente de la décision du pilote.** Noté que l'Administrateur peut la rendre facultative à
>    l'écran des référentiels.
>
> **Question ouverte au pilote :** le DPAC du contrat-cadre dit encore « libellé au nom de l'Agent comptable de l'ARMP
> ou au nom du régisseur de recettes ». Faut-il y imprimer aussi le compte bancaire de l'ARMP, comme dans l'avis ?

> ⚠️ **Contre-recette du front du 2026-10-01 (serveur relancé à 09:44).** Réimpression de l'avis de la fiche 38 par
> l'API (`AVIS_00004-PPM-AGPM-CNM-2026_303121_v7_20261001-094938`), sans numéro de JMP et sans autres supports.
>
> **Conforme :**
> - l'emblème est inséré (`word/media/image1.png`) ;
> - autorité, PRMP et UGPM suivent l'emblème ;
> - « N° … » seul ;
> - paragraphes numérotés **1. à 8.** sans trou (ni garantie absente, ni contrat-cadre ici) ;
> - « n°……… en date du 15/01/2026. » : sans supports, « et dans … » a disparu ;
> - adresse de consultation en liste avec ses libellés ;
> - « auprès de {autorité} » ;
> - « à verser sur le compte bancaire de l'ARMP : ……… » (compte non réglé) ;
> - « le 20/05/2026 à 10 h 00 (heure locale) » ;
> - « à ………, le 05/10/2026 » au bas.
>
> **Un écart : le titre sort encore deux fois.** Le **premier paragraphe** du `.docx` est « Avis d’Appel d’Offres
> Ouvert », centré, gras, taille 13, **au-dessus de l'emblème**. Le modèle recopié n'a pourtant plus de ligne `TITRE`
> en tête. Le générateur semble prendre la ligne `TITRE` du corps comme titre du document et l'imprimer d'abord.
> **Demande** : quand le modèle n'a pas de ligne `TITRE` en tête, ne rien imprimer avant le premier bloc, et rendre la
> ligne `TITRE` du corps à sa place, une seule fois. Si le titre sert aussi de métadonnée (nom, propriétés du
> document), le garder là sans l'imprimer. Test : le premier paragraphe de l'avis est l'image.
