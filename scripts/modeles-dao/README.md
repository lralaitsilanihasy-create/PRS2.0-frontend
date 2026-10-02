# Lot D — le DAO complet sur les documents types officiels

Les documents produits par la fiche DAO (DPAO, DPAC, AE, CCAP) cessent d'être des listes « libellé : valeur » (lot 2a)
pour devenir **le document type de l'ARMP, rempli** : son texte fixe, ses trous remplis par la fiche, les seules
rédactions retenues parmi celles que le modèle propose. Feu vert du pilote le 28/09 ; plan :
`docs/plan-2026-09-28-lot-d-dao-complet.md` ; contrat du moteur : `docs/demande-backend-2026-09-28-lot-d-dao-complet.md`.

Même chaîne que les formulaires du candidat (`../modeles-candidat/`), dont elle réutilise les outils Java (LireDocx,
Decalque) et les normalisations (`propre`, `reduire`).

## Les commandes, dans ce dossier

```
node extraire.mjs [contrat-cadre]        # 1. Word convertit le .doc (armp/), LireDocx le relit → sources/<cle>.txt
node decrire.mjs [DPAC-CC AE-CC]         # 2. structure et sort de chaque trou → modeles/<sigle>.txt et .json
for s in DPAC-CC AE-CC; do java -cp "$(cat ../modeles-candidat/cp.txt);../modeles-candidat/out" Decalque modeles/$s.txt modeles-docx; done
node verifier.mjs DPAC-CC AE-CC          # 3. le rendu dit le modèle, dans les deux sens — code 1 au premier écart
node verifier.mjs DPAC-CC AE-CC --dossier=C:/…/rendus-bruts-du-serveur
```

Prérequis : la chaîne du candidat compilée (`../modeles-candidat/cp.txt`, `../modeles-candidat/out/`). Puis copier
`modeles-docx/*.docx` dans `docs/modeles-dao/` (relecture du pilote et du juriste).

## Le sort de chaque trou

Un trou `<…>` du modèle a l'un de ces sorts, **tous tracés** dans `modeles/<sigle>.json` (`trace`) :

