// Niveles de práctica. Cada nivel define: setup (estado inicial), tasks (verificaciones en vivo),
// hints (pistas progresivas) y solution (solución de referencia; también dibuja el "objetivo").
import { ancestors, isAncestor, headCommit, CONVENTIONAL, VAGUE, fileStatus } from "./engine/git.js";

const L = (st) => st.local;
const tip = (st, b) => st.local?.branches[b];
const onBranch = (st, b) => st.local?.HEAD.type === "branch" && st.local.HEAD.name === b;
const used = (st, re) => st.log.some((l) => !l.startsWith("✗") && re.test(l));
const clean = (st) => !!st.local && fileStatus(st, st.local).every((f) => f.state === "clean");
const only = (st, b, base) => [...ancestors(st, tip(st, b))].filter((c) => !ancestors(st, base).has(c));
const descriptive = (m) => m && m.trim().length >= 10 && !VAGUE.test(m.trim());
const PREFIX = /^(feat|fix|docs|style|refactor|perf|test|chore|build|ci)\/[\w\-.]+$/;
const otherBranches = (st, ...not) => Object.keys(st.local?.branches || {}).filter((b) => !not.includes(b));
const isMerge = (st, id) => (st.commits[id]?.parents.length || 0) > 1;
const typeOf = (m) => (m.match(CONVENTIONAL) || [])[1];

const linear = (ids) => ids.map((id, i) => ({ id, parents: i ? [ids[i - 1]] : [] }));

export const MODULES = [
	{ n: 1, title: "Git desde cero", sub: "Repositorio, staging, commits e historial", color: "#D1007A" },
	{ n: 2, title: "GitHub y colaboración", sub: "clone, push, pull, fork y pull requests", color: "#2B0B3A" },
	{ n: 3, title: "Ramas y buenos commits", sub: "Ramas, merge, conflictos y Conventional Commits", color: "#0F8C74" },
	{ n: 4, title: "GitFlow y avanzado", sub: "feature, release, hotfix, rebase, cherry-pick y revert", color: "#9E005C" },
];

