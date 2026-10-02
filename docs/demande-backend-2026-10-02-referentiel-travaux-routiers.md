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

## B2 — `B09-AC-03` (assurance décennale) : obligatoire seulement pour un bâtiment

- **Constat** : le champ est obligatoire pour tous les travaux, mais le CCAP-T ne l'imprime que sous `BATIMENT`
  (`B09-BT-01 = OUI`). Pour une route, la fiche exige une valeur qui ne s'imprime nulle part.
- **Demandé** :
  - `obligatoire = false` ;
  - une règle de bilan bloquante « `B09-AC-03` exigé quand `B09-BT-01 = OUI` », si vous jugez la garantie indispensable
    pour un bâtiment.

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

## B4 — `B08-MO-01` (taux des intérêts moratoires) : retiré des travaux

- **Constat** : aucun modèle de travaux ne l'imprime. Le CCAP-T écrit en texte fixe « taux directeur de la Banque
  Centrale de Madagascar … augmenté d'un point », et c'est ce que portent le MEN comme le MTP. Le type `POURCENTAGE`
  ne recevrait d'ailleurs pas cette formule.
- **Demandé** : retirer `TRAVAUX` de `categories` pour ce champ ; ou le passer en `TEXTE` s'il sert ailleurs.

**Recette attendue** : une fiche de travaux routiers (non bâtiment, maître d'œuvre non désigné) validable sans
`B02-MW-01` ni `B09-AC-03`, dont le CCAP imprime la rédaction `SANS-MOE`.
