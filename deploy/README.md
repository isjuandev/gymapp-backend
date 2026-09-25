# GymApp Backend — Guía de Despliegue en Coolify

Esta guía documenta la arquitectura de despliegue, configuración y ciclo de vida de instancias del backend de **GymApp** en **Coolify** sobre **Mac mini (Apple Silicon ARM64) con Ubuntu (Multipass)** y **PostgreSQL compartido con schema-per-tenant**.

---

## 1. Arquitectura de Despliegue

```
                                  INTERNET
                                      │
                   DNS (*.api.gymapp.com -> IP Mac mini)
                                      │
                           ┌──────────▼──────────┐
                           │   Traefik (Coolify)  │  (SSL Automático Let's Encrypt)
                           └──────────┬──────────┘
                                      │
           ┌──────────────────────────┼──────────────────────────┐
           │                          │                          │
┌──────────▼──────────┐    ┌──────────▼──────────┐    ┌──────────▼──────────┐
│ Container: FitZone  │    │ Container: PowerGym │    │ Container: IronBox  │
│  (puerto 3000)      │    │  (puerto 3000)      │    │  (puerto 3000)      │
│ fitzone.api.gymapp  │    │ powergym.api.gymapp │    │ ironbox.api.gymapp  │
└──────────┬──────────┘    └──────────┬──────────┘    └──────────┬──────────┘
           │                          │                          │
           │  ?schema=gym_fitzone     │ ?schema=gym_powergym     │ ?schema=gym_ironbox
           └──────────────────────────┼──────────────────────────┘
                                      │
                           ┌──────────▼──────────┐
                           │ Postgres Compartido │
                           │   (schemas aislados)│
                           └─────────────────────┘
```

- **Aislamiento Total**: Cada gimnasio cliente corre en su propio contenedor Docker independiente con su propio subdominio, sus propios tokens JWT y su propio schema de PostgreSQL (`gym_<cliente>`).
- **Eficiencia**: Un solo motor PostgreSQL en el servidor aloja todos los schemas sin sobrecarga de memoria de múltiples bases de datos.
- **Sin Multi-tenancy en Código**: El backend no tiene columnas `tenant_id` ni lógica de discriminación; Prisma se conecta directamente al schema del cliente via el parámetro `?schema=gym_<cliente>`.

---

## 2. Opciones para Conectar Coolify al Repositorio

### Opción A (Recomendada al inicio): Build Directo desde Coolify via Webhook

Coolify clona el repositorio y compila directamente usando el `Dockerfile` de producción en cada push o trigger manual.

- **Ventajas**:
  - Máxima simplicidad: no requiere configurar GitHub Actions, registries de Docker externos ni tokens de acceso adicionales.
  - Velocidad nativa: compila directamente sobre la arquitectura ARM64 del Mac mini sin capas de emulación QEMU.
  - Gestión centralizada desde el dashboard de Coolify.
- **Cuándo conviene**: Ideal para la etapa inicial y hasta ~20 clientes.

### Opción B: Pre-construcción en GitHub Actions y Despliegue de Imagen (GHCR)

GitHub Actions compila la imagen multi-arch (`linux/arm64`) en cada push a `main` y la publica en GitHub Container Registry (`ghcr.io`). Coolify simplemente descarga (`docker pull`) la imagen pre-compilada.

- **Ventajas**:
  - El Mac mini no consume CPU ni memoria compilando Node.js / TypeScript.
  - Despliegues instantáneos para nuevos clientes (solo descarga la imagen existente).
- **Cuándo conviene**: Cuando el número de clientes crezca o si la CPU del Mac mini necesita reservarse exclusivamente para servir tráfico.

---

## 3. Variables de Entorno por Cliente

Cada contenedor desplegado en Coolify **DEBE** tener configuradas las siguientes variables de entorno:

| Variable | Tipo / Ejemplo | Descripción |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Modo de ejecución optimizado de NestJS / Node. |
| `PORT` | `3000` | Puerto interno del contenedor (mapeado por Traefik). |
| `DATABASE_URL` | `postgresql://user:pass@postgres:5432/gym_db?schema=gym_<cliente>` | Cadena de conexión con el schema exclusivo del cliente. |
| `JWT_SECRET` | `openssl rand -hex 32` | **ÚNICO POR CLIENTE**. Llave secreta para firmar access tokens. |
| `JWT_REFRESH_SECRET` | `openssl rand -hex 32` | **ÚNICO POR CLIENTE**. Llave secreta para firmar refresh tokens. |

> [!CAUTION]
> **NUNCA compartas `JWT_SECRET` ni `JWT_REFRESH_SECRET` entre clientes.** Si un secreto fuera compartido, un token emitido por el Gimnasio A podría ser validado por la API del Gimnasio B. Cada cliente debe tener sus propios secretos criptográficos generados aleatoriamente.

---

## 4. Flujo Repetible: Aprovisionar un Nuevo Cliente

Para dar de alta a un gimnasio nuevo (ej. `fitzone`), sigue estos pasos:

