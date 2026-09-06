# Demande backend — Rectification : tolérer jusqu'à 3 ajouts et 3 retraits de lignes

> ✅ **CLÔTURÉE le 06/09** — backend livré (`94c273b`, migration **V19** : `ID_DETAIL_EXAMEN` fige
> le lien observation→marché au snapshot du PV ; garde d'écart en façade, créations/retraits dans
> MarcheService, protection des observations non levées, 4 tests `RectificationEcartIntegrationTest`) ;
> front livré (appariement par idDetail posé au montage, créations sans idDetail, suppressions par
> « ✕ », gardes miroirs et messages, badge « Nouvelle » — vérifié par interception : 4 créations
> refusées, 1 création acceptée). Nota : le diff sert le type **NOUVELLE** (pas « AJOUTEE ») —
> celui que le front affiche déjà. Backend local redémarré sur `b32db82` le 06/09 (V19 appliquée).
> Trois arbitrages backend soumis au pilote — détaillés dans la **note de livraison backend** en fin
> de document.

**Date** : 2026-09-06 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : règle pilote du
jour — « lors de la rectification du dossier de planification, il est interdit d'ajouter ou de
retirer PLUS DE 3 lignes du PPM à rectifier » : l'écart devient permis, mais borné.

## Constat

Aujourd'hui la rectification est à structure STRICTEMENT figée : le `PUT /api/saisies/ppm/{id}`
d'un dossier `EN_ATTENTE_DECISION_PRMP` exige exactement les mêmes lignes (appariement par
`idDetail`, ni ajout ni retrait) ; le front refuse d'ailleurs l'enregistrement au moindre écart.
La règle pilote assouplit : un PPM rectifié peut légitimement gagner ou perdre quelques lignes —
dans la limite de 3 dans chaque sens.

## Demande

Sur le `PUT /api/saisies/ppm/{id}` d'un dossier **en rectification** uniquement :

1. **Accepter** dans `marches[]` :
   - les lignes **avec `idDetail`** → mise à jour en place (comportement actuel inchangé) ;
   - les lignes **sans `idDetail`** → **CRÉATIONS** (nouveaux marchés complets : bénéficiaires,
     processus, justifications — mêmes validations qu'à la saisie), **au plus 3** ;
   - les `idDetail` du dossier **absents du corps** → **SUPPRESSIONS** (cascade actuelle du
     DELETE marché), **au plus 3**.
2. **Garde d'écart** : plus de 3 créations OU plus de 3 suppressions → **400** explicite nommant
   l'écart (« Le PPM rectifié ajoute N ligne(s) / en retire M : l'écart maximal autorisé est de
   3 dans chaque sens. »).
3. **Protection des observations** (proposition, à arbitrer) : refuser la suppression d'une ligne
   portant une **observation du PV non levée** (400 nominatif) — la rectification répond aux
   observations, elle ne les escamote pas.
4. **Cohérences existantes** :
   - versions archivées (V18) : inchangé — la version remplacée est archivée AVANT, telle quelle ;
   - `/diff-rectification` : restituer les lignes ajoutées/supprimées (les types `AJOUTEE` /
     `SUPPRIMEE` du diff des mises à jour existent déjà) ;
   - examen/PV : les `idDetail` conservés continuent de porter le périmètre — rien ne change pour
     les lignes appariées.

## Côté front (après livraison)

La prévisualisation d'import acceptera un écart ≤ 3 par sens (message d'aide au lieu du refus) ;
la grille permettra d'ajuster : « + Ajouter une ligne » (création, sans `idDetail`) et « ✕ »
(suppression) déjà présents ; le PUT enverra lignes appariées + créations, les suppressions étant
les `idDetail` omis.

## Tests attendus

1. Rectification avec 3 créations et 3 suppressions → 200 ; le dossier porte le nouveau contenu,
   la version remplacée est archivée, le diff montre AJOUTEE/SUPPRIMEE.
2. 4 créations (ou 4 suppressions) → 400 avec le message d'écart.
3. Suppression d'une ligne portant une observation non levée → 400 nominatif (si la proposition 3
   est retenue).
4. Rectification à structure identique → comportement actuel inchangé (anti-régression).

---

## Note de livraison backend — 2026-09-06 (`PRS20`, commit `94c273b`)

