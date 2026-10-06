# Demande backend — 2026-10-06 — Le retrait du DAO après paiement des frais : le reçu validé avant le téléchargement

> Décision du pilote (06/10), « Voie B » : un candidat ne peut télécharger le dossier d'appel d'offres qu'après avoir
> **déposé le reçu** du paiement des frais de dossier, et que la PRMP l'a **validé**.

**Le constat.** Aujourd'hui (`demande-backend-2026-10-04-soumission-en-ligne.md` §B8, V65), le retrait est **libre** pour tout
compte candidat confirmé :
- chaque téléchargement est inscrit au registre des retraits de la PRMP ;
- le paiement se fait hors de la plateforme, sur le compte de l'ARMP (`{{PARAM.compte-dao}}`) ;
- le reçu (`RECU-DAO`) est une **pièce de l'offre**, vérifiée par la commission en séance.

Un candidat lit donc le dossier sans avoir payé. Le pilote veut que le paiement soit contrôlé **avant** le retrait.

**La décision.**
1. Le candidat dépose son reçu sur la plateforme.
2. La PRMP le valide, ou le refuse avec un motif.
3. Les documents ne se téléchargent qu'avec un reçu **validé**.

La plateforme n'encaisse rien : le paiement reste un versement sur le compte de l'ARMP. Aucun paiement en ligne n'est demandé
(c'était la voie C, écartée).

Les noms ci-dessous sont **proposés** : le backend fait autorité, et ce document sera corrigé en place si la livraison s'en écarte.

---

## B1 — Les frais, servis avec la procédure

`ProcedureEnLigneDto` gagne **`fraisDossier`** : `[{ lot, montant }]`.
- La source est `B04-DS-05` de la version validée. La valeur est donnée **par lot** (`B04-DS-05#n`) quand la fiche est saisie
  par lot, avec `lot = null` pour un marché non alloti.
- **`null` ou un montant nul** pour tous les lots : **le retrait reste libre**, comme aujourd'hui (un dossier gratuit n'a pas
  de reçu).
- Le compte à créditer est déjà servi par `GET /api/parametres/compte-dao`. Il faudrait le rendre **lisible par un
  `CANDIDAT`** ; ou bien `ProcedureEnLigneDto` sert `compteDao: { banque, titulaire, numeroCompte }`, au choix du backend.

> ⚠️ **2026-10-06 — livré.** Écarts et précisions :
> - `ProcedureEnLigneDto` sert **`compteDao`** = `{ banque, titulaire, numeroCompte }` (le paramètre `compte-dao`) ; la route
>   `GET /api/parametres/compte-dao` reste interne. `compteDao` vaut `null` pour un dossier gratuit ou un compte non réglé ;
> - il sert aussi **`retraitPayant`**, le résultat de B1 et de H2 : c'est lui qui dit si la garde de B4 s'applique ;
> - les frais se lisent sur `B04-DS-05#n`, à défaut `B04-DS-05`, et au contrat-cadre de travaux sur `B04-DK-04`.

## B2 — Le reçu, déposé par le candidat

| Méthode | URL | Accès | Corps / réponse |
|---|---|---|---|
| POST | `/api/procedures-en-ligne/{idDmc}/recus` | `CANDIDAT` | multipart : `fichier` + `data` `{ lots, montant, referencePaiement, datePaiement, banque }` → 201 `RecuDto` |
| GET | `/api/procedures-en-ligne/{idDmc}/recus/mien` | `CANDIDAT` | `RecuDto` le plus récent de **son entreprise**, ou 404 |
| GET | `/api/procedures-en-ligne/{idDmc}/recus/mien/fichier` | `CANDIDAT` | le fichier qu'il a déposé |

`RecuDto` (proposé) contient :
- `idRecu`, `lots`, `montant`, `referencePaiement`, `datePaiement`, `banque`, `nomFichier`, `dateDepot` ;
- `etat` : `EN_ATTENTE` | `VALIDE` | `REFUSE` ;
- `motifRefus`, `dateDecision`, `decidePar` (la fonction, pas le nom).

Les règles :
- **Un reçu par entreprise**, pas par compte. Un groupement passe par son mandataire. Le reçu couvre un ou plusieurs lots :
  `lots = null` vaut « tout le dossier ».
- **Fichier** : PDF, JPEG ou PNG, de 5 Mo au plus (proposé ; un paramètre Administrateur si vous préférez). Le type est
  contrôlé sur le contenu, pas sur l'extension, comme les pièces de l'entreprise.
- **Après un refus**, le candidat dépose un **nouveau** reçu. L'ancien est gardé, en lecture, avec son motif : l'historique
  ne s'efface pas.
