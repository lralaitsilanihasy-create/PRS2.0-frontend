# Demande backend — 2026-09-27 — Préparer la fiche DAO à la remise électronique des offres

**Origine** : cahier des charges du pilote du 27/09 et `docs/plan-2026-09-27-remise-electronique.md` (exploration des deux
dépôts, quatorze questions, arbitrage du pilote le 27/09 : « selon les recommandations »). Le backend a déjà donné son
avis sur Q1, Q2, Q3, Q6, Q7, Q9, Q10, Q11, Q12 : il rejoint les recommandations, ce document les rend contractuelles.

**Périmètre** : la fiche seulement — champs, règles, impression dans les documents produits —, un écran séparé de
paramètres internes, un rôle « Responsable de la procédure » par procédure. La plateforme de dépôt viendra plus tard.
**Décisions prises** : papier ou électronique, pas de mode mixte ; paramètres internes en stockage séparé, jamais exposés
au moteur de rendu ; rôle nominatif par procédure, pas un profil de session ; en mode papier le DAO produit reste
identique texte pour texte, à la seule ligne près nommée en §B1.1 ; le texte officiel ARMP ne se modifie jamais, une
clause absente s'écrit `[[CLAUSE À FOURNIR PAR LE JURISTE : remise électronique — <sujet>]]` ; plus de classeurs Excel à
terme (formulaires en ligne de la plateforme), les classeurs `BP` / `TC` restent produits à titre provisoire, rien à faire.

**Ordre de livraison convenu** : 1) migration V50 ; 2) moteur (`SI:B04-SE`, refus des `INT-SE-*`) ; 3) référentiel ;
4) règles de bilan ; 5) endpoints paramètres internes et responsable ; 6) recopie de C1 / C2 avec la clause balisée.
Le front code contre ce contrat dès maintenant (repli « contrat en attente » tant qu'une route répond 404).

---

## B1 — Référentiel : la rubrique « Remise électronique » et les champs

### B1.1 — La rubrique et le cadrage

- Migration `V50` : rubrique **`B04-SE`** « Remise électronique » dans le bloc `B04`, code court `SE`, maître `DPAO`,
  rang après `B04-CD`, ouverte aux **trois formes** et aux **trois catégories** (Q12).

> ⚠️ **Livraison backend du 2026-09-27 (V50).** La rubrique porte le **rang 61, celui de `B04-CD`** : les rangs du bloc
> B04 sont pris jusqu'à 76 par les rubriques des travaux et le serveur ne décale pas des rangs existants. L'ordre de
> lecture des rubriques devient (bloc, rang, **code**) : `B04-CD` puis `B04-SE`, ce que la demande voulait. Le reflet
> `B04-SE-01` est **toujours servi** dans `valeursCadrage` : `PAPIER` quand la clé `modeRemise` est absente (fiche d'avant
> V50), pour que les Données particulières impriment bien « Mode de remise des offres : Papier ».
- **`B04-VE-01` et `B04-VE-02` désactivés** (`ACTIF = false`, jamais de DELETE) : `B04-SE-01` les remplace (Q1). Les
  fiches validées qui portent une valeur `B04-VE-01` la gardent (valeur orpheline non recopiée à la révision) — noté à
  l'errata E9 du 2463 côté front. Conséquence assumée sur le DAO papier : la ligne « Remise des offres ou propositions par
  voie électronique admise : Non » devient « Mode de remise des offres : Papier » — c'est la seule différence.
- **Clé de cadrage `modeRemise`**, valeurs `PAPIER` (défaut) / `ELECTRONIQUE`, portée par `B04-SE-01` (`source = CADRAGE`,
  `cleCadrage = modeRemise`). Le front l'ajoute à sa liste de questions de cadrage (« Comment les offres sont-elles
  remises ? », deux cartes). Toutes les conditions ci-dessous s'écrivent `modeRemise = ELECTRONIQUE` (grammaire
  existante). Une fiche créée avant V50 sans clé `modeRemise` est lue comme `PAPIER`.

### B1.2 — Deux types de champ nouveaux (Q2), migration V50

| Type | Stockage (`VALEUR`) | 400 nominatif si | Affichage documents |
|---|---|---|---|
| `DATE_HEURE` | ISO local `AAAA-MM-JJTHH:MM` | non parsable → « attend une date et une heure AAAA-MM-JJTHH:MM » | `JJ/MM/AAAA HH:MM` |
| `URL` | texte ≤ 500 | pas une URL absolue `http` / `https` → « attend une adresse http ou https » | tel quel |

Énumération `TypeChampFiche`, contrainte `ck_champ_fiche_marche_type`, `normaliser()`, `affichage()`, colonne `type` de
l'import CSV. `B04-LR-03` reste `DATE` et `B04-LR-04` reste `TEXTE` (l'heure) : c'est la règle 1 qui les exige en mode
électronique.

### B1.3 — Les champs

Attributs communs sauf mention : `source = SAISIE`, `documentMaitre = DPAO`, `reprises` vide, `typesMarche` = les trois,
`categories` = les trois, `parLot = non`, `actif = oui`, `condition = modeRemise = ELECTRONIQUE`. « Défaut » = `valeurDefaut`
quand c'est une constante, sinon la source de calcul (§B1.4). Le motif de code est respecté partout.

