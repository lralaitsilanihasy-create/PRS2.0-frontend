# Demande backend — 2026-10-28 — Pas de « fin prévue » une fois le compteur de la CNM arrêté

## Contexte

Recette du 28/10 (dossier 00002/DAOO-CC/CNM/2026, statut `DECISION_TRANSMISE_SIGMP`) : la page du dossier affichait « Fin de
traitement prévue : mer. 28/10/2026 » — la date du jour —, alors que l'encadré de l'étape disait « Archivage en cours · avant
ven. 30/10 ».

Lecture de `ChronometrageService.datePrevisionnelleFin(statut, …)` :

- en `DECISION_TRANSMISE_SIGMP`, l'étape courante est `ARCHIVAGE`, **hors du compteur global** (`dansCompteurGlobal = false`) :
  la transmission à SIGMP a arrêté le compteur (chronométrage du 01/09) ;
- la boucle sur `etapesDuCompteur()` ne retient alors **aucune** étape (toutes ont un rang inférieur à `ARCHIVAGE`) : le total vaut
  0 heure, et la méthode rend `JoursOuvres.ajouter(maintenant, 0)` = **aujourd'hui** ;
- le même cas vaut pour tout statut dont l'étape de référence est hors compteur après sa fin.

C'est une prévision fausse : le traitement de la CNM est **terminé**, il n'y a plus de fin à prévoir. Elle est servie :

- sur `GET /api/dossiers/{id}` et les listes de dossiers (`DossierService`, `datePrevisionnelleFin`) ;
- sur `GET /api/dossiers/{id}/chronometrage` ;
- sur `GET /api/a-faire` (`delai.datePrevisionnelleFin`), où elle sert de **clé de tri** de l'urgence `SUIVI`
  (`AFaireService.cleIntraUrgence`) : un dossier transmis se trie comme un dossier dont la fin tombe aujourd'hui.

Côté front, l'affichage est déjà corrigé (c90cd0f) : après la transmission, l'en-tête dit « Traitement de la CNM : terminé » et
l'accueil n'affiche plus la ligne. Reste la donnée.

## B1 — `datePrevisionnelleFin` nulle quand le compteur est arrêté

Quand le compteur global est arrêté — transmission SIGMP faite (`DECISION_TRANSMISE_SIGMP`), dossier clos (`CLOTURE`), remplacé
(`REMPLACE`) —, `datePrevisionnelleFin` vaut **`null`**, partout où elle est servie.

Plus généralement : si aucune étape du compteur ne reste à courir (total de la boucle sans étape retenue), `null` plutôt que
« aujourd'hui ».

> ⚠️ **Backend, 2026-10-28 — livré par la règle générale.** `datePrevisionnelleFin` vaut `null` dès que la boucle ne retient
> aucune étape du compteur. Il n'y a pas de liste de statuts en dur : la règle couvre tout statut dont l'étape de référence est
> hors compteur après sa fin. Aujourd'hui, c'est `DECISION_TRANSMISE_SIGMP` (référence `ARCHIVAGE`). `CLOTURE` et `REMPLACE`
> n'ont pas d'étape de référence et rendaient déjà `null`. La date est servie au même endroit partout (`DossierDto`, listes,
> `…/chronometrage`, `/api/a-faire`), donc partout nulle.

## B2 — Le tri de l'accueil

L'urgence `SUIVI` trie par date prévisionnelle croissante ; une date nulle passe **après** les dates connues (règle actuelle des
clés nulles, à confirmer). Rien d'autre ne change.

> ⚠️ **Backend, 2026-10-28 — confirmé, sans changement de code.** Le tri de l'accueil range déjà une clé nulle **après** les
> clés connues (`Comparator.nullsLast`). Viennent ensuite `idDossier`, puis l'ordre des sections.

## B3 — (facultatif) La date de fin réelle

Si c'est simple : servir sur le chronométrage la **date de fin du compteur** (`finCompteur`, déjà servie) suffit au front pour écrire
« Traitement de la CNM terminé le jj/mm » ; rien de nouveau n'est demandé si `finCompteur` reste servi tel quel.

> ⚠️ **Backend, 2026-10-28 — inchangé.** `GET /api/dossiers/{id}/chronometrage` sert toujours `finCompteur`, la date-heure de la
> clôture de l'étape `TRANSMISSION_SIGMP` (`null` tant que le dossier court). Rien d'ajouté.

## Hypothèses à confirmer

- **H1** : les statuts concernés sont `DECISION_TRANSMISE_SIGMP`, `CLOTURE`, `REMPLACE` ; `RETIRE` rend déjà `null`.
- **H2** : aucun consommateur serveur (alertes, KPI, rappels) ne s'appuie sur une date non nulle pour ces statuts ; sinon le dire.

> ⚠️ **Backend, 2026-10-28 — H1 et H2 confirmées.**
> - **H1 :** `RETIRE`, `CLOTURE` et `REMPLACE` rendaient déjà `null`. Seul `DECISION_TRANSMISE_SIGMP` change.
> - **H2 :** aucun consommateur serveur n'attend une date non nulle. Elle n'a que trois lecteurs, tous tolérants au `null` : le
>   tri de l'accueil, le widget compact du chronométrage et l'outil « dossier » de l'assistant IA, qui omet alors la ligne
>   « Fin prévisionnelle ». Aucune alerte, aucun KPI ni aucun rappel ne la lit.
>
> Contrat : `PRS20/docs/api-endpoints.md`, § *Le calcul*, du chronométrage.

## Côté front, une fois livré

- Rien d'obligatoire : l'écran ne lit déjà plus la date pour ces statuts. Il pourra écrire « terminé le jj/mm » depuis `finCompteur`.
