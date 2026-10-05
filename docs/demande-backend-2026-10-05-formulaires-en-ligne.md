# Demande backend — 2026-10-05 — Soumission en ligne, lot 5 : l'offre saisie dans des formulaires, plus seulement jointe

> Demande du pilote (05/10) : « Attaquer d'abord au lot 5. » Ce sont les plateformes de dépôt des maquettes
> `maquette-2026-09-27-formulaires-en-ligne.html` (fournitures, DAO 2463), `maquette-2026-10-02-soumission-en-ligne-travaux.html`
> (bâtiment, MEN) et `maquette-2026-10-02-soumission-en-ligne-routier.html` (route, MTP), restées à l'état de maquette.

**Le constat.** Aujourd'hui (lots 3 et 4, V68 à V71), le candidat dépose une offre faite de **pièces jointes**. Seuls les champs
de l'acte d'engagement (montant HT et TTC, délai, validité, rabais) et la garantie sont saisis : ce sont les valeurs lues en
séance. Le bordereau des prix, le DQE, le tableau de conformité et les capacités sont des fichiers que la commission ouvre un
par un. La plateforme ne sait rien les calculer : ni total, ni écart avec l'acte d'engagement, ni seuil de qualification.

Pourtant, la fiche DAO porte déjà tout ce qu'il faut pour présenter ces formulaires pré-remplis :
- le besoin par lot, avec les caractéristiques exigées (V45) ;
- le DQE des travaux : n° de prix, séries, sous-détail, plafond (V59) ;
- le matériel et le personnel exigés (V60) ;
- les seuils de qualification `B03-QT-15` à `B03-QT-20` (V59) ;
- la TVA (`FICHE_TAUX_TVA`).

**Rien de cela n'est servi au candidat** : `ProcedureEnLigneDto` ne donne que les lots `{ numero, intitule }`.

**Ce que le lot 5 change.** Le candidat **remplit** ses prix, sa conformité et ses capacités dans des formulaires pré-remplis
depuis la fiche. Le navigateur calcule les totaux. **Les montants de l'acte d'engagement sont dérivés du bordereau**, ils ne
sont plus saisis à part. Le tout est **scellé dans l'offre**, comme aujourd'hui : le serveur n'en lit rien avant l'ouverture.
À l'ouverture, le serveur recalcule et signale les écarts. **Il n'écarte jamais une offre** : la commission décide, comme pour
la garantie (V70).

**Découpage.** Le front livrera en deux temps, mais le format scellé est demandé **en une fois**, pour ne le changer qu'une fois :
- **lot 5a** : les prix et la conformité.
  - Fournitures : bordereau des prix, calendrier de livraison, conformité technique.
  - Travaux : DQE et bordereau des prix unitaires, avec les prix en lettres.
- **lot 5b** : les capacités, le personnel, le matériel, le coefficient K1 et le sous-détail des prix.

Les noms ci-dessous sont **proposés** : le backend fait autorité, et ce document sera corrigé en place si la livraison s'en
écarte. Ce lot ne concerne pas les prestations intellectuelles : leur proposition reste un ensemble de pièces jointes.

---

## B1 — Le besoin servi au candidat : `GET /api/procedures-en-ligne/{idDmc}/besoin`

### B1.1 — La route

- **Accès** : candidat **connecté** (`CANDIDAT`), comme le téléchargement des documents du DAO. Le besoin est déjà écrit dans le
  BP et le DQE téléchargeables : rien de nouveau n'est divulgué.
- **Source** : la **version validée en vigueur** de la fiche, celle de la procédure publiée. Jamais un brouillon de révision.
- **Disponibilité** : servie dès que la procédure est visible. Si la fiche n'a pas de besoin (prestations intellectuelles, ou
  fiche antérieure à V45), la route répond **200** avec `formulaires: false` : le front garde alors le dépôt par pièces seules.
- **404** si la procédure n'est pas publiée en ligne (même règle que `GET /api/procedures-en-ligne/{idDmc}`).