- **Pendant qu'un reçu est `EN_ATTENTE`** : 409 `RECU_EN_ATTENTE` sur un second dépôt. **Après `VALIDE`** : 409
  `RECU_DEJA_VALIDE`, sauf pour **ajouter des lots** non couverts (un nouveau reçu pour ces lots).
- **Fermeture** : 409 `PROCEDURE_FERMEE` après la date limite ; 403 `ENTREPRISE_EXCLUE` pour une entreprise exclue ; 409
  `ENTREPRISE_ABSENTE` sans entreprise déclarée. Ce sont les codes déjà connus du dépôt.
- **Montant** : un montant inférieur aux frais des lots couverts n'est **pas refusé** au dépôt. La PRMP le voit, signalé,
  et décide.

> ⚠️ **2026-10-06 — livré.** Écarts et précisions :
> - la partie `data` est un JSON, envoyée en `application/json` ou en texte ; illisible, elle donne 400 `DONNEES_INVALIDES`.
>   Champs exigés : `montant` (> 0), `referencePaiement` et `datePaiement` (pas dans le futur), avec un 400 par champ. `banque` est
>   facultative. `lots` : `null`, vide, ou un marché non alloti valent « tout le dossier », et des lots inconnus donnent 400 ;
> - **`ENTREPRISE_EXCLUE` répond 409**, comme au dépôt de l'offre, et non 403 ;
> - un dossier **gratuit** répond 409 `PROCEDURE_FERMEE` : il n'y a rien à payer ;
> - les autres codes ajoutés : 400 **`FICHIER_ABSENT`**, 400 `FORMAT_INVALIDE` (type lu sur le contenu), 413 au-delà de
>   `tailleMaxPieceMo` ;
> - `RECU_DEJA_VALIDE` : un nouveau reçu n'est accepté que pour des lots que les reçus validés ne couvrent pas encore.

## B3 — La validation, par la PRMP

| Méthode | URL | Accès | Réponse |
|---|---|---|---|
| GET | `/api/fiches-marche/{idDmc}/recus` | PRMP et UGPM de la fiche | `RecuPrmpDto[]`, les `EN_ATTENTE` d'abord, puis du plus récent au plus ancien |
| GET | `/api/fiches-marche/{idDmc}/recus/{idRecu}/fichier` | idem | le fichier |
| POST | `/api/fiches-marche/{idDmc}/recus/{idRecu}/valider` | idem | `RecuPrmpDto` |
| POST | `/api/fiches-marche/{idDmc}/recus/{idRecu}/refuser` | idem | corps `{ motif }` (obligatoire) → `RecuPrmpDto` |

Les règles :
- `RecuPrmpDto` = `RecuDto` + `entreprise { raisonSociale, nif }` + `compte` + **`fraisAttendus`** (la somme des frais des lots
  couverts) + **`montantInsuffisant`** (booléen).
- **Qui décide** : la PRMP **et l'UGPM** de la fiche, sur le modèle de la saisie de la CAO (arbitrage du 04/10). Pas
  l'Administrateur.
- **Une décision ne se reprend pas.** Valider un reçu `REFUSE`, ou refuser un reçu `VALIDE`, renvoie 409 `RECU_DEJA_DECIDE`.
  Une erreur se corrige par un nouveau dépôt du candidat.
- **Le journal** garde `RECU_DEPOSE`, `RECU_VALIDE` et `RECU_REFUSE` : qui, quand, quel reçu ; le motif pour un refus.
- **Les notifications** :
  - à chaque dépôt, la PRMP et l'UGPM de la fiche reçoivent une **notification** (le flux temps réel existant) : « Reçu de
    frais de dossier à valider — {référence du DAO} » ;
  - à chaque décision, le **candidat** reçoit un **courriel** : validé ; ou refusé, avec le motif.

