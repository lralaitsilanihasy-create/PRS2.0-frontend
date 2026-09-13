# Demande backend — Servir les ACTEURS DES ÉTAPES du circuit sur le DTO dossier

> ✅ **CLÔTURÉE le 13/09** — backend livré `bbc4059` (poussé sur `origin/main`, CI verte, run
> 34761469901) : `DossierDto.acteursEtapes` aux 7 clés toujours présentes (noms nus « Prénoms Nom »,
> `null` si non franchie), sur le détail et les listes. Invariant nommé ⇔ daté **par construction** :
> une seule méthode dérive les deux cartes depuis le même passage, `datesEtapes` n'en est plus qu'un
> raccourci. `DISPATCH` = attributaire courant, réattributions comprises (le passage DISPATCH du
> chronométrage reste au nom du dispatcheur, `ed86707` — divergence documentée côté backend, consigne
> de ne pas recopier `nomActeur`). `PV_SIGNE` lu sur le PV, parts effectivement signées (un CC du
> circuit non signataire n'y figure pas — testé). Aucun N+1 : test au compteur d'ordres SQL (1 puis
> 4 dossiers complets, même nombre). Président « toutes localités » et PRMP (`GET /api/dispatchs`
> vide) testés sur la liste. Deux choix dégradés assumés, l'invariant primant sur un `null` : sans
> attributaire connu sous un statut ayant franchi DISPATCH (circuit purgé), la clé prend l'auteur du
> passage ; PV `SIGNE` sans aucune part datée (données anciennes) → acteur du passage qui date la clé.
> **Front branché dans le même lot** : DTO prioritaire, repli clé par clé sur la jointure locale
> (même schéma que `datesEtapes`), préfixes de phrase (« Attribué à … ») côté front.

**Date** : 2026-09-13 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : demande pilote —
au survol de chaque point de la frise du circuit (« Tous les dossiers », tous profils), une
infobulle doit donner **le nom de l'acteur de l'étape** (Réception, Dispatch, Examen, Projet PV,
PV signé, Vérification, Clôture).

Demande **sœur** de `demande-backend-2026-09-07-dates-etapes-dossier.md` (`datesEtapes`) : même
champ de forme, même dérivation en lot, même règle de franchissement. Les deux doivent rester
cohérents entre eux — voir l'invariant ci-dessous.

## Constat

Le front dérive aujourd'hui l'acteur de chaque étape **par jointure** des listes `receptions` /
`dispatchs` / `examens` / `pvs` / `verifications`, puis résout les matricules en noms via le
référentiel des contrôleurs. Exactement la limite qu'avaient les dates avant `datesEtapes` : selon
la PORTÉE du profil, ces listes reviennent **vides** — au Président (« toutes localités »),
`GET /api/dispatchs` et `GET /api/examens` répondent `[]` — la frise n'a alors **aucune infobulle**
sur ces points, alors que ses dates, elles, sont bien servies par `datesEtapes`.

Le **chronométrage** porte déjà l'acteur de chaque passage (`PassageEtape.imActeur` +
`nomActeur` « prénoms nom » résolu serveur) et est déjà résolu **en lot** pour `datesEtapes` /
`dateEnregistrement` / `datePrevisionnelleFin` (`ChronometrageService`, sans N+1).

## Demande

Ajouter au DTO dossier (mêmes listes que `datesEtapes`, même méthode de lot) :

- **`acteursEtapes`** : objet `{ [étape]: nom | null }`, **les 7 clés toujours présentes** (clés du
  front : `RECEPTION`, `DISPATCH`, `EXAMEN`, `PROJET_PV`, `PV_SIGNE`, `VERIFICATION`, `CLOTURE`),
  chaque valeur = le **nom affichable** de l'acteur (« prénoms nom », comme `PassageEtape.nomActeur`),
  `null` si l'étape n'est pas franchie. Résolution **en lot**, aucun N+1 — depuis les **mêmes tâches**
  déjà chargées pour `datesEtapes`.

### Règle : même franchissement, même tâche que la date

