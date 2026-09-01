# Demande au backend `PRS20` — 1ᵉʳ septembre 2026 — Chronométrage et prévision des délais de traitement

> Document destiné à la session backend. Émis depuis le front `frontendprs2`. **Règle du pilote,
> 01/09** : permettre à la PRMP de connaître la **date prévisionnelle d'achèvement** du traitement
> de son dossier à la CNM. Backend d'abord, le front suivra.

## 0. La règle, telle qu'énoncée

1. **Chronométrage automatique.** Chaque tâche affectée à un profil est chronométrée. Le compteur
   global démarre à l'**enregistrement** du dossier (attribution du numéro par le Secrétaire) et
   s'arrête à la **validation sur SIGMP**. Pour chaque profil intervenant : date/heure de prise en
   charge, date/heure de fin de tâche, durée effective.
2. **Prévision de délai par profil.** À la prise en charge, chaque profil renseigne une prévision
   de délai pour sa tâche. La somme des prévisions des profils restants, ajoutée à la date
   courante, donne la **date prévisionnelle de fin de traitement**.
3. **Restitution.** La PRMP consulte cette date pour chacun de ses dossiers.

## 1. Arbitrages du pilote (AskUserQuestion, 01/09)

① **Prise en charge = geste EXPLICITE** : un bouton « Prendre en charge » à l'arrivée du dossier
   dans la file du profil, où il saisit sa prévision. La durée effective court de ce geste à la
   fin de la tâche ; le temps d'attente avant prise en charge est ainsi mesuré lui aussi.
② **Référentiel de délais standards** par étape, **administrable** (écran Admin) : il fournit la
   prévision des étapes non encore prises en charge — la PRMP a une date dès le premier jour —
   et il est remplacé, étape par étape, par la prévision réellement saisie.
③ **Jours OUVRÉS** entiers (samedi/dimanche exclus ; jours fériés hors périmètre v1). Le
   chronométrage effectif reste horodaté à la seconde ; seule la restitution convertit en ouvrés.
④ **Deux compteurs globaux** : le **brut** (enregistrement → validation SIGMP, comme énoncé) et le
   **net CNM** où les périodes « balle chez la PRMP » sont suspendues — c'est le net qui juge la
   CNM, et la date prévisionnelle glisse quand la PRMP tarde.

## 2. Les étapes chronométrées (proposition, à valider dans votre PLAN)

Dérivées du circuit vivant — chaque étape a un porteur, un événement de début d'éligibilité, et un
**geste métier de clôture déjà existant** (la fin de tâche est automatique, jamais saisie) :

| # | Étape | Porteur | Éligible dès | Close par |
|---|-------|---------|--------------|-----------|
| 0 | Réception & enregistrement | Secrétaire | dossier SOUMIS | « Attribuer un numéro » |
| 1 | Dispatch | P/CC (localité) | PRET_DISPATCH | POST dispatch |
| 2 | Examen | Membre dispatché | DISPATCHE | soumission du PV |
| 3 | Visa | P/CC dispatcheur (ou intérim) | PROJET_SOUMIS | POST viser |
| 4 | Co-signature | Membre co-signataire | PV_A_COSIGNER | signature part MEMBRE |
| 5 | Vérification & validation SIGMP | Vérificateur (ciblé, repli localité) | EN_VERIFICATION | transmission SIGMP |
| 6 | Archivage | Assistant (ciblé, repli localité) | DECISION_TRANSMISE_SIGMP | archivage |

- Le **compteur global** court de la clôture de l'étape 0 à la clôture de l'étape 5 (la règle du
  pilote : enregistrement → validation SIGMP). L'étape 6 est chronométrée par profil mais **hors**
  compteur global. L'étape 0 est chronométrée aussi (sa prévision standard sert à la date
  annoncée à la PRMP dès la soumission).
- **Étapes rejouables** : réexamen (A_REEXAMINER → nouvel examen), nouvelle navette de visa,
  passages successifs du Vérificateur dans la boucle FAVR — chaque occurrence est un
  enregistrement de tâche **distinct, append-only** ; la prévision se ressaisit à chaque prise en
  charge.
