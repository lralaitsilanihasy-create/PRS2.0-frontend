# Demande backend — DBPRS20 : remise à zéro de toutes les données de dossiers

**Date** : 2026-09-29 · **Émetteur** : front, sur décision du pilote (« remettre à zéro les données de tous les
dossiers, c'est-à-dire réinitialiser ») · **Exécutant** : backend (choix du pilote).

## B1 — Vider DBPRS20, au périmètre du 25/09, sans resemis

Périmètre retenu par le pilote : **le même que le vidage du 25/09**
(`docs/demo/vidage-total-dossiers-2026-09-25.sql`), **sans resemis**.

- **Supprimé** : tous les dossiers, PPM, lignes de marché, DMC et fiches DAO (versions, valeurs, documents produits),
  avec tout ce qui en dépend : lots, tranches, bénéficiaires, prévisions, échéances, anomalies, pièces jointes, circuit,
  examens, PV, observations et leur suivi, lettres de renvoi, versions archivées, instantanés, journal des dossiers,
  notifications, messages, demandes de retrait.
- **Gardé** : référentiels (dont celui des champs de la fiche, tel que f7d27df l'a laissé), comptes, mandats, intérims,
  journal technique (`t_audit_log`), indicateurs agrégés, compteurs de référence (`t_sequence_reference`).

## B2 — Mettre le script à jour avant de le rejouer

Le script du 25/09 date d'avant V43. Les migrations passées depuis ont pu ajouter des données rattachées à une fiche,
un DMC, un dossier ou une ligne, que le script ne connaît pas. Repérées côté front, **sans garantie d'exhaustivité** :

Pour chacune, le backend dit si c'est une donnée de dossier (à vider) ou du paramétrage (à garder) :

| Migration | À examiner |
|---|---|
| V44 | observations portant sur un champ de la fiche |
| V45 | `t_fiche_article`, `t_fiche_caracteristique` (besoin de la fiche) |
| V49 | rectification du dossier DAO |
| V50 | `t_parametre_interne_procedure`, `t_parametre_interne_journal`, `t_responsable_procedure` (remise électronique) |
| import du DAO (89f8bb3) | journal `FICHE_IMPORTEE` |

Attendu : l'inventaire vient des **clés étrangères de la base**, pas de cette liste. Une table de données de dossier
oubliée ferait échouer la transaction (sans dégât), ou laisserait des restes sans clé étrangère ; c'est ce second cas
qui compte. Le script mis à jour est un **nouveau fichier daté** ; celui du 25/09 reste tel quel.

## B3 — Exécution et preuve

- Une transaction ; `ON_ERROR_STOP` ; rejouable sur une base déjà vide.
- **Comptes avant et après** dans l'encadré : dossiers, PPM, lignes, DMC, versions de fiche, valeurs, documents,
  examens, PV, pièces. Après : tout à 0.
- Serveur de recette **redémarré** après le vidage (caches).
- Contrôle écran rapide : `GET /api/dossiers` et `GET /api/dmcs/eligibles` renvoient une liste vide, et les écrans
  PRMP tiennent sur une base vide (0 erreur 5xx), comme vérifié le 25/09.

## Conséquences, assumées par le pilote

- **La fiche 27** (ligne 303095, seul contrat-cadre, banc de l'import du DAO) et **le dossier 2463** disparaissent.
  Les mesures de l'import (`scripts/import-dao/mesurer.mjs --dmc=27`, `--dmc=16`) ne tournent plus avant qu'une
  démonstration soit remontée. Les documents et PDF déjà extraits dans l'espace de travail du front restent
  utilisables comme fichiers.
- Les **CCAP produits avec l'article 3 erroné** (depuis D2) disparaissent avec leurs fiches : ce point en suspens se
  referme de lui-même.
- Les **214 valeurs** conservées des champs retirés le 29/09 disparaissent aussi.
- Pour remonter une démonstration plus tard : saisir un PPM, le faire signer, puis `node scripts/demo-dao.mjs <idDetail>`.

## Ce que le backend rend

Le script daté, les comptes avant/après et le redémarrage, dans un encadré ⚠️ daté ici. Toute table ajoutée au
périmètre, ou laissée volontairement hors du périmètre, y est nommée avec sa raison.

> ⚠️ **Exécution backend du 2026-09-29.** DBPRS20 est vidée, au périmètre du 25/09 et sans resemis. Script daté :
> `docs/demo/vidage-total-dossiers-2026-09-29.sql` (dépôt PRS20). Celui du 25/09 reste tel quel.
>
> **Inventaire par les clés étrangères (§B2).** La fermeture des clés étrangères vers `t_dossier`, `t_ppm`, `t_marche`,
> `t_dossier_mec` et `t_fiche_marche` compte 42 tables. Cinq manquaient au script du 25/09 et sont **ajoutées** :
> - `t_fiche_article` et `t_fiche_caracteristique` (V45, le besoin de la fiche) : données de dossier, 95 et 374 lignes ;
> - `t_parametre_interne_procedure`, `t_parametre_interne_journal` et `t_responsable_procedure` (V50, par DMC) :
>   données de dossier, 1, 6 et 2 lignes.
>
> Les autres points de la liste du front :
> - **V44** (observations sur un champ de la fiche) et **V49** (rectification du dossier DAO) n'ont ajouté que des
>   colonnes à des tables déjà vidées.
> - **Le journal `FICHE_IMPORTEE`** est dans `t_action_dossier`, déjà vidée.
> - **Tables sans clé étrangère** : parmi celles qui portent une colonne de dossier (`ID_DOSSIER`, `ID_DMC`, `ID_FICHE`,
>   `ID_DETAIL`…), aucune n'échappait au script. La seule relevée, `t_snapshot_stats`, porte des indicateurs agrégés.
>   Elle est **laissée hors du périmètre** volontairement : elle est gardée, et vide.
> - **Sept tables** du script du 25/09 ne sont pas dans la fermeture des clés étrangères : `t_action_dossier`,
>   `t_changement_ligne`, `t_observation_pv`, `t_piece_demande_retrait`, `t_suivi_observation`, `t_transmission_sigmp`
>   et `t_verification_piece_depot`. Elles restent vidées, comme le 25/09.
>
> Le périmètre compte donc 49 tables. Un bloc final les compte toutes et **annule la transaction** s'il en reste une
> ligne. Cela couvre le cas des restes sans clé étrangère.
>
> **Comptes (§B3)**, relevés par le passage à blanc (`ROLLBACK`), puis identiques à l'exécution réelle (`COMMIT`) :
>
> | | dossiers | PPM | lignes | DMC | versions de fiche | valeurs | documents | examens | PV | pièces |
> |---|---|---|---|---|---|---|---|---|---|---|
> | avant | 7 | 3 | 10 | 6 | 20 | 1975 | 432 | 6 | 6 | 92 |
> | après | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
>
> - « Périmètre vide : 49 tables à 0 ». Le script est rejoué ensuite sur la base vide : il ne supprime rien et passe.
> - **Gardé**, vérifié après coup : 670 champs du référentiel de la fiche, 36 533 lignes de `t_audit_log`, 7 compteurs
>   `t_sequence_reference`, 1 intérim.
> - **Mandats : 0**, et déjà 0 avant le vidage. Le script ne touche pas `t_mandat`.
> - **Serveur de recette redémarré** après le vidage (PID 24856), sans erreur au démarrage. `GET /api/dossiers` et
>   `GET /api/dmcs/eligibles` répondent 401 sans jeton : le backend n'a pas de mot de passe de compte de recette, et n'en
>   a ni deviné ni fabriqué.
> - **Contre-recette front attendue** : ces deux listes vides sous un compte PRMP, et 0 erreur 5xx sur les écrans PRMP.
>   Les tables qu'elles lisent sont à 0.

> ⚠️ **Contre-recette front du 2026-09-29 : conforme.**
> - **API**, sous deux comptes PRMP réels (PRMP001, LERAVO ; connexion 200) : `GET /api/dossiers`,
>   `/api/dmcs/eligibles`, `/api/ppms` et `/api/marches` répondent 200 avec 0 élément.
> - **Écrans PRMP** (Chrome réel, `ng serve`, compte PRMP001) : À faire, Suivi des dossiers CNM, Préparer un DAO, Créer
>   dossier, Mes PPM & marchés. Aucune erreur JavaScript, aucune réponse 5xx, aucun état d'erreur. Chaque liste affiche
>   un état vide explicite. « Créer dossier » est un écran de saisie, sans liste : il n'a pas d'état vide à montrer.
