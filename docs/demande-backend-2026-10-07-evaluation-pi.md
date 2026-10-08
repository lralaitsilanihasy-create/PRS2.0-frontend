# Demande backend — 2026-10-07 — Évaluation des offres, lot 3 : les prestations intellectuelles

**Date** : 2026-10-07 · **Émetteur** : front · **Origine** : demande du pilote du 07/10 ; loi n° 2016-055, **art. 42** (prestations
intellectuelles), art. 32 (publicité), **art. 56-II** (infructuosité propre aux prestations intellectuelles) ; *Guide d'évaluation des
offres*, « Cas des prestations intellectuelles » ; lots 1 (évaluation, V76-V78) et 2 (attribution, V79-V81) livrés.

**Arbitrages du pilote du 07/10** :
- les propositions sont **remises en ligne, en deux enveloppes** scellées séparément, technique et financière ;
- la **liste restreinte** naît d'un **appel à manifestation d'intérêt mené dans l'application**, objet d'une demande à part
  (`demande-backend-2026-10-07-ami-pi.md`). Ce lot-ci part de la liste restreinte arrêtée.

**Ce que le lot produit** : pour une fiche de prestations intellectuelles, la consultation des six candidats de la liste restreinte
(art. 42-II), la remise en ligne de leurs propositions technique et financière, l'évaluation technique, puis l'ouverture des seules
propositions financières des candidats qualifiés techniquement, le classement selon la méthode de la fiche, la négociation avec le
seul retenu (art. 42-IV), le rapport, et la suite du lot 2 (dossier de marché, attribution, notification).

**Conventions** : noms **PROPOSÉS** ; le backend les fixe et corrige ce document en place (encadré ⚠️ daté).

**Le constat.**
- Aujourd'hui, une fiche de prestations intellectuelles produit des **lettres d'invitation** à partir d'une liste restreinte **saisie**
  par la PRMP (noms et adresses, `POST …/lettres-invitation`, AV-4) ; rien ne relie ces candidats à un compte, et aucune proposition
  n'est reçue dans l'application.
- La **remise en ligne** (lots 3 et 4 de la soumission en ligne) scelle **une** offre par candidat et par lot, ouverte en une séance :
  elle ne sait pas tenir deux enveloppes ouvertes à deux moments.
- La fiche porte déjà les critères de la consultation :
  - `B02-MS-01` « Mode de sélection du consultant » : *qualité technique, expérience et proposition financière* ; *budget prédéterminé* ;
    *meilleure proposition financière parmi les candidats ayant obtenu la note technique minimale* ; *qualité technique exclusivement* ;
  - `B06-TP-02` à `B06-TP-06` : les points de chaque critère technique (expérience, méthode et plan de travail, personnel clé,
    transfert de connaissances, participation de ressortissants nationaux) ; `B06-TP-07` : le **score technique minimum** ;
  - `B06-CS-02` / `B06-CS-03` : les poids des propositions technique et financière ; `B06-NG-01` : l'adresse des négociations.
- **Deux manques** au regard de l'art. 42-IV : la cinquième méthode, **la qualification du consultant**, n'est pas une option de
  `B02-MS-01` ; et aucun champ ne porte le **montant du budget prédéterminé**.

---

## B1 — La consultation restreinte en ligne

- La liste restreinte arrêtée (demande AMI) porte, pour chaque candidat, son **compte** (entreprise ou consultant) ; à défaut d'AMI en
  ligne (procédure ancienne, seuil réglementaire), la PRMP saisit la liste et chaque candidat est invité à créer son compte.
- La **demande de proposition** (art. 42-III) : les termes de référence, la lettre d'invitation (AV-4, désormais adressée aux
  comptes de la liste), le projet de marché ; elle se retire en ligne par les seuls candidats de la liste (403 aux autres).
- La procédure en ligne d'une fiche PI n'apparaît **pas** dans la liste publique : elle est visible des seuls invités.

