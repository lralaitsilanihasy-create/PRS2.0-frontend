# Signalement backend — La réattribution laisse l'occurrence EXAMEN du précédent assignataire OUVERTE

**Date** : 2026-09-08 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : constat pilote — un
dossier **retiré puis redispatché à un nouvel assignataire** pendant l'examen bloque ce dernier : le
chronométrage affiche « Prise en charge par _l'ancien assignataire_ » et **aucun bouton « Prendre en
charge »** ne s'offre au nouveau. Impasse : il ne peut ni prendre en charge, ni agir.

## Scénario (dossier #100305, réel)

1. Président dispatche au Membre `MEMANT1` (Rina RAFIDIMANANA).
2. `MEMANT1` **prend en charge l'examen** à 06:55 → occurrence `EXAMEN #1` ouverte (`enCours=true`).
3. Président **retire** le dispatch et **redispatche au CC** `CCANT01` (Rabe Chef ANT) à 07:18 → une
   occurrence `DISPATCH #2` est ajoutée (bien).
4. **Mais l'occurrence `EXAMEN #1` de `MEMANT1` reste OUVERTE** (`fin=null`, `enCours=true`).

## Constat (`GET /api/dossiers/100305/chronometrage`)

Le DTO est par ailleurs **correct** sur l'attributaire :

```
etapeCourante : EXAMEN
attributaire  : CCANT01          ← le nouvel assignataire, JUSTE
acteursAttendus : ["CCANT01"]    ← JUSTE
```

Mais les occurrences gardent l'examen abandonné ouvert :

```
occ RECEPTION #1  SECANT1   fin ✔
occ DISPATCH  #1  PRES001   fin ✔
occ EXAMEN    #1  MEMANT1   priseEnCharge 06:55   fin = null   enCours = true   ← RESTE OUVERTE
occ DISPATCH  #2  PRES001   priseEnCharge 07:18   fin ✔        ← le redispatch au CC
```

Le dispatch (`t_dispatch`) est lui aussi correct : `idDispatch=1` a été **mis à jour** en place
(`imCtrlMembre = CCANT01`, `dateDispatch = 07:18`). Seule l'occurrence de chronométrage EXAMEN du
précédent assignataire n'a pas été clôturée.

## Pourquoi ça bloque le nouvel assignataire (côté front, pour information)

Le widget de chronométrage prend « la tâche EN COURS de l'étape courante » comme état affiché. Comme
l'occurrence `EXAMEN #1` de `MEMANT1` est encore ouverte, il :

- affiche « **Prise en charge par Rina RAFIDIMANANA** » (l'occurrence ouverte, pas l'attributaire) ;
- considère l'étape « déjà prise en charge » → **ne propose pas** le bouton « Prendre en charge » ;
- calcule `actionAutorisee = false` pour le CC (il EST l'attributaire mais **sa** prise en charge
  n'existe pas), d'où la bannière « Cliquez d'abord Prendre en charge »… sans bouton.

Le front s'appuie sur le modèle d'occurrences du backend (autorité). Il n'a **rien à changer** : dès
que l'occurrence abandonnée est clôturée, `tacheEnCours` de l'étape EXAMEN redevient nulle et le bouton
s'affiche au nouvel attributaire (règle EXAMEN = `attributaire === utilisateur`, déjà en place).

## Demande

Quand un dossier à l'étape **EXAMEN**, avec une occurrence EXAMEN **ouverte** tenue par l'assignataire
A, est **réattribué / redispatché** à un nouvel assignataire B (ou son dispatch **retiré**), le backend
doit **CLÔTURER l'occurrence EXAMEN ouverte de A** (poser sa `fin` à l'instant de la réattribution —
la durée d'examen entamée par A est ainsi mesurée, comme un passage abandonné).

- L'étape EXAMEN ne doit alors plus avoir d'occurrence ouverte : B prend en charge **à neuf** via
  `POST /api/dossiers/{id}/prise-en-charge` (nouvelle occurrence `EXAMEN #2`).
- `attributaire` / `acteursAttendus` sont déjà justes — **ne rien y changer**.
- Symétrique de ce qui est déjà fait pour la DISPATCH (occurrence n+1 tracée) : ici c'est l'occurrence
  SORTANTE de l'étape EXAMEN qu'il faut **fermer** au même moment.
- Même raisonnement si la réattribution intervient sur d'autres étapes rejouables tenues par un
  assignataire nominatif (au jugement du backend) ; le cas observé est EXAMEN.

## Contre-recette attendue

Sur #100305 (déjà réattribué à `CCANT01`) après correctif :

1. `GET /chronometrage` : l'occurrence `EXAMEN #1` (`MEMANT1`) porte une `fin` (`enCours=false`) ; plus
   aucune occurrence EXAMEN ouverte.
2. Écran d'examen ouvert par `CCANT01` : le bouton **« Prendre en charge »** s'affiche (plus de « Prise
   en charge par Rina »), `actionAutorisee` repasse à true après sa prise en charge, l'examen se
   poursuit normalement.
3. La table des passages montre l'examen de `MEMANT1` **clôturé** (durée = 06:55 → instant du
   redispatch) et, après PEC du CC, un `EXAMEN #2` ouvert à son nom.

## Côté front — rien à changer

Le widget lit le modèle d'occurrences servi par `/chronometrage` ; la correction de la lifecycle
d'occurrence suffit à débloquer l'affichage et le geste. Aucune adaptation front.
