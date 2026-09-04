# Demande backend — `GET /dossiers/{id}/chronometrage` : servir l'attributaire courant

> ✅ **CLÔTURÉE le 04/09** — backend livré (`4ee9c0b`, 760 tests) et contre-recetté en réel :
> dossier réattribué → `attributaire` = l'assignataire courant (MEMANT1), non dispatché → null ;
> la consultation du dossier masque le CTA chez le CC sans changement front (repli DTO du widget).

**Date** : 2026-09-04 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : constat pilote du
jour (session CCANT01, PV en rectification sur un dossier attribué à Rina).

## Constat

Depuis `5225529`, la prise en charge d'**EXAMEN** est réservée à l'**attributaire courant** du
dispatch (403 pour tout autre, même par délégation) — c'est la bonne règle. Mais le front montre le
bouton « Prendre en charge » au **porteur nominal** de l'étape (profil MEMBRE + délégations) : un CC
qui ouvre le PV d'un dossier attribué à Rina voit un bouton actif dont le clic finit en dialogue
« Accès refusé ». Un geste voué au refus ne doit pas être offert.

Le front a corrigé les écrans qui **connaissent** l'attributaire (page des PV, écran d'examen —
livraison du jour) en le passant au widget. Restent les écrans qui ne chargent PAS les dispatchs
(la consultation du dossier notamment) : y ajouter deux appels de liste à chaque ouverture serait
contraire à la vague unique, alors que le serveur qui répond au chronométrage a le dispatch sous
la main.

## Demande

Ajouter au DTO de `GET /api/dossiers/{id}/chronometrage` :

- `attributaire` (string, nullable) : `imCtrlMembre` du **dispatch courant** du dossier
  (réattributions comprises — même dérivation que la garde de `prise-en-charge`) ; `null` tant que
  le dossier n'est pas dispatché.

Le front est déjà prêt : le widget lit ce champ en repli quand l'hôte ne fournit pas l'attributaire,
et masque le geste EXAMEN à quiconque d'autre. Aucun autre changement de contrat.

## Tests attendus

1. Dossier dispatché puis réattribué : `attributaire` = l'`imCtrlMembre` **après** réattribution.
2. Dossier non dispatché (RECEPTION en cours) : `attributaire` null.
