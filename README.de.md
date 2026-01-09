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

## Schnellstart

Fügen Sie zu Ihrer OpenCode-Konfiguration hinzu (`opencode.config.ts`):

```typescript
import FixHivePlugin from '@the-magic-tower/fixhive-opencode-plugin';

export default {
  plugins: [FixHivePlugin],
};
```

**Das war's!** FixHive verbindet sich standardmäßig mit der Community-Wissensdatenbank. Keine Umgebungsvariablen erforderlich.

## Konfiguration (Optional)

Umgebungsvariablen zur Anpassung des Verhaltens:

```bash
# Eigene Supabase-Instanz statt Community verwenden
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key

# Semantische Suche aktivieren (empfohlen)
OPENAI_API_KEY=sk-...

# Benutzerdefinierte Mitwirkenden-ID (wird automatisch generiert, wenn nicht gesetzt)
FIXHIVE_CONTRIBUTOR_ID=your-contributor-id
```

| Variable | Standard | Beschreibung |
|----------|----------|--------------|
| `FIXHIVE_SUPABASE_URL` | Community DB | Supabase-Projekt-URL |
| `FIXHIVE_SUPABASE_KEY` | Community Key | Supabase Anon-Key |
| `OPENAI_API_KEY` | Keine | Aktiviert semantische Ähnlichkeitssuche |
| `FIXHIVE_CONTRIBUTOR_ID` | Auto-generiert | Eindeutige Mitwirkenden-ID |

## Verfügbare Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `fixhive_search` | Wissensdatenbank nach Fehlerlösungen durchsuchen |
| `fixhive_resolve` | Fehler als gelöst markieren und Lösung teilen |
| `fixhive_list` | Fehler in der aktuellen Sitzung auflisten |
| `fixhive_vote` | Lösung hoch-/runtervoten |
| `fixhive_stats` | Nutzungsstatistiken anzeigen |
| `fixhive_helpful` | Melden, dass eine Lösung hilfreich war |
| `fixhive_report` | Unangemessenen Inhalt melden |

### Beispiel-Workflow

1. **Fehler tritt auf** → FixHive erkennt und protokolliert ihn automatisch
2. **Lösungen suchen** → `fixhive_search "Module not found: react"`
3. **Fix anwenden** → Community-Lösung befolgen
4. **Lösung teilen** → `fixhive_resolve <error-id> "Fehlende Abhängigkeit installiert"`

## Self-Hosted Setup (Optional)

Überspringen Sie diesen Abschnitt, wenn Sie die Standard-Community-Wissensdatenbank verwenden.

Um Ihr eigenes FixHive-Backend zu betreiben:

1. Neues Supabase-Projekt erstellen (Free-Tier funktioniert)
2. Setup-Skript im SQL-Editor ausführen:

```bash
cat scripts/setup-supabase.sql | pbcopy
# Im Supabase SQL-Editor einfügen
```

3. Projekt-URL und Anon-Key unter Settings > API abrufen
4. Umgebungsvariablen setzen:

```bash
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key
```

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