> ⚠️ **Backend, 2026-10-08 — B1 livré (tranche PI-a, V84)** ; contrat : `docs/api-endpoints.md`, § *L'évaluation des prestations
> intellectuelles, lot 3, tranche PI-a*. Le lot est livré en quatre tranches : **PI-a** (sous-critères, méthode et budget, consultation
> restreinte), **PI-b** (§B2, §B3), **PI-c** (§B4), **PI-d** (§B5 à §B7).
> - **Lancement** : une fiche PI en remise électronique devient procédure en ligne à l'impression de ses **lettres d'invitation** (elle
>   n'a pas d'avis) ; sa date limite est `B04-LH-02` « Date et heure limites de remise des propositions ».
> - **Visibilité** : absente de `GET /api/procedures-en-ligne` ; `GET /api/procedures-en-ligne/{idDmc}` (et `…/pieces`) répond **404**
>   à qui n'est pas invité (session de candidat requise pour la voir) ; `…/documents` et le retrait d'un document répondent 403
>   **`NON_INVITE`** aux autres candidats, comme la création d'une offre.
> - **Les invités** sont écrits à chaque impression des lettres : avec une liste AMI définitive, ses candidats (leur compte) ; sinon les
>   candidats saisis, qui portent désormais une **adresse électronique** facultative (`candidats[i].email` ; 400 si elle est invalide) —
>   le compte créé avec cette adresse leur est rattaché, et l'adresse reçoit `LETTRE_INVITATION` (« créez votre compte »).
> - **Côté candidat** (nouveau) : `GET /api/candidat/invitations` → `[{ idDmc, reference, objet, autoriteContractante, rang, source (AMI |
>   SAISIE), inviteLe, etatProcedure, dateLimite, lettreDisponible }]` ; `GET /api/candidat/invitations/{idDmc}/lettre` (PDF).
> - La demande de propositions se retire par `…/documents` comme un DAO (TDR, DPIC, projet de marché, selon la fiche) ; le dépôt en
>   deux enveloppes vient en PI-b.

## B2 — Deux enveloppes scellées

- Le dépôt porte **deux conteneurs** scellés, chacun avec sa clé (cérémonie des clés de la procédure, ADR-0013) : `TECHNIQUE` et
  `FINANCIERE`. Le candidat les dépose ensemble, avant la date limite ; l'accusé porte les deux empreintes.
- **Proposition technique** : les pièces exigées (références, méthodologie, plan de travail, CV du personnel clé…), sans aucun
  montant. **Proposition financière** : le montant (HT, TTC), sa décomposition (rémunérations, frais remboursables), éventuellement
  un formulaire en ligne sur le modèle du lot 5.
- Contrôle au dépôt (front, avant le scellement, comme le rabais) : aucun montant dans l'enveloppe technique n'est contrôlable
  automatiquement ; l'écran le rappelle.
- Question **Q1** : la méthode *qualité technique exclusivement* (art. 42-III, prestations complexes) : faut-il quand même une
  enveloppe financière (ouverte pour la seule offre retenue, à la négociation), ou aucune ?

> ⚠️ **Backend, 2026-10-08 — B2 livré (tranche PI-b, V86)** ; contrat : `docs/api-endpoints.md`, § *… tranche PI-b*.
> - **Deux conteneurs ordinaires** : chaque enveloppe suit le parcours d'une offre (création, morceaux, scellement, accusé), avec son
>   propre en-tête et sa propre clé partagée ; ADR-0013 inchangé. `POST /api/candidat/offres` prend **`enveloppe`** (`TECHNIQUE` |
>   `FINANCIERE`) : obligatoire pour une consultation restreinte PI (400 `ENVELOPPE_OBLIGATOIRE`, `ENVELOPPE_INVALIDE`), refusée ailleurs
>   (400 `ENVELOPPE_HORS_PI`). Une enveloppe de chaque sorte par entreprise et par lot (409 `OFFRE_EXISTANTE`) ; `remplace` vise une
>   offre de la même enveloppe.
> - **« Ensemble »** : le serveur ne peut pas recevoir deux conteneurs d'un seul geste ; le front les dépose l'un après l'autre. Les deux
>   portent le **même numéro**, et l'accusé de la seconde porte **`jumelle`** (l'autre enveloppe : son empreinte figure ainsi sur
>   l'accusé). Une enveloppe technique sans financière à la date limite reçoit en séance l'alerte **`FINANCIERE_MANQUANTE`**.
> - **Retrait** : retirer une enveloppe retire la proposition entière (les deux).
> - `OffreDto` gagne `enveloppe` ; le registre (`…/depots`) compte les **propositions** (`nombre`) et porte `enveloppe` sur chaque ligne.
> - Le contrôle « aucun montant dans l'enveloppe technique » reste au front ; à l'ouverture, un montant trouvé n'est **pas lu** et lève
>   l'alerte **`MONTANT_DANS_TECHNIQUE`**.

