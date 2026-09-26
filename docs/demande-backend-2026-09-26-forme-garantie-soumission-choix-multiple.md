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

> ⚠️ **Livré le 2026-09-26 (backend) — §B1 tel que demandé.** Seul le type change : dans le fichier de correspondance des
> fournitures (`docs/referentiel-champs-fiche-marche-fournitures.csv`, à réimporter) et, pour une base déjà chargée, par
> `PRS20/docs/referentiel/2026-09-26-forme-garantie-soumission-choix-multiple.sql` (pas de migration Flyway : aucun schéma
> ne bouge, `LISTE_MULTIPLE` est admis depuis V45). Options, condition, obligatoire, documents (DPAO, repris AE et CCAP)
> inchangés. Contrat de `B04-CD-01` : reçu en tableau ou en chaîne, enregistré dans l'ordre des options, option inconnue →
> 400 `B05-GS-02` nominatif, liste vide = valeur absente → bloquant `OBLIGATOIRE` quand la garantie est exigée. Aucune
> reprise de données ; les documents des versions déjà validées ne sont pas régénérés (la tournure du §B2 s'imprime à la
> prochaine validation).

## B2 — Le rendu dans les documents produits

Le DPAO (et le DPAC pour un contrat-cadre) imprime aujourd'hui la forme retenue ; avec plusieurs formes, il doit
reprendre la tournure du dossier réel : « Une garantie de soumission doit être fournie dans l'une des formes
suivantes : – soit … – soit … ». Une seule forme retenue → phrase au singulier, comme aujourd'hui. Les modèles
C1 (garantie bancaire) et C2 (caution) restent régis par `B04-CD-02` : rien ne change pour eux.

> ⚠️ **Livré le 2026-09-26 (backend) — §B2, avec deux précisions.**
>
> - **Où** : la tournure s'imprime partout où le champ s'imprime — **DPAO, CCAP et acte d'engagement** (chaque AE d'une
>   ligne allotie), en docx comme en pdf. **Pas de DPAC** : `B05-GS-02` n'est pas ouvert au contrat-cadre (`typesMarche` =
>   quantité fixe, à commande) ; le jour où le contrat-cadre exigera une garantie de soumission, ce sera un champ à
>   ouvrir, pas un rendu à ajouter.
> - **Comment** : la ligne garde son libellé — « **Forme de la garantie de soumission :** Une garantie de soumission doit
>   être fournie dans l'une des formes suivantes : », puis une ligne « **– soit …** » par forme, dans l'ordre du référentiel,
>   avec l'article des quatre formes du CMP (« – soit une caution personnelle et solidaire d'un organisme agréé par le
>   MEF », « – soit une garantie bancaire », « – soit un chèque de banque », « – soit un dépôt en numéraire au Trésor ») ;
>   une option qui ne serait pas l'une des quatre s'imprimerait telle quelle. Une seule forme → « Forme de la garantie de
>   soumission : Garantie bancaire », inchangé. `B04-CD-01` (fiches exigées) garde sa liste jointe par virgules : des
>   fiches cumulées, pas des alternatives. La valeur observée d'une observation d'examen (`valeurChampFiche`) reste la
>   liste jointe (« Garantie bancaire, Chèque de banque »).

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
