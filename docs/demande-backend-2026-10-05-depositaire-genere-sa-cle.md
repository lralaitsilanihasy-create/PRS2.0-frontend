# Demande backend — 2026-10-05 — Soumission en ligne : le dépositaire génère lui-même la part de secours

> Décision du pilote (05/10) : « On va accepter le **dépositaire lui-même**. »

**Le constat.** Aujourd'hui (lot 2b, `demande-backend-2026-10-04-ceremonie-des-cles.md` §B2.3), la paire de clés de secours
naît **sur le poste du responsable de la procédure**, en présence du dépositaire. La phrase générée s'affiche à l'écran, puis
s'imprime sur le pli. Le responsable la voit donc passer : de fait, il pourrait détenir la part de secours. Le pilote a écarté
l'idée de confier ce geste à la PRMP. Avec un quorum de 2, la PRMP et un seul membre de la CAO, qu'elle a nommé, suffiraient
à ouvrir les offres.

**La décision.** La clé de secours naît **sur le poste du dépositaire**, et lui seul voit sa phrase. Le responsable ne la
touche plus : il désigne le dépositaire, suit l'état de sa part, et demande son emploi en séance avec un motif. Personne
d'autre que le dépositaire ne détient la part de secours.

Les noms ci-dessous sont **proposés** : le backend fait autorité, et ce document sera corrigé en place si la livraison s'en
écarte.

## B1 — Un compte pour le dépositaire

Aujourd'hui, le dépositaire est une désignation nominative sans compte : `depositaire { nom, organisme, fonction, contact }`.

- Le dépositaire reçoit un **compte externe**, sur le modèle des membres de la CAO (lot 2a). Profil proposé : **`DEPOSITAIRE`**,
  identifiant `D` + 9 chiffres. Il est externe : il n'entre jamais dans la coquille interne.
- `depositaire` gagne **`email`**, **obligatoire**, et **`telephone`**, facultatif. Le `PUT …/parametres-internes` crée le
  compte s'il n'existe pas, puis envoie l'invitation par courriel : un code d'activation, comme pour la CAO.
  - Un même dépositaire peut servir plusieurs procédures : un compte par adresse.
  - `partDeSecours.depositaire.compte = { etat: 'A_INVITER' | 'INVITE' | 'ACTIF' | 'ARCHIVE' }`, comme pour les membres.

| Méthode | URL | Accès | Corps | Réponse | Statuts |
|---|---|---|---|---|---|
| POST | /api/depositaire/activation | public | `{ email, code, motDePasse }` | `{ etat: 'ACTIF' }` | 200, 400, 409 |
| POST | /api/fiches-marche/{idDmc}/parametres-internes/depositaire/inviter | responsable | — | `ParametresInternesDto` | 200, 403, 409 `DEJA_ACTIF` |
| GET | /api/depositaire/procedures | dépositaire | — | `[{ idDmc, reference, objet, etatCeremonie, etatPart, etatSeance }]` | 200, 403 |

- **Exclusions**, nommées par le serveur comme pour la CAO : le dépositaire n'est ni la PRMP, ni l'UGPM, ni le responsable,
  ni un membre de la CAO de la procédure, ni un candidat. Code proposé : 409 **`DEPOSITAIRE_INCOMPATIBLE`**.
- **Ce que le dépositaire ne voit pas** : la lecture des offres, leurs pièces, le PV. Il ne voit que sa part et l'état de la
  séance.

