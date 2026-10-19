# Demande backend — 2026-10-19 — La copie de son offre, relisible par le candidat depuis n'importe quel poste

## Contexte

Recette du 19/10 : trois candidats ont déposé une offre en ligne sur la procédure 13-CC/MEF/SG/PRMP.2026 (produits d'entretien,
idDmc 3). Le pilote a demandé comment un candidat **consulte son offre** après le dépôt. Aujourd'hui, il ne le peut pas :

- l'offre est chiffrée sur son poste pour les détenteurs de clé de la CAO (ADR-0013) ; le serveur ne reçoit qu'un bloc illisible et
  ne connaît ni les prix, ni les fichiers ;
- le brouillon local du navigateur s'efface au dépôt réussi (lot 5, H4) ;
- il ne lui reste que l'accusé (numéro, date, empreinte, taille), puis l'extrait du PV d'ouverture après la séance.

Le pilote a arbitré le 19/10 : **une copie chiffrée par le candidat lui-même, gardée par le serveur, relisible depuis n'importe
quel poste avec sa phrase secrète**. Le serveur reste aveugle : il garde un bloc qu'il ne peut pas ouvrir, exactement comme il
garde aujourd'hui l'enveloppe de la clé privée d'un membre de la CAO (V66, `EnveloppeDto`). L'alternative « récapitulatif sur le
poste seul » a été écartée : elle ne se relit pas depuis un autre ordinateur.

## Ce que le front fera

