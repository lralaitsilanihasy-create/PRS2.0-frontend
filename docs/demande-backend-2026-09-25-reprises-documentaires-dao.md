# Demande backend — dix reprises documentaires à aligner sur le classeur officiel du DAO

*Front → backend, 25/09/2026. Suite de l'audit `docs/audit-2026-09-24-coherence-dao-fournitures.md` (§5).*

## Pourquoi ce n'est pas cosmétique

Le classeur officiel « DAO Fournitures et Services » marque, pour chaque information, le document où elle **se
saisit** et ceux où elle **figure déjà**. Ce sont exactement le `documentMaitre` et les `reprises` du référentiel.

En vérifiant la génération du 24/09, on constate qu'une reprise **décide du contenu des documents produits**. Sur
l'acte d'engagement des travaux généré par le serveur, « Attribution des lots », « Consistance des travaux » et
« Montant de la garantie de soumission » sont **absents** — leurs reprises ne mentionnent pas l'AE — et présents dans
le DPAO. Une reprise de trop écrit donc une information dans un document réglementaire qui ne doit pas la porter ;
une reprise manquante l'en prive.

Les dix écarts ci-dessous ont été rouverts **ligne à ligne** dans le classeur, après qu'un rapprochement automatique
en eut signalé douze : trois étaient faux (voir §3), un onzième est écarté par le pilote (la lettre d'invitation).

## B1 — Fournitures et services : quatre reprises en trop

| champ | aujourd'hui | classeur | à livrer |
|---|---|---|---|
| `B05-GS-03` Montant de la garantie de soumission *(quantité fixe et à commande)* | DPAO + AE + CCAP | L71 : DPAO seul | reprises **vides** |
| `B02-AU-02` Attribution des lots *(quantité fixe)* | DPAO + AE | L27 : DPAO seul | reprises **vides** |
| `B02-AU-03` Quantités minimum et maximum *(à commande)* | DPAO + AE | L31 : DPAO seul | reprises **vides** |
| `B02-AU-04` Durée de validité du marché à commande *(à commande)* | DPAO + AE | L32 : DPAO seul | reprises **vides** |

**Sur `B05-GS-03`** : les marques AE et CCAP appartiennent aux lignes 67-68 du classeur, qui décrivent les **formes**
de la garantie (dépôt en numéraire, caution personnelle) — c'est-à-dire `B05-GS-02`, qui les porte déjà
correctement. La consolidation des branches avait glissé les marques d'un champ à son voisin.

**Sur `B02-AU-03` et `B02-AU-04`** — le doute est levé, le classeur est délibéré. L'acte d'engagement d'un marché à
commande reçoit bien la mesure de l'engagement, mais **sous une autre forme** : le **montant** minimum et maximum
annuel (L68-L69 → `B05-TP-02` et `B05-TP-03`, déjà maître AE) et la **date d'effet** (L33 → `B02-AU-05`, déjà maître
AE). Les *quantités* et la *durée*, elles, restent au DPAO. Rien ne manque à l'acte d'engagement ; ces deux reprises
y feraient double emploi.

## B2 — Contrat-cadre : six champs mal orientés