> ⚠️ **Livraison backend du 2026-09-27 — sept écarts sur les champs, tous dans les cinq CSV et dans
> `docs/referentiel/2026-09-27-remise-electronique.sql`.**
> 1. **Plusieurs contrôles par champ.** Le tableau lui-même l'exige (`B04-SE-17` porte deux contrôles, `B04-SE-05` sert
>    les règles 4 et 9, `B04-LR-03` garde `DATES_ORDRE:REMISE`) : l'attribut `controle` accepte désormais une liste
>    séparée par des **virgules** (`DATES_ORDRE:REMISE,SE_HEURE_LIMITE:DATE`), motif `REGLE[:ROLE](,REGLE[:ROLE])*`.
> 2. **`B05-GS-10` à `-14` et `B04-OP-10` à `-13` : catégorie `FOURNITURES_SERVICES`**, pas les trois. Leurs rubriques
>    `B05-GS` et `B04-OP` sont des rubriques des fournitures ; un champ « trois catégories » sous une rubrique d'une seule
>    serait servi orphelin de sa rubrique aux travaux et aux prestations intellectuelles, qui ont les leurs (`B05-GQ`,
>    `B04-OV`, `B04-LH`…). À étendre par le référentiel le jour où le pilote y ouvre la remise électronique. `B04-SE-*`
>    restent aux trois catégories.
> 3. **Rôles posés sur des champs existants des fournitures**, en plus des deux demandés (règle 1) : `B04-OP-02`
>    `SE_OUVERTURE_PLIS:DATE` et `B04-OP-03` `SE_OUVERTURE_PLIS:HEURE` (la règle 7 et le calcul Q11 ne nomment pas de code),
>    `B04-LR-02` `SE_ORIGINAL_GARANTIE:LIEU_REMISE` (entrée du calcul de `B05-GS-12`). Conséquence : là où aucun champ ne
>    porte l'heure de remise (travaux et prestations intellectuelles n'ont qu'une `DATE` « date et heure limites »), les
>    règles 1, 2, 7 et les calculs dérivés de l'échéance **attendent leurs champs** (convention du catalogue) — ils
>    valent aujourd'hui pour les fournitures.
> 4. **`B04-SE-04`** : option « Heure du serveur (UTC+03:00 Indian/Antananarivo) », **sans la virgule** — la virgule est
>    le séparateur des options du référentiel.
> 5. **`B04-SE-06` et `B05-GS-13`** : la liste officielle n'est pas fournie ; une **option provisoire nominative**
>    « À définir par l'Administrateur (liste officielle des …) » tient la place, **sans défaut « toutes »** (un défaut
>    imprimerait la mention provisoire dans le DAO). La règle 9 bloque donc un niveau Avancée / Qualifiée tant que la
>    PRMP n'a pas choisi — c'est voulu. L'Administrateur remplace les options par `PUT /api/champs-fiche-marche/{code}`.
> 6. **« Défaut = paramètre »** s'écrit `valeurDefaut = PARAM:<CLE>` (`PARAM:FICHE_SE_PLATEFORME_URL`,
>    `PARAM:FICHE_SE_SIGNATURE_MIN`, `PARAM:FICHE_SE_ASSISTANCE`) et se recopie à la création depuis le paramètre du
>    moment ; paramètre vide : rien.
> 7. **`B04-SE-17` calculé** = date prévisionnelle « Lancement » du plan **à 00:00** (le plan n'a pas d'heure).

**Rubrique `B04-SE` — Remise électronique**

| Code | Libellé | Type | Oblig. | Options / défaut | Contrôle |
|---|---|---|---|---|---|
| `B04-SE-01` | Mode de remise des offres | `LISTE` — `source = CADRAGE`, `cleCadrage = modeRemise`, **sans condition** (toujours visible) | oui | options `PAPIER,ELECTRONIQUE` ; défaut `PAPIER` ; s'affiche « Papier » / « Électronique » (§B2.3) | — |
| `B04-SE-02` | Adresse de la plateforme de dépôt | `URL` | oui | défaut = paramètre `FICHE_SE_PLATEFORME_URL` | — |
| `B04-SE-03` | Date d'ouverture des dépôts | `DATE_HEURE` | non | calculé : = `B04-SE-17` si vide (§B1.4) | `SE_OUVERTURE_DEPOTS:DEPOTS` |
| `B04-SE-04` | Heure de référence | `LISTE` | oui | option unique « Heure du serveur (UTC+03:00, Indian/Antananarivo) » ; défaut = elle | — |
| `B04-SE-05` | Niveau de signature électronique exigé | `LISTE` | oui | options `Qualifiée,Avancée,Simple` ; défaut = paramètre `FICHE_SE_SIGNATURE_MIN` | `SE_SIGNATURE_MIN:NIVEAU` |
| `B04-SE-06` | Prestataires de certification acceptés | `LISTE_MULTIPLE` | non (exigé par la règle 9 si `B04-SE-05` ≠ Simple) | options = liste officielle, administrable par l'écran des champs (Q4) ; défaut = toutes | `SE_PRESTATAIRES:PRESTATAIRES` |
| `B04-SE-07` | Formats de fichiers acceptés | `LISTE_MULTIPLE` | oui | options `PDF,PDF/A,XLSX,DOCX,ZIP` ; défaut `PDF,PDF/A` | — |
| `B04-SE-08` | Taille maximale par fichier (Mo) | `NOMBRE` | oui | défaut `50` | `SE_TAILLES:FICHIER` |
| `B04-SE-09` | Taille maximale par offre (Mo) | `NOMBRE` | oui | défaut `500` | `SE_TAILLES:OFFRE` |
| `B04-SE-10` | Remplacement et retrait avant la date limite | `OUI_NON` | oui | défaut `OUI` | — |
| `B04-SE-11` | Copie de sauvegarde autorisée | `LISTE` | oui | options `Non,Support physique sous pli scellé` ; défaut `Non` | — |
| `B04-SE-12` | Seuil d'indisponibilité déclenchant la prorogation (heures) | `NOMBRE` | oui | défaut `2` | — |
| `B04-SE-13` | Durée de la prorogation (jours ouvrables) | `NOMBRE` | oui | défaut `2` | — |
| `B04-SE-14` | Assistance aux candidats (contact, horaires) | `TEXTE_LONG` | oui | défaut = paramètre `FICHE_SE_ASSISTANCE` | — |
| `B04-SE-15` | Date limite des demandes d'assistance | `DATE_HEURE` | non | calculé : `B04-LR-03` + `B04-LR-04` − 48 h si vide (§B1.4) | — |
| `B04-SE-16` | Fenêtre avant l'échéance où le seuil s'applique (heures) | `NOMBRE` | oui | défaut `24` | — |
| `B04-SE-17` | Date de publication de l'avis | `DATE_HEURE` | oui | calculé : date prévisionnelle « Lancement du DAO/DC » du plan si vide (§B1.4) | `SE_OUVERTURE_DEPOTS:PUBLICATION`, `SE_CEREMONIE:PUBLICATION` |

