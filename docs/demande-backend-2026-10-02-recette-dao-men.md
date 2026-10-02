# Demande backend — Recette du DAO du MEN rejoué en fiche de travaux

**Date** : 2026-10-02 · **Émetteur** : front · **Origine** : accord du pilote du 02/10 (« selon votre recommandation »)
pour écrire en base de recette. Le DAO de travaux du MEN (`demande-backend-2026-10-01-dao-travaux-men.md`) a été
rejoué en **fiche 40**, sur la ligne 303288 du plan 00004 (5 lots). La v1 est **validée** et reste en base. Valeurs du
jeu, avec leur nature : `docs/jeu-donnees-men-travaux-faits.md` (§10 et §10.1).

**Ce qui sort juste** :

- **DPAO**, fidèle au MEN :
  - limite de 2 lots ;
  - expérience sur 5 ans ;
  - liquidité et garantie par lot ;
  - validité de 120 jours ;
  - 3 formes de garantie ;
  - rangée 9.4.5 ;
  - personnel clé ;
  - pièces avec leurs sauts de ligne.
- **AE par lot** : délai de 120 jours, maître d'œuvre, avance.
- **Import serveur du PDF** : 120 jours, 10 / 5 / 5, variantes, prix ferme et forfaitaire, le tout en confiance haute. Une seule erreur, en confiance basse (`B03-CQ-01`).

Restent quatre sujets :
- **B1** : deux modèles corrigés à recopier ;
- **B2** : le référentiel, qui exige ce qu'un DAO ne contient pas ;
- **B3** : les trous qui n'ont pas de champ ;
- **B4** : une anomalie de données.

## B1 — Recopier le DPAO-T et le CCAP-T

Fichiers à recopier : `scripts/modeles-dao/modeles/{DPAO-T,CCAP-T}.{txt,json}`. Décalques : `docs/modeles-dao/`.

Fidélité : **DPAO-T 262 / 262** (41 conditions), **CCAP-T 572 / 572** (72 conditions).

Banc de lecture, 13 passes : Q10 tenu, **0** réponse déduite fausse. La lecture du DAO du MEN est inchangée.

| modèle | clause | avant | après | pourquoi |
|---|---|---|---|---|
| CCAP-T | 7.1, libération | `LIBERATION-TOTALE` = `B05-GE-04 contient 100` | `LIBERATION-TOTALE` = `B05-GE-04 = Libérée à 100 % à la réception définitive` ; **nouvelle** `LIBERATION-PROVISOIRE` = `… = Libérée à 100 % à la réception provisoire`, qui imprime « …libérée à 100% dans les 30 jours suivant la date de la réception provisoire » | **faux juridique** : `contient 100` attrapait les deux options à 100 %, et la libération à la réception provisoire (cas du MEN) imprimait « réception **définitive** ». Le modèle ARMP n'a pas de rédaction pour la provisoire : paragraphe déclaré en `ajouts`, calqué mot pour mot sur celui de la définitive |
| CCAP-T | 7.1, formes | « …figurant en Annexe <numéro> au présent CCAP » ×2 | « …figurant en Annexe au présent CCAP » | les annexes du CCAP ne sont pas numérotées par le modèle (le MEN écrit « dans les Annexes ») |
| CCAP-T | 1.2.3 | « …au marché `{{B02-MW-02}}` en date <à préciser> par : » | « …au marché `{{B02-MW-02}}` par : » | la date fait partie des références saisies dans `B02-MW-02` |
| CCAP-T | 20 | après `{{B09-FM-02}}` : « En vue de l'application éventuelle… ci-après : » et trois lignes « <préciser le niveau> » / « <préciser le lieu…> » | retirés | seconde liste de seuils d'intempéries, même objet que `B09-FM-02`, imprimée en blanc à sa suite. Le MEN n'en garde qu'une |
| CCAP-T | 21 | `{{B09-DL-01}}` | `{{B09-DL-01.parLot}}` | délai saisi par lot, dans un document commun : imprimé « ……… » sur la fiche 40 |
| DPAO-T | 6.3 a) | toujours imprimé | section `CHIFFRE-AFFAIRES` = `B03-QT-07 renseigne` | le MEN n'exige aucun chiffre d'affaires (voir B2.1) |

