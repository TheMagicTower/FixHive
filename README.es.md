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

> Sistema de Compartición de Conocimiento de Errores Basado en la Comunidad para OpenCode

**Última versión: v0.1.31** - Corregidos problemas de compatibilidad con Bun runtime. El plugin ahora funciona correctamente con OpenCode.

FixHive es un plugin de OpenCode que captura automáticamente errores durante las sesiones de desarrollo, consulta una base de conocimientos comunitaria para encontrar soluciones y comparte errores resueltos con otros desarrolladores.

## Características

- **Detección Automática de Errores**: Detecta automáticamente errores de las salidas de herramientas (bash, edit, etc.)
- **Base de Conocimientos en la Nube**: Búsqueda de soluciones comunitarias usando similitud semántica (pgvector)
- **Caché Local**: Almacenamiento local basado en SQLite para acceso sin conexión
- **Filtrado de Privacidad**: Redacta automáticamente datos sensibles (claves API, rutas, correos electrónicos)
- **Sincronización en Tiempo Real**: Comunicación inmediata con la nube en error/resolución

## Instalación

```bash
npm install @the-magic-tower/fixhive-opencode-plugin
```

## Inicio Rápido

Agregue a su configuración de OpenCode (`opencode.config.ts`):

```typescript
import FixHivePlugin from '@the-magic-tower/fixhive-opencode-plugin';

export default {
  plugins: [FixHivePlugin],
};
```

**¡Eso es todo!** FixHive se conecta a la base de conocimientos de la comunidad por defecto. No se requieren variables de entorno.

## Configuración (Opcional)

Variables de entorno para personalizar el comportamiento:

```bash
# Use su propia instancia de Supabase en lugar de la comunidad
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key

# Habilitar búsqueda semántica (recomendado)
OPENAI_API_KEY=sk-...

# ID de contribuidor personalizado (se genera automáticamente si no se establece)
FIXHIVE_CONTRIBUTOR_ID=your-contributor-id
```

| Variable | Por Defecto | Descripción |
|----------|-------------|-------------|
| `FIXHIVE_SUPABASE_URL` | DB Comunidad | URL del proyecto Supabase |
| `FIXHIVE_SUPABASE_KEY` | Key Comunidad | Clave anon de Supabase |
| `OPENAI_API_KEY` | Ninguna | Habilita búsqueda de similitud semántica |
| `FIXHIVE_CONTRIBUTOR_ID` | Auto-generado | ID único de contribuidor |

## Comandos Disponibles

| Comando | Descripción |
|---------|-------------|
| `fixhive_search` | Buscar soluciones de errores en la base de conocimientos |
| `fixhive_resolve` | Marcar error como resuelto y compartir solución |
| `fixhive_list` | Listar errores en la sesión actual |
| `fixhive_vote` | Votar a favor/en contra de una solución |
| `fixhive_stats` | Ver estadísticas de uso |
| `fixhive_helpful` | Reportar que una solución fue útil |
| `fixhive_report` | Reportar contenido inapropiado |

### Flujo de Trabajo de Ejemplo

1. **Ocurre un error** → FixHive lo detecta y registra automáticamente
2. **Buscar soluciones** → `fixhive_search "Module not found: react"`
3. **Aplicar corrección** → Seguir la solución de la comunidad
4. **Compartir resolución** → `fixhive_resolve <error-id> "Instalada dependencia faltante"`

## Configuración Auto-Alojada (Opcional)

Omita esta sección si usa la base de conocimientos de la comunidad por defecto.

Para ejecutar su propio backend de FixHive:

1. Crear un nuevo proyecto de Supabase (el plan gratuito funciona)
2. Ejecutar el script de configuración en el Editor SQL:

```bash
cat scripts/setup-supabase.sql | pbcopy
# Pegar en el Editor SQL de Supabase
```

3. Obtener la URL del proyecto y la clave anon desde Settings > API
4. Configurar variables de entorno:

```bash
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key
```

## Arquitectura

```
FixHive Plugin
├── Error Detection (hook tool.execute.after)
├── Privacy Filter (redacta datos sensibles)
├── Local Storage (SQLite - Bun/Node.js)
│   ├── error_records
│   └── query_cache
└── Cloud Client (Supabase + pgvector)
    ├── knowledge_entries
    └── usage_logs
```

### Compatibilidad de Runtime

FixHive detecta automáticamente el entorno de ejecución y usa la implementación SQLite apropiada:

| Runtime | Implementación SQLite |
|---------|----------------------|
| Bun     | `bun:sqlite` (nativo) |
| Node.js | `better-sqlite3` |

## Privacidad

FixHive filtra automáticamente información sensible:

- Claves API (OpenAI, GitHub, AWS, Stripe, etc.)
- Tokens JWT y tokens Bearer
- Direcciones de correo electrónico
- Rutas de archivos (reemplazadas con `~` o `<PROJECT>`)
- Variables de entorno con nombres sensibles
- Cadenas de conexión a bases de datos
- Direcciones IP (excepto localhost)

## Desarrollo

```bash
# Instalar dependencias
npm install

# Compilar
npm run build

# Modo observación
npm run dev

# Verificación de tipos
npm run typecheck

# Ejecutar pruebas
npm test
```

## Solución de Problemas

### Verificar que el Plugin Funciona

Cuando el plugin se carga correctamente, verá:
```
[FixHive] Plugin loaded
[FixHive] Project: /your/project/path
[FixHive] Cloud: enabled
[FixHive] Detected: typescript
[FixHive] Ready - use fixhive_stats to verify
```

Las 7 herramientas deberían estar disponibles:
- `fixhive_search`, `fixhive_resolve`, `fixhive_list`, `fixhive_vote`, `fixhive_report`, `fixhive_stats`, `fixhive_helpful`

### El Plugin no se Carga

Si tiene una versión anterior en caché, limpie la caché y reinicie:
```bash
rm -rf ~/.cache/opencode/node_modules/@the-magic-tower*
opencode
```

## Licencia

MIT

## Agradecimientos

- [OpenCode](https://github.com/opencode-ai/opencode) - Asistente de programación IA
- [Supabase](https://supabase.com) - Backend como Servicio
- [pgvector](https://github.com/pgvector/pgvector) - Búsqueda de similitud vectorial
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) - Enlaces SQLite rápidos (Node.js)
- [Bun](https://bun.sh) - Runtime JavaScript rápido con soporte SQLite nativo

## Contribuir

1. Hacer fork del repositorio
2. Crear su rama de características
3. Hacer commit de sus cambios
4. Hacer push a la rama
5. Crear un Pull Request
