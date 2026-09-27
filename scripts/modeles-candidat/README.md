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

## Chaîne ARMP — les modèles sur les documents types officiels (27/09)

Arbitrage du pilote du 27/09 (« Ajuster par rapport aux officiels ») : les formulaires du candidat sont ceux du
**document type de l'ARMP** (`Documents Types/Fournitures et services/3-Document type d'appel d'offres_Fournitures_
Formulaires de soumission.doc`, déposé par le pilote, non suivi), dont le dossier 2463 n'était qu'une adaptation.
Même principe, autre source, autre comparateur ; les fichiers de commande vont dans `modeles-armp/`.

```
node classpath.mjs                       # cp.txt — commons-lang3 compris (les .docx écrits par Word l'exigent)
javac -encoding UTF-8 -cp "$(cat cp.txt)" -d out Decalque.java LireDocx.java
node extraire-armp.mjs                   # 1. Word (COM) convertit le .doc → armp/formulaires-fournitures.docx (une fois),
                                         #    LireDocx le relit dans l'ordre du document → source-armp.txt
node decrire-armp.mjs                    # 2. structure + jetons → modeles-armp/<sigle>.txt et .json (texte jamais retapé)
for m in A1 A2 A3 A4 C1 C2; do java -cp "$(cat cp.txt);out" Decalque modeles-armp/$m.txt modeles-docx-armp; done
node verifier-armp.mjs A1 A2 A3 A4 C1 C2 # 3. conformité dans les DEUX sens — code 1 au premier fragment manquant ou inventé
node verifier-armp.mjs C1 --docx=C:/…/C1.docx            # un rendu du serveur ; --dossier=<répertoire> pour plusieurs
```

Puis copier `modeles-docx-armp/*.docx` dans `docs/modeles-candidat/armp/` (relecture du pilote).

| ce qui change | par quoi |
|---|---|
| **La source est le texte du `.docx` converti par Word**, pas un PDF | `extraire-armp.mjs` ; `LireDocx` lit run par run : trait d'union insécable (`w:noBreakHyphen` → U+2011, rendu « - » par `propre`), note de bas de page (`[note:n]` dans le paragraphe, `[note n] texte` sur la ligne suivante), petites majuscules lues en capitales (comme Word les affiche), une tabulation entre deux cellules même vides |
| **Une section par formulaire**, bornée par son titre et le suivant, cherchée après la « Note aux Utilisateurs » (le sommaire ressemble aux titres) | `armp-commun.mjs` : `section`, clés de recherche à blancs réduits (Word sème des espaces insécables : « A3 : ») |
| **Les crochets du candidat restent des crochets**, ceux du dossier deviennent des jetons | `JETONS_C1`, `JETONS_C2`, `jetonAO` (cartouches « N° d'appel d'offres et titre : ___ », le blanc lu dans la source), durées des antécédents `B03-CQ-09` / `B03-CQ-10` (A1, A3 : « cinq », « trois » et « [nombre d'années] ») ; A2 et A4 n'ont aucun jeton ; les glyphes de police Symbol (cases à cocher, U+E000–U+F8FF) sont écartés comme au 2463 (S6) |
| **Ce que Decalque n'a pas** — listes numérotées, notes, cellules fusionnées — est rendu dans le texte et déclaré | labels « (a) », « a) » écrits et listés dans `ajouts` (retirés seulement en tête de cellule par le comparateur) ; note d'A4 → « (1) » (dans `trace`) ; lignes fusionnées pleine largeur en paragraphes avant le tableau (A1-c) ou dans la première colonne (A3, A4) ; marqueurs `{{SI:…}}` comme au 2463 |
| **Conformité dans les deux sens** | `verifier-armp.mjs` : chaque fragment du gabarit (cellule ou paragraphe, ≥ 8 lettres ou chiffres, jetons rejoués) se retrouve dans le rendu, **et** chaque fragment du rendu se retrouve dans le gabarit — c'est ce second sens qui a refusé, le 27/09, trois paragraphes complétés de mémoire |
| **Une clause absente du gabarit ne s'invente pas** (remise électronique, 27/09) | C1 et C2 portent, entre `{{SI:B04-SE}}` et `{{FINSI:B04-SE}}`, un paragraphe `[[CLAUSE À FOURNIR PAR LE JURISTE : …]]` visible, déclaré en `ajouts` (`AJOUTS_SE`) : le comparateur le retire du rendu, le moteur ne l'imprime qu'en mode électronique |

`reduire` ne garde que lettres et chiffres (NFKC, minuscules) : casse, blancs, ponctuation, apostrophes, tirets et
pointillés ne comptent pas ; les accents et l'ordre des mots, si. Un titre du gabarit sur deux lignes, une cellule
coupée en paragraphes se retrouvent quand même : les deux textes sont aussi comparés d'un bloc.

## Où sont les décisions

`docs/plan-2026-09-26-modeles-formulaires-candidat.md` (écarts de la source S1-S6, errata E1-E7, besoins N1-N4),
`docs/demande-backend-2026-09-25-formulaires-du-candidat.md` §B8 (le contrat des jetons pour le serveur),
`docs/modeles-candidat/README.md` (les tableaux de correspondance, pour la relecture).
