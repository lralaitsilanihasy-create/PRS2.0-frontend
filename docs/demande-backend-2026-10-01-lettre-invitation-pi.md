# Demande backend — Lettres d'invitation des prestations intellectuelles (01/10/2026, lot AV-4)

> Plan : `docs/plan-2026-10-01-lettre-invitation-pi.md`, accepté par le pilote le 01/10 (Q1 à Q5 selon les
> recommandations). C'est le pendant de l'avis spécifique (`demande-backend-2026-09-30-avis-specifique.md`) pour les
> prestations intellectuelles. Leur procédure n'a pas d'avis public : les candidats de la **liste restreinte** reçoivent
> chacun une **lettre d'invitation**.

## B1 — Recopier le modèle `LETTRE-PI`

- `scripts/modeles-dao/modeles/LETTRE-PI.{txt,json}`, tiré de la source `pi-ic` (`extraire.mjs`) : « 1.1. LETTRE D'INVITATION » du
  volume 1 du dossier type PI.
- Décalque vérifié dans les deux sens : `docs/modeles-dao/LETTRE-PI.docx` (**43/43**).
- Comme l'avis, le modèle est **hors des couvertures** : il ne se produit pas à la validation et l'import ne le lit pas.
- Catégorie `PRESTATIONS_INTELLECTUELLES`, formes `QUANTITE_FIXE` et `A_COMMANDE`.
- En-tête commun avec l'avis : `{{IMAGE:embleme}}`, autorité, PRMP, UGPM, puis le titre « LETTRE D’INVITATION »
  (ligne `TITRE` dans le corps, pas de `TITRE` en tête, comme l'avis).
- Le mode de sélection reprend les quatre rédactions du document type, sous les conditions du DPIC sur `B02-MS-01`
  (`SFQC`, `BUDGET`, `MOINDRE-COUT`, `QUALITE-SEULE`).
- Les paragraphes portent déjà leur numéro (« 1. » à « 5. ») dans le texte officiel : pas de `{{NUM}}`.

> ⚠️ **Livraison backend du 2026-10-01 (§B1).** Modèle recopié tel quel ; le comparateur donne **43/43** sur le rendu
> brut du serveur. Il est hors des couvertures (`ModelesDao.LETTRES`, `sigleLettre`) : ni produit à la validation, ni lu
> à l'import.
> **Un écart sur les formes :** la lettre est servie à **toute** fiche de prestations intellectuelles, contrat-cadre
> compris, et non aux seules quantité fixe et à commande. Le modèle n'a pas de texte propre à une forme, et une procédure de prestations
> intellectuelles passe toujours par une liste restreinte. Si vous voulez la limiter aux deux formes, dites-le : ce
> serait une raison de plus (`FORME_SANS_LETTRE`).

## B2 — Jetons `{{LETTRE.*}}` : saisis à l'impression, jamais écrits dans la fiche

| Jeton | Contenu | Rendu |
|---|---|---|
| `{{LETTRE.lieu}}` | lieu d'envoi | tel quel |
| `{{LETTRE.date}}` | date d'envoi | JJ/MM/AAAA |
| `{{LETTRE.destinataire}}` | le candidat de **cette** lettre | son nom, puis son adresse à la ligne |
| `{{LETTRE.candidats}}` | la liste restreinte entière | un candidat par ligne, « - Nom », dans l'ordre saisi |

> ⚠️ **Livraison backend du 2026-10-01 (§B2).** Conforme. Les quatre jetons sont rendus par l'appelant, jamais lus dans la
> fiche. `{{LETTRE.destinataire}}` : le nom, puis l'adresse **une ligne par ligne saisie** (`\n` dans `adresse`, lignes
> vides retirées).

## B3 — Produire les lettres à la demande

`POST /api/fiches-marche/{idDmc}/lettres-invitation`, corps :

```json
{ "dateEnvoi": "2026-10-05", "lieu": "Antananarivo",
  "candidats": [ { "nom": "Cabinet A", "adresse": "Lot II A 12, Antananarivo" }, { "nom": "Bureau B", "adresse": "…" } ] }
```

- **Accès** : comme l'avis (PRMP et UGPM du périmètre, mandat actif exigé pour imprimer ; 403 aux autres).
- **400 nominatif** : `dateEnvoi`, `lieu`, `candidats` (au moins un, décision Q4 : pas de nombre imposé),
  `candidats[i].nom`, `candidats[i].adresse`.
- **Garde** : la même que l'avis, PV signé FAV ou FAVR après la levée des réserves. 409 `LETTRE_INDISPONIBLE` avec
  `details.raison`, mêmes raisons que l'avis, plus `CATEGORIE_SANS_LETTRE` pour les fournitures et les travaux.
- **Rendu** : sur la dernière version **validée**, **une lettre par candidat** (Q1), en .docx et en PDF. Chaque lettre a
  son destinataire, et toutes ont la même liste. Le type de document est `LETTRE_INVITATION`. Le nom du fichier porte
  l'horodatage **et le rang du candidat** (`LETTRE_<plan>_<ligne>_v2_20261005-143000_01.pdf`). Réponse 201 avec tous
  les `DocumentFiche` produits.
- **Trace** : la saisie (`dateEnvoi`, `lieu`, `candidats`) est gardée avec chaque document, dans `publication` comme
  pour l'avis, pour que l'écran la reprenne à la réimpression.
- **Journal** : `LETTRES_INVITATION_IMPRIMEES` sur le dossier DAO, avec le nombre de candidats.

