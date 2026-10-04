# Demande backend — 2026-10-04 — Soumission en ligne, lot 2a : la commission d'appel d'offres (CAO), détentrice des parts de clé

**Date** : 2026-10-04 · **Émetteur** : front · **Origine** : plan `docs/plan-2026-10-04-soumission-en-ligne.md`, **Q11
arbitrée par le pilote le 04/10** ; ADR-0013 (scellement) ; V50 / ADR-0010 (paramètres internes), que ce lot **corrige**.
Il précède la cérémonie des clés (lot 2b, `docs/demande-backend-2026-10-04-ceremonie-des-cles.md`, corrigée en place).

**La décision du pilote**, dans ses termes : « La commission d'appel d'offres (CAO) examine les candidatures et évalue les
offres ou propositions ; sur la base de son avis, la PRMP choisit l'offre économiquement la plus avantageuse. Elle est
constituée de membres **désignés par la PRMP, par une décision**. Le **président** est désigné par la PRMP parmi ces
membres. La PRMP peut adjoindre des **experts** spécialisés pour l'évaluation des offres. La décision de nomination est
**temporaire** : un appel d'offres correspond à une CAO. Ne peuvent pas en être : la PRMP et l'UGPM (parties à la
procédure), le responsable de la procédure (règle 6 : il ne détient pas de part), et les contrôleurs de la CNM. » Et, en
précision : « Les membres de la CAO sont **issus de l’entité contractante**, ou sont des **personnes ayant une expertise en
matière de l’objet du DAO**. »

**Ce que cela change** : les détenteurs de parts de V50 (`membresCommission` : Présidents, Chefs de commission et
Membres de la localité, choisis par le responsable — ADR-0010) **n'étaient pas les bonnes personnes**. Les détenteurs sont
les membres de la CAO : des personnes de l'autorité contractante, **sans compte dans PRS aujourd'hui**. Il leur en faut un.
Un membre a donc une **origine** : agent de l'entité contractante, ou expert de l'objet du DAO ; les deux siègent et détiennent
une part. Les **experts adjoints** pour l'évaluation, eux, n'ouvrent pas les plis : pas de part, pas de compte dans ce lot.
`n` = membres de la CAO (qualité `MEMBRE`) + 1 (la part de secours).

**Conventions** : les noms de routes, de champs et de codes sont **PROPOSÉS** ; le backend les fixe et corrige ce document en
place (encadré ⚠️ daté). Le front ne code rien contre un nom non confirmé.

---

## B1 — La CAO : données et désignation par la PRMP

| Méthode | URL | Accès | Corps | Réponse | Statuts |
|---|---|---|---|---|---|
| GET | /api/fiches-marche/{idDmc}/cao | qui lit la fiche (PRMP, UGPM, Commission, Administrateur, responsable) | — | `CaoDto` | 200, 403, 404 |
| PUT | /api/fiches-marche/{idDmc}/cao | **PRMP de la fiche seule** | `CaoCorps` | `CaoDto` | 200, 400, 403, 404, 409 |
| POST | /api/fiches-marche/{idDmc}/cao/decision | PRMP | multipart `fichier` (PDF de la décision signée) | `CaoDto` | 200, 400, 403, 404, 413 |
| POST | /api/fiches-marche/{idDmc}/cao/membres/{id}/inviter | PRMP | — | `MembreCaoDto` | 200, 403, 404, 409 `COMPTE_ACTIF` |

