# Demande backend — fournitures : champs non imprimés retirés, modèles CCAP-F et DPAO-F corrigés

**Date** : 2026-09-29 · **Émetteur** : front · **Suite de** : constat backend à la livraison D2 (V52, 9910f2f) et
analyse `docs/analyse-2026-09-29-champs-non-imprimes-fournitures.md` · **Arbitrage** : pilote, 29/09, « oui » aux cinq
décisions de l'analyse.

Périmètre : les fiches des **fournitures** (`typeMarche` QUANTITE_FIXE et A_COMMANDE). Le contrat-cadre n'est pas
touché (aucun des codes ci-dessous n'est dans DPAC-CC ni AE-CC).

## B1 — Retirer 29 champs de la fiche des fournitures

Décisions 1 (G1 + G2, 21 champs) et 4 (Q-b, 8 champs) :

| Groupe | Codes |
|---|---|
| G1 — données du candidat ou de la notification | B02-AU-05, B05-TP-02, B05-TP-03, B08-PA-01, B08-PA-02 |
| G2 — déjà dits par le document type | B03-NA-01, B03-NA-02, B03-ST-02, B04-OP-02, B04-OP-03, B04-RO-03, B06-EO-04, B06-EO-05, B06-EO-06, B08-AC-01, B08-AC-02, B08-AV-03, B08-AV-05, B08-AV-06, B08-PA-04, B10-IR-02 |
| Q-b — sans place dans le document type | B02-AU-07, B05-CP-03, B06-EO-03, B06-EO-07, B06-EO-08, B06-AN-02, B08-PA-08, B09-DG-02 |

Attendus :
1. **Seulement pour les fournitures.** Ces codes n'ont pas de `categories` dans le référentiel (colonne vide) : s'ils
   servent aussi aux travaux ou aux prestations intellectuelles, dont les documents types ne sont pas encore décrits,
   ils y restent. Le moyen (`actif = non` sur une ligne propre aux fournitures, ou `categories` restreintes) est au
   choix du backend.
2. **Valeurs conservées** : un champ retiré ne perd rien de ce qui a été saisi ; il n'est plus proposé, ne compte plus
   dans l'avancement ni dans le bilan (un obligatoire retiré ne bloque plus la validation).
3. **Vérifier avant de retirer** qu'aucun contrôle de la fiche, aucune règle du bilan, aucun champ calculé ni aucun
   point de la grille de la Commission ne lit ces codes. Deux cas sont déjà connus côté front :
   - **B04-OP-02** est **calculé par le serveur** en remise électronique (Q11 : date d'ouverture posée par le serveur).
     Le DPAO 8 dit en texte fixe « les mêmes que la date et l'heure limites » : le calcul n'a plus d'objet à la fiche.
     S'il sert ailleurs (journal, séance d'ouverture), il reste **calculé mais masqué** plutôt que retiré. Le backend
     tranche et le dit dans un encadré.
   - **B05-TP-02 / B05-TP-03** (montants minimum et maximum) sont lus par l'exemple de grille du front
     (`scripts/grille-dao.mjs`, démonstration, sans effet sur le serveur). Si une règle serveur les compare au montant
     du plan, elle est signalée **avant** tout retrait.
   Un code que ce contrôle révèle utile **reste**, avec la raison dans l'encadré.
4. Script du référentiel pour DBPRS20, comme pour V52.

> ⚠️ **Livraison backend du 2026-09-29 (§B1) — 25 champs retirés sur 29 ; quatre restent, parce qu'une règle du serveur
> les lit.** Le contrôle demandé au point 3 a été fait sur le code, les migrations et les modèles du serveur :
> - **`B04-OP-02` et `B04-OP-03` restent actifs, calculés.** Ce ne sont pas de simples champs affichés. En remise
>   électronique, le serveur les recalcule toujours comme l'échéance plus le délai `B04-OP-12` (V50, Q11). Ils sont lus
>   par `SE_OUVERTURE_PLIS`, bloquant si l'ouverture ne suit pas l'échéance, et par `DATES_ORDRE`, étape OUVERTURE. Les
>   retirer éteindrait ces deux règles. Or c'est précisément la question posée au juriste sur la clause 7.3 (décision 2 :
>   le DPAO 8 dit « les mêmes que la date et l'heure limites », la remise électronique dit « échéance + délai »). Ils se
>   décident avec les 16 champs du G4. Le « calculé mais masqué » n'existe pas au référentiel : un champ est servi ou non.
>   Le front peut les afficher en lecture seule, puisque `champsCalcules` les nomme en mode électronique.
> - **`B05-TP-03` reste actif.** Il porte le rôle `MAXIMUM` de l'avertissement `GARANTIE_TAUX` : la garantie de
>   soumission de chaque lot rapportée au montant maximum annuel, comparée aux bornes administrables. C'est le seul contrôle
>   du taux de garantie d'un marché à commande. Il ne compare pas au montant du plan, mais c'est bien une règle serveur.
>   `B05-TP-02` (minimum), que seul `MONTANT_POSITIF` lit sur lui-même, est retiré. Si le pilote accepte de perdre cet
>   avertissement, ou préfère le fonder sur le montant estimé du plan, `B05-TP-03` se retire en une ligne.
> - **`B08-PA-08` reste actif.** Il porte le rôle `DELAI` de l'avertissement `DELAI_PAIEMENT_75`, qui signale un délai de
>   paiement au-delà de 75 jours. Même alternative : retrait en une ligne si le pilote renonce à l'avertissement pour les
>   fournitures.
> - **Aucune autre lecture.** Aucun point de la grille de la Commission ne vise ces codes. Sur DBPRS20, aucune observation
>   (`t_observation_controle`, `t_observation_pv`) ne les porte. 214 valeurs saisies sur 9 fiches les portent et sont
>   conservées.
>
> **Moyen retenu (point 1)** : `actif = non` sur les 25. Aucun n'existe hors des fournitures : leur catégorie vide vaut
> `FOURNITURES_SERVICES`, et aucun fichier des travaux ni des prestations intellectuelles ne les définit. Rien ne change
> « ailleurs ». Le test demandé (« présent ailleurs ») vérifie donc que chacun est propre aux fournitures.
>
> **Valeurs conservées (point 2)** — un correctif était nécessaire. `PUT …/blocs/{bloc}` effaçait toutes les valeurs du
> bloc avant d'écrire celles reçues. L'écran ne renvoyant plus un champ retiré, sa valeur aurait été perdue au premier
> enregistrement du bloc. Désormais, les valeurs des champs inactifs sont gardées. Une **révision** ne reprend pas une
> valeur d'un champ inactif, selon la règle existante des valeurs orphelines, mais la version qui la porte la garde.
>
> Script : `docs/referentiel/2026-09-29-fournitures-champs-non-imprimes.sql`. Le référentiel sert 156 champs en
> quantité fixe et 159 à commande (179 et 184 avant).

## B2 — Modèle CCAP-F : trois corrections

Recopier `scripts/modeles-dao/modeles/CCAP-F.txt` et `.json` (décalque de relecture :
`docs/modeles-dao/CCAP-F.docx`). Fidélité 460/460 (`verifier.mjs`).

1. **Article 3 — les coordonnées du Fournisseur recevaient celles de la PRMP.** La plage de l'article couvrait les
   deux blocs d'adresse : « A l'attention de », « n° et rue », « Adresse électronique » du **Fournisseur** étaient
   remplis avec B01-AC-05, B01-AC-02, B01-AC-06. C'est une **erreur du modèle D2** (front), présente dans les CCAP
   des fournitures produits depuis la livraison D2. Le bloc du Fournisseur reste désormais en blanc (il le remplit à la
   signature). Les CCAP déjà produits se corrigent en les **reproduisant**.
2. **Article 3 — télécopie de la PRMP retirée** (décision 5, Q-c) : retrait motivé tracé dans le `.json`. La
   télécopie du **Fournisseur** reste, en blanc.
3. **Article 6, à commande — la variation au-delà des bornes** (« dans la limite de ………..% ») était restée en
   pointillés. Deux rédactions, deux conditions nouvelles :
   - `VARIATION-COMMANDE` = `typeMarche = A_COMMANDE et B09-OM-02 renseigne` : le pourcentage est **B09-OM-02**
     (« Variation maximale des volumes ou quantités », déjà imprimé pour la quantité fixe) ;
   - `SANS-VARIATION-COMMANDE` = `typeMarche = A_COMMANDE et B09-OM-02 vide` : la phrase s'arrête au Bordereau
     (retrait motivé de la clause de variation — aucune variation au-delà des bornes).
   B09-OM-02 est déjà ouvert aux deux types de marché dans le référentiel : rien à changer côté champ.

Conditions du CCAP-F : 65 → 67.

> ⚠️ **Livraison backend du 2026-09-29 (§B2).** Conforme. `CCAP-F.txt` est recopié tel quel ; le serveur ne lit pas le
> `.json`, qui reste au front. Le comparateur donne 460/460 sur le rendu brut du serveur. Tests (`ModelesDaoFournituresTest`) :
> - article 3 : le bloc de la PRMP porte ses coordonnées, le bloc du Fournisseur n'en porte aucune, et il n'y a plus de
>   télécopie de la PRMP ;
> - article 6 : à commande avec `B09-OM-02 = 15`, « dans la limite de 15 % » ; sans, la phrase s'arrête au Bordereau ;
>   la quantité fixe n'a ni l'une ni l'autre.
>
> Les CCAP déjà produits se corrigent en reproduisant les documents, par une révision validée.

## B3 — Modèle DPAO-F : les niveaux de qualification (décision 3, Q-a)

Recopier `scripts/modeles-dao/modeles/DPAO-F.txt` et `.json` (décalque : `docs/modeles-dao/DPAO-F.docx`). Fidélité
237/237.

Trois **ajouts déclarés** dans la cellule du DPAO 6.3, chacun sous la fiche qu'il précise :
- après 2° (capacités techniques) : « Niveau exigé : {{B03-CQ-02}} » ;
- après 3° (capacité financière) : « Niveau exigé : {{B03-CQ-03}} » ;
- après 4° (marchés similaires) : « Pièces exigées : {{B03-CQ-04}} ».

Les trois champs sont déjà obligatoires : rien à changer côté référentiel. Ce sont les seuls ajouts de ce lot qui
s'écartent du texte ARMP. Ils sont listés dans les `ajouts` du modèle, comme les autres.

> ⚠️ **Livraison backend du 2026-09-29 (§B3).** Conforme. `DPAO-F.txt` est recopié tel quel, 237/237 au comparateur. Un
> test vérifie les trois lignes et leur place sous les fiches 2°, 3° et 4°.

## B4 — Import (`LectureDao`)

Rien de neuf : les nouvelles unités (paragraphes à jeton, rédactions de l'article 6) se lisent avec les règles
existantes. La recopie des deux modèles suffit.

> ⚠️ **Livraison backend du 2026-09-29 (§B4).** Conforme pour les modèles. En plus, et hors de cette demande, les deux
> corrections PDF de `a3217b3` sont reportées dans `LecturePdf` : l'espace posée sous la première lettre est ignorée, et
> l'interligne se mesure par page. Le front avait de son côté repris l'écart du backend sur la ponctuation d'un jeton
> seul. La parité avec `lire.mjs` (5366264) est vérifiée sur quatre entrées :
> - les `.docx` de la fiche 27 ;
> - le PDF réel du 2463 ;
> - le rendu brut des modèles D2 corrigés ;
> - le PDF du DPAC de la fiche 27 produit par le serveur.
>
> L'extraction est identique, et la lecture aussi, aux conflits de cadrage près (écart du 28/09). Le PDF du serveur donne
> 117 unités sur 141, et le test d'import PDF exige désormais 100 et aucune valeur fausse en haute ni en moyenne.

## B5 — Hors backend (pour mémoire)

Décision 2 : les 16 champs de la remise électronique (G4 de l'analyse) rejoignent la question déjà posée au juriste sur
la clause 7.3. Rien à faire côté backend tant qu'il n'a pas répondu.

## B6 — Complément du 29/09 : les deux avertissements (arbitrage du pilote)

Suite de l'encadré §B1 : sur les quatre champs gardés, le pilote a tranché les deux qui ne dépendent pas du juriste
(« recommandations validées », 29/09).

1. **B05-TP-03 reste, mais devient facultatif** (`obligatoire = non`). C'est la seule base de `GARANTIE_TAUX` (le
   contrôle n'existe pas en quantité fixe, faute de rôle `MAXIMUM`). Il n'est imprimé nulle part : comme pour les champs
   non imprimés du contrat-cadre (Q2), il ne doit pas bloquer la validation. Sans valeur, l'avertissement n'est
   simplement pas évalué (comportement actuel de `garantieTaux`).
   Libellé : « Montant maximum annuel **estimé** du marché (Ariary) ». C'est l'estimation de l'acheteur, par lot, qui
   sert à apprécier la garantie ; elle ne se confond pas avec le montant maximum que le candidat porte à l'acte
   d'engagement.
   *Correction de l'analyse front* : B05-TP-03 était classé en G1 (« donnée du candidat ») à tort.
2. **B08-PA-08 est retiré** (`actif = non`), et l'avertissement `DELAI_PAIEMENT_75` avec lui pour les fournitures.
   Aucun document des fournitures n'imprime ce délai, que le CCAG fixe : un avertissement sur une valeur qu'aucun
   document ne porte ne protège rien. Le contrat-cadre n'est pas touché : il garde **B08-FP-03**, imprimé dans l'AE-CC,
   avec le même avertissement.

Attendus : script du référentiel pour DBPRS20 et test (B05-TP-03 facultatif ; fiche à commande sans B05-TP-03 validable ;
B08-PA-08 non servi aux fournitures, B08-FP-03 toujours servi au contrat-cadre).

Restent en attente du juriste : B04-OP-02 et B04-OP-03, avec les 16 champs de la remise électronique.

## Ce que le backend rend

Commit(s) qui referment B1 à B3, script du référentiel pour DBPRS20, tests (le CCAP à commande avec et sans B09-OM-02,
l'article 3 sans coordonnées de la PRMP dans le bloc du Fournisseur, le DPAO 6.3 avec ses trois niveaux, un champ
retiré absent de la fiche des fournitures et présent ailleurs), et un encadré ⚠️ daté ici pour tout écart.