> ⚠️ **2026-10-05 — livré, conforme.** Sans session : 401 ; compte interne : 403 ; hors critères : 404 ; sans besoin : 200 avec
> `formulaires: false`.

### B1.2 — Le contenu (`BesoinEnLigneDto`, nom proposé)

```jsonc
{
  "idDmc": 44,
  "categorie": "FOURNITURES",            // FOURNITURES | TRAVAUX
  "typeMarche": "A_COMMANDE",            // le type de la fiche : A_COMMANDE | QUANTITE_FIXE | CONTRAT_CADRE…
  "formulaires": true,                   // false : dépôt par pièces seules (B1.1)
  "tauxTva": 20,                         // FICHE_TAUX_TVA, en %
  "monnaie": "MGA",
  "lots": [
    {
      "numero": 1,                       // null si non alloti (une seule entrée)
      "intitule": "Matériel informatique",
      "articles": [
        {
          "idArticle": 812,
          "ordre": 1,
          "designation": "Ordinateur portable",
          "unite": "unité",
          "quantite": null, "quantiteMin": 10, "quantiteMax": 25,
          "caracteristiques": [ { "idCaracteristique": 3301, "ordre": 1, "libelle": "Mémoire vive", "exigence": "8 Go au minimum" } ],
          // travaux seulement (null/false ailleurs), noms de V59 :
          "numeroPrix": null, "serie": null, "serieLibelle": null, "libelleBordereau": null, "sousDetail": false, "plafond": null
        }
      ],
      // les valeurs de fiche utiles au formulaire, résolues pour CE lot (clé CODE#n, à défaut CODE) :
      "lieuLivraison": "Ministère, Antananarivo",
      "delaiExecution": { "valeur": 60, "unite": "JOURS" },
      "garantieSoumission": 1500000
    }
  ],
  // travaux seulement (null en fournitures) :
  "qualification": {
    "liquiditeMontant": null, "liquiditePourcentage": 10,                         // B03-QT-15 / montant existant
    "chiffreAffaires": { "montant": 5000000000, "annees": 5, "meilleures": 3, "domaine": "travaux routiers" },
    "references": { "montant": 2500000000, "nombre": 1, "annees": 10, "cumul": false }
  },
  "materiel": [ /* MaterielExige de V60, par lot si parLot */ ],
  "personnel": [ /* PersonnelExige de V60 */ ]
}
```

- `qualification` reprend, sous des noms lisibles, les valeurs déjà saisies dans les clauses `B03-QT-*`. Le backend choisit
  ce découpage s'il en préfère un autre ; le front a seulement besoin de **valeurs typées**, pas d'un texte à analyser.
- `materiel` et `personnel` sont les listes de V60 telles quelles.

> ⚠️ **2026-10-05 — livré.** Écarts :
> - `categorie` reprend le nom de `ProcedureEnLigneDto` : `FOURNITURES_SERVICES` · `TRAVAUX` · `PRESTATIONS_INTELLECTUELLES` ;
> - `delaiExecution` = `{ valeur, unite, texte }`. En fournitures, le délai de livraison (`B06-EO-11` en quantité fixe, `B06-EO-12`
>   à commande, à défaut `B09-DX-01`) est en jours. Aux travaux, `B09-DL-01` est un **texte** : `valeur` n'est remplie que s'il
>   commence par un nombre ;
> - `lieuLivraison` vaut `null` aux travaux (aucun champ) ; `garantieSoumission` = `B05-GS-03` en fournitures, `B05-GQ-03` aux travaux ;
> - `qualification` est servie **par lot** (voir Q1), `null` en fournitures. `materiel` et `personnel` sont vides hors travaux ;
> - l'article n'expose pas son rédacteur.

### B1.3 — Les pièces attendues remplacées par un formulaire

Quand `formulaires` vaut `true`, certaines pièces attendues de l'offre (`demande-backend-2026-10-03-pieces-offre-*`) **ne sont plus
jointes : elles sont remplies**. Le front a besoin de savoir lesquelles, pour ne pas les exiger deux fois.

