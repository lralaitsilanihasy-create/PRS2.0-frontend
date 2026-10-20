# Demande backend — 2026-10-20 — Le générateur de modèles de PV, fidèle au Word

## Contexte

Le pilote demande, dans l'espace Administrateur, un **générateur de modèles de PV** : l'administrateur rédige chaque modèle dans
Word, et l'application le gère et le remplit. Chaque sous-type de dossier (plan, mise en concurrence, marché, acte de gestion) doit
avoir son modèle, sans intervention technique.

**Arbitrage du pilote (20/10) : fidèle au Word.** Le PV produit garde la mise en page du modèle officiel (en-tête, emblème, mentions,
bloc de visa). Pas d'éditeur de texte à l'écran : on rédige dans Word, l'application contrôle, versionne et remplit.

**Ordre voulu par le pilote :**
1. les PV des dossiers de **mise en concurrence et de marché**, qui n'ont aucun modèle (le PV n° 64 de 00003/DAOO-CC/CNM/2026 n'a pas
   de document, réponse B4 du 19/10 « dossier-marche-lecture ») ;
2. la reprise des **14 modèles du plan** dans le générateur ;
3. le retrait des anciens, une fois les rendus comparés sur des dossiers réels.

Maquette des écrans : `docs/maquette-2026-10-20-generateur-modeles-pv.html`.

## L'existant, sur lequel bâtir

| | PV du plan (aujourd'hui) | Documents de la fiche DAO (aujourd'hui) |
|---|---|---|
| Modèles | 12 PV + 2 lettres de renvoi, `resources/templates/*.docx`, dans le JAR | les documents types ARMP, `resources/modeles/dao/` |
| Variantes | **un fichier par combinaison** : avis (AFSR / AF / ANF) × AGPM × centrale / régionale, choisi par `PvDocumentGenerator.modele()` | **un fichier**, sections `{{SI:NOM}} … {{FINSI:NOM}}` |
| Variables | marqueurs du métier entre chevrons : `<REFERENCE PV >`, `<DATE EXAMEN>`, `<ENTITE CONTRACTANTE>`, `<CHEF LIEU>` (4 graphies)… | `{{B01-AC-01}}`, `{{NUM}}`, `{{IMAGE:…}}` |
| Conditions | aucune : le choix du fichier en tient lieu | **déclarées** en tête du fichier, évaluées par `ConditionsModele` (ADR-0011) |
| Répétition | la ligne de l'annexe (point / au lieu de / lire) dupliquée par observation, en dur | — |
| Conversion PDF | documents4j (Word local), retry unique | même chaîne |
| Évolution | un développeur re-dérive les fichiers (`derive-templates.js`, `MakeTemplates.java`) | un développeur |

Le générateur unifie les deux : **le moteur des DAO** (variables, conditions déclarées) appliqué aux **PV**, avec les modèles
**en base** et non plus dans le JAR.

> ⚠️ **2026-10-20, une correction sur l'existant (backend)** : le moteur des DAO ne remplit pas de Word. Les documents types sont
> des fichiers de commande `.txt` (`ModelesDao`), rendus en `.docx` par POI et en PDF par OpenPDF. Seul `PvDocumentGenerator`
> remplit un vrai `.docx`, avec les chevrons. Le générateur reprend la **syntaxe** des DAO et leur **grammaire de conditions**
> (`ConditionsModele`), sur un moteur de remplissage du Word écrit pour lui (`ModelePvWord`).

## B1 — Le modèle de données

```
ModelePv ─┬─< VersionModele ─┬─< ConditionDeclaree
          │                  ├─< VariableUtilisee        (relevée au contrôle du fichier)
          │                  └─< ChampSaisi              (défini par l'administrateur)
          └─< Rattachement >── SousTypeDossier          (un sous-type → un seul modèle en vigueur)

PvExamen ── PvGenere >── VersionModele                   (le document produit, figé, et la version qui l'a produit)
```

