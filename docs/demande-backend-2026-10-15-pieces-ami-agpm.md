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
