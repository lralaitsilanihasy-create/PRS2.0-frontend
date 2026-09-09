# Demande backend — PV bloc VISA : descendre les noms + aligner le nom du Membre

**Date** : 2026-09-09 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : suite au correctif des colonnes
du bloc VISA (viseur à gauche, Membre à droite — OK). Le pilote demande deux ajustements de **mise en page**
du bloc VISA. Document généré côté backend (modèles `.docx`), le front ne fait qu'afficher le PDF.

## Mesures actuelles (PV 00001/PPM-AGPM/CNM/PV/2026 régénéré, page 1, largeur ~596 pt)

```
y=295  x= 77 (G) VISA DU SUPERIEUR HIERARCHIQUE            y=295  x=303 (D) A Antananarivo, le 09 septembre 2026
y=284  x= 77 (G) (Nom, prénoms, cachet et signature du     y=284  x=303 (D) (Nom, prénoms, cachet et signature du membre
y=272  x= 77 (G) supérieur hiérarchique)                   y=272  x=303 (D) en charge du dossier)
y=260  x= 74 (G) Visé par : Sitraka Tsitohaina             y=260  x=281 (D) Chef ANT Rabe (par délégation)
y=247  x= 74 (G) RANDRIANARISON, Président de la
y=235  x= 74 (G) Commission Nationale des Marchés
```

Deux constats :
- les noms (**« Visé par … »** à gauche, **« Chef ANT Rabe … »** à droite) démarrent à **y=260**, soit ~12 pt
  seulement sous les placeholders (y=272) : **aucune place** pour la signature manuscrite / le cachet ;
- **« Chef ANT Rabe … » est à x=281**, alors que les deux lignes du dessus dans la même cellule
  (« A Antananarivo … » et « (… membre en charge du dossier) ») sont à **x=303** → il est **désaligné**
  (~22 pt trop à gauche).

## Demande

1. **Descendre les deux blocs de nom** dans les cellules VISA — ajouter de l'espace vertical **entre le
   placeholder « (Nom, prénoms, cachet et signature …) » et le nom imprimé**, dans les DEUX cellules
   (gauche = « Visé par : … Président … » ; droite = « &lt;nom du Membre&gt; »), pour laisser la place à la
   signature et au cachet. (Quelques lignes vides / un espacement de paragraphe « avant » — à votre main sur
   la hauteur, l'intention est un espace de signature comme sur un document officiel.)

2. **Aligner le nom du Membre** (cellule de droite) sur la **même indentation gauche** que les lignes du
   dessus de cette cellule (« A Antananarivo … » et le placeholder du membre) — c.-à-d. **x=303** au lieu de
   **x=281**. Concrètement, le paragraphe du marqueur du Membre doit avoir le **même retrait/alignement** que
   les paragraphes d'en-tête de la cellule de droite.

## Points d'attention

- À appliquer de façon **cohérente sur les 12 modèles** (centrale / régionale, avec/sans réserves, PPM /
  PPM-AGPM), et pour l'intérim (le viseur peut porter une mention supplémentaire).
- Ne pas casser le rendu à deux colonnes déjà corrigé (viseur à gauche, Membre à droite).

## Contre-recette attendue (côté front, sur PV régénéré)

Je re-mesurerai les positions : nom du Membre à **x≈303** (aligné avec « A Antananarivo … ») et un **écart
vertical accru** entre les placeholders (y≈272) et les noms (nouveau y plus bas), dans les deux cellules.
