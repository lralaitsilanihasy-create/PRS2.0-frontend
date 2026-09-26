# Modèles du candidat — les six, à relire

*26/09/2026. Décalques de **A1, A2, A3, A4, C1 et C2**, pages 23 à 34 du dossier `AOO n° 2463-MI/MESupReS/PRMP/UGPM.2026`.*
*⚠️ **Rien n'est en production** : le gabarit provisoire filigrané reste en place jusqu'à votre relecture.*

## Ce que vous avez sous la main

| fichier | quoi | pages | fidélité |
|---|---|---|---|
| `A1.docx` | Identification du candidat — trois volets a, b, c | 23-25 | identique, 2 651 car. |
| `A2.docx` | Capacités techniques — deux volets a, b | 26-27 | identique, 515 car. |
| `A3.docx` | Capacités financières — trois volets a, b, c | 28-30 | identique, 2 190 car. |
| `A4.docx` | Antécédents pour des marchés de même nature | 31 | identique, 443 car. |
| `C1.docx` | Modèle de garantie bancaire de soumission | 33 | identique, 2 119 car. |
| `C2.docx` | Modèle de caution personnelle et solidaire de soumission | 34 | identique, 2 790 car. |

**Fidélité vérifiée, et pas seulement affirmée.** Le texte de chaque `.docx` est relu par POI dans l'ordre du
document (tableaux compris), puis comparé caractère par caractère au texte des pages correspondantes du PDF,
extrait **sans perte** (`pdftotext -raw -nodiag`, qui écarte le filigrane diagonal et rien d'autre). Les jetons de
champ sont rejoués sur la source avant comparaison — un champ substitué n'est pas un écart ; les marqueurs ajoutés
(`{{SI:…}}`) sont retirés du produit. La comparaison ne neutralise que ce qui n'a pas de sens typographique :
espaces, césures du PDF, apostrophes droites ou courbes, tirets, points de suspension, et les glyphes d'une police
de symboles (S6). Accents, majuscules, ponctuation et ordre sont comparés tels quels.

**Le texte n'a jamais été retapé.** Il est lu dans l'extraction et posé tel quel. Ce qui a été écrit à la main,
c'est la structure — où commence un paragraphe, quelles lignes forment un tableau, où se coupe une ligne du PDF qui
porte deux cellules — et la table de correspondance. Chaque ligne de la source est prise par son début, et une
dérive fait échouer le script au lieu de produire un modèle faux.

## Les jetons

`{{CODE}}` = une valeur de la fiche · `{{CODE.lettres}}` = en toutes lettres · `{{CODE.doublet}}` = l'ordinal et son
abrégé (« cent cinquième (105ème) ») · `{{DERIVE.x}}` = calculé par le serveur · `{{SI:…}}` / `{{FINSI:…}}` = une
section conditionnelle, **ajoutée** sans remplacer de texte (N4). **Les blancs du candidat ne sont pas jetonnés** :
ils restent exactement comme la source les imprime.

⚠️ **Deux codes sont proposés, pas encore attribués** : `B03-AJ-01` (durée des antécédents juridiques, défaut 5 ans)
et `B03-AF-01` (durée des antécédents financiers, défaut 3 ans) — les deux champs du besoin N3, au bloc Candidats.
Le backend les fixe ; les modèles suivront.

## Tableaux de correspondance

### A1 — A1 : IDENTIFICATION DU CANDIDAT

*Pages **23, 24, 25** du dossier 2463 · fidélité vérifiée au caractère près.*

| # | ce que la source imprime | devient | ce que c’est | rempli par |
|---|---|---|---|---|
| A1.1 | `N° D’appel d'offre et titre: _________________` | `{{B02-OB-03}}` `{{B02-OB-01}}` | Numéro du dossier d'appel d'offres + Objet de l'appel d'offres | fiche |
| A1.2 | `Certificat d’immatriculation (NIF), Certificat d’existence (Numéro Statistique), Certificat de non faillite.` | `{{B03-CQ-01}}` | Pièces d'identification et situation juridique exigées | fiche |
| A1.3 | `au cours des cinq dernières années` **(×3)** | `{{B03-AJ-01.lettres}}` | la même durée en toutes lettres | serveur |
| A1.4 | `(non applicable)` | `{{A1B.mention}}` | « (non applicable) » quand le cadrage n’autorise pas le groupement, rien sinon | serveur — **N4**, cadrage `groupement` |
| A1.5 | `No d'appel d'offres et titre : ____________________` | `{{B02-OB-03}}` `{{B02-OB-01}}` | Numéro du dossier d'appel d'offres + Objet de l'appel d'offres | fiche |
| A1.6 | `[nombre d’années]` **(×2)** | `{{B03-AJ-01}}` | Durée des antécédents juridiques (années) — **code proposé**, N3 | fiche (défaut administrable : 5) |
| A1.7 | *(rien)* | `{{SI:A1B}}` | marqueur ajouté : ouvre la section des champs de A1-b : **omise** quand le cadrage n’autorise pas le groupement (N4) | serveur |
| A1.8 | *(rien)* | `{{FINSI:A1B}}` | marqueur ajouté : referme cette section | serveur |
| A1.9 | `[numéro de la page]` | *inchangé* | blanc de l’offre | candidat |
| A1.10 | `[nombre total de pages]` | *inchangé* | blanc de l’offre | candidat |
| A1.11 | `[rappel : chaque membre du groupement doit remplir à titre individuel la fiche de renseignement a) ci-dessus]` | *inchangé* | consigne au candidat | candidat |
| A1.12 | `[Le formulaire ci-dessous doit être rempli par le]` | *inchangé* | **consigne tronquée (S5), pas un blanc** | — |
| A1.13 | `[indiquer le montant et pourcentage]` | *inchangé* | blanc de l’offre | candidat |
| A1.14 | 13 pointillé(s) `______` | *inchangés* | blancs de l’offre | candidat |
| A1.15 | 21 intitulé(s) suivi(s) de « : » | *inchangés* | lignes à renseigner | candidat |

- A1-a, A1-c : le **cartouche** (nom, date, n° d’appel d’offres et titre, page x de y) est posé à droite, comme dans la source ; seul le n° et le titre sont pré-remplis.
- A1-b : titre conservé, mention sous le titre, champs entre `{{SI:A1B}}` et `{{FINSI:A1B}}` — c’est le comportement du 2463 (S3).
- A1-c : deux tableaux à quatre colonnes ; « Année » et « Fraction non exécutée du marché » tiennent une même ligne du PDF, séparés sans toucher au texte.
- **S6** — sept lignes des pages 23-25 sont précédées dans la source d’un glyphe d’une police de symboles (`U+F0F0`, une case à cocher ou une puce). La police n’étant pas identifiable, le glyphe n’est pas reproduit : la ligne commence au texte. **À arbitrer** : le remplacer par « ☐ », ou le laisser.

### A2 — A2 : CAPACITES TECHNIQUES

*Pages **26, 27** du dossier 2463 · fidélité vérifiée au caractère près.*

| # | ce que la source imprime | devient | ce que c’est | rempli par |
|---|---|---|---|---|

- A2-a : tableau à quatre colonnes, une ligne d’en-tête reprise mot pour mot ; **six lignes vides** en dessous — leur nombre est un choix de rendu, pas du texte.
- **E6** — la note de A2-b s’ouvre par « [Note : » et **ne se referme jamais**. Reproduite telle quelle.
- **E7** — la même note écrit « cette preuve **peut-être** apportée » (trait d’union) pour « peut être ». Reproduite telle quelle.

### A3 — A3 : CAPACITES FINANCIERES

*Pages **28, 29, 30** du dossier 2463 · fidélité vérifiée au caractère près.*

| # | ce que la source imprime | devient | ce que c’est | rempli par |
|---|---|---|---|---|
| A3.1 | `No. d'appel d'offres et titre : _____________________` **(×2)** | `{{B02-OB-03}}` `{{B02-OB-01}}` | Numéro du dossier d'appel d'offres + Objet de l'appel d'offres | fiche |
| A3.2 | `pour les trois dernières années` | `{{B03-AF-01.lettres}}` | Durée des antécédents financiers, en toutes lettres — **code proposé**, N3 | fiche (défaut administrable : 3) |
| A3.3 | `des bilans des trois années` | `{{B03-AF-01.lettres}}` | Durée des antécédents financiers, en toutes lettres — **code proposé**, N3 | fiche (défaut administrable : 3) |
| A3.4 | *(rien)* | `{{SI:A3B-NATURES}}` | marqueur ajouté : ouvre les lignes du second tableau de A3-b : **régénérées** avec les natures du marché (N4) | serveur |
| A3.5 | *(rien)* | `{{FINSI:A3B-NATURES}}` | marqueur ajouté : referme ces lignes | serveur |
| A3.6 | `[Chaque Candidat doit compléter le formulaire ci-dessous]` | *inchangé* | consigne au candidat | candidat |
| A3.7 | `[numéro de la page]` | *inchangé* | blanc de l’offre | candidat |
| A3.8 | `[nombre total de pages]` | *inchangé* | blanc de l’offre | candidat |
| A3.9 | `[Fournir une note explicative ou tout autre document validé par le commissaire aux comptes ou à défaut par un expert comptable ou tout autre personne qualifiée]` | *inchangé* | consigne au candidat | candidat |
| A3.10 | 4 pointillé(s) `______` | *inchangés* | blancs de l’offre | candidat |

- A3-a : tableau à quatre colonnes ; « Information du bilan » et « Information des comptes de résultats » sont des lignes de sous-titre, comme la source les lit ; **trois** colonnes d’années, **fixes en V1** — aucun jeton ne porte leur nombre (R10).
- A3-b : deux tableaux. Le premier porte les **quatre** natures (Travaux, Fournitures, Services, Prestations intellectuelles), toujours. Le second porte les natures **du marché** — au 2463, Fournitures et Services — entre `{{SI:A3B-NATURES}}` et `{{FINSI:A3B-NATURES}}` (N4).
- A3-c : son titre tient sur deux lignes dans la source, recollées en un paragraphe.

### A4 — A4 – ANTECEDENTS DU CANDIDAT POUR DES MARCHES DE MEME NATURE1

*Page **31** du dossier 2463 · fidélité vérifiée au caractère près.*

| # | ce que la source imprime | devient | ce que c’est | rempli par |
|---|---|---|---|---|
| A4.1 | 2 pointillé(s) `______` | *inchangés* | blancs de l’offre | candidat |

- Tableau à deux colonnes, quatre lignes ; « Lieu d’exécution » et « Date de début : » tiennent une même ligne du PDF, séparés sans toucher au texte. L’appel de note « ¹ » du titre est reproduit sans note (S4).

### C1 — C 1. Modèle de garantie bancaire de soumission

*Page **33** du dossier 2463 · fidélité vérifiée au caractère près.*

| # | ce que la source imprime | devient | ce que c’est | rempli par |
|---|---|---|---|---|
| C1.1 | `(Nom et adresse de l’Acheteur)` | `{{B01-AC-01}}` `{{B01-AC-02}}` | Autorité contractante + Adresse de l'autorité contractante | fiche (PPM) |
| C1.2 | `[titre du Marché]` | `{{B02-OB-03}}` `{{B02-OB-01}}` | Numéro du dossier d'appel d'offres + Objet de l'appel d'offres | fiche |
| C1.3 | `[Nom de l’Organisme ayant lancé l’Appel d’offres]` | `{{B01-AC-01}}` | Autorité contractante | fiche (PPM) |
| C1.4 | `[montant de la garantie en chiffres et en lettres]` **(×2)** | `{{B05-GS-03}}` `{{B05-GS-03.lettres}}` | Garantie de soumission **du lot** + le même montant en toutes lettres | fiche (par lot) + serveur |
| C1.5 | `trentième (30ème)` | `{{DERIVE.delai-garantie.doublet}}` | l’ordinal « trentième (30ème) » | serveur — **N1 + N2**, `B05-GS-04 − B04-VO-01` |
| C1.6 | `cent cinquième (105ème)` | `{{B05-GS-04.doublet}}` | l’ordinal « cent cinquième (105ème) » | serveur — **N1** |
| C1.7 | `[nom du candidat ]` | *inchangé* | blanc de l’offre | candidat |
| C1.8 | `[date]` | *inchangé* | blanc de l’offre | candidat |

### C2 — C 2. Modèle de caution personnelle et solidaire de soumission

*Page **34** du dossier 2463 · fidélité vérifiée au caractère près.*

| # | ce que la source imprime | devient | ce que c’est | rempli par |
|---|---|---|---|---|
| C2.1 | `[date fixée pour la remise des offres]` | `{{B04-LR-03}}` | Date limite de remise des offres | fiche |
| C2.2 | `[date d’expiration de la validité de l’offre]` | `{{DERIVE.fin-validite-offre}}` | fin de validité de l'offre | serveur — **N2**, `B04-LR-03 + B04-VO-01` |
| C2.3 | `[intitulé ou objet résumé du marché et références de l’appel d’offres]` | `{{B02-OB-03}}` `{{B02-OB-01}}` | Numéro du dossier d'appel d'offres + Objet de l'appel d'offres | fiche |
| C2.4 | `[dénomination et adresse complète de l’Autorité contractante]` | `{{B01-AC-01}}` `{{B01-AC-02}}` | Autorité contractante + Adresse de l'autorité contractante | fiche (PPM) |
| C2.5 | `[insérer le montant en chiffres et en lettres de la garantie de soumission]` | `{{B05-GS-03}}` `{{B05-GS-03.lettres}}` | Garantie de soumission **du lot** + le même montant en toutes lettres | fiche (par lot) + serveur |
| C2.6 | `trentième (30ème)` | `{{DERIVE.delai-garantie.doublet}}` | l’ordinal « trentième (30ème) » | serveur — **N1 + N2**, `B05-GS-04 − B04-VO-01` |
| C2.7 | `cent cinquième (105ème)` | `{{B05-GS-04.doublet}}` | l’ordinal « cent cinquième (105ème) » | serveur — **N1** |
| C2.8 | `[indiquer la dénomination sociale dénomination sociale de la banque ou de l’organisme de caution, et le siège social]` | *inchangé* | blanc de l’offre | candidat |
| C2.9 | `[indiquer le nom et l’adresse complète du Candidat]` | *inchangé* | blanc de l’offre | candidat |
| C2.10 | `[Lieu d’établissement de l’engagement]` | *inchangé* | blanc de l’offre | candidat |
| C2.11 | `[date d’établissement de l’engagement]` | *inchangé* | blanc de l’offre | candidat |
| C2.12 | 1 pointillé(s) `______` | *inchangés* | blancs de l’offre | candidat |
| C2.13 | 2 intitulé(s) suivi(s) de « : » | *inchangés* | lignes à renseigner | candidat |
## Ce que ces six modèles demandent au serveur

| besoin | où |
|---|---|
| **N1** — l'ordinal et son abrégé | C1, C2 : `{{B05-GS-04.doublet}}` et `{{DERIVE.delai-garantie.doublet}}`, deux fois chacun |
| **N2** — les dérivés | C1, C2 : délai de garantie (`B05-GS-04 − B04-VO-01`), fin de validité de l'offre (`B04-LR-03 + B04-VO-01`) |
| **N3** — deux durées d'antécédents | A1 (×5 occurrences), A3 (×2) — codes proposés `B03-AJ-01`, `B03-AF-01` |
| **N4** — deux sections conditionnelles | A1-b (`{{SI:A1B}}`, `{{A1B.mention}}`), A3-b (`{{SI:A3B-NATURES}}`) |
| **N5** — *rien* | l'adresse existe déjà : `B01-AC-02` |

## Deux précisions venues de la relecture du backend (26/09)

- **A1 à A4 se produisent une fois par dossier**, pas par lot : la source ne mentionne aucun lot dans ces fiches, et un candidat qui vise deux lots ne remplit qu'une fiche d'identification. **C1 et C2 restent par lot.** À confirmer par le pilote (R11).
- **Un jeton vide s'imprime en pointillés « ……… »**, pour que le papier reste remplissable ; `B02-OB-03` (numéro de l'AOO) devient obligatoire, pour ne jamais imprimer « — Objet… » (R1, R2).

## Constats pour l'errata, et un arbitrage

Trois constats de plus, en relisant lettre à lettre — **reproduits tels quels**, comme les cinq premiers :

| # | constat | page |
|---|---|---|
| **E5** | C2 répète un membre de phrase : « [indiquer la dénomination sociale **dénomination sociale** de la banque… ] » | 34 |
| **E6** | la note de A2-b s'ouvre par « [Note : » et **ne se referme jamais** | 27 |
| **E7** | la même note écrit « cette preuve **peut-être** apportée » pour « peut être » | 27 |

**S6 — à arbitrer.** Sept lignes des pages 23-25 sont précédées, dans la source, d'un glyphe d'une police de
symboles (`U+F0F0`) : la case à cocher, ou la puce, du formulaire — « Il n'y a pas eu de non-exécution… »,
« Marché(s) non exécuté(s)… », « Pas de litige en instance », « Litige(s) en instance: », la liste des certificats
de A1-a, les deux pointillés de A1-b. La police n'étant pas identifiable, le glyphe n'est pas reproduit : la ligne
commence au texte. Deux issues : le remplacer par « ☐ » (une interprétation), ou le laisser absent (une perte).
