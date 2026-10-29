# Demande backend — 2026-10-29 — Les membres de la CAO (et le dépositaire) lisent leurs notifications

## Contexte

Recette du 29/10 (procédure n° 2, voie rapide de Sambava, séance d'ouverture) : le responsable a produit le PV d'ouverture ;
RABE (membre de la CAO) devait le signer. **Arbitrage du pilote** : le compte d'un membre de la CAO doit recevoir une notification
de la disponibilité du PV d'ouverture.

Le serveur la produit déjà : `SeanceService` (l. 1023) → `ParametresInternesService.notifierMembre(…, PV_A_SIGNER, « Séance
d'ouverture : signez le … »)` → `NotificationService.emettreMembreCao` (notification en base **et** courriel). De même
`PARTS_ATTENDUES`, `SEANCE_A_VENIR`, `CLES_PUBLIEES`, `PV_OUVERTURE`… pour les membres, et `SECOURS_DEMANDE` pour le dépositaire.

Mais le membre **ne peut pas la lire** : `SecurityConfig`, l. 222 — `/api/notifications/**` est réservé à
`INTERNE_OU_RESPONSABLE`. Les profils des espaces externes (`MEMBRE_CAO`, `DEPOSITAIRE`) reçoivent donc des notifications qu'aucune
route ne leur sert ; seul le courriel les prévient — et en recette, comme souvent en production pour un expert extérieur, le courriel
n'arrive pas ou se perd.

## B1 — Ouvrir la lecture de **ses propres** notifications aux profils `MEMBRE_CAO` et `DEPOSITAIRE`

Les routes « à soi » seulement, déjà bornées au destinataire courant :

- `GET /api/notifications/mes` (pagination comme aujourd'hui) ;
- `GET /api/notifications/mes/non-lues/count` ;
- `POST /api/notifications/{id}/lu`, `POST /api/notifications/{id}/non-lu`, `POST /api/notifications/lire-tout` — sur ses
  notifications seulement (403/404 pour celle d'un autre, comme pour les internes) ;
- `GET /api/notifications/stream` (SSE), si le destinataire se résout pour ces comptes ; sinon le dire, le front interrogera.

Les routes d'administration (`GET /api/notifications`, `GET/PUT …/{id}`, `POST /api/notifications`) restent fermées.

> ⚠️ **Backend, 2026-10-29 — livré tel quel.** Les cinq routes « à soi » et `GET /api/notifications/stream` (SSE) s'ouvrent à
> `MEMBRE_CAO` et `DEPOSITAIRE`, et à `CANDIDAT` (voir H1). Le flux SSE se résout pour ces comptes : il est indexé par la clé de la
> session, que l'émission utilise aussi. Une notification d'un autre répond 403. Les routes de supervision répondent 403.

## B2 — Le destinataire de ces comptes

Les notifications émises par `emettreMembreCao` / `emettreDepositaire` doivent se retrouver par `…/mes` pour le compte connecté
(identifiant du compte CAO `K…`, du dépositaire `D…`). Le dire si la clé de destinataire diffère de celle de la session.

> ⚠️ **Backend, 2026-10-29 — confirmé, rien à changer.** La clé est la même : `destinataireRef` = `K…`, `D…` ou `C…`, avec
> `destinataireType` = le type du compte. Le service lisait déjà par cette clé. Seule la route restait fermée.

## B3 — Ce qui ouvre l'écran

Le front route le clic par `typeObjet = PROCEDURE` + `idObjet = idDmc` vers `/cao/procedures/{idDmc}` (membre) et
`/depositaire/procedures/{idDmc}` (dépositaire). Rien à changer si `idObjet` porte bien l'`idDmc` (c'est le cas de `notifierMembre`).

> ⚠️ **Backend, 2026-10-29 — confirmé.** Toutes les notifications aux membres et au dépositaire portent `typeObjet = PROCEDURE` et
> `idObjet = idDmc`, celles de B4 comprises.

## B4 — Une notification pour toute information sur la procédure (ajout du pilote, 29/10)

**Arbitrage du pilote** : le membre de la CAO est notifié de **toute information sur la procédure** dont il est membre, pas seulement
des gestes qu'il doit poser.

Déjà émis aux membres (relevé du code, à garder) : `CLE_A_PUBLIER`, `CLES_PUBLIEES`, `SEANCE_A_VENIR`, `PARTS_ATTENDUES`,
`PV_A_SIGNER`, `PV_OUVERTURE`, `EVALUATION_OUVERTE`, `EVALUATION_REPRISE`, `RAPPORT_A_SIGNER`, `RAPPORT_EVALUATION`, `RAPPORT_RETIRE`,
`PART_A_VERIFIER`, `NEGOCIATION`, `COMMISSION_RECEPTION`, `RECEPTION_A_SIGNER`, `LIVRAISON_DECLAREE`.

À ajouter (même canal `notifierMembre`, à **tous les membres** de la CAO de la procédure, objet `PROCEDURE` = `idDmc`) :

| Événement | Proposition de type | Texte (idée) |
|---|---|---|
| Désignation dans la CAO (compte déjà actif) / retrait de la CAO | `CAO_DESIGNATION`, `CAO_RETRAIT` | « Vous êtes désigné membre / n'êtes plus membre de la commission de ‹ objet › » |
| Cérémonie à refaire (part perdue, composition changée) | `CEREMONIE_A_REFAIRE` | « La cérémonie des clés est à refaire : ‹ motif › » |
| Avis spécifique publié — procédure lancée | `PROCEDURE_LANCEE` | « Avis publié le jj/mm ; dépôts du jj/mm au jj/mm à hh:mm » |
| Questions des candidats : réponse publiée (sans l'identité du candidat) | `REPONSE_PUBLIEE` | « Une réponse aux questions des candidats est publiée » |
| Date limite atteinte — dépôts clos | `DEPOTS_CLOS` | « Dépôts clos : n offre(s) reçue(s) ; séance le jj/mm à hh:mm » (le **nombre** seulement, jamais les soumissionnaires avant l'ouverture) |
| Séance ouverte / reportée / illisibilité constatée | `SEANCE_OUVERTE`, `SEANCE_REPORTEE`, `OFFRES_ILLISIBLES` | — |
| PV d'ouverture signé et publié | (`PV_OUVERTURE` s'il couvre ce cas, sinon `PV_OUVERTURE_PUBLIE`) | — |
| Étape de l'évaluation qui attend une décision des membres (conformité, montant, anormales, post-qualification) | `EVALUATION_ETAPE` | « Évaluation : ‹ étape › attend vos décisions » |
| Rapport d'évaluation signé par tous / publié | `RAPPORT_SIGNE` | — |
| Attribution provisoire publiée, recours déposé / tranché, attribution définitive | `ATTRIBUTION_PROVISOIRE`, `RECOURS`, `ATTRIBUTION_DEFINITIVE` | — |
| Procédure déclarée infructueuse, sans suite, ou annulée | `PROCEDURE_INFRUCTUEUSE`, `PROCEDURE_SANS_SUITE` | — |
| Dates de la procédure modifiées (nouvelle version validée de la fiche) | `PROCEDURE_DATES` | « Date limite reportée au … » |

Le **dépositaire** reçoit le sous-ensemble qui le concerne : cérémonie (clé à publier, à refaire, clés publiées), séance (à venir,
part de secours demandée, PV publié), et la fin de la procédure (infructueuse, sans suite, annulée).

Si un type existe déjà sous un autre nom, le réutiliser et le dire ; si un événement n'existe pas encore dans le code (report de séance,
par exemple), le noter « sans objet ».

> ⚠️ **Backend, 2026-10-29 — livré, avec des types réutilisés.** Les membres sont notifiés par `notifierCommission`, et le
> dépositaire quand l'événement le concerne. Le tableau complet est dans `PRS20/docs/api-endpoints.md`, § *Notifications*.
>
> | Demandé | Livré |
> |---|---|
> | `CAO_DESIGNATION` | **réutilisé** : `CLE_A_PUBLIER` (« vous êtes désigné membre »), qui partait déjà, compte actif compris |
> | `CAO_RETRAIT` | **`CAO_RETRAIT`**, au membre retiré |
> | `CEREMONIE_A_REFAIRE` | **réutilisé** : `CLE_A_PUBLIER` (« Cérémonie des clés à refaire »), aux membres et au dépositaire. Une part déclarée perdue ne refait pas la cérémonie d'office : seul le responsable est prévenu, comme avant |
> | (clés publiées) | `CLES_PUBLIEES`, désormais aussi au dépositaire |
> | `PROCEDURE_LANCEE` | **`PROCEDURE_LANCEE`**, à la première impression de l'avis ou des lettres d'invitation, avec la date limite de remise |
> | `REPONSE_PUBLIEE` | **réutilisé** : `QUESTION_REPONDUE`, le texte ne nomme pas le candidat |
> | `DEPOTS_CLOS` | **existait** (PRMP et responsable) : envoyé désormais aussi aux membres, avec le nombre seulement |
> | `SEANCE_OUVERTE` | **réutilisé** : `PARTS_ATTENDUES` (« apportez vos parts ») ; au dépositaire, `SECOURS_DEMANDE` si besoin |
> | `SEANCE_REPORTEE` | **sans objet** : le report d'une séance n'existe pas dans le code |
> | `OFFRES_ILLISIBLES` | **réutilisé** : `PV_OUVERTURE` porte aussi le « PV de constat d'illisibilité » |
> | `PV_OUVERTURE_PUBLIE` | **réutilisé** : `PV_OUVERTURE` (signé, et publié s'il l'est), désormais aussi au dépositaire |
> | (séance à venir) | `SEANCE_A_VENIR`, désormais aussi au dépositaire |
> | `EVALUATION_ETAPE` | **`EVALUATION_ETAPE`**, à l'arrêt d'une étape, pour l'étape suivante du lot |
> | `RAPPORT_SIGNE` | **réutilisé** : `RAPPORT_EVALUATION` (« Rapport d'évaluation signé »), qui partait déjà aux membres |
> | `ATTRIBUTION_PROVISOIRE` | **réutilisé** : `ATTRIBUTION`, à l'information des candidats (offre retenue, date de signature possible) |
> | `RECOURS` | **`RECOURS`**, au dépôt puis à la décision ; le requérant n'est pas nommé |
> | `ATTRIBUTION_DEFINITIVE` | **réutilisé** : `MARCHE_NOTIFIE`, à la notification du marché |
> | `PROCEDURE_INFRUCTUEUSE`, `PROCEDURE_SANS_SUITE` | **existaient** (candidats) : envoyés désormais aussi aux membres et au dépositaire |
> | (annulée) | **sans objet** : l'annulation d'une procédure n'existe pas dans le code |
> | `PROCEDURE_DATES` | **`PROCEDURE_DATES`**, quand une révision validée change la date limite de remise |
>
> Les nouveaux types sont `CAO_RETRAIT`, `PROCEDURE_LANCEE`, `EVALUATION_ETAPE`, `RECOURS` et `PROCEDURE_DATES`.

## Hypothèses à confirmer

- **H1** : le candidat (`CANDIDAT`, `emettreCandidat` : `OFFRES_ILLISIBLES`…) suit la même règle — ouvrir aussi ses routes « à soi »
  si c'est la même ligne de code ; sinon, une demande à part.
- **H3** : les notifications de B4 sont **informatives** (aucun geste attendu) sauf mention contraire ; le courriel suit la règle
  actuelle de `notifierMembre` (il part aussi).
- **H2** : aucune notification existante n'est réécrite ; celles déjà émises (dont `PV_A_SIGNER` du 29/10 pour RABE) deviennent
  lisibles telles quelles.

> ⚠️ **Backend, 2026-10-29 — H1, H2 et H3 confirmées.**
> - **H1 :** même ligne de code. Le candidat lit ses notifications par les mêmes routes « à soi ».
> - **H2 :** aucune notification existante n'est réécrite, et rien n'est rejoué. Le `PV_A_SIGNER` de RABE du 29/10 est lisible tel
>   quel.
> - **H3 :** les notifications de B4 sont informatives, et le courriel part aussi.

## Côté front, une fois livré

- Coquille des espaces externes (`/cao`, `/depositaire`) : une cloche avec le compteur de non-lues, la liste déroulante des dernières
  notifications, « tout marquer lu », clic vers la procédure.

> ⚠️ **Front, 2026-10-29 — livré.** Cloche dans la coquille des espaces externes (`features/externe/cloche-externe.ts`), pour la CAO,
> le dépositaire et le candidat : compteur (flux SSE du `NotificationsStore`), les seules NON LUES (une notification lue en sort),
> « Tout marquer lu », lien « Voir toutes les notifications ». L'historique complet est un onglet « Notifications » de chaque espace
> (`/<espace>/notifications`, `notifications-externes.ts`) : filtre Toutes / Non lues, marquage lu / non lu à l'unité. Le clic
> (`notification-externe-route.ts`) ouvre `/<espace>/procedures/{idDmc}`, l'écran d'évaluation pour les types de l'évaluation, les
> réceptions pour celles des commandes. Vérifié sur les comptes réels des deux membres et du dépositaire, aucune erreur.
