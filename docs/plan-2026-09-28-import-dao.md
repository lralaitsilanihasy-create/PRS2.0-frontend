# Plan — 2026-09-28 — Pré-remplir la fiche DAO par l'import du dossier d'appel d'offres

**Statut : arbitré par le pilote le 28/09 (« suivre les recommandations », ancrages tirés des modèles du lot D) ; lot 0
(mesure) fait côté front — `scripts/import-dao/`, critère Q10 tenu ; lot 1 demandé au backend
(`docs/demande-backend-2026-09-28-import-dao.md`) ; lot 2 (écran) après sa livraison.**

> ⚠️ **Arbitrage et mesure du 2026-09-28.** Deux réponses changent depuis la première rédaction :
> - **Q5 — les ancrages** ne sont plus une colonne à renseigner champ par champ : ce sont les **modèles du lot D**
>   (`scripts/modeles-dao/modeles/*.json`). Un DAO rédigé sur le document type se lit à l'envers — le texte fixe se
>   retrouve, la valeur est ce qui occupe la place du jeton, la rédaction retenue d'une section dit la réponse. Pas de
>   migration V51 pour l'import.
> - **Q2 — le périmètre** suit le lot D : on n'importe que les documents décrits. Au 28/09 : le contrat-cadre (DPAC,
>   AE) ; les fournitures après le lot D2.
> - **Q10 — sans autre DAO réel** (pilote : « pas pour l'instant »), la mesure s'est faite en aller-retour sur les
>   documents de la fiche 27 validée, puis avec un bruit simulé (typographie, paragraphes fusionnés et ajoutés), 9
>   passes : **0 valeur fausse en confiance haute** (315 justes), 0 en moyenne (213), 7 en basse (sur 19), réponses de
>   cadrage toutes justes, rappel 87 à 98 %. Le premier jet ne tenait pas le critère (jusqu'à 3 fausses valeurs
>   hautes par passe, dues aux fusions et aux paragraphes ajoutés) : la coupe au début d'un paragraphe suivant, la
>   reconnaissance en tête, et la règle « un jeton seul n'atteste jamais sa section » l'ont rétabli.
>   Limite dite : le bruit simulé ne remplace pas un DAO réel d'une autre autorité.
> Les autres réponses (Q1, Q3, Q4, Q6 à Q9) sont celles du tableau §4.
Demande du pilote (28/09) : « à la création de la fiche DAO, est-il possible d'importer le document DAO pour alimenter
les données de la fiche à la place de la saisie si on a ce document. Si on ne l'a pas, on procède à la saisie. »

**Ce que cela renverse** : la décision du 22/09 « DAO = FORMULAIRE, jamais un import de PDF ». Le renversement est
partiel et le plan le tient ainsi : **la fiche reste le formulaire et la seule source de vérité**. L'import ne crée
rien de lui-même ; il **propose** des valeurs, que la PRMP retient une à une avant qu'elles ne soient écrites par les
routes de saisie existantes. Sans document, rien ne change.

## 1. Ce que l'exploration a établi

| Constat | Conséquence |
|---|---|
| **Serveur** — le seul import existant est celui du PPM (`POST /api/saisies/ppm/import`, part `fichier`, PDFBox 3.0.3, `PDFTextStripper` à plat, contrôle `%PDF`, lecture seule, `AnomalieTranscription(champ, type, gravite, corrige, message)`). Briques réutilisables : extraction, nettoyage d'encodage, lecture des montants et des dates, suggestion par distance de Levenshtein (jamais appliquée d'office), test `pdfAvecTexte()`. `ChampAnomalie` est propre au PPM. | Même patron : **lecture seule, réponse = des propositions**, rien n'est écrit par l'import. L'anomalie devient générique (`champ` = code du référentiel). |
| **Serveur** — aucune lecture « document → valeurs de fiche » n'existe. Le référentiel des champs ne porte **pas** la clause du DAO type où vit la valeur ; seul `texteType` (≈ 11 champs, jetons `{CODE}`) pourrait servir de gabarit inversé. | Il faut apprendre au référentiel **où chercher** chaque valeur (Q5). C'est l'essentiel du travail, et c'est de la donnée, pas du code. |
| **Serveur** — `PUT /{idDmc}/cadrage` remplace tout le cadrage ; `PUT /{idDmc}/blocs/{bloc}` remplace tout le bloc (un code absent est effacé) ; aucune atomicité entre blocs ; `normaliser()` (privée, l. 976) valide et met en forme chaque valeur ; 400 `[{champ, message}]`. | Appliquer par N `PUT` successifs laisserait une fiche à moitié écrite sur un 400 au 4ᵉ bloc et effacerait les valeurs déjà saisies non reprises. D'où une **route d'application atomique qui fusionne** (Q4). |
| **Le dossier réel 2463** (`NatureMarches/DAO_Fournitures/Fourniture_a_commande.pdf`, 86 pages) est un PDF **texte** (pas un scan), mais : (1) les **Données particulières sont un tableau à deux colonnes** — l'extraction à plat, et même en mode « mise en page », sort d'abord toutes les clauses de la page (`6.4`, `6.5`, `6.5.1`, `6.5.2`) puis toutes les valeurs (« soixante-quinze (75j) jours », « fermes et non révisables ») : **l'appariement clause ↔ valeur est perdu** ; (2) un **filigrane nominatif en diagonale** s'intercale dans chaque ligne de la colonne de gauche (« RANDRIAMAMONJY Marie Lucienne » lettre à lettre). | Une lecture à plat ne marche pas sur le cas réel. Il faut lire **par position** (colonnes du tableau, glyphes pivotés du filigrane écartés), ou mieux partir du **Word** du DAO, où la cellule « clause » et la cellule « valeur » sont distinctes (Q1). |
| Le même dossier porte ses propres incohérences : l'enveloppe mentionne « AOO N° **2461** » quand la page de garde et l'acte d'engagement disent **2463**. | L'import doit signaler une valeur trouvée deux fois **différente** au lieu d'en choisir une (anomalie, rien de coché). |
| **Oracle de mesure disponible** : `docs/correspondance-2026-09-27-fiche-dao-vs-dossier-2463.md` recense 126 informations de la fiche 16, dont **96 [R]** reprises du dossier avec page et clause, 11 questions de cadrage. | On sait mesurer la lecture avant de construire l'écran : taux de valeurs exactes et, surtout, **zéro fausse valeur proposée avec confiance haute** (Q10). |
| **Front** — patron d'import établi (champ fichier caché → `validerFichier(file, TYPES_PDF)` → signal « en cours » → `POST` multipart → signal d'aperçu → annuler / appliquer). Aucun import dans la fiche : l'en-tête de `fiche-marche.ts` dit « aucun import de PDF ». `appliquer(f)` réécrit le signal `valeurs` : les propositions doivent vivre **à part**. Précédent « valeur proposée à côté de la case » : les aides de révision (`aidesRevision`, `aide(c, lot)`, `.fm__aide`) et `allerCellule`. | Le front consomme une réponse de propositions, les montre à côté des cases, et n'écrit que par la route d'application. |
| La saisie par lot (clé `CODE#n`) existe depuis V43 ; le 2463 donne les garanties **par lot** (« Lot n° 1 : … (Ar 1 600 000) »). | Les propositions portent la clé `CODE#n` quand la valeur est par lot. |
| Les champs calculés (V50, `champsCalcules`) et les paramètres internes (`INT-SE-*`) ne se saisissent pas. | L'import ne les propose jamais, même si le document les contient. |

