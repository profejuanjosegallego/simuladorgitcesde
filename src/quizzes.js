// Cuestionarios de verificación, uno por módulo (paralelos a las presentaciones).
export const QUIZZES = {
	1: [
		{ q: "¿Qué comando convierte una carpeta en un repositorio de Git?", o: ["git start", "git init", "git create", "git new"], a: 1, e: "git init crea la carpeta oculta .git donde se guarda todo el historial." },
		{ q: "¿Qué hace git add?", o: ["Sube los cambios a GitHub", "Crea un commit", "Lleva cambios al área de preparación (staging)", "Agrega un colaborador"], a: 2, e: "git add elige qué cambios entrarán en el próximo commit." },
		{ q: "¿Cuál es la diferencia entre Git y GitHub?", o: ["Son lo mismo", "Git es la herramienta local; GitHub es una plataforma para alojar repositorios y colaborar", "GitHub es la versión gratuita de Git", "Git solo funciona en Linux"], a: 1, e: "Git funciona sin internet en tu computador; GitHub agrega colaboración en la nube." },
		{ q: "git status dice “Untracked files: notas.txt”. ¿Qué significa?", o: ["El archivo está en el último commit", "Git aún no le hace seguimiento al archivo", "El archivo tiene un conflicto", "El archivo fue eliminado"], a: 1, e: "Un archivo untracked es nuevo para Git: debes agregarlo con git add para versionarlo." },
		{ q: "¿Qué debería ir en el archivo .gitignore?", o: ["El README", "Los archivos .env con contraseñas y carpetas como node_modules", "Todo el código fuente", "Los commits antiguos"], a: 1, e: "Secretos, dependencias y archivos generados no se versionan." },
		{ q: "Modificaste un archivo y quieres descartar esos cambios (aún sin git add). ¿Qué usas?", o: ["git restore archivo", "git push archivo", "git commit archivo", "git init archivo"], a: 0, e: "git restore devuelve el archivo a su versión del último commit." },
	],
	2: [
		{ q: "¿Qué hace git clone?", o: ["Crea una rama", "Copia un repositorio remoto completo a tu computador", "Sube tus cambios", "Duplica un commit"], a: 1, e: "git clone descarga el repositorio con todo su historial y configura el remoto origin." },
		{ q: "¿Cuál es la diferencia entre git fetch y git pull?", o: ["Ninguna", "fetch descarga sin integrar; pull descarga e integra en tu rama", "pull solo funciona con SSH", "fetch borra tus cambios"], a: 1, e: "git pull = git fetch + git merge (o rebase)." },
		{ q: "GitHub rechaza tu push con “non-fast-forward”. ¿Qué haces?", o: ["git push --force sin pensarlo", "git pull para integrar lo nuevo y luego git push", "Borrar el repositorio", "Crear otra cuenta"], a: 1, e: "El remoto tiene commits que no tienes; intégralos primero." },
		{ q: "Quieres contribuir a un repositorio donde no tienes permiso de escritura. ¿Qué haces?", o: ["Fork, trabajar en tu copia y abrir un pull request", "Pedir la contraseña del dueño", "Hacer push a main", "Descargar el ZIP"], a: 0, e: "El fork te da una copia propia; el PR propone los cambios al original." },
		{ q: "En una organización, ¿qué rol es adecuado para estudiantes en el repositorio de su equipo?", o: ["Admin", "Write", "Read", "Owner de la organización"], a: 1, e: "Write permite crear ramas, hacer push y fusionar PR; Admin es excesivo." },
		{ q: "¿Qué escribes en la descripción de un PR para cerrar automáticamente el issue #12 al fusionarlo?", o: ["Issue 12 listo", "Closes #12", "@12", "#cerrar 12"], a: 1, e: "Palabras clave como Closes, Fixes o Resolves seguidas de #número cierran el issue." },
	],
	3: [
		{ q: "¿Qué es una rama en Git?", o: ["Una copia completa de la carpeta", "Un puntero móvil a un commit", "Un servidor remoto", "Un archivo de configuración"], a: 1, e: "Crear una rama es instantáneo: solo es una etiqueta que apunta a un commit." },
		{ q: "¿Cuál es el mejor nombre de rama?", o: ["rama-nueva", "Juan", "feat/carrito-compras", "prueba2"], a: 2, e: "prefijo/descripción-corta comunica el propósito de la rama." },
		{ q: "¿Cuándo ocurre un merge fast-forward?", o: ["Cuando hay conflictos", "Cuando la rama destino no avanzó desde que se creó la otra rama", "Siempre que usas --no-ff", "Cuando borras una rama"], a: 1, e: "Git solo mueve la etiqueta hacia adelante; no crea commit de merge." },
		{ q: "Después de resolver un conflicto en index.html, ¿qué sigue?", o: ["git push --force", "git add index.html y luego git commit", "git init", "git branch -D main"], a: 1, e: "git add marca el conflicto como resuelto; git commit completa el merge." },
		{ q: "¿Qué mensaje sigue Conventional Commits?", o: ["Arreglé el login", "fix(login): bloquea contraseña vacía", "update", "FIX!!!"], a: 1, e: "tipo(alcance): descripción en imperativo." },
		{ q: "¿Qué NO debe hacerse en un buen commit?", o: ["Un cambio lógico por commit", "Explicar el porqué en el cuerpo", "Mezclar estilos, arreglos y funciones en un solo commit", "Referenciar el issue"], a: 2, e: "Los commits atómicos son fáciles de revisar y de revertir." },
	],
	4: [
		{ q: "En GitFlow, ¿de qué rama sale una feature?", o: ["main", "develop", "release", "hotfix"], a: 1, e: "Las features nacen en develop y regresan a develop." },
		{ q: "En GitFlow, ¿de qué rama sale un hotfix?", o: ["develop", "feature", "main", "cualquiera"], a: 2, e: "main contiene exactamente lo que está en producción." },
		{ q: "Al terminar una release, ¿en qué ramas se integra?", o: ["Solo main", "Solo develop", "main (con tag) y develop", "En ninguna"], a: 2, e: "main publica la versión y develop recibe los ajustes de la release." },
		{ q: "Un commit con error ya está en GitHub y tu equipo lo descargó. ¿Cómo lo deshaces?", o: ["git reset --hard y push --force", "git revert <hash> y git push", "git commit --amend", "Borrar el repositorio"], a: 1, e: "revert no reescribe la historia compartida." },
		{ q: "¿Qué hace git rebase main estando en tu rama feature?", o: ["Borra main", "Copia tus commits para que partan del último commit de main", "Fusiona con un commit de merge", "Sube la rama a GitHub"], a: 1, e: "El historial queda lineal; los commits copiados tienen nuevos hashes." },
		{ q: "Según la versión semántica, pasar de v2.4.1 a v2.5.0 indica…", o: ["Un cambio que rompe compatibilidad", "Una nueva funcionalidad compatible", "Una corrección de error", "Nada en particular"], a: 1, e: "MAYOR.MENOR.PARCHE: subir MENOR = funcionalidad nueva compatible." },
	],
};
