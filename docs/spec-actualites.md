# Spécification — Actualités affichées à l'ouverture de session

> Demande fonctionnelle du 2026-08-18. **Rien n'existe encore côté serveur** (aucune entité, aucun
> endpoint, aucun paramètre système) : ce document est la demande adressée au backend `PRS20`. Le
> front ne peut être livré qu'une fois ce contrat disponible.

## 1. Besoin

Un **modal d'actualités** s'affiche automatiquement, en surimpression, à chaque ouverture de session
d'un utilisateur **ciblé par son profil**. Il présente une mini-page façon lettre d'information
(blocs de texte + images), éditable par l'Administrateur **sans redéploiement**, et se ferme
manuellement. Un **interrupteur global** permet de couper la fonctionnalité d'un coup.

## 2. Décisions de conception (arbitrées le 2026-08-18)

| Point | Décision | Raison |
|---|---|---|
| Format du texte | **Markdown**, stocké tel quel | Aucun HTML n'est injecté dans la page : la surface XSS soldée par l'audit du 16-17/08 ne se rouvre pas, même si un compte administrateur était compromis. |
| Images | **JPEG uniquement**, **≤ 10 Mo** à l'envoi, **redimensionnées au serveur** (largeur max conseillée 1600 px) | « Sans limite » n'est pas tenable : Spring plafonne par défaut à 1 Mo, et une photo de plusieurs dizaines de Mo saturerait la mémoire et ralentirait l'ouverture du modal pour **tous** les utilisateurs ciblés, à **chaque** connexion. |
| Suppression | **Archivage logique**, jamais de suppression physique | Demande explicite : les actualités désactivées ou expirées restent consultables dans un onglet « Historique ». |
| Fréquence | À **chaque** connexion de l'utilisateur ciblé | Demande explicite. Aucun « ne plus afficher » n'est prévu à ce stade. |

## 3. Modèle de données proposé

- **`t_actualite`** — `ID_ACTUALITE` (IDENTITY), `TITRE` (non vide), `CONTENU_MD` (markdown, texte
  long), `STATUT` (`ACTIF` | `INACTIF` | `ARCHIVE`), `DATE_PUBLICATION` (date, nullable = immédiat),
  `DATE_EXPIRATION` (date, nullable = sans terme), `DATE_CREATION`, `IM_AUTEUR`, `DATE_ARCHIVAGE`,
  `IM_ARCHIVEUR`.
- **`t_actualite_profil`** — couple (`ID_ACTUALITE`, `ID_PROFIL`). Une actualité vise **un ou
  plusieurs** profils parmi les neuf existants (`PRMP`, `UGPM`, `SECRETAIRE`, `PRESIDENT`,
  `CHEF_COMMISSION`, `MEMBRE`, `VERIFICATEUR`, `ASSISTANT_CONTROLEUR`, `PUBLICATION`,
  `ADMINISTRATEUR`). Aucun profil ciblé ⇒ l'actualité n'est visible de personne (jamais « tous »
  implicitement : le ciblage doit être un acte délibéré).
- **`t_actualite_image`** — `ID_IMAGE`, `ID_ACTUALITE`, `NOM_FICHIER`, `FORMAT`, `TAILLE`,
  `SHA_256`, `CONTENU` (`bytea`), `ORDRE` (position dans la mini-page). Même approche que
  `t_piece_demande_retrait`.
- **Paramètre global** — `t_parametre` (`CLE`, `VALEUR`, `DATE_MAJ`, `IM_ACTEUR`) avec la clé
  `ACTUALITES_ACTIVES` (`true` | `false`). Une table de paramètres généraux servira au-delà de ce
  besoin ; à défaut, une colonne dédiée conviendrait.

## 4. Endpoints attendus

| Méthode | Chemin | Corps | Réponse | Codes | Accès |
|---|---|---|---|---|---|
| GET | `/api/actualites/mes-actualites` | — | `ActualiteDto[]` | 200 | Authentifié |
| GET | `/api/actualites` | — | `ActualiteDto[]` | 200, 403 | ADMINISTRATEUR |
| GET | `/api/actualites/{id}` | — | `ActualiteDto` | 200, 403, 404 | ADMINISTRATEUR |
| POST | `/api/actualites` | `ActualiteDto` | `ActualiteDto` | 201, 400, 403 | ADMINISTRATEUR |
| PUT | `/api/actualites/{id}` | `ActualiteDto` | `ActualiteDto` | 200, 400, 403, 404 | ADMINISTRATEUR |
| DELETE | `/api/actualites/{id}` | — | — | 204, 403, 404 | ADMINISTRATEUR — **archive**, ne supprime pas |
| POST | `/api/actualites/{id}/images` | `multipart` (`fichier`) | `ActualiteImageDto` | 201, 400, 403, 413 | ADMINISTRATEUR |
| GET | `/api/actualites/{id}/images/{idImage}` | — | binaire (`image/jpeg`) | 200, 403, 404 | Authentifié |
| DELETE | `/api/actualites/{id}/images/{idImage}` | — | — | 204, 403, 404 | ADMINISTRATEUR |
| GET | `/api/parametres/actualites-actives` | — | `{ "actif": boolean }` | 200 | Authentifié |
| PUT | `/api/parametres/actualites-actives` | `{ "actif": boolean }` | `{ "actif": boolean }` | 200, 403 | ADMINISTRATEUR |

