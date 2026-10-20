# Demande backend — 2026-10-20 — Modèles de PV : servir les modèles intégrés

## Contexte

L'écran « Modèles de PV » de l'Administrateur (lot G1 livré, V138 ; front `features/admin/modeles-pv/`) doit dire ce que
l'application produit **aujourd'hui** :
- les modèles gérés par `/api/modeles-pv` ne produisent encore rien, puisque la production est le lot G2 ;
- les seuls documents produits viennent des fichiers Word **intégrés** au backend, choisis par le code.

Faute de route, le front a recopié ce constat du code au 20/10 dans une constante, `MODELES_INTEGRES` (`modeles-pv-libelles.ts`) :

| Modèle intégré | Fichiers | Servis | Source |
|---|---|---|---|
| PV d'examen du plan de passation | les 12 `PV_{AF\|AFSR\|ANF}_{PPM\|PPMAGPM}_{CENTRALE\|REGIONALE}.docx` | les PV des dossiers qui portent un PPM (PPM, PPM-AGPM) ; l'avis NSP n'a pas de document | `PvDocumentGenerator.modele()`, `PvDocumentService.modelePour()` |
| Lettre de renvoi | `LR_CENTRALE.docx`, `LR_REGIONALE.docx` | toute lettre signée, quel que soit le sous-type | `LettreRenvoiDocumentGenerator` |

Ce constat sert à trois choses dans l'écran :
- afficher les lignes « Intégré à l'application · En service » de la liste ;
- ne plus compter le plan parmi les familles « Sans document » ;
- poser l'encadré « encore servi par les fichiers intégrés » sur la fiche d'un modèle qui reprend PPM ou PPM-AGPM.

Recopié dans le front, ce constat **dérive** dès que le backend change de fichiers ou de règle de choix. Il dérivera notamment en
G2 (production par la version en vigueur) et en G4 (reprise du plan, puis retrait des anciens fichiers). L'écran mentirait alors sans
qu'aucun test ne rougisse.

## B1 — Servir les modèles intégrés

Proposition : une route en lecture, réservée à l'Administrateur comme les autres, `GET /api/modeles-pv/integres` :

```json
[
  {
    "code": "PV-PLAN-INTEGRE",
    "libelle": "PV d'examen du plan de passation",
    "nature": "PV",
    "sousTypes": ["PPM", "PPM-AGPM"],
    "fichiers": ["PV_AF_PPM_CENTRALE.docx", "…"],
    "regle": "Un fichier par avis (FAV, FAVR avec annexe des observations, DEF), avec ou sans AGPM, commission centrale ou régionale ; NSP sans document.",
    "enService": true
  },
  {
    "code": "LETTRE-RENVOI-INTEGREE",
    "libelle": "Lettre de renvoi",
    "nature": "LETTRE_RENVOI",
    "sousTypes": null,
    "fichiers": ["LR_CENTRALE.docx", "LR_REGIONALE.docx"],
    "regle": "Un fichier par commission, centrale ou régionale, pour toute lettre signée.",
    "enService": true
  }
]
```

- `sousTypes: null` : tous les sous-types.
- `enService` : `false` dès qu'un modèle de `/api/modeles-pv` en vigueur sert ces sous-types et que la production passe par lui (G2,
  puis G4). La ligne reste servie, pour l'historique, jusqu'au retrait des fichiers.
- La liste se lit **là où le choix se fait** (`PvDocumentGenerator`, `PvDocumentService`, `LettreRenvoiDocumentGenerator`), pas
  dans une seconde copie côté serveur.

Une variante est acceptable : un champ `integres` ajouté à la réponse de `GET /api/modeles-pv`. Mais la route séparée garde
inchangé le contrat de la liste.

> ⚠️ **2026-10-20, livré (backend), tel que proposé**
> - **La liste se lit là où le choix se fait** :
>   - les fichiers du PV par `PvDocumentGenerator.modeles()`, qui énumère les trois axes de `modele()` ;
>   - ceux de la lettre par `LettreRenvoiDocumentGenerator.modeles()` ;
>   - les sous-types par `PvDocumentService.SOUS_TYPES_MODELES_INTEGRES`.
>
>   Seuls les fichiers présents dans le JAR sont servis.
> - **Une précision sur la règle du PV** : la condition réelle n'est pas le sous-type. C'est un **PPM qui garde au moins une ligne**
>   non supprimée, ce que seuls PPM et PPM-AGPM portent. Un plan vidé de ses lignes n'a pas de document, et `regle` le dit.
> - **`enService`** vaut `true` tant que la production ne passe pas par le générateur. En G2, il sera calculé par la règle de
>   production elle-même.

## B2 — Les sous-types sans document

Proposition, facultative : servir dans la même réponse, ou par `GET /api/modeles-pv/couverture`, pour chaque sous-type et chaque
nature, ce qui produit son document : un modèle géré (`idModele`, `numeroVersion`), un modèle intégré (`code`) ou rien. Le front
afficherait alors les familles « Sans document » sans calcul de son côté. Aujourd'hui, il les déduit des rattachements
(`sousTypes` des modèles actifs) et de B1.

> ⚠️ **2026-10-20, livré (backend)** : `GET /api/modeles-pv/couverture`, une ligne par sous-type du référentiel (26 en recette) et
> par nature : `{ sousType, libelle, famille, nature, produitPar, integre, modeleRattache }`.
> - **`produitPar`** vaut `INTEGRE`, `GERE` ou `AUCUN`.
> - **Avant G2**, il ne vaut jamais `GERE`. Un modèle rattaché ne produit encore rien : il est servi à part, dans `modeleRattache`
>   (`{ id, code, numeroEnVigueur }`). Les familles « Sans document » sont donc celles qui ont `produitPar = AUCUN`.

## Questions

- **Q1.** La route séparée (B1) ou un champ de la liste ?
- **Q2.** B2 : utile dès maintenant, ou seulement en G2, quand la production change de mains ?

> ⚠️ **2026-10-20, réponses (backend)**
> - **Q1 — la route séparée** : le contrat de la liste ne change pas.
> - **Q2 — dès maintenant** : le front n'a plus de couverture à calculer.

## Côté front

À la livraison :
- la constante `MODELES_INTEGRES` est retirée et l'écran lit la route ;
- la règle de couverture (`sousTypesSansModele`, `servisParIntegre`) lit `enService` ;
- les tests de `modeles-pv-libelles.spec.ts` passent sur les données servies.
