# Demande backend — 2026-10-21 — Modèles de PV : générer le modèle de départ

## Contexte

Le pilote a demandé si **l'application peut rédiger elle-même le modèle de départ** d'un PV, au lieu de le préparer à la main.

Le 21/10, le front a préparé à la main, par script, un modèle de départ pour le PV d'examen du dossier de mise en concurrence. Le
fichier est `frontendprs2\PDF_generes\modele-PV-mise-en-concurrence-depart.docx` (non versionné ; une copie lisible est à côté, en
`.pdf`).

Il a été essayé sur un modèle temporaire de la recette :
- dépôt, puis déclaration des quatre conditions et des deux champs : rapport **sans blocage ni avertissement** ;
- aperçus `FAV`, `FAVR` et `DEF` sur le dossier 100382 (00003/DAOO-CC/CNM/2026) : aucun marqueur non remplacé, et l'annexe ne
  s'imprime que pour `FAVR`.

Ce travail est **entièrement mécanique**. Il prend un PV officiel du plan, en remplace le texte propre au plan par les variables du
catalogue, écrit l'avis en blocs conditionnels, ajoute deux champs saisis et met l'annexe sous condition. Il revient au serveur, qui
manipule déjà les `.docx` (`ModelePvWord`) et contrôle les versions.

Le pilote veut **un bouton** sur la fiche d'un modèle sans version : l'application produit la version 1, en brouillon, déjà
déclarée. L'Administrateur la fait relire, la corrige dans Word et la redépose. **Rien n'est mis en vigueur sans lui.**

Limite assumée, décision du pilote (21/10) : l'application **assemble**, elle ne rédige pas le texte juridique. Les phrases propres à
chaque famille sont écrites une fois, validées par la CNM, puis réutilisées à chaque génération. Aucune rédaction libre par une
intelligence artificielle, pour un acte officiel.

## B1 — La route

`POST /api/modeles-pv/{id}/versions/depart`, réservée à l'Administrateur comme les autres routes, journalisée.

- **Entrée** : corps facultatif `{ portee?: "centrale" | "regionale" | "les-deux" }` (défaut `les-deux`, voir B2.7).
- **Famille** : déduite des sous-types rattachés au modèle.
  - 400 `SANS_SOUS_TYPE` si le modèle n'en sert aucun : il faut savoir quelle famille assembler.
  - 409 `FAMILLES_MULTIPLES` si ses sous-types relèvent de plusieurs familles, avec `details` : famille → sous-types.
- **Sortie** : la version créée, comme `POST /{id}/versions`, avec son `rapport`.
  - Elle est en `BROUILLON`, au numéro suivant.
  - `nomFichier` : `depart-<code du modèle>.docx`.
  - `motif` : « Modèle de départ généré par l'application — texte à faire valider par la CNM ».
- **Modèle archivé** : 409 `MODELE_ARCHIVE`, comme le dépôt.
- **Journal** : une action `DEPART_GENERE`, avec en détail la famille et le fichier officiel de base.
- **Déjà une version** : la génération reste permise et crée une version de plus. Le front la propose seulement sur un modèle sans
  version, mais le serveur n'a pas à l'interdire.

> ⚠️ **2026-10-21, livré (backend), avec deux refus de plus**
> - **409 `FAMILLE_SANS_DEPART`** pour un modèle du plan (DDP) : il n'a pas de phrases en B3, et sa reprise relève de G4.
> - **400 `NATURE_SANS_DEPART`** pour un modèle de lettre de renvoi : l'assemblage part d'un PV.
> - Le reste est livré tel que demandé : `PORTEE_INCONNUE` (400) pour une portée hors des trois valeurs, les autres codes comme
>   ci-dessus. Le détail de `FAMILLES_MULTIPLES` est `details` : famille → sous-types triés.

## B2 — Ce que fait l'assemblage

Ce sont les règles du script du 21/10, à reprendre telles quelles.

1. **Base** : le PV officiel `PV_AFSR_PPM_CENTRALE.docx`, et sa variante régionale si la portée le demande (B2.7). On garde
   l'en-tête, l'emblème, les styles, le tableau des signatures et le tableau d'annexe.
