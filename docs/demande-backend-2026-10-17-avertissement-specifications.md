# Demande backend — 2026-10-17 — L'avertissement B14 ne doit plus dire « pas de spécifications » quand le besoin les porte

## Contexte

Sur la fiche des consomptibles informatiques (ligne 303339), l'étape Contrôles affiche cet avertissement :

> **B14** Aucune spécification technique n'est jointe : le DAO complet n'aura pas de partie « Spécifications techniques ».
> Joignez le Word du devis descriptif, des prescriptions et des plans.

Le pilote demande alors : *« le DAO généré n'a-t-il pas de spécifications techniques ? »*

Il en a. La fiche porte 12 articles avec leurs caractéristiques (B12). Depuis la charte du 16/10, `DaoCompletService.parties`
ouvre la section « Spécifications techniques » dès que `t.specifications() != null` : c'est le tableau que
`TableauxBesoin.specifications` génère depuis le besoin. Le Word joint par la PRMP vient ensuite, en complément.

Or l'avertissement (`FicheMarcheService`, ⚠️ 2026-10-06, « DAO complet, §B2 ») ne regarde que la présence du Word
(`specificationsRepository.existsById`). Il date d'avant la charte, et son message est devenu **faux** dès que le besoin porte
des articles.

## B1 — Ne l'émettre que si le DAO n'aura vraiment aucune spécification

Émettre `SPECIFICATIONS_ABSENTES` seulement si **ni** Word de spécifications **ni** article du besoin n'existent. C'est la même
condition que celle qui ouvre la section dans `DaoCompletService.parties`, pour une fiche de fournitures ou de travaux.

## B2 — Facultatif : un rappel plus juste quand le tableau existe mais pas le Word

Si le besoin porte des articles mais qu'aucun Word n'est joint, un avertissement plus léger, ou une simple information, est
possible. Par exemple : « Le DAO portera le tableau des spécifications tiré du besoin. Un devis descriptif, des prescriptions
ou des plans peuvent être joints en Word (facultatif). »

**Q1** : le backend garde-t-il B2, et sous quel code ?
- Si c'est un nouveau code, le front l'affiche comme les autres avertissements, sans rien coder.
- Si c'est une information, il faut dire dans quelle liste du bilan elle arrive (`ok` ou un nouveau champ).

> ⚠️ **2026-10-17, livré côté backend (B1, B2).**
> - **B1, en fournitures et services** : `SPECIFICATIONS_ABSENTES` n'est émis que **sans Word ni article** du besoin, avec un message
>   devenu exact : « Aucune spécification technique : ni article au besoin, ni Word joint. Le DAO complet n'aura pas de partie
>   « Spécifications techniques ». Saisissez le besoin, ou joignez le Word… ».
> - **Écart, en travaux** : le besoin ne donne que le bordereau et le détail quantitatif (`DaoCompletService.tableaux`), aucun tableau
>   de spécifications.
>   - **Ce qui reste** : l'avertissement, tant que le Word manque, au message exact : « Aucun devis descriptif n'est joint : la partie
>     « Spécifications techniques » du DAO complet ne portera que les formulaires du candidat. Joignez le Word… ».
>   - **Pourquoi** : depuis la tranche B de la charte, cette section existe toujours en travaux, avec les formulaires du candidat.
> - **Réponse à Q1 : B2 est gardé, comme information.**
>   - **Où** : dans la liste **`ok`** du bilan, qui existe déjà. Aucun champ nouveau.
>   - **Code** : `SPECIFICATIONS_DU_BESOIN`, bloc B14.
>   - **Message** : « Le DAO complet portera le tableau des spécifications tiré du besoin. Un devis descriptif, des prescriptions ou des
>     plans peuvent y être joints en Word (facultatif). ».
>   - **Quand** : en fournitures et services, avec des articles et sans Word.
> - **Test** : `DaoCompletIntegrationTest.specifications`.

## Recette du front

Sur la fiche 303339 : plus de B14 ; et B2 si le backend le retient.
