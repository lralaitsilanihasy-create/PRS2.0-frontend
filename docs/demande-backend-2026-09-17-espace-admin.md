# Demande backend — Espace d'administration : compteurs, annuaire et journal des connexions

**Date** : 2026-09-17 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : lot 6 (espace
d'administration), plan `frontend/docs/plan-refonte-L6-espace-admin.md`, §4 et §6. Maquettes
`maquettes-design/admin/` — A (accueil) et C (annuaire) retenues par Mathieu le 17/09.

Cinq besoins, **indépendants les uns des autres**. B1 débloque l'accueil, B2 l'annuaire, B4 le journal
des connexions. B3 et B5 sont des ajustements courts.

---

## B1 — Compteurs de l'Administrateur : ce qui manque à l'accueil

### Constat

`KpiService.mesCompteursAdmin()` renvoie trois nombres (`CompteursAdminDto`) :
`inscriptionsEnAttente`, `comptes`, `journalAudit`. L'accueil de la maquette A en demande davantage,
et surtout **l'ancienneté de la plus vieille demande** — c'est elle qui dit s'il y a urgence, pas le
compte brut. Le nombre de **rattachements en attente** manque alors que son jumeau, les inscriptions,
est déjà compté.

### Demande

| | |
|---|---|
| Méthode et URL | `GET /api/kpis/badges` — **enrichir `CompteursAdminDto`, pas de route neuve** |
| Accès | inchangé (profil du connecté) |
| Corps | aucun ; lecture seule, **sans migration** |

Champs ajoutés à `CompteursAdminDto` :

| Champ | Type | Source |
|---|---|---|
| `rattachementsEnAttente` | `long` | demandes de rattachement PRMP⇄entité non décidées |
| `inscriptionDoyenneLe` | `LocalDateTime` (nullable) | date de la plus ancienne inscription en attente |
| `rattachementDoyenLe` | `LocalDateTime` (nullable) | idem pour les rattachements |
| `comptesActifs` | `long` | `t_compte_auth.ACTIF = true` — c'est ce booléen que le login consulte |
| `comptesSuspendus` | `long` | comptes validés puis **fermés** : `STATUT = ACTIF` avec `ACTIF = false` |
| `mandatsExpirantSous30j` | `long` | mandats PRMP dont la fin tombe dans les 30 jours |

La **forme** des champs existants est **conservée telle quelle** : le front lit déjà
`inscriptionsEnAttente` pour la pastille du menu, et `BadgesDto` est partagé avec les neuf autres
profils.

> ⚠️ **Deux précisions arrêtées à la livraison (17/09), qui corrigent ce qui était écrit ci-dessus.**
>
> 1. **`comptesSuspendus` ne compte pas les inscriptions refusées.** L'énuméré `StatutCompte` n'a pas
>    de valeur `DESACTIVE` : `desactiver` ne touche que le booléen `ACTIF` en laissant `STATUT` à
>    `ACTIF`, tandis qu'un refus écrit `STATUT = REFUSE`. Les deux cas sont donc distinguables, et ils
>    le restent : un compte fermé après coup n'est pas une inscription jamais ouverte, et cette tuile
>    est une mesure de sécurité — y verser les refus la gonflerait. Les inscriptions refusées se
>    retrouvent dans l'annuaire, sous `statut=REFUSE`.
> 2. **`inscriptionsEnAttente` change de périmètre : PRMP *et* UGPM**, là où il ne comptait que les
>    PRMP. C'est ce que liste l'écran qu'il annonce (`GET /api/inscriptions/en-attente` rend l'union
>    des deux types). Un badge affichant 5 au-dessus d'une liste de 7 est le défaut même que ce lot
>    corrige. `inscriptionDoyenneLe` suit la même file. **Conséquence pour le front** : ce nombre peut
>    augmenter sans qu'aucune inscription n'ait été déposée — ce sont les UGPM jusqu'ici invisibles.

> `sessionsOuvertes` et `echecsConnexion24h` ne sont **pas** demandés ici : ils dépendent de B4. Tant
> que B4 n'est pas livré, l'accueil n'affiche pas ces deux tuiles (plan §6).

---

## B2 — Annuaire : chercher une personne, quel que soit son type

### Constat

L'administrateur cherche « quelqu'un » : un contrôleur, une PRMP, une UGPM. Aujourd'hui ces trois
populations vivent dans trois écrans et trois endpoints (`/api/controleurs`, `/api/prmps`,
`/api/ugpms`), avec des identifiants de longueurs différentes (`IM_CONTROLEUR` 7, `ID_PRMP` 10) et
des champs qui ne se recouvrent pas. Il n'existe aucune façon de répondre à « qui est
`m.rakotomalala` ? » ou « qui est rattaché à la DGCF ? » sans interroger les trois et recoller à la
main côté front — ce que la maquette C refuse par principe.

