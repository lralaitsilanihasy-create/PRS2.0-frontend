# Plan — Lettres d'invitation des prestations intellectuelles (lot AV-4, 01/10/2026)

> Suite du plan `plan-2026-09-30-avis-specifique.md`. Décision Q3 du pilote : les prestations intellectuelles (PI)
> n'ont pas d'avis spécifique ; leur équivalent est la **lettre d'invitation** adressée aux candidats de la **liste
> restreinte**, présélectionnés après l'avis à manifestation d'intérêt. Elle est à inclure dans un lot qui suit l'avis.
>
> **Statut : PLAN — rien n'est codé avant l'accord du pilote.**

## 1. Le modèle officiel

« 1.1. LETTRE D'INVITATION », en tête du volume 1 du dossier type PI (« Instructions aux candidats »). C'est une page,
cinq paragraphes numérotés :

| § | Texte du modèle | Trou | Source proposée |
|---|---|---|---|
| — | `<En tête de l'Autorité Contractante>` | en-tête | **comme l'avis** : emblème, `B01-AC-01`, PRMP, UGPM |
| — | `Référence: <insérer intitulé et références du Marché>` | numéro et objet | `B02-OB-03` (numéro du dossier) — `B02-OP-02` (objet principal) |
| — | `<insérer : lieu et date>` | lieu, date d'envoi | **saisis à l'impression** (Q2) |
| — | `< insérer : Nom et adresse du Consultant>` | destinataire | **un candidat de la liste restreinte**, saisi à l'impression |
| 1 | « …vous avez été présélectionné… Termes de Références… » | — | texte fixe |
| 2 | « …adressée aux candidats dont les noms figurent ci-après : `<liste des 5 candidats>` » | liste | **la liste restreinte saisie**, un nom par ligne |
| 3 | « …conformément à l'Article 26 du Code… sur la base : `<mode de sélection>` » | 4 rédactions au choix | `B02-MS-01` « Mode de sélection du consultant », déjà dans la fiche, avec les conditions du DPIC (`SFQC`, `BUDGET`, `MOINDRE-COUT`, `QUALITE-SEULE`) |
| 4 | « Le Dossier de Consultation comprend… » (liste des pièces) | — | texte fixe |
| 5 | « …nous faire savoir, par écrit, dès réception, à l'adresse suivante : `<insérer l'adresse>` » | adresse de réponse | `B01-AC-02`, et le courriel de la PRMP `B01-AC-06` (Q3) |
| — | `<Insérer nom et signature de la PRMP ou de son délégué>` | signataire | `B01-AC-05` |

Le modèle sera décrit comme les autres (`decrire.mjs`, décalque vérifié dans les deux sens), sous le sigle `LETTRE-PI`.
La source est à extraire du `.doc` officiel (`extraire.mjs`, clé `pi-ic`).

## 2. Proposition

1. **Quand** : le même déclencheur que l'avis. Le dossier soumis de la fiche a un PV signé FAV, ou FAVR une fois les
   réserves levées. Pour une fiche PI, l'encart de l'étape 7 et de la page du dossier devient « Lettres d'invitation ».
   Pour les fournitures et les travaux, rien ne change.
2. **La modale** demande :
   - la **date d'envoi** et le **lieu** ;
   - la **liste restreinte** : une ligne par candidat (nom, adresse), à ajouter ou retirer.

   Comme pour l'avis, la saisie de la dernière impression est reprise.
3. **La production** : une lettre **par candidat**, en .docx et en PDF (Q1). Chaque lettre porte son destinataire, et
   toutes portent la même liste au § 2. Le type de document est `LETTRE_INVITATION`. Les lettres d'une impression sont
   groupées dans la liste, avec la liste restreinte gardée en trace.
4. **Le statut « Lancé »** : la ligne du plan passe « Lancé » à la **première impression des lettres** (Q5), comme à la
   première impression de l'avis pour les autres catégories.

## 3. Découpage

| Lot | Contenu | Qui |
|---|---|---|
| AV-4.0 | Ce plan et les réponses du pilote | pilote |
| AV-4.1 | Extraction de la source, modèle `LETTRE-PI` décrit et vérifié ; demande backend | front |
| AV-4.2 | Route de production, garde, disponibilité, statut « Lancé », tests | backend |
| AV-4.3 | Encadré « Lettres d'invitation », modale de la liste restreinte, liste des lettres ; tests ; contre-recette | front |

## 4. Questions au pilote (recommandation en premier)

- **Q1 — Une lettre par candidat** (recommandé : chaque candidat reçoit la sienne, à son nom), ou un seul document qui
  les réunit ?
- **Q2 — Lieu de la lettre** : **saisi à l'impression** (recommandé : la fiche PI n'a pas de localité), ou l'adresse de
  l'autorité (`B01-AC-02`) ?
- **Q3 — Adresse de réponse (§ 5)** : **l'adresse de l'autorité et le courriel de la PRMP** (recommandé), ou l'adresse
  de remise des propositions (`B04-LH-01`) ?
- **Q4 — Nombre de candidats** : le modèle parle de « 5 candidats ». **Libre, au moins un** (recommandé, en attendant
  le juriste), ou exactement 5 ?
- **Q5 — Statut « Lancé »** à la **première impression des lettres** (recommandé, comme l'avis) ?

> ⚠️ **Arbitrage du pilote du 01/10 : Q1 à Q5 selon les recommandations.** AV-4.1 fait :
> - source `pi-ic` extraite ;
> - modèle `LETTRE-PI` décrit et vérifié, 43/43 ;
> - demande backend `demande-backend-2026-10-01-lettre-invitation-pi.md`.
