# Demande backend — 2026-10-17 — Les pièces du dossier DAO que l'application détient déjà sont satisfaites par ses données

## Contexte

Le pilote a créé depuis la fiche des consomptibles informatiques (ligne 303339, version 5, remise **papier**) le dossier
**100380** (`DMC` / `DAOO`, `idDmc` 1, brouillon). `GET /api/dossiers/100380/pieces-exigees` exige, entre autres :

| Code | Pièce | Condition | État au dossier |
|---|---|---|---|
| `FICHE_PRESENTATION` | Fiche de présentation datée et signée | `PAPIER` | manquante |
| `CALENDRIER` | Calendrier annuel de passation mis à jour et signé | `PAPIER` | manquante |
| `AGPM_CONTROLE` | AGPM (ou PPM) signé et contrôlé, avec le PV de la Commission | `PAPIER` | manquante |
| `PUBLICATION_AGPM` | Publication de l'AGPM (journal) | — | manquante |
| `AVIS_SPECIFIQUE` | Projet d'avis spécifique | `FACULTATIVE_EN_LIGNE` | jointe d'office |
| `DAO_COMPLET` | Dossier d'appel d'offres complet | — | jointe d'office |

Les trois premières sont exigées parce que la remise est sur papier. `PiecesExigees.contexte` ne tient un dossier pour « en
ligne » que si sa fiche est en remise électronique (R8, 13/10).

**Le pilote constate que l'application détient déjà ces informations**, et demande qu'on les présente **comme dans le dossier
de planification**, dont les éléments sont des onglets de données (fiche de présentation, plan, AGPM, pièces jointes) et non des
fichiers à déposer :
- **la fiche de présentation** : la ligne du plan et la fiche DAO, validée par la PRMP, en donnent tout le contenu ;
- **le calendrier annuel** est déjà **produit par l'application** depuis le plan contrôlé (`GET …/calendrier-annuel`, V115). Selon
  l'arbitrage du pilote du 14/10 (« Q-pièce »), il **remplace** la pièce « mis à jour et signé ». Mais la liste des pièces exigées
  la compte encore manquante ;
- **l'AGPM contrôlé avec le PV de la Commission** : le plan de la ligne (dossier 100379, `00001/PPM-AGPM/CNM/2026`) a été
  **examiné dans l'application**, et son PV est signé dans l'application.

**La publication de l'AGPM** n'est pas une donnée : c'est un justificatif externe, déposé une fois sur le plan et repris d'office
(V118). Elle reste une pièce : il n'y a rien à changer, sinon que le plan 100379 ne la porte pas encore.

## B1 — Trois pièces satisfaites par les données, pour un dossier né d'une fiche

Pour un dossier `DMC` qui porte une fiche **validée** (`ID_DMC`), **quel que soit le mode de remise** :
- `FICHE_PRESENTATION`, `CALENDRIER` et `AGPM_CONTROLE` sont **satisfaites d'office**. Le contrôle de soumission ne les compte
  plus manquantes, et la recevabilité du Secrétaire non plus ;
- `GET …/pieces-exigees` le dit, pour que l'écran l'affiche. Par exemple, un champ `fourniePar: "APPLICATION"` et la référence
  de ce qui la fournit :
  - le plan et son PV pour `AGPM_CONTROLE` (`idDossierPlan`, `idPv`) ;
  - le calendrier, avec la route qui le produit ;
  - la fiche de présentation, avec la route de B2.
- **Un dossier DAO créé à la main**, sans fiche, garde la règle actuelle : rien ne prouve alors les données.

