# Demande backend — La copie de mise à jour doit porter les justifications de la fiche

**Date** : 2026-09-08 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : parité création livrée
côté front (`a0fa796`) — l'écran de mise à jour du PPM exige désormais, comme la création, les
justifications de la **fiche de présentation** (marchés dérogatoires / à délai aménagé). Le pilote a
constaté que l'écran réclame ces justifs **même sur une version qui reprend le plan du parent tel quel**,
alors que le parent les avait déjà.

## Constat (dossier réel #100311, copie de #100308)

Le deep-copy qui crée le brouillon de mise à jour **ne recopie pas** `justifModeDerogatoire` /
`justifDelaiAmenage` des marchés. Les deux lignes dérogatoires perdent leur justification à la copie :

```
GET /api/marches   (mêmes 2 marchés « GRÉ À GRÉ », appariés par libellé)

Dossier 100308 (PARENT) :
  • idDetail=302079  justifModeDerogatoire="rectification1"  justifDelaiAmenage=null  (RNS 13)
  • idDetail=302080  justifModeDerogatoire="Rectification"   justifDelaiAmenage=null  (Ilempona)

Dossier 100311 (COPIE mise à jour) :
  • idDetail=302113  justifModeDerogatoire=null              justifDelaiAmenage=null  (RNS 13)
  • idDetail=302114  justifModeDerogatoire=null              justifDelaiAmenage=null  (Ilempona)
```

Cause probable : le deep-copy de `MiseAJourPpmService` (endpoint `POST /api/saisies/ppm/{id}/mise-a-jour`)
date du **2026-08-05**, **avant** la livraison des justifications de la fiche (**V13 / `831753b`**). Les
deux colonnes `JUSTIF_MODE_DEROGATOIRE` / `JUSTIF_DELAI_AMENAGE` de `t_marche` ont été ajoutées après et
n'ont jamais été intégrées à la routine de copie. Même chose vraisemblablement pour la **justification
globale** `t_ppm.JUSTIFICATION_FICHE` : à vérifier qu'elle est bien reprise du parent à la création du
brouillon (côté front, l'en-tête l'affiche à `null` puis on la resaisit — mais elle devrait être héritée).

## Impact

- Une mise à jour qui **reprend le plan à l'identique** (motif « Modification de montant » sans toucher aux
  lignes dérogatoires) affiche « Justifications à compléter » et **bloque « Créer la mise à jour »** —
  faux positif du point de vue métier (les justifs existaient au parent).
- Pire à l'**import** : une ligne appariée « reprend de l'existant » (règle documentée du réimport). Or
  l'existant de la copie est `null` → l'import garde `null` → la justif reste perdue même après réimport
  du PPM. Le seul moyen de repartir est de re-saisir manuellement chaque justif dans « Modifier le détail ».

## Demande

À la **création du brouillon de mise à jour** (`POST /api/saisies/ppm/{id}/mise-a-jour`), le deep-copy des
marchés doit **copier** `JUSTIF_MODE_DEROGATOIRE` et `JUSTIF_DELAI_AMENAGE` du marché source vers la copie
(au même titre que compte, statut, lots, bénéficiaires — tout ce que « un import ne doit rien effacer »
protège déjà). Idem pour `t_ppm.JUSTIFICATION_FICHE` : la reprendre du PPM parent sur le PPM de la
nouvelle version.

- Non-régression sur l'import : l'`editerPpm` d'une ligne appariée continue de « reprendre de l'existant »
  — mais l'existant portera désormais la justif héritée au lieu de `null`.
- Une ligne **NOUVELLE** (ajoutée à la mise à jour) n'a pas de source : justif `null` attendue, c'est à la
  PRMP de la saisir (le front la réclame déjà, cohérent avec la création).

## Côté front — déjà en place, aucun changement requis

Le garde-fou est **correct** et reste l'autorité d'UI : `justificationsManquantes()` liste chaque marché
dérogatoire/à délai aménagé sans justif + la justif globale manquante, et bloque « Créer la mise à jour »
(miroir du 400 serveur). Une fois la copie corrigée, l'avertissement **ne se déclenchera plus** sur les
lignes héritées ; il ne restera que pour les vraies nouvelles lignes ou une justif réellement absente.
La saisie manuelle de secours (justif globale dans l'en-tête, par ligne dans « Modifier le détail ») reste
disponible.

## Contre-recette attendue

1. Créer une mise à jour d'un dossier dont ≥1 marché est dérogatoire **avec** justif au parent.
2. `GET /api/marches` sur la copie : les lignes dérogatoires portent la **même** `justifModeDerogatoire`
   que le parent (et `t_ppm.JUSTIFICATION_FICHE` reprise).
3. Écran de mise à jour : **aucun** « Justifications à compléter » tant que le plan n'est pas modifié ;
   « Créer la mise à jour » n'est plus bloqué par ce motif.
4. Réimport du même PPM : les justifs restent portées (pas de retour à `null`).

## Donnée existante (#100311)

Le correctif est un **write au moment de la copie** : il ne rétro-corrige pas #100311 (déjà copié à
`null`). Pour un journal de test propre, rejouer une mise à jour fraîche après livraison, ou correction
ponctuelle SQL — à voir avec le pilote, hors périmètre du correctif.
