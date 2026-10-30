# Plan de transformation de l'architecture de PRS 2.0 — du backend rangé par couches au monolithe modulaire

Rédigé le 30/10/2026 à partir de l'analyse du code du backend PRS20, de la mesure de performance du même jour et des présentations
`PDF_generes/domaines-et-modules-prs20-2026-10-30-v2.pptx`, `fonctionnement-architecture-cible-prs20-2026-10-30-v2.pptx` et
`maquette-architecture-cible-prs20-2026-10-30.pptx`. Le backend est modifié par des demandes au backend ; ce plan les ordonne.

## 1. Objectif et limites

**Objectif** : passer d'un backend rangé par couches techniques (`controller/`, `service/`, `repository/`, `entity/`) à un **monolithe
modulaire** de 15 modules métier. Chaque module est le seul à écrire ses tables, parle aux autres par son interface (commandes,
consultations en lot, événements), et ses frontières sont vérifiées par un test dans l'intégration continue.

**Ce qui ne change pas** : un seul JAR, une seule base PostgreSQL, les migrations Flyway, les adresses `/api` et leurs réponses, la
session par cookie. Le front et les utilisateurs ne voient rien, sauf des listes plus rapides.

**Point de départ mesuré** :

| Indicateur | Valeur le 30/10/2026 | Cible |
|---|---|---|
| Accès d'une classe au dépôt d'un autre domaine | 286 | ≈ 0 (les restants listés et tolérés) |
| … dont écritures | 53 | 0 |
| Paires de domaines dépendantes dans les deux sens | 21 | 0 |
| Appels directs à `NotificationService` | 85, dans 37 classes | 0 hors du module communication |
| Événements publiés | 2 (PV signé, lettre de renvoi signée) | un par fait qui intéresse un autre module |
| Requêtes SQL de tout le parcours de mesure | 11 812, puis 4 841 après V153 | non-régression à chaque étape |
| Tests du backend | 1 755 | tous verts à chaque étape |

## 2. Principes de conduite

1. **Aucun changement de comportement.** Chaque étape garde les mêmes adresses, les mêmes réponses et les mêmes règles métier.
2. **Des étapes courtes et livrables seules.** Une étape interrompue ne laisse pas l'application dans un état intermédiaire.
3. **Mesurer avant, pendant, après.** Le test d'architecture compte les entorses ; la mesure de performance du 30/10 est rejouée.
4. **Un module à la fois** pour les étapes 3 à 5, en commençant par les écritures croisées les plus graves.
5. **Le canal reste la demande au backend** : une demande par phase (`docs/demande-backend-AAAA-MM-JJ-modules-phase-N.md`), corrigée
   en place à la livraison, comme aujourd'hui.

## 3. Décisions à prendre avant de commencer

| N° | Décision | Proposition | Qui |
|---|---|---|---|
| D1 | Le découpage en 15 modules, dont le module **dossier** nouveau | adopter l'annexe A comme référence, ajustable | pilote |
| D2 | L'**AMI** : module à part ou dans la passation | module à part (remplit les 5 critères d'un module) | pilote |
| D3 | L'outil de vérification : **Spring Modulith** (dépendance Maven) | Spring Modulith (vérification, documentation, registre des événements) | pilote, puis backend |
| D4 | Une **fenêtre de gel** de 1 à 2 jours pour l'étape 2 | entre deux lots fonctionnels | pilote |
| D5 | Le **rythme** : chantier prioritaire ou en parallèle des lots fonctionnels | en parallèle, avec un créneau réservé par semaine | pilote |
| D6 | Une seule instance du serveur en production (Q1 de la demande « performance ») | à confirmer : conditionne les caches | pilote |

## 4. Les phases

### Phase 0 — Préparer (1 à 2 jours)

- Valider l'**annexe A** (table de correspondance des 820 classes vers leur module) et l'annexe B (les 53 écritures croisées).
- Figer le point de départ : mesure de performance (faite le 30/10, rejouée après V153), compte des entorses.
- Rédiger la demande au backend de la phase 1.

**Sortie** : décisions D1 à D6 prises ; annexes validées.

### Phase 1 — Mesurer (1 à 2 jours)

- Ajouter Spring Modulith (dépendances de test et de documentation).
- Un test d'architecture **en mode relevé** : il liste les entorses dans un fichier de référence et **n'échoue que sur une entorse
  nouvelle**. Les entorses existantes sont tolérées et décomptées à chaque livraison.
- Générer la documentation des modules (schéma, fiche par module).

**Sortie** : le test tourne dans l'intégration continue ; le nombre d'entorses est publié à chaque livraison. Aucune entorse nouvelle
ne peut entrer.