2. **Titre** : « PROCÈS-VERBAL D'EXAMEN DU <objet de la famille> » (B3).
3. **Nature et intitulé** : le libellé reste, la valeur devient la phrase d'intitulé de la famille (B3). La mise en forme du libellé
   (premier morceau du paragraphe) et celle de la valeur (dernier morceau) sont conservées.
4. **« L'an … »** : `<DATE EXAMEN>` devient `{{PV.DATE_EXAMEN|lettres}}` dans ce seul paragraphe. Partout ailleurs, il devient
   `{{PV.DATE_EXAMEN}}`.
5. **Avis** : le paragraphe d'avis devient la phrase d'avis de la famille, en trois blocs `{{SI:FAVORABLE}}`, `{{SI:AVEC_RESERVES}}` et
   `{{SI:DEFAVORABLE}}`. Le bloc défavorable contient `{{SAISI:motif_defavorable}}`. Juste après, un paragraphe de même mise en forme :
   `{{SI:OBS_GENERALE}}Observations générales de la Commission : {{SAISI:observation_generale}}{{FINSI:OBS_GENERALE}}`.
6. **Annexe** :
   - `{{SI:AVEC_RESERVES}}` en tête du paragraphe « ANNEXE » ;
   - `{{FINSI:AVEC_RESERVES}}` dans le premier paragraphe qui suit le dernier tableau ;
   - `{{POUR:OBSERVATIONS}}{{OBS.POINT}}` à la place de `<POINT DE CONTROLE>`.
7. **Portée** :
   - avec `centrale` ou `regionale`, on part du seul fichier de cette portée ;
   - avec `les-deux`, les lignes d'en-tête et la formule qui diffèrent entre les deux fichiers du plan sont réunies en blocs
     `{{SI:CENTRALE}}` et `{{SI:REGIONALE}}` (conditions `portee = centrale` et `portee = regionale`).
   Si `les-deux` est trop délicat à assembler proprement, le défaut peut être `centrale`. Dans ce cas, le dire dans la réponse :
   l'Administrateur ajoutera la variante régionale à la main.
8. **Anciens chevrons** : tous les autres deviennent la variable de leur alias (`CatalogueModelesPv.ALIAS`). Aucun chevron ne reste.
9. **Familles à listes** (marché) : la phrase d'intitulé ou d'avis peut appeler une ligne répétée `{{POUR:TITULAIRES}}`. Elle se pose
   alors dans un petit tableau inséré après l'avis (voir B3). Si c'est trop lourd en G1, les titulaires peuvent rester hors du modèle
   de départ : le dire.

> ⚠️ **2026-10-21, livré (backend), avec trois précisions**
> - **`les-deux` est livré** (B2.7) et reste le défaut. La base est le PV centrale. Ses quatre écarts avec le PV régional
>   deviennent des blocs `CENTRALE` / `REGIONALE` :
>   - la ligne « COMMISSION … DES MARCHES » de l'en-tête ;
>   - la localité `{{COMMISSION.LOCALITE}}`, avec ses pointillés, sous cette ligne ;
>   - « Commission Centrale / Régionale » dans « L'an … » ;
>   - la même mention dans l'avis.
> - **Les titulaires sont livrés** (B2.9) pour le dossier de marché, juste après l'observation générale et quel que soit l'avis :
>   - la ligne « Titulaire(s) proposé(s) : » ;
>   - un tableau à bordures, aligné sur l'avis et dans sa police. Son en-tête est en gras (RANG, CANDIDAT PROPOSÉ, MONTANT HT (Ar),
>     DÉLAI D'EXÉCUTION) et sa ligne `{{POUR:TITULAIRES}}` porte `TIT.RANG`, `TIT.CANDIDAT`, `TIT.MONTANT_HT` et `TIT.DELAI` ;
>   - « Écart à l'estimation : `{{MARCHE.ECART}}` ».
> - **Écart avec B2.6 : la fin de l'annexe.** `{{FINSI:AVEC_RESERVES}}` est posé dans le **dernier** paragraphe du document, pas
>   dans le premier après le tableau.
>   - **La cause** : dans la base, l'annexe est séparée par un **saut de section**, et ce saut restait en place quand l'annexe
>     disparaissait. Le modèle de départ du 21/10 donnait ainsi **une page 2 blanche** pour un avis favorable ou défavorable
>     (constaté dans Word).
>   - **La correction** : le saut de section est retiré, puisque les deux sections ne diffèrent que par un pied de page équivalent
>     (le numéro de page). Le paragraphe « ANNEXE » porte un saut de page qui part avec lui. Les paragraphes vides de fin
>     disparaissent avec l'annexe.
>   - **Vérifié dans Word**, sur le dossier de mise en concurrence et le dossier de marché, en centrale et en régionale : 1 page
>     sans réserves, 2 avec l'annexe.

