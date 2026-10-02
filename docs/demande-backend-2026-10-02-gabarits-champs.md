# Demande backend — Montrer sous chaque champ la phrase du document qui l'imprime (gabarits)

**Date** : 2026-10-02 · **Émetteur** : front · **Origine** : question Q1 de
`demande-backend-2026-10-02-recette-dao-men.md` (§B2.2), jugée faisable par le backend le 02/10. Accord du pilote le
02/10 (« oui »).

**Le problème.** Un champ texte s'insère souvent **au milieu d'une phrase** du modèle. Sans la voir, la PRMP écrit une
phrase complète, et le document produit se double. Constaté sur la fiche 40 (v1) :
- `B09-MA-03` : « au delà de Au-delà de 20 % de la masse initiale des travaux de la masse initiale… » ;
- `B03-NT-01` : « Est désigné comme Comptable Assignataire de paiement le Est désigné comme comptable… ».

Les libellés précisés le 02/10 aident, mais rien ne vaut la phrase elle-même, avec la saisie en place.

Un seul besoin, B1.

## B1 — Servir, avec chaque champ du référentiel, les phrases des modèles qui le citent

### Contrat

`GET /api/champs-fiche-marche?typeMarche=&categorie=` : chaque `ChampFiche` reçoit un tableau **facultatif** `gabarits`.

```json
{
  "code": "B09-MA-03",
  "gabarits": [
    {
      "document": "CCAP",
      "avant": "La diminution dans la masse des travaux au delà de ",
      "apres": " de la masse initiale des travaux ouvre droit à indemnisation pour l'Entrepreneur.",
      "suffixe": null
    }
  ]
}
```

| clé | contenu |
|---|---|
| `document` | la pièce, en code court : `DPAO`, `DPAC`, `DPIC`, `AE`, `CCAP`, `CPS`, `AVIS`, `LETTRE`. Le sigle du modèle sans sa catégorie (`CCAP-T` → `CCAP`) |
| `avant` / `apres` | le texte du **paragraphe** avant et après le jeton du champ, tel que dans le modèle recopié. Les autres jetons sont remplacés par `___`, les balises `{{SI:…}}` / `{{FINSI:…}}` retirées. Pas de troncature : le front coupe lui-même |
| `suffixe` | le suffixe du jeton (`lettres`, `chiffres`, `parLot`, `heure`…), ou `null` pour le jeton nu |

**Règles** :
1. **Périmètre** : les modèles de la **catégorie** demandée (travaux : DPAO-T, AE-T, CCAP-T, AVIS-T ; fournitures, PI,
   contrat-cadre de même), pour le `typeMarche` demandé quand le modèle en dépend.
2. **Un paragraphe fait du seul jeton** (`avant` et `apres` vides après nettoyage) **n'est pas servi** : il n'apprend rien.
   C'est le cas de `{{B09-AC-01}}`, `{{B10-PC-01}}`, etc.
3. **Doublons** : deux occurrences de mêmes `document`, `avant`, `apres` et `suffixe` n'en font qu'une. L'AE-T cite deux fois
   `{{DERIVE.date-dao}}`, par exemple ; le Membre d'un groupement a le même paragraphe.
4. **Ordre** : celui des documents (DPAO, DPAC/DPIC, CCAP/CPS, AE, AVIS, LETTRE), puis celui du modèle.
5. Les paragraphes **sous condition** sont servis comme les autres, même si la condition est fausse pour la fiche en
   cours : le gabarit décrit le modèle, pas la fiche.
6. Un champ cité nulle part n'a pas de `gabarits` (absent ou `[]`, au choix).

**Coût côté serveur** : relevé une fois, au chargement des modèles, comme vous l'avez proposé. Aucune requête en plus
pour le front : la clé voyage avec le référentiel déjà chargé.

### Ce que le front en fait (développé contre ce contrat, avant livraison)

Sous un champ **texte** (`TEXTE`, `TEXTE_LONG`) en saisie : « Dans le CCAP : « …au delà de **‹ votre saisie ›** de la
masse initiale des travaux… » ».
- La saisie en cours apparaît **à sa place**, en gras, et se met à jour à la frappe. Elle n'est remplacée par
  « ‹ votre saisie › » que pour un jeton à suffixe (`.lettres`, `.parLot`…), dont le serveur met la valeur en forme, ou
  si le champ est vide.
- `avant` et `apres` sont coupés à environ 90 caractères, sur une limite de mot, avec « … ».
- Deux extraits au plus, puis « et n autre(s) ».

Tant que la clé est absente, rien ne s'affiche : pas de repli, pas d'erreur.

**Recette attendue** :
- `B09-MA-03` (travaux) : le gabarit ci-dessus, et lui seul ;
- `B03-NT-01` : le paragraphe de l'AE-T, une seule fois malgré la variante « groupement » s'il est identique ;
- `B10-PC-01` : pas de gabarit (paragraphe fait du seul jeton) ;
- `B02-OB-03` (travaux) : entre autres, l'AE-T, avec `apres` = « du ___ et, en particulier… » (le jeton `DERIVE.date-dao` devient `___`).
