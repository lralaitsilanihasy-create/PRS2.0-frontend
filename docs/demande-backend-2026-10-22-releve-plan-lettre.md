# Demande backend — 2026-10-22 — Modèles de PV : remplacer maintenant le PV du plan et la lettre de renvoi (relève D2 et L2)

## Contexte

Le pilote demande de **remplacer maintenant** les deux modèles intégrés par les modèles rédigés dans l'application.

État en recette, le 22/10 :

| Modèle de l'application | Version en vigueur | Sous-types | Modèle intégré qu'il doit remplacer |
|---|---|---|---|
| `PV-PLAN` (id 2) | v1, page, en vigueur le 22/10 à 07:06 | `PPM`, `PPM-AGPM` | `PV-PLAN-INTEGRE` (12 fichiers Word) |
| `LETTRE-RENVOI` (id 29) | v1, page, en vigueur le 22/10 à 07:08 | les 26 sous-types | `LETTRE-RENVOI-INTEGREE` (2 fichiers Word) |

Malgré ces mises en vigueur, rien n'a changé à la production :
- `/couverture` sert toujours `produitPar: INTEGRE` pour ces 28 lignes ;
- `/integres` sert toujours `enService: true` pour les deux intégrés ;
- `PvDocumentService` et `LettreRenvoiService.genererEtStockerDocument` lisent toujours les fichiers Word.

Les demandes précédentes avaient lié la relève à une comparaison des rendus sur des dossiers réels (`modele-pv-plan-depart` §B2,
`modele-lettre-renvoi` §B3). **Le pilote a tranché le 22/10 : la relève se fait maintenant.** La comparaison a été faite pour le plan ;
pour la lettre, elle n'a pas pu l'être (voir R2).

## R1 — Relève du PV du plan (D2)

Pour un dossier `PPM` ou `PPM-AGPM` :
- le PV est produit par **la version en vigueur du modèle de l'application** rattaché au sous-type (rendu PDF de P2), et non plus par
  les fichiers intégrés ;
- les valeurs sont celles que l'aperçu sert déjà (`ContexteModelePvService`) : variables, règles (avis, AGPM, portée, présents, visa),
  liste `OBSERVATIONS` de l'annexe ;
- l'avis `NSP` garde le refus actuel (409 `AUCUN_DOCUMENT`), comme proposé par le backend (Q2 de `modele-pv-plan-depart`).

**Comparaison faite par le front (22/10)**, sur le dossier 100379 (`PPM-AGPM`, commission centrale), avis FAV, FAVR et DEF : le texte
est le même ; la page v1 a été corrigée pour reprendre la mise en forme de l'intégré (gras, souligné, italique, ligne « Visé par :
NOM, qualité — par intérim »). Deux écarts restent, sans effet sur le contenu : le trait vert sous le numéro de page, et une coupure de
ligne dans l'intitulé. Les PDF sont dans `frontendprs2/PDF_generes/PV-PLAN-{page-v1|integre}-dossier-100379-{FAV|FAVR|DEF}.pdf`.

Non comparés faute de dossier : la commission régionale, un plan sans AGPM, un plan modificatif, un PV avec observations.

> ⚠️ **2026-10-22, livré (backend).**
> - Le PV d'un dossier `PPM` / `PPM-AGPM` est produit par la page en vigueur rattachée, avec le contexte **du PV signé** (pas du
>   dernier PV du dossier, comme l'aperçu). Les règles d'éligibilité restent celles de l'intégré : `NSP`, plan sans ligne et
>   localité inconnue restent sans document.
> - **Pas de repli silencieux** : si la page ne se rend pas, l'erreur est journalisée et le téléchargement retente, comme pour le
>   Word. Un repli masquerait un modèle défectueux.
> - **Hors périmètre** : un modèle en vigueur rattaché à une autre famille (DMC, DDM, DGC, DSS) ne produit toujours rien. Ces PV n'ont
>   pas de document aujourd'hui ; leur production serait une demande à part.

## R2 — Relève de la lettre de renvoi (L2)

Pour une lettre de renvoi de n'importe quel sous-type rattaché à `LETTRE-RENVOI` :
- `genererEtStockerDocument` et `apercu` produisent la lettre par la version en vigueur de ce modèle ;
- les variables `LETTRE.*` sont celles de L1.

