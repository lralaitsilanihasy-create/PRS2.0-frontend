# Demande au backend `PRS20` — 7 septembre 2026 — FAVR : rectification PRMP AVANT la vérification

> ✅ **LIVRÉ le 07/09** (backend `a346d9b`, 821 tests verts) — la co-signature d'un FAVR envoie le PV
> définitif **et les observations** à la PRMP (`EN_ATTENTE_DECISION_PRMP`, compteur net suspendu) ; le
> vérificateur n'est **ni notifié ni sollicité**, et le dossier n'apparaît dans **aucune** de ses files tant
> qu'il n'a jamais statué dessus. La **resoumission** ouvre la vérification et le notifie alors
> (`PV_A_VERIFIER`, ciblé par rattachement). **`leveePossible` vaut `true`** dès le premier passage ; le
> passage « rappel » a disparu, la boucle est conservée. **Cas FAV : inchangé, confirmé par un test.**
> Détail et points d'attention : **note de livraison** en fin de document.
>
> Règle pilote (07/09) : réordonnancer le circuit **après la cosignature** pour un avis
> **« Favorable avec réserves » (FAVR)**. Backend d'abord (machine à états + notifications) ;
> le front suivra.

## La règle demandée

1. Une fois la **cosignature terminée**, le **PV définitif est envoyé à la PRMP**.
2. Pour un avis **FAVR**, envoyer **également les observations (réserves) du PV** en même temps que le
   PV définitif, pour que la **PRMP / UGPM** puisse **rectifier** le dossier.
3. Le dossier ne passe au **vérificateur qu'APRÈS la rectification** effectuée par la PRMP/UGPM sur la
   base de ces observations. **Cette rectification conditionne le premier passage en vérification.**
4. Par conséquent, le **vérificateur ne reçoit AUCUNE notification** tant que le dossier n'a pas été
   rectifié. La notification n'est déclenchée qu'**une fois la rectification validée**.

## Flux ACTUEL (FAVR) — ce qui change

```
Examen (Membre, FAVR) → Visa (P/CC) → Cosignature
   → EN_VERIFICATION
   → VÉRIFICATEUR, 1er passage = « rappel » : toutes les observations forcées MAINTENUE
     (leveePossible=false), ce passage GÉNÈRE le rappel à la PRMP        ← à SUPPRIMER
   → EN_ATTENTE_DECISION_PRMP
   → PRMP rectifie (PUT saisies/ppm) + resoumet
   → EN_VERIFICATION (occurrence 2) → VÉRIFICATEUR, LEVÉE possible
   → transmission SIGMP → archivage → CLOTURE
```

Le premier passage du vérificateur ne sert aujourd'hui qu'à **relayer les observations vers la
PRMP** — le pilote veut que ce relais se fasse **directement à la cosignature**, sans mobiliser le
vérificateur.

## Flux DEMANDÉ (FAVR)

```
Examen (Membre, FAVR) → Visa (P/CC) → Cosignature
   → PV DÉFINITIF + OBSERVATIONS (réserves) envoyés à la PRMP
   → dossier « en attente de rectification PRMP » (ex. EN_ATTENTE_DECISION_PRMP)
       · PRMP/UGPM NOTIFIÉE (PV définitif + réserves à rectifier)
       · VÉRIFICATEUR : NON impliqué, NON notifié                        ← silence total
   → PRMP/UGPM rectifie sur la base des observations, puis VALIDE (resoumet)
   → EN_VERIFICATION  (1er passage du vérificateur = APRÈS rectification)
       · VÉRIFICATEUR NOTIFIÉ ici, pas avant
       · CHOIX RÉEL dès ce 1er passage entre MAINTENUE et LEVÉE (les DEUX disponibles, le dossier
         étant déjà rectifié) : LEVÉE si la rectification satisfait → SIGMP ; MAINTENUE sinon
         → nouveau retour PRMP pour rectification (la boucle continue)
   → transmission SIGMP → archivage → CLOTURE
```

## Points backend

- **Transition post-cosignature (FAVR)** : au lieu de passer par `EN_VERIFICATION` avec un passage
  vérificateur « rappel », aller directement à l'état d'attente de rectification PRMP (le même que
  celui atteint aujourd'hui APRÈS le 1er passage — `EN_ATTENTE_DECISION_PRMP` ou équivalent), en
  **joignant les observations du PV** (snapshot `t_observation_pv`) à destination de la PRMP.
- **Notification PRMP** : émise à la cosignature (PV définitif + observations à rectifier).
- **Notification VÉRIFICATEUR** : **supprimée** à la cosignature ; **émise seulement** quand la PRMP
  a **validé sa rectification** et que le dossier entre en `EN_VERIFICATION`.
- **`leveePossible`** : puisque le vérificateur ne voit le dossier qu'APRÈS rectification, ce champ
  vaut **`true` dès son premier passage** (plus de « rappel » côté vérificateur). Le mécanisme
  « rappel auto-généré des maintenues » au vérificateur n'a plus lieu d'être pour ce chemin.
- **Rejouabilité** : si le vérificateur maintient à nouveau des observations (rectification jugée
  insuffisante), le dossier repart vers la PRMP comme aujourd'hui (boucle conservée) — mais le
  PREMIER contact du vérificateur est déjà post-rectification.

## Cas « Favorable » SANS réserves (FAV) — à préciser/confirmer

Sans observations, il n'y a rien à rectifier. Le PV définitif va à la PRMP (déjà consultable), et le
vérificateur transmet directement au SIGMP (comportement actuel, cf. correctif SIGMP FAV-direct du
07/09). **Ce chemin ne change pas** — merci de confirmer.

## Implications FRONT (après livraison — le front reflète, ne décide pas)

- `verifier-dossier` : retirer le message « premier passage = rappel » et le grisé de « Levée »
  (`leveePossible=false`) — le vérificateur ne voit plus que des dossiers déjà rectifiés, donc
  « Levée » est active d'emblée (piloté par `leveePossible` servi par le serveur).
- Côté PRMP/UGPM : un point d'entrée « PV définitif reçu — réserves à rectifier » (notification +
  écran de rectification), sur la base des observations jointes.
