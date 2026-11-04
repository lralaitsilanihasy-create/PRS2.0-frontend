# Demande backend — 2026-11-04 — Avancement des lignes de chaque plan, dans la liste des dossiers

## Contexte

Le pilote a choisi le 04/11 (maquette `docs/maquette-2026-11-04-plusieurs-plans.html`, variante B) la présentation de
l'écran « Plans de passation » chez le Président, le Chef de commission et le Membre. Quand la localité compte plusieurs
plans en vigueur, l'écran ouvre d'abord un **tableau des plans**, une ligne par plan : entité, référence, exercice, nombre de
lignes, montant, date de clôture, et **l'avancement de ses lignes**. Un clic ouvre le plan.

Tout s'obtient avec les lectures déjà faites par l'écran (`GET /api/dossiers`, `/api/ppms`, `/api/marches`), sauf
l'avancement. Aujourd'hui, l'étape d'une ligne se lit sur la **filiation** de son plan (`GET /api/dossiers/{id}/filiation`,
un appel par plan). Pour le tableau, cela ferait un appel par plan à l'ouverture de l'écran : trente appels pour une localité de
trente entités. Nous ne voulons pas de ce N+1.

## B1 — `DossierDto.avancementLignes` sur les plans, servi en liste

Sur chaque dossier de la famille **DDP** de `GET /api/dossiers` (liste scopée, telle qu'elle est), un champ :

```json
"avancementLignes": { "lignes": 34, "marche": 1, "commission": 0, "lancee": 0, "preparation": 0, "lancer": 2, "aucune": 31 }
```

- `lignes` : les lignes du plan **non retirées** (`supprimee = false`), comme l'écran les compte.
- Chaque ligne compte dans **une seule** étape, la première qui s'applique dans cet ordre (c'est la règle que le front applique
  aujourd'hui dans `suivi-ligne.ts`, sur la filiation de la ligne, nœuds masqués exclus, plan et versions suivantes exclus) :
  1. `marche` — la ligne a au moins un dossier `MARCHE` ;
  2. sinon, sur son dossier `MISE_EN_CONCURRENCE` (rapport justificatif compris) :
     `preparation` s'il est `BROUILLON` ; `lancee` s'il est `CLOTURE` ou `DECISION_TRANSMISE_SIGMP` ; `commission` s'il est
     encore au circuit (ni brouillon, ni clos, ni `RETIRE`, ni `REMPLACE`) ;
  3. sinon, `lancer` si la ligne porte une fiche DAO sans dossier (lignes éligibles, `dejaDao`), ou si son mode est un
     gré à gré (libellé contenant « GRE A GRE ») ;
  4. sinon `aucune`.
- Calculé **en lot** pour toute la liste (une requête, comme `objetMarche` le 03/11), jamais par plan.
- `null` (ou absent) sur les autres familles.

**Écart accepté** : le Président, le CC et le Membre ne voient pas les fiches DAO en préparation de la PRMP ; si le serveur
compte ces lignes `lancer` ou `preparation` pour eux, c'est mieux que le front, qui ne le sait pas. Dites-nous ce que vous servez.

## Ce que fait le front

Le tableau des plans est livré sans attendre : sa colonne « Avancement des lignes » n'apparaît que lorsque le champ est servi
(et le tri « lignes sans étape » avec elle). Rien d'autre ne dépend de cette demande.

> ⚠️ **2026-11-04 — B1 livré (PRS20, sans migration), la règle suivie, trois précisions.**
> - **Où** : `DossierDto.avancementLignes` = `{ lignes, marche, commission, lancee, preparation, lancer, aucune }` sur chaque plan (DDP)
>   des listes de `GET /api/dossiers`, et sur `GET /api/dossiers/{id}`. `null` hors plan. Calculé en lot : une requête par nature de
>   fait pour toute la liste.
> - **Ce que le serveur voit (réponse à l'« écart accepté »)** : les dossiers et les procédures comptent **quel que soit le
>   périmètre du lecteur**. Une ligne dont la PRMP prépare la fiche DAO, sans dossier encore, compte donc `lancer` pour le Président,
>   le CC et le Membre aussi. Une mise en concurrence en brouillon compte `preparation`.
> - **Précisions** :
>   - `lancer` couvre toute ligne qui a une procédure sans dossier de mise en concurrence (fiche commencée ou validée), ou dont le mode
>     est un gré à gré (libellé normalisé, accents et traits d'union ignorés) ;
>   - plusieurs dossiers de mise en concurrence sur une ligne : le plus avancé l'emporte (clos, puis au circuit, puis brouillon) ;
>     `RETIRE` et `REMPLACE` sont ignorés ;
>   - les faits des **copies** de la ligne dans les autres versions du plan comptent (même `idLigneOrigine`), comme pour les jalons ;
>   - les dossiers rattachés hors fiche (V163 : RJ, MGG) comptent comme mise en concurrence et comme marché.