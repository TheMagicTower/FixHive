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

> Community-basiertes Fehlerwissen-Sharing für OpenCode

FixHive ist ein OpenCode-Plugin, das während der Entwicklungssitzungen automatisch Fehler erfasst, eine Community-Wissensdatenbank nach Lösungen abfragt und gelöste Fehler mit anderen Entwicklern teilt.

## Funktionen

- **Automatische Fehlererkennung**: Erkennt automatisch Fehler aus Tool-Ausgaben (bash, edit, etc.)
- **Cloud-Wissensdatenbank**: Suche nach Community-Lösungen mit semantischer Ähnlichkeit (pgvector)
- **Lokaler Cache**: SQLite-basierter lokaler Speicher für Offline-Zugriff
- **Datenschutzfilterung**: Entfernt automatisch sensible Daten (API-Schlüssel, Pfade, E-Mails)
- **Echtzeit-Synchronisierung**: Sofortige Cloud-Kommunikation bei Fehler/Lösung

## Installation

```bash
npm install @the-magic-tower/fixhive-opencode-plugin
```

## Konfiguration

Setzen Sie die folgenden Umgebungsvariablen:

```bash
# Erforderlich für Cloud-Funktionen
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key

# Optional: Für embedding-basierte semantische Suche
OPENAI_API_KEY=sk-...

# Optional: Benutzerdefinierte Mitwirkenden-ID (wird automatisch generiert, wenn nicht gesetzt)
FIXHIVE_CONTRIBUTOR_ID=your-contributor-id
```

## Verwendung

### Als OpenCode-Plugin

Fügen Sie zu Ihrer OpenCode-Konfiguration hinzu (`opencode.config.ts`):

```typescript
import FixHivePlugin from '@the-magic-tower/fixhive-opencode-plugin';

export default {
  plugins: [FixHivePlugin],
};
```

### Verfügbare Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `fixhive_search` | Wissensdatenbank nach Fehlerlösungen durchsuchen |
| `fixhive_resolve` | Fehler als gelöst markieren und Lösung teilen |
| `fixhive_list` | Fehler in der aktuellen Sitzung auflisten |
| `fixhive_vote` | Lösung hoch-/runtervoten |
| `fixhive_stats` | Nutzungsstatistiken anzeigen |
| `fixhive_helpful` | Melden, dass eine Lösung hilfreich war |

### Beispiel-Workflow

1. **Fehler tritt auf** → FixHive erkennt und protokolliert ihn automatisch
2. **Lösungen suchen** → `fixhive_search "Module not found: react"`
3. **Fix anwenden** → Community-Lösung befolgen
4. **Lösung teilen** → `fixhive_resolve <error-id> "Fehlende Abhängigkeit installiert"`

## Cloud-Setup (Supabase)

1. Neues Supabase-Projekt erstellen
2. Setup-Skript im SQL-Editor ausführen:

```bash
cat scripts/setup-supabase.sql | pbcopy
# Im Supabase SQL-Editor einfügen
```

3. Projekt-URL und Anon-Key unter Settings > API abrufen

## Architektur

```
FixHive Plugin
├── Error Detection (tool.execute.after Hook)
├── Privacy Filter (entfernt sensible Daten)
├── Local Storage (SQLite)
│   ├── error_records
│   └── query_cache
└── Cloud Client (Supabase + pgvector)
    ├── knowledge_entries
    └── usage_logs
```

## Datenschutz

FixHive filtert automatisch sensible Informationen:

- API-Schlüssel (OpenAI, GitHub, AWS, Stripe, etc.)
- JWT-Token und Bearer-Token
- E-Mail-Adressen
- Dateipfade (ersetzt durch `~` oder `<PROJECT>`)
- Umgebungsvariablen mit sensiblen Namen
- Datenbankverbindungszeichenfolgen
- IP-Adressen (außer localhost)

## Entwicklung

```bash
# Abhängigkeiten installieren
npm install

# Bauen
npm run build

# Watch-Modus
npm run dev

# Typ-Prüfung
npm run typecheck

# Tests ausführen
npm test
```

## Lizenz

MIT

## Mitwirken

1. Repository forken
2. Feature-Branch erstellen
3. Änderungen committen
4. Zum Branch pushen
5. Pull Request erstellen
