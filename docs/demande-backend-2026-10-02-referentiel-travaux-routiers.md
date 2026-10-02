# Demande backend — Référentiel des travaux : quatre corrections relevées sur le DAO routier du MTP

**Date** : 2026-10-02 · **Émetteur** : front · **Origine** : comparaison de la fiche DAO Travaux avec le premier DAO de
travaux **routiers** réel (`docs/correspondance-2026-10-02-fiche-dao-travaux-vs-dao-mtp-routier.md`). Accord du pilote le
02/10 (« oui »).

Ce sont des corrections du référentiel `QUANTITE_FIXE` / `TRAVAUX`, sans modèle à recopier. Chacune a été vérifiée
contre les modèles recopiés, pour savoir où le champ s'imprime. Les besoins de structure (DQE, listes, seuils calculés)
ne sont **pas** ici : ils relèvent du chantier b, qui fera l'objet d'un plan à part.

## B1 — `B02-MW-01` (maître d'œuvre) : facultatif

- **Constat** : le champ est obligatoire. Or le CCAP-T a une rédaction pour son **absence** (section `SANS-MOE`,
  condition `B02-MW-01 vide` : « Les tâches du maître d'œuvre sont assurées… »), qui ne peut donc jamais s'imprimer.
- **Cas réel** : le MTP écrit « Le maître d'œuvre sera désigné par une décision du maître de l'Ouvrage avant tout
  commencement des travaux » (CCAP 1.2.3), et l'AE laisse le nom en blanc. Le maître d'œuvre n'est pas connu au stade du DAO.
- **Demandé** : `obligatoire = false`.

> ⚠️ **Livraison backend du 2026-10-02 (§B1).** Conforme : `B02-MW-01` est facultatif. Une fiche sans maître d'œuvre imprime
> la rédaction `SANS-MOE` du CCAP. **À noter :** cette rédaction porte elle-même un trou sans champ, « Les tâches du maître
> d'œuvre sont assurées par <préciser l'autorité désignée par la PRMP> », imprimé tel quel. Il faut un champ, ou une
> rédaction sans trou, si vous voulez le combler.

## B2 — `B09-AC-03` (assurance décennale) : obligatoire seulement pour un bâtiment

- **Constat** : le champ est obligatoire pour tous les travaux, mais le CCAP-T ne l'imprime que sous `BATIMENT`
  (`B09-BT-01 = OUI`). Pour une route, la fiche exige une valeur qui ne s'imprime nulle part.
- **Demandé** :
  - `obligatoire = false` ;
  - une règle de bilan bloquante « `B09-AC-03` exigé quand `B09-BT-01 = OUI` », si vous jugez la garantie indispensable
    pour un bâtiment.

> ⚠️ **Livraison backend du 2026-10-02 (§B2).** Conforme, règle comprise. `B09-AC-03` est facultatif ; la nouvelle règle
> **bloquante** `ASSURANCE_DECENNALE` l'exige quand `B09-BT-01 = OUI`, avec les rôles `BATIMENT` (`B09-BT-01`) et
> `ASSURANCE` (`B09-AC-03`) portés par la colonne `controle` du fichier de correspondance. Le message dit : « Des travaux de
> bâtiment exigent l'assurance de responsabilité civile décennale : renseignez « Assurance de responsabilité civile
> décennale ». » Hors bâtiment, la règle ne dit rien.

## B3 — `B04-CD-02` (modèle de garantie de soumission joint) : des options qui parlent aux travaux

- **Constat** : les options « C1 / C2 / C1 et C2 » sont les numéros du dossier type des **fournitures**. Le dossier type
  des travaux numérote les mêmes modèles **B1** (garantie bancaire) et **B2** (caution personnelle et solidaire), et le
  MEN comme le MTP écrivent B1 et B2. Une PRMP de travaux ne reconnaît pas son modèle dans « C1 ».
- **À ne pas casser** : ces codes commandent la production des documents `C1` / `C2` (la fiche 40 les a produits) et le
  contrôle bloquant `GARANTIE_MANQUANTE`. Le code enregistré ne change donc pas.
- **Côté front, sans rien vous demander** : les options sont des chaînes où valeur et libellé ne font qu'un. L'écran
  affichera donc à côté de chaque option ce qu'elle désigne : « C1 — garantie bancaire (B1 au dossier type des
  travaux) », « C2 — caution personnelle et solidaire (B2) ».
- **Demandé** : pour une fiche de travaux, un titre des documents produits qui reprenne la numérotation du dossier type
  des travaux (B1, B2). À vous de dire si c'est le titre, le nom de fichier, ou les deux.