| Entité | Champs proposés | Règles |
|---|---|---|
| `ModelePv` | id, code, libellé, nature (`PV` / `LETTRE_RENVOI`), état (`ACTIF` / `ARCHIVE`), créé le / par | un modèle archivé ne se rattache plus |
| `VersionModele` | id, modèle, numéro, fichier `.docx` (empreinte SHA-256, taille), état (`BROUILLON` / `EN_VIGUEUR` / `REMPLACEE`), rapport de contrôle, motif, déposée le / par, mise en vigueur le / par | une seule version `EN_VIGUEUR` par modèle ; une version en vigueur ne se modifie pas : on en dépose une nouvelle |
| `Rattachement` | modèle, sous-type de dossier (`PPM`, `PPM-AGPM`, `DAOO`, `DAOO-CC`, `MAOO`, `MAOO-CC`, `AVN`…), du / au | un sous-type a au plus un modèle en vigueur à une date ; sans modèle, le PV n'a pas de document (comme aujourd'hui) |
| `ConditionDeclaree` | version, nom, expression | grammaire de `ConditionsModele` ; les clés ajoutées pour le PV sont listées en B3 |
| `ChampSaisi` | version, code, libellé, type (texte, liste, case, date, nombre, pièce jointe), options, obligatoire, aide, ordre | saisi par le contrôleur à l'examen, repris dans le Word par `{{SAISI:code}}` |
| `PvGenere` | PV, version du modèle, fichier Word et PDF, empreintes, produit le | **figé** : jamais régénéré une fois le PV signé, même si le modèle change |

> ⚠️ **2026-10-20, livré pour G1 (backend, V138), avec trois écarts**
> - **Rattachement sans dates « du / au »** : un sous-type a au plus un modèle par nature (PV, lettre de renvoi), et c'est la clé de
>   la table. Le rattachement courant fait foi ; son historique est au journal du modèle.
> - **`VariableUtilisee` n'est pas une table** : les variables relevées sont dans le rapport de contrôle de la version
>   (`rapport.variables`, `conditionsUtilisees`, `champsUtilises`).
> - **`PvGenere` relève de G2** : rien n'est produit en G1.
> - **En plus** : un journal par modèle (`historique` de la fiche : créé, déposé, conditions, champs, mis en vigueur, rattachements,
>   dupliqué, archivé). `ChampSaisi` porte aussi `visibleSi` (une condition déclarée de la version), comme sur la maquette.

## B2 — La syntaxe, celle des DAO

