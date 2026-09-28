# Demande backend — 2026-09-28 — Lot D : le DAO complet, rendu depuis les documents types officiels

**Origine** : feu vert du pilote du 28/09 pour le lot D (« DAO complet »). Les documents produits à la validation de
la fiche (lot 2a : une liste « libellé : valeur » par bloc, `GenerateurDocumentsFiche`) deviennent **le document type
de l'ARMP, rempli** — c'est le « lot 2b » que le générateur annonce lui-même (« c'est lui, et lui seul, que
remplaceront les modèles Word officiels au lot 2b »). Plan : `docs/plan-2026-09-28-lot-d-dao-complet.md`.

**Premier périmètre : le contrat-cadre, fournitures et services** — ses deux documents, le DPAC et l'AE, sont décrits
et vérifiés côté front :

| fichier de commande | document | source |
|---|---|---|
| `scripts/modeles-dao/modeles/DPAC-CC.txt` | Données particulières d'appel à concurrence (règlement de la consultation) | document type « Contrat-cadre — Fournitures & Prestations de services » (ARMP 2019), 12 articles |
| `scripts/modeles-dao/modeles/AE-CC.txt` | Contrat-cadre valant acte d'engagement et CCAP | même document, 20 articles et renvois |

Même principe que les formulaires du candidat (demande du 25/09 §B8, `FormulairesCandidat`) : **le fichier de
commande est la source du rendu**, le backend le copie tel quel dans ses ressources (`modeles/dao/`), et le rendu
**brut** du serveur est jugé par le comparateur du front (`node verifier.mjs DPAC-CC AE-CC --dossier=…`). Chaque trou
du modèle y est déjà traité et tracé (`modeles/<sigle>.json`) ; le moteur n'a rien à décider, seulement à évaluer.

## B1 — Un moteur de conditions déclarées (le seul vrai changement de code)

Aujourd'hui `FormulairesCandidat.Contexte.condition()` connaît trois noms écrits en dur (`A1B`, `B04-SE`,
`A3B-NATURES`) et un nom inconnu vaut **vrai**. Le DPAC en déclare 14, l'AE 53 : il faut qu'elles se lisent dans le
fichier.

- **Nouvel enregistrement** en tête du fichier, avant les blocs : `CONDITION<TAB>NOM<US>expression` (US = 0x1F, comme
  les cellules). `FichierCommande` le lit au lieu de le refuser (« type inconnu »). Decalque l'ignore déjà (front).
- **Grammaire** — celle des conditions du référentiel, étendue :
  - `cle = valeur`, `cle != valeur` (valeur jusqu'à la fin du terme ; comparaison sans casse, blancs réduits,
    apostrophes droites et courbes confondues) ;
  - `cle contient texte` (même normalisation) — pour reconnaître une procédure par son libellé
    (`B01-AC-13 contient ouvert`) ;
  - `cle renseigne`, `cle vide` ;
  - termes reliés par ` et ` (prioritaire) puis ` ou ` — pas de parenthèses.
- **Ce que vaut une `cle`** : une clé de **cadrage** (`attributaires`, `alloti`, `groupement`, `modeRemise`,
  `typePrix`, `avance`), lue **avec ses réponses par défaut** (`modeRemise` absent = `PAPIER`, comme
  `RemiseElectronique.electronique`) ; sinon un **code de champ** de la fiche (`B07-FS-01`, `B02-DC-03`), valeur de la
  version figée — pour un document de lot, la valeur du lot (`CODE#n`) si le champ est par lot. Une valeur de liste
  se compare à l'option telle que le référentiel la sert (« Marchés uniques non fractionnés ») ; un `OUI_NON` vaut
  `OUI` / `NON`.
- **Sections imbriquées** : aujourd'hui une seule section est omise à la fois (`sectionOmise`). Il faut une **pile** :
  une section fausse omet tout jusqu'à son `FINSI`, sections internes comprises. (Les deux fichiers n'imbriquent pas
  encore — les conjonctions sont écrites avec `et` —, mais le DPAO des fournitures en aura besoin.)
- **Garde au chargement** : une condition utilisée sans être déclarée, ou une expression illisible, fait **échouer le
  démarrage** (ou le test de chargement des modèles), jamais « vrai » en silence. Les trois noms historiques restent
  reconnus pour les formulaires du candidat.

## B2 — Deux jetons de plus

- **`{{LOT}}`** : le numéro du lot du document (AE d'un contrat-cadre alloti : « chaque lot faisant l'objet d'un
  contrat-cadre distinct »). Vide hors lot.
- **`{{DERIVE.fin-validite-offre}}`** existe (`B04-LR-03 + B04-VO-01`). Pour le contrat-cadre, la date limite est
  `B04-CP-02` (date-heure, sa date) : même calcul sur ce champ quand `B04-LR-03` n'est pas au référentiel de la forme.
- Rappel du contrat existant, utilisé tel quel : `{{CODE}}` (un `MONTANT` avec son unité), `.lettres`, `.chiffres`, et
  les reflets de cadrage (`{{B08-AV-02}}` = `tauxAvance`, `{{B02-LV-05}}` = `nbLots`). Un jeton sans valeur s'imprime
  en pointillés (R2).

