# Plan — Impression de l'avis spécifique d'appel d'offres (30/09/2026)

> Demande du pilote : « Une fois l'examen du dossier DAO terminé, et que le PV obtient un avis favorable ou favorable
> avec réserves, la PRMP peut procéder à l'impression de l'avis spécifique relatif à ce DAO. »
>
> **Statut : PLAN — rien n'est codé avant l'accord du pilote.**

## 1. Ce qui existe

| Sujet | État |
|---|---|
| Modèle officiel | Un seul modèle d'« **Avis spécifique d'Appel d'Offres Ouvert** » dans les documents types, au début du document type du **contrat-cadre** (fournitures et services, `sources/contrat-cadre.txt`, lignes 18 à 45). Sa rédaction couvre les trois formes : « préciser à quantités fixes, à commandes ou contrat-cadre ». Les « Instructions aux candidats » des **fournitures** et des **travaux** n'en contiennent pas. Les **prestations intellectuelles** n'ont pas d'avis d'appel d'offres, mais une **lettre d'invitation** aux candidats présélectionnés. |
| Avis du PV | Codes du référentiel `Avis` : `FAV`, `FAVR`, `DEF`, `NSP`. Le PV porte `idAvis`, et son `statutPv` passe à `SIGNE` à la fin de l'examen. |
| Critère « examen terminé et favorable » | `statutPv = SIGNE` et `idAvis ∈ {FAV, FAVR}`. Le serveur l'applique déjà ailleurs (`DmcService`, l. 291). |
| Lien fiche ↔ dossier | La fiche porte `idDossierSoumis`, et le dossier porte `idDmc` et le résumé `ficheMarche`. Le dossier **ne porte pas** l'avis du PV : on le lit dans le PV (`PvExamen.idAvis`, `statutPv`). |
| Production de documents | Uniquement **à la validation** de la fiche (`DocumentsFicheMarcheService.produire`). **Aucune production à la demande** après validation, hormis celle du PV. Pas de gabarit d'avis côté serveur. |
| Écrans PRMP | Fiche DAO `/prmp/dao/:idDmc`, étape 7 « Documents » (elle cite aujourd'hui l'« avis d'appel d'offres » parmi les pièces **à joindre à la main**) ; page du dossier `/prmp/dossier/:idDossier` (étape PV) ; hub « Résultat examen », carte « PV définitifs ». |

## 2. Les trous du modèle et d'où vient chaque valeur

| # | Trou du modèle | Source proposée |
|---|---|---|
| 1 | Numéro et titre de l'AAO | `B02-OB-03` (numéro) et objet (`B02-OB-01`, ou `B02-OC-01` en contrat-cadre) |
| 2 | Date de publication | **à saisir à l'impression** (Q4) |
| 3-5 | Numéro et date du JMP de l'**Avis Général**, supports et dates de publication | **à saisir à l'impression** (Q4). Aucun champ n'existe, ni dans la fiche ni dans le plan. |
| 6 | Nom de l'Acheteur | entité de la ligne du plan (B01) |
| 7 | « des offres et des candidatures » | rédaction au choix selon la forme (contrat-cadre) |
| 8 | Brève description | objet de la fiche |
| 9-10 | Nombre de lots, ou lot unique indivisible | cadrage `alloti` / `nbLots` (repris du plan) |
| 11 | Quantités fixes / à commandes / contrat-cadre | `typeMarche` |
| 12 | Prix unitaire ou forfaitaire | cadrage `typePrix` (+ « mixte » en travaux) |
| 13-14 | Montant non remboursable du DAO (lettres et chiffres) | `B04-DS-05`, **servi au seul contrat-cadre** → à élargir aux quantités fixes et à commande (demande backend) |
| — | Adresse de consultation du DAO | `B04-DS-07` à `-10`, **servis au seul contrat-cadre** → à élargir (demande backend) |
| 15-16 | Adresse, date et heure limites de remise | `B04-LR-02` / `LR-03` / `LR-04` ; travaux `B04-OV-02` ; contrat-cadre `B04-CP-02` |
| 17 | Remise électronique « sera / ne sera pas » | cadrage `modeRemise` |
| 18 | Montant de la garantie de soumission | `B05-GS-03` ; travaux `B05-GQ-03` ; paragraphe retiré si aucune garantie n'est exigée |
| — | Phrase finale du contrat-cadre (« marchés subséquents ») | présente seulement en contrat-cadre |