La liste veut aussi le **statut du compte** (actif, suspendu, en attente, jamais connecté), qui vit
dans `t_compte_auth`, pas dans les tables de personnes.

### Demande

| | |
|---|---|
| Méthode et URL | `GET /api/annuaire?q=&type=&profil=&localite=&statut=&page=&size=` |
| Accès | `hasRole('ADMINISTRATEUR')` — écran d'administration, rien de moins |
| Réponse | `200 Page<AnnuairePersonneDto>` ; `401` anonyme ; `403` autre profil |
| Corps | aucun ; lecture seule, **sans migration** |

`AnnuairePersonneDto` :

| Champ | Type | Remarque |
|---|---|---|
| `ref` | `String` | `IM_CONTROLEUR` ou `ID_PRMP` ou l'identifiant UGPM |
| `type` | `String` | `CONTROLEUR` · `PRMP` · `UGPM` |
| `nom`, `prenoms` | `String` | |
| `profil` | `String` (nullable) | le profil du contrôleur ; null pour PRMP et UGPM |
| `localite` | `String` (nullable) | la PRMP n'en a pas (`PrmpDto` ne porte plus `idLocalite`) |
| `entite` | `String` (nullable) | entité de rattachement, pour PRMP et UGPM |
| `login` | `String` (nullable) | null si aucun compte |
| `statutCompte` | `String` | `ACTIF` · `SUSPENDU` · `REFUSE` · `EN_ATTENTE` · `SANS_COMPTE` |

`q` cherche sur nom, prénoms, référence, login **et entité de rattachement**, **sans tenir compte de
la casse ni des accents**.

> ⚠️ **Deux précisions arrêtées à la livraison (17/09).**
>
> 1. **`q` couvre aussi l'entité**, alors que cette demande ne citait que nom, prénoms, référence et
>    login. C'est un sur-ensemble — aucun résultat n'est perdu — et c'est ce que promet le champ de
>    recherche de la maquette C (« Rechercher une personne, un matricule, un login, une entité… ») :
>    sans lui, « qui est rattaché à la DGCF ? », la question posée en tête de ce besoin, resterait
>    sans réponse. Pour une UGPM, l'entité est celle de sa **PRMP de tutelle** (elle n'en a pas en
>    propre), si bien qu'une recherche sur une entité rend la PRMP **et** ses UGPM.
> 2. **`statutCompte` distingue `SUSPENDU` de `REFUSE`** au lieu du `DESACTIVE` unique demandé :
>    un compte fermé après validation et une inscription rejetée sont deux histoires sans rapport, et
>    la base les distingue (cf. §B1). Le filtre `?statut=` accepte les cinq valeurs ; `DESACTIVE`
>    n'existe pas et part en **400**.
>
> `localite` porte le **code** (`ID_LOCALITE`, ex. `ANT`), pas le libellé : c'est ce que le reste de
> l'API expose et ce que le filtre attend ; l'écran compose « ANT — Centrale » avec le référentiel des
> localités qu'il charge déjà.

### Options écartées

- *Trois appels côté front, recollés à l'affichage* : la pagination et le tri deviennent faux dès que
  les trois populations se mélangent, et le filtre par statut de compte oblige un quatrième appel.
- *Une vue SQL matérialisée* : trois tables qui bougent peu, une jointure suffit ; une vue ajoute une
  migration et un objet à maintenir pour un gain nul à cette volumétrie.

---

## B3 — Fiche d'annuaire : la dernière connexion et le compte, sur la personne

### Demande

| | |
|---|---|
| Méthode et URL | `GET /api/annuaire/{type}/{ref}` |
| Accès | `hasRole('ADMINISTRATEUR')` |
| Réponse | `200 AnnuaireFicheDto` ; `404` référence inconnue |

Réunit ce que la fiche de la maquette C affiche, et **rien de plus** : l'identité et le compte (login,
statut, date d'activation), la place dans l'organisation (supérieur, transversal, chaîne de contrôle,
délégation en cours, mandat pour une PRMP), et le nombre d'actions au journal sur 30 jours.

`derniereConnexion` et `echecs30j` sont servis **null tant que B4 n'est pas livré** ; le front ne les
affiche pas dans ce cas (plan §6).

---

## B4 — Journal des connexions : alimenter la table qui existe

### Constat

Aucune connexion n'est tracée durablement, nulle part :

- `AuditConfig.java:23` **exclut** `/api/auth/**` du journal d'audit — aucune connexion n'y entre ;
- `t_session_utilisateur` n'est écrite par **aucun code applicatif** : le seul
  `new SessionUtilisateur()` du backend est dans `SessionUtilisateurMapper`, c'est-à-dire alimenté par
  le CRUD générique lui-même. La table est vide en exploitation, et l'écran qui l'expose est
  *modifiable* : un administrateur peut y écrire une fausse trace de connexion ;
- les échecs ne vivent que dans les `ConcurrentHashMap` de `LoginRateLimiter`, perdus à chaque
  redémarrage ;
