# Demande backend — 2026-10-20 — La fiche de présentation du dossier de marché

## Contexte

Le pilote a lu la fiche de présentation du dossier de marché 100383 (produits d'entretien, ligne 303338, procédure
13-CC/MEF/SG/PRMP.2026, `MAOO-CC`) et demande : « est-ce vraiment la fiche de présentation d'un dossier de marché ? »

`GET /api/dossiers/100383/fiche-presentation` sert aujourd'hui, dans cet ordre :

| Section | Contenu | Pertinent pour le marché ? |
|---|---|---|
| `IDENTIFICATION` | autorité, ministère, PRMP, plan, ligne | oui |
| `MARCHE` | objet, catégorie, mode, forme, lots, montant estimatif, financement, imputation | oui |
| `PROCEDURE` | mode de remise, plateforme, date limite, validité, garantie, puis les **dates prévues** du DAO (`B04-CP-01` à `B04-CP-08`) | en partie : les dates prévues ne disent pas ce qui s'est passé |
| `ATTRIBUTION` (V137) | lot, dossier de mise en concurrence, titulaires proposés, délai, rapport signé le | oui : c'est l'objet du dossier, mais il arrive en 4e position |
| `CALENDRIER_PLAN` | les étapes du DAO prévues au plan | non : c'est le contrôle du DAO |
| `COHERENCE` | « Lancement prévu 09/06/2026, DAO disponible 19/10/2026, retard 132 jours » | non : c'est le contrôle du DAO |
| `VALIDATION` | version de la fiche DAO, validée le, dossier de marché créé le | en partie |

Côté front (fait le 20/10) : l'écran titre désormais « Fiche de présentation du **dossier de marché** » (lot n° 1, issue de
l'attribution) quand la section `ATTRIBUTION` est servie, au lieu de « du dossier d'appel d'offres · fiche DAO, version 1 ». Le contenu
et l'ordre restent ceux du serveur, et le PDF aussi.

## B1 — Une fiche propre au dossier de marché

Le manuel de contrôle (p. 50-52, « Examen de marché et contrat-cadre sur appel d'offres ouvert ») fait vérifier : la date de
1re publication de l'avis et le délai de remise, la séance d'ouverture (dates, signataires, quorum), l'évaluation (conformité,
corrections, offres anormales, qualification, classement), le PV de validation. La fiche devrait présenter ces faits, pas ceux du
contrôle du DAO.

Proposition, pour un dossier de marché né d'une attribution :

| Ordre | Section | Lignes |
|---|---|---|
| 1 | `IDENTIFICATION` | inchangée |
| 2 | `MARCHE` | inchangée |
| 3 | `ATTRIBUTION` | lot ; **titulaires par rang, chacun avec son montant HT, TTC et son délai** (aujourd'hui une seule chaîne) ; **écart à l'estimation** (ici 179 570 562 contre 231 563 789, soit −22,5 %) |
| 4 | `MISE_EN_CONCURRENCE` (nouvelle) | dossier de mise en concurrence et **avis de la Commission** (référence du PV, date, avis) ; **date de 1re publication** de l'avis ; date limite de remise ; **délai de remise effectif** (de la publication à la date limite, en jours) |
| 5 | `SEANCE` (nouvelle) | ouverte le, offres reçues / ouvertes / non ouvertes, PV d'ouverture signé le, quorum |
| 6 | `EVALUATION` (nouvelle) | offres évaluées, conformes, écartées ; corrections ; offres anormales ; qualifiées ; rapport signé le, quorum (le PV de validation) |
| 7 | `VALIDATION` | dossier de marché créé le, **par** (la PRMP, nommée) |

Et pour un dossier de marché, ne plus servir `CALENDRIER_PLAN`, `COHERENCE`, ni les dates prévues `B04-CP-*` dans `PROCEDURE`. Elles
restent sur la fiche du dossier de mise en concurrence.

Le PDF suit la même structure.

## Questions

- **Q1 — Les dates prévues du DAO.** Faut-il les garder sous forme de comparaison « prévu / réalisé » (attribution prévue le 04/12/2026,
  notification prévue le 21/12/2026…), utile pour suivre le calendrier, ou les retirer tout à fait ?
- **Q2 — La signature.** Le pilote doit encore confirmer que la création nominative du dossier de marché vaut signature de la fiche.
  En attendant, l'écran l'écrit « à confirmer ».
- **Q3 — Le contrat-cadre.** Pour plusieurs titulaires, l'écart à l'estimation se calcule-t-il sur l'offre du rang 1 seulement ?
