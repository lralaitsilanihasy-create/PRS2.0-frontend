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

> ⚠️ **Livraison backend du 2026-09-28 (§B1).** Conforme. Moteur pur `ConditionsModele`, lecteur `FichierCommande.lireModele` (éléments + conditions
> déclarées), rendu `FormulairesCandidat.rendreModele`, chargement `ModelesDao`. Trois précisions :
> - **« et » dans une valeur** : un `et` / `ou` ne sépare deux termes que s'il est suivi d'un **terme complet** (clé puis
>   opérateur). Sans cela, `B02-PC-02 = Au fur et à mesure des besoins` (DPAC et AE) se serait coupé en deux.
> - **Garde étendue aux formulaires du candidat** : `ModelesCandidat` applique le même contrôle (sections déclarées,
>   emboîtées, refermées), les trois noms historiques restant admis sans déclaration.
> - `=` est **faux** sur une valeur absente et `!=` **vrai** (ce qui donne le sens voulu à `B05-PM-05 != OUI` quand le
>   catalogue n'est pas renseigné). La pile ne fait pas même évaluer une section interne à une section fausse.

## B2 — Deux jetons de plus

- **`{{LOT}}`** : le numéro du lot du document (AE d'un contrat-cadre alloti : « chaque lot faisant l'objet d'un
  contrat-cadre distinct »). Vide hors lot.
- **`{{DERIVE.fin-validite-offre}}`** existe (`B04-LR-03 + B04-VO-01`). Pour le contrat-cadre, la date limite est
  `B04-CP-02` (date-heure, sa date) : même calcul sur ce champ quand `B04-LR-03` n'est pas au référentiel de la forme.
- Rappel du contrat existant, utilisé tel quel : `{{CODE}}` (un `MONTANT` avec son unité), `.lettres`, `.chiffres`, et
  les reflets de cadrage (`{{B08-AV-02}}` = `tauxAvance`, `{{B02-LV-05}}` = `nbLots`). Un jeton sans valeur s'imprime
  en pointillés (R2).

> ⚠️ **Livraison backend du 2026-09-28 (§B2).** Conforme : `{{LOT}}` (vide hors lot) ; `DERIVE.fin-validite-offre` lit `B04-CP-02` (sa date) à défaut de
> `B04-LR-03`.

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

> ⚠️ **Livraison backend du 2026-09-28 (§B3).** Conforme : `DPAC` une fois, `AE` par lot sur une ligne allotie (`saisieParLot`), à la place du lot 2a pour
> le contrat-cadre en fournitures et services ; les autres formes restent au lot 2a. Titres : « Données particulières
> d'appel à concurrence » pour **tout** DPAC (B12 de la demande du contrat-cadre, livré ici) et « Contrat-cadre valant
> acte d'engagement et CCAP » pour l'AE **du contrat-cadre** (le libellé de l'AE des autres formes ne change pas).
> **Écart du modèle à corriger côté front, non retouché ici** (le fichier est copié tel quel) : dans `AE-CC.txt`, cinq
> jetons de **pourcentage** sont suivis d'un « % » écrit en dur — `{{B08-AV-02}} %` (art. 10.3) et `{{B05-PM-04}} %`
> (quatre fois, art. 9.1). `{{CODE}}` imprime déjà l'unité d'un `POURCENTAGE` : le document dit « fixé à 15 % % du montant
> TTC ». Même cas que le « Ariary Ariary » du C1 le 27/09 ; correctif : `{{B08-AV-02.chiffres}} %` et
> `{{B05-PM-04.chiffres}} %`. Le vérificateur ne le voit pas (il juge le rendu **brut**). Je recopierai le fichier corrigé.

> ✅ **Corrigé par le front le 2026-09-28** — `AE-CC.txt` : les cinq jetons passent en `.chiffres`, **et un sixième** du
> même genre, non relevé : `{{B08-FP-04}} point(s)` (art. 15.3, intérêts moratoires) aurait imprimé « 1 % point(s) » →
> `{{B08-FP-04.chiffres}} point(s)`. `decrire.mjs` refuse désormais un jeton nu suivi de « % » ou « Ariary » (éprouvé en
> réintroduisant le défaut). `DPAC-CC.txt` inchangé. Fidélité : 174 / 174 et 378 / 378. À recopier tel quel.

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

> ⚠️ **Livraison backend du 2026-09-28 (§B4).** Conforme : les neuf champs dans le fichier de correspondance du contrat-cadre (front et copie de test) et
> `docs/referentiel/2026-09-28-lot-d-champs-contrat-cadre.sql` (répété à blanc sur DBPRS20 : 9 créations). Contrat-cadre
> servi : 176 champs dans les tests (167 + 9), 176 attendus sur DBPRS20 une fois le script joué.

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

> ⚠️ **Livraison backend du 2026-09-28 (§B5).** `ModelesDaoTest` (6, pur) : grammaire, chargement (14 et 53 conditions ; refus nommés
> d'une condition non déclarée, illisible, en double, d'une section non refermée), imbrication, les deux fiches types de la
> demande (mono / non alloti / papier / non reconductible ; multi / 2 lots / électronique / reconductible, « LOT n°1 » et
> « LOT n°2 »), rendu brut écrit dans `target/modeles-dao/`. `FicheMarcheCommandeEtContratCadreIntegrationTest` : cas 4 et 6
> lus sur le document type, cas 7 — production d'une fiche allotie (DPAC, AE lot 1, AE lot 2) et d'une fiche à commande
> (lot 2a inchangé). Suite complète : 1411 tests, 0 échec. **Recette** (PowerShell, JDK 21 en tête du PATH, rendus bruts
> copiés dans `C:\Users\LANTO\rendus-dao`) :
> 
> ```
> ✓ DPAC-CC (C:/Users/LANTO/rendus-dao/DPAC-CC.docx) : 174 unités attendues, 174 rendues — 0 manquante(s) ou hors d'ordre, 0 inventée(s)
> ✓ AE-CC (C:/Users/LANTO/rendus-dao/AE-CC.docx) : 378 unités attendues, 378 rendues — 0 manquante(s) ou hors d'ordre, 0 inventée(s)
> exit=0
> ```

## Ce que le backend rend

B1 à B5, `docs/api-endpoints.md` (contrat des modèles : enregistrement `CONDITION`, grammaire, `{{LOT}}`),
`docs/regles-gestion.md` (§ fiche marché, documents produits), un ADR si le moteur de conditions le justifie
(prochain : ADR-0011), et un encadré ⚠️ daté ici pour tout écart.

> ⚠️ **Livraison backend du 2026-09-28 (rendu).** Moteur, deux modèles copiés tels quels (`src/main/resources/modeles/dao/`), neuf champs, ADR-0011,
> `docs/api-endpoints.md` (§ *Le DAO complet sur les documents types officiels — lot D*) et `docs/regles-gestion.md`
> (§ du même nom). Pas de migration. Les questions Q1 à Q5 du plan restent au pilote : Q1 est appliquée comme recommandée
> (la demande B3 l'exige) ; Q2 (dix obligatoires rendus facultatifs, `B07-DU-06` désactivée) n'est **pas** faite, faute
> de décision.

> ✅ **Recette réelle du front, 2026-09-28 — verte, un écart de rendu PDF.** Accord du pilote pour une validation
> **définitive** : fiche 27 (DMC 27, ligne 303095 de PRMP001, « Fourniture de pièces de rechange pour les stations de
> pompage »), contrat-cadre **multi-attributaire, non alloti** (la ligne n'a aucun lot au plan : un seul AE, le cas
> « AE par lot » n'a pas pu être éprouvé sur la base), papier, reconductible, avance 15 %, groupement autorisé,
> validée en version 1 (0 bloquant). Produits : DPAC et AE (docx + pdf), liste des fournitures, bordereau, tableau de
> conformité. Relu dans les PDF, **34 contrôles sur 34** : les rédactions retenues et elles seules (« plusieurs
> titulaires (multi attributaire) », « selon le calendrier fixé ci-après », « Sans objet » pour l'allotissement,
> « n'est pas admise » pour la voie électronique sans la clause du juriste, AOO seul au préambule, « Le contrat-cadre
> n'est pas alloti. Il est multi-attributaire. », pénalités du CCAG, garantie « 12 mois à partir de l'admission ») ;
> **« fixé à 15 % du montant TTC »** et « augmenté de 2 point(s) », aucun « % % » ; aucun jeton ni trou `<…>` resté
> dans le DPAC. Les pointillés « ……… » de l'AE sont les facultatifs laissés vides (R2), les chevrons restants sont ceux
> du candidat et de la notification.
> **Écart** : les **cases à cocher « ❏ »** (U+274F) du modèle — quinze dans l'AE : co-contractant / groupement,
> qualité du représentant, avance souhaitée ou refusée, mise au point, dates de notification — sont **dans le `.docx`
> (15) et absentes du PDF (0)** : la police du PDF n'a pas ce glyphe. Le candidat ne peut plus cocher sur l'imprimé.
> Correctif souhaité côté générateur PDF : une police embarquée qui porte le glyphe, ou, à défaut, un « ☐ » / « [ ] »
> de substitution **au rendu PDF seulement** (le fichier de commande reste celui du document type).