- Proposition : la pièce attendue gagne **`formulaire`**, `null` ou l'un de `BORDEREAU`, `CONFORMITE`, `CALENDRIER`, `DQE`,
  `SOUS_DETAIL`, `K1`, `CAPACITES`, `PERSONNEL`, `MATERIEL`.
- Une pièce marquée n'est plus exigée en fichier. Le candidat peut **joindre en plus** une pièce justificative, par exemple
  une fiche technique ou un CV : celle-ci reste une pièce de l'offre comme une autre.
- La correspondance entre code de pièce et formulaire est **au backend**, qui connaît les codes des pièces des trois jeux.

> ⚠️ **2026-10-05 — livré.** `PieceAttendue.formulaire` est servi. Une pièce marquée passe à `obligatoire = false`. `AE`, `RECU-DAO`
> et `GARANTIE` gardent `formulaire = null`. La correspondance se fait sur le libellé de la pièce (voir Q3). ⚠️ Les pièces du lot 5b
> (`K1`, `SOUS_DETAIL`, `CAPACITES`, `PERSONNEL`, `MATERIEL`) sont marquées **dès maintenant** : le front ne doit pas les retirer
> du dépôt tant que leurs formulaires ne sont pas livrés, sinon le candidat n'aurait plus aucun moyen de les fournir.

---

## B2 — Le manifeste en format 3 : les formulaires scellés

Le serveur ignore déjà un champ inconnu du manifeste (V70). Le front peut donc sceller le format 3 **avant** la livraison de
B3. Ce format est demandé ici pour que le serveur le **lise** à l'ouverture.

```jsonc
{
  "version": 3,
  // … tous les champs du format 2, inchangés : idDmc, lot, entreprise, groupement, acteEngagement, pieces, garantie, dateScellement
  "formulaires": {
    // ── lot 5a ─────────────────────────────────────────────────────────────────────────────
    "bordereau": [                                   // fournitures ET travaux : une ligne par article du lot
      { "idArticle": 812, "prixUnitaireHt": 2450000, "prixEnLettres": "deux millions quatre cent cinquante mille",
        "dateLivraison": "2026-12-15" }              // dateLivraison : fournitures seulement (le calendrier)
    ],
    "conformite": [                                  // fournitures : une entrée par article
      { "idArticle": 812, "marque": "…", "modele": "…",
        "caracteristiques": [ { "idCaracteristique": 3301, "proposee": "16 Go", "conforme": true } ] }
    ],
    "totaux": {                                      // calculés par le navigateur ; le serveur les recalcule (B3)
      "ht": 61250000, "tva": 12250000, "ttc": 73500000,
      "htMin": 24500000, "ttcMin": 29400000,         // à commande : au minimum des quantités ; null sinon
      "parSerie": [ { "serie": "500", "ht": 0 } ]    // travaux : sous-totaux du DQE ; null en fournitures
    },
    // ── lot 5b (travaux) ───────────────────────────────────────────────────────────────────
    "k1": { "taux": [ { "code": "a1", "pourcentage": 3.5 } ], "siegeEtranger": false, "k1": 1.25 },
    "sousDetails": [
      { "idArticle": 901, "rendement": 1,
        "lignes": [ { "nature": "MAIN_OEUVRE", "designation": "…", "unite": "h", "quantite": 40, "prixUnitaire": 5000 } ],
        "prixCalcule": 2450000 }
    ],
    "capacites": {
      "chiffresAffaires": [ { "annee": 2025, "montant": 6200000000 } ],
      "liquidite": { "montant": 900000000, "nature": "ligne de crédit", "emetteur": "…" },
      "references": [ { "objet": "…", "maitreOuvrage": "…", "annee": 2023, "montant": 3100000000 } ]
    },
    "personnel": [ { "idPersonnel": 41, "nom": "…", "diplome": "…", "experienceAnnees": 12 } ],
    "materiel": [ { "idMateriel": 17, "designation": "…", "nombre": 2, "enPropre": 1 } ]
  }
}
```

