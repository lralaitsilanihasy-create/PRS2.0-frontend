# Demande au backend `PRS20` — 19 août 2026

> Document destiné à la session backend. Émis depuis le front `frontendprs2`, **à jour et poussé**
> (dernier commit `b108ec8`).
>
> **État au 19/08 en soirée** — 1 point urgent, 1 point ouvert, 2 clos :
>
> | | Sujet | État |
> |---|---|---|
> | **A** | API des actualités **non commitée** (22 fichiers) | 🔴 **urgent** |
> | **B** | Génération du PDF de PV hors du chemin de la requête | ✅ livré (`cd955e0`), recetté : 56 ms |
> | **C** | Exposer `creePar` / `soumisPar` dans `DossierDto` | 🟠 ouvert |
> | 0 | Lettre de demande de retrait | ✅ clos (`0a73fde`) |
> | 1 | API des actualités : conception et livraison | ✅ clos, recetté |

---

## A. 🔴 URGENT — l'API des actualités n'est pas commitée

**Le scénario du point 0 se répète, à plus grande échelle.** L'API livrée aujourd'hui tourne sur le
serveur local et a été recettée de bout en bout par le front — mais **rien n'est dans git**. Dernier
commit du dépôt : `0a73fde` (19/08, 1 h 04), qui ne concerne que la lettre de retrait.

**17 fichiers neufs, aucun suivi par git** — ce sont eux qu'un `git add` oublie le plus facilement :

```
src/main/java/cnm/prs/entity/     Actualite.java · ActualiteImage.java · ActualiteProfil.java · Parametre.java
src/main/java/cnm/prs/enums/      StatutActualite.java
src/main/java/cnm/prs/dto/        ActualiteDto.java · ActualiteImageDto.java · InterrupteurDto.java
src/main/java/cnm/prs/repository/ ActualiteRepository.java · ActualiteImageRepository.java
                                  ActualiteProfilRepository.java · ParametreRepository.java
src/main/java/cnm/prs/service/    ActualiteService.java · ParametreService.java
src/main/java/cnm/prs/controller/ ActualiteController.java · ParametreController.java
src/main/java/cnm/prs/exception/  PayloadTropVolumineuxException.java
```

**5 fichiers modifiés** : `GlobalExceptionHandler.java`, `CnmWorkflowIntegrationTest.java`,
`src/test/resources/application.properties`, `docs/api-endpoints.md`, `docs/regles-gestion.md`.

**Pourquoi c'est urgent.** Le front correspondant **est poussé** (`9faaa14`, `b108ec8`) et appelle
ces endpoints. Un redéploiement du backend depuis git ferait disparaître l'intégralité de la
fonctionnalité : `/api/actualites/**` et `/api/parametres/**` renverraient 404, la table
`t_parametre` ne serait plus créée, et le travail d'une journée serait perdu — il n'existe qu'en
copie de travail.

**Action attendue** : `git add` des 17 fichiers non suivis **compris**, commit et push, avant toute
autre livraison.

---

## B. 🟠 Sortir la génération du PDF du chemin de la signature

*(seul point fonctionnel encore ouvert — inchangé depuis la version initiale de ce document)*

### Constat

`PvExamenService.signer` produit le document **dans la transaction de la requête**, à la signature
qui complète le PV :

```java
if (membreSigne && coSigne) {
    pv.setStatutPv(StatutPv.SIGNE.name());
    pv.setDatePv(today);
    // ⚠️ Règle ajoutée — à la signature finale, génère et stocke le PDF du PV
    pvDocumentService.genererSiEligible(pv).ifPresent(pv::setCheminDocument);
```

La conversion `.docx → PDF` passe par **Microsoft Word piloté localement**
(`documents4j-transformer-msoffice-word`, `pom.xml`) : plusieurs secondes, incompressibles. Le
commentaire du verrou pessimiste, juste au-dessus, le reconnaît déjà — *« la génération du PDF rend
la signature longue ; des clics répétés lisaient tous `PROJET_ACCEPTE` et notifiaient plusieurs
fois »*. Le verrou traite la conséquence, pas la cause.

