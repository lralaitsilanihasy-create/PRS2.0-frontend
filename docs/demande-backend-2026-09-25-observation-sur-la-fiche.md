# Demande backend — une observation d'examen qui pointe une information de la fiche DAO

*Front → backend, 25/09/2026. Lot B de l'examen de la fiche par la Commission ; le lot A — la fiche en lecture
pour les cinq rôles de contrôle — est livré côté front et n'a rien demandé au serveur.*

## Ce qui existe déjà, et qui suffit pour lire

Vérifié sur les six comptes de test : `GET /api/fiches-marche/{idDmc}`, `…/documents` et
`GET /api/champs-fiche-marche` répondent **200** au Secrétaire, au Membre, au Président, au CC et au
Vérificateur. La Commission lit donc déjà la fiche, son cadrage, ses valeurs, son bilan de contrôles et ses
documents. **Nous ne demandons rien pour la lecture.**

## Le besoin : dire *où* porte une observation

Aujourd'hui, une observation d'examen se rattache à une **ligne du PPM** ou à une **pièce** du dossier. Un dossier
d'appel d'offres, lui, se discute **information par information** : « le délai de validité des offres est de
75 jours, le code en exige 90 » ; « la garantie du lot 2 dépasse 2 % du maximum ». Le contrôleur sait le dire ;
l'application ne sait pas l'écrire.

Il lui manque un point d'ancrage : le **code du champ** de la fiche — et, s'il varie par lot, **son rang de lot**
(clé `CODE#n`, livrée en V43).

## B1 — Porter l'ancrage sur l'observation

Sur l'observation d'examen, deux champs facultatifs :

| champ | type | contenu |
|---|---|---|
| `idDmc` | entier, nullable | la fiche visée (celle du dossier examiné) |
| `champFiche` | texte, nullable | la clé de l'information : `B04-VO-01`, ou `B05-GS-03#2` pour celle d'un lot |

Règles que nous attendons du serveur, parce qu'elles sont métier :

1. `champFiche` sans `idDmc` → **400**. Une clé de champ ne veut rien dire sans sa fiche.
2. `idDmc` qui n'est pas celui du dossier examiné → **409**. On n'observe pas la fiche d'un autre dossier.
3. `champFiche` inconnu du référentiel de cette fiche (forme et catégorie comprises) → **400 nominatif**.
4. Le **rang de lot** est vérifié comme à la saisie : refusé au-delà du nombre de lots du plan, refusé sur un champ
   qui n'est pas `parLot`, exigé sur un champ `parLot` d'une ligne allotie.
5. L'observation reste **valable après révision** de la fiche : elle pointe un code, pas une valeur. Si la version
   suivante change la valeur, l'observation garde son sens — c'est d'ailleurs ce qu'on veut vérifier à la
   contre-visite.

> ⚠️ **Livré le 2026-09-25 (backend, V44) — les cinq règles, sur les deux portes d'écriture** (`/api/examen-details`,
> champs `observations[i].…`, et `/api/observation-controles`), avec ces précisions :
>
> - **Champs d'erreur** : règle 1 → 400 sur **`idDmc`** ; règles 3 et 4 → 400 sur **`champFiche`** ; règle 2 → 409
>   **`FICHE_HORS_DOSSIER`** (aussi quand le dossier examiné ne porte aucune fiche). `idDmc` seul, sans
>   `champFiche`, est admis s'il est celui du dossier.
> - **Deux refus de plus** (400 `champFiche`) : une ligne qui vise **à la fois** une cellule du plan (`champ`, V30)
>   et une information de la fiche — une ligne vise un seul endroit ; une ligne sous un point de portée
>   `SUPPRESSION` (constat de retrait), qui n'accepte déjà aucune cellule.
> - La clé est **normalisée** en majuscules et servie telle qu'enregistrée ; sur une ligne non allotie, `CODE#1`
>   vaut la clé nue (comme à la saisie).
> - Le point sous lequel la ligne est posée est libre (portée `LIGNE`, `DOSSIER`, `FICHE`, `AGPM`) : l'information de
>   la fiche ne dépend pas de la grille.

## B2 — Le relire avec l'observation

En lecture d'une observation (PV, suivi, lettre de renvoi), servir de quoi l'afficher sans second appel :

| champ | contenu |
|---|---|
| `libelleChampFiche` | le libellé du champ, tel que le référentiel le donne (« Délai de validité des offres (jours) ») |
| `valeurChampFiche` | la valeur observée **au moment de l'observation**, figée — la fiche peut avoir changé depuis |
| `lot` | le rang du lot, `null` si l'information est commune |

