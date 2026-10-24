# Demande backend — 2026-10-23 — Documents du DAO : pas de juriste pour les corrections de forme

## Contexte

Le pilote demande que **les écarts qui ne sont que des fautes d'orthographe soient validés sans passer par le juriste** (23/10).

Aujourd'hui (D-ARMP, `demande-backend-2026-10-22-modeles-dao.md`), la mise en vigueur d'une version d'un document du DAO exige
`{ juriste: { nom, qualite, date } }` **dès qu'il y a un écart** au document type (400 `VALIDATION_JURISTE_REQUISE`). Le front ne peut
pas lever cette exigence : elle est tenue par le serveur, et c'est voulu.

En recette, les 15 brouillons `DAO-<sigle>` (ids 41 à 55) portent **272 écarts**. Ils viennent de la relecture des documents types
(`frontendprs2/PDF_generes/Relecture-documents-types-DAO-2026-10-22.pdf`) : orthographe, accords, ponctuation, et quelques mots
manquants. Le front les a classés avec la règle proposée en B1 :

| Classe | Nombre | Exemples |
|---|---|---|
| **Forme** | 230 | « pré - qualification » → « pré-qualification » ; « para fiscales » → « parafiscales » ; « Pariculières » → « Particulières » ; « ne tombe pas » → « ne tombent pas » ; « GROUPEMENTS » → « GROUPEMENT » ; « commande » → « commandes » |
| **Fond** | 42 | « ne se conforme soit » → « ne se conforme **pas** soit » (CCAP-T, la clause de résiliation change de sens) ; « adopté par 2006-343 » → « adopté par **décret n°** 2006-343 » ; « Les rémunérations commissions » → « Les rémunérations **ou** commissions » ; phrase réécrite (AE-CC, l. 179) ; phrase dupliquée retirée (CCAP-T, l. 464) |

Par document : DPAO-T, DPIC-PI, LETTRE-PI et LETTRE-AOR n'ont que des écarts de forme ; CCAP-T en a 10 de fond, AE-F 6, CCAP-F 5.

## B1 — Chaque écart classé : forme ou fond

`GET …/versions/{n}/ecarts` sert, pour chaque écart, `nature: "FORME" | "FOND"`, calculée par le serveur :

