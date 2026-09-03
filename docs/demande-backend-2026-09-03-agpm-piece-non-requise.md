# Demande au backend `PRS20` — 3 septembre 2026 — La pièce AGPM n'est plus requise

> Document destiné à la session backend. Émis depuis le front `frontendprs2`. **Règle du pilote,
> 03/09** : « pour le plan de passation ayant un mode en appel d'offres ouvert, la pièce jointe
> Avis Général de Passation de Marché n'est plus requise — on a déjà l'AGPM » : le **projet
> d'AGPM dérivé du plan** (onglet à la création/consultation, document sous les yeux du Membre à
> l'examen, avec SA grille de contrôle depuis `f361de9`) tient désormais ce rôle. Backend d'abord,
> le front suivra.

## 1. Contrat attendu

1. **Retirer l'obligation conditionnelle de la pièce AGPM à la soumission du dossier** :
   `DossierService.ajouterAgpmManquantSiRequis` (contrôle de complétude, 400 « pièce AGPM
   obligatoire… ») disparaît avec ses appels. Un PPM en appel d'offres ouvert se soumet **sans**
   pièce AGPM.
2. **La pièce AGPM devient une facultative ordinaire** du référentiel `t_type_piece_jointe`
   (elle y est déjà `obligatoire = false`) : toujours déposable, toujours contrôlée à la
   réception **si déposée** — rien d'autre à changer sur ce chemin.
3. **Le sous-type dérivé `PPM-AGPM` ne change PAS** : il continue de se recalculer sur
   `declencheAgpm` et de piloter la grille effective (points AGPM), le projet d'AGPM et les
   modèles de PV par sous-type. Seule l'obligation de la PIÈCE tombe.
4. Tests : soumission d'un PPM en appel d'offres ouvert SANS pièce AGPM → acceptée ; le reste de
   la complétude (PPM rattaché, ≥1 marché…) inchangé.

## 2. Ce que le front livrera ensuite

La pièce AGPM redevenant une simple facultative, elle suit la règle des pièces optionnelles
(jamais affichées à la création/mise à jour) :
1. Création : la ligne « Avis Général de Passation de Marché » et son badge « requise (appel
   d'offres ouvert) » quittent la liste des pièces ; la bannière « la pièce AGPM sera exigée à la
   soumission » devient un simple renvoi vers le projet d'AGPM de l'Aperçu.
2. Mise à jour : même retrait (badge + inclusion conditionnelle dans les types à déposer).
3. Détail PPM (onglet Pièces) : le bandeau « pièce AGPM requise / bien fournie » disparaît.
4. Réception : rien à changer (facultative déposée = contrôlable, non déposée = non listée).

Comme toujours : **PLAN d'abord**, tests, docs (`api-endpoints`, `regles-gestion`, **dans le repo
backend**), **commit + push complet**.
