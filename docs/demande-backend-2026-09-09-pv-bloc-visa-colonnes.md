# Demande backend — PV : bloc VISA, remettre le « Visé par » à gauche et le nom du Membre à droite

**Date** : 2026-09-09 · **Demandeur** : frontend (`frontendprs2`) · **Origine** : constat pilote sur un PV
généré (PV N° 00001/PPM-AGPM/CNM/PV/2026, Commission Centrale). Le bloc de signature en bas du PV place le
**« Visé par … Président »** dans la MAUVAISE colonne, et n'imprime pas le nom du Membre à droite. Document
généré côté backend (modèles `.docx` + `PvDocumentGenerator`) — le front ne fait qu'afficher le PDF.

## Rendu ACTUEL (constaté)

```
VISA DU SUPERIEUR HIERARCHIQUE            A Antananarivo, le 08 septembre 2026
(Nom, prénoms, cachet et signature du     (Nom, prénoms, cachet et signature du
 supérieur hiérarchique)                   membre en charge du dossier)
                                           Visé par : Sitraka Tsitohaina
                                           RANDRIANARISON, Président de la
                                           Commission Nationale des Marchés
```

→ Deux problèmes : le « Visé par … Président » (c'est le VISA du supérieur hiérarchique) est imprimé **à
droite**, sous la signature du **membre** ; et **rien** n'apparaît sous la colonne du membre pour l'identifier.

## Rendu ATTENDU

```
VISA DU SUPERIEUR HIERARCHIQUE            A Antananarivo, le 08 septembre 2026
(Nom, prénoms, cachet et signature du     (Nom, prénoms, cachet et signature du
 supérieur hiérarchique)                   membre en charge du dossier)
Visé par : Sitraka Tsitohaina             RANDRIANARISON Chef ANT Rabe
RANDRIANARISON, Président de la           « (nom + prénom du Membre de la Commission
Commission Nationale des Marchés            en charge du dossier) »
```

Concrètement :

1. **Colonne GAUCHE** (sous « VISA DU SUPÉRIEUR HIÉRARCHIQUE » et son placeholder
   « (Nom, prénoms, cachet et signature du supérieur hiérarchique) ») : imprimer
   **« Visé par : &lt;nom prénom du viseur&gt;, &lt;rôle du viseur&gt; »**
   (ici « Visé par : Sitraka Tsitohaina RANDRIANARISON, Président de la Commission Nationale des Marchés »).
   → C'est le texte qui figure aujourd'hui à droite : il faut le **déplacer à gauche**.

2. **Colonne DROITE** (sous « (Nom, prénoms, cachet et signature du membre en charge du dossier) ») : imprimer
   le **nom et prénom du Membre de la Commission** en charge du dossier (le membre/examinateur — le même que
   celui nommé sous « ÉTAIENT PRÉSENTS », ici « Chef ANT Rabe »). La colonne droite **ne doit plus** porter le
   « Visé par … Président ».

## Points d'attention

- Le viseur (colonne gauche) et le membre en charge (colonne droite) sont des **personnes distinctes** : le
  premier est le supérieur hiérarchique qui vise (Président / CC selon l'étage), le second est l'examinateur.
- ⚠️ Rappel modèles : le nom du Membre figure déjà sous « ÉTAIENT PRÉSENTS » — ici on demande **en plus** son
  nom sous la **ligne de signature de droite** (colonne « membre en charge du dossier »).
- Règle à appliquer de façon **cohérente sur les variantes de modèle** concernées (centrale / régionale, avec
  ou sans intérim, sous-type AGPM…), pas seulement sur ce PV.
- Cas **intérim / mention régionale** du viseur : garder la mention telle qu'elle est aujourd'hui produite,
  seulement la **colonne** change.

## Contre-recette attendue (backend)

1. PV normal : bloc gauche = « Visé par : &lt;viseur&gt;, &lt;rôle&gt; » sous le placeholder du supérieur ;
   bloc droit = « &lt;nom prénom du membre&gt; » sous le placeholder du membre. Plus de « Visé par » à droite.
2. Vérifier sur un PV à deux niveaux (CC puis Président) et sur une variante AGPM.