> ⚠️ **Livraison backend du 2026-10-01 (§B3).** Conforme, avec quatre précisions :
> - **400** : les indices de `candidats[i]` partent de **0** (`candidats[1].nom` désigne le deuxième candidat). Le message
>   dit le rang humain (« Le nom du candidat n° 2 est obligatoire. »).
> - **Trace** : `publication` porte `{ dateEnvoi, lieu, candidats: [{nom, adresse}], rang }`. `rang` (1, 2…) dit à
>   quel candidat la paire est adressée, pour que l'écran l'affiche sans relire le nom du fichier.
>   `DocumentFicheDto.publication` porte donc maintenant des valeurs qui ne sont pas toutes du texte ; celles de l'avis
>   restent du texte.
> - **Bloc de signature** gardé ensemble, comme l'avis (« Veuillez agréer… », la qualité, le nom).
> - **Migration V57** : la colonne `TYPE` des documents passe de 10 à 20 caractères (`LETTRE_INVITATION` en compte 17).

## B4 — Disponibilité

`GET /api/fiches-marche/{idDmc}/lettres-invitation/disponibilite`, **même forme** que celle de l'avis
(`disponible`, `raison`, `idAvis`, `statutPv`, `statutDossier`, `idDossierSoumis`). `CATEGORIE_SANS_LETTRE` hors PI.
Les lettres produites apparaissent dans `GET /{idDmc}/documents` (type `LETTRE_INVITATION`), du plus récent au plus
ancien, comme les avis.

> ⚠️ **Livraison backend du 2026-10-01 (§B4).** Conforme. Les lettres sont listées avec les avis, du plus récent au plus
> ancien. Ni l'avis ni les lettres ne sont joints au dossier.

## B5 — Statut « Lancé » (décision Q5)

La **première** impression des lettres fait passer la ligne et sa filiation de `PREVU` à `LANCE`, exactement comme la
première impression de l'avis (`demande-backend-2026-09-30-statut-lance-avis.md` §B2) : statut manuel conservé,
journal `LIGNE_LANCEE`. `MarcheDto.avisImprimeLe` vaut alors la date de cette première impression : le nom reste, il
désigne « la publication ». Dites dans votre encadré si vous préférez un champ distinct.

> ⚠️ **Livraison backend du 2026-10-01 (§B5).** Conforme. La règle porte sur la **première publication** de la filiation,
> avis ou lettres. **`avisImprimeLe` est gardé tel quel**, sans champ distinct, comme vous le proposiez. Journal
> `LIGNE_LANCEE` : « Ligne 9901 : 2 lettre(s) d'invitation imprimée(s) (envoi du 05/10/2026), statut PREVU → LANCE ».

## B6 — Tests

- Rendu ≡ modèle (43), avec chacune des quatre rédactions du mode de sélection.
- Garde : les raisons, dont `CATEGORIE_SANS_LETTRE`.
- 400 nominatifs, dont une liste vide.
- Deux candidats : deux paires de documents, chacune avec son destinataire et la même liste.
- Première impression : `PREVU → LANCE` ; réimpression sans effet.

> ⚠️ **Livraison backend du 2026-10-01 (§B6).** Tests :
> - `ModelesLettreTest` : le registre, puis chacune des quatre rédactions du mode de sélection, seule imprimée (emblème
>   en premier, destinataire sur plusieurs lignes, liste « - Nom », signature gardée ensemble).
> - `LettreInvitationIntegrationTest` :
>   - la garde, dont `CATEGORIE_SANS_LETTRE`, et le 403 de l'Administrateur et du Membre ;
>   - les 400 nominatifs, dont une liste vide et un candidat incomplet ;
>   - deux candidats : deux paires, chacune avec son destinataire et la même liste, la trace et le journal ; jamais
>     jointes au dossier ;
>   - la première impression `PREVU → LANCE`, et une réimpression sans effet.

## Ce que le backend rend

Commit(s) qui referment B1 à B6, les tests, et un encadré ⚠️ daté ici pour tout écart. Côté front ensuite (lot
AV-4.3) : l'encadré « Lettres d'invitation » à la place de l'avis pour une fiche PI, la modale de la liste restreinte,
et la liste des lettres.

> ⚠️ **Réponse du front du 2026-10-01 (lot AV-4.3 fait).**
> - **Formes** : d'accord pour servir la lettre à toute fiche de prestations intellectuelles, contrat-cadre compris. Pas
>   de `FORME_SANS_LETTRE`.
> - **Écran** :
>   - composant `shared/prmp/lettres-invitation`, posé à l'étape 7 de la fiche DAO à la place de l'avis pour une fiche
>     PI, et dans l'encart « Fiche DAO » de la page du dossier (PRMP, UGPM) ;
>   - modale : date d'envoi, lieu, et la liste restreinte (nom, adresse sur plusieurs lignes ; ajouter, retirer, au
>     moins un) ; la liste de la dernière impression est reprise ;
>   - les 400 `candidats[i].…` s'affichent sous le champ du candidat i + 1 ;
>   - la liste des lettres est groupée par impression, puis par candidat (`publication.rang`) ;
>   - les lettres sont écartées des pièces de l'étape 7.
>
>   948 tests verts, lint et build.
> - **Contre-recette à l'écran : impossible pour l'instant.** Le plan 00004 n'a aucune ligne de prestations
>   intellectuelles (72 travaux, 8 fournitures) : elle se fera sur le premier plan qui en porte une.
