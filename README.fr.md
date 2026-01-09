# FixHive

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.zh.md">中文</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.nl.md">Nederlands</a>
</p>

> Partage de Connaissances d'Erreurs Basé sur la Communauté pour OpenCode

FixHive est un plugin OpenCode qui capture automatiquement les erreurs pendant les sessions de développement, interroge une base de connaissances communautaire pour trouver des solutions et partage les erreurs résolues avec d'autres développeurs.

## Fonctionnalités

- **Détection Automatique des Erreurs** : Détecte automatiquement les erreurs des sorties d'outils (bash, edit, etc.)
- **Base de Connaissances Cloud** : Recherche de solutions communautaires par similarité sémantique (pgvector)
- **Cache Local** : Stockage local basé sur SQLite pour l'accès hors ligne
- **Filtrage de Confidentialité** : Supprime automatiquement les données sensibles (clés API, chemins, e-mails)
- **Synchronisation en Temps Réel** : Communication cloud immédiate lors d'erreur/résolution

## Installation

```bash
npm install @the-magic-tower/fixhive-opencode-plugin
```

## Configuration

Définissez les variables d'environnement suivantes :

```bash
# Requis pour les fonctionnalités cloud
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key

# Optionnel : Pour la recherche sémantique basée sur les embeddings
OPENAI_API_KEY=sk-...

# Optionnel : ID de contributeur personnalisé (généré automatiquement si non défini)
FIXHIVE_CONTRIBUTOR_ID=your-contributor-id
```

## Utilisation

### En tant que Plugin OpenCode

Ajoutez à votre configuration OpenCode (`opencode.config.ts`) :

```typescript
import FixHivePlugin from '@the-magic-tower/fixhive-opencode-plugin';

export default {
  plugins: [FixHivePlugin],
};
```

### Commandes Disponibles

| Commande | Description |
|----------|-------------|
| `fixhive_search` | Rechercher des solutions d'erreurs dans la base de connaissances |
| `fixhive_resolve` | Marquer une erreur comme résolue et partager la solution |
| `fixhive_list` | Lister les erreurs de la session en cours |
| `fixhive_vote` | Voter pour/contre une solution |
| `fixhive_stats` | Voir les statistiques d'utilisation |
| `fixhive_helpful` | Signaler qu'une solution a été utile |

### Exemple de Flux de Travail

1. **Une erreur survient** → FixHive la détecte et l'enregistre automatiquement
2. **Rechercher des solutions** → `fixhive_search "Module not found: react"`
3. **Appliquer le correctif** → Suivre la solution de la communauté
4. **Partager la résolution** → `fixhive_resolve <error-id> "Dépendance manquante installée"`

## Configuration Cloud (Supabase)

1. Créer un nouveau projet Supabase
2. Exécuter le script de configuration dans l'éditeur SQL :

```bash
cat scripts/setup-supabase.sql | pbcopy
# Coller dans l'éditeur SQL Supabase
```

3. Obtenir l'URL du projet et la clé anon depuis Settings > API

## Architecture

```
FixHive Plugin
├── Error Detection (hook tool.execute.after)
├── Privacy Filter (supprime les données sensibles)
├── Local Storage (SQLite)
│   ├── error_records
│   └── query_cache
└── Cloud Client (Supabase + pgvector)
    ├── knowledge_entries
    └── usage_logs
```

## Confidentialité

FixHive filtre automatiquement les informations sensibles :

- Clés API (OpenAI, GitHub, AWS, Stripe, etc.)
- Jetons JWT et jetons Bearer
- Adresses e-mail
- Chemins de fichiers (remplacés par `~` ou `<PROJECT>`)
- Variables d'environnement avec des noms sensibles
- Chaînes de connexion aux bases de données
- Adresses IP (sauf localhost)

## Développement

```bash
# Installer les dépendances
npm install

# Compiler
npm run build

# Mode surveillance
npm run dev

# Vérification des types
npm run typecheck

# Exécuter les tests
npm test
```

## Licence

MIT

## Contribuer

1. Forker le dépôt
2. Créer votre branche de fonctionnalité
3. Committer vos modifications
4. Pousser vers la branche
5. Créer une Pull Request