## 2. Le parcours proposé

1. **Création** : la PRMP crée la fiche comme aujourd'hui (ligne du plan → DMC → fiche en brouillon). À l'étape
   **Cadrage**, tant que la fiche est vierge, un encart : « Vous avez déjà le dossier d'appel d'offres ? Importez-le
   pour pré-remplir la fiche — sinon, saisissez. » Bouton **Importer le DAO (.docx ou .pdf)**. Sans document, la saisie
   continue, rien ne change.
2. **Lecture** (serveur, lecture seule) : le document est lu, rien n'est écrit. Réponse : le cadrage reconnu, une liste
   de propositions (code, lot éventuel, valeur lue, valeur mise en forme, **extrait et page**, confiance, anomalies),
   la liste des champs obligatoires non trouvés, les avertissements (document hors gabarit, tableau non lu…).
3. **Revue** (modale plein écran, `appModale`) : un tableau par bloc — libellé, valeur proposée, extrait cité avec sa
   page, valeur déjà saisie s'il y en a une. Chaque ligne a sa case « retenir » : cochée d'office si la confiance est
   haute **et** que la case de la fiche est vide ; jamais cochée si elle écraserait une valeur saisie, si la confiance
   est basse, ou si le document se contredit. Compteurs : « 74 retenues · 12 à vérifier · 23 non trouvées ».