- `CaoCorps` = `{ decision: { reference, date }, membres: [{ id?, nom, prenom, email, telephone, qualite, origine, fonction,
  service, organisme, domaine, president }] }`.
  - `qualite` ∈ `MEMBRE` (siège, détient une part) · `EXPERT_ADJOINT` (évalue, pas de part) ;
  - `origine`, pour un `MEMBRE` : `ENTITE_CONTRACTANTE` (agent de l'autorité contractante de la fiche, avec son `service`) ·
    `EXPERT_OBJET` (personne qualifiée sur l'objet du DAO, avec son `organisme` et son `domaine`, par exemple « génie
    civil ») — la précision du pilote ; un expert adjoint porte `organisme` et `domaine`, pas d'`origine` ;
  - un `id` absent crée le membre, présent le met à jour ; un membre omis est retiré (tant que §B3 le permet).
- `CaoDto` = `{ idDmc, decision: { reference, date, fichier: boolean }, membres: MembreCaoDto[], etat, anomalies: [{ regle,
  message }] }` ; `MembreCaoDto` = `{ id, nom, prenom, email, telephone, qualite, origine, fonction, service, organisme,
  domaine, president, compte: { etat: 'A_INVITER' | 'INVITE' | 'ACTIF' | 'ARCHIVE', idCompte: string | null,
  dateInvitation, dateActivation } }` — les experts adjoints ont `compte = null`.
- **La composition est un acte public de la PRMP** (une décision) : elle se lit par qui lit la fiche. Ce qui reste
  **interne** (ADR-0010) ne change pas : quorum, date de la cérémonie, dépositaire, parts — la PRMP ne les lit pas.
- **Contrôles du serveur** (400 par champ, 409 à code) :
  - `reference` et `date` de la décision obligatoires ; le PDF est **facultatif**, et son absence est une anomalie non
    bloquante (« La décision de nomination n'est pas jointe. ») — question 4 ;
  - **au moins deux membres** de qualité `MEMBRE` (le quorum vaut 2 au moins, V50 règle 6), et **exactement un président**,
    parmi eux ; un `MEMBRE` porte une `origine` (400 sinon) — `service` attendu pour l'entité contractante, `domaine` pour
    l'expert de l'objet ;
  - une adresse électronique ne figure qu'une fois dans la CAO ;
  - **exclusions par construction** : une adresse qui est celle d'un **contrôleur de la CNM** (fiche contrôleur), de la
    **PRMP** ou de l'**UGPM** de la fiche, ou d'un **candidat** inscrit (conflit d'intérêts) → 409 `MEMBRE_EXCLU`, le
    message nommant la raison sans nommer le compte. Le responsable de la procédure est un contrôleur : la même garde
    l'exclut ;
  - **une CAO par DAO** : la ressource est celle de l'`idDmc` ; une personne peut siéger dans plusieurs CAO, c'est son
    compte (§B2) qui est réutilisé, pas sa désignation.
- `etat` ∈ `ABSENTE` (rien) · `INCOMPLETE` (une règle manque) · `COMPLETE`. `anomalies` dit ce qui manque, et les
  comptes non activés (« 2 membres n'ont pas activé leur compte. »).

## B2 — Les comptes des membres de la CAO : le profil `MEMBRE_CAO`

- **Un profil de plus, `MEMBRE_CAO`**, qui n'atteint **aucune route interne** (même garde que `CANDIDAT`, lot 1a). Lui
  restent ouverts `/api/cao/**`, `/api/mon-compte/**`, et les routes publiques. Il n'entre jamais dans la coquille interne.
- **Création par la désignation** : au `PUT …/cao`, chaque membre de qualité `MEMBRE` dont l'adresse n'a pas déjà un compte
  `MEMBRE_CAO` reçoit un compte **à activer** (`t_compte_auth`, login = l'adresse en minuscules, type `MEMBRE_CAO`,
  `REF_ACTEUR` = identifiant court `K` + 9 chiffres), et une **invitation par courriel** : un code à six chiffres, valable
  **72 heures** (une invitation n'est pas une confirmation d'inscription : la personne ne l'attend pas), le lien de
  l'espace, le nom de la procédure et de l'autorité contractante. Les codes réutilisent `CodesCandidat` ; `POST
  …/cao/membres/{id}/inviter` renvoie une invitation (le code précédent ne vaut plus) — 409 `COMPTE_ACTIF` si le compte est
  déjà activé.
- **Activation** (publique, sans session) : `POST /api/cao/activation` `{ email, code, motDePasse }` → 200 `{ etat:
  'ACTIF' }` ; 400 `CODE_INVALIDE` / `CODE_EXPIRE`, 404, 429 (5 essais). La politique du mot de passe est celle des
  comptes internes. Une adresse qui a déjà un compte `MEMBRE_CAO` actif n'est pas réinvitée : la nouvelle désignation lui
  est notifiée (courriel + notification), et elle se connecte comme d'habitude.
- **Connexion** : `POST /api/auth/login`, `login` = l'adresse ; `LoginResponse.role` = `typeActeur` = `MEMBRE_CAO`, `ref` =
  identifiant court, `nomAffichage` = « NOM Prénom » ; 409 `COMPTE_A_ACTIVER` après le mot de passe vérifié.
- **Ses routes** :

| Méthode | URL | Réponse | Statuts |
|---|---|---|---|
| GET | /api/cao/mes-procedures | `[{ idDmc, reference, objet, autoriteContractante, president: boolean, dateLimite, etatCeremonie, etatPart }]` | 200 |
| GET | /api/cao/procedures/{idDmc} | la vue du membre : `ProcedureEnLigneDto` (lot 1c) + `{ president, cao: CaoDto }` | 200, 403 (il n'y siège pas), 404 |

  La cérémonie et la clé (lot 2b : `GET …/ceremonie`, `POST …/ceremonie/cles`, `/mienne`, `/defi`, `/perdue`) s'ouvrent
  au `MEMBRE_CAO` **qui siège dans cette CAO**, par ces mêmes routes sous `/api/fiches-marche/{idDmc}/…` — la garde est
  par identité (il est membre de qualité `MEMBRE` de la CAO de l'`idDmc`), comme celle du responsable (ADR-0010).
- **Pas de ménage automatique** dans ce lot : une désignation est temporaire, le compte reste pour la CAO suivante.
  L'Administrateur peut suspendre un compte comme les autres (`/api/comptes-auth`).

## B3 — Ce que V50 et l'ADR-0010 deviennent

- **`membresCommission` est DÉRIVÉ de la CAO** : les membres de qualité `MEMBRE`. `PUT …/parametres-internes` ne le reçoit plus
  (un corps qui le porte : 400 « Les membres sont ceux de la commission d'appel d'offres, désignée par la PRMP. ») ; il garde
  `quorum`, `dateCeremonie`, et gagne `depositaire` (lot 2b, §B1). `nombreParts` = membres de qualité `MEMBRE` ; `n` =
  `nombreParts + 1`.
- **`GET …/parametres-internes/candidats` disparaît** (410 `Gone`, ou retrait) : le responsable ne choisit plus de membres.
  Le front cesse de l'appeler.
- **Règle 6 `SE_QUORUM`** : `2 ≤ quorum ≤ nombreParts` ; « le responsable ne détient pas de part » devient vrai par
  construction (populations disjointes), la règle le vérifie quand même.
- **Règle 13 `SE_CAO`**, bloquante, mode électronique : « La commission d'appel d'offres n'est pas constituée (décision,
  au moins deux membres, un président) : la fiche ne peut pas être validée en remise électronique. »
- **Les comptes activés ne conditionnent pas la validation** : ils conditionnent la cérémonie, dont la clôture exige les
  `n` clés (lot 2b, §B2.4) — donc tous les comptes. `CaoDto.anomalies` et `CeremonieDto.detenteurs` le montrent.
- **Le responsable de la procédure reste** (ADR-0010) : contrôleur de la CNM désigné par l'Administrateur, gardien neutre
  du quorum, de la date de cérémonie et du dépositaire ; il clôt la cérémonie et conduit la séance d'ouverture **avec le
  président de la CAO**, qui la préside. Il ne détient pas de part. **À confirmer par le pilote** (question 1) ; l'autre
  lecture — le président de la CAO reprend ses attributions — supprimerait le rôle et confierait le quorum et la cérémonie
  à la PRMP, partie à la procédure : le front le déconseille.
- **Les paramètres internes gardent leur secret** (Q7 de V50) pour le quorum, la cérémonie, le dépositaire et les parts ;
  la composition de la CAO, acte de la PRMP, n'en fait plus partie.
- **ADR-0010 à amender** : le § « membres désignables » (Présidents, CC, Membres de la localité) est remplacé par « membres
  de qualité `MEMBRE` de la CAO de la fiche, comptes `MEMBRE_CAO` » ; la motivation « commission de déchiffrement ≠ commission
  d'examen » tient toujours — et plus encore : les détenteurs ne sont plus des contrôleurs.
- **Le président de la CAO** n'a, dans ce lot et le suivant, aucun droit de plus que les autres membres : sa clé est une
  clé parmi `n`. Il préside la séance d'ouverture (lot 4).
- **Les experts adjoints** : données seulement (nom, organisme, domaine, contact), aucune part, aucun compte. L'évaluation des
  offres est hors des quatre lots.

## B4 — Ce que la demande du lot 2b (cérémonie) devient

Corrigée en place par un encadré daté : « membre désigné » s'y lit « membre de la CAO, de qualité `MEMBRE`, compte `MEMBRE_CAO`
actif ». Les routes du lot 2b sous `/api/fiches-marche/{idDmc}/ceremonie/**` s'ouvrent à ces comptes par identité ; les
notifications `CLE_A_PUBLIER`, `CLES_PUBLIEES`, `PART_A_VERIFIER` leur partent **aussi par courriel** — une personne
extérieure ne vit pas dans l'application. L'écran « Ma clé » vit dans l'espace `/cao`, pas dans la coquille interne.

## B5 — Ce que le front construira, à la confirmation

- **PRMP** — écran « Commission d'appel d'offres » sur la fiche en mode électronique (`/prmp/dao/:idDmc/cao`) : la
  décision (référence, date, PDF par `validerFichier`), les membres (nom, prénom, fonction, organisme, adresse,
  téléphone), le président (un seul), les experts, l'état des comptes et « Renvoyer l'invitation ». La fiche porte l'état
  de la CAO comme elle porte celui des paramètres internes.
- **Responsable** — `/procedure/:idDmc/parametres-internes` : les membres se **lisent** (depuis la CAO), ne se choisissent
  plus ; quorum, date de cérémonie, dépositaire ; puis la section « Cérémonie » (lot 2b).
- **Espace `/cao`** (profil `MEMBRE_CAO`), dans **sa propre coquille** sur le modèle de `/candidat` : activation
  (publique), mes procédures, la procédure (lecture) et « Ma clé » (lot 2b), plus tard la séance (lot 4). `Role` et
  `TypeActeur` gagnent `MEMBRE_CAO` ; `RoleInterne` ne bouge pas (dix menus) ; `authGuard` et `roleGuard` le renvoient vers
  `/cao` sans appel aux intérims, comme le candidat.
- **Recette** : une fiche électronique, une CAO et des comptes activés dans DBPRS20 — et des **courriels lisibles** : le
  point 1 de la contre-recette du lot 1 (Mailpit, ou le code au journal sous profil de recette) devient bloquant ici.

## Questions ouvertes

| # | Question | À qui |
|---|---|---|
| 1 | Le responsable de la procédure (CNM, ADR-0010) reste-t-il le gardien neutre du quorum, de la cérémonie et du dépositaire, et le conducteur des séances aux côtés du président de la CAO ? Le front le recommande | pilote |
| 2 | L'UGPM peut-elle **saisir** la CAO pour la PRMP, qui validerait ? Le front propose non : la décision est un acte de la PRMP, et l'UGPM ne soumet rien | pilote |
| 3 | Les experts adjoints auront-ils un compte pour l'évaluation (hors des quatre lots) ? Rien n'est construit pour eux ici | pilote |
| 4 | Le PDF de la décision de nomination : facultatif avec avertissement (proposé), ou obligatoire ? | pilote |
