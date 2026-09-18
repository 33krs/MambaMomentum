# MambaMomentum

MambaMomentum es una aplicación full-stack para registrar y analizar dos dimensiones del rendimiento personal:

- **Concentración:** sesiones de trabajo profundo, categorías y rachas.
- **Entrenamiento:** ejercicios, sesiones, series, repeticiones y carga.
- **Organización:** tablero Kanban personal con tareas, orden y navegación accesible.

El proyecto prioriza aislamiento por usuario, reglas de dominio explícitas y entregas pequeñas verificables.

## Inicio rápido

### Requisitos

- Docker Desktop con Docker Compose
- Python 3.12 para ejecutar el backend fuera de Docker
- Node.js 20+ y npm para el frontend

### Ejecutar la aplicación completa

1. Copiar `.env.example` como `.env` y revisar los valores locales.
2. Iniciar los servicios:

   ```bash
   docker compose up -d --build
   ```

3. Abrir:

   - Frontend: <http://localhost>
   - API: <http://localhost:8000>
   - Documentación OpenAPI: <http://localhost:8000/docs>

4. Detener los servicios:

   ```bash
   docker compose down
   ```

> Docker publica PostgreSQL en `localhost:5433` para herramientas ejecutadas desde el host. Dentro de Compose, el backend usa `db:5432`.

## Arquitectura

| Capa | Tecnología | Responsabilidad |
| --- | --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS | SPA, navegación, formularios y visualizaciones |
| Backend | FastAPI, SQLAlchemy 2, Pydantic | API REST, autorización y reglas de dominio |
| Persistencia | PostgreSQL 16, Alembic | Datos relacionales y migraciones reproducibles |
| Operación | Docker Compose, GitHub Actions | Entorno local y CI de backend/frontend |

### Estructura principal

```text
backend/
├── app/api/v1/          Rutas REST por dominio
├── app/core/             Configuración y seguridad JWT
├── app/crud/             Acceso a datos
├── app/models/           Modelos SQLAlchemy
├── app/schemas/          Contratos Pydantic
├── app/services/         Casos de uso transaccionales
├── alembic/              Migraciones
└── tests/                Pruebas de integración de API

frontend/
├── src/api/              Clientes HTTP por dominio
├── src/components/       Layout y componentes reutilizables
├── src/context/          Autenticación, tema y categorías
├── src/pages/            Vistas de la aplicación
└── src/types/            Tipos compartidos del cliente
```

## Funcionalidades actuales

- Registro, login JWT y perfil autenticado.
- Sesiones de concentración con duración calculada y validación temporal.
- Catálogo de ejercicios con separación entre ejercicios del sistema y del usuario.
- Registro de entrenamientos, series, plantillas y volumen semanal.
- Dashboard y analítica de concentración/entrenamiento.
- Kanban personal con columnas fijas, drag-and-drop, teclado, foco visible y anuncios accesibles.

## Desarrollo local

### Backend

```powershell
cd backend
.venv\Scripts\Activate.ps1
```

Si el entorno virtual no existe:

```powershell
python -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

## Verificación

### Backend contra una base descartable

La suite crea y elimina todas las tablas. Nunca debe ejecutarse contra la base de desarrollo.

Con PostgreSQL de Docker activo desde Windows:

```powershell
cd backend
$env:POSTGRES_HOST="localhost"
$env:POSTGRES_PORT="5433"
$env:POSTGRES_USER="mamba"
$env:POSTGRES_PASSWORD="<password-local>"
$env:POSTGRES_DB="mambamomentum_test"
.venv\Scripts\python.exe -m flake8 app tests
.venv\Scripts\python.exe -m black --check app tests
.venv\Scripts\python.exe -m pytest --cov=app --cov-report=term-missing
```

La salvaguarda de `backend/tests/conftest.py` rechaza bases cuyo nombre no contenga `test`.

### Frontend

```bash
cd frontend
npm run lint
npm run test
npm run build
```

### CI

Los workflows de GitHub Actions ejecutan automáticamente:

- Backend: instalación, Flake8, Black, migraciones y pytest con PostgreSQL 16.
- Frontend: instalación, ESLint, Vitest y build de producción.

## Flujo de contribución

1. Crear una rama desde `main` con formato `tipo/descripcion`.
2. Mantener los cambios enfocados en una sola unidad revisable.
3. Usar Conventional Commits; no agregar atribución de IA.
4. Ejecutar las verificaciones correspondientes antes de abrir el PR.
5. Enlazar un issue aprobado y usar exactamente una etiqueta `type:*`.

## Roadmap

La siguiente entrega planificada es **Habit Tracker**, dividida en tres cortes:

1. Persistencia, fechas de negocio y restricciones.
2. API, registros diarios y estadísticas.
3. UI responsive y accesible.

La optimización del chunk grande del frontend se mantiene como tarea de rendimiento independiente.
