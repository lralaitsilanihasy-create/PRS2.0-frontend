# Demande backend — 2026-10-18 — Le DAO d'une procédure en remise électronique

## Contexte

Recette du 18/10 sur la première fiche validée en **remise électronique** : « Fourniture d'articles de bureau (contrat-cadre) »,
ligne 303337, fiche version 2, procédure n° 12-CC/MEF/SG/PRMP.2027, dossier 00002/DAOO-CC/CNM/2026 clôturé, cérémonie des clés close,
avis imprimé le 18/10 (publication au 01/02/2027). La procédure paraît dans l'espace candidat.

Le pilote a demandé de confronter la page du candidat (`/candidat/procedures/{idDmc}`) au DAO complet et à l'avis que cette page
propose au téléchargement. **La page dit ce que fait la plateforme ; le DAO et l'avis disent le papier.**

### Ce que le DAO généré (v2) et l'avis imprimé disent

| Donnée de la page (lue sur la fiche) | DAO complet (DPAC-CC) | Avis spécifique |
|---|---|---|
| Référence `00001/PPM-AGPM/CNM/2026` | n° `12-CC/MEF/SG/PRMP.2027` | n° `12-CC/MEF/SG/PRMP.2027` |
| Retrait du dossier **en ligne**, après reçu validé | art. 3.3 : « retiré auprès du Secrétariat de la PRMP, porte 07 … du lundi au vendredi de 9 heures à 15 heures » (`B04-DS-04`) | §4-5 : consultation et retrait au secrétariat |
| Dépôt **sur la plateforme**, remplacement autorisé (`B04-SE-10`) | art. 5.1 « Transmission sous support papier » imprimé en entier : original et deux copies, pli cacheté, adresse du secrétariat (`B04-RQ-01/02/03`) | §6 : « Les plis devront parvenir au Secrétariat … et seront ouverts … en présence des candidats » |
| Heure de référence, signature, formats, tailles, assistance, prorogation (`B04-SE-04…16`) | art. 5.2 : **« [[CLAUSE À FOURNIR PAR LE JURISTE : … ]] »**, suivi de la clause de re-matérialisation et de la clause de l'art. 31 | §7 : « La soumission des offres par voie électronique **sera autorisée** » |
| Ouverture des dépôts le 01/02/2027 à 08:00 (`B04-SE-03`) | absente | absente |
| Séance d'ouverture **en ligne**, lien de suivi, 30 minutes, PV publié (`B04-OP-10…13`) | art. 6.1.1 : séance publique, « les candidats ou leurs représentants sont admis à y assister » ; les quatre champs ne sont pas imprimés | « ouverts … en présence des candidats » |
| Questions recevables jusqu'à **10 jours** avant la date limite (art. 35-II, R7) | « au plus tard **7 jours** avant la date limite » (texte du modèle) ; modifications de détail « 6 jours avant » | — |
| Frais 150 000 Ar, compte de l'ARMP non publié | art. 3.3 : « 150 000 Ariary à verser sur le compte bancaire de l'ARMP : ……… » | §5 : idem |

Les dates, les montants et l'objet sont justes. Tout ce qui touche au **canal** — retrait, dépôt, ouverture, questions — est contredit
par le document que le candidat télécharge.

### La cause

Dans le référentiel des champs (`GET /api/champs-fiche-marche?typeMarche=CONTRAT_CADRE&categorie=FOURNITURES_SERVICES`) :

- `B04-SE-02…17` et `B04-OP-10…13` sont conditionnés à `modeRemise = ELECTRONIQUE` ;
- `B04-RQ-01`, `B04-RQ-02`, `B04-RQ-03` (remise papier) et `B04-DS-04`, `B04-DS-07…11` (retrait et consultation au guichet) n'ont
  **aucune condition** : ils s'impriment dans les deux modes ;
- les délais « 7 jours » (informations complémentaires) et « 6 jours » (modifications de détail) sont écrits en dur dans le modèle
  DPAC-CC ;
- l'article 5.2 du modèle porte le texte de réserve `[[CLAUSE À FOURNIR PAR LE JURISTE …]]`, qui reprend les valeurs des champs
  `B04-SE` sans les rédiger.

> ⚠️ **2026-10-18, correction (backend)** — seul le « 6 jours » est écrit au modèle. Le « 7 jours » est la valeur saisie de
> `B04-RC-02` sur la fiche (voir B5).

