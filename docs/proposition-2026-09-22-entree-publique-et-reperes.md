# Proposition — Entrée publique sur le modèle « portail » et trois repères dans les écrans internes

**Date** : 2026-09-22 · **Auteur** : frontend (`frontendprs2`) · **Statut** : PROPOSITION, recommandation **accordée
par le pilote le 22/09** (« recommandation accordée ») — à valider sur la maquette avant de coder. ⚠️ Rien de ce qui
suit n'est codé ; **aucun besoin backend** n'est identifié (tout est présentation, sur des données déjà servies).

**Origine** : capture d'e-marchespublics.com (« Accédez à l'annuaire fournisseurs ») montrée par le pilote avec la
question « est-ce qu'on peut penser à adapter cette ergonomie pour notre application ? ». **Maquette** :
`docs/maquette-2026-09-22-entree-publique.html` (deux variantes, PRMP & UGPM / Commission, jetons du design system
réel — à ouvrir dans un navigateur).

## 1. Ce que le modèle fait, et ce qu'il est

Un **portail public de communication** : barre du haut (marque, deux onglets d'audience « Entreprise / Acheteur »,
bouton « Connexion » saillant), barre secondaire sombre listant ce que l'audience peut faire ici avec un bouton
« Créer un compte » détaché, fil d'Ariane, bannière photo floutée portant un titre et une promesse, puis un titre de
section et trois cartes qui expliquent chaque brique, mots-clés en bleu.

PRS 2.0 est un **poste de travail** : dix profils connectés, barre latérale par rubriques (refonte lots 5-6 :
rail compact, hauteur garantie à 1366×768 et 1229×691, contrastes mesurés), accueil « À faire » calculé par le
serveur, page guidée par dossier. Les deux ne cherchent pas la même chose : le modèle veut convaincre et orienter
un visiteur, l'application veut faire avancer des dossiers sans rien faire chercher. On transpose donc **l'entrée**
(qui est bien un portail) et **trois repères** (qui manquent aux écrans), pas la structure.

## 2. État des lieux de l'entrée publique (vrai au 22/09)

| Écran | Aujourd'hui | Limite |
|---|---|---|
| `/login` | carte centrée : décor abstrait à gauche, « Procurement Review System — Anytime, Anywhere, Anydevice », formulaire à droite | ne dit **ni ce que fait l'application, ni pour qui** ; un visiteur PRMP ne sait pas qu'il peut s'inscrire ni ce qu'il trouvera |
| `/inscription` | formulaire public d'inscription PRMP (identité, pièces, entités), validé par l'Admin | atteint par un lien discret depuis la connexion |
| tout le reste | derrière la session (cookie `PRS_SESSION`) | — |

## 3. Proposition A — l'entrée publique (maquette, variantes PRMP / Commission)

1. **Barre du haut** : marque « MEF · PRS 2.0 · Commission nationale des marchés », **deux onglets d'audience**
   « PRMP & UGPM » / « Commission » (le modèle : Entreprise / Acheteur), bouton **Connexion** en bleu primaire.
   L'onglet retenu est mémorisé dans l'URL (`/accueil/prmp`, `/accueil/commission`), pas en `localStorage`.
