# Demande backend — 2026-10-28 — La décision de nomination de la CAO, jointe obligatoirement

## Contexte

Recette du 28/10 (voie rapide de Sambava, ligne 303414, fiche DAO n° 1, remise électronique) : la fiche a été validée et le
dossier 00002/DAOO-CC/CNM/2026 soumis alors que la décision de nomination de la commission d'appel d'offres n'avait **pas de
PDF joint**. L'écran « Écrans figés » de la Commission le relève en constat (« La décision de nomination n'est pas jointe. »),
mais rien ne l'a empêché.

C'est la règle actuelle (V67, « question 4 ») : `CaoRegles.constituee` exige la référence et la date de la décision, deux
membres de qualité `MEMBRE` au moins et un président ; le PDF n'est qu'une anomalie `DECISION_SANS_FICHIER`, « non bloquant ».
L'écran de la CAO dit de même : « Non jointe : facultative, mais attendue. »

**Arbitrage du pilote (28/10)** : la décision de nomination doit être **obligatoire** — référence, date **et** PDF signé. Une
commission sans sa décision jointe n'est pas constituée.

## B1 — Une CAO n'est constituée qu'avec sa décision jointe

- `CaoRegles.constituee` exige en plus le fichier de la décision (`decisionFichier` ou `decisionTaille` non nul).
- L'état de la CAO (`CaoDto.etat`) reste `INCOMPLETE` tant que le PDF manque ; l'anomalie `DECISION_SANS_FICHIER` passe parmi
  ce qui manque (avec `CAO_INCOMPLETE`), plus parmi ce qui « compte pour la cérémonie » seulement.
- Conséquence attendue : la règle 13 `SE_CAO` du bilan de la fiche devient **bloquante** sans le PDF → la validation de la fiche
  en remise électronique est refusée (409 du bilan, comme aujourd'hui pour une CAO incomplète), avec un message qui nomme la
  cause : « La décision de nomination de la commission n'est pas jointe (PDF signé). »

> ⚠️ **Backend, 2026-10-28 — livré, deux précisions.**
> - Le refus de validation est le 409 du bilan, `CONTROLES_BLOQUANTS`, comme aujourd'hui. La phrase demandée n'est pas tout le
>   message de `SE_CAO` : elle est suivie de « Sans commission d'appel d'offres constituée, la fiche ne peut pas être validée en
>   remise électronique. » (voir B2).
> - Le texte de l'anomalie `DECISION_SANS_FICHIER` dans `CaoDto.anomalies` change : il devient la phrase ci-dessus, au lieu de
>   « La décision de nomination n'est pas jointe. ». Le code de l'anomalie ne change pas.

## B2 — Le message du contrôle

Le contrôle `SE_CAO` dit **ce qui manque**, pas seulement « commission non constituée » : décision sans référence ou sans date,
décision sans PDF, moins de deux membres, pas de président / plusieurs présidents. Le front l'affiche tel quel dans le bilan.

> ⚠️ **Backend, 2026-10-28 — livré, sous cette forme.** Le message contient une phrase par manque, dans cet ordre :
> - « La commission d'appel d'offres n'est pas encore désignée. » (cette phrase est alors seule) ;
> - « La décision de nomination n'a pas de référence. » ;
> - « … n'a pas de date. » ;
> - « La décision de nomination de la commission n'est pas jointe (PDF signé). » ;
> - « Au moins deux membres sont attendus. » ;
> - « Aucun président n'est désigné parmi les membres. » ou « Un seul président est attendu. ».
>
> Le message se termine toujours par « Sans commission d'appel d'offres constituée, la fiche ne peut pas être validée en remise
> électronique. ».
>
> Ces phrases sont aussi celles de `CaoDto.anomalies`. Les deux phrases sur la référence et la date y sont nouvelles, sous le code
> `CAO_INCOMPLETE`. En pratique, elles n'apparaissent pas : `PUT …/cao` exige déjà la référence et la date (400).

## B3 — Ce qui est déjà validé

Pas de rétroactivité : une version de fiche déjà validée, un dossier déjà soumis (00002/DAOO-CC/CNM/2026) ne sont pas remis en
cause. La règle joue à la **prochaine validation** (nouvelle fiche ou révision). Le constat des écrans figés reste tel quel.

> ⚠️ **Backend, 2026-10-28 — confirmé, avec un effet visible.** Rien de ce qui est fait n'est défait : la version validée, le
> dossier soumis et le constat restent tels quels. Mais le bilan servi par `GET /api/fiches-marche/{idDmc}` est recalculé à chaque
> lecture. Une fiche **déjà validée** dont la CAO n'a pas de PDF y montre donc `SE_CAO` parmi les bloquants, jusqu'à ce que le
> PDF soit joint. C'est le cas de la fiche n° 1 de la ligne 303414. Cela n'a d'effet qu'à la prochaine révision. Le front peut
> choisir de ne pas afficher le bilan d'une version validée en rouge.

## B4 — Paramètres internes et cérémonie

À confirmer : les gestes qui exigent aujourd'hui une CAO « constituée » (paramètres internes du responsable de la procédure,
ouverture de la cérémonie) suivent la même règle sans rien de plus — ils lisent `constituee` / `etat`. Le dire si l'un d'eux
doit au contraire rester possible sans le PDF (par exemple saisir les paramètres internes pendant que la décision se signe).

> ⚠️ **Backend, 2026-10-28 — écart : ces gestes ne lisent pas `constituee`.** Dans le code, seule la **validation de la fiche**
> (règle 13 du bilan) lit `constituee`. Ni la saisie des paramètres internes ni la cérémonie des clés (ouverture, publication des
> clés, clôture) ne l'exigent, ni avant ni après cette livraison. Elles lisent les membres de la CAO tels qu'ils sont, et la
> clôture de la cérémonie attend des comptes activés.
>
> Ces gestes restent donc possibles pendant que la décision se signe, ce qui est le cas cité en exemple. La validation reste la
> seule porte, et elle précède de toute façon la publication. Aucune garde n'a été ajoutée ; le dire si le pilote en veut une.

## Hypothèses à confirmer

- **H1** : la règle vaut pour la remise électronique seulement (la CAO n'est saisie dans l'application que dans ce mode).
- **H2** : aucun changement de contrat : mêmes routes (`PUT …/cao`, `POST …/cao/decision`), même `CaoDto` ; seuls `etat`,
  `anomalies` et le bilan changent.

> ⚠️ **Backend, 2026-10-28 — H1 et H2 confirmées.**
> - **H1** : la règle 13 n'est évaluée qu'en remise électronique ; en papier, `FicheMarcheDto.cao` reste `null`.
> - **H2** : routes, `CaoCorps` et `CaoDto` sont inchangés. `PUT …/cao` répond toujours 200 sans PDF, avec l'état `INCOMPLETE`.
>   Seuls l'état, le texte et l'ordre des anomalies, et le message de `SE_CAO` changent (voir B1 et B2). Pas de migration.
>   Contrat : `PRS20/docs/api-endpoints.md`, § *La commission d'appel d'offres… — V67*.

## Côté front, une fois livré

- Écran de la CAO : « Décision signée (PDF) » marquée **obligatoire** ; « Non jointe : facultative, mais attendue. » devient
  « Non jointe : la commission n'est pas constituée sans elle. »
- Bilan de la fiche : le message de `SE_CAO` affiché tel quel.