La question du pilote : **le DAO papier est-il encore nécessaire dans la soumission électronique ?** Réponse proposée : le DAO
(le document) reste nécessaire, c'est lui qui porte le règlement, les pièces, le bordereau, les spécifications et le CCAP ; ses
**clauses papier** (original et copies, pli cacheté, dépôt et retrait au secrétariat, séance en salle) n'ont plus d'objet quand le mode
figé est électronique. Restent légitimes, après l'attribution : la re-matérialisation des pièces contractuelles et l'original signé de
l'acte d'engagement (clause du juriste, déjà dans le DAO).

## B1 — Les clauses papier ne s'impriment qu'en remise papier

Conditionner `B04-RQ-01`, `B04-RQ-02`, `B04-RQ-03`, `B04-DS-04` et `B04-DS-07…11` à **`modeRemise = PAPIER`** (référentiel et bilan
des contrôles : ils ne sont plus attendus ni comptés en électronique). Dans le modèle DPAC-CC, l'article 5.1 « Transmission sous support
papier » et les articles 3.2-3.3 (consultation et retrait au guichet) deviennent une section `{{SI:…}}` du mode papier.

En électronique, l'article 3.3 dit que le dossier se retire **sur la plateforme** (`B04-SE-02`), après validation du reçu des frais quand
le dossier est payant (`B04-DS-05`), et l'article 3.2 que le dossier s'y consulte. Si le modèle a besoin d'une adresse de contact, c'est
celle de l'assistance (`B04-SE-14`).

Même traitement pour les modèles **DPAO** (fournitures et travaux) et **DPIC**, qui portent les mêmes clauses.

> ⚠️ **2026-10-18, livré (backend), avec deux écarts**
> - **La condition est `modeRemise != ELECTRONIQUE`**, pas `= PAPIER` : une fiche sans mode est papier, et `= PAPIER` y serait faux.
>   Elle porte sur `B04-RQ-01/02/03`, `B04-DS-04` et `B04-DS-07/08/09/11` (contrat-cadre), `B04-RO-01/02` (fournitures),
>   `B04-FP-01/02` (travaux) et `B04-FL-01/02` (prestations intellectuelles). En électronique, ces champs ne sont ni servis, ni
>   attendus au bilan, ni imprimés. Les valeurs déjà saisies restent en base et sont simplement fermées.
> - **Premier écart : `B04-DS-10` (localité) n'est pas conditionné.** Il date la signature de l'avis et de la lettre AOR (« à …, le
>   … ») dans les deux modes. Il ne s'imprime plus au DPAC en électronique.
> - **Second écart : quatre champs papier restent ouverts.** `B04-LR-02` est aussi le lieu de remise de l'original de la garantie
>   en électronique. `B04-OP-01…03` et `B04-OV-01/02` sont lus par les échéances de la remise électronique.
> - **Modèles.** DPAC 3.2-3.3 (consultation, retrait), 5.1 (pli), 6.1.1 et 10 ; DPAO 5.2 (adresse), 7.1 (forme des plis), 7.2
>   (adresse de remise) et 8 ; DPIC 5.2, 8.1 et 8.2. Chacun a une section `{{SI:PAPIER}}` et une section `{{SI:B04-SE}}`.
> - **En électronique**, le dossier se consulte et se retire sur la plateforme, « une fois le reçu de son versement validé ». L'art.
>   5.1 du DPAC dit que la transmission sous support papier n'est pas admise. Le DAO ne donne pas d'adresse de contact : la
>   clause B2 cite l'assistance.
> - **Le référentiel de recette** est aligné par `PRS20/docs/referentiel/2026-10-18-dao-electronique.sql`.

## B2 — L'article 5.2 rédigé, à partir des champs saisis

Remplacer le texte de réserve par une clause rédigée (**rédaction du juriste**), qui prend ses valeurs dans les champs :
plateforme (`B04-SE-02`), ouverture des dépôts (`B04-SE-03`), heure de référence (`B04-SE-04`), signature exigée (`B04-SE-05`, et
`B04-SE-06` si elle est avancée ou qualifiée), formats (`B04-SE-07`), tailles (`B04-SE-08`, `B04-SE-09`), remplacement et retrait
(`B04-SE-10`), copie de sauvegarde (`B04-SE-11`), indisponibilité et prorogation (`B04-SE-12`, `B04-SE-13`, `B04-SE-16`), assistance
(`B04-SE-14`, `B04-SE-15`). La clause dit que la remise électronique est le **seul** mode de remise de la procédure.

Les clauses de re-matérialisation et de l'art. 31 restent à leur place.