### Phase 2 — Ranger (3 à 5 jours, dont 1 à 2 jours de gel)

- Créer les 15 paquets `cnm.prs.<module>`, chacun avec son interface publique et son intérieur, et sa déclaration des modules dont
  il a le droit de dépendre.
- **Déplacer** les classes selon l'annexe A, sans les modifier (outil de refactorisation de l'IDE). Les contrôleurs gardent leurs
  adresses.
- **Replacer** les trois entités mal rangées : `Anomalie`, `AnomalieLigne` et `RegleAnomalie` vers planification, `SeanceFinanciere`
  vers passation, `ActeGestion` vers execution. Cela supprime 6 écritures croisées.
- Rien ne change en base.

**Sortie** : 1 755 tests verts ; recette des écrans par le front (parcours Playwright des 8 profils) ; mesure de performance
identique. Les entorses sont désormais visibles module par module.

### Phase 3 — Supprimer les écritures croisées (12 à 16 jours)

Dans cet ordre, du plus simple au plus risqué :

| Étape | Données | Écritures supprimées | Ce qui change |
|---|---|---|---|
| 3a | Comptes de connexion (`CompteAuth`, `Compte`, sessions) | 9 | une commande `identite` : créer, activer, désactiver un compte ; les 7 classes qui écrivent la table l'appellent |
| 3b | Pièces du dossier (`PieceJointeDossier`) | 6 | une commande `dossier` : joindre, remplacer, retirer une pièce |
| 3c | PRMP, UGPM, entités, bénéficiaires | 10 | des commandes `organisation`, appelées par l'inscription, la connexion et la saisie du plan |
| 3d | **Le nœud dossier ↔ plan** | 14 | le contrôle ne modifie plus le plan ; la planification ne modifie plus l'enveloppe du dossier |

**Ce qui réduit le risque de 3d** : les relations entre le plan et le dossier sont déjà en lecture seule. Toutes les relations de
`Ppm`, `Marche`, `Lot`, `Tranche` et `Echeance` sont déclarées `insertable = false, updatable = false`, à côté d'une colonne qui porte
déjà l'identifiant. Les remplacer par l'identifiant ne retire que de la navigation, pas d'écriture.

**Sortie** : des 47 écritures croisées restantes après la phase 2, les 39 visées ici sont tombées à 0 (le test le vérifie) ; les 8
autres (journal de l'évaluation, instantanés de rectification, échéances) partent en phase 4. Recette des circuits PPM, DAO et marché
de bout en bout.

### Phase 4 — Passer aux événements (5 à 8 jours)

- La **décision du circuit** (PV signé, rectification) est publiée par le contrôle ; la planification l'applique à ses tables, dans la
  même transaction (écoute avant validation). Cela supprime les instantanés de rectification écrits par le contrôle.
- Les **85 appels de notification** (37 classes) deviennent des événements écoutés par le module communication, après validation.
- Les événements écoutés après validation sont notés dans le **registre des événements** (une table, créée par une migration Flyway) ;
  un écouteur en échec est rejoué.
- La génération du PV et de la lettre de renvoi, déjà déclenchée par un événement, rejoint le module documents.

**Sortie** : plus aucune écriture croisée (les 8 dernières sont tombées) ; plus aucun appel à `NotificationService` hors du module
communication ; le contrôle ne dépend plus de l'intérieur de la planification ; le registre est visible par l'exploitation.

### Phase 5 — Remplacer les lectures directes (15 à 25 jours, progressif)

- Remplacer les **≈ 233 lectures** directes par des **consultations en lot**, en commençant par les données les plus lues :
  `Dossier` (29 classes), `Prmp` (21), `Marche` (19), le dossier de mise en concurrence (18), les comptes candidats (17).
- Mener ensemble le **second chantier de performance** (≈ 11 lectures par procédure restantes après V153) : chaque consultation reçoit
  une liste d'identifiants et répond en une requête.
- Mettre en cache, dans leur module, les référentiels encore relus : processus `t_capm`, profils, champs de la fiche.

**Sortie** : le fichier des entorses tolérées est vide, ou ne contient que des exceptions écrites et justifiées ; la mesure de
performance montre un nombre de requêtes indépendant du volume sur les listes de procédures.

### Phase 6 — Consolider (2 à 3 jours)

- Le test d'architecture passe en **mode bloquant** : toute entorse fait échouer la livraison.
- Publier la documentation générée et le **registre des modules** (tables, interface, événements de chacun).
- Écrire les décisions d'architecture (ADR) du découpage.
- Présenter le fonctionnement à l'équipe (présentation « fonctionnement de l'architecture cible »).

**Sortie** : la cible est atteinte et protégée.