## B3 — Deux séances d'ouverture

- **Première séance** (date limite) : n'ouvre que les enveloppes **techniques**, au quorum, comme le lot 4 ; le PV d'ouverture
  technique ne lit **aucun montant**. Les enveloppes financières restent scellées.
- **Seconde séance**, après l'arrêt de l'évaluation technique : n'ouvre que les enveloppes **financières** des candidats ayant atteint
  le score minimum (`B06-TP-07`) ; celles des autres ne sont **jamais ouvertes** (rendues ou détruites selon la règle de
  conservation, Q2). Les candidats qualifiés sont invités à y assister ; le PV lit les notes techniques et les montants.
- Le quorum et la cérémonie des clés sont ceux de la procédure ; la seconde séance réutilise les mêmes parts.

> ⚠️ **Backend, 2026-10-08 — B3 livré en partie (tranche PI-b)** :
> - **Première séance livrée** : elle ne connaît que les enveloppes techniques (listées dans `offres`, seules demandées aux détenteurs
>   dans `mes-parts`, seules ouvertes) ; une part apportée pour une financière est ignorée ; les financières restent `DEPOSEE`, scellées.
>   La lecture d'une technique ne sert **aucun montant** (`acteEngagement` et `rabais` nuls). Le PV n'en lit aucun et dit le nombre
>   d'enveloppes financières restées scellées.
> - **Écart de découpage : la seconde séance passe en PI-d**, avec l'évaluation financière : elle ouvre les financières des seuls candidats
>   qualifiés, donc après l'arrêt de l'évaluation technique (PI-c).
> - **« Les mêmes parts »** : ce ne sont pas les parts de la première séance qui serviront. Chaque enveloppe a sa propre clé, partagée
>   entre les détenteurs, et les parts claires vivent en mémoire seulement : les détenteurs apporteront, en seconde séance, les parts
>   des financières, déchiffrées avec **les mêmes clés** de la cérémonie.
> - Les clés publiques de la procédure (`…/cles`) suivent la visibilité de la consultation : 404 hors des invités.

> ⚠️ **Backend, 2026-10-08 — B3 complété : seconde séance livrée (tranche PI-d1, V88)** ; contrat : `docs/api-endpoints.md`,
> § *… tranche PI-d1*. Chemin `/api/fiches-marche/{idDmc}/seance/financiere` (`GET`, `POST /ouvrir`, `GET /mes-parts`,
> `POST /parts`, `POST /cloturer`, `GET /pv[?format=docx]`), même accès que la première séance.
> - **Ouverture** par le responsable, seulement après la première séance close et l'évaluation technique **arrêtée sur chaque
>   lot** (409 `SEANCE_TECHNIQUE_NON_CLOSE`, `TECHNIQUE_NON_ARRETEE` avec `details.lots`). S'ouvrent les financières des
>   `QUALIFIEE` ; en « Qualité technique exclusivement » / « Qualification du consultant », la seule du premier rang (Q1).
> - **Non ouvertes** : servies dans `nonOuvertes[{ numero, raisonSociale, lot, motif }]` et nommées au PV ; elles restent
>   `DEPOSEE`, scellées — **Q2 (rendues ou détruites) reste au juriste**, rien n'est purgé.
> - **Invitation** : notification `SEANCE_FINANCIERE` aux seuls candidats dont l'enveloppe s'ouvre ; `PARTS_ATTENDUES` aux membres.
> - **Parts** : comme en première séance (toutes en une fois, `PARTS_INCOMPLETES`, secours avec motif), mais pour les seules
>   enveloppes à ouvrir ; au quorum, tout s'ouvre et `aOuvrir[].acteEngagement` porte les montants.
> - **Écart** : le PV n'a pas de signature des membres dans cette tranche (clôture par le responsable, PDF + Word). Une fois la
>   seconde séance ouverte, la réouverture technique est refusée (409 `SEANCE_FINANCIERE_OUVERTE`).
> - L'évaluation financière et le classement (§B5 et suivants) arrivent en **PI-d2**.