L'acteur d'une clé vient de **la tâche dont `datesEtapes` prend la date**. Le franchissement se juge
sur le STATUT (règle affinée de `datesEtapes`, `d364f1a`) : un dispatch annulé ou un réexamen remet
l'acteur à `null` comme il remet la date à `null`.

**Invariant à garantir** : pour chaque clé `k`, `acteursEtapes[k] != null` ⇔ `datesEtapes[k] != null`.
Une date sans acteur, ou un acteur sans date, est un bug.

| Clé | Acteur servi | Source |
|---|---|---|
| `RECEPTION` | le Secrétaire qui a enregistré | acteur de la clôture de `RECEPTION` |
| `DISPATCH` | ⚠️ **l'ATTRIBUTAIRE** (`imCtrlMembre` du dernier dispatch), **pas le dispatcheur** | voir ci-dessous |
| `EXAMEN` | le Membre qui a examiné | acteur du dernier `EXAMEN` |
| `PROJET_PV` | même acteur qu'`EXAMEN` | le projet naît de l'examen — même tâche, même date, même acteur |
| `PV_SIGNE` | les **signataires effectifs** (parts DATÉES), ordre Membre · CC · Président, joints par ` · ` | parts de signature du PV `SIGNE` |
| `VERIFICATION` | le Vérificateur | acteur de la clôture de `VERIFICATION` |
| `CLOTURE` | l'Assistant qui a archivé, à défaut le Vérificateur de la transmission SIGMP | `ARCHIVAGE`, à défaut `TRANSMISSION_SIGMP` (même repli que la date) |

### ⚠️ `DISPATCH` diverge volontairement du chronométrage

Le passage `DISPATCH` du chronométrage est enregistré **au nom de l'auteur** (le dispatcheur —
Président ou CC, `ed86707`). Ce n'est **pas** ce que la frise doit montrer : arbitrage pilote du
2026-09-13, l'infobulle du point « Dispatch » dit **« Attribué à »** — le Membre qui a reçu le
dossier. Servir donc `imCtrlMembre` du dernier dispatch (réattributions comprises : après une
réattribution, c'est le **nouvel** attributaire, cohérent avec `datesEtapes.DISPATCH` = dernier
dispatch). Ne pas réutiliser `nomActeur` du passage `DISPATCH` tel quel.

`PV_SIGNE` est la seule clé pouvant porter **plusieurs** noms : une seule chaîne, noms joints par
` · `, dans l'ordre Membre · CC · Président, en ne retenant que les parts **effectivement signées**
(part datée). Un PV signé Membre + Président sans part CC donne « Membre · Président ».

### Côté front

Le front alignera `acteursEtapes` sur ses 7 étapes et l'utilisera **en priorité**, avec repli sur la
jointure actuelle tant que le champ n'est pas servi (même schéma que `datesEtapes`). Les préfixes
de phrase (« Réceptionné par », « Attribué à », « Examiné par »…) restent **côté front** : le
backend sert des **noms nus**.

## Tests attendus

1. Dossier examiné (projet de PV soumis) → `RECEPTION`, `DISPATCH`, `EXAMEN`, `PROJET_PV`
   renseignés (noms), le reste `null`.
2. **Invariant** : pour chaque dossier et chaque clé, `acteursEtapes[k]` est non null si et seulement
   si `datesEtapes[k]` est non null.
3. `DISPATCH` = l'**attributaire**, pas le dispatcheur : un dossier dispatché par le Président à un
   Membre sert le nom du **Membre** ; après réattribution à un autre Membre, sert le **nouveau**.
4. Le Président lit `acteursEtapes` sur `GET /api/dossiers` alors que `dispatchs` / `examens`
   restent vides (portée inchangée).
5. Annulation de dispatch → `DISPATCH`, `EXAMEN`, `PROJET_PV` redeviennent `null` ; réexamen
   (`A_REEXAMINER`) → `EXAMEN` redevient `null` (même règle de recul que les dates).
6. `PV_SIGNE` : PV signé Membre + Président (pas de part CC) → « Membre · Président » ; PV non
   `SIGNE` → `null`.
7. Aucune requête supplémentaire quelle que soit la taille de la liste (même compteur de requêtes
   qu'avec `datesEtapes` seul).
