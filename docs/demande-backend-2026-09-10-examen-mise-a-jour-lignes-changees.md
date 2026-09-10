# Demande backend — Examen d'une MISE À JOUR : n'examiner que les lignes changées

**Date** : 2026-09-10 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : règle pilote. À l'examen
d'un dossier issu d'une **mise à jour** de PPM, seules les lignes qui ont **changé** par rapport à la version
précédente doivent être soumises aux grilles de contrôle — les lignes **inchangées** ont déjà été examinées
et validées à la version précédente, il est inutile (et coûteux) de les re-contrôler. La règle vaut aussi
pour l'**AGPM** et la **fiche de présentation**.

## Périmètre décidé par le pilote (2026-09-10)

Pour un examen dont le dossier a un `idDossierParent` (mise à jour) :

| Élément | Règle |
|---|---|
| Ligne **MODIFIÉE** ou **NOUVELLE** | Examen **complet** (grille de contrôle LIGNE, comme aujourd'hui). |
| Ligne **INCHANGÉE** | **Non examinée** — exclue de la complétude et du calcul du PV. |
| Ligne **SUPPRIMÉE** | **Simple constat du retrait** : un seul résultat (RAS / observation) par ligne retirée, **pas** la grille de contrôle complète d'une ligne active. |
| Points **FICHE** | Étape requise **seulement si** au moins un marché alimentant la fiche a changé (modifié/nouveau/supprimé) ; sinon sautée. |
| Points **AGPM** | Idem : requise seulement si un marché déclencheur d'AGPM a changé ; sinon sautée. |
| Points **DOSSIER** (inter-lignes, globaux) | **Conservés** — toujours examinés (cohérence d'ensemble de la version). |

⚠️ Pour un dossier **NON** issu d'une mise à jour (création initiale, rectification), **rien ne change** :
tout le plan est examiné comme aujourd'hui.

## Ce qui bloque côté serveur (autorité)

1. **Complétude à la soumission** : `POST /api/examens/{id}/soumettre` renvoie aujourd'hui **400** si la
   grille n'est pas entièrement couverte (tous les marchés × tous les points LIGNE, + fiche/AGPM/dossier).
   Il faut que, pour une mise à jour, le serveur **n'exige** que : les points LIGNE des marchés MODIFIÉS/
   NOUVEAUX + le **constat** de chaque SUPPRIMÉ + FICHE/AGPM **si concernés par un changement** + DOSSIER
   toujours. Sans ce changement, un examen à périmètre réduit sera refusé.

2. **Accès au « type de changement » par ligne pour l'examinateur** : `GET /api/dossiers/{id}/diff` est
   aujourd'hui **réservé au PRMP propriétaire** (le front le charge en silence à l'examen et dégrade sur 403).
   Le **Membre / CC / Président** qui examinent doivent pouvoir connaître, par marché, le type de changement
   (INCHANGEE/MODIFIEE/NOUVELLE/SUPPRIMEE). Deux options, à votre main :
   - (a) **ouvrir le `/diff`** en lecture aux profils qui instruisent le dossier ; ou
   - (b) **servir le type de changement dans les données d'examen** (ex. un champ `typeChangement` par
     marché dans la réponse du dossier/examen, ou une projection dédiée). L'option (b) est plus robuste
     (le front ne dépend plus du diff PRMP). À vous de choisir.

3. **Constat des lignes SUPPRIMÉES** : aujourd'hui une ligne supprimée est **exclue** de toutes les vues
   (filtre `!supprimee`). Pour le « simple constat », il faut :
   - qu'elle soit **examinée** par **un seul résultat** (conforme / non conforme + observation), pas la
     grille complète ; et
   - un **mécanisme de stockage** de ce constat. Proposition (à valider par vous) : un **point de contrôle
     dédié « constat de suppression »** (portée LIGNE, réservé aux lignes supprimées) OU un résultat unique
     par `idDetail` supprimé. Merci de nous dire la forme retenue (le front s'y alignera). ⚠️ Préciser aussi
     comment le diff identifie une ligne supprimée côté examen : `LigneDiff.idDetail` peut être `null` (ligne
     n'existant que chez le prédécesseur) — or, dans le dossier de mise à jour, la ligne supprimée existe en
     base avec `SUPPRIMEE=true` et un `idDetail`. Quel `idDetail` porte le constat ?

4. **Génération du PV / observations** : le PV de l'examen ne doit refléter que le périmètre examiné (les
   observations portent sur les lignes changées + constats de suppression + fiche/AGPM/dossier concernés).
   Vérifier que la synthèse et l'annexe d'observations restent cohérentes avec ce périmètre réduit.

## Côté front — ce que je ferai à la livraison

Le front **connaît déjà** le type de changement par ligne à l'examen (chargé quand `idDossierParent != null`,
utilisé aujourd'hui pour le seul surlignage). À la livraison backend, je :
- restreins la **séquence d'examen** et la garde de complétude (`toutTraite`) aux marchés **≠ INCHANGEE** ;
- **réintroduis** les lignes **SUPPRIMÉES** en mode **constat** (un seul résultat par ligne) ;
- **saute** l'étape FICHE / AGPM si aucun marché concerné n'a changé (extension de « on ne contrôle pas le
  vide » en « on ne contrôle pas l'inchangé ») ;
- **garde** l'étape DOSSIER ;
- adapte l'ordre des étapes, la frontière et la reprise. Tout est circonscrit à `examen-dossier.ts`.

## Contre-recette attendue (backend)

1. Mise à jour avec 2 lignes modifiées, 1 nouvelle, 1 supprimée, le reste inchangé : l'examen ne portant que
   sur ces 4 lignes (dont le constat de la supprimée) + DOSSIER → `POST …/soumettre` **200** (pas de 400).
2. Le même examen sans le constat de la ligne supprimée → **400** (le constat manque).
3. Une mise à jour dont aucun marché AGPM n'a changé : l'examen **sans** les points AGPM → **200**.
4. `GET /diff` (ou le type de changement) **accessible au Membre** examinateur (plus de 403).
5. Un dossier **initial** (sans parent) : examen complet exigé comme aujourd'hui (non-régression).