- `t_audit_log.SESSION_ID` porte pourtant une clé étrangère vers
  `t_session_utilisateur(ID_SESSION)` (`V1__baseline.sql:3017`) : le schéma prévoyait que chaque
  action pointe vers sa session. Cette FK est morte depuis la baseline.

### Demande

**1. Écrire la session au login et au logout.**

| Moment | Écriture |
|---|---|
| `POST /api/auth/login` réussi | ligne neuve : `ID_SESSION`, référence de l'acteur, `DATE_CONNEXION`, IP, user-agent, `SUCCES = true` |
| `POST /api/auth/login` échoué | ligne neuve avec `SUCCES = false` et l'identifiant **tenté** — c'est la ligne qui manque le plus |
| `POST /api/auth/logout` | `DATE_DECONNEXION` sur la session du cookie |

**2. Migration `V29` — la colonne ne peut pas recevoir tous les acteurs.**
`t_session_utilisateur.IM_CONTROLEUR` est en `varchar(7)` alors qu'un `ID_PRMP` en fait **10** : c'est
exactement le défaut **C3** de l'audit du 14/09, sur une autre colonne. Sans migration, aucune
connexion de PRMP ni d'UGPM ne peut s'écrire. La colonne passe à `varchar(10)`, et la FK vers
`t_controleur` doit être revue puisqu'elle ne vaudra plus pour tous les acteurs.

> ⚠️ **À embarquer dans la même `V29` (relevé à la livraison de B1, 17/09) : une vraie date de demande
> sur `t_compte_auth`.** La table ne porte **aucune** date de dépôt — seulement `DATE_DECISION`,
> renseignée quand l'Administrateur tranche, donc jamais pour une inscription en attente. B1 ayant
> interdit toute migration, `inscriptionDoyenneLe` est aujourd'hui **dérivée** de
> `t_piece_jointe.DATE_DEPOT` (la première pièce, écrite dans la même transaction que l'inscription ;
> à défaut, la première déclaration d'entité). C'est exact mais fragile : la dérivation tombe si une
> inscription est un jour créée sans pièce, et elle repose sur une coïncidence de transaction, pas sur
> une donnée. `V29` doit donc ajouter `DATE_DEMANDE` (ou équivalent) à `t_compte_auth` et la renseigner
> à l'inscription ; `KpiService.inscriptionDoyenneLe` sera alors remplacé par une simple lecture.

**3. Route de lecture seule.**

| | |
|---|---|
| Méthode et URL | `GET /api/sessions?acteur=&succes=&du=&au=&page=&size=` |
| Accès | `hasRole('ADMINISTRATEUR')` |
| Réponse | `200 Page<SessionDto>` |
| Écriture | **aucune** — ni `POST`, ni `PUT`, ni `DELETE`. Le CRUD générique actuel (`/api/session-utilisateurs`) est retiré. |

**4. Deux compteurs pour l'accueil**, une fois la table alimentée : `sessionsOuvertes`
(`DATE_DECONNEXION` nulle et connexion de moins de 12 h) et `echecsConnexion24h`, ajoutés à
`CompteursAdminDto` de B1.

### Option écartée

*Retirer l'exclusion d'`/api/auth/**` du journal d'audit.* Trois raisons : une ligne d'audit décrit
une **écriture** (table, enregistrement, champ, avant/après) là où une session décrit une **durée** ;
l'intercepteur ignore tout ce qui renvoie ≥ 400, donc les échecs — précisément ce qu'on veut voir —
seraient perdus ; et la table comme sa FK existent déjà, il n'y a rien à concevoir.

---

## B5 — Journal d'audit : filtrer sur plusieurs tables

### Constat

`GET /api/audit-logs?page=` accepte `table`, `acteur`, `du`, `au`. Le bloc « Derniers changements de
paramétrage » de l'accueil a besoin des écritures sur **l'ensemble** des tables de réglage
(délais standards, seuil AGPM, points de contrôle, règles d'alerte, règles d'anomalie, chaînes de
contrôle) — soit six appels aujourd'hui, pour afficher quatre lignes.

### Demande

`table` accepte une **liste** : `?table=t_delai_standard&table=t_points_ctrl&…` (paramètre répété,
`List<String>`), ou une chaîne séparée par des virgules — au choix du backend. Le comportement à une
seule valeur est inchangé.

---

## Récapitulatif

| # | Objet | Migration | Bloque |
|---|---|---|---|
| B1 | Compteurs de l'Administrateur enrichis | non | L6-F2 (accueil) |
| B2 | `GET /api/annuaire` | non | L6-F3 (annuaire) |
| B3 | `GET /api/annuaire/{type}/{ref}` | non | L6-F3 (fiche) |
| B4 | Sessions alimentées, `varchar(10)`, lecture seule | **oui, V29** | L6-F5 et 3 tuiles de l'accueil |
| B5 | `table` en liste sur le journal d'audit | non | un bloc de l'accueil |
