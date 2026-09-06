# Demande backend — Rectifications : conserver CHAQUE version du PPM (historique du dossier)

> ✅ **BACKEND LIVRÉ le 06/09** (`6d9ba29` sur `main`, 776 tests verts, Word compris) — voir la
> **note de livraison** en fin de document. ⚠️ Le chemin est **`/versions-archivees`**, pas `/versions`
> (déjà pris par la chaîne des mises à jour que le front consomme). Front : section « Historique des
> versions » à livrer.

**Date** : 2026-09-06 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : demande pilote
(écran « Rectifier le dossier », 00002) — « garder les versions non rectifiées et la version
rectifiée pour l'historique du dossier ».

## Constat

La rectification par import remplace le contenu courant du dossier **en place** ; seul un
instantané du **dernier** cycle est figé (`t_snapshot_rectif_ligne`) et il ne sert que le
`/diff-rectification`. Après plusieurs cycles, les états intermédiaires sont perdus — alors que
les **mises à jour** de PPM, elles, conservent chaque version en entier. Le pilote veut le même
niveau d'historique pour les rectifications : pouvoir consulter chaque version non rectifiée ET
la version courante.

## Demande

1. **À chaque rectification validée** (le PUT `saisies/ppm/{idDossier}` d'un cycle), figer la
   version REMPLACÉE en **version archivée immuable** : numéro d'ordre, date, auteur (PRMP),
   itération de rectification, et les lignes complètes (mêmes champs que le PPM courant —
   montants, bénéficiaires, dates prévisionnelles…).
2. **`GET /dossiers/{id}/versions`** : liste des versions archivées — numéro, date, auteur,
   origine (`RECTIFICATION` ; extensible à `MISE_A_JOUR` si l'unification a du sens), nombre de
   lignes.
3. **`GET /dossiers/{id}/versions/{n}`** : contenu complet de la version (lignes), lecture seule.
4. **Reprise de l'existant** : si l'instantané du dernier cycle est encore en base, le servir
   comme première version archivée (pas de trou pour 00002).
5. Le `/diff-rectification` actuel reste inchangé (dernier cycle) ; si la mécanique du
   versionnement des mises à jour peut être réutilisée telle quelle, la préférer à une table neuve.

## Côté front (après livraison)

Section « Historique des versions » dans la consultation du dossier : liste des versions
(numéro, date, auteur, origine), ouverture d'une version dans le tableau partagé en lecture
seule, badge « version courante » — même langage que le diff existant.

## Tests attendus

1. Deux cycles de rectification successifs → deux versions archivées + la courante ; chaque
   version restitue ses propres montants/lignes.
2. Une version archivée est immuable (toute écriture refusée).
3. Dossier jamais rectifié → liste vide (aucune régression sur `/diff-rectification`).

---

## Note de livraison backend — 2026-09-06 (`PRS20`, commit `6d9ba29`)

Les cinq points de la demande sont livrés. Référence complète du contrat : `docs/api-endpoints.md`
du backend, section « Saisies », bloc **« Versions archivées »** ; règle de gestion ajoutée dans
`docs/regles-gestion.md` (2026-09-06). Migration Flyway **`V18`**.

### Deux écarts avec la demande, assumés

1. **Chemins** : `GET /api/dossiers/{id}/versions-archivees` (liste) et
   `GET /api/dossiers/{id}/versions-archivees/{numero}` (contenu) — et non `/versions`, qui existe
   déjà et que le front consomme (`prmp.services.ts`, chaîne des mises à jour en `Dossier[]`). Les
   deux notions coexistent, distinguées par le chemin : `/versions` = mises à jour (chaque version
   est un dossier) ; `/versions-archivees` = historique des rectifications du même dossier.
2. **Mécanique des mises à jour non réutilisée** : elle crée un `t_dossier` par version, ce qui
   aurait semé des dossiers fantômes (sans statut ni circuit) dans toutes les listes. Choix : en-tête
   `t_version_dossier` + lignes `t_snapshot_rectif_ligne` conservées par cycle + trois tables enfants
   (bénéficiaires, lots, dates prévisionnelles). `origine` vaut `RECTIFICATION` ; `MISE_A_JOUR` est
   réservé pour une unification future sans changement de contrat.

### Contrat

- **Périmètre de lecture** : le même que `/diff-rectification` — tout-voyant, PRMP propriétaire,
  contrôleurs de la localité (rôles `PRMP`, `PRESIDENT`, `CHEF_COMMISSION`, `SECRETAIRE`, `MEMBRE`,
  `VERIFICATEUR`, `ASSISTANT_CONTROLEUR`, `ADMINISTRATEUR`). 403 hors périmètre, 404 dossier inconnu.
- **`GET …/versions-archivees` → `VersionArchiveeDto[]`**, de la plus ancienne à la plus récente.
  **Liste vide (200)** pour un dossier jamais rectifié — pas de 409, contrairement au diff.
  Champs : `idDossier`, `numero` (clé du détail), `origine`, `cycle` (itération de rectification),
  `dateVersion`, `idPrmpAuteur` (PRMP opératrice), `nomAuteur`, `auteur` (login réel), `nbLignes`,
  `exercice`, `reference`, `signataire`, `dateSignature` (en-tête du PPM au moment du gel ; **nuls**
  pour la version reprise d'avant la V18).
- **La version courante n'est pas dans la liste** : c'est le dossier lui-même. Son numéro vaut
  `versions archivées + 1` ; le badge « version courante » est à poser côté front.
- **`GET …/versions-archivees/{numero}` → `VersionArchiveeDetailDto`** = `version` (l'en-tête
  ci-dessus) + `lignes[]`, ordonnées par `idDetail`, avec les **mêmes champs que `Marche`** :
  `idDetail`, `idLigneOrigine`, `designationMarche`, `numCompte`, `montEstim`, `ancienMontEstim`,
  `nouvMontEstim`, `financement`, `statut`, `idNature`, `idMode`, `formeMarche`, `supprimee`,
  `justifModeDerogatoire`, `justifDelaiAmenage`, et leurs collections :
  `beneficiaires[]` (`soaCode`, `numCompte`, `ancMontBenef`, `nouvMontBenef`),
  `lots[]` (`designationLot`, `montLot`, `qteLot`, `uniteLot`),
  `processus[]` (`idCapm`, `ordre` = ordre d'affichage **actuel** du référentiel, `dateDebut`,
  `dateFin`). **404** si le numéro n'existe pas pour ce dossier.
- **Immuable** : ressource en lecture seule — toute autre méthode répond **405** ; entités Hibernate
  `@Immutable` ; trigger PostgreSQL refusant tout `UPDATE`. Les versions partent avec le circuit
  (retrait accepté, annulation de dispatch, suppression du dossier), comme l'instantané qu'elles
  remplacent.
- **Reprise (00002)** : l'instantané du dernier cycle déjà en base est devenu la **version n° 1** de
  son dossier. Ses collections n'existaient que sous forme d'empreintes : elles sont **reconstituées**
  à la lecture, en mode dégradé — désignations de lots en minuscules, `uniteLot` et `numCompte` de
  bénéficiaire absents, un seul montant par bénéficiaire porté par `nouvMontBenef`. À afficher tel
  quel, sans en déduire une régression.
- **`/diff-rectification` inchangé** : il compare toujours la **dernière** version archivée aux lignes
  courantes.

### Tests livrés (`VersionsRectificationIntegrationTest`)

Les trois cas demandés (deux cycles → deux versions avec leurs propres montants et collections ;
immuabilité 405 + trigger ; dossier jamais rectifié → liste vide, 404 sur un numéro inconnu, 409
conservé sur le diff), plus la reprise dégradée (collections reconstituées depuis les empreintes,
archivage du cycle suivant à la suite sans rien effacer).