> ⚠️ **2026-10-18, livré (backend), rédaction provisoire (Q1)** — la réserve est remplacée dans DPAC 5.2, DPAO 7.3 et DPIC 8.3 (« les
> Propositions »). La clause compte une phrase par champ :
> - « La remise électronique est le seul mode de remise des offres de la présente consultation : aucun pli sous support papier
>   n'est reçu. Les offres sont déposées sur la plateforme de dépôt : {`B04-SE-02`}. » ;
> - l'ouverture des dépôts (`B04-SE-03`, si saisie) ;
> - l'heure de référence, et l'heure de la plateforme qui fait foi : un dépôt inachevé à l'heure limite n'est pas recevable ;
> - le niveau de signature, et les prestataires (`B04-SE-06`, si saisis) ;
> - les formats et les tailles ;
> - le remplacement ou le retrait jusqu'à l'heure limite, ou leur interdiction (`B04-SE-10`) ;
> - la copie de sauvegarde (`B04-SE-11`, sauf « Non ») ;
> - la prorogation : « Si la plateforme est indisponible pendant plus de {`SE-12`} heures au cours des {`SE-16`} heures qui précèdent
>   la date limite, cette date est prorogée de {`SE-13`} jours ouvrables » ;
> - l'assistance (`B04-SE-14`), et la date limite des demandes d'assistance (`B04-SE-15`, si saisie).
>
> Les clauses de re-matérialisation et de l'art. 31 suivent, inchangées.

## B3 — La séance d'ouverture en ligne

À l'article 6.1.1 (et à l'article des IC sur l'ouverture des plis, s'il est repris), en mode électronique : la séance se tient selon
`B04-OP-10` (présentiel, en ligne, mixte), avec le lien de suivi (`B04-OP-11`), à l'heure limite plus `B04-OP-12` minutes, et le
procès-verbal est publié sur la plateforme si `B04-OP-13 = OUI`. Les mentions « enveloppes marquées RETRAIT / REMPLACEMENT / MODIFICATION
ouvertes à haute voix » sont propres au papier : section du mode papier.

> ⚠️ **2026-10-18, livré (backend), avec un écart**
> - DPAC 6.1.1 et DPAO 8, en électronique : les offres déposées sur la plateforme sont ouvertes en séance après l'heure limite.
>   Suivent, chacune seulement si son champ est saisi, quatre phrases : « La séance d'ouverture se tient {`B04-OP-12`} minutes après
>   l'heure limite », « Modalité de la séance : {`B04-OP-10`} », le lien de suivi `B04-OP-11`, et « Le procès-verbal de la séance est
>   publié sur la plateforme » si `B04-OP-13 = OUI`.
> - Le DPAO dit aussi le lieu de la séance « lorsqu'elle se tient en présentiel » (`B04-OP-01`, travaux `B04-OV-01`). La séance
>   publique « en présence des candidats » passe en section papier.
> - Les champs `B04-OP-10…13` ne sont ouverts qu'aux **fournitures** : en travaux, seules restent la phrase d'ouverture et le lieu.
> - **Écart** : les mentions « enveloppes RETRAIT / REMPLACEMENT / MODIFICATION » sont dans les **IC**, des textes fixes du DAO complet
>   que le moteur ne peut pas conditionner. Elles restent. Le DPIC n'a pas d'article d'ouverture dans ses données particulières :
>   il n'est pas touché.

## B4 — L'avis spécifique aligné sur le mode

En mode électronique :

- **§4-5** : le dossier se consulte et se retire sur la plateforme (adresse `B04-SE-02`), après paiement des frais le cas échéant ;
- **§6** : « Les offres sont déposées sur la plateforme … au plus tard le {date limite} ({heure de référence}) ; les dépôts sont
  ouverts à compter du {`B04-SE-03`}. La séance d'ouverture se tient {selon `B04-OP-10`} … » — plus de plis au secrétariat ni de
  séance « en présence des candidats » ;
- **§7** : la remise électronique est **exclusive** (« La remise des offres se fait exclusivement par voie électronique »), et non
  « autorisée ».

Le front n'a rien à changer : l'avis est produit par le serveur.

