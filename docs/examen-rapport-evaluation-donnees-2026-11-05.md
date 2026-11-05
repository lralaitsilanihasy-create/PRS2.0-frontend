# Examen d'un dossier de marché — les données du « Rapport d'évaluation » face aux points de la grille

*05/11/2026 — établi à la demande du pilote, sur le dossier 00003/MAOO/CNM/2026 (Maintirano, fiche 15/MTP/SG/PRMP.2026, lot 1,
3 offres). Lecture seule de la recette : `GET /api/fiches-marche/10/evaluation`, `…/lots/1/indicateurs-prix`, `GET /api/dossiers/100402/controles`,
`GET /api/points-ctrls?sousType=MAOO`.*

## 1. Le principe

Depuis le 05/11, la grille d'un dossier de marché ne porte que sur ses **éléments nouveaux** ; le rapport d'évaluation en est le centre :
**12 des 21 points** lui sont rattachés (référentiel, V166-V168), 2 autres s'y vérifient aussi (« CAO désignée », « Délai de remise »).
Ce document établit, point par point, **ce que l'élément « Rapport d'évaluation » doit montrer** au contrôleur pour qu'il statue sans
chercher ailleurs — à partir de **ce que la commission d'appel d'offres (CAO) produit réellement** dans le module d'évaluation.

Deux sources, une règle : **le rapport à l'examen est une lecture en données de l'évaluation enregistrée**, jamais une ressaisie. Il montre ce
que la CAO a décidé, qui, quand, sur quelle règle du DAO ; le PDF du rapport (régénéré à chaque signature) reste la pièce officielle,
téléchargeable, mais le contrôleur lit les données.

## 2. Ce que la CAO produit (le module d'évaluation, V76-V78, V101, V112, V116, V120)

| Étape de la CAO | Données enregistrées (servies par `EvaluationDto`) |
|---|---|
| Ouverture de l'évaluation | `ouverteLe`, `ouvertePar` (responsable) ; **déclarations** d'absence de conflit de chaque membre : `signeeLe`, `conflit`, `precision` |
| Examen préliminaire (par offre) | 17 vérifications cotées C / SC / NC / SO : AE prix, garantie, offre unique, exclusion, pouvoirs, pièces, conformité technique, intégrité, frais de dossier, AE daté et signé, validité de l'offre, délai, bordereau, sommes aux tiers, validité de la garantie, visite des lieux, autres conditions ; `constat`, `observation`, `clause` du DAO ; décision `CONFORME` / `ECARTEE` avec `qualification` (irrecevable, non conforme, inappropriée, inacceptable) et `motif` ; **spécifications** article par article (fournitures par formulaires) ; demandes de **précisions** (question, délai, réponse, pièce) ; auteur et date |
| Montant évalué (par offre) | `prixLu` (HT, TTC), **corrections** (ligne, règle `PU_PREVAUT` / `LETTRES_PREVALENT` / `REPORT` / `AUTRE`, avant → après, `motif`, `ecart` hors calcul), `refusCandidat` (motif, clause), `rabais` (lu, nature, valeur, condition, lots, motif), `preference` (éligible, taux, ajustement, motif), `criteres` monétisés (libellé, montant, justification), `prixCorrige`, `montantEvalue` ; **rang**, `exAequo`, départage (ordre, motif) ; auteur et date |
| Offres anormales (par offre) | `suspectee`, `decision` (non suspectée, suspectée, maintenue, rejetée), `motif`, demande de **justification** (éléments, délai, échéance, réponse, pièce), `defautReponse` ; **indicateurs de prix** du lot : `methodeDao` (B06-EO-07), `estimation`, `moyenne`, par offre `ecartEstimation`, `ecartMoyenne`, `alertes` (sous-détails écartés du bordereau) ; **estimation détaillée** de la PRMP (V116, non publiée) |
| Post-qualification (offre la mieux classée, puis la suivante si elle échoue) | critères par groupe (juridique, financière, technique) avec leur **code du DAO** (`B03-QT-07`…), `exigence`, `constat`, `decision`, `motif` ; décision `QUALIFIE` / `NON_QUALIFIE`, `clause` |
| Arrêt de chaque étape | `etapesArretees` : étape, membre, date, **observation** de la CAO |
| Rapport | `produitLe`, `observations` du responsable, **signatures** (membre, président, date, `observation` de désaccord, `empechement` + motif + constaté par), `signaturesAttendues`, **`quorum`** (règle, requis, obtenus, atteint, président signé ou représentant) ; `signeLe` = dernière signature = **PV de validation** (manuel révisé, R1) ; rapports **retirés** avant validation (motif, signatures tombées) ; `proposition` d'attribution (offre, candidat, montant HT/TTC, délai, ou infructuosité motivée) |
| Hors rapport, même fiche | **CAO** : décision de désignation (référence, date, PDF signé), membres (origine, fonction, président) ; **séance d'ouverture** : PV signé/publié, quorum, offres lues, tentatives refusées hors délai |