> ⚠️ **2026-10-06 — livré.** Écarts et précisions :
> - le DTO est un seul `RecuDto` pour les deux publics. `entreprise`, `compte` (l'adresse du déposant), `fraisAttendus` et
>   `montantInsuffisant` sont servis à la PRMP et à l'UGPM, et valent `null` pour le candidat. `fraisAttendus` est la somme des
>   frais des lots couverts, ou de tous les lots pour un reçu « tout le dossier » ;
> - `decidePar` vaut `PRMP` ou `UGPM` ;
> - **notifications** : `RECU_A_VALIDER` part à la **PRMP** de la fiche, dans son flux temps réel. L'UGPM n'a pas de centre de
>   notifications propre (son compte porte la référence de sa PRMP) : elle voit les reçus en attente dans l'écran. Le candidat
>   reçoit `RECU_VALIDE` ou `RECU_REFUSE` par courriel, avec une trace.

## B4 — La garde sur le téléchargement

- `GET …/documents` (la liste) reste servie à tout candidat connecté : il voit **ce qu'il achète**.
- `GET …/documents/{code}` renvoie **403 `FRAIS_NON_REGLES`** tant que l'entreprise du compte n'a pas de reçu `VALIDE`
  couvrant **au moins un lot**. Le dossier est commun à tous les lots : un lot payé ouvre tout le dossier. Le registre
  des retraits n'inscrit rien en cas de 403.
- Un dossier **gratuit** (B1) reste libre.
- Un **agent** reçoit toujours 403, comme aujourd'hui.

> ⚠️ **2026-10-06 — livré, conforme.** La garde ne joue que si `retraitPayant` est vrai (H2).

## B5 — L'offre et la séance

Le reçu validé **est** la preuve du paiement : le redemander dans l'offre ferait doublon.
- `PieceAttendue` `RECU-DAO` passe à **`obligatoire = false`** et gagne **`dejaFourni: true`** pour une entreprise dont un reçu
  couvrant le lot est `VALIDE`. Le front l'affichera « Reçu validé le … » sans champ obligatoire. `GET …/pieces` devient donc
  **relatif au candidat connecté** ; sans session, il reste générique.
- **En séance**, la lecture (`OffreLue`) gagne **`fraisDossier`** : `{ regle: boolean, dateValidation, referencePaiement }`, lu
  par le serveur. Ce n'est pas une donnée scellée : elle ne révèle rien de l'offre.
- **Alerte `FRAIS_NON_REGLES`** quand une offre ouverte vient d'une entreprise **sans** reçu validé pour son lot (par exemple
  un dossier retiré sur papier). C'est une **alerte, jamais un refus** : la commission décide, comme pour la garantie.

> ⚠️ **2026-10-06 — livré.** Écarts et précisions :
> - `dejaFourni` n'est servi que sur `RECU-DAO` et pour un **retrait payant**. Il vaut `false` sans session, et `null` ailleurs.
>   `RECU-DAO` passe à `obligatoire = false` pour un retrait payant ;
> - un dossier **sans frais renseignés** (`B04-DS-05` vide) garde `RECU-DAO` **obligatoire**, comme avant : l'absence du champ ne
>   prouve pas que le dossier est gratuit ;
> - la séance sert `fraisDossier` (`null` pour un retrait libre) ; l'alerte `FRAIS_NON_REGLES` n'apparaît que dans la lecture
>   complète et le PV complet, pas dans le PV publié.

## B6 — Le registre

`GET /api/fiches-marche/{idDmc}/retraits` gagne, par ligne, **`recu`** : `{ etat, referencePaiement }` du reçu qui a ouvert le
retrait. Ainsi la PRMP voit que chaque retrait est couvert.

> ⚠️ **2026-10-06 — livré, conforme.** Pour un retrait libre, `recu` vaut `null`. Le registre reste lu par la PRMP seule, comme
> avant.

---

## Hypothèses (à confirmer ou corriger)

- **H1 — Pas de validation automatique.** Aucun délai ne valide un reçu de lui-même : c'est la PRMP qui atteste le paiement.
  Le front affichera à la PRMP « en attente depuis … », et l'Administrateur pourra suivre les reçus en attente.
  *Si le pilote veut un délai de traitement contraignant (par exemple 1 jour ouvrable), il deviendra un paramètre
  Administrateur, utilisé pour un rappel, pas pour une validation.*
- **H2 — Transition.** La règle vaut pour les procédures **lancées après la livraison** (première impression de l'avis
  postérieure). Une procédure déjà ouverte en ligne garde le retrait libre jusqu'à sa clôture, pour ne pas fermer un
  dossier à des candidats qui l'ont déjà retiré. *Le backend peut proposer un indicateur figé sur la fiche à la première
  publication.*
- **H3 — La vérification du paiement est documentaire.** La PRMP compare le reçu au relevé de l'ARMP hors de la
  plateforme. Aucun raccordement bancaire n'est demandé.
- **H4 — Données personnelles.** Le reçu et son fichier suivent la conservation des offres (paramètre Administrateur, V70), à
  compter de la clôture de la procédure.

> ⚠️ **2026-10-06 — H1 à H4 retenues.** **H2** : il n'y a pas d'indicateur sur la fiche. La migration V72 pose le paramètre
> `RETRAIT_PAYANT_DEPUIS` à sa date d'application. Le retrait est payant si le **premier avis imprimé** est postérieur à cette date,
> une date qui ne change plus. `ProcedureEnLigneDto.retraitPayant` donne le résultat. **H4** : la purge de conservation (V70) vide
> aussi le fichier des reçus de la procédure ; la ligne et le journal restent.

## Questions

1. **Q1** : le reçu est-il bien **par entreprise** (et non par compte) ? C'est l'entreprise qui soumissionne ; deux comptes de
   la même entreprise partageraient le reçu.
