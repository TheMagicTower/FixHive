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

**Dernière version : v0.1.29** - Correction des problèmes de compatibilité avec le runtime Bun. Le plugin fonctionne maintenant correctement avec OpenCode.

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

## Démarrage Rapide

Ajoutez à votre configuration OpenCode (`opencode.config.ts`) :

```typescript
import FixHivePlugin from '@the-magic-tower/fixhive-opencode-plugin';

export default {
  plugins: [FixHivePlugin],
};
```

**C'est tout !** FixHive se connecte par défaut à la base de connaissances communautaire. Aucune variable d'environnement requise.

## Configuration (Optionnel)

Variables d'environnement pour personnaliser le comportement :

```bash
# Utiliser votre propre instance Supabase au lieu de la communauté
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key

# Activer la recherche sémantique (recommandé)
OPENAI_API_KEY=sk-...

# ID de contributeur personnalisé (généré automatiquement si non défini)
FIXHIVE_CONTRIBUTOR_ID=your-contributor-id
```

| Variable | Par Défaut | Description |
|----------|------------|-------------|
| `FIXHIVE_SUPABASE_URL` | DB Communauté | URL du projet Supabase |
| `FIXHIVE_SUPABASE_KEY` | Clé Communauté | Clé anon Supabase |
| `OPENAI_API_KEY` | Aucune | Active la recherche de similarité sémantique |
| `FIXHIVE_CONTRIBUTOR_ID` | Auto-généré | ID de contributeur unique |

## Commandes Disponibles

| Commande | Description |
|----------|-------------|
| `fixhive_search` | Rechercher des solutions d'erreurs dans la base de connaissances |
| `fixhive_resolve` | Marquer une erreur comme résolue et partager la solution |
| `fixhive_list` | Lister les erreurs de la session en cours |
| `fixhive_vote` | Voter pour/contre une solution |
| `fixhive_stats` | Voir les statistiques d'utilisation |
| `fixhive_helpful` | Signaler qu'une solution a été utile |
| `fixhive_report` | Signaler un contenu inapproprié |

### Exemple de Flux de Travail

1. **Une erreur survient** → FixHive la détecte et l'enregistre automatiquement
2. **Rechercher des solutions** → `fixhive_search "Module not found: react"`
3. **Appliquer le correctif** → Suivre la solution de la communauté
4. **Partager la résolution** → `fixhive_resolve <error-id> "Dépendance manquante installée"`

## Configuration Auto-Hébergée (Optionnel)

Ignorez cette section si vous utilisez la base de connaissances communautaire par défaut.

Pour exécuter votre propre backend FixHive :

1. Créer un nouveau projet Supabase (le plan gratuit fonctionne)
2. Exécuter le script de configuration dans l'éditeur SQL :

```bash
cat scripts/setup-supabase.sql | pbcopy
# Coller dans l'éditeur SQL Supabase
```

3. Obtenir l'URL du projet et la clé anon depuis Settings > API
4. Configurer les variables d'environnement :

```bash
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key
```

## Architecture

```
FixHive Plugin
├── Error Detection (hook tool.execute.after)
├── Privacy Filter (supprime les données sensibles)
├── Local Storage (SQLite - Bun/Node.js)
│   ├── error_records
│   └── query_cache
└── Cloud Client (Supabase + pgvector)
    ├── knowledge_entries
    └── usage_logs
```

### Compatibilité Runtime

FixHive détecte automatiquement l'environnement d'exécution et utilise l'implémentation SQLite appropriée :

| Runtime | Implémentation SQLite |
|---------|----------------------|
| Bun     | `bun:sqlite` (natif) |
| Node.js | `better-sqlite3` |

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

## Dépannage

### Vérifier le Fonctionnement du Plugin

Lorsque le plugin se charge avec succès, vous verrez :
```
[FixHive] Plugin loaded
[FixHive] Project: /your/project/path
[FixHive] Cloud: enabled
[FixHive] Detected: typescript
[FixHive] Ready - use fixhive_stats to verify
```

Les 7 outils devraient être disponibles :
- `fixhive_search`, `fixhive_resolve`, `fixhive_list`, `fixhive_vote`, `fixhive_report`, `fixhive_stats`, `fixhive_helpful`

### Le Plugin ne se Charge Pas

Si vous avez une ancienne version en cache, videz le cache et redémarrez :
```bash
rm -rf ~/.cache/opencode/node_modules/@the-magic-tower*
opencode
```

## Licence

MIT

## Remerciements

- [OpenCode](https://github.com/opencode-ai/opencode) - Assistant de programmation IA
- [Supabase](https://supabase.com) - Backend en tant que Service
- [pgvector](https://github.com/pgvector/pgvector) - Recherche de similarité vectorielle
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - Liaisons SQLite rapides (Node.js)
- [Bun](https://bun.sh) - Runtime JavaScript rapide avec support SQLite natif

## Contribuer

1. Forker le dépôt
2. Créer votre branche de fonctionnalité
3. Committer vos modifications
4. Pousser vers la branche
5. Créer une Pull Request
