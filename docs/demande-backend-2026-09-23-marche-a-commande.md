# Demande backend — Outiller le marché à commande (lot 3)

**Date** : 2026-09-23 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : demande du pilote, « prépare le lot
pour le contrat cadre et à commande ». Suite du lot 1 (`-22-fiche-marche-dao.md`), du lot 1c
(`-23-type-marche-depuis-le-plan.md`, qui a gelé les formes non outillées) et du lot 2a
(`-23-documents-fiche-marche.md`, qui produit les documents).

> **Ce lot est court, parce que la matière est déjà là.** Le référentiel porte **146 champs actifs** pour le marché
> à commande, dont **8 qui lui sont propres**, tous semés et servis. Il ne manque que d'**ouvrir le type**. Le
> contrat-cadre, lui, fait l'objet d'une demande séparée : sa matière n'existe pas encore
> (`-23-contrat-cadre.md`).

## Constat (mesuré sur la base locale le 23/09)

`GET /api/champs-fiche-marche` sert 151 champs et 10 blocs. Par type de marché :

| type | champs applicables | dont actifs | dont propres au type |
|---|---|---|---|
| `QUANTITE_FIXE` | 143 | **139** | 0 |
| `A_COMMANDE` | 151 | **146** | **8** |
| `CONTRAT_CADRE` | 35 | 35 | **0** |

Les huit informations propres au marché à commande sont déjà chargées, avec leur document maître :