- **FORME** quand l'écart est `MODIFIE` et que :
  - les deux lignes sont identiques une fois ignorés la casse, les accents, la ponctuation, les espaces, les tirets et les
    apostrophes (« ci - après » / « ci-après », « dans: » / « dans : ») ;
  - **ou** elles ont le même nombre de mots (après la même normalisation) et chaque mot qui change ne diffère que de **deux lettres au
    plus** (distance d'édition ≤ 2 : « Pariculières », « tombe » / « tombent », « nationale » / « national »).
- **FOND** dans tous les autres cas : mot ajouté, retiré ou remplacé, ligne ajoutée (`AJOUTE`) ou retirée (`RETIRE`), règle modifiée.

Les jetons (`{{B01-AC-01}}`) et les marqueurs de passage comptent comme des mots : en changer un est du fond.

> ⚠️ **2026-10-23, livré (backend), avec trois garde-fous et un ajout**
> - **Garde-fous** (toujours **fond**, même quand la règle de B1 dirait forme) :
>   - un nombre dont les chiffres changent (« 30 » / « 60 ») ; « 30ème » / « 30e » reste de la forme, car les chiffres sont gardés ;
>   - un mot de **3 lettres ou moins** qui change de plus d'une lettre (« ou » / « et » change le sens ; « des » / « du » aussi) ;
>   - un jeton ou un marqueur de passage, comparés à l'identique, comme demandé.
> - **Ajout** : un changement de **style seul** (PARA → CENTRE, même texte) est de la forme.
> - **Sur les 15 brouillons de recette** (ids 41 à 55), classés par le serveur : **272 écarts, 222 de forme, 50 de fond**, tous des
>   lignes modifiées. Par document (fond / total) :
>
>   | Document | Fond / total | | Document | Fond / total |
>   |---|---|---|---|---|
>   | DPAC-CC | 3 / 19 | | DPAO-T | 0 / 11 |
>   | AE-CC | 3 / 27 | | CCAP-T | 10 / 55 |
>   | DPAO-F | 2 / 10 | | AE-T | 5 / 24 |
>   | CCAP-F | 5 / 38 | | AVIS-F | 2 / 4 |
>   | AE-F | 8 / 24 | | AVIS-T | 2 / 3 |
>   | DPIC-PI | 2 / 6 | | LETTRE-PI | 0 / 4 |
>   | CPS-PI | 3 / 26 | | LETTRE-AOR | 0 / 3 |
>   | AE-PI | 5 / 18 | | | |
>
> - **Écart avec le classement du front** (42 de fond) :
>   - deux écarts passent en fond par le garde-fou des mots courts : CCAP-T l. 474 (« des CCAG » → « du CCAG ») et DPIC-PI l. 51
>     (« la » → « le », « des » → « du ») ;
>   - les autres relèvent de mots ajoutés, retirés ou remplacés : « a » → « ont », « feront » → « fera », « l'article » → « la
>     clause », « leur » → « son », etc. Elles viennent sans doute d'un appariement des lignes un peu différent de celui du front. Le
>     panneau sert la nature de chaque écart.

## B2 — La validation du juriste, seulement pour le fond

- **Mise en vigueur** : `juriste` n'est exigé que s'il y a **au moins un écart de fond** (400 `VALIDATION_JURISTE_REQUISE`,
  `details.nbEcartsFond`).
- **Sans écart de fond**, la mise en vigueur passe avec le seul motif ; le journal du modèle et le journal général portent : « n
  correction(s) de forme au document type, sans validation juridique (arbitrage du pilote du 23/10) ».
- **Avec des écarts de fond**, le juriste valide la version entière, comme aujourd'hui ; le journal dit « n de forme, m de fond,
  validés par … ».

> ⚠️ **2026-10-23, livré (backend)**
> - Détails du 400 : `nbEcartsFond` et `nbEcartsForme`.
> - Journal du modèle, comme demandé. Journal général : entrée `ECARTS_DOCUMENT_TYPE` (champ = sigle) dans les deux cas.

## B3 — Le rapport de contrôle

Le point `ECARTS_ARMP` (niveau `INFO`) dit les deux nombres : « 24 écarts au document type : 21 de forme, 3 de fond — la mise en
vigueur demandera la validation du juriste » ; ou, sans fond, « 11 corrections de forme : pas de validation du juriste ».
`CONFORME_ARMP` reste quand il n'y a aucun écart.

> ⚠️ **2026-10-23, livré (backend)**
> - Les libellés de `ECARTS_ARMP` sont ceux demandés.
> - Chaque `ECART_ARMP` commence par « [forme] » ou « [fond] » ; la nature est aussi servie par `/ecarts`.

## Questions

- **Q1 — Les petits mots ajoutés ou retirés.** Une négation (« pas »), une conjonction (« ou »), une préposition (« de », « d'une »),
  un pronom (« nous nous engageons ») : le front propose de les laisser **en fond**, car ils peuvent changer le sens (« ne se conforme
  pas »). Le pilote peut en décider autrement : il faudrait alors une liste fermée de mots-outils.
- **Q2 — Les écarts déjà validés.** Une version déjà mise en vigueur avec un juriste garde sa validation ; rien n'est recalculé.

> ⚠️ **2026-10-23, réponses (backend)**
> - **Q1 — En fond**, sans liste de mots-outils : un mot ajouté ou retiré change le nombre de mots.
> - **Q2 — Gardée** : rien n'est recalculé pour une version déjà en vigueur.

## Côté front

À la livraison :
- le panneau « Écarts avec le document type » distingue les écarts de forme (gris, « forme ») et de fond (ambre, « fond »), avec un
  filtre « fond seulement » ;
- la fenêtre de mise en vigueur ne demande le juriste que s'il y a du fond, et dit sinon « n corrections de forme : pas de validation
  du juriste » ;
- les tuiles de l'onglet « Dossier de mise en concurrence » disent « n de fond » (à faire valider) plutôt que le total des écarts.
