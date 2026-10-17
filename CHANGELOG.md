# 📋 Chrono — Notes de mise à jour

---

## 🚀 v1.4.0 — 27 mai 2026

### ✨ Nouveau système de mise à jour automatique
- Détection des nouvelles versions directement via l'API GitHub — plus besoin de `latest.yml`
- Nouvelle fenêtre de mise à jour dédiée avec barre de progression en temps réel
- Téléchargement du fichier `.exe` directement depuis GitHub Releases
- Confirmation avant installation — l'app se ferme et relance automatiquement

### 🕐 Horloge analogique refaite
- Nouveau cadran SVG propre, inspiré d'un modèle open source
- Aiguilles parfaitement centrées, rotation sans décalage
- Graduations heures et minutes, chiffres 12/3/6/9
- Pivot central à trois couches

### 🖥️ Barre de navigation
- Boutons **Accueil / Chrono / Minuteur / Horloge** visibles en permanence
- Bouton actif mis en évidence en bleu
- Menus déroulants Affichage et Aide conservés

### ⌨️ Minuteur — saisie clavier
- Remplacement des listes déroulantes par des champs numériques
- Saisie directe, molette souris, flèches ▲▼, `Entrée` pour démarrer

### 🔒 Installation sans droits administrateur
- L'installeur s'installe dans `%LocalAppData%` — plus de demande UAC

---

## 🔧 v1.3.0 — 24 mai 2026

### Corrections
- Suppression de la double popup de mise à jour (native + HTML)
- La modale HTML est désormais la seule notification de MAJ

---

## ✨ v1.2.0 — 23 mai 2026

### Nouveautés
- Barre de menu native Windows (vraie barre titre OS)
- Mélodie de fin et chemin audio sauvegardés en SQLite
- Plein écran in-app synchronisé avec le plein écran OS
- Horloge : fuseau horaire masqué en plein écran, date toujours visible

---

## ✨ v1.1.0 — 20 mai 2026

### Nouveautés
- Couleurs personnalisables (6 variables) sauvegardées en DB
- 6 polices d'affichage préchargées
- Musique locale pour la fin du minuteur
- Vérification MAJ au démarrage si réseau disponible
- Support double écran

---

## 🎉 v1.0.0 — 17 mai 2026

### Première version
- ⏱ Chronomètre avec préréglages nommés
- ⏳ Minuteur avec cercle animé et 9 mélodies
- 🕐 Horloge analogique + numérique, 22 fuseaux
- 🎨 Thème clair / sombre
- 💾 Préréglages stockés en SQLite