> ⚠️ **Livraison backend du 2026-10-02 (§B1).** Conforme. Les deux modèles sont recopiés tels quels : **DPAO-T 262/262**
> (41 conditions), **CCAP-T 572/572** (72 conditions), mesurés par votre comparateur sur le rendu brut du serveur.
> Rendu contrôlé (`ModelesDaoTravauxTest.recetteDuMen`) :
> - « …libérée à 100% dans les 30 jours suivant la date de la réception **provisoire** », sans la définitive ; l'option
>   définitive, elle, imprime la définitive seule ;
> - le délai par lot dans le CCAP ;
> - le chiffre d'affaires imprimé seulement s'il est renseigné.
>
> **Parité** (options et réponses déduites, 18 documents) : extraction identique, 1 022 lignes de lecture identiques à
> `lire.mjs` ; aucune lecture du DAO du MEN ne change.
> **Rejeu de la fiche 40 en v2** : c'est à faire de votre côté, après le redémarrage et le passage des scripts. Je
> n'écris pas en base sous le nom d'une PRMP.

## B2 — Référentiel des travaux : ce qui ne devrait pas être exigé, et des libellés qui trompent

### B2.1 — Champs obligatoires qu'un DAO ne remplit pas

Sans ces quatre valeurs, la fiche 40 refusait la validation. Elles ont été inventées pour la recette (§10.1 de la fiche des faits).

| code | aujourd'hui | demandé | raison |
|---|---|---|---|
| `B03-QT-07` chiffre d'affaires minimum | obligatoire | **facultatif** | critère que l'acheteur peut ne pas retenir (le MEN le remplace par la liquidité, `B03-QT-14`). Le DPAO-T de B1 ne l'imprime plus que renseigné |
| `B03-CQ-10` durée des antécédents financiers | obligatoire | **facultatif** | aucun modèle de travaux ne l'imprime |
| `B09-DL-04` date de réception de l'ouvrage | obligatoire | **facultatif** | inconnaissable au stade du DAO ; l'AE-T ne l'imprime que renseignée (section `RECEPTION`) |
| `B10-PC-01` procédure contentieuse | obligatoire, sans défaut | **`valeurDefaut`** renvoyant au CCAG, rédaction à faire valider par le juriste | le CCAP du MEN n'en dit rien de propre |

Le contrôle `DATES_ORDRE` reste juste : il a obligé à aligner la date limite sur le calendrier du plan. Rien à changer.

### B2.2 — Libellés à préciser : la valeur s'insère dans une phrase du modèle

Sur la fiche 40, quatre saisies faites en phrases complètes, comme leurs libellés y invitent, ont produit des doublons :

| code | libellé actuel | phrase du modèle | imprimé sur la fiche 40 | libellé proposé |
|---|---|---|---|---|
| `B09-MA-03` | Limite de la diminution ouvrant droit à indemnité | « …au delà de `{{B09-MA-03}}` de la masse initiale des travaux… » | « au delà de Au-delà de 20 % de la masse initiale des travaux de la masse initiale » | « …: pourcentage de la masse initiale (ex. « vingt pour cent (20 %) ») ». Même précision pour `B09-MA-01`, `-02` et `-04` |
| `B09-MD-01` | Conditions de prolongation ou de report du délai d'exécution | « …pour une période cumulé de `{{B09-MD-01}}` » (le trou ARMP est « <indiquer le nombre de jours> ») | « …une période cumulé de La PRMP peut notifier une prolongation… » | « Durée cumulée maximale de prolongation ou de report sans avenant ». Le type `NOMBRE` (jours) serait plus juste ; à vous de juger le coût de migration |
| `B03-NT-01` | Comptable assignataire et montant maximal nanti | « Est désigné comme Comptable Assignataire de paiement le `{{B03-NT-01}}` » | « …de paiement le Est désigné comme comptable assignataire… » | « Comptable assignataire des paiements (désignation seule) ». Le montant nanti est rempli par le candidat dans le paragraphe suivant |
| `B02-MW-04` | Maître d'ouvrage délégué : nom et coordonnées | section `MOD` = `B02-MW-04 renseigne` | « Non applicable » saisi : tout le §1.2.2 sur la délégation est imprimé | ajouter « (laisser vide s'il n'y en a pas) » |

