# Demande backend — 2026-11-01 — L'avis spécifique publié, consultable dans l'espace candidat

## Contexte

Question du pilote du 01/11, devant le calendrier d'une procédure de l'espace candidat (« Publication de l'avis : 28/10/2026 ») :

> « L'avis a été publié le 28/10/2026, qui peut voir cette publication ? » — puis : « rédiger la demande ».

Aujourd'hui l'avis spécifique imprimé (`t_document_fiche_marche`, type `AVIS`, paire .docx / .pdf) ne se lit que **dans
l'application, au périmètre de la fiche** (PRMP, UGPM, profils internes dont le périmètre couvre le dossier du plan) par
`GET /api/fiches-marche/{idDmc}/documents` et `GET /api/fiches-marche/documents/{id}/contenu`. Côté entreprises, l'avis n'existe
que par ses effets :

- il **lance** la procédure (`ProceduresEnLigneService.lire()` : sans avis imprimé, la procédure n'est pas listée) ;
- sa **date de publication**, saisie à la première impression, s'affiche dans le calendrier (`datePublication`) ;
- mais `documents()` l'**écarte expressément** (« sans l'avis ni les lettres d'invitation ») et `retirer()` le refuse
  (`DocumentsFicheMarcheService.horsDao`).

Or l'avis est **le** document public de la procédure : il est publié dans la presse et au Journal des marchés publics, et c'est
lui qui annonce la forme des prix, la garantie de soumission (montant et formes), le coût et le lieu de retrait du dossier, la visite
des lieux, la réunion préparatoire, l'ouverture des plis — autant de mentions que la carte de l'espace candidat ne reprend pas.
Une entreprise qui découvre la procédure en ligne doit pouvoir lire l'avis qui la fonde, **avant** de créer un compte ou de payer
le dossier.

Le précédent existe : le PV d'ouverture publié se lit sans compte (`GET /api/procedures-en-ligne/{idDmc}/pv`, `permitAll`, 404 hors
critères), de même que l'avis d'attribution (`…/avis-attribution/*`).

## B1 — Le PDF de l'avis spécifique publié, en accès public

`GET /api/procedures-en-ligne/{idDmc}/avis-specifique`

- **Accès** : public (`permitAll`, comme `…/pv`), aux mêmes critères que `GET /api/procedures-en-ligne/{idDmc}` (procédure
  listée ou close lue par son identifiant) ; **404** hors critères ou tant qu'aucun avis n'est imprimé — sans dire pourquoi.
- **Contenu** : le **PDF** de l'avis imprimé (type `AVIS`), `Content-Disposition` avec le nom de fichier enregistré, jamais le
  .docx ni le projet (`AVIS_PROJET`, filigrane « PROJET »).
- **Plusieurs impressions** : servir **la plus récente** (un avis réimprimé sur une version ultérieure de la fiche — rectificatif —
  remplace le précédent aux yeux du public ; arbitrage Q1).
- **Hors registre et hors frais** : la lecture de l'avis n'est **pas** un retrait du DAO — rien dans `t_retrait_dao`, pas de
  reçu exigé (`retraitPayant` ne s'applique pas).
- **Consultation restreinte** (prestations intellectuelles, lettres d'invitation) : pas d'avis, donc 404 ; les lettres
  d'invitation restent hors de cette route.

## B2 — La procédure dit si l'avis est consultable

Dans `ProcedureEnLigneDto` (liste et détail), un champ **`avisSpecifique`** :

```json
"avisSpecifique": { "imprimeLe": "2026-10-28T21:00", "version": 3, "taille": 184320 }
```

`null` quand aucun avis n'est imprimé (ou pour une consultation restreinte). Le front n'affiche le lien que si ce champ est
présent : pas d'appel à l'aveugle suivi d'un 404.

## Ce que fera le front (une fois B1-B2 livrés)

- Dans la page de détail d'une procédure (`/candidat/procedures/:idDmc`) : un bouton **« Lire l'avis spécifique »** dans le
  bloc « Calendrier », à côté de « Publication de l'avis », ouvert par `ouvrirBlobSur()` (le PDF s'ouvre dans un nouvel onglet,
  assaini) ; visible sans compte.
- Sur la carte de la liste « Procédures ouvertes » : un lien discret « Avis » sur la même condition.

## Arbitrages du pilote (01/11)

- **Q1 — Avis rectificatif : le dernier seul.** Un avis réimprimé remplace le précédent : B1 sert l'impression la plus récente,
  sans historique « avis initial / avis rectificatif ».
- **Q2 — Mentions de publication : non requises.** Le journal et le numéro du Journal des marchés publics saisis à l'impression
  (`publication.journal`, `jmpNumero`, `jmpDate`) ne sont pas ajoutés à `avisSpecifique` : B2 reste tel qu'écrit ci-dessus.