export const LEVELS = [
	// ---------------- Módulo 1 ----------------
	{
		id: "1-1", module: 1, title: "Tu primer commit",
		intro: [
			"Tienes una carpeta con dos archivos: `index.html` y `estilos.css`. Todavía no es un repositorio.",
			"Conviértela en repositorio, revisa el estado, prepara los archivos con `git add` y guárdalos en un commit con un mensaje claro.",
			"En este nivel el área de preparación (staging) es obligatoria, como en Git real.",
		],
		setup: { strict: true, files: { "index.html": "index@v1", "estilos.css": "css@v1" } },
		tasks: [
			{ text: "Inicializa el repositorio con `git init`", check: (st) => !!L(st) },
			{ text: "Revisa el estado con `git status`", check: (st) => used(st, /^git status/) },
			{ text: "Confirma ambos archivos en un commit", check: (st) => { const h = L(st) && headCommit(st, L(st)); return !!h && ["index.html", "estilos.css"].every((f) => st.commits[h].snapshot[f]); } },
			{ text: "Usa un mensaje descriptivo (no “cambios” ni “update”)", check: (st) => { const h = L(st) && headCommit(st, L(st)); return !!h && descriptive(st.commits[h].msg); } },
			{ text: "Deja el directorio limpio (nothing to commit)", check: (st) => clean(st) && !!headCommit(st, L(st)) },
		],
		hints: ["Empieza con `git init`.", "`git status` te muestra los archivos sin seguimiento (untracked).", "Puedes agregar varios archivos: `git add index.html estilos.css` o todos con `git add .`", 'Luego: `git commit -m "feat: agrega página de inicio y estilos"`'],
		solution: ["git init", "git status", "git add index.html estilos.css", 'git commit -m "feat: agrega página de inicio y estilos"'],
	},
	{
		id: "1-2", module: 1, title: "Construye historia",
		intro: [
			"Tu repositorio ya tiene un commit inicial. Ahora trabaja como en un día normal: modifica archivos, prepáralos y confírmalos.",
			"Usa `editar <archivo>` para simular que cambias un archivo y `touch <archivo>` para crear uno nuevo.",
		],
		setup: { strict: true, commits: [{ id: "C0", msg: "feat: estructura inicial", files: { "index.html": "i0", "estilos.css": "s0" } }], local: { branches: { main: "C0" }, head: "main" } },
		tasks: [
			{ text: "Haz al menos 3 commits nuevos en `main`", check: (st) => !!L(st) && ancestors(st, tip(st, "main")).size >= 4 },
			{ text: "Todos los commits nuevos tienen mensajes descriptivos", check: (st) => { const ids = only(st, "main", "C0"); return ids.length >= 3 && ids.every((id) => descriptive(st.commits[id].msg)); } },
			{ text: "Consulta el historial con `git log`", check: (st) => used(st, /^git log/) },
			{ text: "Deja el directorio limpio", check: (st) => clean(st) },
		],
		hints: ["Ciclo: `editar index.html` → `git add index.html` → `git commit -m \"...\"`.", "`git status` en cualquier momento te dice qué falta.", "`git log --oneline` muestra el historial compacto."],
		solution: ["editar index.html", "git add .", 'git commit -m "feat: agrega encabezado con el logo"', "editar estilos.css", "git add estilos.css", 'git commit -m "style: define colores de la marca"', "touch contacto.html", "git add contacto.html", 'git commit -m "feat: crea página de contacto"', "git log --oneline"],
	},
	{
		id: "1-3", module: 1, title: "Viaje en el tiempo",
		intro: [
			"Quieres ver cómo estaba el proyecto en el commit `C1`, antes de los últimos cambios.",
			"Mueve HEAD a ese commit en modo desacoplado (detached), y luego regresa a la rama `main` sin cambiar la historia.",
		],
		setup: { commits: [...linear(["C0", "C1", "C2", "C3"]).map((c, i) => ({ ...c, msg: ["feat: estructura inicial", "feat: agrega menú", "style: nuevos colores", "feat: agrega pie de página"][i] }))], local: { branches: { main: "C3" }, head: "main" } },
		tasks: [
			{ text: "Mira el historial con `git log`", check: (st) => used(st, /^git log/) },
			{ text: "Mueve HEAD al commit `C1`", check: (st) => (st.detachedAt || []).includes("C1") },
			{ text: "Regresa a la rama `main`", check: (st) => (st.detachedAt || []).includes("C1") && onBranch(st, "main") },
			{ text: "La historia no cambió: `main` sigue en C3", check: (st) => tip(st, "main") === "C3" },
		],
		hints: ["`git switch --detach C1` (o `git checkout C1`).", "Observa cómo HEAD se separa de main en el dibujo.", "Para volver: `git switch main`."],
		solution: ["git log --oneline", "git switch --detach C1", "git switch main"],
	},

	// ---------------- Módulo 2 ----------------
	{
		id: "2-1", module: 2, title: "Clona y empuja", remote: true,
		intro: [
			"El equipo tiene el proyecto en GitHub: `https://github.com/cesde/inventario.git`. Aún no está en tu computador.",
			"Clónalo, haz dos commits y súbelos con `git push`. A la derecha verás el repositorio remoto.",
		],
		setup: { commits: linear(["C0", "C1"]).map((c, i) => ({ ...c, msg: ["feat: estructura inicial", "feat: agrega listado"][i] })), servers: { origin: { branches: { main: "C1" }, head: "main", url: "https://github.com/cesde/inventario.git" } } },
		tasks: [
			{ text: "Clona el repositorio con `git clone`", check: (st) => !!L(st) },
			{ text: "Haz al menos 2 commits nuevos en `main`", check: (st) => !!L(st) && only(st, "main", "C1").length >= 2 },
			{ text: "Sube tus commits: `origin/main` en GitHub tiene tu trabajo", check: (st) => !!L(st) && only(st, "main", "C1").length >= 2 && st.servers.origin.branches.main === tip(st, "main") },
		],
		hints: ["`git clone https://github.com/cesde/inventario.git`", 'Dos commits: `git commit -m "feat: ..."` (en este nivel no hace falta git add).', "`git push` envía tus commits a origin."],
		solution: ["git clone https://github.com/cesde/inventario.git", 'git commit -m "feat: agrega formulario de equipos"', 'git commit -m "docs: documenta la instalación"', "git push"],
	},
	{
		id: "2-2", module: 2, title: "Trae el trabajo del equipo", remote: true,
		intro: [
			"Mientras trabajabas en tu commit `C4`, una colega subió `C2` y `C3` a GitHub. Tu computador aún no lo sabe.",
			"Descarga los cambios con `git fetch`, intégralos con `git pull` y sube el resultado. Si intentas hacer push primero, GitHub lo rechazará.",
		],
		setup: {
			commits: [{ id: "C0", msg: "feat: estructura inicial" }, { id: "C1", parents: ["C0"], msg: "feat: agrega listado" }, { id: "C2", parents: ["C1"], msg: "feat: agrega filtros (colega)" }, { id: "C3", parents: ["C2"], msg: "fix: corrige paginación (colega)" }, { id: "C4", parents: ["C1"], msg: "feat: exporta a Excel (tú)" }],
			servers: { origin: { branches: { main: "C3" }, head: "main", url: "https://github.com/cesde/inventario.git" } },
			local: { branches: { main: "C4" }, head: "main", remoteRefs: { "origin/main": "C1" }, remotes: { origin: "origin" }, upstream: { main: "origin/main" } },
		},
		tasks: [
			{ text: "Descarga sin integrar con `git fetch`", check: (st) => used(st, /^git fetch/) },
			{ text: "Integra el trabajo de tu colega (C3 está en tu `main`)", check: (st) => isAncestor(st, "C3", tip(st, "main")) },
			{ text: "Tu commit C4 sigue en `main`", check: (st) => isAncestor(st, "C4", tip(st, "main")) },
			{ text: "Sube el resultado a GitHub", check: (st) => isAncestor(st, "C4", st.servers.origin.branches.main) && isAncestor(st, "C3", st.servers.origin.branches.main) },
		],
		hints: ["Prueba `git status` antes y después de `git fetch`: verás que tu rama divergió.", "`git pull` = fetch + merge: crea un commit de merge.", "Después: `git push`."],
		solution: ["git fetch", "git status", "git pull", "git push"],
	},
	{
		id: "2-3", module: 2, title: "Fork y pull request", remote: true,
		intro: [
			"Quieres proponer una mejora al proyecto base del docente (`cesde/proyecto-base`), pero no tienes permiso de escritura.",
			"Haz un fork, clona tu fork, registra el original como `upstream`, trabaja en una rama, súbela a tu fork y abre un pull request.",
		],
		setup: {
			commits: linear(["C0", "C1"]).map((c, i) => ({ ...c, msg: ["feat: estructura inicial", "feat: agrega página principal"][i] })),
			servers: { upstream: { branches: { main: "C1" }, head: "main", url: "https://github.com/cesde/proyecto-base.git" } },
			forkFrom: { forkUrl: "https://github.com/tu-usuario/proyecto-base.git" },
		},
		tasks: [
			{ text: "Haz fork con `gh repo fork`", check: (st) => st.forked },
			{ text: "Clona tu fork (no el original)", check: (st) => !!L(st) && L(st).remotes.origin === "origin" },
			{ text: "Registra el original como remoto `upstream`", check: (st) => L(st)?.remotes.upstream === "upstream" },
			{ text: "Crea una rama con prefijo (feat/, fix/…) y al menos un commit", check: (st) => otherBranches(st, "main").some((b) => PREFIX.test(b) && only(st, b, "C1").length >= 1) },
			{ text: "Sube la rama a tu fork", check: (st) => Object.keys(st.servers.origin?.branches || {}).some((b) => b !== "main" && st.servers.origin.branches[b] !== "C1") },
			{ text: "Abre un pull request hacia `upstream/main`", check: (st) => st.prs.some((p) => p.target === "upstream" && p.base === "main" && p.head !== "main") },
		],
		hints: ["`gh repo fork` crea tu copia en GitHub.", "`git clone https://github.com/tu-usuario/proyecto-base.git`", "`git remote add upstream https://github.com/cesde/proyecto-base.git`", "`git switch -c feat/contacto`, un commit y `git push -u origin feat/contacto`", "`gh pr create --base main --head feat/contacto`"],
		solution: ["gh repo fork", "git clone https://github.com/tu-usuario/proyecto-base.git", "git remote add upstream https://github.com/cesde/proyecto-base.git", "git switch -c feat/formulario-contacto", 'git commit -m "feat(contacto): agrega formulario"', "git push -u origin feat/formulario-contacto", "gh pr create --base main --head feat/formulario-contacto"],
	},

	// ---------------- Módulo 3 ----------------
	{
		id: "3-1", module: 3, title: "Tu primera rama",
		intro: ["Vas a desarrollar el menú del sitio sin tocar `main`.", "Crea una rama con un nombre que siga la convención (por ejemplo `feat/menu`), haz dos commits en ella y regresa a `main`."],
		setup: { commits: linear(["C0", "C1"]).map((c, i) => ({ ...c, msg: ["feat: estructura inicial", "feat: agrega página principal"][i] })), local: { branches: { main: "C1" }, head: "main" } },
		tasks: [
			{ text: "Crea una rama con prefijo: feat/, fix/, docs/…", check: (st) => otherBranches(st, "main").some((b) => PREFIX.test(b)) },
			{ text: "Haz 2 commits en esa rama", check: (st) => otherBranches(st, "main").some((b) => PREFIX.test(b) && only(st, b, "C1").length >= 2) },
			{ text: "Regresa a `main`", check: (st) => onBranch(st, "main") && otherBranches(st, "main").length > 0 },
			{ text: "`main` no cambió (sigue en C1)", check: (st) => tip(st, "main") === "C1" },
		],
		hints: ["`git switch -c feat/menu` crea la rama y te cambia a ella.", "Dos commits con `git commit -m \"...\"`.", "`git switch main` para volver."],
		solution: ["git switch -c feat/menu", 'git commit -m "feat(menu): agrega menú principal"', 'git commit -m "style(menu): ajusta colores"', "git switch main"],
	},
	{
		id: "3-2", module: 3, title: "Fusiona con merge",
		intro: ["`main` y `feat/menu` avanzaron por separado. Integra el menú en `main` con un merge de tres vías y luego borra la rama, que ya cumplió su propósito."],
		setup: {
			commits: [{ id: "C0" }, { id: "C1", parents: ["C0"], msg: "feat: página principal" }, { id: "C2", parents: ["C1"], msg: "fix: corrige enlace roto" }, { id: "C3", parents: ["C1"], msg: "feat(menu): agrega menú" }, { id: "C4", parents: ["C3"], msg: "style(menu): ajusta colores" }],
			local: { branches: { main: "C2", "feat/menu": "C4" }, head: "main" },
		},
		tasks: [
			{ text: "`main` contiene el trabajo de `feat/menu` (C4)", check: (st) => isAncestor(st, "C4", tip(st, "main")) },
			{ text: "Se creó un commit de merge con dos padres", check: (st) => isMerge(st, tip(st, "main")) },
			{ text: "Borra la rama `feat/menu`", check: (st) => !!L(st) && tip(st, "feat/menu") === undefined && isAncestor(st, "C4", tip(st, "main")) },
		],
		hints: ["Debes estar en `main`: es la rama que recibe los cambios.", "`git merge feat/menu`", "`git branch -d feat/menu`"],
		solution: ["git merge feat/menu", "git branch -d feat/menu"],
	},
	{
		id: "3-3", module: 3, title: "Resuelve el conflicto",
		intro: [
			"En `main` alguien cambió el título de `index.html` a “Bienvenidos a CESDE”, y en `feat/titulo` a “Bienvenidos al Consultor Tech”. Al fusionar habrá un conflicto.",
			"Inicia el merge, decide qué versión queda (botones del panel o `git checkout --ours/--theirs index.html`), marca el archivo como resuelto con `git add` y termina con `git commit`.",
		],
		setup: {
			commits: [{ id: "C0", msg: "feat: estructura inicial", files: { "index.html": "<h1>Inicio</h1>", "estilos.css": "body{}" } }, { id: "C1", parents: ["C0"], msg: "feat: título institucional", files: { "index.html": "<h1>Bienvenidos a CESDE</h1>" } }, { id: "C2", parents: ["C0"], msg: "feat: título del programa", files: { "index.html": "<h1>Bienvenidos al Consultor Tech</h1>" } }],
			local: { branches: { main: "C1", "feat/titulo": "C2" }, head: "main" },
		},
		tasks: [
			{ text: "Inicia el merge de `feat/titulo` en `main`", check: (st) => used(st, /^git merge (?!--abort)/) },
			{ text: "Resuelve el conflicto y marca el archivo con `git add`", check: (st) => !!L(st) && (!L(st).merge ? isMerge(st, tip(st, "main")) : L(st).merge.conflicts.length === 0) },
			{ text: "Completa el merge con `git commit`", check: (st) => isMerge(st, tip(st, "main")) && isAncestor(st, "C2", tip(st, "main")) },
		],
		hints: ["`git merge feat/titulo` → aparecerá CONFLICT.", "`git status` muestra el archivo en conflicto (both modified).", "Usa los botones del panel de archivos o `git checkout --theirs index.html`.", "`git add index.html` y luego `git commit`."],
		solution: ["git merge feat/titulo", "git status", "git checkout --theirs index.html", "git add index.html", 'git commit -m "Merge feat/titulo: título del programa"'],
	},
	{
		id: "3-4", module: 3, title: "Commits convencionales",
		intro: [
			"El equipo adoptó Conventional Commits: `tipo(alcance): descripción`. Tipos: feat, fix, docs, style, refactor, test, perf, build, ci, chore.",
			"Crea una rama con prefijo, haz 3 commits con el formato correcto (al menos 2 tipos distintos) e intégrala en `main` con `git merge --no-ff`. El simulador te dará retroalimentación en cada commit.",
		],
		setup: { conventional: true, commits: [{ id: "C0", msg: "chore: estructura inicial" }], local: { branches: { main: "C0" }, head: "main" } },
		tasks: [
			{ text: "Crea una rama con prefijo (feat/, fix/, docs/…)", check: (st) => used(st, /(switch -c|checkout -b|branch) (feat|fix|docs|style|refactor|perf|test|chore|build|ci)\//) },
			{ text: "3 commits con formato Conventional Commits", check: (st) => { const ids = [...ancestors(st, tip(st, "main"))].filter((id) => id !== "C0" && !isMerge(st, id)); return ids.filter((id) => CONVENTIONAL.test(st.commits[id].msg)).length >= 3 || otherBranches(st, "main").some((b) => only(st, b, "C0").filter((id) => CONVENTIONAL.test(st.commits[id].msg)).length >= 3); } },
			{ text: "Usa al menos 2 tipos distintos", check: (st) => { const ids = [...reachAll(st)].filter((id) => id !== "C0"); return new Set(ids.map((id) => typeOf(st.commits[id].msg)).filter(Boolean)).size >= 2; } },
			{ text: "Intégrala en `main` con `git merge --no-ff`", check: (st) => isMerge(st, tip(st, "main")) },
		],
		hints: ["`git switch -c feat/perfil`", 'Ejemplos: `git commit -m "feat(perfil): agrega foto de usuario"`, `"test(perfil): valida formato de imagen"`, `"docs(perfil): describe la API"`', "`git switch main` y `git merge --no-ff feat/perfil`"],
		solution: ["git switch -c feat/perfil", 'git commit -m "feat(perfil): agrega foto de usuario"', 'git commit -m "test(perfil): valida formato de imagen"', 'git commit -m "docs(perfil): describe la API de perfil"', "git switch main", "git merge --no-ff feat/perfil"],
	},

	// ---------------- Módulo 4 ----------------
	{
		id: "4-1", module: 4, title: "Feature completa", gitflow: true,
		intro: ["Aplica el flujo feature de GitFlow: crea `feature/login` desde `develop`, haz commits, intégrala en `develop` con `--no-ff` y borra la rama. `main` no se toca."],
		setup: { commits: [{ id: "C0", msg: "chore: versión inicial" }, { id: "C1", parents: ["C0"], msg: "chore: crea develop" }], local: { branches: { main: "C0", develop: "C1" }, head: "develop" } },
		tasks: [
			{ text: "Crea una rama `feature/…` desde `develop`", check: (st) => used(st, /(switch -c|checkout -b|branch) feature\/[\w\-.]+/) },
			{ text: "Haz al menos un commit en la feature", check: (st) => [...ancestors(st, tip(st, "develop")), ...otherBranches(st, "main", "develop").flatMap((b) => [...ancestors(st, tip(st, b))])].some((id) => !["C0", "C1"].includes(id) && !isMerge(st, id)) },
			{ text: "Intégrala en `develop` con `--no-ff` (commit de merge)", check: (st) => isMerge(st, tip(st, "develop")) },
			{ text: "Borra la rama feature", check: (st) => isMerge(st, tip(st, "develop")) && !otherBranches(st, "main", "develop").some((b) => b.startsWith("feature/")) },
			{ text: "`main` sigue intacta", check: (st) => tip(st, "main") === "C0" },
		],
		hints: ["`git switch -c feature/login develop`", "Commits convencionales: `feat(login): ...`", "`git switch develop` y `git merge --no-ff feature/login`", "`git branch -d feature/login`"],
		solution: ["git switch -c feature/login develop", 'git commit -m "feat(login): agrega formulario"', 'git commit -m "test(login): valida campos"', "git switch develop", "git merge --no-ff feature/login", "git branch -d feature/login"],
	},
	{
		id: "4-2", module: 4, title: "Publica una release", gitflow: true,
		intro: ["`develop` tiene tres funciones listas. Publica la versión `1.0.0`: crea `release/1.0.0` desde `develop`, haz un commit de preparación, intégrala en `main` con tag `v1.0.0`, llévala de vuelta a `develop` y borra la rama."],
		setup: { commits: [{ id: "C0", msg: "chore: versión inicial" }, { id: "C1", parents: ["C0"], msg: "feat: catálogo" }, { id: "C2", parents: ["C1"], msg: "feat: carrito" }, { id: "C3", parents: ["C2"], msg: "feat: pagos" }], local: { branches: { main: "C0", develop: "C3" }, head: "develop" } },
		tasks: [
			{ text: "Crea `release/x.y.z` desde `develop`", check: (st) => used(st, /(switch -c|checkout -b|branch) release\/\d+\.\d+\.\d+/) },
			{ text: "Haz un commit de preparación en la release", check: (st) => [...reachAll(st)].some((id) => !["C0", "C1", "C2", "C3"].includes(id) && !isMerge(st, id) && isAncestor(st, "C3", id)) },
			{ text: "Integra la release en `main` (commit de merge)", check: (st) => isMerge(st, tip(st, "main")) && isAncestor(st, "C3", tip(st, "main")) },
			{ text: "Marca `main` con un tag `vX.Y.Z`", check: (st) => Object.entries(L(st)?.tags || {}).some(([t, id]) => /^v\d+\.\d+\.\d+$/.test(t) && id === tip(st, "main") && id !== "C0") },
			{ text: "Lleva la release de vuelta a `develop`", check: (st) => isMerge(st, tip(st, "main")) && isAncestor(st, st.commits[tip(st, "main")].parents[1], tip(st, "develop")) },
			{ text: "Borra la rama release", check: (st) => isMerge(st, tip(st, "main")) && !otherBranches(st, "main", "develop").some((b) => b.startsWith("release/")) },
		],
		hints: ["`git switch -c release/1.0.0 develop`", '`git commit -m "chore(release): 1.0.0"`', "`git switch main`, `git merge --no-ff release/1.0.0`, `git tag v1.0.0`", "`git switch develop`, `git merge --no-ff release/1.0.0`, `git branch -d release/1.0.0`"],
		solution: ["git switch -c release/1.0.0 develop", 'git commit -m "chore(release): 1.0.0"', "git switch main", "git merge --no-ff release/1.0.0", "git tag v1.0.0", "git switch develop", "git merge --no-ff release/1.0.0", "git branch -d release/1.0.0"],
	},
	{
		id: "4-3", module: 4, title: "Apaga el incendio", gitflow: true,
		intro: ["En producción (`v1.0.0`) hay un error en los pagos. `develop` tiene funciones a medias (C2, C3) que NO pueden salir todavía.", "Crea `hotfix/1.0.1` desde `main`, corrige, publica con tag `v1.0.1` y lleva la corrección también a `develop`."],
		setup: { commits: [{ id: "C0", msg: "chore: versión inicial" }, { id: "C1", parents: ["C0"], msg: "Merge release/1.0.0" }, { id: "C2", parents: ["C1"], msg: "feat: reportes (a medias)" }, { id: "C3", parents: ["C2"], msg: "feat: gráficas (a medias)" }], local: { branches: { main: "C1", develop: "C3" }, tags: { "v1.0.0": "C1" }, head: "main" } },
		tasks: [
			{ text: "Crea `hotfix/…` desde `main`", check: (st) => used(st, /(switch -c|checkout -b|branch) hotfix\/[\w\-.]+/) },
			{ text: "Integra la corrección en `main` (commit de merge)", check: (st) => isMerge(st, tip(st, "main")) },
			{ text: "Marca `main` con el tag `v1.0.1`", check: (st) => L(st)?.tags["v1.0.1"] === tip(st, "main") && tip(st, "main") !== "C1" },
			{ text: "Lleva la corrección a `develop`", check: (st) => isMerge(st, tip(st, "main")) && isAncestor(st, st.commits[tip(st, "main")].parents[1], tip(st, "develop")) },
			{ text: "Las funciones a medias (C2, C3) NO llegaron a `main`", check: (st) => !!L(st) && !isAncestor(st, "C2", tip(st, "main")) },
			{ text: "Borra la rama hotfix", check: (st) => isMerge(st, tip(st, "main")) && !otherBranches(st, "main", "develop").some((b) => b.startsWith("hotfix/")) },
		],
		hints: ["El hotfix sale de main: `git switch -c hotfix/1.0.1 main`", '`git commit -m "fix(pago): corrige redondeo"`', "`git switch main`, `git merge --no-ff hotfix/1.0.1`, `git tag v1.0.1`", "`git switch develop`, `git merge --no-ff hotfix/1.0.1`, `git branch -d hotfix/1.0.1`"],
		solution: ["git switch -c hotfix/1.0.1 main", 'git commit -m "fix(pago): corrige redondeo"', "git switch main", "git merge --no-ff hotfix/1.0.1", "git tag v1.0.1", "git switch develop", "git merge --no-ff hotfix/1.0.1", "git branch -d hotfix/1.0.1"],
	},
	{
		id: "4-4", module: 4, title: "Rebase limpio",
		intro: ["Tu rama `feature/reportes` salió de C1, pero `main` ya avanzó a C2. Antes de integrar, actualiza tu rama con `git rebase main` para que la historia quede lineal. Luego avanza `main` con un fast-forward."],
		setup: { commits: [{ id: "C0" }, { id: "C1", parents: ["C0"], msg: "feat: base de datos" }, { id: "C2", parents: ["C1"], msg: "fix: conexión segura" }, { id: "C3", parents: ["C1"], msg: "feat(reportes): consulta mensual" }, { id: "C4", parents: ["C3"], msg: "feat(reportes): exporta PDF" }], local: { branches: { main: "C2", "feature/reportes": "C4" }, head: "feature/reportes" } },
		tasks: [
			{ text: "`feature/reportes` parte ahora de C2 (rebase)", check: (st) => !!tip(st, "feature/reportes") && isAncestor(st, "C2", tip(st, "feature/reportes")) || (tip(st, "feature/reportes") === undefined && st.commits[tip(st, "main")]?.id.includes("'")) },
			{ text: "Sin commits de merge: historia lineal", check: (st) => { const t = tip(st, "feature/reportes") || tip(st, "main"); return !!t && [...ancestors(st, t)].every((id) => !isMerge(st, id)) && [...ancestors(st, t)].some((id) => id.startsWith("C4'")); } },
			{ text: "`main` avanzó con fast-forward hasta la feature", check: (st) => [...ancestors(st, tip(st, "main"))].some((id) => id.startsWith("C4'")) && !isMerge(st, tip(st, "main")) },
		],
		hints: ["Estás en `feature/reportes`: `git rebase main`.", "Observa: C3 y C4 se copian como C3' y C4'.", "`git switch main` y `git merge feature/reportes` (será fast-forward)."],
		solution: ["git rebase main", "git switch main", "git merge feature/reportes"],
	},
	{
		id: "4-5", module: 4, title: "Cherry-pick",
		intro: ["En `develop` hay una corrección urgente (C2) mezclada con funciones a medias (C3, C4). Lleva a `main` solo la corrección con `git cherry-pick`, sin hacer merge de develop."],
		setup: { commits: [{ id: "C0" }, { id: "C1", parents: ["C0"], msg: "chore: versión 1.0" }, { id: "C2", parents: ["C1"], msg: "fix(login): bloquea contraseña vacía" }, { id: "C3", parents: ["C2"], msg: "feat: chat (a medias)" }, { id: "C4", parents: ["C3"], msg: "feat: notificaciones (a medias)" }], local: { branches: { main: "C1", develop: "C4" }, head: "main" } },
		tasks: [
			{ text: "`main` tiene una copia de la corrección C2", check: (st) => [...ancestors(st, tip(st, "main"))].some((id) => st.commits[id].cherryOf === "C2") },
			{ text: "C3 y C4 no llegaron a `main`", check: (st) => !!L(st) && [...ancestors(st, tip(st, "main"))].every((id) => !["C3", "C4"].includes(id) && !["C3", "C4"].includes(st.commits[id].cherryOf)) },
			{ text: "Sin commits de merge en `main`", check: (st) => !!L(st) && [...ancestors(st, tip(st, "main"))].every((id) => !isMerge(st, id)) && tip(st, "main") !== "C1" },
		],
		hints: ["Mira `git log --oneline develop` para identificar el commit.", "Estando en `main`: `git cherry-pick C2`."],
		solution: ["git log --oneline develop", "git cherry-pick C2"],
	},
	{
		id: "4-6", module: 4, title: "Deshacer con criterio", remote: true,
		intro: [
			"El commit C2 introdujo un error y ya está en GitHub (tus compañeros lo descargaron). Además, tienes un commit local C3 de pruebas que nunca subiste.",
			"Elimina C3 con `reset` (solo existe en tu computador), deshaz C2 con `revert` (está publicado) y sube el resultado sin forzar.",
		],
		setup: {
			commits: [{ id: "C0" }, { id: "C1", parents: ["C0"], msg: "feat: cálculo de IVA" }, { id: "C2", parents: ["C1"], msg: "feat: cambia redondeo (con error)" }, { id: "C3", parents: ["C2"], msg: "wip: pruebas locales" }],
			servers: { origin: { branches: { main: "C2" }, head: "main", url: "https://github.com/cesde/facturacion.git" } },
			local: { branches: { main: "C3" }, head: "main", remoteRefs: { "origin/main": "C2" }, remotes: { origin: "origin" }, upstream: { main: "origin/main" } },
		},
		tasks: [
			{ text: "Descarta el commit local C3 con `git reset`", check: (st) => !!L(st) && !isAncestor(st, "C3", tip(st, "main")) },
			{ text: "Deshaz C2 con `git revert` (sin borrarlo de la historia)", check: (st) => !!L(st) && isAncestor(st, "C2", tip(st, "main")) && [...ancestors(st, tip(st, "main"))].some((id) => st.commits[id].revertOf === "C2") },
			{ text: "Sube el resultado sin `--force`", check: (st) => !st.forcePushed && !!L(st) && st.servers.origin.branches.main === tip(st, "main") && [...ancestors(st, tip(st, "main"))].some((id) => st.commits[id].revertOf === "C2") },
		],
		hints: ["C3 no está publicado: `git reset --hard HEAD~1`.", "C2 sí está publicado: `git revert C2`.", "`git push` (sin --force)."],
		solution: ["git reset --hard HEAD~1", "git revert C2", "git push"],
	},
];

function reachAll(st) {
	const s = new Set();
	if (!st.local) return s;
	for (const id of Object.values(st.local.branches)) for (const a of ancestors(st, id)) s.add(a);
	return s;
}

export const SANDBOX = {
	id: "libre", module: 0, title: "Modo libre", remote: true,
	intro: ["Experimenta sin objetivos: tienes un repositorio local con `main` y un remoto `origin`. Prueba cualquier comando; puedes deshacer o reiniciar cuando quieras."],
	setup: { commits: linear(["C0", "C1"]).map((c, i) => ({ ...c, msg: ["feat: estructura inicial", "feat: página principal"][i] })), servers: { origin: { branches: { main: "C1" }, head: "main", url: "https://github.com/cesde/sandbox.git" } }, local: { branches: { main: "C1" }, head: "main", remoteRefs: { "origin/main": "C1" }, remotes: { origin: "origin" }, upstream: { main: "origin/main" } } },
	tasks: [],
	hints: ["Escribe `ayuda` para ver todos los comandos."],
	solution: [],
};

export const levelById = (id) => (id === "libre" ? SANDBOX : LEVELS.find((l) => l.id === id));
export const nextLevel = (id) => LEVELS[LEVELS.findIndex((l) => l.id === id) + 1] || null;
