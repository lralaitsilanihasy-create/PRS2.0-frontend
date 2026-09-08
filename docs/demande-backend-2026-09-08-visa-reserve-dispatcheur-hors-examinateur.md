# Demande backend — Le visa (et le retour) exclut l'EXAMINATEUR, même par intérim

> ✅ **CLÔTURÉ le 08/09** — backend livré (`05fa5a6`, 6 tests, garde sur viser + retourner + PEC de
> l'étape visa ; `acteursAttendus` laissé null, motivé dans la note backend) et **contre-recetté en réel**,
> les deux branches vertes :
> - **(a) examinateur ≠ dispatcheur** (CC examine, Président dispatche — PV 28) : `POST /viser` par le CC →
>   **403** « Le visa revient au dispatcheur (RANDRIANARISON…) : l'examinateur ne vise pas son propre
>   examen — pas même en suppléant par intérim », `POST /retourner` par le CC → **403**,
>   `POST /prise-en-charge` (visa) par le CC → **403** ; `POST /prise-en-charge` par le Président
>   (dispatcheur) → **200**.
> - **(b) examinateur = dispatcheur** (Président dispatche à lui-même — PV 29, `imCtrlMembre =
>   imDispatcheur = PRES001`) : `POST /soumettre` par PRES001 → **200**, `POST /prise-en-charge` (visa) →
>   **200**. L'exception tient : il cumule examen + soumission + visa.
>
> Front `e3ea9ae` + exception `6d8a9fa`.

**Date** : 2026-09-08 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : constat + arbitrage
pilote — quand le **Président dispatche l'examen au CC**, le CC examine puis se voyait proposer de
**viser** le même dossier (visa direct OU **par intérim**, étant P/CC de la localité). C'est
l'examinateur qui viserait son propre examen — rupture de la séparation des rôles.

## Règle arbitrée par le pilote (2026-09-08)

Le **visa** — et par cohérence le **retour pour rectification** — d'un projet de PV est réservé au
**dispatcheur** du dossier. L'**EXAMINATEUR** (`imCtrlMembre` du PV / assignataire du dispatch) ne vise
**PAS** son propre examen, **même s'il est CC ou Président** (cas d'un examen redispatché au CC), et
**même par la voie de l'intérim** (suppléance d'un P/CC du périmètre). Séparation des rôles : celui qui
examine ne vise pas. Même esprit que « la soumission revient à l'examinateur »
(`docs/demande-backend-2026-09-08-soumission-pv-reservee-examinateur.md`), pris à l'envers.

> ⚠️ **EXCEPTION (précision pilote 2026-09-08) — l'examinateur QUI EST AUSSI LE DISPATCHEUR.** Par
> **délégation de profil**, une même personne peut dispatcher le dossier **à elle-même** puis l'examiner
> (`imCtrlMembre == imDispatcheur`). Dans ce cas, elle cumule **légitimement** examen + soumission +
> **visa** — elle N'est PAS bloquée. Le critère n'est donc pas « est l'examinateur » mais **« est
> l'examinateur ET n'est pas le dispatcheur »**. La soumission, elle, reste inchangée : elle revient à
> l'examinateur, que celui-ci soit ou non le dispatcheur (donc ce cas peut aussi soumettre).

## Constat (réel, navette simple)

Dossier dispatché par `PRES001` (dispatcheur) au CC `CCANT01` (examinateur) ; PV `PROJET_SOUMIS`,
`niveauNavette = null` (navette simple) :

```
GET /chronometrage → etapeCourante=VISA, attributaire=CCANT01, acteursAttendus=null
PV.imCtrlMembre (examinateur) = CCANT01
PV.imDispatcheur              = PRES001
```

`acteursAttendus = null` sur l'étape VISA : le serveur ne restreint pas nommément le viseur pour une
navette simple, et rien n'exclut l'examinateur de la suppléance par intérim.

## Demande

Sur les endpoints de **visa** (`POST /api/pv-examens/{idPv}/viser`, y compris la variante **intérim**
avec note) et de **retour** (`POST /api/pv-examens/{idPv}/retourner`) d'une **navette simple** :

- **403** si l'appelant est l'**examinateur** du PV (`imCtrlMembre`) **ET n'est pas le dispatcheur**
  (`imCtrlMembre != imDispatcheur`) — quel que soit son rôle, et **y compris s'il tenterait de suppléer
  par intérim**. Message explicite (dialogue front) : le visa revient au dispatcheur, l'examinateur ne
  vise pas son propre examen.
- **EXCEPTION** : si `imCtrlMembre == imDispatcheur` (examinateur = dispatcheur, délégation de profil),
  **200** — cette personne cumule légitimement examen + soumission + visa.
- Le **dispatcheur** (`imDispatcheur`) garde le visa/retour ; un **suppléant par intérim** légitime
  (P/CC du périmètre) le garde AUSSI **tant qu'il n'est pas l'examinateur** (au sens ci-dessus :
  examinateur ≠ dispatcheur).
- Idéalement, refléter cette réserve dans `acteursAttendus` de l'étape VISA (navette simple) pour que le
  front s'aligne sans règle dupliquée — au minimum, la garde 403 fait foi.
- La navette à DEUX niveaux garde ses règles d'étage existantes (déjà livrées, `1a92f5a`) ; ce point ne
  vise que la **navette simple**.

## Côté front — déjà fait

- `pv-workflow.ts` : `canViser` et `canRetourner` renvoient `false` pour l'examinateur **non
  dispatcheur** (`estExaminateur && !estDispatcheur`, avec `estExaminateur = auth.ref() ===
  pv.imCtrlMembre` et `estDispatcheur = imDispatcheur == null || imDispatcheur === auth.ref()`) → masque
  TOUT le bloc visa, `estViseurAttendu` et la suppléance par intérim (`peutSuppleer`) compris. Un
  examinateur = dispatcheur garde le bloc.
- `pv-page.ts` : `pecPermiseDe` renvoie `false` sur `PROJET_SOUMIS` pour l'examinateur **définitivement
  ≠ dispatcheur** (`imDispatcheur != null && auth.ref() !== imDispatcheur`) → pas de « Prendre en
  charge » du VISA pour lui.
- Vérifié en réel : CC examinateur (≠ dispatcheur) → aucune action visa/retour ; Président dispatcheur →
  visa/retour offerts. La garde serveur reste l'autorité (un appel direct doit être refusé).

## Contre-recette attendue

1. Examen fait par l'assignataire A (ici CC), **dispatché par B** (≠ A) ; PV `PROJET_SOUMIS`, navette simple.
2. `POST …/viser` (direct ou intérim) par **A** (examinateur ≠ dispatcheur) → **403** nommant le dispatcheur.
3. Le même par le **dispatcheur B** → **200** ; par un **P/CC suppléant du périmètre non-examinateur**
   (avec note d'intérim) → **200**.
4. `POST …/retourner` par **A** → **403** ; par le dispatcheur B → **200**.
5. **EXCEPTION** — dossier dispatché par C **à lui-même** (`imDispatcheur == imCtrlMembre == C`, délégation
   de profil) puis examiné par C : `POST …/soumettre` par C → **200**, puis `POST …/viser` par C → **200**
   (il cumule légitimement examen + soumission + visa).
