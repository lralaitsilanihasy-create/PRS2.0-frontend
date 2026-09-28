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
