# Demande backend — Servir la date d'ENREGISTREMENT CNM sur le DTO dossier

> ✅ **CLÔTURÉE le 06/09** — backend livré (`b32db82` : `DossierDto.dateEnregistrement`, date-heure
> nullable = clôture de `RECEPTION`, **exactement** le `debutCompteur` du chronométrage, résolue **en
> lot** avec `datePrevisionnelleFin` ; 3 tests dans `ChronometrageIntegrationTest`, suite 783 verte).
> `GET /api/receptions` reste vide pour la PRMP. Rien à livrer côté front : la colonne
> « Enregistrement CNM » se remplit dès que le backend local sert ce commit (redémarré le 06/09).
> Note de livraison en fin de document.

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

---

## Note de livraison backend — 2026-09-06 (`PRS20`, commit `b32db82`)

Livré tel que demandé. Référence du contrat : `docs/api-endpoints.md` du backend, § Chronométrage,
tableau « Champs sur `DossierDto` » ; règle ajoutée dans `docs/regles-gestion.md` (« Date prévisionnelle
de fin de traitement »).

- **`dateEnregistrement`** (string date-heure ISO, `null` tant que le Secrétaire n'a pas enregistré) sur
  `DossierDto`, présent sur `GET /api/dossiers/{id}` **et** sur toutes les listes qui servent déjà
  `datePrevisionnelleFin`, `attentePrmp` et `etapeCourante`.
- **Même valeur que le `debutCompteur`** du chronométrage, par construction : une seule méthode
  (`ChronometrageService.dateEnregistrement`) calcule la clôture de la dernière occurrence close de
  l'étape `RECEPTION`, pour le détail comme pour les listes. Liste et détail ne peuvent pas diverger.
- **En lot, zéro requête de plus** : la valeur est dérivée des tâches déjà chargées pour la date
  prévisionnelle (`DossierService.enrichirChronometrage`). Aucun N+1.
- **`GET /api/receptions` reste vide pour la PRMP** : portée inchangée, verrouillée par un test.
- Tests (`ChronometrageIntegrationTest`, section « date d'enregistrement ») : dossier réceptionné →
  `dateEnregistrement` = `debutCompteur` ; dossier soumis non réceptionné → `null` (la date
  prévisionnelle, elle, est déjà servie) ; la PRMP lit le champ sur la liste `GET /api/dossiers` et
  `GET /api/receptions` lui répond toujours `[]`.

Rien à livrer côté front : la colonne « Enregistrement CNM » affichait « — », elle se remplit d'elle-même.
