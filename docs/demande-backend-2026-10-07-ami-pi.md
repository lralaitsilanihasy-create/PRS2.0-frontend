# Demande backend — 2026-10-07 — L'appel à manifestation d'intérêt en ligne (prestations intellectuelles)

**Date** : 2026-10-07 · **Émetteur** : front · **Origine** : arbitrage du pilote du 07/10 : la **liste restreinte** des prestations
intellectuelles naît d'un **appel à manifestation d'intérêt (AMI) mené dans l'application** ; loi n° 2016-055, **art. 42-II** (« la
liste des candidats présélectionnés est arrêtée à la suite d'une invitation publique à soumettre des expressions d'intérêt réalisée
dans les conditions définies à l'article 32 » ; la commission d'appel d'offres « sélectionne et classe six candidats qualifiés ») et
**art. 32** (publicité). Préalable du lot 3 de l'évaluation (`demande-backend-2026-10-07-evaluation-pi.md`).

**Ce que le lot produit** : la publication de l'avis à manifestation d'intérêt, le dépôt en ligne des expressions d'intérêt par les
consultants, leur évaluation par la commission d'appel d'offres sur les critères publiés, et la **liste restreinte de six**, arrêtée,
publiée et reliée aux comptes des candidats, d'où partent les lettres d'invitation.

**Conventions** : noms **PROPOSÉS** ; le backend les fixe et corrige ce document en place (encadré ⚠️ daté).

**Le constat.** La liste restreinte est aujourd'hui **saisie** par la PRMP au moment d'imprimer les lettres d'invitation (AV-4). Rien
ne trace l'AMI : ni son avis, ni les candidatures reçues, ni la sélection.

---

## B1 — L'avis à manifestation d'intérêt

- Sur une fiche de prestations intellectuelles, avant la demande de propositions : l'**avis à manifestation d'intérêt**, produit
  depuis la fiche sur le modèle de l'avis spécifique (Word et PDF), avec l'objet, les **critères de sélection** et leur pondération,
  les pièces attendues, la date limite de dépôt des expressions d'intérêt.
- Les **critères** (art. 42-II : aptitude, références, expérience) : à saisir dans la fiche (nouvelle rubrique, à proposer par le
  backend), chacun avec son poids.
- Publication : la PRMP déclare la publication (journal ARMP, journal national, art. 32-III) ; l'avis paraît dans la liste publique des
  procédures en ligne, comme un avis spécifique.
- Sous le seuil réglementaire (art. 42-II), l'AMI est **dispensé de publicité** : la PRMP le déclare, et la liste se saisit comme
  aujourd'hui (Q1 : où est fixé ce seuil ?).

## B2 — Le dépôt des expressions d'intérêt

- Un consultant (compte entreprise ou consultant individuel, comme le candidat d'aujourd'hui) dépose son **expression d'intérêt** :
  lettre, références de missions similaires, qualifications, pièces demandées ; avant la date limite ; accusé de dépôt.
- Pas de scellement (Q2 : l'expression d'intérêt se lit dès son dépôt, ou seulement à la date limite ?).
- Le groupement est déclaré au dépôt, comme pour une offre.

## B3 — L'évaluation et la liste restreinte

- La commission d'appel d'offres (déclaration préalable, comme au lot 1) note chaque expression d'intérêt sur les critères publiés,
  avec motif ; le serveur classe.
- Elle **sélectionne et classe six candidats qualifiés** (art. 42-II) ; Q3 : moins de six candidats qualifiés — la procédure
  continue-t-elle, ou l'AMI est-il relancé ? (art. 56-II : l'absence de toute réponse rend la procédure infructueuse.)
- Un **rapport de présélection** signé par la commission, transmis à la PRMP ; Q4 : passe-t-il au contrôle de la Commission avant
  l'invitation ?
- La **liste restreinte** arrêtée est publiée (Q5 : publique, ou notifiée aux seuls candidats ?) ; chaque candidat non retenu en est
  informé, avec le motif.

## B4 — De la liste aux invitations

- Les lettres d'invitation (AV-4) prennent la liste arrêtée **avec les comptes** des candidats, au lieu d'une saisie ; chaque invité
  reçoit sa lettre en ligne et par courriel, et accède à la procédure restreinte (lot 3, §B1).

## Questions

| # | Question | À qui |
|---|---|---|
| Q1 | Le seuil de dispense de publicité de l'AMI (art. 42-II) : quel texte, quel montant, et sur quelle base ? | juriste |
| Q2 | Les expressions d'intérêt : lues dès leur dépôt, ou seulement après la date limite ? | pilote |
| Q3 | Moins de six candidats qualifiés : on poursuit avec ceux-là, ou on relance l'AMI ? | juriste |
| Q4 | Le rapport de présélection passe-t-il au contrôle de la Commission avant les invitations ? | juriste, pilote |
| Q5 | La liste restreinte : publiée, ou notifiée aux seuls candidats ? | pilote |

## Ce que le front fera, et quand

- **Dès B1-B2** : l'avis à manifestation d'intérêt sur la fiche PI ; sa page publique ; le dépôt de l'expression d'intérêt côté
  consultant.
- **Dès B3-B4** : l'écran de présélection de la commission (sur le modèle de l'évaluation), le rapport, la liste arrêtée, les lettres
  d'invitation tirées de la liste.