- **Les montants de l'acte d'engagement sont dérivés.** Quand `formulaires` est présent, `acteEngagement.montantHt` et
  `montantTtc` **sont** `totaux.ht` et `totaux.ttc` : le front ne les laisse plus saisir. La séance continue de lire
  `acteEngagement`, sans autre changement.
- **Les personnes nommées** (personnel clé, signataires de références) sont des **données personnelles**. Elles sont scellées
  comme le reste et ne sont lues qu'après l'ouverture, par la commission seule (`PIECE_RESERVEE_CAO`). Elles suivent la même
  conservation que les pièces (V70, `conservation-offres-admin`).
- **Les formats 1 et 2 restent lus** : une offre scellée avant le lot 5 s'ouvre comme aujourd'hui.

### B2.1 — Les prix en lettres

Pour les travaux, **ce sont les lettres qui font foi** (BPU, cadre du bordereau ; maquette routière). Le candidat saisit son
prix **en chiffres** ; le navigateur l'écrit en lettres (`enLettres`, règles traditionnelles). Le candidat **voit et accepte**
ce texte au récapitulatif, et c'est ce texte qui est scellé.

À l'ouverture, le serveur vérifie que les lettres correspondent aux chiffres. S'ils divergent, il lève une alerte, sans
corriger : les lettres priment, et la correction relève de l'évaluation, pas de l'ouverture.

> ⚠️ **2026-10-05 — livré, conforme.** Le format 3 est lu à l'ouverture, un champ inconnu est ignoré, et les formats 1 et 2 restent
> lus. Pour les prix en lettres, le serveur relit le texte (orthographe traditionnelle ou de 1990, « virgule » pour les décimales)
> et le compare aux chiffres.

---

## B3 — L'ouverture : le serveur lit, recalcule, signale

Au déchiffrement (lot 4), pour une offre au format 3 :

1. **Recalcul des totaux** à partir du bordereau et des quantités de la fiche, puis comparaison :
   - avec `totaux` ;
   - avec `acteEngagement`.

   Un écart supérieur à 1 Ar par ligne lève une **alerte** dans la lecture : `TOTAL_DIVERGENT`, ou `AE_DIVERGENT`.
   **Jamais un refus.**
2. **Contrôles lus avec la commission**, chacun sous forme d'**alerte**, sur le modèle de « Garantie insuffisante » (V70) :
   - `PRIX_MANQUANT` : un article du lot n'a pas de prix ;
   - `LETTRES_DIVERGENTES` : voir B2.1 ;
   - `PLAFOND_DEPASSE` : article dont `plafond` est renseigné, par exemple l'installation de chantier ≤ 10 % des travaux ;
   - `NON_CONFORME` : au moins une caractéristique déclarée non conforme ;
   - `LIVRAISON_HORS_DELAI` : date de livraison postérieure au délai de la fiche ;
   - lot 5b : `CA_INSUFFISANT`, `LIQUIDITE_INSUFFISANTE`, `REFERENCES_INSUFFISANTES`, `PERSONNEL_INCOMPLET`, `MATERIEL_INCOMPLET`,
     `SOUS_DETAIL_INCOHERENT` (écart supérieur à 1 % entre le prix calculé et le prix du bordereau).
3. **La lecture** (`LectureOffreDto`) gagne `formulaires: boolean`, ainsi que `totaux`, avec `htMin`/`ttcMin` en marché
   à commande.
4. **Le détail des formulaires** est servi à la commission seule, comme les pièces (`PIECE_RESERVEE_CAO`) :
   - `GET /api/procedures/{idDmc}/offres/{idOffre}/formulaires` renvoie le JSON du manifeste, partie `formulaires`, avec les
     libellés du besoin joints, pour que l'écran n'ait pas à faire un second appel ;
   - `GET …/formulaires/{BORDEREAU|DQE|CONFORMITE|CAPACITES}.pdf` (proposé) renvoie le document **rempli** que la commission
     imprime. Il reprend le gabarit des documents produits en V45/V59 (BP, DQE), complété des prix de l'offre.