Q3 : `B04-SE-12` est scindé, la fenêtre est `B04-SE-16`. Q10 : `B04-SE-17` est nouveau.

**Rubrique `B05-GS` — Garantie de soumission** (condition `modeRemise = ELECTRONIQUE et garantieSoumission = OUI`)

| Code | Libellé | Type | Oblig. | Options / défaut | Contrôle |
|---|---|---|---|---|---|
| `B05-GS-10` | Forme de remise de la garantie acceptée | `LISTE_MULTIPLE` | oui | options `Dépôt direct par le garant (voie A),Téléversement avec code de vérification (voie B),Original papier` ; défaut voie B | — |
| `B05-GS-11` | Original papier exigé en plus | `OUI_NON` | oui | défaut `NON` | `SE_ORIGINAL_GARANTIE:EXIGE` |
| `B05-GS-12` | Lieu du dépôt de l'original | `TEXTE_LONG` | non | calculé : = `B04-LR-02` si vide | `SE_ORIGINAL_GARANTIE:LIEU` |
| `B05-GS-13` | Garants habilités | `LISTE_MULTIPLE` | non | options = liste officielle, administrable (Q4) ; défaut = tous | — |
| `B05-GS-14` | Date et heure limite du dépôt de l'original | `DATE_HEURE` | non | calculé : `B04-LR-03` + `B04-LR-04` si vide | `SE_ORIGINAL_GARANTIE:LIMITE` |

« Lieu et heure limite du dépôt de l'original » porte deux valeurs : scindé en `B05-GS-12` et **`B05-GS-14`**, même règle
que Q3 (un champ, une valeur).

**Rubrique `B04-OP` — Ouverture des plis**

| Code | Libellé | Type | Oblig. | Options / défaut | Contrôle |
|---|---|---|---|---|---|
| `B04-OP-10` | Modalité de la séance | `LISTE` | oui | options `Présentiel,En ligne,Mixte` ; défaut `Mixte` | — |
| `B04-OP-11` | Lien de suivi de la séance pour les soumissionnaires | `URL` | non | vide (généré par la plateforme plus tard) | — |
| `B04-OP-12` | Délai entre l'heure limite et l'ouverture (minutes) | `NOMBRE` | oui | défaut `60` | `SE_OUVERTURE_PLIS:DELAI` |
| `B04-OP-13` | Publication du procès-verbal sur la plateforme | `OUI_NON` | oui | défaut `OUI` | — |

`B04-OP-02` et `B04-OP-03` (Q11) : inchangés en mode papier ; en mode électronique, **calculés par le serveur** à
l'enregistrement du bloc B04 (`B04-LR-03` + `B04-LR-04` + `B04-OP-12` minutes), renvoyés en lecture seule au front
(§B5.1 : `champsCalcules`), revérifiés par la règle 7 ; le contrôle `DATES_ORDRE:OUVERTURE` reste valable dessus.

### B1.4 — Valeurs par défaut et valeurs calculées

- **Constantes** : dans `valeurDefaut` (recopiées à la création de la fiche, mécanisme V47). Les fiches déjà créées ne les
  reçoivent pas : la ressaisie des obligatoires est exigée par le bilan, comme pour tout champ nouveau.
- **Paramètres administrables** (`t_parametre`, patron `fiche-taux-tva`), servis par **`GET /api/parametres/fiche-remise-electronique`**
  (tout authentifié) et **`PUT`** (Administrateur, état complet, `null` efface) :
  `{ plateformeUrl, fuseau, signatureMin, tailleMaxPlateformeMo, delaiMinRemiseJours, assistance, quorumDefaut }` ↔ clés
  `FICHE_SE_PLATEFORME_URL`, `FICHE_SE_FUSEAU` (défaut `Indian/Antananarivo`), `FICHE_SE_SIGNATURE_MIN` (défaut `Avancée`),
  `FICHE_SE_TAILLE_MAX_PLATEFORME_MO` (défaut `500`), `FICHE_SE_DELAI_MIN_REMISE_JOURS` (défaut `30`, à faire fixer par le
  pilote), `FICHE_SE_ASSISTANCE`, `FICHE_SE_QUORUM_DEFAUT` (`3/5`). Un défaut « = paramètre » se recopie à la création de
  la fiche depuis le paramètre du moment.
- **Calculés** (`B04-SE-03`, `B04-SE-15`, `B04-SE-17`, `B05-GS-12`, `B05-GS-14`, `B04-OP-02`, `B04-OP-03`) : posés par le
  serveur à l'enregistrement du bloc quand la cellule est vide et que le mode est électronique, renvoyés au front avec
  la liste `champsCalcules` (§B5.1). Le front ne pré-remplit jamais.