## B3 — Les phrases de chaque famille

Ce sont des **propositions du front, à valider par la CNM**. Les variables citées existent toutes au catalogue (vérifié le 21/10
sur `GET /api/modeles-pv/variables`).

| Famille | Objet (titre) | Intitulé du dossier | Avis — favorable / avec réserves / défavorable |
|---|---|---|---|
| DMC — dossier de mise en concurrence | DOSSIER DE MISE EN CONCURRENCE | `{{DOSSIER.SOUS_TYPE}} n° {{DOSSIER.REFERENCE}} — {{PROCEDURE.OBJET}} (procédure {{PROCEDURE.NUMERO}}, {{PROCEDURE.MODE}}, lot {{PROCEDURE.LOT}})` | « FAVORABLE au dossier de mise en concurrence. » / « FAVORABLE au dossier de mise en concurrence, sous réserve qu'il soit tenu compte des observations portées en annexe. » / « NON FAVORABLE au dossier de mise en concurrence, pour le motif suivant : `{{SAISI:motif_defavorable}}`. » |
| DDM — dossier de marché | DOSSIER DE MARCHÉ | `{{DOSSIER.SOUS_TYPE}} n° {{DOSSIER.REFERENCE}} — {{PROCEDURE.OBJET}} (procédure {{PROCEDURE.NUMERO}}, lot {{PROCEDURE.LOT}}), issu du dossier de mise en concurrence {{MARCHE.DOSSIER_MEC}}` | « FAVORABLE à l'attribution du marché. » / « FAVORABLE à l'attribution du marché, sous réserve qu'il soit tenu compte des observations portées en annexe. » / « NON FAVORABLE à l'attribution du marché, pour le motif suivant : `{{SAISI:motif_defavorable}}`. » — puis, si B2.9 : le tableau des titulaires proposés (`TIT.RANG`, `TIT.CANDIDAT`, `TIT.MONTANT_HT`, `TIT.DELAI`) et la ligne « Écart à l'estimation : `{{MARCHE.ECART}}` » |
| DGC — acte de gestion contractuelle | ACTE DE GESTION | `{{DOSSIER.SOUS_TYPE}} n° {{DOSSIER.REFERENCE}}` | « FAVORABLE à l'acte de gestion. » / « … sous réserve qu'il soit tenu compte des observations portées en annexe. » / « NON FAVORABLE à l'acte de gestion, pour le motif suivant : `{{SAISI:motif_defavorable}}`. » |
| DSS — déclaration sans suite | DÉCLARATION SANS SUITE | `{{DOSSIER.SOUS_TYPE}} n° {{DOSSIER.REFERENCE}}` | « FAVORABLE à la déclaration sans suite. » / « … sous réserve… » / « NON FAVORABLE à la déclaration sans suite, pour le motif suivant : `{{SAISI:motif_defavorable}}`. » |
| DDP — plan de passation | — | — | Pas de génération : le plan a ses 12 fichiers intégrés, et sa reprise relève du lot G4. |

Les familles DGC et DSS n'ont au catalogue que les groupes communs : Commission, Dossier, PV, Personnes, Observations. Leur intitulé
ne peut donc nommer ni l'objet de l'acte, ni le marché concerné, ni le motif de la déclaration. Voir Q3.

> ⚠️ **2026-10-21, livré (backend) — un article dans le titre.** « PROCÈS-VERBAL D'EXAMEN **DU** ACTE DE GESTION » ne se
> dit pas. Le titre porte donc l'article de chaque famille :
> - « DU DOSSIER DE MISE EN CONCURRENCE » ;
> - « DU DOSSIER DE MARCHÉ » ;
> - « DE L'ACTE DE GESTION CONTRACTUELLE » ;
> - « DE LA DÉCLARATION SANS SUITE ».
>
> Les intitulés et les phrases d'avis sont ceux du tableau. Les phrases d'avis sont précédées de « AVIS », en gras comme dans la
> base : « émet un **AVIS FAVORABLE** au dossier de mise en concurrence. ».
>
> Elles sont dans le code (`ModelePvDepart.FAMILLES`), à faire valider par la CNM.

