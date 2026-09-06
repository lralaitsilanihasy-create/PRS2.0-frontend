# Demande backend — Rectification : tolérer jusqu'à 3 ajouts et 3 retraits de lignes

> ✅ **CLÔTURÉE le 06/09** — backend livré (`94c273b`, migration **V19** : `ID_DETAIL_EXAMEN` fige
> le lien observation→marché au snapshot du PV ; garde d'écart en façade, créations/retraits dans
> MarcheService, protection des observations non levées, 4 tests `RectificationEcartIntegrationTest`) ;
> front livré (appariement par idDetail posé au montage, créations sans idDetail, suppressions par
> « ✕ », gardes miroirs et messages, badge « Nouvelle » — vérifié par interception : 4 créations
> refusées, 1 création acceptée). Nota : le diff sert le type **NOUVELLE** (pas « AJOUTEE ») —
> celui que le front affiche déjà. ⚠️ Backend local : redémarrer pour appliquer la V19 avant toute
> recette réelle. Trois arbitrages backend soumis au pilote (voir rapport du 06/09).

**Date** : 2026-09-06 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : règle pilote du
jour — « lors de la rectification du dossier de planification, il est interdit d'ajouter ou de
retirer PLUS DE 3 lignes du PPM à rectifier » : l'écart devient permis, mais borné.

## Constat

Aujourd'hui la rectification est à structure STRICTEMENT figée : le `PUT /api/saisies/ppm/{id}`
d'un dossier `EN_ATTENTE_DECISION_PRMP` exige exactement les mêmes lignes (appariement par
`idDetail`, ni ajout ni retrait) ; le front refuse d'ailleurs l'enregistrement au moindre écart.
La règle pilote assouplit : un PPM rectifié peut légitimement gagner ou perdre quelques lignes —
dans la limite de 3 dans chaque sens.

## Demande

Sur le `PUT /api/saisies/ppm/{id}` d'un dossier **en rectification** uniquement :

1. **Accepter** dans `marches[]` :
   - les lignes **avec `idDetail`** → mise à jour en place (comportement actuel inchangé) ;
   - les lignes **sans `idDetail`** → **CRÉATIONS** (nouveaux marchés complets : bénéficiaires,
     processus, justifications — mêmes validations qu'à la saisie), **au plus 3** ;
   - les `idDetail` du dossier **absents du corps** → **SUPPRESSIONS** (cascade actuelle du
     DELETE marché), **au plus 3**.
2. **Garde d'écart** : plus de 3 créations OU plus de 3 suppressions → **400** explicite nommant
   l'écart (« Le PPM rectifié ajoute N ligne(s) / en retire M : l'écart maximal autorisé est de
   3 dans chaque sens. »).
3. **Protection des observations** (proposition, à arbitrer) : refuser la suppression d'une ligne
   portant une **observation du PV non levée** (400 nominatif) — la rectification répond aux
   observations, elle ne les escamote pas.
4. **Cohérences existantes** :
   - versions archivées (V18) : inchangé — la version remplacée est archivée AVANT, telle quelle ;
   - `/diff-rectification` : restituer les lignes ajoutées/supprimées (les types `AJOUTEE` /
     `SUPPRIMEE` du diff des mises à jour existent déjà) ;
   - examen/PV : les `idDetail` conservés continuent de porter le périmètre — rien ne change pour
     les lignes appariées.

## Côté front (après livraison)

La prévisualisation d'import acceptera un écart ≤ 3 par sens (message d'aide au lieu du refus) ;
la grille permettra d'ajuster : « + Ajouter une ligne » (création, sans `idDetail`) et « ✕ »
(suppression) déjà présents ; le PUT enverra lignes appariées + créations, les suppressions étant
les `idDetail` omis.

## Tests attendus

1. Rectification avec 3 créations et 3 suppressions → 200 ; le dossier porte le nouveau contenu,
   la version remplacée est archivée, le diff montre AJOUTEE/SUPPRIMEE.
2. 4 créations (ou 4 suppressions) → 400 avec le message d'écart.
3. Suppression d'une ligne portant une observation non levée → 400 nominatif (si la proposition 3
   est retenue).
4. Rectification à structure identique → comportement actuel inchangé (anti-régression).
