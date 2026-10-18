# Demande backend — 2026-10-18 — Prévenir la PRMP que l'avis spécifique est à imprimer

## Contexte

Demande du pilote du 18/10 : « Lorsque la PRMP peut imprimer l'avis spécifique, une notification doit parvenir dans son compte, et
un bouton doit permettre cette impression dans la colonne Actions du tableau de suivi des dossiers CNM. »

Aujourd'hui, la PRMP n'apprend que l'avis est disponible qu'en ouvrant la page du dossier. Là, la carte « Avis spécifique d'appel
d'offres » lit `GET /api/fiches-marche/{idDmc}/avis-specifique/disponibilite`. Rien ne la prévient, et le tableau de suivi
(`/prmp/tableau-de-bord`, lu sur `GET /api/dossiers`) ne sait pas quels dossiers ont un avis à imprimer.

Le front ne peut pas lire la disponibilité ligne par ligne : ce serait un appel par dossier du tableau (N+1). Il faut donc que le
serveur porte l'information sur la liste.

Le même besoin vaut pour les **lettres d'invitation** (prestations intellectuelles, et appel d'offres restreint sans avis public,
`MODE_SANS_AVIS`) : c'est le document que la PRMP imprime à la place de l'avis.

## B1 — Une notification quand l'avis devient imprimable

Nouveau type proposé : **`AVIS_A_IMPRIMER`**, et **`LETTRES_A_IMPRIMER`** pour les lettres d'invitation (ou un seul type avec le
document en détail, au choix du backend).

- **Destinataires** : la PRMP du plan et l'UGPM, c'est-à-dire ceux à qui `…/disponibilite` répond.
- **Moment** : le passage de `disponible: false` à `disponible: true`, quel que soit l'événement qui le provoque :
  - la signature d'un PV `FAV` ;
  - pour un PV `FAVR`, le dossier qui atteint `OBSERVATIONS_LEVEES`, `DECISION_TRANSMISE_SIGMP` ou `CLOTURE` ;
  - le dépôt de la publication de l'AGPM sur le plan, quand c'était la seule raison restante (`PUBLICATION_AGPM_ABSENTE`) ;
  - la clôture de la cérémonie des clés, en mode électronique (`CEREMONIE_NON_CLOSE`).
- **Objet** : `typeObjet = DOSSIER`, `idDossier` = le dossier soumis de la fiche. Le front mène alors à la page du dossier, où
  s'imprime l'avis.
- **Une seule fois** par dossier et par document. Une réimpression ne renotifie pas. Un retour à `disponible: false` suivi d'une
  nouvelle disponibilité (nouvelle version, réexamen) renotifie.
- **Texte suggéré** : « L'avis spécifique du dossier {refeDossier} ({designationMarche}) peut être imprimé. »

## B2 — L'information sur la liste des dossiers

Sur `GET /api/dossiers` (et ses filtres `?statut=`), pour un dossier né d'une fiche (`idDmc` non nul), un champ réduit :

```json
"impressionAvis": { "document": "AVIS_SPECIFIQUE", "disponible": true, "dejaImprime": false }
```

- `document` : `AVIS_SPECIFIQUE` ou `LETTRES_INVITATION`, selon ce que la fiche imprime ;
- `disponible` : la même règle que `…/disponibilite`, sans la raison (la page du dossier la lit si besoin) ;
- `dejaImprime` : un avis (ou une lettre) a déjà été produit ; le front affiche alors « Réimprimer » plutôt qu'« Imprimer » ;
- le champ est **absent** quand `idDmc` est nul ou quand l'utilisateur n'est ni la PRMP ni l'UGPM du plan.

Ce champ doit être calculé **en lot** pour la page de la liste, pas dossier par dossier.

## Questions

- **Q1 — Les dossiers déjà disponibles.** Faut-il notifier, à la mise en production, les dossiers dont l'avis est déjà disponible
  mais jamais imprimé ? Le front propose que non : le bouton du tableau suffit à les retrouver.
- **Q2 — L'« À faire ».** L'avis à imprimer doit-il aussi apparaître dans l'accueil « À faire » de la PRMP, comme une tâche
  servie par `GET /api/dossiers/{id}/gestes` ? Le front ne l'invente pas, mais il saurait l'afficher.

## Côté front (préparé, sans attendre la livraison)

- **Tableau de suivi** : dans la colonne Actions, un bouton « Imprimer l'avis » (ou « Imprimer les lettres », ou « Réimprimer »)
  quand `impressionAvis.disponible` est vrai. Il mène à la page du dossier avec `?imprimer=avis`, qui ouvre d'emblée la fenêtre
  d'impression. Tant que le champ n'est pas servi, le bouton ne s'affiche pas.
- **Notification** : `AVIS_A_IMPRIMER` / `LETTRES_A_IMPRIMER` mènent à la même page, avec la même ouverture d'emblée.
