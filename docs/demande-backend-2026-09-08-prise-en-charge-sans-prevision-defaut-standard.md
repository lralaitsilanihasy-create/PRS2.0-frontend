# Demande backend — « Prendre en charge » sans saisie : prévision = délai standard admin par défaut

**Date** : 2026-09-08 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : demande pilote — le
bouton **« Prendre en charge »** ne doit **plus demander de prévision**. Il ne sert qu'à **déclencher le
chronométrage** de l'étape ; la prévision doit être prise **par défaut** sur le **délai standard
administrable** de l'étape (référentiel `delais-standards`). Valable pour **tout profil** portant ce
bouton (widget partagé `chronometrage-dossier.ts`).

## État actuel (vérifié)

- `POST /api/dossiers/{id}/prise-en-charge` **exige** `previsionHeures` (entier ≥ 1) :
  `{}` et `{previsionHeures:null}` → **400 « Validation échouée »**.
- `GET /api/delais-standards` sert les standards par étape : RECEPTION 8, DISPATCH 8, **EXAMEN 40**,
  **VISA 16**, COSIGNATURE 8, VERIFICATION 24, TRANSMISSION_SIGMP 8, ARCHIVAGE 16.
- ⚠️ **`RECTIFICATION_PRMP` n'est PAS dans `delais-standards`** — or c'est une étape à prise en charge
  (écran PRMP « Rectifier le dossier »). Il lui faut aussi un standard.

## Demande

Rendre `previsionHeures` **OPTIONNEL** sur `POST /api/dossiers/{id}/prise-en-charge` :

- **Absent (ou null)** → le backend applique le **délai standard admin de l'étape courante**
  (`etapeCourante`) comme prévision, et marque l'occurrence `previsionStandard = true`. C'est le
  comportement du bouton « juste démarrer le chrono ».
- Le standard doit exister pour **toute étape chronométrée** — y compris **`RECTIFICATION_PRMP`**
  (l'ajouter au référentiel `delais-standards`, ou un repli serveur documenté si l'admin ne l'a pas
  saisi, comme le repli 8 h annoncé ailleurs).
- **Rejoué** sur une tâche ouverte sans `previsionHeures` : ré-applique le standard (idempotent), sans
  créer d'occurrence — même logique que la correction actuelle.
- La garde d'identité (403 hors porteur / hors acteurs attendus) et le 409 « aucune étape ouverte »
  restent inchangés : seule la **source de la prévision** change.
- Un `previsionHeures` explicite reste **accepté** (compat / éventuel override), mais le front cessera
  d'en envoyer.

## Côté front — à faire APRÈS livraison (dépend de l'API)

- `chronometrage-dossier.ts` : le bouton **« Prendre en charge »** appelle **directement** la PEC
  (plus de panneau de saisie « Ma prévision pour cette étape ») ; succès → recharge du chronométrage.
- `circuit.services.ts` : `priseEnCharge(idDossier)` n'envoie plus `previsionHeures` (corps vide).
- `PriseEnChargeRequest` : `previsionHeures` passe optionnel.
- ⚠️ **À trancher avec le pilote** : le bouton **« Corriger ma prévision »** (correction manuelle d'une
  tâche ouverte) a-t-il encore un sens si la prévision est toujours le standard admin ? Probable retrait.

## Contre-recette attendue

1. `POST /prise-en-charge` **sans corps** par le porteur de l'étape → **200** ; l'occurrence porte
   `previsionHeures` = le **standard de l'étape** (ex. VISA → 16 h) et `previsionStandard = true`.
2. `datePrevisionnelleFin` cohérente (calculée sur les standards, comme aujourd'hui).
3. Idem sur `RECTIFICATION_PRMP` (PRMP) : PEC sans corps → 200, prévision = son standard.
4. `previsionHeures` explicite encore accepté → 200 (compat).
