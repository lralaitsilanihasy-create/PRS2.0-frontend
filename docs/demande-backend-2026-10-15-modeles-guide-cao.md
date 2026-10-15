# Demande backend — 2026-10-15 — PV et rapports de la commission d'appel d'offres alignés sur le guide de la CAO

## Contexte

Le pilote a fourni le **Guide de la Commission d'Appel d'Offres** (ARMP, mai 2008 : `docs/GuideCAO/`, annexes 1 à 3, p. 18 à 39). Il
contient les modèles de PV et de rapports d'évaluation de la commission, **par catégorie** :
- **fournitures** (annexe 1) et **travaux** (annexe 2) : PV d'ouverture des plis, rapport d'évaluation des offres, PV de validation ;
- **prestations intellectuelles** (annexe 3) : PV d'ouverture des plis, rapport d'évaluation des propositions techniques, PV de
  validation de ce rapport, PV d'ouverture des propositions financières, rapport d'évaluation finale, PV de validation finale.

Le front a confronté ces modèles aux documents produits (code au 15/10 : `SeanceService.pdf`, `SeanceFinanciereService.document`,
`EvaluationService.document`, `ResultatsPi.sections`). Le guide cite des textes abrogés (code de 2004, décret 2006-344) : les documents
continuent de citer la **loi n° 2016-055**.

Décisions du pilote (15/10) :
- le guide sert de **canevas** des documents de la commission ; le canevas suit la **catégorie** (fournitures, travaux, prestations
  intellectuelles), pas le sous-type : cela **clôt le §B3 de la demande Q-pièce du 14/10** (« canevas par sous-type, modèles du
  pilote ») ;
- l'application garde ses choix du travail en ligne : rapport signé valant PV de validation (Q4), pas de sous-comité technique
  d'évaluation (SCTE), pas de signature des représentants des candidats (le PV leur est publié), signature électronique et journal à la
  place du paraphe et de la fiche de présence ; les sections que le guide n'a pas (offres anormales, observations, déclarations de
  conflit d'intérêts, échanges avec les candidats) restent ;
- **n° 16** : la commission peut refuser de valider et faire reprendre l'évaluation (B5) ;
- **n° 13** : la conversion en monnaie unique est **sans objet** tant que le DAO impose l'ariary.

