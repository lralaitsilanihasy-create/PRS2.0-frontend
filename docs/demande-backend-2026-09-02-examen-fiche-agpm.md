# Demande au backend `PRS20` — 2 septembre 2026 — La fiche de présentation et l'AGPM entrent dans l'examen

> Document destiné à la session backend. Émis depuis le front `frontendprs2`. **Règle du pilote,
> 02/09** : « faire entrer la fiche de présentation et l'AGPM (s'il y en a) dans l'examen de
> dossier — chacun d'eux a SA PROPRE grille de contrôle ». Backend d'abord, le front suivra
> (l'affichage en onglets du contenu du dossier, lui, est purement front).

## 0. Pourquoi c'est un petit lot

Le modèle existant porte déjà tout : `tr_points_ctrl.PORTEE` (`LIGNE`/`DOSSIER`), le rattachement
par sous-type (`idSousType` nullable = commun/spécifique), la grille effective
`GET /api/points-ctrls?sousType=`, et le stockage des résultats hors-ligne
(`t_examen_detail.idDetail = null`). Il ne manque que **deux portées de plus** et leur prise en
compte dans la garde de complétude.

## 1. Contrat attendu

1. **Portées `FICHE` et `AGPM`** ajoutées à `LIGNE`/`DOSSIER` (colonne et DTO existants ; l'écran
   admin des points de contrôle passera son menu à 4 valeurs — vérifier que la validation serveur
   accepte les deux nouvelles et refuse toujours le reste en 400).
2. **Rattachement par sous-type, PAS en commun** :
   - points `FICHE` attachés aux sous-types **`PPM` ET `PPM-AGPM`** (spécifiques — un point commun
     `idSousType = null` arroserait DMC/DDM, qui n'ont pas de fiche de présentation) ;
   - points `AGPM` attachés au seul **`PPM-AGPM`**.
   La grille effective `?sousType=` les sert alors naturellement au bon dossier, sans autre garde :
   un dossier PPM sans AGPM ne voit jamais la grille AGPM.
3. **Stockage inchangé** : un résultat sur un point `FICHE`/`AGPM` s'enregistre comme un point
   `DOSSIER` (`t_examen_detail`, `idDetail = null`, observations « AU LIEU DE / LIRE » comprises).
   Les observations suivent le circuit normal (synthèse, PV, boucle FAVR) — rien à changer si le
   chemin est bien agnostique à la portée.
4. **Garde de complétude à la soumission** : les points `FICHE`/`AGPM` comptent comme les autres —
   la soumission de l'examen reste refusée tant qu'un point de la grille effective n'est pas
   statué. Si la garde actuelle itère la grille sans regarder la portée, un test suffit ; sinon,
   l'étendre.
5. **Seed initial** (à votre main, l'Admin ajuste ensuite) — proposition :
   - `FICHE` : « Listes de la fiche cohérentes avec le plan (dérogatoires / délais aménagés /
     contrats-cadres) » ; « Justifications par marché renseignées et recevables » ;
     « Justification globale de la fiche recevable ».
   - `AGPM` : « AGPM cohérent avec le PPM (tous les marchés en appel d'offres y figurent) » ;
     « Dates du DAO = dates prévisionnelles de lancement » ; « Forme conforme au modèle officiel ».
6. Aucun changement d'URL ni de DTO attendu au-delà des nouvelles valeurs de portée.

## 2. Ce que le front livrera ensuite

1. Écran d'examen, panneau « Contenu du dossier » **en onglets**, comme le détail PPM :
   Plan de passation / Fiche de présentation / Projet d'AGPM (si le sous-type en a un) / Pièces
   jointes — les deux documents dérivés étant déjà calculés côté front (fonctions partagées).
2. Panneau « Consigner l'examen » : deux puces de plus — **« Fiche »** et **« AGPM »** — chacune
   avec sa grille (points de portée `FICHE` / `AGPM`), même mécanique RAS/Observation, même
   progression enregistrée, même verrou de soumission.

Comme toujours : **PLAN d'abord** pour validation (surtout le point 4), tests (grille effective par
sous-type avec les nouvelles portées, complétude, observations), docs (`api-endpoints`,
`regles-gestion`, **dans le repo backend**), **commit + push complet, migration/seed compris**.
