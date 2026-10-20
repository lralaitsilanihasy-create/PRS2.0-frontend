# Demande backend — 2026-10-20 — Les pièces du dossier de marché lues en données par la Commission

## Contexte

Le pilote demande que le dossier de marché présente ses pièces **en données**, comme le dossier de mise en concurrence présente
celles que produit sa fiche DAO : un onglet par pièce produite par l'application, et un renvoi depuis « Pièces jointes » (front
fb6ef68, 18/10).

Le dossier de marché né d'une attribution (V137) a presque tout en données dans l'application. Exemple : 100383, produits
d'entretien, ligne 303338, procédure 13-CC/MEF/SG/PRMP.2026, sous-type `MAOO-CC`.

| Pièce exigée | Données | Route |
|---|---|---|
| Fiche de présentation | oui (section `ATTRIBUTION`, V137) | `GET /api/dossiers/{id}/fiche-presentation` |
| PV d'ouverture des offres | oui | `GET /api/fiches-marche/{idDmc}/seance` et `…/seance/lecture` |
| Rapport d'évaluation, PV de validation | oui | `GET /api/fiches-marche/{idDmc}/evaluation`, `…/lots/{lot}/tableau` |
| Projet de marché (titulaires, montants, délais) | oui | `GET /api/fiches-marche/{idDmc}/attribution` |
| PV de la Commission sur le DAO | oui, sans PDF | `GET /api/pv-examens/{idPv}` |
| Bordereau estimatif | oui | la fiche, `GET /api/fiches-marche/{idDmc}` |

Ces onglets sont faits pour la Commission, qui contrôle le dossier. Mesure du 20/10 sur 100383 (soumis, pas encore réceptionné) :

| Route | PRMP001 | SECANT1 | PRES001 | MEMANT1 | VERANT1 |
|---|---|---|---|---|---|
| `/api/dossiers/100383/fiche-presentation` | 200 | 200 | 200 | 200 | 200 |
| `/api/fiches-marche/3` | 200 | 200 | 200 | 200 | 200 |
| `/api/fiches-marche/3/seance` | 200 | **403** | **403** | **403** | **403** |
| `/api/fiches-marche/3/seance/lecture` | 200 | **403** | **403** | **403** | **403** |
| `/api/fiches-marche/3/evaluation` | 200 | **403** | **403** | **403** | **403** |
| `/api/fiches-marche/3/evaluation/lots/1/tableau` | 200 | **403** | **403** | **403** | **403** |
| `/api/fiches-marche/3/attribution` | 200 | **403** | **403** | **403** | **403** |
| `/api/pv-examens/64` | **403** | 200 | 200 | 200 | 200 |

## B1 — La Commission lit la procédure du dossier de marché qu'elle contrôle

Demande : ouvrir **en lecture**, aux contrôleurs qui ont le dossier de marché dans leur périmètre (comme pour la fiche DAO d'un
dossier de mise en concurrence), les routes de la procédure de ce dossier :
- `GET /api/fiches-marche/{idDmc}/seance` et `…/seance/lecture` ;
- `GET /api/fiches-marche/{idDmc}/evaluation` et `…/lots/{lot}/tableau` ;
- `GET /api/fiches-marche/{idDmc}/attribution`.

Les règles proposées :
- **Lecture seule** : aucun geste (déclarer, décider, arrêter, signer, attribuer) n'est ouvert.
- **Le droit naît du dossier de marché** : un contrôleur lit la procédure parce qu'un dossier de marché soumis en procède (`procedure.idDmc`,
  V137) et qu'il est dans son périmètre. Sans dossier de marché, rien ne change.
- **Les pièces des offres restent fermées** : l'arbitrage du 04/10 réserve leur ouverture aux membres de la CAO. La lecture de
  séance sert donc `piecesOuvrables = false` à la Commission, comme au responsable de la procédure.
- **La confidentialité** (art. 12-V, 35-V) ne s'oppose pas à la lecture par l'organe de contrôle, qui examine justement ce rapport.

Questions :
- **Q1 — Le moment.** Le front propose : dès la soumission du dossier de marché, pour que la secrétaire contrôle les pièces à la
  réception. Ou seulement à partir de la réception ?
- **Q2 — Qui.** Les contrôleurs du périmètre du dossier (secrétaire, président, chargé de contrôle, membre, vérificateur, assistant),
  ou seulement ceux du circuit de ce dossier (dispatché, assigné) ?
- **Q3 — Le journal de l'évaluation** (`GET …/evaluation/journal`) : ouvert aussi à la Commission, ou non ?

> ⚠️ **2026-10-20, livré (backend), comme le front le propose**
> - **La règle** : un compte de la Commission lit la procédure dès qu'un dossier de marché qui en procède est dans son périmètre de
>   lecture. Les comptes concernés : Président, chef de commission, secrétaire, membre, vérificateur, assistant, chargé de
>   publication, Administrateur. Sans dossier de marché, la réponse reste 403.
> - **Les routes ouvertes** : les cinq demandées, et toutes les autres lectures de la procédure, protégées par les mêmes gardes : le PV
>   de séance, le rapport et ses PDF, l'estimation, la qualification, les évaluations technique et financière, la négociation, le
>   projet de marché, les lettres, l'avis et les fichiers de l'attribution.
> - **Lecture seule** : les gestes répondent toujours 403. Les pièces des offres répondent 403 `PIECE_RESERVEE_CAO`.
>   `piecesOuvrables` n'est pas un champ du serveur : l'écran le met à `false` lui-même, comme pour le responsable.
> - **Q1 : dès la soumission.** Le périmètre d'un contrôleur exclut déjà les brouillons de sa localité.
> - **Q2 : tous les contrôleurs du périmètre**, pas seulement ceux du circuit. C'est la règle de la fiche et de la fiche de
>   présentation, qui répondent déjà 200.
> - **Q3 : oui**, le journal de l'évaluation est ouvert aussi.

## B2 — La PRMP lit encore 403 sur le PV n° 64

La réponse B4 du 19/10 (« dossier-marche-lecture ») annonce que PRMP001 lit les PV 63 et 64. Le 20/10, sur le serveur de recette,
`GET /api/pv-examens/64` répond toujours **403** à PRMP001 (et 200 aux comptes de la Commission). Le JAR de recette porte-t-il la
correction ?

> ⚠️ **2026-10-20, réponse (backend) : oui, c'était le JAR.** La mesure a été faite sur l'ancien JAR : la demande est écrite à 08:05,
> et le backend de recette a redémarré avec la correction à 08:09. En base, les PV 63 et 64 relèvent des dossiers 100381 et 100382,
> dont la PRMP est IMP001, la référence du compte PRMP001. La mesure est à refaire, sans changement côté serveur.

## Côté front

À construire dès B1, sur la page du dossier de marché, en reprenant les vues existantes :
- **Fiche de présentation** (onglet, comme pour le DAO) ;
- **Séance d'ouverture** : la lecture des offres, sans ouverture des pièces ;
- **Évaluation** : le rapport, ses étapes, son tableau, ses signatures (le PV de validation) ;
- **Attribution** : titulaires, montants, délais (résumé du projet de marché, son PDF à côté) ;
- **PV de la Commission sur le DAO** : ses données, « PV sans document » (V137 : `idPv`) ;
- **Bordereau estimatif** : celui de la fiche.

Dans « Pièces jointes », chaque pièce produite renverra à son onglet au lieu d'être listée deux fois. Le journal de publication de
l'avis et la publication de l'AGPM restent des fichiers.
