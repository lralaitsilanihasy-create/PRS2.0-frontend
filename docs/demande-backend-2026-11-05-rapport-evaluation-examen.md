# Demande backend — 2026-11-05 — Rapport d'évaluation à l'examen : les données que la grille attend encore

## Contexte

Le pilote a validé le 05/11 le tableau `docs/examen-rapport-evaluation-donnees-2026-11-05.md` (§ 3) : ce que l'élément « Rapport
d'évaluation » d'un dossier de marché doit montrer au contrôleur pour chacun des 12 points de la grille qui lui sont rattachés (V166-V168).
Le serveur sert déjà l'essentiel ; quatre données manquent pour que quatre points se statuent sur des faits et non sur un texte libre.
Lu le 05/11, en lecture seule, sur la fiche 15/MTP/SG/PRMP.2026 (idDmc 10, dossier 100402).

## B1 — Offres anormales : seuils et moyennes en valeurs (point 21 « processus et seuils des DPAO »)

`GET /api/fiches-marche/{idDmc}/evaluation/lots/{lot}/indicateurs-prix` ne sert qu'une `moyenne` et `methodeDao` (texte B06-EO-07, **nul
sur cette fiche de travaux**) ; le contrôleur ne peut pas vérifier le processus (deux moyennes) ni les pourcentages.

- Servir, sur le lot : `seuilHautePct`, `seuilBassePct` (lus de la fiche quand elle les porte, sinon ceux que la CAO a appliqués — la
  méthode de la circulaire : 20 % haute, 10 % basse — avec `origineSeuils: 'DAO' | 'CIRCULAIRE' | 'CAO'`), `moyenne1` (toutes les offres
  évaluées), `moyenne2` (après neutralisation des hautes) ; `moyenne` reste servie (= `moyenne2`) pour l'écran actuel.
- Par offre : `ecartMoyenne1`, `ecartMoyenne2`, `seuilFranchi: 'HAUTE' | 'BASSE' | null`.
- `methodeDao` : dire pourquoi il est nul aux travaux (le contrat le note « servi aux travaux seulement » ; ici c'est l'inverse) — s'il
  faut lire un autre code (B06-EV-*), le servir sous le même nom.

## B2 — Mention de la vérification de la moralité des prix (point 15)

Le point demande que le rapport **mentionne expressément** la vérification de la moralité des prix unitaires (circulaire, XII-2). Aucune
donnée ne le porte : sur cette fiche, l'observation d'arrêt de l'étape ANORMALES dit « aucune offre anormalement basse… », pas « moralité
vérifiée ».

- À l'arrêt de l'étape `ANORMALES` (`POST …/evaluation/lots/{lot}/arreter`), un champ `moraliteVerifiee: boolean` (obligatoire à
  l'arrêt de cette étape : 400 nominatif s'il manque) et `moraliteObservation?: string`.
- Servi dans `LotEvaluation` (`moralite: { verifiee, observation, par, le }`) et repris dans le PDF du rapport (section 6, une phrase :
  « La commission a vérifié la moralité des prix unitaires… »).
- Les évaluations closes avant la règle : `moralite` nul, l'écran le dit.

## B3 — L'entreprise qualifiée : STAT, RCS, activités (point 16)

`OffreEvaluee.entreprise` = `{ nif, raisonSociale }`. Le point demande les activités du candidat (NIF, STAT) couvrant l'objet.

- Servir `entreprise.stat`, `entreprise.rcs` (déjà au profil candidat, V63) et `entreprise.activites` (texte : objet social ou activités
  déclarées — **à ajouter au profil candidat** `PUT /api/candidat/entreprise` s'il n'existe pas ; dites-nous).
- Les pièces d'entreprise (carte fiscale, statuts, pouvoir) lisibles par la Commission depuis l'évaluation :
  `GET …/evaluation/offres/{idOffre}/entreprise/pieces` (liste) et `…/pieces/{id}` (binaire), accès CAO, responsable, PRMP, UGPM, Commission.

