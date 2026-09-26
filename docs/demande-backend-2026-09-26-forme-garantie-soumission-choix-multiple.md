# Demande backend — 2026-09-26 — Forme de la garantie de soumission : plusieurs formes admises (B05-GS-02)

**Origine** : la fiche des faits du dossier réel 2463 (`docs/jeu-donnees-2463-faits.md`, §4 et §10), arbitrée par le
pilote le 26/09/2026 : « demander au backend une liste à choix multiples ».

## Le constat

Le DPAO du dossier réel (clause 6.6, p.18) dit :

> Une garantie de soumission doit être fournie dans **l'une des formes suivantes** :
> – soit une garantie bancaire
> – soit une caution personnelle et solidaire
> – soit un chèque de banque – libellée au nom de Monsieur le Receveur Général d'Antananarivo à verser auprès du
> Trésor public et dont la quittance est à joindre dans l'offre

C'est le candidat qui choisit parmi les formes que l'acheteur admet. Or l'information `B05-GS-02` « Forme de la
garantie de soumission » est aujourd'hui une **liste à choix unique** (`LISTE`, options : « Dépôt en numéraire au
Trésor » / « Caution personnelle et solidaire d'un organisme agréé par le MEF » / « Garantie bancaire » / « Chèque de
banque »). La fiche ne peut donc pas dire ce que le dossier dit ; le jeu 2463 se replie sur « Garantie bancaire »,
ce qui est faux par omission.

## B1 — `B05-GS-02` devient une liste à choix multiples

- Type : `LISTE_MULTIPLE` (même contrat que `B04-CD-01`, livré le 25/09) : la valeur est la liste des options
  retenues **séparées par des virgules, dans l'ordre du référentiel** — par exemple
  `Caution personnelle et solidaire d'un organisme agréé par le MEF,Garantie bancaire,Chèque de banque`.
  Aucune option ne contient de virgule : le séparateur reste sûr.
- Options : inchangées (les quatre formes du CMP).
- Condition : inchangée (`garantieSoumission = OUI`) ; **au moins une** forme quand la garantie est exigée
  (contrôle bloquant, comme aujourd'hui pour une valeur vide).
- Valeurs existantes : une valeur à une seule option est déjà une liste valide à un élément — pas de migration de
  données, seul le type du champ change au référentiel.
- Le front n'a rien à construire : la saisie (`LISTE_MULTIPLE`, cases à cocher), la lecture (`optionsChoisies`) et
  le document de l'examen (lot B) traitent déjà ce type de façon générique.

## B2 — Le rendu dans les documents produits

Le DPAO (et le DPAC pour un contrat-cadre) imprime aujourd'hui la forme retenue ; avec plusieurs formes, il doit
reprendre la tournure du dossier réel : « Une garantie de soumission doit être fournie dans l'une des formes
suivantes : – soit … – soit … ». Une seule forme retenue → phrase au singulier, comme aujourd'hui. Les modèles
C1 (garantie bancaire) et C2 (caution) restent régis par `B04-CD-02` : rien ne change pour eux.

## B3 — Le jeu 2463 après livraison

`scripts/demo-dao-valeurs.mjs` (VALEURS_2463) passera « Garantie bancaire » à
`Caution personnelle et solidaire d'un organisme agréé par le MEF,Garantie bancaire,Chèque de banque`
— les trois formes du DPAO 6.6, [R] — et la ligne [H] du §10 de la fiche des faits sera fermée. Tant que le champ
est à choix unique, le jeu garde « Garantie bancaire » (une valeur à plusieurs options serait refusée : « n'est
pas une option »).

## Ce que le backend rend

Le référentiel servi (`GET /api/champs-fiche-marche`) avec `B05-GS-02.type = 'LISTE_MULTIPLE'`, la validation
(au moins une option, options connues seulement), le rendu B2 dans les six rendus du moteur de documents, et un
mot ici si la livraison s'écarte de la demande (encadré ⚠️ daté, à l'endroit corrigé).