> **Question Q1.** Le piège est général : un `TEXTE_LONG` s'insère souvent au milieu d'une phrase. Le référentiel
> pourrait-il servir, pour chaque champ, la **phrase du modèle qui l'entoure** (un champ `gabarit` : « …au delà de ___ de
> la masse initiale… ») ? Le front l'afficherait sous le champ. Les modèles recopiés la contiennent déjà. C'est une
> proposition, pas un préalable.

> ⚠️ **Livraison backend du 2026-10-02 (§B2).**
> - **B2.1, conforme.** `B03-QT-07`, `B03-CQ-10` et `B09-DL-04` sont facultatifs. `B03-CQ-10` est commun aux trois
>   catégories et n'est imprimé nulle part : il devient facultatif partout.
>   `B10-PC-01` propose par défaut : « Les différends nés de l'exécution du marché sont réglés selon la procédure prévue à
>   l'article 50 du Cahier des Clauses Administratives Générales applicable aux marchés de travaux. » L'article 50 est
>   celui que cite déjà le titre de l'article 31 du CCAP-T. **Rédaction à faire valider par le juriste.** Le défaut ne
>   vaut que pour les fiches créées ensuite : une révision de la fiche 40 garde la valeur saisie en v1.
> - **B2.2, conforme**, avec deux précisions :
>   - `B09-MD-01` garde le type `TEXTE_LONG`. Passer en `NOMBRE` rendrait invalides les valeurs déjà saisies en phrase
>     (dont la fiche 40) ; le libellé guide désormais vers une durée (« ex. « soixante (60) jours » »).
>   - `B09-MA-01` à `-04` reçoivent le même complément (« : pourcentage de la masse initiale (ex. « vingt pour cent
>     (20 %) ») »).
> - **Q1 (gabarit), faisable.** Au chargement des modèles, le serveur peut relever, pour chaque champ, les paragraphes qui
>   le citent dans les modèles de sa catégorie, et les servir avec le référentiel (`gabarits: [{ sigle, texte }]`, les
>   autres jetons remplacés par « ___ »). Je ne l'ai pas fait dans cette livraison : dites-moi si vous le voulez, je
>   l'écris en demande à part.

## B3 — Trous restés en blanc faute de champ ou de suffixe

Ces trous s'impriment tels quels sur la fiche 40. Le front les branchera dans `decrire.mjs` dès que le champ ou le
suffixe sera servi.

### B3.1 — Moteur

