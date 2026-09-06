# Demande backend — Servir la date d'ENREGISTREMENT CNM sur le DTO dossier

**Date** : 2026-09-06 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : demande pilote —
le tableau de bord PRMP devient « Suivi des délais CNM » : référence · **date d'enregistrement**
(réception par le Secrétaire) · fin de traitement prévue.

## Constat

Le DTO dossier des listes sert déjà `datePrevisionnelleFin`, `attentePrmp` et `etapeCourante`
(chronométrage), mais pas la date d'ENREGISTREMENT. Or :
- `GET /api/receptions` renvoie une liste **vide** à la PRMP (hors portée) ;
- le chronométrage par dossier la porte (`debutCompteur` = clôture de RECEPTION), mais l'appeler
  par dossier ferait un N+1 sur une liste.

## Demande

Ajouter au DTO dossier (mêmes listes que `datePrevisionnelleFin`) :

- **`dateEnregistrement`** (date-heure, nullable) : la clôture de l'étape RECEPTION du
  chronométrage (`debutCompteur`) — `null` tant que le Secrétaire n'a pas enregistré le dossier.
  Même résolution en lot que la date prévisionnelle (pas de N+1 serveur).

Le front est prêt : la colonne « Enregistrement CNM » du nouvel écran affiche « — » tant que le
champ n'est pas servi, et le lira dès qu'il l'est.

## Tests attendus

1. Dossier réceptionné → `dateEnregistrement` = clôture de RECEPTION (cohérente avec
   `debutCompteur` du chronométrage).
2. Dossier soumis non réceptionné → `null`.
3. La PRMP voit le champ sur SES dossiers via `GET /api/dossiers` (aucun élargissement de portée
   des réceptions).
