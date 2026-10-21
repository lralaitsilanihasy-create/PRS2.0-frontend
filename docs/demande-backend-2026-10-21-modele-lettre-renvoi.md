# Demande backend — 2026-10-21 — Modèles de PV : rédiger la lettre de renvoi dans l'application

## Contexte

Le pilote demande où sont les lettres de renvoi dans l'écran « Modèles de procès-verbaux ».

Aujourd'hui, la lettre de renvoi est produite **uniquement par le modèle intégré** `LETTRE-RENVOI-INTEGREE` :
- deux fichiers Word, `LR_CENTRALE.docx` et `LR_REGIONALE.docx` (`LettreRenvoiDocumentGenerator`) ;
- la couverture sert les 26 sous-types en `produitPar: INTEGRE`.

Depuis l'option C' (décision du pilote du 21/10), un modèle se rédige comme une page dans l'application. Pour la lettre de renvoi, trois
choses manquent :

1. **Le catalogue n'a pas les variables de la lettre.** `CatalogueModelesPv` ne sert pour elle que `DOSSIER.REFERENCE` (sa seule
   variable requise). Les champs que les fichiers Word remplissent n'ont pas d'équivalent :
   - `<DATE_LETTRE>`, `<DATE EXAMEN>`, `<CORPS DE LA LETTRE>` ;
   - le signataire : `<NOM ET PRENOMS DU PRESIDENT OU CHEF DE COMMISSION>` (centrale), `<NOM ET PRENOMS DU CHEF DE COMMISSION>`
     (régionale) ;
   - `<LOCALITE DOSSIER>` (régionale).
2. **Pas de modèle de départ.** `POST /api/modeles-pv/{id}/versions/depart` répond 400 `NATURE_SANS_DEPART` pour une lettre.
3. **Pas de relève.** Un modèle de lettre mis en vigueur ne produit rien : `LettreRenvoiService.genererEtStockerDocument` lit
   toujours les fichiers Word. C'est la part « lettre de renvoi » du lot P4 (demande `modele-pv-page`, §Lots).

## B1 — Les variables de la lettre au catalogue

Ajouter au catalogue (`GET /api/modeles-pv/variables`), pour la nature `LETTRE_RENVOI`, une section « Lettre de renvoi » :

| Code proposé | Remplace | Valeur |
|---|---|---|
| `LETTRE.DATE` | `<DATE_LETTRE>` | date de la lettre (formats de date usuels, dont `lettres`) |
| `LETTRE.DATE_EXAMEN` | `<DATE EXAMEN>` | date de l'examen |
| `LETTRE.CORPS` | `<CORPS DE LA LETTRE>` | le corps, **avec** les informations de la fiche DAO visées (`corpsAvecInformationsFiche`), sauts de ligne compris |
| `LETTRE.SIGNATAIRE` | les deux placeholders du nom | le nom du signataire, selon la portée (règle de localité de `signer`) |
| `LETTRE.LOCALITE` | `<LOCALITE DOSSIER>` | la localité du dossier, en majuscules |

- `DOSSIER.REFERENCE` et l'entité contractante (`<NOM_ENTITE_CONTRACT>`) existent déjà au catalogue ; à confirmer pour l'entité.
- **Variables requises** de la nature `LETTRE_RENVOI` : proposer `DOSSIER.REFERENCE`, `LETTRE.CORPS`, `LETTRE.SIGNATAIRE`.
- La condition `portee` (`centrale` / `regionale`) existe déjà : une seule page avec deux passages suffit, comme le départ des PV.