| besoin | où | proposition |
|---|---|---|
| **suffixe `.heure`** d'un `DATE_HEURE` (« 09 h 30 ») | DPAO-T 8 : « Heure : (insérer l'heure) », imprimé tel quel | `{{B04-OV-02.heure}}`. L'ouverture a lieu le même jour que la remise, immédiatement après (l'avis le dit déjà) |
| **dérivé « date des prix »** = date limite de remise − 15 jours | AE-T 3 : « …le quinzième jour précédant la date limite fixée pour la remise des offres, soit le………… » | `{{DERIVE.date-prix}}`, sur le modèle de `DERIVE.fin-validite-offre` |
| **dérivé « date du DAO »** | AE-T : « Dossier d'Appel d'Offres N° `{{B02-OB-03}}` du <date> » | `{{DERIVE.date-dao}}`. La date à retenir est à fixer par vous (validation de la fiche ? publication de l'avis ?) |
| accord du nom après un nombre | DPAO-T 7.1 : « `{{B04-FP-01}}` copies » imprime « 1 copies » | à votre choix (suffixe d'accord, ou dérivé). Priorité basse |

> ⚠️ **Livraison backend du 2026-10-02 (§B3.1).**
> - **`.heure`** : `{{B04-OV-02.heure}}` donne « 09 h 30 ».
> - **`{{DERIVE.date-prix}}`** : la date limite de remise moins 15 jours, lue comme `DERIVE.fin-validite-offre`
>   (`B04-LR-03`, à défaut `B04-CP-02`, à défaut `B04-OV-02`).
> - **`{{DERIVE.date-dao}}`** : je retiens la **date de validation de la version** rendue. C'est le moment où le DAO est
>   établi et figé, et ses documents produits ; l'avis peut ne jamais être imprimé, ou l'être plusieurs fois. Sur un rendu
>   brut (sans validation) : pointillés.
> - **« 1 copies »** : non traité, priorité basse. Le plus simple serait côté modèle, « {{B04-FP-01}} copie(s) » ;
>   sinon un suffixe d'accord, à demander à part.

### B3.2 — Champs à créer (travaux)

| information | où | MEN | type proposé |
|---|---|---|---|
| **Bénéficiaire des chèques de banque** | DPAO-T 6.7 (garantie de soumission, « libéllé au nom de ….. ») ; CCAP-T 7.1 (« à l'ordre de <à préciser> ») | « Receveur Général d'Antananarivo », aussi pour l'avance (CCAP 14.1) | `TEXTE`, un seul champ pour toutes les garanties |
| Plafond des pénalités de retard | CCAP-T 23 : « …dans la limite de <pourcentage> du montant global… » | renvoi au CCAG 20.6 | `POURCENTAGE` |
| Délai de remise du projet de décompte mensuel | CCAP-T 16 : « au plus tard < nombre de jours> jours ouvrables… » | — | `NOMBRE` |
| Plafond des travaux en régie | CCAP-T 12.2 : « …atteint <pourcentage> du montant du Marché » | non applicable | `POURCENTAGE` |
| Indices d'actualisation des prix fermes | CCAP-T 11.4 : « <indiquer la nature des indices…> », imprimé dès que les prix sont fermes | prix « fermes et non révisables », **sans** actualisation | `TEXTE_LONG` **facultatif**. Le front mettra le paragraphe d'actualisation sous condition `renseigne` (comme `B05-VP-03` en fournitures) |
| Découpage du forfait par corps d'état | CCAP-T 16 : quatre lignes « -…………% », puis « Réception provisoire 5 % » | dix postes (installation, terrassement… assainissement), pourcentages en blanc, plus une retenue de 3 % | `TEXTE_LONG` (liste des postes) |

> ⚠️ **Livraison backend du 2026-10-02 (§B3.2).** Les six champs sont créés, facultatifs, réservés aux travaux (quantité
> fixe et à commande). Codes à brancher dans `decrire.mjs` :
> - `B05-GQ-04`, bénéficiaire des chèques de banque, `TEXTE` : un seul champ pour toutes les garanties (DPAO maître,
>   repris au CCAP) ;
> - `B09-PE-03`, plafond des pénalités de retard, `POURCENTAGE` ;
> - `B08-MR-05`, délai de remise du projet de décompte, `NOMBRE` (jours ouvrables) ;
> - `B08-RE-04`, plafond des travaux en régie, `POURCENTAGE` ;
> - `B05-VR-02`, indices d'actualisation des prix fermes, `TEXTE_LONG` : le libellé dit « laisser vide sans
>   actualisation », pour votre condition `renseigne` ;
> - `B08-MR-06`, découpage du forfait par poste ou corps d'état, `TEXTE_LONG`, un poste par ligne (un saut de ligne dans
>   une valeur est un vrai saut de ligne en Word depuis le 01/10).

## B4 — Données : apostrophes remplacées par « ¿ »

**14 lignes de plan sur 233** ont un `designationMarche` où l'apostrophe est devenue `¿` (U+00BF). Exemple, la ligne
303288 : « Travaux d¿aménagement et d¿entretien des voiries… ». Le défaut se recopie tel quel dans l'objet des
documents produits. Il vient d'un import ancien du plan, pas de la chaîne du DAO.

Demande :
1. corriger ces 14 lignes (`¿` entre deux lettres → `’`) ;
2. vérifier que l'import actuel du plan ne le reproduit plus.

**Recette attendue** :
- **B1** : la parité habituelle sur les 18 documents, plus la fiche 40 rejouée en v2 avec `B05-GE-04` « …réception provisoire » ;
- **B2** : la fiche 40 validable sans les quatre valeurs inventées ;
- **B3** : rendus du DPAO-T, de l'AE-T et du CCAP-T sans aucun des blancs listés, une fois le front rebranché.

> ⚠️ **Livraison backend du 2026-10-02 (§B4).**
> 1. **Correction** : `docs/referentiel/2026-10-02-apostrophes-plan.sql`, essai à blanc fait (14 lignes et 14 lots
>    corrigés, aucun « ¿ » restant). **Deux écarts :**
>    - **L'apostrophe est la droite « ' »**, et non « ’ » : c'est celle du reste du plan (« Travaux d'urgence », sur la ligne
>      303158 elle-même) et celle que pose l'import. Une même désignation ne mélange donc pas les deux.
>    - **Les lots aussi** (`t_lot`, 14 désignations), que l'objet des documents reprend tout autant. Un « ¿ » n'était pas
>      une apostrophe : « Antsiranana ¿ Lot n°02 », sur la ligne 303288, est un tiret, comme les « - » qui séparent les
>      autres lots de la même phrase. Il devient « - » dans la ligne, et il est retiré du bout de la désignation du lot 1,
>      où le découpage l'avait laissé.
>
>    Les documents déjà produits pour la fiche 40 (v1) restent figés ; la v2 reprendra le bon objet.
> 2. **L'import actuel** ne reprend pas un « ¿ » en silence. Les deux imports du plan, PDF et xlsx, le signalent par une
>    anomalie `ENCODAGE_SUSPECT` à la revue ; l'import PDF corrige aussi depuis le 22/07 les cas sans ambiguïté (œ,
>    « jusqu'à »). Ajout du 02/10 :
>    - l'élision d'un mot d'une lettre ou de « qu » (« d¿aménagement » → « d'aménagement »), la ligature œ passant avant,
>      pour que « c¿ur » reste « cœur » ;
>    - le même nettoyage, désormais appliqué aussi à l'import xlsx (objet et lots).
>
>    Test : `NettoyageEncodagePpmTest`.

