# Demande backend — 2026-11-01 — Fiche de présentation : la section « Procédure » s'intitule « Avis spécifique »

## Contexte

Demande du pilote du 01/11, sur la carte « PROCÉDURE » de la fiche de présentation (mode de remise des offres, plateforme de
dépôt, date et heure limites de remise, délai de validité, garantie de soumission, dates de lancement, de séance, d'attribution…) :

> « Changer l'appellation de ceci (PROCÉDURE) en AVIS SPÉCIFIQUE dans tous les processus dans l'application. »

Ces lignes sont celles que publie l'avis spécifique d'appel d'offres : le titre « Procédure » ne le dit pas.

Le titre est servi par `FichePresentationService` (`section("PROCEDURE", "Procédure", …)`, fiche du dossier DAO et fiche du
dossier de marché) et repris tel quel par deux sorties :

| Sortie | Où le titre est écrit |
|---|---|
| `GET /api/dossiers/{id}/fiche-presentation` (données) | `sections[].titre` |
| `GET /api/dossiers/{id}/fiche-presentation/pdf` | intitulé de la section dans le PDF |

(Le canevas du rapport d'évaluation a ses propres sections numérotées, sans section « Procédure » : il n'est pas concerné.)

**Côté front, c'est déjà fait pour l'écran** : `DossierService.fichePresentation()` renomme la section de code `PROCEDURE` en
« Avis spécifique » à la lecture. Le PDF, produit par le serveur, garde « Procédure » tant que B1 n'est pas livré.

## B1 — Le titre de la section `PROCEDURE` devient « Avis spécifique »

Dans `FichePresentationService`, les deux sections `PROCEDURE` (fiche du DAO et fiche du marché) prennent le titre
**« Avis spécifique »**. Rien d'autre ne change :

- le **code** reste `PROCEDURE` (le front s'y réfère : `v('PROCEDURE', 'DATE_LIMITE')`, `GARANTIE_MONTANT`…) ;
- les **lignes**, leurs codes, libellés et leur ordre sont inchangés ;
- le PDF de la fiche suit de lui-même, puisqu'il lit `titre()`.

Pas de migration : le titre est écrit dans le code du service.

Une fois livré, le renommage du front devient inerte (il réécrit la même valeur) ; il sera retiré au commit qui referme ce besoin.