- **Suspensions PRMP (compteur net, arbitrage ④)** : les statuts où la balle est chez la PRMP —
  au moins EN_ATTENTE_COMPLEMENTS_DEPOT, EN_ATTENTE_PIECES, EN_ATTENTE_DECISION_PRMP, et la phase
  de rectification des documents témoins — suspendent le net CNM (et aucune tâche CNM n'est en
  cours pendant ces fenêtres). Vous êtes l'autorité sur la cartographie exacte des statuts.

## 3. Contrat attendu (formes indicatives — vous êtes l'autorité sur les URL et DTO)

1. **Prise en charge** : `POST /api/dossiers/{id}/prise-en-charge` `{ previsionJours: entier ≥ 1 }`
   — réservé au porteur éligible de l'étape courante (mêmes gardes que le geste métier de l'étape,
   délégations et intérim compris) ; 409 si l'étape n'est pas ouverte ou déjà prise en charge par
   l'acteur attendu. La prévision est **modifiable** tant que la tâche est ouverte (PUT ou même
   POST rejoué, à votre main).
2. **Tolérance** : un geste métier de clôture SANS prise en charge préalable n'est **pas bloqué**
   — le backend crée l'occurrence avec prise en charge = fin (durée effective nulle) et prévision
   = standard du référentiel. Le chronométrage ne doit jamais empêcher le métier.
3. **Référentiel des délais standards** : table + CRUD Admin (`GET/PUT /api/delais-standards` ou
   équivalent) — un délai en jours ouvrés par étape du §2. Seed initial à votre main (ex. : 1, 1,
   5, 2, 1, 3, 2), l'Admin ajuste ensuite.
4. **Calcul serveur de la date prévisionnelle** (aucun calcul front) :
   `datePrevisionnelleFin = aujourd'hui + reste(étape en cours) + Σ prévisions des étapes
   restantes jusqu'à l'étape 5 incluse` — en jours ouvrés ; `reste = max(0, prévision − ouvrés
   écoulés depuis la prise en charge)` (une étape en dépassement compte 0 : la date glisse jour
   après jour, elle ne ment pas) ; étapes restantes = prévision saisie si prise en charge, sinon
   standard. Pendant une suspension PRMP, la date reste calculée mais un drapeau `attentePrmp`
   l'accompagne (le front écrira qu'elle glisse tant que la PRMP n'a pas rendu la main).
5. **Exposition** :
   - `DossierDto` : `datePrevisionnelleFin`, `attentePrmp` (et, si peu coûteux, l'étape courante).
   - `GET /api/dossiers/{id}/chronometrage` : les occurrences de tâches — étape, profil, acteur
     (im + nom), prise en charge, fin, prévision, durée effective, en cours/suspendue — plus les
     compteurs globaux (début, fin SIGMP, brut, net CNM, cumul des attentes PRMP en ouvrés).
     Visible PRMP (son dossier) et profils du circuit ; c'est la matière de la frise front.
6. **Transition** : la base vient d'être RÉINITIALISÉE (reset total du 01/09, plus aucun dossier
   vivant) — **aucune reprise d'historique à prévoir**. Les dossiers créés après déploiement sont
   chronométrés dès leur soumission ; pas de reconstitution rétroactive.

## 4. Ce que le front livrera ensuite

1. Bouton « Prendre en charge » + saisie de la prévision dans les files de chaque profil
   (réceptions Secrétaire, mes dossiers P/CC, à-examiner Membre, panneau PV, files Vérificateur/
   Assistant), avec l'état « pris en charge le … — prévu N j ouvrés ».
2. PRMP : colonne « Fin prévue » sur ses listes de dossiers + la date (et le drapeau « en attente
   de vos compléments ») dans le détail ; frise de chronométrage par étape.
3. Écran Admin « Délais standards ».
4. Aucun calcul de date côté front : tout vient du serveur.

Hors périmètre (lots ultérieurs si le pilote les demande) : alertes de dépassement, jours fériés,
indicateurs agrégés de pilotage sur les durées effectives.

Comme toujours : **PLAN d'abord** pour validation (notamment la liste des étapes du §2 et la
cartographie des statuts suspensifs), tests (prise en charge/gardes/tolérance, calcul ouvrés,
suspension, étapes rejouées), docs (`api-endpoints`, `regles-gestion`, **dans le repo backend**),
**commit + push complet, migration et fichiers neufs compris**.