Les quatre points de la demande sont livrés, la proposition 3 est **retenue**. Suite complète verte
(780 tests). Référence du contrat : `docs/api-endpoints.md` du backend (bloc « Rectification PAR IMPORT
du PPM », § Saisies) et `docs/regles-gestion.md` (règle pilote 2026-09-06, « Rectification en attente de
décision PRMP »). Migration Flyway **`V19`**.

### Contrat du `PUT /api/saisies/ppm/{id}` en rectification

- Ligne **avec `idDetail`** : mise à jour en place, inchangé. Ligne **sans `idDetail`** : **création**,
  mêmes validations qu'à la saisie (≥ 1 processus, Σ bénéficiaires, justifications de la fiche), tracée
  `CREATION_RECTIFICATION`. `idDetail` du dossier **absent du corps** : **retrait**, cascade complète du
  DELETE marché (DMC, lots/tranches, bénéficiaires, prévisions, anomalies, échéances), tracé
  `SUPPRESSION_RECTIFICATION`.
- **Garde évaluée avant l'archivage V18 et avant toute écriture** : un refus ne laisse aucune trace,
  pas même une version archivée.
  - plus de 3 créations OU plus de 3 retraits → **400** : « Le PPM rectifié ajoute N ligne(s) et en
    retire M : l'écart maximal autorisé est de 3 dans chaque sens. » ;
  - `idDetail` **étranger au dossier** → **400** nominatif (« …référence un marché (n° X) qui n'appartient
    pas au dossier — une ligne nouvelle s'envoie sans idDetail ») : ce n'est pas une création
    silencieuse, c'est une erreur d'appariement ;
  - retrait d'une ligne portant une **observation du PV non levée** (ÉMISE ou MAINTENUE) → **400**
    nominatif (« …la ligne « … » (n° X) porte une observation du PV non levée — elle ne peut pas être
    retirée, la rectification doit y répondre. »).
- Les messages sont à afficher **tels quels** (`message` de l'erreur 400).
- `POST`/`DELETE /api/marches` restent réservés au BROUILLON : seule la façade tient la borne de 3.

### Ce qui ne change pas

- **Versions archivées (V18)** : la version remplacée est archivée avant, telle quelle, lignes retirées
  comprises.
- **`/diff-rectification`** : même DTO, mêmes types — une ligne ajoutée sort en **`NOUVELLE`** (le doc
  de demande disait « AJOUTEE » : le type réel est celui du diff des mises à jour, que le front affiche
  déjà), une ligne retirée en **`SUPPRIMEE`** avec `idDetail` nul, libellé et `idLigneOrigine` repris de
  la version archivée.
- Les `idDetail` conservés continuent de porter le périmètre de l'examen et des observations.

### Trois arbitrages pris sans le pilote, à lui faire valider

1. **Les lignes d'examen et les observations d'une ligne retirée sont conservées** (histoire de
   l'instruction, `t_examen_detail.ID_DETAIL` sans FK) ; seuls le marché et ses enfants métier
   disparaissent.
2. **Protection des observations : ce qui la rend possible, et sa limite.** Une observation « point »
   sans ligne détaillée « Au lieu de / Lire » n'était rattachée à aucune ligne d'examen, donc à aucun
   marché. La **V19** ajoute `t_observation_pv.ID_DETAIL_EXAMEN`, figé au snapshot du PV pour toute
   observation « point », avec reprise des observations existantes quand une ligne détaillée le
   permettait. Une observation **antérieure sans ligne détaillée reste irrattachable et ne protège rien**
   — choix : mieux vaut un retrait de trop qu'un blocage sans motif visible.
3. Une ligne **déjà supprimée logiquement** dans une version de mise à jour (`supprimee`) n'est ni comptée
   dans l'écart ni retouchée par la rectification.

### Tests livrés (`RectificationEcartIntegrationTest`)

Les quatre cas demandés : écart 3/3 accepté (contenu, version archivée à 5 lignes, diff NOUVELLE ×3 /
SUPPRIMEE ×3) ; 4 créations, 4 retraits et `idDetail` étranger refusés **sans aucune écriture** ; retrait
d'une ligne à observation non levée refusé puis accepté une fois l'observation levée (lignes d'examen et
observation conservées) ; structure identique inchangée.

### Environnement

Backend local redémarré sur `b32db82` le 06/09 : V19 appliquée sur la base de dev. Les migrations V18
et V19 sont **idempotentes** et rejouables.