| Usage | Syntaxe | Exemple |
|---|---|---|
| Variable du dossier | `{{CODE}}` | `{{DOSSIER.REFERENCE}}`, `{{PV.DATE_EXAMEN}}` |
| Variable formatée | `{{CODE|format}}` | `{{PV.DATE_EXAMEN|lettres}}` (« l'an deux mille vingt-six… ») |
| Champ saisi au contrôle | `{{SAISI:code}}` | `{{SAISI:observation_generale}}` |
| Bloc conditionnel | `{{SI:NOM}} … {{FINSI:NOM}}`, `NOM` déclaré | `{{SI:AVEC_RESERVES}}` la clause « sous réserve… » `{{FINSI:AVEC_RESERVES}}` |
| Ligne répétée d'un tableau | `{{POUR:LISTE}}` dans la 1re cellule de la ligne modèle | `{{POUR:OBSERVATIONS}}` puis `{{OBS.POINT}}`, `{{OBS.AU_LIEU_DE}}`, `{{OBS.LIRE}}` |
| Image | `{{IMAGE:nom}}` | l'emblème, s'il n'est pas déjà dans le fichier |

Les conditions se déclarent comme pour les DAO (`CONDITION<TAB>NOM<US>expression`), ou dans l'écran de la version (B4), au choix du
backend.

**La reprise des 14 modèles** : les marqueurs entre chevrons deviennent des **alias** des nouvelles variables (`<REFERENCE PV >` →
`{{PV.REFERENCE}}`, `<CHEF LIEU>` et ses graphies → `{{COMMISSION.CHEF_LIEU}}`…). Un fichier officiel installé tel quel reste donc
lisible. Les 12 fichiers d'un même PV deviennent **un seul modèle**, avec trois conditions : `AVEC_RESERVES`, `AVEC_AGPM`,
`REGIONALE`.

> ⚠️ **2026-10-20, livré (backend), avec des précisions**
> - **Les conditions se déclarent dans l'écran** (Q1), pas dans le Word.
> - **`{{IMAGE:…}}` n'est pas pris en charge** : l'emblème s'insère directement dans le Word, et il est reproduit tel quel. Le
>   contrôle le signale (bloquant).
> - **Un marqueur que Word a coupé** en plusieurs morceaux (correcteur, révisions) est recollé. Un marqueur coupé par une
>   tabulation, un saut ou une image ne l'est pas : le contrôle le nomme, bloquant.
> - **Formats** : `long` (défaut des dates, « 22 octobre 2026 »), `court` (22/10/2026), `lettres`, `majuscules`, `minuscules`.
>   `{{PV.DATE_EXAMEN|lettres}}` rend « deux mille vingt-six et le vingt-deux octobre », la formule des PV du plan.
> - **Reprise des 12 modèles du plan** : relus par le contrôle, ils n'ont aucun marqueur coupé, et leurs chevrons sont tous reconnus.
>   Il leur manque deux choses, qui sont du ressort de G4 :
>   - la ligne de l'annexe doit porter `{{POUR:OBSERVATIONS}}` ;
>   - la formule « L'an … » doit s'écrire `|lettres` (l'ancien générateur la repérait au mot « instituée »).
>
>   La lettre de renvoi emploie quatre chevrons hors catalogue (`<DATE_LETTRE>`, `<NOM_ENTITE_CONTRACT>`, `<REFERENCE DOSSIER>`,
>   `<CORPS DE LA LETTRE>`), à ajouter en G4.

## B3 — Le catalogue des variables

Servi à l'administrateur (`GET /api/modeles-pv/variables?sousType=`), par groupe, avec un exemple :

| Groupe | Variables proposées |
|---|---|
| Commission | `COMMISSION.NOM` (« Commission Nationale des Marchés » ou « Commission Régionale »), `COMMISSION.LOCALITE`, `COMMISSION.CHEF_LIEU` |
| Dossier | `DOSSIER.REFERENCE`, `DOSSIER.SOUS_TYPE`, `DOSSIER.DATE_RECEPTION`, `DOSSIER.ENTITE`, `DOSSIER.PRMP`, `DOSSIER.EXERCICE` |
| PV | `PV.REFERENCE`, `PV.DATE_EXAMEN`, `PV.AVIS` (favorable / favorable avec réserves / défavorable), `PV.DATE_DU_JOUR` |
| Personnes | `PV.PRESIDENT`, `PV.CHEF_COMMISSION`, `PV.MEMBRE`, `PV.VISEUR`, `PV.VISEUR_ROLE`, `PV.INTERIM` |
| Observations | liste `OBSERVATIONS` : `OBS.POINT`, `OBS.AU_LIEU_DE`, `OBS.LIRE` |
| Procédure (mise en concurrence, marché) | `PROCEDURE.NUMERO`, `PROCEDURE.OBJET`, `PROCEDURE.MODE`, `PROCEDURE.FORME`, `PROCEDURE.LOT` |
| Marché | `MARCHE.DOSSIER_MEC` (référence et avis du PV du DAO), liste `TITULAIRES` (`TIT.RANG`, `TIT.CANDIDAT`, `TIT.MONTANT_HT`, `TIT.MONTANT_TTC`, `TIT.DELAI`), `MARCHE.ESTIMATION`, `MARCHE.ECART` |

Clés de condition ajoutées : `avis`, `agpm`, `portee` (centrale / régionale), `sousType`, `forme`, `titulaires` (nombre).

> ⚠️ **2026-10-20, livré (backend)** : `GET /api/modeles-pv/variables?sousType=` sert le catalogue.
> - **Les groupes**, filtrés par la famille du sous-type : `Procédure` pour la mise en concurrence et le marché ; `Marché` et la liste
>   `TITULAIRES` pour le marché seul.
> - **Le reste** : les listes, les clés de condition avec leurs valeurs, les formats et les alias (chevron → variable).
> - **Clés de condition** : `avis` vaut `FAV`, `FAVR`, `DEF` ou `NSP`, les codes de la base ; `forme` est la forme de la fiche ;
>   `titulaires` est le nombre de titulaires proposés ; `saisi.<code>` lit un champ saisi.
> - **Sur un dossier réel**, ces variables se lisent par les règles de la fiche de présentation. Il n'y a qu'un endroit pour elles,
>   et l'aperçu ne peut pas en diverger.

## B4 — Les routes de l'Administrateur

| Route | Effet |
|---|---|
| `GET /api/modeles-pv` | les modèles, leurs rattachements et leur version en vigueur |
| `POST /api/modeles-pv` | créer un modèle (code, libellé, nature) |
| `POST /api/modeles-pv/{id}/dupliquer` | copier un modèle et sa version en vigueur, en brouillon |
| `POST /api/modeles-pv/{id}/versions` (multipart `.docx`) | déposer une version : **contrôle** du fichier (B5), version `BROUILLON` avec son rapport |
| `PUT /api/modeles-pv/{id}/versions/{v}/conditions`, `…/champs` | déclarer les conditions et les champs saisis |
| `POST /api/modeles-pv/{id}/versions/{v}/apercu?dossier=` | produire le PDF sur un dossier réel, **sans rien enregistrer** au dossier |
| `POST /api/modeles-pv/{id}/versions/{v}/mettre-en-vigueur` (motif) | la version remplace la précédente pour les PV **à venir** |
| `PUT /api/modeles-pv/{id}/rattachements` | les sous-types servis par le modèle |
| `POST /api/modeles-pv/{id}/archiver` | retirer le modèle (refusé s'il est le seul en vigueur d'un sous-type, sauf motif) |
| `GET /api/modeles-pv/{id}/versions/{v}/fichier` | télécharger le `.docx` d'une version |

Réservé à l'Administrateur (403 sinon), journalisé (déposé, mis en vigueur, archivé, rattaché).

> ⚠️ **2026-10-20, livré (backend)**, routes et codes dans `PRS20/docs/api-endpoints.md`. Précisions :
> - **Conditions et champs** se remplacent en bloc (`PUT` d'une liste), sur une version en brouillon seulement (409
>   `VERSION_FIGEE`). Chaque déclaration relance le contrôle.
> - **Mise en vigueur** : le motif est toujours exigé (400 `MOTIF_REQUIS`). Elle est refusée sur un rapport bloquant (409
>   `RAPPORT_BLOQUANT`).
> - **Aperçu** : `?dossier=&avis=&format=pdf|docx`, corps facultatif `{ saisis }`. Toute version s'essaie, brouillon compris. Sans
>   Word sur le serveur, le PDF répond 409 `CONVERSION_INDISPONIBLE` : demandez le Word.
> - **Duplication** : sans corps, le code devient `<code>-COPIE`. Les rattachements ne se copient pas, puisqu'un sous-type n'a qu'un
>   modèle.
> - **Archivage avec motif** d'un modèle en service : il est archivé et détaché, et ses sous-types n'ont plus de modèle.

## B5 — Le contrôle d'un fichier déposé

Au dépôt, avant toute mise en vigueur, le serveur rend un **rapport** :
- le fichier est un `.docx` lisible par POI (les quatre pièges des modèles du plan : `xml:space`, `<w:t/>` auto-fermants, ordre des
  entrées, écriture par POI) ;
- chaque `{{…}}` et chaque chevron connu est **reconnu** ; un code inconnu est **bloquant**, nommé avec sa page ou son paragraphe ;
- chaque `{{SI:NOM}}` a son `{{FINSI:NOM}}` et sa condition déclarée ;
- les **sections attendues** sont présentes (en-tête, identification, avis, signatures), repérées par des variables obligatoires
  (`PV.REFERENCE`, `PV.AVIS`, `PV.MEMBRE`…) ;
- une **production d'essai** sur un dossier fictif passe jusqu'au PDF.

Une version au rapport bloquant ne se met pas en vigueur.

> ⚠️ **2026-10-20, livré (backend), avec deux différences**
> - **L'emplacement** : la page n'est pas donnée, car Word seul pagine. `ou` situe le marqueur par « paragraphe n », « tableau t,
>   ligne l, cellule c, paragraphe n » ou « en-tête n ».
> - **Le PDF de la production d'essai** : sans Word, ou si la conversion est désactivée, l'essai s'arrête au Word, avec l'avertissement
>   `ESSAI_PDF_NON_VERIFIE`. Il n'est pas bloquant, pour qu'un serveur sans Word puisse quand même gérer les modèles.
> - **Les sections attendues**, repérées par leurs variables :
>   - pour un PV : `PV.REFERENCE`, `PV.MEMBRE`, et `PV.AVIS` ou un bloc dont la condition lit l'avis (les PV du plan disent l'avis
>     par des blocs) ;
>   - pour une lettre de renvoi : `DOSSIER.REFERENCE`.
> - **Les codes des points** (`VARIABLE_INCONNUE` et sa `suggestion`, `ANCIEN_MARQUEUR`…) sont dans `PRS20/docs/api-endpoints.md`.

## B6 — La production du PV

- À la production du PV d'examen, le serveur prend la version **en vigueur** du modèle rattaché au sous-type, et l'enregistre dans
  `PvGenere`.
- Un PV **signé** garde son document : jamais régénéré, même si le modèle change (le cache actuel `CHEMIN_DOCUMENT` devient la
  règle).
- Un PV **non signé** (projet) est reproduit avec la version en vigueur à chaque production : le dernier visa et la dernière
  signature voient le texte qu'ils signent.
- Sans modèle rattaché : pas de document, et l'écran le dit (comme `PV_CNM_DMC` aujourd'hui, `idPv` sans `lien`).
- Les **champs saisis** se remplissent dans l'écran d'examen du membre (front), et partent avec la soumission de l'examen.

