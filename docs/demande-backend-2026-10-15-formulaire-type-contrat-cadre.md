# Demande backend — 2026-10-15 — formulaire du contrat-cadre face au document type ARMP

## Contexte

Suite de `demande-backend-2026-10-15-articles-vides-dao.md`. Le pilote a fait confronter les données du document type ARMP
« Contrat-cadre — Fournitures et prestations de services » (2019, `Documents Types/Fournitures et services/`) à celles du
formulaire de la fiche DAO (référentiel `CONTRAT_CADRE` / `FOURNITURES_SERVICES` : **177 champs**, dont **107** imprimés par le
DPAC-CC et l'AE-CC). Deux constats, dans les deux sens : des champs saisis que rien n'imprime, et des données du type qu'aucun
champ ne porte. Décision du pilote (15/10) : les remonter.

## B1 — Dix-sept champs saisis que rien n'imprime

Recherche du code de chaque champ dans `src/main/resources/modeles` et `src/main/java` : **aucune occurrence**. Le rédacteur les
saisit pour rien. Pour chacun : l'imprimer à sa place dans le modèle (emplacement proposé ci-dessous, d'après le type), ou le
retirer du formulaire du contrat-cadre (règle du 30/09 : un champ que rien ne lit sort de la fiche).

| Champ | Libellé | Emplacement proposé dans le type |
|---|---|---|
| `B06-SO-01` | Rejet des offres hors délais et ouverture des offres | DPAC art. 6, § 1 |
| `B06-SO-02` | Analyse des offres | DPAC art. 6, § 2 |
| `B06-SO-03` | Rejet des offres non recevables | DPAC art. 6, § 3 |
| `B06-SO-04` | Comparaison des offres (offre économiquement la plus avantageuse) | DPAC art. 6, § 4 |
| `B04-DS-02` | Langue du dossier de consultation et des offres | DPAC art. 8 |
| `B04-DS-03` | Modalités d'acquisition du dossier de consultation | DPAC art. 3.3 |
| `B04-DS-06` | Modification du dossier de consultation | DPAC art. 3 |
| `B07-MA-03` | Attribution des marchés subséquents après remise en concurrence (non alloti) | AE art. 4, choix 2.1 |
| `B07-PI-01` | Pièces contractuelles du contrat-cadre et des marchés subséquents | AE art. 6 |
| `B07-DU-01` | Entrée en vigueur du contrat-cadre | AE art. 7.1 |
| `B07-DE-04` | Délais d'exécution des marchés fractionnés par bons de commande | AE art. 7.4, choix 2 |
| `B08-FI-04` | Remboursement de l'avance (art. 72.III) | AE art. 10.4 (désormais toujours imprimé) |
| `B08-FP-03` | Délai de paiement (jours) | AE art. 15 |
| `B08-FP-05` | Règlement des prestations | AE art. 15.1 (voir B2) |
| `B09-AU-02` | Attestation d'assurance à justifier | AE art. 16 |
| `B09-EA-03` | Modalités particulières à fixer dans les marchés subséquents | AE art. 12 |
| `B10-RS-01` | Résiliation sans faute du contrat-cadre | AE art. 18.1 |
| `B03-SS-01`, `B03-SS-02` | Désignation des sous-traitants ; paiement direct | AE art. 11.1 et 11.2 (texte fixe aujourd'hui) |
| `B06-NO-01`, `B06-NO-02` | Dates de réception de l'accusé ; de remise en main propre | Cadre « notification » de l'AE, qui imprime encore « <indiquer la date> » |

Pour `B06-NO-01` et `B06-NO-02`, le front recommande de les **retirer** de la fiche : ce sont des faits de la notification,
postérieurs au DAO, que le document publié doit laisser en blanc. (Avec `B03-SS-*`, la liste compte dix-neuf codes pour
dix-sept rubriques.)

Rappel : `B08-FI-05` (avance au sous-traitant) n'est plus lu depuis l'arbitrage (b) de l'article 10 — même règle.

> ⚠️ **2026-10-15, livraison backend : 20 champs retirés, aucun imprimé.** J'ai confronté chaque emplacement proposé au
> texte du document type (`.doc` de 2019, exporté en texte). Partout, le type porte un **texte fixe**, que DPAC-CC et
> AE-CC reprennent déjà tel quel, et non un blanc à remplir :
> - DPAC : 3.2 « rédigé en langue française », 3.3 (rempli par `B04-DS-04/05`), 3.4 (6 jours), 6.2 §1 à §3. Le §4,
>   `<préciser les critères>`, est rempli par `B06-SO-05`, ce qui fait de `B06-SO-04` un doublon.
> - AE : art. 4 choix 2.1, art. 6 (liste fixe des pièces), 7.1 (« à compter de sa notification »), 7.4 choix 2,
>   10.4 (art. 72.III), 11.1-11.2, 12 (« Dans les deux cas… »), 16 (attestation), 18.1.
>
> Imprimer la saisie à ces endroits aurait doublé ou réécrit le type, ce que l'ADR-0011 exclut. Ces champs sortent donc
> de la fiche selon la règle du 30/09, avec `B06-NO-01/02` (recommandation du front) et `B08-FI-05`. Leurs valeurs
> sont conservées (aucune n'existe sur DBPRS20).
>
> **Exception :** `B08-FP-03` (délai de paiement) reste, facultatif, parce que la règle `DELAI_PAIEMENT_75` le lit
> (l'art. 15.3 du type écrit 75 jours en dur). `B08-FP-05` est traité en B2.

## B2 — Une phrase imprime le mauvais champ

AE-CC, art. 15.1 : « Le règlement des prestations se fera `{{B08-FP-01}}`. » imprime le champ « Présentation des demandes de
paiement », alors que la fiche a un champ **« Règlement des prestations »** (`B08-FP-05`) que rien n'imprime. Dans le DAO de
recette, la phrase devenait « Le règlement des prestations se fera Les factures sont établies… ». Proposition : `B08-FP-05` dans
cette phrase, `B08-FP-01` sous le sous-titre « 15.1 – Présentation des demandes de paiement ».

> ⚠️ **2026-10-15, livré tel que proposé.** `B08-FP-01` s'imprime en premier paragraphe sous le 15.1, et la phrase porte
> `B08-FP-05`. Ce dernier devient **obligatoire**, puisqu'il remplit un blanc du type, et il est servi aussi au
> contrat-cadre de travaux, comme `B08-FP-01`.

## B3 — L'indice d'actualisation des prix

Type, AE art. 9.3 : « si le bon de commande … intervient après l'expiration du délai de validité de l'offre du titulaire, les
prix peuvent être actualisés au moyen de la formule suivante : Pn = Po × (Indice n / Indice o) ». La fiche demande « prix ferme
ou révisable » (cadrage), mais **aucun champ ne nomme l'indice**. Proposition : un champ « Indice d'actualisation des prix »
(texte, facultatif), imprimé avec la formule dans l'art. 9.3 quand il est renseigné ; vide, la phrase d'actualisation ne s'imprime
pas.

> ⚠️ **2026-10-15, livré : `B05-PM-06`**, condition `ACTUALISATION`. La formule mal extraite du type
> (« Indice n P n = Po () Indice o ») est réécrite `Pn = Po × (Indice n / Indice o)`, et « L'indice retenu est : … »
> suit les définitions. Le champ est servi aux deux catégories du contrat-cadre.

## B4 — Le minimum du contrat-cadre

Le type distingue le contrat-cadre **avec ou sans minimum en quantité ou en valeur** : la phrase de l'art. 18.1 « La résiliation
n'ouvrira droit au profit du titulaire à aucune indemnité » est « à supprimer si le contrat-cadre prévoit un minimum ». La fiche
ne porte que le **montant indicatif** (`B05-MT-01`, `B05-MT-02`). Proposition : un champ « Minimum du contrat-cadre » (montant,
facultatif ; ou quantité minimale par article, si le pilote le préfère), imprimé à l'art. 8 (montant) et qui retire la phrase de
l'art. 18.1 quand il est renseigné.

> ⚠️ **2026-10-15, livré en montant : `B05-MT-03`** (Ariary HT, facultatif, `MONTANT_POSITIF`), conditions `MINIMUM` et
> `SANS-MINIMUM`. Le décret n° 2019-1064, art. 34, dit que l'acheteur « n'est pas tenu » de s'engager sur un minimum :
> c'est une faculté, pas une interdiction. L'art. 8 devient alors « conclu avec un minimum de … H.T. et sans maximum ».
> La quantité minimale par article n'est pas faite ; elle attend le pilote s'il la préfère.

## B5 — L'en-tête de l'acheteur

Le type ouvre chaque document par « <Insérer l'en-tête de l'Acheteur> » (DPAC, AE, lettre d'invitation, avis). L'application
n'imprime que l'autorité contractante (`B01-AC-01`) et sa localité (`B01-AC-02`). Le **courriel** et le **téléphone** de la PRMP
sont repris du plan (`B01-AC-06`, `B01-AC-07`) mais aucun document ne les imprime ; l'**adresse postale complète** (rue, boîte
postale) n'existe nulle part. Proposition : un champ « Adresse postale de l'autorité contractante » (au niveau de l'entité
contractante plutôt que de chaque fiche, si le référentiel des entités s'y prête), et un en-tête commun aux documents produits :
autorité, PRMP, adresse postale, courriel, téléphone.

> ⚠️ **2026-10-15, livré sans champ nouveau.** `B01-AC-02` est déjà « Adresse de l'autorité contractante ». Il est lu sur
> l'entité (`tr_entite_contract.ADRESSE`), au niveau voulu, et non sur chaque fiche. Sur DBPRS20, cette adresse n'est
> le plus souvent qu'une localité (« Antananarivo », « Anosy »), d'où la lecture du front ; c'est à l'Administrateur de
> la compléter.
>
> L'en-tête de DPAC-CC et d'AE-CC imprime l'autorité, son adresse, « Personne responsable des marchés publics : … » et
> « Courriel : … – Téléphone : … ». Une valeur absente s'imprime en pointillés. L'avis et la lettre d'invitation ne
> sont pas touchés, conformément à H3.

## Question au pilote — les marchés subséquents

L'annexe 1 du type est la **lettre d'invitation pour le marché subséquent** (numéro et date du contrat-cadre, échéance de remise,
délai d'exécution, validité des offres, critères). Plus largement, l'application s'arrête à l'attribution du contrat-cadre : les
remises en concurrence des titulaires et les bons de commande n'y existent pas. Faut-il ouvrir ce chantier (production de la
lettre d'invitation, suivi des marchés subséquents et des bons de commande) ? Aucun travail n'est demandé avant la réponse.

> ⚠️ **15/10 — tranché par le pilote : le chantier est ouvert**, en se référant à la loi n° 2016-055 (art. 13, 30, 33, 67). La
> suite est portée par `demande-backend-2026-10-15-marches-subsequents.md`.

> ⚠️ **2026-10-15 — livré avec cette demande : Q2 de `marches-subsequents`.** Le champ porte le code `B07-MA-07`, en
> texte long, obligatoire en multi-attributaire. Il s'imprime à l'**article 4** de l'AE-CC, avec les **deux** clauses
> que l'article 23 du décret impose au contrat-cadre : la déliaison de l'exclusivité à plus de 30 % du prix moyen, et
> la résiliation en cas d'absence répétée d'offres raisonnables. Le texte suit le décret, relu sur
> `D2019-1064-VF.pdf`.
>
> Côté banc : AE-CC compte 56 conditions et DPAC-CC 18. `modeles/AE-CC.txt` et `DPAC-CC.txt` sont à resynchroniser.

## Hypothèses

- H1 — Les fiches et les documents existants ne sont pas réécrits ; un champ retiré du formulaire garde sa valeur en base.
- H2 — Les champs ajoutés (B3, B4, B5) sont facultatifs : une fiche validée avant reste valide.
- H3 — Les autres catégories (DPAO-F, DPAO-T, DPIC) méritent le même balayage ; ce document ne porte que sur le contrat-cadre de
  fournitures.

## Ce que le front fera

Le formulaire est servi par le référentiel : un champ ajouté ou retiré apparaît ou disparaît sans code de l'écran. Le front
mettra à jour le banc de lecture (`scripts/import-dao/banc.mjs`, `modeles/*.json`) et regénérera le DAO de recette du
contrat-cadre.

> ✅ **Front, 2026-10-15 — après la livraison 300a93f** :
> - Le formulaire suit le référentiel servi : rien à coder à l'écran (20 champs retirés, 3 créés, `B08-FP-05` obligatoire).
> - Banc de lecture : `AE-CC` et `DPAC-CC` resynchronisés sur le serveur par `scripts/modeles-dao/resynchroniser.mjs` (recopie le
>   `.txt`, régénère `conditions` et `blocs` du `.json` ; contrôle `--verifier` : identique sur les 9 modèles inchangés). Critère Q10
>   tenu, propre et bruité (graine 6), 0 réponse déduite fausse. Rappel AE-CC : 80 % avec avance (« oui »), 97 % sans (« non ») —
>   contre 100 % / 77 % avant : avec l'article 10 désormais toujours imprimé, les valeurs des articles 12 à 15 (`B09-EA-02`,
>   `B09-GP-02/03`, `B08-FP-01/02/04/05`) ne sont plus relues quand la fiche prévoit une avance. Aucune valeur fausse ; à examiner
>   côté lecture si le pilote importe des contrats-cadres avec avance.
> - DAO de recette du contrat-cadre (ligne 303339) regénéré sur les nouveaux modèles : en-tête complet, indice d'actualisation,
>   article 15.1 corrigé ; relu 40/40 (DPAC) et 28/28 (AE), aucune valeur fausse.
