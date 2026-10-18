# Demande backend — 2026-10-18 — La grille d'examen du contrat-cadre cite des informations que sa fiche ne porte pas

## Contexte

Depuis le 18/10, l'examen d'un dossier DAO relie chaque point de la grille aux informations de la fiche qu'il cite. Les codes écrits
dans le texte du point (« B05-GS-03 », « B12 ») deviennent des boutons. Un clic amène la fiche sur l'information et la surligne, et
la bulle « Observer » propose d'abord les points qui citent l'information cliquée.

Le front a vérifié la grille servie pour le dossier 00001/DAOO-CC/CNM/2026, celui des consomptibles informatiques
(ligne 303339), par `GET /api/points-ctrls?sousType=DAOO-CC`. Elle compte 33 points, tous de portée `DOSSIER`, hérités de `DAOO` par
`GRILLE_BASE` (V131).

**Le constat :** leurs textes citent **52 codes**. **43 ne figurent pas dans la fiche de ce contrat-cadre.** Ils existent bien au
référentiel `/api/champs-fiche-marche`, mais pour `typesMarche = [QUANTITE_FIXE, A_COMMANDE]` seulement. Exemples :

| Code cité | Libellé au référentiel | Formes du marché |
|---|---|---|
| `B02-OB-03` | Numéro du dossier d'appel d'offres | quantités fixes, à commandes |
| `B02-AU-02` | Attribution des lots | quantités fixes, à commandes |
| `B05-TP-02` | Montant minimum annuel du marché | à commandes |
| `B05-GS-03` | Montant de la garantie de soumission | quantités fixes, à commandes |
| `B04-LR-03` | Date limite de remise des offres | quantités fixes, à commandes |
| `B04-OP-02` | Date de l'ouverture des plis | quantités fixes, à commandes |
| `B06-EO-01` | Évaluation des offres portant sur plusieurs lots | quantités fixes, à commandes |
| `B08-AC-01` | Acomptes prévus | quantités fixes, à commandes |
| `B09-PR-02` | Plafond des pénalités de retard | quantités fixes, à commandes |

Le contrat-cadre porte ces notions sous ses propres codes. Son numéro d'appel d'offres, par exemple, est l'information
« Numéro de l'appel d'offres, de la consultation ou du contrat-cadre » de la rubrique « Objet et étendue du contrat-cadre ».

**La liste complète, par point :**

| Point | Codes cités absents de la fiche du contrat-cadre |
|---|---|
| Conformité au plan de passation | `B01`, `B02-OB-03` |
| Allotissement | `B02-AU-02`, `B02-AU-07` |
| Montants et estimation | `B05-TP-02`, `B05-TP-03` |
| Garantie de soumission | `B05-GS-02`, `B05-GS-03`, `B05-GS-04` |
| Délais de la consultation | `B04-DE-02`, `B04-DE-03`, `B04-LR-03`, `B04-LR-04`, `B04-OP-02`, `B04-OP-03` |
| Candidats : pièces et capacités | `B03-CQ-01`, `B03-CQ-02`, `B03-CQ-03`, `B04-CO-01`, `B04-CD-01` |
| Évaluation et attribution | `B03-CQ-08`, `B06-EO-01`, `B06-EO-02`, `B06-EO-05`, `B06-EO-07`, `B06-EO-09` |
| Paiements, avance et garanties financières | `B08-AC-01`, `B08-IM-01`, `B08-PA-08` |
| Pénalités, garantie et dérogations | `B09-PR-02`, `B09-PR-03`, `B09-DG-01`, `B09-DG-02`, `B10-DD-01` |
| Exécution et livraison | `B06-EO-12`, `B09-LL-01`, `B09-DX-03`, `B09-RT-01`, `B09-IV-01`, `B09-DI-01` |
| Cohérence des mentions du dossier | `B04-RO-02`, `B02-OB-02` |

`B01` est à part : le bloc « Identification & données du PPM » est repris du plan, et la fiche ne l'affiche pas à l'examen.

**L'effet aujourd'hui :** le front n'affiche que les références présentes dans la fiche et dit pour les autres « n sans objet
pour cette fiche ». Mais pour le Membre, un point comme « Délais de la consultation » ne mène plus à aucune date : ses six codes sont
absents. Le contrôle reste possible en lisant la fiche, mais le lien fiche–grille, fait pour lui, est perdu sur un contrat-cadre.

## B1 — Les points du contrat-cadre citent les informations du contrat-cadre

Pour chaque point hérité de `DAOO` que `DAOO-CC` garde, la description, ou une variante propre à la forme, cite les **codes du
contrat-cadre** à la place de ceux des formes à quantités fixes ou à commandes. Le choix de la solution revient au backend :
- **une description par forme**, par exemple une colonne `DESCRIPTION_CC` lue quand la fiche est un contrat-cadre ;
- **des points propres à `DAOO-CC`** pour ceux dont le texte change ;
- ou **une table de correspondance** entre codes « quantités fixes / à commandes » et codes « contrat-cadre », appliquée au
  service des points.

