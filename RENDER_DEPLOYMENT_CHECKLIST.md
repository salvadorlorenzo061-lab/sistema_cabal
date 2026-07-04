# Render Deployment Checklist (Sin cruzar sistemas)

## Objetivo
Mantener separados `sistema_cabal` y `api_inmoviliaria` en Render para evitar mezclas de base de datos, dominio o variables.

## Regla principal
Cada Web Service en Render tiene sus propias variables de entorno. No se comparten automaticamente entre proyectos.

## Variables requeridas para este backend
- `SERVICE_NAME` (ejemplo: `sistema_cabal-api`)
- `DB_HOST`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`
- `DB_PORT`
- `NODE_ENV=production`

## Configuracion recomendada por servicio
### Servicio 1: sistema_cabal
- `SERVICE_NAME=sistema_cabal-api`
- `DB_HOST=<host DB de sistema_cabal>`
- `DB_USER=<usuario DB de sistema_cabal>`
- `DB_PASSWORD=<password DB de sistema_cabal>`
- `DB_NAME=<base de datos de sistema_cabal>`
- `DB_PORT=<puerto DB de sistema_cabal>`

### Servicio 2: api_inmoviliaria
- `SERVICE_NAME=api_inmoviliaria-api`
- `DB_HOST=<host DB de api_inmoviliaria>`
- `DB_USER=<usuario DB de api_inmoviliaria>`
- `DB_PASSWORD=<password DB de api_inmoviliaria>`
- `DB_NAME=<base de datos de api_inmoviliaria>`
- `DB_PORT=<puerto DB de api_inmoviliaria>`

## Verificacion despues de deploy
1. Abrir `https://<tu-servicio>/health`.
2. Confirmar que `service` coincide con el sistema correcto.
3. Revisar en logs de Render que conecta a la DB esperada.

## Flujo seguro antes de cada push
1. Verificar secretos en cambios:
   - `git diff -- server/Conexion.js`
2. Asegurar que no exista `.env` en git:
   - `git ls-files | findstr /R "\.env$ \.env\."`
3. Hacer push solo de la rama objetivo:
   - `git push origin desarrollo`

## Si GitHub vuelve a bloquear push por secretos
1. Corregir el archivo para usar variables de entorno.
2. Reescribir el ultimo commit:
   - `git add .`
   - `git commit --amend -m "remove hardcoded secrets"`
3. Reintentar push.

## Nota de seguridad
Si una credencial se escribio en un commit, rota esa credencial en el proveedor (Aiven, MySQL, etc.).
