# Demande backend — 2026-10-20 — Fiche de présentation du marché : deux écarts à la livraison

## Contexte

Recette du 20/10 de la livraison « fiche-presentation-marche » sur le dossier de marché 100383 (produits d'entretien, procédure
13-CC/MEF/SG/PRMP.2026), par `GET /api/dossiers/100383/fiche-presentation` après le redémarrage de 09:47. Tout est conforme à la
réponse du backend, sauf deux points.

## B1 — `DOSSIER_CREE_PAR` n'est pas servi

La réponse annonce : « `VALIDATION` : `DOSSIER_CREE_LE` et `DOSSIER_CREE_PAR` seulement ». La section servie ne porte qu'une ligne :

| Code | Libellé | Valeur |
|---|---|---|
| `DOSSIER_CREE_LE` | Dossier de marché créé le | 19/10/2026 à 18:17 |

Le dossier 100383 a pourtant son créateur (`creePar = PRMP001`, `creeParNom = Randrianarivo La Personne` sur `GET /api/dossiers/100383`).
Demande : servir `DOSSIER_CREE_PAR` (le nom de la PRMP), dans l'écran et dans le PDF. C'est la ligne qui porte la signature, si le
pilote confirme que la création nominative en tient lieu.

> ⚠️ **2026-10-20, corrigé (backend), et un second défaut de même cause**
> - **La cause** : le créateur est tracé par sa **référence d'acteur** (IMP001), et la fiche cherchait son nom comme s'il s'agissait
>   d'un login (PRMP001). Faute de nom, la ligne disparaissait.
> - **La correction** : le nom se lit maintenant par la référence. `DOSSIER_CREE_PAR` porte « Randrianarivo La Personne », à l'écran
>   et dans le PDF.
> - **Le même défaut** touchait `VALIDEE_PAR`, sur la fiche du dossier de mise en concurrence. En recette, cette ligne n'était servie
>   pour aucune fiche validée. Elle l'est désormais.
> - **Limite** : quand une UGPM crée le dossier, elle trace la référence de sa PRMP de tutelle. La ligne porte alors le nom de la
>   PRMP.

## B2 — Les offres optimisées marquées « non réalisé »

La réponse à Q1 dit : « Les offres optimisées (étapes 06 et 07) relèvent des marchés subséquents et restent en "prévu" seul ». La
section `PREVU_REALISE` sert pourtant :

| Code | Valeur servie | Valeur annoncée |
|---|---|---|
| `B04-CP-06` (envoi des demandes d'offres optimisées) | prévu le 24/11/2026 ; non réalisé | prévu le 24/11/2026 |
| `B04-CP-07` (date limite de réception des offres optimisées) | prévu le 27/11/2026 ; non réalisé | prévu le 27/11/2026 |

« Non réalisé » laisse croire à un retard de la procédure, alors que ces étapes ne la concernent pas. Demande : la valeur annoncée.

> ⚠️ **2026-10-20, corrigé (backend)** : `B04-CP-06` et `B04-CP-07` sont servis « prévu le … » seul, comme annoncé.

## Côté front

Rien à changer : la fiche affiche les lignes servies.
