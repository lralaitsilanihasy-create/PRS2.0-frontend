# Demande backend — Servir la date de SOUMISSION sur le DTO dossier

**Date** : 2026-09-06 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : demande pilote —
le « Suivi des dossiers CNM » (PRMP) gagne une colonne **« Dépôt du dossier »** entre la référence
et l'enregistrement CNM. Terme métier précisé par le pilote : **la date de soumission EST la date
de dépôt du dossier** — même donnée, le contrat garde le nom `dateSoumission`.

## Constat

La date/heure de soumission du dossier est déjà persistée serveur — la réception la sert au
Secrétaire (`ReceptionDto.dateSoumission`) — mais le DTO dossier des listes ne la porte pas, et
`GET /api/receptions` répond une liste vide à la PRMP (portée, à ne pas élargir).

## Demande

Ajouter au DTO dossier (mêmes listes que `dateEnregistrement` / `datePrevisionnelleFin`) :

- **`dateSoumission`** (date-heure, nullable) : l'horodatage de la soumission par la PRMP —
  la même valeur que celle servie au Secrétaire sur la réception ; `null` pour un brouillon
  (et pour un dossier ancien sans date de soumission). Résolution **en lot**, pas de N+1.

Le front est prêt : la colonne « Soumission » affiche « — » tant que le champ n'est pas servi.

## Tests attendus

1. Dossier soumis → `dateSoumission` du DTO = celle de la réception (même source).
2. Brouillon → `null`.
3. La PRMP lit le champ sur `GET /api/dossiers` (portée des réceptions inchangée).
