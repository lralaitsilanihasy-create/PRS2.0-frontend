# Cohérence du DAO « Fournitures et services » — le classeur officiel contre le référentiel servi

*Vérification demandée par le pilote le 24/09/2026, sur `NatureMarches/DAO_Fournitures et Services.xlsx`.*

Le référentiel des fournitures avait été converti le 23/09 depuis le **PDF** « carte des informations » (37 p.).
Le classeur Excel officiel est arrivé depuis. Cette note le compare, feuille par feuille, à ce que le serveur sert
aujourd'hui — chaque ligne du classeur cherchée parmi les champs servis, chaque champ servi cherché dans le classeur.

> ⚠️ **25/09 — la vérification à la main est faite : les deux listes fermes sont au §5.** Une reprise décide du
> contenu des documents produits, ce que l’audit de la veille ignorait ; dix champs sont à corriger, trois écarts
> signalés étaient faux.
>
> ⚠️ **Arbitrage du pilote, 24/09 : « ne change rien ».** Les écarts décrits ci-dessous sont **constatés et
> laissés en l’état** — ni les quatre reprises de trop, ni la lettre d’invitation ne donnent lieu à une livraison
> aujourd’hui. Ce document reste le relevé qui permettra d’y revenir quand le pilote le décidera.

## Verdict

**Le référentiel est fidèle au classeur.** Les 427 informations à saisir des trois feuilles sont couvertes, aux
consolidations près (les branches d'un même choix — « caution / garantie bancaire / chèque de banque » — sont un seul
champ de type liste, décision actée le 23/09). Quatre écarts réels sont listés plus bas ; un seul demande une
livraison.

| feuille | lignes d'information | dont du plan | dont à saisir | champs servis | couverture |
|---|---|---|---|---|---|
| Quantité fixe | 158 | 22 | **130** | 139 (23 plan · 104 saisie · 12 cadrage) | **130 / 130** |
| À commande | 165 | 22 | **136** | 146 (23 · 111 · 12) | **136 / 136** |
| Contrat-cadre | 188 | 21 | **161** | 148 (23 · 112 · 13) | **159 / 161** |

Les quatre lignes que le rapprochement automatique ne trouvait pas sont en réalité servies — l'orthographe seule
différait (« Autorisation du **Fabriquant** » → `B03-CQ-05` « Autorisation du **fabricant** exigée »), ou la ligne
était une branche consolidée (« Fournisseur unique » → `B08-PA-01`, « ACOMPTE??? » → `B08-AC-01`, « Stockage de
fourniture / Applicable ou pas » → `B09-SK-01`).

## 1. ⚠️ La lettre d'invitation : un document du contrat-cadre qui n'existe pas dans le référentiel

La feuille **Contrat-cadre** a une cinquième colonne de document, **« Lettre d'invitation »**, que les deux autres
feuilles n'ont pas. Elle porte **7 reprises** et surtout **2 informations à saisir qui n'appartiennent qu'à elle** :

| ligne | information | DPAC | AE | CCAP | Lettre |
|---|---|---|---|---|---|
| L33 | **Date du contrat-cadre** | — | — | — | **à saisir** |
| L34 | **Objet du marché subséquent** | — | — | — | **à saisir** |

Ni le document ni ces deux informations n'existent aujourd'hui : `DocumentDao` connaît `DPAO`, `DPAC`, `DPIC`, `AE`,
`CCAP` — pas de lettre d'invitation — et aucun champ servi ne porte ces deux libellés. C'est **le seul manque de
fond** de cet audit.

C'est cohérent avec le geste réel : dans un contrat-cadre, la remise en concurrence des titulaires passe par une
lettre d'invitation, qui porte la date du contrat-cadre et l'objet du marché subséquent demandé. Deux décisions
possibles :

1. **l'ajouter** — une valeur `LETTRE_INVITATION` au document maître, deux champs dans le bloc B07 (marchés
   subséquents), et la lettre rejoint les documents produits par la fiche ;
2. **l'écarter pour l'instant** et le noter : la lettre est un document d'exécution du contrat-cadre, pas du dossier
   soumis à la Commission.

*Ma recommandation : l'ajouter, mais au lot 2 (génération), avec les modèles Word — aujourd'hui la fiche n'aurait que
deux champs à montrer pour un document entier.*

## 2. Quatre reprises documentaires en écart