> ⚠️ **Livraison backend du 2026-09-27 (§B1.4).**
> - **`FICHE_SE_DELAI_MIN_REMISE_JOURS` = 30**, posé par V50 et par le script — **proposé, à faire fixer par le pilote** ;
>   il se change sans redéploiement par `PUT /api/parametres/fiche-remise-electronique`.
> - **Jours fériés : week-end seul.** Aucun paramètre `FICHE_JOURS_FERIES` n'existe ; la règle 1 juge « jour ouvrable » =
>   lundi à vendredi (`JoursOuvres`, même convention que le chronométrage). Le jour où le pilote fournit la liste, elle
>   s'administrera dans un paramètre dédié ; rien n'a été inventé.
> - `t_parametre.VALEUR` passe à **1000 caractères** (adresse de plateforme, texte d'assistance). `quorumDefaut` (« 3/5 »)
>   sert de **quorum proposé** dans le `GET …/parametres-internes` tant que rien n'est enregistré.
> - La mention « calculée » est **persistée** (`t_fiche_marche_valeur.CALCULEE`) : `champsCalcules` est servi en `GET` aussi,
>   et suit la valeur à la révision. Une valeur renvoyée **identique** à la valeur calculée reste « calculée » ; une valeur
>   **différente** est une saisie ; `B04-OP-02` / `B04-OP-03` sont recalculés à chaque enregistrement du bloc B04 (Q11).

### B1.5 — Vecteur de livraison

CSV des cinq fichiers de référence (colonnes reconnues par nom), script `docs/referentiel/2026-09-2x-remise-electronique.sql`
idempotent pour les bases chargées (rubrique, champs, désactivation de `B04-VE-01/02`, paramètres), migration V50 pour
les types, la contrainte, les tables de §B4 et §B5.

> ⚠️ **Livraison backend du 2026-09-27 (§B1.5).** Les 17 champs `B04-SE-*` sont dans les **cinq** CSV, projetés sur
> l'en-tête de chacun : les fichiers des contrats-cadres n'ont pas de colonne `categories`, `parLot` ni `valeurDefaut`, et
> ceux des travaux et des prestations intellectuelles n'ont pas `parLot` ni `valeurDefaut` — importés **après** le fichier
> des fournitures (qui porte tout), ces attributs restent « inchangés ». `B05-GS-1x` et `B04-OP-1x` ne sont que dans le
> fichier des fournitures (écart 2 de §B1.3) ; `B04-VE-01/02` passent `actif = non` dans le fichier des prestations
> intellectuelles, seul à les porter. Script : `docs/referentiel/2026-09-27-remise-electronique.sql`, **après V50** (la
> contrainte des types refuse `DATE_HEURE` avant). Les copies de test (`src/test/resources/fiche-marche/`) sont identiques.

## B2 — Moteur de rendu

### B2.1 — Section conditionnelle `B04-SE`

`FormulairesCandidat.condition("B04-SE")` = `modeRemise = ELECTRONIQUE` (aujourd'hui un nom inconnu est **gardé** : tant
que le moteur ne connaît pas `B04-SE`, la clause de C1 / C2 s'imprimerait en mode papier — d'où l'ordre de livraison).
Les marqueurs ne s'impriment jamais, l'omission porte sur paragraphes et tableaux comme pour `A1B`.

### B2.2 — Refus des jetons `INT-SE-*`

Les paramètres internes ne sont pas des champs du référentiel (§B4) et leur nom ne suit pas le motif des codes : un jeton
`{{INT-SE-03}}` ne résout rien. Le refus demandé va plus loin : **`ModelesCandidat` refuse au démarrage** tout fichier de
commande contenant un jeton dont le nom commence par `INT-` (message nominatif, fichier et ligne), et `jeton()` renvoie
`null` (jeton laissé tel quel) pour un tel nom. Test unitaire sur le patron `suffixeChiffres()` : un modèle en ligne avec
`{{INT-SE-03}}` n'est jamais substitué, et `ModelesCandidat` lève au chargement.

### B2.3 — Affichage

`affichage()` : `DATE_HEURE` → `JJ/MM/AAAA HH:MM` ; `URL` tel quel ; pour `B04-SE-01` (LISTE de cadrage), les codes
`PAPIER` / `ELECTRONIQUE` s'impriment « Papier » / « Électronique », comme `OUI_NON` imprime Oui / Non. Les Données
particulières impriment les nouveaux champs comme tous les autres (une ligne « libellé : valeur » par champ ouvert par le
cadrage) : rien à coder pour eux ; en mode papier ils sont fermés, rien ne s'imprime.

### B2.4 — Non-régression

En mode papier, `ModelesCandidatRenduTest` et `node scripts/modeles-candidat/verifier-armp.mjs A1 A2 A3 A4 C1 C2 --dossier=`
restent verts sans écart. Un test d'intégration rend les Données particulières d'une fiche papier avant / après V50 :
même texte, à la ligne `B04-SE-01` près.

> ⚠️ **Livraison backend du 2026-09-27 (§B2.4).** `modeles-armp/C1.txt` et `C2.txt` (commit front `c80cee2`) sont
> **recopiés tels quels** après §B2.1, les six fichiers identiques octet pour octet. Preuve, chaîne ARMP du front (PowerShell,
> JDK 21 en tête du PATH, rendus bruts de `ModelesCandidatRenduTest` copiés dans `C:\Users\LANTO\rendus-modeles`) :
>
> ```
> A1 [C:\Users\LANTO\rendus-modeles/A1.docx] — conforme au document type · 35 fragment(s) du gabarit retrouvés, 37 du rendu tous fondés
> A2 [C:\Users\LANTO\rendus-modeles/A2.docx] — conforme au document type · 7 fragment(s) du gabarit retrouvés, 7 du rendu tous fondés
> A3 [C:\Users\LANTO\rendus-modeles/A3.docx] — conforme au document type · 48 fragment(s) du gabarit retrouvés, 48 du rendu tous fondés
> A4 [C:\Users\LANTO\rendus-modeles/A4.docx] — conforme au document type · 7 fragment(s) du gabarit retrouvés, 7 du rendu tous fondés
> C1 [C:\Users\LANTO\rendus-modeles/C1.docx] — conforme au document type · 13 fragment(s) du gabarit retrouvés, 13 du rendu tous fondés
> C2 [C:\Users\LANTO\rendus-modeles/C2.docx] — conforme au document type · 16 fragment(s) du gabarit retrouvés, 15 du rendu tous fondés
>
> Aucun écart : les modèles sont ceux du document type.
> exit=0
> ```
>
> « Avant / après V50 » ne se rend pas dans un même code : le test d'intégration (`RemiseElectroniqueIntegrationTest`, cas 2)
> valide une fiche **papier** sans rien de plus qu'avant et vérifie que ses Données particulières impriment « Mode de remise
> des offres : Papier », aucune autre ligne de `B04-SE`, ni la plateforme, ni l'ancienne ligne `B04-VE-01` ; et que son C1 ne
> porte pas la clause. La même fiche en **électronique** imprime « Électronique », la plateforme, la publication en
> `JJ/MM/AAAA HH:MM`, et son C1 la clause balisée.

## B3 — Règles de bilan (`ControlesFicheMarche`), toutes **bloquantes**, mode électronique seulement

Une constante, une méthode, une ligne d'appel, le `controle = REGLE:ROLE` posé sur les champs (§B1.3). Message en
français, un test valide et un invalide par règle.

| # | Constante | Rôles | Règle | Message |
|---|---|---|---|---|
| 1 | `SE_HEURE_LIMITE` | `B04-LR-03` `:DATE`, `B04-LR-04` `:HEURE` (contrôles à ajouter à ces deux champs existants) | heure renseignée au format `HH:MM` et date un jour ouvrable (lundi-vendredi, hors jours fériés de `FICHE_JOURS_FERIES` si le paramètre existe, sinon week-end seul) | « En remise électronique, la date limite doit porter une heure (HH:MM) et tomber un jour ouvrable. » |
| 2 | `SE_OUVERTURE_DEPOTS` | `:DEPOTS`, `:PUBLICATION` + `B04-LR-03` | `B04-SE-03` < `B04-LR-03` + `B04-LR-04`, et `B04-LR-03` − `B04-SE-17` ≥ `FICHE_SE_DELAI_MIN_REMISE_JOURS` | « L'ouverture des dépôts doit précéder la date limite, et la publication la précéder d'au moins n jours. » |
| 3 | `SE_TAILLES` | `:FICHIER`, `:OFFRE` | `B04-SE-08` ≤ `B04-SE-09` ≤ `FICHE_SE_TAILLE_MAX_PLATEFORME_MO` | « La taille par fichier doit être inférieure ou égale à la taille par offre, elle-même limitée à n Mo par la plateforme. » |
| 4 | `SE_SIGNATURE_MIN` | `:NIVEAU` | rang(`B04-SE-05`) ≥ rang(`FICHE_SE_SIGNATURE_MIN`), Qualifiée > Avancée > Simple | « Le niveau de signature exigé ne peut pas être inférieur au niveau minimal fixé par l'administrateur (n). » |
| 5 | `SE_ORIGINAL_GARANTIE` | `:EXIGE`, `:LIEU`, `:LIMITE` | `B05-GS-11 = OUI` ⇒ `B05-GS-12` et `B05-GS-14` renseignés | « L'original papier étant exigé, indiquez le lieu et la date limite de son dépôt. » |
| 6 | `SE_QUORUM` | paramètres internes (§B4) | `INT-SE-03` ≤ `INT-SE-02`, `INT-SE-03` ≥ 2, et `INT-SE-05` ∉ `INT-SE-01` | « Le quorum de déchiffrement doit être compris entre 2 et le nombre de membres, et le responsable ne peut pas détenir une part de clé. » |
| 7 | `SE_OUVERTURE_PLIS` | `:DELAI` + `B04-OP-02/03` | `B04-OP-02` + `B04-OP-03` = `B04-LR-03` + `B04-LR-04` + `B04-OP-12` minutes | « La date et l'heure d'ouverture des plis sont calculées : date limite plus n minutes. » |
| 8 | `SE_CEREMONIE` | `:PUBLICATION` + paramètres internes | `INT-SE-04` < `B04-SE-17` | « La cérémonie des clés doit précéder la publication de l'avis. » |
| 9 | `SE_PRESTATAIRES` | `:PRESTATAIRES`, `:NIVEAU` | `B04-SE-05` ∈ {Qualifiée, Avancée} ⇒ `B04-SE-06` non vide | « Pour une signature qualifiée ou avancée, indiquez au moins un prestataire de certification accepté. » |
| 10 | `PARAMETRES_INTERNES_INCOMPLETS` | — | l'écran §B4 n'est pas complet ou invalide | « Les paramètres internes de la procédure sont incomplets : à compléter par le responsable de la procédure. » |
| 11 | `RESPONSABLE_NON_DESIGNE` | — | aucun responsable actif (§B5) | « Aucun responsable de la procédure n'est désigné : la fiche ne peut pas être validée en remise électronique. » |

`bilan()` reçoit en plus l'état des paramètres internes et le responsable (signature étendue) ; `POST …/valider` refuse
par `409 CONTROLES_BLOQUANTS` comme aujourd'hui. Les règles 6, 8, 10, 11 se lisent sur `bloc = B04`.

> ⚠️ **Livraison backend du 2026-09-27 (§B3).** Les onze règles, constantes et messages sont ceux du tableau ; `bilan()`
> reçoit un `RemiseElectroniqueBilan { electronique, parametres, internes, responsableDesigne }` (nul ou papier : aucune
> des onze n'est évaluée, ni en `ok` ni en `bloquants`). Précisions :
> - **Règle 1** : jours fériés hors périmètre (voir §B1.4) — lundi à vendredi.
> - **Règle 2** : *n* est `FICHE_SE_DELAI_MIN_REMISE_JOURS` (« d'au moins 30 jours ») ; si `B04-SE-03` est vide, seule la
>   seconde moitié est jugée ; l'écart publication → date limite se compte en **jours calendaires** sur les dates.
> - **Règle 6** : évaluée dès que le quorum **ou** le responsable est connu ; le message est le même pour les trois
>   violations. Règles 6, 8, 10, 11 : `bloc = B04`, `champs = []`.
> - **Règle 7** : lit `B04-OP-02` / `B04-OP-03` par les rôles `SE_OUVERTURE_PLIS:DATE` / `:HEURE` (écart 3 de §B1.3) ;
>   comme ils sont recalculés à chaque enregistrement de B04, elle ne bloque qu'une fiche dont la date limite ou le délai
>   a changé sans réenregistrement du bloc.
> - **Règle 9** : « Simple » rend un `ok` explicite.
> - Une règle dont un rôle manque n'est pas évaluée (convention du catalogue) : c'est le cas des règles 1, 2, 7 hors
>   fournitures aujourd'hui.

## B4 — Paramètres internes de la procédure

- Entité **`ParametreInterneProcedure`**, table `t_parametre_interne_procedure` (V50) : `ID_DMC` PK/FK, `MEMBRES_CLE`
  (liste d'IM, texte), `QUORUM`, `DATE_CEREMONIE`, `DATE_MAJ`, `IM_MAJ`. Hors référentiel, hors `SelectionDocumentsFiche`,
  hors `FormulairesCandidat` : le moteur ne les voit pas (§B2.2).
- Journal dédié **`t_parametre_interne_journal`** (V50) : `ID`, `ID_DMC`, `DATE`, `IM_ACTEUR`, `NOM_ACTEUR`, `CHAMP`,
  `ANCIENNE_VALEUR`, `NOUVELLE_VALEUR` — servi au seul titulaire (Q7). Le journal global `t_audit_log` reçoit l'entrée de
  route habituelle, **sans valeurs**.
- **`GET /api/fiches-marche/{idDmc}/parametres-internes`** → `ParametresInternesDto` :
  `{ idDmc, membresCommission: [{ im, nom, profil }], nombreParts, quorum, dateCeremonie, responsable: { im, nom } | null, etat: 'COMPLETS' | 'INCOMPLETS', anomalies: [{ regle, message }], journal: [{ date, acteur, nomActeur, champ, ancienneValeur, nouvelleValeur }] }`.
  `nombreParts` = taille de `membresCommission` (INT-SE-02, calculé) ; `responsable` = titulaire du rôle (INT-SE-05,
  automatique) ; `etat = COMPLETS` quand membres ≥ 2, quorum et date renseignés, et règles 6 et 8 satisfaites.
- **`PUT`** même URL, corps `{ membresCommission: [im…], quorum, dateCeremonie }` → 400 nominatifs `[{champ, message}]`
  (`membresCommission`, `quorum`, `dateCeremonie`), 409 **`MEMBRE_COMMISSION`** si un IM est le responsable actif (contrôle
  dans les deux sens, §B5), 409 `FICHE_VALIDEE` si la version courante est figée ? — non : les paramètres internes se
  modifient à tout moment tant que la fiche n'est pas validée en mode électronique ; après validation, lecture seule
  (409 **`FICHE_VALIDEE`**).
- **`GET …/parametres-internes/candidats`** → comptes désignables comme membres (contrôleurs des profils Président,
  Chef de commission, Membre de la localité de la fiche), `[{ im, nom, profil }]`.
- **Garde** : `GET` / `PUT` / `candidats` réservés au **titulaire du rôle** pour cette fiche (403 pour tout autre,
  Administrateur compris, PRMP comprise) ; ordre : profil authentifié → identité (prédicat pur) → corps. L'**état** seul
  (`COMPLETS` / `INCOMPLETS` / `ABSENTS`) est exposé sur la fiche à tous ceux qui la lisent (§B5.1).

> ⚠️ **Livraison backend du 2026-09-27 (§B4).** Conforme, avec ces précisions : `membresCommission` du DTO est une liste
> d'objets `{ im, nom, profil }` (le corps du `PUT` reste une liste de matricules) ; `quorum` du `GET` vaut le quorum
> **proposé** (`FICHE_SE_QUORUM_DEFAUT`) tant que rien n'est enregistré ; les 400 : `membresCommission` « Compte inconnu : … »,
> `quorum` < 1, `dateCeremonie` illisible (`AAAA-MM-JJTHH:MM`) — un quorum de 1 ou supérieur au nombre de membres n'est pas
> un 400 mais l'anomalie de la règle 6 (`etat = INCOMPLETS`). **`FICHE_VALIDEE`** joue quand la **dernière version** de la
> fiche est validée **et** en mode électronique ; une révision ouverte rouvre les paramètres. Le journal dédié trace aussi le
> champ `responsable` (désignation `null → im`, retrait `im → null`) ; le journal global reçoit `PARAMETRES-INTERNES` et
> `RESPONSABLE` par l'intercepteur, `ANCIENNE_VALEUR` et `NOUVELLE_VALEUR` nulles (vérifié par le test).

## B5 — Rôle « Responsable de la procédure »

- Table **`t_responsable_procedure`** (V50) : `ID`, `ID_DMC`, `IM_RESPONSABLE`, `NOM_RESPONSABLE`, `DESIGNE_PAR`,
  `DATE_DESIGNATION`, `RETIRE_PAR`, `DATE_RETRAIT` ; **un seul actif par `ID_DMC`** (index partiel `DATE_RETRAIT IS NULL`).
  Ce n'est ni un `ProfilUtilisateur`, ni une ligne de `t_delegation_profil`, ni un intérim (ADR-0008) : **ADR-0010** à
  écrire. Différence avec l'arbitrage du 25/09 (« pas de rôle service bénéficiaire ») : ici le rôle **porte des droits
  exclusifs**, ce n'est pas une trace.
- Prédicat pur `PredicatsIdentite.estResponsableProcedure(acteur, responsable)`, lu par les gardes de §B4 et par
  `FicheMarcheDto`.
- **`POST /api/fiches-marche/{idDmc}/responsable`** `{ im }` (Administrateur) → 201 ; 409 **`RESPONSABLE_EXISTANT`** s'il y
  a déjà un titulaire actif (le retirer d'abord) ; 409 **`MEMBRE_COMMISSION`** si `im` figure dans `MEMBRES_CLE` de la
  fiche ; 404 compte inconnu. **`DELETE`** même URL (Administrateur) → 204, 404 s'il n'y a pas de titulaire.
  **`GET …/responsable/candidats`** (Administrateur) → comptes désignables `[{ im, nom, profil }]`, hors membres de la
  commission de cette fiche. Journal `t_audit_log` : route + acteur ; `t_parametre_interne_journal` : champ
  `responsable`, ancienne → nouvelle valeur.
- L'Administrateur **ne lit ni ne modifie** les paramètres internes (403), sauf s'il est lui-même titulaire.

> ⚠️ **Livraison backend du 2026-09-27 (§B5).** **Désignables comme responsable** : les **contrôleurs** de la localité de
> la fiche et ceux sans localité (Président, Chargé de publication — compétents partout), hors membres détenteurs d'une part
> de clé de cette fiche ; PRMP et UGPM ne sont pas désignables (parties à la procédure), un Administrateur l'est (il lit
> alors les paramètres à ce titre). `POST` répond **201 `{ im, nom }`** (« NOM Prénoms », sans relecture de la fiche) ;
> `404` vaut pour un DMC comme pour un compte inconnu. Le compte se juge sur `tr_controleur` (matricule), pas sur
> l'existence d'un compte de connexion. ADR-0010 : `docs/adr/ADR-0010-responsable-de-procedure-et-parametres-internes.md`.

### B5.1 — Ce que la fiche dit au front (contrat lu par l'écran)

`FicheMarcheDto` et `FicheMarcheResumeDto` gagnent :
`responsableProcedure: { im, nom } | null`, `peutModifierParametresInternes: boolean` (vrai pour le titulaire connecté),
`parametresInternes: 'COMPLETS' | 'INCOMPLETS' | 'ABSENTS'`, et `champsCalcules: string[]` (clés `CODE` ou `CODE#n` posées
par le serveur à l'enregistrement, §B1.4 et Q11 — le front les affiche en lecture seule avec la mention « calculée »).
La réponse de `PUT …/blocs/B04` renvoie la fiche entière comme aujourd'hui, `champsCalcules` compris.

## B6 — Tests attendus

- Non-régression papier (§B2.4) ; jetons publiés présents dans les Données particulières en mode électronique et absents
  en mode papier ; sections `SI:B04-SE` présentes dans C1 / C2 en mode électronique, absentes en mode papier.
- Une série par règle 1 à 11 : un cas valide, un cas invalide, message exact.
- Refus des `INT-SE-*` (§B2.2), deux tests.
- Droits : `GET` / `PUT` paramètres internes → 403 pour PRMP, UGPM, Membre, Président, Administrateur non titulaire, et pour
  le responsable d'une **autre** procédure ; 200 pour le titulaire.
- Rôle : attribution et retrait par un Administrateur ; refus d'attribuer à un membre de la commission ; refus d'ajouter le
  titulaire à la commission ; `RESPONSABLE_EXISTANT` ; entrées de journal (globale sans valeurs, dédiée avec valeurs).
- Validation refusée sans responsable en mode électronique (`RESPONSABLE_NON_DESIGNE`), acceptée en mode papier sans rien.

> ⚠️ **Livraison backend du 2026-09-27 (§B6) — où sont les tests.** `RemiseElectroniqueTest` (pur, 14 tests) : les onze
> règles, un cas valide et un invalide chacune, message exact ; aucune évaluée en papier ni sans contexte ; valeurs
> calculées ; état et anomalies ; contrôles multiples ; formats. `ModelesCandidatRenduTest` (+3) : `{{INT-SE-03}}` jamais
> substitué, refus au chargement (fichier, ligne, jeton nommés), section `SI:B04-SE` présente en électronique, absente en
> papier et sur une fiche sans cadrage. `RemiseElectroniqueIntegrationTest` (5 cas) : 1 référentiel, défauts constants et
> « = paramètre », 400 nominatifs des deux types, reflet `PAPIER`, champs fermés en papier, `champsCalcules` posés (Q11
> compris), saisie ≠ calcul ; 2 validation refusée (deux messages exacts, `bloc = B04`), désignation, paramètres internes
> complets, validation acceptée, Données particulières et C1 en électronique puis en papier, `FICHE_VALIDEE` ; 3 droits
> (PRMP, UGPM, Membre, Président, Chef de commission, Administrateur, responsable d'une autre procédure → 403 ; titulaire
> → 200 ; candidats ; 404 ; 400 nominatifs) ; 4 rôle (403 PRMP, 404 compte inconnu, 201, `RESPONSABLE_EXISTANT`,
> `MEMBRE_COMMISSION` dans les deux sens, retrait 204 puis 404, candidats hors membres, journal dédié avec valeurs, journal
> global sans valeurs) ; 5 paramètres administrables (défauts de V50, 403, 400 nominatif, état complet, `null` efface).

## B7 — Classeurs Excel

Décision du pilote : les formulaires du candidat (bordereau des prix, liste des fournitures, tableau de conformité)
seront des **formulaires en ligne de la plateforme**. Rien à produire maintenant ; `BP` / `TC` restent produits à titre
provisoire ; leur retrait viendra avec la plateforme. Le besoin par lot (`GET …/articles`) reste la source structurée que la
plateforme lira.

## État du front (27/09) — codé contre ce contrat, avant livraison

Cinq commits (`38ab6bb`, `1b33b96`, `2d29c65`, `bc9257a`, `c80cee2`), 909 tests verts, lint et build propres. Ce que le
serveur doit savoir de ce que l'écran attend :

- Types `DATE_HEURE` (valeur `AAAA-MM-JJTHH:MM`, celle d'un `datetime-local`) et `URL` rendus ; `valeurDefaut` porté par
  l'écran admin des champs ; question de cadrage `modeRemise` posée par l'écran, **jamais envoyée tant que la PRMP ne la
  choisit pas** (la clé absente vaut PAPIER, §B1.1).
- `champsCalcules` (§B5.1) lu sur la fiche renvoyée par `PUT …/blocs/B04` : les clés qu'il porte s'affichent en lecture
  seule « calculée ». `B04-SE-01` en lecture s'affiche « Papier » / « Électronique » depuis le code du cadrage.
- `responsableProcedure`, `peutModifierParametresInternes`, `parametresInternes` lus sur la fiche ; l'écran
  `/procedure/{idDmc}/parametres-internes` appelle `GET` / `PUT …/parametres-internes` et `GET …/parametres-internes/candidats`,
  nomme le 403 sans rediriger, pose les 400 nominatifs sous `membresCommission`, `quorum`, `dateCeremonie`, nomme
  `MEMBRE_COMMISSION` et `FICHE_VALIDEE`.
- Encart Administrateur sur la fiche (route `/admin/dao/{idDmc}`) : `GET …/responsable/candidats`, `POST …/responsable`
  `{ im }` (201 attendu, la fiche n'est pas relue), `DELETE …/responsable` (204) ; `RESPONSABLE_EXISTANT` et
  `MEMBRE_COMMISSION` nommés.
- Bilan : les règles `PARAMETRES_INTERNES_INCOMPLETS` et `RESPONSABLE_NON_DESIGNE` renvoient à l'écran du responsable
  et à l'Administrateur, les autres au bloc `B04` ; aucun message n'est réécrit par l'écran.
- Paramètres : écran `/admin/referentiels/remise-electronique` sur `GET` / `PUT /api/parametres/fiche-remise-electronique`
  (§B1.4, sept clés).
- C1 / C2 : `modeles-armp/C1.txt` et `C2.txt` portent la section `{{SI:B04-SE}}` … `{{FINSI:B04-SE}}` avec la clause
  balisée (§B2.1) ; `verifier-armp.mjs A1 A2 A3 A4 C1 C2` reste vert. **À recopier après §B2.1**, jamais avant.
- Errata E9 du 2463 (front) : « Mode de remise des offres : Papier » remplace la ligne `B04-VE-01` des Données
  particulières ; la valeur `B04-VE-01` d'une fiche validée n'est pas recopiée à la révision.

## Ce que le backend rend

Migration V50, moteur, référentiel (CSV + script), règles, endpoints, ADR-0010, `docs/api-endpoints.md` et
`docs/regles-gestion.md` mis à jour, tests ; et, ici même, un encadré ⚠️ daté à l'endroit concerné pour chaque écart.

> ⚠️ **Rendu le 2026-09-27**, dans l'ordre convenu : V50 (`V50__remise_electronique.sql`) ; moteur (`SI:B04-SE`, refus des
> `INT-*`, `DATE_HEURE` / `URL`, « Papier » / « Électronique ») ; référentiel (cinq CSV, copies de test,
> `docs/referentiel/2026-09-27-remise-electronique.sql`) ; règles 1 à 11 ; endpoints (`/parametres-internes`,
> `/responsable`, `/api/parametres/fiche-remise-electronique`) et champs de `FicheMarcheDto` / `FicheMarcheResumeDto` ;
> recopie de `C1.txt` / `C2.txt` en dernier. Contrat : `docs/api-endpoints.md`, § *La remise électronique des offres — V50*
> et § *Paramètres système* ; règles : `docs/regles-gestion.md`, § *La remise électronique des offres* ; décision :
> `docs/adr/ADR-0010-responsable-de-procedure-et-parametres-internes.md`. Les deux points à trancher sont notés en §B1.4
> (délai 30 proposé, jours fériés = week-end seul).