**Pas de comparaison possible côté front** : la base de recette ne contient **aucune lettre de renvoi** (`GET /api/lettre-renvois` →
0). Le front demande au backend de comparer les deux rendus sur une lettre de test (centrale et régionale) avant de livrer, ou de dire
s'il faut créer un dossier renvoyé en recette.

> ⚠️ **2026-10-22, livré (backend), après comparaison par le backend** (Q3).
> - Une lettre de test (base de test, signée, corps de trois lignes) a été rendue par le Word intégré et par la page de départ, en
>   centrale (`ANT`) et en régionale (`TMS`) : **une page chacune, mêmes textes et mêmes positions**.
> - Écarts relevés, sans effet sur le contenu :
>   - l'en-tête (l'emblème des PV, sans les deux lignes répétées du Word : déjà signalé en L1) ;
>   - le corps commence à la ligne après « demandant au service de : » ; le Word colle la première ligne au deux-points ;
>   - « Réf : » : le Word met la référence en gras, la page ne met en gras que « Réf ». À corriger dans la page si la CNM y tient.
> - Pas besoin de créer un dossier renvoyé en recette : la contre-recette se fera sur la première lettre signée.

## R3 — Ce que la relève change dans les données servies

- `/couverture` : les sous-types relevés passent à `produitPar: GERE`.
- `/integres` : `enService: false` sur chaque intégré dont plus aucun sous-type n'est servi par ses fichiers. Les fichiers restent
  consultables (`/integres/{code}/fichiers/{nom}`, `/apercu`), pour mémoire et pour comparer.
- **Les documents déjà produits ne changent pas** : un PV signé ou une lettre déjà stockée garde son fichier.
- **Retour en arrière** : si le modèle de l'application est archivé ou détaché d'un sous-type, ce sous-type revient-il aux fichiers
  intégrés, ou reste-t-il sans document ? Le front propose le **retour aux fichiers intégrés**, pour qu'aucun PV ne soit signé sans
  document. Voir Q1.
- **Trace** : une entrée au journal général (`/admin/audit`) à la relève, et à un éventuel retour en arrière.

> ⚠️ **2026-10-22, livré (backend), avec une limite**
> - `/couverture` : `GERE` pour un sous-type relevé ; `/integres` : `enService: false` quand plus aucun sous-type n'est
>   produit par les fichiers. Les fichiers et l'aperçu de l'intégré restent servis.
> - **Journal général** : `RELEVE_MODELE_INTEGRE` / `RETOUR_MODELE_INTEGRE`, une entrée par sous-type, à la mise en vigueur, aux
>   rattachements et à l'archivage (table `modeles-pv`, champ = sous-type).
> - **Limite** : les deux mises en vigueur faites en recette le 22/10 (07:06 et 07:08) précèdent la livraison. La relève prend
>   effet au redémarrage, **sans entrée au journal** pour elles.

## Questions

- **Q1 — Retour en arrière.** Retour aux fichiers intégrés si le modèle relevé est archivé ou détaché (proposé), ou sous-type sans
  document ?
- **Q2 — La relève est-elle automatique ?** Le front propose qu'elle découle de la mise en vigueur, sans autre geste : c'est ce que le
  pilote vient de faire. Faut-il plutôt un geste explicite « Remplacer le modèle intégré » sur la fiche ? Si oui, le front l'ajoute.
- **Q3 — La lettre sans comparaison.** Livrer R2 maintenant, ou attendre qu'une lettre de test ait été comparée (R2) ?

> ⚠️ **2026-10-22, réponses (backend)**
> - **Q1 — Retour aux fichiers intégrés**, de lui-même : la règle est lue à chaque production. Archivé, détaché ou sans version en
>   vigueur, le sous-type revient à l'intégré.
> - **Q2 — Automatique** : la mise en vigueur et le rattachement suffisent. Pas de geste « Remplacer le modèle intégré ».
> - **Q3 — Livré maintenant**, après la comparaison du backend (encadré de R2).

## Côté front

- **Déjà fait (22/10)** : la liste « Modèles de procès-verbaux » sort de la liste un modèle intégré dont `enService` est `false`, et le
  range sous « Modèles intégrés remplacés », en consultation. La mention « Remplacera le modèle intégré » disparaît d'elle-même quand
  la couverture passe à `GERE`, et la ligne des lettres de renvoi compte alors « par un modèle de l'application ».
- **À la livraison** : contre-recette sur le dossier 100379 (PV du plan produit par la page) et, dès qu'une lettre existe, sur une
  lettre de renvoi.
