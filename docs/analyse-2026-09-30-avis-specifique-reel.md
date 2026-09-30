# Analyse — un avis spécifique réel comparé au modèle AVIS-F / AVIS-T (30/09/2026)

> Pièce étudiée : `AOO_26033314AOO003_TVX.pdf`, transmise par le pilote le 30/09. C'est l'avis d'un **contrat-cadre de
> travaux**, alloti (3 lots), de la **Région Analamanga** (n° 14-26/AOO/TVX/MID/REGAN/PRMP/UGPM), daté du 09/09/2026.
> Il sort d'une plateforme de génération : nom de fichier technique en pied de page, **QR code** en page 2.
> Objet : en tirer le modèle d'avis, en le comparant à `AVIS-F` / `AVIS-T` (lot AV-1, tirés du document type ARMP du
> contrat-cadre).
>
> **Statut : ANALYSE — aucune modification des modèles avant l'accord du pilote.**

## 1. Même trame, même texte

Les neuf paragraphes suivent le document type, dans le même ordre et pour l'essentiel mot pour mot :
- rappel de l'avis général ;
- sollicitation des offres (« des offres et des candidatures » en contrat-cadre) ;
- procédure ;
- consultation du DAO ;
- retrait du DAO contre paiement ;
- remise des plis ;
- remise électronique ;
- garantie ;
- marchés subséquents.

Notre modèle a donc la bonne trame. Les écarts portent sur la **présentation** et sur quelques **variantes**.

## 2. Écarts, un par un