- La notification vérificateur ne doit apparaître qu'après la rectification validée.

## Recette de contre-vérification

1. Dossier FAVR : examen (1 observation) → visa → cosignature.
2. Vérifier : la PRMP est **notifiée** (PV définitif + observations) ; le vérificateur **n'a AUCUNE
   notification** et le dossier n'apparaît PAS dans sa liste « À vérifier ».
3. La PRMP rectifie + valide.
4. Vérifier : le dossier entre en `EN_VERIFICATION`, le vérificateur est **notifié maintenant**, et
   « Levée » est **possible dès son premier passage**.
5. Vérification → SIGMP → archivage → CLOTURE.

---

## Note de livraison backend — 2026-09-07 (`PRS20`, commit `a346d9b`)

Les quatre points de la demande sont livrés, sans migration. Contrat : `docs/regles-gestion.md` (la règle
du 2026-08-15 y est explicitement marquée **REMPLACÉE**) et `docs/api-endpoints.md` (§ branchement
post-signature, § observations-pv). Suite : **821 tests verts**.

### Le circuit livré

| Moment | Dossier | PRMP | Vérificateur |
|---|---|---|---|
| **Co-signature FAVR** | `EXAMINE` → **`EN_ATTENTE_DECISION_PRMP`** (compteur net **suspendu**) | `PV_SIGNE` **+ `OBSERVATION_VERIFICATION`** portant les réserves | **rien** — ni notification, ni file |
| **Resoumission PRMP** | → **`EN_VERIFICATION`** | — | **`PV_A_VERIFIER`**, ciblé par **rattachement** (repli : les vérificateurs de la localité) |
| **1ᵉʳ passage** | `LEVEE` → `OBSERVATIONS_LEVEES` ; `MAINTENUE` → retour PRMP | rappel si maintenue | `leveePossible = true` |

### Ce que j'ai ajouté au-delà de la demande, et pourquoi

- **Le silence n'était pas que dans les notifications.** `GET /api/dossiers/a-verifier` et
  `/en-attente-prmp` incluaient tout dossier `EN_ATTENTE_DECISION_PRMP` : le vérificateur aurait vu
  arriver un dossier qui ne le concernait pas encore. Ces deux listes (et leurs compteurs) **excluent
  désormais** les dossiers en attente de PRMP **sur lesquels aucun passage de vérification n'existe**. Un
  dossier qui boucle, lui, reste sous ses yeux en lecture seule — comme avant.
- **Le ciblage par rattachement a été déplacé, pas perdu.** Il vivait sur la notification émise à la
  signature ; il est maintenant porté par celle de la resoumission, au **premier contact** du
  vérificateur. La règle du 2026-09-01 tient donc toujours.
- **Le type de notification distingue les deux moments** : `PV_A_VERIFIER` au premier contact (le
  vérificateur découvre le dossier), `RECTIFICATION_PRMP` aux tours suivants (il le retrouve).

### Points d'attention

- ⚠️ **La PRMP reçoit `OBSERVATION_VERIFICATION` à deux moments** : à la co-signature (les réserves du PV)
  puis à chaque observation maintenue (le rappel). Même type, donc même écran côté front. Si vous voulez
  les distinguer visuellement, demandez un type dédié — je ne l'ai pas créé pour ne pas multiplier les
  types sur une distinction que le corps du message porte déjà.
- Le **compteur net CNM** se suspend dès la co-signature et reprend à la resoumission : sur un FAVR, le
  temps de rectification n'est plus imputé à la Commission, y compris pour le premier tour.
- La `leveePossible` est **toujours `true`** ; la méthode est conservée (et non remplacée par un littéral)
  pour que le champ garde son sens et qu'une condition future ait où se loger.

### Tests

`FavrRectificationAvantVerificationIntegrationTest` suit la recette de contre-vérification : silence total
avant rectification (notifications **et** files **et** compteurs), notification PRMP portant les réserves,
ouverture par la resoumission avec notification ciblée, levée possible au premier passage, boucle
conservée, et **cas FAV inchangé**. S'y ajoutent **8 classes existantes mises à jour** : elles encodaient
l'ancien ordre (dossier en vérification après signature, levée refusée au premier passage), et disent
maintenant le contraire — c'est la meilleure preuve que le réordonnancement mord.

### Côté front — ce qui peut être retiré

Comme annoncé dans la demande : le message « premier passage = rappel » et le grisé de « Levée » n'ont
plus lieu d'être (`leveePossible` les pilote et vaut `true`). La PRMP peut entrer dans son écran de
rectification depuis la notification `OBSERVATION_VERIFICATION`, qui porte l'objet PV **et** le dossier.
