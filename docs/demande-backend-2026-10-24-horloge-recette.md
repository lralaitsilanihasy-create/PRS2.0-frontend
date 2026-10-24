# Demande backend — 2026-10-24 — Horloge de recette et régénération des actes figés

## Contexte

Le pilote demande une chaîne de recette **cohérente de la planification au dossier de marché** (24/10). Elle a été jouée sur la
ligne 303336 du plan `00001/PPM-AGPM/CNM/2026`, l'entretien et la réparation des véhicules administratifs (contrat-cadre, remise
électronique) :

| Étape | Donnée | Date réelle |
|---|---|---|
| Fiche DAO `14-CC/MEF/SG/PRMP.2026` (idDmc 4, fiche 11) | validée, montant indicatif = plan (1 132 856 709 Ar HT) | 24/10 |
| Dossier `00004/DAOO-CC/CNM/2026` (100384) | PV FAV signé `00004/DAOO-CC/CNM/PV/2026`, clôturé | 24/10 |
| Cérémonie des clés | close (2 membres + secours) | 24/10 |
| Avis spécifique | publication déclarée le **26/10** | 24/10 |
| 3 garages candidats | reçus validés, offres scellées et déposées | 24/10, 13:32-13:33 |
| Séance d'ouverture | quorum atteint, 3 offres intactes, PV signé | 24/10, 13:35-13:39 |
| Évaluation | 3 offres conformes et qualifiées, rapport signé | 24/10, 13:40-13:41 |
| Dossier de marché MAOO-CC (100385) | soumis, projet de marché produit | 24/10, 13:42 |

Le calendrier de la fiche, lui, est dans l'ordre :
- publication le 26/10 ;
- remise des offres le 27/11 à 09:00 ;
- évaluation le 30/11 ;
- attribution le 11/12 ;
- notification le 28/12.

Le serveur vit à l'heure réelle. Pour jouer la chaîne en un jour, le front a dû **retoucher deux valeurs de la fiche validée en
base** (`t_fiche_marche_valeur`, fiche 11) :
- `B04-SE-03` (ouverture des dépôts) : 26/10 → 24/10 00:00 ;
- `B04-CP-02` (heure limite) : 27/11 09:00 → 24/10 13:35.

Elles **ne peuvent pas être remises** : l'état de la procédure en ligne (`ProceduresEnLigneService.construire`) se calcule sur
ces deux dates. La procédure redeviendrait `A_VENIR`, puis `OUVERTE`, alors que ses plis sont ouverts et évalués.

Décaler en base les horodatages des événements (une quarantaine de colonnes, de `t_recu_dao` à `t_dossier_instantane`) ne suffit
pas non plus. Les actes signés sont des PDF **figés à leur production** :
- `t_seance.PV` / `PV_PUBLIC` : « Séance ouverte le 24/10/2026 à 13:35 », « Date limite de remise des offres : 2026-10-24T13:35 » ;
- `t_evaluation_rapport.PDF` / `DOCX` : « signé électroniquement… le 24/10/2026 à 13:41 », déclarations « à 13:40 », et leurs
  copies en pièces du dossier 100385.

Les écrans diraient 27/11, les actes 24/10. La même limite a déjà produit, le 19/10, la chaîne des produits d'entretien
(`13-CC/MEF/SG/PRMP.2026`) : délai de remise de quelques heures, et calendrier de la fiche postérieur à la séance.

## R1 — Une horloge de recette décalable

- **Une horloge réglable, en développement seulement** : par exemple une propriété `prs.recette.horloge` (instant de départ, ou
  décalage), lue par `ClockConfig` sous un profil de développement. En production, le bean reste `Clock.systemDefaultZone()`.
- **Le réglage à chaud** serait le plus utile : avancer l'horloge entre deux étapes d'un parcours, sans redémarrer le serveur. Le
  front n'a pas d'avis sur la forme (route réservée à l'Administrateur sous ce profil, ou fichier relu). Le backend choisit.
- **Toute la règle du temps passe par l'horloge.** 18 services la lisent déjà (`maintenant()` sur l'horloge injectée, par exemple
  `OffreService`). En revanche, 63 fichiers appellent encore `LocalDateTime.now()` / `LocalDate.now()` directement, dont
  `FicheMarcheService` (l. 193, échéance de la remise). Le front ne sait pas lesquels comptent pour la recette. Ceux qui
  horodatent un événement ou jugent un délai sont concernés :
  - dépôt, heure limite, paiement des frais ;
  - séance, signatures, journaux.
- **Le journal garde la vérité.** Une entrée faite sous horloge décalée porte la mention de la date réelle, dans le journal de la
  procédure et dans le journal général. Ainsi, une recette ne se confond pas avec un fait.

