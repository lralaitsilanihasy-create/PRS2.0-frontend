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

> ⚠️ **2026-10-20, livré (backend), avec deux ajustements**
> - **L'ordre servi** : `IDENTIFICATION`, `MARCHE`, `ATTRIBUTION`, `MISE_EN_CONCURRENCE`, `PROCEDURE`, `SEANCE`, `EVALUATION`,
>   `PREVU_REALISE`, `VALIDATION`. Le PDF suit le même ordre.
> - **Ajustement 1, `PROCEDURE` reste**, entre la mise en concurrence et la séance. Elle porte les conditions de la mise en
>   concurrence que le contrôle vérifie : mode de remise, lieu, validité des offres, garantie. Elle perd la date limite, passée dans
>   `MISE_EN_CONCURRENCE`, et les dates prévues `B04-CP-*`.
> - **Ajustement 2, les titulaires** : une ligne par titulaire, `TITULAIRE_<rang>`. Sa valeur porte, une information par ligne, le
>   candidat et l'offre, le montant HT, le montant TTC et le délai. `TITULAIRES` n'est plus servie. Un attributaire unique garde
>   `ATTRIBUTAIRE`, `MONTANT_HT`, `MONTANT_TTC` et `DELAI`.
> - **L'écart** : `ECART_ESTIMATION`, sur le montant estimatif de la ligne du plan.
> - **`MISE_EN_CONCURRENCE`** : `DOSSIER_MISE_EN_CONCURRENCE` (déplacée d'`ATTRIBUTION`), `AVIS_COMMISSION`, `PREMIERE_PUBLICATION`
>   (la date saisie à l'impression de l'avis), `DATE_LIMITE`, `DELAI_REMISE`.
> - **`SEANCE`** : `OUVERTE_LE`, `OFFRES_RECUES`, `OFFRES_OUVERTES`, `OFFRES_NON_OUVERTES` (avec leurs états), `PV_SIGNE`, `QUORUM`.
> - **`EVALUATION`** : `OUVERTE_LE`, `OFFRES_EVALUEES`, `OFFRES_CONFORMES`, `OFFRES_ECARTEES`, `CORRECTIONS`, `OFFRES_ANORMALES`,
>   `OFFRES_QUALIFIEES`, `RAPPORT_SIGNE`, `QUORUM`. Les chiffres portent sur le lot du dossier.
> - **`VALIDATION`** : `DOSSIER_CREE_LE` et `DOSSIER_CREE_PAR` seulement.
> - **Ne sont plus servis pour un dossier de marché** : `CALENDRIER_PLAN` et `COHERENCE`. Une section sans ligne n'est pas servie,
>   par exemple `SEANCE` pour un dossier sans séance en ligne.
> - **La fiche du dossier de mise en concurrence est inchangée.**

## Questions

- **Q1 — Les dates prévues du DAO.** Faut-il les garder sous forme de comparaison « prévu / réalisé » (attribution prévue le 04/12/2026,
  notification prévue le 21/12/2026…), utile pour suivre le calendrier, ou les retirer tout à fait ?
- **Q2 — La signature.** Le pilote doit encore confirmer que la création nominative du dossier de marché vaut signature de la fiche.
  En attendant, l'écran l'écrit « à confirmer ».
- **Q3 — Le contrat-cadre.** Pour plusieurs titulaires, l'écart à l'estimation se calcule-t-il sur l'offre du rang 1 seulement ?

> ⚠️ **2026-10-20, réponses (backend)**
> - **Q1 — gardées, en « prévu / réalisé ».** La section `PREVU_REALISE` ne concerne que le contrat-cadre, le seul à porter
>   `B04-CP-01` à `08`. Elle sert une ligne par étape prévue : « prévu le … ; réalisé le … » ou « non réalisé ». Le réalisé vient de :
>   - la première publication pour le lancement ;
>   - la date limite, une fois échue, pour la remise ;
>   - l'ouverture de l'évaluation ;
>   - l'attribution ;
>   - la notification ;
>   - l'information des candidats pour les courriers de rejet.
>
>   Les offres optimisées (étapes 06 et 07) relèvent des marchés subséquents et restent en « prévu » seul.
> - **Q2 — inchangé.** La création nominative vaut signature, hypothèse toujours au pilote. Le pied du PDF le dit.
> - **Q3 — oui, sur l'offre classée 1re**, et le libellé le dit : « Écart à l'estimation du plan (offre classée 1re) ». Pour 13-CC :
>   −22,5 %.
