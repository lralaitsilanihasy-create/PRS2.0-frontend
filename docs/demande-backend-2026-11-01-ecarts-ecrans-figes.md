# Demande backend — 2026-11-01 — Écrans figés : les écarts avec l'état actuel

## Contexte

Le pilote a demandé, le 01/11, de **fusionner** les écrans figés (R4, V104) dans les éléments du dossier : la carte « Écrans
figés » disparaît, chaque élément (Fiche de présentation, Séance d'ouverture, Rapport d'évaluation, Attribution…) porte un sélecteur
**« État actuel / À la soumission n° k »**. Le front l'a livré (lot 1) : la répartition des écrans entre les cartes est faite en
front, l'instantané se lit par la route existante (`GET /api/dossiers/{id}/instantanes/{ecran}?soumission=k`).

Sur la maquette retenue (« cas 2 »), la carte dit en plus **si l'état actuel diffère** de la soumission (pastille « ≠ soumission »,
« 1 écart avec la soumission n° 1 », valeur soumise rappelée à côté de la valeur actuelle). Le front ne peut pas le calculer seul :

- `PLAN` et `AVIS` sont des **assemblages** propres à l'instantané (`InstantaneService.plan()`, `avis()`) : aucune route de lecture
  vivante ne sert la même forme ;
- les DTO vivants portent des champs **dépendant de l'heure ou de l'appelant** (états calculés à l'horloge, droits, libellés) :
  une comparaison brute côté navigateur signalerait de faux écarts ;
- l'écran figé est la preuve ; c'est au serveur, qui l'a produit et en garde l'empreinte, de dire s'il est encore conforme.

## B1 — Les écarts d'une soumission

`GET /api/dossiers/{idDossier}/instantanes/ecarts?soumission=k` (`soumission` absente : la dernière)

- **Accès** : les mêmes lecteurs que `GET …/instantanes` (profils CNM, PRMP, UGPM du dossier).
- **Calcul** : pour chaque écran figé de la soumission, recalculer le contenu **actuel** par le même `InstantaneService.contenu(...)`
  (sans rien enregistrer) et le comparer au JSON figé, **champ par champ**, en écartant les champs volatils (à lister côté serveur :
  états calculés à l'horloge, drapeaux de droits de l'appelant…).
- **Réponse** :

```json
{
  "soumission": 1,
  "figeLe": "2026-08-24T10:00",
  "ecrans": [
    { "ecran": "EVALUATION", "identique": false, "ecarts": [
      { "chemin": "lots[0].offres[1].evaluation.montantEvalue", "libelle": "Offre n° 2 — montant évalué",
        "soumis": "2 939 941 765 Ar", "actuel": "2 914 400 000 Ar" } ] },
    { "ecran": "SEANCE", "identique": true, "ecarts": [] },
    { "ecran": "PLAN", "identique": true, "ecarts": [] }
  ]
}
```

- **`libelle`** : en clair, pour l'écran (« Offre n° 2 — montant évalué », « Commission — membre ajouté : RABE »), le front ne
  reconstruit pas de libellé à partir d'un chemin JSON. **`soumis` / `actuel`** : les valeurs telles qu'on les lit (montant formaté,
  date en jj/mm/aaaa), `null` pour un ajout ou un retrait.
- **Écran disparu** (la donnée n'existe plus) : `identique: false` et un écart unique « écran supprimé depuis la soumission ».
- **Plafond** : au plus 50 écarts par écran, avec `"tronque": true` au-delà (le dossier reste lisible ; l'écran figé fait foi).

## Ce que fera le front (une fois B1 livré)

- **Carte** : la pastille « 🔒 figé à la soumission » devient **« ≠ soumission »** (ocre) quand un de ses écrans n'est pas identique.
- **Fenêtre** : à côté du sélecteur, « ✓ identique à la soumission n° k » (vert) ou « n écart(s) avec la soumission n° k », qui
  déplie la liste des écarts (libellé, valeur soumise → valeur actuelle) et un lien « voir ce qui a été soumis ».
- Un appel par dossier, dans la vague de la page, silencieux : en cas d'échec, la pastille reste « 🔒 figé » sans comparaison.

## Hors périmètre

Le surlignage de la valeur modifiée **à sa place dans chaque vue** (la maquette le montre sur le rapport d'évaluation) : il
demanderait de relier chaque chemin JSON à un endroit de chaque écran. La liste des écarts dans la fenêtre en tient lieu.

> ⚠️ **2026-11-01 — B1 livré (PRS20, sans migration). Écarts et précisions :**
> - Route et forme comme demandé, plus **`comparable`** par écran : `false` (avec `identique` nul et aucun écart) quand l'écran ne se
>   relit pas pour l'appelant — l'écran AVIS (disponibilités de l'avis et des lettres) se recalcule pour la PRMP seule : pour un Membre
>   il est `comparable: false`, pas un faux écart. **Le front l'affiche comme « non comparable »** (ni « ✓ identique » ni « ≠ »).
> - **Libellés** : génériques, pas rédigés écran par écran. Éléments nommés par leur identité (« Lot 1 », « Offre n° 2 », « Membre 3 »,
>   « … (ajouté) »), champs par un dictionnaire des noms courants (montant évalué, état, avis…), à défaut le nom découpé en mots
>   (« ligne — designation marche »), joints par « — ». Exemple réel : `Lot 1 — Offre n° 2 — évaluation — montant évalué`.
> - **Valeurs** : montant « 2 939 941 765 Ar », date jj/mm/aaaa (et heure), oui/non ; un élément entier ajouté ou retiré est résumé en
>   texte compact (JSON, 120 caractères au plus) — à demander si une forme plus lisible est utile.
> - **Seuls les champs présents dans l'écran figé sont comparés** : un champ apparu depuis (nouvelle version du serveur, champ que
>   seul le lecteur voit) n'est pas un écart. Champs volatils écartés : liste dans `PRS20/docs/api-endpoints.md` (section des
>   instantanés).
> - Vérifié : juste après une soumission, les trois écrans (PLAN, AVIS, CAO) sont **identiques** pour la PRMP (aucun faux écart).