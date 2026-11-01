# Demande backend — 2026-11-01 — Contrats en vigueur : nommer le contrat par son dossier, et dire ce qui a été commandé

## Contexte

Le 01/11, le pilote a retenu la variante A de la maquette de l'écran « Contrats en vigueur » (PRMP, UGPM, Commission,
Administrateur). Il avait d'abord choisi la variante B, puis s'est ravisé. Chaque contrat devient un **tableau de bord** : un
en-tête, quatre indicateurs (échéance, commandé, titulaires, réception), puis des onglets.

Deux données de cet écran n'ont pas de source aujourd'hui :

1. **La référence du contrat.** L'écran l'appelait « fiche 5, lot 1 ». `idDmc` est un identifiant interne, invisible partout
   ailleurs. Le pilote nomme une procédure par sa référence de dossier, jamais par un identifiant. Le dossier de marché du lot
   porte cette référence, par exemple `00009/MAOO-CC/CNM/2026`. Ni `GET /api/contrats-en-vigueur` ni la fiche (`GET
   /api/fiches-marche/{idDmc}`) ne la servent. Seul `GET /api/dmcs/eligibles` porte `dossiersMarche[]`, et il est hors de propos ici.
2. **Le montant commandé.** Il n'est servi que par `GET /api/contrats-en-vigueur/{id}/bons-commande`. Le lire pour chaque ligne du
   tableau ferait un appel par contrat.

## B1 — La référence du dossier de marché du contrat

Dans chaque élément de `GET /api/contrats-en-vigueur` et de `GET /api/contrats-en-vigueur/{id}` :

```json
{ "idDossierMarche": 100398, "refeDossierMarche": "00009/MAOO-CC/CNM/2026" }
```

- C'est le dossier de marché (DDM) du lot du contrat, celui que la filiation range sous la mise en concurrence.
- Les deux champs valent `null` quand ce dossier n'existe pas : contrat antérieur à la liaison, remise papier sans dossier.
- Même visibilité que le reste de l'élément. Le front ouvre le dossier par la route habituelle du profil.

## B2 — Ce qui a été commandé, dans la liste

Dans chaque élément de `GET /api/contrats-en-vigueur` :

```json
{ "commandeHt": 300000000, "bonsEmis": 1, "bonsSansAccuse": 1 }
```

- **`commandeHt`** : le cumul HT des bons non annulés. C'est le `cumulHt` de `/bons-commande`.
- **`bonsEmis`** : le nombre de bons non annulés.
- **`bonsSansAccuse`** : ceux dont le titulaire n'a pas encore accusé réception.

L'indicateur « Commandé » affiche « 300 000 000 Ar · 2 % de l'estimé » quand `montantEstime` est servi. L'onglet des bons porte
leur nombre, et l'indicateur « Réception » le nombre de bons en attente d'accusé. Le contrat ouvert relit ses bons ; la liste suffit
pour le contrat qui s'affiche avant cette lecture. La note de performance du 30/10 s'applique : un calcul groupé pour toute la
liste, pas une requête par contrat.

## Côté front, en attendant

Les champs sont lus comme facultatifs :

- sans `refeDossierMarche`, le contrat est nommé « lot k » sous son objet ;
- sans `commandeHt`, l'indicateur « Commandé » attend la lecture des bons du contrat ouvert.

Le front n'interroge pas `/bons-commande` ligne par ligne.

> ⚠️ **2026-11-01 — B1, B2 livrés (PRS20, sans migration), sans écart.** `ContratVigueurDto` (liste et détail) gagne en fin d'objet
> `idDossierMarche`, `refeDossierMarche` (le DDM du lot, `null` s'il n'existe pas), `commandeHt` (cumul HT des bons émis, annulés
> exclus, comme `cumulHt`), `bonsEmis`, `bonsSansAccuse`. Sur la liste, bons, attributions et dossiers sont lus en une requête chacun
> pour tous les contrats ; le détail les lit pour son seul contrat.