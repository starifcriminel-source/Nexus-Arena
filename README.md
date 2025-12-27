# NEXUS ARENA — Mastermind (GitHub Pages)

Jeu Mastermind 4 chiffres, autonome, hébergé sur GitHub Pages.  
Permet de créer des salons **Duo**, **Groupe** ou jouer en **Solo**. Les salons sont partagés via des liens URL.

## Contenu du dépôt
- `index.html` — interface principale
- `styles.css` — styles et thème néon
- `app.js` — logique du jeu, création de salons, gestion des liens et records
- `README.md` — ce fichier
- `LICENSE` — MIT
- `.gitignore`

## Fonctionnement
- **Duo** : le créateur définit un code (4 chiffres) et partage le lien joueur.
- **Groupe** : le site génère un code et fournit les liens.
- **Solo** : jouer seul contre un code généré.
- **Persistance** : les records sont stockés dans `localStorage` du navigateur.
- **Remarque importante** : sans serveur, l'état du salon est transmis via l'URL (paramètres `room`, `code` ou `token`). Il n'y a pas de secret absolu côté client : partager un lien peut exposer le code si le paramètre `code` est présent. Le paramètre `token` est une simple base64 pour une légère obfuscation, mais **n'est pas sécurisé**.

## Déploiement sur GitHub Pages
1. Crée un nouveau dépôt (par ex. `arena-nexus`).
2. Pousse les fichiers (`index.html`, `styles.css`, `app.js`, `README.md`, `LICENSE`, `.gitignore`) sur la branche `main`.
3. Dans les paramètres du dépôt → Pages, choisis la branche `main` et le dossier `/ (root)`.
4. Attends quelques minutes, ton site sera disponible à `https://<ton-utilisateur>.github.io/<repo>/`.

## Améliorations possibles
- Ajouter un backend léger (Firebase / serverless) pour stocker les salons et masquer le code.
- Ajouter authentification pour distinguer créateur/joueurs de façon fiable.
- Ajouter chat intégré, avatars, ou statistiques globales.
- Ajouter animations et sons (WebAudio) pour plus d'immersion.

## Licence
MIT — voir `LICENSE`.