## B4 — Conditions et champs déclarés d'office

| Nom | Expression | Libellé |
|---|---|---|
| `FAVORABLE` | `avis = FAV` | Avis favorable |
| `AVEC_RESERVES` | `avis = FAVR` | Avis favorable avec réserves |
| `DEFAVORABLE` | `avis = DEF` | Avis défavorable |
| `OBS_GENERALE` | `saisi.observation_generale renseigne` | Une observation générale est saisie |
| `CENTRALE`, `REGIONALE` | `portee = centrale`, `portee = regionale` | seulement avec `les-deux` |

| Code | Libellé | Type | Obligatoire | Visible si | Aide |
|---|---|---|---|---|---|
| `motif_defavorable` | Motif de l'avis défavorable | `TEXTE_LONG` | oui | `DEFAVORABLE` | Obligatoire quand l'avis est défavorable. |
| `observation_generale` | Observation générale de la Commission | `TEXTE_LONG` | non | — | Facultative : un constat d'ensemble sur le dossier. |

Le rapport de la version produite doit être **sans blocage**. Le front le vérifie en recette.

> ⚠️ **2026-10-21, livré (backend), tel que demandé** : conditions et champs déclarés d'office, rapport **sans blocage**.
> - En test, son seul avertissement est l'essai PDF, désactivé en test.
> - Les apostrophes du texte assemblé sont typographiques (’), comme dans la base.

## Questions

- **Q1 — Où vivent les phrases de B3 ?**
  - en code : simple, mais chaque correction de la CNM passe par une livraison ;
  - en table administrable : un écran de plus pour l'Administrateur.
  Le front propose le code pour ce lot, la table plus tard si la CNM les retouche souvent.
- **Q2 — La base.** `PV_AFSR_PPM_CENTRALE.docx` convient-il comme base de toutes les familles, puisqu'il a l'annexe et le tableau des
  signatures ? Ou faut-il un fichier de base neutre, livré à part ?
- **Q3 — Actes de gestion et déclaration sans suite.** Faut-il ajouter au catalogue des variables pour ces familles (objet de l'acte,
  marché concerné, motif de la déclaration) ? Sans elles, leur PV ne nomme que la référence du dossier.
- **Q4 — Portée.** `les-deux` (B2.7) est-il réaliste pour ce lot ?

> ⚠️ **2026-10-21, réponses (backend)**
> - **Q1 — dans le code** pour ce lot (`ModelePvDepart.FAMILLES`). Une table viendra si la CNM les retouche souvent.
> - **Q2 — `PV_AFSR_PPM_*` convient** : c'est la seule base qui ait l'annexe et le tableau des signatures. Il n'y a pas de fichier
>   neutre à livrer.
> - **Q3 — pas encore.** Il faut d'abord savoir où lire l'objet de l'acte, le marché concerné et le motif de la déclaration, pour
>   les dossiers DGC et DSS. C'est une question pour la CNM. D'ici là, leur PV ne nomme que la référence du dossier.
> - **Q4 — oui**, `les-deux` est livré et reste le défaut.
> - **Deux écarts avec le PV intégré, non traités** :
>   - une ligne « Président … : » ou « Chef de la Commission : » s'imprime même sans nom, faute de clé de condition sur la
>     présence ; le générateur intégré, lui, la retire ;
>   - le viseur est `{{PV.VISEUR}}` seul, sans la qualité ni la mention « par intérim » que porte la ligne du PV intégré.
>
>   À compléter dans Word par l'Administrateur, ou plus tard par une clé de condition si la CNM le demande.

## Côté front

À la livraison, sur la fiche d'un modèle :
- un bouton « Générer un modèle de départ » sur un modèle **sans version** qui sert au moins un sous-type ;
- un choix de portée, si `les-deux` n'est pas retenu ;
- l'ouverture de la version produite sur son rapport, avec un encadré « Texte proposé par l'application — à faire valider par la
  CNM avant mise en vigueur » ;
- la gestion des refus `SANS_SOUS_TYPE` et `FAMILLES_MULTIPLES`, avec un message en clair.