> ⚠️ **2026-10-18, livré (backend)** — `AVIS-F` et `AVIS-T`, en électronique :
> - **§4** : le dossier « peut être consulté par tout candidat sur la plateforme de dépôt des offres : {`B04-SE-02`} ».
> - **§5** : il « est retiré sur la plateforme de dépôt des offres, une fois le reçu du versement validé, moyennant le paiement… ».
> - **§6** : « Les offres sont déposées sur la plateforme de dépôt ({`B04-SE-02`}) au plus tard le {date limite} (heure de référence :
>   {`B04-SE-04`}) », puis l'ouverture des dépôts (`B04-SE-03`), l'ouverture en séance et les phrases de B3.
> - **§7** : « La remise des offres se fait exclusivement par voie électronique, sur la plateforme de dépôt : … ».
>
> En papier, l'avis ne change pas. **`LETTRE-AOR`** est aligné de la même façon : consultation, retrait, dépôt.
>
> Les mentions `ADRESSE_CONSULTATION`, `ADRESSE_RETRAIT`, `DATE_HEURE_LIMITE` et `HEURE_OUVERTURE` (`…/mentions`, avis en données)
> se lisent aussi sur ces phrases. La localité `B04-DS-10` reste ouverte dans les deux modes : elle date la signature (« à …, le … »).

## B5 — Le délai des questions

Le DPAC dit « 7 jours avant la date limite » ; la plateforme clôt les questions **10 jours** avant (art. 35-II, `DelaisLegaux` n° 3,
R7). Proposition : le modèle lit le délai légal (ou un champ dédié, au choix du backend) plutôt qu'un nombre écrit en dur, et dit que les
questions se posent **sur la plateforme** quand le mode est électronique. Même question pour les « 6 jours » des modifications de
détail, s'il existe un délai légal correspondant.

> ⚠️ **2026-10-18, livré (backend), avec un écart**
> - **Le « 7 jours » n'est pas écrit au modèle.** C'est la valeur saisie de `B04-RC-02` : l'article 10 du DPAC imprime « au plus
>   tard {{B04-RC-02}} jours avant la date limite ». Le libellé du champ était trompeur (« délai de réponse »). Il devient « Délai
>   d'envoi des demandes d'informations (jours avant la date limite) ».
> - Plutôt qu'un délai fixé par le modèle, le champ reste et une **règle bloquante `DELAI_QUESTIONS`** (rôle `DELAI`) l'encadre. Elle
>   s'applique à `B04-RC-02` (contrat-cadre), `B04-DE-02` (fournitures), `B04-EQ-01` (travaux) et `B04-EP-03` (prestations
>   intellectuelles). Au-dessous du délai légal n° 3 (10 jours, art. 35-II), la validation est bloquée, avec un message qui donne
>   les deux délais. À 10 jours ou plus, la règle passe en `ok`.
> - En électronique, la question se pose **sur la plateforme** : DPAC art. 10, DPAO et DPIC 5.2, où l'adresse passe en section
>   papier.
> - **Les « 6 jours »** des modifications de détail (DPAC 3.4) restent écrits au modèle : aucun délai légal ne leur correspond.
> - ⚠️ En recette, les **7 fiches validées** du contrat-cadre portent 7 jours. Elles ne sont pas réévaluées : leur prochaine
>   révision devra passer à 10 jours.

## B6 — Le numéro de la procédure servi au candidat

`ProcedureEnLigneDto.reference` vaut « `B02-OB-03`, à défaut la référence du plan » : pour un contrat-cadre, `B02-OB-03` n'existe pas et
le candidat lit `00001/PPM-AGPM/CNM/2026`, alors que le DAO et l'avis portent `12-CC/MEF/SG/PRMP.2027`. Appliquer la règle **R1** du DAO
complet (recette du 16/10) : `B02-OE-01`, puis `B02-OB-03`, puis le plan — sur `GET /api/procedures-en-ligne` et `/{idDmc}`, et sur
les listes de la CAO (`/api/cao/mes-procedures`) et du dépositaire (`/api/depositaire/procedures`), qui montrent la même référence du
plan.

> ⚠️ **2026-10-18, livré (backend)** — `reference` suit la règle R1 : d'abord `B02-OE-01` pour un contrat-cadre, puis `B02-OB-03`, et
> à défaut la référence du plan. Le changement est fait dans la vue de la procédure, que reprennent `GET /api/procedures-en-ligne`,
> `/{idDmc}`, `/api/cao/mes-procedures`, `/api/depositaire/procedures` et les invitations. Pour la fiche des articles de bureau, la
> référence devient `12-CC/MEF/SG/PRMP.2027`.

## Questions