2. **Barre secondaire** (fond du dégradé de la barre latérale) : ce que l'audience peut faire — PRMP : « Déposer un
   plan », « Suivre le contrôle », « Consulter les PV définitifs », « Nous contacter », et le bouton détaché
   **« Créer un compte PRMP »** (→ `/inscription`, bordure or) ; Commission : « Mon travail du jour », « Le circuit »,
   « Délais », « Assistance », **sans** « Créer un compte » (les comptes sont créés par l'Administrateur).
3. **Bannière** : titre + promesse en une phrase, **fond en dégradé** (pas de photo : poids, droits, et lisibilité du
   texte), boutons « Se connecter » / « Créer un compte PRMP », trois repères chiffrés (étapes chronométrées, délai
   standard du visa, PV consultables) — chiffres à confirmer par le pilote.
4. **Section** : un titre de section et **trois cartes** (Déposer · Suivre · Consulter côté PRMP ; Recevoir et
   dispatcher · Examiner et viser · Vérifier et clore côté Commission), **mots-clés en bleu = liens** vers la page
   d'aide ou l'écran concerné.
5. **Pied** : ministère, mentions légales, accessibilité, contact.
6. La **connexion elle-même** reste la carte actuelle, atteinte par « Se connecter » ; le formulaire ne change pas
   (cookie HttpOnly, aucun jeton). L'entrée publique devient la route racine hors session ; un utilisateur
   authentifié qui y arrive est renvoyé à son « À faire ».

**Contraintes gardées** : jetons de couleur et polices du design system, or `#f5c542` des rubriques pour les accents,
contrastes AA mesurés (`scripts/contrastes-coquille.mjs` étendu aux nouvelles paires), texte alternatif et ordre de
lecture (onglets = `nav` + `aria-current`), tout responsive à 360 px.

## 4. Proposition B — trois repères dans les écrans internes (tous profils)

| Repère | Aujourd'hui | Proposé | Coût |
|---|---|---|---|
| **Phrase de rôle** en tête des hubs | présente sur « Examen de dossiers » (`.re__intro`), absente ou inégale ailleurs (accueil Admin, hubs Membre/PRMP, « Intérim » l'a) | un paragraphe d'une phrase sous chaque `page-title` : à quoi sert l'écran, pour qui | 1 ligne par écran, ~12 écrans |
| **Fil d'Ariane** sous la barre du haut | seulement sur la page du dossier (`.pd-ariane` : retour › titre) | un composant partagé `app-fil-ariane` alimenté par `data.title` des routes et l'espace du profil (« À faire › Répartition de dispatch ») ; la page du dossier garde le sien (retour vers l'écran d'origine) | 1 composant + `data.title` déjà posé sur la plupart des routes |
| **Mots-clés mis en valeur** | textes d'aide des cartes en gris uniforme | les termes qui désignent un écran ou une notion deviennent des **liens** (bleu, gras), jamais du gras décoratif | dans les hubs et l'accueil Admin |

Ce qu'on **n'adapte pas** : bannière photo dans les écrans de travail (400 px perdus à 1366×768), navigation
horizontale à la place de la barre latérale (acquis des lots 5-6), magenta hors palette.

## 5. Lotissement

- **Lot A1** — page publique `/accueil/:audience` (composant standalone hors coquille, deux variantes, contenu dans
  un fichier de libellés unique), redirections `/` → `/accueil/prmp` hors session ; `/login` et `/inscription`
  inchangés. Tests : rendu des deux variantes, redirection d'un connecté, contrastes, Playwright 360 px et 1366 px.
- **Lot A2** — chiffres de la bannière servis par le serveur si le pilote les veut vivants (nombre de PV signés,
  délai standard) — **seul point qui demanderait un endpoint** ; sinon libellés fixes.
- **Lot B** — phrase de rôle (12 écrans), `app-fil-ariane` (coquille), mots-clés en liens (hubs). Indépendant de A.

## 6. Arbitrages demandés au pilote (recommandation en gras)

| # | Question | Reco |
|---|---|---|
| Q1 | La page publique remplace-t-elle `/login` comme première page, ou s'ajoute-t-elle à côté ? | **S'ajoute** : `/` hors session mène à l'accueil public, « Connexion » ouvre la carte actuelle inchangée |
| Q2 | Les trois chiffres de la bannière : fixes (libellés) ou vivants (serveur) ? | **Fixes** au lot A1 ; vivants au lot A2 si utile |
| Q3 | Onglet Commission : faut-il un contenu spécifique, ou renvoyer simplement vers la connexion ? | **Contenu spécifique court** (trois cartes du circuit) : c'est aussi la page qu'on montre à un nouvel agent |
| Q4 | Fil d'Ariane : sur tous les écrans, ou seulement hors des écrans en mode concentration (examen, vérification, page dossier) ? | **Partout sauf en concentration**, où la barre est déjà réduite à l'essentiel |
