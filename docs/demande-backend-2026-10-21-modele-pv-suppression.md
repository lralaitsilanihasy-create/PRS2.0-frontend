# Demande backend — 2026-10-21 — Modèles de PV : supprimer un brouillon, supprimer un modèle qui n'a jamais servi

## Contexte

Le pilote demande s'il peut **supprimer une version** d'un modèle de PV. Aujourd'hui, ni une version ni un modèle ne se suppriment :
- ni `DELETE /api/modeles-pv/{id}/versions/{n}` ;
- ni `DELETE /api/modeles-pv/{id}`.

Une version ou un modèle inutile reste à vie dans la fiche et dans la liste.

Deux cas réels en recette, le 21/10 :
- **`PV-MISE-EN-CONCURRENCE`** a deux brouillons qui ne serviront jamais :
  - la v1, un départ Word de ce matin, devenu inutilisable (`SUPPORT_ABANDONNE`) ;
  - la v2, une page vierge laissée en essai.
- **18 modèles d'essai archivés** ont été laissés par les recettes du front des 20 et 21/10. Leurs codes commencent tous par `ESSAI-` :
  `ESSAI-ECRAN`, `ESSAI-PV-MEC`, `ESSAI-FORMULAIRE`, `ESSAI-DEPART`, `ESSAI-DEPART-VIDE`, `ESSAI-PAGE`, `ESSAI-EDITEUR` à
  `ESSAI-EDITEUR-8`, `ESSAI-VIERGE`, `ESSAI-VIERGE-2`, `ESSAI-VIERGE-*`, `ESSAI-OUTILS-*`.

  Ils encombrent la liste (« Modèles archivés (18) »).

**La règle proposée est prudente.** On ne supprime que ce **dont aucun PV n'a jamais pu dépendre** : un brouillon, ou un modèle qui n'a
jamais eu de version en vigueur. Tout ce qui a été en vigueur reste, pour la traçabilité.

## B1 — Supprimer une version en brouillon

`DELETE /api/modeles-pv/{id}/versions/{n}`, réservée à l'Administrateur.

- **Permis** sur une version `BROUILLON`, page ou Word.
  - Un brouillon n'a jamais été en vigueur : `REMPLACEE` ne vient qu'après `EN_VIGUEUR`.
  - Aucun PV n'a donc pu être produit avec lui, ni en G2, ni en aperçu (l'aperçu n'enregistre rien).
- **Refusé** en 409 `VERSION_NON_SUPPRIMABLE` sur une version `EN_VIGUEUR` ou `REMPLACEE`, avec un message en clair : « une version
  qui a été en vigueur ne se supprime pas ».
- **Supprimés avec elle** : son document ou son fichier, son rapport, ses conditions et ses champs.
- **Les images de la bibliothèque restent** : une autre version peut les utiliser.
- **Les numéros ne sont pas réutilisés** : supprimer la v2 puis enregistrer donne une v3. L'historique continue ainsi de désigner
  chaque version sans ambiguïté.
- **Journal du modèle** : une action `VERSION_SUPPRIMEE`, avec le numéro et le support.
- 409 `MODELE_ARCHIVE` sur un modèle archivé, comme les autres écritures.

> ⚠️ **2026-10-21, livré (backend) tel que demandé.**
> - La route rend la **fiche du modèle**, sans la version supprimée. Une version inexistante répond 404.
> - Le journal porte `VERSION_SUPPRIMEE` avec le détail « version 2, page » (ou « Word »).

## B2 — Supprimer un modèle qui n'a jamais servi

`DELETE /api/modeles-pv/{id}`, réservée à l'Administrateur.