> ⚠️ **2026-10-20, lot G2 (backend)** : rien n'est encore produit par le générateur. Les PV de mise en concurrence et de marché
> restent sans document, et les PV du plan gardent leurs 12 modèles.

## Questions

- **Q1 — Les conditions.** Déclarées en tête du fichier Word, comme les DAO (ADR-0011), ou dans l'écran de la version ? Le front
  propose l'écran : l'administrateur non technique n'a pas à écrire une ligne de déclaration dans Word.
- **Q2 — Le stockage.** Les `.docx` en base (`bytea`) ou sur le disque du serveur avec leur empreinte ? Ils doivent survivre à une
  réinstallation du JAR.
- **Q3 — La conversion PDF.** documents4j (Word local) reste la chaîne ? Elle impose Word sur le serveur de production ; c'est elle qui
  garantit la fidélité au modèle.
- **Q4 — La reprise.** Les 12 PV du plan deviennent-ils un seul modèle à trois conditions (proposition), ou restent-ils 12 modèles
  rattachés par avis, AGPM et portée ?
- **Q5 — Les champs saisis.** Où le membre les remplit-il : dans l'écran d'examen, avant la soumission (proposition), ou à part ?
- **Q6 — La comparaison avant retrait.** Le serveur peut-il produire, pour un PV du plan, le document par l'ancien et par le nouveau
  modèle, et en comparer le texte (comme `comparer-anf-reg.js`), pour décider du retrait sur des dossiers réels ?

