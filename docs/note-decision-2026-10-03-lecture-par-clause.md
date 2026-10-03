# Note de décision — 2026-10-03 — Faut-il lire les DAO « par clause » ?

**Pour** : le pilote. **Décision attendue** : retenir A, B ou C (§4). En attente depuis le 29/09.

## 1. La question

L'import d'un DAO lit aujourd'hui le document **en suivant le modèle**, paragraphe par paragraphe. C'est fiable quand
le DAO reprend fidèlement le document type, et cela ne produit jamais de fausse valeur en confiance haute. C'est
impuissant dès qu'il s'en écarte :
- le DPAO du **MTP** (version ancienne du document type) n'est reconnu qu'à **5 %** ;
- le **MEN** a réécrit sa clause 6.3, et ses listes (matériel, personnel, pièces) ne sont pas retrouvées.

**Lire par clause**, c'est chercher chaque information par les mots de sa clause (« validité des offres », « garantie
de soumission », « ouverture des plis »), où qu'elle se trouve, puis sa valeur par sa forme (un nombre de jours, un
montant).

## 2. Ce que l'essai a mesuré

Prototype hors dépôt, sur les **trois DAO réels**. Il trouve d'abord la section des données particulières (la phrase
d'introduction du document type), puis cinq informations simples, jugées contre les fiches des faits :

| information | MEN | MTP | 2463 |
|---|---|---|---|
| validité des offres | actuel ✓ · clause ✓ | actuel — · clause — | actuel ✓ · clause — |
| garantie de soumission | actuel — · clause — | actuel — · clause ✓ | actuel — · clause ✓ |
| délai d'exécution / de livraison | actuel — · clause ✓ | actuel — · clause ✓ | actuel — · clause ✓ |
| liquidité exigée | actuel — · clause ✓ | actuel — · clause ✓ | sans objet |
| lieu d'ouverture des plis | actuel ✓ · clause ✓ | actuel ✓ · clause ✓ | actuel ✓ · clause ✓ |
| **total** | actuel 2/5 · clause 4/5 | actuel 1/5 · clause 4/5 | actuel 2/4 · clause 4/4 |

- **Valeurs simples** : la lecture par clause en trouve **12 sur 14**, contre 5 pour l'import actuel, et **aucune
  fausse**. Les deux se complètent : la validité des offres du 2463 est trouvée par l'import actuel, pas par l'essai.
- **Listes** (matériel, personnel, pièces) : **mauvais résultat** (1 juste sur 6, trois comptes faux). Repérer le
  passage marche, le découper sans le comprendre non.
- **Condition décisive** : chercher **dans la section des données particulières**, pas dans tout le DAO. Sinon les
  Instructions aux candidats, qui parlent des mêmes choses en général, prennent la place (premier essai : 4/14).

## 3. Ce que cela coûterait

- **Front** : un catalogue de règles, une par information (ses mots-clés et la forme de sa valeur), mesurées sur les DAO
  réels et sur le banc d'essai, comme les règles 1 à 9. À compter une à deux règles par information utile.
- **Backend** : le même catalogue porté dans la lecture du serveur, avec la vérification que front et serveur lisent pareil.
- **Risque** : une valeur trouvée par ses mots-clés est moins sûre qu'une valeur lue dans le modèle. Elle serait donc
  toujours proposée en **confiance moyenne** au plus, jamais haute : la PRMP la vérifie, comme aujourd'hui.

## 4. Les options

- **A — Lecture hybride (recommandée).** La lecture actuelle reste, et une passe « par clause » s'y ajoute pour un
  **catalogue court** d'informations qui comptent (une quinzaine : validité, garantie, délais, seuils, lieu et date
  d'ouverture). Elle ne remplit que ce que la lecture actuelle n'a pas trouvé, toujours en confiance moyenne. Pour les
  **listes**, l'import ne découpe rien : il repère le passage et le **propose dans la fenêtre « Coller une liste »**
  déjà en place. La PRMP voit l'aperçu, corrige, ajoute. Deux temps : d'abord 5 à 8 informations, mesurées ; puis
  extension si la mesure tient.
- **B — Tout par clause.** On abandonne la lecture par le modèle. **Déconseillé** : on perdrait sa sûreté, qui est la
  seule source de confiance haute, et tout le travail de mesure déjà fait.
- **C — Statu quo.** L'import reste utile pour les DAO fidèles au document type, et la saisie (avec « Coller une liste »)
  couvre le reste.

**Recommandation : A**, premier temps limité à 5 à 8 informations simples et à la proposition des passages de listes.
L'essai montre un gain net (5 → 12 valeurs justes sur 14) sans fausse valeur, et le risque est contenu : confiance
moyenne, sans toucher à la lecture actuelle.
