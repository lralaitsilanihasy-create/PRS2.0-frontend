# Demande backend — 2026-10-30 — Dossier de marché : les publications fournies par les données, et plus de fichier sur une pièce fournie

## Contexte

Demande du pilote du 30/10, sur le dossier de marché `00010/MAOO/CNM/2026` (dossier 100399, procédure 5) : « revoir les pièces jointes
qui ne doivent plus être en pièces jointes mais en données ».

Le dossier porte onze pièces. Six sont jointes d'office par l'attribution (`PRODUITE_PAR = ATTRIBUTION` : projet de marché, DAO complet,
DQE estimatif, bordereau de l'offre, PV d'ouverture, rapport d'évaluation). Cinq sont des **fichiers déposés à la main** :

| Pièce (code) | Fichier déposé | Ce que l'application sait déjà |
|---|---|---|
| `FICHE_PRESENTATION` | `piece-26-recette-formes.pdf` | **fournie** par `PiecesFournies.duMarche` (fiche de la procédure validée) |
| `PV_CNM_DMC` | `piece-49-recette-formes.pdf` | **fournie** (PV signé de la Commission sur le DAO) |
| `PV_VALIDATION_CAO` | `piece-50-recette-formes.pdf` | **fournie** (le rapport d'évaluation signé en tient lieu) |
| `PUBLICATION_AGPM` | `piece-29-recette-formes.pdf` | déposée **une fois sur le plan** (V118) ; reprise d'office par les dossiers de mise en concurrence, **pas** par le dossier de marché |
| `PUBLICATION_AVIS` | `piece-47-recette-formes.pdf` | l'avis spécifique est **produit et imprimé** par l'application ; sa première impression fait passer la ligne « Lancé » (journal `LIGNE_LANCEE`) ; en prestations intellectuelles, les lettres d'invitation sont envoyées par l'application (`t_invitation.INVITE_LE`) |

Les trois premiers fichiers ont été déposés par le script de recette du 29/10, qui remplissait toutes les pièces exigées sans tenir
compte de `fourniePar`. Le serveur les a acceptés. **Côté front, c'est corrigé** : un fichier joint sur une pièce que l'application
fournit et qu'un onglet présente n'est plus listé, et un renvoi mène à l'onglet. Les deux publications, elles, restent à déposer à la
main : c'est l'objet de B1 et B2.

## B1 — La publication de l'AGPM reprise par le dossier de marché

`PublicationAgpmService.joindreSiAbsente` et `planDuDossier` partent de `Dossier.ID_DMC`, qui est **nul** pour un dossier de marché né
d'une attribution : le plan n'est pas trouvé, la publication n'est pas reprise.

Demandé : pour un dossier de marché né d'une attribution, trouver le plan par la **procédure** (`procedureDe(d).idDmc()` → la ligne →
son plan), comme pour le dossier de mise en concurrence. Deux formes possibles :

- **(a)** la reprise d'office à la soumission, comme aujourd'hui (fichier `PUBLICATION_AGPM_<référence>.pdf`, journal
  `PUBLICATION_AGPM_REPRISE`) ;
- **(b)** ou mieux, la déclarer **fournie par l'application** dans `PiecesFournies.duMarche` (`PUBLICATION_AGPM` → la publication du
  plan, lien `GET /api/dossiers/{id}/publication-agpm/contenu`), sans copier le fichier.

Le front sait afficher les deux : (a) avec la mention « reprise du plan », (b) comme les autres pièces fournies.

## B2 — La publication de l'avis fournie par les données

Pour une procédure menée dans l'application, le serveur détient la preuve de la première publication :

- l'avis spécifique produit depuis la fiche, et la date de sa **première impression** (ligne passée « Lancé ») ;
- en prestations intellectuelles, les **lettres d'invitation** envoyées, leurs destinataires et leur date d'envoi.

Demandé : déclarer `PUBLICATION_AVIS` **fournie par l'application** dans `PiecesFournies.duMarche` quand cette preuve existe, avec un
lien vers l'avis (ou les lettres) tel qu'imprimé, et la date de première publication.

**Q1** — Le pilote doit dire si le **journal** de publication, c'est-à-dire la parution dans un journal d'annonces légales, reste exigé
comme preuve distincte. Si oui, `PUBLICATION_AVIS` reste à déposer, mais une seule fois : sur la procédure, à la publication. Elle est
alors reprise par le dossier de marché, comme l'AGPM en B1.

> ⚠️ **2026-10-30 — décision du pilote sur Q1 : oui, le journal reste exigé.** B2 devient :
> - le **journal de première publication de l'avis** (ou, en prestations intellectuelles, les lettres d'invitation avec accusé) se
>   **dépose une seule fois, sur la procédure**, après sa publication — sur le modèle de la publication de l'AGPM déposée sur le plan
>   (V118) : un fichier, la date de parution, le journal, le numéro ;
> - le dossier de marché né de l'attribution le **reprend d'office** à sa soumission, sous `PUBLICATION_AVIS`, avec la mention
>   « reprise de la procédure » (même forme que B1, variante (a) ou (b)) ;
> - l'avis imprimé par l'application et la date de première impression ne remplacent **pas** le journal : ils restent des données de
>   la procédure, sans valeur de preuve de parution.
>
> Demandé en plus : la route de dépôt et de lecture de ce journal sur la procédure (comme `…/publication-agpm` sur le plan), pour que
> le front propose le dépôt depuis l'écran de la procédure, à la publication.

