# Demande backend — 2026-10-06 — Dossier payant : le reçu validé garde aussi les formulaires et le dépôt de l'offre

> Décision du pilote (06/10), « A » : tant que le reçu des frais de dossier n'est pas validé, le candidat ne voit pas les formulaires
> de l'offre et ne peut pas déposer. Suite de `demande-backend-2026-10-06-retrait-apres-paiement.md` (V72).

**Le constat.** En V72, la garde « reçu validé » (§B4) ne porte que sur `GET …/documents/{code}`. Un candidat qui n'a pas payé
peut encore :
- **lire le besoin** : `GET /api/procedures-en-ligne/{idDmc}/besoin` sert les articles, les quantités du DQE, les caractéristiques,
  les seuils, le matériel et le personnel, c'est-à-dire une part du contenu payant, que l'écran de dépôt affiche pré-rempli ;
- **déposer une offre** : la séance la signale par `FRAIS_NON_REGLES`, mais elle arrive jusqu'à l'ouverture.

La recette du 06/10 (fiche 48) l'a montré : l'entreprise 2, sans reçu, a déposé une offre complète.

Les noms ci-dessous sont **proposés** : le backend fait autorité, et ce document sera corrigé en place si la livraison s'en écarte.

---

## B1 — Le besoin, gardé comme les documents

- `GET /api/procedures-en-ligne/{idDmc}/besoin` répond **403 `FRAIS_NON_REGLES`** quand `retraitPayant` est vrai et que l'entreprise
  du compte n'a aucun reçu `VALIDE`.
- La règle est celle des documents : **un lot payé ouvre tout le besoin** (§B4 de la V72).
- Sans entreprise déclarée : la même réponse que les documents.
- Un retrait libre ne change pas.

> ⚠️ **2026-10-06 — livré, conforme.** Le besoin répond 403 `FRAIS_NON_REGLES` sous la règle des documents. Un reçu `VALIDE` de
> l'entreprise sur n'importe quel lot ouvre tout le besoin. Sans entreprise déclarée, la réponse est la même. Pour un retrait libre,
> rien ne change.

## B2 — La création d'une offre, gardée par lot

- `POST /api/candidat/offres` (création, remplacement compris) répond **403 `FRAIS_NON_REGLES`** quand `retraitPayant` est vrai et
  qu'aucun reçu `VALIDE` de l'entreprise ne couvre **le lot de l'offre** (`lots = null` couvre tout le dossier ; un marché non alloti
  n'a qu'un « lot »).
- C'est la même règle que l'alerte de séance (« sans reçu validé couvrant le lot de l'offre »), appliquée en amont.
- Les routes suivantes (morceaux, scellement) ne changent pas : elles suivent une création déjà acceptée.
- **Les offres déjà déposées** ne sont pas touchées, et l'alerte `FRAIS_NON_REGLES` de la séance reste comme filet (offre déposée
  avant cette livraison, reçu qui ne couvre pas le lot…).

> ⚠️ **2026-10-06 — livré, conforme.** La garde porte sur `POST /api/candidat/offres`, création comme remplacement. Elle joue
> **après** les conditions existantes : `PROCEDURE_FERMEE` / `DELAI_DEPASSE`, `CLES_INDISPONIBLES`, `ENTREPRISE_ABSENTE`,
> `ENTREPRISE_EXCLUE`, puis le contrôle du lot. Un candidat sans entreprise reçoit donc d'abord 409 `ENTREPRISE_ABSENTE`. Les
> morceaux et le scellement ne sont pas gardés, et les offres déjà déposées ne sont pas touchées.

## Hypothèses

- **H1** — `GET …/pieces` reste public et inchangé : il dit **ce qu'il faudra joindre**, pas le contenu du dossier.
- **H2** — Le reçu déposé et non encore validé (`EN_ATTENTE`) ne suffit pas : c'est la validation qui fait preuve.
- **H3** — Aucun délai de grâce près de la date limite. La PRMP reçoit `RECU_A_VALIDER` à chaque dépôt ; à elle de traiter avant
  l'échéance.

> ⚠️ **2026-10-06 — H1, H2 et H3 retenues.** `GET …/pieces` reste public. Un reçu `EN_ATTENTE` ne suffit pas, et il n'y a pas de
> délai de grâce.

## Ce que le front fait déjà (06/10, sans attendre)

- **L'écran de dépôt** lit le reçu de l'entreprise (`GET …/recus/mien`). Pour un retrait payant sans reçu validé, il **ne s'ouvre
  pas** : il dit pourquoi, avec un lien vers la section « Frais de dossier » de la procédure. Le besoin n'est alors pas demandé.
- **La page de la procédure** désactive « Déposer une offre » tant que le reçu n'est pas validé, avec la raison.
- Les codes `FRAIS_NON_REGLES` sur le besoin et sur la création sont nommés, si le serveur les renvoie le premier (reçu annulé
  entre-temps, autre onglet…).
