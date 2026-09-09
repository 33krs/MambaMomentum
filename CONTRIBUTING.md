# Contribuir a MambaMomentum

Gracias por ayudar a mejorar MambaMomentum. Mantén cada cambio enfocado, comprobable y seguro de revisar.

## Flujo de trabajo

1. Crea una rama desde la rama actual `main`.
2. Usa un prefijo de rama que describa el trabajo:
   - `feat/` para funcionalidades de producto
   - `fix/` para correcciones de defectos
   - `docs/` para cambios exclusivos de documentación
   - `chore/` para tareas de mantenimiento
3. Implementa una unidad de trabajo coherente a la vez, incluidas sus pruebas y la documentación pertinente.
4. Ejecuta los controles locales aplicables antes de abrir un pull request.
5. Abre un pull request enfocado que explique el resultado y cómo se verificó.

## Commits

Usa [Conventional Commits](https://www.conventionalcommits.org/) y describe el resultado en lugar de los archivos modificados.

```text
feat(workouts): add private custom exercises
fix(focus): reject invalid partial time updates
docs(contributing): document the review workflow
```

Mantén las pruebas junto con el comportamiento que verifican. No dividas una misma unidad de trabajo en commits separados de implementación y pruebas.

## Pull requests

- Mantén el alcance lo suficientemente acotado como para revisarlo con confianza.
- Explica qué cambió, por qué cambió y qué queda intencionalmente fuera de alcance.
- Incluye los comandos de verificación exactos y sus resultados.
- Vincula los issues relacionados cuando corresponda.
- Actualiza la documentación dirigida a las personas usuarias junto con el comportamiento que describe.
- Responde a los comentarios de revisión con commits adicionales y enfocados, en lugar de incluir limpieza no relacionada.

## Seguridad y secretos

Nunca incluyas en un commit credenciales, tokens, claves privadas, datos personales, archivos `.env`, volcados de bases de datos ni notas privadas para mantenedores. Usa `.env.example` únicamente para nombres de variables documentados y valores de marcador de posición seguros.

Si un secreto se incluye en un commit por accidente, revócalo o rótalo de inmediato; eliminarlo en un commit posterior no lo quita del historial de Git.
