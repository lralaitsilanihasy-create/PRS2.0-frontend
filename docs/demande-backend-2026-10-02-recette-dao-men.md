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

### B3.2 — Champs à créer (travaux)

| information | où | MEN | type proposé |
|---|---|---|---|
| **Bénéficiaire des chèques de banque** | DPAO-T 6.7 (garantie de soumission, « libéllé au nom de ….. ») ; CCAP-T 7.1 (« à l'ordre de <à préciser> ») | « Receveur Général d'Antananarivo », aussi pour l'avance (CCAP 14.1) | `TEXTE`, un seul champ pour toutes les garanties |
| Plafond des pénalités de retard | CCAP-T 23 : « …dans la limite de <pourcentage> du montant global… » | renvoi au CCAG 20.6 | `POURCENTAGE` |
| Délai de remise du projet de décompte mensuel | CCAP-T 16 : « au plus tard < nombre de jours> jours ouvrables… » | — | `NOMBRE` |
| Plafond des travaux en régie | CCAP-T 12.2 : « …atteint <pourcentage> du montant du Marché » | non applicable | `POURCENTAGE` |
| Indices d'actualisation des prix fermes | CCAP-T 11.4 : « <indiquer la nature des indices…> », imprimé dès que les prix sont fermes | prix « fermes et non révisables », **sans** actualisation | `TEXTE_LONG` **facultatif**. Le front mettra le paragraphe d'actualisation sous condition `renseigne` (comme `B05-VP-03` en fournitures) |
| Découpage du forfait par corps d'état | CCAP-T 16 : quatre lignes « -…………% », puis « Réception provisoire 5 % » | dix postes (installation, terrassement… assainissement), pourcentages en blanc, plus une retenue de 3 % | `TEXTE_LONG` (liste des postes) |

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
