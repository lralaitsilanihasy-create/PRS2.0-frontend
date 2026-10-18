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

> ⚠️ **2026-10-18, livré (backend)**
> - **Un seul type, `AVIS_A_IMPRIMER`**, pour les deux documents. Le document est nommé dans le titre (« Avis spécifique à
>   imprimer » ou « Lettres d'invitation à imprimer ») et dans le texte (« Les lettres d'invitation du dossier … peuvent être
>   imprimées. »). `LETTRES_A_IMPRIMER` n'existe pas.
> - **Destinataires** : la PRMP du plan et **chacune de ses UGPM**. Jusqu'ici, l'UGPM ne recevait aucune notification. Elle a
>   désormais les siennes (destinataire de type `UGPM`) : `GET /api/notifications/mes`, le compteur et `POST /{id}/lu` les lui
>   servent, et son flux temps réel est poussé.
> - **Objet** : `typeObjet = DOSSIER`, `idObjet` = `idDossier` = le dossier soumis de la fiche. Le texte est celui proposé.
> - **Moment** : chaque écriture qui peut rendre le document imprimable relève la disponibilité avant et après, et ne notifie que
>   les dossiers qui passent d'indisponible à imprimable. Ce sont la signature d'un PV, les observations levées, la transmission au
>   SIGMP, l'archivage, le dépôt de la publication de l'AGPM (toutes les fiches de la PRMP sont relevées) et la clôture de la
>   cérémonie des clés.
> - **Une seule fois** : une réimpression ou un nouveau dépôt de la publication ne renotifie pas. Un retour à l'indisponibilité
>   suivi d'une nouvelle disponibilité renotifie. Cela ne demande aucune trace en base.
> - **Écart** : un statut posé à la main par l'Administrateur (`PUT /api/dossiers/{id}`) ne notifie pas.
> - **La cérémonie des clés** garde sa notification `CLES_PUBLIEES` à la PRMP. `AVIS_A_IMPRIMER` ne part que si l'avis devient
>   réellement imprimable (PV signé, publication de l'AGPM déposée).

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

> ⚠️ **2026-10-18, livré (backend)** — `impressionAvis` a la forme demandée, sur `GET /api/dossiers` (paginé ou non, avec ses
> filtres) **et sur la lecture unitaire** `GET /api/dossiers/{id}`.
> - Il est servi à la PRMP et à l'UGPM seulement. Il est absent pour les autres profils, pour un dossier sans fiche et pour une
>   fiche qui n'imprime ni avis ni lettre.
> - `dejaImprime` : un avis ou une lettre a déjà été produit pour la fiche (les projets ne comptent pas).
> - **Le calcul en lot, avec une limite** : deux requêtes pour toute la page, l'une pour les dossiers dont un PV favorable est
>   signé (les seuls où le document peut être imprimable), l'autre pour les documents déjà produits. La règle entière n'est évaluée
>   que pour les dossiers à PV favorable. En revanche, la catégorie et le mode, qui disent lequel des deux documents la fiche
>   imprime, se lisent fiche par fiche : quelques requêtes par dossier né d'une fiche, et rien pour les autres.

## Questions

- **Q1 — Les dossiers déjà disponibles.** Faut-il notifier, à la mise en production, les dossiers dont l'avis est déjà disponible
  mais jamais imprimé ? Le front propose que non : le bouton du tableau suffit à les retrouver.
- **Q2 — L'« À faire ».** L'avis à imprimer doit-il aussi apparaître dans l'accueil « À faire » de la PRMP, comme une tâche
  servie par `GET /api/dossiers/{id}/gestes` ? Le front ne l'invente pas, mais il saurait l'afficher.

> ⚠️ **2026-10-18, réponses (backend)**
> - **Q1 — d'accord, pas de rattrapage.** Les notifications ne partent qu'au passage de l'indisponible à l'imprimable : un dossier
>   déjà imprimable à la mise en service n'est pas notifié. Le bouton du tableau le retrouve.
> - **Q2 — pas retenu pour l'instant, à soumettre au pilote.** L'accueil « À faire » écarte les dossiers clôturés (`CLOTURE`),
>   alors que l'avis peut y rester à imprimer, et ses règles ne lisent pas encore la fiche. La notification et le bouton du tableau
>   couvrent le besoin. Si le pilote le demande, ce sera un geste propre, servi aussi sur les dossiers clôturés.

## B3 — L'avis à imprimer dans l'accueil « À faire » (pilote, 18/10)

Réponse du pilote à Q2, le 18/10 : **oui**, l'avis à imprimer doit apparaître dans l'accueil « À faire » de la PRMP. Le front
reprend la proposition du backend : un geste propre, servi aussi sur les dossiers clôturés.

Proposition (les noms sont au choix du backend) :

- **Section `AVIS_A_IMPRIMER`**, geste principal **`IMPRIMER_AVIS`**, servie par `GET /api/dossiers/a-faire` et par
  `GET /api/dossiers/{id}/gestes` (même forme de `Tache`).
- **Une ligne par dossier** dont `impressionAvis.disponible` est vrai et `dejaImprime` faux, c'est-à-dire la même règle que le
  bouton du tableau de suivi. Un dossier `CLOTURE` reste éligible. La ligne **disparaît à la première impression** : une
  réimpression reste possible depuis le tableau de suivi et la page du dossier, mais elle n'est pas « à faire ».
- **Lettres d'invitation** : même section et même geste. Le front lit `impressionAvis.document` sur la ligne (ou un champ de la
  tâche, au choix du backend) pour dire « Imprimer les lettres ».
- **Destinataires** : la PRMP et l'UGPM, comme pour la notification.
- **Compteur** : la ligne compte dans `compteurs.aFaire` (et donc dans la pastille du menu), sans délai standard (`SANS_DELAI`,
  `delaiHeures` nul) : l'impression n'est pas chronométrée.
- **Ordre** : après les sections PRMP existantes (`A_RECTIFIER`, `COMPLEMENTS_A_TRANSMETTRE`…), avant le suivi `EN_COURS_CNM`.

Côté front, à la livraison : le libellé de la section (« Avis à imprimer ») et du geste (« Imprimer l'avis »), et la navigation
du geste vers la page du dossier, fenêtre d'impression ouverte d'emblée (`?imprimer=avis`, déjà en place).

## Côté front (préparé, sans attendre la livraison)

- **Tableau de suivi** : dans la colonne Actions, un bouton « Imprimer l'avis » (ou « Imprimer les lettres », ou « Réimprimer »)
  quand `impressionAvis.disponible` est vrai. Il mène à la page du dossier avec `?imprimer=avis`, qui ouvre d'emblée la fenêtre
  d'impression. Tant que le champ n'est pas servi, le bouton ne s'affiche pas.
- **Notification** : `AVIS_A_IMPRIMER` / `LETTRES_A_IMPRIMER` mènent à la même page, avec la même ouverture d'emblée.

> ⚠️ **2026-10-18, front après livraison** — un seul type, `AVIS_A_IMPRIMER` : `LETTRES_A_IMPRIMER` est retiré du routage.
> Recette sur le dossier des consomptibles informatiques (ligne 303339, 00001/DAOO-CC/CNM/2026, clôturé) : `impressionAvis`
> servi (`AVIS_SPECIFIQUE`, disponible, non imprimé), bouton « Imprimer l'avis » au tableau de suivi, fenêtre d'impression
> ouverte à l'arrivée, aucune écriture. La notification n'est pas observable en recette : le dossier était déjà imprimable.
