# Demande backend — 2026-10-28 — Un contrôleur créé à l'écran doit pouvoir se connecter

## Contexte

Recette du profil « Responsable de procédure » (V145) : l'Administrateur crée le compte `RESPRO1` dans « Comptes & personnes »
(`POST /api/controleurs`, profil 10). La fiche du contrôleur est créée ; **aucun compte de connexion** ne l'est.
`POST /api/comptes-auth/RESPRO1/reinitialiser-mot-de-passe` répond 404 « Compte introuvable : RESPRO1 ».

Lecture du code :

- `ControleurService.create` / `createAvecPhoto` n'écrivent que `tr_controleur` ; `CompteAuthService` sait activer, désactiver et
  réinitialiser un compte, **pas en créer** ;
- les comptes de connexion des contrôleurs ne naissent que du `CompteSeeder` (`app.seed.comptes.enabled`, faux par défaut,
  « à n'utiliser qu'en environnement de développement ») ;
- la suppression d'un contrôleur supprime pourtant son compte (`ControleurService`, l. 275) : le cycle de vie est déjà lié, sauf à
  la naissance.

Conséquence : **en production, aucun compte interne créé depuis l'écran ne peut se connecter** — pas seulement le nouveau profil.
(Les PRMP, UGPM, membres de CAO, dépositaires et candidats ont, eux, leur création de compte.)

Sur la limite du matricule : `IM_CONTROLEUR` est un `varchar(7)` ; `RESPPROC1` a été refusé en 409 « Violation d'une contrainte de
données », sans dire laquelle (voir B3).

## B1 — Créer le compte de connexion avec le contrôleur

À `POST /api/controleurs` (et sa variante multipart), dans la même transaction : un compte de connexion `login` = matricule,
`typeActeur` = `CONTROLEUR`, `refActeur` = matricule, **sans mot de passe utilisable** tant que l'Administrateur n'en a pas fixé un
(ou un mot de passe aléatoire jamais communiqué).

L'Administrateur fixe ensuite le mot de passe provisoire par le geste existant « Réinitialiser le mot de passe »
(`POST /api/comptes-auth/{login}/reinitialiser-mot-de-passe`) ; le changement au premier login suit la règle actuelle des comptes
réinitialisés.

> ⚠️ **Backend, 2026-10-28 — livré, deux précisions.**
> - Le mot de passe initial est un **aléa de 32 octets chiffré, jamais communiqué**, créé dans la même transaction que la fiche.
>   Si le matricule est déjà le login d'un **autre** compte (une PRMP, par exemple), la création répond **409 `LOGIN_PRIS`** et la
>   fiche n'est pas créée.
> - **Il n'existe pas de « changement au premier login »** : aucun compte, réinitialisé ou non, n'est forcé de changer son mot de
>   passe à la connexion. Le mot de passe provisoire fixé par l'Administrateur reste valable jusqu'à ce que l'agent le change
>   lui-même (« Mon compte »). Pour l'imposer, il faudrait une demande à part.

## B2 — Les contrôleurs déjà créés sans compte

Un rattrapage (migration ou au démarrage, idempotent) : un compte pour chaque contrôleur qui n'en a pas, sans mot de passe
utilisable. Aujourd'hui : `RESPRO1` au moins.

> ⚠️ **Backend, 2026-10-28 — livré par une migration : V146.**
> - Chaque contrôleur sans compte en reçoit un, actif et sans mot de passe utilisable. La valeur stockée n'est pas une empreinte
>   BCrypt : aucune saisie ne lui correspond.
> - La migration est idempotente, et un login déjà pris n'est pas touché.
> - **Sur la recette, rien ne reste à rattraper** : le 28/10 à 20:06, le backend a été relancé une fois avec le jeu de données
>   des comptes, à la demande du pilote. Cette relance a ouvert les comptes de RESPRO1 et de SECTMS (contrôleurs) et de IMP001 et
>   LERAVO01 (PRMP), tous avec le mot de passe de développement. V146 n'y trouvera donc aucun contrôleur sans compte.

## B3 — Le refus lisible d'un matricule trop long

Un 400 nominatif sur `imControleur` (« 7 caractères au plus ») au lieu du 409 générique, comme les autres erreurs de champ ; le front
l'affichera sous le champ. Idem pour les autres colonnes bornées du formulaire si c'est simple.

> ⚠️ **Backend, 2026-10-28 — livré.** Au-delà de 7 caractères, la réponse est **400** avec `erreurs[{ champ: "imControleur",
> message: "7 caractères au plus." }]`, en JSON comme en multipart. Les autres champs bornés (`nomCont`, `prenomsCont`,
> `emailCont`, `telCont`, `idLocalite`, `idSuperieur`) répondaient déjà 400 par champ, avec le message par défaut de la
> validation.

## Hypothèses à confirmer

- **H1** : le compte est créé **actif**, mais inutilisable tant qu'aucun mot de passe n'est fixé ; sinon créé inactif, et
  « Activer » s'ajoute au geste de l'Administrateur — le dire.
- **H2** : aucun courriel n'est envoyé (les contrôleurs n'en reçoivent pas aujourd'hui).
- **H3** : la modification d'un contrôleur ne touche pas à son compte (le matricule ne change pas).

> ⚠️ **Backend, 2026-10-28 — H1, H2 et H3 confirmées.**
> - **H1 :** le compte est actif, mais inutilisable sans mot de passe fixé. « Activer » n'a pas à s'ajouter au geste.
> - **H2 :** aucun courriel n'est envoyé.
> - **H3 :** `PUT` ne touche pas au compte. `DELETE` le supprime, comme avant.
>
> Contrat : `PRS20/docs/api-endpoints.md`, § *Contrôleurs*.

## Côté front, une fois livré

- « Comptes & personnes » : après la création, proposer d'emblée « Fixer le mot de passe provisoire » (le geste existant) ;
  `maxlength="7"` sur le matricule et l'erreur de champ affichée.
