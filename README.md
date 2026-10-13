# Discord Key Server

Bot para manejar keys por Discord sin pasar paginas de keys a otras personas.

Incluye estos proyectos:

- GLLYZI APP
- TRYHARD APP
- BLACKOUT
- ZEUS PRIME

ELIAS y GREEG no estan incluidos.

## Que hace

- Crea una categoria `KEYS - APPS`.
- Crea un canal privado por proyecto.
- Crea un rol por proyecto.
- Solo el rol de ese proyecto puede ver su canal.
- Un rol global `KEYS ADMIN` puede ver todo.
- Los comandos trabajan directo con Supabase.

## Comandos

- `/preparar-canales`: crea roles y canales privados.
- `/crear-key`: crea keys y deja botones para administrarlas.
- `/ver-keys`: lista y busca keys con botones.
- `/bloquear-todas`: bloquea todas las keys de un proyecto.
- `/eliminar-bloqueadas`: elimina keys bloqueadas o expiradas.
- `/eliminar-todas`: bloquea y elimina todas las keys de un proyecto.

## Configuracion

1. En Discord Developer Portal crea una aplicacion y un bot.
2. Copia el token del bot.
3. Invita el bot al servidor con permisos:
   - Manage Roles
   - Manage Channels
   - View Channels
   - Send Messages
   - Use Slash Commands
   - Read Message History
4. Copia `.env.example` y renombralo a `.env`.
5. Llena:
   - `DISCORD_TOKEN`
   - `GUILD_ID`
   - los correos y passwords admin de Supabase de cada proyecto.

Los correos deben existir en Supabase Auth y tambien en `public.license_admins`, igual que los paneles web.

## Encender

Abre:

```bat
INICIAR-BOT-KEYS.cmd
```

O desde terminal:

```bat
npm start
```

Cuando el bot diga que esta conectado, en Discord usa:

```text
/preparar-canales
```

Despues dale a cada dueño su rol, por ejemplo `KEYS GLLYZI`, `KEYS BLACKOUT`, `KEYS ZEUS PRIME`, etc.

## Seguridad

No compartas el archivo `.env`. Ahi van el token del bot y las claves de Supabase.
