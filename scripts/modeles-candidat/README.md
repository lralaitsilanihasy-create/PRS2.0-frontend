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
