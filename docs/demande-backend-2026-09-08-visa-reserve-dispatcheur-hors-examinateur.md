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

---

## Note de livraison backend — 2026-09-08 (`PRS20`, commit `05fa5a6`)

Livré, sans migration. Contrat : `docs/regles-gestion.md` (§ chronométrage, « …et symétriquement,
l'EXAMINATEUR NE VISE PAS son propre examen ») et `docs/api-endpoints.md` (§ VISER et RETOURNER excluent
l'EXAMINATEUR). Suite : **846 tests verts**.

### La règle, appliquée sur TROIS portes

| Appelant, navette simple | Visa / retour |
|---|---|
| Le **dispatcheur** | **200** — inchangé |
| Un **P/CC du périmètre non examinateur**, par intérim | **200** avec sa note (400 si elle manque) |
| L'**examinateur**, dispatcheur ≠ lui | **403**, avant même la note d'intérim |
| L'**examinateur QUI EST le dispatcheur** | **200** — il cumule légitimement examen, soumission, visa |

Le refus vient **avant** la note d'intérim : réclamer une pièce qui ne débloquerait rien serait
malhonnête. Message : *« Le visa revient au dispatcheur du dossier (nom) : vous avez examiné ce dossier,
et l'examinateur ne vise pas son propre examen — pas même en suppléant par intérim. »*

**⚠️ La troisième porte, hors demande mais imposée par sa logique** : la **prise en charge de l'étape
`VISA`** (`POST /dossiers/{id}/prise-en-charge`) suit la même réserve. Sans elle, l'examinateur ouvrait
une tâche qu'il ne pourrait jamais achever — et surtout **verrouillait l'étape contre le dispatcheur**,
à qui le 409 nominal du 04/09 aurait alors renvoyé le nom de l'examinateur. C'est exactement le blocage
que ce 409 avait pour but d'empêcher. Votre `pecPermiseDe` fait déjà l'équivalent côté front ; le
serveur est maintenant d'accord avec lui.

### ⚠️ `acteursAttendus` reste `null` — je n'ai pas suivi la suggestion, voici pourquoi

L'ensemble admis est : le dispatcheur, **plus** tout P/CC du périmètre par intérim, **moins**
l'examinateur. Il n'est pas énumérable — et **une soustraction ne s'écrit pas avec une énumération**.

- Y mettre le seul dispatcheur **masquerait le geste aux suppléants légitimes** (le front masque à qui
  n'est pas dans la liste close).
- Une liste **vide** dirait « personne » et bloquerait tout le monde — d'où la convention `null` déjà
  documentée le 04/09.

La réserve s'exprime donc en **refus**, ce que votre demande acceptait comme minimum. Votre front porte
l'exclusion de son côté, ce qui est le bon endroit pour une règle négative : le serveur reste
l'autorité, et il refuse.

### Contre-recette

1. ✅ Examen par A (CC), dispatché par B (Président) → `/viser` par **A** = 403 nommant B ; par **B** = 200.
2. ✅ `/retourner` : même partage.
3. ✅ Intérim tenté par A = 403 (avant la note). Un autre CC de la localité, non examinateur, reçoit
   **400 note manquante** et non 403 : la preuve que la garde d'identité l'a laissé passer.
4. ✅ **Exception** : dossier dispatché par C à lui-même puis examiné par C → `/soumettre` = 200,
   `/viser` = 200.
5. ✅ Prise en charge du VISA : 403 pour A, 200 pour B, 200 pour C (le cumulant).

Six tests dans `VisaReserveHorsExaminateurIntegrationTest`. La navette à **deux niveaux** est inchangée.
