# Modèles du candidat — les deux garanties, à relire

*26/09/2026. Décalques de **C1** et **C2**, pages 33 et 34 du dossier `AOO n° 2463-MI/MESupReS/PRMP/UGPM.2026`.*
*⚠️ **Rien n'est en production** : le gabarit provisoire filigrané reste en place jusqu'à votre relecture.*

## Ce que vous avez sous la main

| fichier | quoi |
|---|---|
| `C1.docx` | Modèle de garantie bancaire de soumission |
| `C2.docx` | Modèle de caution personnelle et solidaire de soumission |

**Fidélité vérifiée, et pas seulement affirmée** : le texte des deux `.docx` a été relu par POI, puis comparé
caractère par caractère au texte de la page correspondante du PDF. Résultat : **identique** — 2 119 caractères
pour C1, 2 790 pour C2, aucun écart. La comparaison ne neutralise que ce qui n'a pas de sens typographique
(espaces multiples, césures du PDF, apostrophes droites ou courbes) ; accents, majuscules, ponctuation et ordre
sont comparés tels quels, et les jetons de champ sont rejoués sur la source avant comparaison — un champ
substitué n'est pas un écart.

**Le texte n'a jamais été retapé.** Il est lu dans une extraction **sans perte** du PDF et posé tel quel. Ce que
j'ai écrit à la main, ce sont les bornes de paragraphes et la table de correspondance ci-dessous — pas une
phrase du dossier. Une faute de frappe de ma part est impossible par construction.

## Les jetons

`{{CODE}}` = une valeur de la fiche · `{{CODE.lettres}}` = le montant en toutes lettres · `{{CODE.doublet}}` =
l'ordinal et son abrégé (« cent cinquième (105ème) ») · `{{DERIVE.x}}` = calculé par le serveur.
**Les blancs du candidat ne sont pas jetonnés** : ils restent exactement comme la source les imprime.

## Tableaux de correspondance

### C1 — C 1. Modèle de garantie bancaire de soumission

*Page **33** du dossier 2463. 13 paragraphes, fidélité vérifiée au caractère près.*

| # | ce que la source imprime | devient | ce que c’est | rempli par |
|---|---|---|---|---|
| C1.1 | `(Nom et adresse de l'Acheteur)` | `{{B01-AC-01}}` `{{B01-AC-02}}` | Autorité contractante + Adresse de l'autorité contractante | fiche (PPM) |
| C1.2 | `[titre du Marché]` | `{{B02-OB-01}}` `{{B02-OB-03}}` | Objet de l'appel d'offres + Numéro du dossier d'appel d'offres | fiche |
| C1.3 | `[Nom de l'Organisme ayant lancé l'Appel d'offres]` | `{{B01-AC-01}}` | Autorité contractante | fiche (PPM) |
| C1.4 | `[montant de la garantie en chiffres et en lettres]` **(×2)** | `{{B05-GS-03}}` `{{B05-GS-03.lettres}}` | Garantie de soumission **du lot** + le même montant en toutes lettres | fiche (par lot) + serveur |
| C1.5 | `trentième (30ème)` | `{{DERIVE.delai-garantie.doublet}}` | l’ordinal « trentième (30ème) » | serveur — **N1 + N2**, `B05-GS-04 − B04-VO-01` |
| C1.6 | `cent cinquième (105ème)` | `{{B05-GS-04.doublet}}` | l’ordinal « cent cinquième (105ème) » | serveur — **N1** |
| C1.7 | `[nom du candidat ]` | *inchangé* | blanc de l’offre | **candidat** |
| C1.8 | `[date]` | *inchangé* | blanc de l’offre | **candidat** |

### C2 — C 2. Modèle de caution personnelle et solidaire de soumission

*Page **34** du dossier 2463. 14 paragraphes, fidélité vérifiée au caractère près.*

| # | ce que la source imprime | devient | ce que c’est | rempli par |
|---|---|---|---|---|
| C2.1 | `[date fixée pour la remise des offres]` | `{{B04-LR-03}}` | Date limite de remise des offres | fiche |
| C2.2 | `[date d'expiration de la validité de l'offre]` | `{{DERIVE.fin-validite-offre}}` | fin de validité de l'offre | serveur — **N2**, `B04-LR-03 + B04-VO-01` |
| C2.3 | `[intitulé ou objet résumé du marché et références de l'appel d'offres]` | `{{B02-OB-01}}` `{{B02-OB-03}}` | Objet de l'appel d'offres + Numéro du dossier d'appel d'offres | fiche |
| C2.4 | `[dénomination et adresse complète de l'Autorité contractante]` | `{{B01-AC-01}}` `{{B01-AC-02}}` | Autorité contractante + Adresse de l'autorité contractante | fiche (PPM) |
| C2.5 | `[insérer le montant en chiffres et en lettres de la garantie de soumission]` | `{{B05-GS-03}}` `{{B05-GS-03.lettres}}` | Garantie de soumission **du lot** + le même montant en toutes lettres | fiche (par lot) + serveur |
| C2.6 | `trentième (30ème)` | `{{DERIVE.delai-garantie.doublet}}` | l’ordinal « trentième (30ème) » | serveur — **N1 + N2**, `B05-GS-04 − B04-VO-01` |
| C2.7 | `cent cinquième (105ème)` | `{{B05-GS-04.doublet}}` | l’ordinal « cent cinquième (105ème) » | serveur — **N1** |
| C2.8 | `[indiquer la dénomination sociale dénomination sociale de la banque ou de l'organisme de caution, et le siège social]` | *inchangé* | blanc de l’offre | **candidat** |
| C2.9 | `[indiquer le nom et l'adresse complète du Candidat]` | *inchangé* | blanc de l’offre | **candidat** |
| C2.10 | `[Lieu d'établissement de l'engagement]` | *inchangé* | blanc de l’offre | **candidat** |
| C2.11 | `[date d'établissement de l'engagement]` | *inchangé* | blanc de l’offre | **candidat** |
| C2.12 | 1 ligne de pointillés `______` | *inchangée* | blanc de l’offre | **candidat** |
## Ce que ces deux modèles demandent au serveur

| besoin | pour quoi |
|---|---|
| **N1** — l'ordinal et son abrégé | `{{B05-GS-04.doublet}}` et `{{DERIVE.delai-garantie.doublet}}`, deux fois chacun |
| **N2** — les dérivés | le délai de garantie (`B05-GS-04 − B04-VO-01`) et la fin de validité de l'offre (`B04-LR-03 + B04-VO-01`) |
| **N5** — *rien* | l'adresse existe déjà : `B01-AC-02` |

## Un cinquième constat pour l'errata

**E5 — C2, page 34** : la source écrit « [indiquer la dénomination sociale **dénomination sociale** de la banque
ou de l'organisme de caution, et le siège social] » — le membre de phrase est **répété**. Reproduit tel quel,
comme les quatre autres constats : on ne corrige pas la source, on la signale.
