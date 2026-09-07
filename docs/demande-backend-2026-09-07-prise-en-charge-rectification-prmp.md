# Demande au backend `PRS20` — 7 septembre 2026 — Prise en charge AVANT la rectification PRMP

> Règle pilote (07/09) : étendre « **aucune action sans prise en charge** » (04/09, jusqu'ici pour les
> contrôleurs CNM) à la **rectification par la PRMP/UGPM**. La rectification d'un dossier ne doit pas
> être possible tant que la PRMP n'a pas cliqué « Prendre en charge ». Backend d'abord (le mécanisme
> de prise en charge est serveur) ; le front posera ensuite le verrou.

## Le constat — le mécanisme actuel ne couvre pas le PRMP

Sur un dossier en attente de rectification (`EN_ATTENTE_DECISION_PRMP`, ex. #100299),
`GET /api/dossiers/{id}/chronometrage` renvoie :

```
etapeCourante : null
attentePrmp   : true
attributaire  : MEMANT1        (l'examinateur, pas la PRMP)
acteursAttendus : null
taches        : RECEPTION, DISPATCH, EXAMEN, VISA, COSIGNATURE, VERIFICATION  (toutes closes)
```

Il n'y a donc **aucune étape ouverte ni porteur PRMP** pendant l'attente de rectification.
`POST /api/dossiers/{id}/prise-en-charge` répond **409** (« aucune étape n'est ouverte »). Le widget
`<app-chronometrage-dossier>` ne peut proposer aucun bouton « Prendre en charge » à la PRMP, et le
front n'a donc rien sur quoi gater la rectification.

## Demande

Ouvrir une **prise en charge chronométrable pour la PRMP** pendant `EN_ATTENTE_DECISION_PRMP` :

- Une **étape/porteur PRMP** (ex. `RECTIFICATION_PRMP`) est **ouverte** tant que le dossier est en
  attente de rectification, avec la **PRMP propriétaire comme porteur attendu**.
- `POST /api/dossiers/{id}/prise-en-charge` **fonctionne** dans cet état (au lieu de 409), la PRMP
  posant sa prévision comme les autres porteurs (heures ouvrées).
- `GET /api/dossiers/{id}/chronometrage` expose alors, dans cet état, `etapeCourante` = l'étape de
  rectification, `acteursAttendus`/`attributaire` = la PRMP, et le drapeau `actionAutorisee` du widget
  passe à `true` **seulement après** la prise en charge (comme pour les contrôleurs).
- **Gardes serveur en miroir** : `POST /resoumettre` (et l'import/PUT de rectification si vous voulez
  le fermer aussi) **refuse** (403/409) tant que la PRMP n'a pas pris en charge — pour que le verrou
  ne soit pas seulement cosmétique côté front.

Traitement du compteur : à votre main. La rectification PRMP est un temps **suspensif** (déjà compté
en `attentePrmpHeuresOuvrees`) ; la prise en charge sert surtout de **geste** (début d'action + verrou)
et, accessoirement, à mesurer le délai propre de la PRMP. Elle peut donc rester **hors du compteur net
CNM** — dites ce que vous retenez.

## Côté front — après livraison (je m'en charge)

- Monter `<app-chronometrage-dossier>` sur l'écran « Dossiers à rectifier » (`dossiers-a-rectifier.ts`),
  brancher sa sortie `actionAutorisee`.
- **Verrouiller** « ✎ Modifier le dossier » et « Resoumettre le dossier » tant que `actionAutorisee`
  est faux, avec le bandeau « 🔒 Cliquez d'abord Prendre en charge » (même motif que réception/examen/
  visa/vérification).

## Recette de contre-vérification

1. Dossier FAVR en `EN_ATTENTE_DECISION_PRMP`. Ouvrir « Dossiers à rectifier ».
2. Avant prise en charge : « Modifier le dossier » et « Resoumettre » **inertes** (verrou visible) ;
   un `POST /resoumettre` direct → **403/409**.
3. « Prendre en charge » (prévision) → les deux actions **s'activent** ; `actionAutorisee=true`.
4. Rectifier + resoumettre → le dossier repart en `EN_VERIFICATION`.