5. **Le PV d'ouverture** reprend, pour chaque offre au format 3 :
   - les totaux HT et TTC ;
   - le minimum et le maximum en marché à commande ;
   - les alertes.

   Son contenu ne change pas autrement.

> ⚠️ **2026-10-05 — livré.** Écarts et précisions :
> - **routes** : `GET /api/fiches-marche/{idDmc}/seance/offres/{idOffre}/formulaires` et `…/formulaires/{type}.pdf`, à côté des
>   pièces (et non `/api/procedures/…`) ; mêmes gardes (403 `PIECE_RESERVEE_CAO`, 409 séance non déchiffrée). Réponse du détail :
>   `{ idOffre, numero, lot, formulaires, besoin }`, où `besoin` est le lot de `BesoinEnLigneDto`. PDF : `BORDEREAU`, `DQE` (le même
>   document aux travaux), `CONFORMITE`, `CAPACITES` ; un autre type → 400 **`FORMULAIRE_INCONNU`** ; une partie absente → 404 ;
> - **tolérance** : « 1 Ar par ligne » s'applique aux totaux, soit un écart toléré égal au nombre d'articles du lot ;
>   `LETTRES_DIVERGENTES` se déclenche à 1 Ar près, et un texte que le serveur ne sait pas lire ne lève rien ;
> - **`LIVRAISON_HORS_DELAI`** : le délai de la fiche (`B06-EO-11` / `B06-EO-12`, à défaut `B09-DX-01`, en jours) est compté **depuis
>   l'ouverture des plis**, faute de date de notification ;
> - **`LIQUIDITE_INSUFFISANTE`** : le seuil retenu est le plus exigeant entre `QT-14` et `QT-15` % du **TTC recalculé** ;
>   **`CA_INSUFFISANT`** : moyenne des `meilleures` années parmi les `annees` dernières ; **`REFERENCES_INSUFFISANTES`** : cumul des
>   `nombre` meilleurs marchés de la période. Les contrôles du lot 5b ne jouent que si le manifeste porte la partie concernée ;
> - code ajouté : **`FORMULAIRES_ILLISIBLES`**, pour une analyse impossible ; l'offre reste lisible ;
> - `totaux` de la lecture : ce sont les totaux **recalculés** par le serveur, pas ceux déclarés ;
> - au passage : `GARANTIE_INSUFFISANTE` (V70) lit désormais aussi le minimum des travaux, `B05-GQ-03`.

---

## B4 — Journal et conservation

