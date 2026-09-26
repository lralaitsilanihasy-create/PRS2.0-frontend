# Reconstituer les modèles du candidat — la chaîne

Les six modèles `A1` à `A4`, `C1`, `C2` de `docs/modeles-candidat/` ne sont **pas écrits à la main** : ils sont
**décalqués** des pages 22 à 34 du dossier réel `AOO n° 2463-MI/MESupReS/PRMP/UGPM.2026`
(`NatureMarches/DAO_Fournitures/Fourniture_a_commande.pdf`) par cette chaîne, et **vérifiés** contre lui. Toute
correction demandée par le pilote se fait dans le descripteur, puis se rejoue : jamais dans le `.docx`.

## Les cinq commandes, dans ce dossier

```
node extraire.mjs                        # 1. la source, sans perte  → source-modeles.txt
node classpath.mjs                       # 2. les jars POI du dépôt Maven local → cp.txt (une fois par poste)
javac -encoding UTF-8 -cp "$(cat cp.txt)" -d out Decalque.java LireDocx.java      # 3. les deux outils Java
node decrire.mjs                         # 4. structure + jetons → modeles/<sigle>.txt et .json
for m in A1 A2 A3 A4 C1 C2; do java -cp "$(cat cp.txt);out" Decalque modeles/$m.txt modeles-docx; done
node verifier.mjs A1 A2 A3 A4 C1 C2      # 5. fidélité — sort en code 1 au premier écart inexpliqué
node correspondance.mjs                  #    (et les tableaux de correspondance → correspondance-six.md)
```

Sous Linux ou macOS, le séparateur du classpath est `:` (`classpath.mjs` le sait ; remplacer `;out` par `:out`).
Puis copier `modeles-docx/*.docx` dans `docs/modeles-candidat/`.

## Les fichiers de commande sont la source du rendu

`modeles/<sigle>.txt` (et son descripteur `.json`, qui porte la trace des jetons) sont **versionnés** : sous l'issue
(c) du rendu — le moteur du backend rend les modèles lui-même, docx et PDF —, c'est ce fichier que le backend copie
dans ses ressources, et non le `.docx`, qui reste l'objet de relecture du pilote. Format : un enregistrement par ligne,
type puis tabulation puis texte ; `US` (0x1F) sépare les cellules d'une `LIGNE`, `RS` (0x1E) sépare les paragraphes
d'une cellule ; décrit en tête de `Decalque.java`.

## Vérifier un `.docx` produit par le serveur

Le comparateur sait juger **n'importe quel** `.docx`, pas seulement le décalque : rendu par le moteur du backend en
mode « modèle » (jetons non substitués), il doit dire exactement le même texte que le dossier.

```
node verifier.mjs C1 --docx=C:/chemin/vers/C1-produit-par-le-serveur.docx        # un fichier
node verifier.mjs A1 A2 A3 A4 C1 C2 --dossier=C:/chemin/vers/les-rendus           # les six, nommés <sigle>.docx
```

La sortie nomme chaque fichier vérifié ; un fichier absent compte comme un écart ; code 1 au premier écart. C'est ce
qui prouve que le moteur et le décalque disent la même chose — sans quoi (c) ne serait qu'une promesse. **C'est la
recette de (c)** : six rendus du serveur à jetons non substitués, six fois « identique ».

## Les règles que la chaîne fait tenir

| règle | par quoi |
|---|---|
| **Le texte n'est jamais retapé** | `decrire.mjs` lit chaque ligne dans `source-modeles.txt` par son **début** (`celui`) ou son **texte exact** (`exact`) ; une dérive de la source fait échouer le script au lieu de produire un modèle faux |
| **Ce qui est écrit à la main, c'est la structure** | paragraphes, tableaux (`T`, `L`, `FIN`), cellules qui partagent une ligne du PDF (`couper`), alignements (`D`, `C`, `ST`) |
| **Seuls les blancs et les valeurs propres au 2463 deviennent des champs** | les tables `JETONS_*` ; les blancs du candidat ne sont **pas** jetonnés |
| **Le `.docx` est écrit par POI, jamais par un zip maison** | `Decalque.java` — piège n° 2 de `PRS20/docs/derivation-modeles-docx.md` |
| **La fidélité est vérifiée, pas affirmée** | `LireDocx.java` relit le `.docx` **dans l'ordre du document**, `verifier.mjs` compare caractère par caractère aux pages de la source, jetons rejoués, marqueurs `{{SI:…}}` retirés |
| **On ne décalque pas depuis un texte filtré** | `extraire.mjs` : `-raw -nodiag -enc UTF-8` — le filigrane diagonal écarté, rien d'autre ; la copie de lecture du dossier jette les lignes courtes et un décodage latin1 altère les glyphes |

Ce que le comparateur neutralise, et rien d'autre : espaces multiples, césures du PDF, apostrophes droites ou
courbes, tirets, points de suspension, et les glyphes d'une police de symboles (`U+E000`–`U+F8FF`, constat S6).

## Où sont les décisions

`docs/plan-2026-09-26-modeles-formulaires-candidat.md` (écarts de la source S1-S6, errata E1-E7, besoins N1-N4),
`docs/demande-backend-2026-09-25-formulaires-du-candidat.md` §B8 (le contrat des jetons pour le serveur),
`docs/modeles-candidat/README.md` (les tableaux de correspondance, pour la relecture).
