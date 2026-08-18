# Demande au backend `PRS20` — 19 août 2026

> Document destiné à la session backend. Émis depuis le front `frontendprs2`, qui est **à jour et
> poussé** (dernier commit `11596dd`). Trois points, par ordre d'urgence.

---

## 0. ⚠️ URGENT — la lettre de demande de retrait n'est pas commitée

La fonctionnalité livrée le 2026-08-17 (lettre PDF obligatoire à la demande de retrait) **tourne sur
le serveur local mais n'existe pas dans git**. Dernier commit du dépôt : `63a6e28`, 17/08 à 4 h
(phase 3 du plan cookie). Tout le travail sur la lettre lui est postérieur et n'a jamais été versé.

```
?? src/main/java/cnm/prs/entity/PieceDemandeRetrait.java            ← entité, NON SUIVIE
?? src/main/java/cnm/prs/repository/PieceDemandeRetraitRepository.java  ← NON SUIVI
 M src/main/java/cnm/prs/service/DemandeRetraitService.java         (+156 lignes)
 M src/main/java/cnm/prs/controller/DemandeRetraitController.java   (+34)
 M src/main/java/cnm/prs/dto/DemandeRetraitDto.java                 (+6)
 M src/test/java/cnm/prs/CnmWorkflowIntegrationTest.java            (+137 lignes de tests)
 M docs/api-endpoints.md · docs/regles-gestion.md
```

**Pourquoi c'est urgent.** Le front correspondant, lui, **est poussé** : il envoie désormais un
`multipart/form-data` avec la lettre (`DemandeRetraitService.creerAvecLettre`). Un redéploiement du
backend depuis git ferait donc disparaître l'entité et repasser l'endpoint en JSON pur : **toute
demande de retrait échouerait en 415**, y compris les écrans recettés le 18/08. C'est le scénario
qui a déjà cassé le distant par le passé.

**Action attendue** : commiter ces 8 fichiers (les deux fichiers non suivis compris — c'est
précisément ce qui manque le plus facilement) et pousser, avant toute autre livraison.

---

## 1. API des actualités affichées à l'ouverture de session

**Contrat complet** : `frontendprs2/docs/spec-actualites.md` (versionné, commit `ae79f41`). Il décrit
le modèle de données, onze endpoints, le DTO et les règles. Résumé :

| | |
|---|---|
| Ressource | `/api/actualites` — CRUD réservé à `ADMINISTRATEUR` ; `DELETE` = **archivage logique**, jamais de suppression physique |
| Lecture ciblée | `GET /api/actualites/mes-actualites` — filtre **entièrement serveur** : profil de l'utilisateur authentifié, statut `ACTIF`, fenêtre `datePublication`/`dateExpiration`, interrupteur global |
| Images | `POST /api/actualites/{id}/images` — **JPEG seul**, magic-bytes `FF D8 FF`, **10 Mo max**, redimensionnement serveur avant stockage (`bytea`, comme `t_piece_demande_retrait`) |
| Interrupteur global | `GET`/`PUT /api/parametres/actualites-actives` — à `false`, `/mes-actualites` renvoie une liste **vide** pour tout le monde |
| Contenu | **Markdown** stocké tel quel. **Aucun HTML** n'est accepté ni renvoyé |

**Deux règles à ne pas perdre de vue :**

- **Aucun profil ciblé ⇒ visible de personne.** Jamais « tous » par défaut : un oubli de saisie
  diffuserait sinon l'annonce à toute l'administration.
- **L'expiration bascule le statut en `ARCHIVE`** (tâche planifiée ou calcul à la lecture, au choix),
  afin que l'onglet « Historique » se remplisse sans geste manuel.

**Pourquoi markdown et pas HTML** : le front rend le contenu en construisant des nœuds typés, sans
jamais utiliser `innerHTML`. Accepter du HTML éditable rouvrirait la surface XSS fermée par l'audit
des 16-17/08 — un compte administrateur compromis suffirait à exécuter du script dans l'origine de
l'application.

**Pourquoi 10 Mo et non « sans limite »** (la demande initiale disait sans limite) : Spring plafonne
à 1 Mo par défaut, et une photo de plusieurs dizaines de Mo saturerait la mémoire tout en ralentissant
l'ouverture du modal pour **tous** les profils ciblés, à **chaque** connexion.
`spring.servlet.multipart.max-file-size` et `max-request-size` sont donc à relever à 10 Mo.

**État du front** : livré et poussé (`9faaa14`) — modal d'ouverture de session, écran
d'administration complet, historique, interrupteur. Il est **déployable dès maintenant** : l'appel
`/mes-actualites` porte `skipErrorToast`, donc un endpoint absent n'affiche aucune erreur et aucun
modal. Il se branchera sans changement de code si le contrat est respecté.

**Trois questions ouvertes :**

1. Ordre d'affichage quand plusieurs actualités sont actives — `datePublication` décroissante, ou un
   champ d'ordre explicite ?
2. Une pagination est-elle utile sur `GET /api/actualites` (vue Administrateur) ?
3. Les créations, activations et archivages entrent-ils dans `t_audit_log` ? (Souhaitable : une
   annonce est un acte de communication institutionnelle.)

---

## 2. Sortir la génération du PDF du chemin de la signature

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
