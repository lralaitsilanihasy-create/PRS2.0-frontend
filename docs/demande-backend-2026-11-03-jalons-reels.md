# Demande backend — 2026-11-03 — Les dates réelles des jalons d'une ligne, déduites de ses dossiers

## Contexte

Le pilote a fait du **plan de passation** l'écran de travail de la PRMP (`/prmp/plan`, livré en trois lots le 03/11). Ouvrir une
ligne montre ses jalons : la date **prévue** au plan (`t_marche_prevision`, un processus CAPM) face à la date **réelle**.

Aujourd'hui, la date réelle se lit sur `GET /api/echeances` (`dateReelle`), comme dans « Calendrier des jalons ». Or :
- `t_echeance` est **vide** en recette, et aucun flux n'y écrit de `DATE_REELLE` : seul `AlerteScheduler` enregistre une
  échéance ;
- l'écriture est réservée à l'Administrateur, et aucun profil métier ne saisit ces dates (§ « Échéances » de `api-endpoints.md`).

Résultat : tous les jalons passés s'affichent « prévu dépassé de N jours ». C'est le cas même quand l'étape a eu lieu : la
voie rapide de Sambava (ligne 303414) a son DAO examiné et clôturé (00002/DAOO-CC, 28/10/2026) et son avis imprimé, mais
ses jalons « Examen et avis de la CNM » et « Lancement du DAO/DC » restent sans date réelle.

Le serveur connaît pourtant ces dates : dépôt et clôture des dossiers, signature des PV, impression de l'avis, séance
d'ouverture, rapport d'évaluation, attribution, signature du contrat.

## B1 — Les dates réelles d'un plan, calculées à la lecture

Une lecture **par plan**, sans stockage, appelée une fois par écran :

`GET /api/dossiers/{idPlan}/jalons-reels` → `[{ idDetail, idCapm, dateReelle, source }]`

- une entrée par ligne du plan et par processus CAPM dont la date réelle est connue ; rien pour les autres ;
- `source` : ce qui donne la date, en clair, par exemple « Clôture du dossier 00002/DAOO-CC/CNM/2026 » ou « Première
  impression de l'avis » (le front l'affiche en infobulle) ;
- même périmètre que `GET /api/dossiers/{id}/filiation` (403 hors périmètre) ;
- une requête par nature de fait pour tout le plan, pas une par ligne.

Le **rapprochement processus → fait** est à fixer par le backend. Il connaît le libellé de chaque processus
(`tr_capm`), ses variantes par mode et ce que chaque flux enregistre. Le front propose, pour les processus présents en
recette :

| Processus CAPM (début du libellé) | Fait proposé |
|---|---|
| Élaboration et publication de l'avis général… | Dépôt de la publication de l'AGPM sur le plan (V118) |
| Transmission du DAO/DC à la CNM | Réception du dossier de mise en concurrence |
| Examen et avis de la CNM (DAO) | Avis de la Commission sur ce dossier |
| Établissement / Signature du PV de la CNM (DAO) | Projet de PV ; PV signé |
| Lancement du DAO/DC : avis spécifique… | Première impression de l'avis (`avisImprimeLe`) ou des lettres d'invitation |
| Remise des offres | Date limite de remise de la fiche |
| Ouverture des plis | Séance d'ouverture |
| Évaluation et classement des offres | Signature du rapport d'évaluation |
| Transmission du projet de marché à la CNM | Réception du dossier de marché |
| Examen / PV / Signature du PV (marché) | Avis, PV, PV signé du dossier de marché |
| Décision d'attribution de marché | Attribution du lot |
| Mise au point… et signature du marché | Signature du contrat (`essentiel.contrat.signeLe`) |

Pour une ligne à plusieurs lots, le front propose de prendre la **première** date atteinte, avec le lot dans `source`.

## Questions

- **Q1** — Faut-il garder `t_echeance` pour les alertes J-7 / J-1 et ne rien y écrire de plus ? Le front lirait alors les deux
  sources : la date réelle calculée, à défaut `dateReelle` de l'échéance.
- **Q2** — Un processus sans fait correspondant, comme « Détermination des besoins », reste-t-il sans date réelle ? Le front
  suppose que oui et l'affiche « non renseigné », sans retard.

## Ce que fait le front

À la livraison, le détail d'une ligne (`/prmp/plan`) et le calendrier des jalons liront ces dates. Un jalon sans date
réelle et sans fait possible (Q2) ne sera plus compté en retard. Rien n'est codé contre cette route avant sa livraison.

> ⚠️ **2026-11-03 — B1 livré (PRS20, sans migration), le rapprochement fixé ; réponses à Q1 et Q2.**
> - **La route** : `GET /api/dossiers/{idPlan}/jalons-reels` → `[{ idDetail, idCapm, dateReelle, source }]`, comme demandé.
>   - `source` porte le fait **et sa date** : « Réception du dossier 00002/DAOO-CC/CNM/2026, le 02/06/2026 ».
>   - Erreurs : 409 `PAS_UN_PLAN` si le dossier n'est pas un plan ; 403 et 404 comme la filiation.
>   - Lecture : une requête par nature de fait pour tout le plan.
> - **Le rapprochement** (par identifiant de processus, la recette n'ayant que les processus 101 à 130 et les anciens 1, 3, 4) :
>   - **102** : publication de l'AGPM, sur ce plan ou une version antérieure ;
>   - **106 / 107 / 108 / 109** : le dossier de mise en concurrence — première réception, date du PV (avis), soumission du PV à la
>     signature (à défaut sa date), signature du PV ;
>   - **111** : première impression de l'avis spécifique ou des lettres ;
>   - **112** : date limite de remise de la dernière version validée de la fiche, **une fois passée** ;
>   - **113 / 114 / 115** : ouverture de la séance, signature du rapport d'évaluation, signature du PV d'ouverture ;
>   - **117 à 120** : le dossier de marché d'un lot (ou un marché rattaché hors fiche, V163) — réception, avis, soumission, signature ;
>   - **123 à 129** : l'attribution du lot — décision, information des non-retenus, signature, **visa** (126), **approbation**
>     (127), **enregistrement** (128), **notification** (129) ;
>   - **anciens processus** : 1 = 111, 3 = 113, 4 = 123.
> - **Écarts avec le tableau proposé** :
>   - **107** prend la date du PV de la Commission, qui porte l'avis : l'examen n'a pas de date d'avis propre.
>   - **108** prend la soumission du PV à la signature, plutôt qu'un « projet de PV » qui n'a pas de date.
>   - **125** prend la date de signature saisie à l'attribution, à défaut l'instant de la saisie ; c'est ce que sert
>     `essentiel.contrat.signeLe`.
>   - Les étapes **126 à 129** sont ajoutées : leurs dates existent.
> - **Faits des autres versions** : les faits des copies de la ligne dans les autres versions du plan comptent (même
>   `idLigneOrigine`).
> - **Q1** : oui. `t_echeance` reste aux alertes J-7 / J-1 et rien n'y est écrit de plus. Le front lit la date calculée, à défaut
>   `dateReelle` de l'échéance.
> - **Q2** : oui. Un processus sans fait n'a pas de date réelle : 101, 103, 104, 105, 110, 116, 121, 122 et 130.