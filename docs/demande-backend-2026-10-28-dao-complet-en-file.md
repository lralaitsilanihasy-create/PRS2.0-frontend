# Demande backend — 2026-10-28 — Le DAO complet produit en file, hors de la validation

## Contexte

La validation d'une fiche DAO (`POST /api/fiches-marche/{idDmc}/valider`) assemble le DAO complet par Word **avant de répondre** :
`FicheMarcheService.valider` → `daoComplet.assurer(fiche, etat)` → `DaoCompletWord.assembler` (PowerShell, Word en automation COM).

Mesure du 28/10 sur la fiche n° 1 (voie rapide de Sambava, ligne 303382, contrat-cadre de travaux, remise électronique) :
validation lancée à 10:00:31, DAO complet journalisé à 10:01:54 — **1 min 23 s** d'attente à l'écran (`[DAO_COMPLET] DMC 1
version 1 : 298 Ko (docx), 780 Ko (pdf)`). En fournitures, on mesurait ~20 s ; les travaux recopient le CCAG Travaux et le CCAP,
bien plus longs à paginer.

Le pilote a demandé ce que donnent **plusieurs validations simultanées**. Lecture du code :

| Constat | Où | Effet |
|---|---|---|
| `assembler` est `synchronized` sur le composant unique | `DaoCompletWord` | Un seul Word à la fois pour tout le serveur : les validations simultanées passent l'une après l'autre (voulu : l'automation de plusieurs Word est instable) |
| Le même verrou sert l'avis spécifique (assemblage « sur-le-champ » si le DAO complet manque) et le rattrapage | `AvisSpecifiqueService`, `DaoCompletRattrapage` | Ces gestes font la queue derrière les validations |
| `FicheMarcheService` est `@Transactional` au niveau de la classe ; `DaoCompletService.assurer` aussi | `valider` | Chaque validation **en cours ou en attente du verrou** garde une connexion de base pendant toute l'attente de Word |
| Aucun réglage du pool de connexions | `application*.properties` | Hikari par défaut : **10 connexions** |
| Le délai de 300 s (`app.dao-complet.delai-secondes`) part du lancement de PowerShell | `DaoCompletWord` | L'attente dans la file n'est pas bornée |

Conséquences, à ~1 min 20 s par DAO de travaux :

- 5 validations simultanées : la dernière attend 6 à 7 minutes ;
- 10 et plus : les 10 connexions sont prises par des requêtes qui attendent Word — **tous les écrans de tous les profils** attendent
  une connexion, puis échouent (délai Hikari, 30 s) ;
- derrière un relais qui coupe à 60 s (réglage courant en production), l'utilisateur voit une erreur alors que la validation se
  poursuit et aboutit : il recommence, la file s'allonge.

Ce qui existe déjà et sur quoi la demande s'appuie : un échec de Word **ne bloque pas** la validation (`assurer` rend `false`, les
documents séparés restent servis) et `DaoCompletRattrapage` assemble, toutes les 10 minutes, les dernières versions validées qui
n'ont pas de DAO complet, une à la fois.

## Le besoin

La validation répond en quelques secondes, quel que soit le nombre d'utilisateurs ; le DAO complet suit, produit une fiche à la
fois, sans retenir de connexion pendant l'attente de Word ; l'écran dit où il en est.

## Q1 — La validation n'assemble plus le DAO complet

- `valider` fige la version et produit les documents séparés comme aujourd'hui (Java, rapide), puis **met la version en file** au
  lieu d'appeler `assurer`. La réponse part aussitôt.
- La mise en file est enregistrée en base (elle survit à un redémarrage), après la validation de la transaction : une version
  dont la validation échoue n'entre pas dans la file.

## Q2 — Une file traitée par un seul ouvrier

- Un ouvrier unique (le rattrapage actuel, déclenché à chaque mise en file au lieu de toutes les 10 minutes, ou un exécuteur à un
  fil) prend les versions **dans l'ordre d'arrivée** et les assemble une à la fois.
- **Aucune transaction ni connexion ouverte pendant Word** : lire l'état (transaction courte), assembler (hors transaction),
  enregistrer les deux fichiers (transaction courte).
- Échec (Word absent, délai dépassé, script en erreur) : la version reste en file avec son motif et un nombre d'essais ; elle est
  reprise plus tard (le rattrapage actuel), sans bloquer les suivantes. Après N échecs, état `ECHEC` visible (voir Q3).
- L'avis spécifique qui trouve un DAO complet absent **met la version en tête de file** et rend 409 `DAO_COMPLET_ABSENT` comme
  aujourd'hui (message : « en préparation, réessayez dans quelques minutes »), au lieu d'assembler sur-le-champ sous le verrou.