## B4 — L'évaluation technique

- Une **grille par candidat** : les critères `B06-TP-02` à `-06`, chacun noté sur ses points (la note ne dépasse pas le maximum de la
  fiche) ; les sous-critères éventuels du DPIC (Q3) ; la note technique = Σ des notes.
- Chaque membre de la commission note, ou la commission note collégialement (Q4) ; la note retenue est motivée ; le président arrête
  l'étape, comme au lot 1.
- Un candidat sous le score minimum est **éliminé** techniquement, avec le motif ; sa proposition financière ne sera pas ouverte.
- Les étapes 2 (recevabilité, conformité) et le principe des précisions (art. 35-VI) du lot 1 valent ici, sur l'enveloppe technique.

> ⚠️ **Backend, 2026-10-08 — B4 livré (tranche PI-c, V87)** ; contrat : `docs/api-endpoints.md`, § *… tranche PI-c*.
> - **Socle du lot 1** : ouverture de l'évaluation par le responsable, déclarations (`POST …/evaluation/declaration`), examen
>   préliminaire de l'enveloppe technique (`PUT …/evaluation/offres/{idOffre}/conformite`, arrêt `POST …/lots/{lot}/etapes/CONFORMITE/
>   arreter`), précisions : inchangés. Les étapes suivantes du lot 1 (montant, anormales, post-qualification) ne servent pas aux PI.
> - **Nouvelle ressource** `GET /api/fiches-marche/{idDmc}/evaluation/technique` → `TechniqueDto` = `{ idDmc, scoreMinimum,
>   seuilEcartPourcent, elements[{ code, critere, libelleCritere, libelle, max }], lots[{ lot, conformiteArretee, arret{ le, par, nom,
>   observation, rouverteLe, motifReouverture }, offres[…] }] }` ; 409 `CATEGORIE_SANS_NOTATION_TECHNIQUE` hors PI.
> - **Grille** : un élément par **sous-critère** de la fiche validée (`B06-TP-03#1`, `#2`…), ou le critère entier s'il n'en a pas
>   (`B06-TP-02`) ; maximum = ses points.
> - **Q4 — chaque membre note** : `PUT …/evaluation/technique/offres/{idOffre}/notes` `{ notes[{ element, note, motif }] }`, sa propre
>   grille (une nouvelle saisie remplace la sienne) ; 0 ≤ note ≤ maximum (400 `NOTE_HORS_BAREME`), motif exigé (400
>   `MOTIF_OBLIGATOIRE`), 400 `ELEMENT_INCONNU` ; 409 `CONFORMITE_NON_ARRETEE` (avant l'arrêt de l'examen préliminaire du lot),
>   `OFFRE_ECARTEE`, `TECHNIQUE_ARRETEE`, `DECLARATION_MANQUANTE` ; 403 `MEMBRE_EN_CONFLIT`.
> - **Calcul** : par proposition, `grilles[]` (une par membre), `moyennes[{ element, moyenne, min, max, nombreNotes, ecart }]`, `total`
>   (somme des moyennes), `complete`, `statut` (`EN_COURS` · `QUALIFIEE` · `ELIMINEE`), `motifElimination`, `rang`. **`ecart`** : la note
>   la plus haute et la plus basse d'un élément s'écartent de **plus de 20 %** de son maximum (paramètre administrable
>   `EVALUATION_ECART_NOTES_POURCENT`) ; alerte seulement, la moyenne reste retenue.
> - **Arrêt** par le président : `POST …/evaluation/technique/lots/{lot}/arreter` `{ observation? }` ; 409 `NOTATION_INCOMPLETE`
>   (`details.offres` : les numéros dont une grille manque). Sous `B06-TP-07` : `ELIMINEE`, avec le motif. **Réouverture** : `POST
>   …/lots/{lot}/rouvrir` `{ motif }`.
> - Les **grilles individuelles jointes au rapport** viennent avec le rapport adapté (PI-d).

## B5 — L'évaluation financière et le classement, selon la méthode