## B4 — Variantes (point 4 « montant évalué conforme au DAO »)

Le cadrage de la fiche dit si les variantes sont autorisées (`variantes`), l'évaluation ne dit rien d'une variante déposée ou évaluée.

- Par offre : `variante: { deposee: boolean, evaluee: boolean | null, montant: number | null, retenue: boolean | null, motif } | null`
  (nul quand le cadrage n'autorise pas les variantes) ; saisi avec le montant évalué (`MontantRequest.variante`).
- Faible priorité : aucun DAO de la recette n'autorise les variantes ; livrable après B1-B3.

**À préserver** : les évaluations closes gardent leurs valeurs (champs nuls, jamais recalculés) ; le PDF du rapport déjà signé n'est pas
régénéré ; `moyenne` et `alertes` restent servies telles quelles.

## Ce que fait le front

L'élément « Rapport d'évaluation » de l'examen est réorganisé en huit parties nommant leurs points (document § 4) ; il affiche dès
maintenant les données servies mais absentes de l'écran (clause du rejet, demande de justification et réponse, départage, codes du DAO des
critères, rapports retirés, contrôles automatiques sous leur point) ; B1 à B4 s'y ajoutent à la livraison, avec un repli « non renseigné »
tant qu'ils ne sont pas servis.

> ⚠️ **2026-11-05 — B1, B2, B3 livrés (PRS20, V169) ; B4 à suivre, dans une livraison séparée.**
> - **B1, seuils** : `origineSeuils` vaut toujours `CIRCULAIRE` (20 % et 10 %). La fiche ne porte **aucun seuil chiffré**, donc
>   `DAO` n'a pas de source. `CAO` n'a pas de saisie : l'ajouter demanderait que la commission déclare ses seuils, et à quel moment
>   (avant ses décisions, sinon les indicateurs changeraient après coup). **Question au pilote** : la commission doit-elle pouvoir
>   appliquer d'autres seuils que ceux de la circulaire ?
> - **B1, `moyenne`** : elle sert désormais `moyenne2`, comme demandé, et `ecartMoyenne` l'écart à `moyenne2`. La valeur est inchangée
>   tant qu'aucune offre n'est anormalement haute. Sinon elle diffère de l'ancienne « moyenne de toutes les offres », que
>   `moyenne1` sert désormais.
> - **B1, calculs** : les indicateurs sont **calculés à la lecture**, comme `moyenne` l'était déjà : ils valent aussi pour une
>   évaluation close. Rien n'est stocké, donc rien n'est « recalculé » au sens de la règle.
> - **B1, `methodeDao`** : il est nul sur la fiche 15/MTP/SG/PRMP.2026 parce que la PRMP **n'a pas saisi** `B06-EO-07`, ce qui a été
>   vérifié en recette (lecture seule). Ce champ est facultatif et réservé aux travaux, ce que le contrat dit bien. Aucun code `B06-EV-*`
>   ne porte le traitement des offres anormales, donc rien d'autre n'est à lire.
> - **B2** : livré comme demandé. Le 400 sur `moraliteVerifiee` vient **après** les contrôles 409 de l'étape (offres sans décision,
>   suspectées, égalité). Seuls les rapports produits après la règle portent la phrase.
> - **B3, `activites`** : le champ n'existait pas, il est **ajouté au profil** (`PUT /api/candidat/entreprise`, facultatif, 1000
>   caractères). Un `PUT` sans le champ **conserve** la valeur, pour que l'écran actuel ne l'efface pas. Vide, il l'efface.
> - **B3, lecture au profil** : `stat`, `rcs` et `activites` sont lus au profil **au jour de la lecture**, pas à la date du dépôt de l'offre,
>   comme le STAT déjà servi par la séance. Une modification ultérieure du profil se voit donc à l'évaluation.
> - **B3, pièces** : servies par les deux routes demandées. Ce sont les pièces du profil d'aujourd'hui, avec le même accès que les
>   autres lectures de l'évaluation.