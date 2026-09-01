# Demande au backend `PRS20` — 1ᵉʳ septembre 2026 — Le PV perd son Secrétaire de séance

> Document destiné à la session backend. Émis depuis le front `frontendprs2`. **Règle du pilote,
> 01/09** : « supprimer du projet de PV et du PV définitif le Secrétaire de séance » — la notion
> disparaît du cycle du PV, désignation comprise. Backend d'abord, le front suivra.
>
> Lecture du contexte : depuis les **rattachements Membre → Vérificateur → Assistant** (`f7cfe66`),
> la boucle de vérification est routée par les chaînes nominatives — le Secrétaire de séance
> n'avait plus qu'un rôle documentaire (une ligne sous « Étaient présents », mention « (par
> délégation) » le cas échéant). C'est cette ligne, et la désignation qui la nourrissait, que le
> pilote retire.

---

## 1. Contrat

- **`POST /api/pv-examens/{id}/viser`** (normal et intérim) : `idSecretaireSeance` **n'est plus
  exigé** — la garde 400 « Secrétaire de séance obligatoire » est retirée. Recommandation de
  tolérance : un champ encore envoyé par un client non à jour est **ignoré**, pas refusé
  (même esprit que la note d'intérim envoyée par un dispatcheur).
- Les gardes d'éligibilité associées (Vérificateur titulaire de la localité / paire
  « → Vérificateur » active, §3.3) deviennent **sans objet** sur ce chemin — à retirer avec le
  champ. `peutEtreSecretaireSeance` ne sert plus au visa.
- **Documents** (projet de PV et PV définitif, les 12 modèles) : la ligne « Secrétaire de séance :
  … » ne s'imprime **plus**, mention « (par délégation) » comprise. D'après vos livraisons, elle
  est posée par le contexte serveur sous « Étaient présents » — à retirer du contexte (et des
  modèles si un placeholder y existe) ; étendre le test `PvDocumentService.contexte(pv)` hors Word.
- **DTO `PvExamenDto`** : `idSecretaireSeance` / `nomSecretaireSeance` **conservés en LECTURE**
  pour les PV existants (trace fidèle — le PV 00009 signé aujourd'hui en porte un) ; `null` sur
  tout PV visé après le déploiement. Ne pas purger les données historiques.

## 2. Transition

Aucune migration : les PV déjà signés gardent leur secrétaire en base et au DTO ; les documents déjà
générés ne sont pas retouchés. Seuls les visas et générations postérieurs au déploiement changent.

## 3. Ce que le front livrera ensuite

1. Panneau « Viser » (normal et intérim) : le champ « Secrétaire de séance » disparaît, sa
   validation aussi — restent l'avis, le co-signataire (et la note d'intérim le cas échéant).
2. Affichages (Projets de PV, PV reçus de l'Assistant, détail du PV) : la ligne « Secrétaire de
   séance » n'apparaît plus que si le PV en porte un (historique).

Comme toujours : PLAN d'abord pour validation, tests (visa sans champ OK, champ envoyé = ignoré,
document sans la ligne, PV historique inchangé au DTO), docs (`api-endpoints`, `regles-gestion`),
**commit + push complet, fichiers neufs et `.docx` éventuels compris**.
