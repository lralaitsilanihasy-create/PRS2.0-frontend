# Demande backend — 2026-10-18 — Le projet d'avis spécifique en données, et les articles d'une version de la fiche

## Contexte

Le pilote veut que les pièces produites par l'application se lisent **en données**, dans un onglet du dossier, et non par leur seul
PDF. C'est déjà le cas pour la fiche de présentation et le canevas de rapport (demandes du 17/10).

Le front a fait le reste de son côté, sans nouvelle route, sur le dossier DAO 100380 (consomptibles informatiques, ligne 303339) :
- **le DAO complet** renvoie à l'onglet « Fiche DAO » : il est le rendu de la fiche dans le modèle type, et son PDF reste à portée
  dans cet onglet pour le texte type ;
- **le bordereau estimatif** (le DQE en travaux) a son onglet, lu dans `GET /api/fiches-marche/{idDmc}/articles` et les
  `estimations` de la fiche.

Les pièces restent des pièces jointes côté serveur. Seule la présentation change : dans « Pièces jointes », l'écran les remplace par
un renvoi vers leur onglet.

Il manque deux choses au front.

## B1 — Le projet d'avis spécifique (et la lettre d'invitation) en données

Aujourd'hui :
- `GET /api/fiches-marche/{idDmc}/avis-specifique/projet` rend un PDF ou un Word ;
- `…/avis-specifique/mentions` dit si chaque mention est **renseignée**, mais pas sa **valeur**.

L'écran ne peut donc pas présenter l'avis en données.

Demande : la lecture de l'avis en données, sur la même version que le PDF joint au dossier (la version soumise, à défaut la dernière
validée). Par exemple :
- la route `GET /api/dossiers/{id}/avis-specifique` ;
- ou une valeur `valeur` ajoutée à chaque mention de `…/mentions`, avec un paramètre de version.

Le choix est au backend.

> ⚠️ **2026-10-18, livré (backend)** — la route **`GET /api/dossiers/{id}/avis-specifique`**, sous la garde de lecture du dossier
> (comme la fiche de présentation et le canevas) : la Commission la lit aussi, alors que `…/mentions` reste réservée à la PRMP et à
> l'UGPM. Forme : `{ idDossier, idDmc, versionFiche, gabarit, lettre, autoriteContractante, numero, documentComplet, mentions: [{
> code, libelle, presenteAuGabarit, renseignee, sansObjet, detail, valeur }] }`.
> - `gabarit` est choisi comme pour le projet : `AVIS-F` / `AVIS-T`, ou `LETTRE-PI` / `LETTRE-AOR` (`lettre: true`).
> - L'en-tête : `autoriteContractante` (`B01-AC-01`), `numero` (`B02-OB-03`, le « N° » sous le titre), `versionFiche`.
> - 409 `AVIS_INDISPONIBLE`, `details.raison` = `FICHE_NON_VALIDEE` ou `CATEGORIE_SANS_AVIS`.
> - `valeur` est aussi ajoutée aux mentions de `…/mentions` (version courante, inchangée par ailleurs).

**Le contenu** : les mentions du modèle type, dans l'ordre du manuel, avec leur valeur telle que l'avis l'imprime :
- `AVIS-F` : `OBJET`, `LOTS_MAX`, `FORME_PRIX`, `ADRESSE_CONSULTATION`, `ADRESSE_RETRAIT`, `DATE_HEURE_LIMITE`, `HEURE_OUVERTURE`,
  `COUT_DOSSIER`, `COMPTE_PAIEMENT`, `FORMES_GARANTIE`, `MONTANT_GARANTIE` ;
- `AVIS-T` : les mêmes, plus `VISITE_LIEUX` et `REUNION_PREPARATOIRE` ;
- `LETTRE-PI` et `LETTRE-AOR` : leurs mentions.

Pour chaque mention, le front a besoin de :
- `sansObjet` ;
- la marque d'une valeur **non renseignée** (pointillés), comme aujourd'hui ;
- un en-tête : gabarit, autorité contractante, numéro de l'avis, version de la fiche.

C'est exactement ce que le manuel fait contrôler sur l'avis : objet, lots, forme des prix, adresses, dates, garantie de 1 à 2 %.
L'écran l'affichera en lignes « libellé : valeur », comme la fiche de présentation. Le PDF reste la pièce.

## B2 — Les articles d'une version donnée de la fiche

`GET /api/fiches-marche/{idDmc}/articles` rend les articles de la **version courante**, et `GET …/versions/{n}` ne les porte pas.
Les `estimations` y sont, mais pas les articles.

Le bordereau de l'onglet doit être celui de la **version soumise**. Quand la fiche est révisée après la soumission, l'écran affiche
aujourd'hui les articles de la version courante, avec un avertissement.

Demande : les articles d'une version figée. Par exemple :
- `GET …/articles?version=n` ;
- ou `articles` dans `GET …/versions/{n}`.

Ils doivent porter les mêmes champs que `ArticleBesoinDto`, prix unitaire estimé compris.

> ⚠️ **2026-10-18, livré (backend)** — **`GET …/articles?version=n`** : le besoin de la version `n` (figée ou courante), mêmes
> champs, prix unitaire estimé compris ; 404 si la version n'existe pas. Sans le paramètre, la version courante, comme avant.
> `GET …/versions/{n}` est inchangé.

## Questions

- **Q1 — La version de l'avis joint.** Le PDF joint sous `AVIS_SPECIFIQUE` est-il bien remplacé à chaque nouvelle version tant que
  le dossier est en constitution ? Le front le suppose (R3b) et lira la même version en données.
- **Q2 — Les pointillés.** Une mention non renseignée doit-elle être servie avec une valeur nulle, plutôt qu'avec les pointillés
  du document ? Le front propose une valeur nulle, et c'est l'écran qui écrit « à compléter ».

> ⚠️ **2026-10-18, réponses (backend)**
> - **Q1 — oui, avec une nuance.** À chaque validation, le projet joint est remplacé tant que le dossier est en constitution ou en
>   attente de pièces. En rectification, la nouvelle version est jointe comme version corrigée, l'ancienne conservée. En examen,
>   rien ne change. La route lit la version soumise, à défaut la dernière validée : c'est celle du PDF joint.
> - **Q2 — d'accord** : `valeur: null` et `renseignee: false` pour une mention en pointillés. Une mention sans objet qui n'imprime
>   rien a aussi `valeur: null` (avec `sansObjet: true`). Une mention qui imprime une phrase quand elle ne s'applique pas la garde :
>   `LOTS_MAX` « lot unique indivisible », `MONTANT_GARANTIE` et `FORMES_GARANTIE` « garantie de soumission n’est pas requise ».
>   Deux valeurs imprimées ensemble sont jointes par « — » (`ADRESSE_ACCUSE` : la PRMP — son adresse).

## Côté front, après livraison

- **Onglet « Avis spécifique »** (« Lettre d'invitation » en prestations intellectuelles) dans le dossier né d'une fiche ;
  la pièce `AVIS_SPECIFIQUE` y renvoie dans « Pièces jointes ».
- **Bordereau lu sur la version soumise** ; l'avertissement de révision disparaît.
- **La carte « Avis spécifique d'appel d'offres »** au-dessus des onglets se réduit à ses actions propres (projet en Word,
  relecture des mentions).