Un point sans équivalent pour un contrat-cadre (par exemple l'attribution lot par lot, sans objet pour un lot unique) n'a pas à
être servi pour cette forme, s'il ne l'est pas déjà.

> ⚠️ **2026-10-18, livré (backend, V133)** — des **variantes contrat-cadre en points propres**, sans colonne ni table de
> correspondance (les notions ne se correspondent pas une à une).
> - Les 11 points de `DAOO` dont le texte change ont chacun une variante de forme `CONTRAT_CADRE`, avec le même libellé, l'ordre,
>   la portée et le caractère obligatoire de l'original. Elle cite les codes du contrat-cadre : `B02-OE-01`, `B02-AL-02/03`,
>   `B05-MT-01..03`, `B04-CP-01..03`, `B04-RC-02`, `B04-PO-01/02`, `B06-SC-02`, `B06-CA-01`, `B06-SO-05`, `B05-PM-02`,
>   `B07-MA-*`, `B08-FI-02`, `B08-FP-*`, `B07-PE-*`, `B09-GP-*`, `B07-DE-*`, `B07-PS-*`, `B09-EA-01`, `B09-VA-01`, `B04-RQ-02`…
>   Quand le code des travaux diffère, il est donné entre parenthèses (« travaux : B05-GQ-03 »).
> - L'original passe en forme `AUTRE`. « Spécifications techniques » (`B12` seul, présent pour toutes les formes) reste commun.
> - **La requête du front ne change pas** : `DAOO-CC` impose la forme, et `GET /api/points-ctrls?sousType=DAOO-CC` ne sert plus les
>   points `AUTRE`. Pour le 100380, la grille garde 33 points, dont 11 remplacés par leur variante, et tous les codes cités
>   existent pour le contrat-cadre (vérifié en base : 0 absent sur 60 citations). `GET /api/dossiers/{id}/grille` donne le même résultat.
> - Aucun point n'a été retiré : chaque point gardé a un équivalent pour le contrat-cadre. Pour l'allotissement, la variante
>   porte sur les lots, le mono ou multi-attributaire et l'attribution des marchés subséquents par lot.

## B2 — Un contrôle à la publication des points

Un point (ou sa variante) ne cite que des codes qui existent au référentiel **pour les formes et catégories auxquelles il
s'applique**. Le contrôle se fait à l'enregistrement par l'Administrateur (400 nominatif), et une fois sur l'existant, avec un bilan.

> ⚠️ **2026-10-18, livré (backend)** — la règle précise :
> - Un code cité (champ `B05-GS-03`, rubrique `B08-AV`, bloc `B12`) doit exister, **actif**, pour **chaque forme** du point
>   (contrat-cadre, autres formes ; les deux pour un point sans forme). Il doit aussi exister dans **au moins une** de ses
>   catégories, car un point peut citer le code des fournitures et celui des travaux.
> - **À l'enregistrement** (`POST`, `PUT`) : 400 `CODES_ABSENTS`. Le message nomme chaque code, par exemple « B05-TP-02 retiré du
>   référentiel » ou « B02-OB-03 absent pour le contrat-cadre ». `details.ecarts` vaut `[{ code, motif, forme }]`.
> - **Le bilan** : `GET /api/points-ctrls/controle-codes`, avec `motif` = `INCONNU`, `INACTIF`, `HORS_CATEGORIE` ou `HORS_FORME`.
> - **Le bilan a trouvé 5 codes retirés du référentiel**, cités par les originaux sous toutes les formes : `B05-TP-02`,
>   `B06-EO-05`, `B08-AC-01`, `B08-PA-08`, `B09-DG-02`. V133 les ôte, ou les remplace (`B08-AC-01` → `B08-PA-05`, `B09-DG-02` →
>   `B09-DG-04`). Après V133, le bilan en recette est vide.
> - Le tableau du constat comptait `B05-GS-03` comme absent : il existe bien pour le contrat-cadre, sous la condition
>   « garantie exigée ».

## Questions

- **Q1 — `B01`.** Faut-il le citer ? Le bloc est repris du plan et se lit dans l'onglet « Plan de passation », pas dans la fiche.
  Le front propose de citer le plan dans le texte (« la ligne du plan ») plutôt qu'un code.
- **Q2 — Les autres catégories.** Le front n'a pu vérifier que la grille d'un contrat-cadre de fournitures : la recette n'a pas
  d'autre ligne éligible. Le même écart touche-t-il les travaux et les prestations intellectuelles (`DC`) ?

> ⚠️ **2026-10-18, réponses (backend)**
> - **Q1 — d'accord.** `B01` n'est plus cité, ni par l'original ni par la variante : le texte dit déjà « la ligne du plan
>   examinée ».
> - **Q2 — travaux : oui, et pas seulement en contrat-cadre.** La grille a été rédigée sur le DAO de fournitures. Sur une fiche
>   de travaux, 42 des 54 codes cités sont absents en quantités fixes ou à commandes, et 46 en contrat-cadre. Ce n'est pas traité
>   ici : il faudrait des variantes « travaux », jusqu'à 11 points de plus par forme. C'est un lot à part, sur avis du pilote. En
>   attendant, la règle « au moins une catégorie » ne bloque pas la modification de ces points, et le front continue de compter
>   les codes absents « sans objet pour cette fiche ».
> - **Q2 — prestations intellectuelles : non.** La grille `DC` ne cite aucun code, et le contrat-cadre n'existe pas en
>   prestations intellectuelles.

## Côté front

Déjà fait le 18/10 : les références absentes de la fiche ne sont plus proposées et sont comptées « sans objet pour cette fiche ».
Rien d'autre à changer après la livraison : les boutons suivront les codes servis.