## B5 — Contre-recette (front, 2026-10-02) et modèles rebranchés à recopier

### B5.1 — Fiche 40 rejouée en v2 : B1, B2 et B4 conformes

v2 = révision de la v1, puis validée. Écart avec la v1 :
- retirées : `B03-QT-07`, `B03-CQ-10`, `B09-DL-04`, `B02-MW-04` ;
- ajoutées : `B05-GQ-04`, `B08-MR-06` ;
- corrigées : `B09-MA-01` à `-04`, `B09-MD-01`, `B03-NT-01` (saisies en fragment, selon les nouveaux libellés), `B10-PC-01` (votre texte par défaut).

Résultat :
- **0 contrôle bloquant**, sans aucune des quatre valeurs inventées ;
- CCAP : libération « …suivant la date de la réception **provisoire** » seule, « figurant en Annexe au présent CCAP », délai par lot à l'art. 21, plus de §1.2.2 (maître d'ouvrage délégué), plus de seconde liste de seuils ;
- art. 18 et 22 sans doublon (« au delà de vingt pour cent (20 %) de la masse initiale… », « une période cumulé de vingt (20) jours ») ;
- DPAO : critère a) absent, la liste commence à b) ;
- AE : « …de paiement le Trésorier Ministériel chargé de l'Enseignement » ;
- objet : « Travaux d'aménagement… campus universitaire d'Antsiranana - Lot n°02… » dans les trois documents.

> Piège de script, noté pour les prochains rejeux : `PUT /blocs/{bloc}` remplace **tout** le bloc. Un envoi partiel
> efface le reste (vu sur le brouillon v2, rétabli avant validation, écart avec la v1 contrôlé clé par clé).

### B5.2 — Recopier le DPAO-T, l'AE-T et le CCAP-T rebranchés (contre-recette de B3)