Le classeur marque, pour chaque information, le document où elle **se saisit** (`AS`) et ceux où elle **figure déjà**
(`x`) — ce sont exactement le « document maître » et les « reprises » du référentiel. Comparés champ par champ (sur
les seuls champs appariés à une ligne unique, les consolidations n'étant pas comparables) :

| champ | porte | le classeur dit | écart |
|---|---|---|---|
| `B05-GS-03` Montant de la garantie de soumission | DPAO + AE + CCAP | DPAO seul | **deux reprises en trop** (quantité fixe et à commande) |
| `B02-AU-02` Attribution des lots | DPAO + AE | DPAO seul | une reprise en trop (quantité fixe) |
| `B02-AU-03` Quantités minimum et maximum | DPAO + AE | DPAO seul | une reprise en trop (à commande) |
| `B02-AU-04` Durée de validité du marché à commande | DPAO + AE | DPAO seul | une reprise en trop (à commande) |

Conséquence à l'écran : la pastille « repris dans AE » s'affiche sous ces champs alors que l'acte d'engagement ne les
reprend pas. Rien de faux dans les données, une promesse de trop dans l'affichage.

En **contrat-cadre**, trois champs n'affichent pas le DPAC que le classeur leur donne (`B02-DC-04` conditions de
reconduction, `B06-NO-01` et `B06-NO-02` dates de notification) et cinq en portent un de trop. Ces derniers sont à
vérifier à la main : la rubrique « Durée – Délais d'exécution - Pénalités » compte 27 lignes du classeur pour une
poignée de champs consolidés, et le rapprochement automatique y est peu sûr.

## 3. Ce que le classeur confirme

- **Un contrat-cadre ne produit pas de CCAP.** Sa colonne CCAP porte **112 « x » et zéro « AS »** : l'information s'y
  retrouve, mais rien ne s'y saisit. C'est exactement la règle appliquée par l'écran depuis le lot 4
  (`DPAO → DPAC`, `CCAP → AE`).
- **Les comptes de l'esquisse sont ceux du classeur** : 158 informations en quantité fixe, dont 22 du plan et 130 à
  saisir. Le PDF de 23/09 et le classeur disent la même chose.

## 4. Le classeur lui-même porte des questions ouvertes

Douze lignes de la feuille quantité fixe (douze aussi à commande, une en contrat-cadre) portent un point
d'interrogation — deux le disent en malgache, « **INONA NO SORATANA ETO** » (qu'est-ce qu'on écrit ici ?) :

| ligne | rubrique | texte |
|---|---|---|
| L29, L30 | Lots et variantes | `? INONA NO SORATANA ETO` · `??` |
| L105, L106 | Avance | Remboursement de l'avance`??` · Précompte sur les sommes dues`??` |
| L107 | `ACOMPTE???` | — |
| L110 | Ordres de modifications | `(fa ngah moa azo ajuster-na ny prix??)` |
| L112 | Protection du secret | Si applicable : lieu d'exécution sécurisé`??` |
| L140, L141, L142 | Garantie de bonne exécution`??` · Retenue de garantie`??` · Matériels confiés`??` | Requise ou pas · Pratiqué ou pas · Applicable ou pas |
| L153 | Contrôle des prix de revient | Applicable ou pas`???` |

Le référentiel a tranché chacun de ces points en champ oui/non assorti de ses modalités (`B08-AV-05`, `B08-GB-01`,
`B08-RG-01`, `B09-CR-01`…). Ces choix tiennent, mais ils sont **nôtres, pas ceux du classeur** : si la source doit
être complétée un jour, c'est là qu'il faut regarder.

## Comment cette vérification a été faite

`node scripts/coherence-dao.mjs [QUANTITE_FIXE|A_COMMANDE|CONTRAT_CADRE]` (versé au dépôt avec
`scripts/lire-xlsx.mjs`) : lecture du `.xlsx` sans aucune dépendance (une archive ZIP de XML), rapprochement par
recouvrement de mots entre chaque ligne du classeur et chaque champ servi par
`GET /api/champs-fiche-marche?typeMarche=…&categorie=FOURNITURES_SERVICES`, puis comparaison des ensembles de
documents (maître + reprises contre `AS` + `x`), avec la répartition du contrat-cadre appliquée comme l'écran
l'applique. Rejouable sur les trois formes.

---

## 5. Les deux listes fermes — vérification à la main, 25/09/2026

