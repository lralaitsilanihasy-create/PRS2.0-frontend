# Demande backend — 2026-10-27 — Un seul compteur de dossiers, tous types confondus

## Contexte

La référence d'un dossier, attribuée à la réception (`ReferenceService.generer`), a la forme
`xxxxx/sous-type/localité/exercice`. Le numéro `xxxxx` vient d'un compteur **par famille et par exercice** : la clé du compteur
est la famille (`DDP`, `DMC`, `DDM`…), sa portée est nationale (clé localité fixe `DOSSIER`), et il repart à 1 chaque année.

Résultat en recette, sur l'exercice 2026 :

| Dossier | Famille | Référence |
|---|---|---|
| Plan de passation | DDP | `00001/PPM-AGPM/CNM/2026` |
| DAO des consomptibles | DMC | `00001/DAOO-CC/CNM/2026` |
| DAO des articles de bureau | DMC | `00002/DAOO-CC/CNM/2026` |
| DAO des produits d'entretien | DMC | `00003/DAOO-CC/CNM/2026` |
| DAO de l'entretien des véhicules | DMC | `00004/DAOO-CC/CNM/2026` |
| Marché des produits d'entretien | DDM | `00001/MAOO-CC/CNM/2026` |
| Marché de l'entretien des véhicules (soumis, pas encore reçu) | DDM | — |

Le numéro 00001 sert donc trois fois la même année.

**Le pilote demande (27/10)** que le numéro **s'incrémente sans distinction de type de dossier** : un seul compteur pour tous les
dossiers de l'exercice. Le segment du sous-type reste dans la référence ; seul le numéro change de règle.

## N1 — Un compteur unique par exercice

- La clé du compteur des dossiers ne dépend plus de la famille : **un compteur par exercice**, pour tous les dossiers **reçus**
  (plans, dossiers de mise en concurrence, dossiers de marché, et toute autre famille), toujours national.
- Il repart à 1 chaque année, comme aujourd'hui.
- Le **compteur des lettres de renvoi** (`LETTRE`) ne change pas.

## N2 — Le passage à la nouvelle règle

- **Les références déjà attribuées ne changent pas.** Elles sont imprimées sur des PV signés et sur les accusés de réception.
- Pour l'exercice en cours, le compteur unique **reprend après le plus grand numéro déjà attribué**, toutes familles confondues : en
  recette 2026, le prochain dossier reçu porte **00005**, quel que soit son type.
- Migration de données : le backend décide de sa forme (une ligne de compteur par exercice, initialisée au maximum par exercice).

## Arbitrages du pilote (27/10)

- **Par exercice** : l'incrémentation vaut pour une année d'exercice ; le compteur repart à 1 l'année suivante.
- **Le PV garde le numéro de son dossier** (`00004/DAOO-CC/CNM/PV/2026`) : la règle ne change pas, le PV suit le dossier.
- **Un compteur national**, commissions régionales (`CRM-…`) comprises : un seul compteur par exercice, toutes localités confondues,
  comme aujourd'hui.
- **Seuls les dossiers reçus sont numérotés** : le numéro s'attribue à la réception, jamais à la création ni à la soumission. Un
  brouillon ou un dossier soumis n'en a pas. Un dossier retourné avant réception n'en consomme pas. Ainsi, le dossier de marché 100387,
  soumis et pas encore reçu, prendra à sa réception le numéro suivant (00005 en recette).

## Côté front

Rien à changer : le front affiche la référence servie. Les tests qui supposent un numéro par famille, s'il y en a, seront adaptés.
