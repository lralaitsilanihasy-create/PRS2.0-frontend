# Contrat d'API REST — Backend CNM (PRS20)

> Document généré à partir du **code réel** des contrôleurs (`src/main/java/cnm/prs/controller`)
> et des DTO (`src/main/java/cnm/prs/dto`). Destiné au frontend Angular (`frontendprs2`) :
> un développeur doit pouvoir en déduire les interfaces TypeScript et les services HTTP
> sans lire le code Java. Règles de gestion : voir `docs/regles-gestion.md`.

## Conventions générales

### Base
- URL de base (dev) : `http://localhost:8080` ; toutes les ressources sont préfixées par `/api`.
- Sérialisation JSON : les champs sont en **camelCase** (identiques aux noms Java des DTO).

### Authentification
- Toutes les routes nécessitent un **jeton JWT**, **sauf** `POST /api/auth/login` et
  `POST /api/auth/register/prmp` (seules routes publiques).
- Obtenir le jeton via `POST /api/auth/login`, puis l'envoyer sur chaque requête :
  `Authorization: Bearer <token>`.
- Absence / invalidité du jeton → **401**. Rôle insuffisant → **403**.
- Dans les tableaux ci-dessous, **« Authentifié »** (ou « Ouvert ») = tout utilisateur connecté
  (un JWT valide suffit) ; ce n'est **pas** public.

### Profils (rôles)
Le rôle de l'utilisateur est porté par le jeton (claim `role`). Valeurs possibles :
`PRMP`, `PRESIDENT`, `CHEF_COMMISSION`, `SECRETAIRE`, `MEMBRE`, `VERIFICATEUR`,
`CHARGE_PUBLICATION`, `ADMINISTRATEUR`.

### Clés primaires — IMPORTANT
**Toutes les entités ont une clé primaire ASSIGNÉE par le client** (pas d'auto-génération).
Le champ identifiant (le **1er champ** de chaque DTO) **doit être fourni dans le corps d'un POST de
création** ; l'omettre renvoie **400** (« L'identifiant (clé primaire) est obligatoire à la création »).
Les exemples de requête ci-dessous incluent donc toujours l'identifiant.

### Visibilité par localité
Pour les ressources du circuit (`dossiers`, `receptions`, `dispatchs`, `examens`, `pv-examens`,
`verifications`, `demande-retraits`), les listes et accès directs sont **filtrés par localité** :
- **Président** et **Administrateur** voient toutes les localités ;
- les autres contrôleurs ne voient que **leur** localité ;
- une **PRMP** ne voit que **ses propres** dossiers / demandes : ceux dont elle est **propriétaire**
  (`t_dossier.idPrmp`, **y compris ses brouillons** — PPM, DAO, MAOO) ou rattachés à ses PPM / marchés.
  Elle peut donc **reprendre un brouillon** plus tard (`GET /api/dossiers`, filtrer sur `statut == "BROUILLON"`) ;
- un accès direct (`GET /{id}`) hors périmètre renvoie **403**.

### Référentiels & administration
- **Référentiels** (lecture ouverte, écriture POST/PUT/DELETE réservée à `ADMINISTRATEUR`) :
  `aviss`, `cat-comptes`, `comptes`, `delegation-profils`, `entite-contracts`, `localites`,
  `ministeres`, `mode-passations`, `natures`, `points-ctrls`, `profiles`, `regle-alertes`,
  `regle-anomalies`, `regle-passations`, `seuils`, `situations`, `type-dossiers`.
- **Gestion des comptes / hiérarchie** (écriture `ADMINISTRATEUR`, lecture ouverte) :
  `controleurs`, `prmps`, `organigrammes`.
- **Réservé `ADMINISTRATEUR`** (lecture comprise) : `audit-logs`, `session-utilisateurs`, `comptes-auth`.

### Saisie d'un dossier & endpoints restreints
La création d'un dossier passe par la **façade `/api/saisies`** (réservée `PRMP`), pas par les endpoints
bruts. Récapitulatif des écritures **désormais restreintes** :