2. **Q2** : faut-il un plafond de **taille** propre au reçu, ou réutiliser `tailleMaxPieceMo` des pièces de l'entreprise ?
3. **Q3** : `GET …/pieces` relatif au candidat (B5) vous convient-il, ou préférez-vous une route à part
   (`…/pieces/mien`) ?

> ⚠️ **2026-10-06 — livré (V72), réponses.** **Q1** : oui, le reçu est **par entreprise**, et la clé en est le **NIF** de
> l'entreprise déclarée par le compte : deux comptes de la même entreprise le partagent. **Q2** : le plafond est le même que pour
> les pièces de l'entreprise, `tailleMaxPieceMo` (413 au-delà) ; aucun paramètre n'est ajouté. **Q3** : `GET …/pieces` reste
> public et devient relatif au candidat connecté ; il n'y a pas de route à part.

## Ce que le front fera, dès la livraison

- **Côté candidat**, sur la page de la procédure :
  - les frais par lot et le compte de l'ARMP ;
  - la section « Frais de dossier » : déposer son reçu, puis suivre son état (en attente, validé, refusé avec motif,
    nouveau dépôt) ;
  - les boutons « Retirer » désactivés tant que le reçu n'est pas validé, avec la raison en clair ;
  - au dépôt de l'offre, `RECU-DAO` affiché « Reçu validé le … ».
- **Côté PRMP et UGPM**, un écran « Reçus des frais de dossier » dans la fiche (à côté du registre des retraits) :
  - la liste, les `EN_ATTENTE` d'abord ;
  - le fichier ouvert par `ouvrirBlobSur` ;
  - « Valider » et « Refuser » (motif obligatoire, dans une modale) ;
  - le montant insuffisant signalé.
- **En séance**, la ligne « Frais de dossier » de chaque offre, et l'alerte `FRAIS_NON_REGLES`.

> ✅ **Front, 2026-10-06 — livré et recetté** (JAR V72, fiche 47, travaux, frais de 100 000 Ar).
> - **Candidat** : section « Frais de dossier » sur la page de la procédure (`app-frais-dossier`) : frais par lot, compte de l'ARMP,
>   dépôt du reçu (lots, montant, référence, date, banque, fichier), état et motif d'un refus, nouveau dépôt. Les boutons
>   « Retirer » restent désactivés tant que `retraitPayant` est vrai et qu'aucun reçu n'est validé. Au dépôt de l'offre, `RECU-DAO`
>   avec `dejaFourni` porte « Reçu des frais de dossier déjà validé ».
> - **PRMP et UGPM** : écran `/prmp/dao/{idDmc}/recus` (bouton « Reçus des frais de dossier » sur la fiche ; notification
>   `RECU_A_VALIDER` → cet écran) : en attente d'abord, montant insuffisant signalé, « Voir le reçu » (`ouvrirBlobSur`), « Valider »,
>   « Refuser… » (modale, motif obligatoire). Le registre des retraits gagne la colonne « Reçu des frais ». En séance : la ligne
>   « Frais de dossier » et l'alerte `FRAIS_NON_REGLES`.
> - **Recette verte** : retrait sans reçu → 403 `FRAIS_NON_REGLES` et 21 boutons sur 21 désactivés ; deux reçus déposés ; deux
>   notifications `RECU_A_VALIDER` à la PRMP ; reçu à 100 000 Ar validé, reçu à 50 000 Ar refusé avec motif (signalé « inférieur aux
>   100 000 Ar attendus ») ; le candidat validé retire le dossier, le registre porte `recu = VALIDE` ; le candidat refusé lit le motif ;
>   `RECU-DAO` servi `dejaFourni = true`, `obligatoire = false`.
> - ⚠️ **À régler par l'Administrateur** : le compte de l'ARMP (`/api/parametres/compte-dao`) est vide sur DBPRS20 ; `compteDao` vaut
>   donc `null` et le candidat ne voit pas où verser. Le retrait reste bien payant.

> ✅ **Front, 2026-10-06 — recette de la séance verte** (fiche 48, travaux, frais de 100 000 Ar). L'entreprise 1 a déposé son reçu
> (validé) puis son offre ; l'entreprise 2 a déposé son offre **sans** reçu : son bouton « Retirer » restait inactif, le dépôt de
> l'offre, lui, n'est pas bloqué. En séance : offre 1 `fraisDossier = { regle: true, referencePaiement, dateValidation }` ; offre 2
> `{ regle: false }` et l'alerte `FRAIS_NON_REGLES` « Aucun reçu de frais de dossier validé pour l'entreprise ». La ligne « Frais de
> dossier » s'affiche dans la lecture (« réglés · réf. … · reçu validé le … » / « aucun reçu validé »).
