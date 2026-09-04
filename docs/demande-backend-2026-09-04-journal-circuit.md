# Demande backend — Journal du circuit : consigner les gestes de dispatch (réattributions, reprises, retraits)

> ✅ **CLÔTURÉE le 04/09** — backend livré (`d24c115` + consigne au détail `177ced0`), affiché dans
> la consultation (DISPATCH/REATTRIBUTION/REPRISE/RETRAIT_DISPATCH), contre-recetté en réel.

**Date** : 2026-09-04 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : demande pilote

> « Est-ce qu'on peut faire apparaître les réattributions du CC et le retrait — c'est-à-dire toutes
> les étapes que le dossier a fait ? »

## Contexte

Le **chronométrage** (t_tache_dossier) journalise les ÉTAPES et leurs durées : chaque POST de
dispatch y écrit un passage « Dispatch », mais les **réattributions** (PUT, `imCtrlMembre` écrasé),
les **reprises** (PUT vers soi) et les **retraits** (`/annuler`, dispatch supprimé) ne laissent
AUCUNE trace — l'histoire du dossier est irrécupérable (le dispatch ne garde que son dernier état).

Le bon réceptacle existe déjà : le **journal des actions** (`t_action_dossier`,
`JournalDossierService.tracer`, append-only, vocabulaire fermé), affiché dans la consultation du
dossier (« Journal des actions »). Il ne consigne aujourd'hui que les gestes PRMP (CREATION,
SOUMISSION, …). Demande : y consigner les gestes du circuit de dispatch.

## Demandes

### 1. Tracer les gestes de dispatch dans `t_action_dossier`

Depuis `DispatchService`, appeler `journalDossierService.tracer(idDossier, type, detail)` dans la
même transaction que chaque geste :

| Geste | `typeAction` | `detail` proposé |
|---|---|---|
| POST `/api/dispatchs` | `DISPATCH` | `à {nom attributaire}` + ` · copie à {nom CC}` si copie |
| PUT (changement d'`imCtrlMembre`, nouvel attributaire ≠ appelant) | `REATTRIBUTION` | `de {ancien} à {nouveau}` |
| PUT (nouvel attributaire = appelant — reprise) | `REPRISE` | `reprise à {ancien attributaire}` |
| POST `/{id}/annuler` | `RETRAIT_DISPATCH` | `retiré à {attributaire} — retour en pré-dispatch` |

Optionnel mais bienvenu (même mécanique) : `RECEPTION` au passage COMPLET (détail : n° de
réception). Les étapes aval (examen, PV, visa…) ont déjà leurs traces ailleurs — hors périmètre.

### 2. Opérateur : gérer les CONTRÔLEURS dans `tracer`

`tracer` résout l'opérateur comme une PRMP (`idPrmpOperateur`, nom via `PrmpRepository`, mandat).
Pour un geste de contrôleur (Président/CC) : `idPrmpOperateur` et `idMandatOperateur` restent
**null** (concepts PRMP — le badge « ≠ attribution » du front ne doit pas s'allumer),
`nomOperateur` = nom du contrôleur (via `ControleurRepository`), `auteur` = login. Adapter
`nomOperateur(...)` ou ajouter une variante.

### 3. Visibilité

Le journal est servi avec le dossier (consultation) — inchangé : tous les profils du circuit le
voient déjà. Rien à ouvrir.

## Front (déjà prêt)

`dossier-consultation.actionLabel` connaît déjà les nouveaux types (`DISPATCH`, `REATTRIBUTION`,
`REPRISE`, `RETRAIT_DISPATCH`, `RECEPTION`) — dès que le backend les écrit, ils s'affichent dans le
« Journal des actions » sans autre livraison.

## Complément (2026-09-04, après livraison d24c115) — la CONSIGNE dans le détail

> « Comment savoir que le dossier a été dispatché au CC avec instruction avant de le dispatcher au
> membre ? » (pilote) — le dispatch ne garde que la DERNIÈRE consigne (le PUT remplace) ; celle du
> Président au CC disparaît à la réattribution.

Ajouter la consigne au `detail` des lignes `DISPATCH` et `REATTRIBUTION` quand elle existe :

- `DISPATCH` : `à {nom}` + ` — consigne : « {instructions} »` ;
- `REATTRIBUTION` : `de {ancien} à {nouveau}` + ` — consigne : « {instructions} »` (la NOUVELLE,
  celle du réattribueur).

Le `detail` est déjà tronqué à 500 caractères (`tronquer`) — suffisant. Aucun changement front :
la colonne Détail du journal affiche le texte tel quel.

## Tests attendus

1. Président dispatche au CC → ligne `DISPATCH` (« à Rabe Chef ANT »), opérateur = Président,
   sans mandat ni marqueur PRMP — **consigne incluse dans le détail** si fournie.
2. CC réattribue à un Membre → `REATTRIBUTION` (« de Rabe Chef ANT à RAFIDIMANANA Rina »),
   **avec la consigne du CC** si fournie.
3. CC reprend le dossier au Membre → `REPRISE` (« reprise à RAFIDIMANANA Rina »).
4. Président retire → `RETRAIT_DISPATCH` — la ligne SURVIT à la suppression du dispatch et au
   re-dispatch suivant (append-only).
5. Le journal PRMP existant (CREATION, SOUMISSION…) est inchangé ; la purge d'un brouillon purge
   toujours tout.