## 3. Proposition

1. **Quand** : le bouton « Imprimer l'avis spécifique » n'apparaît que si le dossier soumis produit par la fiche a
   un **PV signé** à avis **FAV** ou **FAVR**. Le serveur vérifie la même règle et répond 409 à code stable
   (`AVIS_INDISPONIBLE`) sinon.
2. **Où** : à l'étape 7 « Documents » de la fiche DAO, et sur la page du dossier, sous le PV (Q5).
3. **Comment** : une modale demande les quelques informations de **publication**, qui ne sont pas des données du DAO
   (date de publication, numéro et date du JMP de l'avis général, supports), puis appelle
   `POST /api/fiches-marche/{idDmc}/avis-specifique`. Le serveur produit l'avis en **.docx et PDF**, sur la
   **dernière version validée** de la fiche, et le range parmi les documents de la fiche (type `AVIS`). Une nouvelle
   impression, après une correction par exemple, produit une nouvelle pièce ; l'ancienne reste consultable.
4. **Modèle** : décrit côté front comme les autres modèles (`decrire.mjs`, décalque vérifié) : `AVIS-F` (fournitures,
   quantité fixe, à commande et contrat-cadre, sur le modèle officiel) et `AVIS-T` (travaux, le même modèle adapté,
   Q2). Le backend le recopie, comme pour le lot D.
5. Les pièces « à joindre à la main » de l'étape 7 ne citent plus l'avis d'appel d'offres, puisque l'application le
   produit.

## 4. Découpage

| Lot | Contenu | Qui |
|---|---|---|
| AV-0 | Ce plan et les réponses aux questions | pilote |
| AV-1 | Modèles `AVIS-F` / `AVIS-T` décrits et vérifiés ; demande backend (route, garde FAV/FAVR + PV signé, type de document `AVIS`, élargissement de `B04-DS-05` et `B04-DS-07…10`, corps de la modale) | front |
| AV-2 | Route et production côté serveur, avec tests | backend |
| AV-3 | Bouton, modale, liste des avis produits (étape 7 et page du dossier) ; tests ; contre-recette à l'écran sur un dossier dont le PV est signé | front |

## 5. Questions au pilote (recommandation en premier)

- **Q1 — Avis FAVR** : impression **dès le PV signé** (recommandé, conforme à la demande), ou seulement après la levée
  des réserves (statut `OBSERVATIONS_LEVEES`) ? Si la levée corrige le DAO, il suffira de réimprimer l'avis sur la
  nouvelle version.
- **Q2 — Travaux** : **adapter le modèle officiel des fournitures** (« pour exécuter les travaux de… » au lieu de « pour
  fournir… », recommandé), ou attendre un modèle d'avis de travaux de l'ARMP ?
- **Q3 — Prestations intellectuelles** : **exclues pour l'instant** (recommandé : leur procédure passe par une lettre
  d'invitation, pas par un avis d'appel d'offres), ou faut-il un document équivalent ?
- **Q4 — Informations de publication** (date de publication, JMP de l'avis général, supports) : **saisies dans la
  modale d'impression** (recommandé : ce ne sont pas des données du DAO, et elles ne sont connues qu'au moment de
  publier), ou ajoutées comme champs de la fiche ?
- **Q5 — Emplacement** : **étape 7 de la fiche DAO et page du dossier** (recommandé), ou aussi la carte « PV
  définitifs » du hub « Résultat examen » ?
