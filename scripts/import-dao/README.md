# Import du DAO — la lecture « par modèle inversé » (lot 0 : prototype et mesure)

Plan : `docs/plan-2026-09-28-import-dao.md` (décisions du pilote du 28/09 : suivre les recommandations ; ancrages tirés
des modèles du lot D). Un DAO rédigé sur le document type se lit à l'envers : le texte fixe du modèle
(`../modeles-dao/modeles/*.json`) se retrouve dans le document, ce qui occupe la place d'un jeton est la valeur, et la
rédaction retenue d'une section conditionnelle dit la réponse. **Lecture seule : on propose, on n'écrit rien.**

```
node lire.mjs <DAO.docx> DPAC-CC [--json=sortie.json]
node mesurer.mjs --dmc=27 --login=PRMP001 --dpac=<DPAC.docx> --ae=<AE.docx> [--un-fichier] [--bruit=<graine>]
```

`mesurer.mjs` confronte la lecture aux valeurs de la fiche qui a produit les documents (aller-retour) ; `--un-fichier`
met DPAC et AE bout à bout (un DAO arrive souvent en un seul fichier) ; `--bruit` altère le document comme le ferait
une autre autorité (typographie, un paragraphe sur dix fusionné avec le suivant, un sur vingt suivi d'un paragraphe
ajouté). Code 1 si une valeur fausse est proposée en confiance haute (critère Q10 du plan).

## L'algorithme — spécification de la route serveur

1. **Normaliser** document et modèle de la même façon (`norm` : NFKC, apostrophes, tirets, guillemets, espaces
   insécables, blancs) ; un paragraphe ou une cellule de tableau est une unité.
2. **Paragraphes à texte fixe**, dans l'ordre, avec un curseur (fenêtre de 60 paragraphes après le dernier reconnu ;
   tout le document tant que rien n'est reconnu) : motif = texte fixe littéral (blancs souples, espace facultative
   autour de la ponctuation), chaque jeton capturé. Un paragraphe qui finit par du texte fixe se reconnaît aussi **en
   tête** d'un paragraphe du document (fusion) : le reste est relu comme un paragraphe à part.
3. **Coupe** : le dernier jeton d'un paragraphe qui finit par lui n'a pas de borne à droite ; si sa capture contient le
   **début d'un paragraphe suivant** du modèle (texte fixe avant son premier jeton, ≥ 6 caractères, dans les 40
   suivants), c'est une fusion — la valeur est coupée là, le reste relu.
4. **Paragraphes faits d'un seul jeton** : ce qui sépare les voisins reconnus. Plusieurs tels paragraphes dans le même
   intervalle → **ambigu** (signalé, jamais choisi) ; intervalle qui commence comme un paragraphe du modèle → écarté.
5. **Réponses déduites** : chaque section dont un paragraphe **à texte fixe** a été reconnu donne les termes `cle =
   valeur` de sa condition (conjonction seulement ; pas de `ou`, pas de `!=`). Un jeton seul n'atteste jamais sa section.
6. **Valeurs** remises dans la forme de saisie du champ (dates `JJ/MM/AAAA` → ISO, montants et pourcentages → nombre,
   pointillés → vide) ; un reflet du cadrage (`B08-AV-02`) devient une réponse de cadrage (`tauxAvance`) ; `.lettres`,
   `{{LOT}}`, `{{DERIVE…}}` ne sont pas des valeurs. Un champ lu deux fois différemment est un **conflit**, pas un choix.

**Confiance** — *haute* : bornée par le texte fixe, dans un paragraphe reconnu tel quel ; une valeur ouverte à droite
ne reste haute que si son type la contraint (nombre, montant, pourcentage, date). *Moyenne* : ouverte à droite (texte),
paragraphe redécoupé, jeton seul d'une section attestée sur un seul paragraphe. *Basse* : jeton seul d'une section non
attestée, intervalle de plusieurs paragraphes, valeur coupée.

## Ce que la mesure a établi (28/09, fiche 27, contrat-cadre)

| passe | haute (justes/fausses) | moyenne | basse | réponses déduites | rappel |
|---|---|---|---|---|---|
| sans bruit | 38 / 0 | 23 / 0 | 1 / 0 | 21 / 21 | 98 % |
| 8 graines de bruit (cumul) | 277 / 0 | 190 / 0 | 11 / 7 | toutes justes | 87 à 98 % |

Limites : `.docx` seulement ; l'aller-retour et le bruit simulé ne remplacent pas un DAO réel écrit par une autre
autorité (aucun disponible au 28/09) ; un seul modèle mesuré (contrat-cadre).