Le rapprochement automatique signalait huit écarts en contrat-cadre et quatre chez les fournitures. Chacun a été
rouvert ligne à ligne dans le classeur. Trois s'effondrent, dix tiennent.

⚠️ **Ce qui a changé l'enjeu** : en vérifiant la génération, on constate qu'une reprise n'est pas une étiquette
d'écran — **elle décide du contenu des documents produits**. Sur l'acte d'engagement des travaux généré le 24/09,
« Attribution des lots », « Consistance des travaux » et « Montant de la garantie de soumission » sont **absents**,
parce que leurs reprises ne mentionnent pas l'AE ; ils sont dans le DPAO. Une reprise de trop écrit donc une
information dans un document réglementaire qui ne doit pas la porter.

### À corriger — 10 champs, uniquement des reprises, aucune structure

| champ | aujourd'hui | le classeur | correction |
|---|---|---|---|
| `B05-GS-03` Montant de la garantie de soumission *(QF et AC)* | DPAO + AE + CCAP | L71 : DPAO seul | **retirer AE et CCAP** |
| `B02-AU-02` Attribution des lots *(QF)* | DPAO + AE | L27 : DPAO seul | **retirer AE** |
| `B02-AU-03` Quantités minimum et maximum *(AC)* | DPAO + AE | L31 : DPAO seul | **retirer AE** ⚠️ |
| `B02-AU-04` Durée de validité du marché à commande *(AC)* | DPAO + AE | L32 : DPAO seul | **retirer AE** ⚠️ |
| `B02-DC-02` Durée de validité du contrat-cadre *(CC)* | maître AE + DPAC | L44 : DPAC seul | **maître DPAC**, sans reprise |
| `B02-DC-04` Conditions de reconduction *(CC)* | maître AE, sans reprise | L45-47 : DPAC · L127-129 : AE | **maître DPAC + reprise AE** |
| `B05-UM-01` Monnaie en devise *(CC)* | DPAC + AE | L86-87 : DPAC seul | **retirer AE** |
| `B05-PM-02` Le prix est un critère d'attribution *(CC)* | maître AE + DPAC | L156 : AE (et CCAP, qui devient AE) | **retirer DPAC** |
| `B06-NO-01` Date de réception sur l'accusé *(CC)* | maître AE, sans reprise | L103 : DPAC + AE + CCAP | **maître DPAC + reprise AE** |
| `B06-NO-02` Date de remise en main propre *(CC)* | maître AE, sans reprise | L104 : DPAC + AE + CCAP | **maître DPAC + reprise AE** |

⚠️ **Les deux réserves sont levées — le classeur est délibéré** (vérifié le 25/09). L’acte d’engagement d’un
marché à commande reçoit bien la mesure de l’engagement, mais sous une autre forme : le **montant** minimum et
maximum annuel (L68-L69, servis par `B05-TP-02` et `B05-TP-03`, déjà maître AE) et la **date d’effet** (L33, servie
par `B02-AU-05`, déjà maître AE). Les *quantités* et la *durée* restent au DPAO. Rien ne manque à l’acte
d’engagement : les deux reprises y feraient double emploi. **Recommandation : appliquer le classeur.**

Aucune de ces corrections ne touche le front : ce sont dix lignes du référentiel servi, côté backend. Les fiches
déjà validées gardent leurs documents figés — seules les versions suivantes en tiendraient compte.

### À laisser — ce que le rapprochement voyait à tort

| champ | pourquoi c'était un faux écart |
|---|---|
| `B03-GR-01` Groupement autorisé · `B03-GR-02` Forme du groupement · `B05-GS-01` Garantie de soumission exigée | Ce sont des **reflets de cadrage**, pas des champs de saisie : les douze reflets portent un jeu de documents générique, commun aux trois catégories, que l'écran remappe selon la forme. En contrat-cadre, leur `CCAP` devient un `AE` : le rapprochement lisait « AE » deux fois et croyait à une reprise en trop. Le référentiel dit exactement ce que le classeur dit (L51 : saisi au DPAC, figure dans l'AE et le CCAP). |

S'y ajoutent, inchangés : la **lettre d'invitation** (§1, écartée jusqu'à l'exécution des contrats-cadres), les
**consolidations en listes** (arbitrage du 23/09) et les **douze questions ouvertes du classeur** (§4), qui
appartiennent à son auteur.

➡️ Les dix corrections sont écrites, prêtes à partir, dans
`docs/demande-backend-2026-09-25-reprises-documentaires-dao.md`.