> ⚠️ **Backend, 2026-10-28 — livré, avec trois précisions.**
> - Le 409 `DAO_COMPLET_ABSENT` porte `details: { version, rang }` (le rang après la mise en tête, `null` si Word l'assemble déjà) ;
>   le message dit « n° k dans la file ». Les lettres d'invitation suivent la même règle.
> - Une version en `ECHEC` que l'avis attend **repart en tête pour une nouvelle série de trois essais** : c'est le seul geste qui
>   relance un abandon.
> - N = **3** essais, reprise **10 minutes** après un échec (`app.dao-complet.essais`, `app.dao-complet.reprise-ms`). Une version
>   remplacée par une révision validée avant son tour sort de la file sans être assemblée.

## Q3 — L'état du DAO complet servi à l'écran

Sur `GET /api/fiches-marche/{idDmc}` (et, si c'est plus simple, sur `GET …/documents`), un objet :

```json
"daoComplet": { "etat": "EN_FILE", "rang": 3, "depuis": "2026-10-28T10:00:31", "motif": null }
```

- `etat` ∈ `EN_FILE` · `EN_COURS` · `PRET` · `ECHEC` · `SANS_WORD` (serveur sans Word : documents séparés seuls, comme aujourd'hui) ;
- `rang` : la position dans la file (1 = le prochain), `null` hors `EN_FILE` ;
- `motif` : le dernier échec, en clair, pour `ECHEC`.

Le front affichera « DAO complet en préparation — n° 3 dans la file » sur la fiche et dans « Documents », puis le document.

> ⚠️ **Backend, 2026-10-28 — écarts.**
> - Servi sur `GET /api/fiches-marche/{idDmc}` **et sur la réponse de `POST …/valider`** (le message de l'étape « Validation » a son
>   rang tout de suite). **Pas sur `GET …/documents`**, qui reste un tableau : l'onglet « Documents » lit l'état sur la fiche.
> - `daoComplet` est `null` sans version validée, et pour une version validée avant la production des documents (aucun DAO complet
>   attendu).
> - `motif` est aussi servi en `EN_FILE` quand la version attend d'être reprise après un échec (« n° k dans la file, nouvel essai
>   prévu »), pas seulement en `ECHEC`.
> - `depuis` = l'entrée dans l'état courant ; `null` en `SANS_WORD`.
> - La disponibilité de l'avis (`GET …/avis-specifique/disponibilite`) garde son propre `daoComplet` (`PRODUIT` · `A_ASSEMBLER` ·
>   `SANS_ASSEMBLAGE`), inchangé.

## Q4 — Prévenir la PRMP

À la fin de l'assemblage, une notification à la PRMP de la fiche (et à l'UGPM rédactrice si elle existe) : « Le DAO complet de
‹ objet › (version n) est prêt. », lien vers la fiche. En `ECHEC` définitif, une notification à l'Administrateur.

> ⚠️ **Backend, 2026-10-28 — écart.** Types `DAO_COMPLET_PRET` et `DAO_COMPLET_ECHEC` ; objet `PROCEDURE`, `idObjet` = `idDmc` ;
> `idDossier` = le dossier né de la fiche s'il existe. La notification va à **toutes les UGPM de la PRMP**, comme « avis à imprimer » :
> la fiche ne retient pas l'UGPM qui l'a rédigée.

## Q5 — Ce qui attend le DAO complet

Aujourd'hui le DAO complet est joint d'office au dossier quand il existe. Avec la file, il peut ne pas exister **encore** au moment
où la PRMP crée ou soumet le dossier. Proposition :

- la création du dossier depuis la fiche reste permise ; le DAO complet rejoint le dossier **dès qu'il est prêt** (comme pour un
  dossier déjà soumis, `documents.joindre`) ;
- la **soumission** du dossier à la Commission est refusée tant que le DAO complet est `EN_FILE` ou `EN_COURS` : 409
  `DAO_COMPLET_EN_PREPARATION` `{ rang }` — la Commission examine le DAO tel que les candidats le recevront ;
- en `SANS_WORD` ou `ECHEC`, la règle actuelle s'applique (documents séparés).

> ⚠️ **Backend, 2026-10-28 — écart.** La garde joue aussi à la **resoumission** après rectification et à la **transmission des
> compléments** : la révision validée qui repart à la Commission attend son DAO complet comme la première soumission. `rang` est
> `null` quand la version est `EN_COURS`.

## Hypothèses à confirmer

- **H1** : Q5 — refuser la soumission pendant la préparation (plutôt que soumettre et joindre ensuite). Si le backend préfère
  joindre après coup, le dire : le front affichera alors l'état sur la page du dossier.
- **H2** : la file en base (table dédiée ou colonnes sur la version) plutôt qu'en mémoire, pour survivre aux redémarrages.
- **H3** : régler aussi le pool de connexions (`spring.datasource.hikari.maximum-pool-size`) n'est plus nécessaire une fois Q2
  livré ; le laisser au défaut.

> ⚠️ **Backend, 2026-10-28 — H1, H2, H3 confirmées.** H1 : la soumission est refusée pendant la préparation. H2 : table dédiée
> `t_dao_complet_file` (V144), une ligne par version validée ; V144 y a inscrit les dernières versions validées sans DAO complet ; un
> assemblage interrompu par un arrêt reprend au démarrage. H3 : pool au défaut. Contrat : `PRS20/docs/api-endpoints.md`, § *Le DAO
> complet en un seul document*.

## Côté front, une fois livré

- Fiche DAO, étape « Validation » : « Fiche validée — version n figée. Le DAO complet est en préparation (n° k dans la file) ; vous
  serez prévenu. » ; plus d'attente bloquante.
- Étape « Documents » et page du dossier : l'état du DAO complet, rafraîchi par le flux de notifications.
- Soumission du dossier : le refus `DAO_COMPLET_EN_PREPARATION` lu en clair, avec le rang.