> ⚠️ **2026-10-20, réponses (backend)**
> - **Q1 — dans l'écran.** Les conditions se déclarent en base, dans la grammaire de `ConditionsModele`. Le Word n'en porte pas : il
>   n'y a qu'une source.
> - **Q2 — en base (`bytea`).** Les fichiers font quelques centaines de Ko : ils survivent à une réinstallation du JAR et suivent la
>   sauvegarde de la base, avec leur empreinte SHA-256. Les PV produits (G2) garderont le stockage disque actuel (`CHEMIN_DOCUMENT`).
> - **Q3 — documents4j reste la chaîne.** C'est elle qui garantit la fidélité, et elle impose Word sur le serveur de production. Sans
>   Word, l'aperçu se fait en `.docx` et l'essai du contrôle s'arrête au Word, avec un avertissement.
> - **Q4 — au pilote.** Un seul modèle à trois conditions est possible, mais il faut **réécrire le Word à la main** : les 12 fichiers
>   diffèrent par leur texte, et l'ancien générateur porte de la logique écrite en dur. Cette logique doit passer dans le Word, sous
>   forme de blocs et de variables :
>   - le paragraphe « L'an … » repéré au mot « instituée » ;
>   - « INITIAL » remplacé par « MODIFICATIF N°n » ;
>   - les lignes Président, chef de commission et membre retirées selon le visa ;
>   - la ligne de l'annexe dupliquée.
>
>   Garder 12 modèles demanderait un rattachement par avis et par portée, contraire à la règle « un sous-type, un modèle ».
> - **Q5 — dans l'écran d'examen, avant la soumission** (G3). Les champs sont déclarés dès G1.
> - **Q6 — oui, par le texte** (G4) : chaque document est extrait par POI et comparé paragraphe par paragraphe.
> - **Les 3 PV DAOO-CC déjà signés** en recette (sans document) ne seront pas rattrapés par G2 sans l'accord du pilote. Un PV signé ne
>   reçoit pas après coup un texte qu'aucun signataire n'a vu.

## Lots proposés

| Lot | Contenu | Prérequis |
|---|---|---|
| **G1** | Entités, stockage, routes de l'Administrateur (B1, B4), contrôle du fichier (B5), catalogue (B3) | — |
| **G2** | Production du PV par le générateur (B6) pour les **sous-types sans modèle** : mise en concurrence et marché | G1 ; le pilote fournit ou valide le modèle Word |
| **G3** | Champs saisis à l'examen (front : écran du membre) | G2 |
| **G4** | Reprise des 14 modèles du plan en alias, production comparée (Q6) | G2 |
| **G5** | Retrait des modèles du JAR, une fois G4 validé sur des dossiers réels | G4 |

> ⚠️ **2026-10-20, G1 livré (backend, V138).** G2 attend le modèle Word du pilote pour la mise en concurrence et le marché.

## Côté front

- **G1** : l'écran d'administration « Modèles de PV » (liste, fiche d'un modèle et ses versions, dépôt et rapport de contrôle,
  conditions, champs, rattachements, aperçu sur un dossier), sur la maquette jointe.
- **G3** : les champs saisis dans l'écran d'examen du membre.
- Partout où un PV s'ouvre : « PV sans document » tant qu'aucun modèle n'est rattaché.
