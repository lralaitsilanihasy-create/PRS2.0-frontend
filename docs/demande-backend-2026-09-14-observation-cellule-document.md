# Demande backend — Rattacher une observation d'examen à une CELLULE du document

**Date** : 2026-09-14 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : refonte de l'examen (maquette `maquettes-design/src/ExamenLigne.tpl.html` validée par Mathieu et ses chefs). Une ligne « Au lieu de / Lire » vise une cellule précise du document officiel (ex. « MODE DE PASSATION » de la ligne 6) : la cellule est encadrée dans le document, et « Au lieu de » est pré-rempli.

## Constat

- Aujourd'hui, `t_observation_controle` porte N lignes par `t_examen_detail` (`AU_LIEU_DE`, `LIRE`, `ORDRE`). La ligne de marché n'est connue que via `t_examen_detail.ID_DETAIL`, nul pour les portées DOSSIER, FICHE et AGPM. Rien n'indique la colonne visée.
- À la signature d'un PV FAVR, `t_observation_pv` fige un libellé que le front redécoupe par expression régulière (`decomposerObservation`) ; le PV Word lit `construireObservations`.
- Retrouver la cellule en cherchant la valeur « Au lieu de » dans la ligne est ambigu : deux montants peuvent être égaux, les bénéficiaires multiples sont fusionnés en `rowspan`, un même mode apparaît sur plusieurs lignes. C'est impossible pour la fiche et l'AGPM, dont les résultats n'ont pas de ligne. La demande n'est donc pas superflue.

## Demande

### 1. Migration `V30__observation_cellule_cible.sql` (additive, idempotente)

```sql
ALTER TABLE public.t_observation_controle
    ADD COLUMN IF NOT EXISTS "CHAMP_CIBLE"     varchar(40),
    ADD COLUMN IF NOT EXISTS "ID_MARCHE_CIBLE" integer,
    ADD COLUMN IF NOT EXISTS "ID_BENEF_CIBLE"  integer;
ALTER TABLE public.t_observation_pv
    ADD COLUMN IF NOT EXISTS "CHAMP_CIBLE"     varchar(40),
    ADD COLUMN IF NOT EXISTS "ID_MARCHE_CIBLE" integer,
    ADD COLUMN IF NOT EXISTS "ID_BENEF_CIBLE"  integer;
-- sur chaque table : CHECK ("CHAMP_CIBLE" IS NOT NULL OR ("ID_MARCHE_CIBLE" IS NULL AND "ID_BENEF_CIBLE" IS NULL))
```

- Pas de clé étrangère, comme en V19 : c'est un instantané, soumis à la purge du circuit, et les lignes restent retirables en rectification.
- Pas de reprise des données : l'existant vaut NULL, soit le comportement actuel.
- Entités mises à jour dans le même commit (`ddl-auto=validate`). Vérifier que V30 est libre au moment d'implémenter.

### 2. Contrat

- `ObservationControleDto` (y compris `ExamenDetailDto.observations[]`) et `ObservationPvDto` gagnent trois champs facultatifs :
  - `champ` (string ou null) ;
  - `idMarcheCible` (`t_marche.ID_DETAIL`) ;
  - `idBenefCible` (`t_service_beneficiaire.ID_BENEF`).
- `ObservationPvDto` gagne en plus `documentCible`, déduit du code : `PPM`, `FICHE`, `AGPM` ou null.
- Rétrocompatible : un champ absent en entrée vaut null. Aucune nouvelle URL. Le `libelle` figé ne change pas d'un caractère.

### 3. Codes de champ (liste fermée, énumération `@JsonValue` comme `ChampAnomalie`)

| Document | Portée du point | Codes |
|---|---|---|
| PPM | LIGNE, DOSSIER | `nature` `objet` `montEstim` `nouvMontEstim` `mode` `financement` `lancement` `ouverture` `attribution` ; par bénéficiaire : `soa` `compte` `montBenef` `nouvMontBenef` |
| Fiche de présentation | FICHE | `derogatoires.{objet,montEstim,mode,justification}`, `delaisAmenages.{objet,montEstim,mode,delaiRemise,justification}`, `contratsCadres.{objet,montEstim,mode,delaiRemise}` |
| Projet d'AGPM | AGPM | `agpm.{compte,nature,objet,montEstim,financement,mode,dateDao}` |

Les préfixes permettent de retrouver le document à partir du seul code.

### 4. Validation

Un seul validateur, appelé par `/api/examen-details` et par `/api/observation-controles` (POST et PUT). En cas d'erreur : 400 ciblé sur `observations[i].<champ>`.

1. `champ` nul impose `idMarcheCible` et `idBenefCible` nuls.
2. Code inconnu, ou étranger au document de la portée du point : refusé. La portée SUPPRESSION n'accepte aucun champ.
3. Portée LIGNE : `idMarcheCible` facultatif et forcé à la ligne du résultat ; s'il est fourni et différent, 400.
4. Portées DOSSIER, FICHE, AGPM : `idMarcheCible` obligatoire dès qu'un champ est posé, et doit être une ligne du dossier examiné. Le serveur ne vérifie pas que la ligne figure dans la fiche ou l'AGPM (documents calculés côté front ; leur règle de calcul n'est pas recopiée).
5. `idBenefCible` n'est admis qu'avec les codes par bénéficiaire, et doit être un bénéficiaire de `idMarcheCible`.
6. Verrous inchangés : l'examen reste modifiable jusqu'à PV_SIGNE.

### 5. Propagation

- Projet de PV : lit `ExamenDetailDto`, rien à faire.
- Instantané FAVR (`genererPourPv`) : recopie les trois colonnes ; nulles pour une pièce ou un point sans ligne détaillée.
- `GET /api/observations-pv` : sert les nouveaux champs à tous, PRMP comprise (ce n'est pas une identité).
- PV Word : inchangé en v1.

## Tests attendus

1. PUT `examen-details` avec `champ: "mode"` sur un point LIGNE : relu à l'identique, `idMarcheCible` égal à la ligne.
2. Corps sans ces champs : valeurs nulles ; tous les tests existants restent verts.
3. 400 sur : code inconnu ; code PPM sur un point FICHE ; point FICHE sans ligne ; ligne d'un autre dossier ; bénéficiaire étranger à la ligne ; bénéficiaire avec `objet` ; champ sur SUPPRESSION.
4. Le même jeu de cas via `/api/observation-controles`.
5. À la signature FAVR, `observations-pv` sert la cible et `documentCible` ; le `libelle` reste identique à l'octet près.
6. La PRMP reçoit les champs de cible.
7. V30 passe sur Testcontainers ; le CHECK refuse une cible sans champ.

## Côté front

- Examen : « Observer cette cellule » crée la ligne d'observation avec la cible et pré-remplit « Au lieu de » (modifiable). L'encadrement se recalcule à partir des observations enregistrées.
- Carte d'observation et rectification PRMP : la cellule est encadrée à partir des nouveaux champs ; `decomposerObservation` reste intact.
