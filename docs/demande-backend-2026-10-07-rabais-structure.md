# Demande backend — 2026-10-07 — Le rabais structuré au dépôt de l'offre

**Date** : 2026-10-07 · **Émetteur** : front · **Origine** : arbitrage du pilote du 07/10 sur la question **Q4** de l'évaluation des offres
(`demande-backend-2026-10-07-evaluation-des-offres.md`) : « le rabais est **structuré au dépôt** », au lieu d'être lu en texte libre puis
saisi en valeur par la CAO.

**Le constat.**
- Au dépôt, le rabais est un **texte libre** de l'acte d'engagement (`acteEngagement.rabais: string | null` du manifeste scellé ;
  exemple d'aide à l'écran : « 2 % en cas d'attribution des deux lots »).
- À l'évaluation (étape 3, V77), la CAO en saisit la **valeur hors taxes** et sa lecture (`MontantRequest.rabais{ montant, lecture }`) ;
  le serveur la soustrait du prix corrigé.
- Un texte libre ne se calcule pas : deux membres peuvent en tirer deux montants, et la séance le lit sans le chiffrer.

**Conventions** : noms **PROPOSÉS** ; le backend les fixe et corrige ce document en place (encadré ⚠️ daté).

---

## B1 — Le rabais déclaré par le candidat

Dans le manifeste scellé (et donc le corps du dépôt), `acteEngagement.rabais` devient un objet, ou nul :

```
rabais: {
  nature: 'POURCENTAGE' | 'MONTANT',
  valeur: number,                 // pourcentage (0 < v < 100) ou montant hors taxes en ariary
  condition: 'AUCUNE' | 'LOTS',   // inconditionnel, ou subordonné à l'attribution de plusieurs lots
  lots: number[] | null,          // condition LOTS : les lots dont l'attribution conjointe déclenche le rabais (le lot de l'offre compris)
  libelle: string | null          // la phrase du candidat, telle qu'il l'écrit (facultative)
} | null
```

- **Format du manifeste** : version **4** (les versions 2 et 3 restent lisibles ; leur rabais texte reste lu comme aujourd'hui).
- **Contrôles au dépôt** (proposés) : 400 `RABAIS_INVALIDE` (valeur ≤ 0, pourcentage ≥ 100, montant supérieur au HT de l'acte),
  `RABAIS_LOTS` (condition `LOTS` sans au moins deux lots, ou sans le lot de l'offre, ou un lot inconnu de la fiche).
- **Le DAO** : si le cadrage ou la fiche dit que les rabais ne sont pas admis (Q1), le dépôt refuse un rabais (409 `RABAIS_NON_ADMIS`).

> ⚠️ **Backend, 2026-10-07 — B1 livré, avec un écart de fond** (contrat : `docs/api-endpoints.md`, § *Le rabais structuré de l'offre en
> ligne*) :
> - **Le serveur ne peut pas contrôler le rabais au dépôt** : le manifeste est **scellé dans le navigateur** et le serveur ne le lit qu'à
>   l'ouverture des plis (ADR-0013). Les 400 `RABAIS_INVALIDE` / `RABAIS_LOTS` proposés sont donc **à faire par le front avant le
>   scellement** ; le serveur **rejoue les mêmes contrôles à l'ouverture**, en **alertes de séance** de mêmes codes (`OffreLue.alertes`),
>   jamais en refus. Pour une procédure non allotie, le lot de l'offre est le lot **1**, et la fiche n'a qu'un lot.
> - **`RABAIS_NON_ADMIS` n'est pas servi** : aucun champ de la fiche ne dit si les rabais sont admis (Q1 reste au pilote).
> - **Version** : le serveur ne lit pas de numéro de version ; il reconnaît le format 4 à la **forme** de `acteEngagement.rabais` (un
>   objet). Un texte (formats 2 et 3) reste lu tel quel. `condition` absente vaut `AUCUNE`.

## B2 — La séance et la lecture

- `OffreLue.acteEngagement.rabais` sert l'objet ; la séance lit à haute voix **le montant du rabais** (art. 35-IV, 3°) : pour un
  pourcentage, le serveur le chiffre sur le HT lu ; pour un rabais conditionnel, la lecture dit sa condition (« 2 % si les lots 1 et 2
  sont attribués »).
- Le PV d'ouverture et son extrait public reprennent la même phrase.

> ⚠️ **Backend, 2026-10-07 — B2 livré**, avec ce complément : `acteEngagement.rabais` reste servi tel que scellé, et la séance sert en plus
> **`OffreLue.rabais`** (nouveau) = `{nature, valeur, condition, lots, libelle, montant, lecture}` — `montant` hors taxes chiffré sur le
> **HT lu** (rabais inconditionnel ; nul pour un conditionnel), `lecture` la phrase lue et imprimée au PV et à son extrait public :
> « 2 % du montant hors taxes, soit 250 000 Ariary », « 100 000 Ariary hors taxes, si les lots 1, 2 sont attribués au candidat ». Un
> texte libre (formats 2 et 3) est servi dans `libelle` et `lecture`, les autres champs nuls.

## B3 — L'évaluation (étape 3)

- **Rabais inconditionnel** : le serveur le **propose** dans `evaluation.rabais` (montant hors taxes : pourcentage × prix corrigé HT, ou
  le montant déclaré) ; la CAO le confirme ou le corrige avec un motif (principe P2 du lot 1 : une proposition n'est jamais une
  décision). `rabais` porte alors `{ montant, lecture, propose, nature, valeur }`.
- **Rabais conditionnel (`LOTS`)** : **non appliqué** à l'évaluation lot par lot (la combinaison de lots n'est pas servie, Q5 du lot 1
  au juriste) ; il est **affiché** à la CAO et repris au rapport. Q2 : faut-il l'appliquer quand l'attribution des lots visés est
  proposée au même candidat ?
- Les offres déposées avant ce lot (manifeste 2 ou 3) gardent la saisie actuelle par la CAO.

> ⚠️ **Backend, 2026-10-07 — B3 livré**, noms confirmés, avec ces précisions :
> - `evaluation.rabais` = `{montant, lecture, propose, nature, valeur, condition, lots, motif}` (en plus de la demande : `condition`,
>   `lots`, `motif`). En requête `PUT …/montant`, seuls `rabais.montant`, `rabais.lecture` et **`rabais.motif`** comptent.
> - **Inconditionnel** : sans `rabais.montant` saisi, la **proposition est retenue** ; un montant différent de la proposition exige
>   `rabais.motif` (400 `MOTIF_OBLIGATOIRE`). La proposition se calcule sur le **prix corrigé** (Q3, proposition retenue en attendant le
>   juriste).
> - **Conditionnel** : rabais **0** ; un montant saisi > 0 répond 400 **`RABAIS_CONDITIONNEL`**. Il est repris au rapport (§5, « non
>   appliqué à l'évaluation lot par lot »), comme un rabais déclaré corrigé (« de … corrigé à … — motif »).
> - Pour pré-remplir avant toute saisie : **`OffreEvaluee.rabaisDeclare`** (nouveau) = le `RabaisLu` de la séance (chiffré sur le HT
>   lu ; la proposition définitive, sur le prix corrigé, revient dans `evaluation.rabais.propose` après le `PUT`).

## Questions

| # | Question | À qui |
|---|---|---|
| Q1 | Le DAO dit-il si les rabais sont admis ? Faut-il une question de cadrage ou un champ de la fiche (« Rabais admis : oui / non ; conditionnels admis : oui / non ») ? | pilote |
| Q2 | Un rabais conditionnel à l'attribution de plusieurs lots : s'applique-t-il quand la CAO propose ces lots au même candidat (méthode des DPAO) ? | juriste |
| Q3 | Le pourcentage s'applique-t-il au HT lu ou au HT corrigé (après corrections arithmétiques) ? Proposition : au HT **corrigé**. | juriste |

> ⚠️ **Backend, 2026-10-07 — en attendant les réponses** : **Q1** — aucun champ ni question de cadrage créés ; tout rabais est lu
> (pas de `RABAIS_NON_ADMIS`) ; un champ « Rabais admis / conditionnels admis » s'ajoutera par le référentiel quand le pilote tranchera.
> **Q2** — le rabais conditionnel n'est jamais appliqué (la combinaison de lots n'est pas servie). **Q3** — la proposition de la demande
> est retenue : le pourcentage s'applique au HT **corrigé** à l'évaluation (au HT lu en séance, où il n'y a pas encore de correction).

## Ce que le front fera, et quand

- **Dès B1** : au dépôt, le champ « Rabais » devient : aucun / pourcentage / montant, inconditionnel ou lié à l'attribution de plusieurs
  lots (cases des lots de la fiche), et la phrase facultative ; le manifeste passe en version 4 (`core/securite/scellement.ts`) ; le
  brouillon local de l'offre suit.
- **Dès B2-B3** : la lecture de séance affiche le rabais chiffré ou sa condition ; l'étape 3 pré-remplit le rabais proposé et demande un
  motif pour le corriger.
