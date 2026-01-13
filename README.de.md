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

**Neueste Version: v0.1.34** - Bun-Runtime-Kompatibilitätsprobleme behoben. Das Plugin funktioniert jetzt korrekt mit OpenCode.

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

Fügen Sie zu Ihrer OpenCode-Konfiguration hinzu (`~/.config/opencode/opencode.json`):

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@the-magic-tower/fixhive-opencode-plugin@beta"]
}
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
├── Local Storage (SQLite - Bun/Node.js)
│   ├── error_records
│   └── query_cache
└── Cloud Client (Supabase + pgvector)
    ├── knowledge_entries
    └── usage_logs
```

### Runtime-Kompatibilität

FixHive erkennt automatisch die Laufzeitumgebung und verwendet die entsprechende SQLite-Implementierung:

| Runtime | SQLite-Implementierung |
|---------|------------------------|
| Bun     | `bun:sqlite` (nativ) |
| Node.js | `better-sqlite3` |

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

## Fehlerbehebung

### Plugin-Funktion Überprüfen

Wenn das Plugin erfolgreich geladen wird, sehen Sie:
```
[FixHive] Plugin loaded
[FixHive] Project: /your/project/path
[FixHive] Cloud: enabled
[FixHive] Detected: typescript
[FixHive] Ready - use fixhive_stats to verify
```

Alle 7 Tools sollten verfügbar sein:
- `fixhive_search`, `fixhive_resolve`, `fixhive_list`, `fixhive_vote`, `fixhive_report`, `fixhive_stats`, `fixhive_helpful`

### Plugin Lädt Nicht

Bei einer alten Cache-Version, Cache leeren und neu starten:
```bash
rm -rf ~/.cache/opencode/node_modules/@the-magic-tower*
opencode
```

## Lizenz

MIT

## Danksagungen

- [OpenCode](https://github.com/opencode-ai/opencode) - KI-Programmierassistent
- [Supabase](https://supabase.com) - Backend as a Service
- [pgvector](https://github.com/pgvector/pgvector) - Vektor-Ähnlichkeitssuche
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - Schnelle SQLite-Bindungen (Node.js)
- [Bun](https://bun.sh) - Schnelle JavaScript-Laufzeit mit nativer SQLite-Unterstützung

## Mitwirken

1. Repository forken
2. Feature-Branch erstellen
3. Änderungen committen
4. Zum Branch pushen
5. Pull Request erstellen
