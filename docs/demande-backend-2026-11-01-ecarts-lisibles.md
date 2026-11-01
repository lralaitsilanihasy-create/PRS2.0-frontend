# Demande backend — 2026-11-01 — Écarts des écrans figés : des valeurs lisibles

## Contexte

La route des écarts (`GET /api/dossiers/{id}/instantanes/ecarts`, livrée le 01/11 par PRS20 7f2b1d68, demande
`demande-backend-2026-11-01-ecarts-ecrans-figes.md`) est branchée côté front (commit 46eda9d4). Une fenêtre du dossier affiche
maintenant ses écarts dans un tableau « Élément / À la soumission / Aujourd'hui ». Le front affiche `libelle`, `soumis` et
`actuel` **tels quels** : il ne reconstruit rien à partir du chemin JSON.

Recette sur 00009/MAOO-CC/CNM/2026, vue par PRES001 : l'écran ATTRIBUTION a 18 écarts, tous réels, car le marché a avancé
depuis la soumission. Mais le tableau est difficile à lire pour un membre de la Commission :

| Élément (libellé servi)               | Soumis        | Actuel |
|---------------------------------------|---------------|--------|
| Lot 1 — état                          | `AU_CONTROLE` | `NOTIFIE` |
| Lot 1 — dossier marche — statut       | `SOUMIS`      | `CLOTURE` |
| Lot 1 — dossier marche — avis         | —             | `FAV` |
| Lot 1 — attributaire                  | —             | `{"idOffre":"1baae434-…","numero":1,"candidat":"SAVA Routes et Ouvrages SA","nif":"730007307…` |
| Lot 1 — information                   | —             | `{"le":"2026-08-31T10:00:00","par":"IMP001","signataire":"Randrianarivo La Personne",…` |
| Lot 1 — Titulaire 1 (ajouté)          | —             | `{"idOffre":"1baae434-…","numero":1,"candidat":"SAVA Routes et Ouvrages SA","montant":11279…` |

Ce tableau pose trois problèmes :

- des **codes** au lieu de leurs libellés ;
- des **noms de champ** découpés mot à mot ;
- des **objets** résumés en JSON, avec des identifiants techniques (UUID) que l'utilisateur n'a jamais vus.

## B1 — Les codes en libellés

Une valeur qui est un code d'un référentiel ou d'une énumération connue est servie par son **libellé**, celui que l'écran vivant
affiche.

Exemples :

- états d'un lot d'attribution (`AU_CONTROLE` → « Au contrôle », `NOTIFIE` → « Notifié ») ;
- statuts de dossier (`SOUMIS` → « Soumis », `CLOTURE` → « Clôturé ») ;
- avis (`FAV` → « Favorable », `FAVR` → « Favorable avec réserves », `DEF` → « Défavorable ») ;
- statut de marché (référentiel `/api/statut-marches`) ;
- natures et modes.

Un code sans libellé connu reste servi tel quel.

## B2 — Les noms de champ en français de l'écran

Le dictionnaire des noms courants est complété pour les champs des écrans figés. Exemples :

| Nom de champ          | Libellé attendu                              |
|-----------------------|----------------------------------------------|
| `dossierMarche`       | « Dossier de marché »                        |
| `delaiAttente`        | « Délai d'attente »                          |
| `information`         | « Information des soumissionnaires »         |
| `piecesAttributaire`  | « Pièces de l'attributaire »                 |
| `avisAttribution`     | « Avis d'attribution »                       |
| `suiviTitulaires`     | « Suivi des titulaires »                     |

Le premier mot prend une majuscule. Un nom absent du dictionnaire garde le repli actuel, le nom découpé en mots, de sorte
qu'aucun écart ne se perd.

## B3 — Un objet ajouté ou retiré résumé en une phrase

Un élément ou un objet entier ajouté ou retiré est résumé par **ce qui l'identifie à l'écran**, sans identifiant technique et
avec les valeurs formatées comme ailleurs (montant en « Ar », date en jj/mm/aaaa). Exemples :

| Élément                                   | Résumé attendu                                                                         |
|-------------------------------------------|----------------------------------------------------------------------------------------|
| Offre, titulaire, attributaire            | « SAVA Routes et Ouvrages SA — offre n° 1 — 1 127 980 000 Ar »                         |
| Acte daté (information, signature, enregistrement, notification, approbation) | « le 31/08/2026 par IMP001 », plus la référence ou l'autorité quand elle existe (« ENR-2026-09-15-3 », « Ministre des Travaux Publics ») |
| Membre                                    | « Nom Prénom — qualité »                                                               |
| Document ou pièce                         | « nom du fichier — 14/09/2026 »                                                        |
| Délai                                     | « du 03/09/2026 au 13/09/2026 (10 jours) »                                             |

