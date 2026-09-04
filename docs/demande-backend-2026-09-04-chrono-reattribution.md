# Demande backend — Chronométrage : la RÉATTRIBUTION laisse sa trace (tâche DISPATCH n+1)

**Date** : 2026-09-04 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : vérification pilote
du tableau « Chronométrage & délais » (dossier 100286, écran Vérifier).

## Constat

Sur un dossier Président → CC → Membre, le **journal du circuit** porte les deux gestes :

```
12:36:03  DISPATCH        Sitraka T. RANDRIANARISON · à Chef ANT Rabe — consigne : « Deux niveaux »
12:36:04  REATTRIBUTION   Chef ANT Rabe · de Chef ANT Rabe à Rina RAFIDIMANANA
```

mais le **chronométrage** n'a qu'UNE tâche `DISPATCH#1` (le Président). Le geste du CC n'existe
nulle part dans la table des passages : le chemin réel se lit au journal, pas au chronométrage —
asymétrie avec la règle « chaque geste du circuit compte » (et avec le retrait + re-dispatch du
Président, qui produit bien un `DISPATCH#2`).

## Demande

À la **réattribution** (`PUT /api/dispatchs/{id}` changeant l'attributaire) : consigner une tâche
**`DISPATCH` occurrence n+1** au nom de **l'AUTEUR du geste** — quel que soit son profil (CC
central comme dans le constat, CC régional sur ses propres dispatchs, Président si le serveur
l'autorise) — même modèle que le dispatch : instantanée (prise en charge = fin = l'horodatage du
geste), **prévision standard** de l'étape. Rien d'autre ne change (la date prévisionnelle de fin
reste calculée comme aujourd'hui ; l'étape courante reste EXAMEN).

Périmètre : tout geste qui **change l'attributaire** hors dispatch initial — réattribution, et par
la même règle la **reprise** (le CC se remet le dossier) et le « **rendre** » du Membre si le
modèle le permet à coût nul ; sinon, les laisser hors lot en le disant. Le retrait + re-dispatch
du Président produit déjà son occurrence (anti-régression seulement).

## Tests attendus

1. P dispatch CC puis CC réattribue Membre → tâches `DISPATCH#1` (P) et `DISPATCH#2` (CC), toutes
   deux closes instantanément, prévision standard.
2. Dispatch direct sans réattribution → un seul `DISPATCH#1` (anti-régression).
3. Le journal et le chronométrage racontent le même chemin (mêmes acteurs, mêmes instants).
