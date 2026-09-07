# Demande au backend `PRS20` — 7 septembre 2026 — FAVR : rectification PRMP AVANT la vérification

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
       · « Levée » DÉSORMAIS POSSIBLE dès ce passage (le rappel a déjà eu lieu)
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