- **Permis** si le modèle :
  - **n'a jamais eu de version en vigueur** : aucune version `EN_VIGUEUR` ni `REMPLACEE`, et aucune trace de mise en vigueur ;
  - **ne sert aucun sous-type** : il est archivé (l'archivage le détache), ou on l'a détaché avant.
- **Refusé** en 409 `MODELE_NON_SUPPRIMABLE`, avec la raison : « a été en vigueur » ou « sert encore des sous-types : détachez-les ou
  archivez le modèle ».
- **Supprimés avec lui** : ses versions, conditions, champs, rattachements et son journal.
- **La trace reste ailleurs** : comme le journal du modèle disparaît avec lui, la suppression s'inscrit au journal général de
  l'application (code, libellé, auteur, date). Voir Q2.

> ⚠️ **2026-10-21, livré (backend) — la route rend 204.**
> - `MODELE_NON_SUPPRIMABLE` porte `details.raison` : `A_ETE_EN_VIGUEUR` ou `SERT_DES_SOUS_TYPES`. Dans le second cas,
>   `details.sousTypes` donne la liste.
> - « Jamais en vigueur » se lit sur les versions (`EN_VIGUEUR`, `REMPLACEE`) **et** sur le journal (`MISE_EN_VIGUEUR`).
> - Un modèle **actif**, jamais en vigueur et sans sous-type se supprime aussi : l'archivage n'est pas exigé.
> - **La trace** se lit dans `/admin/audit` : table `modeles-pv`, action `MODELE_SUPPRIME`. L'entrée porte le code (champ
>   modifié) et, en valeur, le code, le libellé, la nature, l'état, le motif d'archivage, le nombre de versions et l'auteur.
> - L'intercepteur écrit aussi sa ligne ordinaire (`DELETE`, avec l'id).

## B3 — Le nettoyage de la recette

À la livraison, le front supprimera par B2 les 18 modèles d'essai `ESSAI-*`, tous archivés et jamais en vigueur. Il supprimera aussi,
avec l'accord du pilote, les brouillons v1 et v2 de `PV-MISE-EN-CONCURRENCE`.

## Questions

- **Q1 — Les numéros.** Ne pas réutiliser le numéro d'une version supprimée (proposé) ? Ou repartir du plus grand numéro restant ?
- **Q2 — La trace.** Le journal général (`/admin/audit`) suffit-il pour garder la trace d'un modèle supprimé ? Faut-il plutôt un
  champ « supprimé le / par » et garder la ligne masquée (suppression logique) ?
- **Q3 — Le plan.** Pour la reprise des modèles du plan (G4), faut-il interdire de supprimer un modèle tant qu'il « reprend » des
  fichiers intégrés ? Le front propose que non : tant qu'il n'est pas en vigueur, il ne produit rien.

> ⚠️ **2026-10-21, réponses (backend)**
> - **Q1 — Les numéros ne sont jamais réutilisés.** Le numéro suivant est le plus grand numéro des versions **et du journal**, plus
>   un : le journal cite encore la version supprimée. Supprimer la v2 puis enregistrer donne une v3. Sans cela, supprimer la
>   dernière version aurait repris son numéro.
> - **Q2 — Le journal général suffit.** Pas de suppression logique.
> - **Q3 — Non**, comme le propose le front : un modèle qui n'a jamais été en vigueur ne produit rien.
> - **En recette (21/10)** : les 18 `ESSAI-*` sont bien archivés, sans rattachement ni mise en vigueur ; `PV-MISE-EN-CONCURRENCE` a
>   ses v1 (Word) et v2 (page) en brouillon. Le backend n'a rien supprimé : le nettoyage reste au front (B3). Pour
>   `PV-MISE-EN-CONCURRENCE`, la v3 suivra la suppression des deux brouillons.

## Côté front

À la livraison :
- **Sur la fiche**, une ligne de version en brouillon porte « Supprimer », avec une confirmation qui nomme la version.
  - Si c'était la version ouverte, la fiche se rouvre sur la plus récente.
  - Une version qui a été en vigueur n'a pas ce bouton.
- **Sur la fiche d'un modèle archivé** qui n'a jamais été en vigueur : « Supprimer définitivement », avec une confirmation.
- **Dans la liste**, les modèles archivés supprimables le disent. Le nettoyage de la recette (B3) se fait par script, avec l'accord du
  pilote.
