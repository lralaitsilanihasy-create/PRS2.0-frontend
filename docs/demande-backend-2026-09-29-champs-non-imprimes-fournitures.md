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

## B3 — Modèle DPAO-F : les niveaux de qualification (décision 3, Q-a)

Recopier `scripts/modeles-dao/modeles/DPAO-F.txt` et `.json` (décalque : `docs/modeles-dao/DPAO-F.docx`). Fidélité
237/237.

Trois **ajouts déclarés** dans la cellule du DPAO 6.3, chacun sous la fiche qu'il précise :
- après 2° (capacités techniques) : « Niveau exigé : {{B03-CQ-02}} » ;
- après 3° (capacité financière) : « Niveau exigé : {{B03-CQ-03}} » ;
- après 4° (marchés similaires) : « Pièces exigées : {{B03-CQ-04}} ».

Les trois champs sont déjà obligatoires : rien à changer côté référentiel. Ce sont les seuls ajouts de ce lot qui
s'écartent du texte ARMP. Ils sont listés dans les `ajouts` du modèle, comme les autres.

## B4 — Import (`LectureDao`)

Rien de neuf : les nouvelles unités (paragraphes à jeton, rédactions de l'article 6) se lisent avec les règles
existantes. La recopie des deux modèles suffit.

## B5 — Hors backend (pour mémoire)

Décision 2 : les 16 champs de la remise électronique (G4 de l'analyse) rejoignent la question déjà posée au juriste sur
la clause 7.3. Rien à faire côté backend tant qu'il n'a pas répondu.

## Ce que le backend rend

Commit(s) qui referment B1 à B3, script du référentiel pour DBPRS20, tests (le CCAP à commande avec et sans B09-OM-02,
l'article 3 sans coordonnées de la PRMP dans le bloc du Fournisseur, le DPAO 6.3 avec ses trois niveaux, un champ
retiré absent de la fiche des fournitures et présent ailleurs), et un encadré ⚠️ daté ici pour tout écart.