| Endpoint | Avant | Maintenant |
|---|---|---|
| `POST /api/saisies/ppm`, `POST /api/saisies/dossier` | *(n'existaient pas)* | **`PRMP`** (façade de saisie) |
| `POST /api/dossiers`, `PUT /api/dossiers/{id}` | authentifié | **`ADMINISTRATEUR`** |
| `POST /api/ppms` | authentifié | **`ADMINISTRATEUR`** |
| `DELETE /api/ppms/{id}` | authentifié | **`PRMP`** (propriétaire ; dossier en brouillon) |
| `PUT /api/ppms/{id}` | authentifié | **`PRMP`** ou `ADMINISTRATEUR` |
| `POST`/`PUT`/`DELETE /api/marches` | authentifié | **`PRMP`** (édition d'un brouillon PPM) |
| `POST /api/dossiers/{id}/soumettre` | `PRMP` | `PRMP` **propriétaire**, `BROUILLON → SOUMIS` |

Garde-fous appliqués dans un service partagé (toutes voies) : **propriété** (`t_dossier.idPrmp`), **statut
BROUILLON** pour l'édition, **cohérence type↔contenu** (PPM ⇒ a un PPM ; DAO/MAOO ⇒ pas de PPM).

### Codes de statut
| Code | Signification |
|---|---|
| 200 | OK (GET, PUT, actions) |
| 201 | Créé (POST) |
| 204 | Pas de contenu (DELETE) |
| 400 | Requête invalide (validation, identifiant de création manquant) |
| 401 | Non authentifié (JWT absent/invalide, ou compte désactivé) |
| 403 | Interdit (rôle ou périmètre de localité insuffisant) |
| 404 | Ressource introuvable |
| 409 | Conflit métier (transition d'état interdite, contrainte violée, doublon, suppression interdite) |

### Format d'erreur (`ErrorResponse`)
```json
{
  "timestamp": "2026-06-12T10:30:00",
  "status": 409,
  "error": "Conflict",
  "message": "Le commentaire de rectification est obligatoire (§3.2).",
  "path": "/api/pv-examens/1/retourner",
  "fieldErrors": { "champ": "message" }
}
```
`fieldErrors` n'est renseigné que pour les erreurs de validation (400).

### Détail des erreurs 400 / 403 / 409
Récapitulatif des trois codes d'erreur « métier » les plus fréquents, leur signification et
quand ils surviennent (mapping centralisé dans `GlobalExceptionHandler`). Côté Angular : afficher
`message`, et pour le **400** exploiter `fieldErrors` champ par champ.

#### 400 — Bad Request *(requête invalide ; à corriger avant de renvoyer)*
| Cause | Quand ça survient | Indice |
|---|---|---|
| **Validation des champs** (`@Valid`) | un champ obligatoire manque ou ne respecte pas une contrainte (`@NotNull`, `@NotBlank`, `@Size`…) | `message` = « Validation échouée » + **`fieldErrors`** renseigné |
| **Identifiant de création manquant** | POST de création sans la clé primaire (toutes les PK sont **assignées par le client**, cf. *Clés primaires*) | « L'identifiant (clé primaire) est obligatoire à la création… » |
| **Règle d'entrée métier** (`BadRequestException`) | ex. `POST /api/mon-compte/changer-mot-de-passe` avec ancien mot de passe incorrect ou nouveau identique à l'ancien ; `POST /api/marches` quand la **localité du dossier** est introuvable (mode indéterminable) | message explicite |

#### 403 — Forbidden *(authentifié mais non autorisé ; ne pas réessayer tel quel)*
| Cause | Quand ça survient | Exemple |
|---|---|---|
| **Rôle insuffisant** (`@PreAuthorize`) | le profil de l'utilisateur n'a pas le droit d'exécuter l'action (ni en titulaire, ni par délégation) | Membre → `POST /api/dispatchs` ; Secrétaire → `…/accepter` un PV ; non-Admin → écriture d'un référentiel ou d'`audit-logs` |
| **Hors périmètre de localité** | accès direct `GET /{id}` ou écriture sur une ressource du circuit d'**une autre localité** (sauf Président/Administrateur) ; une PRMP hors de ses propres dossiers | CC d'ANT → `GET /api/receptions/{id}` d'un dossier TMS |

#### 409 — Conflict *(l'état actuel interdit l'opération)*
| Cause | Quand ça survient | Exemple |
|---|---|---|
| **Transition d'état du PV interdite** | l'action ne correspond pas au statut courant du PV | `accepter` hors `PROJET_SOUMIS` ; `signer` hors `PROJET_ACCEPTE` ; `retourner` **sans commentaire** ; `PUT` sur un PV déjà soumis/signé |
| **Précondition de circuit non remplie** | l'étape précédente n'est pas atteinte | `dispatch` d'un dossier non `PRET_DISPATCH` ou **doublon** de dispatch ; `examen` d'un dossier non `DISPATCHE` ; **édition d'un examen verrouillé** (dossier `PV_SIGNE`) ; `vérification` hors PV `SIGNE` / avis ≠ `FAVR` / dossier clos |
| **Autre règle de gestion** | contrainte métier violée | `NUM_PASSAGE = 1` ⟺ `TYPE_PASSAGE = INITIAL` ; `INTERIM_DISPATCH` incohérent avec la localité ; décision de retrait sans observation ; `sens` de navette invalide |
| **Suppression interdite (immuabilité)** | `DELETE` d'une ressource à traçabilité immuable | `pv-navettes`, `audit-logs` |
| **Violation de contrainte BD** (`DataIntegrityViolationException`) | identifiant en **doublon**, valeur obligatoire manquante (NOT NULL) ou **clé étrangère** inexistante | POST avec un id déjà utilisé, ou référençant une entité inexistante |

> Rappel : **401** (non authentifié : JWT absent/invalide ou compte désactivé) et **404** (ressource introuvable) restent distincts des trois ci-dessus.

### Types
`Integer`/`Long` → `number` ; `String` → `string` ; `Boolean` → `boolean` ; `BigDecimal` → `number` ;
`LocalDate` → `string` `"yyyy-MM-dd"` ; `LocalDateTime` → `string` ISO `"2026-06-12T10:30:00"`.

---

## Anomalies
**Ressource** `/api/anomalies` — Lecture et écriture : tout utilisateur authentifié (CRUD standard, aucun rôle particulier).

**Champs `AnomalieDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idAnomalie | number | Oui (PK, au POST) | clé primaire |
| idDetail | number | Non | |
| idPpm | number | Non | |
| idRegleAnomalie | number | Oui | @NotNull |
| typeAnomalie | string | Non | max 50 |
| gravite | string | Non | max 10 |
| description | string | Non | |
| dateDetection | string (date-time) | Non | |
| source | string | Non | max 20 |
| statut | string | Non | max 20 |
| imTraitement | string | Non | max 7 |
| dateTraitement | string (date-time) | Non | |
| commentaireTraitement | string | Non | |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/anomalies | — | `AnomalieDto[]` | 200 | Authentifié |
| GET | /api/anomalies/{id} | — | `AnomalieDto` | 200, 404 | Authentifié |
| POST | /api/anomalies | `AnomalieDto` | `AnomalieDto` | 201, 400, 401 | Authentifié |
| PUT | /api/anomalies/{id} | `AnomalieDto` | `AnomalieDto` | 200, 400, 404 | Authentifié |
| DELETE | /api/anomalies/{id} | — | — | 204, 404 | Authentifié |

`{id}` = idAnomalie (number).

**Exemple — requête**
```json
{
  "idAnomalie": 1024, "idDetail": 305, "idPpm": 88, "idRegleAnomalie": 12,
  "typeAnomalie": "MONTANT_INCOHERENT", "gravite": "HAUTE",
  "description": "Montant engagé supérieur au crédit disponible",
  "dateDetection": "2026-06-12T10:30:00", "source": "CONTROLE_AUTO", "statut": "OUVERTE",
  "imTraitement": "CTRMEM", "dateTraitement": null, "commentaireTraitement": null
}
```

---

## Authentification
**Ressource** `/api/auth` — Routes **publiques** (aucun token requis). Pas de CRUD.

**Champs `LoginRequest`** (corps de `/login`)

| Champ (JSON) | Type | Obligatoire |
|---|---|---|
| login | string | Oui (@NotBlank) |
| motDePasse | string | Oui (@NotBlank) |

**Champs `LoginResponse`** (réponse de `/login`)

| Champ (JSON) | Type | Description |
|---|---|---|
| token | string | JWT à placer dans `Authorization: Bearer ...` |
| login | string | login authentifié |
| role | string | profil métier (ou `null` si non reconnu) |
| typeActeur | string | `CONTROLEUR` ou `PRMP` |
| ref | string | matricule contrôleur ou identifiant PRMP |
| localite | string | localité de rattachement (`null` = toutes, cas Président) |
| expiresIn | number | durée de validité du jeton (secondes) |

**Champs `RegisterPrmpRequest`** (corps de `/register/prmp` — **variante JSON historique**, sans entités ni pièces ; conservée le temps de la bascule du frontend puis retirée)

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| login | string | Oui | @NotBlank, max 100 |
| motDePasse | string | Oui | @NotBlank, min 8, max 72 |
| idPrmp | string | Oui | @NotBlank, max 10 — identifiant PRMP (unique) |
| nomPrmp | string | Oui | @NotBlank, max 50 |
| prenomsPrmp | string | Oui | @NotBlank, max 100 |
| imPrmp | string | Oui | @NotBlank, max 6 |
| arreteNomin | string | Oui | @NotBlank, max 100 |
| dateNomin | string (date) | Oui | @NotNull |
| cin | string | Oui | @NotBlank, max 12 |
| dateCin | string (date) | Oui | @NotNull |
| lieuCin | string | Oui | @NotBlank, max 50 |
| emailPrmp | string | Oui | @NotBlank, max 100 |
| telPrmp | string | Oui | @NotBlank, max 20 |

> La PRMP **n'a pas de localité propre** : l'inscription ne comporte plus de champ `idLocalite`.

**Champs `RegisterResponse`** (réponse de `/register/prmp`)

| Champ (JSON) | Type | Description |
|---|---|---|
| login | string | login choisi |
| refActeur | string | identifiant PRMP |
| typeActeur | string | `PRMP` |
| actif | boolean | toujours `false` (en attente de validation) |
| statut | string | statut du compte à l'inscription (toujours `EN_ATTENTE`) |
| message | string | message d'information |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/auth/entites | — | `EntitePubliqueDto[]` | 200 | PUBLIC |
| POST | /api/auth/login | `LoginRequest` | `LoginResponse` | 200, 400, 401 | PUBLIC |
| POST | /api/auth/register/prmp | **`multipart/form-data`** (v2, ci-dessous) ou `RegisterPrmpRequest` (JSON, historique) | `RegisterResponse` | 201, 400, 409 | PUBLIC |

> **Inscription v2 (`multipart/form-data`).** Le corps comporte une part **`data`** (`application/json`,
> `RegisterPrmpV2Request` = identité + **`idEntites: number[]`** (entités existantes) +
> **`entitesNonListees: []`** (proposées : `libelle`/`adresse`/`idLocalite`/`categorie`)) et les fichiers
> **`arrete`** et **`cin`** (obligatoires) + **`photo`** (optionnel). **Au moins une** entité (existante
> ou proposée) est requise. Pièces : **PDF / JPEG / PNG**, type vérifié par *magic-bytes*, arrêté ≤ 10 Mo,
> CIN / photo ≤ 5 Mo (sinon **400**). Le compte est créé **`EN_ATTENTE`** ; la connexion reste refusée
> (**401**) jusqu'à validation. Login ou identifiant PRMP déjà utilisés → **409**.
> À chaque inscription, les **Administrateurs sont notifiés** (`NOUVELLE_INSCRIPTION`).
>
> `GET /api/auth/entites` expose le **référentiel réduit** des entités contractantes (id, libellé,
> adresse, catégorie, localité) pour le formulaire d'inscription.
> *Les contrôleurs ne sont pas auto-inscriptibles : leurs comptes sont créés par l'Administrateur (§3.8).*

**Exemple — login (requête / réponse)**
```json
{ "login": "CTRMEM", "motDePasse": "Test@1234" }
```
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...", "login": "CTRMEM", "role": "MEMBRE",
  "typeActeur": "CONTROLEUR", "ref": "CTRMEM", "localite": "ANT", "expiresIn": 28800
}
```
**Exemple — inscription PRMP (requête / réponse)**
```json
{
  "login": "prmp.rabe", "motDePasse": "MotDePasse#2026", "idPrmp": "PRMP050",
  "nomPrmp": "Rabe", "prenomsPrmp": "Hery", "imPrmp": "IM0050",
  "arreteNomin": "ARR-2026-050", "dateNomin": "2026-01-15", "cin": "101011112222",
  "dateCin": "2010-05-05", "lieuCin": "Antananarivo", "emailPrmp": "hery.rabe@min.mg",
  "telPrmp": "0330000050"
}
```
```json
{
  "login": "prmp.rabe", "refActeur": "PRMP050", "typeActeur": "PRMP", "actif": false,
  "message": "Inscription enregistrée. Votre compte est en attente de validation par l'administrateur."
}
```

---

## Inscriptions PRMP (validation Administrateur)
**Ressource** `/api/inscriptions` — Instruction des inscriptions PRMP (§3.1). Consultation et écriture réservées à l'**Administrateur** ; le **téléchargement d'une pièce** est ouvert à l'Administrateur **ou** au propriétaire de l'inscription.

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/inscriptions/en-attente | — | `InscriptionEnAttenteDto[]` | 200, 403 | ADMINISTRATEUR |
| POST | /api/inscriptions/{login}/valider | `ValidationInscriptionRequest` (optionnel) | `ValidationInscriptionResponse` | 200, 400, 403, 404 | ADMINISTRATEUR |
| POST | /api/inscriptions/{login}/refuser | `RefusInscriptionRequest` | — | 204, 400, 403, 404 | ADMINISTRATEUR |
| GET | /api/inscriptions/{login}/pieces/{type} | — | fichier (octets) | 200, 403, 404 | ADMINISTRATEUR ou propriétaire |

`{login}` = login de l'inscription ; `{type}` ∈ `ARRETE_NOMIN` / `CIN` / `PHOTO`.

> **`en-attente`** liste les inscriptions au statut `EN_ATTENTE` (type PRMP), avec leurs entités
> déclarées (existantes/proposées + drapeau *disponible*) et les **métadonnées** des pièces.
>
> **`valider`** est **partielle** : chaque entité existante **disponible** est rattachée
> (`t_prmp_entite` active) ; une entité déjà prise est renvoyée dans **`conflits`** (non bloquant) ;
> une entité **proposée** est créée **seulement si** l'Administrateur l'accepte dans `entitesProposees`
> (`{idDemande, accepter:true, idOrganigramme}` — l'`idOrganigramme` est requis pour créer l'entité).
> Le compte passe **`ACTIF`** si **≥ 1** entité a été activée ; sinon il **reste `EN_ATTENTE`**.
> Réponse : `{ validees:[…], conflits:[{idEntiteContract|libelle, motif}], statutCompte }`.
>
> **`refuser`** passe le compte à **`REFUSE`** (+ `MOTIF_REFUS`), marque les déclarations `REFUSEE`
> et **notifie la PRMP** (`INSCRIPTION_REFUSEE`). La connexion reste refusée.

**Modèle de données associé**
- `t_compte_auth.STATUT` : `EN_ATTENTE` / `ACTIF` / `REFUSE` (+ `MOTIF_REFUS`, `DATE_DECISION`, `IM_VALIDATEUR`) ; le login reste piloté par `ACTIF` (`ACTIF=true` ⟺ `STATUT=ACTIF`).
- `t_prmp_entite_demande` : déclarations d'entités — existante (`ID_ENTITE_CONTRACT`) **ou** proposée (`*_PROPOSE`) ; `STATUT_DEMANDE` `EN_ATTENTE`/`VALIDEE`/`REFUSEE`.
- `t_piece_jointe` : pièces stockées en `bytea` (`TYPE_PIECE`, `FORMAT`, `TAILLE_OCTETS`, `HASH_SHA256`) ; une pièce active par (`LOGIN`, `TYPE_PIECE`).

---

## Avis
**Ressource** `/api/aviss` *(noter le double « s »)* — Référentiel : lecture ouverte ; écriture réservée à `ADMINISTRATEUR`.

**Champs `AvisDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idAvis | string | Oui (PK, au POST) | clé primaire |
| libelleAvis | string | Non | max 100 |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/aviss | — | `AvisDto[]` | 200 | Authentifié |
| GET | /api/aviss/{id} | — | `AvisDto` | 200, 404 | Authentifié |
| POST | /api/aviss | `AvisDto` | `AvisDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/aviss/{id} | `AvisDto` | `AvisDto` | 200, 400, 403, 404 | ADMINISTRATEUR |
| DELETE | /api/aviss/{id} | — | — | 204, 403, 404 | ADMINISTRATEUR |

`{id}` = idAvis (string).

**Exemple — requête**
```json
{ "idAvis": "FAV", "libelleAvis": "Favorable" }
```

---

## Catégories de compte
**Ressource** `/api/cat-comptes` — Référentiel : lecture ouverte ; écriture `ADMINISTRATEUR`.

**Champs `CatCompteDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idCatCompte | string | Oui (PK, au POST) | clé primaire |
| catCompte | string | Non | max 50 |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/cat-comptes | — | `CatCompteDto[]` | 200 | Authentifié |
| GET | /api/cat-comptes/{id} | — | `CatCompteDto` | 200, 404 | Authentifié |
| POST | /api/cat-comptes | `CatCompteDto` | `CatCompteDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/cat-comptes/{id} | `CatCompteDto` | `CatCompteDto` | 200, 400, 403, 404 | ADMINISTRATEUR |
| DELETE | /api/cat-comptes/{id} | — | — | 204, 403, 404 | ADMINISTRATEUR |

`{id}` = idCatCompte (string).

**Exemple — requête**
```json
{ "idCatCompte": "FONC", "catCompte": "Dépenses de fonctionnement" }
```

---

## Comptes budgétaires
**Ressource** `/api/comptes` — Référentiel : lecture ouverte ; écriture `ADMINISTRATEUR`.

**Champs `CompteDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| numCompte | string | Oui (PK, au POST) | clé primaire |
| libelle | string | Non | max 100 |
| idCatCompte | string | Non | max 10 |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/comptes | — | `CompteDto[]` | 200 | Authentifié |
| GET | /api/comptes/{id} | — | `CompteDto` | 200, 404 | Authentifié |
| POST | /api/comptes | `CompteDto` | `CompteDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/comptes/{id} | `CompteDto` | `CompteDto` | 200, 400, 403, 404 | ADMINISTRATEUR |
| DELETE | /api/comptes/{id} | — | — | 204, 403, 404 | ADMINISTRATEUR |

`{id}` = numCompte (string).

**Exemple — requête**
```json
{ "numCompte": "6011001", "libelle": "Achats de fournitures de bureau", "idCatCompte": "FONC" }
```

---

## Comptes d'authentification
**Ressource** `/api/comptes-auth` — **Réservé `ADMINISTRATEUR`**. Gestion/validation des comptes de connexion (notamment les inscriptions PRMP en attente). Le mot de passe n'est jamais exposé.

**Champs `CompteAuthResumeDto`** (réponse)

| Champ (JSON) | Type | Description |
|---|---|---|
| login | string | login du compte |
| typeActeur | string | `CONTROLEUR` ou `PRMP` |
| refActeur | string | matricule contrôleur ou identifiant PRMP |
| actif | boolean | `true` si le compte peut se connecter |

**Champs `ReinitMotDePasseRequest`** (corps de `reinitialiser-mot-de-passe`)

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| nouveauMotDePasse | string | Oui | @NotBlank, min 8, max 72 |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/comptes-auth/en-attente | — | `CompteAuthResumeDto[]` (comptes inactifs) | 200, 403 | ADMINISTRATEUR |
| POST | /api/comptes-auth/{login}/activer | — | `CompteAuthResumeDto` | 200, 403, 404 | ADMINISTRATEUR |
| POST | /api/comptes-auth/{login}/desactiver | — | `CompteAuthResumeDto` | 200, 403, 404 | ADMINISTRATEUR |
| POST | /api/comptes-auth/{login}/reinitialiser-mot-de-passe | `ReinitMotDePasseRequest` | `CompteAuthResumeDto` | 200, 400, 403, 404 | ADMINISTRATEUR |

`{login}` = login du compte (string). La réinitialisation impose un nouveau mot de passe à un
utilisateur (ex. mot de passe oublié) ; l'utilisateur pourra ensuite le changer via **Mon compte**.

**Exemple — requête (`/reinitialiser-mot-de-passe`) / réponse (`/activer`)**
```json
{ "nouveauMotDePasse": "MotProvisoire#2026" }
```
```json
{ "login": "prmp.rabe", "typeActeur": "PRMP", "refActeur": "PRMP050", "actif": true }
```

---

## Contrôleurs
**Ressource** `/api/controleurs` — Gestion des comptes (§3.8) : lecture ouverte ; écriture réservée à `ADMINISTRATEUR`.

**Champs `ControleurDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| imControleur | string | Oui (PK, au POST) | clé primaire (matricule, max 7) |
| nomCont | string | Non | max 50 |
| prenomsCont | string | Non | max 100 |
| emailCont | string | Non | max 100 |
| telCont | string | Non | max 20 |
| idProfile | number | Non | |
| idLocalite | string | Non | max 5 (`null` = toutes, cas Président) |
| idSuperieur | string | Non | max 7 |
| transversal | boolean | Oui | @NotNull |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/controleurs | — | `ControleurDto[]` | 200 | Authentifié |
| GET | /api/controleurs/{id} | — | `ControleurDto` | 200, 404 | Authentifié |
| POST | /api/controleurs | `ControleurDto` | `ControleurDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/controleurs/{id} | `ControleurDto` | `ControleurDto` | 200, 400, 403, 404 | ADMINISTRATEUR |
| DELETE | /api/controleurs/{id} | — | — | 204, 403, 404 | ADMINISTRATEUR |

`{id}` = imControleur (string).

**Exemple — requête**
```json
{
  "imControleur": "CTRMEM", "nomCont": "Rasoa", "prenomsCont": "Le Membre",
  "emailCont": "mem.ant@cnm.mg", "telCont": "0320000005",
  "idProfile": 5, "idLocalite": "ANT", "idSuperieur": "CCANT01", "transversal": false
}
```

---

## Copies de dossier
**Ressource** `/api/copie-dossiers` — Lecture / écriture : tout utilisateur authentifié.

**Champs `CopieDossierDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idCopie | number | Oui (PK, au POST) | clé primaire |
| idDispatch | number | Oui | @NotNull |
| idDossier | number | Oui | @NotNull |
| imDestinataire | string | Oui | @NotBlank, max 7 |
| typeCopie | string | Oui | @NotBlank, max 30 |
| dateTransmission | string (date-time) | Oui | @NotNull |
| accuseReception | boolean | Oui | @NotNull |
| dateAccuse | string (date-time) | Non | |
| observation | string | Non | max 300 |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/copie-dossiers | — | `CopieDossierDto[]` | 200 | Authentifié |
| GET | /api/copie-dossiers/{id} | — | `CopieDossierDto` | 200, 404 | Authentifié |
| POST | /api/copie-dossiers | `CopieDossierDto` | `CopieDossierDto` | 201, 400 | Authentifié |
| PUT | /api/copie-dossiers/{id} | `CopieDossierDto` | `CopieDossierDto` | 200, 400, 404 | Authentifié |
| DELETE | /api/copie-dossiers/{id} | — | — | 204, 404 | Authentifié |

`{id}` = idCopie (number).

**Exemple — requête**
```json
{
  "idCopie": 5012, "idDispatch": 410, "idDossier": 2207, "imDestinataire": "CCANT01",
  "typeCopie": "DISPATCH_CC", "dateTransmission": "2026-06-12T09:15:00",
  "accuseReception": false, "dateAccuse": null, "observation": "Copie pour information"
}
```

---

## Délégations de profil
**Ressource** `/api/delegation-profils` — Référentiel (§3.8) : lecture ouverte ; écriture `ADMINISTRATEUR`.

> **Convention** : `idProfileDelegant` = profil qui **exerce** la tâche (ex. Président) ;
> `idProfileDelegue` = profil **dont la tâche est exercée** (ex. Secrétaire) ; `actif` active/désactive.

**Champs `DelegationProfilDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idDelegation | number | Oui (PK, au POST) | clé primaire |
| idProfileDelegant | number | Oui | @NotNull — profil qui exerce |
| idProfileDelegue | number | Oui | @NotNull — profil dont la tâche est exercée |
| actif | boolean | Oui | @NotNull |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/delegation-profils | — | `DelegationProfilDto[]` | 200 | Authentifié |
| GET | /api/delegation-profils/{id} | — | `DelegationProfilDto` | 200, 404 | Authentifié |
| POST | /api/delegation-profils | `DelegationProfilDto` | `DelegationProfilDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/delegation-profils/{id} | `DelegationProfilDto` | `DelegationProfilDto` | 200, 400, 404 | ADMINISTRATEUR |
| DELETE | /api/delegation-profils/{id} | — | — | 204, 404 | ADMINISTRATEUR |

`{id}` = idDelegation (number).

**Exemple — requête** (le Président — profil 2 — exerce la tâche du Secrétaire — profil 4)
```json
{ "idDelegation": 1, "idProfileDelegant": 2, "idProfileDelegue": 4, "actif": true }
```

---

## Demandes de retrait
**Ressource** `/api/demande-retraits` — Création (POST) réservée à `PRMP` ; décision (`POST /{id}/accepter` | `/{id}/refuser`) réservée à `CHEF_COMMISSION` ou `PRESIDENT` (contrôle **rôle↔localité dans le service**) ; suppression à `ADMINISTRATEUR`. Lecture filtrée : une PRMP ne voit que ses demandes, un contrôleur celles de sa localité, Président/Admin tout.

> ⚠️ **Identité & ID (règle ajoutée).** À la création : `idPrmp` = **utilisateur authentifié** (JWT, corps ignoré), `dateDemande` serveur, `statut` forcé `EN_ATTENTE`, `idDemandeRetrait` **auto-généré** (IDENTITY). Gardes (sinon **403/409**) : PRMP **propriétaire** du dossier ; dossier **`SOUMIS`/`PRET_DISPATCH`** ; pas de demande déjà **`EN_ATTENTE`**. Liste déroulante des dossiers éligibles : **`GET /api/dossiers/retirables`** (PRMP).

> ⚠️ **Décision (règle ajoutée).** `POST /{id}/accepter` → statut `ACCEPTEE` + **dossier `BROUILLON`** ; `POST /{id}/refuser` (corps `{ "motif"? }`) → `REFUSEE`, dossier **inchangé**. Le décideur réel (CC **ou** Président) est enregistré dans `IM_CTRL_CC` depuis le **JWT**. Hors CC-localité/Président → **403** ; demande déjà traitée → **409**. Notifs PRMP : `RETRAIT_ACCEPTE` / `RETRAIT_REFUSE`.

**Champs `DemandeRetraitDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idDemandeRetrait | number | Non (auto-généré) | ID serveur (IDENTITY) ; ignoré en entrée |
| idDossier | number | Oui | @NotNull |
| idPrmp | string | Non | max 10 — **ignoré** : dérivé du JWT |
| motifRetrait | string | Oui | @NotBlank |
| dateDemande | string (date-time) | Non | **ignoré** : posé côté serveur |
| statut | string | Non | max 20 — `EN_ATTENTE` / `ACCEPTEE` / `REFUSEE` ; **ignoré** en entrée (forcé) |
| imCtrlCc | string | — | max 7 — décideur (CC ou Président), posé serveur depuis le JWT |
| dateDecision | string (date-time) | — | posé serveur à la décision |
| obsDecision | string | — | max 500 — motif de refus (optionnel) |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/demande-retraits | — | `DemandeRetraitDto[]` | 200 | Authentifié (filtré) — worklist PRMP |
| GET | /api/demande-retraits/a-valider | — | `DemandeRetraitDto[]` | 200, 403 | CHEF_COMMISSION (localité) / PRESIDENT |
| GET | /api/demande-retraits/historique | — | `DemandeRetraitDto[]` | 200, 403 | CHEF_COMMISSION (localité) / PRESIDENT |
| GET | /api/demande-retraits/{id} | — | `DemandeRetraitDto` | 200, 403, 404 | Authentifié (filtré) |
| POST | /api/demande-retraits | `DemandeRetraitDto` | `DemandeRetraitDto` | 201, 400, 403, 409 | PRMP |
| POST | /api/demande-retraits/{id}/accepter | — | `DemandeRetraitDto` | 200, 403, 404, 409 | CHEF_COMMISSION / PRESIDENT |
| POST | /api/demande-retraits/{id}/refuser | `{ motif? }` | `DemandeRetraitDto` | 200, 403, 404, 409 | CHEF_COMMISSION / PRESIDENT |
| DELETE | /api/demande-retraits/{id} | — | — | 204, 404 | ADMINISTRATEUR |

`{id}` = idDemandeRetrait (number). Le `PUT /{id}` générique est **supprimé** au profit de `accepter`/`refuser`.

**Exemple — requête (création, PRMP)**
```json
{ "idDossier": 1023, "motifRetrait": "Dossier incomplet, pièces manquantes" }
```
*(le reste — `idPrmp`, `dateDemande`, `statut`, `idDemandeRetrait` — est dérivé/serveur, ignoré en entrée)*

---

## Détails d'examen
**Ressource** `/api/examen-details` — POST/PUT : profil `MEMBRE` (titulaire ou délégué) ; DELETE : `ADMINISTRATEUR`.

**Champs `ExamenDetailDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idDetailExamen | number | Oui (PK, au POST) | clé primaire |
| idExamen | number | Oui | @NotNull |
| idPtControle | number | Oui | @NotNull |
| conforme | boolean | Oui | @NotNull |
| observation | string | Non | max 500 |
| obsSiNonConforme | string | Non | max 500 |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/examen-details | — | `ExamenDetailDto[]` | 200 | Authentifié |
| GET | /api/examen-details/{id} | — | `ExamenDetailDto` | 200, 404 | Authentifié |
| POST | /api/examen-details | `ExamenDetailDto` | `ExamenDetailDto` | 201, 400, 403 | MEMBRE (titulaire/délégué) |
| PUT | /api/examen-details/{id} | `ExamenDetailDto` | `ExamenDetailDto` | 200, 400, 404 | MEMBRE (titulaire/délégué) |
| DELETE | /api/examen-details/{id} | — | — | 204, 404 | ADMINISTRATEUR |

`{id}` = idDetailExamen (number).

**Exemple — requête**
```json
{ "idDetailExamen": 4501, "idExamen": 201, "idPtControle": 12, "conforme": false, "observation": "Point examiné", "obsSiNonConforme": "Garantie de soumission absente" }
```

---

## Dispatchs
**Ressource** `/api/dispatchs` — POST/PUT : `PRESIDENT` ou `CHEF_COMMISSION` ; DELETE : `ADMINISTRATEUR`. Lecture filtrée par localité.

> **Précondition de circuit (création) → 409** : le dossier rattaché à la réception doit être au statut **`PRET_DISPATCH`** (§2.2/§2.3), et **aucun dispatch ne doit déjà exister** pour cette réception (anti-doublon, §3.2 ; corriger via `PUT`).

> ⚠️ **Transition de statut (règle ajoutée).** À la **création** d'un dispatch, le dossier passe **`PRET_DISPATCH` → `DISPATCHE`** dans la **même transaction** que le dispatch. C'est ce statut `DISPATCHE` qui conditionne l'étape suivante (l'examen l'exige).

> **Règle `interimDispatch`** (sinon **409**) : Président → `false` ; CC dans sa localité → `false` ; CC hors de sa localité → `true` obligatoire.

**Champs `DispatchDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idDispatch | number | Oui (PK, au POST) | clé primaire |
| idReception | number | Oui | @NotNull |
| imCtrlDispatch | string | Non | max 7 |
| imCtrlCc | string | Non | max 7 |
| imCtrlMembre | string | Non | max 7 |
| dateDispatch | string (date) | Non | |
| dateCtrlAssigne | string (date) | Non | |
| instructions | string | Non | max 500 |
| interimDispatch | boolean | Oui | @NotNull (voir règle) |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/dispatchs | — | `DispatchDto[]` | 200 | Authentifié (filtré) |
| GET | /api/dispatchs/{id} | — | `DispatchDto` | 200, 404 | Authentifié (filtré) |
| POST | /api/dispatchs | `DispatchDto` | `DispatchDto` | 201, 400, 403, 409 | PRESIDENT / CHEF_COMMISSION |
| PUT | /api/dispatchs/{id} | `DispatchDto` | `DispatchDto` | 200, 400, 404, 409 | PRESIDENT / CHEF_COMMISSION |
| DELETE | /api/dispatchs/{id} | — | — | 204, 404 | ADMINISTRATEUR |

`{id}` = idDispatch (number).

**Exemple — requête**
```json
{ "idDispatch": 88, "idReception": 305, "imCtrlCc": "CCANT01", "imCtrlMembre": "MEMANT1", "dateDispatch": "2026-05-02", "instructions": "Examiner en priorité", "interimDispatch": false }
```

---

## Documents publics
**Ressource** `/api/document-publics` — Réservé à `CHARGE_PUBLICATION` (CRUD et actions d'intégrité).

**Champs `DocumentPublicDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idDocPublic | number | Oui (PK, au POST) | clé primaire |
| idPublication | number | Oui | @NotNull |
| typeDoc | string | Non | max 30 |
| libelleDoc | string | Non | max 200 |
| cheminFichier | string | Non | max 500 |
| format | string | Non | max 10 |
| tailleOctets | number | Non | |
| dateDepot | string (date-time) | Non | |
| hashSha256 | string | Non | max 64 — renseigné par l'action `empreinte` |

**Champs `EmpreinteRequest`** (corps des actions)

| Champ (JSON) | Type | Obligatoire |
|---|---|---|
| contenuBase64 | string | Oui (@NotBlank) — contenu du fichier en Base64 |

**Champs `VerificationIntegriteResult`** (réponse de `verifier-integrite`)

| Champ (JSON) | Type | Description |
|---|---|---|
| conforme | boolean | vrai si l'empreinte calculée = empreinte enregistrée |
| hashAttendu | string | empreinte SHA-256 enregistrée |
| hashCalcule | string | empreinte SHA-256 recalculée du contenu fourni |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/document-publics | — | `DocumentPublicDto[]` | 200 | CHARGE_PUBLICATION |
| GET | /api/document-publics/{id} | — | `DocumentPublicDto` | 200, 404 | CHARGE_PUBLICATION |
| POST | /api/document-publics | `DocumentPublicDto` | `DocumentPublicDto` | 201, 400, 403 | CHARGE_PUBLICATION |
| PUT | /api/document-publics/{id} | `DocumentPublicDto` | `DocumentPublicDto` | 200, 400, 404 | CHARGE_PUBLICATION |
| DELETE | /api/document-publics/{id} | — | — | 204, 404 | CHARGE_PUBLICATION |
| POST | /api/document-publics/{id}/empreinte | `EmpreinteRequest` | `DocumentPublicDto` | 200, 400, 404 | CHARGE_PUBLICATION |
| POST | /api/document-publics/{id}/verifier-integrite | `EmpreinteRequest` | `VerificationIntegriteResult` | 200, 404 | CHARGE_PUBLICATION |

`{id}` = idDocPublic (number).

**Exemple — requête / réponse (vérification)**
```json
{ "contenuBase64": "JVBERi0xLjQKJeLjz9MK..." }
```
```json
{
  "conforme": true,
  "hashAttendu": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "hashCalcule": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

---

## Dossiers
**Ressource** `/api/dossiers` — Écriture : tout utilisateur authentifié. Lecture **filtrée par localité** (voir conventions) ; accès hors périmètre → 403.

> **Visibilité d'un dossier par localité.** Un dossier appartient à une localité par **l'une** de ces
> 3 sources : sa propre **`idLocalite`** (`t_dossier.ID_LOCALITE`, estampillée à la soumission), sa
> **réception** (`Reception → Contrôleur.idLocalite`), ou son **PPM** (`Ppm.idLocalite`). Ainsi un
> dossier soumis — **même sans PPM** (DAO, MAOO) — apparaît dans la liste et est consultable par les
> contrôleurs de sa localité (dont le Secrétaire) **avant** toute réception. Un dossier sans aucune de
> ces 3 sources n'est visible que du Président/Administrateur. (La PRMP, elle, voit ses dossiers via `Ppm.idPrmp`.)

**Champs `DossierDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idDossier | number | Oui (PK, au POST) | clé primaire |
| idTypeDossier | string | Non | max 10 |
| idDossierParent | number | Non | |
| refeDossier | string | Non | max 100 — **référence officielle, générée par `…/soumettre`** ; laisser vide à la création |
| dateRef | string (date) | Non | renseignée à la soumission si vide |
| statut | string | Non | max 30 — cycle : `BROUILLON` → `SOUMIS` → `PRET_DISPATCH` → `DISPATCHE` → `EXAMINE` → `PV_SIGNE` → (`EN_VERIFICATION` si avis FAVR) → `CLOTURE` ; vérif. obs. non levées → `EN_ATTENTE_DECISION_PRMP` (ou `RETIRE`) ; posé par le système, **lecture seule** côté PRMP |
| idLocalite | string | Non | max 5 — localité (FK `tr_localite`) ; **dérivée de l'entité** du dossier (lecture seule à la saisie) |
| idPrmp | string | Non | max 10 — PRMP **propriétaire** (FK `t_prmp`) ; posée à la saisie ; seule elle édite/soumet |
| idEntiteContract | number | Non | entité contractante (FK `tr_entite_contract`) ; **choisie à la saisie**, fixe la localité |

> **Cycle de vie & saisie.** On **ne crée pas** un dossier brut : la **façade `/api/saisies`** (réservée PRMP)
> crée le dossier (statut **`BROUILLON`**) et son contenu. Un brouillon est **invisible des contrôleurs** ;
> il le devient (`SOUMIS`) via `…/soumettre`. Les endpoints bruts `POST`/`PUT /api/dossiers` sont **réservés
> `ADMINISTRATEUR`** (cf. *Saisies*).

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/dossiers | — | `DossierDto[]` | 200, 400 | Authentifié (filtré, hors BROUILLON) |
| GET | /api/dossiers/a-receptionner | — | `DossierDto[]` | 200, 403 | `SECRETAIRE` (titulaire/délégué) ou `ADMINISTRATEUR` |
| GET | /api/dossiers/a-examiner | — | `DossierDto[]` | 200, 403 | `MEMBRE` (titulaire/délégué) ou `ADMINISTRATEUR` |
| GET | /api/dossiers/examines | — | `Page<DossierDto>` | 200, 403 | `MEMBRE` (titulaire/délégué) ou `ADMINISTRATEUR` |
| GET | /api/dossiers/a-verifier | — | `DossierDto[]` | 200, 403 | `VERIFICATEUR` (titulaire/délégué) ou `ADMINISTRATEUR` |
| GET | /api/dossiers/verifies | — | `Page<DossierDto>` | 200, 403 | `VERIFICATEUR` (titulaire/délégué) ou `ADMINISTRATEUR` |
| GET | /api/dossiers/en-attente-prmp | — | `DossierDto[]` | 200, 403 | `VERIFICATEUR` (titulaire/délégué) ou `ADMINISTRATEUR` — lecture seule |
| GET | /api/dossiers/{id} | — | `DossierDto` | 200, 403, 404 | Authentifié (filtré) |
| POST | /api/dossiers | `DossierDto` | `DossierDto` | 201, 400, 403 | **ADMINISTRATEUR** |
| PUT | /api/dossiers/{id} | `DossierDto` | `DossierDto` | 200, 400, 403, 404 | **ADMINISTRATEUR** |
| DELETE | /api/dossiers/{id} | — | — | 204, 404 | Authentifié |
| POST | /api/dossiers/{id}/soumettre | — | `DossierDto` | 200, 400, 403, 404, 409 | **PRMP** |
| POST | /api/dossiers/{id}/resoumettre | `DossierResoumissionRequest` | `DossierDto` | 200, 400, 403, 404, 409 | **PRMP** propriétaire |

`{id}` = idDossier (number). **`DossierResoumissionRequest`** = `{ motifRectification }` (String, **@NotBlank**, max 255).

> **Filtre serveur `?statut=` (nouveau).** `GET /api/dossiers?statut=SOUMIS` restreint la liste à ce
> statut **côté serveur**, en **conservant le périmètre** (localité / PRMP). Statut inconnu → **400**.
> Valeurs : `BROUILLON`, `SOUMIS`, `PRET_DISPATCH`, `DISPATCHE`, `EXAMINE`, `PV_SIGNE`, `EN_VERIFICATION`, `EN_ATTENTE_DECISION_PRMP`, `RETIRE`, `CLOTURE`. **Ne pas** l'utiliser pour la
> worklist du Secrétaire : un dossier réceptionné **mais incomplet** reste `SOUMIS` ; utiliser
> `GET /api/dossiers/a-receptionner` (filtre serveur « `SOUMIS` + sans réception », sans N+1).

> **File « à réceptionner » (§3.4).** `GET /api/dossiers/a-receptionner` retourne les dossiers
> **`SOUMIS`** **sans réception** de la **localité** du contrôleur (Président/Administrateur : toutes
> localités). C'est la file de travail du Secrétaire ; un dossier en sort dès qu'une réception est créée.

> **Files du Membre attributaire (§2.4).** `GET /api/dossiers/a-examiner` = ses dossiers **`DISPATCHE`**
> (pas encore examinés) ; `GET /api/dossiers/examines` = **historique** de ce qu'il a examiné
> (**`EXAMINE` + `PV_SIGNE` + `CLOTURE`**), **paginé** (`?page=&size=&sort=`, réponse `Page` :
> `content[]`, `totalElements`, …). Les deux sont **scopées au Membre courant** (`Dispatch.imCtrlMembre`)
> et **exclusives** : à la création de l'examen, un dossier quitte « à examiner » pour « examinés ». Un
> Membre ne voit que **ses** dossiers (ceux d'un autre Membre n'y figurent pas).

> ⚠️ **Files du Vérificateur (§3.6, règle ajoutée).** `GET /api/dossiers/a-verifier` = dossiers
> **`EN_VERIFICATION`** (PV signé d'avis `FAVR`, à vérifier) ; `GET /api/dossiers/verifies` =
> **historique** paginé, **lecture seule**, des dossiers **`CLOTURE` ayant un PV `SIGNE`** — **y compris
> les auto-clôturés** à la signature (`FAV`/`DEF`/`NSP`). Les deux sont **scopées à la localité** du
> vérificateur (contrôleur réceptionnaire) et **partitionnent** les PV signés (`EN_VERIFICATION` ⊎ `CLOTURE`).

> ⚠️ **File « En attente PRMP » du Vérificateur (règle ajoutée), lecture seule.** `GET /api/dossiers/en-attente-prmp`
> = dossiers **`EN_ATTENTE_DECISION_PRMP`** de sa localité (observations non levées transmises à la PRMP). Le
> vérificateur ne peut ni modifier ni soumettre de nouvelle vérification tant que la PRMP n'a pas statué.

> ⚠️ **Resoumission après rectification (règle ajoutée).** `POST /api/dossiers/{id}/resoumettre` (réservé **PRMP
> propriétaire**) — corps `{ "motifRectification": "…" }` (**obligatoire**, non vide, sinon **400**). N'agit que
> sur un dossier **`EN_ATTENTE_DECISION_PRMP`** (sinon **409**) → transition **`EN_VERIFICATION`** (retour au
> vérificateur). Effets : notification **`RECTIFICATION_PRMP`** au vérificateur du dossier (référence, nom PRMP,
> motif, date) ; trace dans `t_audit_log` (NOM_TABLE=`t_dossier`, TYPE_ACTION=`RECTIFICATION_PRMP`,
> IM_ACTEUR=`<idPrmp>`, CHAMP_MODIFIE=`motifRectification`) ; le **motif** est enregistré sur la dernière
> vérification (`t_verification.MOTIF_RECTIF`) et exposé dans `VerificationDto.motifRectif` (visible côté vérificateur).

> **Soumission (§3.1, Module 03).** `POST /api/dossiers/{id}/soumettre` (réservé **PRMP propriétaire**) :
> passe le dossier de **`BROUILLON` → `SOUMIS`** (statut autre → **409**), vérifie la **cohérence
> type↔contenu** (PPM ⇒ a un PPM ; DAO/MAOO ⇒ pas de PPM, sinon **409**), propage la **localité** (du PPM,
> sinon de la PRMP ; **400** si indéterminable), **génère la référence** `refeDossier`
> (`CNM-{localité}-{exercice}-{idDossier}`) et **notifie** le Secrétaire + CC (`DOSSIER_SOUMIS`).
> Propriété non respectée → **403**.
>
> ⚠️ **Précondition « PPM ⇒ ≥ 1 marché » (règle ajoutée, cf. `regles-gestion.md` §3.1 Module 03).** Un
> dossier de type **PPM** sans aucune ligne de marché ne peut être soumis → **409** (« *Un PPM doit
> comporter au moins un marché avant soumission.* »). **DAO/MAOO non concernés.**

**Exemple — réponse après `…/soumettre`** (statut SOUMIS, référence générée)
```json
{ "idDossier": 1023, "idTypeDossier": "DAO", "refeDossier": "CNM-ANT-2026-001023", "dateRef": "2026-03-10", "statut": "SOUMIS", "idLocalite": "ANT", "idPrmp": "PRMP001" }
```

---

## Saisies (façade de création)
**Ressource** `/api/saisies` — Réservée au profil **`PRMP`**. « Saisir un PPM/DAO/MAOO » **EST** créer le
dossier à soumettre : la façade crée le `t_dossier` (statut **`BROUILLON`**, propriété de la PRMP courante)
et son contenu **en une transaction** (rollback si une étape échoue). Remplace la création brute de
dossier/PPM (désormais réservée Admin).

> ⚠️ **Règle ajoutée — PK attribuées par le serveur.** Les identifiants `dossier`/`PPM`/`marché` sont
> **alloués par une séquence serveur** (`seq_dossier`/`seq_ppm`/`seq_marche`) ; tout id envoyé par le
> client est **ignoré**. Les payloads de création **n'envoient plus** `idDossier`/`idPpm`/`idDetail` ;
> l'id figure **en sortie** (réponse). **Dette documentée** : choix d'une séquence applicative (et non
> `IDENTITY` JPA) pour éviter une refonte massive des fixtures sur 3 tables centrales — migration vers
> `IDENTITY` possible ultérieurement.

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| POST | /api/saisies/ppm | `SaisiePpmRequest` | `DossierDto` (le dossier créé) | 201, 400, 403 | **PRMP** |
| POST | /api/saisies/dossier | `SaisieDossierRequest` | `DossierDto` | 201, 400, 403, 409 | **PRMP** |
| PUT | /api/saisies/ppm/{idDossier} | `EditionPpmRequest` | `DossierDto` | 200, 400, 403, 404, 409 | **PRMP** |

**`SaisiePpmRequest`** — crée dossier (type PPM) + PPM + lignes de marché (mode **auto**) :

| Champ | Type | Obligatoire |
|---|---|---|
| **idEntiteContract** | number | **Oui** — entité contractante concernée (fixe la localité) |
| exercice | number | Oui |
| signataire | string | Oui (max 50) |
| dateSignature | string (date) | Oui |
| reference | string | Oui (max 100) |
| marches | `SaisieMarcheLigne[]` | Non |

*(plus de `idDossier`/`idPpm` : attribués par le serveur.)*

**`SaisieMarcheLigne`** : `designationMarche`, `numCompte`, `montEstim`, `financement`, `statut`, `idSituation`, `idNature`. `idDetail` est **facultatif** — **null à la création** (PK serveur), renseigné seulement pour **identifier une ligne existante** lors de l'édition (réconciliation). `idDossier`/`idPpm` sont renseignés par le service. ⚠️ **`idMode`** = mode **choisi** par la PRMP (facultatif), validé contre l'ensemble autorisé (hors ensemble → **409**) ; absent → mode **recommandé** (§3.1 M02).

**`SaisieDossierRequest`** (DAO/MAOO, sans contenu) : `idTypeDossier` (oui, ≠ `PPM` sinon **409**), **`idEntiteContract` (oui)**. *(plus de `idDossier` : attribué par le serveur.)*

**`EditionPpmRequest`** (`PUT /api/saisies/ppm/{idDossier}`) — édite un **brouillon** PPM en une transaction :
`exercice`, `signataire`, `dateSignature`, `reference` (en-tête, tous obligatoires) + `marches` (liste désirée). Les lignes sont **réconciliées par `idDetail`** : ajout des nouvelles, mise à jour des existantes (mode **recalculé**), **retrait** des absentes. La localité/le type/le propriétaire/l'entité ne changent pas. Dossier non BROUILLON → **409** ; non-propriétaire → **403**.

> **Localité dérivée de l'ENTITÉ.** Le champ `idLocalite` n'est **pas** saisi : la PRMP **choisit une
> entité contractante** parmi **ses** entités actives (`t_prmp_entite`), et la **localité du dossier en
> est dérivée** (`tr_entite_contract.idLocalite`). Une même PRMP liée à des entités de localités
> différentes peut donc déposer dans plusieurs localités. Erreurs : entité **non rattachée** à la PRMP
> → **403** ; entité **sans localité** → **400**. L'`idPrmp` propriétaire est **forcé** à l'utilisateur
> courant. Le dossier reste **BROUILLON** (invisible des contrôleurs) jusqu'à
> `POST /api/dossiers/{id}/soumettre`.

**Exemple — requête `POST /api/saisies/ppm`** (`idEntiteContract` fixe la localité, pas de `idLocalite`)
```json
{
  "idDossier": 70, "idEntiteContract": 1, "idPpm": 70, "exercice": 2026,
  "signataire": "RABE Hery", "dateSignature": "2026-01-10", "reference": "PPM-2026-ANT-001",
  "marches": [ { "idDetail": 700, "designationMarche": "Travaux X", "montEstim": 500000000, "idNature": 1, "idSituation": 1, "statut": "PREVU" } ]
}
```

---

## Échéances
**Ressource** `/api/echeances` — Lecture / écriture : tout utilisateur authentifié.

**Champs `EcheanceDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idEcheance | number | Oui (PK, au POST) | clé primaire |
| idDetail | number | Oui | @NotNull |
| typeJalon | string | Oui | @NotBlank, max 30 |
| datePrevue | string (date) | Oui | @NotNull |
| dateReelle | string (date) | Non | |
| statutJalon | string | Non | max 20 |
| ecartJours | number | Non | |
| alerteEnvoyee | boolean | Non | |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/echeances | — | `EcheanceDto[]` | 200 | Authentifié |
| GET | /api/echeances/{id} | — | `EcheanceDto` | 200, 404 | Authentifié |
| POST | /api/echeances | `EcheanceDto` | `EcheanceDto` | 201, 400 | Authentifié |
| PUT | /api/echeances/{id} | `EcheanceDto` | `EcheanceDto` | 200, 400, 404 | Authentifié |
| DELETE | /api/echeances/{id} | — | — | 204, 404 | Authentifié |

`{id}` = idEcheance (number).

**Exemple — requête**
```json
{ "idEcheance": 510, "idDetail": 77, "typeJalon": "OUVERTURE", "datePrevue": "2026-06-01", "dateReelle": null, "statutJalon": "A_VENIR", "ecartJours": null, "alerteEnvoyee": false }
```

---

## Entités contractantes
**Ressource** `/api/entite-contracts` — Référentiel : lecture ouverte ; écriture `ADMINISTRATEUR`.

**Champs `EntiteContractDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idEntiteContract | number | Oui (PK, au POST) | clé primaire |
| libelleEntite | string | Oui | @NotBlank, max 50 |
| adresse | string | Oui | @NotBlank, max 200 |
| categorieEntite | string | Non | max 20 |
| idOrganigramme | number | Oui | @NotNull |
| idEntiteParent | number | Non | |
| niveauHierarchique | number | Non | |
| idLocalite | string | Non | max 5 — **localité de l'entité** (FK `tr_localite`) ; détermine la localité des dossiers la concernant |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/entite-contracts | — | `EntiteContractDto[]` | 200 | Authentifié |
| GET | /api/entite-contracts/{id} | — | `EntiteContractDto` | 200, 404 | Authentifié |
| POST | /api/entite-contracts | `EntiteContractDto` | `EntiteContractDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/entite-contracts/{id} | `EntiteContractDto` | `EntiteContractDto` | 200, 400, 404 | ADMINISTRATEUR |
| DELETE | /api/entite-contracts/{id} | — | — | 204, 404 | ADMINISTRATEUR |

`{id}` = idEntiteContract (number).

**Exemple — requête**
```json
{ "idEntiteContract": 7, "libelleEntite": "Direction Générale des Marchés", "adresse": "Antananarivo", "categorieEntite": "MINISTERE", "idOrganigramme": 2, "idEntiteParent": 1, "niveauHierarchique": 2, "idLocalite": "ANT" }
```

---

## Entités-PRMP
**Ressource** `/api/prmp-entites` — Affectations PRMP↔entité contractante (§3.1).
- **Lecture** : utilisateur authentifié, mais **scopée** — l'Administrateur voit toutes les
  affectations ; une **PRMP** ne voit que **les siennes** ; tout autre profil → liste vide
  (accès direct hors périmètre → **403**).
- **Écriture** (POST/PUT/DELETE) : réservée à l'**Administrateur**, qui gère les affectations.
- **Invariant d'unicité** : une entité ne peut être rattachée qu'à **une seule PRMP active** ;
  toute tentative d'affecter une entité déjà rattachée → **409**. Une PRMP peut gérer **plusieurs**
  entités. Les affectations sont **stables** (pas de transfert d'une PRMP à une autre).

**Champs `PrmpEntiteDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idPrmpEntite | number | Non (PK **générée côté serveur**) | clé primaire |
| idPrmp | string | Oui | @NotBlank, max 10 ; la PRMP doit exister (sinon 400) |
| idEntiteContract | number | Oui | @NotNull ; l'entité doit exister (sinon 400) |
| dateAffectation | string (date) | Non | défaut = date du jour |
| actif | boolean | Oui | @NotNull ; une création est toujours active |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/prmp-entites | — | `PrmpEntiteDto[]` | 200 | Authentifié (scopé) |
| GET | /api/prmp-entites/{id} | — | `PrmpEntiteDto` | 200, 403, 404 | Authentifié (scopé) |
| POST | /api/prmp-entites | `PrmpEntiteDto` | `PrmpEntiteDto` | 201, 400, 403, 409 | Administrateur |
| PUT | /api/prmp-entites/{id} | `PrmpEntiteDto` | `PrmpEntiteDto` | 200, 400, 403, 404, 409 | Administrateur |
| DELETE | /api/prmp-entites/{id} | — | — | 204, 403, 404 | Administrateur |

`{id}` = idPrmpEntite (number).

**Exemple — requête** (le serveur génère `idPrmpEntite` et la date par défaut)
```json
{ "idPrmp": "PRMP001", "idEntiteContract": 8, "actif": true }
```

---

## Examens
**Ressource** `/api/examens` — POST/PUT : profil `MEMBRE` (titulaire ou délégué) ; DELETE : `ADMINISTRATEUR`. Écriture limitée à sa localité (dossier hors localité → 403, sauf Président). Lecture filtrée par localité.

> **Précondition de circuit (création) → 409** : le dossier (via `dispatch → réception`) doit avoir été **dispatché**, statut **`DISPATCHE`** (§2.4). ⚠️ *Changé* : l'examen n'accepte plus `PRET_DISPATCH` — il faut d'abord créer le dispatch (qui pose `DISPATCHE`).
>
> **Autorisation (création) → 403** : un **Membre titulaire** n'examine que les dossiers **qui lui sont attribués** (`Dispatch.imCtrlMembre`) ; un CC/Président **par délégation** (§3.5) reste autorisé.
>
> **Transition** : à la création de l'examen, le dossier passe **`DISPATCHE` → `EXAMINE`** (même transaction) — il **quitte « à examiner »**.
>
> **Verrou (édition) → 409** : `PUT /api/examens/{id}` **et** les écritures sur `/api/examen-details` (création/MAJ/suppression) sont **refusées dès `PV_SIGNE`** : l'examen est modifiable tant que le dossier est `EXAMINE` (navette ouverte), **définitif** après signature du PV.

**Champs `ExamenDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idExamen | number | Oui (PK, au POST) | clé primaire |
| idDispatch | number | Oui | @NotNull |
| imCtrlMembre | string | Non | max 7 |
| dateExamen | string (date) | Non | |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/examens | — | `ExamenDto[]` | 200 | Authentifié (filtré) |
| GET | /api/examens/{id} | — | `ExamenDto` | 200, 404 | Authentifié (filtré) |
| POST | /api/examens | `ExamenDto` | `ExamenDto` | 201, 400, 403 | MEMBRE (titulaire/délégué) |
| PUT | /api/examens/{id} | `ExamenDto` | `ExamenDto` | 200, 400, 403, 404 | MEMBRE (titulaire/délégué) |
| DELETE | /api/examens/{id} | — | — | 204, 404 | ADMINISTRATEUR |

`{id}` = idExamen (number).

**Exemple — requête**
```json
{ "idExamen": 201, "idDispatch": 88, "imCtrlMembre": "MEMANT1", "dateExamen": "2026-05-08" }
```

---

## Indicateurs contrôleur
**Ressource** `/api/indicateur-ctrls` — Lecture / écriture : tout utilisateur authentifié.

**Champs `IndicateurCtrlDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idIndicateur | number | Oui (PK, au POST) | clé primaire |
| imControleur | string | Oui | @NotBlank, max 7 |
| periode | string | Oui | @NotBlank, max 7 |
| nbExamens | number | Non | |
| nbConformes | number | Non | |
| delaiMoyenExamen | number | Non | |
| nbObsEmises | number | Non | |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/indicateur-ctrls | — | `IndicateurCtrlDto[]` | 200 | Authentifié |
| GET | /api/indicateur-ctrls/{id} | — | `IndicateurCtrlDto` | 200, 404 | Authentifié |
| POST | /api/indicateur-ctrls | `IndicateurCtrlDto` | `IndicateurCtrlDto` | 201, 400 | Authentifié |
| PUT | /api/indicateur-ctrls/{id} | `IndicateurCtrlDto` | `IndicateurCtrlDto` | 200, 400, 404 | Authentifié |
| DELETE | /api/indicateur-ctrls/{id} | — | — | 204, 404 | Authentifié |

`{id}` = idIndicateur (number).

**Exemple — requête**
```json
{ "idIndicateur": 101, "imControleur": "MEMANT1", "periode": "2026-05", "nbExamens": 42, "nbConformes": 35, "delaiMoyenExamen": 3.5, "nbObsEmises": 18 }
```

---

## Indicateurs PRMP
**Ressource** `/api/indicateur-prmps` — Lecture / écriture : tout utilisateur authentifié.

**Champs `IndicateurPrmpDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idIndicateurPrmp | number | Oui (PK, au POST) | clé primaire |
| idPrmp | string | Oui | @NotBlank, max 10 |
| exercice | number | Oui | @NotNull |
| nbPpmSoumis | number | Oui | @NotNull |
| nbDossiersSoumis | number | Oui | @NotNull |
| nbDossiersConformes | number | Oui | @NotNull |
| nbDossiersNonConformes | number | Oui | @NotNull |
| nbRetours | number | Oui | @NotNull |
| nbRetraits | number | Oui | @NotNull |
| tauxConformite | number | Non | |
| delaiMoyCorrectionJours | number | Non | |
| montTotalSoumis | number | Non | |
| dateMaj | string (date-time) | Non | |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/indicateur-prmps | — | `IndicateurPrmpDto[]` | 200 | Authentifié |
| GET | /api/indicateur-prmps/{id} | — | `IndicateurPrmpDto` | 200, 404 | Authentifié |
| POST | /api/indicateur-prmps | `IndicateurPrmpDto` | `IndicateurPrmpDto` | 201, 400 | Authentifié |
| PUT | /api/indicateur-prmps/{id} | `IndicateurPrmpDto` | `IndicateurPrmpDto` | 200, 400, 404 | Authentifié |
| DELETE | /api/indicateur-prmps/{id} | — | — | 204, 404 | Authentifié |

`{id}` = idIndicateurPrmp (number).

**Exemple — requête**
```json
{
  "idIndicateurPrmp": 7, "idPrmp": "PRMP001", "exercice": 2026, "nbPpmSoumis": 12,
  "nbDossiersSoumis": 58, "nbDossiersConformes": 47, "nbDossiersNonConformes": 11,
  "nbRetours": 9, "nbRetraits": 2, "tauxConformite": 81.03,
  "delaiMoyCorrectionJours": 4.25, "montTotalSoumis": 1450000000.0, "dateMaj": "2026-06-10T14:32:00"
}
```

---

## Instantanés de statistiques
**Ressource** `/api/snapshot-statss` *(double « s » final)* — Lecture / écriture : tout utilisateur authentifié.

**Champs `SnapshotStatsDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idSnapshot | number | Oui (PK, au POST) | clé primaire |
| dateSnapshot | string (date) | Oui | @NotNull |
| idLocalite | string | Non | max 5 |
| exercice | number | Oui | @NotNull |
| nbDossiersRecus | number | Non | |
| nbDossiersClotures | number | Non | |
| nbDossiersEnCours | number | Non | |
| tauxConformite | number | Non | |
| delaiMoyenJours | number | Non | |
| montTotalControle | number | Non | |
| nbRetoursMoyen | number | Non | |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/snapshot-statss | — | `SnapshotStatsDto[]` | 200 | Authentifié |
| GET | /api/snapshot-statss/{id} | — | `SnapshotStatsDto` | 200, 404 | Authentifié |
| POST | /api/snapshot-statss | `SnapshotStatsDto` | `SnapshotStatsDto` | 201, 400 | Authentifié |
| PUT | /api/snapshot-statss/{id} | `SnapshotStatsDto` | `SnapshotStatsDto` | 200, 400, 404 | Authentifié |
| DELETE | /api/snapshot-statss/{id} | — | — | 204, 404 | Authentifié |

`{id}` = idSnapshot (number).

---

## Journaux d'audit
**Ressource** `/api/audit-logs` — Réservé à `ADMINISTRATEUR` pour **toutes** les opérations (lecture comprise). Le journal est alimenté **automatiquement** par le système. **DELETE interdit → 409** (journal immuable, §3.8).

**Champs `AuditLogDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idLog | number | Oui (PK, au POST) | clé primaire |
| dateAction | string (date-time) | Oui | @NotNull |
| imActeur | string | Non | max 7 |
| nomTable | string | Non | max 50 |
| idEnregistrement | string | Non | max 20 |
| typeAction | string | Non | max 10 |
| champModifie | string | Non | max 50 |
| ancienneValeur | string | Non | |
| nouvelleValeur | string | Non | |
| ipAdresse | string | Non | max 45 |
| sessionId | string | Non | max 100 |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/audit-logs | — | `AuditLogDto[]` | 200 | ADMINISTRATEUR |
| GET | /api/audit-logs/{id} | — | `AuditLogDto` | 200, 404 | ADMINISTRATEUR |
| POST | /api/audit-logs | `AuditLogDto` | `AuditLogDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/audit-logs/{id} | `AuditLogDto` | `AuditLogDto` | 200, 400, 404 | ADMINISTRATEUR |
| DELETE | /api/audit-logs/{id} | — | — | **409 (interdit)** | ADMINISTRATEUR |

`{id}` = idLog (number).

---

## KPIs / Tableau de bord
**Ressource** `/api/kpis` — `GET /api/kpis/tableau-bord` réservé à `PRESIDENT`, `ADMINISTRATEUR` et
`CHEF_COMMISSION`. Lecture seule.

> **Périmètre selon le profil (§3.3).** Président/Administrateur → **toutes localités** (global) ;
> **Chef de commission** → KPIs **filtrés sur sa localité** (pipeline, conformité et non-conformité du
> périmètre de sa localité ; CC sans localité → tableau vide). Aucun paramètre : le périmètre découle du profil.

**Champs `TableauBordDto`** (réponse)

| Champ (JSON) | Type | Description |
|---|---|---|
| pipelineParStatut | object (`Map<string, number>`) | nombre de dossiers par statut |
| nbDossiersSoumis | number | dossiers **soumis** (statut ≠ `BROUILLON`) du périmètre — dénominateur du taux ; les brouillons restent visibles dans `pipelineParStatut` |
| nbDossiersConformes | number | dossiers conformes (observations levées) |
| tauxConformitePct | number | conformes / soumis × 100 |
| topNonConformite | `PointNonConformiteDto[]` | top 5 des points de contrôle non conformes |

**Champs `PointNonConformiteDto`**

| Champ (JSON) | Type | Description |
|---|---|---|
| idPointCtrl | number | identifiant du point de contrôle |
| libelle | string | libellé du point |
| nbTotal | number | total d'occurrences examinées |
| nbNonConforme | number | occurrences non conformes |
| tauxNonConformitePct | number | taux de non-conformité (%) |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/kpis/tableau-bord | — | `TableauBordDto` | 200, 403 | PRESIDENT / ADMINISTRATEUR |

**Exemple — réponse**
```json
{
  "pipelineParStatut": { "PRET_DISPATCH": 5, "DISPATCHE": 8, "EXAMINE": 21, "PV_SIGNE": 6, "CLOTURE": 47, "RETIRE": 2 },
  "nbDossiersSoumis": 75, "nbDossiersConformes": 47, "tauxConformitePct": 62.67,
  "topNonConformite": [
    { "idPointCtrl": 14, "libelle": "Absence de pièce justificative", "nbTotal": 58, "nbNonConforme": 22, "tauxNonConformitePct": 37.93 }
  ]
}
```

---

## Localités
**Ressource** `/api/localites` — Référentiel : lecture ouverte ; écriture `ADMINISTRATEUR`.

**Champs `LocaliteDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idLocalite | string | Oui (PK, au POST) | clé primaire, max 5 |
| libelleLocalite | string | Oui | @NotBlank, max 50 |
| referencement | string | Oui | @NotBlank, max 50 |
| localite | string | Oui | @NotBlank, max 3 |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/localites | — | `LocaliteDto[]` | 200 | Authentifié |
| GET | /api/localites/{id} | — | `LocaliteDto` | 200, 404 | Authentifié |
| POST | /api/localites | `LocaliteDto` | `LocaliteDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/localites/{id} | `LocaliteDto` | `LocaliteDto` | 200, 400, 404 | ADMINISTRATEUR |
| DELETE | /api/localites/{id} | — | — | 204, 404 | ADMINISTRATEUR |

`{id}` = idLocalite (string).

**Exemple — requête**
```json
{ "idLocalite": "ANT", "libelleLocalite": "Antananarivo", "referencement": "REF-ANT", "localite": "ANT" }
```

---

## Lots
**Ressource** `/api/lots` — Lecture / écriture : tout utilisateur authentifié.

**Champs `LotDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idLot | number | Oui (PK, au POST) | clé primaire |
| idDossier | number | Oui | @NotNull |
| idDetail | number | Oui | @NotNull |
| designationLot | string | Oui | @NotBlank, max 200 |
| montLot | number | Non | |
| qteLot | number | Non | |
| uniteLot | string | Non | max 10 |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/lots | — | `LotDto[]` | 200 | Authentifié |
| GET | /api/lots/{id} | — | `LotDto` | 200, 404 | Authentifié |
| POST | /api/lots | `LotDto` | `LotDto` | 201, 400 | Authentifié |
| PUT | /api/lots/{id} | `LotDto` | `LotDto` | 200, 400, 404 | Authentifié |
| DELETE | /api/lots/{id} | — | — | 204, 404 | Authentifié |

`{id}` = idLot (number).

**Exemple — requête**
```json
{ "idLot": 88, "idDossier": 320, "idDetail": 1205, "designationLot": "Fourniture de mobilier - Lot 1", "montLot": 85000000.0, "qteLot": 150, "uniteLot": "unite" }
```

---

## Marchés
**Ressource** `/api/marches` — Lecture **scopée au périmètre de l'appelant** (⚠️ changement de portée, voir note). **Écriture (POST/PUT/DELETE) réservée `PRMP`** : édition des lignes d'un dossier **PPM en BROUILLON** dont elle est propriétaire (sinon 403/409). Le **mode** est déterminé automatiquement (cf. note ci-dessous). ⚠️ **Règle ajoutée** : à la **suppression** (`DELETE`), les **dates prévisionnelles** du marché (`t_marche_prevision`) sont supprimées **en cascade applicative** (même transaction).

> **⚠️ Scoping serveur (changement de portée, §1/§3.1).** `GET /api/marches` ne renvoie **plus toute
> la table** : Président/Administrateur → tout ; **PRMP → ses marchés** (ceux de ses PPM) ; contrôleur
> → ceux de **sa localité** (dossier non brouillon) ; autre profil → liste vide. `GET /api/marches/{id}`
> hors périmètre → **403**. Le front n'a plus à filtrer côté client (corrige la fuite inter‑PRMP/localité).

**Champs `MarcheDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idDetail | number | Oui (PK, au POST) | clé primaire |
| idDossier | number | Oui | @NotNull |
| idPpm | number | Oui | @NotNull |
| designationMarche | string | Non | max 500 |
| numCompte | string | Non | max 20 |
| montEstim | number | Non | |
| ancienMontEstim | number | Non | |
| nouvMontEstim | number | Non | |
| financement | string | Non | max 20 |
| statut | string | Non | max 20 |
| idSituation | number | Non | critère de détermination du mode |
| idNature | number | Non | critère de détermination du mode |
| idMode | number | **Déterminé automatiquement** | **lecture seule** : ignoré en entrée, calculé par le backend |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/marches | — | `MarcheDto[]` (scopé) | 200 | Authentifié |
| GET | /api/marches/{id} | — | `MarcheDto` | 200, 403, 404 | Authentifié (dans son périmètre) |
| POST | /api/marches | `MarcheDto` | `MarcheDto` | 201, 400 | Authentifié |
| PUT | /api/marches/{id} | `MarcheDto` | `MarcheDto` | 200, 400, 404 | Authentifié |
| DELETE | /api/marches/{id} | — | — | 204, 403, 404, 409 | PRMP (propriétaire, brouillon) — ⚠️ cascade prévisions |

`{id}` = idDetail (number).

> Les **dates prévisionnelles** ne sont plus portées par le marché : elles sont
> dans la ressource dédiée **Marchés — dates prévisionnelles** (`/api/marche-previsions`),
> en relation 1,N avec le marché.
>
> **Mode de passation (§3.1, Module 02) — ⚠️ règle ajoutée : la PRMP choisit, le serveur valide.**
> Pour (`idSituation`, `idNature`, `montEstim`, **localité du dossier**), `t_regle_passation`/`t_seuil`
> calcule l'**ensemble des modes autorisés** + un **recommandé** (cf. `suggestion-mode`). À la **création
> et à la mise à jour** : `idMode` **fourni** et dans l'ensemble → conservé ; **hors ensemble** → **409**
> (« choisir parmi … ») ; fourni mais **aucune règle** → accepté s'il existe dans `tr_mode` (saisie
> manuelle) ; **absent** → mode **recommandé**. Aucune règle et aucun mode → `idMode = null` + notification
> `MODE_NON_DETERMINE`. Localité du dossier introuvable → **400**.

**Exemple — requête** (`idMode` facultatif : mode choisi ; absent → recommandé)
```json
{
  "idDetail": 1205, "idDossier": 320, "idPpm": 45,
  "designationMarche": "Acquisition de matériel informatique", "numCompte": "6011001", "montEstim": 620000000.0,
  "financement": "RPI", "statut": "PREVU", "idSituation": 1, "idNature": 2
}
```
**Exemple — réponse** (`idMode` renseigné par le calcul)
```json
{
  "idDetail": 1205, "idDossier": 320, "idPpm": 45,
  "designationMarche": "Acquisition de matériel informatique", "numCompte": "6011001", "montEstim": 620000000.0,
  "financement": "RPI", "statut": "PREVU", "idSituation": 1, "idNature": 2, "idMode": 3
}
```

---

## Marchés — dates prévisionnelles
**Ressource** `/api/marche-previsions` — Lecture / écriture : tout utilisateur authentifié.

Dates prévisionnelles d'un marché, en relation **1,N** avec `/api/marches` (un marché a
plusieurs dates, chacune typée). Remplace les anciens champs `datePrev*` de `MarcheDto`.

**Champs `MarchePrevisionDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idPrevision | number | Oui (PK, au POST) | @NotNull, clé primaire |
| idDetail | number | Oui | @NotNull — FK vers le marché |
| typeDate | string | Oui | @NotNull, max 20 — `LANCEMENT`, `DAO`, `OUVERTURE`, `ATTRIBUTION` |
| datePrev | string (date) | Non | |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/marche-previsions | — | `MarchePrevisionDto[]` | 200 | Authentifié |
| GET | /api/marche-previsions?marche={idDetail} | — | `MarchePrevisionDto[]` | 200 | Authentifié |
| GET | /api/marche-previsions/{id} | — | `MarchePrevisionDto` | 200, 404 | Authentifié |
| POST | /api/marche-previsions | `MarchePrevisionDto` | `MarchePrevisionDto` | 201, 400 | Authentifié |
| PUT | /api/marche-previsions/{id} | `MarchePrevisionDto` | `MarchePrevisionDto` | 200, 400, 404 | Authentifié |
| DELETE | /api/marche-previsions/{id} | — | — | 204, 404 | Authentifié |

`{id}` = idPrevision (number). Le paramètre `marche` filtre par marché (idDetail).

**Exemple — réponse** (dates du marché 1)
```json
[
  { "idPrevision": 1, "idDetail": 1, "typeDate": "LANCEMENT", "datePrev": "2026-03-01" },
  { "idPrevision": 2, "idDetail": 1, "typeDate": "OUVERTURE", "datePrev": "2026-04-15" },
  { "idPrevision": 3, "idDetail": 1, "typeDate": "ATTRIBUTION", "datePrev": "2026-06-01" }
]
```

---

## Messagerie
**Ressource** `/api/messages` — Tout utilisateur authentifié, avec **confidentialité** : on ne voit que les messages dont on est expéditeur ou destinataire. À l'envoi, l'expéditeur est **forcé** à l'utilisateur courant.

**Champs `MessageDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idMessage | number | Oui (PK, au POST générique) | clé primaire |
| idDossier | number | Non | |
| expediteurIm | string | Oui | @NotBlank, max 7 (forcé à l'utilisateur courant) |
| destinataireIm | string | Oui | @NotBlank, max 7 |
| sujet | string | Non | max 200 |
| corps | string | Non | |
| dateEnvoi | string (date-time) | Non | |
| lu | boolean | Non | |
| idMessageParent | number | Non | |

**Champs `MessageEnvoiRequest`** (corps de `POST /api/messages/envoyer`)

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| destinataireIm | string | Oui | @NotBlank, max 7 |
| sujet | string | Non | max 200 |
| corps | string | Non | |
| idDossier | number | Non | |
| idMessageParent | number | Non | |

> Via `/envoyer`, l'id du message est généré par le serveur et l'expéditeur est l'utilisateur courant.

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/messages | — | `MessageDto[]` (filtré à l'utilisateur) | 200 | Authentifié |
| GET | /api/messages/{id} | — | `MessageDto` | 200, 403, 404 | Expéditeur / destinataire |
| POST | /api/messages | `MessageDto` | `MessageDto` | 201, 400 | Authentifié |
| PUT | /api/messages/{id} | `MessageDto` | `MessageDto` | 200, 400, 403, 404 | Expéditeur / destinataire |
| DELETE | /api/messages/{id} | — | — | 204, 403, 404 | Expéditeur / destinataire |
| POST | /api/messages/envoyer | `MessageEnvoiRequest` | `MessageDto` | 201, 400 | Authentifié |
| GET | /api/messages/recus | — | `MessageDto[]` | 200 | Authentifié |
| GET | /api/messages/envoyes | — | `MessageDto[]` | 200 | Authentifié |
| POST | /api/messages/{id}/lu | — | `MessageDto` | 200, 403, 404 | Destinataire uniquement |

`{id}` = idMessage (number).

**Exemple — requête (`/envoyer`) / réponse**
```json
{ "destinataireIm": "CCANT01", "sujet": "Question dossier 320", "corps": "Merci de vérifier le lot 1.", "idDossier": 320, "idMessageParent": null }
```
```json
{
  "idMessage": 4521, "idDossier": 320, "expediteurIm": "MEMANT1", "destinataireIm": "CCANT01",
  "sujet": "Question dossier 320", "corps": "Merci de vérifier le lot 1.",
  "dateEnvoi": "2026-06-12T09:15:00", "lu": false, "idMessageParent": null
}
```

---

## Ministères
**Ressource** `/api/ministeres` — Référentiel : lecture ouverte ; écriture `ADMINISTRATEUR`.

**Champs `MinistereDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idMinistere | number | Oui (PK, au POST) | clé primaire |
| libelleMinistere | string | Oui | @NotBlank, max 150 |
| sigle | string | Non | max 20 |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/ministeres | — | `MinistereDto[]` | 200 | Authentifié |
| GET | /api/ministeres/{id} | — | `MinistereDto` | 200, 404 | Authentifié |
| POST | /api/ministeres | `MinistereDto` | `MinistereDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/ministeres/{id} | `MinistereDto` | `MinistereDto` | 200, 400, 404 | ADMINISTRATEUR |
| DELETE | /api/ministeres/{id} | — | — | 204, 404 | ADMINISTRATEUR |

`{id}` = idMinistere (number).

**Exemple — requête**
```json
{ "idMinistere": 12, "libelleMinistere": "Ministère de l'Économie et des Finances", "sigle": "MEF" }
```

---

## Modes de passation
**Ressource** `/api/mode-passations` — Référentiel : lecture ouverte ; écriture `ADMINISTRATEUR`.

**Champs `ModePassationDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idMode | number | Oui (PK, au POST) | clé primaire |
| libelle | string | Non | max 100 |
| description | string | Non | max 500 |
| publiciteRequise | boolean | Non | |
| delaiMinJours | number | Non | |
| baseLegale | string | Non | max 200 |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/mode-passations | — | `ModePassationDto[]` | 200 | Authentifié |
| GET | /api/mode-passations/{id} | — | `ModePassationDto` | 200, 404 | Authentifié |
| POST | /api/mode-passations | `ModePassationDto` | `ModePassationDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/mode-passations/{id} | `ModePassationDto` | `ModePassationDto` | 200, 400, 404 | ADMINISTRATEUR |
| DELETE | /api/mode-passations/{id} | — | — | 204, 404 | ADMINISTRATEUR |

`{id}` = idMode (number).

**Exemple — requête**
```json
{ "idMode": 3, "libelle": "Appel d'offres ouvert", "description": "Procédure ouverte avec publicité.", "publiciteRequise": true, "delaiMinJours": 30, "baseLegale": "Code des marchés publics, art. 25" }
```

---

## Mon compte
**Ressource** `/api/mon-compte` — Actions de l'utilisateur **authentifié** sur son propre compte (contrôleur ou PRMP, tout rôle).

**Champs `ChangePasswordRequest`** (corps)

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| ancienMotDePasse | string | Oui | @NotBlank |
| nouveauMotDePasse | string | Oui | @NotBlank, min 8, max 72 |

**Champs `MessageResponse`** (réponse)

| Champ (JSON) | Type | Description |
|---|---|---|
| message | string | message d'information |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| POST | /api/mon-compte/changer-mot-de-passe | `ChangePasswordRequest` | `MessageResponse` | 200, 400, 401 | Authentifié |

> Vérifie l'ancien mot de passe ; **400** si l'ancien est incorrect ou si le nouveau est
> identique à l'actuel ; **401** sans jeton valide. Après changement, le nouveau mot de passe
> est requis à la prochaine connexion.

**Exemple — requête / réponse**
```json
{ "ancienMotDePasse": "Test@1234", "nouveauMotDePasse": "Nouveau#2026" }
```
```json
{ "message": "Mot de passe modifié avec succès." }
```

---

## Natures
**Ressource** `/api/natures` — Référentiel : lecture ouverte ; écriture `ADMINISTRATEUR`.

**Champs `NatureDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idNature | number | Oui (PK, au POST) | clé primaire |
| libelle | string | Non | max 100 |
| description | string | Non | max 500 |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/natures | — | `NatureDto[]` | 200 | Authentifié |
| GET | /api/natures/{id} | — | `NatureDto` | 200, 404 | Authentifié |
| POST | /api/natures | `NatureDto` | `NatureDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/natures/{id} | `NatureDto` | `NatureDto` | 200, 400, 404 | ADMINISTRATEUR |
| DELETE | /api/natures/{id} | — | — | 204, 404 | ADMINISTRATEUR |

`{id}` = idNature (number).

**Exemple — requête**
```json
{ "idNature": 1, "libelle": "Fournitures", "description": "Marchés de fournitures courantes" }
```

---

## Navettes de PV
**Ressource** `/api/pv-navettes` — Lecture / écriture (POST/PUT) : tout utilisateur authentifié. **DELETE interdit → 409** (traçabilité immuable, §3.5). `sens` ∈ {`SOUMISSION`, `RETOUR_RECTIF`, `ACCEPTATION`} (sinon **409**).

**Champs `PvNavetteDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idNavette | number | Oui (PK, au POST) | clé primaire |
| idPv | number | Oui | @NotNull |
| numNavette | number | Oui | @NotNull |
| sens | string | Oui | @NotBlank, max 20 — valeur contrôlée |
| imActeur | string | Oui | @NotBlank, max 7 |
| dateAction | string (date-time) | Oui | @NotNull |
| commentaire | string | Non | |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/pv-navettes | — | `PvNavetteDto[]` | 200 | Authentifié |
| GET | /api/pv-navettes/{id} | — | `PvNavetteDto` | 200, 404 | Authentifié |
| POST | /api/pv-navettes | `PvNavetteDto` | `PvNavetteDto` | 201, 400, 409 | Authentifié |
| PUT | /api/pv-navettes/{id} | `PvNavetteDto` | `PvNavetteDto` | 200, 400, 404, 409 | Authentifié |
| DELETE | /api/pv-navettes/{id} | — | — | **409 (interdit)** | — |

`{id}` = idNavette (number). *En pratique, les navettes sont créées automatiquement par les actions du PV.*

**Exemple — requête**
```json
{ "idNavette": 905, "idPv": 312, "numNavette": 1, "sens": "SOUMISSION", "imActeur": "MEMANT1", "dateAction": "2026-06-12T09:35:00", "commentaire": "Première soumission" }
```

---

## Notifications
**Ressource** `/api/notifications` (table `t_notification`) — Notifications système, émises **automatiquement à chaque transmission** (dossier, PV, navette, message).
- **Mes notifications** (`/mes`, `/mes/non-lues/count`, `/{id}/lu`, `/lire-tout`) : **scopées** à l'utilisateur courant — chacun ne voit/agit que sur **les siennes** (clé `DESTINATAIRE_REF` + `DESTINATAIRE_TYPE` ; repli e-mail pour les PRMP).
- **Liste globale** et **CRUD** : réservés à l'**Administrateur** (supervision).

**Champs `NotificationDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idNotification | number | Oui (PK, au POST) | clé primaire |
| idDossier | number | Non | |
| typeNotif | string | Oui | @NotBlank, max 30 |
| destinataireIm | string | Non | max 7 — destinataire contrôleur (compat.) |
| destinataireEmail | string | Non | max 100 — destinataire PRMP/externe |
| **destinataireRef** | string | Non | max 10 — clé unifiée (matricule ou id PRMP) |
| **destinataireType** | string | Non | max 20 — `CONTROLEUR` / `PRMP` |
| **idObjet** | number | Non | objet concerné (selon `typeObjet`) |
| **typeObjet** | string | Non | max 20 — `DOSSIER` / `PV` / `MESSAGE` |
| titre | string | Non | max 200 |
| corps | string | Non | |
| dateEnvoi | string (date-time) | Non | |
| lu | boolean | Non | |
| dateLecture | string (date-time) | Non | |
| canal | string | Non | max 20 |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/notifications/mes`?lu=` | — | `NotificationDto[]` | 200 | Authentifié (scopé) |
| GET | /api/notifications/mes/non-lues/count | — | `{ "nonLues": number }` | 200 | Authentifié (scopé) |
| POST | /api/notifications/{id}/lu | — | `NotificationDto` | 200, 403, 404 | Destinataire |
| POST | /api/notifications/lire-tout | — | `{ "traitees": number }` | 200 | Authentifié (scopé) |
| GET | /api/notifications | — | `NotificationDto[]` | 200, 403 | ADMINISTRATEUR |
| GET | /api/notifications/{id} | — | `NotificationDto` | 200, 403, 404 | ADMINISTRATEUR |
| POST | /api/notifications | `NotificationDto` | `NotificationDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/notifications/{id} | `NotificationDto` | `NotificationDto` | 200, 400, 403, 404 | ADMINISTRATEUR |
| DELETE | /api/notifications/{id} | — | — | 204, 403, 404 | ADMINISTRATEUR |

`{id}` = idNotification (number). `?lu=true|false` filtre lues/non-lues ; `POST /{id}/lu` refuse (403) une notification qui ne vous appartient pas.

**Types (`TYPE_NOTIF`) émis à la transmission**
| Type | Événement | Destinataire | Objet |
|---|---|---|---|
| `DOSSIER_SOUMIS` | soumission du dossier | Secrétaire / CC de la localité | DOSSIER |
| `PRET_DISPATCH` | dossier complet | Président + CC de la localité | DOSSIER |
| `EXAMEN_A_FAIRE` | dossier dispatché | Membre assigné | DOSSIER |
| `PV_A_VALIDER` | projet de PV soumis | CC + Président de la localité | PV |
| `PV_A_RECTIFIER` | navette retournée (commentaire) | Membre auteur | PV |
| `PV_ACCEPTE` | projet de PV accepté | Membre auteur | PV |
| `PV_SIGNE` | PV signé | PRMP | DOSSIER |
| `PV_A_VERIFIER` | PV signé `FAVR` à vérifier | Vérificateur de la localité | DOSSIER |
| `PV_POUR_INFO` | PV signé auto-clôturé (FAV/DEF/NSP) | Vérificateur de la localité | DOSSIER |
| `OBSERVATION_VERIFICATION` | observations de vérification non levées à traiter | PRMP du dossier | DOSSIER |
| `RECTIFICATION_PRMP` | dossier rectifié par la PRMP et resoumis | Vérificateur du dossier | DOSSIER |
| `CLOTURE_ELIGIBLE` | dossier clôturé éligible | Chargé de publication | DOSSIER |
| `NOUVEAU_MESSAGE` | message reçu (messagerie) | destinataire | MESSAGE |

*(Autres types existants : `NOUVELLE_INSCRIPTION`, `INSCRIPTION_VALIDEE/REFUSEE`, `DEMANDE_RETRAIT_A_VALIDER`, `RETRAIT_ACCEPTE/REFUSE`, `MODE_NON_DETERMINE`, `FIN_MANDAT`, `ALERTE_DELAI`, `DISPATCH_CC`.)*

**Exemple — réponse `/mes`**
```json
[{
  "idNotification": 1042, "typeNotif": "EXAMEN_A_FAIRE",
  "destinataireRef": "CTRMEM", "destinataireType": "CONTROLEUR",
  "idObjet": 312, "typeObjet": "DOSSIER", "idDossier": 312,
  "titre": "Dossier à examiner", "corps": "Le dossier 312 vous a été dispatché pour examen.",
  "dateEnvoi": "2026-06-16T09:15:30", "lu": false, "dateLecture": null, "canal": "SYSTEME"
}]
```

---

## Organigrammes
**Ressource** `/api/organigrammes` — Gestion de la hiérarchie (§3.8) : lecture ouverte ; écriture `ADMINISTRATEUR`.

**Champs `OrganigrammeDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idOrganigramme | number | Oui (PK, au POST) | clé primaire |
| idMinistere | number | Oui | @NotNull |
| libelle | string | Non | max 200 |
| version | string | Non | max 20 |
| dateValidation | string (date) | Non | |
| actif | boolean | Oui | @NotNull |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/organigrammes | — | `OrganigrammeDto[]` | 200 | Authentifié |
| GET | /api/organigrammes/{id} | — | `OrganigrammeDto` | 200, 404 | Authentifié |
| POST | /api/organigrammes | `OrganigrammeDto` | `OrganigrammeDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/organigrammes/{id} | `OrganigrammeDto` | `OrganigrammeDto` | 200, 400, 404 | ADMINISTRATEUR |
| DELETE | /api/organigrammes/{id} | — | — | 204, 404 | ADMINISTRATEUR |

`{id}` = idOrganigramme (number).

**Exemple — requête**
```json
{ "idOrganigramme": 7, "idMinistere": 3, "libelle": "Organigramme MEF", "version": "2026.1", "dateValidation": "2026-01-15", "actif": true }
```

---

## Points de contrôle
**Ressource** `/api/points-ctrls` — Référentiel (grille de contrôle) : lecture ouverte ; écriture `ADMINISTRATEUR`.

**Champs `PointsCtrlDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idPointCtrl | number | Oui (PK, au POST) | clé primaire |
| libelPointCtrl | string | Non | |
| decriptPointCtrl | string | Non | |
| ordrePointCtrl | number | Non | |
| obligatoire | boolean | Oui | @NotNull |
| idTypeDossier | string | Oui | @NotBlank |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/points-ctrls | — | `PointsCtrlDto[]` | 200 | Authentifié |
| GET | /api/points-ctrls/{id} | — | `PointsCtrlDto` | 200, 404 | Authentifié |
| POST | /api/points-ctrls | `PointsCtrlDto` | `PointsCtrlDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/points-ctrls/{id} | `PointsCtrlDto` | `PointsCtrlDto` | 200, 400, 404 | ADMINISTRATEUR |
| DELETE | /api/points-ctrls/{id} | — | — | 204, 404 | ADMINISTRATEUR |

`{id}` = idPointCtrl (number).

**Exemple — requête**
```json
{ "idPointCtrl": 12, "libelPointCtrl": "Présence de l'avis d'appel d'offres", "decriptPointCtrl": "Vérifier que l'avis est joint et signé.", "ordrePointCtrl": 3, "obligatoire": true, "idTypeDossier": "AO" }
```

---

## PPM
**Ressource** `/api/ppms` — Lecture **scopée au périmètre de l'appelant** (⚠️ changement de portée, voir note). **`POST` réservé `ADMINISTRATEUR`** (la saisie passe par `/api/saisies/ppm`) ; **`PUT` réservé `PRMP`/`ADMINISTRATEUR`** (édition de l'en-tête d'un brouillon) ; **`DELETE` réservé `PRMP` propriétaire** — uniquement si le **dossier rattaché est en BROUILLON** (sinon **403**/**409**), avec ⚠️ **cascade** des marchés du PPM **et** de leurs dates prévisionnelles (même transaction). Un PPM ne se rattache qu'à un dossier de **type PPM, en BROUILLON, propriété de la PRMP** (sinon **409**/**403**).

> **⚠️ Scoping serveur (changement de portée, §1/§3.1).** `GET /api/ppms` ne renvoie **plus toute la
> table** : Président/Administrateur → tout ; **PRMP → les siens** (`t_ppm.ID_PRMP`, brouillons compris) ;
> contrôleur → ceux de **sa localité** (dossier non brouillon) ; autre profil → liste vide.
> `GET /api/ppms/{id}` hors périmètre → **403**. Corrige la fuite inter‑PRMP/localité (plus de filtrage côté client).

**Champs `PpmDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idPpm | number | Oui (PK, au POST) | clé primaire |
| idDossier | number | Oui | @NotNull |
| exercice | number | Oui | @NotNull |
| signataire | string | Oui | @NotBlank, max 50 |
| dateSignature | string (date) | Oui | @NotNull |
| datePpmInit | string (date) | Non | |
| numMajPrec | number | Non | |
| dateMajPrec | string (date) | Non | |
| numMaj | number | Non | |
| dateMaj | string (date) | Non | |
| reference | string | Oui | @NotBlank, max 100 |
| libelle | string | Non | max 200 |
| dateReceptionCnm | string (date) | Non | |
| idLocalite | string | Non | max 5 |
| vu | string | Non | max 100 |
| idPrmp | string | Non | max 10 |
| motifMaj | string | Non | max 500 |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/ppms | — | `PpmDto[]` (scopé) | 200 | Authentifié |
| GET | /api/ppms/{id} | — | `PpmDto` | 200, 403, 404 | Authentifié (dans son périmètre) |
| POST | /api/ppms | `PpmDto` | `PpmDto` | 201, 400 | Authentifié |
| PUT | /api/ppms/{id} | `PpmDto` | `PpmDto` | 200, 400, 404 | Authentifié |
| DELETE | /api/ppms/{id} | — | — | 204, 403, 404, 409 | PRMP (propriétaire, brouillon) — ⚠️ cascade marchés + prévisions |

`{id}` = idPpm (number).

**Exemple — requête**
```json
{ "idPpm": 88, "idDossier": 312, "exercice": 2026, "signataire": "Le Signataire", "dateSignature": "2026-02-10", "reference": "PPM-2026-0312", "libelle": "PPM exercice 2026", "idLocalite": "ANT", "idPrmp": "PRMP001" }
```

---

## Profils
**Ressource** `/api/profiles` — Référentiel RBAC (§3.8) : lecture ouverte ; écriture `ADMINISTRATEUR`.

**Champs `ProfileDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idProfile | number | Oui (PK, au POST) | clé primaire |
| profile | string | Non | max 50 — libellé du profil |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/profiles | — | `ProfileDto[]` | 200 | Authentifié |
| GET | /api/profiles/{id} | — | `ProfileDto` | 200, 404 | Authentifié |
| POST | /api/profiles | `ProfileDto` | `ProfileDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/profiles/{id} | `ProfileDto` | `ProfileDto` | 200, 400, 404 | ADMINISTRATEUR |
| DELETE | /api/profiles/{id} | — | — | 204, 404 | ADMINISTRATEUR |

`{id}` = idProfile (number). *Le rôle métier est déduit du libellé `profile` (ex. « Chef de commission »).*

**Exemple — requête**
```json
{ "idProfile": 2, "profile": "Président" }
```

---

## PRMP
**Ressource** `/api/prmps` — Gestion des comptes PRMP (§3.8) : lecture ouverte ; écriture `ADMINISTRATEUR`. *(Fiche de la personne PRMP, distincte des PPM/marchés qu'elle soumet. Voir aussi l'auto-inscription dans **Authentification**.)*

**Champs `PrmpDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idPrmp | string | Oui (PK, au POST) | clé primaire, max 10 |
| nomPrmp | string | Oui | @NotBlank, max 50 |
| prenomsPrmp | string | Oui | @NotBlank, max 100 |
| imPrmp | string | Oui | @NotBlank, max 6 |
| arreteNomin | string | Oui | @NotBlank, max 100 |
| dateNomin | string (date) | Oui | @NotNull |
| cin | string | Oui | @NotBlank, max 12 |
| dateCin | string (date) | Oui | @NotNull |
| lieuCin | string | Oui | @NotBlank, max 50 |
| emailPrmp | string | Oui | @NotBlank, max 100 |
| telPrmp | string | Oui | @NotBlank, max 20 |

> La PRMP n'a **pas de localité propre** : `PrmpDto` ne porte plus de champ `idLocalite` (la
> localité d'un dossier vient de l'entité contractante choisie à la saisie).

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/prmps | — | `PrmpDto[]` | 200 | Authentifié |
| GET | /api/prmps/{id} | — | `PrmpDto` | 200, 404 | Authentifié |
| POST | /api/prmps | `PrmpDto` | `PrmpDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/prmps/{id} | `PrmpDto` | `PrmpDto` | 200, 400, 404 | ADMINISTRATEUR |
| DELETE | /api/prmps/{id} | — | — | 204, 404 | ADMINISTRATEUR |

`{id}` = idPrmp (string).

**Exemple — requête**
```json
{
  "idPrmp": "PRMP001", "nomPrmp": "Randria", "prenomsPrmp": "La Personne", "imPrmp": "IMP001",
  "arreteNomin": "ARR-2024-001", "dateNomin": "2024-01-15", "cin": "101011112222",
  "dateCin": "2010-05-05", "lieuCin": "Antananarivo", "emailPrmp": "prmp@ministere.mg",
  "telPrmp": "0330000001", "idLocalite": "ANT"
}
```

---

## Publications
**Ressource** `/api/publications` — Portail de transparence (§3.7). CRUD + `publier`/`retirer` réservés à `CHARGE_PUBLICATION` ; `consulter` ouvert à tout authentifié. À la création, `statutPubli` est forcé à `EN_ATTENTE` et `nbConsultations` à `0`.

**Champs `PublicationDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idPublication | number | Oui (PK, au POST) | clé primaire |
| typeObjet | string | Oui | @NotBlank, max 20 |
| idObjet | number | Oui | @NotNull |
| datePublication | string (date-time) | Non | renseigné à la publication |
| imPubliePar | string | Non | max 7 — renseigné à la publication |
| statutPubli | string | Non | max 20 — `EN_ATTENTE` / `PUBLIE` / `RETIRE` |
| dateRetrait | string (date) | Non | renseigné au retrait |
| motifRetrait | string | Non | max 300 — renseigné au retrait |
| nbConsultations | number | Non | |

**Champs `RetraitPublicationRequest`** (corps de `retirer`)

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| motifRetrait | string | Oui | @NotBlank, max 300 |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/publications | — | `PublicationDto[]` | 200 | CHARGE_PUBLICATION |
| GET | /api/publications/{id} | — | `PublicationDto` | 200, 404 | CHARGE_PUBLICATION |
| POST | /api/publications | `PublicationDto` | `PublicationDto` | 201, 400, 403 | CHARGE_PUBLICATION |
| PUT | /api/publications/{id} | `PublicationDto` | `PublicationDto` | 200, 400, 404 | CHARGE_PUBLICATION |
| DELETE | /api/publications/{id} | — | — | 204, 404 | CHARGE_PUBLICATION |
| POST | /api/publications/{id}/publier | — | `PublicationDto` | 200, 404, 409 | CHARGE_PUBLICATION |
| POST | /api/publications/{id}/retirer | `RetraitPublicationRequest` | `PublicationDto` | 200, 400, 404, 409 | CHARGE_PUBLICATION |
| POST | /api/publications/{id}/consulter | — | `PublicationDto` | 200, 404 | Authentifié |

`{id}` = idPublication (number). `publier` : EN_ATTENTE→PUBLIE (409 sinon) ; `retirer` : PUBLIE→RETIRE (409 sinon) ; `consulter` : incrémente `nbConsultations`.

**Exemple — requête (création) / retrait**
```json
{ "idPublication": 87, "typeObjet": "PPM", "idObjet": 4521 }
```
```json
{ "motifRetrait": "Document erroné, republication à suivre" }
```

---

## PV d'examen
**Ressource** `/api/pv-examens` — CRUD : POST/PUT = `MEMBRE`/`CHEF_COMMISSION`/`PRESIDENT` ; DELETE = `ADMINISTRATEUR`. Lecture filtrée par localité. À la création, `statutPv` est forcé à `BROUILLON` et `nbNavettes` à `0`. Cycle : `BROUILLON → PROJET_SOUMIS → EN_RECTIFICATION → PROJET_ACCEPTE → SIGNE`.

**Champs `PvExamenDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idPv | number | Oui (PK, au POST) | clé primaire |
| idExamen | number | Oui | @NotNull |
| idAvis | string | Oui | @NotBlank, max 10 |
| imCtrlPresident | string | Non | max 7 |
| imCtrlCc | string | Non | max 7 |
| imCtrlMembre | string | Oui (validation) | @NotBlank, max 7 — **valeur ignorée** : dérivée de l'attribution (`Examen → Dispatch.imCtrlMembre`) ; examen sans attributaire → 409 |
| syntheseObservations | string | Non | |
| statutPv | string | Oui | @NotBlank, max 20 (forcé `BROUILLON` à la création) |
| nbNavettes | number | Oui | @NotNull (forcé `0` à la création) |
| dateSoumissionInitiale | string (date) | Non | |
| dateAcceptation | string (date) | Non | |
| dateSignaturePresident | string (date) | Non | |
| dateSignatureCc | string (date) | Non | |
| dateSignatureMembre | string (date) | Non | |
| datePv | string (date) | Non | |
| referencePv | string | Non | max 100 |

**Champs `PvActionRequest`** (corps des actions de workflow)

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| imActeur | string | Oui | @NotBlank, max 7. **Non utilisé pour l'identité** : `signer` enregistre l'utilisateur authentifié (JWT), pas ce champ |
| commentaire | string | Conditionnel | obligatoire pour `retourner` (sinon 409) |
| role | string | Conditionnel | max 20 — obligatoire pour `signer` : `MEMBRE` / `PRESIDENT` / `CC` |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/pv-examens | — | `PvExamenDto[]` | 200 | Authentifié (filtré) |
| GET | /api/pv-examens/{id} | — | `PvExamenDto` | 200, 404 | Authentifié (filtré) |
| POST | /api/pv-examens | `PvExamenDto` | `PvExamenDto` | 201, 400, 403 | MEMBRE / CC / PRESIDENT |
| PUT | /api/pv-examens/{id} | `PvExamenDto` | `PvExamenDto` | 200, 400, 404, 409 | MEMBRE / CC / PRESIDENT |
| DELETE | /api/pv-examens/{id} | — | — | 204, 404 | ADMINISTRATEUR |
| POST | /api/pv-examens/{id}/soumettre | `PvActionRequest` | `PvExamenDto` | 200, 400, 403, 404, 409 | MEMBRE / CC / PRESIDENT |
| POST | /api/pv-examens/{id}/retourner | `PvActionRequest` | `PvExamenDto` | 200, 400, 403, 404, 409 | CC / PRESIDENT |
| POST | /api/pv-examens/{id}/accepter | `PvActionRequest` | `PvExamenDto` | 200, 403, 404, 409 | CC / PRESIDENT |
| POST | /api/pv-examens/{id}/signer | `PvActionRequest` | `PvExamenDto` | 200, 400, 403, 404, 409 | MEMBRE / CC / PRESIDENT |

`{id}` = idPv (number). `soumettre` : BROUILLON|EN_RECTIFICATION→PROJET_SOUMIS ; `retourner` : PROJET_SOUMIS→EN_RECTIFICATION (`commentaire` obligatoire) ; `accepter` : PROJET_SOUMIS→PROJET_ACCEPTE ; `signer` : passe à SIGNE quand le Membre **et** (le Président **ou** le CC) ont signé.

**`signer` — authentification de la signature (dans le service).** L'endpoint autorise largement (`MEMBRE`/`CHEF_COMMISSION`/`PRESIDENT`) mais le service vérifie que le **signataire authentifié** correspond au `role` signé et enregistre son identité (`IM_CTRL_MEMBRE`/`IM_CTRL_PRESIDENT`/`IM_CTRL_CC` = matricule du signataire) :
- `role=MEMBRE` → l'appelant doit être le **Membre attributaire** du PV (`IM_CTRL_MEMBRE`), non déléguable → **403** sinon ;
- `role=PRESIDENT` → profil **PRESIDENT** réel → **403** sinon ;
- `role=CC` → profil **CHEF_COMMISSION** **et localité du dossier** → **403** sinon ;
- co-signataire (Président/CC) **≠ Membre signataire** : auto-co-signature interdite → **409** ;
- `signer` hors `PROJET_ACCEPTE` → **409**.

**Exemple — requête (création) / signature**
```json
{ "idPv": 312, "idExamen": 201, "idAvis": "FAV", "imCtrlMembre": "MEMANT1", "statutPv": "BROUILLON", "nbNavettes": 0, "syntheseObservations": "RAS" }
```
```json
{ "imActeur": "CTRPRE", "role": "PRESIDENT" }
```

---

## Rapports
**Ressource** `/api/rapports` — Ouvert à `PRESIDENT`, `ADMINISTRATEUR` et `CHEF_COMMISSION`. **Réponses binaires** (téléchargement), pas de JSON. Côté Angular : `responseType: 'blob'`.

**Endpoints**

| Méthode | URL | Paramètres (query) | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/rapports/dossiers | `from`, `to` (date `yyyy-MM-dd`), `localite` (facultatifs) | `application/pdf` (`rapport-dossiers.pdf`) | 200, 403 | PRESIDENT / ADMINISTRATEUR / CHEF_COMMISSION |
| GET | /api/rapports/dossiers/excel | `from`, `to` (date `yyyy-MM-dd`), `localite` (facultatifs) | `.xlsx` (`...spreadsheetml.sheet`) | 200, 403 | PRESIDENT / ADMINISTRATEUR / CHEF_COMMISSION |

`from`/`to` bornent la période (sur `DATE_REF`) ; absents → tous les dossiers.

**Portée par localité (§3.3).** Le contenu (et la colonne **Localité** des deux formats) est filtré selon le profil :
- **Chef de commission** : rapport **toujours forcé sur sa propre localité** ; le paramètre `localite` est **ignoré**. Si le CC n'a aucune localité associée → **403**.
- **Président / Administrateur** : **toutes commissions** par défaut ; peuvent cibler une commission précise via `?localite=ANT`.

**Exemples**
```
GET /api/rapports/dossiers?from=2026-01-01&to=2026-12-31
→ 200 OK, application/pdf, attachment; filename="rapport-dossiers.pdf"  (toutes localités si Président)

GET /api/rapports/dossiers?localite=TMS            (Président : cible la commission TMS)
GET /api/rapports/dossiers/excel                   (Chef de commission : forcé sur sa localité)
```

---

## Réceptions
**Ressource** `/api/receptions` — POST/PUT : profil `SECRETAIRE` (titulaire ou délégué) ; DELETE : `ADMINISTRATEUR`. Écriture limitée à sa localité (dossier hors localité → 403, sauf Président). Lecture filtrée par localité.

> **Garde de localité dès la 1ʳᵉ réception.** La localité du dossier est résolue par ordre :
> `t_dossier.idLocalite` → PPM (`Ppm.idLocalite`) → réception existante. Si elle est connue, un
> contrôleur d'une **autre** localité ne peut pas réceptionner (→ **403**), **y compris au premier
> passage** ; Président/Administrateur ne sont pas contraints. Si aucune localité n'est déterminable,
> aucune contrainte (la réception l'établit).
>
> **Pas de réception d'un brouillon** : si le dossier est au statut `BROUILLON` (non soumis), la réception
> est refusée (→ **409**).

> **Règles (sinon 409)** : `numPassage` ≥ 1 ; `numPassage = 1` ⟺ `typePassage = "INITIAL"`.
> **Effet `[Auto]`** : si `complet = true`, le dossier passe au statut `PRET_DISPATCH`.

**Champs `ReceptionDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idReception | number | Oui (PK, au POST) | clé primaire |
| idDossier | number | Oui | @NotNull |
| numPassage | number | Oui | @NotNull (≥ 1) |
| typePassage | string | Oui | @NotBlank, max 10 — `INITIAL` ⟺ numPassage=1 |
| imCtrlRecept | string | Non | max 7 |
| dateReception | string (date) | Non | |
| observation | string | Non | max 500 |
| complet | boolean | Non | si `true` → dossier `PRET_DISPATCH` |
| idReceptionPrec | number | Non | |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/receptions | — | `ReceptionDto[]` | 200 | Authentifié (filtré) |
| GET | /api/receptions?idDossier={n} | — | `ReceptionDto[]` | 200 | Authentifié (filtré) |
| GET | /api/receptions/dossier/{idDossier}/existe | — | `ReceptionExisteDto` | 200 | Authentifié (filtré) |
| GET | /api/receptions/{id} | — | `ReceptionDto` | 200, 403, 404 | Authentifié (filtré) |
| POST | /api/receptions | `ReceptionDto` | `ReceptionDto` | 201, 400, 403, 409 | SECRETAIRE (titulaire/délégué) |
| PUT | /api/receptions/{id} | `ReceptionDto` | `ReceptionDto` | 200, 400, 403, 404, 409 | SECRETAIRE (titulaire/délégué) |
| DELETE | /api/receptions/{id} | — | — | 204, 404 | ADMINISTRATEUR |

`{id}` = idReception (number).

> **Ne charger que l'utile (anti sur‑fetch).** `?idDossier={n}` restreint la liste aux réceptions de
> ce dossier (filtre serveur, dans le périmètre). `…/dossier/{idDossier}/existe` → `{ "idDossier": n,
> "recu": true|false }` : test **léger** « déjà réceptionné ? » avant d'enregistrer une réception, sans
> charger l'historique. La PRMP (ressource interne) obtient liste vide / `recu=false`. **Pour la worklist
> du Secrétaire, utiliser `GET /api/dossiers/a-receptionner`** (et non un `…/existe` par dossier — ce
> serait un N+1).

**Exemple — requête**
```json
{ "idReception": 1543, "idDossier": 7720, "numPassage": 1, "typePassage": "INITIAL", "imCtrlRecept": "SECANT1", "dateReception": "2026-06-12", "observation": "Dossier reçu complet", "complet": true }
```

---

## Règles d'alerte
**Ressource** `/api/regle-alertes` — Référentiel : lecture ouverte ; écriture `ADMINISTRATEUR`.

**Champs `RegleAlerteDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idRegleAlerte | number | Oui (PK, au POST) | clé primaire |
| typeJalon | string | Oui | @NotBlank, max 30 |
| joursAvant | number | Oui | @NotNull |
| destinataireProfil | number | Non | |
| actif | boolean | Non | |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/regle-alertes | — | `RegleAlerteDto[]` | 200 | Authentifié |
| GET | /api/regle-alertes/{id} | — | `RegleAlerteDto` | 200, 404 | Authentifié |
| POST | /api/regle-alertes | `RegleAlerteDto` | `RegleAlerteDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/regle-alertes/{id} | `RegleAlerteDto` | `RegleAlerteDto` | 200, 400, 404 | ADMINISTRATEUR |
| DELETE | /api/regle-alertes/{id} | — | — | 204, 404 | ADMINISTRATEUR |

`{id}` = idRegleAlerte (number).

**Exemple — requête**
```json
{ "idRegleAlerte": 12, "typeJalon": "OUVERTURE", "joursAvant": 7, "destinataireProfil": 1, "actif": true }
```

---

## Règles d'anomalie
**Ressource** `/api/regle-anomalies` — Référentiel : lecture ouverte ; écriture `ADMINISTRATEUR`.

**Champs `RegleAnomalieDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idRegleAnomalie | number | Oui (PK, au POST) | clé primaire |
| codeRegle | string | Oui | @NotBlank, max 30 |
| libelle | string | Non | max 200 |
| parametreNum | number | Non | |
| parametreTxt | string | Non | max 200 |
| actif | boolean | Non | |
| graviteDefaut | string | Non | max 10 |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/regle-anomalies | — | `RegleAnomalieDto[]` | 200 | Authentifié |
| GET | /api/regle-anomalies/{id} | — | `RegleAnomalieDto` | 200, 404 | Authentifié |
| POST | /api/regle-anomalies | `RegleAnomalieDto` | `RegleAnomalieDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/regle-anomalies/{id} | `RegleAnomalieDto` | `RegleAnomalieDto` | 200, 400, 404 | ADMINISTRATEUR |
| DELETE | /api/regle-anomalies/{id} | — | — | 204, 404 | ADMINISTRATEUR |

`{id}` = idRegleAnomalie (number).

**Exemple — requête**
```json
{ "idRegleAnomalie": 27, "codeRegle": "MONTANT_HORS_SEUIL", "libelle": "Montant supérieur au seuil", "parametreNum": 50000000.0, "parametreTxt": null, "actif": true, "graviteDefaut": "MAJEURE" }
```

---

## Règles de passation
**Ressource** `/api/regle-passations` — Référentiel : lecture ouverte ; écriture `ADMINISTRATEUR`. L'endpoint `suggestion-mode` est réservé à `PRMP` (non soumis au verrou Admin). ⚠️ **Règle ajoutée** : la PRMP **choisit** le mode parmi l'**ensemble autorisé** que ce calcul renvoie ; le serveur **valide** ce choix à la création/édition d'un marché (mode hors ensemble → **409**).

**Champs `ReglePassationDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idRegle | number | Oui (PK, au POST) | clé primaire |
| idSituation | number | Oui | @NotNull |
| idSeuil | number | Oui | @NotNull |
| idMode | number | Oui | @NotNull |
| priorite | number | Non | |

**Champs `SuggestionModeRequest`** (corps de `suggestion-mode`)

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idSituation | number | Oui | @NotNull |
| montant | number | Oui | @NotNull |
| idNature | number | Oui | @NotNull |
| idLocalite | string | Oui | @NotBlank, max 5 |

**Champs `SuggestionModeResponse`** (réponse) — ⚠️ règle ajoutée : **ensemble autorisé** + recommandé.

| Champ (JSON) | Type | Description |
|---|---|---|
| modeRecommande | number | mode recommandé (règle de plus haute priorité) ; `null` si aucune règle |
| modesAutorises | array | modes autorisés `[{ idMode, libelle }]`, **recommandé en tête** |
| modeNonDetermine | boolean | `true` si aucune règle ne correspond (ensemble vide → saisie manuelle) |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/regle-passations | — | `ReglePassationDto[]` | 200 | Authentifié |
| GET | /api/regle-passations/{id} | — | `ReglePassationDto` | 200, 404 | Authentifié |
| POST | /api/regle-passations | `ReglePassationDto` | `ReglePassationDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/regle-passations/{id} | `ReglePassationDto` | `ReglePassationDto` | 200, 400, 404 | ADMINISTRATEUR |
| DELETE | /api/regle-passations/{id} | — | — | 204, 404 | ADMINISTRATEUR |
| POST | /api/regle-passations/suggestion-mode | `SuggestionModeRequest` | `SuggestionModeResponse` | 200, 400 | PRMP |

`{id}` = idRegle (number). `suggestion-mode` → **200 même sans règle** (`modesAutorises:[]`, `modeNonDetermine:true`) — plus de 404 ; non contraignant : la PRMP choisit, le serveur valide.

**Exemple — requête (création) / suggestion-mode / réponse**
```json
{ "idRegle": 18, "idSituation": 2, "idSeuil": 9, "idMode": 4, "priorite": 1 }
```
```json
{ "idSituation": 2, "montant": 120000000.0, "idNature": 5, "idLocalite": "ANT" }
```
```json
{ "modeRecommande": 4, "modesAutorises": [ { "idMode": 4, "libelle": "Cotation" }, { "idMode": 2, "libelle": "AOR" } ], "modeNonDetermine": false }
```

---

## Seuils
**Ressource** `/api/seuils` — Référentiel : lecture ouverte ; écriture `ADMINISTRATEUR`.

**Champs `SeuilDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idSeuil | number | Oui (PK, au POST) | clé primaire |
| montantMin | number | Non | |
| montantMax | number | Non | |
| idNature | number | Oui | @NotNull |
| idLocalite | string | Oui | @NotBlank, max 5 |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/seuils | — | `SeuilDto[]` | 200 | Authentifié |
| GET | /api/seuils/{id} | — | `SeuilDto` | 200, 404 | Authentifié |
| POST | /api/seuils | `SeuilDto` | `SeuilDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/seuils/{id} | `SeuilDto` | `SeuilDto` | 200, 400, 404 | ADMINISTRATEUR |
| DELETE | /api/seuils/{id} | — | — | 204, 404 | ADMINISTRATEUR |

`{id}` = idSeuil (number).

**Exemple — requête**
```json
{ "idSeuil": 12, "montantMin": 0.0, "montantMax": 5000000.0, "idNature": 3, "idLocalite": "ANT" }
```

---

## Services bénéficiaires
**Ressource** `/api/service-beneficiaires` — Lecture / écriture : tout utilisateur authentifié.

**Champs `ServiceBeneficiaireDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idBenef | number | Oui (PK, au POST) | clé primaire |
| ancMontBenef | number | Non | |
| nouvMontBenef | number | Non | |
| soaCode | string | Non | max 15 |
| idDetail | number | Oui | @NotNull |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/service-beneficiaires | — | `ServiceBeneficiaireDto[]` | 200 | Authentifié |
| GET | /api/service-beneficiaires/{id} | — | `ServiceBeneficiaireDto` | 200, 404 | Authentifié |
| POST | /api/service-beneficiaires | `ServiceBeneficiaireDto` | `ServiceBeneficiaireDto` | 201, 400 | Authentifié |
| PUT | /api/service-beneficiaires/{id} | `ServiceBeneficiaireDto` | `ServiceBeneficiaireDto` | 200, 400, 404 | Authentifié |
| DELETE | /api/service-beneficiaires/{id} | — | — | 204, 404 | Authentifié |

`{id}` = idBenef (number).

**Exemple — requête**
```json
{ "idBenef": 4501, "ancMontBenef": 120000.0, "nouvMontBenef": 135000.0, "soaCode": "SOA-014", "idDetail": 88 }
```

---

## Sessions utilisateur
**Ressource** `/api/session-utilisateurs` — Données de sécurité (§3.8) : réservé à `ADMINISTRATEUR` pour **toutes** les opérations (lecture comprise).

**Champs `SessionUtilisateurDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idSession | string | Oui (PK, au POST) | clé primaire, max 100 |
| imControleur | string | Non | max 7 |
| dateConnexion | string (date-time) | Non | |
| dateDeconnexion | string (date-time) | Non | |
| ipAdresse | string | Non | max 45 |
| userAgent | string | Non | max 300 |
| succes | boolean | Non | |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/session-utilisateurs | — | `SessionUtilisateurDto[]` | 200, 403 | ADMINISTRATEUR |
| GET | /api/session-utilisateurs/{id} | — | `SessionUtilisateurDto` | 200, 403, 404 | ADMINISTRATEUR |
| POST | /api/session-utilisateurs | `SessionUtilisateurDto` | `SessionUtilisateurDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/session-utilisateurs/{id} | `SessionUtilisateurDto` | `SessionUtilisateurDto` | 200, 400, 403, 404 | ADMINISTRATEUR |
| DELETE | /api/session-utilisateurs/{id} | — | — | 204, 403, 404 | ADMINISTRATEUR |

`{id}` = idSession (string).

**Exemple — requête**
```json
{ "idSession": "SESS-2026-0007", "imControleur": "CTRMEM", "dateConnexion": "2026-06-11T08:32:17", "ipAdresse": "192.168.1.42", "userAgent": "Mozilla/5.0", "succes": true }
```

---

## Situations
**Ressource** `/api/situations` — Référentiel : lecture ouverte ; écriture `ADMINISTRATEUR`.

**Champs `SituationDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idSituation | number | Oui (PK, au POST) | clé primaire |
| libelle | string | Non | max 100 |
| description | string | Non | max 500 |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/situations | — | `SituationDto[]` | 200 | Authentifié |
| GET | /api/situations/{id} | — | `SituationDto` | 200, 404 | Authentifié |
| POST | /api/situations | `SituationDto` | `SituationDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/situations/{id} | `SituationDto` | `SituationDto` | 200, 400, 404 | ADMINISTRATEUR |
| DELETE | /api/situations/{id} | — | — | 204, 404 | ADMINISTRATEUR |

`{id}` = idSituation (number).

**Exemple — requête**
```json
{ "idSituation": 7, "libelle": "En attente de pièces", "description": "Dossier suspendu jusqu'à réception des justificatifs." }
```

---

## SOA bénéficiaires
**Ressource** `/api/soa-beneficiaires` — Lecture / écriture : tout utilisateur authentifié.

**Champs `SoaBeneficiaireDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| soaCode | string | Oui (PK, au POST) | clé primaire |
| libelle | string | Non | max 100 |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/soa-beneficiaires | — | `SoaBeneficiaireDto[]` | 200 | Authentifié |
| GET | /api/soa-beneficiaires/{id} | — | `SoaBeneficiaireDto` | 200, 404 | Authentifié |
| POST | /api/soa-beneficiaires | `SoaBeneficiaireDto` | `SoaBeneficiaireDto` | 201, 400 | Authentifié |
| PUT | /api/soa-beneficiaires/{id} | `SoaBeneficiaireDto` | `SoaBeneficiaireDto` | 200, 400, 404 | Authentifié |
| DELETE | /api/soa-beneficiaires/{id} | — | — | 204, 404 | Authentifié |

`{id}` = soaCode (string).

**Exemple — requête**
```json
{ "soaCode": "SOA-014", "libelle": "Service des opérations - Antananarivo" }
```

---

## Tranches
**Ressource** `/api/tranches` — Lecture / écriture : tout utilisateur authentifié.

**Champs `TrancheDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idTranche | number | Oui (PK, au POST) | clé primaire |
| lieuTrc | string | Non | max 100 |
| montTrc | number | Non | |
| idLot | number | Oui | @NotNull |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/tranches | — | `TrancheDto[]` | 200 | Authentifié |
| GET | /api/tranches/{id} | — | `TrancheDto` | 200, 404 | Authentifié |
| POST | /api/tranches | `TrancheDto` | `TrancheDto` | 201, 400 | Authentifié |
| PUT | /api/tranches/{id} | `TrancheDto` | `TrancheDto` | 200, 400, 404 | Authentifié |
| DELETE | /api/tranches/{id} | — | — | 204, 404 | Authentifié |

`{id}` = idTranche (number).

**Exemple — requête**
```json
{ "idTranche": 305, "lieuTrc": "Antananarivo - Analakely", "montTrc": 7500000.0, "idLot": 42 }
```

---

## Types de dossier
**Ressource** `/api/type-dossiers` — Référentiel : lecture ouverte ; écriture `ADMINISTRATEUR`.

**Champs `TypeDossierDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idTypeDossier | string | Oui (PK, au POST) | clé primaire, max 10 |
| libelleType | string | Non | max 100 |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/type-dossiers | — | `TypeDossierDto[]` | 200 | Authentifié |
| GET | /api/type-dossiers/{id} | — | `TypeDossierDto` | 200, 404 | Authentifié |
| POST | /api/type-dossiers | `TypeDossierDto` | `TypeDossierDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | /api/type-dossiers/{id} | `TypeDossierDto` | `TypeDossierDto` | 200, 400, 404 | ADMINISTRATEUR |
| DELETE | /api/type-dossiers/{id} | — | — | 204, 404 | ADMINISTRATEUR |

`{id}` = idTypeDossier (string).

**Exemple — requête**
```json
{ "idTypeDossier": "DAO", "libelleType": "Dossier d'appel d'offres" }
```

---

## Vérifications
**Ressource** `/api/verifications` — autorisation large à l'entrée, mais le **service exige strictement le profil `VERIFICATEUR`** (⚠️ règle ajoutée — **pas de délégation** CC/Président) ; DELETE : `ADMINISTRATEUR`. Écriture limitée à sa localité. Lecture filtrée par localité.

> ⚠️ **Identité & ID (règle ajoutée).** L'identité du vérificateur (`imCtrlVerif`) et la `dateVerif` sont **prises du JWT / serveur**, jamais du corps. L'`idVerification` est **auto-généré** (colonne IDENTITY) ; ne pas le fournir.

> **Préconditions de circuit (création/MAJ) → 403/409** : profil non `VERIFICATEUR` → **403** ; sinon le PV référencé (`idPv`) doit être **`SIGNE`** **et** d'avis **`FAVR`** (favorable avec réserves) **et** le dossier **non clos** → sinon **409**. La vérification est **itérative** sur le même dossier.

> **Effet `[Auto]`** (sur un dossier `EN_VERIFICATION`) : `obsLevees = true` → dossier **`CLOTURE`** + notification `CLOTURE_ELIGIBLE`. ⚠️ **Règle ajoutée** — `obsLevees = false` → dossier **`EN_ATTENTE_DECISION_PRMP`** : l'observation est **transmise à la PRMP** du dossier (notification `OBSERVATION_VERIFICATION` : référence dossier, vérificateur, texte de l'observation, date) et l'événement est **tracé** dans `t_audit_log`. Le vérificateur ne peut plus modifier ni soumettre de vérification tant que la PRMP n'a pas statué (nouvelle tentative → **409**) ; il voit le dossier en lecture seule dans `GET /api/dossiers/en-attente-prmp`. La PRMP le retrouve via `GET /api/dossiers?statut=EN_ATTENTE_DECISION_PRMP` et lit l'observation complète dans sa notification.

**Champs `VerificationDto`**

| Champ (JSON) | Type | Obligatoire | Contraintes |
|---|---|---|---|
| idVerification | number | Non (auto-généré) | ID serveur (IDENTITY) ; ignoré en entrée |
| idReception | number | Oui | @NotNull |
| idPv | number | Oui | @NotNull — PV `SIGNE` d'avis `FAVR` |
| imCtrlVerif | string | Non | max 7 — **ignoré** : identité = JWT (`CurrentUser.ref`) |
| dateVerif | string (date) | Non | **ignoré** : posée côté serveur (date du jour) |
| observation | string | Non | max 500 |
| obsLevees | boolean | Non | `true` → `CLOTURE` ; `false` → `EN_ATTENTE_DECISION_PRMP` + notif PRMP `OBSERVATION_VERIFICATION` + trace audit (si dossier `EN_VERIFICATION`) |
| motifRectif | string | — (sortie) | max 255 — motif de rectification PRMP, posé serveur à la resoumission ; **lecture seule** (visible côté vérificateur) |

**Endpoints**

| Méthode | URL | Corps | Réponse | Statuts | Rôle |
|---|---|---|---|---|---|
| GET | /api/verifications | — | `VerificationDto[]` | 200 | Authentifié (filtré) |
| GET | /api/verifications/{id} | — | `VerificationDto` | 200, 404 | Authentifié (filtré) |
| POST | /api/verifications | `VerificationDto` | `VerificationDto` | 201, 400, 403, 409 | VERIFICATEUR strict (service) |
| PUT | /api/verifications/{id} | `VerificationDto` | `VerificationDto` | 200, 400, 403, 404, 409 | VERIFICATEUR strict (service) |
| DELETE | /api/verifications/{id} | — | — | 204, 404 | ADMINISTRATEUR |

`{id}` = idVerification (number).

**Exemple — requête**
```json
{ "idVerification": 9012, "idReception": 5500, "idPv": 7321, "imCtrlVerif": "VERANT1", "dateVerif": "2026-06-11", "observation": "Observations levées", "obsLevees": true }
```
