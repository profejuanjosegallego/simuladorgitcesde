# Plataforma Consultor Tech · Practica Git

Simulador web para practicar Git, GitHub y GitFlow, inspirado en [Learn Git Branching](https://learngitbranching.js.org/?locale=es_ES). Hace parte de la estrategia Consultor Tech de CESDE.

- 16 retos en 4 módulos, paralelos a las presentaciones de `../materiales`.
- La terminal simulada dibuja el repositorio local y los remotos (GitHub) en vivo.
- Los objetivos de cada reto se validan solos, con pistas, vista del objetivo y solución de referencia.
- Incluye 4 cuestionarios, modo libre, guía rápida y una constancia de práctica imprimible.
- El progreso se guarda solo en el navegador (localStorage). No hay backend ni cuentas.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # verifica que la solución de cada reto cumpla todos sus objetivos
npm run build    # genera dist/
```

## Despliegue en Vercel

Opción A, desde GitHub:

1. Sube la carpeta `plataforma/` a un repositorio de GitHub (puede ser la raíz del repositorio o una subcarpeta).
2. En [vercel.com/new](https://vercel.com/new) importa el repositorio. Si la plataforma está en una subcarpeta, indica `plataforma` en **Root Directory**.
3. Vercel detecta Vite: build `npm run build`, salida `dist` (ya están configurados en `vercel.json`).

Opción B, con la CLI:

```bash
npm i -g vercel
vercel          # primera vez: crea el proyecto
vercel --prod   # publica
```

Las presentaciones no enlazan a la plataforma: comparte la URL de Vercel por aparte (por ejemplo, en el canal del curso).

## Estructura

```
src/engine/git.js     simulador de Git (commits, ramas, remotos, merge de 3 vías, conflictos, rebase…)
src/levels.js         definición de los 16 retos: estado inicial, objetivos, pistas y solución
src/quizzes.js        cuestionarios por módulo
src/components/       grafo SVG, terminal y panel de archivos
src/pages/            inicio, reto, cuestionario, progreso y guía
tests/                pruebas de los retos y de render
```

Para agregar un reto, añade un objeto a `LEVELS` en `src/levels.js` y ejecuta `npm test`.