## B3 — Produire le DPAC et l'AE du contrat-cadre depuis ces fichiers

- À la validation d'une fiche `CONTRAT_CADRE` / `FOURNITURES_SERVICES` : le **DPAC** (un document) et l'**AE** (un par
  lot si la fiche est allotie, sinon un) sont rendus depuis `modeles/dao/DPAC-CC.txt` et `AE-CC.txt`, **à la place**
  des listes « libellé : valeur » du lot 2a pour ces deux types. Titres : « Données particulières d'appel à
  concurrence » (voir aussi B12 de la demande `contrat-cadre-modele-officiel`) et « Contrat-cadre valant acte
  d'engagement et CCAP ».
- Mise en page de `DocumentLibre` (celle des formulaires du candidat) : `TITRE`, `SOUS_TITRE`, `PARA`, `CENTRE`,
  tableaux. Les marqueurs `{{SI…}}` ne s'impriment jamais. Un paragraphe réduit à un seul jeton vide est retiré (R9).
- Les autres formes et catégories gardent le lot 2a tant que leurs fichiers n'existent pas (repli par type, pas de
  bascule générale).
- `[[CLAUSE À FOURNIR PAR LE JURISTE : …]]` (DPAC, art. 5.2, en mode électronique) s'imprime tel quel, comme dans C1 / C2.

## B4 — Neuf champs que le modèle demande et que la fiche n'a pas

Contrat-cadre, fournitures et services, saisie, facultatifs (aucune condition possible : `B09-GP-01` et `B02-DC-03`
sont des saisies, pas des clés de cadrage).

| code | libellé | type | maître | trou du modèle |
|---|---|---|---|---|
| `B04-DS-07` | Adresse de consultation du dossier : nom du responsable | TEXTE | DPAC | art. 3.2 « Nom du Responsable : » |
| `B04-DS-08` | Adresse de consultation du dossier : fonction | TEXTE | DPAC | art. 3.2 « Fonction : » |
| `B04-DS-09` | Adresse de consultation du dossier : bureau, n° de porte, étage | TEXTE | DPAC | art. 3.2 « Bureau, N° porte, étage : » |
| `B04-DS-10` | Adresse de consultation du dossier : localité | TEXTE_LONG | DPAC | art. 3.2 « Localité : <…> » |
| `B09-GP-03` | Délai de garantie des prestations (mois) | NOMBRE | AE | art. 14 « fixé à X mois/ année » |
| `B09-GP-04` | Point de départ du délai de garantie | LISTE : « À partir de l'admission » / « À partir de la date de mise en service » | AE | art. 14 « à partir de l'admission/ de la date de mise en service <choisir> » |
| `B09-GP-05` | Garantie exécutée conformément au CCAG | OUI_NON | AE | art. 14 « Si la garantie est exécutée conformément au C.C.A.G.-FCS, ajouter : … » |
| `B10-RS-02` | Préavis de résiliation sans faute (mois avant la date anniversaire) | NOMBRE | AE | art. 18.1 « <indiquer le nombre de mois> mois » (contrat non reconductible) |
| `B10-RS-03` | Fautes du titulaire ouvrant la résiliation du contrat-cadre | TEXTE_LONG | AE | art. 18.2 « <Lister les différentes hypothèses> » |

Les options de `B09-GP-04` s'écrivent **exactement** ainsi : les conditions de l'AE les citent.

## B5 — Tests

- Chargement : les deux fichiers se lisent, 14 et 53 conditions, aucune condition non déclarée.
- Grammaire : `=`, `!=`, `contient`, `renseigne`, `vide`, `et` avant `ou` ; clé de cadrage avec défaut
  (`modeRemise` absent = `PAPIER`) ; code de champ ; valeur de lot.
- Rendu d'une fiche de contrat-cadre **mono-attributaire, non allotie, papier, non reconductible** puis
  **multi-attributaire, allotie (2 lots), électronique, reconductible** : dans chaque document, les rédactions retenues
  et elles seules (ex. « Le contrat-cadre n'est pas alloti. Il est mono-attributaire. » ; « La transmission de dossiers
  par voie électronique n'est pas admise ») ; deux AE « LOT n° 1 » / « LOT n° 2 » dans le second cas.
- **Rendu brut** (jetons et marqueurs non substitués, conditions ignorées) des deux fichiers, écrit dans un dossier de
  test : le front le juge par `node verifier.mjs DPAC-CC AE-CC --dossier=<ce dossier>` — c'est la recette du lot,
  comme les six formulaires du candidat le 27/09.
- Les autres formes : documents du lot 2a inchangés.

## Ce que le backend rend

B1 à B5, `docs/api-endpoints.md` (contrat des modèles : enregistrement `CONDITION`, grammaire, `{{LOT}}`),
`docs/regles-gestion.md` (§ fiche marché, documents produits), un ADR si le moteur de conditions le justifie
(prochain : ADR-0011), et un encadré ⚠️ daté ici pour tout écart.