- **Journal** : `OFFRE_LUE` (ou l'événement existant de la lecture) mentionne `formulaires: true` et le nombre d'alertes.
  Aucun prix ne va dans le journal.
- **Conservation** : la partie `formulaires` vit et se purge avec l'offre déchiffrée (V70). Aucune table de plus n'est
  demandée **si** le backend relit le manifeste à la demande. S'il préfère indexer les prix, par exemple pour un futur tableau
  comparatif des offres, il suit la même purge.

> ⚠️ **2026-10-05 — livré, conforme.** Aucune table ni migration. À l'ouverture, seuls les **totaux recalculés** et les **alertes**
> sont gardés avec la lecture de l'offre (`t_offre.LECTURE`), au même titre que les montants de l'acte d'engagement. Le détail ligne à
> ligne se relit dans le contenu déchiffré et se purge avec lui. `OUVERTURE_OFFRE` dit « formulaires : n alerte(s) », sans aucun prix.

---

## Hypothèses (à confirmer ou corriger)

- **H1 — Marché à commande : le montant de l'AE est celui des quantités MAXIMALES.** `montantHt`/`montantTtc` = au maximum ;
  `htMin`/`ttcMin` sont lus en plus. *À confirmer par le pilote et le backend sur le DAO 2463 : l'AE type porte-t-il les deux
  montants ?*
- **H2 — Contrat-cadre** : traité comme quantité fixe sur `quantite`, la quantité indicative.
- **H3 — Les neuf taux du K1** (a1 à a9, groupes A1/A2/A3) et la formule
  `K1 = (1 + A1/100) × (1 + A2/100) / (1 − A3/100 × (1 + TVA/100))`, arrondie au centième par défaut, sont ceux de l'annexe 2
  de l'AE-T type ARMP. Ils sont **fixes** : le front les porte en constante, la fiche n'a rien à servir. *À corriger si le
  backend veut les rendre administrables.*
- **H4 — Pas de brouillon côté serveur** : les formulaires remplis restent dans le navigateur jusqu'au scellement. Le front
  garde un brouillon **local**, sans prix en clair hors du poste, et l'efface au dépôt. Un brouillon serveur exposerait les
  prix avant l'ouverture, ce que l'ADR-0013 interdit.
- **H5 — Un remplacement d'offre** (`B04-SE-10`) rescelle tout, formulaires compris, comme aujourd'hui.
- **H6 — Fiches validées avant le lot 5** : `formulaires: true` dès qu'il y a un besoin. Aucun paramètre de fiche n'est
  ajouté. *Si le pilote veut que la PRMP puisse choisir le dépôt par pièces seules, un champ `B04-SE-*` OUI/NON suffira.*

> ⚠️ **2026-10-05 — H1 à H6 retenues.** Le serveur ne recalcule pas le K1 (H3) ; aucun paramètre de fiche n'est ajouté (H6).

## Questions

1. **Q1** : le découpage proposé pour `qualification` (B1.2) convient-il ? Les clauses `B03-QT-15` à `B03-QT-20` sont-elles
   toutes résolues **par lot** quand la fiche est saisie par lot ?
2. **Q2** : le PDF rempli (B3.4) est-il produit **à la volée** ou **une fois** à la lecture ? Le front n'a pas de
   préférence : la commission doit seulement pouvoir l'imprimer.
3. **Q3** : la correspondance pièces → formulaire (B1.3) couvre-t-elle les **trois** jeux (fournitures, travaux bâtiment,
   travaux routiers) avec les codes actuels ?

> ⚠️ **2026-10-05 — livré, réponses.**
> - **Q1** : le découpage est retenu ; `references.annees` vient de `B03-QT-12` (période des marchés similaires), `cumul` vaut vrai
>   quand `QT-19` > 1. Sont **par lot** `QT-14`, `QT-15` et `QT-20` ; les autres valent pour toute la fiche. ⚠️ Écart :
>   `qualification` est servie **dans chaque lot** (`lots[].qualification`), résolue pour ce lot, et non une fois en tête.
> - **Q2** : le PDF est produit **à la volée** : rien n'est stocké, il disparaît donc avec la purge du contenu déchiffré.
> - **Q3** : la correspondance se fait sur le **libellé** des pièces de la fiche (bloc B14, saisi librement par la PRMP), car les
>   codes (`PIECE-<id>`) ne disent rien du contenu. Elle couvre les libellés usuels des trois jeux ; la liste figure dans
>   `docs/api-endpoints.md`, § *L'offre saisie dans des formulaires — lot 5*. Un libellé inattendu laisse la pièce **à joindre**,
>   ce qui est le choix sûr.

## Ce que le front fera, et quand

- **Dès B1 livré** — lot 5a :
  - la section « Offre financière » du dépôt (`depot-offre`), entre l'acte d'engagement et les pièces ;
  - les grilles bordereau / DQE / conformité / calendrier, avec calculs, prix en lettres et contrôles **avant** dépôt
    (avertissements, jamais bloquants hors prix manquant) ;
  - l'acte d'engagement dérivé ; le scellement en format 3.
- **Dès B3 livré** : la lecture en séance (totaux, alertes), le détail des formulaires pour la commission, le PDF rempli.
- **Lot 5b** : K1, sous-détail, capacités, personnel et matériel, dans le même format 3, sans nouvelle demande si B1.2 et B3
  sont livrés complets.

> ✅ **Front, 2026-10-05 — lots 5a et 5b livrés** (`673b287`, `e01471f`).
> - **Dépôt** : section 3 « L'offre financière » pré-remplie depuis `…/besoin`. Fournitures : bordereau, dates de livraison, conformité
>   (marque, modèle, caractéristique proposée, conforme). Travaux : DQE par série avec sous-totaux et prix en lettres ; puis K1 (neuf
>   taux, siège), sous-détail des prix `sousDetail`, capacités (exercices, liquidité, références), personnel par poste, matériel
>   (nombre, dont en propre). Les montants de l'acte d'engagement sont **dérivés** du bordereau (H1 au maximum). Seul un prix
>   manquant bloque ; le reste est averti, avec les règles de B3.
> - Une pièce dont le `formulaire` est livré par l'écran porte « Remplie en ligne » et reste ouverte à un justificatif facultatif.
>   Le calendrier des **travaux** reste à joindre (aucun formulaire).
> - **Séance** : totaux recalculés, alertes du lot 5 en clair, et pour la commission les boutons « Bordereau des prix », « Conformité
>   technique », « Capacités » (PDF remplis, `ouvrirBlobSur`).
> - **Recette 5a verte** (fiche 45, fournitures à commande, 3 lots, deux offres sur le lot 1) : totaux recalculés **identiques** à
>   ceux du navigateur, aucune alerte `AE_DIVERGENT`, `NON_CONFORME` et `LIVRAISON_HORS_DELAI` lues, PDF remplis et PV en 200.

## B5 — Une petite suite : les parties que l'offre porte, dans la lecture

La lecture ne dit pas la catégorie du marché, ni les parties du manifeste. L'écran de la commission propose donc les trois documents
remplis à **chaque** offre ; celui qui n'existe pas répond 404 (« ne comporte pas ce formulaire »). L'interroger offre par offre
(`…/formulaires`) ferait un appel par offre.

- Proposition : `LectureDto.offres[]` gagne **`partiesFormulaires`**, la liste des documents productibles pour l'offre, parmi
  `BORDEREAU`, `CONFORMITE`, `CAPACITES` (vide ou `null` sans formulaires). Le front n'affichera que ceux-là.
- Aucune autre évolution n'est demandée.

## B6 — Constat de recette : un planning pris pour une liste (correspondance B1.3)

Recette du 05/10, fiche 46 (pièces de la fiche 32, route) : **`PIECE-102` « Planning de mobilisation du personnel et du matériel »**
est servie `formulaire = PERSONNEL`, `obligatoire = false`. Aucun formulaire ne remplace un **planning** : l'écran l'affiche
« Remplie en ligne », et le candidat peut omettre une pièce exigée. « Liste du personnel » et « Liste du matériel » sont, elles,
justement marquées.

- Proposition : un libellé qui contient **« planning »**, **« calendrier »** (aux travaux), **« plan de »** ou **« échéancier »**
  ne reçoit **jamais** de formulaire, quels que soient les autres mots. Le choix sûr de Q3 (laisser la pièce à joindre) s'applique.
- À vérifier au passage sur les libellés des deux autres jeux (MEN : « Planning de mobilisation », « Liste du matériel » ;
  2463 : « Calendrier de livraison » reste bien `CALENDRIER` en fournitures).

> ✅ **Front, 2026-10-05 — recette 5b verte** (fiche 46, route, pièces, matériel, personnel et seuils de la fiche 32 ; deux offres).
> Totaux recalculés **identiques** à ceux du navigateur, `parSerie` compris (000 / 500 / 600). Offre en défaut partout : les six
> alertes `CA_INSUFFISANT`, `LIQUIDITE_INSUFFISANTE` (seuil 10 % du TTC recalculé), `REFERENCES_INSUFFISANTES`, `PERSONNEL_INCOMPLET`,
> `MATERIEL_INCOMPLET`, `SOUS_DETAIL_INCOHERENT` — les mêmes que les avertissements de l'écran au dépôt. Offre conforme (K1 = 1,21,
> sous-détail à 100 000 000 Ar) : **aucune** alerte. `…/formulaires` en 200, `DQE.pdf` et `CAPACITES.pdf` en 200, PV en 200.
> Restent **B5** (parties de l'offre dans la lecture) et **B6** (le planning pris pour une liste).
