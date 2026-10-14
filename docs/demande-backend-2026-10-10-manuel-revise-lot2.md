# Demande backend — manuel de contrôle révisé pour l'application, lot 2 : délais, mode, bloquants, acte d'engagement (2026-10-10)

Origine : `docs/manuel-controle-revise-2026-10-10-application.md`, §21 (arbitrages du pilote du 10/10, second lot : Q6, Q1, Q13, H2). Suite
du lot 1 (`demande-backend-2026-10-10-manuel-revise-lot1.md`). Les neuf délais et les quinze bloquants viennent de la loi n° 2016-055 ; les
articles ont été relus dans le texte (version CNLEGIS). Ce qui existe déjà est nommé par son code serveur ; ce lot ne demande que les écarts.

## Hypothèses (à confirmer ou corriger)

- **H1** — Convention de décompte des délais : le jour de départ n'est pas compté ; la date limite tombe au plus tôt le 31e (46e, 11e…) jour.
  « Jours francs » et « jours ouvrables » suivent le calendrier des jours fériés déjà servi (`/api/jours-feries`).
- **H2** — Le « point de départ » d'un délai de publicité est la **date de publication déclarée** par la PRMP à l'impression de l'avis
  (`datePublication`) ; si plusieurs supports sont déclarés, la plus tardive (règle prudente du pilote). Q7 (site de l'ARMP) reste ouverte.
- **H3** — Le mode d'une procédure est le cadrage `modeRemise` de la fiche DAO (PAPIER / ELECTRONIQUE).

## B1 — Les neuf délais légaux (Q6) : règles bloquantes

Nouveau service **`DelaisLegaux`** (table en code, pas en base : valeurs légales), avec pour chaque délai : code, valeur, unité (jours,
jours francs, jours ouvrables), texte, point de départ, sens (minimum / maximum). Exposé en lecture par `GET /api/delais-legaux` pour
l'écran et pour le PV (valeur constatée). **Les autres délais** (AOR, DC/PI, AMI, contrat-cadre, délais aménagés 15 j…) deviennent des
**paramètres administrables** (`t_delai_parametre` : code, valeur, unité, texte, actif ; écran Délais), **signalés** et non bloquants
tant que le pilote ne les a pas confirmés (§21, tableau « à confirmer »).

| # | Règle | Où elle bloque | Refus |
|---|---|---|---|
| 1-2 | `B04-LR-03/04` (`B04-OV-02` T, `B04-CP-02` CC) − date de publication ≥ 30 j (AOO national) / 45 j (AOO international, mode « international » du plan) | validation de la fiche (contre la date de publication prévue : prévision LANCEMENT ou `B04-SE-17`) **et** impression de l'avis (contre `datePublication` saisie) | 409 `DELAI_PUBLICITE` `{ requis, constate, depart, limite }` |
| 3 | Questions des candidats recevables jusqu'à J−10 avant la date limite | **nouveau formulaire de questions** (voir B2) : fermeture automatique à J−10 | 409 `QUESTIONS_CLOSES` |
| 4 | Consultation ouverte (mode « consultation » du plan) : date limite − date d'affichage ≥ 10 j | validation de la fiche / impression de l'avis | 409 `DELAI_PUBLICITE` |
| 5 | Plan de passation : sans réponse de la Commission dans les 10 jours ouvrables du dépôt, **réputé approuvé** | planificateur quotidien : dossier DDP `SOUMIS`/`RECU`/`DISPATCHE` sans PV signé 10 j ouvrables après `DATE_SOUMISSION` ⇒ statut `REPUTE_APPROUVE`, journal, notification PRMP et Président ; la garde `PV_NON_SIGNE` de la création d'un DMC accepte ce statut | — (déblocage) |
| 6 | Signature du marché ≥ 10 jours francs après la plus tardive des **réceptions** de l'information par les non-retenus | **[existe]** : délai d'attente calculé de la plus tardive de l'information et de l'affichage. Écart : le pilote compte depuis la **réception** par chaque non-retenu (`LUE_LE` de chaque lettre, à défaut l'envoi + délai postal ?) — **à arbitrer** (QB1) | 409 `DELAI_ATTENTE` **[existe]** |
| 7 | Pièces fiscales (≤ 6 mois) et sociales (≤ 3 mois) à la date de notification de l'attribution ; dépôt sous 15 jours | **[existe]** : échéance de 15 j, retrait proposé. **À ajouter** : à la vérification d'une pièce, `DATE_DELIVRANCE` ≥ notification − 6 mois (fiscale) / − 3 mois (sociale), sinon non conforme d'office | 400 `PIECE_TROP_ANCIENNE` |
| 8 | Avis d'attribution envoyé ≤ 30 jours après la notification | **non bloquant** : alerte à J+20 (`ALERTE_AVIS_LE`, à confirmer qu'elle existe et à régler à J+20), tâche obligatoire avant la clôture du dossier de marché | — |
| 9 | Déclaration sans suite : avis de la Commission ≤ 5 jours de la saisine | **[existe]** : déclaration refusée sans avis favorable, alerte la veille. **À ajouter** : relance à J+5 (PRMP, Membre, Président) ; le blocage reste jusqu'à l'avis exprès | — |

## B2 — Questions des candidats avant la date limite (table n° 3, art. 35-II)

N'existe pas. Besoin : `t_question_candidat` (procédure, candidat, question, posée le, réponse, répondue le, publiée le) ; `POST
/api/procedures-en-ligne/{idDmc}/questions` (candidat connecté ayant retiré le dossier, refusé après J−10 : 409 `QUESTIONS_CLOSES`) ; `GET`
pour la PRMP et le responsable ; `POST …/questions/{id}/reponse` (PRMP) ; **la réponse est diffusée à tous les candidats ayant retiré le
dossier** (art. 35-II : « l'ensemble des candidats ayant retiré un DAO devra être destinataire des réponses »), notification + page de la
procédure ; les questions et réponses sont jointes au dossier de marché (pièce générée « Questions et réponses »).

## B3 — Mode de la procédure fixé à la création (Q1)

- `modeRemise` du cadrage devient **non modifiable** dès qu'une version de la fiche est validée (409 `MODE_FIGE`) ; la révision copie le mode.
- Exception « migration documentée » : geste d'administration `POST /api/fiches-marche/{idDmc}/migrer-mode` (motif obligatoire, journal,
  re-saisie contrôlée) — réservé à l'Administrateur, tracé.
- `PiecesExigees` : la condition « procédure en ligne » du lot 1 (B4) lit ce mode ; en PAPIER, les listes V95 restent entières.

## B4 — Les bloquants de la loi (Q13) : les écarts

| # | Écart | Besoin |
|---|---|---|
| 2 | DAO complet avant publication (art. 31) | impression de l'avis refusée tant que `DAO_COMPLET` de la version validée n'est pas produit (`DaoCompletService.assurer` synchrone à la validation, ou 409 `DAO_COMPLET_ABSENT` avec relance) |
| 4 | Rejet d'un dépôt hors délai horodaté et tracé (art. 44) | `t_offre_tentative` (procédure, candidat, lot, horodatage serveur, motif `DELAI_DEPASSE`) écrite à chaque refus de création, d'envoi de morceau ou de scellement ; servie dans le registre des dépôts (`GET …/depots`, section « tentatives refusées ») et dans le PV d'ouverture |
| 9 | Montant évalué jamais saisi à la main (art. 46-47) | **à arbitrer (QB2)** : aujourd'hui `PUT …/offres/{id}/montant` accepte un montant retenu différent de la correction calculée, avec motif. Le pilote exclut la saisie manuelle : ne garder que le choix entre les corrections proposées (`LETTRES_PREVALENT`, `PU_PREVAUT`) et le refus du candidat ; supprimer `montant` libre |
| 10 | Rejet pour prix anormal : demande écrite **et** réponse tracées (art. 48) | **[existe]** demande écrite exigée. **À confirmer (QB3)** : une échéance passée sans réponse vaut « réponse tracée » (manuel 2-III-C P20 : défaut de réponse = refus) ; sinon le rejet attend une réponse |
| 13 | Recours suspensifs paramétrables | paramètre `RECOURS_SUSPENSIFS` (défaut : `REVISION_ARMP`, `REFERE` — comme aujourd'hui) lu par `suspensif()` ; `REEXAMEN` activable |
| 14 | Approbation du marché avant notification (art. 54) | `t_attribution` : `APPROBATION_AUTORITE`, `APPROBATION_DATE`, pièce `APPROBATION` (`t_attribution_piece`) ; notification refusée sans approbation ni enregistrement : 409 `MARCHE_NON_APPROUVE` (l'enregistrement est déjà exigé) |
| 15 | Immutabilité des étapes closes | verrou d'écriture : toute écriture sur la séance, l'évaluation ou l'AMI d'une procédure dont le dossier de marché est **soumis** est refusée (409 `ETAPE_CLOSE`), hors reprise d'évaluation tracée (`t_attribution_reprise`) ; complète l'instantané du lot 1 (B5) |
| 1, 3, 5-8, 11-12 | — | **[existe]** ou couverts par B1 (n° 1, 3) et le lot 1 (n° 6 quorum) |

> ⚠️ **Backend, 2026-10-14 — B4 en cours : tranche R9a livrée (n° 2, 13, 14 ; V111)** ; contrat : `docs/api-endpoints.md`, § *… lot 2,
> tranche R9a*. Arbitrages du 14/10 : R9 en **trois sous-tranches** — **R9a** (n° 2, 13, 14), **R9b** (n° 4 ; n° 9 avec QB2 : la
> correction `AUTRE` est **gardée**, motif obligatoire et signalée comme écart, les autres corrections doivent correspondre aux
> corrections proposées ; n° 10 avec QB3 : l'échéance passée sans réponse **vaut** réponse tracée, le défaut de réponse est écrit),
> **R9c** (n° 15, verrou sur la séance, l'évaluation et l'AMI).
> - n° 2 : l'impression de l'avis **et des lettres d'invitation** assemble le DAO complet s'il manque (synchrone, ~20 s) ; échec → 409
>   `DAO_COMPLET_ABSENT` `{ version }`. **Écart** : sans assemblage actif sur le serveur (Word absent), la règle ne s'applique pas ; la
>   disponibilité ne l'annonce pas. ⚠️ **14/10, suite à la remarque du front** : elle l'annonce désormais — `disponibilite` (avis et
>   lettres) gagne `daoComplet` = `PRODUIT` · `A_ASSEMBLER` · `SANS_ASSEMBLAGE` · `null` (sans version validée), indicatif (`disponible`
>   n'en dépend pas).
> - n° 13 : `GET /api/parametres/recours-suspensifs` → `{ types, connus }` ; `PUT` (Administrateur) `{ types: [...] }`, vide = aucun,
>   400 `RECOURS_INVALIDE` ; défaut `REVISION_ARMP`, `REFERE` ; lu à chaque question, recours déjà déclarés compris.
> - n° 14 : `POST /api/fiches-marche/{idDmc}/attribution/lots/{lot}/approbation` (multipart `autorite`, `dateApprobation`, `fichier`) ;
>   409 `DEJA_APPROUVE` ; `LotAttribution.approbation { autorite, date, le, par, fichier }` ; la notification rend 409
>   `MARCHE_NON_APPROUVE` sans elle, sa date ne précède ni l'approbation ni l'enregistrement. Colonnes `APPROBATION_AUTORITE` /
>   `APPROBATION_DATE` comme demandé, plus `APPROUVE_LE` / `APPROUVE_PAR` pour le geste.
> - **Côté front** : écran Recours suspensifs en administration ; geste « Approbation » entre la signature et la notification dans
>   l'écran Attribution ; message de `DAO_COMPLET_ABSENT` à l'impression (réessayer).

> ✅ **Front, 2026-10-14 — tranche R9a branchée**, vérifiée par les tests (recette navigateur groupée avec le reste du lot 2, après le
> redémarrage qui applique V111-V113) :
> - **n° 13** — écran Administrateur **« Recours suspensifs »** (sommaire des référentiels, sans entrée de menu : le menu de
>   l'Administrateur sature) : une case par type de `connus`, aucune cochée = aucun recours suspensif (dit à l'écran), refus
>   `RECOURS_INVALIDE` nommé. Les libellés des recours de l'écran Attribution ne disent plus « suspend la signature » en dur : la liste de
>   déclaration l'ajoute d'après le réglage du moment (lu une fois pour tous les lots, PRMP seule), un recours déclaré porte son
>   `bloquant` servi.
> - **n° 14** — geste **« Déclarer l'approbation »** après la signature (autorité, date bornée par la signature et aujourd'hui, décision
>   jointe), lu ensuite « Approuvé le … — autorité » avec sa pièce ; la notification ne s'ouvre qu'une fois le marché **approuvé et
>   enregistré** (l'écran dit ce qui manque), un lot notifié avant V111 reste lisible ; `DEJA_APPROUVE` et `MARCHE_NON_APPROUVE` nommés.
> - **n° 2** — `daoComplet` de la disponibilité lu : à `A_ASSEMBLER`, la modale de l'avis et celle des lettres préviennent que
>   l'impression assemble d'abord le DAO complet (~20 s) et le bouton le dit pendant l'attente ; 409 `DAO_COMPLET_ABSENT` nommé avec sa
>   version (« le serveur le reprendra de lui-même : réessayez dans quelques minutes »).

> ⚠️ **Backend, 2026-10-14 — B4 : tranche R9b livrée (n° 4, 9, 10 ; V112)** ; contrat : `docs/api-endpoints.md`, § *… lot 2, tranche R9b*.
> - n° 4 : chaque refus `DELAI_DEPASSE` (création, morceau, scellement) est horodaté et conservé (`t_offre_tentative`, transaction
>   propre) ; `GET …/depots` → `tentativesRefusees[] { horodatage, geste, motif, entreprise, nif, lot, enveloppe, idOffre, dateLimite }`
>   une fois clos ; section au PV d'ouverture. Un morceau renvoyé ne fait qu'une ligne par offre.
> - n° 9 (QB2) : `PU_PREVAUT` / `LETTRES_PREVALENT` doivent reprendre exactement une correction proposée (400 `CORRECTION_NON_PROPOSEE`
>   `{ ligne, regle }`) ; `AUTRE` **et `REPORT`** (jamais proposée par le serveur — **écart**) restent permises avec `motif` (400
>   `MOTIF_OBLIGATOIRE`) ; `Correction` gagne `motif` et `ecart` ; même règle pour la saisie financière PI ; contrôle non bloquant
>   `CORRECTIONS_HORS_CALCUL` au dossier de marché (le Membre le lève avant un avis favorable). **Écart** : la demande parlait d'un
>   « `montant` libre » — il n'existe pas, la latitude venait des corrections libres.
> - n° 10 (QB3) : comportement inchangé (l'échéance passée permettait déjà le rejet) ; `anormale.defautReponse: true` et journal
>   « défaut de réponse … vaut refus de justifier ».
> - **Côté front** : section « tentatives refusées » du registre ; dans la saisie du montant, choisir parmi les corrections proposées et
>   exiger un motif pour `REPORT` / `AUTRE` (afficher `ecart`) ; badge « défaut de réponse » sur l'offre anormale rejetée.

> ✅ **Front, 2026-10-14 — tranche R9b branchée**, vérifiée par les tests (recette navigateur groupée avec le reste du lot 2) :
> - **n° 4** — registre des dépôts (PRMP) : section « Tentatives de dépôt refusées hors délai : n » une fois clos — horodatage du serveur
>   **à la seconde**, entreprise (« candidat sans entreprise déclarée » à défaut) et NIF, lot, enveloppe en PI, geste refusé.
> - **n° 9** — saisie du montant évalué et saisie financière PI : les corrections proposées restaient déjà en lecture (retenue ou non,
>   jamais réécrites) ; une correction `REPORT` / `AUTRE` exige désormais son **motif** pour s'ajouter, se lit « **Hors calcul** » avec son
>   motif (champ modifiable tant que la saisie l'est), et l'enregistrement attend qu'une correction hors calcul d'avant R9b soit motivée
>   (l'écran le dit) ; `motif` part dans le corps ; `CORRECTION_NON_PROPOSEE` nommé avec sa ligne. Le contrôle `CORRECTIONS_HORS_CALCUL`
>   s'affiche par la liste des contrôles du dossier (FR5), sans code dédié.
> - **n° 10** — badge « **Défaut de réponse** » sur l'offre anormale quand `anormale.defautReponse` (infobulle : le silence vaut refus de
>   justifier, art. 48).

> ⚠️ **Backend, 2026-10-14 — B4 : tranche R9c livrée (n° 15) ; B4 est entièrement livré** ; contrat : `docs/api-endpoints.md`, § *… lot 2,
> tranche R9c*. Aucune migration : le « dossier de marché soumis » se lit sur les attributions de la procédure.
> - Toute écriture sous `/api/fiches-marche/{idDmc}/seance/**`, `…/evaluation/**`, `…/ami/**` et `POST /api/cao/procedures/{idDmc}/representant`
>   → **409 `ETAPE_CLOSE`** `{ idDossierMarche, lot }` dès qu'un DDM de la procédure est soumis ; lectures ouvertes.
> - Hors verrou : `…/attribution/lots/{lot}/reprendre` et `…/reattribuer` (tracées dans `t_attribution_reprise`), qui lèvent le verrou en
>   retirant l'attribution portant le DDM. **Écarts** : pas de table de verrou (lu à la volée) ; le 409 précède le contrôle des droits
>   (un profil non habilité reçoit 409, pas 403) ; les réponses des candidats aux demandes de précision / justification ne sont pas visées.
> - **Côté front** : griser les gestes de séance, d'évaluation et d'AMI quand un DDM est soumis (lire `lots[].dossierMarche` de
>   l'attribution) ; message de `ETAPE_CLOSE` renvoyant à la reprise.

> ✅ **Front, 2026-10-14 — tranche R9c branchée (étapes closes)**, vérifiée par les tests (recette navigateur groupée avec le reste du lot 2,
> après le redémarrage qui applique V111-V113) : le front lit le verrou sur `GET …/attribution` avec **la règle du serveur** — le premier
> lot, dans l'ordre, dont le dossier de marché n'est plus `BROUILLON` (`dateSoumission` n'est pas servie : le statut en tient lieu) ; une
> attribution illisible (404 avant l'évaluation, profil sans lecture) vaut « pas de verrou », le serveur restant la garde. Un bandeau
> **« Étape close »** nomme le dossier et son lot et renvoie à la reprise ou à la réattribution (lien vers le dossier pour la PRMP et
> l'UGPM) sur la **séance d'ouverture** (la conduite passe en lecture), l'**évaluation** (interne et CAO : décider, arrêter, rouvrir,
> produire le rapport, séance complémentaire PI, négociation — retirés), la **présélection de l'AMI** ; sur la page procédure de la CAO,
> la **désignation du représentant** du président est remplacée par une mention. Les lectures (PV, rapport, PDF, Word) restent ouvertes ;
> l'attribution et la déclaration sans suite, hors verrou, ne changent pas. Le refus `ETAPE_CLOSE` s'affiche sous le titre « Étape close »
> avec le message du serveur.
> ⚠️ **Question pour le backend — procédure allotie** : `reprendre` refuse si un **autre lot est attribué** (`AUTRES_LOTS_ATTRIBUES`),
> mais pas si un autre lot porte un DDM **soumis et non encore attribué** (au contrôle, ou avis favorable sans attribution). Exemple :
> lot 1 au contrôle, lot 2 refusé (`DEF`) puis repris → l'évaluation rouvre (`EN_COURS`), mais le DDM du lot 1 la garde fermée : toute
> écriture d'évaluation répond `ETAPE_CLOSE`, la reprise du lot 2 ne peut pas avancer. Faut-il refuser la reprise dans ce cas (même
> garde que `AUTRES_LOTS_ATTRIBUES`, étendue aux DDM soumis), ou que le verrou ne porte que sur le lot du DDM ? Le front suit la règle
> actuelle (toute la procédure) et s'alignera sur la réponse.

> ⚠️ **Backend, 2026-10-14 — réponse à la question « procédure allotie »** (arbitrage : **garde + levée tracée**) ; contrat :
> `docs/api-endpoints.md`, § *… tranche R9c*. Bien vu — et le même blocage touchait la **réattribution**, qui n'a pas de garde sur les
> autres lots (2d-2) : elle restait coincée derrière le DDM soumis d'un autre lot.
> - **Garde** : `…/reprendre` → **409 `AUTRES_LOTS_SOUMIS`** `{ lots }` si un autre lot a son DDM soumis (hors `BROUILLON`), comme
>   `AUTRES_LOTS_ATTRIBUES` (testé avant `MOTIF_OBLIGATOIRE`). Ton exemple (lot 1 au contrôle, lot 2 `DEF`) est donc refusé à la reprise.
> - **Levée tracée** (« hors reprise d'évaluation tracée » de la demande) : une reprise ou réattribution **postérieure à la soumission** du
>   DDM qui verrouille, avec l'évaluation rouverte (non close), lève le verrou ; il revient à la clôture de l'évaluation.
> - Pas de verrou par lot (le rapport commun bloquerait de toute façon).
> - **Côté front** : `dateSoumission` n'étant pas servie, le bandeau ne peut pas reproduire la levée tracée seul ; le plus simple est de
>   ne pas afficher le bandeau quand l'évaluation est `EN_COURS` et qu'une reprise (`lots[].reprises`) est plus récente que le passage du
>   DDM hors brouillon — ou de s'en remettre au 409. Dis-moi si tu préfères que le serveur serve l'état du verrou (ex. `etapesCloses` sur
>   `GET …/attribution`).

> ✅ **Front, 2026-10-14 — réponse : oui, que le serveur serve l'état du verrou.** Le front ne doit pas réécrire la levée tracée (il lui
> faudrait `dateSoumission` et l'ordre exact des reprises : deux règles qui divergeraient un jour). **Demande** : sur `GET …/attribution`,
> un champ **`etapesCloses`** = `{ idDossierMarche, lot }` quand `EtapesCloses.exigerOuvertes` refuserait une écriture, `null` sinon —
> calculé par la même méthode, levée tracée comprise. Le front le lira tel quel et gardera sa règle actuelle seulement tant que le champ
> est absent. Limite connue d'ici là : pendant une levée tracée (reprise ou réattribution postérieure au DDM d'un autre lot, évaluation
> rouverte), le bandeau resterait affiché et les gestes d'évaluation masqués à tort — cas rare, le serveur restant la garde.
> Côté front, `AUTRES_LOTS_SOUMIS` est nommé dans les refus de la reprise (« le dossier de marché d'un autre lot est soumis… », lots cités).

## B5 — Acte d'engagement déposé en ligne (H2)

- **Clause des DPAO** : ajouter aux gabarits `DPAO-F`, `DPAO-T`, `DPIC-PI`, `DPAC-CC` (section « Signature de l'offre ») : « La soumission par
  la plateforme, effectuée depuis le compte authentifié du candidat et scellée par celle-ci, vaut signature de l'offre et de l'acte
  d'engagement au sens de l'article 31 du Code. L'attributaire remet l'original signé de son acte d'engagement avant la signature du
  marché. » — rendue seulement en mode ELECTRONIQUE.
- **Pièce de l'attributaire** : nature `ACTE_ENGAGEMENT_ORIGINAL` dans `t_attribution_piece` (dépôt par l'attributaire ou la PRMP,
  vérification PRMP `CONFORME`), exigée **avant la signature du marché** : 409 `AE_ORIGINAL_MANQUANT` (comme `FISCALE` / `SOCIALE`).
- **Paramètre par procédure** `SIGNATURE_OFFRE` (`t_parametre_interne_procedure`) : `SCELLE_PLUS_ORIGINAL` (défaut) / `CERTIFIEE` (réservé ;
  sans effet tant que la certification n'est pas branchée).
- Le projet de marché (art. 3, pièces constitutives) cite « l'acte d'engagement original remis le … ».

> ⚠️ **Backend, 2026-10-14 — B5 : tranche R10 livrée (V113) ; le lot 2 (B1 à B5) est entièrement livré** ; contrat : `docs/api-endpoints.md`,
> § *… lot 2, tranche R10*.
> - Clause ajoutée dans le bloc remise électronique (`{{SI:B04-SE}}`) de `DPAO-F` / `DPAO-T` (§ 7.3), `DPIC-PI` (§ 8.3, « la proposition »)
>   et `DPAC-CC` (§ 5.2). **Écart** : pas de section « Signature de l'offre » dans les gabarits, la clause suit la remise électronique ;
>   elle vaut à la prochaine validation (documents validés non régénérés). **Le front resynchronise ses copies des quatre gabarits.**
> - `ACTE_ENGAGEMENT_ORIGINAL` : dépôt par l'attributaire (`pieces-attributaire`, `type=ACTE_ENGAGEMENT_ORIGINAL`, sans l'échéance de
>   15 jours) ou par la PRMP (`POST …/attribution/lots/{lot}/acte-engagement-original`, `dateRemise` + `fichier`), vérification par
>   `…/pieces/{id}/verifier` ; signature → 409 `AE_ORIGINAL_MANQUANT` ; `piecesAttributaire.aeOriginalExige` / `aeOriginalConforme`.
>   **Écart** : exigé seulement quand la procédure est en remise électronique (mode figé) — en papier, l'offre porte déjà l'acte signé.
> - Projet de marché : « original signé à remettre… », puis « original signé remis le … » une fois reconnu conforme et le projet refait.
> - `signatureOffre` dans `PUT/GET …/parametres-internes` (`SCELLE_PLUS_ORIGINAL` défaut, `CERTIFIEE` réservé et sans effet), 400
>   `SIGNATURE_OFFRE_INVALIDE`.
> - **Côté front** : pièce « original de l'acte d'engagement » dans l'écran Attribution (dépôt PRMP, vérification) et dans l'espace de
>   l'attributaire ; message de `AE_ORIGINAL_MANQUANT` ; réglage `signatureOffre` en administration de la procédure.

> ✅ **Front, 2026-10-14 — tranche R10 branchée**, vérifiée par les tests (recette navigateur groupée avec le reste du lot 2) :
> - **Gabarits** : copies `DPAO-F`, `DPAO-T`, `DPIC-PI`, `DPAC-CC` resynchronisées (commit `17f977c`, identiques au backend octet pour
>   octet, clause déclarée en ajout dans `scripts/modeles-dao/decrire.mjs`).
> - **Écran Attribution (PRMP)** — volet « Pièces de l'attributaire » : quand `aeOriginalExige`, l'original est annoncé avec son état ;
>   les pièces `ACTE_ENGAGEMENT_ORIGINAL` se lisent « Original signé de l'acte d'engagement · remis le … » et se vérifient comme les autres ;
>   la PRMP qui a reçu l'original l'enregistre (« Enregistrer l'original reçu » : date de remise facultative, scan) tant qu'il n'est pas
>   conforme ; le bloc « Signer le marché » cite l'original ; `AE_ORIGINAL_MANQUANT` nommé.
> - **Espace de l'attributaire** (résultat de l'offre) : l'original se dépose comme une pièce (« Remis le », facultatif), **y compris
>   après l'échéance des quinze jours** tant qu'il n'est pas conforme ; la phrase rappelle que le dépôt scellé a valu signature.
> - **Paramètres internes** : liste « Signature de l'offre » — `SCELLE_PLUS_ORIGINAL` ; `CERTIFIEE` affichée mais non choisissable
>   (réservée, sans effet) sauf si elle est déjà la valeur ; la valeur lue est **toujours renvoyée** au `PUT` (son absence remettrait le
>   défaut) ; `SIGNATURE_OFFRE_INVALIDE` nommé.

## Questions au backend

| # | Question |
|---|---|
| QB1 | Délai n° 6 : le pilote décompte depuis la **réception** par chaque non-retenu. Dans l'application, la réception d'une lettre est sa première consultation (`LUE_LE`) ; un candidat qui ne consulte jamais bloquerait la signature. Proposition : départ = max(`LUE_LE` ; `ENVOYEE_LE` + n jours, n paramétrable, défaut 3) — à arbitrer avec le pilote. |
| QB2 | Bloquant n° 9 : supprimer la saisie libre du montant retenu (ne garder que les corrections proposées et le refus du candidat) ? Le pilote tranche. |
| QB3 | Bloquant n° 10 : une échéance passée sans réponse vaut-elle « réponse tracée » pour rejeter une offre anormale ? |
| QB4 | Délai n° 5 : le statut `REPUTE_APPROUVE` d'un plan doit-il empêcher la Commission de rendre ensuite un avis (ou l'avis tardif vaut-il observation) ? |

## Ce que le front fera, et quand

Après livraison : affichage des neuf délais (requis / constaté / départ) sur la fiche, l'avis, l'attribution et la DSS, avec les refus
nommés ; formulaire de questions côté candidat (fermé à J−10) et réponses diffusées ; mode de la procédure figé dans le cadrage ;
registre des tentatives refusées ; approbation du marché dans l'écran Attribution ; original de l'acte d'engagement dans les pièces de
l'attributaire ; paramètres `RECOURS_SUSPENSIFS`, `SIGNATURE_OFFRE`, délais paramétrables en administration ; manuel à deux colonnes.

> ⚠️ **Backend, 2026-10-13 — B1 en cours : tranche R6a livrée (délais de la loi, paramètres, délai de publicité ; V106)** ; contrat :
> `docs/api-endpoints.md`, § *… lot 2, tranche R6a*. Arbitrages du 13/10 : R6 découpée en **R6a** (ci-dessous), **R6b** (règle 5 réputé
> approuvé, QB4 à arbitrer) et **R6c** (règles 6 QB1, 7, 8, 9) ; la règle de publicité **bloque dès la validation de la fiche** ; les
> modes se lisent au libellé du mode du plan (« international » 45 j, « consultation » 10 j, « appel d'offres ouvert » 30 j) ; les
> paramètres sont semés actifs et signalés.
> - `GET /api/delais-legaux` (neuf délais, table en code) ; `GET /api/delais-parametres`, `PUT /api/delais-parametres/{code}`
>   (Administrateur) sur `t_delai_parametre` (`code, valeur, unite, texte, actif`) semée : `PUBLICITE_AOR` 15, `PUBLICITE_DC_PI` 30,
>   `PUBLICITE_AMI` 15, `PUBLICITE_CONTRAT_CADRE` 30, `PUBLICITE_PREQUALIFICATION` 30, `DELAI_AMENAGE` 15 (jours, à confirmer).
> - Règles 1-2 et 4 : au bilan de la fiche, règle `DELAI_PUBLICITE` (bloquante pour la loi, avertissement pour un paramètre) contre
>   `B04-SE-17`, à défaut la prévision LANCEMENT du plan ; à l'impression de l'avis, 409 `DELAI_PUBLICITE` `{ code, requis, constate,
>   depart, limite }` contre `datePublication`. **Écarts** : à la validation, le 409 garde le code `CONTROLES_BLOQUANTS` du bilan (le
>   détail est dans la règle `DELAI_PUBLICITE` du bilan) ; H2 « plusieurs supports : la plus tardive » ne s'applique pas encore (une
>   seule `datePublication` est saisie) ; le délai aménagé justifié remplace le délai de la loi par le paramètre `DELAI_AMENAGE` (signalé).
> - Règle 3 (J−10) : la valeur est dans la table ; le formulaire de questions est B2 (R7).
> - **Côté front** : écran Délais (loi en lecture, paramètres réglables) ; afficher la règle `DELAI_PUBLICITE` du bilan (requis / constaté /
>   départ / limite) sur la fiche et le 409 de l'impression.

> ⚠️ **Backend, 2026-10-13 — B1, règle 5 : tranche R6b livrée (plan réputé approuvé ; V107)** ; contrat : `docs/api-endpoints.md`,
> § *… lot 2, tranche R6b*. Arbitrages du 13/10 : un **marqueur daté** `t_dossier.REPUTE_APPROUVE_LE`, pas un statut — l'examen
> continue et un PV signé plus tard vaut observation (QB4) ; **tout plan sans PV signé** est éligible, quel que soit son statut dans le
> circuit (hors brouillon, clôturé, retiré, remplacé) ; jours ouvrables = **lundi-vendredi sans jours fériés** ; destinataires = **PRMP
> du plan + Présidents de sa localité** (un Président sans localité est notifié aussi).
> - Planificateur horaire (`app.plans.cron-repute-approuve`, défaut `0 20 * * * *`) : dix jours ouvrables après la soumission (jour de
>   départ non compté, délai n° 5 de `GET /api/delais-legaux`), sans PV signé ⇒ `REPUTE_APPROUVE_LE` posé une fois, journal
>   `PLAN_REPUTE_APPROUVE` (sans auteur), notification `PLAN_REPUTE_APPROUVE` (objet `DOSSIER`) à la PRMP et aux Présidents.
> - `DossierDto.reputeApprouveLe` (date-heure, `null` sinon) sur toutes les lectures ; la garde `PV_NON_SIGNE` de la création d'un DMC
>   accepte un plan réputé approuvé.
> - **Écarts** : pas de statut `REPUTE_APPROUVE` (lire `reputeApprouveLe`, le filtre statut ne le voit pas) ; éligibilité à tout
>   statut (la demande citait `SOUMIS` / `RECU` / `DISPATCHE`) ; passage horaire plutôt que quotidien ; pas de calendrier des fériés.
> - **Côté front** : badge « réputé approuvé le … » sur le plan et dans la liste ; sur un PV signé après ce marqueur, afficher l'avis
>   comme observation ; la notification ouvre le plan.

> ⚠️ **Backend, 2026-10-13 — B1, règles 6 à 9 : tranche R6c livrée (V108) ; B1 est entièrement livré** ; contrat : `docs/api-endpoints.md`,
> § *… lot 2, tranche R6c*. Arbitrages du 13/10 : règle 6 (QB1), réception **présumée pour tous à l'envoi + n jours** (paramètre
> `RECEPTION_LETTRE`, 3 j proposés, `PUT /api/delais-parametres/RECEPTION_LETTRE`), sans lire `LUE_LE` — la proposition « max(`LUE_LE` ;
> envoi + n) » n'est pas retenue ; règle 8, départ = **réception de la notification par le titulaire** (déclarée ou accusé de lecture), à
> défaut la notification ; règle 9, **une relance à J+5** à la PRMP, au membre examinateur et aux Présidents de la localité.
> - Règle 6 : `delaiAttente` = `{ debut, fin, signableLe, jours, ecoule, receptionLe, joursReception }` ; 409 `DELAI_ATTENTE` inchangé.
> - Règle 7 : le dépôt refusait déjà la pièce périmée (`PIECE_PERIMEE`) ; à la vérification, `conforme: true` sur une pièce plus ancienne
>   que la limite → **400 `PIECE_TROP_ANCIENNE`** `{ nature, dateDelivrance, limite, reference }` ; `piecesAttributaire.limiteFiscale` /
>   `limiteSociale` à afficher.
> - Règle 8 : `avisAttribution` = `{ depart, echeance, datePublication, publieLe, par, disponible, enRetard }` ; alerte
>   `ECHEANCE_AVIS_ATTRIBUTION` à **J+20** (au lieu de J+25) ; compteur `compteurs.avisEnRetard` dans `GET /api/kpis/badges`. **Écart** :
>   aucun geste de clôture du dossier de marché n'existe côté PRMP, la règle reste non bloquante (alerte + `enRetard` + compteur).
> - Règle 9 : notification `RELANCE_SANS_SUITE` une fois l'échéance passée, `SansSuiteDto.Demande.relanceLe` ; l'alerte de la veille et le
>   blocage jusqu'à l'avis exprès restent.
> - **Côté front** : afficher la réception présumée et `joursReception` sur le délai d'attente ; les limites de délivrance sur les pièces ;
>   `depart` / `enRetard` sur l'avis d'attribution et le badge `avisEnRetard` ; `relanceLe` sur la demande de sans suite.

> ✅ **Front, 2026-10-14 — tranche FR6 branchée (R6b et R6c)**, vérifiée par les tests (recette navigateur groupée avec le reste du lot 2) :
> - **R6b** — badge « **Réputé approuvé** » (vert, à côté du badge de statut, jamais à sa place) sur « Tous les dossiers » (tableau et
>   cartes), la page du dossier, la consultation, la liste des dossiers de la PRMP et son suivi des délais ; infobulle : art. 26-IV, date,
>   « l'examen continue ; un avis rendu après coup vaut observation » (QB4). Les notifications `PLAN_REPUTE_APPROUVE` et `RELANCE_SANS_SUITE`
>   portent le titre du serveur et ouvrent le dossier (comportement par défaut). L'éligibilité des lignes à la fiche DAO reste servie par le
>   serveur : rien à changer côté front.
> - **R6c** — délai d'attente : « réception présumée de l'information le …, n jours après l'envoi, ou affichage s'il est plus tardif » ;
>   pièces de l'attributaire : les dates de délivrance les plus anciennes admises, et `PIECE_TROP_ANCIENNE` nommé avec la nature, la date
>   et la limite ; avis d'attribution : « 30 jours après la réception de la notification par le titulaire, le … », badge « En retard » /
>   « Publié après l'échéance » ; **pastille d'alerte** rouge `avisEnRetard` sur l'entrée « Fiches DAO » de la PRMP (à côté du compteur
>   existant, aucune entrée de menu ajoutée) ; sans suite : « relance envoyée le … : la déclaration attend toujours l'avis exprès ».
>   `RECEPTION_LETTRE` paraît d'elle-même dans l'écran Délais (liste générique des délais paramétrables).

> ⚠️ **Backend, 2026-10-13 — B2 : tranche R7 livrée (questions des candidats, V109)** ; contrat : `docs/api-endpoints.md`, § *… lot 2,
> tranche R7*. Arbitrages du 13/10 : auteur = **candidat ayant retiré le DAO** (registre des retraits, 403 `DOSSIER_NON_RETIRE`) ; les
> questions répondues sont **publiques et anonymisées** sur la page de la procédure, et chaque candidat ayant retiré est notifié ;
> **répondre = diffuser** (`publieeLe` = `repondueLe`, une réponse définitive par question).
> - Candidat / public : `GET /api/procedures-en-ligne/{idDmc}/questions` (sans session : fenêtre `{ dateLimite, clotureLe, closes,
>   joursAvantLimite }` + questions répondues anonymisées), `GET …/questions/{id}/fichier`, `GET …/questions/miennes` (CANDIDAT),
>   `POST …/questions { question }` → 201 ; 409 `QUESTIONS_CLOSES` `{ dateLimite, clotureLe, joursAvantLimite }` après J−10 (J−10 compris
>   recevable), `DATE_LIMITE_INCONNUE` ; 400 `QUESTION_OBLIGATOIRE`.
> - PRMP : `GET /api/fiches-marche/{idDmc}/questions` (avec `auteur` / `auteurCompte`), `POST …/questions/{id}/reponse` (multipart `texte`
>   + `fichier` PDF/JPEG/PNG facultatif ; 409 `DEJA_REPONDUE`), `GET …/questions/pdf`. Notifications `QUESTION_POSEE` (PRMP) et
>   `QUESTION_REPONDUE` (candidats ayant retiré) ; journal de la procédure `QUESTION_POSEE` / `QUESTION_REPONDUE`.
> - Dossier de marché : pièce `QUESTIONS_REPONSES` (PDF des questions répondues) jointe d'office à la création, s'il y en a.
> - **Écarts** : page publique (la demande visait les seuls candidats ayant retiré) ; pas de geste de publication distinct ; la table
>   s'appelle `t_question_candidat` avec `ID_ENTREPRISE` en plus.
> - **Côté front** : formulaire de question sur la page de la procédure (fermé quand `closes`, afficher `clotureLe`), liste publique des
>   réponses, écran PRMP des questions avec réponse et fichier, badge sur `QUESTION_POSEE`.

> ✅ **Front, 2026-10-14 — tranche R7 branchée (questions des candidats)**, vérifiée par les tests (recette navigateur groupée avec le
> reste du lot 2) :
> - **Page de la procédure en ligne** (publique) : section « Questions des candidats » — la fenêtre (« recevables jusqu'au … inclus, 10 jours
>   avant la date limite », ou « closes ») et les **réponses diffusées, anonymes**, avec leur pièce jointe ; sans session, l'invitation à se
>   connecter avec le compte qui a retiré le dossier ; candidat connecté : **ses questions** (en attente / répondue) et le formulaire (4 000
>   caractères, compteur), fermé quand `closes` ; refus nommés : `DOSSIER_NON_RETIRE` (renvoie à la section du dossier), `QUESTIONS_CLOSES`
>   (avec la date de clôture), `DATE_LIMITE_INCONNUE`, `QUESTION_TROP_LONGUE`. La section ne paraît pas hors d'une procédure en ligne (404).
> - **PRMP** — écran `/prmp/dao/{idDmc}/questions` (bouton « Questions des candidats » sur la fiche, PRMP et UGPM, remise électronique,
>   version validée) : toutes les questions avec leur auteur (raison sociale et compte), le nombre en attente, la réponse **« Répondre et
>   diffuser »** (texte + pièce facultative, avertissement « diffusée à tous, définitive »), `DEJA_REPONDUE` nommé (et relecture), le PDF
>   « Questions et réponses » ; l'UGPM lit sans répondre. La notification `QUESTION_POSEE` mène à cet écran.
> - La pièce `QUESTIONS_REPONSES` du dossier de marché paraît avec les autres pièces (liste générique), sans code dédié.
> ⚠️ **Demande** — la pastille de menu « question en attente » demande un **compteur serveur** : proposition `questionsEnAttente` dans
> `GET /api/kpis/badges` (PRMP : questions `EN_ATTENTE` de ses fiches). Le front l'ajoutera à la pastille « Fiches DAO » dès qu'il est servi
> (pas de recalcul côté front, règle P2 de l'audit). D'ici là : la notification et le nombre en attente de l'écran.

> ⚠️ **Backend, 2026-10-13 — B3 : tranche R8 livrée (mode figé, V110)** ; contrat : `docs/api-endpoints.md`, § *… lot 2, tranche R8*.
> Arbitrages du 13/10 : la migration **ouvre une révision** avec le nouveau mode (version validée intacte, PRMP ressaisit puis valide) ;
> **point de non-retour** dès une offre en ligne, une cérémonie close ou un lot attribué ; « procédure en ligne » (R2, R5) **lit le mode**
> de la fiche validée.
> - `PUT /{idDmc}/cadrage` avec un autre `modeRemise` (clé absente = PAPIER) → **409 `MODE_FIGE`** `{ modeFige, modeDemande }` dès qu'une
>   version est validée ; l'import ne change pas le mode (signalé dans `erreurs[]`). `FicheMarcheDto.modeFige`, `modeRemiseFige`,
>   `modeMigreLe` / `modeMigrePar` / `modeMigreMotif`.
> - `POST /api/fiches-marche/{idDmc}/migrer-mode { modeRemise, motif }` (Administrateur) : révision ouverte avec le nouveau mode, figé à
>   son tour ; journal `FICHE_MODE_MIGRE` ; 400 `MODE_INVALIDE` / `MOTIF_OBLIGATOIRE` ; 409 `MODE_NON_FIGE`, `MODE_IDENTIQUE`,
>   `MODE_IRREVERSIBLE` `{ raison: OFFRES | CEREMONIE_CLOSE | ATTRIBUTION }`.
> - Pièces conditionnées et contrôles automatiques : « en ligne » = fiche validée en remise électronique ; en PAPIER, listes V95 entières et
>   contrôles `NON_APPLICABLE`.
> - **Écart** : pas de « re-saisie contrôlée » distincte, la révision suit le circuit ordinaire de validation.
> - **Côté front** : griser `modeRemise` quand `modeFige`, afficher `modeRemiseFige` et la migration (date, auteur, motif) ; écran
>   Administrateur de migration avec motif ; message de `MODE_IRREVERSIBLE`.

> ✅ **Front, 2026-10-14 — tranche R8 branchée (mode figé)**, vérifiée par les tests (recette navigateur groupée avec le reste du lot 2) :
> - **Cadrage** : quand `modeFige`, la question « Comment les offres sont-elles remises ? » montre `modeRemiseFige`, verrouillée, marquée
>   « figé depuis la première validation », avec l'explication (fixé à la création ; seule la migration de l'Administrateur, avant le point
>   de non-retour). Le cadrage effectif — conditions, blocs, liens de la remise électronique — lit le mode figé, et **le `PUT …/cadrage`
>   porte toujours `modeRemise` = le mode figé** (le cadrage nu d'une fiche ancienne peut ne pas avoir la clé, qui vaudrait papier → 409).
> - **Migration** : bouton « Migrer le mode de remise… » sur la fiche, **Administrateur seul** et fiche figée ; modale (`appModale`) qui
>   propose l'autre mode, explique la révision ouverte et exige le motif (1 000 caractères) ; refus nommés — `MODE_IRREVERSIBLE` selon sa
>   raison (offres déposées en ligne, cérémonie close, lot attribué), `MODE_IDENTIQUE`, `MODE_NON_FIGE`, `MOTIF_*`, `DOSSIER_EN_EXAMEN`, 403 ;
>   la fiche se relit ensuite.
> - **Version migrée** : bandeau « Mode de remise migré vers la remise … le … par … — motif : … », et en brouillon « complétez ce que ce
>   mode exige, puis validez la version ».
> - L'import du DAO affiche déjà ses `erreurs[]` (dont `modeRemise`) sans code dédié.
