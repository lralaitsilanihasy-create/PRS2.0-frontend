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

## B3 — Deux séances d'ouverture

- **Première séance** (date limite) : n'ouvre que les enveloppes **techniques**, au quorum, comme le lot 4 ; le PV d'ouverture
  technique ne lit **aucun montant**. Les enveloppes financières restent scellées.
- **Seconde séance**, après l'arrêt de l'évaluation technique : n'ouvre que les enveloppes **financières** des candidats ayant atteint
  le score minimum (`B06-TP-07`) ; celles des autres ne sont **jamais ouvertes** (rendues ou détruites selon la règle de
  conservation, Q2). Les candidats qualifiés sont invités à y assister ; le PV lit les notes techniques et les montants.
- Le quorum et la cérémonie des clés sont ceux de la procédure ; la seconde séance réutilise les mêmes parts.

## B4 — L'évaluation technique

- Une **grille par candidat** : les critères `B06-TP-02` à `-06`, chacun noté sur ses points (la note ne dépasse pas le maximum de la
  fiche) ; les sous-critères éventuels du DPIC (Q3) ; la note technique = Σ des notes.
- Chaque membre de la commission note, ou la commission note collégialement (Q4) ; la note retenue est motivée ; le président arrête
  l'étape, comme au lot 1.
- Un candidat sous le score minimum est **éliminé** techniquement, avec le motif ; sa proposition financière ne sera pas ouverte.
- Les étapes 2 (recevabilité, conformité) et le principe des précisions (art. 35-VI) du lot 1 valent ici, sur l'enveloppe technique.

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

## B6 — La négociation (art. 42-IV)

- Avec le **seul** candidat classé premier ; jamais avec plusieurs à la fois (409 `NEGOCIATION_EN_COURS` sur un autre).
- Elle ne modifie de manière substantielle **ni** la mission des termes de référence, **ni** les conditions contractuelles, **ni** le
  prix : le serveur ne le contrôle pas ; un **procès-verbal de négociation** (texte, date, lieu `B06-NG-01`, pièces) est joint.
- Échec de la négociation : le candidat suivant est invité à négocier (Q7 : la loi ne le dit pas expressément ; le guide le laisse
  entendre).

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

## Ce que le front fera, et quand

- **Dès B1-B3** : la page de la procédure restreinte côté candidat invité ; le dépôt en deux enveloppes (scellement de deux
  conteneurs) ; les deux séances (l'écran de séance du lot 4, une seconde fois pour les enveloppes financières).
- **Dès B4-B6** : la grille de notation technique, l'écran financier et le tableau des scores selon la méthode, la négociation.
- **Dès B7** : le rapport et la suite du lot 2, déjà construits.