| Méthode (`B02-MS-01`) | Classement |
|---|---|
| Qualité technique, expérience et proposition financière (qualité-coût) | Score combiné : `S = T × wT + F × wF`, avec `wT`, `wF` de la fiche (`B06-CS-02`, `-03`) et `F = 100 × Fm / Fp` (Fm : montant le plus bas des propositions ouvertes, Fp : celui de la proposition) — **formule à confirmer** sur les IC du dossier type PI (Q5) |
| Budget prédéterminé | La meilleure note technique parmi les propositions financières **dans le budget** ; une proposition au-delà est écartée. Le montant du budget : **champ à créer** (Q6) |
| Meilleure proposition financière parmi les candidats ayant la note minimale (moindre coût) | Le montant le plus bas parmi les qualifiés |
| Qualité technique exclusivement | La meilleure note technique ; la proposition financière (si elle existe) n'entre que dans la négociation |
| Qualification du consultant | La meilleure qualification ; **option à ajouter** à `B02-MS-01` (Q6) |

- Les corrections arithmétiques des propositions financières (comme au lot 1, étape 3) ; le classement ; l'égalité départagée par la
  commission avec un motif (Q5 du lot 1).
- Le serveur calcule `F`, `S` et le rang ; l'écran affiche, comme au lot 1.

