# Demande backend — Accueil « À faire » : les gestes attendus du connecté, calculés par le serveur

**Date** : 2026-09-14 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : refonte ergonomique, maquette validée par Mathieu et ses chefs (`maquettes-design/src/Main.tpl.html`, `data.js`). Chaque profil arrive sur « À faire » : des sections par geste, triées par urgence, une action principale par ligne et un délai en heures ouvrées.

> **Statut : arbitrages en attente** (voir fin de document). Les parties B1 à B3 du découpage ne dépendent pas de ces arbitrages ; B4 (l'endpoint) les attend.

## Constat

Il n'existe aucune boîte de tâches. « Tous les dossiers » calcule ses boutons dans le navigateur (`dossiers-pipeline.ts`, `peutReceptionnerDash`…) à partir du statut et de `permissions.can()`, en croisant des listes qui reviennent vides selon la portée. Le visa, la signature, les retraits et l'archivage n'y figurent pas.

Les règles qui disent *qui* agit sont côté serveur, et souvent nominatives :
- le visa revient au dispatcheur, à un intérimaire, ou au Président à l'étage PRESIDENT d'une navette à deux niveaux ;
- l'examen et la soumission reviennent à l'attributaire ;
- la signature revient au désigné ;
- le pré-dispatch d'un dossier central est réservé au Président ;
- l'archivage est lié à la localité de l'Assistant.

Le front ne peut pas recopier ces règles sans diverger. `GET /api/kpis/badges` compte des volumes de files, pas des gestes personnels : le CC central y voit par exemple des « prêts à dispatcher » qu'il recevrait en 403.

## Demande

### 1. Route

`GET /api/dossiers/a-faire?delegations=false` → `AFaireDto` (200, 401, 403).

- Profils autorisés : `hasAnyRole('PRESIDENT','CHEF_COMMISSION','SECRETAIRE','MEMBRE','VERIFICATEUR','ASSISTANT_CONTROLEUR','PRMP','UGPM')`.
- Administrateur et Chargé de publication : 403 (ils gardent leur accueil actuel).
- Calcul en lecture seule, à la volée, sans table ni migration.
- `delegations=true` renvoie les lignes du bloc délégation ; par défaut, seuls leurs totaux sont servis.

### 2. DTO — exemple pour le Président, lundi 14/09/2026 à 15:00

```json
{
  "profil": "PRESIDENT",
  "genereLe": "2026-09-14T15:00:00",
  "compteurs": { "aFaire": 5, "enRetard": 1, "bientot": 2, "dansLesDelais": 1, "sansDelai": 1, "enPause": 0, "suivi": 0 },
  "sections": [
    { "code": "A_DISPATCHER", "total": 3, "standardHeures": 8 },
    { "code": "PV_A_VISER", "total": 1, "standardHeures": 16 },
    { "code": "RETRAITS_A_DECIDER", "total": 1, "standardHeures": null }
  ],
  "taches": [
    {
      "section": "A_DISPATCHER", "geste": "DISPATCHER", "gestesSecondaires": [],
      "mode": "TITULAIRE", "urgence": "EN_RETARD", "rang": 1,
      "dossier": {
        "idDossier": 1051, "refeDossier": "00015/DGSR/DAO/2026", "dateSoumission": "2026-09-10T10:05:00",
        "idTypeDossier": "DAO", "idSousType": "DAO", "idEntiteContract": 31,
        "libelleEntite": "Direction générale de la Sécurité routière", "idLocalite": "ANT", "libelleLocalite": "Antananarivo",
        "statut": "PRET_DISPATCH", "statutPv": null, "niveauNavette": null,
        "datesEtapes": { "RECEPTION": "2026-09-11T14:00:00", "DISPATCH": null, "EXAMEN": null, "PROJET_PV": null, "PV_SIGNE": null, "VERIFICATION": null, "CLOTURE": null },
        "acteursEtapes": { "RECEPTION": "Fanja Rasoanaivo", "DISPATCH": null, "EXAMEN": null, "PROJET_PV": null, "PV_SIGNE": null, "VERIFICATION": null, "CLOTURE": null }
      },
      "delai": { "etape": "DISPATCH", "entree": "2026-09-11T14:00:00", "standardHeures": 8, "ecouleHeures": 9,
                 "restantHeures": -1, "echeance": "2026-09-14T14:00:00", "pauseDepuis": null, "pauseHeures": null,
                 "datePrevisionnelleFin": "2026-09-30" },
      "faits": { "nbLignes": null, "montantTotal": null, "nbPieces": 8, "idAvis": null, "nbObservations": null,
                 "consigneDispatch": null, "dernierRetourNavette": null, "motifRetrait": null, "examenEntame": null, "partsAttendues": null },
      "refs": { "idReception": 402, "idDispatch": null, "idExamen": null, "idPv": null, "idLettre": null, "idDemandeRetrait": null }
    }
  ],
  "delegations": { "total": 3, "parSection": [ { "code": "A_RECEPTIONNER", "total": 3 } ], "taches": [] }
}
```

Les autres lignes ont les mêmes clés, toujours présentes :

| Rang | Dossier | Section | Urgence | Reste |
|---|---|---|---|---|
| 2 | 00014/MTP/PPM/2026 | A_DISPATCHER | BIENTOT | 2 h |
| 3 | 00002/MTP/PPM-AGPM/2026 | PV_A_VISER (niveau PRESIDENT, entrée 11/09 12:00, échéance 15/09 12:00) | BIENTOT | 5 h |
| 4 | 00016/FR/PPM/2026 | A_DISPATCHER | DANS_LES_DELAIS | 7 h |
| 5 | 00009/DGB/PPM/2026 | RETRAITS_A_DECIDER | SANS_DELAI | — |

Énumérations (le serveur sert des codes, le front porte les libellés) :
- `mode` : `TITULAIRE`, `DELEGATION` (paire active de `t_delegation_profil`), `INTERIM` (visa par intérim), `COLLEGUE` (dossier ciblé sur un collègue), `SUPPLEANCE`. Seules les lignes `TITULAIRE` vont dans `taches` ; les autres dans `delegations.taches`.
- `urgence` : `EN_RETARD`, `BIENTOT`, `DANS_LES_DELAIS`, `SANS_DELAI`, `HORS_DELAI`, `EN_PAUSE`, `SUIVI`.

Champs internes à la CNM, à `null` pour la PRMP et l'UGPM (principe de `masquerActeursInternesPourPrmp`, règle C2) : `dossier.acteursEtapes`, `dossier.niveauNavette`, `faits.consigneDispatch`, `faits.dernierRetourNavette`, `faits.partsAttendues`, `refs.idDispatch`.

Clé d'une ligne : (`idDossier`, `section`). Un même dossier peut produire deux lignes pour une même personne (ex. un retrait et un visa).

### 3. Qui voit quoi

« Localité » désigne la localité du dossier ; le Président n'est borné par aucune. Pour la vérification, c'est la localité du contrôleur de réception, comme dans `/a-verifier`.

| Section | Condition sur le dossier | Titulaire (liste principale) | Bloc délégation (`mode`) | Geste | Délai |
|---|---|---|---|---|---|
| `A_RECEPTIONNER` | SOUMIS sans réception | Secrétaire de la localité | Président, CC de la localité, si la paire → SECRETAIRE est active (DELEGATION) | NUMEROTER | RECEPTION |
| `A_DISPATCHER` | PRET_DISPATCH | Central : Président. Régional : CC de la localité | Régional : Président (SUPPLEANCE, Q2) | DISPATCHER | DISPATCH |
| `A_EXAMINER` | DISPATCHE | Attributaire courant, quel que soit son profil | — | EXAMINER, ou REATTRIBUER pour un CC attributaire d'un dossier central sans examen entamé (Q3) | EXAMEN |
| `A_REEXAMINER` | A_REEXAMINER | Attributaire | — | REEXAMINER | EXAMEN |
| `PV_A_SOUMETTRE` | EXAMINE, PV BROUILLON | Examinateur (`imCtrlMembre` du PV) | — | SOUMETTRE_PV | EXAMEN |
| `PV_A_REPRENDRE` | EXAMINE, PV EN_RECTIFICATION | Examinateur | — | REPRENDRE_EXAMEN | EXAMEN |
| `PV_A_ACCEPTER` | PV PROJET_SOUMIS, deux niveaux, niveau CC ou nul | CC dispatcheur | — | ACCEPTER, en second RETOURNER | VISA |
| `PV_A_VISER` | PV PROJET_SOUMIS, deux niveaux, niveau PRESIDENT | Président | — (pas d'intérim sur ce circuit) | VISER, en second RETOURNER | VISA |
| `PV_A_VISER` | PV PROJET_SOUMIS en navette simple, ou PROJET_ACCEPTE sans la part du viseur | Dispatcheur | Président ou CC de la localité, sauf l'examinateur non dispatcheur (INTERIM) | VISER, en second RETOURNER | étape courante |
| `PV_A_SIGNER` | PV PROJET_ACCEPTE | Désigné (`imMembreCoSignataire` ou `imCcCoSignataire`) dont la part n'est pas datée | — | SIGNER | COSIGNATURE |
| `LETTRES_A_SIGNER` | Lettre SOUMIS | Régional : CC de la localité. Central : CC de la localité et Président | — | SIGNER_LETTRE | sans délai |
| `RETRAITS_A_DECIDER` | Demande EN_ATTENTE | CC de la localité et Président | — | DECIDER_RETRAIT | sans délai |
| `A_VERIFIER` | EN_VERIFICATION | Vérificateur cible ; sans cible, tous les Vérificateurs de la localité | Autres Vérificateurs (COLLEGUE) ; Président et CC de la localité si la paire → VERIFICATEUR est active (DELEGATION) | VERIFIER si avis FAVR, sinon TRANSMETTRE_DECISION | VERIFICATION |
| `A_TRANSMETTRE_SIGMP` | OBSERVATIONS_LEVEES | Comme `A_VERIFIER` | Comme `A_VERIFIER` | TRANSMETTRE_SIGMP | TRANSMISSION_SIGMP |
| `A_ARCHIVER` | DECISION_TRANSMISE_SIGMP, PV non archivé | Assistant cible ; sans cible, Assistants de la localité | Autres Assistants (COLLEGUE) ; CC de la localité (DELEGATION) ; jamais le Président (Q5) | ARCHIVER_PV | ARCHIVAGE |
| `LETTRES_A_ARCHIVER` | Lettre SIGNE non archivée | Assistants de la localité | CC de la localité (DELEGATION) | ARCHIVER_LETTRE | sans délai |
| `EN_ATTENTE_PRMP` | EN_ATTENTE_COMPLEMENTS_DEPOT, EN_ATTENTE_PIECES, ou EN_ATTENTE_DECISION_PRMP avec vérification | Porteur de l'étape de reprise : Secrétaire de la localité, attributaire, ou Vérificateur | — | VOIR | EN_PAUSE, hors `aFaire` |
| `BROUILLONS` | BROUILLON | PRMP (SOUMETTRE) ; UGPM (COMPLETER_BROUILLON, Q6) | — | voir titulaire | HORS_DELAI |
| `PIECES_DEPOT_A_COMPLETER` | EN_ATTENTE_COMPLEMENTS_DEPOT | PRMP propriétaire | — | COMPLETER_PIECES_DEPOT | EN_PAUSE |
| `COMPLEMENTS_A_TRANSMETTRE` | EN_ATTENTE_PIECES | PRMP propriétaire | — | TRANSMETTRE_COMPLEMENTS | EN_PAUSE |
| `A_RECTIFIER` | EN_ATTENTE_DECISION_PRMP | PRMP propriétaire | — | RECTIFIER | EN_PAUSE |
| `EN_COURS_CNM` | De SOUMIS à DECISION_TRANSMISE_SIGMP, hors attente | PRMP ou UGPM propriétaire | — | SUIVRE | SUIVI, hors `aFaire` |

Le front peut regrouper `PIECES_DEPOT_A_COMPLETER` et `COMPLEMENTS_A_TRANSMETTRE` sous « Pièces à compléter » ; ils restent distincts côté serveur (deux endpoints différents).

### 4. Délai : réutiliser le chronométrage, ne rien recopier

- Nouvelle méthode publique `ChronometrageService.delaiCourant(statut, statutPv, taches, suspensions, depot, maintenant, delais)` : étape courante, entrée dérivée (même `entree()` que la chaîne des passages), écoulé, délai standard `tr_delai_standard`, reste, échéance.
- Une seule dérivation : `datePrevisionnelleFin` est réécrite pour s'appuyer sur `delaiCourant`.
- `HeuresOuvrees.ajouter(debut, heures)`, réciproque de `ecoulees` sur la même fenêtre 08:00–16:00 du lundi au vendredi : `ecoulees(d, ajouter(d, h)) == h`.
- `delai.etape` est toujours l'étape courante ; elle peut être nulle pendant une attente PRMP. Lettres et retraits n'ont pas d'étape chronométrée : `SANS_DELAI`, `entree` = date de la lettre ou de la demande.
- Pause : statut suspensif (`estEnAttentePrmp`) → `EN_PAUSE` ; `pauseDepuis` = début de la fenêtre ouverte de `t_suspension_dossier` (nul s'il n'y en a pas), `pauseHeures` = écoulé ouvré. L'étape de reprise est lue dans `REPRISE_APRES_ATTENTE` (à rendre publique, pas à recopier).
- Seuils : reste < 0 → `EN_RETARD` ; 0 ≤ reste ≤ max(2 h, ⌈35 % du standard⌉) → `BIENTOT` (seuil de la maquette, Q4) ; au-delà → `DANS_LES_DELAIS`.
- Horloge : `Clock` injecté (bean `ClockConfig`).

### 5. Tri, sections, compteurs

- Tri de `taches` : par urgence dans l'ordre de l'énumération ; puis `restantHeures` croissant (classes chronométrées), date la plus ancienne (`SANS_DELAI`, `HORS_DELAI`, `EN_PAUSE`), `datePrevisionnelleFin` croissante (`SUIVI`) ; enfin `idDossier`. `rang` commence à 1.
- `sections` : dans l'ordre du §3, sections vides omises.
- Compteurs : lignes `TITULAIRE` seulement. `aFaire` exclut `EN_ATTENTE_PRMP` et `EN_COURS_CNM` ; `sansDelai` regroupe `SANS_DELAI` et `HORS_DELAI`.
- Invariants : CNM, `aFaire = enRetard + bientot + dansLesDelais + sansDelai` ; PRMP, `aFaire = enPause + sansDelai`.
- `BadgesDto` gagne `aFaire` (Integer, nul pour Administrateur et Chargé de publication), calculé par le même service ; les compteurs existants restent.

### 6. Performance et architecture

- Nombre de requêtes constant, chargement en lot : identifiants du périmètre (mêmes prédicats que `PerimetreDossier` et `/a-verifier`, statuts actifs) ; dossiers et libellés ; circuits (variante `in :ids` de `findCircuitByDossier`) ; états des PV (`etatsPvParDossiers` élargie à `idPv`, `niveauNavette`, `imCcCoSignataire`, `idAvis`, `dateArchivage`) ; passages, suspensions, délais standards ; lettres et demandes de retrait ; agrégats (lignes, montant, pièces, observations) ; paires de délégation actives ; annuaire des contrôleurs.
- Cible : au plus 15 ordres SQL, vérifiés au compteur Hibernate avec 1 puis 40 dossiers.
- Aucune condition du §3 ne se recopie : les prédicats aujourd'hui privés sont extraits en prédicats purs, à côté de `CircuitDossierService.deuxNiveaux` (`exigerViseurHorsExaminateur`, « niveau nul = étage du CC », `exigerCcDuCircuit`, `exigerPresidentSiCentrale`, garde de localité de l'archivage). Gardes et accueil appellent les mêmes prédicats ; les messages d'erreur ne changent pas.

### 7. Exclu volontairement

Administrateur et Chargé de publication ; lettres de renvoi non lues et décisions de retrait (déjà badgées) ; brouillon de lettre de renvoi du Membre (sous-étape de l'examen) ; statuts CLOTURE, RETIRE, REMPLACE et PV_SIGNE ; compteur « clôturés ce mois » de la maquette PRMP ; libellés (le serveur ne sert que des codes).

## Tests attendus

1. Pour chaque ligne du §3 : présent chez le titulaire, absent chez un pair (autre Membre, CC ou Secrétaire d'une autre localité).
2. Dossier central PRET_DISPATCH : absent chez le CC central, présent chez le Président ; dossier régional présent chez son CC.
3. Navette simple : le dispatcheur a VISER ; l'examinateur non dispatcheur n'a rien, même en INTERIM ; un autre P/CC de la localité est dans le bloc INTERIM. Deux niveaux, niveau nul : le CC a PV_A_ACCEPTER, le Président rien. Niveau PRESIDENT : le Président a PV_A_VISER.
4. Désactiver la paire PRESIDENT → SECRETAIRE retire les réceptions du bloc délégation ; le bloc ne compte jamais dans `compteurs`.
5. Vérificateur cible en TITULAIRE, collègue en COLLEGUE ; sans rattachement, tous TITULAIRE ; avis FAV → TRANSMETTRE_DECISION.
6. Le Président n'a jamais `A_ARCHIVER` ni `LETTRES_A_ARCHIVER`.
7. Règle C2 : le corps brut renvoyé à la PRMP et à l'UGPM ne contient aucun nom ni matricule de contrôleur, et seulement leurs propres dossiers.
8. Pause : EN_ATTENTE_DECISION_PRMP donne à la PRMP `A_RECTIFIER` en `EN_PAUSE`, `pauseDepuis` = début de la suspension ; le Vérificateur le voit en `EN_ATTENTE_PRMP`, hors `aFaire`.
9. `ecouleHeures` = `dureeHeuresOuvrees` du passage `enCours` de `GET /{id}/chronometrage` ; bornes BIENTOT et EN_RETARD testées à horloge fixe.
10. Tri déterministe ; statuts terminaux absents ; Administrateur et Chargé de publication en 403, anonyme en 401.
11. Compteur SQL constant ; `badges.aFaire` = `compteurs.aFaire` pour chaque profil.

## Côté front

- Écran `features/home/a-faire.ts`, monté en `loadComponent` dans le `*.routes.ts` de chaque espace (`/<espace>/a-faire`), pour que les liens d'action restent dans l'espace du profil.
- `home.ts` redirige les huit profils vers cet écran ; repli sur l'atterrissage actuel tant que l'endpoint répond 404.
- `DossierService.aFaire(delegations)` et interfaces `AFaire*` ; chaque geste ouvre l'écran existant qui le porte.
- Vues « Par étape » et « Par localité » : regroupement côté client. L'aperçu du dossier se construit à partir de `dossier`, `delai` et `faits`, sans appel supplémentaire.
- Badge de menu : `badges.aFaire`.
- « Tous les dossiers » reste en place, réaligné sur ce contrat dans un second temps.

## Arbitrages en attente (Mathieu ou le pilote)

1. Bloc délégation : replier les lignes réalisables par délégation, intérim ou collègue, hors compteurs et hors badge ? (proposé : oui ; sans cela, le Président verrait toutes les réceptions et vérifications du pays)
2. PRET_DISPATCH régional chez le Président : bloc délégation (proposé) ou liste principale ?
3. CC attributaire d'un dossier central : action principale « Attribuer à un Membre » (proposé) ou « Examiner » ?
4. Seuil « bientôt » : reste ≤ max(2 h, 35 % du standard), figé dans le code (proposé) ?
5. Archivage par délégation du Président : la maquette le propose mais le serveur le refuse. Retirer de la maquette (proposé) ou changer la règle ?
6. UGPM : même accueil que la PRMP avec des gestes de préparation (proposé), ou exclue en v1 ?
7. Sections réelles absentes de la maquette (« Projets de PV à soumettre », « à accepter », « Lettres de renvoi à signer / à archiver », « À archiver ») : les ajouter (proposé) ?
