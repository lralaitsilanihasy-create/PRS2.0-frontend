# Demande backend — 2026-10-28 — Un profil dédié : « Responsable de procédure »

## Contexte

Le responsable d'une procédure en remise électronique tient les **paramètres internes** (quorum, date de la cérémonie, dépositaire),
**clôt la cérémonie des clés**, conduit la **séance d'ouverture** et les étapes qui la suivent : les services le vérifient par
`estTitulaire` / `exigerTitulaire` (`ParametresInternesService`, `CeremonieService`, `SeanceService`, `SeanceFinanciereService`,
`EvaluationService`, `OffreService`, `FicheMarcheService`).

Aujourd'hui, l'Administrateur le désigne parmi **les comptes de contrôleurs** de la localité de la fiche ou sans localité, hors des
membres détenteurs d'une part (`candidatsResponsable`). Il n'existe pas de profil propre : le compte désigné garde les droits et le
menu de son profil (une Secrétaire réceptionne, un Vérificateur vérifie…). En recette, c'est ADMIN01 qui tient le rôle — et
l'Administrateur n'a pas l'entrée « Mes procédures en ligne » (menu saturé, choix du 06/10) : le pilote n'a pas trouvé l'écran.

**Arbitrage du pilote (28/10)** : un **compte dédié** au rôle, avec un profil qui ne donne **que** ce rôle.

## B1 — Le profil `RESPONSABLE_PROCEDURE`