À défaut d'une règle pour un objet, on garde le texte compact actuel, mais **sans les champs `id…`**.

## Hors périmètre

Le front ne change pas : il affiche ce qui est servi. Une réponse dans la forme actuelle reste valide, rien ne casse si un écran
n'est pas couvert.

> ⚠️ **2026-11-01 — B1, B2, B3 livrés (PRS20, sans migration ; forme de la réponse inchangée). Précisions :**
> - **B1** — libellés servis : états des écrans (dossier, attribution, PV, séance, évaluation, cérémonie, retrait, formes, catégories),
>   **dictionnaire du serveur** (l'énumération n'a pas de libellé côté serveur : « Au contrôle », « Notifié », « Clôturé »,
>   « Soumissionnaires informés » pour `INFORME`…) ; avis (`tr_avis`), statut de marché (`tr_statut_marche`), nature et mode **par
>   les champs `idNature` / `idMode`** (référentiels). Un code inconnu reste tel quel. Si un libellé diffère de celui de l'écran
>   vivant, dites-le : le dictionnaire est dans `EcartsInstantane.Dictionnaire.etats()`.
> - **B2** — dictionnaire des noms de champ complété (tableau de la demande et noms voisins), majuscule initiale, repli inchangé.
>   **En plus** : un élément de liste apparié par un identifiant technique (`idOffre`, `idMembre`…) est nommé par son numéro, à défaut
>   son rang, son lot, son nom, son candidat, son fichier (« Titulaire 1 », « Membre RABE ») — jamais par l'UUID.
> - **B3** — résumés en une phrase par **forme d'objet** (champs présents), pas par écran : offre/titulaire/attributaire « candidat —
>   offre n° — montant » (n° seulement s'il est servi), acte daté « le jj/mm/aaaa par … — référence ou autorité », membre « nom prénom —
>   qualité », document « fichier — date », délai « du … au … (n jours) » ; à défaut « champ : valeur, … » sans les champs `id…` ; une
>   liste, ses éléments résumés séparés par « ; » (200 caractères au plus).
## Complément du 01/11 (recette de la livraison 1609e01f)

Recette sur 00009/MAOO-CC/CNM/2026 (PRES001), écran ATTRIBUTION : B1 à B3 sont bons. Il reste deux défauts.

### B4 — Les noms de champ dans les résumés « à défaut »

Le repli « champ : valeur, … » écrit les noms bruts, découpés mais sans accents. Exemples :

- Avis d'attribution : « depart : 17/09/2026, echeance : 17/10/2026 » ;
- Pièces de l'attributaire : « echeance : 15/09/2026, delai depasse : oui, … ».

Demande : passer ces noms par **le même dictionnaire que B2** (« Départ », « Échéance », « Délai dépassé », « Date de
délivrance »…) et compléter ce dictionnaire avec les noms rencontrés dans les écrans figés.

### B5 — Le nom de la liste pour ses éléments

« Lot 1 — Titulaire 1 (ajouté) », « Titulaire 2 », « Titulaire 3 » paraissent **deux fois**. Le second groupe vient de
`suiviTitulaires`, mais son libellé a perdu le nom de la liste au profit du seul nom de l'élément.

Demande : un élément de liste garde le **nom de sa liste** devant son identité, par exemple « Lot 1 — Suivi des titulaires —
Titulaire 1 (ajouté) ». À défaut, seule la liste principale peut s'en passer : « Titulaire 1 » pour `titulaires`.

> ⚠️ **2026-11-01 — B4, B5 livrés (PRS20).**
> - **B4** — le repli « champ : valeur, … » passe par le dictionnaire des noms de champ (« Départ : 17/09/2026, Échéance : 17/10/2026,
>   Délai dépassé : oui », « Date de délivrance ») ; un nom absent du dictionnaire est découpé en mots **accentués un à un** (délai,
>   échéance, dépôt, réception, pièce, signé, notifié…) avec une majuscule initiale.
> - **B5** — le nom de la liste est gardé devant l'élément, sauf quand il n'est que le pluriel du nom de l'élément : « Lot 1 — Suivi
>   des titulaires — Titulaire 1 (ajouté) » et « Lot 1 — Titulaire 1 (ajouté) » sont distincts ; « Lot 1 », « Offre n° 2 » inchangés.