| code | document | libellé | état |
|---|---|---|---|
| `B02-AU-03` | DPAO | Quantités minimum et maximum | actif |
| `B02-AU-04` | DPAO | Durée de validité du marché à commande (mois) | actif |
| `B02-AU-05` | AE | Date d'effet du marché à commande | actif |
| `B02-AU-06` | aucun | Rythme de commande (bons de commande) | **inactif** (décision 4 de l'esquisse) |
| `B05-TP-02` | AE | Montant minimum annuel du marché (Ariary) | actif |
| `B05-TP-03` | AE | Montant maximum annuel du marché (Ariary) | actif |
| `B06-EO-12` | DPAO | Délai maximum de livraison (jours) | actif |
| `B09-OM-03` | CCAP | Délai de validité du marché (mois) | actif |

Autrement dit : **la fiche d'un marché à commande se dessinerait déjà toute seule** si le serveur acceptait d'y
écrire. Aujourd'hui, le lot 1c la gèle — `POST /api/dmcs/par-marche/{idDetail}`, `PUT …/cadrage`, `PUT …/blocs/{bloc}`,
`POST …/valider` et `POST …/reviser` répondent **409 `FORME_NON_OUTILLEE`** dès que `FORME_MARCHE` vaut
`A_COMMANDE`.

Le cadrage n'a **rien à changer** : les neuf questions communes s'appliquent telles quelles, et la question
« mono ou multi-attributaire » reste réservée au contrat-cadre.

## Demande

### B1 — Ouvrir le type `A_COMMANDE`

La liste des formes outillées passe de `{QUANTITE_FIXE}` à `{QUANTITE_FIXE, A_COMMANDE}`. Conséquences, toutes déjà
écrites au lot 1c et qui se déduisent de la liste :

- `GET /api/dmcs/eligibles` sert `formeOutillee = true` sur les lignes à commande ;
- la création du DMC et les quatre écritures de la fiche cessent de répondre 409 pour ce type ;
- `blocsASaisir` reste inchangé : **B07 demeure réservé au contrat-cadre** ;
- la génération du lot 2a produit DPAO, CCAP et AE, avec les huit informations supplémentaires — aucune règle de
  sélection à écrire, elle suit déjà `typesMarche`.

### B2 — La liste des formes outillées devient une **donnée servie**, plus une constante du front

Aujourd'hui le front porte sa propre liste en dur (`TYPES_OUTILLES` dans `fiche-marche-modele.ts`) et le serveur
porte la sienne. Deux listes pour une seule vérité : ouvrir un type demande une livraison de chaque côté, et un
oubli d'un côté donne soit un écran qui propose ce que le serveur refuse, soit l'inverse.

**`FicheMarcheDto` porte `typeOutille: boolean`** — la même réponse que le serveur donne déjà, pour la fiche lue.
Le front supprime alors sa liste : ouvrir un type devient une livraison **backend seule**.

`LigneEligible.formeOutillee` existe déjà et joue ce rôle sur la liste des lignes : c'est exactement le même besoin
sur la fiche.

> ⚠️ **Livraison backend du 2026-09-23 — B1 et B2 livrés tels que demandés**, avec le lot 4 dans la même livraison :
> `DmcService.FORMES_OUTILLEES` contient désormais les **trois** formes, et `FicheMarcheDto.typeOutille` en est la
> réponse (`false` seulement pour une ligne sans forme au plan). Recette (`FicheMarcheCommandeEtContratCadreIntegrationTest`,
> sur le CSV des fournitures chargé par l'import) : ligne à commande éligible et outillée, DMC 201, cadrage des neuf
> questions 200, **146 champs actifs** servis pour `A_COMMANDE` (139 en quantité fixe), B07 absent de ses blocs,
> validation → DPAO, CCAP, AE, le DPAO porte « Quantités minimum et maximum », l'AE les montants annuels. Précision
> sur le test 4 : « 146 » est le compte des champs **servis** par le référentiel ; `bilanControles.nbAttendus` de la
> fiche ne compte que les champs **de saisie** des rubriques ouvertes par le cadrage, il est donc plus petit.
> **B3** (rythme de commande) : rien fait, le champ reste inactif comme recommandé.

### B3 — Le rythme de commande (`B02-AU-06`)

Il est chargé **inactif**, sans document maître : c'est la décision 4 de l'esquisse, restée en suspens. Deux issues,
au choix du pilote :

1. **Le laisser inactif** : le rythme se lit dans le marché, il n'a pas à figurer au DAO. C'est la recommandation du
   front — le champ n'a pas de document maître, donc nulle part où sortir.
2. **L'activer** avec `documentMaitre = CCAP` : le rythme devient une clause du cahier des charges.

Rien à faire côté serveur tant que le pilote n'a pas tranché : un champ inactif est simplement ignoré.

## Tests attendus (recette backend)

1. Ligne de plan à `FORME_MARCHE = A_COMMANDE` → `formeOutillee = true` dans `GET /api/dmcs/eligibles`.
2. `POST /api/dmcs/par-marche/{idDetail}` sur une telle ligne → 201, plus de 409.
3. `PUT …/cadrage` avec les neuf réponses → 200 ; la question « attributaires » n'est **pas** attendue.
4. La fiche ouvre **146 informations** attendues (contre 139 en quantité fixe), dont les 7 champs actifs propres.
5. `POST …/valider` → DPAO, CCAP et AE produits ; le DPAO contient « Quantités minimum et maximum », l'AE contient
   les montants minimum et maximum annuels.
6. `B07` n'apparaît **pas** dans les blocs à saisir d'un marché à commande.
7. `FicheMarcheDto.typeOutille` vaut `true` pour `A_COMMANDE` et `QUANTITE_FIXE`, `false` pour `CONTRAT_CADRE`.

## Côté front (à la livraison)

- `TYPES_OUTILLES` disparaît au profit de `FicheMarche.typeOutille` (B2) : l'écran cesse de décider ce que le
  serveur seul sait.
- La page courte des formes non outillées (livrée le 23/09) ne s'affichera plus que pour le contrat-cadre, sans
  aucun changement de code.
- Les huit informations propres se dessinent d'elles-mêmes : elles viennent du référentiel, comme les 139 autres.

## Ce que ce lot ne fait pas

L'**assemblage** du DAO avec les parties standard du dossier type (avis d'appel d'offres, instructions aux
candidats, CCAG, spécifications, bordereau, formulaires) reste hors périmètre, comme au lot 2a. Le marché à
commande n'y change rien.
