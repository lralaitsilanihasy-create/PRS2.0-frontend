# Signalement backend — Le retrait d'un dossier n'apparaît pas dans le journal des actions

> ✅ **CLÔTURÉ le 07/09** — backend livré (`399c1c0`) et **contre-recetté en réel** sur #100299
> (retrofit, sans rien rejouer) : le journal renvoie désormais 7 actions, dont `DEMANDE_RETRAIT`
> (08:23:03, opérateur PRMP, « motif : Test ») et `RETRAIT_ACCEPTE` (08:23:50, opérateur PRES001,
> « PRET_DISPATCH → BROUILLON » — l'état réel correctement dérivé). Les trois types proposés ont été
> retenus tels quels ; les libellés front (`7c86e4a`) s'activent seuls. Rendu vérifié à l'écran
> (profil Président, modale « Journal des actions »).

**Date** : 2026-09-07 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : constat pilote sur
un dossier réel (00002/MTP/PPM/2026, id **100299**) dont le journal saute d'une réception à une
nouvelle soumission sans mentionner le retrait qui a permis ce retour en brouillon.

## Constat — le retrait accepté est absent du journal servi

`GET /api/dossiers/100299/journal` renvoie **5 actions**, aucune n'étant un retrait :

```
07:12:02  CREATION     Création du dossier (DDP / PPM)
07:57:25  SOUMISSION   BROUILLON -> SOUMIS
08:12:37  RECEPTION    réception n° 1100058 — dossier complet
08:32:24  SOUMISSION   BROUILLON -> SOUMIS      ← 2e soumission : le dossier était donc reparti en BROUILLON
08:43:55  RECEPTION    réception n° 1100059 — dossier complet
```

Or `GET /api/demande-retraits?dossier=100299` montre qu'un **retrait a bien eu lieu** entre la 1re
réception (08:12) et la 2e soumission (08:32) :

```json
{
  "idDemandeRetrait": 1, "idDossier": 100299, "idPrmp": "IMP001",
  "motifRetrait": "Test", "dateDemande": "2026-09-07T08:23:03",
  "statut": "ACCEPTEE", "imCtrlCc": "PRES001", "dateDecision": "2026-09-07T08:23:50",
  "nomFichier": "projet_d_agpm...pdf"
}
```

La demande a été faite par la PRMP à 08:23:03, **acceptée** par PRES001 à 08:23:50 → le dossier est
repassé en BROUILLON (d'où la 2e soumission à 08:32). Cet enchaînement — le geste métier le plus
lourd de la séquence, puisqu'il fait reculer le dossier dans le circuit — **ne laisse aucune trace
dans le journal**. Le front affiche fidèlement les 5 actions reçues ; c'est la dérivation serveur du
journal (fusion à la lecture, `ed162e8`) qui n'émet pas l'événement retrait.

## Demande — dériver le retrait dans le journal (comme les autres actes, rétroactif)

À partir de `t_demande_retrait`, émettre dans `GET /api/dossiers/{id}/journal` :

1. **`DEMANDE_RETRAIT`** — à `dateDemande`, **opérateur = la PRMP** (`idPrmp`), détail =
   `« Demande de retrait — motif : {motifRetrait} »`. Acte de la PRMP, visible de tous (rang 0,
   comme CREATION / SOUMISSION).
2. **`RETRAIT_ACCEPTE`** — à `dateDecision` quand `statut = ACCEPTEE`, **opérateur = le décideur**
   (`imCtrlCc`), détail = `« Retrait accepté — SOUMIS -> BROUILLON »` (l'état de départ réel selon
   le statut au moment du retrait). C'est l'événement qui change l'état ; **le plus important**.
3. *(souhaitable)* **`RETRAIT_REFUSE`** — à `dateDecision` quand `statut = REFUSEE`, opérateur
   `imCtrlCc`, détail = `obsDecision`.

Rétroactif comme la fusion existante (les dossiers déjà retirés doivent se compléter à la relecture).
Visibilité hiérarchique : un retrait est un acte PRMP/CC autour du dossier de la PRMP — le traiter
comme un acte **rang 0** (visible de tous), au même titre que CREATION/SOUMISSION.

Les **noms de type** ci-dessus sont une proposition ; le front s'aligne sur ce que vous retiendrez.
Les libellés côté front sont déjà prêts pour `DEMANDE_RETRAIT`, `RETRAIT_ACCEPTE`, `RETRAIT_REFUSE`
(inertes tant que rien n'est servi) ; ils tombent en repli sur le code brut sinon.

## Recette de contre-vérification (à rejouer)

Sur un dossier jetable : Créer → Soumettre → Réceptionner → Demander un retrait → l'accepter (CC/
Président) → re-soumettre. `GET /dossiers/{id}/journal` doit alors intercaler, entre la 1re réception
et la 2e soumission, `DEMANDE_RETRAIT` (PRMP, 08:23:03) puis `RETRAIT_ACCEPTE` (PRES001, 08:23:50).

---

## Note de livraison backend — 2026-09-07 (`PRS20`, commit `399c1c0`)

Dérivation à la lecture, dans `JournalTraitementService`, donc **rétroactive** : rien à rejouer, #100299
s'est complété à la relecture. Types retenus : ceux que vous proposiez.

| `typeAction` | Instant | Opérateur | Détail |
|---|---|---|---|
| `DEMANDE_RETRAIT` | `dateDemande` | la **PRMP** (`idPrmpOperateur` **posé**) | « Demande de retrait — motif : … » |
| `RETRAIT_ACCEPTE` | `dateDecision` | le décideur (`imCtrlCc`) | « Retrait accepté — {état d'avant} -> BROUILLON » |
| `RETRAIT_REFUSE` | `dateDecision` | le décideur | « Retrait refusé — {obsDecision} » |

### Le point délicat : l'« état d'avant »

`t_demande_retrait` ne stocke **pas** le statut du dossier au moment du retrait. Il est donc **relu dans le
journal** : la dernière action de circuit antérieure à la décision (`SOUMISSION` → `SOUMIS`, `RECEPTION` →
`PRET_DISPATCH`, `DISPATCH` → `DISPATCHE`, `SOUMISSION_EXAMEN` → `EXAMINE`). Sur #100299, cela donne bien
« `PRET_DISPATCH` -> `BROUILLON` ». Si l'état reste indéterminable, le détail dit simplement « retour en
BROUILLON » plutôt que d'affirmer un statut faux.

Cette relecture est fiable parce qu'un correctif du même jour (`d364f1a`) **fige les événements de
traitement avant la purge du circuit** : un retrait n'efface plus l'histoire dont il a besoin.

⚠️ **Pour le front** : ces trois types portent un `idAction` **réel** (ce sont des lignes dérivées mais
issues d'entités identifiées) ; ne supposez pas qu'un événement dérivé n'a jamais d'identifiant.
