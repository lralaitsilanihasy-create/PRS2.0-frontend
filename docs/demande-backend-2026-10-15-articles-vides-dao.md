# Demande backend — 2026-10-15 — des articles du DAO s'impriment vides

## Contexte

Le pilote a fait comparer un DAO de contrat-cadre rédigé sur les modèles de l'application (ligne 303339, « Fourniture de
consommables informatiques », fiche DMC 1) au document type ARMP « Contrat-cadre — Fournitures et prestations de services »
(2019, `Documents Types/Fournitures et services/`). Le corps est fidèle au type : les 12 articles du règlement de la consultation et
les 20 articles de l'acte d'engagement valant CCAP, avec la seule option retenue de chaque « Choix ».

Un défaut ressort : **l'article 10 de l'AE-CC (« Clauses de financement et de sûreté ») s'imprime avec son titre et rien
dessous** quand la fiche ne prévoit pas d'avance. Tout son contenu est sous `{{SI:AVANCE}}` (`avance = OUI`) et
`{{SI:AVANCE-SOUS-TRAITANT}}` (`B08-FI-05 = OUI`) ; les deux fausses, il ne reste que le titre. Le modèle du serveur
(`src/main/resources/modeles/dao/AE-CC.txt`) a la même condition : les DAO produits par l'application ont donc le même défaut.

Le front a balayé les modèles du serveur : un article dont **tout** le contenu est conditionnel, sans condition complémentaire
qui imprimerait autre chose, peut sortir vide de la même façon.

| Modèle | Article | Condition(s) | Vide quand |
|---|---|---|---|
| AE-CC | 10 – Clauses de financement et de sûreté | `AVANCE` (`avance = OUI`), `AVANCE-SOUS-TRAITANT` (`B08-FI-05 = OUI`) | pas d'avance |
| CCAP-F | 15 – Emballage | `MARQUAGE` (`B09-EM-01 renseigne`), `DOCUMENTS-EMBALLAGE` (`B09-EM-02 renseigne`) | les deux champs vides |
| CCAP-F | 23 – Indemnité de résiliation | `INDEMNITE` (`B10-IR-01 = OUI`) | `B10-IR-01 = NON` |
| CCAP-T | 3 – Estimations des engagements financiers | `ESTIMATIONS` (`B08-EF-01 renseigne`) | champ vide |
| CCAP-T | 5 – Marchés à tranches conditionnelles | `TRANCHES` (`tranches = OUI`) | sans tranches |
| CPS-PI | 14 – Fourniture de matériel par le consultant | `FOURNITURE-MATERIEL` (`B09-FC-01 renseigne`) | champ vide |
| CPS-PI | 15 – Délai d'exécution | `DEPART-OS` (`B09-DP-01 = OUI`) | `B09-DP-01 ≠ OUI` |
| CPS-PI | 19 – Indemnisation en cas de résiliation | `INDEMNITE` (`B10-IN-01 renseigne`) | champ vide |
| CPS-PI | 10 – Modalités de règlement des comptes | `REGLEMENT-COURT`, `-TEMPS`, `-ETAPES` (chacun `renseigne`) | les trois vides |

(Balayage par lecture des modèles, à confirmer : un paragraphe libre hors condition, ou une condition qui couvre l'autre cas,
retire l'article de la liste.)

> ⚠️ **2026-10-15, livraison backend : balayage confirmé et élargi.** J'ai rendu les quinze modèles avec une fiche **vide**
> (cadrage à `NON`, aucune valeur saisie). Cela confirme les neuf lignes du tableau. D'autres articles reçoivent aussi
> « Sans objet. » quand leurs champs restent vides :
> - AE-CC art. 4 et 14 ;
> - CCAP-F art. 4, 7, 11, 12, 13, 14, 16 et 19 ;
> - AE-F art. 3 ;
> - CPS-PI art. 3 ;
> - CCAP-T art. 4.
>
> Pour l'article 12 du CCAP-F, la mention se place sous le dernier sous-titre (12.2), puisqu'un sous-titre interne ne
> compte pas comme contenu. Rien à faire côté front : la règle est générale (B1).

## B1 — Un article ne s'imprime jamais vide

Au rendu d'un document de la fiche (et du DAO complet), un article (titre `ARTICLE …` ou `Article …`) dont aucun paragraphe
n'est retenu reçoit **« Sans objet. »** sous son titre, comme les articles du type qui le prévoient déjà (AE-CC art. 16
« Assurance », DPAC-CC). Règle générale du moteur, pour tous les modèles, plutôt qu'une section ajoutée à chacun.

## B2 — L'article 10 du contrat-cadre suit le document type

Le type ne rend pas l'avance conditionnelle : « Une avance sera accordée … dans les conditions prévues à l'article 72 du code
des marchés publics, **sauf renonciation expresse** de sa part figurant ci-dessous », suivi des deux cases que **l'entreprise**
coche (souhaite percevoir / renonce), puis 10.2 à 10.5 (délai de versement, montant au plus 20 % du TTC du marché subséquent,
remboursement selon l'article 72.III, avance au sous-traitant). Le choix appartient au titulaire, pas à l'acheteur.

Question au pilote, relayée ici : le cadrage « avance : non » de la fiche doit-il
- (a) imprimer « Sans objet. » (B1) — l'acheteur décide qu'aucune avance n'est versée ;
- (b) ou imprimer la clause du type avec les cases de renonciation — l'avance reste de droit, le titulaire y renonce ou non ?

Le front recommande (b) pour l'AE-CC, qui reproduit le type et l'article 72, la réponse de cadrage ne servant plus qu'aux
documents dont le modèle prévoit vraiment le choix de l'acheteur.

> ⚠️ **2026-10-15, arbitrage : option (b) retenue.** Les conditions `AVANCE` et `AVANCE-SOUS-TRAITANT` sont retirées
> d'`AE-CC.txt` (53 conditions, contre 55 auparavant), et l'article 10 (10.1 à 10.5) s'imprime toujours. Le
> `modeles/AE-CC.txt` du banc doit suivre. Deux conséquences sur le référentiel du contrat-cadre ne sont **pas
> traitées** dans cette livraison :
> 1. Le délai de versement (`B08-FI-02`) et le taux imprimé (`B08-AV-02`, reflet du cadrage `tauxAvance`) ne se
>    saisissent que quand `avance = OUI`. Avec « avance : non », le 10.2 et le 10.3 s'impriment donc en pointillés.
> 2. `B08-FI-05` (avance au sous-traitant) n'est plus lu par aucun document. Selon la règle du 30/09, il devrait sortir de
>    la fiche.
>
> Ces deux points attendent une décision.

## Hypothèses

- H1 — Les documents déjà produits ne sont pas réécrits ; une nouvelle version validée de la fiche les reproduit.
- H2 — La lecture du DAO importé (`LectureDao`) n'est pas touchée : un « Sans objet. » isolé n'atteste aucune section.

## Ce que le front fera

Rien à l'écran : les documents sont produits par le serveur. Le banc de lecture (`scripts/import-dao/banc.mjs`) rendra « Sans
objet. » comme le moteur, pour rester fidèle au rendu.