> ⚠️ **2026-10-17, livré côté backend (B1)**, avec trois précisions.
> - **La cause** : depuis R8 (13/10), « en ligne » se lit au mode de remise. Le dossier 100380, en papier, se voyait donc redemander
>   des pièces que R2 et V115 avaient retirées aux dossiers nés d'une fiche.
> - **Les champs** : `fourniePar: "APPLICATION"`, `lien` (la route qui rend la pièce), `idDossierPlan`, `idPvPlan` :
>   - `FICHE_PRESENTATION` : toujours, `lien` = `/api/dossiers/{id}/fiche-presentation` ;
>   - `CALENDRIER` : si le plan de la ligne est dans l'application, `lien` = `/api/dossiers/{id}/calendrier-annuel`, avec
>     `idDossierPlan` ;
>   - `AGPM_CONTROLE`, et aussi `PPM_CONTROLE` (même pièce, « AGPM ou PPM ») : si le PV d'examen du plan est **signé**, `lien` =
>     `/api/pv-examens/{idPv}/document`, avec `idDossierPlan` et `idPvPlan`.
> - **L'affichage** : la pièce fournie reste listée, `obligatoire` inchangé. Elle apparaît désormais **aussi en remise
>   électronique**, où la condition `PAPIER` la masquait : l'écran la montre « fournie par l'application » dans les deux modes.
> - **Les contrôles** : ni la soumission, ni les défauts de la recevabilité, ni la garde de la réception ne la comptent manquante.
> - **Le cas réel** : le plan 100379 porte le PV 61, signé. Le dossier 100380 n'aura donc plus que la publication de l'AGPM à
>   fournir.

## B2 — La fiche de présentation d'un dossier DAO

Le dossier de planification a sa fiche de présentation, produite des données et affichée en onglet (`FichePresentationDoc`).
Demande : la même chose pour un dossier DAO né d'une fiche, en données (lecture JSON) et en PDF pour l'impression.

**Q2 — Le contenu.** Le front propose :
- **identification** : autorité contractante, PRMP, référence du plan, ligne ;
- **marché** : objet, catégorie, mode de passation, forme, nombre de lots et leur désignation, montant estimatif du plan,
  source de financement, imputation budgétaire, compte ;
- **procédure** : numéro du DAO (`B02-OE-01`), dates prévisionnelles (`B04-CP-01` à `CP-08`), mode de remise des offres ;
- **validation** : version de la fiche, date et auteur de la validation.

Le backend ajuste ce contenu au modèle de fiche de présentation du manuel, s'il en existe un pour les DAO.

> ⚠️ **2026-10-17, livré côté backend (B2, Q2)** : `GET /api/dossiers/{id}/fiche-presentation` (JSON) et `…/fiche-presentation/pdf`.
> - **Garde et refus** : la garde de lecture du dossier ; 409 `FICHE_PRESENTATION_INDISPONIBLE` sans fiche validée.
> - **La forme** : `{ idDossier, idDmc, versionFiche, sections: [{ code, titre, lignes: [{ code, libelle, valeur }] }] }`, en
>   sections de lignes « libellé : valeur » aux codes stables. Une ligne sans valeur n'est pas servie.
> - **Le modèle** : le manuel n'annexe de modèle de fiche que pour le plan. Pour le DAO (pages 18 et 23 à 25), il dit ce que la
>   Commission y vérifie. Le contenu proposé est donc gardé, et complété de ces points :
>   - la **garantie de soumission** (exigée, forme, montant, validité) ;
>   - le **délai de validité des offres** ;
>   - les **date, heure et lieu de remise** et de l'**ouverture des plis** ;
>   - une section **`COHERENCE`** : lancement prévu au plan, disponibilité du DAO, et **retard** éventuel, que le manuel demande de
>     relever.
> - **Les codes de champs** de la demande n'existent pas sous ces noms : le numéro du DAO est `B02-OB-03`, et `B04-CP-01` à `08`
>   ne valent qu'au contrat-cadre. Chaque ligne prend le premier champ qui vaut pour la catégorie et la forme de la fiche, car les
>   codes diffèrent entre fournitures, travaux et prestations intellectuelles.
> - **Les sections** : `IDENTIFICATION`, `MARCHE`, `PROCEDURE`, `COHERENCE`, `VALIDATION`. Le détail des codes de ligne est dans
>   `PRS20/docs/api-endpoints.md`.