> ⚠️ **2026-10-05 — livré (V71).** Écarts et précisions :
> - `partDeSecours.depositaire` = `{ nom, organisme, fonction, contact, email, telephone, compte: { idCompte, etat } }`. Le champ
>   `compte` porte aussi `idCompte` ; il est ignoré en écriture, et `null` pour un dépositaire désigné avant V71 sans adresse.
>   L'`email` manquant donne 400 sous le champ **`depositaire.email`**. L'invitation part quand le compte **devient** le
>   dépositaire de la procédure, s'il n'est pas actif ; un `PUT` qui renvoie le même dépositaire ne réinvite pas ;
> - l'activation d'un compte déjà actif répond 200 `{ etat: 'ACTIF' }` sans rien changer, comme pour la CAO : pas de 409 ; le
>   renvoi d'invitation sans dépositaire à adresse répond 409 **`DEPOSITAIRE_ABSENT`** ;
> - les exclusions visent aussi **toute adresse déjà prise par un autre compte de PRS**, puisqu'un login est une adresse et qu'un
>   compte n'a qu'un profil. Un membre de CAO d'une autre procédure ne peut donc pas être dépositaire avec la même adresse ;
>   réciproquement, la CAO refuse l'adresse d'un dépositaire (409 `MEMBRE_EXCLU`) ;
> - `GET /api/depositaire/procedures` sert aussi `generePar` (qui a généré la clé de secours active) et **`cleARemplacer`** (une
>   clé active qui n'est pas la sienne : il la remplace par `PUT`), et `secoursDemande` (§B3). `etatPart` est l'état de **sa**
>   clé (`ABSENTE` sinon) ;
> - connexion par `POST /api/auth/login` : 409 `COMPTE_A_ACTIVER` avant l'activation ; `role` = `DEPOSITAIRE`, `ref` = `D…`.
>   Ses notifications se lisent par `/api/mon-compte/**`, comme celles d'un membre.

## B2 — Sa clé, dans son navigateur

Les gestes du membre (`…/ceremonie/cles`, lot 2b §B2.2) valent pour le dépositaire, avec le rôle `SECOURS` :

| Méthode | URL | Accès | Corps | Réponse | Statuts |
|---|---|---|---|---|---|
| POST | /api/fiches-marche/{idDmc}/ceremonie/cles/secours | **dépositaire** (et non plus le responsable) | `CleCorps` | 201 `DetenteurDto` (`role = SECOURS`) | 201, 400, 403, 409 |
| PUT | /api/fiches-marche/{idDmc}/ceremonie/cles/secours | **dépositaire** (remplacement, S4) | `CleCorps` | `DetenteurDto` | 200, 400, 403, 409 |
| GET | /api/fiches-marche/{idDmc}/ceremonie/cles/secours | **dépositaire** | — | `EnveloppeDto` | 200, 403, 404 |
| POST | /api/fiches-marche/{idDmc}/ceremonie/defi?role=SECOURS | **dépositaire** | — | 201 `{ idDefi, chiffre, expire }` | 201, 403, 409 |
| POST | /api/fiches-marche/{idDmc}/ceremonie/cles/perdue?role=SECOURS | **dépositaire** | — | `DetenteurDto` | 200, 403 |

- **La phrase.** Comme pour la question 4 du lot 2b, le front propose une phrase **générée** de sept mots, montrée **une
  fois**, sur le poste du dépositaire. Il l'imprime lui-même pour son pli et enregistre sa copie de sauvegarde, comme un
  membre. Une phrase choisie par lui risquerait l'oubli, qui rendrait le secours vain. Le serveur n'en dépend pas.
- **Le responsable** garde la lecture de la cérémonie : détenteurs, états, empreintes. Il voit aussi « Clé de secours à
  publier par le dépositaire » et, pour un dépositaire injoignable, les mêmes avertissements que pour un membre. La clôture
  de la cérémonie reste son geste (409 `CLES_INCOMPLETES` tant que la part de secours manque).
- **Notification** : `CLE_A_PUBLIER` au dépositaire (courriel compris), dès la désignation et après son activation.

> ⚠️ **2026-10-05 — livré (V71).** Écarts et précisions :
> - le responsable qui tente `POST` ou `PUT …/cles/secours` reçoit 403 **`GESTE_DU_DEPOSITAIRE`** ;
> - `GET …/cles/secours`, le défi et la perte valent pour le **détenteur** de la clé active : le dépositaire qui l'a publiée, ou
>   le responsable pour une clé de l'ancien geste (§B4). Un autre dépositaire (Q2) reçoit 403 et remplace la clé ;
> - le dépositaire **lit la cérémonie** (`GET …/ceremonie` : détenteurs, états, empreintes), comme un membre ;
> - `DetenteurDto.generePar` est servi pour la part de secours publiée (`null` pour un membre ou une part absente) ;
> - `CLE_A_PUBLIER` part aussi à la réouverture de la cérémonie. Le rappel de nuit `PART_A_VERIFIER` reste limité aux membres.

## B3 — En séance : le responsable demande, le dépositaire apporte

Aujourd'hui (lot 4, §B2), le responsable apporte la part de secours depuis son poste, la phrase dictée par le dépositaire.

| Méthode | URL | Accès | Corps | Réponse | Statuts |
|---|---|---|---|---|---|
| POST | /api/fiches-marche/{idDmc}/seance/secours | responsable | `{ motif }` | `SeanceDto` (`secoursDemande = { motif, date }`) | 200, 400 `MOTIF_ABSENT`, 409 `SEANCE_NON_OUVERTE` / `SECOURS_INUTILE` |
| GET | /api/fiches-marche/{idDmc}/seance/mes-parts?role=SECOURS | **dépositaire** | — | `PartChiffree[]` | 200, 403, 409 `SECOURS_NON_DEMANDE` |
| POST | /api/fiches-marche/{idDmc}/seance/parts?role=SECOURS | **dépositaire** | `{ parts }` | `SeanceDto` | 200, 403, 409 `SECOURS_NON_DEMANDE` |

- Le **motif** reste celui de la séance, posé par le responsable. Il est porté au PV, comme aujourd'hui (`secoursEmploye`).
- **`SECOURS_INUTILE`** (proposé) : le quorum est déjà atteint, la part de secours ne sert pas.
- Le dépositaire apporte depuis **n'importe quel poste** où il se connecte, en salle ou à distance, comme un membre. Sa phrase
  ne quitte jamais son navigateur.
- **Notification** : `SECOURS_DEMANDE` au dépositaire (courriel compris) dès la demande.
- **S5** est inchangé : si la part de secours ne peut pas venir, le quorum n'est pas atteignable, et le responsable constate
  l'illisibilité.

> ⚠️ **2026-10-05 — livré (V71).** Écarts et précisions :
> - `SeanceDto` gagne **`secoursDemande`** et aussi **`secoursGenerePar`** (`RESPONSABLE` · `DEPOSITAIRE` · `null`), pour que
>   l'écran choisisse entre « Demander la part de secours » et l'ancien geste ;
> - **`SECOURS_INUTILE`** veut dire en pratique « la part de secours est déjà apportée ». Le quorum réuni ouvre aussitôt les
>   offres : la séance n'est alors plus `OUVERTE` et la demande répond `SEANCE_NON_OUVERTE`. Une nouvelle demande remplace la
>   précédente (motif et date). Code ajouté : 409 **`GESTE_DU_RESPONSABLE`** pour une clé de l'ancien geste (§B4) ;
> - le dépositaire apporte **sans motif** : c'est celui de la demande qui est porté au PV. Journal `SECOURS_DEMANDE`, puis
>   `SECOURS` (« apportée par le dépositaire ») ;
> - `GET /api/depositaire/procedures` donne `etatSeance` et `secoursDemande`. La lecture de la séance elle-même
>   (`GET …/seance`) reste refusée au dépositaire (403).

## B4 — Les procédures déjà en cours

- Une part de secours **déjà publiée selon l'ancien geste** (générée chez le responsable : fiches 34 et 40 en recette) reste
  valable. Le responsable l'apporte comme aujourd'hui, avec la phrase du pli. Le `DetenteurDto` du secours gagne
  **`generePar: 'RESPONSABLE' | 'DEPOSITAIRE'`** pour que les écrans proposent le bon geste.
- Une procédure dont la clé de secours n'est **pas encore publiée** passe au nouveau geste dès la livraison : le responsable
  ne peut plus générer la clé de secours (403 `GESTE_DU_DEPOSITAIRE`).

> ⚠️ **2026-10-05 — livré (V71), conforme.** V71 marque `RESPONSABLE` toutes les clés de secours déjà publiées. Pour elles,
> `POST …/seance/secours` répond 409 **`GESTE_DU_RESPONSABLE`** (code ajouté) : le responsable apporte la part lui-même, avec
> le motif dans le corps. Le dépositaire peut aussi **remplacer** une clé de l'ancien geste (`PUT …/cles/secours`), qui passe
> alors au nouveau geste. ⚠️ Une procédure sans clé publiée doit d'abord avoir un dépositaire **avec adresse** : le `PUT`
> l'exige.

## Questions au backend

| # | Question | Proposé |
|---|---|---|
| 1 | Le profil du dépositaire : un profil propre (`DEPOSITAIRE`), ou le compte de membre de CAO avec un rôle de détenteur `SECOURS` ? | Un profil propre : il ne doit ni lire les offres ni signer le PV, et la règle B1 du 04/10 (pièces aux membres de la CAO seulement) reste simple |
| 2 | Le changement de dépositaire après publication de sa clé : remplacement (S4) par le nouveau, qui publie sa propre clé ? | Oui, comme le remplacement d'une clé de membre ; l'ancien compte garde son journal |

> ⚠️ **2026-10-05 — livré (V71) : les deux propositions sont retenues.** Q1 : profil propre **`DEPOSITAIRE`** (type d'acteur
> `DEPOSITAIRE`, table `t_compte_depositaire`). Q2 : le changement de dépositaire (un autre `email` au `PUT`) crée ou retrouve son
> compte, l'invite et lui envoie `CLE_A_PUBLIER` ; l'ancien ne gère plus la clé et ne voit plus la procédure, le nouveau la
> **remplace** (`PUT …/cles/secours`) ; l'ancien compte garde son journal. ⚠️ Écart : le changement suit les règles des
> paramètres internes — fiche validée ou cérémonie close, il faut rouvrir d'abord, ce qui n'est plus possible après le premier
> dépôt (`DEPOT_EXISTANT`).

## Ce que le front fera, à la livraison

- **Responsable** (`/procedure/{idDmc}/parametres-internes`) : le formulaire du dépositaire gagne le courriel (obligatoire) et
  le téléphone, avec l'état de son compte et « Renvoyer l'invitation ». La section « Générer la clé de secours » disparaît
  pour une part non publiée, remplacée par l'état de la part et le rappel qu'elle se publie chez le dépositaire. En séance,
  « Part de secours… » devient « Demander la part de secours » (motif), puis le suivi de son arrivée. L'ancien geste reste
  pour une part `generePar = RESPONSABLE`.
- **Dépositaire** : un espace externe `/depositaire` sur la coquille externe partagée (`espace-externe-layout`, troisième espace
  après `candidat` et `cao`). Il contient : l'activation, « Mes procédures », la clé de chaque procédure (génération, phrase
  montrée une fois, impression du pli, copie de sauvegarde, vérification par le défi, perte), puis en séance « Apporter la
  part de secours » quand elle est demandée. Ces gestes reprennent les composants du membre (`ma-cle`, `apport-parts`).
