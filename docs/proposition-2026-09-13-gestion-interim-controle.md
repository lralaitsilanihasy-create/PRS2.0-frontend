# Proposition — Gestion de l'INTÉRIM dans le processus de contrôle

**Date** : 2026-09-13 · **Auteur** : frontend (`frontendprs2`) · **Statut** : PROPOSITION à arbitrer par le
pilote, puis à transformer en demande backend. ⚠️ Rien de ce qui suit n'existe : le contrat esquissé au
§5 est une **proposition**, pas une description du backend.

## 1. Ce qui existe déjà (à ne pas réinventer)

L'intérim n'existe aujourd'hui que comme **exception ponctuelle, auto-déclarée au moment de l'acte** :

| Mécanisme | Portée | Limite |
|---|---|---|
| `Dispatch.interimDispatch` | un CC dispatche **hors de sa localité** en levant le drapeau (409 sinon) | un seul acte ; aucune justification ; aucune désignation |
| Visa **par intérim** (01/09) | un P/CC **du périmètre**, non dispatcheur, vise en joignant une **note PDF** ; trace `viseParInterim`, note consultable (403 PRMP), mention « par intérim » sur les PV **régionaux** seulement | un seul acte ; la note est la seule justification ; personne ne sait *à l'avance* qui supplée qui |
| Délégation ascendante (`t_delegation_profil`, 9 paires) | un **supérieur** (P/CC) exerce les tâches d'un **subordonné** — automatique, data-driven | structurelle et permanente ; jamais descendante ni entre pairs ; **le Président n'est suppléé par personne** |
| Réattribution / reprise (03/09) | le CC ou le Président ré-attribue un dossier d'un Membre à un autre | par dossier, à la main ; il faut *remarquer* l'absence |
| Rattachements Membre → Vérificateur → Assistant | ciblage des files FAVR (pas une garde : un collègue de la localité peut agir) | ne dit rien de l'absence |
| Mandats PRMP + vacance | côté PRMP : vacance = **standby**, arbitrage explicite « pas d'intérim » | hors périmètre ici (le circuit CNM n'est jamais suspendu) |