### Paso 1: Ejecutar el script de aprovisionamiento en la terminal

En la máquina host (o dentro del entorno Multipass):

```bash
cd backend
./scripts/provision-new-client.sh fitzone
```

El script ejecutará automáticamente:
1. Verificación y creación del schema `gym_fitzone` en PostgreSQL.
2. Despliegue de todas las migraciones de Prisma en ese schema (`prisma migrate deploy`).
3. Generación de secretos seguros aleatorios de 256 bits para `JWT_SECRET` y `JWT_REFRESH_SECRET`.
4. Impresión en pantalla de las variables de entorno listas para copiar y pegar.

### Paso 2: Pasos Manuales en Coolify UI (Dashboard)

1. Ingresa a tu dashboard de Coolify (ej. `http://<ip-mac-mini>:8000`).
2. Entra a tu proyecto `GymApp` y selecciona el entorno `Production`.
3. **Duplicar Plantilla (Opción más rápida)**:
   - Haz clic en los tres puntos `...` de tu aplicación base `gymapp-template` y selecciona **Duplicate**.
   - Nombra la nueva aplicación: `gymapp-fitzone`.
4. **Configurar Dominio / FQDN**:
   - En la sección **Domains**, escribe el subdominio del cliente:
     ```
     https://fitzone.api.gymapp.com
     ```
   - Coolify solicitará automáticamente el certificado SSL gratuito vía Let's Encrypt.
5. **Configurar Variables de Entorno**:
   - Ve a la pestaña **Environment Variables** y pega los valores generados por el script:
     ```env
     NODE_ENV=production
     PORT=3000
     DATABASE_URL=postgresql://gym_user:gym_password@postgres:5432/gym_db?schema=gym_fitzone
     JWT_SECRET=<valor_generado_por_el_script>
     JWT_REFRESH_SECRET=<valor_generado_por_el_script>
     ```
   - Guarda los cambios.
6. **Desplegar**:
   - Haz clic en **Deploy**.
   - Una vez finalizado el build, verifica la salud del servicio:
     ```bash
     curl -f https://fitzone.api.gymapp.com/health
     ```
     Debe responder: `{"status":"ok","timestamp":"...","uptime":...}`.

---

## 5. Estrategia de Backups y Recuperación ante Desastres

> [!IMPORTANT]
> **Regla de Oro**: NUNCA dejes las copias de seguridad únicamente en el mismo Mac mini que ejecuta la producción. Un fallo de disco o incidente físico destruiría tanto los datos vivos como sus backups.

El script [`scripts/backup-tenant.sh`](file:///Users/isjuandev/Documents/WS-PERSONAL/Fitty/backend/scripts/backup-tenant.sh) permite realizar respaldos independientes por schema y subirlos a almacenamiento externo.

### Uso Manual

```bash
./scripts/backup-tenant.sh fitzone
```

Genera un archivo comprimido `backups/gym_fitzone_YYYYMMDD_HHMMSS.sql.gz`.

### Configuración de Almacenamiento Externo

El script soporta múltiples destinos externos configurables vía variables de entorno:

#### 1. AWS S3 / Cloudflare R2 / Backblaze B2 (Recomendado)
```bash
export BACKUP_STORAGE_DRIVER=s3
export S3_BACKUP_BUCKET="mi-bucket-backups-gyms"
export AWS_ACCESS_KEY_ID="tu-key"
export AWS_SECRET_ACCESS_KEY="tu-secret"
export AWS_DEFAULT_REGION="us-east-1"
# Si usas Cloudflare R2 o Backblaze B2:
# export AWS_ENDPOINT_URL="https://<account-id>.r2.cloudflarestorage.com"

./scripts/backup-tenant.sh fitzone
```

#### 2. Rsync / SSH hacia un NAS o Servidor Remoto
```bash
export BACKUP_STORAGE_DRIVER=rsync
export RSYNC_DESTINATION="backupuser@nas.local:/data/fitty_backups"

./scripts/backup-tenant.sh fitzone
```

### Automatización con Cron (Diario a las 2:00 AM)

Puedes añadir una tarea en el `crontab` de tu máquina Ubuntu para respaldar todos los clientes periódicamente:

```cron
# Editar crontab con: crontab -e
0 2 * * * /home/ubuntu/Fitty/backend/scripts/backup-tenant.sh fitzone >> /var/log/backup-fitzone.log 2>&1
```

---

## 6. Mantenimiento y Nuevas Migraciones

Cuando agregues nuevas funcionalidades al backend y generes una nueva migración de Prisma:

1. Haz push de los cambios al repositorio `main`.
2. Para aplicar la migración a los clientes existentes:
   ```bash
   DATABASE_URL="postgresql://gym_user:gym_password@localhost:5432/gym_db?schema=gym_fitzone" npx prisma migrate deploy
   ```
3. O bien, ejecuta `provision-tenant-schema.sh <cliente>` para cada gimnasio; el comando es idempotente y solo aplicará las migraciones pendientes.
4. Coolify actualizará los contenedores automáticamente con la nueva versión de la imagen.
