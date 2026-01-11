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

> Community-gebaseerd Foutkennis Delen voor OpenCode

**Laatste versie: v0.1.34** - Bun runtime compatibiliteitsproblemen opgelost. Plugin werkt nu correct met OpenCode.

FixHive is een OpenCode-plugin die automatisch fouten vastlegt tijdens ontwikkelsessies, een community-kennisbank raadpleegt voor oplossingen en opgeloste fouten deelt met andere ontwikkelaars.

## Functies

- **Automatische Foutdetectie**: Detecteert automatisch fouten uit tool-uitvoer (bash, edit, etc.)
- **Cloud Kennisbank**: Zoek community-oplossingen met semantische gelijkenis (pgvector)
- **Lokale Cache**: SQLite-gebaseerde lokale opslag voor offline toegang
- **Privacy Filtering**: Verwijdert automatisch gevoelige gegevens (API-sleutels, paden, e-mails)
- **Realtime Synchronisatie**: Directe cloudcommunicatie bij fout/oplossing

## Installatie

```bash
npm install @the-magic-tower/fixhive-opencode-plugin
```

## Snelstart

Voeg toe aan uw OpenCode-configuratie (`opencode.config.ts`):

```typescript
import FixHivePlugin from '@the-magic-tower/fixhive-opencode-plugin';

export default {
  plugins: [FixHivePlugin],
};
```

**Dat is alles!** FixHive maakt standaard verbinding met de community-kennisbank. Geen omgevingsvariabelen vereist.

## Configuratie (Optioneel)

Omgevingsvariabelen om gedrag aan te passen:

```bash
# Gebruik uw eigen Supabase-instantie in plaats van community
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key

# Schakel semantisch zoeken in (aanbevolen)
OPENAI_API_KEY=sk-...

# Aangepaste bijdrager-ID (automatisch gegenereerd indien niet ingesteld)
FIXHIVE_CONTRIBUTOR_ID=your-contributor-id
```

| Variabele | Standaard | Beschrijving |
|-----------|-----------|--------------|
| `FIXHIVE_SUPABASE_URL` | Community DB | Supabase project-URL |
| `FIXHIVE_SUPABASE_KEY` | Community Key | Supabase anon-sleutel |
| `OPENAI_API_KEY` | Geen | Schakelt semantische gelijkeniszoekopdracht in |
| `FIXHIVE_CONTRIBUTOR_ID` | Auto-gegenereerd | Unieke bijdrager-ID |

## Beschikbare Commando's

| Commando | Beschrijving |
|----------|--------------|
| `fixhive_search` | Zoek foutoplossingen in de kennisbank |
| `fixhive_resolve` | Markeer fout als opgelost en deel oplossing |
| `fixhive_list` | Lijst fouten in huidige sessie |
| `fixhive_vote` | Stem voor/tegen een oplossing |
| `fixhive_stats` | Bekijk gebruiksstatistieken |
| `fixhive_helpful` | Meld dat een oplossing nuttig was |
| `fixhive_report` | Meld ongepaste inhoud |

### Voorbeeld Workflow

1. **Fout treedt op** → FixHive detecteert en registreert deze automatisch
2. **Zoek oplossingen** → `fixhive_search "Module not found: react"`
3. **Pas fix toe** → Volg de community-oplossing
4. **Deel oplossing** → `fixhive_resolve <error-id> "Ontbrekende dependency geïnstalleerd"`

## Self-Hosted Setup (Optioneel)

Sla deze sectie over als u de standaard community-kennisbank gebruikt.

Om uw eigen FixHive-backend te draaien:

1. Maak een nieuw Supabase-project aan (gratis tier werkt)
2. Voer het setup-script uit in de SQL-editor:

```bash
cat scripts/setup-supabase.sql | pbcopy
# Plak in Supabase SQL-editor
```

3. Haal project-URL en anon-sleutel op via Settings > API
4. Stel omgevingsvariabelen in:

```bash
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key
```

## Architectuur

```
FixHive Plugin
├── Error Detection (tool.execute.after hook)
├── Privacy Filter (verwijdert gevoelige gegevens)
├── Local Storage (SQLite - Bun/Node.js)
│   ├── error_records
│   └── query_cache
└── Cloud Client (Supabase + pgvector)
    ├── knowledge_entries
    └── usage_logs
```

### Runtime Compatibiliteit

FixHive detecteert automatisch de runtime-omgeving en gebruikt de juiste SQLite-implementatie:

| Runtime | SQLite Implementatie |
|---------|---------------------|
| Bun     | `bun:sqlite` (natief) |
| Node.js | `better-sqlite3` |

## Privacy

FixHive filtert automatisch gevoelige informatie:

- API-sleutels (OpenAI, GitHub, AWS, Stripe, etc.)
- JWT-tokens en Bearer-tokens
- E-mailadressen
- Bestandspaden (vervangen door `~` of `<PROJECT>`)
- Omgevingsvariabelen met gevoelige namen
- Database-verbindingsstrings
- IP-adressen (behalve localhost)

## Ontwikkeling

```bash
# Installeer dependencies
npm install

# Bouwen
npm run build

# Watch-modus
npm run dev

# Type-controle
npm run typecheck

# Tests uitvoeren
npm test
```

## Probleemoplossing

### Controleer of Plugin Werkt

Wanneer de plugin succesvol laadt, ziet u:
```
[FixHive] Plugin loaded
[FixHive] Project: /your/project/path
[FixHive] Cloud: enabled
[FixHive] Detected: typescript
[FixHive] Ready - use fixhive_stats to verify
```

Alle 7 tools moeten beschikbaar zijn:
- `fixhive_search`, `fixhive_resolve`, `fixhive_list`, `fixhive_vote`, `fixhive_report`, `fixhive_stats`, `fixhive_helpful`

### Plugin Laadt Niet

Als u een oude gecachte versie hebt, wis de cache en herstart:
```bash
rm -rf ~/.cache/opencode/node_modules/@the-magic-tower*
opencode
```

## Licentie

MIT

## Dankbetuigingen

- [OpenCode](https://github.com/opencode-ai/opencode) - AI-programmeerassistent
- [Supabase](https://supabase.com) - Backend as a Service
- [pgvector](https://github.com/pgvector/pgvector) - Vector-gelijkenis zoeken
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - Snelle SQLite-bindingen (Node.js)
- [Bun](https://bun.sh) - Snelle JavaScript-runtime met native SQLite-ondersteuning

## Bijdragen

1. Fork de repository
2. Maak uw feature-branch aan
3. Commit uw wijzigingen
4. Push naar de branch
5. Maak een Pull Request
