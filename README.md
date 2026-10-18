# Chrono — Application Tauri

Chronomètre · Minuteur · Horloge — migré de Electron vers **Tauri 2**

## Avantages de Tauri vs Electron
| | Electron | Tauri |
|---|---|---|
| Taille bundle | ~80 Mo | ~5 Mo |
| RAM au démarrage | ~120 Mo | ~30 Mo |
| Moteur | Chromium embarqué | WebView2 natif Windows |
| Backend | Node.js | Rust |

## Prérequis développement

### Windows
```bash
# 1. Rust
https://rustup.rs

# 2. WebView2 (déjà installé sur Windows 10/11)

# 3. Node.js 20+
https://nodejs.org

# 4. Visual Studio Build Tools (C++)
https://visualstudio.microsoft.com/visual-cpp-build-tools/
```

## Lancer en développement
```bash
npm install
npm run dev
```

## Builder
```bash
npm run build
# → src-tauri/target/release/bundle/nsis/Chrono_1.5.0_x64-setup.exe
```

## Publier une MAJ
```bash
git tag v1.5.0
git push origin v1.5.0
# GitHub Actions build et publie automatiquement
```

## Structure
```
chrono-tauri/
├── src/                    # Frontend HTML/CSS/JS (inchangé vs Electron)
│   ├── index.html          # Application principale
│   ├── update.html         # Fenêtre de mise à jour
│   └── assets/             # Icônes, images
├── src-tauri/              # Backend Rust
│   ├── src/
│   │   ├── main.rs         # Point d'entrée
│   │   └── lib.rs          # Commandes Tauri (DB, MAJ, écrans…)
│   ├── Cargo.toml
│   └── tauri.conf.json
└── .github/workflows/
    └── build.yml           # CI/CD automatique
```

## Différences avec la version Electron

Le frontend est **identique** — seul le pont IPC change :
- Electron : `window.electronAPI.xxx()`
- Tauri : `window.__TAURI__.core.invoke('xxx', args)`

Un shim de compatibilité en haut de `index.html` maintient la même interface.

## Base de données SQLite
Stockée dans `%AppData%\com.chrono.app\chrono.db`
Tables : `timer_presets`, `settings`
