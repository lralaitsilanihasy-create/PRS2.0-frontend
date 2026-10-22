# Demande backend — 2026-10-22 — Modèles de PV : le modèle de départ du PV du plan, copié du modèle intégré

## Contexte

Le pilote demande de **rédiger le modèle « PV d'examen du plan de passation » (`PV-PLAN`) qui remplacera le modèle intégré, en
copiant le modèle en service**.

Aujourd'hui :
- `PV-PLAN` (id 2) est rattaché à `PPM` et `PPM-AGPM`, sans aucune version. La liste l'affiche « À rédiger · Remplacera le modèle
  intégré ».
- Le PV du plan est produit par le modèle intégré `PV-PLAN-INTEGRE` : **12 fichiers Word**
  (`PV_{AF|AFSR|ANF}_{PPM|PPMAGPM}_{CENTRALE|REGIONALE}.docx`), choisis par `PvDocumentGenerator`.
- `POST /api/modeles-pv/2/versions/depart` répond 409 `FAMILLE_SANS_DEPART` (« la reprise relève du lot G4 »).

Le front ne peut pas faire cette copie lui-même : il faudrait relire les 12 Word et les traduire en page, ce que seul le serveur sait faire
(comme `ModelePvDepart.lettre` pour la lettre de renvoi). En revanche, **toutes les marques des 12 fichiers ont déjà leur variable** au
catalogue (`CatalogueModelesPv`, table des anciennes marques : `<REFERENCE PV>` → `PV.REFERENCE`, `<ANNEE EXERCICE>` →
`DOSSIER.EXERCICE`, `<POINT DE CONTROLE>` / `<AU LIEU DE>` / `<LIRE>` → `OBS.*`, etc.).

## B1 — Le départ de la famille DDP (plan), d'après les 12 fichiers intégrés

`POST /api/modeles-pv/{id}/versions/depart` sur un modèle rattaché à `PPM` et/ou `PPM-AGPM` :
- assemble **une seule page** d'après les 12 fichiers, comme le départ des autres familles et celui de la lettre ;
- ce qui diffère d'un fichier à l'autre devient des **passages conditionnels**, avec leurs règles déclarées :

| Ce qui varie | Fichiers | Règles proposées |
|---|---|---|
| L'avis | `AF` / `AFSR` / `ANF` | `FAVORABLE` (`avis = FAV`), `AVEC_RESERVES` (`avis = FAVR`), `DEFAVORABLE` (`avis = DEF`) |
| L'AGPM | `PPM` / `PPMAGPM` | `AVEC_AGPM` (`agpm = oui`), `SANS_AGPM` (`agpm = non`) |
| La commission | `CENTRALE` / `REGIONALE` | `CENTRALE`, `REGIONALE` (selon la portée demandée, comme les autres départs) |

- les marques deviennent les variables de la table déjà servie ; le tableau des observations devient une **ligne répétée** sur la liste
  `OBSERVATIONS` (`OBS.POINT`, `OBS.AU_LIEU_DE`, `OBS.LIRE`) ;
- l'emblème est repris de la bibliothèque (`EMBLEME`), comme pour les autres départs ;
- le motif est `MOTIF_VERSION_DEPART`, pour que l'écran affiche l'encadré « texte à faire valider ».

`FAMILLE_SANS_DEPART` ne reste vrai que pour une famille sans départ connu.

> ⚠️ **2026-10-22, livré (backend), avec des précisions**
> - **`SANS_AGPM` n'est pas déclarée** : les fichiers sans AGPM n'ont rien en propre, ils retirent seulement la mention. Seule
>   `AVEC_AGPM` (`agpm = oui`) existe, sinon le contrôle signalerait une condition inutilisée.
> - **« INITIAL » n'est pas un mot fixe** : sur une mise à jour du plan, le générateur intégré écrit « MODIFICATIF N°n ». Le départ
>   l'écrit `{{DOSSIER.NATURE_PLAN}}`, variable nouvelle (famille DDP).
> - **Les lignes des présents** : l'intégré retire celles du Président, du Chef de la Commission et du Membre quand le nom manque. Le
>   départ les met en blocs `PRESIDENT`, `CHEF_COMMISSION`, `MEMBRE` (`PV.PRESIDENT renseigne`…) : une condition peut
>   désormais lire une variable du catalogue, hors liste.
> - **Aucun champ saisi** : l'avis défavorable de l'intégré n'a pas de motif et il n'y a pas d'observation générale. Les autres
>   départs les ont ; celui du plan non.
> - « L'an … » s'écrit `{{PV.DATE_EXAMEN|lettres}}`, le même texte que l'intégré. La mise en forme suit les fichiers : titre en
>   Arial 12 gras, « Séance du » gras souligné, libellés de l'identification en gras.
> - Rendu vérifié en image contre le Word (`PV_AFSR_PPMAGPM_CENTRALE`, `PV_ANF_PPM_REGIONALE`) : même nombre de pages (2 avec
>   l'annexe, 1 sinon), mêmes textes. Écarts restants : les noms des signatures en Times New Roman, comme dans les autres départs.

## B2 — La comparaison avant la relève

Le départ ne change aucun PV : le plan reste produit par les fichiers intégrés jusqu'à la relève (P4 / G4). Pour que la comparaison soit
honnête, le départ **recopie les textes tels quels**, même s'ils diffèrent d'un fichier à l'autre sans raison apparente. Le backend
signale ces écarts dans sa réponse : la CNM tranchera, et la correction se fera dans la page.

L'écran le permet déjà : l'onglet « Aperçu » de la version produit le PDF sur un dossier réel (par exemple le 100379, PPM-AGPM avec un
PV favorable), et « Voir » sur le modèle intégré produit le PDF de l'intégré sur le même dossier.

## Questions

- **Q1 — Une seule page ou deux ?** Le front propose une seule page pour `PPM` et `PPM-AGPM`, l'AGPM en passages conditionnels, comme
  le rattachement actuel de `PV-PLAN`. Si les deux textes diffèrent trop, deux modèles seraient-ils plus lisibles ?
- **Q2 — L'avis « sans avis » (`NSP`).** Les fichiers intégrés n'ont pas de variante `NSP`. Le départ doit-il prévoir un passage, ou
  laisser ce cas sans texte d'avis comme aujourd'hui ?

> ⚠️ **2026-10-22, réponses (backend)**
> - **Q1 — Une seule page.** Les fichiers `PPM` et `PPMAGPM` ne diffèrent que par deux morceaux de phrase (intitulé et avis).
> - **Q2 — Pas de passage `NSP`.** L'intégré ne produit aucun document pour cet avis (409 `AUCUN_DOCUMENT`) ; la page n'imprime
>   alors aucune phrase d'avis. La relève (D2) devra garder ce refus, ou la CNM fournira un texte.
> - **D2 non livré** : le PV du plan est toujours produit par les fichiers intégrés ; la couverture reste `INTEGRE`.

## Lots

| Lot | Contenu |
|---|---|
| D1 | B1 : le départ du plan, et `FAMILLE_SANS_DEPART` levé pour la famille DDP |
| D2 | B2 : la relève du plan, avec P4 (comme L2 pour la lettre) |

## Côté front

- **Rien à changer pour D1** : la fiche propose déjà « Générer un modèle de départ » dès qu'un modèle sert des sous-types ; le refus
  `FAMILLE_SANS_DEPART` y est dit en clair. Dès la livraison, l'Administrateur génère le départ de `PV-PLAN` depuis sa fiche.
- **À la livraison de D2** : la ligne « PV d'examen du plan de passation » du groupe « En service » passe de l'intégré au modèle de
  l'application.
