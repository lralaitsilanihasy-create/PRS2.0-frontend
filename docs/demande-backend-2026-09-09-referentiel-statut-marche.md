# Demande backend — Référentiel administrable des STATUTS DE MARCHÉ

**Date** : 2026-09-09 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : demande pilote — sur la
grille de saisie d'un dossier (création), afficher une **colonne « Statut »** par ligne de marché, dont les
valeurs sont **administrables au niveau Profil Admin**.

## Constat côté front

- `Marche.statut` est aujourd'hui une **chaîne libre** (`String`), avec une **seule valeur par défaut codée
  en dur : `"PREVU"`** (posée à l'import et au mapping du payload). Le champ est transporté au serveur mais
  n'est ni affiché ni saisi.
- Il n'existe **aucun référentiel** de statuts de marché (ni table, ni endpoint). Impossible donc de
  proposer une liste administrable côté UI.

## Demande — un référentiel simple, comme les autres

Créer un référentiel **Statut de marché** exposé en CRUD, sur le **même moule** que les référentiels
existants (`natures`, `mode-passations`, `type-dossiers`, `sous-type-dossiers`…) : lecture ouverte aux
profils authentifiés (la PRMP en a besoin pour peupler la liste déroulante de la grille), **écriture réservée
à l'Admin** (capacité `REFERENTIEL_WRITE`, comme les autres référentiels).

### Contrat proposé (à ajuster si besoin, mais merci de figer les noms)

- **Endpoint** : `/api/statut-marches` — `GET` (liste), `GET /{code}`, `POST`, `PUT /{code}`,
  `DELETE /{code}`.
- **Ressource / DTO** (PK = **code string**, cohérent avec l'actuel `Marche.statut = "PREVU"`) :

  ```jsonc
  {
    "code": "PREVU",          // PK, string courte en MAJUSCULES (identifiant stable)
    "libelle": "Prévu",       // libellé affiché
    "ordre": 1,                // optionnel : ordre d'affichage dans la liste déroulante
    "actif": true              // optionnel : masquer une valeur sans la supprimer (garde l'historique)
  }
  ```

- **Garde d'écriture** : `POST/PUT/DELETE` réservés `REFERENTIEL_WRITE` (403 sinon), lecture ouverte.
- **Suppression** : refuser (409) la suppression d'un `code` **référencé** par au moins un marché (intégrité),
  ou privilégier `actif=false`. À votre main.

### Lien avec `t_marche.STATUT`

- `Marche.statut` **continue de stocker le `code`** (string) — pas de changement de type. La valeur devient
  un **code du référentiel** au lieu d'une chaîne libre.
- **Validation** souhaitée à l'écriture d'un marché (`POST/PUT /api/saisies/ppm…`, `PUT /api/marches/{id}`) :
  `statut` doit être un **code existant** (et `actif`) du référentiel ; **`null`/absent → défaut serveur**
  (voir ci-dessous). 400 explicite si code inconnu — au même titre que la garde `formeMarche`.
- **Défaut** : à omission, le serveur applique un statut **par défaut**. Proposition : un `code` marqué par
  défaut dans le référentiel, sinon `"PREVU"`. Merci de préciser la règle retenue (le front alignera son
  défaut dessus, il en pose un aujourd'hui en dur = `"PREVU"`).

### Seed

- Au minimum **`PREVU` / « Prévu »** pour que les données existantes restent valides (tous les marchés
  actuels portent `"PREVU"`).
- Les autres valeurs métier (le workflow réel d'un marché : lancé, attribué, etc.) seront **saisies par
  l'Admin** via l'écran de gestion — sauf si vous préférez seeder une liste initiale : dites-nous laquelle
  et on s'aligne.

## Côté front — ce que je ferai à la livraison (aucun endpoint inventé en attendant)

1. Modèle `StatutMarche { code, libelle, ordre?, actif? }` + `StatutMarcheService extends CrudService<…,string>`
   (`resource = 'statut-marches'`).
2. **Écran Admin** « Statuts de marché » : une entrée dans `admin-resources.config.ts` (slug `statut-marches`,
   champs `code` (PK) + `libelle`) → route `referentiels/statut-marches` + lien de menu **auto-générés**,
   garde `REFERENTIEL_WRITE`.
3. **Colonne « Statut »** dans la grille partagée `ppm-saisie-grid` : une liste déroulante par ligne, liée au
   form control `statut` déjà présent, peuplée par le référentiel (valeurs `actif`, triées par `ordre`).
   Défaut aligné sur la règle serveur. Remplace le `"PREVU"` en dur des 3 emplacements front.
4. Contre-recette réelle : création d'un dossier en choisissant un statut par ligne → vérifier le `statut`
   posté et relu ; écran Admin (ajout/édition d'un statut, 403 hors Admin).

## Contre-recette attendue (backend)

1. `GET /api/statut-marches` → liste (au moins `PREVU`).
2. `POST` d'un statut par un **non-Admin** → **403** ; par Admin → 201.
3. `POST /api/saisies/ppm` avec un `statut` **inconnu** → **400** (code invalide) ; avec un code valide → 201,
   `statut` relu = code choisi ; sans `statut` → défaut serveur.
4. `DELETE` d'un statut référencé par un marché → **409** (ou désactivation `actif=false`).
