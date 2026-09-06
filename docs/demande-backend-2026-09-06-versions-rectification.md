# Demande backend — Rectifications : conserver CHAQUE version du PPM (historique du dossier)

> ✅ **CLÔTURÉE le 06/09** — backend livré (`6d9ba29`, V18, `GET /api/dossiers/{id}/versions-archivees`
> et `/{numero}`, 776 tests verts, Word compris) ; front livré (`05f3a19` : onglet « Historique des
> versions » dans la consultation du dossier, build + lint + 180 tests verts) ; **recette réelle
> Playwright 20/20** (Vérificateur VERANT1, dossier jetable cloné de 00002 puis purgé — 00002 intact).
> Les deux notes de livraison sont en fin de document. ⚠️ Le chemin est **`/versions-archivees`**, pas
> `/versions` (déjà pris par la chaîne des mises à jour que le front consomme).

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

---

## Note de livraison front — 2026-09-06 (`frontendprs2`, commit `05f3a19`)

Section « Historique des versions » livrée dans la **consultation du dossier**
(`features/circuit/dossier-consultation.ts`), donc dans les 8 écrans qui l'ouvrent en modale et les
3 qui l'embarquent — tous les profils du circuit, PRMP comprise.

### Ce que voit l'utilisateur

- Un **onglet « Historique des versions »**, dans la barre d'onglets du dossier (fiche / plan / AGPM /
  pièces), **visible seulement s'il existe au moins une version archivée** : un dossier jamais rectifié
  n'a pas d'onglet vide. Le compteur = versions archivées **+ la courante**.
- Une **liste des versions**, au langage du journal des actions : la **version courante en tête**
  (badge « Version courante », numéro = archivées + 1, nombre de marchés du dossier), puis les versions
  archivées **de la plus récente à la plus ancienne** — numéro, origine (« Rectification »), date
  `dd/MM/yyyy HH:mm`, auteur (nom de la PRMP, à défaut login), cycle, nombre de lignes.
- Un bouton **« Afficher »** par version. La version sélectionnée est rendue **dans le même tableau
  partagé que le plan courant** (`<app-ppm-marches-table>`, lecture seule, sans surlignage — une archive
  n'est comparée à rien), sous un **bandeau d'identité** : « Version n° X · archivée le … à … par … ·
  Rectification, cycle N · réf. … · signé le … ». La ligne affichée est marquée « Affichée ». Par défaut,
  c'est la version courante qui est affichée.
- Le contenu d'une version est **chargé à la demande** (indicateur `role="status"`), **gardé en cache**
  pour la durée de la consultation (une archive est immuable), et un échec affiche l'état d'erreur
  standard avec **« Réessayer »**.
- L'onglet **Plan de passation** est inchangé : surlignage et légende « Rectification : » du diff du
  dernier cycle restent en place.

### Ce que ça change dans le code

- `models/prmp.model.ts` : `VersionArchivee`, `VersionArchiveeDetail`, `LigneVersion` et ses
  collections (`BeneficiaireVersion`, `LotVersion`, `PrevisionVersion`), miroir du contrat backend.
- `services/prmp.services.ts` (`MiseAJourPpmService`) : `versionsArchivees(idDossier, silencieux)` et
  `versionArchivee(idDossier, numero)`. ⚠️ **`/versions-archivees` ≠ `/versions`** : le second reste
  la chaîne des mises à jour (`versions()`, `Dossier[]`).
- `features/circuit/version-archivee-vue.ts` : fonction **pure** qui projette une version en
  `Marche[]` / `ServiceBeneficiaire[]` / `MarchePrevision[]` pour le tableau partagé (identifiants
  d'enfants synthétiques négatifs ; les lots restent disponibles dans `detail`).
- La liste des versions entre dans la **vague unique** de la consultation, en silence (`skipErrorToast`) :
  un 403 ou un backend antérieur masque simplement l'onglet.

### Vérifications

- `npx ng build`, `npm run lint`, `npx ng test --watch=false` : **180 tests verts** (dont 2 specs
  nouvelles : projection pure ; URL du service avec la garde « jamais `/versions` »).
- **Recette réelle** (backend local sur `6d9ba29`, V18 appliquée) : dossier jetable **cloné de 00002**
  (dossier, PPM, marché, bénéficiaire, prévision, réception), deux cycles de rectification joués par
  l'API en PRMP001, puis **Playwright** en Vérificateur VERANT1 depuis « Dossiers à vérifier » →
  « Voir détails » : **20 contrôles sur 20** (onglet et compteur, ordre de la liste, version courante
  affichée par défaut, version 1 = état d'origine à 500 000,00, version 2 = fin de cycle 1 à
  550 000,00, bandeau, retour à la courante, légende du plan intacte, aucune erreur console). Le jetable a
  été **purgé** ; **00002 n'a été ni rectifié ni versionné** — sa première rectification créera sa
  version n° 1.

### À savoir pour la suite

- Une version **reprise d'avant la V18** s'affiche telle que le serveur la reconstitue (mode dégradé
  documenté dans la note backend) : ne pas y voir une régression du tableau.
- Les files du Vérificateur (`a-verifier`, `en-attente-prmp`) exigent une **réception** dans sa localité
  — à prévoir pour toute recette sur un dossier créé à la main.
