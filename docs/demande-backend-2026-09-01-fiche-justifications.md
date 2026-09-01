# Demande au backend `PRS20` — 1ᵉʳ septembre 2026 — Justifications de la fiche de présentation

> Document destiné à la session backend. Émis depuis le front `frontendprs2`. **Règle arbitrée par
> le pilote le 01/09** — backend d'abord, le front suivra. Contexte : le front rend désormais la
> « Fiche de présentation » officielle du dossier de planification, DÉRIVÉE du plan (onglet du
> détail PPM `c7f9d60` + aperçu de création `b6fa3f2`) : ① marchés à mode **dérogatoire**
> (`tr_mode_passation.CATEGORIE`), ② marchés à **délais aménagés** (date prévisionnelle d'ouverture
> des plis − date de lancement, en jours calendaires, **strictement inférieure** à `delaiMinJours`
> du mode ; jamais sans les deux dates ni sans plancher ; égalité = conforme), ③ **contrats-cadres**
> (`formeMarche = CONTRAT_CADRE`). Les justifications y sont aujourd'hui « À compléter » : le
> pilote veut qu'elles soient **saisies à la création du dossier**.
>
> | | Question | Décision |
> |---|---|---|
> | 1 | Par marché | **Deux justifications distinctes** — une pour le mode dérogatoire (liste 1), une pour le délai aménagé (liste 2) : un marché peut cumuler |
> | 2 | « Justification : » du bas du formulaire | **Globale à la fiche**, portée par le plan |
> | 3 | Caractère bloquant | **Bloquantes DÈS LA CRÉATION** du dossier (garde serveur 400, miroir front) |
> | 4 | Saisie côté front | Section dédiée sous la grille de saisie (sans impact contrat) |

---

## 1. Modèle

- **Ligne de marché** (`t_marche` / DTO `Marche` / `SaisieMarcheLigne`) : deux champs texte
  nullables — `justifModeDerogatoire`, `justifDelaiAmenage` (nommage à votre main, le front suivra
  le DTO). Transportés par la façade de création (`POST /api/saisies`), la mise à jour/rectification
  (`PUT /api/saisies/ppm`) et le PUT unitaire du marché.
- **Plan** (`t_ppm` / DTO `Ppm`) : un champ texte nullable — `justificationFiche` (la
  « Justification : » du bas du formulaire). Transporté par les mêmes canaux.

## 2. Garde à la création (et à la mise à jour) — 400 avec messages par champ

À `POST /api/saisies` (et `PUT /api/saisies/ppm`), le serveur **re-classe les marchés lui-même**
depuis SES référentiels (catégorie et `delaiMinJours` du mode, `formeMarche`, dates CAPM appariées
par mot-clé LANCEMENT / OUVERTURE — mêmes règles que ci-dessus, ne pas faire confiance au client) et
refuse en 400 :

- un marché classé **dérogatoire** sans `justifModeDerogatoire` ;
- un marché classé **délai aménagé** sans `justifDelaiAmenage` ;
- `justificationFiche` absente alors qu'**au moins une des trois listes est non vide** (les
  contrats-cadres n'ont pas de justification par ligne : la globale les couvre).

Messages 400 par champ (fieldErrors) pour que le front pointe la ligne fautive. Blancs/espaces =
absent.

## 3. Lecture

`Marche` et `Ppm` exposent les trois champs en lecture — l'onglet « Fiche de présentation » du
détail PPM et l'aperçu de création afficheront les textes saisis à la place de « À compléter ».

## 4. Transition

Plans existants sans justifications : lecture `null` (le front affiche « À compléter ») ; la garde
ne s'applique qu'aux créations et mises à jour postérieures au déploiement — **aucune migration de
données**.

## 5. Ce que le front livrera ensuite

1. Écran de création : section « Fiche de présentation — justifications » sous la grille, visible
   dès qu'une liste se remplit (calcul live existant) — un champ par marché des listes 1 et 2, plus
   la justification globale ; création **bloquée** tant qu'il en manque (panneau « justifications
   manquantes », même patron que les pièces obligatoires) ; miroir de votre 400 par champ.
2. Aperçu de création + onglet du détail : les textes saisis remplacent « À compléter » ; édition
   dans le modal de détail tant que le plan est modifiable.

Comme toujours : PLAN d'abord pour validation, tests (les trois gardes, cumul des deux
justifications sur un même marché, listes vides = rien d'exigé, blancs = absents, mise à jour),
docs (`api-endpoints`, `regles-gestion`), **commit + push complet, fichiers neufs compris**.