Ce que le front en fera : jouer chaque étape à la date de la fiche (publication le 26/10, dépôts en novembre, séance le 27/11,
évaluation, puis dossier de marché le 07/12). Plus aucune retouche en base.

> ⚠️ **2026-10-24, livré (backend, ADR-0016)**
> - **Propriété** : `app.recette.horloge.active` (préfixe `app.` comme les autres réglages, et non `prs.`), variable
>   `APP_RECETTE_HORLOGE=true`, posée par `lancer-backend-jar.cmd`. Pas de profil Spring, le projet n'en a pas. Hors recette, le bean
>   reste `Clock.systemDefaultZone()`.
> - **Réglage à chaud** par l'Administrateur, routes présentes en recette seulement (404 ailleurs, 403 hors Administrateur) :
>   - `GET /api/admin/horloge-recette` → `{ maintenant, heureReelle, decalage, decalageMinutes, decalee }` ;
>   - `PUT` avec `{ maintenant: "2026-11-27T09:30:00", motif }` (poser une date) **ou** `{ avancer: "PT2H" | "P3D" | "-PT30M", motif }`
>     (avancer d'une durée) ; 400 `MAINTENANT_OU_AVANCER`, `DUREE_INVALIDE` ;
>   - `DELETE ?motif=` → retour à l'heure réelle.
> - **Le décalage survit au redémarrage** : il est gardé dans `${user.home}/prs-horloge-recette.txt` et relu au démarrage. Une
>   reconstruction du JAR ne ramène donc pas la recette à l'heure réelle ; il faut un `DELETE`.
> - **Toute la règle du temps** : les 170 appels directs à `now()` (63 fichiers, dont `FicheMarcheService` l. 193) lisent désormais
>   l'horloge, et un test interdit d'en ajouter. Trois exceptions gardent l'heure réelle : les jetons de connexion (avancer l'horloge
>   ne déconnecte personne), les sessions, l'horodatage des réponses d'erreur.
> - **Le journal** : sous horloge décalée, chaque entrée est datée à l'heure de recette et porte `[recette — heure réelle : 24/10/2026
>   13:46]` dans son détail. C'est vrai du journal général, du journal du dossier, des journaux de l'offre, du reçu, de la séance, de
>   l'évaluation et des modèles. Chaque réglage est tracé (`HORLOGE_RECETTE`, ancien → nouveau décalage, motif).

## R2 — Régénérer les actes figés d'une procédure de recette

- **La régénération des actes produits** d'une procédure (PV d'ouverture et sa version publique, rapport d'évaluation PDF et
  Word, copies en pièces du dossier de marché encore modifiable), **à partir des données**, en développement seulement.
- **Cas d'usage** : remettre d'accord les actes et les données après un recalage, ici la chaîne de l'entretien des véhicules,
  une fois ses horodatages décalés.
- **Garde-fous** : profil de développement seulement, Administrateur, journalisé avec motif.

> ⚠️ **2026-10-24, écarté (backend, accord du pilote)** — pas de régénération des actes figés. Un acte signé est une pièce : le
> refaire à partir des données, même en recette, ouvrirait une porte qu'on ne veut pas voir en production. Voir Q1.

## Questions

- **Q1 — R1 suffit-il ?** Avec R1, une chaîne neuve se joue aux bonnes dates : R2 ne sert plus qu'à réparer les chaînes déjà
  jouées. Si R2 coûte cher, le front propose de s'en passer et de **rejouer** la chaîne de l'entretien des véhicules sur une autre
  ligne du plan.
- **Q2 — Les deux valeurs retouchées** de la fiche 11 (`B04-SE-03`, `B04-CP-02`) : le backend préfère-t-il les remettre lui-même
  après R1/R2, ou laisser le front le faire, avec le décalage des horodatages ? La table de correspondance est prête côté front.
  Elle garde l'ordre des événements :
  - reçus du 03 au 10/11 ;
  - offres les 24, 25 et 26/11 ;
  - séance le 27/11, de 09:30 à 11:40 ;
  - évaluation du 30/11 au 04/12 ;
  - dossier de marché le 07/12.

> ⚠️ **2026-10-24, réponses (backend)**
> - **Q1 — R1 suffit.** R2 n'est pas fait. La chaîne de l'entretien des véhicules se **rejoue** sur une autre ligne du plan, aux
>   dates de la fiche, l'horloge étant avancée entre deux étapes.
> - **Q2 — Ni l'un ni l'autre.** Puisque la chaîne est rejouée, la fiche 11 et sa chaîne du 24/10 (100384, 100385) restent en l'état,
>   comme chaîne abandonnée. Il n'y a pas de décalage d'horodatages ni de remise des deux valeurs. Seule réserve : si l'on veut que la
>   ligne 303336 elle-même porte la chaîne propre, il faudra d'abord libérer la ligne. Le dire au backend.