## 5. Calendrier

Durées en jours de travail, recette et mesure comprises (+ 20 à 30 %).

| Phase | Effort | Si le chantier est prioritaire | En parallèle des lots fonctionnels |
|---|---|---|---|
| 0 — Préparer | 1-2 j | semaine 1 | semaine 1 |
| 1 — Mesurer | 1-2 j | semaine 1 | semaine 2 |
| 2 — Ranger | 3-5 j | semaines 2 | semaines 3-4 |
| 3 — Écritures croisées | 12-16 j | semaines 3-6 | semaines 5-11 |
| 4 — Événements | 5-8 j | semaines 7-8 | semaines 12-15 |
| 5 — Lectures | 15-25 j | semaines 9-13 | semaines 16-24 |
| 6 — Consolider | 2-3 j | semaine 14 | semaine 25 |
| **Total** | **≈ 45-70 j** | **≈ 3 à 3,5 mois** | **≈ 5 à 6 mois** |

**Jalons** :

- **Fin de semaine 2** (ou 4) : frontières visibles et mesurées ; aucune entorse nouvelle ne peut entrer.
- **Fin de la phase 3** : plus aucun domaine n'écrit dans les données d'un autre — le gain principal en sûreté.
- **Fin de la phase 4** : le contrôle et le plan sont découplés ; les notifications ne se perdent plus en silence.
- **Fin de la phase 6** : la cible est protégée par un test bloquant.

La phase 5 peut s'arrêter avant son terme : les lectures restantes sont alors listées et tolérées, et seules celles qui coûtent en
performance sont traitées.

## 6. Organisation

| Rôle | Qui | Ce qu'il fait |
|---|---|---|
| Décisions | le pilote | D1 à D6 ; validation de chaque phase ; fenêtre de gel |
| Réalisation | la session du backend (PRS20) | une demande par phase ; livraison avec encadré daté dans la demande |
| Vérification | la session du front | recette des écrans des 8 profils (Playwright), mesure de performance rejouée, mise à jour des annexes |
| Recette fonctionnelle | le pilote | parcours de bout en bout à la fin des phases 2, 3 et 4 |

**Critère de passage d'une phase à la suivante** : tests du backend et du front verts, recette des écrans sans écart, mesure de
performance sans régression, compte des entorses en baisse conforme à la phase.

## 7. Risques et parades

| Risque | Effet | Parade |
|---|---|---|
| Les lots fonctionnels avancent pendant le déplacement des classes (phase 2) | conflits de fusion massifs | gel de 1 à 2 jours ; déplacement fait d'un seul tenant |
| Le nœud dossier ↔ plan (phase 3d) touche les écrans les plus anciens et les plus utilisés | régression du circuit PPM | relations déjà en lecture seule ; recette complète du circuit PPM avant et après |
| Une interface de consultation lit ligne à ligne | régression de performance | règle « toujours en lot » ; mesure rejouée à chaque phase |
| Un événement écouté avant validation échoue | la décision du circuit est annulée | réservé aux réactions qui doivent être cohérentes ; les autres après validation, avec registre |
| Plusieurs instances du serveur en production (D6) | caches incohérents | décision D6 avant la phase 5 ; à défaut, durée de vie courte des caches |
| Le chantier s'étire en parallèle des lots fonctionnels | perte de l'élan après la phase 2 | créneau réservé chaque semaine ; jalon de fin de phase 3 daté |

## 8. Indicateurs de suivi

Publiés à chaque livraison, dans l'encadré de la demande de la phase :

- entorses relevées par le test d'architecture (286 au départ) et écritures croisées (53) ;
- paires de modules dépendantes dans les deux sens (21) ;
- appels à `NotificationService` hors du module communication (85) ;
- requêtes SQL du parcours de mesure et des trois listes de procédures (4 841 après V153) ;
- tests du backend et du front (1 755 et 1 485 le 30/10).

## Annexes

- **Annexe A** — `docs/plan-transformation-annexe-a-correspondance.csv` : les 820 classes du backend (entités, dépôts, services,
  contrôleurs, planificateurs), leur domaine mesuré et leur module cible. Les cas à trancher sont marqués dans la colonne « remarque »
  (module dossier, entités replacées, AMI).
- **Annexe B** — `docs/plan-transformation-annexe-b-ecritures-croisees.csv` : les 53 écritures croisées, la classe qui écrit, le dépôt
  écrit et la phase qui les supprime (2 : 6, 3a : 9, 3b : 6, 3c : 10, 3d : 14, 4 : 8).

Les deux annexes sont produites par un script à partir du code de PRS20 ; elles se régénèrent à chaque phase pour suivre l'avancement.