**Trois facteurs aggravent l'attente :**

- aucun processus Word n'était résident sur la machine au moment du constat : la conversion suivante
  paie donc en plus le **démarrage de Word** ;
- `convertirEnPdf` **retente une fois** avec un convertisseur neuf en cas d'échec — protection
  légitime contre un Word qui s'arrête entre deux conversions, mais qui peut **doubler** le temps ;
- la génération n'a lieu que si un modèle correspond au cas (avis, sous-type, localité) : certaines
  signatures finales sont donc rapides et d'autres non, ce qui rend la lenteur **imprévisible** pour
  l'utilisateur.

Le reste est hors de cause : les écrans concernés ont été mesurés à **21 ms de médiane** sur 21
appels, et le front ne déclenche qu'un seul rechargement après la signature.

### Correction demandée

Marquer le PV `SIGNE` et **répondre immédiatement** ; produire le document **après commit**
(`@TransactionalEventListener(AFTER_COMMIT)` + `@Async`, ou file de traitement), puis renseigner
`CHEMIN_DOCUMENT` quand il est prêt.

**Le front est déjà outillé pour cela** : le DTO expose `documentDisponible`, et deux écrans
l'exploitent (`pv-definitifs.ts`, `detail-pv-modal.ts`). Il sait donc afficher un PV signé dont le
document n'est pas encore disponible.

**Une question de contrat** : pendant la génération, le PV est signé mais le fichier n'existe pas
encore. Que doit renvoyer `GET /api/pv-examens/{id}/document` dans cet intervalle — un **404
explicite**, un **202** avec réessai, ou `documentDisponible: false` tant que `CHEMIN_DOCUMENT` est
nul ? Cette dernière option est la plus simple à refléter côté front, qui affiche déjà l'état.

**À défaut**, une mesure partielle réduirait déjà l'attente : **préchauffer le convertisseur au
démarrage** de l'application, ce qui supprime le coût de lancement de Word sur la première signature.

### Ce que le front a fait en attendant

Commit `441fff7` : à la signature qui clôt le PV, le bouton devient « Signature et édition du PV… »
et un bandeau explique l'attente. Il n'apparaît **que si elle aura lieu** — la signature doit être
clôturante **et** `documentDisponible` doit indiquer qu'un modèle existe.

⚠️ Cela **ne raccourcit pas l'attente d'une seconde** : c'est un pansement d'ergonomie, pour éviter
qu'un écran figé plusieurs secondes ne se lise comme une panne et n'invite à recliquer. La correction
de fond reste entièrement côté serveur.

---

## C. 🟠 Exposer l'auteur de la saisie d'un dossier (demande du 19/08, soir)

**Besoin** : afficher, dans le détail d'un plan de passation, **l'UGPM qui a créé le dossier** —
l'onglet « Entité contractante » réunit désormais entité, PRMP et unités rattachées.

**L'information existe déjà en base** :  (« login de l'acteur ayant créé le
dossier — PRMP ou UGPM ») et , tous deux portés par l'entité . Mais
** ne les expose pas** : le front ne reçoit que 11 champs (idDossier, idTypeDossier,
idSousType, idDossierParent, refeDossier, dateRef, statut, idLocalite, idPrmp, idMandatAttrib,
idEntiteContract). Vérifié le 19/08 sur l'API réelle.

**Demande** : ajouter  et  à  (lecture seule, posés serveur).

**Deux précisions utiles** :

1.  contient un **login**, pas un identifiant d'UGPM. Le front ne peut le traduire en
   identité que s'il peut lire les UGPM — or  est réservé à l'ADMINISTRATEUR
   (403 pour la PRMP et les contrôleurs, mesuré). Sans autre changement, une PRMP verrait donc
   « Créé par UGPM001 » plutôt que le nom de l'agent.
2. D'où une demande complémentaire, au choix : soit **ouvrir**    à la PRMP concernée (elle consulte ses propres unités), soit joindre au DTO un libellé lisible
   (). La première option a un autre effet utile : elle supprime le 403 que le front
   doit aujourd'hui rendre silencieux à chaque ouverture du modal.

