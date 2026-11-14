# Chrono

Application de bureau **Tauri 2** : chronomètre, minuteur et horloge.

## Environnement de développement

### Prérequis

- Node.js 22 ou plus récent
- pnpm 10 (via Corepack)
- Rust stable installé avec rustup
- Les dépendances natives Tauri de votre système
- Sous Windows : WebView2 et Visual Studio Build Tools (C++). WebView2 est déjà présent sur Windows 10/11 dans la plupart des installations.

### Installer et lancer

```bash
corepack enable pnpm
pnpm install
pnpm tauri dev
```

`pnpm tauri dev` démarre le petit serveur statique local puis ouvre Chrono dans la WebView Tauri. Les ressources de `src/` sont servies sans bundler afin de conserver les horloges, polices et fichiers HTML existants.

### Vérifications qualité

```bash
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
```

Le frontend est en JavaScript natif (pas en TypeScript) : `pnpm typecheck` vérifie donc la syntaxe de tous les scripts et pages intégrés, tandis que `pnpm lint` applique ESLint.

Pour vérifier le backend Rust :

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --all -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
```

### Compiler localement

```bash
pnpm tauri build
```

Les installeurs sont générés dans `src-tauri/target/release/bundle/` : NSIS/MSI sous Windows, DMG sous macOS, DEB/RPM/AppImage sous Linux (selon les outils installés sur la machine).

Pour compiler l'application sans générer d'installeur :

```bash
pnpm tauri build --no-bundle
```

## Releases automatiques

La CI vérifie le JavaScript intégré, le formatage, les tests et le backend Rust sur les pull requests et les branches principales. Sur les pushes vers la branche principale, elle compile aussi Tauri sans générer les installeurs, sous Windows, macOS et Linux.

Pour publier une version :

```bash
# Mettre à jour CHANGELOG.md et les versions package.json / tauri.conf.json / Cargo.toml
# Puis créer et pousser le tag correspondant :
git tag v1.5.1
git push origin v1.5.1
```

GitHub Actions compile automatiquement Windows, macOS et Linux, rassemble les installeurs et publie une GitHub Release avec les notes générées automatiquement. Un lancement manuel du workflow `Build & Release` compile et conserve les artefacts sans publier de release.

Aucune annonce Discord n'est envoyée.

## Structure

```text
chrono/
├── .github/workflows/
│   ├── ci.yml                 # Qualité frontend + Rust
│   └── release.yml            # Builds multiplateformes + GitHub Releases
├── scripts/
│   ├── dev-server.mjs         # Serveur statique utilisé par Tauri en dev
│   ├── lint-inline.mjs        # ESLint sur les scripts des pages HTML
│   ├── check-inline-scripts.mjs
│   └── set-version.mjs        # Synchronisation de version au moment d'une release
├── src/                       # Interface HTML/CSS/JS et ressources
└── src-tauri/                 # Application native et commandes Rust
    ├── capabilities/
    ├── icons/
    ├── src/
    ├── Cargo.toml
    └── tauri.conf.json
```

## Données locales

La base SQLite `chrono.db` est stockée dans le répertoire de données applicatif Tauri (`app_data_dir`). Les réglages et les préréglages de minuteur restent donc locaux à l'utilisateur.

## Mise à jour intégrée

L'interface de mise à jour existante télécharge actuellement le programme d'installation Windows `.exe` depuis les GitHub Releases. Les versions macOS et Linux sont publiées automatiquement, mais leur mise à jour intégrée multiplateforme nécessitera ensuite la configuration du plugin updater Tauri et la signature des artefacts.