Le serveur pose déjà trois **contrôles automatiques** sur le dossier de marché, servis par `GET /api/dossiers/{id}/controles` :
`CORRECTIONS_HORS_CALCUL` (art. 46-47), `DOCUMENTS_EVALUATION_SIGNES` (P5), `QUORUM_COMMISSION` (P3 / P14). Ils ne statuent pas à la place
du contrôleur, mais ils éclairent trois points (36, 40, 108) et doivent s'afficher **à côté du point** qu'ils éclairent.

## 3. Point par point : ce que le rapport doit montrer

Légende de la colonne « État » — **S** : servi par le serveur et affiché aujourd'hui · **s** : servi, pas (ou mal) affiché · **M** : manque au serveur.

| N° | Point de la grille (question) | Données à présenter | Où, dans l'évaluation | État |
|---|---|---|---|---|
| 3 | **Rejets motivés par le DAO** — chaque rejet d'offre est-il motivé par une clause du DAO ? | Pour chaque offre écartée : étape du rejet, qualification du rejet, **motif**, **clause du DAO** citée, membre et date. Pour une offre conforme : la mention « aucun rejet ». | `offre.ecartee {etape, qualification, motif, clause, nom, le}` ; `conformite.clause` ; `anormale.decision = REJETEE` + `motif` | S (motif) · **s** (la clause n'est affichée que dans le détail d'offre ; la synthèse doit la porter) |
| 4 | **Montant évalué conforme au DAO** — erreurs arithmétiques corrigées selon les IC ; montant évalué = prix corrigé + rabais, préférence, critères, variantes prévus par le DAO ? | Par offre : prix lu, chaque **correction** (ligne, règle des IC, avant → après ; **motif** si hors calcul `REPORT` / `AUTRE`), refus du candidat, rabais (nature, valeur, condition), préférence (éligible, taux, ajustement), critères monétisés (justification), prix corrigé, **montant évalué** ; la **méthode d'évaluation du DAO** (B06-EO-04 à 06) en regard ; le contrôle automatique `CORRECTIONS_HORS_CALCUL`. | `offre.evaluation` ; `rabaisDeclare` ; fiche B06-EO-04/05/06 ; contrôle `CORRECTIONS_HORS_CALCUL` | S · **s** (méthode du DAO et contrôle automatique non rapprochés du point) · **M** (variantes : la fiche sait si elles sont autorisées — cadrage `variantes` —, l'évaluation ne dit pas si une offre en porte une ni comment elle a été évaluée) |
| 5 | **Offres anormales : justification demandée** — aucune offre anormalement basse rejetée sans demande écrite ? | Par offre suspectée : la **demande** (éléments demandés, date, délai, échéance), la **réponse** (texte, pièce, date) ou le **défaut de réponse** constaté après l'échéance, puis la décision (maintenue / rejetée) et son motif. | `offre.anormale {suspectee, decision, motif, justification{question, delaiJours, echeance, reponse, fichier, reponduLe}, defautReponse}` | **s** (servi ; la synthèse n'affiche que « non suspectée / rejetée » — la demande et sa réponse manquent à l'écran) |
| 21 | **Offres anormales : processus et seuils** — la détection a-t-elle suivi le processus et les pourcentages des DPAO ? | La **méthode du DAO** (B06-EO-07) ; les **seuils** (haute, basse) ; la **première moyenne**, les offres écartées comme hautes, la **seconde moyenne**, les offres basses ; par offre : montant, écart à chaque moyenne, seuil franchi ou non ; les alertes de sous-détail (prix unitaires écartés du bordereau). | `indicateurs-prix {methodeDao, estimation, moyenne, offres[{ecartEstimation, ecartMoyenne, alertes}]}` | S (moyenne, écarts, alertes) · **M** (seuils haute/basse en valeurs, les **deux** moyennes et la mention du seuil franchi : seul un texte libre et une moyenne unique sont servis ; sur ce dossier `methodeDao` est même nul) |
| 6 | **Classement et attributaire proposé** — classement par montant évalué croissant ; attributaire = mieux classé qualifié ? | Le tableau des offres **trié par montant évalué**, rang, ex æquo et **départage** (ordre, motif), offres écartées hors classement ; la **proposition** (offre, candidat, montant, délai) ou l'infructuosité motivée ; « seul titulaire qualifié ». | `offre.rang, exAequo, montantEvalue` ; `departager` (journal) ; `lot.proposition` | S · **s** (le départage et son motif ne sont lisibles qu'au journal) |
| 7 | **Post-qualification sur les seuls critères du DAO** | Les critères examinés avec leur **code du DAO** (B03-QT-07…), l'exigence du DAO, le constat, la décision ; tout critère **sans code du DAO** (ex. `JURIDIQUE`, `MATERIEL`) mis en évidence comme « hors fiche : à vérifier ». | `offre.qualification.criteres[{code, groupe, exigence, constat, decision, motif}]`, `clause` | S · **s** (le code du DAO n'est pas affiché ; rien ne distingue un critère de la fiche d'un critère ajouté) |
| 16 | **Qualification : activités et critères** — activités du candidat (NIF, STAT) couvrant l'objet ; seuls critères du DAO validé ; fiches de renseignement ignorées hors qualifications particulières | L'**entreprise** de l'offre qualifiée : raison sociale, **NIF**, **STAT**, RCS, **activités / objet** déclarés, pièces d'entreprise (carte fiscale, statuts) ; le critère juridique et son constat ; les critères du DAO (comme au point 7). | `offre.entreprise {nif, raisonSociale}` ; profil `Entreprise {stat, rcs, pieces}` (espace candidat) ; critère `JURIDIQUE.constat` | **s** (NIF seul à l'écran ; STAT et pièces existent au profil candidat mais ne sont pas servis dans l'évaluation) · **M** (activités / objet social de l'entreprise : non enregistrés) |
| 14 | **Spécifications techniques** — conformes, sans réserve, divergence ni omission substantielle ? | Par offre : le tableau **spécifications** (article, caractéristique, exigé, proposé, cote C/SC/NC, observation) pour une offre par formulaires ; pour une offre par pièces : la vérification `CONFORMITE_TECHNIQUE` et son constat ; le renvoi au DAO (bloc B12). | `GET …/offres/{idOffre}/specifications` ; `conformite.verifications[CONFORMITE_TECHNIQUE]` | S |
| 13 | **Conformité des documents essentiels** — AE daté et signé, validité, délai, garantie (montant, forme, validité), attestation du fabricant, certificat de visite ; offre complète : bordereau ou DQE entier et non modifié | Par offre, les vérifications **ciblées** : `AE_DATE_SIGNE`, `AE_PRIX`, `VALIDITE_OFFRE`, `DELAI`, `GARANTIE` (montant, forme), `GARANTIE_VALIDITE`, `VISITE_LIEUX`, `PIECES` (attestation du fabricant), `BORDEREAU`, `INTEGRITE` — avec cote, constat, clause ; les exigences du DAO en regard (B04-VO-01, B05-GS-03…). | `conformite.verifications` (17 codes) ; fiche B04/B05 | S · **s** (les 17 vérifications sont listées sans être rapprochées de ce point : le rapport doit en isoler ces dix) |
| 15 | **Moralité des prix** — le rapport mentionne-t-il **expressément** la vérification de la moralité des prix unitaires (circulaire, XII-2) ? | La **mention explicite** de la CAO ; l'**estimation** de la fiche (et l'estimation détaillée, non publiée) ; la moyenne des offres ; par offre l'écart et les **prix unitaires écartés** du bordereau (sous-détails). | `indicateurs-prix` ; `etapesArretees[ANORMALES].observation` ; `rapport.observations` ; `estimation` V116 | S (indicateurs) · **M** (aucune donnée ne dit si la CAO a **vérifié** la moralité : seul un texte libre peut le porter ; sur ce dossier il dit « aucune offre anormalement basse… », pas « moralité vérifiée ») |
| 8 | **Rapport signé de tous les membres** — signé et paraphé de tous, observations de désaccord comprises ? | La liste des **signataires appelés** (membres hors conflit déclaré), pour chacun : signé le…, **observation** de désaccord, ou **empêchement** (motif, constaté par) ; les signatures attendues ; les rapports **retirés** avant validation ; le contrôle automatique `DOCUMENTS_EVALUATION_SIGNES`. | `rapport.signatures, signaturesAttendues, rapportsRetires` ; contrôle | S · **s** (rapports retirés et contrôle automatique non rapprochés) |
| 17 | **PV de validation cohérent** — les résultats du PV sont ceux du rapport ; quorum et signataires ? | Le rapport signé **vaut** PV de validation (R1, Q4) : date de la dernière signature, **quorum** (règle, requis, obtenus, président ou représentant), signataires ; le classement et la proposition **figés** à la signature ; le contrôle automatique `QUORUM_COMMISSION`. | `rapport.quorum, signeLe` ; `proposition` ; contrôle | S · **s** (dire explicitement « rapport signé = PV de validation », afficher le contrôle) |
| 1 | **CAO désignée, membres déclarés** (aussi : Séance, Pièces) | Décision de désignation (référence, date, **PDF signé joint**), membres (origine, fonction, président, un expert au plus) ; **déclarations** d'absence de conflit : signées le…, conflit déclaré et précision. | `cao` ; `evaluation.declarations` | S |
| 10 | **Délai de remise des offres** (aussi : Séance, DAO) | Hors rapport : date de 1re publication de l'avis, date limite de remise, délai décompté. | séance, avis | S (séance) |

