# Demande backend — Servir la date de SOUMISSION sur le DTO dossier

> ✅ **CLÔTURÉE le 07/09** — backend livré (**V20**) : `DossierDto.dateSoumission` nullable, posée
> au `POST /soumettre` (plus à la création du brouillon), effacée au retour en brouillon (retrait) ;
> reprise V20 depuis le journal. Découverte : la colonne était écrite à la CRÉATION — le Secrétaire
> lisait une date de saisie sous un nom de soumission ; sémantique corrigée à la source, il lit
> désormais la vraie date de dépôt. Contre-recette front verte : « Dépôt du dossier » = 06/09 sur le
> Suivi des dossiers CNM (dossier réel). Aucun changement front (colonne déjà câblée).

**Date** : 2026-09-06 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : demande pilote —
le « Suivi des dossiers CNM » (PRMP) gagne une colonne **« Dépôt du dossier »** entre la référence
et l'enregistrement CNM. Terme métier précisé par le pilote : **la date de soumission EST la date
de dépôt du dossier** — même donnée, le contrat garde le nom `dateSoumission`.

## Constat

La date/heure de soumission du dossier est déjà persistée serveur — la réception la sert au
Secrétaire (`ReceptionDto.dateSoumission`) — mais le DTO dossier des listes ne la porte pas, et
`GET /api/receptions` répond une liste vide à la PRMP (portée, à ne pas élargir).

## Demande

Ajouter au DTO dossier (mêmes listes que `dateEnregistrement` / `datePrevisionnelleFin`) :

- **`dateSoumission`** (date-heure, nullable) : l'horodatage de la soumission par la PRMP —
  la même valeur que celle servie au Secrétaire sur la réception ; `null` pour un brouillon
  (et pour un dossier ancien sans date de soumission). Résolution **en lot**, pas de N+1.

Le front est prêt : la colonne « Soumission » affiche « — » tant que le champ n'est pas servi.

## Tests attendus

1. Dossier soumis → `dateSoumission` du DTO = celle de la réception (même source).
2. Brouillon → `null`.
3. La PRMP lit le champ sur `GET /api/dossiers` (portée des réceptions inchangée).

---

## Note de livraison backend — 2026-09-07 (`PRS20`, commit `9b21ee3`, migration **V20**)

`DossierDto.dateSoumission` (date-heure ISO, nullable) est mappée depuis la **colonne de l'entité** :
aucune requête de plus sur les listes, et lecture seule (jamais reprise d'un corps de requête).

### ⚠️ Un écart avec la demande, et pourquoi

La demande supposait que `ReceptionDto.dateSoumission` portait déjà l'horodatage de la soumission. En
réalité, `t_dossier.DATE_SOUMISSION` était écrite **à la création du brouillon** : le Secrétaire lisait une
**date de saisie** sous un nom de soumission, et un brouillon en portait toujours une. Servir cette valeur
telle quelle aurait contredit à la fois « `null` pour un brouillon » et le terme du pilote (« la date de
soumission EST la date de dépôt »).

J'ai donc corrigé la **sémantique à la source** plutôt que de maquiller le DTO :

- la date est posée par `POST /api/dossiers/{id}/soumettre`, et **plus** à la création ;
- un **retrait accepté l'efface** avec le retour en brouillon — le dépôt est annulé avec le retrait ;
- **V20 reprend l'existant depuis le journal** : dernière action `SOUMISSION` pour les dossiers soumis,
  `null` pour les brouillons jamais soumis, valeur conservée pour un dossier hors brouillon antérieur au
  journal.

**Conséquence à connaître** : sur d'anciens dossiers, la date de soumission affichée au Secrétaire a pu
**changer** — elle dit maintenant la vraie date de dépôt, plus celle de la saisie. Si quelqu'un s'en
étonne, c'est cette reprise.

Le Secrétaire (`ReceptionDto.dateSoumission`, format `yyyy-MM-dd HH:mm`) et la PRMP (`DossierDto`, ISO)
lisent désormais **la même colonne**, donc la même valeur.