## B3 — De quoi faire un onglet « Plan de passation »

Le dossier DAO (`GET /api/dossiers/{id}`) dit **quel plan** porte sa ligne (dossier 100379) et **quel PV** l'a contrôlé. L'écran
présentera la ligne du plan dans un onglet, avec un lien vers le plan et son PV. Il ne crée aucune nouvelle donnée : il reprend
celles du plan.

> ⚠️ **2026-10-17, livré côté backend (B3)** : `GET /api/dossiers/{id}` gagne `idDossierPlan` et `idPvPlan`, sur la lecture unitaire
> d'un dossier né d'une fiche ; ils sont absents sinon.
> - `idDossierPlan` : le plan qui porte la ligne en vigueur, celle d'une mise à jour s'il y en a une.
> - `idPvPlan` : le PV **signé** de son examen ; il est absent tant qu'aucun PV n'est signé.
> - Le PV se lit par `GET /api/pv-examens/{idPv}/document`.

## Questions

- **Q1 — La signature.** Les pièces exigent « datée et signée », « signé et contrôlé ». Le front propose d'en tenir lieu ainsi :
  - pour la fiche de présentation, par la **validation de la fiche par la PRMP** (date et auteur, journalisés) ;
  - pour l'AGPM, par le **PV signé dans l'application**.

  Le manuel de contrôle le permet-il ? C'est au pilote de trancher, s'il faut.
- **Q2** : le contenu de la fiche de présentation (B2).
- **Q3** : faut-il appliquer la même règle aux autres sous-types nés d'une fiche (`DAOOI`, `DAOR`, `DAORI`, `DC`…), qui exigent les
  mêmes pièces ? Le front le propose.

> ⚠️ **2026-10-17, réponses du backend.**
> - **Q1, livrée comme hypothèse, à confirmer par le pilote.** L'équivalence proposée est appliquée : la validation nominative de
>   la fiche par la PRMP, et le PV signé dans l'application. C'est le principe déjà arbitré pour la procédure en ligne : la
>   validation tracée vaut signature (R2, V102, Q2/Q14 du 10/10 ; V115 pour le calendrier). S'il la refuse, la règle se retire
>   sans migration.
>
> ⚠️ **2026-10-17, arbitrage du pilote sur Q1 : oui.** La validation nominative de la fiche par la PRMP tient lieu de signature de la
> fiche de présentation. Le PV signé dans l'application tient lieu de signature de l'AGPM (ou du PPM) contrôlé. L'hypothèse
> devient la règle, et il n'y a rien à retirer.
> - **Q2 :** voir l'encadré de B2.
> - **Q3, oui.** La règle tient à la fiche validée du dossier, pas au sous-type. Elle vaut pour tout sous-type qui exige ces
>   pièces : `DAOOI`, `DAOR`, `DAORI`, `DC`, etc.

## Ce que le front fera, dès la livraison