- **Au scellement**, le candidat choisit une **phrase de relecture** (**16 caractères au moins**, saisie deux fois), distincte de
  son mot de passe ; elle ne quitte jamais son poste. L'écran l'avertit avant le choix : **aucun recours** si elle est perdue, ni par
  l'administration ni par le serveur. La copie est **facultative** : il peut la refuser et n'emporter que le récapitulatif PDF. Le front construit le **récapitulatif en clair** de l'offre (ci-dessous), le chiffre
  avec une clé dérivée de la phrase (PBKDF2-SHA-256, ≥ 600 000 itérations, AES-256-GCM — les mêmes algorithmes et les mêmes
  contrôles que l'enveloppe des clés), puis l'envoie **après** le scellement réussi. Un échec de cet envoi ne touche pas au dépôt :
  l'écran le dit et propose de réessayer.
- **Dans « Mes offres »**, un bouton « Relire mon offre » demande la phrase, lit le bloc, le déchiffre sur le poste et affiche le
  récapitulatif en lecture seule, avec « Enregistrer en PDF ». Une phrase fausse échoue au déchiffrement, côté poste : le serveur
  n'en sait rien et ne compte rien.
- **En complément, sur le poste** : au scellement, le même récapitulatif est proposé en **PDF à enregistrer** (sans phrase), à
  côté de l'accusé. L'écran dit de la copie et du PDF ce qu'ils sont : **la saisie du candidat, pas l'original scellé** ; seule
  l'empreinte de l'accusé fait foi.
- **Le récapitulatif** (JSON, versionné) : l'acte d'engagement saisi (montants, délai, validité, rabais), le bordereau (prix
  unitaires, dates de livraison, totaux), la conformité technique (marque, modèle, valeurs proposées, oui/non), le groupement, la
  garantie, et pour chaque fichier joint son **nom, sa taille et son empreinte SHA-256** — pas les fichiers eux-mêmes (le candidat
  les garde ; ils peuvent peser jusqu'à 100 Mo). Quelques dizaines de Ko au plus.

## B1 — Garder et rendre la copie chiffrée

| Méthode | URL | Corps | Réponse | Statuts | Accès |
|---|---|---|---|---|---|
| PUT | /api/candidat/offres/{idOffre}/copie | `EnveloppeDto` = `{ chiffre, iv, sel, iterations, kdf, algorithme }` + `version` (du récapitulatif) | 204 | 400 `ENVELOPPE_INVALIDE` (mêmes contrôles que `…/ceremonie/cles`), 404, 409 `OFFRE_RETIREE`, 413 au-delà de 1 Mo | `CANDIDAT`, **propriétaire de l'offre** |
| GET | /api/candidat/offres/{idOffre}/copie | — | l'`EnveloppeDto` + `version`, `enregistreeLe` | 200, 404 (offre inconnue, ou sans copie) | idem |

- Un `PUT` remplace la copie précédente (le candidat peut la refaire avec une autre phrase).
- Le serveur **ne déchiffre jamais** et ne journalise ni la phrase ni le contenu ; au journal, seulement « copie déposée / lue »
  avec l'horodatage, comme pour les enveloppes.
- La copie suit l'offre : une offre **remplacée** garde sa copie (lisible dans l'historique de « Mes offres ») ; une offre
  **retirée** aussi ; la **purge** de conservation (paramètre de l'Administrateur) l'emporte avec l'offre.
- **Durée de vie limitée au secret** : la copie est **supprimée à la clôture de la séance d'ouverture** (PV d'ouverture signé),
  quand l'offre est de toute façon connue de la CAO. Le bloc chiffré n'est exposé sur le serveur que pendant la période où le
  secret compte ; après la séance, le candidat relit son offre telle que lue par la commission (voir Q2). `GET …/copie` répond
  alors 404, et « Mes offres » dit pourquoi.

> ⚠️ **2026-10-19, livré (backend, V136), avec trois précisions**
> - **Routes et corps** : comme le tableau. Le corps est plat (`{ chiffre, iv, sel, iterations, kdf, algorithme, version }`) et
>   `version` est un entier ≥ 1. Le contrôle de l'enveloppe est celui de `…/ceremonie/cles` (code partagé).
> - **Le `PUT`** répond :
>   - 403 si l'offre n'est pas la sienne ;
>   - 413 au-delà de 1 Mo de chiffré ;
>   - 409 **`OFFRE_NON_SCELLEE`** si l'offre est encore `EN_COURS` : la copie se dépose après le scellement ;
>   - 409 `OFFRE_RETIREE` si l'offre est retirée ;
>   - 409 **`SEANCE_CLOSE`** une fois la séance close.
> - **Le `GET`** répond 404 **`COPIE_ABSENTE`** sans copie, et 404 **`COPIE_EFFACEE`** après l'effacement, avec la date dans le
>   message. « Mes offres » lit aussi cette date sur la liste (B2).
> - **Journal** : `COPIE_DEPOSEE`, `COPIE_LUE`, `COPIE_EFFACEE`, avec l'horodatage et la taille du chiffré, jamais le contenu.
> - **Écart 1, le constat d'illisibilité** : il n'efface pas la copie. La commission n'a rien lu, la procédure est à relancer, et la
>   copie reste la seule trace lisible de la saisie. Elle part avec la purge.
> - **Écart 2, l'enveloppe financière (prestations intellectuelles)** : la séance d'ouverture ne la déchiffre pas. Sa copie n'est
>   effacée qu'à la clôture de la **séance financière**.
> - **Précision, le moment exact** : l'effacement a lieu à la signature complète du PV d'ouverture, quand la séance passe à `CLOSE`.
>   Une offre remplacée ou retirée garde sa copie jusque-là, puis la perd avec les autres.

## B2 — Le dire sur la liste

`GET /api/candidat/offres` : chaque offre gagne **`copie: boolean`** (une copie existe), pour afficher « Relire mon offre » ou
« Enregistrer une copie » sans appel de plus.

> ⚠️ **2026-10-19, livré (backend)** — `OffreDto` gagne **`copie`** : une copie **lisible** existe, donc faux une fois effacée.
> Il gagne aussi **`copieEffaceeLe`** : la date de l'effacement, nulle sinon, pour que « Mes offres » dise pourquoi. Les deux
> champs sont servis sur `GET /api/candidat/offres` et sur `/{idOffre}`.

## Les risques, et ce qui les contient

| Risque de B | Parade |
|---|---|
| Phrase perdue : copie irrécupérable | avertissement avant le choix ; copie facultative ; PDF sur le poste en complément ; l'offre déposée reste valable |
| Essais hors ligne sur le bloc chiffré, s'il fuit | phrase de 16 caractères au moins ; PBKDF2 ≥ 600 000 itérations ; bloc supprimé dès la séance d'ouverture |
| Surface et droits côté serveur | deux routes, propriétaire seul, 1 Mo, aucun déchiffrement, journal sans contenu |
| Copie prise pour une preuve | l'écran nomme la copie « votre saisie » ; seule l'empreinte de l'accusé fait foi |

## Questions

- **Q1 — Les fichiers.** Le front propose de ne garder que nom, taille et empreinte des fichiers. Faut-il aussi offrir la copie
  chiffrée des fichiers eux-mêmes (jusqu'à 100 Mo, un morceau par fichier, comme le dépôt) ? Le pilote tranche.
- **Q2 — Après l'ouverture des plis.** La copie est supprimée à la séance (B1). L'offre déchiffrée par la CAO étant alors connue du
  serveur, peut-il servir au candidat **son propre récapitulatif tel que lu en séance** (les mêmes valeurs que
  `…/seance/lecture`, restreintes à son offre) ? Ce serait la voie de relecture après la séance, sans phrase. Le front propose
  cette route en B3, si le backend l'accepte : `GET /api/candidat/offres/{idOffre}/lecture` → 200 après la séance,
  409 `SEANCE_NON_DECHIFFREE` avant.
- **Q3 — La phrase perdue.** Pas de recouvrement possible, par construction ; le front le dit au candidat au moment du choix.
  Le backend confirme-t-il qu'aucune voie de secours n'est attendue ?

> ⚠️ **2026-10-19, réponses (backend)**
> - **Q1 — non, pas pour l'instant ; au pilote de trancher.** Garder jusqu'à 100 Mo de fichiers par offre élargirait beaucoup ce que le
>   serveur expose pendant la période du secret. Le candidat garde ses fichiers, et le nom, la taille et l'empreinte suffisent à les
>   reconnaître. Rien n'est prévu côté serveur.
> - **Q2 — oui, livré tel que proposé** : `GET /api/candidat/offres/{idOffre}/lecture` rend un **`OffreLue`**, la forme de
>   `…/seance/lecture` restreinte à son offre. On y lit le numéro, l'intégrité, le groupement, l'acte d'engagement, la garantie,
>   les pièces lues et manquantes, les totaux des formulaires et le rabais.
>   - **Retiré** : les alertes de la commission (`alertes` toujours vide), l'identité vérifiée de l'entreprise (`entreprise` nul) et
>     le reçu de frais (`fraisDossier` nul).
>   - **Disponible dès que la séance est déchiffrée**, et non seulement après sa clôture : la relecture n'a ainsi pas de trou avec
>     l'effacement de la copie.
>   - **Codes d'erreur** : 409 `SEANCE_NON_DECHIFFREE` avant le déchiffrement, et aussi sur un constat d'illisibilité ; 409
>     **`OFFRE_NON_OUVERTE`** pour une offre remplacée, retirée ou écartée ; 409 **`ENVELOPPE_FINANCIERE`** pour l'enveloppe
>     financière d'une proposition PI, dont la lecture n'est pas servie par cette route (écart).
> - **Q3 — confirmé** : il n'existe aucune voie de secours, et le serveur ne peut pas la créer. Il ne détient ni la phrase ni rien qui
>   permette de la retrouver.

## Côté front, après livraison

Écran de dépôt (phrase de relecture, chiffrement, envoi après scellement, reprise sur échec), « Mes offres » (bouton, saisie de la
phrase, déchiffrement, récapitulatif en lecture seule, PDF). Les primitives existent déjà dans `core/securite/cles-detenteur.ts`
(dérivation, AES-GCM, enveloppe) et `scellement`.
