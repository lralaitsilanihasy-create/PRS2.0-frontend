# Demande backend — 2026-09-26 — Le sigle de l'entité contractante, porté par le référentiel

**Origine** : rejeu du dossier réel 2463 par le backend (`PRS20/docs/export/2463/rapport-2463.md`, §2.1) et
`docs/jeu-donnees-2463-faits.md` §11 ; arbitrage du pilote du 26/09 : « Oui, je souhaite ».

## Le constat

Le dossier réel s'intitule `2463-MI/MESupReS/PRMP/UGPM.2026` : l'autorité contractante y est désignée par son
**sigle**, « MESupReS ». Le référentiel des entités (`tr_entite_contract`) n'a pas de colonne pour ce sigle. La
référence du plan de passation est donc bâtie sur un acronyme **dérivé du libellé** par `ReferenceService` (mots vides
retirés, apostrophe non coupée : « L'ENSEIGNEMENT » → L), ce qui donne `00001/MLSRS/PPM-AGPM/2026` pour le Ministère de
l'Enseignement Supérieur et de la Recherche Scientifique — un sigle que personne n'emploie, imprimé sur le PPM, la fiche
de présentation, l'AGPM et repris dans les références des dossiers.

## B1 — Une colonne `SIGLE` sur l'entité, servie et modifiable

- `tr_entite_contract.SIGLE` : texte court, **facultatif** (nul pour les entités existantes), 20 caractères au plus,
  unicité **non** exigée (deux directions régionales peuvent partager un sigle) ; servi dans `EntiteContractDto.sigle`
  par toutes les lectures d'entités (`GET /api/entite-contracts`, `/{id}`, l'arbre), accepté au `POST` (création par la
  PRMP à l'import comme par l'Administrateur) et au `PUT`.
- Validation : lettres, chiffres, tirets et points seulement (c'est un morceau de référence), sans espace ; trop long ou
  caractère interdit → 400 `sigle` nominatif.
- Pas de reprise de données : le sigle des entités déjà en base est laissé nul et se renseigne à la main
  (Administrateur → Entités). La seule exception utile est l'entité 11 du jeu 2463, à poser à « MESupReS » par le script
  de rejeu (étape 0), pas par migration.

## B2 — La référence emploie le sigle quand il existe

`ReferenceService` prend `SIGLE` **s'il est renseigné**, et garde l'acronyme dérivé sinon — même règle pour la
référence du PPM, du dossier de planification et de tout ce qui reprend le segment « entité » d'une référence. Une
référence déjà attribuée ne change jamais (elle est indélébile) : seules les prochaines en profitent. Le compteur
`t_sequence_reference` étant clé par `CODE_LOCALITE` (aujourd'hui l'acronyme dérivé), dire dans la réponse comment le
compteur suit le passage de « MLSRS » à « MESupReS » (nouvelle ligne à 0, ou renommage de la clé — la première est la
plus simple, la base de démonstration est à zéro).

## B3 — Les documents

Là où un document imprime l'acronyme dérivé (en-tête du PPM, fiche de présentation, AGPM, cartouche des formulaires
du candidat A1-A4, référence du DAO), il imprime le sigle. Rien à changer aux gabarits : c'est la même valeur, mieux
alimentée.

## Ce que le front fera

- `EntiteContract.sigle?: string | null` au modèle.
- Le champ « Sigle » (facultatif, 20 caractères, aide : « tel qu'il figure dans les références : MESupReS, JIRAMA… »)
  sur les trois endroits qui saisissent une entité : Administrateur → Entités (formulaire générique
  `admin-resources.config.ts`), le panneau de résolution de l'entité à l'import d'un PPM (création par la PRMP), la
  fiche de l'arbre des entités ; affiché à côté du libellé dans les listes qui nomment l'entité.
- Rien n'est codé tant que le contrat n'est pas servi ; un sigle absent n'affiche rien (le libellé suffit).

## Ce que le backend rend

La colonne et le DTO (B1), la règle de référence et la réponse sur le compteur (B2), les documents (B3), la ligne du
CSV / SQL du référentiel pour l'entité 11 du jeu 2463, `docs/api-endpoints.md` et `docs/regles-gestion.md` mis à jour,
et un mot ici si la livraison s'écarte de la demande (encadré ⚠️ daté, à l'endroit corrigé).