Les documents sont des documents de travail lisibles par la commission et la PRMP : les tableaux du guide y sont repris **en tableaux**
(le `DocumentLibre` actuel n'écrit que des paragraphes : un élément tableau est sans doute à ajouter).

## B1 — PV d'ouverture des plis (`PV_OUVERTURE`)

1. **En-tête** : ajouter, quand l'application les connaît, la **date de l'avis de la Commission** sur le DAO (PV signé), la **date de
   lancement** (première publication de l'avis spécifique, `publication.datePublication`) et les **journaux et supports** de publication
   (`publication.supports`, journal de l'AGPM sans objet ici).
2. **Garantie** : imprimer sa **date de validité** à côté du montant et de l'émetteur, si elle est relevée au dépôt (sinon le dire en
   réponse : c'est une donnée que la commission vérifie en conformité, B3).
3. **Tableau récapitulatif par pli** (modèle du guide), en plus du détail : n° du pli, lot, candidat, acte d'engagement fourni ou non,
   montant et rabais, garantie (fournie, montant, validité), pièces manquantes.
4. **Carence** : la formule du guide — aucun pli reçu à la date et à l'heure limites, « la commission propose de déclarer l'appel
   d'offres infructueux » — avec l'article applicable de la loi n° 2016-055 (au backend de le citer, le front ne l'invente pas).
5. **Levée de séance** : l'heure de clôture de la séance, après l'heure d'ouverture.

## B2 — PV d'ouverture des propositions financières (`PV_FINANCIER`, prestations intellectuelles)

1. Désigner la procédure par sa **référence et son objet** (pas seulement « Procédure 44 »), avec l'autorité contractante et la
   **décision** qui a arrêté la liste restreinte, comme le PV d'ouverture.
2. Lire le **rabais** éventuel de chaque proposition (montant et rabais), comme au PV d'ouverture des offres.

## B3 — Rapport d'évaluation des offres (fournitures et travaux)

1. **Conformité, pièce par pièce** (guide, I.1) : une grille par offre, cotée **C** (conforme), **SC** (substantiellement conforme) ou
   **NC** (non conforme), avec la valeur relevée — acte d'engagement daté et signé ; validité de l'offre ; délai de livraison
   (fournitures) ou d'exécution (travaux) ; bordereau des prix (fournitures) ou bordereau des prix unitaires et détail quantitatif et
   estimatif (travaux) ; état des sommes versées aux tiers ; garantie (forme, validité, montant) ; **certificat de visite des lieux**
   (travaux, quand la fiche la rend obligatoire, `B04-VL-02`) ; autres conditions du DAO. Si l'examen préliminaire ne garde aujourd'hui
   qu'un verdict par offre, le dire : la grille devient alors une saisie de l'étape (à décrire dans la réponse, le front l'outillera).
2. **Conformité des spécifications techniques** (fournitures, guide I.2) : une section par offre, spécification demandée, proposée,
   C/SC/NC — depuis le tableau de conformité technique (`TC`) que la fiche produit.
3. **Comparaison des offres** (guide III) : une colonne par ajustement au lieu du seul total — rabais, **marge de préférence
   nationale**, critères additionnels (fournitures : délai de livraison, de paiement…), variantes techniques — puis montant évalué et
   rang.
4. **Qualification** (guide IV) : la **grille complète**, candidat par candidat dans l'ordre du classement — NIF, non-faillite, état
   211 bis, statistique, registre de commerce, bilan, chiffre d'affaires moyen sur trois ans, fonds de roulement, travaux similaires,
   matériel, personnel, autres critères du DAO — chacun satisfait ou non, et non plus les seuls critères non satisfaits.
5. **Conversion en monnaie unique** : sans objet (le DAO impose l'ariary). Si une fiche admet un jour une autre monnaie, la colonne
   viendra avec elle.

## B4 — Rapport d'évaluation des prestations intellectuelles

Questions, avant toute correction :
1. Le guide fait **valider par la commission le rapport d'évaluation technique avant l'ouverture des propositions financières** (PV de
   validation technique : les enveloppes des candidats sous la note minimale sont renvoyées sans être ouvertes). L'application
   l'exige-t-elle avant la seconde séance, et où cette validation est-elle tracée ?
2. Le rapport présente-t-il le **tableau de la méthode de sélection** retenue — qualité-coût (score S = St × T + Sf × F), moindre coût,
   budget déterminé, qualité technique seule — avec les colonnes du guide (montant corrigé, rabais, montant avec rabais, scores,
   classement) ?
3. La grille de conformité (pouvoir du signataire, expérience, méthodologie, personnel clé) et la notation par critère et sous-critère
   (score maximal, score du candidat) y figurent-elles en tableaux ?

## B5 — Refuser de valider : la commission fait reprendre l'évaluation (décision du pilote, n° 16)

Le guide prévoit trois issues au PV de validation : valider le classement, proposer l'infructuosité, ou **recommander une
ré-évaluation** (demande d'éclaircissement, recadrage…). Aujourd'hui, une fois le rapport produit, les étapes ne se rouvrent plus
(`RAPPORT_SIGNE`) et un membre en désaccord ne peut que joindre une observation à sa signature.

- Avant la dernière signature, le **président** de la commission (ou son représentant désigné pour le rapport) peut **retirer le
  rapport** avec un **motif** obligatoire : les signatures déjà posées tombent, le retrait et son motif sont journalisés et gardés (le
  rapport retiré reste consultable, marqué « retiré »), les étapes redeviennent réouvrables, et la commission est avertie.
- Le rapport suivant cite le retrait précédent (date, motif) dans sa section « Séance de validation ».
- Même règle pour le rapport des prestations intellectuelles.

## Hypothèses (à confirmer ou corriger)

- H1 — Les données des B1 à B3 sont déjà au serveur (publication de l'avis, avis de la Commission, examen préliminaire, ajustements,
  critères de qualification) : il s'agit de les imprimer. Celles qui manquent sont nommées dans la réponse.
- H2 — Les documents déjà produits ne sont pas réécrits ; les règles valent pour les documents produits après la livraison.
- H3 — Le retrait du rapport (B5) n'est possible qu'avant la dernière signature ; après, l'évaluation est close (la reprise sur avis
  défavorable de la Commission ou sur réattribution reste la seule voie, comme aujourd'hui).
- H4 — La validation des PV d'ouverture ne change pas (signature des présents, empêchements, quorum).

## Ce que le front fera

- B5 : dans l'écran de l'évaluation, étape Rapport, un bouton « Retirer le rapport » pour le président (motif obligatoire, modale), le
  rapport retiré listé avec son motif, et les étapes rouvrables à nouveau.
- B3.1, si la grille devient une saisie : la grille de conformité dans l'étape de l'examen préliminaire.
- Les documents eux-mêmes sont produits par le serveur : rien d'autre à afficher que leur nouvelle version.

## Réponse du backend — 2026-10-15 (tranche 1 : B1, B2, B4, B5 ; V120)

> ✅ **Livré** (PRS20, commit de la tranche 1 ; arbitrages du 15/10 : B3.1 la saisie s'étend, B3.2 la commission cote, B1.2 la
> validité de la garantie se vérifie en conformité, deux tranches). **B3 suit en tranche 2.** V120 s'applique au prochain démarrage
> du backend recompilé.
>
> **H1 corrigée** : `DocumentLibre` sait déjà écrire des tableaux (élément `Tableau`, utilisé par les formulaires du candidat) ; rien
> à ajouter. Les données manquantes sont nommées ci-dessous (garantie, décision de liste restreinte, cotes C/SC/NC).
> **H2, H3, H4 confirmées** (un PV ou un rapport qui se régénère à une signature prend la nouvelle forme).

> ✅ **B5 — retirer le rapport** :
> - `POST /api/fiches-marche/{idDmc}/evaluation/rapport/retirer` `{ motif }` → `EvaluationDto` (`etat` = `EN_COURS`, `rapport` nul) ;
>   400 `MOTIF_OBLIGATOIRE`, 403 (ni président ni représentant désigné pour le rapport), 409 `RAPPORT_NON_PRODUIT`, `RAPPORT_SIGNE`
>   (H3 : entièrement signé, l'évaluation est close).
> - Les signatures déjà posées tombent ; le rapport retiré (PDF, Word, signatures) est gardé : `EvaluationDto.rapportsRetires` =
>   `[{ id, produitLe, retireLe, retirePar, nom, motif, signatures }]` (`signatures` : texte lisible, ou nul), et
>   `GET …/evaluation/rapport/retires/{id}` (`?format=docx`) le sert, aux lecteurs du rapport.
> - Les étapes se rouvrent à nouveau par `…/etapes/{etape}/rouvrir` (rien de rouvert d'office : la commission choisit l'étape) ;
>   le responsable produit ensuite un nouveau rapport, qui cite chaque retrait (date, auteur, motif) dans « 10. Séance de validation ».
> - Journal `RAPPORT_RETIRE` ; **nouveau type de notification `RAPPORT_RETIRE`**, à chaque membre de la CAO (à libeller côté front).
> - Même règle pour le rapport PI (même rapport, même évaluation).

> ✅ **B1 — PV d'ouverture** :
> 1. En-tête : « Avis de la Commission nationale des marchés sur le dossier d'appel d'offres : procès-verbal n° …, du …, avis
>    favorable » (le plus récent PV signé du dossier que porte le DMC) ; « Date de lancement (première publication de l'avis d'appel
>    d'offres) : … ; journaux et supports : … » (saisis à la première impression de l'avis spécifique). Absents quand inconnus.
> 2. ⚠️ **Garantie** : sa date de validité **n'est pas relevée au dépôt** (montant, émetteur, code de vérification seulement) ; le PV
>    porte « validité : vérifiée à l'examen de conformité » — elle devient une rubrique cotée de la grille (tranche 2, B3.1).
> 3. Tableau récapitulatif avant le détail : n° du pli, lot, candidat, acte d'engagement (fourni / non fourni), montant lu HT et
>    rabais (« non lu » pour une proposition technique), garantie, pièces manquantes.
> 4. Carence : « Aucun pli n'a été reçu à la date et à l'heure limites de remise des offres (…) : la séance constate la carence, et la
>    commission propose de déclarer l'appel d'offres infructueux (art. 56 de la loi n° 2016-055 relative aux marchés publics). »
> 5. « La séance est levée le … » : l'heure de production du PV (ou du constat d'illisibilité).

> ✅ **B2 — PV financier** : la procédure par sa référence et son objet, l'autorité contractante ; ⚠️ **pas de décision numérotée**
> de la liste restreinte dans l'application : le PV dit ce qui l'a arrêtée — « Liste restreinte arrêtée à l'issue de l'appel à
> manifestation d'intérêt « … », par le rapport de présélection signé le … » (ou la dispense motivée de l'AMI). Le rabais lu de chaque
> proposition, et un tableau (n°, lot, candidat, note et rang techniques, montants HT et TTC, rabais).

> ✅ **B4 — rapport PI, réponses** :
> 1. **Oui** : la seconde séance ne s'ouvre pas tant que l'évaluation technique n'est pas arrêtée pour tous les lots (409
>    `TECHNIQUE_NON_ARRETEE`). ⚠️ La validation est l'**arrêt par le président** (journal, et section 4 du rapport : date, observation,
>    réouverture éventuelle), pas un PV signé par chaque membre : c'est le choix du travail en ligne (rapport signé valant PV de
>    validation). Les enveloppes des éliminés restent scellées (« non ouvertes » au PV financier).
> 2. **Désormais oui** : tableau de la méthode de sélection — montant lu, montant corrigé, rabais déclaré, montant comparé, score
>    financier, score combiné, rang (ou motif). ⚠️ Le rabais d'une proposition financière est **lu, non appliqué** : la méthode
>    compare le prix corrigé hors dépenses remboursables ; il n'y a donc pas de « montant avec rabais ».
> 3. Notation : **désormais en tableau** (critère et sous-critère, score maximal, score de chaque proposition = moyenne des membres,
>    total, rang technique) ; les grilles individuelles restent en annexe. La grille de conformité (pouvoir du signataire, expérience,
>    méthodologie, personnel clé) est celle de l'examen préliminaire : elle passe en tableau coté C/SC/NC avec la tranche 2.

> ✅ **B3 — tranche 2 livrée le 15/10** : voir la réponse ci-dessous.

> ✅ **Front, 2026-10-15 — tranche 1 branchée** :
> - **B5** : étape Rapport de l'évaluation (`features/evaluation/rapport-evaluation.ts`), bouton « Retirer le rapport » proposé au
>   président et au représentant désigné pour le rapport (qualité `REPRESENTANT` parmi les signataires attendus ; le serveur tranche),
>   jamais sur un rapport signé de tous ; modale, motif obligatoire, nombre de signatures qui tombent ; liste « Rapports retirés »
>   (dates, auteur, motif, signatures tombées) avec lecture du PDF (`…/rapport/retires/{id}`) ; `RAPPORT_SIGNE` reformulé (retirer avant
>   de rouvrir ; signé de tous, plus de retrait). Notification `RAPPORT_RETIRE` libellée « Rapport retiré ».
> - B1, B2, B4 : documents du serveur, rien à afficher de plus.
> - Recette navigateur **à faire** : le JAR n'est pas relancé sur V120 (code backend non commité au moment du branchement) et la base
>   ne compte aucune évaluation depuis la remise à zéro du 14/10.
> - Tranche 2 (B3) : la grille de conformité et la cotation des spécifications seront outillées à la livraison du contrat de saisie.

## Réponse du backend — 2026-10-15 (tranche 2 : B3 ; sans migration)

> ✅ **B3.1 — grille de conformité du guide, saisie** (arbitrage : la saisie s'étend) :
> - `conformite.verifications[]` garde ses 9 vérifications et gagne, **à la suite**, `AE_DATE_SIGNE`, `VALIDITE_OFFRE`, `DELAI`,
>   `BORDEREAU`, `SOMMES_TIERS`, `GARANTIE_VALIDITE`, `VISITE_LIEUX`, `AUTRES_CONDITIONS` (libellés servis par le serveur). Chaque
>   vérification porte en plus **`coteProposee`** et **`cote`** ∈ `C` · `SC` · `NC` · `SO` (sans objet) ; nulle = à examiner (à afficher
>   comme telle).
> - Saisie : `PUT …/offres/{idOffre}/conformite`, `verifications[{ code, cote?, satisfaite?, observation? }]` ; la cote **fixe**
>   `satisfaite` (C, SC → vrai ; NC → faux ; SO → nul). 400 `COTE_INVALIDE`, `COTE_INCOHERENTE` (cote et `satisfaite` contraires).
>   Envoyer la cote seule suffit ; `satisfaite` reste accepté comme avant (vrai → C, faux → NC).
> - Propositions : validité déclarée à l'acte d'engagement comparée au DAO (`B04-VO-01`) ; délai déclaré (NC si livraison hors
>   délai) ; bordereau / DQE rempli en ligne → C ; visite des lieux **SO** sauf travaux avec `B04-VL-02` = OUI ; garantie non exigée,
>   retrait sans frais → SO ; date et signature de l'acte, validité de la garantie, autres conditions : à examiner.
> - ⚠️ La grille **n'emporte pas la décision** : `decision` (CONFORME / ECARTEE, motif, clause, qualification) reste saisie par la
>   commission, comme aujourd'hui.

> ✅ **B3.2 — spécifications techniques cotées par la commission** (fournitures, offre déposée par formulaires) :
> - `GET /api/fiches-marche/{idDmc}/evaluation/offres/{idOffre}/specifications` → `[{ idArticle, article, marque, modele,
>   idCaracteristique, caracteristique, exigee, proposee, declareeConforme, coteProposee, cote, observation }]` ; CAO et responsable
>   (403 sinon) ; **vide** pour une offre déposée par pièces (rien à coter en ligne : la rubrique `CONFORMITE_TECHNIQUE` reste la
>   seule).
> - Cote proposée = déclaration du candidat (conforme → C, non conforme → NC, sans déclaration : nulle).
> - Saisie dans le **même PUT** que la conformité : `specifications[{ idArticle, idCaracteristique, cote, observation? }]`, cote C, SC
>   ou NC (400 `COTE_INVALIDE`) ; 400 `SPECIFICATION_INCONNUE` hors du tableau de l'offre. ⚠️ Ce PUT remplace toute la décision :
>   renvoyer les cotes déjà saisies (vérifications et spécifications) à chaque enregistrement.

> ✅ **B3.3 — comparaison** : tableau prix lu, prix corrigé, rabais, marge de préférence, critères additionnels, montant évalué, rang.
> ⚠️ Pas de colonne « variantes » : l'application n'évalue aucune variante (le rapport le dit) ; **B3.5** : conversion en monnaie
> unique dite sans objet au rapport.

> ✅ **B3.4 — qualification complète** : par candidat examiné, dans l'ordre du classement, chaque critère (groupe, libellé), son
> exigence au DAO, le constat, satisfait ou non et le motif. ⚠️ Les critères sont **ceux de la fiche** (`B03-QT-*`, `B03-CQ-*` :
> capacité financière, chiffre d'affaires, travaux similaires, matériel, personnel…) ; NIF, non-faillite, état 211 bis, statistique,
> registre de commerce n'y figurent que si le DAO en fait des critères — sinon ce sont des **pièces**, cotées dans la grille de
> conformité (rubrique `PIECES`).

> Le rapport (section 3) imprime pour chaque offre la grille cotée (rubrique, valeur relevée, cote, observation) et, en fournitures,
> le tableau de conformité technique coté. Le rapport PI imprime la même grille (rubriques non applicables : SO).

> ✅ **Front, 2026-10-15 — tranche 2 branchée** (`features/evaluation/etape-conformite.ts`) :
> - **B3.1** : la grille de l'examen préliminaire montre toutes les rubriques servies (neuf vérifications et rubriques du guide), avec la
>   valeur relevée, la proposition du serveur (`coteProposee`, sinon l'ancienne `proposee`) et une **cote** C · SC · NC · SO ou « À
>   examiner » ; cote de départ = celle de la commission, sinon la proposée. Le PUT envoie la cote seule (« à examiner » : cote et
>   `satisfaite` nulles). La décision sur l'offre reste distincte, avec le rappel des rubriques non conformes.
> - **B3.2** : volet « Spécifications techniques » (lu à l'ouverture) : article, marque et modèle, caractéristique, exigée, proposée,
>   déclaration du candidat, cote C · SC · NC, observation ; vide → « rien à coter en ligne (offre par pièces) ». Comme le PUT remplace
>   toute la décision, les spécifications sont lues avant l'enregistrement si le volet n'a pas été ouvert, et leurs cotes renvoyées.
> - Refus nommés : `COTE_INVALIDE`, `COTE_INCOHERENTE`, `SPECIFICATION_INCONNUE`.
> - B3.3 à B3.5 : documents du serveur, rien à afficher de plus.
> - JAR relancé sur ce4f8ad (V120 déjà appliquée) ; recette navigateur **à faire** faute d'évaluation en base depuis le 14/10.
