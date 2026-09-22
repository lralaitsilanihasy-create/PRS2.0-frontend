# Demande backend — Réinitialiser un examen en cours (brouillon de l'attributaire)

**Date** : 2026-09-21 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : question pilote du 21/09 sur
l'examen du dossier 00002 (« comment faire un retour en arrière ou une réinitialisation du contrôle »). Le retour
en arrière existe (réouverture d'une ligne validée, « Revenir à … », reprise d'un écartement) ; la
**réinitialisation n'existe pas** et n'a aujourd'hui qu'un substitut disproportionné.

## Constat

- L'examen est un **brouillon serveur** : `POST /api/examens` à la première validation, puis un
  `t_examen_detail` par (ligne × point de contrôle) — avec ses `t_observation_controle` « Au lieu de / Lire »,
  cellule cible comprise depuis V30 — et un `t_examen_piece` par pièce, réconciliés à **chaque « Valider »**,
  repris automatiquement à la réouverture (`calculerReprise`).
- Le Membre ne peut **rien effacer** : `DELETE /api/examens`, `/examen-details`, `/examen-pieces` sont
  réservés à l'Administrateur. Un examen entamé sur une mauvaise base (mauvaise lecture du plan, observations
  posées ligne à ligne à reprendre, réexamen d'un dossier dont le périmètre a changé) se corrige ligne par ligne,
  jamais d'un geste.
- La seule remise à zéro fonctionnelle est le **retrait du dispatch** par le dispatcheur
  (`POST /api/dispatchs/{id}/annuler` → purge examen + PV, dossier `PRET_DISPATCH`, redispatch) : geste d'un
  autre profil, notification, redispatch — pour un examen que l'attributaire veut simplement recommencer.

## Demande

### B1 — Route

| | |
|---|---|
| Méthode et URL | `POST /api/examens/{id}/reinitialiser` |
| Accès | l'**attributaire courant** du dispatch de l'examen (`imCtrlMembre`, réattributions comprises) — même règle que « seul l'assignataire examine » (`d24c115`) ; un P/CC attributaire par délégation est couvert ; le dispatcheur non attributaire reçoit un **403 nominatif** (« Réinitialisation réservée à l'attributaire (Prénoms Nom) »), copie CC idem |
| Préconditions | dossier au statut **`DISPATCHE`** (brouillon jamais soumis) et **aucun projet de PV** lié à l'examen ; sinon **409 nominatif** (« L'examen a été soumis : passez par « Modifier l'examen » ou par la navette ») |
| Corps | aucun |
| Réponse | `200 ExamenDto` (examen vidé) ; `401` anonyme ; `403` non-attributaire ; `404` examen inexistant ; `409` précondition |