**État du front** : prêt. Le champ est déclaré optionnel et le bloc « Saisie du dossier » est
conditionnel — masqué aujourd'hui, il s'affichera dès la livraison sans changement de code. Vérifié
dans les deux cas (champ absent → 2 fiches, aucun bloc, aucune erreur ; champ simulé → bloc présent
avec « Créé par » et « Soumis par »).

---

## 0. ✅ CLOS — lettre de demande de retrait (19/08)

Le travail du 17/08 était resté hors de git (entité et repository non suivis compris). **Traité** :
commit `0a73fde`, 8 fichiers, +409/−37 ; arbre propre à ce moment-là, suite backend 439/439, serveur
relancé, table `t_piece_demande_retrait` créée (PK identity, `UNIQUE` sur `ID_DEMANDE_RETRAIT`,
`bytea` + SHA-256).

**Vérifié côté front après relance** : la lettre déposée le 18/08 a survécu — demande #34,
`lettre-de-retrait-signee.pdf`, 133 Ko, `GET /{id}/document` → **200 · application/pdf · 136 195
octets**. Les demandes antérieures à la règle (#26, #27, #28) renvoient `nomFichier: null` et
s'affichent « — » : la rétro-compatibilité tient. Aucune adaptation du front n'était nécessaire, le
contrat multipart y étant branché depuis le 17/08.

---

## 1. ✅ CLOS — API des actualités : livrée et recettée (19/08)

Contrat conforme à `frontendprs2/docs/spec-actualites.md`. **Sous réserve du point A : ce code n'est
pas encore versé dans git.**

### Recette de bout en bout, par l'interface, sur l'API réelle

| Étape | Résultat |
|---|---|
| Création d'une actualité (Administrateur) | statut **forcé `INACTIF`** par le serveur ✅ |
| Dépôt d'une image JPEG | acceptée, métadonnées renvoyées ✅ |
| Activation | statut `ACTIF` ✅ |
| Connexion d'une PRMP ciblée | **modal affiché** : markdown rendu (sous-titre, 3 puces, gras, citation) + image chargée ✅ |
| Fermeture (✕, Échap, clic extérieur, bouton) | ✅ |

**Ciblage — la garantie principale.** Les profils non ciblés ne reçoivent **rien** : Membre, Chef de
commission et Administrateur obtiennent **0 actualité** de `/mes-actualites` (filtrage serveur, pas
un masquage d'écran). La PRMP ciblée en reçoit 1.

**Interrupteur global.** Basculé à `false` : la PRMP ciblée reçoit **0 actualité**, aucun modal.
Rétabli ensuite. Le comportement « ligne absente = actif » est confirmé (`{"actif":true}` sans ligne
en base).

### Précisions apportées par le backend, à conserver

- **Archivage automatique à l'expiration** *au fil des lectures* (pas de tâche planifiée), avec
  `imArchiveur` nul pour marquer l'origine système.
- **HTML rejeté dès la saisie** (400), tout en laissant passer les usages markdown légitimes de
  « < » (autolien, comparaison).
- **Tri** : date de publication effective décroissante.
- Une actualité `ARCHIVE` n'est **plus modifiable** (409) — le front ne propose d'ailleurs que
  « Consulter ».
- Les trois questions ouvertes ont toutes reçu réponse : tri par `datePublication` décroissante,
  pagination disponible via `?page=&size=`, et écritures journalisées dans `t_audit_log`.

### Un écart corrigé côté front

L'écran d'administration proposait le profil sous le nom `PUBLICATION` ; le nom d'enum attendu est
**`CHARGE_PUBLICATION`**. Cocher « Chargé de publication » aurait échoué en 400. Corrigé par
`b108ec8`, avec la liste et `profilsCibles` désormais typés `Role` : la faute devient une erreur de
compilation plutôt qu'un refus découvert à l'usage. `ADMINISTRATEUR` a été ajouté à la liste, le
contrat l'acceptant.