- Nouveau profil interne (référentiel des profils, `Role` côté sécurité), libellé « Responsable de procédure ».
- Compte créé par l'Administrateur dans « Comptes & personnes », comme un contrôleur : matricule, nom, prénoms, adresse, mot de
  passe initial ; **localité facultative** (sans localité : compétent partout, comme aujourd'hui).
- Connexion par le matricule, comme les autres comptes internes.

> ⚠️ **Backend, 2026-10-28 — livré, une précision.** Le compte est une fiche `t_controleur` dont l'`idProfile` vise le profil
> « Responsable de procédure ». V145 ajoute ce profil à `tr_profile`, id **10** sur une base complète. Le front doit lire cet id
> sur `GET /api/profiles` et ne pas l'écrire en dur.
>
> La création passe par les mêmes routes que pour un contrôleur ; le libellé fait le rôle. À la connexion :
> `role = RESPONSABLE_PROCEDURE` et `typeActeur = CONTROLEUR`.

## B2 — Ce que le profil peut faire, et rien d'autre

- Les gestes du **titulaire** d'une procédure, inchangés : ils restent gardés par la désignation (`estTitulaire`), pas par le profil.
- `GET /api/fiches-marche/en-ligne` : ses procédures (celles dont il est titulaire), comme pour les autres profils.
- Lecture de la fiche et de ses documents **pour les procédures dont il est titulaire** (ce que l'écran « Ouvrir la fiche » appelle).
- Notifications, mot de passe, horloge, référentiels lus par ces écrans.
- **Aucune route du circuit de contrôle** (dossiers, réceptions, dispatch, examens, PV, vérification, plans) : 403, comme pour le
  Membre de CAO.

> ⚠️ **Backend, 2026-10-28 — livré.** Le profil est hors coquille interne, comme le membre de CAO. Il n'atteint que ces routes :
> - `GET /api/fiches-marche/en-ligne` ;
> - en lecture, sur **ses** fiches seulement (403 pour une autre, car la désignation remplace la localité) :
>   `GET …/{idDmc}`, `…/documents`, `…/documents/{id}/contenu`, `…/versions`, `…/versions/{n}`, `…/articles`, `…/materiel`,
>   `…/personnel`, `…/sous-criteres`, `…/pieces`, `…/cao` et `…/depots` ;
> - `…/parametres-internes/**`, `…/ceremonie/**`, `…/seance/**` et `…/evaluation/**` (gestes du titulaire, gardés comme avant) ;
> - `/api/notifications/**`, `/api/kpis/badges`, `/api/mon-compte/**`, `GET /api/horloge`, et le `GET` des référentiels.
>
> Tout le reste répond 403, en particulier : l'écriture de la fiche, les dossiers, réceptions, dispatch, examens, PV,
> vérification, transmissions SIGMP, plans, `/api/a-faire`, l'annuaire des contrôleurs et l'attribution.
>
> **Si un écran « Ouvrir la fiche » appelle une autre route que celles-ci, me le dire : elle répondra 403.** Par exemple les
> mentions de l'avis ou la disponibilité de l'avis spécifique, que je n'ai pas ouvertes.
>
> L'accueil « À faire » n'existe pas pour ce profil : l'accueil est « Mes procédures en ligne ».

## B3 — La désignation

- `GET …/responsable/candidats` propose les comptes `RESPONSABLE_PROCEDURE` de la localité ou sans localité, **en tête**.
- À trancher (H2) : les autres contrôleurs restent-ils désignables ?
- La séparation des rôles demeure : un détenteur de part de cette procédure n'est pas désignable.

> ⚠️ **Backend, 2026-10-28 — livré.** `…/responsable/candidats` sert d'abord les comptes `RESPONSABLE_PROCEDURE`, triés par nom,
> puis les autres contrôleurs, triés par nom aussi. Le front reconnaît un compte dédié à `profil == "RESPONSABLE_PROCEDURE"` ;
> aucun champ n'est ajouté.

## B4 — Le contrat

- Le profil dans `docs/api-endpoints.md` (profils, routes permises) ; la règle dans `docs/regles-gestion.md` ; un ADR si la
  séparation des rôles est formalisée.
- Une migration : le profil au référentiel ; aucun compte créé d'office.

> ⚠️ **Backend, 2026-10-28 — livré.** La migration est V145, sans aucun compte créé. Le contrat est dans
> `PRS20/docs/api-endpoints.md`, § *Rôle « Responsable de la procédure »*, et la règle dans `PRS20/docs/regles-gestion.md`. Pas
> d'ADR nouveau : l'ADR-0010 reçoit un amendement daté du 2026-10-28, sur la séparation des rôles. Le profil n'ajoute aucun
> droit, il en retire ; le droit sur une procédure reste la désignation.

## Hypothèses à confirmer

- **H1** : un compte interne (comme un contrôleur), pas un compte « à activer par courriel » comme le membre de CAO.
- **H2** : les autres contrôleurs **restent désignables** (transition douce) ; le profil dédié est proposé en premier. Si le backend
  préfère réserver le rôle au seul profil dédié, le dire : les procédures déjà désignées (n° 1 : ADMIN01) garderaient leur titulaire.
- **H3** : l'intérim (ADR-0008) s'applique au profil comme aux autres : un responsable absent est suppléé par intérim désigné.
- **H4** : l'Administrateur garde la vue de toutes les procédures (`/procedures-en-ligne`) et la désignation ; il cesse simplement
  d'être le responsable par défaut en recette.

> ⚠️ **Backend, 2026-10-28 — H1, H2 et H4 confirmées ; H3 non.**
> - **H1 :** compte interne, sans activation par courriel.
> - **H2 :** les autres contrôleurs restent désignables, après les comptes dédiés. La fiche n° 1 garde ADMIN01 ; pour passer au
>   compte dédié, l'Administrateur retire ADMIN01 puis désigne le nouveau compte.
> - **H4 :** l'Administrateur garde `/procedures-en-ligne` et la désignation.
> - **H3 — écart.** L'intérim désigné (ADR-0008) n'admet comme titulaire absent que le Président et le Chef de commission
>   (contrainte en base `ck_interim_profil_titulaire`). Les gestes du responsable se gardent par l'identité exacte du titulaire,
>   sans intérim. Un responsable absent n'est donc pas suppléé : l'Administrateur le retire et en désigne un autre, ce qui est
>   déjà possible.
>
>   Étendre l'intérim à ce rôle demande une migration de la contrainte et une garde qui accepte le suppléant : c'est une demande à
>   part, si le pilote la veut.

## Côté front, une fois livré

- `Role` : `RESPONSABLE_PROCEDURE` ; libellé ; garde de route.
- Menu (`NAV_BY_ROLE` + `GROUPES_PAR_CHEMIN`) : « Mes procédures en ligne » (accueil du profil), « Notifications ». Contrôle de
  hauteur du menu sans objet (deux entrées).
- « Comptes & personnes » : le profil dans la création d'un compte.
- Désignation du responsable (fiche, Administrateur) : les comptes du profil en tête, marqués « dédié ».
