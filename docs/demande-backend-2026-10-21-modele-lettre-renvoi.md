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

## B2 — Le modèle de départ d'une lettre

`POST /api/modeles-pv/{id}/versions/depart` sur un modèle de nature `LETTRE_RENVOI` :
- assemble une page d'après `LR_CENTRALE.docx` et `LR_REGIONALE.docx` ;
- portée `les-deux` : les parties qui diffèrent dans deux passages `CENTRALE` / `REGIONALE`, avec leurs règles déclarées ;
- les placeholders deviennent les variables de B1, l'emblème est repris de la bibliothèque comme pour les PV ;
- le motif posé est le même que pour un PV (`MOTIF_VERSION_DEPART`), pour que l'écran affiche l'encadré « texte à faire valider ».

`NATURE_SANS_DEPART` ne reste vrai que s'il apparaît plus tard une nature sans départ.

## B3 — La relève de la lettre intégrée (part de P4)

Quand un modèle de lettre de renvoi a une version **en vigueur**, rattachée à des sous-types :
- `genererEtStockerDocument` et `apercu` produisent la lettre de ces sous-types **par cette page** (rendu PDF de P2) ;
- les autres sous-types gardent les fichiers intégrés ;
- `/couverture` passe ces sous-types en `produitPar: MODELE` (ou la valeur déjà prévue par la relève du plan) ;
- `/integres` met `enService: false` quand plus aucun sous-type n'est servi par les fichiers.

Comme pour le plan (demande `modele-pv-page`, §B6) : la relève ne se fait qu'après comparaison des rendus sur des dossiers réels. Le
front propose de la garder sous la même condition : la mise en vigueur ne change rien tant que la comparaison n'est pas faite.

## Questions

- **Q1 — Un modèle pour toutes les lettres ?** Le front propose **un seul modèle** de lettre, rattaché aux 26 sous-types. Faut-il
  plutôt un modèle par famille ? Aujourd'hui les deux fichiers ne distinguent que la portée.
- **Q2 — Le corps.** `LETTRE.CORPS` est un texte saisi par le Membre, rendu tel quel. Faut-il le rendre en plusieurs paragraphes (un
  par saut de ligne) ? Le front le propose.
- **Q3 — Rattachement.** Un modèle de lettre peut-il être rattaché dès maintenant aux sous-types, alors que l'intégré les sert
  encore ? Le front le propose, comme pour PV-PLAN (« Remplacera le modèle intégré »).

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
