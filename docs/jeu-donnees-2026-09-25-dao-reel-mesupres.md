# Jeu de données — du plan de passation au DAO, à partir d'un dossier réel

*25/09/2026, **rejoué le 26/09** (identifiants ci-dessous). Source : le dossier d'appel d'offres publié par le MESupReS,*
*`AOO n° 2463-MI/MESupReS/PRMP/UGPM.2026` — « Fourniture et livraison des matériels informatiques*
*répartis en cinq (5) lots (à commande) », 86 pages, remis par le pilote.*

## Ce que c'est

Un jeu de données qui part de **rien** — la base a été vidée le 25/09 au soir, puis **rejouée entièrement le 26/09** — et va jusqu'au **dossier
d'appel d'offres généré**, en rejouant **toute la chaîne par l'API, rôle par rôle**, comme le feraient les
vrais acteurs. Aucune écriture directe en base, aucun code applicatif touché.

```
node scripts/jeu-donnees-dao-2463.mjs              la chaîne entière
node scripts/jeu-donnees-dao-2463.mjs --etapes 4-6 une tranche seulement (le script reprend son contexte)
node scripts/demo-dao.mjs 303089                   la fiche DAO de la ligne ainsi semée
```

| étape | acteur | ce qui se passe |
|---|---|---|
| 1 | **PRMP** puis **Administrateur** | l'entité contractante absente du référentiel est créée par la PRMP ; l'Administrateur approuve le rattachement |
| 2 | **PRMP** | le plan de passation : dossier, PPM, la ligne de marché, ses **cinq lots** et ses **28 étapes prévisionnelles** |
| 3 | **PRMP** | la soumission du plan à la Commission |
| 4 | **Secrétaire** | la réception |
| 5 | **Président** | le dispatch au Membre examinateur |
| 6 | **Membre** | la grille de contrôle — 12 points évalués conformes — et la soumission : **avis favorable**, projet de PV |
| 7 | **Président**, **Membre désigné** | le visa, la désignation du co-signataire, les signatures → **PV signé** |
| 8 | **PRMP** | la ligne devient préparable en DAO ; `demo-dao.mjs` garnit la fiche et produit les documents |

## Ce qui est en base

| | |
|---|---|
| entité | **MINISTERE DE L'ENSEIGNEMENT SUPERIEUR ET DE LA RECHERCHE SCIENTIFIQUE** (n° 11), rattachée à la PRMP |
| plan | dossier **100346** — référence officielle **`00005/PPM-AGPM/CNM/2026`** |
| ligne | **303089** — matériels informatiques, **à commande**, **5 lots**, 457 000 000 Ar |
| circuit | réception 1100075 → dispatch 25 (MEMANT1) → examen 1 → PV **36** `SIGNE`, avis **FAV**, co-signé par MEMANT2 |
| fiche DAO | **13** — validée, **115 informations** dont **25 cellules par lot** (5 × 5), **12 articles** et **58 caractéristiques exigées** au besoin |
| dossier produit | **100347** — **86 fichiers pour 48 pièces** (voir ci-dessous) |

## Le contenu vient du dossier, pas d'une invention

Les cinq lots sont ceux du dossier (ministère, Ambatondrazaka ×2, Fort-Dauphin ×2). Leurs montants se
**déduisent des garanties de soumission réelles**, qui valent 2 % du maximum : 1 600 000 Ar pour les lots 1, 3
et 5 (80 000 000 Ar de maximum annuel), 2 170 000 Ar pour les lots 2 et 4 (108 500 000 Ar).

Le calendrier prévisionnel reprend les **trente étapes du mode « appel d'offres ouvert »** du référentiel, datées
de juin 2026 à janvier 2028 : remise et ouverture des plis au **09/11/2026**, attribution au **24/12/2026**,
notification fin janvier 2027, exécution sur douze mois — la durée du marché à commande.

⚠️ **Ce calendrier fait foi pour la fiche DAO.** Le contrôle `DATES_ORDRE` compare les dates de la fiche aux
dates prévisionnelles du plan : c'est parce que celles-ci sont à venir que la fiche peut annoncer une remise
des offres au 09/11/2026. Le point ouvert depuis le 23/09 — un plan au calendrier passé rend toute fiche
invalidable — ne se pose pas ici, et ce jeu de données montre pourquoi il faut y prendre garde.