**Bilan** : sur 12 points, le serveur sert déjà l'essentiel ; **sept** gagnent à une présentation rapprochée du point (colonne « s ») ;
**quatre manques** côté serveur (colonne « M ») :

- **M1 — seuils et moyennes des offres anormales** (point 21) : servir, dans `indicateurs-prix`, les seuils du DAO (`seuilHautePct`,
  `seuilBassePct`, lus de la fiche ou saisis par la CAO si le DAO les laisse libres), la **première moyenne**, la **seconde moyenne** après
  neutralisation des hautes, et par offre `seuilFranchi: 'HAUTE' | 'BASSE' | null` ; `methodeDao` nul sur une fiche de travaux (B06-EO-07
  « servi aux travaux seulement » d'après le contrat — à vérifier sur cette fiche).
- **M2 — mention de la moralité des prix** (point 15) : à l'arrêt de l'étape ANORMALES, une case « La commission a vérifié la moralité des
  prix unitaires (circulaire, XII-2) » → `moraliteVerifiee: boolean` sur le lot, reprise dans le PDF du rapport ; à défaut, le point reste
  statué sur un texte libre.
- **M3 — activités de l'entreprise** (point 16) : `entreprise.stat`, `rcs` et `activites` (objet social, ou code d'activité) dans
  `OffreEvaluee.entreprise`, lus du profil candidat ; les pièces d'entreprise (carte fiscale, statuts) consultables depuis le rapport.