Sans ces trois-là, l'écran devrait recharger le référentiel et la fiche pour afficher une ligne de PV — et
afficherait la valeur d'aujourd'hui, pas celle qui a été observée.

> ⚠️ **Livré le 2026-09-25 (backend, V44)** — `idDmc`, `champFiche`, `libelleChampFiche`, `valeurChampFiche` et `lot`
> sont servis par **`ObservationControleDto`** (lignes d'examen : `GET /api/examen-details…`, `GET
> /api/observation-controles?detail=`) et par **`ObservationPvDto`** (`GET /api/observations-pv?dossier=`, le
> périmètre figé du PV FAVR, qui nourrit le suivi et la lettre de renvoi — recopiés à la signature, servis à la PRMP
> comme la cellule V30). Précisions :
>
> - **`valeurChampFiche` est la valeur telle que les documents l'impriment** (« 4 000 000 Ariary (quatre millions
>   ariary) », date au format JJ/MM/AAAA, « Oui »/« Non »), lue sur la **dernière version validée** de la fiche —
>   celle dont le dossier porte les documents ; `null` si l'information n'est pas renseignée.
> - **Figée à la pose** de la ligne. Réenregistrer la ligne (`PUT`, ou le remplacement des lignes par
>   `/api/examen-details`) sur la même information de la même fiche **conserve** libellé et valeur, même après une
>   révision de la fiche ; une ligne nouvelle, ou qui change d'information, fige la valeur du moment. Les trois
>   champs de lecture envoyés par le client sont ignorés.
> - Le **libellé figé** de l'observation (`libelle` d'`ObservationPvDto`) et le **PV Word** ne changent pas : c'est à
>   l'écran de composer « libellé du champ, valeur observée, lot ».

## Ce que le front fera ensuite

Sur la fiche en lecture, chaque information portera un geste « Observer », qui ouvre le panneau d'observation de
l'examen avec l'ancrage déjà rempli. Dans le PV et la lettre de renvoi, l'observation s'affichera avec le libellé
du champ, sa valeur observée et son lot, et un lien vers la fiche à l'endroit exact.

Rien ne sera codé tant que le contrat n'est pas servi : comme au lot 1, l'écran se replie — le geste n'apparaît
pas si `champFiche` n'existe pas.

> ⚠️ **Livré côté front le 2026-09-26 (lot B), avec un écart sur le lieu du geste.** Le geste « Observer » ne vit
> **pas** sur l'écran de la fiche en lecture (`/<espace>/dao/:idDmc`), mais **dans l'écran d'examen lui-même** : la
> fiche DAO y est un **quatrième document** (onglet « Fiche DAO », à côté du plan, de la fiche de présentation et de
> l'AGPM), rendu par `shared/prmp/fiche-dao-doc.ts`, dès que le dossier examiné porte un `idDmc`. Raison : c'est
> l'examen qui connaît le point de contrôle, la ligne et la ligne d'observation en cours — un geste posé sur l'écran de
> la fiche aurait dû les deviner, ou faire naviguer l'examinateur hors de son examen. Le patron est celui de V30
> (cellules observables, pastilles numérotées, « Au lieu de » pré-rempli de la valeur affichée) ; la ligne posée
> porte `idDmc` + `champFiche` (`CODE#n` pour un lot) et jamais `champ`. Dans le PV (page du Membre, modale du
> circuit, carte partagée Vérificateur/PRMP), l'observation dit « Information de la fiche DAO : *libellé* — lot *n* ·
> valeur observée « … » », avec le lien « Ouvrir la fiche » vers `/<espace>/dao/:idDmc` sur la carte partagée.
> Pas d'écran de lettre de renvoi touché : elle reprend le libellé figé du PV, qui porte déjà le contexte.

## Une question, avant de coder

**Qui peut observer une information ?** Nous supposons : les mêmes que ceux qui portent une observation d'examen
aujourd'hui, sans élargissement. Si l'examen d'un DAO devait ouvrir ce geste à un rôle qui ne l'a pas (le
Vérificateur, par exemple), dites-le — c'est une règle d'habilitation, elle vous appartient.

> ⚠️ **Réponse du backend (2026-09-25) : aucun élargissement.** Observer une information de la fiche, c'est écrire une
> ligne d'observation d'examen : mêmes profils, mêmes gardes — le **Membre attributaire**, le CC ou le Président par
> délégation dans leur localité, examen modifiable jusqu'à `PV_SIGNE`. Le **Vérificateur** n'observe pas : il statue
> sur les observations du PV (levée / maintenue), il n'en émet pas. Le geste « Observer » ne s'affiche donc qu'à ceux
> qui peuvent déjà écrire une ligne d'observation.
