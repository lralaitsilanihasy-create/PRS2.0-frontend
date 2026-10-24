# Demande backend — 2026-10-24 — Libérer la ligne 303336 pour rejouer la chaîne de recette

## Contexte

La réponse à Q2 de `demande-backend-2026-10-24-horloge-recette.md` laisse en l'état, comme chaîne abandonnée, la chaîne jouée le
24/10 sans horloge de recette sur l'entretien et la réparation des véhicules administratifs (ligne 303336 du plan
`00001/PPM-AGPM/CNM/2026`). Elle demande aussi de dire au backend si la ligne doit porter la chaîne propre.

**C'est le cas, sur l'arbitrage du pilote (24/10).** Aucune autre ligne du plan ne s'y prête :
- les quatre lignes en appel d'offres ouvert et contrat-cadre (303336 à 303339) ont déjà chacune leur procédure ;
- les dix-neuf autres sont des marchés à quantité fixe, en mode 5 ou 13, de 1,1 à 70 M Ar.

La chaîne abandonnée sur la ligne 303336 :

| Objet | Identifiant |
|---|---|
| Procédure (`t_dossier_mec`) | idDmc 4 |
| Fiche validée | `ID_FICHE` 11, n° `14-CC/MEF/SG/PRMP.2026`, avec deux valeurs retouchées en base (`B04-SE-03`, `B04-CP-02`) |
| Dossier du DAO | 100384 = `00004/DAOO-CC/CNM/2026` : réception 1100106, dispatch 5, examen 21, PV 65 `00004/DAOO-CC/CNM/PV/2026` signé, transmission SIGMP, archivage |
| Remise électronique | CAO, responsable, paramètres internes, cérémonie des clés et clés des trois détenteurs |
| Avis spécifique | imprimé, publication déclarée le 26/10 |
| Candidats | 3 reçus validés, 3 offres (garages Ambohijatovo, Méca Services Tana, Auto Entretien Ivato) |
| Ouverture et évaluation | séance, apports, PV d'ouverture signé ; évaluation, décisions, rapport signé |
| Attribution | lot 1 `AU_CONTROLE` ; dossier de marché 100385 (MAOO-CC) soumis, projet de marché, instantanés, pièces |
| Diffusion | notifications et entrées des journaux de ces objets |

Le front a fait une sauvegarde le 24/10, avant les deux retouches : `C:/Users/LANTO/prs-sauvegardes/DBPRS20-2026-10-24-avant-recalage.dump`.

## L1 — Remettre la ligne 303336 dans l'état d'avant sa fiche

- **La ligne** reprend le statut `PREVU`. Le PPM, sa version et ses lignes ne sont pas touchés.
- **La procédure et tout ce qui en descend** (tableau ci-dessus) sont retirés. Une fiche ne se supprime pas par l'API (405) :
  le retrait est une opération de recette, faite par le backend, et tracée au journal général avec son motif (« chaîne de recette
  abandonnée du 24/10, rejouée sous horloge de recette »).
- **Restent en place** :
  - les comptes des trois garages et leurs entreprises, qui seront réutilisés ;
  - les comptes de la CAO et du dépositaire ;
  - le modèle de PV et les référentiels.
- **Les autres chaînes ne bougent pas** : produits d'entretien (idDmc 3, 100382, 100383), articles de bureau (idDmc 2, 100381),
  consomptibles (idDmc 1, 100380).

> ⚠️ **2026-10-24, fait (backend), 14:59**
> - **Retiré, en une transaction** : 267 lignes rattachées à la procédure 4, à la fiche 11 ou aux dossiers 100384 / 100385, plus
>   les racines (2 dossiers, la fiche, la procédure) et le circuit CNM du DAO (réception 1100106, dispatch 5, examen 21 et ses
>   28 détails, PV 65 et ses navettes, transmission). Les notifications de la chaîne sont parties aussi : 13 sur les dossiers, 3 sur
>   le PV et 36 sur la procédure.
> - **La ligne 303336 est à `PREVU`.** Le PPM, ses lignes, ses prévisions et son PV n'ont pas bougé : c'est vérifié par comparaison
>   avec la sauvegarde du 17/10, où seul le statut différait.
> - **Restent** : les autres chaînes (idDmc 1 à 3, dossiers 100379 à 100383), les comptes (garages, CAO, dépositaire), les
>   entreprises, les modèles, les référentiels.
> - **Journal général** : il reste entier, car il est immuable. Il reçoit l'entrée `RETRAIT_CHAINE_RECETTE` (table `t_dossier_mec`,
>   enregistrement 4), avec le motif demandé.
> - **Les fichiers chiffrés des trois offres** sont mis de côté dans `C:/Users/LANTO/prs-sauvegardes/offres-chaine-303336-2026-10-24/`
>   et non supprimés.
> - **Sauvegarde prise juste avant** : `C:/Users/LANTO/prs-sauvegardes/DBPRS20-2026-10-24-avant-liberation-303336.dump`. Celle du
>   front, faite à 13:31, ne contenait pas la fin de la chaîne. Le script est à côté (`liberer-ligne-303336-2026-10-24.sql`).
> - **La prochaine procédure portera l'identifiant 5.** Seuls les numéros sont rendus (L2), pas les identifiants internes.

## L2 — Les numéros