> ⚠️ **Backend, 2026-10-08 — B5 livré (tranche PI-d2a, V89)** ; contrat : `docs/api-endpoints.md`, § *… tranche PI-d2a*.
> - `GET /api/fiches-marche/{idDmc}/evaluation/financiere` (`FinanciereDto`, `codeMethode`), `PUT …/financiere/offres/{idFinanciere}`
>   (saisie d'un membre), `GET …/corrections-proposees`, `POST …/financiere/lots/{lot}/departager|arreter|rouvrir`.
> - **Écart de nom** : le score financier s'appelle `scoreFinancier` (`Sf`, et non `F`) et le score combiné `scoreCombine` ; le montant
>   comparé est `montantCompare` = prix corrigé − **dépenses remboursables**, saisies par la commission (arbitrage du pilote, 08/10 :
>   l'acte d'engagement en ligne ne les distingue pas).
> - **Poids** `B06-CS-02` / `B06-CS-03` : 0,8 / 0,2 ou 80 / 20 (ramenés à 1) ; sinon `poidsTechnique` nul et 409 `POIDS_INVALIDES` à l'arrêt.
> - **Budget prédéterminé** : comparé au prix corrigé **HT** (sans déduire les remboursables) ; au-delà → `HORS_BUDGET`.
> - **Qualité technique exclusivement / qualification** : rang = rang technique ; la saisie de la financière reste ouverte après l'arrêt
>   (elle n'entre que dans la négociation) et est exigée pour conclure une négociation réussie (409 `MONTANT_NON_EVALUE`).
> - L'arrêt (président) exige toutes les financières ouvertes saisies et les égalités départagées (`EGALITE_NON_DEPARTAGEE`).

## B6 — La négociation (art. 42-IV)

- Avec le **seul** candidat classé premier ; jamais avec plusieurs à la fois (409 `NEGOCIATION_EN_COURS` sur un autre).
- Elle ne modifie de manière substantielle **ni** la mission des termes de référence, **ni** les conditions contractuelles, **ni** le
  prix : le serveur ne le contrôle pas ; un **procès-verbal de négociation** (texte, date, lieu `B06-NG-01`, pièces) est joint.
- Échec de la négociation : le candidat suivant est invité à négocier (Q7 : la loi ne le dit pas expressément ; le guide le laisse
  entendre).

> ⚠️ **Backend, 2026-10-08 — B6 livré (tranche PI-d2a, V89)** ; arbitrages du pilote du 08/10 :
> - **Conduite par la PRMP** (ou son UGPM), pas par la commission : `POST …/evaluation/negociation/lots/{lot}/ouvrir` (`{ prevueLe?,
>   lieu? }`, lieu par défaut `B06-NG-01`), `PUT …/negociation/{id}/piece` (multipart `fichier`, **une** pièce, remplacée),
>   `POST …/negociation/{id}/conclure` (`{ resultat, dateNegociation, lieu?, texte, motif? }`), `GET …/negociation`, `…/{id}/pv`.
>   Le candidat est notifié (`NEGOCIATION`) ; c'est toujours celui dont c'est le tour (`prochain`) : on ne choisit pas l'offre.
> - **Q7 (juriste)** : en attendant, l'échec **motivé** ouvre la voie au suivant ; réversible.
> - **Méthodes « premier seul »** (qualité technique exclusivement, qualification du consultant) : la financière du suivant n'est pas
>   ouverte → 409 `FINANCIERE_NON_OUVERTE` (`details.numero`) ; le responsable ouvre une **séance complémentaire**
>   (`POST …/seance/financiere/complementaire`, `{ lot?, motif }`) : même écran de séance, ronde 2, mêmes parts, PV complémentaire.
>   `SeanceFinanciereDto` gagne `ronde`, `motif`, `rondes[]` ; `GET …/pv?ronde=n`.
> - Une fois une négociation engagée, le classement ne se rouvre plus (`NEGOCIATION_ENGAGEE`).
> - **B7** (rapport, proposition d'attribution, dossier de marché, infructuosité 56-II) suit en **PI-d2b**.

## B7 — Le rapport, l'attribution, l'infructuosité

- Le **rapport d'évaluation** du lot 1, adapté : notes techniques par critère, éliminations, notes financières, scores combinés,
  classement, négociation ; signé par la commission.
- La suite est celle du **lot 2** : dossier de marché (sous-type PI à fixer par le backend), contrôle de la Commission, attribution,
  information des candidats (les motifs disent la note technique et le classement), délai d'attente, notification, avis.
- **Infructuosité propre aux PI (art. 56-II)** : aucun candidat n'a répondu à l'AMI ; aucune proposition reçue à la date limite ;
  toutes inacceptables, inappropriées, ou **aucune n'atteint la note technique minimale** ; **une seule proposition conforme**.
  Toujours après avis conforme de la commission, jamais après l'attribution (art. 56-VI).

## B8 — Consultants individuels (art. 42-V)

Sous le seuil réglementaire : comparaison des qualifications d'**au moins trois** candidats ayant manifesté leur intérêt, sur leurs
diplômes et leurs expériences. Question **Q8** : dans ce lot (une grille de qualifications, sans enveloppe financière ouverte en
séance), ou plus tard ?

## Hypothèses (à confirmer ou corriger)

- **H1** — Les lots 1 et 2 s'appliquent tels quels là où ce document ne dit rien (déclarations, motifs, journal, rapport signé,
  attribution).
- **H2** — Une procédure PI est **non allotie** dans la plupart des cas ; si elle l'est, tout se conduit lot par lot.
- **H3** — Les montants des propositions financières sont comparés **hors taxes**, comme au lot 1 (arbitrage Q3).

## Questions

| # | Question | À qui |
|---|---|---|
| Q1 | Qualité technique exclusivement : une enveloppe financière quand même (pour la négociation), ou aucune ? | pilote, juriste |
| Q2 | Les enveloppes financières des éliminés : jamais ouvertes ; restituées, ou détruites, et quand ? | juriste |
| Q3 | Des sous-critères techniques (par exemple, pour le personnel clé, par expert) : à saisir dans la fiche, ou notés globalement ? | pilote |
| Q4 | La note technique : chaque membre note puis moyenne, ou une note collégiale ? | pilote |
| Q5 | La formule du score financier et du score combiné : celle des IC du dossier type PI (le backend en a le texte) ? | backend, juriste |
| Q6 | Ajouter la méthode « qualification du consultant » à `B02-MS-01`, et un champ « montant du budget prédéterminé » ? | pilote, backend |
| Q7 | Échec de la négociation : on négocie avec le suivant ? | juriste |
| Q8 | Les consultants individuels (art. 42-V) : dans ce lot, ou plus tard ? | pilote |

> ⚠️ **Arbitrages du pilote, 2026-10-07** :
> - **Q1** — *qualité technique exclusivement* : **deux enveloppes, comme les autres méthodes** ; seule l'enveloppe financière du
>   **premier classé** s'ouvre, pour la négociation (B6) ; celles des autres ne s'ouvrent jamais (même sort que les éliminés, Q2).
>   Un seul parcours de dépôt pour toutes les méthodes.
> - **Q3** — les **sous-critères sont saisis dans la fiche** : chaque critère `B06-TP-02` à `-06` se détaille en sous-critères
>   pondérés (par exemple, un barème par expert pour le personnel clé), dont la somme fait les points du critère ; ils paraissent
>   dans la demande de propositions et la commission note sur cette grille. Forme du champ à proposer par le backend (liste
>   structurée, comme les critères de l'AMI).
> - **Q4** — **chaque membre note, puis moyenne** : chaque membre de la commission saisit sa grille ; le serveur calcule la moyenne
>   par sous-critère et par critère ; un écart important entre membres est signalé (seuil à proposer) ; le président arrête l'étape.
>   Les grilles individuelles sont jointes au rapport.
> - **Q8** — les **consultants individuels** (art. 42-V) : **plus tard, lot à part** ; le lot 3 traite les cabinets (deux
>   enveloppes).
> - Restent au juriste : Q2, Q5, Q7 ; Q6 (méthode « qualification du consultant », budget prédéterminé) au pilote et au backend.

> ⚠️ **Backend, 2026-10-08 — Q3, Q5, Q6 et le seuil de Q4** (arbitrages du pilote des 07 et 08/10, et le texte du dossier type) :
> - **Q3 livré (PI-a)** : `GET|PUT /api/fiches-marche/{idDmc}/sous-criteres`, corps `{ sousCriteres[{ critere, libelle, points }] }`
>   (l'ordre est la position ; `critere` ∈ `B06-TP-02` … `B06-TP-06`) ; 400 `sousCriteres[i].critere|libelle|points` ; 409
>   `SOUS_CRITERES_HORS_PERIMETRE` hors PI, `FICHE_VALIDEE`. Un critère sans sous-critère se note globalement. Au bilan, **bloquant
>   `SOUS_CRITERES_POINTS`** : les sous-critères d'un critère en totalisent les points. Recopiés à la révision. À l'impression,
>   **`{{SOUSCRITERES.B06-TP-03}}`** (etc.) donne « a) Approche technique et méthodologie : 10 points », une ligne par sous-critère :
>   **à placer par le front dans `DPIC-PI.txt` §9.3**, à la place des « <Indiquer nombre de points> » (le modèle est celui du front).
> - **Q6 (pilote, 08/10)** : `B02-MS-01` gagne l'option **« Qualification du consultant »** ; **aucun champ `B06-CS-04`** : le budget
>   prédéterminé est le champ **existant `B05-PF-13`**, déjà imprimé par la DPIC (condition `BUDGET-DISPONIBLE`), renommé « Budget
>   disponible (Ariary HT) » et lu hors taxes. Au bilan, **bloquant `BUDGET_DISPONIBLE_ABSENT`** quand la méthode est le budget
>   prédéterminé et que `B05-PF-13` est vide. Script `docs/referentiel/2026-10-08-pi-methode-qualification-budget.sql` (DBPRS20) ;
>   **le front aligne sa copie** `docs/referentiel-champs-fiche-dao-prestations-intellectuelles.csv` (les deux lignes `B02-MS-01`,
>   `B05-PF-13`).
> - **Q5 tranchée par le dossier type** (DPIC-PI §9.4 et §9.5) : `Sf = 100 × Fm / F`, hors dépenses remboursables (Fm : la proposition
>   la moins-disante) ; `S = T × wT + Sf × wF`, poids `B06-CS-02` et `B06-CS-03` totalisant 1. Appliquée en PI-d.
> - **Seuil d'écart de Q4 (pilote)** : un écart entre membres de **20 % du maximum** d'un sous-critère (ou du critère noté
>   globalement) est signalé ; simple alerte, la moyenne reste retenue. Appliqué en PI-c.

## Ce que le front fera, et quand

- **Dès B1-B3** : la page de la procédure restreinte côté candidat invité ; le dépôt en deux enveloppes (scellement de deux
  conteneurs) ; les deux séances (l'écran de séance du lot 4, une seconde fois pour les enveloppes financières).
- **Dès B4-B6** : la grille de notation technique, l'écran financier et le tableau des scores selon la méthode, la négociation.
- **Dès B7** : le rapport et la suite du lot 2, déjà construits.