> ⚠️ **Livraison backend du 2026-10-02 (§B3).** Le **libellé et le nom de fichier**, pour une fiche de travaux :
> - « Garantie bancaire de soumission (B1) », `B1_<plan>_<ligne>_lot<n>_v<n>.pdf` ;
> - « Caution personnelle et solidaire de soumission (B2) », `B2_…`.
>
> Le **type** du document reste `C1` / `C2`, comme vous le demandiez : il commande la production et
> `GARANTIE_MANQUANTE`. Le filtre de la liste des documents se fait donc toujours sur `type == 'C1'`.
> **Ce qui reste « C » :** le titre imprimé **dans** le document, « C 1 – Modèle de garantie bancaire de soumission ».
> C'est le texte du modèle officiel des fournitures recopié, que je ne réécris pas en douce. Pour un « B 1 » dans le
> corps, il faudrait recopier les modèles B1 / B2 du dossier type des travaux, à me fournir comme les autres.

## B4 — `B08-MO-01` (taux des intérêts moratoires) : retiré des travaux

- **Constat** : aucun modèle de travaux ne l'imprime. Le CCAP-T écrit en texte fixe « taux directeur de la Banque
  Centrale de Madagascar … augmenté d'un point », et c'est ce que portent le MEN comme le MTP. Le type `POURCENTAGE`
  ne recevrait d'ailleurs pas cette formule.
- **Demandé** : retirer `TRAVAUX` de `categories` pour ce champ ; ou le passer en `TEXTE` s'il sert ailleurs.

