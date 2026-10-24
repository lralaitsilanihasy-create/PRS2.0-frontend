# Demande backend — 2026-10-24 — L'heure du serveur, lisible par tous les profils

## Contexte

Depuis l'horloge de recette (`demande-backend-2026-10-24-horloge-recette.md`, ADR-0016), le serveur peut vivre à une autre date que
le poste de l'utilisateur. Le serveur de recette est aujourd'hui au **07/12/2026**, pour la chaîne de l'entretien des véhicules ;
les postes sont au 24/10.

Le front, lui, prend la date du **poste** :
- **8 formulaires** la proposent par défaut (`new Date()`) : réception (Secrétaire), dispatch, examen (Membre), frais de dossier
  (candidat), publication de l'AGPM, modèle de document, etc. ;
- **24 fichiers** calculent avec elle : délais restants (« Reste 8 h »), échéances, chronométrage, pastilles « en retard ».

**Constat sur le dossier de marché 100387** (soumis le 07/12 à 10:00, heure du serveur) : la fenêtre de réception du Secrétaire
propose la date du **24/10/2026**. Enregistrée telle quelle, la réception serait antérieure de six semaines au dépôt.

La seule lecture de l'heure du serveur, `GET /api/admin/horloge-recette`, est réservée à l'Administrateur (403 ailleurs) et
n'existe qu'en recette. L'en-tête HTTP `Date` est posé par Tomcat à l'heure réelle : il ne suit pas l'horloge.

## H1 — L'heure du serveur, pour toute session

- **Une lecture légère**, ouverte à tout utilisateur connecté, candidats compris, en recette comme en production. Par exemple
  `GET /api/horloge` → `{ maintenant: "2026-12-07T10:42:00", fuseau: "Indian/Antananarivo", decalee: true }`. `decalee` vaut
  toujours `false` hors recette.
- **Ou bien** le même `maintenant` dans la réponse de `GET /api/auth/me`, que le front lit déjà à chaque ouverture de session. Le
  backend choisit ; le front préfère une route à part, qu'il peut relire sans recharger le profil.
> ⚠️ **2026-10-24, livré (backend) — la route existait déjà**
> - **`GET /api/horloge` est servi depuis le 04/10** (soumission en ligne, lot 3, §B1). Il est public, sans connexion, donc ouvert aux
>   candidats (Q1), et suit l'horloge de recette. Seul ajout : `decalee`, qui vaut toujours `false` hors recette.
>   Réponse : `{ maintenant: "2026-12-07T10:42:00", fuseau: "Indian/Antananarivo", decalee: true }`.
> - **`maintenant` est une chaîne `AAAA-MM-JJTHH:MM:SS`**, sans fuseau, comme toutes les dates servies par l'API.
> - **⚠️ À savoir sur `fuseau`** : c'est le fuseau déclaré de la remise électronique (paramètre `FICHE_SE_FUSEAU`), pas celui de
>   la JVM. Sur le poste de recette, la JVM est en `Europe/Paris`. Toutes les heures que le serveur écrit et compare, `maintenant`
>   compris, sont donc à l'heure de Paris : 1 heure de moins qu'à Antananarivo aujourd'hui, 2 heures après le passage à l'heure
>   d'hiver du 25/10. Le front doit comparer `maintenant` aux dates de l'API telles quelles, sans conversion de fuseau. La
>   correction (régler la JVM sur `Indian/Antananarivo`) est signalée au pilote ; elle n'est pas faite.
>
> ⚠️ **2026-10-24, corrigé (backend), sur décision du pilote** — la JVM est désormais en `Indian/Antananarivo`, imposé au
> démarrage. On peut le surcharger par `APP_FUSEAU`. Le serveur et `fuseau` disent maintenant la même heure.
> - **Effet sur la recette** : l'horloge de recette est en décembre, et Paris y est à l'heure d'hiver (UTC+1). À décalage égal,
>   l'heure du serveur avance donc de **2 heures** (07/12 11:24 devient 13:24). Il suffit de reposer l'heure voulue avec
>   `PUT /api/admin/horloge-recette { maintenant }`.
> - **Les heures enregistrées avant le redémarrage** restent à l'heure de Paris, donc plus tôt qu'en heure de Madagascar : de
>   2 heures pour celles de la chaîne jouée en décembre, d'1 heure pour celles d'octobre. L'ordre des événements est conservé.
>   Elles ne sont pas recalées.

