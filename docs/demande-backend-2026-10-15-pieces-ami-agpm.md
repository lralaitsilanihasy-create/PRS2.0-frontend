# Demande backend — 2026-10-15 — pièces de l'AMI et publication de l'AGPM

## Contexte

Après R2, Q-pièce et Q11, le pilote a demandé (15/10) quelles pièces restent exigées d'un dossier conduit dans l'application sans que
leurs données y soient. Lecture du référentiel (`t_piece_sous_type`, base au 15/10, V117) :

- **DAOO** (et voisins) : une seule pièce, **Publication de l'AGPM (journal)** (`PUBLICATION_AGPM`, sans condition).
- **DC** : `PUBLICATION_AGPM`, `PUBLICATION_AMI` (journal de l'AMI), `TABLEAU_COUTS` (Q11, H3 en attente du pilote),
  `DECISION_LISTE` (Q9 en attente), et deux pièces de l'AMI sans condition alors que l'AMI est conduit dans l'application :
  `PV_AMI` (« PV d'ouverture et PV de validation de l'AMI ») et `RAPPORT_PRESELECTION`.

Le pilote a validé (15/10) deux propositions du front : retirer ce que l'application tient déjà pour l'AMI, et déposer la publication
de l'AGPM une seule fois, sur le plan.

## B1 — Les pièces de l'AMI d'une consultation conduite dans l'application

- `RAPPORT_PRESELECTION` : le rapport signé est déjà joint d'office au dossier de la demande de propositions (tranche AMI-b). À
  confirmer : la pièce est alors satisfaite d'office, jamais demandée à la PRMP (sinon, passer la pièce en `CONDITION = 'PAPIER'`).
- `PV_AMI` : le **PV de validation** est le rapport de présélection signé (arbitrage Q4 du 10/10 : rapport et PV de validation
  fusionnés). Le **PV d'ouverture** n'existe pas dans l'application (expressions non scellées, pas de séance). Proposition :
  l'application produit à la date limite un **relevé d'ouverture des expressions** (expressions reçues, entreprise, date de dépôt,
  empreinte, retirées et remplacées), signé par la validation tracée du président de la commission, joint d'office ; la pièce
  `PV_AMI` passe alors en `CONDITION = 'PAPIER'`.
- Une consultation dont l'AMI n'a pas été conduit dans l'application (dispense de publicité, liste restreinte saisie) garde les deux
  pièces.

## B2 — La publication de l'AGPM déposée une fois, sur le plan

La publication de l'AGPM (le journal) vaut pour tout le plan, pas pour un marché. Proposition :
- le plan de passation reçoit la pièce **Publication de l'AGPM** (scan du journal, avec le nom du journal, la date de parution et la
  référence de l'AGPM — mentions que le manuel exige visibles), déposée par la PRMP ou l'UGPM une fois le plan contrôlé, et
  remplaçable (nouvelle version : une nouvelle publication) ;
- chaque dossier conduit dans l'application dont la ligne relève de ce plan la **reprend d'office** (comme le projet d'avis) ; la
  pièce `PUBLICATION_AGPM` n'est plus demandée au dossier tant que le plan la porte ; sinon elle reste à joindre, avec un message qui
  dit qu'elle peut être déposée sur le plan.

## Hypothèses (à confirmer ou corriger)

- H1 — Le numéro et la date du journal saisis à l'impression de l'avis spécifique (`jmpDate`…) se lisent désormais depuis la pièce du
  plan (structurés à son dépôt), pour ne pas les ressaisir.
- H2 — Un plan mis à jour (nouvelle version) n'exige pas une nouvelle publication s'il ne crée pas de nouvel AGPM ; à préciser.
- H3 — `PUBLICATION_AMI` (journal de l'AMI) reste à joindre au dossier de consultation : publication extérieure.
- H4 — Les dossiers déjà soumis ne changent pas.

## Ce que le front fera

- Plan contrôlé : dépôt de la publication de l'AGPM (scan + journal, date, référence), dans la page du dossier de planification ou
  « Mes plans et leurs marchés ».
- Dossier : la pièce reprise du plan, marquée comme telle ; le relevé d'ouverture des expressions parmi les pièces jointes d'office.

> ✅ **Backend, 2026-10-15 — réponse** (V118 ; arbitrages de l'utilisateur au backend le 15/10 : relevé d'ouverture produit avec le
> rapport ; H1 « lus sur le plan, figés » ; H2 « suit la filiation ») :
>
> **B1 — livré.**
> - `RAPPORT_PRESELECTION` : confirmé, la pièce est **satisfaite d'office** (le rapport signé est joint sous ce type de pièce à la création
>   du dossier ; la soumission la trouve). Pas de changement de condition.
> - `PV_AMI` : avec le rapport, l'application joint d'office le **relevé d'ouverture des expressions** (`releve-ouverture-ami_<idDmc>.pdf` :
>   chaque expression reçue, candidat, NIF, date de dépôt, empreinte SHA-256, état déposée / retirée / remplacée), sous la pièce `PV_AMI`.
>   - ⚠️ **Écart avec la proposition** : le relevé n'est pas produit à la date limite et ne demande pas de geste du président. Il est
>     produit **avec le rapport** et validé par **ses signatures** (arbitrage du 15/10 : aucun geste ni état de plus). La pièce est
>     satisfaite d'office, sans passer en `PAPIER`.
> - Sans AMI conduit dans l'application (dispense, liste saisie), les deux pièces restent à joindre.
>
> **B2 — livré (V118).**
> - `POST /api/dossiers/{idPlan}/publication-agpm`, multipart : `fichier` (PDF), `journal`, `numero` (facultatif), `dateParution`
>   (AAAA-MM-JJ), `referenceAgpm`.
>   - Réponse 201 `PublicationAgpmDto` = `{ idPublication, idDossierPlan, journal, numero, dateParution, referenceAgpm, nomFichier, taille,
>     deposePar, deposeLe, remplaceeLe, enVigueur, heritee }`.
>   - Refus : 400 nominatif ; 403 hors PRMP propriétaire et son UGPM ; 409 `PAS_UN_PLAN`, ou `PLAN_NON_CONTROLE` avant le PV signé
>     favorable.
>   - Un nouveau dépôt **remplace** la publication en vigueur, sans rien effacer.
> - `GET /api/dossiers/{idDossier}/publication-agpm` (404 sans publication) et `…/publication-agpm/contenu` (le PDF) se lisent depuis le
>   plan **ou depuis tout dossier dont la ligne relève du plan**. `heritee: true` signale une publication venue d'une version
>   précédente du plan (H2).
> - **Reprise d'office** : à la création ou au rattachement d'un dossier par sa fiche, et **à toute soumission**, un dossier dont le
>   sous-type exige `PUBLICATION_AGPM` et qui ne la porte pas la reçoit (`PUBLICATION_AGPM_<référence>.pdf`).
>   - Cela vaut aussi pour le dossier de marché, rattaché au plan par son attribution.
>   - Sans publication sur le plan, la pièce reste à joindre. Le refus de soumission ajoute : « Elle se dépose une fois sur le plan
>     de passation contrôlé, et chaque dossier du plan la reprend d'office. »
>   - ⚠️ **Écart** : la pièce reprise est une pièce jointe ordinaire. Aucun champ ne la marque « reprise du plan » : reconnaissez-la par
>     son type (`PUBLICATION_AGPM`) et son nom de fichier.
>
> **H1 — arbitrée « figés »**, ce qui va plus loin que la proposition.
> - `POST …/avis-specifique` **ignore** `jmpNumero` et `jmpDate` du corps : ils se lisent sur la publication du plan. La trace
>   `publication` de l'avis porte en plus `journal` et `referenceAgpm`. Seule `datePublication` reste exigée.
> - Sans publication sur le plan : 409 `AVIS_INDISPONIBLE`, `details.raison` = **`PUBLICATION_AGPM_ABSENTE`**, servie aussi par
>   `…/avis-specifique/disponibilite`.
> - Les lettres d'invitation ne sont pas concernées.
>
> **H2** : la publication suit la filiation du plan. **H3** confirmée (`PUBLICATION_AMI` reste à joindre). **H4** confirmée (la reprise
> ne joue qu'à la création et à la soumission).

> ✅ **Front, 2026-10-15 — branché** :
> - **Plan** (page du dossier, onglet du plan) : encart « Publication de l'AGPM » ; la PRMP et son UGPM la déposent ou la remplacent
>   (scan PDF, journal, numéro facultatif, date de parution non future, référence de l'AGPM) ; 400 sous le champ, `PLAN_NON_CONTROLE` et
>   `PAS_UN_PLAN` nommés. Composant `shared/circuit/publication-agpm.ts`.
> - **Dossier du plan** : la publication en vigueur se lit (journal, date, référence, « déposée sur une version précédente du plan » si
>   `heritee`) et le scan s'ouvre ; muet sans publication. Dans la liste des pièces, la pièce reprise est marquée « reprise du plan » et le
>   relevé d'ouverture « AMI en ligne », reconnus à leur nom de fichier (écart accepté : pas de marque serveur).
> - **Avis spécifique** : les champs « N° » et « date du Journal des Marchés Publics » sont retirés de la modale, qui montre le journal lu
>   sur le plan ; sans publication, elle le dit et l'impression reste fermée ; la raison `PUBLICATION_AGPM_ABSENTE` est nommée. Le corps
>   n'envoie plus que `datePublication` et `supports`.
> - Recette navigateur du dépôt **à faire** : la base ne compte aucun plan contrôlé depuis la remise à zéro du 14/10.