**Recette attendue** : une fiche de travaux routiers (non bâtiment, maître d'œuvre non désigné) validable sans
`B02-MW-01` ni `B09-AC-03`, dont le CCAP imprime la rédaction `SANS-MOE`.

> ⚠️ **Livraison backend du 2026-10-02 (§B4).** `B08-MO-01` n'était servi qu'aux travaux : il est donc **inactif**. Ses
> valeurs restent lisibles : 7 sur DBPRS20, hors avancement et hors bilan. Le contrôle `INTERETS_MORATOIRES_TAUX` qui le
> lisait n'a plus d'entrée pour les travaux, et ne dit plus rien.
>
> **Recette** (`FicheDaoTravauxIntegrationTest.travauxRoutiers`) :
> - une fiche de travaux sans maître d'œuvre ni assurance se valide, et son CCAP imprime « Les tâches du maître d'œuvre
>   sont assurées par… » ;
> - avec `B09-BT-01 = OUI` et sans assurance, la validation est refusée par `ASSURANCE_DECENNALE` ;
> - le document `C1` s'intitule « Garantie bancaire de soumission (B1) » et son fichier commence par `B1_`.
>
> Script `docs/referentiel/2026-10-02-travaux-routiers.sql`, passé à blanc sur DBPRS20 ; il sera appliqué avec la
> livraison. Les deux copies du fichier de correspondance des travaux sont mises à jour à l'identique.

> ✅ **Contre-recette du front, 2026-10-02 (JAR de 14:00), fiche 31** (travaux, 1 lot, jeu du MEN sans maître d'œuvre ni
> assurance décennale ; écriture en base avec l'accord du pilote) :
> - le référentiel sert `B02-MW-01` et `B09-AC-03` facultatifs, et ne sert plus `B08-MO-01` ;
> - avec `B09-BT-01 = OUI`, le contrôle donne **un seul** bloquant, `ASSURANCE_DECENNALE`, avec le message attendu ;
> - avec `B09-BT-01 = NON`, **0 bloquant** : la fiche se valide (v1 VALIDEE) ;
> - les garanties s'intitulent « Garantie bancaire de soumission (B1) » et « Caution personnelle et solidaire de
>   soumission (B2) », fichiers `B1_…_v1` et `B2_…_v1` ;
> - le CCAP imprime la rédaction `SANS-MOE`, avec ses deux phrases d'origine (voir B5 ci-dessous).

## B5 — Deux modèles à recopier (suite de la livraison)

**B5.1 — CCAP-T, rédaction sans maître d'œuvre : le trou est levé par le modèle, sans champ.** Le modèle alignait deux
phrases : « Les tâches du maître d'œuvre sont assurées par <préciser l'autorité désignée par la PRMP> » et « Dans ce
cas, le maître d'œuvre sera désigné par une décision du Maître de l'ouvrage ou de la PRMP ». La première est retirée :
une autorité connue se saisit déjà dans `B02-MW-01`, ce qui imprime la rédaction `MOE`. La seconde est retenue, comme au
DAO du MTP, sans « Dans ce cas, ». Elle devient « Le maître d'œuvre sera désigné par une décision du Maître de
l'ouvrage ou de la PRMP ».
- À recopier : `scripts/modeles-dao/modeles/CCAP-T.txt` et `.json`. La différence porte sur la seule section `SANS-MOE`.
- Contrôle : `verifier.mjs` donne 573 unités sur 573. Le banc de l'import est identique ligne pour ligne.

**B5.2 — B1 et B2 : les garanties de soumission du document type des travaux.** Elles ont été recopiées de
`Documents Types/Travaux/3-Dossier type d'appel d'offres_Travaux_Formulaire de soumission.doc` par la chaîne de C1 / C2
(`scripts/modeles-candidat`, `node extraire-armp.mjs travaux` puis `decrire-armp.mjs B1 B2`). Le modèle est
**plus qu'un titre à changer** : C1 imprimé sur une fiche de travaux renvoie à la « clause 6.8 (fournitures) » et à la
« clause 10.4 (fournitures) » des Instructions aux candidats. La fiche 31 le montre encore. B1 dit « 6.7 (travaux) » et
« 10.4 (travaux) ».
- À recopier : `scripts/modeles-candidat/modeles-armp/B1.txt`, `B2.txt` et leurs `.json`. Les **mêmes jetons** que C1 /
  C2, plus un dans B2. Le document type des travaux y ajoute « soit jusqu'au [durée de validité des offres + 30 jours]
  ème jour », jetonné `{{B05-GS-04}}` comme dans C1. Une coquille du document type, « Adresse) », est corrigée et tracée.
- Choix du modèle : **B1 / B2 pour une fiche de travaux**, C1 / C2 sinon. Le **type** du document reste `C1` / `C2`,
  comme convenu en §B3.
- Contrôle : `node verifier-armp.mjs B1 B2` donne « conforme au document type » dans les deux sens. A1 à C2 ressortent à
  l'identique.
- Pour la recette : `node verifier-armp.mjs B1 --docx=<rendu brut du serveur>`.

**Constat de la recette, côté données** : `B02-MW-04` (maître d'ouvrage délégué) saisi « Non applicable », comme dans
le DAO du MEN, déclenche la rédaction `MOD`. Le CCAP imprime alors « Le Maître d'Ouvrage Délégué désigné… Non
applicable ». C'est le jeu de recette qui est en cause, pas le serveur : le champ doit rester vide. À surveiller si les
PRMP écrivent « Non applicable » par habitude.

> ⚠️ **Livraison backend du 2026-10-02 (§B5).**
> - **B5.1, conforme.** CCAP-T recopié, **573/573** sur le rendu brut du serveur. La rédaction `SANS-MOE` imprime
>   « Le maître d'œuvre sera désigné par une décision du Maître de l'ouvrage ou de la PRMP », sans trou.
> - **B5.2, conforme au contrat.** B1 et B2 sont recopiés dans `modeles/candidat/` et chargés avec les autres modèles. Pour une
>   fiche de **travaux**, la garantie `C1` / `C2` est rendue sur B1 / B2 ; le type reste `C1` / `C2`, avec l'intitulé et le
>   nom de fichier `B1` / `B2` du §B3. `verifier-armp.mjs B1 --docx=<rendu brut>` et `B2` donnent « aucun écart ». La
>   recette d'intégration vérifie qu'une garantie de travaux dit « (travaux) » et jamais « (fournitures) ».
> - **Parité de la lecture** sur 19 documents : extraction identique, **1 117 lignes** identiques.
>
> **Un défaut à corriger côté modèle : les jetons de B1 / B2 ne valent pas pour les travaux.** Comme C1 / C2, B1 et B2
> citent `B05-GS-03` (montant, en chiffres et en lettres), `B05-GS-04` (validité de la garantie), `B04-LR-03` (date limite,
> dans B2) et `B05-GS-10`. Ce sont des champs de la catégorie **FOURNITURES_SERVICES** (vérifié sur DBPRS20). Une fiche de
> travaux ne les sert pas et ne les saisit jamais : le **montant**, la **validité** et la **date limite** de la garantie
> s'impriment donc en **pointillés** sur B1 / B2. C'était déjà le cas de C1 / C2 sur la fiche 40 et la fiche 31 : ce n'est
> pas une régression, mais votre rejeu ne le montrait pas.
> Ce qu'il faudrait, dans `decrire-armp.mjs` pour B1 / B2 :
> - `B05-GS-03` → `B05-GQ-03` (montant de la garantie des travaux, par lot : un document par lot, donc la valeur du lot) ;
> - `B04-LR-03` → `B04-OV-02` (date limite des travaux, date-heure : sa date) ;
> - `B05-GS-04` (validité de la garantie, en jours) : **les travaux n'ont pas de champ**. Le document type des travaux dit
>   « [durée de validité des offres + 30 jours] » : je peux servir un dérivé `{{DERIVE.validite-garantie}}` =
>   `B04-VO-01` + 30, si vous le voulez ;
> - `B05-GS-10` (forme de remise électronique de la garantie) : pas d'équivalent travaux ; la section `B04-SE` reste à
>   arbitrer.
>
> Dites-moi la voie retenue : je recopierai B1 / B2 rejetonnés et ajouterai le dérivé s'il le faut.