- Le front calcule un **écart** (serveur − poste) au chargement, le relit périodiquement (toutes les 10 minutes, et après une
  réponse `HORLOGE_RECETTE`). Il l'applique à toutes ses dates : valeurs par défaut des formulaires, délais restants, échéances.
  En production, l'écart reste de quelques secondes : il corrige aussi un poste mal réglé.

## H2 — Une date saisie antérieure au dépôt

Le front ne sait pas si le serveur refuse une **réception datée avant la soumission** du dossier. Exemple, sur 100387 :
`dateReception` au 24/10, `dateSoumission` au 07/12. Même question pour le dispatch avant la réception, et pour l'examen avant le
dispatch.
- **Si aucune garde n'existe**, le front propose d'en ajouter une : 400 `DATE_ANTERIEURE` avec la date de l'étape précédente dans
  `details`. Le front affiche alors le message près du champ.
- **Si elle existe**, le dire, et le front la reflète.

> ⚠️ **2026-10-24, livré (backend)** — il n'y avait **aucune garde**. Il y en a deux désormais, sur la réception, le dispatch et
> l'examen (`POST` et `PUT`) :
> - **400 `DATE_ANTERIEURE`**, `details { etape, date, etapePrecedente, datePrecedente }` :
>   - réception avant la soumission du dossier ;
>   - dispatch avant la réception ;
>   - examen (au jour) avant le dispatch.
> - **Ajout, 400 `DATE_FUTURE`**, `details { etape, date, maintenant }` : une date au-delà de l'heure du serveur, à 5 minutes près
>   (au jour pour l'examen). Une réception datée de demain est refusée comme une réception datée d'avant le dépôt.
> - **Comparaison à la minute** : une réception à 10:00 suit une soumission à 10:00:35. Une date seule (`AAAA-MM-JJ`) se compare au
>   jour.
> - **Sur un `PUT`**, la garde ne joue que si la date change : une correction d'observation sur une réception ancienne passe.
> - Étapes : `SOUMISSION`, `RECEPTION`, `DISPATCH`, `EXAMEN`. `datePrecedente` est servie à la minute, au format `AAAA-MM-JJTHH:MM`.

## Côté front, à la livraison

- Un service `HeureServeur` (signal `maintenant()`, écart) remplace `new Date()` dans les 8 formulaires et les calculs de délai
  des 24 fichiers. Un test interdit d'en ajouter, comme côté serveur.
- La date proposée par défaut est celle du serveur. Le champ reste modifiable, dans la limite de la garde H2.
- En recette, un bandeau discret « Heure de recette : 07/12/2026 10:42 » rappelle que le serveur est décalé.

## Questions

- **Q1 — Les candidats** : la route H1 leur est-elle ouverte ? Le dépôt d'une offre et la date limite les concernent au premier
  chef, et « date limite dans 3 jours » doit se calculer à l'heure du serveur.
- **Q2 — Le bandeau de recette** : le backend préfère-t-il servir lui-même le libellé (par exemple `libelle: "Heure de recette"`),
  ou laisser le front le déduire de `decalee` ?

> ⚠️ **2026-10-24, réponses (backend)**
> - **Q1 — Oui**, et même sans connexion : `/api/horloge` est public. L'heure n'est pas un secret, et les pages publiques des
>   procédures en ligne affichent elles aussi des dates limites.
> - **Q2 — Le front déduit son bandeau de `decalee`.** Le serveur ne sert pas de libellé.