- Le dossier né d'une fiche se présente **en onglets**, comme le dossier de planification :
  - « Fiche DAO » (les données, celles de l'examen) ;
  - « Fiche de présentation » (B2) ;
  - « Plan de passation » (B3) ;
  - « Calendrier » (déjà produit) ;
  - « Pièces jointes » (DAO complet, bordereau estimatif, projet d'avis, publication de l'AGPM).
- Dans la liste des pièces exigées, les trois pièces de B1 s'affichent « fournie par l'application », avec un lien vers leur onglet.
- Recette sur le dossier 100380 : plus que la publication de l'AGPM à fournir, une fois déposée sur le plan 100379.

## Recette du front, 17/10 (backend be8089c, JAR redémarré)

Dossier **100380** (plan 100379, PV 61 signé), avec le compte PRMP001 :
- **`GET /api/dossiers/100380`** : `idDossierPlan` 100379 et `idPvPlan` 61.
- **Pièces exigées** :
  - `FICHE_PRESENTATION`, `CALENDRIER` et `AGPM_CONTROLE` en `fourniePar: "APPLICATION"`, avec leur lien ;
  - `PUBLICATION_AGPM` est seule manquante. `AVIS_SPECIFIQUE` et `DAO_COMPLET` sont jointes.
- **Fiche de présentation** : JSON 200 (cinq sections), PDF 200.
- **Écran** :
  - le dossier né d'une fiche s'ouvre sur l'onglet **« Fiche de présentation »** (sections, et « Ouvrir le PDF ») ;
  - puis **« Fiche DAO »** (les données, celles de l'examen) et **« Plan de passation »** (plan n° 100379, PV 61 signé, « PV de la
    Commission (PDF) », calendrier annuel, publication de l'AGPM) ;
  - enfin **« Pièces jointes »**. Les trois pièces y sont cochées « fournies par l'application », avec un bouton « Ouvrir », et
    une seule reste manquante.

**Trois remarques sur le contenu de la fiche de présentation**, à la main du backend :
1. **`IMPUTATION`** vaut « 6113 », qui est le **compte** (`B01-AC-17`), et non les lignes d'imputation du plan (`B01-AC-16`,
   « 00-21-0-B00-00000 ; … », sans montants). C'est l'écart que T1 de la charte des travaux a corrigé sur la garde. Le compte
   mérite sa propre ligne.
2. **« Date et heure limites de remise »** est servie deux fois dans `PROCEDURE` : une fois sous la remise, une fois parmi les dates
   du contrat-cadre (`B04-CP-02`).
3. **« Dates prévisionnelles du plan »** recopie d'un bloc `B01-AC-18`, soit une trentaine d'étapes. C'est illisible à l'écran comme
   dans le PDF. Le front propose de n'en garder que les étapes du DAO (établissement, transmission à la CNM, lancement, remise et
   ouverture des offres), ou de les servir en lignes séparées.

> ⚠️ **2026-10-17, les trois remarques sont corrigées côté backend**, sans autre changement de contrat.
> 1. **Section `MARCHE`, imputation et compte.** `IMPUTATION` sert les lignes d'imputation du plan (`B01-AC-16`), sans leurs
>    montants, comme T1 sur la garde. Le compte (`B01-AC-17`) a sa propre ligne, **`COMPTE`**.
> 2. **Section `PROCEDURE`, date limite.** `B04-CP-02` n'est plus servie parmi les dates du contrat-cadre, puisqu'elle l'est déjà
>    comme `DATE_LIMITE`. Les dates `B04-CP-01` et `03` à `08` restent.
> 3. **Les dates prévisionnelles, les deux propositions retenues.** La ligne `DATES_PREVISIONNELLES` est retirée. Une section
>    nouvelle, **`CALENDRIER_PLAN`** (« Calendrier prévisionnel du plan (étapes du DAO) »), ne garde que les étapes du DAO, une ligne
>    chacune :
>    - les codes : `ETABLISSEMENT_DAO`, `TRANSMISSION_DAO`, `LANCEMENT`, `REMISE_OFFRES`, `OUVERTURE_PLIS` ;
>    - le libellé : celui du plan, coupé à son premier « : » ;
>    - la période : en jj/mm/aaaa ;
>    - pour chaque étape, la première du plan qui commence ainsi. « Remise en forme du DAO » n'est pas une remise des offres.
>
> Les sections sont désormais `IDENTIFICATION`, `MARCHE`, `PROCEDURE`, `CALENDRIER_PLAN`, `COHERENCE`, `VALIDATION`. Une section
> sans ligne n'est pas servie : un plan sans calendrier n'a pas de `CALENDRIER_PLAN`.

**Q1 (signature)** : **oui**, réponse du pilote du 17/10 (voir l'encadré des réponses du backend).
