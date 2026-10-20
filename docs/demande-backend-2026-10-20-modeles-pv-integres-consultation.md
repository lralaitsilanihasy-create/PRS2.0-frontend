# Demande backend — 2026-10-20 — Modèles de PV intégrés : les consulter depuis l'écran

## Contexte

`GET /api/modeles-pv/integres` (demande « modeles-pv-integres », livrée le 20/10) sert la liste des fichiers Word intégrés : les
12 du PV du plan et les 2 de la lettre de renvoi. Il en sert le nom, la règle et l'état. L'écran « Modèles de PV » les affiche
« En service ».

Le pilote demande à les **voir**. Aujourd'hui, seul un accès au poste du serveur le permet, en ouvrant
`src/main/resources/templates/` dans Word. Rien ne les ouvre depuis l'application.

Il y a deux besoins :
- **lire le Word livré**, pour le reprendre comme base d'un modèle de l'écran : lot G4, reprise du plan, avec la réécriture que la
  réponse à Q4 du 20/10 juge nécessaire ;
- **voir ce qu'il produit sur un dossier réel**. C'est aussi l'outil de la comparaison qu'exige le retrait des anciens fichiers : on
  met côte à côte, sur les mêmes dossiers, le rendu d'un fichier intégré et celui du modèle qui le remplace.

## B1 — Télécharger un fichier intégré

`GET /api/modeles-pv/integres/{code}/fichiers/{nom}` → le `.docx` tel que livré dans le JAR.

- `code` : celui de la liste (`PV-PLAN-INTEGRE`, `LETTRE-RENVOI-INTEGREE`).
- `nom` : un des `fichiers` de ce code, par exemple `PV_AF_PPM_CENTRALE.docx`.
- Réservé à l'Administrateur, comme les autres routes. Un nom absent de la liste servie répond 404 : jamais un chemin libre lu sur
  le disque ou dans le classpath.

> ⚠️ **2026-10-20, livré (backend), tel que demandé** : le nom n'est servi que s'il figure dans les `fichiers` du code (la liste
> de `/integres`). Tout autre nom, ou un code inconnu, répond 404.

## B2 — L'aperçu d'un fichier intégré sur un dossier réel

`POST /api/modeles-pv/integres/{code}/apercu?dossier=&avis=&format=pdf|docx` → le document rempli. **Rien n'est enregistré**,
comme l'aperçu d'une version (`/versions/{n}/apercu`).

- Le **fichier** est choisi par la règle même de la production : l'avis (forcé par `avis`, sinon celui du dernier PV), le sous-type
  (AGPM ou non) et la localité. Pour la lettre de renvoi, la localité seule.
- La réponse dit quel fichier a servi, par exemple dans un en-tête `X-Fichier-Modele: PV_AFSR_PPMAGPM_CENTRALE.docx`. L'écran
  l'affiche à côté de l'aperçu.
- Un dossier que la règle exclut répond 409, avec la raison en clair : PPM sans ligne, avis NSP, dossier hors du plan pour le PV.
  C'est exactement le cas où un PV réel serait produit sans document.
- `CONVERSION_INDISPONIBLE` comme pour l'aperçu d'une version. Le format `docx` reste possible sans Word sur le serveur.
- Les valeurs sont lues **par le même code que la production** (`PvDocumentService`, `LettreRenvoiService`). Un aperçu qui
  divergerait du PV produit ne servirait pas à la comparaison.

> ⚠️ **2026-10-20, livré (backend), avec deux précisions**
> - **Même code que la production**. La règle de choix est extraite en `PvDocumentService.choisirModele`, qui donne le fichier ou
>   la raison du refus ; la production et l'aperçu la partagent. Les deux générateurs sont coupés en « remplir le Word », puis
>   « convertir », sans changer le rendu. Les remplacements de la lettre passent par le même calcul.
> - **L'avis forcé** se pose sur une copie du PV : le PV en base garde le sien.
> - **Les 409** :
>   - `PV_ABSENT` : le dossier n'a pas de PV ;
>   - `AUCUN_DOCUMENT` : la règle refuse, avec la raison en clair (avis « ne se prononce pas », dossier sans plan, plan sans ligne,
>     localité du circuit inconnue) ;
>   - `LETTRE_ABSENTE` : le dossier n'a pas de lettre de renvoi ;
>   - `CONVERSION_INDISPONIBLE` : pas de Word sur le serveur pour le PDF.
> - **L'en-tête `X-Fichier-Modele`** se lit sans configuration CORS, car le front passe par `proxy.conf.json` (même origine). Un
>   déploiement sur une autre origine devra l'exposer.
> - **Précision pour la comparaison** : un PV signé, régénéré pour l'aperçu, prend la date du jour (`<DATE AUJOURD'HUI>`) et les
>   règles en vigueur. Il peut donc différer du PDF archivé sur ces points. C'est déjà le cas de la régénération actuelle.

## Questions

- **Q1.** Pour un dossier qui a un PV, l'aperçu prend-il le PV le plus récent ? Ou faut-il un paramètre `pv=` pour viser un PV
  précis, par exemple un PV signé qu'on veut comparer à son document archivé ?
- **Q2.** Pour la lettre de renvoi, faut-il la lettre du dossier, ou un paramètre `lettre=` ?

> ⚠️ **2026-10-20, réponses (backend)**
> - **Q1 — le PV le plus récent par défaut**, et `pv=` pour en viser un autre du dossier (404 s'il n'en est pas).
> - **Q2 — la dernière lettre du dossier par défaut**, même non signée, et `lettre=` pour en viser une autre (404 si elle n'en est
>   pas).

## Côté front

À la livraison, dans « Détail » d'une ligne intégrée :
- chaque nom de fichier devient un lien de téléchargement (B1) ;
- un bloc « Aperçu sur un dossier » (n° du dossier, avis, Word / PDF dans la page) reprend celui de la fiche d'un modèle, et
  nomme le fichier qui a servi (B2).