4. **Application** : un seul appel atomique. Tout passe par la même validation que la saisie (`normaliser`) ; un refus
   rend la liste nominative `[{champ, message}]` et **rien** n'est écrit. Journal : « fiche pré-remplie par import de
   *nom du fichier* (empreinte), n valeurs ».
5. **Suite** : la fiche s'ouvre sur le premier bloc, comme après une saisie. Les valeurs importées portent une marque
   discrète « importé — p. 18, DPAO 6.4 » jusqu'à ce qu'elles soient retouchées ; les champs non trouvés restent vides
   et le bilan de validation les réclame comme aujourd'hui.

Un second import sur une fiche commencée reste possible (« Réimporter ») : il ne propose d'office que les cases
vides — une valeur saisie n'est remplacée que sur une case cochée à la main.

## 3. Ce qui reste hors de l'import

- Les **questions de cadrage** qui n'ont pas de réponse écrite dans le dossier (le 2463 : `typePrix`, `avance`,
  `tauxAvance` sont déduits ou supposés) : proposées seulement si le texte les dit, sinon posées comme aujourd'hui.
- Les données **issues du plan de passation** (objet, montant estimé, mode de passation…) : **le plan fait foi**. Une
  divergence est montrée (« le DAO dit … ; le plan dit … »), jamais appliquée.
- Les champs calculés, les paramètres internes, les pièces (`PIECE`), les formulaires du candidat.
- La conservation du fichier : il n'est pas gardé (comme l'import du PPM) — à confirmer (Q7).

## 4. Questions au pilote