### `ActualiteDto`

| Champ | Type | Entrée | Note |
|---|---|---|---|
| idActualite | number | Non (auto) | IDENTITY, ignoré en entrée |
| titre | string | **Oui** | `@NotBlank` |
| contenuMd | string | **Oui** | Markdown brut. **Aucun HTML n'est accepté ni renvoyé.** |
| profilsCibles | string[] | **Oui** | Au moins un profil (400 si vide ou profil inconnu) |
| statut | string | Non | Forcé `INACTIF` à la création ; `ACTIF`/`INACTIF` par le PUT ; `ARCHIVE` par le DELETE seul |
| datePublication | date | Non | `null` = visible dès activation |
| dateExpiration | date | Non | `null` = sans terme ; antérieure à `datePublication` → 400 |
| images | `ActualiteImageDto[]` | Non | Lecture seule (peuplé serveur), ordre inclus |
| dateCreation / imAuteur | — | Non | Serveur |
| dateArchivage / imArchiveur | — | Non | Serveur |

### Règle de visibilité (`/mes-actualites`)

Une actualité est renvoyée si **toutes** les conditions tiennent :

1. le paramètre `ACTUALITES_ACTIVES` vaut `true` — sinon la liste est **vide** ;
2. `statut = ACTIF` ;
3. le **profil de l'utilisateur authentifié** (JWT/cookie, jamais un paramètre client) figure dans
   ses profils cibles ;
4. `datePublication` est nulle ou passée, **et** `dateExpiration` est nulle ou non atteinte.

⚠️ Le filtrage est **entièrement serveur**. Le front ne doit jamais recevoir une actualité qu'il
devrait masquer lui-même : masquer côté écran n'autorise rien, conformément à la règle du projet.

⚠️ **Expiration = archivage.** Une actualité dont la `dateExpiration` est atteinte doit basculer en
`ARCHIVE` (tâche planifiée ou calcul à la lecture, au choix du backend) afin d'apparaître dans
l'onglet « Historique » sans intervention manuelle.

### Upload d'image

Mêmes garanties que la lettre de demande de retrait (règle du 2026-08-17) : **`multipart/form-data`**,
partie `fichier`, **JPEG obligatoire validé par magic-bytes** (`FF D8 FF`, jamais le `Content-Type`
déclaré), **10 Mo maximum** (413 au-delà), SHA-256 stocké. Le serveur **redimensionne** avant
stockage. `spring.servlet.multipart.max-file-size` et `max-request-size` sont à relever en
conséquence.

## 5. Ce que fera le front (une fois l'API livrée)

1. `models/actualite.model.ts` — interfaces `Actualite`, `ActualiteImage`.
2. `services/actualite.services.ts` — `ActualiteService` (dérivé de `CrudService`) + le paramètre
   global.
3. `shared/actualites/actualites-modal.ts` — le modal : directive `appModale` (focus, Échap, piège
   de Tab), fermeture au clic extérieur, animations d'ouverture/fermeture communes, rendu markdown
   **sans injection HTML**, images servies via `urlBlobSure()`.
4. Branchement dans `layout/main-layout` — une seule interrogation par session, après connexion,
   sans retarder l'affichage de l'écran d'atterrissage.
5. `features/admin/actualites/` — CRUD complet : liste, formulaire (titre, markdown avec aperçu,
   profils cibles, dates, statut), gestion des images, interrupteur global, onglet « Historique »
   des actualités archivées ou expirées.

## 6. Points ouverts pour le backend

- **Ordre d'affichage** de plusieurs actualités simultanées : par `datePublication` décroissante
  (proposition) ou champ d'ordre explicite ?
- **Volume** : une pagination est-elle utile sur `/api/actualites` (vue Administrateur) ?
- **Journalisation** : les créations, activations et archivages entrent-ils dans `t_audit_log` ?
  (Souhaitable : une annonce est un acte de communication institutionnelle.)