- **M4 — variantes** (point 4) : si le cadrage autorise les variantes, chaque offre dit si elle en **porte une** et l'évaluation si elle a
  été **évaluée** (montant de la variante, retenue ou non) ; sinon, le rapport affiche « variantes non autorisées » et le point se statue
  sans donnée de plus.

## 4. Structure proposée de l'élément « Rapport d'évaluation » à l'examen

Les parties suivent l'**ordre de travail de la CAO**, et chacune **nomme les points de la grille** qu'elle sert. Ouvrir un point depuis la
grille ouvre la partie correspondante (comme « Observer cette cellule » ouvre une information du DAO) ; les contrôles automatiques
s'affichent sous le point qu'ils éclairent.

| Partie | Contenu | Points |
|---|---|---|
| A. Commission et déclarations | Décision de désignation (PDF), membres, origine, président ; déclarations signées, conflits | 1 |
| B. Synthèse et classement | Tableau trié par montant évalué : rang, offre, soumissionnaire, examen préliminaire (**motif + clause** si écartée), montant évalué, écart à l'estimation, écart aux moyennes, anormale (décision), post-qualification ; départage ; **proposition d'attribution** ou infructuosité | 3, 6 |
| C. Examen préliminaire | Par offre : les **dix vérifications « documents essentiels »** d'abord, puis les sept autres ; cote, constat, clause ; demandes de précisions et réponses | 13 |
| D. Montant évalué | Par offre : prix lu, corrections (règle, motif hors calcul), refus du candidat, rabais, préférence, critères monétisés, montant évalué ; méthode du DAO (B06-EO-04/05/06) ; contrôle `CORRECTIONS_HORS_CALCUL` ; variantes (M4) | 4 |
| E. Offres anormales et moralité des prix | Méthode du DAO, seuils, les deux moyennes (M1) ; par offre : écart, seuil franchi, **demande de justification, réponse ou défaut**, décision et motif ; estimation de la fiche et estimation détaillée (non publiée) ; prix unitaires écartés ; **mention de la moralité** (M2) | 5, 21, 15 |
| F. Spécifications techniques | Par offre : tableau des spécifications cotées, ou la vérification technique pour une offre par pièces | 14 |
| G. Post-qualification | Offre(s) examinée(s) : entreprise (NIF, STAT, activités — M3), critères **avec leur code du DAO**, exigence, constat, décision, motif ; critères hors fiche signalés | 7, 16 |
| H. Rapport signé — PV de validation | Produit le…, observations du responsable ; signataires appelés, signatures, observations de désaccord, empêchements ; **quorum** ; rapports retirés ; contrôles `DOCUMENTS_EVALUATION_SIGNES` et `QUORUM_COMMISSION` ; « le rapport signé vaut PV de validation » ; PDF téléchargeable | 8, 17 |

Ce qui ne change pas : la fenêtre du rapport sur la page du dossier (onglets « Synthèse / Offre n° / Post-qualification / Commission »,
01/11) reste la lecture de la PRMP et de la CAO ; **la structure ci-dessus est celle de l'examen**, où le document est lu point par point.

## 5. Suite

1. Le pilote valide (ou corrige) le tableau du § 3 et la structure du § 4.
2. Les manques M1 à M4 partent en demande backend (`demande-backend-2026-11-0x-rapport-evaluation-examen.md`), B1 à B4.
3. Le front réorganise l'élément à l'examen (§ 4), rapproche chaque point de sa partie et des contrôles automatiques, et affiche les
   données déjà servies mais absentes (colonne « s ») sans attendre la livraison des manques.