> ⚠️ **Livraison backend du 2026-09-22** — implémenté tel quel (`ExamenService.reinitialiser`, `ExamenController`).
> Le 403 nomme l'attributaire dans la convention de l'application, « **NOM Prénoms** » (« Réinitialisation réservée à
> l'attributaire (NOM Prénoms) : c'est son brouillon d'examen… »). Le 409 dit le statut du dossier et, s'il existe,
> le projet de PV (« L'examen a été soumis (dossier « EXAMINE », projet de PV créé) : … »). Gardes dans l'ordre :
> 404, localité (403), attributaire (403 nominatif), préconditions (409). Contrat : `docs/api-endpoints.md`,
> section « Examens » ; règle : `docs/regles-gestion.md`, « Réinitialiser un examen en cours ».

### B2 — Effet, en UNE transaction

1. Supprime **tous** les `t_examen_detail` de l'examen (cascade `t_observation_controle`, y compris les cibles de
   cellule V30) et **tous** les `t_examen_piece`.
2. **Conserve** la ligne `t_examen` (identifiant stable : le front la retrouve par `idDispatch` et repart à la
   première étape, comme un brouillon vierge) ; `avisSuggere` redevient `null`.
3. **Chronométrage inchangé** : l'occurrence `EXAMEN` en cours reste ouverte — on recommence l'examen, on ne
   revient pas au dispatch ; le temps déjà écoulé compte.
4. **Journal** : une entrée `REINITIALISATION_EXAMEN` (auteur = attributaire, détail = « N point(s) et M pièce(s)
   effacés »), rang 4 dans le référentiel des rangs (comme `SOUMISSION_EXAMEN`). Aucune entrée si rien n'a été
   effacé (appel sur un examen déjà vide → 200, sans trace).

   > ⚠️ **Livraison backend du 2026-09-22** — le détail porte aussi les observations : « N point(s) et M pièce(s)
   > effacés (K observation(s)) », la parenthèse étant omise si K = 0. Le « rang 4 » est celui du **référentiel du
   > front** (visibilité hiérarchique, rang du Membre) ; côté serveur, le rang de départage des événements du même
   > instant est **49**, juste avant `SOUMISSION_EXAMEN` (50) — la réinitialisation précède la soumission qu'elle
   > rend possible. La ligne est **consignée** dans `t_action_dossier` (pas dérivée) : elle survit à tout.
5. **Pré-contrôle intact** : les signalements et leurs écartements portent sur le plan, pas sur l'examen, et
   se reprennent déjà un à un (`POST /signalements/{id}/reprendre`). La réinitialisation ne les touche pas (Q1).
6. **Aucune notification** : geste propre à l'attributaire, sans effet sur les autres acteurs (Q3).

### Options écartées

- *Ouvrir `DELETE /api/examens/{id}` à l'attributaire* : ferait disparaître l'examen et son occurrence de
  chronométrage, obligerait le front à recréer, et ne laisserait aucune trace au journal.
- *Passer par le retrait du dispatch* : c'est le substitut actuel — geste d'autrui, disproportionné, et il
  remet le compteur d'étape à zéro alors que le temps a réellement couru.

## Côté front (pour information, livré après le backend)

Bouton « Réinitialiser l'examen » dans la barre d'actions de l'examen, **mode création seulement** (masqué dès
que le dossier est `EXAMINE`), confirmation en modale (fermeture par bouton, jamais au clic sur le voile) qui
dit ce qui sera effacé (« N lignes validées, M pièces, K observations ») et ce qui reste (pré-contrôle,
chronométrage) ; au 200, rechargement complet et reprise à la première étape. Le 403/409 est affiché tel que
servi, sans reformulation.

## Tests attendus

1. Attributaire, dossier `DISPATCHE`, 3 lignes validées + 2 pièces + 4 observations → `200`, 0 détail, 0 pièce,
   0 observation ; `t_examen` conservé ; dossier toujours `DISPATCHE` ; chronométrage identique avant/après ;
   journal +1 `REINITIALISATION_EXAMEN` au nom de l'attributaire.
2. Dispatcheur non attributaire (Président) → `403` nominatif ; CC en copie → `403`.
3. P/CC attributaire par délégation (dispatché à lui-même) → `200`.
4. Dossier `EXAMINE` (projet de PV créé) → `409` nominatif, rien d'effacé.
5. Examen inexistant → `404` ; anonyme → `401`.
6. Second appel sur l'examen déjà vide → `200`, journal **sans** nouvelle entrée.
7. Un signalement de pré-contrôle écarté par l'attributaire avant la réinitialisation est **toujours écarté**
   après (et toujours reprenable).
8. Compteur de requêtes : une transaction, pas de suppression ligne à ligne côté service.

## Questions au pilote (recommandation en gras)

| # | Question | Reco |
|---|---|---|
| Q1 | La réinitialisation doit-elle aussi **reprendre** les écartements de pré-contrôle posés par l'attributaire ? | **Non** — objets du plan, réversibles un à un, et l'écartement est un jugement, pas un résultat d'examen |
| Q2 | Ouvrir le geste à un dossier `A_REEXAMINER` (réexamen après lettre de renvoi, PV `EN_RECTIFICATION`) ? | **Non dans ce lot** — le réexamen est scopé et lié à un PV existant ; à traiter à part si le besoin apparaît |
| Q3 | Notifier le dispatcheur qu'un examen a été réinitialisé ? | **Non** — la trace au journal suffit, le dispatcheur la voit dans la consultation |

> ✅ **Front livré le 2026-09-22** (sur backend `7c601f9`) : bouton « Réinitialiser » dans la barre du document de
> l'écran d'examen, **mode création seulement** (dossier `DISPATCHE`, brouillon déjà enregistré — dès que le dossier
> est `EXAMINE`, le bouton n'existe plus) ; confirmation en modale (fermeture par bouton ou Échap) qui compte ce qui
> sera effacé (lignes validées, pièces examinées, observations relevées) et rappelle ce qui reste (pré-contrôle,
> chronométrage, dispatch, trace au journal) ; au 200, rechargement complet de l'écran et reprise à la première
> étape ; 403 / 409 affichés tels que servis. Journal : libellé « Réinitialisation de l'examen », rang de
> l'attributaire. `ExamenService.reinitialiser`, 2 tests d'écran (792 au total).
