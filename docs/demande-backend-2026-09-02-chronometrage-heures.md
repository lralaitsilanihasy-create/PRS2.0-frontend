# Demande au backend `PRS20` — 2 septembre 2026 — Le chronométrage passe en HEURES ouvrées

> Document destiné à la session backend. Émis depuis le front `frontendprs2`. **Règle du pilote,
> 02/09** : « mettre le délai standard en heure de jour ouvré » — révision de l'unité du
> chronométrage livré hier (`c66db71`). Backend d'abord, le front suivra.

## 1. Arbitrages du pilote (AskUserQuestion, 02/09)

① **Périmètre : TOUT le chronométrage** — délais standards, prévision saisie à la prise en
   charge, restes et durées restituées. Une seule unité partout : aucune somme ne mélange heures
   et jours.
② **Conversion : 8 heures ouvrées = 1 jour ouvré** (heures de service). Un délai de 16 h avance
   la date prévisionnelle de 2 jours ouvrés ; samedi/dimanche restent exclus, fériés hors
   périmètre v1 (inchangé).

## 2. Contrat attendu (les noms exacts restent à votre main)

1. **Référentiel** : `DelaiStandardDto.delaiJours` → `delaiHeures` (entier **≥ 1**, 400 sinon) ;
   `PUT /api/delais-standards/{etape}` inchangé pour le reste. **Migration des valeurs
   existantes : × 8** (l'Admin a pu les modifier — convertir, ne pas réinitialiser) ; le seed
   d'hier devient 8 / 8 / 40 / 16 / 8 / 24 / 8 / 16 h. Le repli « étape manquante » passe de
   1 jour à **8 h**.
2. **Prise en charge** : le corps devient `{ "previsionHeures": entier ≥ 1 }` (400 sinon). Le POST
   rejoué sur une tâche ouverte corrige la prévision, comme aujourd'hui. À votre main : tolérer ou
   refuser un `previsionJours` résiduel — le front bascule le même jour, il n'y a pas d'autre
   client.
3. **Restitution** : `TacheDossierDto.previsionJours` → `previsionHeures`,
   `dureeJoursOuvres` → `dureeHeuresOuvrees` ; compteurs du `ChronometrageDto`
   (`dureeBrute…`/`dureeNette…`/`attentePrmp…`) en **heures ouvrées** eux aussi (arbitrage ① :
   une seule unité). `datePrevisionnelleFin` reste une **date**.
4. **Calcul de la date** : inchangé dans sa forme —
   `aujourd'hui + reste(étape en cours) + Σ prévisions restantes` — mais la somme est en heures
   ouvrées et se convertit en jours par tranche de 8 h. Recommandation : **arrondi au jour ouvré
   supérieur** (une journée entamée compte pleine — la date glisse, elle ne ment pas ; un délai en
   dépassement compte toujours 0).
5. ⚠️ **Piège de cohérence — l'écoulé doit être dans la MÊME échelle que la prévision.**
   `reste = max(0, prévision − écoulé)` : si la prévision est en heures « 8 h/jour » et l'écoulé
   en heures d'horloge (24 h/jour), une tâche prise en charge hier matin serait déjà « en
   dépassement » de 16 h à tort. L'écoulé entre deux horodatages doit compter **au plus 8 h par
   jour ouvré** (l'algorithme exact — plafond journalier ou fenêtre de service — est à votre
   main, documentez-le). L'horodatage brut à la seconde, lui, ne change pas.
6. **Historique** : la base ne porte qu'un dossier vivant (100278, créé le 02/09) avec ses
   premières occurrences en jours — migration × 8 de `PREVISION_JOURS` comme du référentiel, ou
   purge assumée de ses tâches si plus simple (dossier de recette) : dites ce que vous choisissez.

## 3. Ce que le front livrera ensuite

1. Écran Admin « Délais standards » : libellés et saisies en **heures ouvrées**.
2. Widget de prise en charge : « Ma prévision pour cette étape (heures ouvrées) », POST
   `previsionHeures`.
3. Frise et compteurs : affichage en heures ouvrées (avec l'équivalent jours quand c'est parlant,
   ex. « 40 h (5 j) ») ; la colonne « Fin prévue » PRMP ne change pas (c'est une date).

Comme toujours : **PLAN d'abord** pour validation (surtout le point 5 et la migration), tests
(conversion 8 h/jour, arrondi de la date, écoulé plafonné, migration × 8), docs (`api-endpoints`,
`regles-gestion`, **dans le repo backend**), **commit + push complet, migration comprise**.
