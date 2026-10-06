# Demande backend — 2026-10-06 — La liste des procédures en ligne, pour le responsable et l'Administrateur

> Demande du pilote (06/10) : « Est-ce qu'il y a des menus qu'on doit créer pour accéder aux nouvelles fonctionnalités ? » — puis
> « oui » à la proposition du front.

**Le constat.** Les écrans de la soumission en ligne s'atteignent aujourd'hui par un bouton de la fiche DAO, par une notification,
ou en tapant l'adresse. Le front a ajouté le 06/10 une entrée de menu « Appels d'offres » pour la PRMP et l'UGPM : c'est l'écran
existant `/prmp/dao`, servi par `GET /api/dmcs/eligibles`. Deux publics restent sans porte d'entrée.
- **Le responsable de la procédure** : un contrôleur de la CNM, ou l'Administrateur. Il règle les paramètres internes, conduit la
  cérémonie des clés et la séance. Il doit connaître la fiche pour y aller.
- **L'Administrateur**, qui désigne le responsable et suit les procédures. Il n'a aucune liste des fiches en remise électronique.

Aucune route ne sert ces listes : `GET /api/procedures-en-ligne` est la vitrine publique (procédures **lancées**, date limite non
passée), et `/api/dmcs/eligibles` est celle de la PRMP.

Les noms ci-dessous sont **proposés** : le backend fait autorité, et ce document sera corrigé en place si la livraison s'en écarte.

---

## B1 — `GET /api/fiches-marche/en-ligne`

| Appelant | Ce qui est servi |
|---|---|
| **Administrateur** | toutes les fiches dont la dernière version porte `modeRemise = ELECTRONIQUE`, brouillons compris (la désignation du responsable se fait avant la validation) |
| **Tout autre profil interne** | les seules fiches dont il est le **responsable** titulaire, et celles qu'il exerce **par intérim** pour un titulaire (ADR-0008), signalées |
| Profils externes (candidat, membre de la CAO, dépositaire) | 403 |

Un compte sans procédure reçoit **200 `[]`**, jamais 403 : le front s'en sert pour savoir s'il affiche l'entrée de menu (B2).

`ProcedureInterneDto` (proposé) :
- `idDmc`, `reference` (`B02-OB-03`, à défaut la référence du plan), `objet`, `autoriteContractante`, `categorie` ;
- `statutFiche` (`BROUILLON` | `VALIDEE` | révision ouverte) ;
- `responsable` : `{ im, nom }` ou `null` ; `parInterim: boolean` ;
- `etatCao`, `etatCeremonie` (les valeurs déjà servies par la fiche) ;
- `datePublication`, `dateOuvertureDepots`, `dateLimite`, `dateOuverturePlis` ;
- `etat` : `NON_LANCEE` | `A_VENIR` | `OUVERTE` | `CLOSE` (les trois derniers comme `ProcedureEnLigneDto`) ;
- `etatSeance` (`A_VENIR` … `CLOSE`, `null` avant l'heure) ;
- `nbOffres`, le **nombre** seul (comme le registre de la PRMP avant l'échéance).

Tri proposé : les procédures **à traiter** d'abord, c'est-à-dire sans responsable, cérémonie non close, séance du jour ou ouverte.
Puis par date limite croissante.

> ⚠️ **2026-10-06 — livré.** Écarts et précisions :
> - **`statutFiche`** vaut `BROUILLON`, `VALIDEE` ou **`REVISION`** (un brouillon après une version validée).
> - **`etat`** vaut `NON_LANCEE` tant que la procédure n'entre pas dans la liste publique : avis non imprimé, fiche non validée, ou
>   signature au-dessus de Simple. `datePublication` n'est servie qu'une fois la procédure lancée.
> - **`nbOffres`** compte les offres déposées et les offres écartées.
> - **Champ ajouté : `aTraiter`.** Il est vrai sans responsable, cérémonie non close, ou séance en cours ou du jour. Le tri suit la
>   proposition, avec les séances closes en dernier.
> - ⚠️ **Intérim.** L'intérimaire voit la procédure de son titulaire (`parInterim = true`), mais ne peut pas encore agir :
>   paramètres internes, cérémonie et séance restent réservés au **titulaire**, car l'intérim (ADR-0008) n'est pas étendu à la
>   remise électronique. C'est à trancher par le pilote si cela doit changer.
> - Les profils externes reçoivent 403 ; un compte interne sans procédure reçoit `[]`.

## B2 — Rien de plus pour le menu

Le front n'affiche l'entrée « Mes procédures en ligne » **que** si B1 rend au moins une procédure. Il l'appelle une fois à
l'ouverture de session, puis sur les notifications `typeObjet = PROCEDURE`. Aucune route de comptage à part n'est demandée. *Si le
backend préfère une route légère (`…/en-ligne/compte`), le front s'y adapte.*

> ⚠️ **2026-10-06 — conforme.** Il n'y a pas de route de comptage. Le front compte lui-même dans la liste, y compris les
> procédures sans responsable de la carte de l'Administrateur (`responsable = null`).

## Hypothèses

- **H1** — Un responsable dont la procédure est **close** (séance close, PV signé) la garde dans sa liste, en bas : le PV et la
  conservation s'y retrouvent. Une procédure close depuis plus de la durée de conservation des offres (V70) en sort.
- **H2** — La PRMP et l'UGPM ne reçoivent que les fiches dont elles sont responsables (cas de recette). Leur porte d'entrée reste
  « Appels d'offres ».

> ⚠️ **2026-10-06 — H1 et H2 retenues.** H1 : la durée de conservation se compte depuis la clôture de la séance ; si
> `OFFRE_CONSERVATION_ANNEES` est nul, la procédure reste dans la liste sans limite. H2 : la PRMP et l'UGPM ne voient que les
> procédures dont elles sont responsables.

## Ce que le front fera

- **Contrôleurs et Administrateur responsables** : une entrée « **Mes procédures en ligne** », dans la rubrique « Mon travail »,
  affichée seulement si la liste n'est pas vide. Elle ouvre un écran-liste (référence, objet, dates, cérémonie, séance) avec, par
  ligne, « Paramètres et cérémonie » (`/procedure/{idDmc}/parametres-internes`) et « Séance » (`/procedure/{idDmc}/seance`).
- **Administrateur** : pas d'entrée de menu, car le sien est saturé (20 px de marge à 1229×691, `scripts/hauteur-menu.mjs`). À la
  place, une **carte « Procédures en ligne »** sur le Poste d'administration, avec le nombre de procédures sans responsable. Elle
  mène à la même liste, complète, avec « Désigner le responsable » (depuis la fiche, comme aujourd'hui).
