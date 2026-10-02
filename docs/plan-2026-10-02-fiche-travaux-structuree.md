# Plan — 2026-10-02 — Une fiche DAO de travaux qui porte ses listes et ses seuils (chantier b)

**Statut : proposition, à arbitrer par le pilote.** Rien n'est codé. Après arbitrage, une demande au backend reprendra
les lots retenus, sur le modèle des précédentes.

**Pourquoi maintenant.** Deux DAO de travaux réels ont été confrontés à la fiche :
- le bâtiment scolaire du MEN (`docs/correspondance-2026-10-01-fiche-dao-travaux-vs-dao-men.md`) ;
- l'entretien routier du MTP (`docs/correspondance-2026-10-02-fiche-dao-travaux-vs-dao-mtp-routier.md`).

Les deux arrivent au même point. La fiche reproduit bien les **clauses** (60 % des informations trouvées), mais pas ce
qui fait l'offre d'un candidat :
- le **détail quantitatif et estimatif** (DQE) ;
- les **listes** d'exigences (matériel, personnel, pièces) ;
- les **seuils calculés**.

Deux maquettes de soumission en ligne montrent à quoi servirait cette structure :
- `docs/maquette-2026-10-02-soumission-en-ligne-travaux.html` (bâtiment, prix forfaitaire) ;
- `docs/maquette-2026-10-02-soumission-en-ligne-routier.html` (route, prix unitaires).

Tout ce qu'elles pré-remplissent ou contrôlent devrait venir de la fiche. Aujourd'hui, c'est du texte libre ou une pièce jointe.

## 1. Ce que les deux DAO ont établi

| besoin | MEN (bâtiment) | MTP (route) | aujourd'hui dans la fiche |
|---|---|---|---|
| **DQE** | 57 articles en 12 chapitres, prix global et forfaitaire, découpage du forfait par corps d'état | 17 articles en 3 séries (000, 500, 600), prix unitaires écrits **en lettres** au bordereau | pièce jointe ; découpage du forfait en texte (`B08-MR-06`) |
| **Sous-détail des prix** | — | exigé pour l'installation (et les prix « marqués d'un astérisque ») ; K1 imposé | rien |
| **Plafond d'un article** | — | installation ≤ 10 % des travaux, payée 60 % / 40 % | rien |
| **Matériel exigé** | 5 engins, 1 de chaque | 10 engins avec nombre et **minimum en propre** (« 6 camions, au moins 4 en propre ») | texte (`B03-QT-09`) |
| **Personnel clé** | 2 postes : diplôme, 3 ans | 2 postes : diplôme, 5 et 3 ans **en travaux routiers** | texte (`B03-QT-13`) et un nombre (`B03-QT-10`) |
| **Liquidité** | montant fixe par lot | **10 % du montant de l'offre** | montant fixe (`B03-QT-14`) |
| **Chiffre d'affaires** | non exigé | **moyenne des 3 meilleures des 5 dernières années**, en travaux routiers | montant annuel fixe (`B03-QT-07`) |
| **Références** | 1 marché ≥ montant du lot, sur 5 ans | **au plus 3 marchés, cumul** ≥ 2,5 Md, sur 10 ans | texte par lot (`B03-QT-08`) et une période (`B03-QT-12`) |
| **Pièces typées** | planning, méthodologie, attestation de visite avec photos | 5 plannings (8-a à 8-e), plan de charge, méthodologie | texte (`B04-PI-01`) |

## 2. Ce qui existe déjà et qu'on réutilise

Les **fournitures** ont depuis le 25/09 un **besoin** structuré (bloc `B12`) :
- articles par lot, désignation, unité, quantités ;
- caractéristiques exigées ;
- ressource à part `GET|PUT /api/fiches-marche/{id}/articles`, figée à la validation, copiée à la révision ;
- documents produits : liste des fournitures, bordereau des prix en tableur protégé (seule la colonne des prix est
  ouverte), tableau de conformité.

Aujourd'hui, `PUT /articles` refuse les travaux (`BESOIN_HORS_PERIMETRE`). Le DQE des travaux est le **même objet**,
avec quelques attributs en plus : c'est l'extension la plus économique.

## 3. La proposition, en quatre lots

### Lot 1 — Le DQE dans la fiche (le plus utile)

