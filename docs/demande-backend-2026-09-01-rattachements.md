# Demande au backend `PRS20` — 1ᵉʳ septembre 2026 — Rattachements Membre → Vérificateur → Assistant

> Document destiné à la session backend. Émis depuis le front `frontendprs2`. **Nouvelle règle
> d'organisation arbitrée par le pilote le 01/09** — troisième demande du jour, indépendante des
> deux closes (visa unique, intérim). Backend d'abord ; le front suivra.
>
> | | Question | Décision |
> |---|---|---|
> | 1 | Nature du routage | **Ciblage de files** — le rattaché est le destinataire par défaut (files + notifications) ; un autre Vérificateur/Assistant de la localité peut agir, tracé. PAS de garde d'identité (esprit « instruction délégable » du 15/08) |
> | 2 | Circuit court / donnée manquante | **Repli localité** — sans rattachement défini (examinateur P/CC auto-attribué, ou chaîne incomplète), règle actuelle : tout Vérificateur de la localité, tout Assistant |
> | 3 | Administration | **Admin + Président/CC** — l'Admin partout, le Président partout, le CC dans SA localité |
> | 4 | « SIGMP ou eGP » | **Transmission existante** — aucune nouvelle modélisation de plateforme (`DECISION_TRANSMISE_SIGMP` inchangé) |

---

## 1. Règle métier

**Énoncé du pilote** : « Chaque Membre a un contrôleur Vérificateur rattaché à lui, et chaque
Vérificateur a lui-même un Assistant contrôleur rattaché à lui. Pour la vérification des documents
témoins rectifiés par la PRMP au regard des observations envoyées après visa du PV définitif portant
Avis Favorable Avec Réserves, c'est le Vérificateur rattaché au Membre ayant examiné le dossier qui
se charge de la vérification et de la validation sur SIGMP/eGP, et l'Assistant rattaché à ce
Vérificateur se charge de l'archivage après cette validation. »

Aujourd'hui, la boucle FAVR post-signature est ouverte **au profil, scopé localité** (décision Q1a
du 15/08) : tout Vérificateur de la localité statue, tout Assistant archive. La règle nouvelle
**personnalise le routage** par deux rattachements nominatifs — sans le fermer (arbitrage 1).

## 2. Référentiel des rattachements

- Deux relations : **Membre → son Vérificateur** ; **Vérificateur → son Assistant**. Modélisation à
  votre main (colonnes sur le contrôleur ou table dédiée) ; plusieurs Membres peuvent partager le
  même Vérificateur, plusieurs Vérificateurs le même Assistant ; au plus UN rattaché par porteur.
- **Contrainte recommandée : intra-localité** (le rattaché est de la localité du porteur) — dites-le
  si vous voyez un cas contraire.
- **Écriture** : Admin partout ; Président partout ; CC restreint à sa localité (403 sinon). Garde
  de profil sur le rattaché (Vérificateur pour un Membre, Assistant pour un Vérificateur).
- **Chaîne incomplète autorisée** (arbitrage 2) : aucun blocage — le repli localité s'applique.
  Exposer de quoi la signaler (liste des Membres sans Vérificateur, Vérificateurs sans Assistant),
  pour l'écran d'administration.
- Historisation : valeur courante + journal d'audit suffisent (pas de table d'historique dédiée,
  sauf avis contraire de votre part).

## 3. Routage de la boucle FAVR (dossier `EN_VERIFICATION` → … → archivage → `CLOTURE`)

- **Vérificateur CIBLE** d'un dossier en vérification = le rattaché du **Membre ayant examiné**
  (`imCtrlMembre` de l'examen — pas le co-signataire), quand il est défini ; sinon repli localité.
- **Effets du ciblage** (pas de garde) :
  - les files « à vérifier » / « en attente PRMP » distinguent LES SIENS chez le rattaché ; les
    autres Vérificateurs de la localité voient toujours le dossier et peuvent agir (l'acteur réel
    est déjà journalisé) ;
  - les **notifications** de ce circuit (dossier à vérifier, resoumission PRMP, rappels) ciblent le
    rattaché quand il existe, sinon le ciblage actuel (localité).
- **Assistant CIBLE** pour l'archivage = le rattaché du **Vérificateur qui a effectivement validé**
  (recommandation : suivre l'acteur effectif — si un suppléant a validé, c'est SA chaîne qui
  archive) ; repli : le rattaché du Vérificateur cible ; repli final : tout Assistant (actuel).
  Même mécanique de files/notifications ciblées.
- **DTO** (pour éviter tout N+1 au front) : exposer sur le dossier en vérification
  `imVerificateurCible`/`nomVerificateurCible`, et pour la phase d'archivage
  `imAssistantCible`/`nomAssistantCible` (résolus serveur, null en repli).

## 4. Transition

Au déploiement, **aucun rattachement en base** : tout fonctionne comme aujourd'hui (repli localité
intégral, comportement inchangé). La personnalisation s'active rattachement par rattachement —
data-driven, aucune migration de données obligatoire.

## 5. Ce que le front livrera ensuite

1. **Écran « Rattachements »** (Admin ; décliné chez Président/CC scopé) : Membres avec leur
   Vérificateur, Vérificateurs avec leur Assistant, édition, signalement des chaînes incomplètes.
2. **Files Vérificateur et Assistant** : rubrique « Les miens » (cible = moi) distincte du reste de
   la localité — même patron visuel que les rubriques de délégation ; badge « À vérifier par X » en
   consultation (depuis le DTO).
3. Rien d'autre : notifications routées serveur, transmission/archivage inchangés dans leur forme.

Comme toujours : PLAN d'abord pour validation, tests (ciblage avec et sans rattachement, repli,
gardes d'écriture Admin/P/CC-localité, profil du rattaché), docs (`api-endpoints`,
`regles-gestion`), **commit + push complet, fichiers neufs compris**.