## B3 — Refuser un fichier sur une pièce fournie par l'application

Le serveur accepte aujourd'hui un dépôt (`POST /api/piece-jointe-dossiers`) sur un type que `pieces-exigees` déclare
`fourniePar = APPLICATION`. Demandé : 409 **`PIECE_FOURNIE_PAR_APPLICATION`**, avec le libellé de la pièce dans `details`. L'écran ne
propose déjà pas de dépôt sur ces pièces : le refus protège des dépôts par script et des anciens écrans.

## Données de recette

Les cinq fichiers `piece-NN-recette-formes.pdf` des dossiers de marché de la recette du 29/10 (100398 `00009/MAOO-CC`, 100399
`00010/MAOO`) peuvent être retirés une fois B1 et B2 livrés. C'est une décision du pilote, puisqu'il s'agit de données de recette.

> ⚠️ **2026-10-30 — accord du pilote** : le front retirera ces fichiers déposés à la main dès la livraison de B1 et B2, après une
> sauvegarde de la base, et vérifiera que les deux publications sont alors reprises d'office.

## Ce que fait le front

- **Livré avec cette demande** (`dossier-pieces.ts`) : la liste des pièces se lit dans tous les états du dossier. Un fichier joint sur
  une pièce fournie par l'application que présente un onglet (fiche de présentation, PV de la Commission, PV de validation de la CAO)
  n'est plus listé, et un renvoi « Fournies par l'application, dans leurs onglets » mène à l'onglet.
- **Après B1 et B2** : la publication de l'AGPM et celle de l'avis s'affichent comme pièces reprises (« reprise du plan », « reprise
  de la procédure »). L'écran de la procédure propose de déposer le journal de l'avis une seule fois, à la publication, sur le modèle
  de `app-publication-agpm` (⚠️ 30/10, décision du pilote sur Q1).
- **Après B3** : le refus se nomme dans l'écran (« Cette pièce est fournie par l'application : rien à déposer »).

> ⚠️ **2026-10-30 — B1, B2, B3 livrés (PRS20, V154 ; forme (b) pour les deux publications). Précisions et écarts :**
> - **B1 — le diagnostic était inexact** : le serveur trouvait déjà le plan d'un dossier de marché par son attribution
>   (`PublicationAgpmService.planDuDossier`, depuis le 15/10). En recette, la reprise n'a pas joué parce que les dossiers 100398 et 100399
>   portaient déjà un fichier déposé à la main (la reprise ne joue que si la pièce manque). Livré en **forme (b)** : `PUBLICATION_AGPM`
>   est **fournie** au dossier de marché quand une publication est en vigueur sur le plan de la ligne (`lien`
>   `/api/dossiers/{id}/publication-agpm/contenu`, `idDossierPlan` = le plan) ; plus de copie pour ce dossier. Les dossiers de mise en
>   concurrence gardent la reprise par copie (inchangée).
> - **B2** — dépôt sur la procédure : `POST /api/fiches-marche/{idDmc}/publication-avis` (multipart `fichier` PDF, `journal`,
>   `numero` facultatif, `dateParution`), PRMP ou UGPM ; lecture `GET …/publication-avis` et `…/contenu`, et depuis un dossier
>   `GET /api/dossiers/{id}/publication-avis[/contenu]`. **Ouvert après l'impression de l'avis** : 409 `AVIS_NON_PUBLIE` avant (en
>   PI, avant la production des lettres), `FICHE_NON_VALIDEE` sans version validée. `PublicationAvisDto` = `{ idPublication, idDmc,
>   nature, journal, numero, dateParution, nomFichier, taille, deposePar, deposeLe }` ; `nature` = `JOURNAL`, ou `LETTRES_INVITATION`
>   en prestations intellectuelles (le **journal y est facultatif**, `dateParution` = date d'envoi). Un nouveau dépôt remplace le
>   précédent. Au dossier de marché, `PUBLICATION_AVIS` est **fournie** (lien `/api/dossiers/{id}/publication-avis/contenu`).
>   **Pas de notification** au dépôt, et pas de champ « déjà déposée » sur la liste des procédures : à demander si l'écran en a besoin.
> - **B3** — 409 `PIECE_FOURNIE_PAR_APPLICATION`, `details.piece` (libellé) et `details.code`, sur **tout** dossier (mise en
>   concurrence comprise : fiche de présentation, calendrier, contrôle du plan, canevas).
> - **Données de recette** : les fichiers déjà déposés restent tant que le front ne les retire pas ; le serveur les liste toujours.

> ⚠️ **2026-10-30 (soir) — recette du front sur V154** : base sauvegardée (`DBPRS20-avant-retrait-pieces-recette-2026-10-30.dump`),
> puis les dix fichiers `piece-NN-recette-formes.pdf` retirés par `DELETE /api/piece-jointe-dossiers/{id}` (Administrateur ; pièces
> 49-53 du dossier 100398, 60-64 du dossier 100399 ; 204 chacun). Restent sur chaque dossier les six fichiers de l'attribution.
> `pieces-exigees` des deux dossiers : `FICHE_PRESENTATION`, `PUBLICATION_AGPM`, `PV_CNM_DMC`, `PV_VALIDATION_CAO` **fournies** ;
> `PUBLICATION_AVIS` reste à fournir tant que le journal n'est pas déposé sur la procédure — l'écran de dépôt est le lot front suivant.