**Ce que la fiche porte** : le besoin des fournitures, ouvert aux travaux. Chaque article de DQE a :
- son **numéro de prix** (« 529 ») ;
- sa **série ou son chapitre** (« 500 — Ouvrages », « 4 — Maçonnerie ») ;
- sa désignation, son unité et sa quantité ;
- le **libellé du bordereau** (« Le mètre cube », « Le forfait »), proposé d'après l'unité ;
- un drapeau « **sous-détail exigé** » ;
- un **plafond** éventuel en % des travaux (l'installation à 10 % du MTP).

**Ce qu'on en tire** :
- documents :
  - le **bordereau des prix et le DQE** produits (annexe 1 de l'AE) : un tableur protégé comme pour les fournitures,
    plus le cadre du bordereau à remplir en lettres ;
  - la **liste des prix soumis à sous-détail** (annexe 3) ;
- au **forfait**, le découpage par corps d'état **dérivé des chapitres**, qui remplace le texte de `B08-MR-06` ;
- contrôles : chaque chapitre a un article, chaque article une unité et une quantité.

**Coût** : moyen. Côté backend, il faut lever `BESOIN_HORS_PERIMETRE`, ajouter quatre attributs et produire un tableur
de plus. Côté front, la grille du besoin existe : il faut des colonnes en plus et le regroupement par chapitre.

### Lot 2 — Les seuils calculés (peu coûteux, gros effet sur l'évaluation)

Trois champs reçoivent un **mode de calcul** :
- `B03-QT-14` **liquidité** : montant fixe (MEN) **ou** pourcentage de l'offre (MTP) ;
- `B03-QT-07` **chiffre d'affaires** :
  - annuel minimum (cas actuel) **ou** moyenne des *n* meilleures des *m* dernières années ;
  - et le domaine (« travaux routiers ») ;
- `B03-QT-08` **références** : un marché ≥ montant (MEN) **ou** au plus *n* marchés dont le cumul ≥ montant (MTP) ;
  la période reste `B03-QT-12`.

**Ce qu'on en tire** : le DPAO imprime la règle telle que l'acheteur l'a choisie, et une plateforme pourra la
contrôler. La maquette routière le fait déjà.

**Coût** : faible. Quelques champs ou options en plus, et les rédactions correspondantes dans le DPAO-T (côté front,
dans `decrire.mjs`).

### Lot 3 — Matériel et personnel en listes

- **Matériel exigé** : une liste (type et caractéristiques, nombre, minimum en propre). Elle remplace le texte de
  `B03-QT-09` et s'imprime en tableau au DPAO, comme chez le MTP.
- **Personnel clé** : une liste (poste, diplôme exigé, années d'expérience, domaine, justificatifs). Elle remplace
  `B03-QT-13` et `B03-QT-10`.

**Coût** : moyen. Ce sont deux ressources en liste, du même type que le besoin, mais plus simples (sans quantités ni
caractéristiques).

### Lot 4 — Les pièces de l'offre typées

Une liste de pièces : code, libellé, ancienneté maximale (« moins de 3 mois »), commune aux lots ou par lot, modèle
joint (planning 8-a…). Elle remplace une partie de `B03-CQ-01` et de `B04-PI-01`.

**Coût** : moyen. **Utilité surtout pour la soumission en ligne**, qui n'est pas engagée.

## 4. Questions au pilote

- **Q1 — Ordre des lots.** Recommandation : **lot 1, puis lot 2**, puis le lot 3. Le lot 4 attend la décision sur la
  soumission en ligne. Le lot 1 donne tout de suite un document que la fiche ne sait pas produire (l'annexe 1 de l'AE).
  Le lot 2 coûte peu et répond aux ⚠ du DAO routier.
- **Q2 — Saisie du DQE.** La PRMP a son DQE dans un tableur (le MTP l'exige même en Excel). Recommandation : la grille
  de saisie, plus un **« coller depuis le tableur »** (lignes copiées, colonnes reconnues), plutôt qu'un import de
  fichier. L'import xlsx a été volontairement retiré pour le plan de passation, et le copier-coller évite d'y revenir.
- **Q3 — Forfait.** Recommandation : le découpage par corps d'état se **dérive** des chapitres du DQE, et `B08-MR-06`
  disparaît des travaux. Alternative : garder le texte libre en plus.
- **Q4 — Anciens champs texte** (`B03-QT-09`, `B03-QT-13`). Recommandation : ils restent en **complément libre**, pour ce
  que la liste ne dit pas ; la liste fait foi et s'imprime en premier.
- **Q5 — Périmètre.** Ce plan prépare la fiche et ses documents. La **plateforme de dépôt** (les maquettes) reste hors
  périmètre tant qu'elle n'est pas engagée. Confirmez.

## 5. Ce que ce plan ne fait pas

- Il ne change rien au **papier** : un DAO produit avec ces listes s'imprime comme aujourd'hui, en mieux rempli.
- Il ne lit pas le DQE **dans le PDF** du DAO : l'import ne fait que proposer, et un tableau de 57 lignes se colle
  plus sûrement qu'il ne se lit.
- Il ne touche pas aux **fournitures** ni aux **prestations intellectuelles**, sauf pour les seuils du lot 2 s'ils y
  servent aussi (à voir avec le backend).
