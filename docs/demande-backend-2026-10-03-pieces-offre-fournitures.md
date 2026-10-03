# Demande backend — Les pièces de l'offre ouvertes aux fournitures

**Date** : 2026-10-03 · **Émetteur** : front · **Origine** : extension du lot 4 du chantier b
(`demande-backend-2026-10-03-pieces-offre-travaux.md`, close, livrée en V61), retenue par le pilote le 03/10 (choix
« A »). Elle répond à l'hypothèse **H4** de cette demande : « les fournitures ont la même clause 6.2 ; une extension
ultérieure ne changerait que le périmètre ».

## Le constat qui motive le choix A

Le DPAO **officiel** des fournitures n'est pas construit comme celui des travaux. Sa clause 6.2 n'a qu'une rubrique,
« Documents ou pièces à remettre en sus de ceux mentionnés à la clause 6.2. des IC », que remplit `B04-CO-01`. Il n'a
**aucune place pour les pièces administratives**.

`B03-CQ-01` (« Identification et situation juridique : pièces exigées ») est pourtant servi aux fournitures, en quantité
fixe et à commande, avec la liste du document type pour valeur par défaut. Il ne s'imprimait que dans l'ancienne fiche
A1, recopiée du dossier 2463. Depuis le passage aux modèles officiels (27/09), **il ne s'imprime plus nulle part** : la
PRMP le saisit pour rien. Le dossier réel 2463 exige pourtant ces pièces, et datées (« Carte d'Immatriculation Fiscale
2026 ou 2025 validée, datée… », correspondance du 27/09, DPAO 6.1).

**Choix A du pilote** : un paragraphe « Pièces administratives » est **ajouté** à la clause 6.2 du DPAO des fournitures,
sur le patron du 2° des travaux. La liste des pièces s'ouvre aux fournitures, et `B03-CQ-01` retrouve une place.

---

## B1 — `/pieces` et le bloc `B14` ouverts aux fournitures

- `GET|PUT /api/fiches-marche/{idDmc}/pieces` s'ouvre à **FOURNITURES_SERVICES**, en **quantité fixe et à commande**.
  Le contrat, les règles et les 400 sont ceux de V61.
- Le bloc `B14` « Pièces de l'offre » (`rendu = 'PIECES'`, rubriques `B14-AD` et `B14-OF`) est servi au référentiel des
  fournitures pour ces deux types de marché.
- **Contrat-cadre de fournitures : hors périmètre (H1)**. Il ne sert ni `B04-CO-01` ni `B03-CQ-01`, et son DPAC n'a pas
  cette clause. `PIECES_HORS_PERIMETRE` y reste.
- **L'écran ne change pas** : la grille, l'aperçu, « Reprendre les pièces du document type » et « Coller une liste »
  sont les mêmes qu'aux travaux.

## B2 — Les contrôles

- **`PIECES_OFFRE_EXIGEES`** s'étend aux fournitures, avec `B04-CO-01` pour texte : la liste `OFFRE` **ou**
  `B04-CO-01`, qui devient **facultatif** (aujourd'hui obligatoire). Même logique qu'aux travaux avec `B04-PI-01`.
- **`PIECES_EN_DOUBLE`** s'étend aux fournitures (fin de H4) : l'avertissement porte sur `B03-CQ-01` égal à sa valeur
  par défaut alors que la liste `ADMINISTRATIVE` est remplie.

## B3 — Le DPAO-F (recopié par le front)

Rédigé dans `scripts/modeles-dao/modeles/DPAO-F.txt` / `.json` (`verifier.mjs` : 251 sur 251). ⚠️ **Ne pas le recopier
avant la validation du pilote**, que je noterai ici. La cellule 6.2 devient :

```
Documents ou pièces à remettre en sus de ceux mentionnés à la clause 6.2. des IC :
{{SI:PIECES-OFFRE-LISTE}} {{PIECES.offre}}                   — PIECES.offre renseigne
{{SI:PIECES-OFFRE-TEXTE}} {{B04-CO-01}}                      — B04-CO-01 renseigne
{{SI:PIECES-ADM}} Pièces administratives à joindre à l'offre :   — PIECES.administratives renseigne ou B03-CQ-01 renseigne
{{SI:PIECES-ADM-LISTE}} {{PIECES.administratives}}           — PIECES.administratives renseigne
{{SI:PIECES-ADM-TEXTE}} {{B03-CQ-01}}                        — B03-CQ-01 renseigne
```

- « Pièces administratives à joindre à l'offre : » est un **ajout** au document type, déclaré comme tel au comparateur.
- **Effet sur les fiches existantes** : `B03-CQ-01` a une valeur par défaut. Les fiches de fournitures qui ne l'ont pas
  vidé imprimeront désormais le paragraphe, avec la liste du document type. C'est l'effet voulu : ces pièces étaient
  exigées sans être dites.

## Hypothèses

- **H1** — Le contrat-cadre de fournitures reste hors périmètre.
- **H2** — `B04-CO-01` devient facultatif, sous la règle `PIECES_OFFRE_EXIGEES`, comme `B04-PI-01` en V61.

**Recette attendue** : une fiche de fournitures (quantité fixe) avec les pièces administratives du 2463 et deux
pièces de l'offre. Le DPAO imprime les deux listes à la clause 6.2. Sans liste ni texte de pièces de l'offre, la fiche
est refusée par `PIECES_OFFRE_EXIGEES`, et `PIECES_EN_DOUBLE` avertit tant que `B03-CQ-01` garde son défaut.

**Banc de l'import** : aucune fausse valeur. `B04-CO-01` et `B03-CQ-01` deviennent **ambigus** pour la lecture, comme
aux travaux : chacun suit le paragraphe du seul jeton de sa liste.

> ✅ **2026-10-03 — texte validé par le pilote, tel quel** (« Pièces administratives à joindre à l'offre : »).
> `DPAO-F.txt` est **à recopier** tel que commité en `ae93f90`, avec la livraison de B1 et B2. Le pilote autorise la
> recette sur une fiche de fournitures en brouillon de DBPRS20.
