# Demande backend — 2026-10-28 — Prévenir la PRMP que la décision de son dossier est transmise à SIGMP

## Contexte

Recette du 28/10 (dossier 00002/DAOO-CC/CNM/2026, voie rapide de Sambava, PV « Favorable avec réserves », observations levées) :
le Vérificateur a transmis la décision à SIGMP ; le dossier est en `DECISION_TRANSMISE_SIGMP`. Question du pilote : **comment la
PRMP le sait-elle ?**

Aujourd'hui, elle ne le sait que si elle va regarder :

- `TransmissionSigmpService.transmettre` notifie l'**Assistant contrôleur** (`PV_A_ARCHIVER`) et, pour la PRMP, rien
  (javadoc : « PRMP/UGPM rien — elle est notifiée de la décision ») ;
- la notification qu'elle a reçue est `PV_SIGNE` : elle annonce la décision, pas sa transmission, qui est pourtant ce qui
  **arrête le compteur** de la CNM (chronométrage du 01/09) et ouvre la suite (avis, exécution) ;
- pour un dossier né d'une fiche, `AvisAImprimer.notifierDevenues` ne prévient que si l'avis **devient** disponible à cet instant.
  Ici il ne l'est pas : `GET /api/fiches-marche/1/avis-specifique/disponibilite` → `disponible: false`, `raison:
  CEREMONIE_NON_CLOSE` (remise électronique). Aucun signal ne part.

Les notifications de PRMP001 le confirment : « DAO complet prêt » et « PV signé », rien d'autre.

## B1 — Une notification à la transmission

À `POST /api/sigmp-transmissions`, après le changement de statut, une notification **`DECISION_TRANSMISE_SIGMP`** :

- à la **PRMP** du dossier et à **toutes ses UGPM** (même règle que `AVIS_A_IMPRIMER` et `DAO_COMPLET_PRET`) ;
- pour **tous les dossiers** : plan (DDP), mise en concurrence (DMC), marché (DDM) ;
- objet `DOSSIER`, `idObjet` = `idDossier`.

> ⚠️ **Backend, 2026-10-28 — livré, une précision.** Si le dossier ne porte pas de PRMP, la notification va à la PRMP du PPM,
> comme pour `PV_SIGNE`. La notification part après la clôture du chronométrage, à côté de `PV_A_ARCHIVER` (Assistant).

## B2 — Ce qu'elle dit

Titre : « Décision transmise à SIGMP — ‹ référence › ».

Corps, selon le sens (`sens`, `leveeObservations` de la transmission) :

- `APPROUVE`, sans levée : « Le dossier ‹ réf › (‹ objet ›) est **approuvé** (avis favorable) : la décision a été transmise à SIGMP
  le ‹ date ›. »
- `APPROUVE`, avec levée : « … est **approuvé** : vos corrections ont levé les réserves du PV ; la décision a été transmise… »
- `NON_APPROUVE` : « … n'est **pas approuvé** (avis ‹ défavorable / ne se prononce pas ›) : la décision a été transmise… »

Puis **ce qui suit**, quand le serveur le sait (une phrase, facultative) :

- dossier né d'une fiche, avis disponible : « L'avis spécifique peut être imprimé. » — ⚠️ dans ce cas `AVIS_A_IMPRIMER` part déjà :
  le dire ici suffit-il, pour n'envoyer **qu'une** notification ? (voir H2) ;
- avis non disponible, `CEREMONIE_NON_CLOSE` : « L'avis spécifique s'imprimera après la clôture de la cérémonie des clés. » ;
- autre raison connue de l'indisponibilité : sa phrase, comme `messageIndisponible` côté front.

> ⚠️ **Backend, 2026-10-28 — livré, avec ces écarts.**
> - **Titre** : sans référence, il porte « n° ‹ idDossier › ».
> - **Objet** : « (‹ objet ›) » n'apparaît que pour un dossier né d'une fiche, avec la désignation de la fiche. Pour un plan ou
>   un dossier saisi librement, la référence est seule : le dossier ne porte pas d'objet propre.
> - **Date** : au format jj/mm/aaaa.
> - **Non approuvé** : « avis défavorable » pour `DEF`, « la Commission ne se prononce pas » pour `NSP`.
> - **La suite** n'existe que pour le dossier DAO né d'une fiche, celui dont la fiche imprime l'avis. Rien n'est ajouté pour un
>   dossier de marché, même lié à la même procédure.
>   - Si le document est imprimable : « L'avis spécifique peut être imprimé. » ou « Les lettres d'invitation peuvent être
>     imprimées. » (prestations intellectuelles, AOR).
>   - S'il ne l'est pas : la phrase de `…/disponibilite` pour sa raison, et **non** la phrase courte proposée pour
>     `CEREMONIE_NON_CLOSE`. Pour celle-ci : « La cérémonie des clés n'est pas close : sans clés publiées, aucun candidat ne
>     pourrait sceller son offre. L'avis spécifique s'imprime une fois la cérémonie close. » La règle est la même pour toutes
>     les raisons, et le texte est celui du 409 `AVIS_INDISPONIBLE`.
>   - Pour un avis non favorable (`AVIS_NON_FAVORABLE`), rien n'est ajouté : la phrase du sens le dit déjà.

## B3 — Le contrat

- Nouveau `TypeNotification.DECISION_TRANSMISE_SIGMP` ; le dire dans `docs/api-endpoints.md` (§ notifications) avec la cible.
- Aucune autre route ne change.

> ⚠️ **Backend, 2026-10-28 — confirmé.** `TypeNotification.DECISION_TRANSMISE_SIGMP` (24 caractères, la colonne en admet 30) ;
> aucune route, aucun DTO ni aucune migration ne change. Contrat : `PRS20/docs/api-endpoints.md`, § *Notifications* (le type)
> et § *Transmissions SIGMP* (texte et destinataires).

## Hypothèses à confirmer

- **H1** : la notification vaut pour les trois familles de dossiers, pas seulement les DAO.
- **H2** : quand l'avis devient disponible à la transmission, **une seule** notification (`DECISION_TRANSMISE_SIGMP` portant la phrase
  « L'avis spécifique peut être imprimé ») plutôt que deux ; sinon garder les deux et le dire.
- **H3** : pas de rattrapage pour les dossiers déjà transmis (dont 00002/DAOO-CC/CNM/2026) : la règle vaut à partir de la livraison.

> ⚠️ **Backend, 2026-10-28 — H1, H2 et H3 confirmées.**
> - **H1** : la notification vaut pour tous les dossiers, quels que soient leur type et leur famille.
> - **H2** : une seule notification. Quand la transmission rend imprimable l'avis de **ce** dossier, `AVIS_A_IMPRIMER` ne part
>   pas ; c'est `DECISION_TRANSMISE_SIGMP` qui le dit. Ailleurs, `AVIS_A_IMPRIMER` est inchangé (signature du PV, levée des
>   réserves, archivage, publication de l'AGPM, cérémonie, compte de l'ARMP). Conséquence pour le front : la ligne « À faire »
>   `AVIS_A_IMPRIMER` est calculée et non tirée des notifications, elle apparaît donc comme avant.
> - **H3** : aucun rattrapage. Le dossier 00002/DAOO-CC/CNM/2026 ne reçoit rien. Son avis, quand la cérémonie sera close,
>   déclenchera `AVIS_A_IMPRIMER` comme aujourd'hui.

## Côté front, une fois livré

- `notification-route` : `DECISION_TRANSMISE_SIGMP` → la page du dossier (`/<espace>/dossier/:id`) pour la PRMP et l'UGPM.
- La cloche et l'écran « Notifications » l'affichent d'office (libellé du type à ajouter).
