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

## B4 — Les procédures déjà en cours

- Une part de secours **déjà publiée selon l'ancien geste** (générée chez le responsable : fiches 34 et 40 en recette) reste
  valable. Le responsable l'apporte comme aujourd'hui, avec la phrase du pli. Le `DetenteurDto` du secours gagne
  **`generePar: 'RESPONSABLE' | 'DEPOSITAIRE'`** pour que les écrans proposent le bon geste.
- Une procédure dont la clé de secours n'est **pas encore publiée** passe au nouveau geste dès la livraison : le responsable
  ne peut plus générer la clé de secours (403 `GESTE_DU_DEPOSITAIRE`).

## Questions au backend

| # | Question | Proposé |
|---|---|---|
| 1 | Le profil du dépositaire : un profil propre (`DEPOSITAIRE`), ou le compte de membre de CAO avec un rôle de détenteur `SECOURS` ? | Un profil propre : il ne doit ni lire les offres ni signer le PV, et la règle B1 du 04/10 (pièces aux membres de la CAO seulement) reste simple |
| 2 | Le changement de dépositaire après publication de sa clé : remplacement (S4) par le nouveau, qui publie sa propre clé ? | Oui, comme le remplacement d'une clé de membre ; l'ancien compte garde son journal |

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