| # | Question | Recommandation |
|---|---|---|
| **Q1** | Quel document la PRMP importera-t-elle : le **Word** du DAO, le **PDF**, ou les deux ? | **Les deux, Word d'abord.** Le Word donne les cellules du tableau des Données particulières telles quelles : c'est la lecture fiable. Le PDF « texte » se lit par position (colonnes, filigrane écarté) avec une confiance plus basse. Un PDF **scanné** (image) est refusé avec un message clair — pas d'OCR. |
| **Q2** | Quel périmètre pour le premier lot ? | **Cadrage + Données particulières (DPAO) + Données particulières du CCAP + page de garde** — c'est là que se trouvent l’essentiel des 96 [R] du 2463. Les **bordereaux** (prix, quantités, spécifications techniques, calendrier de livraison) sont des tableaux longs : second lot. |
| **Q3** | Où proposer l'import ? | À l'étape **Cadrage** tant que la fiche est vierge, plus un bouton « Réimporter » dans la barre de la fiche en brouillon. Pas dans la liste des lignes éligibles : la fiche doit exister (DMC créé, ligne passée à « Lancé »). |
| **Q4** | Application : une route atomique ou les routes de saisie existantes, bloc par bloc ? | **Une route atomique qui fusionne** (`PUT /api/fiches-marche/{idDmc}/import/appliquer`) : tout ou rien, les cases non retenues gardent leur valeur. Les `PUT` de bloc actuels effacent ce qu'ils ne reçoivent pas et ne sont pas atomiques entre blocs. |
| **Q5** | Où consigner « quelle valeur se lit à quelle clause » ? | **Dans le référentiel des champs**, administrable (nouvelle colonne d'**ancrage** : document maître, clause, libellé repère, V51), éditée par l'Administrateur dans l'écran des champs. Pas dans le code : les modèles ARMP évoluent, les ancrages suivront sans livraison. Amorçage à partir de la table de correspondance du 2463. |
| **Q6** | Une valeur du DAO qui contredit le plan de passation ? | **Le plan fait foi** : divergence montrée, jamais appliquée. (Le cas se présente : le 2463 écrit « 2461 » dans la mention d'enveloppe.) |
| **Q7** | Garder le fichier importé dans la fiche ? | **Non** au premier lot (lecture seule, comme le PPM) ; le journal garde le nom et l'empreinte. À revoir si le contrôle de la Commission veut confronter la fiche au document d'origine. |
| **Q8** | Cocher d'office les propositions sûres ? | **Oui, seulement les sûres sur case vide.** Tout le reste est à cocher à la main. Rien n'est jamais écrit sans passer par la revue. |
| **Q9** | Valeurs par lot (garanties, délais, montants par lot) dans le premier lot ? | **Oui** : la saisie par lot existe (V43) et le 2463 en dépend (garantie de soumission par lot). |
| **Q10** | Critère d'acceptation ? | Mesuré sur le 2463 contre l'oracle de correspondance, **avant** de construire l'écran : ≥ 70 % des [R] du périmètre Q2 proposées avec la bonne valeur, **0 fausse valeur en confiance haute**. Et **2 ou 3 autres DAO réels** (idéalement en Word, de catégories différentes) pour ne pas régler la lecture sur un seul dossier — à fournir par le pilote. |

## 5. Découpage proposé

| Lot | Qui | Contenu | Preuve |
|---|---|---|---|
| **0 — Mesure** | backend | Lecture du 2463 (Word si fourni, sinon PDF par position) sur le périmètre Q2, sans écran ni route publique : un test qui confronte les propositions à l'oracle et imprime le taux. | Taux mesuré, liste des écarts. **Point d'arrêt** : si la cible Q10 n'est pas tenue, on en rediscute avant tout écran. |
| **1 — Contrat et route** | backend | `POST /api/fiches-marche/{idDmc}/import` (multipart `fichier`, lecture seule) → `ImportDaoResult` ; `PUT …/import/appliquer` atomique ; colonne d'ancrage (V51) et son amorçage ; `normaliser` rendue accessible ; anomalie générique ; journal ; ADR-0011 (renversement du 22/09 : l'import propose, la fiche décide). | Tests d'intégration sur le 2463 et un DAO hors gabarit. |
| **2 — Écran** | front | Encart d'invitation au Cadrage, bouton « Réimporter », modale de revue, marque « importé — p. n », écran admin des ancrages ; en-tête de `fiche-marche.ts` révisé ; specs (fichier refusé, revue, cases cochées d'office, 400 nominatif sans écriture). | Recette réelle : fiche vierge → import du 2463 → application → bilan. |
| **3 — Bordereaux** | les deux | Tableaux des prix, quantités, spécifications, calendrier de livraison. | Après le lot 2, selon le taux mesuré. |

Le front peut écrire le lot 2 contre le contrat dès que le lot 1 est décrit dans la demande backend, avec le repli
« contrat en attente » déjà employé pour la fiche DAO ; il ne le fait qu'après le point d'arrêt du lot 0.

## 6. Risques

- **Dossier hors gabarit** (clauses renumérotées, tableau fusionné, DAO d'un autre bailleur) : la lecture propose peu,
  le dit, et la saisie reste entière. Aucun risque d'écriture silencieuse : tout passe par la revue.
- **Fausse confiance** : c'est le seul risque grave (une valeur plausible mais fausse, cochée d'office). D'où la cible
  « 0 fausse valeur en confiance haute » et la citation systématique de l'extrait et de la page.
- **Fichier hostile** : même garde que le PPM (type contrôlé à l'octet, taille plafonnée à 10 Mo, lecture sans
  exécution de macro — un `.docm` est refusé) ; côté front, `validerFichier()`.
- **Dette de décision** : la mémoire et l'en-tête du composant disent « jamais un import ». Ils seront corrigés au lot 2,
  pas avant l'arbitrage.