Fichiers : `scripts/modeles-dao/modeles/{DPAO-T,AE-T,CCAP-T}.{txt,json}`. Fidélité : **DPAO-T 262 / 262**,
**AE-T 363 / 363**, **CCAP-T 574 / 574** (73 conditions). Banc de 13 passes : Q10 tenu, 0 réponse déduite fausse.

| modèle | clause | jeton ou changement |
|---|---|---|
| DPAO-T | 6.7, chèque de garantie de soumission | « libéllé au nom de `{{B05-GQ-04}}` » |
| DPAO-T | 7.1 | « `{{B04-FP-01}}` copie(s) » (votre suggestion) |
| DPAO-T | 8, ouverture | « Heure : `{{B04-OV-02.heure}}` » |
| AE-T | préambule, deux fois | « N° `{{B02-OB-03}}` du `{{DERIVE.date-dao}}` » |
| AE-T | art. 2 | « …soit le `{{DERIVE.date-prix}}` » |
| CCAP-T | 7.1 | « à l'ordre de `{{B05-GQ-04}}` » |
| CCAP-T | 11.4 | « Les prix sont fermes et non révisables. » reste sous `FERME` ; l'actualisation (formule et indices `{{B05-VR-02}}`) passe sous la **nouvelle** condition `ACTUALISATION` = `prixRevisable = NON et B05-VR-02 renseigne` |
| CCAP-T | 12.2 | « …atteint `{{B08-RE-04.chiffres}} %` du montant du Marché » |
| CCAP-T | 16, décomptes | « au plus tard `{{B08-MR-05}}` jours ouvrables… » |
| CCAP-T | 16, forfait | les quatre lignes « -……% » et « - Réception provisoire…… 5% » sont retirées ; à leur place `{{B08-MR-06}}`, déclaré en `ajouts`. « - Total… 100 % » reste |
| CCAP-T | 23 | « …dans la limite de `{{B09-PE-03.chiffres}} %` du montant global… » |
| CCAP-T | 28.2 | « …est de `{{B09-RP-03}}` jours. » (la v2 imprimait « est de 20. ») ; « décrites en annexe aux Spécifications Techniques », sans « <n°> » |

**Recette attendue** :
- la parité habituelle ;
- la fiche 40 révisée en v3, sans changement de valeur : les blancs de B3 doivent disparaître.

Il en restera trois, faute de donnée chez le MEN : `B09-PE-03`, `B08-MR-05` et le marché de maîtrise d'œuvre (`B02-MW-02`). Ce sont des pointillés attendus. Je rejouerai la v3 à votre retour.

> ⚠️ **Livraison backend du 2026-10-02 (§B5.2).** Conforme. Les trois modèles sont recopiés tels quels : **DPAO-T 262/262**,
> **AE-T 363/363**, **CCAP-T 574/574** (73 conditions), sur le rendu brut du serveur.
> Rendu contrôlé (`ModelesDaoTravauxTest.blancsDeB3Remplis`) :
> - chèque « libéllé au nom de … » et « à l'ordre de … » ;
> - « 1 copie(s) » ;
> - « Heure : 09 h 30 » ;
> - « N° … du 02/10/2026 » (date de validation) ;
> - « soit le 01/11/2026 » (remise − 15 jours) ;
> - régie à « 10 % », décompte « 5 jours ouvrables », découpage du forfait ligne à ligne, pénalités plafonnées à « 10 % » ;
> - « est de 20 jours. ».
>
> Plus aucun « <à préciser> », « <pourcentage> », « < nombre de jours> », « <indiquer la nature des indices… » ni « <n°> ».
> L'actualisation ne s'imprime que si `B05-VR-02` est renseigné, et « Les prix sont fermes et non révisables. » reste.
> **Parité** : extraction identique, **1 027 lignes** de lecture identiques. Sur le DAO du MEN, le DPAO-T reconnaît désormais
> 46 paragraphes, comme chez vous.
> La v3 de la fiche 40 est à rejouer de votre côté, après le redémarrage du JAR. Aucun script n'est à passer.
