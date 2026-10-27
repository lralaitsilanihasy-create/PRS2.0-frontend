# Demande backend — 2026-10-27 — Deux lectures pour la Commission, à l'examen d'un dossier de marché

## Contexte

Le pilote a demandé de vérifier que la **grille de contrôle du dossier de marché** (sous-type `MAOO-CC`, 18 points de portée
`DOSSIER`) se contrôle sur les éléments du dossier lus en données (27/10). L'écran d'examen du Membre montre désormais :
- la fiche de présentation ;
- le PV de la CNM sur le DAO ;
- la fiche DAO ;
- la séance d'ouverture : faits, présents et signataires, lecture des offres, validité des offres ;
- le rapport d'évaluation : CAO et déclarations, détail par offre, moralité des prix, PV de validation ;
- l'attribution, avec le projet de marché ;
- le bordereau estimatif.

Toutes les lectures utilisées sont servies au Membre de la CNM : `GET /api/fiches-marche/{id}/evaluation`, `/seance`,
`/seance/lecture`, `/cao`, `/attribution`, `/attribution/lots/{lot}/projet`, `/evaluation/lots/{lot}/indicateurs-prix`,
`/evaluation/offres/{idOffre}/precisions`.

**Deux lectures sont refusées (403)** au Membre de la CNM, alors que deux points de la grille en dépendent :

| Point de la grille | Lecture refusée | Message |
|---|---|---|
| « PV d'ouverture signé et publié » : *les plis hors délai ont-ils été écartés sans ouverture ?* | `GET /api/fiches-marche/{id}/depots` (`tentativesRefusees`, R9b) | « Les dépôts se lisent par la PRMP de la fiche, son UGPM et le responsable de la procédure. » |
| « Spécifications techniques » : *les spécifications proposées sont-elles conformes, sans réserve, divergence ni omission substantielle ?* | `GET /api/fiches-marche/{id}/evaluation/offres/{idOffre}/specifications` | « Le tableau de conformité d'une offre se lit par la commission et le responsable de la procédure. » |

Aujourd'hui, l'écran le dit au lieu de le montrer :
- « les tentatives de dépôt refusées après la date limite sont portées au PV d'ouverture ; leur liste n'est pas encore servie à la
  Commission » ;
- pour les spécifications, seule la vérification d'ensemble « Conformité pour l'essentiel aux spécifications » de l'examen
  préliminaire est lisible.

## L1 — Les tentatives refusées hors délai, lisibles par la CNM

- Les profils de la CNM qui lisent le dossier de marché (Secrétaire, Président, Chef de commission, Membre, Vérificateur,
  Assistant) lisent les **tentatives refusées** de la procédure **une fois les dépôts clos**, même règle qu'aujourd'hui pour la
  PRMP. Seule la liste des tentatives est demandée, pas celle des dépôts.
- Forme au choix du backend :
  - ouvrir `tentativesRefusees` de `GET /depots` à ces profils, `depots` restant réservé ;
  - ou servir les tentatives dans `GET /seance` (`pv.tentativesRefusees`), puisqu'elles sont portées au PV d'ouverture.

> ⚠️ **2026-10-27, livré (backend) — par `GET /seance`** (Q1)
> - **`pv.tentativesRefusees`** a la même forme que dans `/depots` : `[{ horodatage, geste, motif, entreprise, nif, lot, enveloppe,
>   idOffre, dateLimite }]`.
> - **Il est servi à tout lecteur de la séance**, la Commission comprise, aux mêmes conditions que les autres lectures (un dossier de
>   marché né de la procédure, soumis et dans son périmètre).
> - **Il vaut `null` tant que la séance n'est pas ouverte.** Une séance ne s'ouvre qu'une fois les dépôts clos : la règle est donc la
>   même que pour la PRMP. Une fois la séance ouverte, une liste vide veut dire qu'aucune tentative n'a été refusée.
> - **`GET /depots` reste fermé à la Commission** (403) : le registre des dépôts n'est pas ouvert.

## L2 — Le tableau de conformité d'une offre, en lecture, pour la CNM

- `GET /evaluation/offres/{idOffre}/specifications` en **lecture seule** pour les mêmes profils de la CNM, **après la clôture de
  l'évaluation** (rapport signé) : la Commission contrôle les cotes de la CAO, elle ne les modifie pas.
- Si le tableau porte des informations réservées à la CAO, le backend les retire de cette lecture et le dit.

> ⚠️ **2026-10-27, livré (backend)**
> - **La Commission du dossier de marché lit le tableau une fois le rapport d'évaluation signé.** Avant, elle reçoit un 403 avec le
>   message « … se lit par la Commission une fois le rapport d'évaluation signé ».
> - **Rien n'est retiré** : le tableau ne porte rien de réservé à la CAO. La Commission lit les mêmes champs : l'exigé, le proposé,
>   la déclaration du candidat, la cote proposée, ainsi que la cote et l'observation retenues par la CAO.
> - **C'est une lecture seule** : la saisie des cotes passe par `PUT …/conformite`, qui reste réservé à la CAO.

## Questions

- **Q1** — Pour L1, le front préfère la lecture par `GET /seance`. Il la charge déjà, et la tentative est un fait de la séance.
- **Q2** — Le **NIF vérifié** (`entreprise.verification`) et le **STAT** servent au point « Qualification : activités et critères ».
  `GET /seance/lecture` sert le NIF et son statut de vérification, mais pas le STAT. Le STAT peut-il être servi avec le NIF ?

> ⚠️ **2026-10-27, réponses (backend)**
> - **Q1 — Oui, par `GET /seance`** : voir L1.
> - **Q2 — Oui.** `GET /seance/lecture` sert désormais `offres[].entreprise.stat`, le STAT déclaré par l'entreprise. Il vaut `null`
>   s'il n'a pas été déclaré.
>   - Il n'est pas servi dans la relecture de son offre par le candidat, qui ne reçoit pas le bloc `entreprise`.
>   - **Le STAT n'est pas vérifié** : `verification` ne concerne que le NIF. Le contrôle du STAT reste au jugement de la
>     Commission.