- **Accueil public** : pas de nouvelle audience. Le dépositaire arrive par son invitation, comme le membre de CAO.

---

> ✅ **Front, livré le 2026-10-05 (contre le contrat V71 ; serveur local encore en V70 au moment de la livraison).**
> - **Profil `DEPOSITAIRE`** : externe (exclu de `RoleInterne`), libellés « Dépositaire de la part de secours » / « Dépositaire », espace
>   **`/depositaire`** dans la coquille externe partagée (troisième espace après `candidat` et `cao`) ; la connexion y mène.
> - **Activation** (`/depositaire/activation`) : l'écran de la CAO en variante (`data.variante`), même code, même politique de mot de
>   passe. Après un 404, chacun des deux écrans propose l'autre (« Vous êtes dépositaire… ? »).
> - **Mes procédures** (`GET /api/depositaire/procedures`) : état de sa clé, de la cérémonie et de la séance, et en tête ce qui
>   l'attend (« clé de secours à générer », « la séance demande votre part »).
> - **Sa procédure** (`/depositaire/procedures/{idDmc}`) : la cérémonie en lecture ; **`app-part-secours`** (nouveau composant
>   partagé, extrait de l'écran du responsable) : générer sa clé (phrase de sept mots montrée une fois, pli imprimé ou enregistré,
>   case « J'ai imprimé le pli »), remplacer une clé qui n'est pas la sienne (`cleARemplacer`), vérifier par le défi, déclarer perdue ;
>   puis, si `secoursDemande` et séance `OUVERTE`, **« Apporter la part de secours »** (`apport-parts`, `parDepositaire` : sans motif).
>   Relecture toutes les cinq secondes tant que la séance est ouverte.
> - **Responsable** : paramètres internes — adresse (obligatoire, 400 `depositaire.email` sous le champ) et téléphone du dépositaire,
>   état et identifiant de son compte, « Renvoyer l'invitation » (`DEJA_ACTIF`, `DEPOSITAIRE_ABSENT`, `DEPOSITAIRE_INCOMPATIBLE`
>   nommés) ; cérémonie — la part de secours en **lecture** (« se génère sur le poste du dépositaire »), sauf une clé
>   `generePar = RESPONSABLE` : vérification et perte gardées, remplacement renvoyé au dépositaire ; séance — « Part de secours… »
>   devient **« Demander la part de secours »** (motif ; `SECOURS_INUTILE`, `GESTE_DU_RESPONSABLE` nommés), la demande et son motif
>   affichés ; l'ancien geste reste pour `secoursGenerePar = RESPONSABLE`.
> - Tests : `part-secours.spec.ts` (5), `parametres-internes.spec.ts` et `libelles-profils.spec.ts` mis à jour ; build de production vert.
>   Recette en navigateur à faire dès que le serveur local tourne en V71.
>
> **Constat pour le backend (non bloquant)** — `POST /api/auth/login` répond 409 `COMPTE_A_ACTIVER` sans dire **quel** compte
> (membre de CAO ou dépositaire). Le front choisit l'écran d'activation d'après la page visée (`returnUrl`), puis propose l'autre en
> cas de 404. Un `details.espace` (`'cao'` | `'depositaire'`) dans la réponse lèverait l'ambiguïté.