| champ | aujourd'hui | classeur | à livrer |
|---|---|---|---|
| `B02-DC-02` Durée de validité du contrat-cadre (mois) | maître AE + reprise DPAC | L44 : DPAC seul | maître **DPAC**, sans reprise |
| `B02-DC-04` Conditions de reconduction de la période de validité | maître AE, sans reprise | L45-L47 : DPAC · L127-L129 : AE | maître **DPAC** + reprise **AE** |
| `B05-UM-01` Monnaie en devise (appel d'offres international) | maître DPAC + reprise AE | L86-L87 : DPAC seul | reprises **vides** |
| `B05-PM-02` Le prix est un critère d'attribution (multi-attributaire) | maître AE + reprise DPAC | L156 : AE (et CCAP, qui devient AE) | reprises **vides** |
| `B06-NO-01` Date de réception portée sur l'accusé de réception | maître AE, sans reprise | L103 : DPAC saisi, AE et CCAP repris | maître **DPAC** + reprise **AE** |
| `B06-NO-02` Date de remise en main propre au titulaire | maître AE, sans reprise | L104 : DPAC saisi, AE et CCAP repris | maître **DPAC** + reprise **AE** |

⚠️ Rappel de la règle de forme, pour ne pas la réintroduire par erreur : en contrat-cadre, le front remappe à
l'affichage `DPAO → DPAC` et `CCAP → AE`. Les valeurs à écrire en base sont celles du tableau, telles quelles.

## B3 — Ce qu'il ne faut PAS toucher

- `B03-GR-01` (groupement autorisé), `B03-GR-02` (forme du groupement) et `B05-GS-01` (garantie de soumission
  exigée) sont des **reflets de cadrage**, pas des champs de saisie. Les douze reflets portent un jeu de documents
  générique, commun aux trois catégories, que l'écran remappe selon la forme ; en contrat-cadre leur `CCAP` devient
  un `AE`. Le rapprochement automatique lisait « AE » deux fois et croyait à une reprise en trop : **le référentiel
  y dit exactement ce que dit le classeur** (L51 : saisi au DPAC, figure dans l'AE et le CCAP).
- La **lettre d'invitation** du contrat-cadre (cinquième colonne du classeur, deux informations qui n'appartiennent
  qu'à elle) : écartée par le pilote jusqu'à l'ouverture de l'exécution des contrats-cadres.
- Les **consolidations en listes** (branches d'un même choix réunies en un champ) : arbitrage du 23/09, il tient.

## Effet attendu, et ce que cela ne change pas

- Dix lignes du référentiel servi. **Aucune migration, aucun code front.**
- Les fiches **déjà validées gardent leurs documents figés** : la correction ne vaut que pour les versions suivantes.
- Vérification, avant et après : `node scripts/coherence-dao.mjs QUANTITE_FIXE|A_COMMANDE|CONTRAT_CADRE` — le
  rapprochement doit ne plus signaler que les faux écarts du §B3.

## ✅ Livré le 25/09/2026 — contre-recette du front

Le backend a corrigé les dix champs (script `docs/referentiel/2026-09-25-reprises-dao-fournitures.sql` côté PRS20,
rejouable ; aucun redémarrage, le référentiel est relu à chaque requête) et aligné les deux CSV de conversion du
dépôt front (commit `901f34d`). Contre-recette sur le référentiel servi : **les dix valeurs sont celles demandées**,
et les trois reflets de cadrage du §B3 comme le voisin `B05-GS-02` (DPAO + AE + CCAP) sont **intacts**.

⚠️ **Deux signalements subsistent au contrôle automatique, tous deux normaux** — à ne pas « corriger » :

- `B03-GR-02` « en trop AE » : le faux écart annoncé au §B3 (reflet de cadrage, `CCAP` remappé en `AE`) ;
- `B02-DC-04` « porte DPAC+AE, classeur DPAC » : la valeur **est** celle demandée. Le champ figure à deux endroits du
  classeur — L45-L47 côté DPAC, L127-L129 côté AE — et le rapprochement, qui donne chaque ligne à un seul champ, ne
  lui attribue que les premières. C'est une limite de l'outil de vérification, pas un défaut du référentiel.

Les fournitures en quantité fixe et à commande ne signalent plus rien du tout.

## Une observation, sans demande

Le classeur nomme les montants du marché à commande « Montant minimum/maximum annuel **TTC** » (L68-L69). Le
référentiel les sert en « (Ariary) », sans mention de régime, ce qui est cohérent avec l'arbitrage du 18/09 — aucun
montant TTC n'existe dans l'application, tout est hors taxes. Nous ne demandons rien ici ; c'est noté pour que
personne ne « corrige » le libellé un jour en s'appuyant sur le classeur.
