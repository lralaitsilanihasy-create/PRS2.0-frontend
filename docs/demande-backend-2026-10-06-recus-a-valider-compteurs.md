# Demande backend — 2026-10-06 — Les reçus à valider, visibles d'un coup d'œil

> Demande du pilote (06/10), à propos des écrans de la fiche (commission, dépôts, retraits, reçus) : « Des menus doivent être
> créés ? » La réponse retenue : pas de menu par écran, car ils appartiennent à une procédure. En revanche, **les reçus des frais de
> dossier en attente doivent se voir** sans ouvrir chaque fiche.

**Le constat.** Un reçu en attente bloque un candidat : sans validation, il ne retire pas le dossier et ne dépose pas d'offre
(V72 et sa garde du 06/10). La PRMP ne l'apprend que par la notification `RECU_A_VALIDER`, et l'UGPM, qui n'a pas de centre de
notifications, ne l'apprend pas du tout. Ni le menu ni la liste des appels d'offres (`GET /api/dmcs/eligibles`) ne le disent.

Les noms ci-dessous sont **proposés** : le backend fait autorité, et ce document sera corrigé en place si la livraison s'en écarte.

## B1 — Une pastille sur « Appels d'offres »

- `GET /api/kpis/badges` gagne, pour la **PRMP** et l'**UGPM**, `compteurs.recusAValider` : le nombre de reçus `EN_ATTENTE` sur les
  fiches de la PRMP (de sa PRMP de tutelle pour l'UGPM).
- Le front l'affiche en pastille sur l'entrée « Appels d'offres » (`/prmp/dao`). Le champ est **déjà lu** (06/10) : absent ou nul,
  pas de pastille.

> ⚠️ **2026-10-06 — livré.** Pour la PRMP, `compteurs.recusAValider` s'ajoute aux compteurs existants (`CompteursPrmpDto`). L'UGPM
> n'avait aucun compteur : elle reçoit désormais `compteurs = { recusAValider }`, calculé sur les fiches de sa PRMP de tutelle. Le
> calcul porte sur les fiches dont le plan appartient à la PRMP.

## B2 — Par fiche, dans la liste des appels d'offres

- `LigneEligible` (`GET /api/dmcs/eligibles`) gagne, pour une ligne qui porte une fiche (`dejaDao`), deux nombres :
  - `recusEnAttente` : les reçus `EN_ATTENTE` de cette fiche ;
  - `nbOffres` : les offres déposées, le **nombre** seul, comme le registre de la PRMP avant l'échéance.
- `0` ou absent pour une fiche en remise papier, ou sans fiche.
- Le front les affiche **déjà** (06/10) sous le bouton de la ligne : « 2 reçus à valider », lien vers l'écran des reçus ;
  « 3 offres déposées ».
- Un seul appel pour toute la liste : pas une requête par fiche.

> ⚠️ **2026-10-06 — livré, conforme.** `recusEnAttente` et `nbOffres` sont servis sur **chaque** ligne et valent `0` sans fiche ou
> en remise papier. Ce ne sont jamais des champs absents. `nbOffres` compte les offres déposées et les offres écartées. Le calcul
> tient en deux requêtes groupées pour toute la liste.

## Hypothèse

- **H1** — Les reçus `REFUSE` ou `VALIDE` ne comptent pas : seul `EN_ATTENTE` appelle un geste.

> ⚠️ **2026-10-06 — H1 retenue.**
