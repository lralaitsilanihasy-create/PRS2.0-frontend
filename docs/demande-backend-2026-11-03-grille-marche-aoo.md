# Demande backend — 2026-11-03 — Grille du marché sur appel d'offres : les points du manuel encore absents

## Contexte

Le pilote a comparé la grille d'un PV de marché (00009/MAOO-CC/CNM/PV/2026) au **manuel de contrôle a priori**, chapitre 2, III.C
« Examen de Marché et Contrat-cadre sur Appel d'Offres Ouvert », p. 47-55. Cette grille réunit les 9 points communs aux dossiers de
marché (`tr_points_ctrl`, ordres 16 à 24, sans sous-type) et les 9 points du `MAOO` (ordres 84 à 92). Le MAOO-CC, le MAOOI, le
MAOOPREQUAL, le MAOR-CC et le MAOR en héritent par `GRILLE_BASE`.

Le front a lu les **descriptions** des points, pas seulement leurs libellés. La grille couvre le tableau des points de vérification
(p. 50-51) :
- la correction des erreurs, le rabais, la préférence et les critères du DAO sont dans le point 19 ;
- le quorum du PV de validation est dans le point 91 ;
- le délai d'un appel d'offres restreint, compté depuis la dernière réception d'une lettre, est dans le point 95.

**Restent absents trois contrôles que le manuel demande, et trois précisions.** Les libellés et descriptions ci-dessous sont
**proposés** : le backend les fixe et corrige ce document en place (encadré ⚠️ daté).

## B1 — Trois points à ajouter au `MAOO` (hérités par ses dérivés)

| Libellé proposé | Description proposée | Source |
|---|---|---|
| **Offre retenue acceptable** | L'offre de l'attributaire n'est-elle ni trop chère au regard de l'estimation, ni au-delà des crédits alloués, ni contraire à la législation, notamment fiscale et douanière, ni assortie de conditions d'exécution contraires à la réglementation ? | p. 52-53 ; CMP, art. 1 |
| **Publicité effective de l'avis** | L'avis a-t-il paru sous les formes obligatoires : affichage au siège et aux organes de contrôle, Journal des marchés publics, journal national ou local, site de l'ARMP ? Les pièces qui l'attestent sont-elles jointes : journal, ou reçu ou facture « service fait » pour la radio ou la télévision ? | p. 47-48 ; décret n° 2019-1310, art. 2.1 |
| **Offres anormales : processus et seuils** | La détection des offres anormalement basses **et hautes** a-t-elle suivi le processus et les pourcentages fixés dans les DPAO ? | p. 51 |

- Le troisième complète le point commun 20 (« Offres anormales : justification demandée »), qui ne vérifie que la demande de
  justification avant un rejet. Il peut aussi s'écrire comme une description élargie du point 20, si le backend le juge plus clair.
- Pour le `MAOR` et le `MAORI`, la **publicité effective** porte sur les lettres d'invitation, déjà contrôlées par le point 95. Le
  point « Publicité effective de l'avis » ne doit donc pas s'y appliquer : un point `MAOO` hérité qui ne vaut pas pour le restreint
  doit en être écarté, ou rattaché aux seuls sous-types ouverts.

## B2 — Trois précisions de description

| Point | Ajout proposé | Source |
|---|---|---|
| 19 — Montant évalué conforme au DAO | « … et les **variantes techniques** prévues par le DAO » | p. 51 |
| 87 — Conformité des documents essentiels | « … ; offre **complète** : bordereau des prix ou DQE renseigné en entier et non modifié » | p. 53 |
| 23 — Rapport signé de tous les membres | « … signé **et paraphé** de tous les membres » | p. 47 |

## Questions

- **Q1** — Les PV déjà rendus gardent-ils leur grille d'origine ? Le front suppose que oui : une grille servie est figée avec son
  examen, comme lors des ajouts V94-V100.
- **Q2** — Les nouveaux points sont-ils **obligatoires** (`OBLIGATOIRE = true`), comme les autres points du `MAOO` ?

## Ce que fait le front

Rien à coder : la grille est servie par le serveur, l'écran l'affiche telle quelle. À la livraison, le front relit la grille
effective (`GET …?sousType=`) du MAOO, du MAOO-CC et du MAOR.

> ⚠️ **2026-11-03 — B1, B2 livrés (PRS20, V162), avec les libellés et descriptions fixés, et les réponses aux deux questions.**
> - **B1** : trois points du `MAOO`, hérités par ses dérivés, aux libellés proposés.
>   - **Offre retenue acceptable** : « L'offre de l'attributaire n'est-elle ni trop chère au regard de l'estimation, ni au-delà des
>     crédits alloués, ni contraire à la législation (fiscale, douanière), ni assortie de conditions d'exécution irrégulières (CMP,
>     art. 1) ? »
>   - **Publicité effective de l'avis** : « L'avis a-t-il paru sous les formes obligatoires (affichage, JMP, journal, site de l'ARMP)
>     et les preuves sont-elles jointes : journal, ou reçu ou facture « service fait » (radio, télévision) (décret 2019-1310, art. 2.1) ? »
>   - **Offres anormales : processus et seuils** : la description proposée.
>   - Les descriptions sont **raccourcies** : la colonne est limitée à 255 caractères.
>   - Le point commun 20 reste tel quel ; le nouveau point le complète.
>   - Les nouveaux points sont **semés en fin de grille**, après les points actuels du MAOO : le semeur ne réordonne pas l'existant.
> - **Écarter du restreint** : nouvelle colonne `SOUS_TYPES_EXCLUS` sur les points. « Publicité effective de l'avis » est écarté des
>   `MAOR`, `MAORI` et `MAOR-CC`, sur toute la chaîne d'héritage. Les autres dérivés du MAOO le gardent.
> - **B2** : les trois précisions sont posées. Pour le point 87, la formule est resserrée : « … ; offre complète : bordereau des prix ou
>   DQE entier et non modifié ? ». Une description déjà retouchée par l'Administrateur n'est pas écrasée.
> - **Q1** : oui pour les PV déjà rendus, qui gardent leurs points évalués. Mais la grille se lit **vivante** : un examen encore en cours
>   devra statuer sur les nouveaux points avant sa soumission.
> - **Q2** : oui, les trois points sont **obligatoires**.