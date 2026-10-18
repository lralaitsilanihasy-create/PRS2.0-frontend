# Demande backend — 2026-10-18 — Requalifier en `DAOO-CC` un dossier de contrat-cadre déjà numéroté en `DAOO`

## Contexte

La demande « sous-type-contrat-cadre » du 18/10 (PRS20 c5bede7, V131) a fait de `DAOO-CC` un sous-type produit par la fiche. À
la Q1, le front avait proposé de ne pas requalifier les dossiers déjà soumis, et le backend l'avait accepté.

**Le pilote revient sur ce point le 18/10 :** la référence doit refléter le sous-type. Le cas réel :

| Dossier | Objet | Référence | Sous-type | Statut | Forme de la fiche |
|---|---|---|---|---|---|
| 100380 | Fourniture de consomptibles informatiques (ligne 303339) | `00001/DAOO/CNM/2026` | `DAOO` | `PRET_DISPATCH` (réceptionné le 18/10) | `CONTRAT_CADRE` (version soumise 5) |

La règle de la référence (`ReferenceService`, 20/07) rend la requalification possible **sans renuméroter** :
- le segment du milieu est le sous-type ;
- le numéro suit la série de la **famille** (`DMC`), par localité et par exercice.

Changer `DAOO` en `DAOO-CC` ne change donc que le libellé du segment : `00001/DAOO/CNM/2026` devient `00001/DAOO-CC/CNM/2026`. Le
numéro 00001 et la série ne bougent pas.

Un précédent existe déjà : la bascule `PPM` ↔ `PPM-AGPM` d'un plan (`DossierIntegriteService`, `remplacerSegmentSousType`), qui
remplace le segment de la référence du dossier, du PPM et du PV.

## B1 — La requalification d'un dossier contrat-cadre

**Cible :** un dossier `DMC` en `DAOO` dont la fiche porte la forme contrat-cadre, déjà soumis ou numéroté, tant que son PV n'est
pas signé (voir Q1). Jusque-là, la référence n'a pas été diffusée hors de la Commission.

**Effet :**
- le sous-type passe à `DAOO-CC` ;
- la référence du dossier remplace son segment (`…/DAOO/…` → `…/DAOO-CC/…`), avec le **même numéro** ;
- les références dérivées suivent, s'il y en a : PV d'examen, projet de PV, lettres de renvoi ;
- une **trace au journal** du dossier : ancienne et nouvelle référence, motif « requalification contrat-cadre (sous-type DAOO-CC,
  V131) ».

**Point technique :** `remplacerSegmentSousType` ne reconnaît aujourd'hui que les segments des plans (`SOUS_TYPES_DDP`). Il faut
l'ouvrir aux sous-types `DMC`, ou écrire une variante, sans risquer de confondre un segment d'entité avec un sous-type.

**Déclenchement :** au choix du backend.
- Une migration ponctuelle, qui requalifie les dossiers existants dans ce cas (en recette, le seul 100380).
- Ou une règle générale : un dossier non clôturé suit le sous-type de sa fiche.

Le front préfère la migration ponctuelle. La règle générale de la Q2 du 18/10 (« jamais après la soumission ») reste alors
valable pour l'avenir : désormais, un contrat-cadre naît en `DAOO-CC`.

> ⚠️ **2026-10-18, livré (backend, V132)** — une migration ponctuelle, comme le front le préférait ; pas de règle générale.
> - **Cible** : un dossier `DMC` né d'une fiche, en `DAOO`, dont la version soumise de la fiche (à défaut la dernière validée) est
>   un contrat-cadre, non clôturé et sans PV signé. En recette, seul le 100380 est concerné.
> - **Effet** : le sous-type passe à `DAOO-CC`, et `00001/DAOO/CNM/2026` devient `00001/DAOO-CC/CNM/2026`, même numéro. Les
>   références suivent dans ses réceptions (le 100380 en a une), ses versions archivées et ses PV non signés (il n'en a aucun).
> - **Les lettres de renvoi** ont leur propre compteur et ne citent pas la référence du dossier : rien à changer.
> - **Le journal** : une action `SOUS_TYPE_REQUALIFIE` (rang 31, après la réception), sans opérateur, auteur `migration V132`.
>   Détail : « Requalification contrat-cadre (sous-type DAOO-CC, V131) : DAOO → DAOO-CC ; référence 00001/DAOO/CNM/2026 →
>   00001/DAOO-CC/CNM/2026, même numéro ».
> - **Le point technique** : le remplacement porte sur le segment exact `/DAOO/`, en SQL. Un segment d'entité ne peut pas s'y
>   confondre, et `remplacerSegmentSousType` reste réservé aux plans.
> - **Vérifié** : la référence ne figurait nulle part ailleurs en base (toutes les colonnes texte et JSON ont été parcourues),
>   seulement dans `t_dossier` et `t_reception`.

## B2 — Les points d'attention

- **Le chronométrage et la file du dispatch :** le dossier reste à son étape (prêt au dispatch), avec ses délais. Seul son libellé
  change.
- **Les écrans figés** à la soumission (V104) gardent ce qu'ils ont figé, avec l'ancienne référence. Le front propose de ne pas les
  réécrire : ils témoignent de ce qui a été soumis.
- **Les documents déjà produits** qui citent la référence (s'il y en a : fiche de présentation PDF, accusés) sont régénérés à la
  demande. Les PDF de la fiche (DAO complet, avis) ne portent pas la référence du dossier.
- **Les notifications déjà envoyées** gardent l'ancienne référence. La trace au journal fait le lien.

## Questions

- **Q1 — Le périmètre.** Requalifier aussi un dossier dont le PV est déjà signé ? Le front propose **non** : une fois le PV signé,
  la référence a été diffusée (PV, avis) et ne change plus.
- **Q2 — Le statut `CLOTURE`.** Le front propose de ne jamais toucher un dossier clôturé.

> ⚠️ **2026-10-18, réponses (backend)**
> - **B2 — d'accord sur tous les points.** Le dossier garde son étape, ses délais et sa place dans la file du dispatch. Les écrans
>   figés et les notifications envoyées ne sont pas réécrits. Aucun document produit ne porte la référence du dossier, donc il n'y
>   a rien à régénérer.
> - **Q1 — non** : un dossier dont un PV est signé (ou archivé) n'est pas requalifié.
> - **Q2 — jamais** : un dossier clôturé n'est pas touché.

## Côté front

Rien à coder : la référence et le sous-type sont lus sur le dossier. Après livraison, le front vérifiera le dossier 100380 :
référence, journal, et carte de la page.