**Le trou réel** : (1) le **Président** est un point unique de défaillance — visa d'un PV qu'il a
dispatché, pré-dispatch d'un dossier central (réservé, 9c34077), part Président de la signature :
personne ne peut agir à sa place ; (2) pour tous les profils, **aucune désignation** — donc ni routage
des files et des notifications vers le suppléant, ni visibilité (« qui supplée qui aujourd'hui ? »),
ni contrôle (qui a autorisé ?), ni trace consolidée.

## 2. Principe : l'intérim DÉSIGNÉ, distinct de la délégation

| | Délégation (existe) | Intérim (proposé) |
|---|---|---|
| Qui agit | un **supérieur** | un **pair désigné** (ou le supérieur du Président) |
| Nature | structurelle, permanente, par **profil** | temporelle, **nominative**, par **personne** |
| Déclenchement | automatique (paire active en base) | une **désignation** datée, avec pièce |
| Actes d'identité | jamais (invariant 15/08) | **oui, c'est le but** — sous contraintes (§4.1) |

Un intérim = **« X (titulaire) est absent du D1 au D2 ; Y (intérimaire) agit à sa place, dans son
périmètre, sous sa propre identité »**. Modèle calqué sur le **mandat PRMP** (période, référence,
indélébile, historique) croisé avec la **garde centrale** des délégations (« titulaire OU délégation
OU intérim actif »).

### 2.1 Objet `Interim` (t_interim) — proposition

| Champ | Sens |
|---|---|
| `imTitulaire` | le contrôleur absent |
| `imInterimaire` | le désigné (≠ titulaire) |
| `dateDebut`, `dateFin` | période inclusive ; `dateFin` **obligatoire** (une absence a un terme ; prolongation = **nouvel** intérim, comme la reconduction d'un mandat) — sauf motif VACANCE_POSTE, `dateFin` nulle admise |
| `motif` | CONGE · MISSION · MALADIE · VACANCE_POSTE · AUTRE |
| `reference` + pièce PDF | note de service / décision de désignation (même garde que la note d'intérim : lisible par les contrôleurs du périmètre + Admin, **403 PRMP**) |
| `designePar`, `dateDesignation` | qui a créé |
| `statut` (dérivé serveur) | A_VENIR · **ACTIF** · ACHEVE · REVOQUE — jamais saisi, la date du serveur décide |

Règles d'intégrité (409) : titulaire ≠ intérimaire ; **un seul intérim actif par titulaire** à une date
donnée (chevauchement refusé) ; **non transitif** (l'intérimaire d'un absent ne se fait pas suppléer
pour cet intérim) ; un intérimaire peut cumuler plusieurs intérims (signalé, pas interdit) ;
**ni PUT ni DELETE** — une révocation (`revoquer`) clôt l'intérim avant terme, l'historique reste.

### 2.2 Qui peut suppléer qui (proposition)

| Titulaire absent | Intérimaire admissible | Pourquoi |
|---|---|---|
| **Président** | un **CC désigné** (toute localité) | seul cas ascendant ; comble le trou n° 1 |
| **CC** | un **CC d'une autre localité** | remplace le drapeau `interimDispatch` par une désignation ; le Président le couvre déjà par délégation |
| **Secrétaire** | un Secrétaire d'une autre localité | tâche d'instruction ; P/CC déjà couverts par délégation |
| **Vérificateur / Assistant** | même profil, même localité de préférence, sinon autre localité | les rattachements ciblent ; l'intérim **re-cible** temporairement la chaîne |
| **Membre** | *pas d'intérim d'identité* → **réattribution** (existante), assistée : le Membre absent est signalé, les dispatchs vers lui sont avertis/refusés (§6 Q7), l'intérimaire déclaré est **proposé** par défaut à la réattribution | l'examen et la part Membre sont des actes d'**attributaire** : on change l'attribution, on ne « prête » pas l'identité |

## 3. Effets d'un intérim ACTIF

1. **Droits** — garde centrale étendue : *titulaire OU délégation OU intérimaire actif du titulaire*.
   Les contrôles d'**identité** aussi : « le dispatcheur » devient « le dispatcheur **ou son
   intérimaire actif** » (visa, retrait), « le désigné » idem (co-signature), « le Président » idem
   (pré-dispatch central, part Président). Périmètre = celui du **titulaire** (un CC intérimaire du
   Président agit sur toutes les localités ; un CC intérimaire d'un CC agit sur la localité de ce CC).
2. **Files et écrans** — l'intérimaire voit les dossiers et actions du titulaire, marqués
   « ⤳ Intérim de X · jusqu'au D2 » (même patron que le badge « ⤴ Délégation », marqueur distinct).
3. **Notifications** — toute notification adressée au titulaire est **copiée** à l'intérimaire (le
   titulaire garde son historique ; à son retour il sait ce qui s'est passé). Voir Q6.
4. **Trace** — journal : auteur = intérimaire, `interimDe` = titulaire, `idInterim` (« Visé par Y,
   par intérim de X ») ; chronométrage : `PassageEtape.imActeur` = intérimaire + `interimDe` ;
   documents PV : la règle actuelle (mention « par intérim » régionale, Centrale sans mention) est
   **conservée** sauf arbitrage Q5.
5. **Retour du titulaire** — rien à défaire : les actes posés pendant l'intérim sont ceux de
   l'intérimaire, tracés comme tels. Fin automatique à `dateFin` (ou révocation).

## 4. Contraintes à préserver (arbitrages déjà rendus)

- **4.1 Deux personnes distinctes signent un PV** — un intérimaire ne signe **qu'une part** par PV.
  Cas limite à arbitrer (Q3) : le CC intérimaire du Président a déjà signé la part CC → la part
  Président attend un autre CC intérimaire… ou le retour du Président.
- Seul l'**assignataire** examine ; pas d'auto-retrait ; retrait = dispatcheur (ou son intérimaire).
- La délégation reste **inchangée** : l'intérim ne la remplace pas, il la complète (pairs + Président).
- PRMP : vacance = standby, **hors périmètre** de cette proposition.
- Le chemin **ponctuel** (note au visa, `interimDispatch`) devient le **repli d'urgence** pour une
  absence non anticipée — ou disparaît (Q4).

## 5. Esquisse de contrat — PROPOSITION (à confirmer par le backend)

- `GET /api/interims?titulaire=&interimaire=&actifs=true` · `GET /api/interims/{id}` ·
  `POST /api/interims` (qui : Q1) · `POST /api/interims/{id}/revoquer` · `GET /api/interims/{id}/piece`
  (PDF, 403 PRMP) — **pas de PUT ni DELETE**.
- `GET /api/interims/mes` : pour l'utilisateur de session — *qui je supplée* (intérims exercés,
  actifs) et *qui me supplée* (mon absence déclarée). Sert le badge, la bannière, le menu.
- Garde centrale + contrôles d'identité étendus (§3.1), résolus **serveur** (le front ne rejoue
  pas la règle) ; 403 nominatifs comme aujourd'hui.
- Notifications : copie à l'intérimaire actif au moment de l'émission.
- DTO : `ActionDossierDto.interimDe`, `PassageEtape.interimDe`, `PvExamenDto.viseParInterim` (déjà)
  + `interimDe` ; `ControleurDto.interimEnCours` (titulaire : « suppléé par Y jusqu'au … »).
- Admin : écran `/admin/comptes/interims` calqué sur `/admin/comptes/mandats` (historique,
  désignation, révocation, pièce) ; fiche contrôleur : « Absent — suppléé par Y jusqu'au D2 ».

## 6. Arbitrages demandés au pilote

| # | Question | Proposition |
|---|---|---|
| Q1 | **Qui désigne ?** | Administrateur pour tous (comme les mandats) ; **le Président peut désigner** pour un CC/Secrétaire/Vérif/Assistant/Membre ; seul l'Admin désigne l'intérimaire du Président |
| Q2 | **Qui peut suppléer qui ?** | tableau §2.2 (même profil d'une autre localité ; Président ← CC ; Membre = réattribution assistée) |
| Q3 | **Une part de signature par personne** — le CC intérimaire du Président ayant signé la part CC : la part Président attend le Président ou un autre intérimaire ? | **attend** (on ne contourne pas « deux personnes distinctes ») ; à confirmer |
| Q4 | **Pièce** obligatoire à la désignation ; **garder** la note ponctuelle au visa comme repli d'urgence ? | oui obligatoire ; **garder** le repli le temps de l'adoption, réévaluer ensuite |
| Q5 | **Mention sur les documents** : étendre « par intérim » à toutes les localités (il y a désormais une désignation formelle) ou conserver « régional seulement, Centrale sans mention » ? | **conserver** l'arbitrage du 01/09 (rien ne le remet en cause) |
| Q6 | **Notifications** : copie (titulaire + intérimaire) ou redirection ? | **copie** |
| Q7 | **Dispatch vers un titulaire absent** (Membre / CC) : refus 409 ou avertissement + intérimaire proposé ? | **avertissement + proposition** pour un Membre ; **refus** pour un acte d'identité |

## 7. Lotissement proposé

- **Lot 0** — arbitrages Q1-Q7 (pilote) → cette proposition devient `demande-backend-…`.
- **Lot 1 backend** — `t_interim`, endpoints, statut dérivé, 409 d'intégrité, garde centrale +
  identités étendues, copie des notifications, `interimDe` au journal et au chrono — tests par
  cas de la recette ci-dessous.
- **Lot 1 front** — écran Admin, `PermissionsService` (intérims actifs chargés comme les paires),
  badge « ⤳ Intérim », bannière « Vous suppléez X jusqu'au … » / « Vous êtes suppléé par Y », files
  du titulaire dans « Tous les dossiers », fiche contrôleur.
- **Lot 2** — assistance à la réattribution (Membre absent), avertissement/refus au dispatch,
  mention document si Q5 change, retrait éventuel du repli ponctuel.
- **Recette (données jetables)** : Président absent → CC intérimaire pré-dispatche un dossier
  central, vise un PV dispatché par le Président, signe **une** part, l'autre part attend (Q3) ; CC
  absent → CC d'une autre localité dispatche **sans** `interimDispatch` ; Membre absent → réattribution
  proposée ; chevauchement → 409 ; révocation → droits retirés dans la minute ; retour → rien à défaire ;
  PRMP : 403 sur la pièce.

## 8. Hors périmètre

Vacance PRMP (standby, arbitré) ; refonte de la délégation ; absence d'une UGPM ; planification
prévisionnelle des congés (l'intérim se déclare, il ne se planifie pas dans l'outil).
