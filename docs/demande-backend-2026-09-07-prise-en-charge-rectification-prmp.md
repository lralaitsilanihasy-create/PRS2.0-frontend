# Demande au backend `PRS20` — 7 septembre 2026 — Prise en charge AVANT la rectification PRMP

> Règle pilote (07/09) : étendre « **aucune action sans prise en charge** » (04/09, jusqu'ici pour les
> contrôleurs CNM) à la **rectification par la PRMP/UGPM**. La rectification d'un dossier ne doit pas
> être possible tant que la PRMP n'a pas cliqué « Prendre en charge ». Backend d'abord (le mécanisme
> de prise en charge est serveur) ; le front posera ensuite le verrou.

## Le constat — le mécanisme actuel ne couvre pas le PRMP

Sur un dossier en attente de rectification (`EN_ATTENTE_DECISION_PRMP`, ex. #100299),
`GET /api/dossiers/{id}/chronometrage` renvoie :

```
etapeCourante : null
attentePrmp   : true
attributaire  : MEMANT1        (l'examinateur, pas la PRMP)
acteursAttendus : null
taches        : RECEPTION, DISPATCH, EXAMEN, VISA, COSIGNATURE, VERIFICATION  (toutes closes)
```

Il n'y a donc **aucune étape ouverte ni porteur PRMP** pendant l'attente de rectification.
`POST /api/dossiers/{id}/prise-en-charge` répond **409** (« aucune étape n'est ouverte »). Le widget
`<app-chronometrage-dossier>` ne peut proposer aucun bouton « Prendre en charge » à la PRMP, et le
front n'a donc rien sur quoi gater la rectification.

## Demande

Ouvrir une **prise en charge chronométrable pour la PRMP** pendant `EN_ATTENTE_DECISION_PRMP` :

- Une **étape/porteur PRMP** (ex. `RECTIFICATION_PRMP`) est **ouverte** tant que le dossier est en
  attente de rectification, avec la **PRMP propriétaire comme porteur attendu**.
- `POST /api/dossiers/{id}/prise-en-charge` **fonctionne** dans cet état (au lieu de 409), la PRMP
  posant sa prévision comme les autres porteurs (heures ouvrées).
- `GET /api/dossiers/{id}/chronometrage` expose alors, dans cet état, `etapeCourante` = l'étape de
  rectification, `acteursAttendus`/`attributaire` = la PRMP, et le drapeau `actionAutorisee` du widget
  passe à `true` **seulement après** la prise en charge (comme pour les contrôleurs).
- **Gardes serveur en miroir** : `POST /resoumettre` (et l'import/PUT de rectification si vous voulez
  le fermer aussi) **refuse** (403/409) tant que la PRMP n'a pas pris en charge — pour que le verrou
  ne soit pas seulement cosmétique côté front.

Traitement du compteur : à votre main. La rectification PRMP est un temps **suspensif** (déjà compté
en `attentePrmpHeuresOuvrees`) ; la prise en charge sert surtout de **geste** (début d'action + verrou)
et, accessoirement, à mesurer le délai propre de la PRMP. Elle peut donc rester **hors du compteur net
CNM** — dites ce que vous retenez.

## Côté front — après livraison (je m'en charge)

- Monter `<app-chronometrage-dossier>` sur l'écran « Dossiers à rectifier » (`dossiers-a-rectifier.ts`),
  brancher sa sortie `actionAutorisee`.
- **Verrouiller** « ✎ Modifier le dossier » et « Resoumettre le dossier » tant que `actionAutorisee`
  est faux, avec le bandeau « 🔒 Cliquez d'abord Prendre en charge » (même motif que réception/examen/
  visa/vérification).

## Recette de contre-vérification

1. Dossier FAVR en `EN_ATTENTE_DECISION_PRMP`. Ouvrir « Dossiers à rectifier ».
2. Avant prise en charge : « Modifier le dossier » et « Resoumettre » **inertes** (verrou visible) ;
   un `POST /resoumettre` direct → **403/409**.
3. « Prendre en charge » (prévision) → les deux actions **s'activent** ; `actionAutorisee=true`.
4. Rectifier + resoumettre → le dossier repart en `EN_VERIFICATION`.

---

## Note de livraison backend — 2026-09-07 (`PRS20`, commit `9439700`)

Livré sans migration. Contrat : `docs/regles-gestion.md` (§ Chronométrage, « La rectification de la PRMP
se prend en charge elle aussi ») et `docs/api-endpoints.md` (§ Prise en charge, bloc « RECTIFICATION PRMP
— l'étape `RECTIFICATION_PRMP` »). Suite : **826 tests verts**.

### Ce que sert le serveur pendant `EN_ATTENTE_DECISION_PRMP`

| Champ de `GET /api/dossiers/{id}/chronometrage` | Avant | Maintenant |
|---|---|---|
| `etapeCourante` | `null` | **`RECTIFICATION_PRMP`** |
| `acteursAttendus` | `null` | **`["<idPrmp du dossier>"]`** — liste **close** ; `null` si le dossier n'a pas de PRMP propriétaire connue |
| `attributaire` | `MEMANT1` (l'examinateur) | **inchangé**, voir ci-dessous |
| `attentePrmp` | `true` | `true` — le temps reste suspensif |
| `datePrevisionnelleFin` | — | **inchangée** par la prise en charge |
| `taches` | 6 occurrences closes | + `RECTIFICATION_PRMP` **ouverte** dès la prise en charge, au nom de la PRMP |

`POST /api/dossiers/{id}/prise-en-charge` répond donc **200** dans cet état (il répondait 409), avec
`previsionHeures` en heures ouvrées comme partout ailleurs. **403** pour tout autre acteur — contrôleur
de la CNM comme autre PRMP :

```
403 — La rectification de ce dossier revient à la PRMP : elle seule la prend en charge.
403 — La rectification de ce dossier revient à sa PRMP ({nom}) : elle seule la prend en charge,
      puis resoumet.
```

### ⚠️ Il vous reste un geste, sans quoi le verrou reste ouvert

`chronometrage-dossier.ts` court-circuite `peutPrendreEnCharge()` dès que `attentePrmp` est vrai
(« La PRMP, elle, ne porte aucune étape ») : tel quel, le widget **masquera le bouton** et émettra
`actionAutorisee = true` **sans** prise en charge — l'inverse de ce que la demande cherche. Trois points :

1. lever ce court-circuit quand l'étape courante est portée par la PRMP (le reste de la méthode fait déjà
   le travail : `acteursAttendus` est une liste close, elle décide seule) ;
2. ajouter `RECTIFICATION_PRMP` à l'union `EtapeCircuit`, à `ETAPE_CIRCUIT_LABELS` (proposition :
   « Rectification PRMP ») et à `ETAPE_CIRCUIT_PORTEURS` (porteur `PRMP`) ;
3. `tacheChronoVisiblePour` : décider si la ligne apparaît dans le tableau des passages des contrôleurs
   (la PRMP et l'Admin voient tout de toute façon).

### Gardes serveur — les DEUX gestes, pas seulement la resoumission

La demande laissait l'édition optionnelle ; je l'ai fermée aussi, sinon « ✎ Modifier le dossier » serait
resté cosmétique : le contenu passait par l'API sans qu'aucune tâche ne soit ouverte, et le geste qu'on
cherche justement à horodater n'avait pas lieu.

| Geste | Endpoints fermés |
|---|---|
| Resoumettre | `POST /api/dossiers/{id}/resoumettre` |
| Rectifier | `PUT /api/saisies/ppm/{idDossier}` (façade, **import du PPM rectifié compris**), `PATCH /api/ppms/{id}/rectifier`, `PATCH /api/marches/{id}/rectifier`, création/suppression de ligne en rectification |

```
409 — Prenez d'abord en charge la rectification de ce dossier (« Prendre en charge ») :
      elle ouvre votre tâche, et vous permet de rectifier puis de resoumettre.
```

Le message **dit le geste à poser** : affichez-le tel quel si un appel passe malgré le verrou. Le
**brouillon reste libre** — la garde ne mord que sur `EN_ATTENTE_DECISION_PRMP`. La **resoumission clôt**
la tâche : le dossier repart en `EN_VERIFICATION`, plus aucune étape PRMP n'est ouverte, le verrou se
referme seul.

### Arbitrages, à valider par le pilote

- **Hors compteur net CNM**, comme le proposait la demande. Ce temps est déjà compté en
  `attentePrmpHeuresOuvrees` ; l'imputer une seconde fois ferait payer à la Commission l'attente de la
  PRMP. Conséquences visibles : `GET /api/delais-standards` garde ses **huit** étapes (l'étape PRMP n'y
  figure pas, et `PUT /api/delais-standards/RECTIFICATION_PRMP` répond **404** — un réglage invisible
  serait un piège pour l'Administrateur), et **la prise en charge ne déplace pas la date annoncée**.
- **`attributaire` n'est PAS devenu la PRMP**, contrairement à ce que demandait le doc. C'est
  *exactement* la valeur sur laquelle porte la garde de prise en charge d'`EXAMEN` ; y servir la PRMP
  l'aurait désalignée de sa garde, et votre widget ne la lit que dans la branche `EXAMEN`. La PRMP passe
  par `acteursAttendus`, que le widget exploite déjà de façon générique.
- **Une seule étape, pas une par tour de boucle** au sens des occurrences : chaque retour en
  `EN_ATTENTE_DECISION_PRMP` rouvre une occurrence `RECTIFICATION_PRMP` (append-only, comme `VERIFICATION`).
  Le nombre d'aller-retours reste donc lisible dans le tableau des passages.

### Tests

`PriseEnChargeRectificationPrmpIntegrationTest` suit la recette de contre-vérification : l'étape ouverte
et son porteur, le **double refus** avant prise en charge (avec le dossier inchangé), l'ouverture des deux
gestes après, la réserve à la PRMP propriétaire, et le traitement du compteur. S'y ajoutent **sept classes
existantes** qui rectifiaient ou resoumettaient sans prendre en charge : elles passent maintenant par les
helpers `prendreEnChargeRectification(id)` / `resoumettreDossier(id, motif)` du socle — c'est la preuve
que la garde mord sur tous les chemins, y compris l'import.
