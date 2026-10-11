# my-mods

Dos mods para la terminal de Claude Code, con estilo neón y todo en español:

| Mod | Qué muestra |
| --- | --- |
| [`usage-bar`](usage-bar) | Una barra sobre el prompt con el **contexto** y el **% de uso** del límite de **5 horas** (`5/H`) y del **semanal**, con el tiempo que falta para el reinicio |
| [`agents-bar`](agents-bar) | Los **subagentes** lanzados en la sesión: cuáles están activos, cuánto llevan y cuántos se han lanzado en total |

Ninguno hace peticiones de red ni llama al modelo, así que **no gastan cuota**: solo leen datos que Claude Code ya lleva internamente (`$.session.usage()`, `session.measure` y `$.agent.list()`).

## Instalación

Hace falta un Claude Code con soporte de mods (probado en la 2.1.296).

### Desde GitHub

```sh
claude plugin marketplace add <usuario>/<repositorio>
claude plugin install usage-bar@my-mods
claude plugin install agents-bar@my-mods
```

Dentro de Claude Code también sirve `/plugin install usage-bar --marketplace <usuario>/<repositorio>`.

### Desde una carpeta local

```sh
git clone <url-del-repositorio> ~/.claude/my-mods
claude plugin marketplace add ~/.claude/my-mods
claude plugin install usage-bar@my-mods
claude plugin install agents-bar@my-mods
```

### Solo probarlos, sin instalar

```sh
claude --plugin-dir ./usage-bar --plugin-dir ./agents-bar
```

Se cargan solo en esa sesión y no tocan tu configuración.

Para actualizar tras un `git pull`: `claude plugin update usage-bar@my-mods` (y lo mismo con `agents-bar`), o `/reload-plugins` dentro de Claude Code.

## usage-bar

```
◈ Contexto ▰▰▰▱▱▱▱▱▱▱ 23% (229k/1M) ❯ ⚡ 5/H ▰▱▱▱▱▱▱▱▱▱ 9% (1h 10m) ❯ 📅 Semana ▰▰▰▱▱▱▱▱▱▱ 38% (10h 30m)
```

- Las etiquetas van en rosa, las barras en verde (contexto) y cian (límites), y las horas en naranja.
- La barra pasa a **amarillo** desde el 70 % y a **rojo** desde el 90 %.
- Se adapta al ancho de la terminal:
  - con 112 columnas o más, las tres medidas van en una sola fila;
  - entre 100 y 111, también, con barras más cortas;
  - entre 70 y 99, el contexto va arriba y `5/H` con `Semana` abajo;
  - por debajo, cada medida en su propia fila, y con muy poco ancho desaparecen la barra y el detalle.
- Las medidas aparecen cuando Claude Code las informa: una sesión nueva no muestra el contexto hasta la primera respuesta, y las cuentas con clave de API no tienen límites de 5 horas ni semanal.

**Comando:** `/usage-bar [on|off]` muestra u oculta la barra; sin argumento, alterna.

| Opción | Qué hace | Por defecto |
| --- | --- | --- |
| `showContext` | Muestra la fila de contexto | activada |
| `warnAt` | Porcentaje desde el que se pone amarilla | 70 |
| `critAt` | Porcentaje desde el que se pone roja | 90 |

## agents-bar

```
◈ Agentes ❯ 2 activos ❯ 7 lanzados
  ◌ Explore buscar el config de auth  1m12s
  ◐ revisor revisar el diff           0m38s
  ◉ Plan    plan de migración         2m05s
```

- Estados: `◌` trabajando, `◐` esperando, `○` en pausa, `◉` terminado, `✗` fallido, `■` detenido.
- Lista los agentes activos con su cronómetro y deja a la vista los últimos terminados.
- Se oculta sola un rato después de que termine el último agente.
- Mira la lista de agentes cada 2 segundos.

**Comando:** `/agents-bar [on|off]`, igual que el anterior.

| Opción | Qué hace | Por defecto |
| --- | --- | --- |
| `maxActive` | Agentes activos a listar; el resto se resume como `+N más` | 5 |
| `showFinished` | Agentes terminados recientes a listar; `0` los oculta | 2 |
| `lingerSeconds` | Segundos que sigue visible tras terminar el último; `0` la oculta de inmediato | 60 |

Las opciones se cambian con `/plugin configure <mod>@my-mods` o desde `/config`.

## Desarrollo

Cada mod es una carpeta con tres piezas: `.claude-plugin/plugin.json`, `hooks/hooks.json` y `hooks/register.tsx`, más un contrato de estado en `types/index.d.ts`. La lógica pura (formato, filas, fusión de agentes) está aparte, en `format.ts` y `agents.ts`, para poder probarla.

```sh
claude plugin validate ./usage-bar     # lee el manifiesto y el código como lo hará el motor
claude plugin test ./usage-bar         # ejecuta los *.test.ts
claude plugin validate .               # valida también el marketplace
```

Claude Code genera en cada mod una carpeta `.claude-plugin/types/` y un `tsconfig.json` para el editor; no se versionan (ver `.gitignore`).

## Licencia

Sin licencia por ahora: añade un archivo `LICENSE` antes de publicarlo si quieres que otras personas puedan reutilizarlo.