| # | Élément | Avis réel | Notre modèle | Proposition |
|---|---|---|---|---|
| E1 | **En-tête** | Emblème, « REPOBLIKAN'I MADAGASIKARA », devise « Fitiavana - Tanindrazana - Fandrosoana », puis l'autorité (« REGION ANALAMANGA »), « LA PERSONNE RESPONSABLE DES MARCHES PUBLICS », « UNITE DE GESTION DE PASSATION DES MARCHES PUBLICS » | l'autorité seule (`B01-AC-01`) | **reprendre l'en-tête réel** : République, devise, autorité, PRMP, UGPM. L'emblème est une image, à fournir au backend (question Q1). |
| E2 | **Numéro** | « N° 14-26/AOO/… » seul, sous le titre | « numéro — objet » | **le numéro seul**, précédé de « N° » ; l'objet est déjà au § 2. |
| E3 | **Date** | pas de date sous le numéro ; en bas : « à ……… Le 09/09/2026 », au-dessus de la signature | date de publication sous le numéro | **« à {lieu}, le {date de publication} » en bas**, au-dessus de « La Personne Responsable des Marchés Publics ». Lieu : question Q3. |
| E4 | **Numérotation** | paragraphes numérotés 1 à 9 | non numérotés | **numéroter**. Ce ne sont que des ajouts de présentation : la numérotation suit les paragraphes réellement imprimés (le § garantie ou le § marchés subséquents peuvent manquer). À faire par le moteur du serveur (question Q4). |
| E5 | **JMP et supports vides** | « Journal des Marchés Publics n° en date du 31/07/2026 et . » : numéro et supports **laissés vides** | les quatre informations **exigées** à l'impression | **numéro du JMP et supports facultatifs**. Si les supports sont vides, retirer « et dans … » au lieu d'imprimer « et . ». La date du JMP et celle de l'avis restent exigées. |
| E6 | **Objet** | entre guillemets et en gras | texte simple | **guillemets** « … » autour de l'objet. Le gras dépend du moteur (question Q4). |
| E7 | **« pour fournir » en travaux** | gardé tel quel (« pour fournir " Travaux de pavage… " ») | adapté : « pour exécuter les travaux suivants : » (décision Q2 du 30/09) | **garder notre adaptation** : l'avis réel montre la maladresse du modèle non adapté. |
| E8 | **Lots** | « Les Travaux routiers-Construction, rabilitation sont réparties en 3 lots » : la **nature de la ligne du plan**, puis « pour un (01) ou plusieurs lots » | « Les travaux sont répartis en N lots » | garder notre phrase, qui s'accorde, plutôt que la nature du plan (« réparties » ne s'accorde pas avec « Travaux »). Reprendre « un (01) » **seulement si le pilote le souhaite** (le document type dit « un »). |
| E9 | **Articles du Code** | « articles 35, 63 et 67 » | « articles 30, 35 et 67 » (document type) | **question au juriste (Q5)** : les deux sources divergent. Nous gardons le document type en attendant. |
| E10 | **Forme** | « de marché « Contrat-cadre » conclu prix forfaitaire » (la forme entre guillemets, « à » oublié) | « de marché contrat-cadre conclu à prix forfaitaire » | mettre la forme **entre guillemets** comme l'avis réel ; garder « à prix » (coquille de l'avis réel). |
| E11 | **Adresse de consultation** | liste **avec ses libellés** : « - Nom du Responsable : … », « - Fonction : … », « - Adresse : … », « - E-mail : » | les valeurs seules, sans libellé | **garder les libellés** en tirets, comme l'avis réel. « Adresse » regroupe le bureau et la localité. L'e-mail reste facultatif (la ligne disparaît si elle est vide). |
| E12 | **Retrait du DAO** | « auprès du REGION ANALAMANGA » (l'autorité nommée) ; « version électronique » | « auprès de l'Autorité contractante » | nommer l'autorité (`B01-AC-01`) ? Le document type dit « l'Autorité contractante » : **question Q6**. Ne pas reprendre « version électronique » (propre à ce dossier). |
| E13 | **Montant du DAO par lot** | « - Lot 1 : cent mille Ariary (Ar 100 000.00) », une ligne **par lot** | un montant unique (`B04-DS-05`) | **montant par lot** sur une ligne allotie : `B04-DS-05` devient « par lot » (demande backend), une ligne par lot, la ligne unique sinon. |
| E14 | **Bénéficiaire du paiement** | « Agent Comptable de l'ARMP (ou, au nom du Régisseur de recette de la **Commission Régionale des marchés**) » | « … ou au nom du régisseur de recettes de l'ARMP » (document type) | **question Q7** : le régisseur dépend-il de la Commission compétente (`B01-AC-04`, « Commission des marchés compétente ») ? |
| E15 | **Date limite** | « le 12/10/2026 à 09 H 00 Min locales » | « le {date et heure} » (JJ/MM/AAAA HH:MM) | **« le JJ/MM/AAAA à HH h MM (heure locale) »** : format à demander au backend pour les DATE_HEURE de l'avis. |
| E16 | **Sans garantie** | un paragraphe : « La garantie de soumission n'est pas requise. » | paragraphe omis | **imprimer cette phrase** quand aucune garantie n'est exigée (ajout déclaré), pour que la numérotation et l'information restent complètes. |
| E17 | **Pied de page, QR code** | nom de fichier technique et date en pied ; QR code en page 2 | aucun | **hors du modèle** : ce sont les marques de la plateforme émettrice. Un QR code de vérification serait un sujet à part (question Q8). |

## 3. Ce que cela change

**Dans les modèles** (front, `decrire.mjs` : ajouts déclarés, décalques revérifiés) :
- E1, E2, E3, E6, E10, E11, E16 ;
- E5, avec une condition « supports renseignés » ;
- E13, avec les sections « alloti » et « lot unique » du paragraphe du montant.

**Au serveur** (demande backend) :
- E5 : `jmpNumero` et `supports` deviennent facultatifs, et une condition leur est ouverte ;
- E13 : `B04-DS-05` devient « par lot » ;
- E15 : format de la date-heure ;
- E4 et E6 : numérotation et gras, si le moteur les prend en charge ;
- E1 : l'emblème, si le pilote en fournit l'image.

**À l'écran** : dans la modale d'impression, le numéro du JMP et les supports deviennent facultatifs.

## 4. Questions au pilote (recommandation en premier)

- **Q1 — En-tête** : **République, devise, autorité, PRMP, UGPM**, comme l'avis réel (recommandé). Avec l'emblème ?
  Si oui, merci de fournir l'image officielle.
- **Q2 — Tout le reste de la colonne « Proposition »** : d'accord (recommandé) ?
- **Q3 — Lieu de signature** : **la localité de l'autorité contractante** (recommandé : `B04-DS-10`, déjà saisie pour
  l'adresse de consultation), ou des pointillés à compléter à la main comme sur l'avis réel ?
- **Q4 — Numérotation et gras** : **les demander au moteur du serveur** (recommandé), ou s'en passer ?
- **Q5 — Articles du Code** (juriste) : « 30, 35 et 67 » (document type) ou « 35, 63 et 67 » (avis réel) ?
- **Q6 — « auprès de … »** : **nommer l'autorité** (recommandé : plus clair pour le candidat), ou garder « l'Autorité
  contractante » du document type ?
- **Q7 — Régisseur** : celui de l'ARMP (document type), ou celui de la **Commission compétente** de la ligne (avis réel) ?
- **Q8 — QR code de vérification** : **plus tard, sujet à part** (recommandé), ou maintenant ?

> ⚠️ **Arbitrage du pilote du 30/09 : « oui » aux recommandations.**
> - Q1 : en-tête sans l'emblème pour l'instant ; il sera ajouté quand le pilote fournira l'image.
> - Q2 : oui.
> - Q3 : lieu = `B04-DS-10`.
> - Q4 : numérotation demandée au moteur (`{{NUM}}`) ; le gras n'est pas demandé.
> - Q5 et Q7 : en attente (juriste, pilote) ; le texte du document type est gardé.
> - Q6 : l'autorité est nommée.
> - Q8 : plus tard.
>
> Modèles refaits côté front (`AVIS-F` 91/91, `AVIS-T` 97/97). Demande backend : §B7 de
> `demande-backend-2026-09-30-avis-specifique.md`. Modale : le numéro du JMP et les supports sont facultatifs.

> ⚠️ **Suite du 30/09.**
> - **Emblème (Q1)** : le serveur l'a déjà. C'est l'image de tête des 14 modèles de PV et des 2 lettres de renvoi
>   (`templates/PV_*.docx`, `word/media/image1.png`, 750 × 492 px). Elle réunit le sceau, le drapeau,
>   « REPOBLIKAN'I MADAGASIKARA » et la devise, comme en tête de l'avis réel. **Proposition** : la placer en tête de
>   l'avis, centrée, au-dessus de l'autorité, et **retirer** alors nos deux lignes « REPOBLIKAN’I MADAGASIKARA » et
>   devise, qu'elle contient déjà. À confirmer par le pilote.
> - **Bénéficiaire du paiement (Q7)** et **QR code (Q8)** : plus tard, sujets à part (décision du pilote).
> - **Articles du Code (Q5)** : rappel donné au pilote ; en attente.