- **Q1 (juriste)** — la rédaction de l'article 5.2 (B2) et de l'avis (B4) : le front propose les champs, le juriste les phrases.
- **Q2** — les **fiches déjà validées** en électronique (une seule en recette, les articles de bureau) : leur DAO complet est figé
  (charte, §B6 : pas de migration de rattrapage). Une révision validée après la livraison suffit-elle à régénérer le DAO corrigé ? Pour
  une fiche dont le dossier est clôturé, la révision est refusée (`DOSSIER_EN_EXAMEN`) : faut-il une voie de régénération du DAO sans
  révision, ou accepte-t-on que les procédures lancées avant la livraison gardent leur DAO ?
- **Q3** — en mode électronique, les pièces de l'offre citées à l'article 4 (acte d'engagement **signé**, bordereau **renseigné**,
  catalogues) : le DAO doit-il dire qu'elles sont déposées en fichiers et que la soumission par la plateforme vaut signature (art. 31,
  déjà écrit à l'article 5.2) ? Ou la clause existante suffit-elle ?
- **Q4** — le compte de l'ARMP non réglé par l'Administrateur imprime « ……… » dans le DAO et dans l'avis. Faut-il **refuser
  l'impression de l'avis** tant que le compte n'est pas réglé quand le dossier est payant (`B04-DS-05 > 0`), comme on refuse sans
  publication de l'AGPM ? Le front le signale déjà au candidat (page de la procédure, 18/10).

> ⚠️ **2026-10-18, réponses (backend)**
> - **Q1 — rédaction provisoire, à valider par le juriste.** La clause de l'article 5.2 (DPAO 7.3, DPIC 8.3) et les phrases de
>   l'avis ont été rédigées par le backend, une phrase par champ, en s'en tenant aux faits que les champs disent. La réserve
>   `[[CLAUSE À FOURNIR PAR LE JURISTE]]` a disparu des DAO. Le juriste corrige les phrases dans les modèles, sans toucher aux
>   jetons. Les modèles candidat C1/C2 gardent leur réserve : ils ne faisaient pas partie de la demande.
> - **Q2 — les procédures lancées gardent leur DAO.** Il n'existe pas de voie de régénération. Le DAO de la fiche 9 a été retiré par
>   les candidats et son avis est imprimé : le régénérer reviendrait à modifier le dossier après publication, hors de la procédure
>   de l'art. 3.4. Pour une fiche dont le dossier n'est pas clôturé, une révision validée après la livraison produit le DAO
>   corrigé.
> - **Q3 — une phrase ajoutée.** En électronique, l'art. 4 du DPAC dit que les pièces sont déposées en fichiers sur la plateforme et
>   que la soumission par la plateforme vaut signature, dans les conditions de l'art. 5.2. L'art. 31 reste à l'article 5.2.
> - **Q4 — oui.** Un dossier payant (`B04-DS-05`, unique ou par lot, positif) dont le compte de l'ARMP n'est pas réglé n'imprime ni
>   avis ni lettre AOR : 409 `AVIS_INDISPONIBLE`, `details.raison` = **`COMPTE_ARMP_ABSENT`**, aussi servie par `…/disponibilite` et
>   `impressionAvis`. Le réglage du compte (`PUT /api/parametres/compte-dao`) est relevé avant et après, comme les autres écritures :
>   les fiches qu'il rend imprimables envoient `AVIS_A_IMPRIMER` à leur PRMP et à ses UGPM. ⚠️ **En recette, le compte n'est pas
>   réglé** : tout dossier payant devient indisponible jusqu'à son réglage par l'Administrateur.

## Côté front

Rien à coder : la page du candidat lit la fiche et dit ce que fait la plateforme. À la livraison de B6, la référence affichée suivra le
serveur sans changement ; à celle de B1-B5, les documents téléchargés seront cohérents avec la page.

> ⚠️ **2026-10-18, livré (backend)** — une chose reste à faire côté front : **resynchroniser les copies des modèles** `DPAC-CC`,
> `DPAO-F`, `DPAO-T`, `DPIC-PI`, `AVIS-F`, `AVIS-T` et `LETTRE-AOR` (`scripts/modeles-dao/modeles`), ainsi que les **fichiers de
> correspondance** : conditions de B1, contrôle `DELAI_QUESTIONS:DELAI` et libellé de `B04-RC-02` (B5). Le backend a modifié les
> modèles en premier, comme le 15/10. L'écran de la fiche n'a rien à coder : les champs papier disparaissent d'eux-mêmes en
> électronique, puisque le référentiel les sert avec leur condition. Le nouveau contrôle bloquant arrive dans `bilanControles`
> comme les autres.
