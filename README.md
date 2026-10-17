# Chrono — Application de bureau

Chronomètre · Minuteur · Horloge — construite avec Electron.

## Fonctionnalités

### Chronomètre
- Préréglages nommés (localStorage)
- Centièmes affichés à la pause
- Plein écran in-app

### Minuteur
- **Préréglages stockés en SQLite** (persistents entre sessions)
- Mélodie de fin synthétisée (9 mélodies)
- **Musique locale** : choisissez un fichier audio (mp3, wav, ogg…) depuis votre ordinateur
- Cercle animé, plein écran

### Horloge
- Analogique + numérique
- 31 fuseaux horaires
- **Zoom réglable** (80 % → 180 %)

## Nouvelles fonctionnalités v2

### Barre de menu native
Menu Fichier / Affichage / Aide entièrement natif Windows.  
**F11** = plein écran (géré côté Electron, fonctionne même avec la fenêtre sans cadre).

### Couleurs personnalisées
Modifiez les 6 couleurs de l'interface (primaire, secondaire, accent, succès, danger, texte) depuis Paramètres → sauvegardées en base de données.

### Police d'affichage
6 polices préchargées : Poppins, Orbitron, Share Tech Mono, Rajdhani, Exo 2, Inter.

### Double écran
Détecte automatiquement si deux écrans sont branchés. En cas de mode "Dupliquer", déplace l'app en plein écran sur l'écran secondaire. Bouton "Revenir" ramène sur l'écran principal.

### Mises à jour automatiques (depuis GitHub)
Via `electron-updater`. Configurez le champ `publish` dans `package.json` :

```json
"publish": [{
  "provider": "github",
  "owner": "votre-utilisateur",
  "repo": "chrono-app"
}]
```

Lors d'un build, publiez via `electron-builder --publish always`.  
Dans l'app : Paramètres → Mises à jour → Vérifier.

## Installation & lancement

```bash
npm install
npm start
```

## Build Windows

```bash
npm run build
```

## Base de données

SQLite via `better-sqlite3`, stocké dans `%APPDATA%\ChronoApp\chrono.db`.  
Tables : `timer_presets`, `settings`.