> ⚠️ **2026-10-21, livré (backend), avec trois précisions**
> - **Le catalogue se filtre par nature** : `GET /api/modeles-pv/variables?nature=LETTRE_RENVOI`. La réponse porte `nature` et le
>   groupe « Lettre de renvoi ». Elle ne contient ni les variables du PV (`PV.*`, `OBS.*`, `TIT.*`, `MARCHE.*`) ni les listes
>   répétées. Sans `nature`, le catalogue sert tout, comme avant.
> - **Une variable hors de sa nature est bloquante** au contrôle : `VARIABLE_HORS_NATURE` (un `PV.MEMBRE` dans une lettre, un
>   `LETTRE.CORPS` dans un PV). Les variables requises sont celles proposées.
> - **`LETTRE.LOCALITE` rend le libellé tel quel.** Les majuscules du Word s'écrivent `{{LETTRE.LOCALITE|majuscules}}`, comme
>   dans le départ.
> - L'entité : `DOSSIER.ENTITE`, confirmé (le même libellé que `<NOM_ENTITE_CONTRACT>`).
> - **L'aperçu d'une version de lettre** prend `lettre=`, à défaut la dernière lettre du dossier, même non signée (comme l'aperçu de
>   l'intégré). Codes : 409 `LETTRE_ABSENTE`, 404 pour une lettre d'un autre dossier. La portée est celle de la lettre.

## B2 — Le modèle de départ d'une lettre

`POST /api/modeles-pv/{id}/versions/depart` sur un modèle de nature `LETTRE_RENVOI` :
- assemble une page d'après `LR_CENTRALE.docx` et `LR_REGIONALE.docx` ;
- portée `les-deux` : les parties qui diffèrent dans deux passages `CENTRALE` / `REGIONALE`, avec leurs règles déclarées ;
- les placeholders deviennent les variables de B1, l'emblème est repris de la bibliothèque comme pour les PV ;
- le motif posé est le même que pour un PV (`MOTIF_VERSION_DEPART`), pour que l'écran affiche l'encadré « texte à faire valider ».

`NATURE_SANS_DEPART` ne reste vrai que s'il apparaît plus tard une nature sans départ.

> ⚠️ **2026-10-21, livré (backend) — deux écarts de rendu, signalés.**
> - **Le départ ne demande pas de rattachement** : une seule lettre pour tous les sous-types (Q1), il n'y a pas de famille à lire.
> - **L'emblème** : la lettre Word porte une petite image (199 × 88 pixels) qui contient déjà « REPOBLIKAN'I MADAGASIKARA » et la
>   devise, et elle les réécrit en texte en dessous. Le départ reprend l'emblème des PV (`EMBLEME`, la même image en haute
>   définition), à 45 mm, sans répéter ces deux lignes.
> - **Les marges** : celles du Word (7,5 mm à gauche, aucune à droite, puis des retraits de paragraphe) deviennent des marges de page
>   de 25 et 23 mm, avec les mêmes positions.
> - Rendu vérifié en image, en centrale et en régionale : **une page**, proche du Word.
>
> **Texte repris tel quel, à faire valider par la CNM.** La lettre régionale écrit, comme le fichier intégré :
> - « **Antananarivo**, le … », alors que `COMMISSION.CHEF_LIEU` existe ;
> - « la **Commission Nationale des Marchés** renvoie l'examen… ».
>
> Le départ les garde pour que la comparaison avec l'intégré (L2) reste honnête. Une correction se fera dans la page, puis à la mise
> en vigueur.

## B3 — La relève de la lettre intégrée (part de P4)

Quand un modèle de lettre de renvoi a une version **en vigueur**, rattachée à des sous-types :
- `genererEtStockerDocument` et `apercu` produisent la lettre de ces sous-types **par cette page** (rendu PDF de P2) ;
- les autres sous-types gardent les fichiers intégrés ;
- `/couverture` passe ces sous-types en `produitPar: MODELE` (ou la valeur déjà prévue par la relève du plan) ;
- `/integres` met `enService: false` quand plus aucun sous-type n'est servi par les fichiers.

Comme pour le plan (demande `modele-pv-page`, §B6) : la relève ne se fait qu'après comparaison des rendus sur des dossiers réels. Le
front propose de la garder sous la même condition : la mise en vigueur ne change rien tant que la comparaison n'est pas faite.

> ⚠️ **2026-10-21, non livré (backend) : L2 attend la comparaison**, comme le propose le front.
> - La production (`genererEtStockerDocument`) lit toujours les fichiers intégrés.
> - La couverture des lettres reste `INTEGRE`.
> - La relève se fera avec P4 (la relève du plan).

## Questions

- **Q1 — Un modèle pour toutes les lettres ?** Le front propose **un seul modèle** de lettre, rattaché aux 26 sous-types. Faut-il
  plutôt un modèle par famille ? Aujourd'hui les deux fichiers ne distinguent que la portée.
- **Q2 — Le corps.** `LETTRE.CORPS` est un texte saisi par le Membre, rendu tel quel. Faut-il le rendre en plusieurs paragraphes (un
  par saut de ligne) ? Le front le propose.
- **Q3 — Rattachement.** Un modèle de lettre peut-il être rattaché dès maintenant aux sous-types, alors que l'intégré les sert
  encore ? Le front le propose, comme pour PV-PLAN (« Remplacera le modèle intégré »).

> ⚠️ **2026-10-21, réponses (backend)**
> - **Q1 — Un seul modèle**, rattaché aux 26 sous-types : les deux fichiers ne distinguent que la portée.
> - **Q2 — Oui, déjà le cas** : un saut de ligne dans une valeur devient un retour à la ligne de la page, comme le Word intégré.
>   Pour toutes les variables, pas seulement le corps. Le corps reste dans son paragraphe : il suit « demandant au service de : »,
>   après un retour à la ligne posé par le départ.
> - **Q3 — Oui**, c'est déjà permis. La couverture reste `INTEGRE` jusqu'à la relève.

## Lots

| Lot | Contenu |
|---|---|
| L1 | B1 (variables) et B2 (modèle de départ) : la lettre se rédige et s'aperçoit dans l'application |
| L2 | B3 : la relève, après comparaison des rendus |

## Côté front

- **Déjà fait (21/10)** : la page « Modèles de procès-verbaux » montre la couverture des lettres de renvoi à côté de celle des PV
  (sous-types servis par le modèle intégré ou par un modèle de l'application).
- **À la livraison de L1** : l'écran du modèle de lettre propose « Générer un modèle de départ » comme pour un PV ; l'éditeur reçoit
  les variables de la section « Lettre de renvoi » du catalogue sans autre changement.
- **À la livraison de L2** : la ligne « Lettre de renvoi » du groupe « En service » passe de l'intégré au modèle de l'application.
