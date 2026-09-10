# Demande backend — Ouvrir la création d'entité / ministère à l'UGPM (à l'import)

**Date** : 2026-09-10 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : constat pilote — une
**UGPM** (`UGPM002`, « RALAITSILANIHASY Lantonirina Annick », tutelle **PRMP `IMP001`**) importe un PPM
dont l'entité (« JIRO SY RANO MALAGASY ») **et** le ministère (« Ministère de l'Énergie et des
Hydrocarbures / MEH ») sont **absents du référentiel**. L'écran de saisie lui propose de les enregistrer,
mais le clic sur *Enregistrer le ministère* / *Enregistrer l'entité* renvoie **403 « Action non autorisée :
rôle ou périmètre de localité insuffisant »**.

## Constat

Le panneau de résolution d'entité de l'écran de saisie (`soumettre-dossier`) offre trois écritures de
référentiel, aujourd'hui **ouvertes à la PRMP uniquement** :

| Geste | Endpoint | Rôle actuel |
|---|---|---|
| Nouveau ministère | `POST /api/ministeres` | PRMP → **UGPM = 403** |
| Organigramme actif du ministère | `POST /api/organigrammes` | PRMP → **UGPM = 403** |
| Nouvelle entité contractante | `POST /api/entite-contracts` | PRMP → **UGPM = 403** |

La création d'entité crée par ailleurs un **rattachement PRMP↔entité en attente** (`actif=false`),
**activé par l'ADMIN** (écran « Rattachements en attente ») : l'entité n'est sélectionnable qu'après cette
approbation.

## Décision pilote — ouvrir ces créations à l'UGPM

Le pilote a tranché : **l'UGPM doit pouvoir créer entité / ministère / organigramme à l'import**, comme la
PRMP.

**Pourquoi c'est cohérent avec « l'UGPM saisit, la PRMP engage »** (règle du 2026-08-26, reconfirmée le
2026-08-08, commit `e9db492`) : créer une entité absente du référentiel est un acte de **saisie** —
préparer le dossier avant dépôt —, **pas** un acte d'engagement formel. Il reste de surcroît **borné par
l'approbation ADMIN** (rattachement `actif=false` tant que l'ADMIN n'a pas validé). On n'ouvre donc **pas**
la soumission : `/soumettre`, `/resoumettre`, `/transmettre-complements*` **restent `hasRole('PRMP')`**.
L'UGPM prépare (y compris le référentiel manquant, sous filet ADMIN) ; la PRMP engage.

## Demande

1. **Ouvrir au rôle `UGPM`** (en plus de `PRMP`) les trois écritures :
   `POST /api/ministeres`, `POST /api/organigrammes`, `POST /api/entite-contracts`.
   Tout le reste inchangé (validation des champs, PK client, catégorie, localité…).

2. **Cible du rattachement auto en attente**, quand c'est une **UGPM** qui crée l'entité : le rattachement
   `actif=false` doit cibler la **PRMP de tutelle de l'UGPM** (celle sous l'autorité de laquelle elle
   saisit — `IMP001` pour `UGPM002`), **pas** l'UGPM elle-même. Ainsi, après approbation ADMIN, l'entité
   entre dans le **périmètre de la PRMP** et devient sélectionnable par la PRMP **et** par ses UGPM (qui
   listent les entités de leur tutelle, cf. `GET` entités de la PRMP courante).
   La tutelle est dérivable côté serveur comme pour le journal (`UGPM002` → unité `303230` → PRMP `IMP001`)
   — le front n'envoie aucun identifiant de PRMP dans le payload de création.

3. **Rien d'autre ne bouge.** Le message 403 « rôle ou périmètre de localité insuffisant » ne doit plus se
   produire sur ces trois POST pour une UGPM ; il reste légitime pour les autres rôles/gestes.

## Côté front — rien à changer

Le panneau de création (`soumettre-dossier.ts`, blocs « ➕ Enregistrer une nouvelle entité / Nouveau
ministère ») **n'est pas conditionné au rôle** : il est déjà visible pour l'UGPM. Dès que le 403 est levé,
le parcours fonctionne de bout en bout sans adaptation. Je mettrai simplement à jour, après livraison, les
commentaires qui mentionnent « ouvert PRMP » en « PRMP + UGPM ».

## Recette de contre-vérification

1. Login **UGPM** (`UGPM002` / `Test@1234`). Importer un PPM dont l'entité est absente du référentiel.
2. « ➕ Enregistrer une nouvelle entité » → « ➕ Nouveau ministère » → remplir (libellé, sigle, organigramme
   dérivé, localité) → *Enregistrer* : **200** attendu (plus aucun 403).
3. Vérifier en base / API que le **rattachement** créé est `actif=false` et cible la **PRMP de tutelle**
   (`IMP001`), pas l'UGPM.
4. Login **ADMIN** → écran « Rattachements en attente » → approuver.
5. L'entité devient **sélectionnable** — à vérifier côté **PRMP** (`PRMP001`) **et** côté **UGPM**
   (`UGPM002`) sur l'écran de saisie.