- **Les références du DAO et du PV** (`00004/DAOO-CC/CNM/2026`, `00004/DAOO-CC/CNM/PV/2026`) : le front préfère qu'elles soient
  rendues, pour que la chaîne propre les reprenne et que la série reste sans trou. Si la numérotation ne le permet pas, le backend
  le dit, et la chaîne propre prend `00005`.
- **Le n° de la procédure** `14-CC/MEF/SG/PRMP.2026` est saisi dans la fiche (`B02-OE-01`) : la chaîne propre le reprend.

> ⚠️ **2026-10-24, fait (backend)** — `00004` est rendu. La numérotation des dossiers de mise en concurrence tient dans un compteur
> par famille et par année (`t_sequence_reference`, DMC 2026). Il était à 4, puisque 00004 était le dernier numéro servi ; il est
> revenu à 3. Le prochain dossier du DAO soumis recevra donc `00004/DAOO-CC/CNM/2026`. Son PV prendra `00004/DAOO-CC/CNM/PV/2026`,
> car la référence du PV dérive de celle du dossier. Le dossier de marché 100385 n'avait pas encore de numéro (compteur DDM à 0) :
> il n'y avait rien à rendre.

## Ce que le front fera ensuite

Rejouer la chaîne sur la ligne 303336 avec les scripts du 24/10. L'horloge de recette sera réglée entre les étapes, aux dates de
la fiche :
- fiche et circuit de la CNM du DAO entre le 13 et le 23/10 (horloge reculée), ou à partir d'aujourd'hui si l'horloge ne recule
  pas — voir Q1 ;
- publication le 26/10 ;
- reçus du 03 au 10/11 ;
- offres les 24, 25 et 26/11, heure limite le 27/11 à 09:00, séance à 09:30 ;
- évaluation du 30/11 au 04/12 ;
- dossier de marché le 07/12.

Aucune retouche en base. À la fin, l'horloge revient à l'heure réelle (`DELETE`).

## Questions

- **Q1 — Reculer l'horloge.** `PUT { avancer: "-PT30M" }` est admis : un décalage négatif de plusieurs jours l'est-il aussi ? Il
  permettrait de jouer la fiche et le circuit de la CNM avant la publication du 26/10, sur plusieurs jours, comme le prévoit le
  plan. Sinon, la chaîne commence aujourd'hui (24/10) et la publication est repoussée d'autant.
- **Q2 — Les autres chaînes.** L'horloge de recette est commune au serveur. Une fois avancée à fin novembre, les procédures en
  cours (articles de bureau, produits d'entretien) verront aussi le temps passer : délais, rappels, alertes. Le front ne voit pas de
  geste prévu sur elles d'ici là. Le backend voit-il un traitement planifié (`AlerteScheduler`…) qui écrirait sur elles, et
  faut-il le suspendre pendant la rejouée ?

> ⚠️ **2026-10-24, réponses (backend)**
> - **Q1 — Oui, l'horloge recule de plusieurs jours.** `PUT { maintenant: "2026-10-16T08:00:00", motif }` ou
>   `{ avancer: "-P8D", motif }` sont admis. Deux limites :
>   - **ne pas reculer avant le 16/10.** Le plan `00001/PPM-AGPM/CNM/2026` a été signé le **15/10**, et une procédure créée avant
>     daterait d'avant l'approbation de son plan. Le 13/10 proposé est donc trop tôt ; commencer le 16/10 au plus tôt ;
>   - **une fois la chaîne lancée, ne plus revenir en arrière** : seulement avancer. Revenir derrière un événement déjà enregistré
>     de la chaîne inverserait ses dates.
>
>   Pendant que l'horloge est avant le 19/10, les chaînes 1 à 3 (créées du 17 au 19/10) paraîtront « dans le futur » à l'écran. Ce
>   n'est que de l'affichage : rien ne leur est écrit pour autant.
> - **Q2 — Pas de suspension nécessaire.** Le serveur a dix traitements planifiés.
>   - **Quatre peuvent changer un état** :
>     - le ménage des comptes candidats non confirmés après 7 jours ;
>     - la purge des dépôts d'offre abandonnés ;
>     - le suivi des déclarations sans suite ;
>     - les plans réputés approuvés.
>
>     Ils n'ont rien à toucher aujourd'hui : les 6 comptes candidats sont confirmés, il n'y a aucune déclaration sans suite, et aucun
>     plan n'est en attente (seuls 100383 et 100385, deux dossiers de marché, étaient ouverts).
>   - **Les autres ne font qu'avertir** : rappels de séance et de vérification des parts, alertes d'attribution, d'examen, de fin
>     de mandat, jalons. Le rattrapage du DAO complet régénère un document manquant, mais il ne dépend pas de l'heure. Une fois l'horloge avancée, la PRMP et la CAO de la chaîne 3 (dossier 100383) pourront recevoir des
>     alertes de délai, une fois chacune. Rien n'est modifié sur ces procédures.
>
>   Deux précautions pendant la rejouée :
>   - **confirmer un compte candidat créé pour l'occasion avant d'avancer l'horloge de plus de 7 jours**, sinon le ménage de nuit
>     le supprime ;
>   - **ne pas avancer l'horloge pendant le dépôt d'une offre** : un dépôt en cours deviendrait « abandonné » et serait purgé.
>
>   Si le pilote veut le silence complet, chaque traitement se coupe par sa propriété (`app.offres.cron-entretien=-`, etc.) au
>   lancement : il suffit de le dire.
