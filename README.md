# MambaMomentum

Aplicación full-stack para el registro y análisis de métricas de **productividad** (bloques de concentración / trabajo profundo) y **actividad física** (entrenamientos de fuerza con series, repeticiones y peso).

## Arquitectura

| Capa       | Tecnología                                              |
|------------|----------------------------------------------------------|
| Backend    | FastAPI (Python 3.12), SQLAlchemy 2.0, Alembic, JWT (python-jose + passlib) |
| Base de datos | PostgreSQL 16                                          |
| Frontend   | React 18 + TypeScript + Vite, TailwindCSS, Recharts, React Router |
| Contenedores | Docker / Docker Compose (servicios independientes: `db`, `backend`, `frontend`) |


```
MambaMomentum/
├── backend/            API REST (FastAPI)
│   ├── app/
│   │   ├── api/v1/     Endpoints (auth, focus-sessions, workouts, analytics)
│   │   ├── core/       Configuración y seguridad (JWT, hashing)
│   │   ├── crud/       Acceso a datos
│   │   ├── db/         Sesión y base declarativa de SQLAlchemy
│   │   ├── models/     Modelos ORM
│   │   └── schemas/    Esquemas Pydantic
│   ├── alembic/        Migraciones de base de datos
│   ├── tests/          Suite de pytest (contra PostgreSQL real)
│   └── Dockerfile
├── frontend/           SPA (React + Vite)
│   ├── src/
│   │   ├── api/        Cliente Axios por dominio
│   │   ├── components/ Layout, gráficos, UI reutilizable
│   │   ├── context/    Contexto de autenticación
│   │   └── pages/      Login, Registro, Dashboard, Concentración, Entrenamientos
│   └── Dockerfile      Build multi-stage servido con Nginx
├── docker-compose.yml
└── .github/workflows/  Pipelines de CI (backend y frontend)
```

## Modelo de datos

- **User** — cuenta de usuario con contraseña hasheada (bcrypt).
- **FocusSession** — bloque de concentración: categoría, inicio, fin, duración (calculada), notas.
- **Exercise** — catálogo compartido de ejercicios (nombre, grupo muscular).
- **WorkoutSession** — sesión de entrenamiento (nombre, fecha, notas) compuesta por…
- **WorkoutSet** — estructura paramétrica de una serie: ejercicio, número de serie, repeticiones, peso (kg), RPE.


## Pruebas automatizadas

### Backend (pytest contra PostgreSQL real)

La suite de tests **crea y elimina todas las tablas** en la base de datos configurada, por lo que **nunca debe apuntar a la base de datos de desarrollo**. `conftest.py` rechaza ejecutar si `POSTGRES_DB` no contiene la palabra `test`.

```bash
# Crea una base de datos desechable, p. ej. "mambamomentum_test"
cd backend
POSTGRES_DB=mambamomentum_test pytest --cov=app
```

### Frontend (Vitest + Testing Library)

```bash
cd frontend
npm run test
npm run lint
npm run build     # type-check + build de producción
```