Le jeu de valeurs de la fiche (`VALEURS_2463`, 95 informations communes et 4 × 5 cellules par lot) transcrit le
DPAO, le CCAP et l'acte d'engagement, **y compris ce que le dossier a de particulier** :

- un **plafond de pénalités à 10 %** — dérogation à l'article 12 du CCAG, qui en retient quinze ;
- **aucune garantie de bonne exécution, aucune retenue de garantie** (CCAP art. 12) ;
- un **délai de garantie de deux mois**, seule dérogation que le CCAP récapitule dans son tableau final ;
- **deux lots au maximum par candidat**, chaque lot indivisible, évaluation **par lot** ;
- validité des offres **75 jours**, garantie de soumission valable **105 jours**, plis **séparés par lot** avec
  double enveloppe scellée **à la cire**, voie électronique **non admise** ;
- délai de livraison **fixé au bon de commande sans dépasser 30 jours**, durée du marché **12 mois** ;
- méthode des deux moyennes (20 % puis 10 %) pour les offres anormalement hautes ou basses ;
- **pas de préférence nationale**, pas de critère additionnel, pas de variante, pas de groupement,
  pas de sous-traitance.

## ⚠️ Le visa a buté sur une réception sans réceptionnaire — corrigé le 25/09

Le visa refusait **tous** les co-signataires, y compris le Membre examinateur de la bonne localité :

```
POST /api/pv-examens/35/viser   { "imActeur": "PRES001", "coSignataires": ["MEMANT1"] }
→ 400 « MEMANT1 » ne peut pas co-signer ce PV : les co-signataires admis sont
       les Membres de la localité du dossier (§3.3).
```

La cause n'était pas dans la garde : **la réception 1100074 ne nommait pas son réceptionnaire**. Le script
l'avait créée sans `imCtrlRecept`, et le serveur ne le déduisait pas de l'acteur connecté — le circuit
n'avait donc pas d'acteur de réception. Le backend a corrigé la racine (**`f3bf8af`** : une réception créée
sans réceptionnaire prend l'acteur connecté), réparé la réception existante, et créé le compte du second
Membre `MEMANT2` — aucun endpoint ne crée le compte d'un contrôleur, `POST /api/controleurs` ne pose que la
fiche.

⚠️ **À retenir pour tout script qui réceptionne** : nommer `imCtrlRecept` explicitement, comme le fait
désormais l'étape 4.

⚠️ **Et pour la signature** : la part « Membre » est réservée au **Membre DÉSIGNÉ au visa** — l'examinateur
lui-même reçoit un 403. Le PV est signé par le dispatcheur, dont la part est posée par le visa, et par ce
co-signataire.

## Le résultat : le DAO du dossier réel

La fiche 13 est validée sans un contrôle au bilan, et le dossier 100347 porte **48 pièces** — 86 fichiers, chacune
étant produite en `.docx` **et** en `.pdf`, sauf les classeurs :

| pièce | combien | format |
|---|---|---|
| DPAO, CCAP | 1 chacune | docx + pdf |
| liste des fournitures et calendrier (LF) | 1 | docx + pdf |
| acte d'engagement (AE) | **1 par lot** | docx + pdf |
| fiches du candidat A1 à A4 | **4 par lot** | docx + pdf |
| garanties C1 et C2 | **2 par lot** | docx + pdf |
| bordereau des prix (BP), tableau de conformité (TC) | **1 par lot chacun** | xlsx seul, non joint au dossier soumis |

Chaque acte porte les chiffres de **son** lot, montants en toutes lettres compris :

| | lot 2 | lot 5 |
|---|---|---|
| montant minimum annuel | 54 000 000 Ariary (cinquante-quatre millions) | 40 000 000 Ariary (quarante millions) |
| montant maximum annuel | 108 500 000 Ariary (cent huit millions cinq cent mille) | 80 000 000 Ariary (quatre-vingts millions) |

C'est la règle livrée en V43, vérifiée ici sur un allotissement en **cinq** lots venu d'un dossier réellement
publié — et sur toute la chaîne, du premier geste de la PRMP au document généré.
