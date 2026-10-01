# Import du DAO — la lecture « par modèle inversé » (lot 0 : prototype et mesure)

Plan : `docs/plan-2026-09-28-import-dao.md` (décisions du pilote du 28/09 : suivre les recommandations ; ancrages tirés
des modèles du lot D). Un DAO rédigé sur le document type se lit à l'envers : le texte fixe du modèle
(`../modeles-dao/modeles/*.json`) se retrouve dans le document, ce qui occupe la place d'un jeton est la valeur, et la
rédaction retenue d'une section conditionnelle dit la réponse. **Lecture seule : on propose, on n'écrit rien.**

```
node lire.mjs <DAO.docx> DPAC-CC [--json=sortie.json]
node mesurer.mjs --dmc=27 --login=PRMP001 --dpac=<DPAC.docx> --ae=<AE.docx> [--un-fichier] [--bruit=<graine>]
```

`mesurer.mjs` confronte la lecture aux valeurs de la fiche qui a produit les documents (aller-retour) ; `--un-fichier`
met DPAC et AE bout à bout (un DAO arrive souvent en un seul fichier) ; `--bruit` altère le document comme le ferait
une autre autorité (typographie, un paragraphe sur dix fusionné avec le suivant, un sur vingt suivi d'un paragraphe
ajouté). Code 1 si une valeur fausse est proposée en confiance haute (critère Q10 du plan).

## L'algorithme — spécification de la route serveur

1. **Normaliser** document et modèle de la même façon (`norm` : NFKC, apostrophes, tirets, guillemets, espaces
   insécables, blancs) ; un paragraphe ou une cellule de tableau est une unité.
2. **Paragraphes à texte fixe**, dans l'ordre, avec un curseur (fenêtre de 60 paragraphes après le dernier reconnu ;
   tout le document tant que rien n'est reconnu) : motif = texte fixe littéral (blancs souples, espace facultative
   autour de la ponctuation), chaque jeton capturé. Un paragraphe qui finit par du texte fixe se reconnaît aussi **en
   tête** d'un paragraphe du document (fusion) : le reste est relu comme un paragraphe à part.
3. **Coupe** : si la capture du dernier jeton d'un paragraphe contient le **début d'un paragraphe suivant** du modèle
   (texte fixe avant son premier jeton, ≥ 6 caractères, dans les 40 suivants), c'est une fusion — la valeur est coupée
   là, le reste relu. ⚠️ 29/09 : aussi quand le paragraphe **finit par du texte fixe** (« … est {{B02-OB-01}}. ») —
   fusionné avec les suivants, il finit encore par un point ; le texte fixe final revient alors au reste relu.
