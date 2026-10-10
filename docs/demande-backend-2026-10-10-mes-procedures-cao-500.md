# Demande backend — « Mes procédures » du membre de CAO en 500 (2026-10-10)

Origine : signalement du pilote le 10/10. Connecté en `cao.demo.deux@exemple.mg`, l'écran *Mes procédures* de l'espace commission
d'appel d'offres affiche « Service indisponible — Une erreur interne est survenue ». La liste ne se charge pas du tout.

## Le constat

- `GET /api/cao/mes-procedures` répond **500** pour `cao.demo.deux@exemple.mg` et pour `cao.demo.un@exemple.mg`.
- Journal : `GlobalExceptionHandler : Erreur non prevue sur /api/cao/mes-procedures` —
  `UnexpectedRollbackException: Transaction silently rolled back because it has been marked as rollback-only`.
- Ces membres siègent dans la CAO du **DMC 49**, dont la fiche n'existe pas :
  `GET /api/cao/procedures/49` → 404 « La fiche de la procédure 49 n'est pas encore enregistrée. »
  Les autres DMC du membre (41, 42, 44 à 48, 50) répondent tous 200 sur la même route.
- **Cause** : `CaoService.mesProcedures` (`@Transactional(readOnly = true)`) appelle `procedures.vue(idDmc)` dans un `try/catch`.
  Pour le DMC 49, `vue` lève une `ResourceNotFoundException` à travers le proxy `@Transactional` de `ProceduresEnLigneService`. La
  transaction est alors marquée pour l'annulation : le `catch` avale l'exception, mais la validation finale échoue. C'est le motif
  corrigé le 09/10 pour la lecture de la séance PI (`ba131a6`, `piecesAttenduesInternes`).

## B1 — Une ligne illisible ne fait pas tomber toute la liste

`GET /api/cao/mes-procedures` renvoie 200, quels que soient les DMC du membre. Un DMC sans fiche, ou sans procédure en ligne, sort
avec ce que la ligne sait déjà : `procedureEtAutorite`, sans `reference` ni `dateLimite`. C'est déjà le comportement voulu par le
`catch` actuel.

Piste, au choix du backend :
- une lecture interne sans exception (comme `piecesAttenduesInternes`) ;
- ou `noRollbackFor` sur `vue`, pour ces deux exceptions.

## B2 — Le même motif chez le dépositaire

`DepositaireService.vue(idDmc)` enveloppe aussi `procedures.vue` dans un `try/catch (RuntimeException)`. `GET /api/depositaire/procedures`
répond 200 aujourd'hui pour `depositaire.demo@exemple.mg`, faute d'un DMC sans fiche dans sa liste. Mais il tomberait de la même façon
dès qu'un tel DMC y entrerait. Même correctif, et un test pour chaque espace (un DMC sans fiche dans la liste → 200).

## Question

| # | Question | À qui |
|---|---|---|
| Q1 | Une CAO constituée sur un DMC sans fiche (le 49) : état normal (CAO avant la fiche) ou résidu de démonstration à nettoyer ? | backend, pilote |

## Côté front

Rien à changer : l'écran montre déjà `<app-etat-erreur>` avec « Réessayer » en cas d'échec. Il se chargera dès que la route répondra
200. Une ligne sans référence s'affiche déjà avec l'objet et l'autorité contractante.