| sort | ce que c'est | garde-fou |
|---|---|---|
| `jeton` | une information de la fiche le remplit : `{{CODE}}`, `{{CODE.lettres}}`, `{{CODE.chiffres}}`, `{{LOT}}`, `{{DERIVE.…}}` | autour des jetons, rien que de la ponctuation, des mots du trou, ou une unité (« mois », « jours ») |
| `choix` | le modèle propose ses rédactions (« choisir entre … / … », « Choix 1 / Choix 2 ») : l'une est gardée **mot pour mot**, dans une section `{{SI:NOM}}` … `{{FINSI:NOM}}` | le texte gardé est une sous-chaîne du trou |
| `retire` | une instruction à l'acheteur (« préciser… », « <choisir…> », exemples) : « à supprimer du contrat finalisé » | ne remplace rien |
| `typo` | une coquille de frappe du modèle (« .Les », « ARTICLE 1 3 ») | même texte à la ponctuation près |
| `adapte` | du **texte fixe** d'un exemple que le document type invite à adapter (« choisir parmi les exemples suivants en les adaptant ») devient un jeton : durée figée, liste de pièces imprimée d'office (01/10, DAO travaux du MEN) | autour du jeton, rien que des mots du texte remplacé, de la ponctuation ou une unité |
| `renvoi` | un **renvoi interne** que nos propres modèles fixent : « Annexe <N° de l'Annexe> » de l'AE-T (le DQE est toujours l'annexe n° 1), « l'article…. du CCAP » (le découpage du forfait est l'article 16 du CCAP-T) — 02/10, fiche 40 v3 | hors les mots du trou, rien qu'un numéro |

Et des lignes entières **retirées**, chacune avec sa raison (`retraits`) : sommaire, bandeaux, intitulés « Choix n » /
« Option n », exemples. Une ligne de la source ni reprise ni retirée fait échouer `decrire.mjs` ; un paragraphe du
modèle qui ne vient pas de la source doit être déclaré en `ajouts` (numérotation automatique « ARTICLE n : »,
clause demandée au juriste, paragraphe fait d'un seul jeton).

**Ce qui reste entre chevrons** se remplit **après** le DAO : par le candidat (identification, compte bancaire,
signature, annexes) ou à la notification (numéro du contrat-cadre, dates, mise au point) — comme dans les formulaires
du candidat, ces crochets restent.

## Les conditions

Déclarées en tête du fichier de commande — `CONDITION<TAB>NOM<US>expression` —, dans la syntaxe des conditions du
référentiel, étendue : `cle = valeur`, `cle != valeur`, `cle contient texte`, `cle renseigne`, `cle vide`, reliés par
`et` (prioritaire) et `ou`. `cle` est une clé de cadrage (`attributaires`, `alloti`, `modeRemise`…) ou un code de
champ de la fiche (`B07-FS-01`) ; une valeur de liste s'écrit comme l'option du référentiel. `decrire.mjs` refuse une
condition utilisée et non déclarée, ou déclarée et jamais utilisée. Decalque ne les imprime pas : le décalque montre
toutes les rédactions, marqueurs compris.

## La preuve, en deux maillons

1. **modèle ≡ document type** — à la construction (`decrire.mjs`) : texte lu, jamais retapé ; trous tracés ; aucune
   ligne perdue sans raison ; aucun texte venu d'ailleurs sans déclaration.
2. **rendu ≡ modèle** — `verifier.mjs`, dans les deux sens, sur le décalque ou sur le rendu **brut** du serveur
   (jetons et marqueurs non substitués).

## Lot D2 — les fournitures (29/09)

`DPAO-F`, `AE-F`, `CCAP-F` : un modèle par document pour la quantité fixe et le marché à commande (sections
`typeMarche`). Deux outils de plus :

- **lecture par cellule** — les sources des fournitures sont extraites avec `LireDocx --paragraphes` (paragraphes d'une
  cellule séparés par RS) et décrites **paragraphe de cellule par paragraphe de cellule** (`sectionCellules`, `rangee`) :
  les rédactions au choix du DPAO sont dans les cellules ; marqueurs `{{SI:…}}` **dans une cellule** et **en rangée**
  (ligne de tableau dont la première cellule est le marqueur) ;
- **émetteur générique** (`emetteur`) — pour un document surtout fixe (l'AE du candidat, le CCAP) : une plage de la
  source reprise telle quelle, trous déclarés remplacés ; le rang d'un repère de fin se compte après le début de la plage.

Le contrat-cadre garde sa lecture d'origine (sans `--paragraphes`) : ses modèles sont inchangés, octet pour octet.

## Lot D3 — les prestations intellectuelles (29/09)

`DPIC-PI` (le tableau des données particulières seulement — arbitrage Q1 du pilote), `AE-PI`, `CPS-PI` (le CCAP et ses
annexes ; les Termes de référence restent une pièce de l'acheteur, Q11). Fidélité 230/230, 300/300, 238/238. Plan :
`docs/plan-2026-09-29-lot-d3-prestations-intellectuelles.md` ; analyse ligne par ligne :
`docs/analyse-2026-09-29-documents-types-pi.md`.

- La grille de notation garde ses **cinq totaux** ; sous-critères, postes et pondérations restent des blancs visibles (Q3).
- Texte officiel reproduit tel quel, coquilles comprises (Q14) — dont une formule du CPS qui finit par `}}`.
- Ce que le modèle donne « par exemple » (termes de paiement, documents contractuels, vérification, clause d'arbitrage)
  est remplacé par la saisie, comme aux fournitures.
- **Leçon de la mesure** : un paragraphe réduit à sa lettre d'option (« d) ») une fois l'instruction retirée se retrouve
  ailleurs dans le document (la grille : « d) <Indiquer le poste> ») et fait sauter la lecture — il est retiré entier.

## Lot D4 — les travaux (29/09)

`DPAO-T`, `AE-T`, `CCAP-T` : le marché ordinaire de travaux (feuille « A tranche_Alloti » du classeur
`DAO_Travaux.xlsx`), quantité fixe et à commande. Tranches communes à tous les lots (Q3) ; texte officiel fidèle (Q5).
Le CCAP produit **ses six annexes** (formule de révision, garanties et cautions de bonne exécution et de restitution
d'avance, cadre du bordereau) : ce sont les modèles des six « formulaires à remplir » que la fiche attendait.
Fidélité 247/247, 363/363, 570/570. Plan : `docs/plan-2026-09-29-lot-d4-travaux.md`.

Le **contrat-cadre de travaux** n'a pas de document type propre : `DPAC-CC` et `AE-CC` le servent, leurs sept choix
« CCAG Fournitures / CCAG Travaux » étant commandés par la catégorie (`CCAG-FOURNITURES` / `CCAG-TRAVAUX`), avec les
codes du contrat-cadre de fournitures (harmonisation demandée au backend, Q1).

Piège rencontré : une section conditionnelle qui dépend d'une autre (la tranche conditionnelle 2 d'un prix unitaire ou
forfaitaire) doit être **imbriquée** dans celle-ci, sinon elle s'imprime aussi sous l'autre forme de prix.

## Avis spécifique d'appel d'offres (30/09, plan `docs/plan-2026-09-30-avis-specifique.md`)

`AVIS-F` (fournitures, les trois formes) et `AVIS-T` (travaux) : le modèle « AVIS SPECIFIQUES » en tête du document
type du contrat-cadre, le seul modèle d'avis des documents types. `AVIS-T` l'adapte aux travaux (« pour exécuter les
travaux suivants : », « Les travaux… », prix mixte), chaque texte adapté étant un **ajout** déclaré. Les informations de
publication (date de l'avis, JMP de l'avis général, supports) sont des jetons `{{AVIS.*}}` que le serveur remplit
avec la saisie faite à l'impression : ce ne sont pas des champs de la fiche. Décalques : 73/73 et 79/79.