4. **Paragraphes faits d'un seul jeton** : ce qui sépare les voisins reconnus. Plusieurs tels paragraphes dans le même
   intervalle → **ambigu** (signalé, jamais choisi) ; intervalle qui commence comme un paragraphe du modèle → écarté.
   ⚠️ 29/09 : un paragraphe fait de **plusieurs** jetons séparés de ponctuation seule (« {{B02-OB-03}} — {{B02-OB-01}} »)
   ne propose rien (le tiret devient « - » à la normalisation, comme les traits d'union des valeurs).
5. **Réponses déduites** : chaque section dont un paragraphe **à texte fixe** a été reconnu donne les termes `cle =
   valeur` de sa condition (conjonction seulement ; pas de `ou`, pas de `!=`). Un jeton seul n'atteste jamais sa section.
6. **Valeurs** remises dans la forme de saisie du champ (dates `JJ/MM/AAAA` → ISO, montants et pourcentages → nombre,
   pointillés → vide) ; un reflet du cadrage (`B08-AV-02`) devient une réponse de cadrage (`tauxAvance`) ; `.lettres`,
   `{{LOT}}`, `{{DERIVE…}}` ne sont pas des valeurs. Un champ lu deux fois différemment est un **conflit**, pas un choix.

**Confiance** — *haute* : bornée par le texte fixe, dans un paragraphe reconnu tel quel ; une valeur ouverte à droite
ne reste haute que si son type la contraint (nombre, montant, pourcentage, date). *Moyenne* : ouverte à droite (texte),
paragraphe redécoupé, jeton seul d'une section attestée sur un seul paragraphe. *Basse* : jeton seul d'une section non
attestée, intervalle de plusieurs paragraphes, valeur coupée. ⚠️ 29/09 : un paragraphe dont **un autre paragraphe du
modèle a le même texte fixe** (« {{B04-EP-03}} jours avant la date limite… » / « {{B04-EP-04}} jours avant… ») n'est
jamais *haute* — quand l'un n'est pas reconnu, l'autre prend sa place.

**Valeur reprise dans le texte d'origine** (30/09, demande D4 §B6.3) — la reconnaissance travaille sur le texte
normalisé (`norm`), mais une valeur de texte est reprojetée sur le paragraphe tel qu'écrit : « m³ », « ’ », « — »,
« « » » ne sont plus perdus. Les types convertis (nombre, montant, pourcentage, dates, listes, oui/non) restent lus sur
le texte normalisé. Une ligne introuvable laisse la valeur normalisée. `node --test test_reprojection.mjs`.

## Le banc synthétique (29/09) — `banc.mjs`

Les fiches 27 et 16, qui servaient de banc à `mesurer.mjs`, ont disparu avec le vidage de DBPRS20. `banc.mjs` les
remplace pour **tous** les modèles décrits : une fiche fictive par modèle (valeurs générées selon le type du champ servi
par le référentiel, cadrages « tout oui » / « tout non »), rendue comme le moteur du serveur, relue par `lire.mjs` ;
`--bruit=<graine>` applique le bruit de `mesurer.mjs`. À lancer avant tout changement de la lecture (le serveur de
recette doit tourner : le référentiel est lu par l'API).

État au 29/09, après les trois règles ci-dessus : critère Q10 **tenu sur les huit modèles**, sans bruit et sur douze
graines. Rappel sans bruit : DPAC-CC 95 %, AE-CC 100 %, DPAO-F 96-100 %, AE-F 100 %, CCAP-F 88-93 %, DPIC-PI 96 %,
AE-PI 100 %, CPS-PI 65-77 % (ce qui manque : l'objet et la référence repris du plan, que l'import ne propose jamais, et les
termes de paiement, trois jetons seuls au choix signalés ambigus). Avant les règles, la graine 6 rendait une fausse valeur
haute dans l'AE du contrat-cadre (valeur fusionnée avec les deux phrases suivantes). Sur les vrais fichiers restants
(DPAC et AE du contrat-cadre en .docx et PDF, le 2463 en PDF), seul le 2463 change : une valeur qui avalait la suite de
sa phrase passe de *haute* à *moyenne*, coupée.

## Ce que la mesure a établi (28/09, fiche 27, contrat-cadre)

| passe | haute (justes/fausses) | moyenne | basse | réponses déduites | rappel |
|---|---|---|---|---|---|
| sans bruit | 38 / 0 | 23 / 0 | 1 / 0 | 21 / 21 | 98 % |
| 8 graines de bruit (cumul) | 277 / 0 | 190 / 0 | 11 / 7 | toutes justes | 87 à 98 % |

Limites : `.docx` seulement ; l'aller-retour et le bruit simulé ne remplacent pas un DAO réel écrit par une autre
autorité (aucun disponible au 28/09) ; un seul modèle mesuré (contrat-cadre).

**Règle R-c, variante la plus contrainte** (01/10, parité `LectureDao`) — quand deux variantes d'un même paragraphe,
sous des sections différentes, reconnaissent le même paragraphe du document, c'est la plus contrainte qui le prend :
celle qui a le plus de texte fixe, en caractères hors blancs. La recherche porte sur les 8 unités suivantes du modèle.
Cas d'origine : le DPAC du contrat-cadre, « … de {{B04-DS-05.parLot}} libellé … » face à « … de
{{B04-DS-05.lettres}} ({{B04-DS-05}}) libellé … ». Le banc rend désormais les montants en lettres sans parenthèse,
comme le serveur, sinon il masquait ce cas.

**Premier DAO de travaux réel** (01/10, MEN, AOO deux lots, `Documents Types/Travaux/ExemplesDAO/`) — quatre règles,
à porter dans `LectureDao` (parité) :
1. **Frontière des colonnes mesurée par page** (PDF) : l'abscisse de départ la plus fréquente d'un morceau qui suit,
   sur la même ligne de base, un morceau d'une autre colonne (saut > 12 pt), retenue si vue au moins 3 fois ; sinon
   240 comme avant. Ici la colonne des données commence à x ≈ 183 : sous 240, libellés et valeurs se croisaient.
2. **Rangée = même ligne de base à 1,5 pt près** (PDF) : la clause passe avant sa donnée même posée 0,5 pt plus bas.
3. **« MOTS (n) »** : pour un nombre, un montant ou un pourcentage écrit « CENT VINGT (120) », « Cinq (05) »,
   « neuf cent mille Ariary (Ar 9 900 000) », les chiffres entre parenthèses font foi — si rien d'autre que des lettres
   ne les précède.
4. **Point final facultatif** quand du texte fixe le précède (« …sera de CENT VINGT (120) jours », sans point).
5. **Case laissée en blanc** : des pointillés autour d'une unité seule (« ........ Jours …. ») ne sont pas une valeur.
   Les caractères d'usage privé (U+E000-U+F8FF, glyphes de police Symbol : l'astérisque de renvoi « ….* ») sont
   ignorés pour ce test.
6. **Réponse déduite d'un terme `contient`** (01/10, après la livraison backend : `B05-GQ-02` en `LISTE_MULTIPLE`) :
   `CODE contient Option` d'une section retenue ajoute l'option à la liste du champ, **si c'est une option entière** du
   référentiel (« contient bancaire », fragment, ne dit rien). La valeur est la suite des options dans l'ordre du
   référentiel, séparées par des virgules ; deux lectures d'un même DAO donnent la même valeur. Un terme `=` sur le même
   champ qui dirait autre chose est un conflit.

**Banc** (01/10) : il rend aussi les champs que seules les conditions citent, donne **toutes** ses options à un choix
multiple en cadrage « tout oui », coupe les conditions comme le serveur (« Caution personnelle et solidaire » est une
valeur), et **contrôle les réponses déduites** (`déduites j/n`, une fausse fait échouer). Rendu propre : 70/70 justes.
⚠️ Défaut connu, antérieur, révélé par ce contrôle : graine 6, CCAP-T « tout oui », `B05-GE-01 = OUI` déduit alors que le
rendu dit NON — un paragraphe bruité atteste une section de bonne exécution. À instruire (la même logique vit dans
`LectureDao`).
`PdfLignes` : la fin d'un morceau est celle de sa dernière lettre (une espace finale, retirée du texte, collait le
morceau suivant). Banc : rappel identique sur les 18 passes, Q10 tenu (propre et graines 3, 6, 11). 2463 : +3 valeurs
justes (B04-DE-02/03, B06-EP-01), aucune perdue.
