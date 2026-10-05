// Simulador de Git para la plataforma Consultor Tech.
// Modelo: un almacén global de commits inmutables (C0, C1, …) y varios repositorios
// (el local y los "servidores" remotos) que solo guardan referencias a esos commits.
// Cada commit guarda un snapshot { archivo: contenido } para poder hacer merge de 3 vías.

const clone = (o) => JSON.parse(JSON.stringify(o));

// ---------- Construcción del estado ----------

export function emptyRepo() {
	return {
		branches: {}, tags: {}, HEAD: { type: "branch", name: "main" },
		remoteRefs: {}, remotes: {}, upstream: {},
		wd: {}, index: {}, merge: null, stash: [],
	};
}

// setup: { commits: [{id, parents, msg, files}], local: {...} | null, servers: {origin: {...}}, files, strict }
export function createState(setup = {}) {
	const st = {
		commits: {}, counter: 0, local: null, servers: {}, urls: {}, prs: [], forked: false,
		strict: !!setup.strict, conventional: !!setup.conventional, log: [], visited: [],
	};
	for (const c of setup.commits || []) {
		const parents = c.parents || [];
		const base = parents.length ? st.commits[parents[0]].snapshot : {};
		st.commits[c.id] = { id: c.id, parents, msg: c.msg || defaultMsg(c.id), snapshot: { ...base, ...(c.files || {}) } };
		const n = parseInt(c.id.replace(/\D/g, ""), 10);
		if (!isNaN(n)) st.counter = Math.max(st.counter, n + 1);
	}
	const mkRepo = (def) => {
		const r = emptyRepo();
		Object.assign(r.branches, def.branches || {});
		Object.assign(r.tags, def.tags || {});
		if (def.head) r.HEAD = typeof def.head === "string" ? { type: "branch", name: def.head } : def.head;
		Object.assign(r.remoteRefs, def.remoteRefs || {});
		Object.assign(r.remotes, def.remotes || {});
		Object.assign(r.upstream, def.upstream || {});
		return r;
	};
	for (const [k, def] of Object.entries(setup.servers || {})) {
		st.servers[k] = mkRepo(def);
		st.urls[k] = def.url || `https://github.com/cesde/${k}.git`;
	}
	if (setup.local) {
		st.local = mkRepo(setup.local);
		const head = headCommit(st, st.local);
		const snap = head ? { ...st.commits[head].snapshot } : {};
		st.local.wd = { ...snap, ...(setup.local.wd || {}) };
		st.local.index = { ...snap };
		if (head) st.visited.push(head);
	} else if (setup.files) {
		st.pendingFiles = { ...setup.files }; // archivos de la carpeta antes de git init
	}
	if (setup.forkFrom) st.forkFrom = setup.forkFrom;
	return st;
}

const defaultMsg = (id) => (id === "C0" ? "Commit inicial" : `Commit ${id}`);

// ---------- Utilidades de grafo ----------

export function headCommit(st, repo) {
	if (!repo) return null;
	if (repo.HEAD.type === "detached") return repo.HEAD.id;
	return repo.branches[repo.HEAD.name] || null;
}

export function ancestors(st, id) {
	const seen = new Set();
	const stack = id ? [id] : [];
	while (stack.length) {
		const c = stack.pop();
		if (!c || seen.has(c)) continue;
		seen.add(c);
		for (const p of st.commits[c]?.parents || []) stack.push(p);
	}
	return seen;
}

export const isAncestor = (st, a, b) => ancestors(st, b).has(a); // ¿a es ancestro de b (o igual)?

function mergeBase(st, a, b) {
	const A = ancestors(st, a);
	// BFS desde b: el primer ancestro común encontrado es una buena base.
	const queue = [b];
	const seen = new Set();
	while (queue.length) {
		const c = queue.shift();
		if (seen.has(c)) continue;
		seen.add(c);
		if (A.has(c)) return c;
		queue.push(...(st.commits[c]?.parents || []));
	}
	return null;
}

function newId(st, base) {
	if (base) {
		let id = base + "'";
		while (st.commits[id]) id += "'";
		return id;
	}
	const id = "C" + st.counter;
	st.counter++;
	return id;
}

function addCommit(st, { parents, msg, snapshot, base, extra = {} }) {
	const id = newId(st, base);
	st.commits[id] = { id, parents, msg, snapshot: { ...snapshot }, ...extra };
	return id;
}

// Cambios que introduce un commit respecto a su primer padre.
function diffOf(st, id) {
	const c = st.commits[id];
	const prev = c.parents.length ? st.commits[c.parents[0]].snapshot : {};
	const d = {};
	for (const f of new Set([...Object.keys(prev), ...Object.keys(c.snapshot)])) {
		if (prev[f] !== c.snapshot[f]) d[f] = c.snapshot[f] === undefined ? null : c.snapshot[f];
	}
	return d;
}

function applyDiff(snapshot, d) {
	const out = { ...snapshot };
	for (const [f, v] of Object.entries(d)) {
		if (v === null) delete out[f];
		else out[f] = v;
	}
	return out;
}

// Merge de 3 vías sobre snapshots. Devuelve { snapshot, conflicts: [archivo] }.
function merge3(base, ours, theirs) {
	const out = {};
	const conflicts = [];
	for (const f of new Set([...Object.keys(base), ...Object.keys(ours), ...Object.keys(theirs)])) {
		const b = base[f], o = ours[f], t = theirs[f];
		if (o === t) { if (o !== undefined) out[f] = o; }
		else if (o === b) { if (t !== undefined) out[f] = t; }
		else if (t === b) { if (o !== undefined) out[f] = o; }
		else { conflicts.push(f); out[f] = { conflict: true, ours: o ?? "", theirs: t ?? "" }; }
	}
	return { snapshot: out, conflicts };
}

// ---------- Resolución de referencias ----------

export function resolve(st, repo, ref) {
	if (!ref) return null;
	const m = ref.match(/^(.*?)((?:[~^]\d*)*)$/);
	let base = m[1];
	const suffix = m[2] || "";
	let id = null;
	if (base === "HEAD" || base === "@") id = headCommit(st, repo);
	else if (repo.branches[base] !== undefined) id = repo.branches[base];
	else if (repo.tags[base] !== undefined) id = repo.tags[base];
	else if (repo.remoteRefs[base] !== undefined) id = repo.remoteRefs[base];
	else {
		const k = Object.keys(st.commits).find((c) => c.toLowerCase() === base.toLowerCase());
		if (k && reachableInRepo(st, repo).has(k)) id = k;
	}
	if (!id) return null;
	const ops = suffix.match(/[~^]\d*/g) || [];
	for (const op of ops) {
		const n = op.length > 1 ? parseInt(op.slice(1), 10) : 1;
		if (op[0] === "~") {
			for (let i = 0; i < n; i++) {
				id = st.commits[id]?.parents[0];
				if (!id) return null;
			}
		} else {
			id = n === 0 ? id : st.commits[id]?.parents[n - 1];
			if (!id) return null;
		}
	}
	return id;
}

export function reachableInRepo(st, repo) {
	const all = new Set();
	const tips = [...Object.values(repo.branches), ...Object.values(repo.tags), ...Object.values(repo.remoteRefs)];
	if (repo.HEAD.type === "detached") tips.push(repo.HEAD.id);
	for (const t of tips) for (const a of ancestors(st, t)) all.add(a);
	for (const s of repo.stash || []) all.add(s.base);
	return all;
}

// ---------- Archivos y estado del directorio ----------

export function fileStatus(st, repo) {
	const head = headCommit(st, repo);
	const H = head ? st.commits[head].snapshot : {};
	const I = repo.index, W = repo.wd;
	const out = [];
	for (const f of [...new Set([...Object.keys(H), ...Object.keys(I), ...Object.keys(W)])].sort()) {
		const w = W[f], i = I[f], h = H[f];
		if (w && typeof w === "object" && w.conflict) { out.push({ file: f, state: "conflict" }); continue; }
		const staged = i !== h;
		const modified = w !== i;
		if (h === undefined && i === undefined) out.push({ file: f, state: "untracked" });
		else if (staged && modified) out.push({ file: f, state: "staged+modified", staged: i === undefined ? "deleted" : h === undefined ? "new" : "modified" });
		else if (staged) out.push({ file: f, state: "staged", staged: i === undefined ? "deleted" : h === undefined ? "new" : "modified" });
		else if (modified) out.push({ file: f, state: w === undefined ? "deleted" : "modified" });
		else out.push({ file: f, state: "clean" });
	}
	return out;
}

const isClean = (st, repo) => fileStatus(st, repo).every((f) => f.state === "clean");
const hasStaged = (st, repo) => fileStatus(st, repo).some((f) => f.state.startsWith("staged"));

function checkoutSnapshot(st, repo, id) {
	const snap = id ? { ...st.commits[id].snapshot } : {};
	// Conserva archivos sin seguimiento.
	for (const f of fileStatus(st, repo)) if (f.state === "untracked") snap[f.file] = repo.wd[f.file];
	repo.wd = snap;
	repo.index = id ? { ...st.commits[id].snapshot } : {};
}

// ---------- Mensajes de commit ----------

export const CONVENTIONAL = /^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\([\w\-./ ]+\))?!?: \S.{2,}$/;
export const VAGUE = /^(cambios?|update|updates|fix|arreglos?|wip|asdf|\.|commit|prueba|test|varios|ya|listo|final)$/i;

export function reviewMessage(msg) {
	const notes = [];
	if (!CONVENTIONAL.test(msg)) notes.push({ type: "warn", text: "El mensaje no sigue Conventional Commits. Ejemplo: feat(login): agrega recordar sesión" });
	else notes.push({ type: "ok", text: "✔ Mensaje con formato Conventional Commits" });
	const subject = msg.split("\n")[0];
	if (subject.length > 72) notes.push({ type: "warn", text: `El asunto tiene ${subject.length} caracteres; procura no pasar de 50–72.` });
	if (/\.$/.test(subject)) notes.push({ type: "warn", text: "El asunto no debería terminar en punto." });
	return notes;
}

// ---------- Tokenizador ----------

export function tokenize(line) {
	const out = [];
	let cur = "", q = null, has = false;
	for (const ch of line) {
		if (q) { if (ch === q) q = null; else cur += ch; continue; }
		if (ch === '"' || ch === "'") { q = ch; has = true; continue; }
		if (/\s/.test(ch)) { if (cur || has) out.push(cur); cur = ""; has = false; continue; }
		cur += ch;
	}
	if (cur || has) out.push(cur);
	return out;
}

// ---------- Ejecución ----------

class GitError extends Error {}
const fail = (m) => { throw new GitError(m); };

export function run(state, line) {
	const st = clone(state);
	const out = [];
	const parts = line.split(/\s*&&\s*/).map((s) => s.trim()).filter(Boolean);
	try {
		for (const p of parts) {
			st.log.push(p);
			execOne(st, p, out);
		}
		const h = st.local && headCommit(st, st.local);
		if (h && st.visited[st.visited.length - 1] !== h) st.visited.push(h);
		return { state: st, out, ok: true };
	} catch (e) {
		if (e instanceof GitError) {
			out.push({ type: "err", text: e.message });
			// Los comandos fallidos no modifican el estado, pero sí quedan en el registro.
			const kept = clone(state);
			kept.log.push(...parts.map((p) => "✗ " + p));
			return { state: kept, out, ok: false };
		}
		throw e;
	}
}

function needRepo(st) {
	if (!st.local) fail("fatal: no es un repositorio git (ni ningún directorio superior). Usa git init o git clone.");
	return st.local;
}

function execOne(st, line, out) {
	const t = tokenize(line);
	if (!t.length) return;
	const [cmd, ...args] = t;
	if (cmd === "git") return git(st, args, out);
	if (cmd === "gh") return gh(st, args, out);
	if (cmd === "touch" || cmd === "editar" || cmd === "nano" || cmd === "code") return editFiles(st, args, out, cmd);
	if (cmd === "echo") return echo(st, args, out);
	if (cmd === "rm") return removeFiles(st, args, out);
	if (cmd === "ls" || cmd === "dir") {
		const repo = st.local;
		const files = repo ? Object.keys(repo.wd) : Object.keys(st.pendingFiles || {});
		out.push({ type: "info", text: files.length ? files.sort().join("   ") : "(carpeta vacía)" });
		return;
	}
	if (cmd === "clear" || cmd === "cls" || cmd === "help" || cmd === "ayuda") return; // los maneja la interfaz
	if (cmd === "cd" || cmd === "mkdir" || cmd === "pwd") { out.push({ type: "info", text: "(en este simulador ya estás en la carpeta del proyecto)" }); return; }
	fail(`Comando no reconocido: ${cmd}. Escribe "ayuda" para ver los comandos disponibles.`);
}

// --- Archivos ---

let editCounter = 0;
function editFiles(st, args, out, cmd) {
	if (!args.length) fail(`uso: ${cmd} <archivo>`);
	const repo = st.local;
	for (const f of args) {
		const target = repo ? repo.wd : (st.pendingFiles = st.pendingFiles || {});
		const cur = target[f];
		if (cur && typeof cur === "object") fail(`${f} tiene un conflicto: resuélvelo con los botones del panel o con git checkout --ours/--theirs ${f}`);
		target[f] = `${f}@v${++editCounter}-${st.log.length}`;
		out.push({ type: "info", text: cur === undefined ? `Creaste ${f}` : `Modificaste ${f}` });
	}
}

function echo(st, args, out) {
	const gt = args.findIndex((a) => a === ">" || a === ">>");
	if (gt === -1) { out.push({ type: "info", text: args.join(" ") }); return; }
	return editFiles(st, args.slice(gt + 1), out, "echo");
}

function removeFiles(st, args, out) {
	const repo = needRepo(st);
	for (const f of args.filter((a) => !a.startsWith("-"))) {
		if (repo.wd[f] === undefined) fail(`rm: no existe ${f}`);
		delete repo.wd[f];
		out.push({ type: "info", text: `Eliminaste ${f}` });
	}
}

// --- gh (GitHub CLI simulada) ---

function gh(st, args, out) {
	const [area, action, ...rest] = args;
	if (area === "repo" && action === "fork") {
		if (!st.servers.upstream) fail("No hay un repositorio para hacer fork en este nivel.");
		if (st.servers.origin) fail("Ya tienes un fork (origin).");
		const up = st.servers.upstream;
		st.servers.origin = { ...emptyRepo(), branches: { ...up.branches }, tags: { ...up.tags }, HEAD: { ...up.HEAD } };
		st.urls.origin = st.forkFrom?.forkUrl || "https://github.com/tu-usuario/proyecto-base.git";
		st.forked = true;
		out.push({ type: "ok", text: `✓ Fork creado: ${st.urls.origin}` });
		if (rest.includes("--clone")) cloneInto(st, "origin", out);
		return;
	}
	if (area === "pr" && action === "create") {
		const repo = needRepo(st);
		const opt = (n) => { const i = rest.indexOf(n); return i >= 0 ? rest[i + 1] : null; };
		const base = opt("--base") || opt("-B") || "main";
		const head = opt("--head") || opt("-H") || (repo.HEAD.type === "branch" ? repo.HEAD.name : null);
		if (!head) fail("No se pudo determinar la rama del PR (usa --head).");
		const target = st.servers.upstream ? "upstream" : "origin";
		if (!st.servers.origin || st.servers.origin.branches[head] === undefined) fail(`La rama ${head} no está en GitHub. Primero: git push -u origin ${head}`);
		if (st.servers[target].branches[base] === undefined) fail(`La rama base ${base} no existe en ${target}.`);
		const n = st.prs.length + 1;
		st.prs.push({ n, head, base, target, commit: st.servers.origin.branches[head], title: opt("--title") || opt("-t") || head });
		const url = st.urls[target].replace(/\.git$/, "") + `/pull/${n}`;
		out.push({ type: "ok", text: `✓ Pull request #${n} creado: ${head} → ${target}/${base}` });
		out.push({ type: "info", text: url });
		return;
	}
	if (area === "auth") { out.push({ type: "ok", text: "✓ Sesión iniciada en github.com (simulado)" }); return; }
	fail("gh: comandos disponibles en el simulador: gh repo fork [--clone], gh pr create --base <rama> --head <rama>, gh auth login");
}

// --- git ---

function git(st, args, out) {
	const [sub, ...a] = args;
	const handlers = {
		init: gInit, status: gStatus, add: gAdd, commit: gCommit, log: gLog, branch: gBranch, switch: gSwitch,
		checkout: gCheckout, merge: gMerge, rebase: gRebase, "cherry-pick": gCherry, reset: gReset, revert: gRevert,
		tag: gTag, stash: gStash, clone: gClone, fetch: gFetch, pull: gPull, push: gPush, remote: gRemote,
		restore: gRestore, diff: gDiff, config: gConfig, show: gShow, reflog: gReflog, rm: gRm, help: () => {}, "--version": gVersion, version: gVersion,
	};
	if (!sub) fail("uso: git <comando> [<args>]");
	const h = handlers[sub];
	if (!h) fail(`git: '${sub}' no es un comando de git disponible en el simulador.`);
	return h(st, a, out);
}

function gVersion(st, a, out) { out.push({ type: "info", text: "git version 2.51.0 (simulador Consultor Tech)" }); }
function gConfig(st, a, out) {
	st.config = st.config || {};
	const keys = a.filter((x) => !x.startsWith("--"));
	if (a.includes("--list") || a.includes("-l")) {
		out.push({ type: "info", text: Object.entries(st.config).map(([k, v]) => `${k}=${v}`).join("\n") || "(sin configuración)" });
		return;
	}
	if (keys.length >= 2) { st.config[keys[0]] = keys.slice(1).join(" "); out.push({ type: "ok", text: `${keys[0]} = ${st.config[keys[0]]}` }); }
	else if (keys.length === 1) out.push({ type: "info", text: st.config[keys[0]] || "" });
}

function gInit(st, a, out) {
	if (st.local) { out.push({ type: "info", text: "Reinitialized existing Git repository in /proyecto/.git/" }); return; }
	st.local = emptyRepo();
	st.local.wd = { ...(st.pendingFiles || {}) };
	delete st.pendingFiles;
	out.push({ type: "ok", text: "Initialized empty Git repository in /proyecto/.git/" });
}

function gStatus(st, a, out) {
	const repo = needRepo(st);
	const lines = [];
	if (repo.HEAD.type === "branch") lines.push(`On branch ${repo.HEAD.name}`);
	else lines.push(`HEAD detached at ${repo.HEAD.id}`);
	if (repo.HEAD.type === "branch" && repo.upstream[repo.HEAD.name]) {
		const up = repo.upstream[repo.HEAD.name];
		const l = repo.branches[repo.HEAD.name], r = repo.remoteRefs[up];
		if (l && r) {
			if (l === r) lines.push(`Your branch is up to date with '${up}'.`);
			else if (isAncestor(st, r, l)) lines.push(`Your branch is ahead of '${up}'.`);
			else if (isAncestor(st, l, r)) lines.push(`Your branch is behind '${up}'. (usa git pull)`);
			else lines.push(`Your branch and '${up}' have diverged.`);
		}
	}
	if (repo.merge) lines.push(repo.merge.conflicts.length ? "You have unmerged paths. (resuelve los conflictos y luego git add + git commit)" : "All conflicts fixed but you are still merging. (usa git commit)");
	const fs = fileStatus(st, repo);
	const staged = fs.filter((f) => f.state.startsWith("staged"));
	const conflict = fs.filter((f) => f.state === "conflict");
	const modified = fs.filter((f) => f.state === "modified" || f.state === "deleted" || f.state === "staged+modified");
	const untracked = fs.filter((f) => f.state === "untracked");
	if (conflict.length) lines.push("Unmerged paths:", ...conflict.map((f) => `        both modified:   ${f.file}`));
	if (staged.length) lines.push("Changes to be committed:", ...staged.map((f) => `        ${f.staged === "new" ? "new file" : f.staged}:   ${f.file}`));
	if (modified.length) lines.push("Changes not staged for commit:", ...modified.map((f) => `        ${f.state === "deleted" ? "deleted" : "modified"}:   ${f.file}`));
	if (untracked.length) lines.push("Untracked files:", ...untracked.map((f) => `        ${f.file}`));
	if (!staged.length && !modified.length && !untracked.length && !conflict.length) lines.push("nothing to commit, working tree clean");
	out.push({ type: "info", text: lines.join("\n") });
}

function gAdd(st, a, out) {
	const repo = needRepo(st);
	const paths = a.filter((x) => !x.startsWith("-") || x === "-A");
	if (!paths.length) fail("Nothing specified, nothing added. (¿quisiste decir git add . ?)");
	const all = paths.some((p) => p === "." || p === "-A" || p === "*");
	const files = all ? [...new Set([...Object.keys(repo.wd), ...Object.keys(repo.index)])] : paths;
	for (const f of files) {
		if (repo.wd[f] === undefined && repo.index[f] === undefined) fail(`fatal: pathspec '${f}' did not match any files`);
		const v = repo.wd[f];
		if (v && typeof v === "object") fail(`${f} aún tiene marcadores de conflicto. Resuélvelo antes de git add.`);
		if (v === undefined) delete repo.index[f];
		else repo.index[f] = v;
		if (repo.merge) repo.merge.conflicts = repo.merge.conflicts.filter((c) => c !== f);
	}
	out.push({ type: "ok", text: all ? "Cambios agregados al área de preparación." : `Agregado al staging: ${files.join(", ")}` });
}

function gRm(st, a, out) {
	const repo = needRepo(st);
	const cached = a.includes("--cached");
	for (const f of a.filter((x) => !x.startsWith("-"))) {
		delete repo.index[f];
		if (!cached) delete repo.wd[f];
	}
	out.push({ type: "ok", text: "Archivo(s) eliminados del índice." });
}

function gRestore(st, a, out) {
	const repo = needRepo(st);
	const staged = a.includes("--staged") || a.includes("-S");
	const files = a.filter((x) => !x.startsWith("-"));
	if (!files.length) fail("uso: git restore [--staged] <archivo>");
	const head = headCommit(st, repo);
	const H = head ? st.commits[head].snapshot : {};
	const all = files.includes(".");
	const list = all ? Object.keys({ ...repo.wd, ...repo.index }) : files;
	for (const f of list) {
		if (staged) {
			if (H[f] === undefined) delete repo.index[f];
			else repo.index[f] = H[f];
		} else {
			if (repo.index[f] === undefined) { if (!all) fail(`error: pathspec '${f}' no está bajo seguimiento`); continue; }
			repo.wd[f] = repo.index[f];
		}
	}
	out.push({ type: "ok", text: staged ? "Archivo(s) fuera del staging; tus cambios siguen en el directorio." : "Cambios locales descartados." });
}

function gDiff(st, a, out) {
	const repo = needRepo(st);
	const fs = fileStatus(st, repo);
	const staged = a.includes("--staged") || a.includes("--cached");
	const list = fs.filter((f) => (staged ? f.state.startsWith("staged") : ["modified", "deleted", "staged+modified"].includes(f.state)));
	out.push({ type: "info", text: list.length ? list.map((f) => `diff --git a/${f.file} b/${f.file}\n  (cambios ${staged ? "preparados" : "sin preparar"} en ${f.file})`).join("\n") : "(sin diferencias)" });
}

function gCommit(st, a, out) {
	const repo = needRepo(st);
	const amend = a.includes("--amend");
	const all = a.includes("-a") || a.includes("-am") || a.includes("--all");
	let msg = null;
	for (let i = 0; i < a.length; i++) {
		if (a[i] === "-m" || a[i] === "-am" || a[i] === "--message") { msg = a[i + 1]; i++; }
		else if (a[i].startsWith("-m") && a[i].length > 2 && a[i] !== "-m") msg = a[i].slice(2);
	}
	if (a.includes("--no-edit") && amend) msg = st.commits[headCommit(st, repo)]?.msg;
	if (repo.merge) {
		if (repo.merge.conflicts.length) fail(`error: no puedes hacer commit con conflictos sin resolver (${repo.merge.conflicts.join(", ")}).\nResuélvelos y usa git add.`);
		const head = headCommit(st, repo);
		const id = addCommit(st, { parents: [head, repo.merge.theirs], msg: msg || `Merge branch '${repo.merge.name}'`, snapshot: repo.index, extra: { merge: true } });
		moveHead(repo, id);
		repo.merge = null;
		out.push({ type: "ok", text: `[${branchLabel(repo)} ${id}] ${st.commits[id].msg}` });
		return;
	}
	if (all) for (const f of Object.keys(repo.index)) { if (repo.wd[f] === undefined) delete repo.index[f]; else repo.index[f] = repo.wd[f]; }
	if (msg === null || msg === undefined) {
		if (!amend) fail('Falta el mensaje. Usa: git commit -m "tipo: descripción"\n(En Git real se abriría el editor; aquí escribe el mensaje con -m.)');
	}
	if (!msg?.trim() && !amend) fail("Aborting commit due to empty commit message.");
	const head = headCommit(st, repo);
	if (amend) {
		if (!head) fail("fatal: no hay commit que corregir.");
		const old = st.commits[head];
		const id = addCommit(st, { parents: old.parents, msg: msg || old.msg, snapshot: repo.index, base: head });
		moveHead(repo, id);
		out.push({ type: "ok", text: `[${branchLabel(repo)} ${id}] ${st.commits[id].msg}  (commit corregido; reemplaza a ${head})` });
		reviewOut(st, st.commits[id].msg, out);
		return;
	}
	if (st.strict && !hasStaged(st, repo)) {
		const fsx = fileStatus(st, repo);
		fail(fsx.some((f) => f.state !== "clean") ? 'no changes added to commit (usa "git add" para preparar los cambios)' : "nothing to commit, working tree clean");
	}
	// En modo no estricto, cada commit simula un cambio en un archivo propio.
	let snapshot = { ...repo.index };
	if (!st.strict && !hasStaged(st, repo)) {
		const f = `trabajo-${st.counter}.txt`;
		snapshot[f] = `${f}@commit`;
		repo.wd[f] = snapshot[f];
	}
	const id = addCommit(st, { parents: head ? [head] : [], msg, snapshot });
	moveHead(repo, id);
	repo.index = { ...snapshot };
	out.push({ type: "ok", text: `[${branchLabel(repo)}${head ? "" : " (root-commit)"} ${id}] ${msg}` });
	reviewOut(st, msg, out);
}

function reviewOut(st, msg, out) {
	const subject = msg.split("\n")[0].trim();
	if (st.conventional) out.push(...reviewMessage(msg));
	else if (VAGUE.test(subject)) out.push({ type: "warn", text: `Consejo: “${subject}” no describe el cambio. Prueba algo como "feat: agrega formulario de contacto".` });
}

function branchLabel(repo) {
	return repo.HEAD.type === "branch" ? repo.HEAD.name : "HEAD desacoplado";
}

function moveHead(repo, id) {
	if (repo.HEAD.type === "branch") repo.branches[repo.HEAD.name] = id;
	else repo.HEAD.id = id;
}

function gLog(st, a, out) {
	const repo = needRepo(st);
	const all = a.includes("--all");
	const refArg = a.find((x) => !x.startsWith("-"));
	const start = refArg ? resolve(st, repo, refArg) : headCommit(st, repo);
	if (!start && !all) fail("fatal: tu rama actual no tiene commits todavía");
	const set = all ? reachableInRepo(st, repo) : ancestors(st, start);
	const order = [...set].sort((x, y) => num(y) - num(x));
	const decor = (id) => {
		const refs = [];
		if (headCommit(st, repo) === id) refs.push(repo.HEAD.type === "branch" ? `HEAD -> ${repo.HEAD.name}` : "HEAD");
		for (const [b, v] of Object.entries(repo.branches)) if (v === id && !(repo.HEAD.type === "branch" && repo.HEAD.name === b)) refs.push(b);
		for (const [b, v] of Object.entries(repo.remoteRefs)) if (v === id) refs.push(b);
		for (const [b, v] of Object.entries(repo.tags)) if (v === id) refs.push("tag: " + b);
		return refs.length ? ` (${refs.join(", ")})` : "";
	};
	const lines = order.map((id) => {
		const c = st.commits[id];
		return `${id.padEnd(5)}${decor(id)} ${c.msg.split("\n")[0]}${c.parents.length > 1 ? "   [merge]" : ""}`;
	});
	out.push({ type: "info", text: lines.join("\n") });
}
const num = (id) => parseFloat(id.replace(/\D/g, "") || "0") + (id.split("'").length - 1) * 0.1;

function gShow(st, a, out) {
	const repo = needRepo(st);
	const id = resolve(st, repo, a[0] || "HEAD");
	if (!id) fail(`fatal: referencia desconocida '${a[0]}'`);
	const c = st.commits[id];
	out.push({ type: "info", text: `commit ${id}\nPadres: ${c.parents.join(", ") || "(ninguno)"}\n\n    ${c.msg}\n\nArchivos cambiados: ${Object.keys(diffOf(st, id)).join(", ") || "(ninguno)"}` });
}

function gReflog(st, a, out) {
	needRepo(st);
	const v = [...st.visited].reverse().slice(0, 15);
	out.push({ type: "info", text: v.map((id, i) => `${id.padEnd(5)} HEAD@{${i}}: ${st.commits[id]?.msg.split("\n")[0] || ""}`).join("\n") });
}

const BRANCH_NAME = /^(?!-)(?!.*\.\.)(?!.*\/$)[\w\-./]+$/;

function gBranch(st, a, out) {
	const repo = needRepo(st);
	const flags = a.filter((x) => x.startsWith("-"));
	const names = a.filter((x) => !x.startsWith("-"));
	if (flags.includes("-d") || flags.includes("-D") || flags.includes("--delete")) {
		if (!names.length) fail("uso: git branch -d <rama>");
		for (const n of names) {
			if (repo.branches[n] === undefined) fail(`error: la rama '${n}' no existe.`);
			if (repo.HEAD.type === "branch" && repo.HEAD.name === n) fail(`error: no puedes borrar la rama '${n}' porque estás en ella. Cámbiate primero con git switch.`);
			const head = headCommit(st, repo);
			if (!flags.includes("-D") && !isAncestor(st, repo.branches[n], head)) fail(`error: la rama '${n}' no está completamente integrada.\nSi estás seguro, usa git branch -D ${n}.`);
			out.push({ type: "ok", text: `Deleted branch ${n} (was ${repo.branches[n]}).` });
			delete repo.branches[n];
			delete repo.upstream[n];
		}
		return;
	}
	if (flags.includes("-f") && names.length >= 2) {
		const id = resolve(st, repo, names[1]);
		if (!id) fail(`fatal: referencia no válida: ${names[1]}`);
		if (repo.HEAD.type === "branch" && repo.HEAD.name === names[0]) fail("fatal: no puedes forzar la rama actual.");
		repo.branches[names[0]] = id;
		out.push({ type: "ok", text: `Rama ${names[0]} movida a ${id}` });
		return;
	}
	if (flags.includes("-a") || flags.includes("-r") || !names.length) {
		const cur = repo.HEAD.type === "branch" ? repo.HEAD.name : null;
		const lines = [];
		if (!flags.includes("-r")) for (const b of Object.keys(repo.branches).sort()) lines.push(`${b === cur ? "*" : " "} ${b}`);
		if (flags.includes("-a") || flags.includes("-r")) for (const r of Object.keys(repo.remoteRefs).sort()) lines.push(`  remotes/${r}`);
		if (repo.HEAD.type === "detached") lines.unshift(`* (HEAD desacoplado en ${repo.HEAD.id})`);
		out.push({ type: "info", text: lines.join("\n") || "(sin ramas todavía: haz tu primer commit)" });
		return;
	}
	createBranch(st, repo, names[0], names[1], out);
}

function createBranch(st, repo, name, startRef, out) {
	if (!BRANCH_NAME.test(name)) fail(`fatal: '${name}' no es un nombre de rama válido.`);
	if (repo.branches[name] !== undefined) fail(`fatal: ya existe una rama llamada '${name}'.`);
	const id = startRef ? resolve(st, repo, startRef) : headCommit(st, repo);
	if (!id) fail(startRef ? `fatal: referencia no válida: ${startRef}` : "fatal: no hay commits todavía; haz tu primer commit antes de crear ramas.");
	repo.branches[name] = id;
	out?.push({ type: "ok", text: `Rama ${name} creada en ${id}` });
	return id;
}

function guardSwitch(st, repo) {
	if (repo.merge) fail("error: tienes un merge en curso. Termínalo (git commit) o cancélalo (git merge --abort).");
	const dirty = fileStatus(st, repo).filter((f) => f.state !== "clean" && f.state !== "untracked");
	if (dirty.length) fail(`error: tus cambios locales en ${dirty.map((f) => f.file).join(", ")} se perderían.\nHaz commit o usa git stash antes de cambiar de rama.`);
}

function switchTo(st, repo, target, out) {
	if (repo.branches[target] !== undefined) {
		guardSwitch(st, repo);
		repo.HEAD = { type: "branch", name: target };
		checkoutSnapshot(st, repo, repo.branches[target]);
		out.push({ type: "ok", text: `Switched to branch '${target}'` });
		return;
	}
	// Rama remota con el mismo nombre: crear rama de seguimiento (DWIM).
	const rr = Object.keys(repo.remoteRefs).find((r) => r.split("/").slice(1).join("/") === target);
	if (rr) {
		guardSwitch(st, repo);
		repo.branches[target] = repo.remoteRefs[rr];
		repo.upstream[target] = rr;
		repo.HEAD = { type: "branch", name: target };
		checkoutSnapshot(st, repo, repo.branches[target]);
		out.push({ type: "ok", text: `Rama '${target}' configurada para seguir a '${rr}'.\nSwitched to a new branch '${target}'` });
		return;
	}
	return null;
}

function detach(st, repo, ref, out) {
	const id = resolve(st, repo, ref);
	if (!id) fail(`fatal: referencia no válida: ${ref}`);
	guardSwitch(st, repo);
	repo.HEAD = { type: "detached", id };
	st.detachedAt = [...(st.detachedAt || []), id];
	checkoutSnapshot(st, repo, id);
	out.push({ type: "ok", text: `HEAD is now at ${id} ${st.commits[id].msg.split("\n")[0]}\n(Estás en modo “HEAD desacoplado”: ideal para mirar. Vuelve con git switch <rama>.)` });
}

function gSwitch(st, a, out) {
	const repo = needRepo(st);
	const create = a.includes("-c") || a.includes("-C") || a.includes("--create");
	const names = a.filter((x) => !x.startsWith("-"));
	if (a.includes("--detach") || a.includes("-d")) return detach(st, repo, names[0] || "HEAD", out);
	if (a.includes("-")) { const prev = st.prevBranch; if (!prev) fail("No hay rama anterior."); names[0] = prev; }
	if (!names.length) fail("uso: git switch [-c] <rama>");
	const prev = repo.HEAD.type === "branch" ? repo.HEAD.name : null;
	if (create) {
		guardSwitch(st, repo);
		const id = createBranch(st, repo, names[0], names[1]);
		repo.HEAD = { type: "branch", name: names[0] };
		checkoutSnapshot(st, repo, id);
		out.push({ type: "ok", text: `Switched to a new branch '${names[0]}'` });
	} else if (switchTo(st, repo, names[0], out) === null) {
		const isCommit = resolve(st, repo, names[0]);
		fail(isCommit ? `fatal: se esperaba una rama, '${names[0]}' es un commit o tag.\nPara mirarlo usa: git switch --detach ${names[0]}` : `fatal: la rama '${names[0]}' no existe. Para crearla: git switch -c ${names[0]}`);
	}
	if (prev) st.prevBranch = prev;
}

function gCheckout(st, a, out) {
	const repo = needRepo(st);
	const names = a.filter((x) => !x.startsWith("-"));
	if (a.includes("--ours") || a.includes("--theirs")) {
		if (!repo.merge) fail("error: no hay un merge en curso.");
		for (const f of names) {
			const v = repo.wd[f];
			if (!v || typeof v !== "object") fail(`${f} no tiene conflicto.`);
			repo.wd[f] = a.includes("--ours") ? v.ours : v.theirs;
			out.push({ type: "ok", text: `${f}: se conservó la versión ${a.includes("--ours") ? "actual (ours)" : "entrante (theirs)"}. Ahora: git add ${f}` });
		}
		return;
	}
	if (a.includes("--")) return gRestore(st, names, out);
	if (a.includes("-b") || a.includes("-B")) return gSwitch(st, ["-c", ...names], out);
	if (!names.length) fail("uso: git checkout <rama|commit>");
	const prev = repo.HEAD.type === "branch" ? repo.HEAD.name : null;
	if (switchTo(st, repo, names[0], out) === null) detach(st, repo, names[0], out);
	if (prev) st.prevBranch = prev;
}

function gMerge(st, a, out) {
	const repo = needRepo(st);
	if (a.includes("--abort")) {
		if (!repo.merge) fail("fatal: no hay un merge en curso.");
		repo.merge = null;
		checkoutSnapshot(st, repo, headCommit(st, repo));
		out.push({ type: "ok", text: "Merge cancelado. Todo quedó como antes." });
		return;
	}
	if (repo.merge) fail("error: ya hay un merge en curso. Resuélvelo o usa git merge --abort.");
	const noff = a.includes("--no-ff");
	const ffOnly = a.includes("--ff-only");
	let msg = null;
	const mi = a.indexOf("-m");
	if (mi >= 0) msg = a[mi + 1];
	const refs = a.filter((x, i) => !x.startsWith("-") && a[i - 1] !== "-m");
	if (!refs.length) fail("uso: git merge <rama>");
	const name = refs[0];
	const theirs = resolve(st, repo, name);
	if (!theirs) fail(`merge: ${name} - no es algo que se pueda fusionar.`);
	guardSwitch(st, repo);
	return doMerge(st, repo, theirs, name, { noff, ffOnly, msg }, out);
}

function doMerge(st, repo, theirs, name, { noff, ffOnly, msg }, out) {
	const ours = headCommit(st, repo);
	if (!ours) { moveHead(repo, theirs); checkoutSnapshot(st, repo, theirs); out.push({ type: "ok", text: "Fast-forward" }); return; }
	if (isAncestor(st, theirs, ours)) { out.push({ type: "info", text: "Already up to date." }); return; }
	if (isAncestor(st, ours, theirs) && !noff) {
		moveHead(repo, theirs);
		checkoutSnapshot(st, repo, theirs);
		out.push({ type: "ok", text: `Updating ${ours}..${theirs}\nFast-forward` });
		return;
	}
	if (ffOnly) fail("fatal: no es posible un fast-forward; las ramas divergieron.");
	const base = mergeBase(st, ours, theirs);
	const res = merge3(base ? st.commits[base].snapshot : {}, st.commits[ours].snapshot, st.commits[theirs].snapshot);
	const label = msg || `Merge branch '${name}'${repo.HEAD.type === "branch" ? ` into ${repo.HEAD.name}` : ""}`;
	if (res.conflicts.length) {
		repo.merge = { theirs, name, conflicts: [...res.conflicts] };
		const clean = Object.fromEntries(Object.entries(res.snapshot).filter(([, v]) => typeof v !== "object"));
		repo.index = { ...st.commits[ours].snapshot, ...clean };
		repo.wd = { ...res.snapshot };
		out.push({ type: "err", text: res.conflicts.map((f) => `Auto-merging ${f}\nCONFLICT (content): Merge conflict in ${f}`).join("\n") + "\nAutomatic merge failed; fix conflicts and then commit the result." });
		out.push({ type: "info", text: "Pasos: 1) resuelve el archivo (botones del panel o git checkout --ours/--theirs <archivo>)  2) git add <archivo>  3) git commit" });
		return;
	}
	const id = addCommit(st, { parents: [ours, theirs], msg: label, snapshot: res.snapshot, extra: { merge: true } });
	moveHead(repo, id);
	checkoutSnapshot(st, repo, id);
	out.push({ type: "ok", text: `Merge made by the 'ort' strategy.  →  ${id}` });
}

function gRebase(st, a, out) {
	const repo = needRepo(st);
	if (a.includes("-i") || a.includes("--interactive")) fail("El rebase interactivo no está disponible en el simulador. Usa git rebase <rama>.");
	const names = a.filter((x) => !x.startsWith("-"));
	if (!names.length) fail("uso: git rebase <rama>");
	if (repo.HEAD.type !== "branch") fail("Para este simulador, haz rebase estando en una rama.");
	guardSwitch(st, repo);
	const onto = resolve(st, repo, names[0]);
	if (!onto) fail(`fatal: referencia no válida: ${names[0]}`);
	const head = headCommit(st, repo);
	if (isAncestor(st, head, onto)) {
		repo.branches[repo.HEAD.name] = onto;
		checkoutSnapshot(st, repo, onto);
		out.push({ type: "ok", text: `Fast-forward: ${repo.HEAD.name} ahora apunta a ${onto}` });
		return;
	}
	if (isAncestor(st, onto, head)) { out.push({ type: "info", text: "Current branch is up to date." }); return; }
	const keep = ancestors(st, onto);
	// Commits propios (no alcanzables desde onto), en orden, saltando merges.
	const mine = [...ancestors(st, head)].filter((c) => !keep.has(c) && st.commits[c].parents.length <= 1).sort((x, y) => num(x) - num(y));
	let tip = onto;
	for (const c of mine) {
		const snap = applyDiff(st.commits[tip].snapshot, diffOf(st, c));
		tip = addCommit(st, { parents: [tip], msg: st.commits[c].msg, snapshot: snap, base: c });
	}
	repo.branches[repo.HEAD.name] = tip;
	checkoutSnapshot(st, repo, tip);
	out.push({ type: "ok", text: `Successfully rebased and updated refs/heads/${repo.HEAD.name}.\n(${mine.length} commit(s) copiados sobre ${names[0]}: ${mine.join(", ")} → nuevos hashes)` });
}

function gCherry(st, a, out) {
	const repo = needRepo(st);
	const refs = a.filter((x) => !x.startsWith("-"));
	if (!refs.length) fail("uso: git cherry-pick <commit>...");
	guardSwitch(st, repo);
	for (const r of refs) {
		const id = resolve(st, repo, r);
		if (!id) fail(`fatal: commit desconocido: ${r}`);
		if (st.commits[id].parents.length > 1) fail(`error: ${id} es un commit de merge; el simulador no hace cherry-pick de merges.`);
		const head = headCommit(st, repo);
		if (isAncestor(st, id, head)) fail(`${id} ya está en tu rama.`);
		const snap = applyDiff(st.commits[head].snapshot, diffOf(st, id));
		const nid = addCommit(st, { parents: [head], msg: st.commits[id].msg, snapshot: snap, base: id, extra: { cherryOf: id } });
		moveHead(repo, nid);
		checkoutSnapshot(st, repo, nid);
		out.push({ type: "ok", text: `[${branchLabel(repo)} ${nid}] ${st.commits[id].msg}  (copia de ${id})` });
	}
}

function gReset(st, a, out) {
	const repo = needRepo(st);
	const mode = a.includes("--hard") ? "hard" : a.includes("--soft") ? "soft" : "mixed";
	const refs = a.filter((x) => !x.startsWith("-"));
	if (refs.length && !resolve(st, repo, refs[0]) && (repo.index[refs[0]] !== undefined || repo.wd[refs[0]] !== undefined)) {
		return gRestore(st, ["--staged", ...refs], out); // git reset <archivo>
	}
	const target = resolve(st, repo, refs[0] || "HEAD");
	if (!target) fail(`fatal: referencia no válida: ${refs[0]}`);
	if (repo.merge) repo.merge = null;
	const before = headCommit(st, repo);
	moveHead(repo, target);
	if (mode === "hard") checkoutSnapshot(st, repo, target);
	else if (mode === "mixed") repo.index = { ...st.commits[target].snapshot };
	out.push({ type: "ok", text: `HEAD is now at ${target} ${st.commits[target].msg.split("\n")[0]}  (reset --${mode}; antes estaba en ${before})` });
	if (mode === "hard") out.push({ type: "warn", text: "reset --hard descarta cambios. Si te equivocaste, git reflog te muestra a dónde volver." });
}

function gRevert(st, a, out) {
	const repo = needRepo(st);
	const refs = a.filter((x) => !x.startsWith("-"));
	if (!refs.length) fail("uso: git revert <commit>");
	guardSwitch(st, repo);
	for (const r of refs) {
		const id = resolve(st, repo, r);
		if (!id) fail(`fatal: commit desconocido: ${r}`);
		const head = headCommit(st, repo);
		if (!isAncestor(st, id, head)) fail(`${id} no está en la historia de tu rama actual.`);
		const c = st.commits[id];
		const prev = c.parents.length ? st.commits[c.parents[0]].snapshot : {};
		const inv = {};
		for (const f of Object.keys(diffOf(st, id))) inv[f] = prev[f] === undefined ? null : prev[f];
		const snap = applyDiff(st.commits[head].snapshot, inv);
		const nid = addCommit(st, { parents: [head], msg: `Revert "${c.msg.split("\n")[0]}"`, snapshot: snap, extra: { revertOf: id } });
		moveHead(repo, nid);
		checkoutSnapshot(st, repo, nid);
		out.push({ type: "ok", text: `[${branchLabel(repo)} ${nid}] Revert "${c.msg.split("\n")[0]}"` });
	}
}

const TAG_NAME = /^[\w\-.]+$/;
function gTag(st, a, out) {
	const repo = needRepo(st);
	if (a.includes("-d")) {
		const n = a[a.indexOf("-d") + 1];
		if (repo.tags[n] === undefined) fail(`error: tag '${n}' no encontrado.`);
		delete repo.tags[n];
		out.push({ type: "ok", text: `Deleted tag '${n}'` });
		return;
	}
	const pos = a.filter((x, i) => !x.startsWith("-") && a[i - 1] !== "-m");
	if (!pos.length) { out.push({ type: "info", text: Object.keys(repo.tags).sort().join("\n") || "(sin tags)" }); return; }
	const [name, ref] = pos;
	if (!TAG_NAME.test(name)) fail(`fatal: '${name}' no es un nombre de tag válido.`);
	if (repo.tags[name] !== undefined) fail(`fatal: el tag '${name}' ya existe.`);
	const id = resolve(st, repo, ref || "HEAD");
	if (!id) fail(`fatal: referencia no válida: ${ref}`);
	repo.tags[name] = id;
	out.push({ type: "ok", text: `Tag ${name} creado en ${id}` });
	if (!/^v\d+\.\d+\.\d+/.test(name)) out.push({ type: "warn", text: "Consejo: usa versionado semántico, por ejemplo v1.2.0" });
}

function gStash(st, a, out) {
	const repo = needRepo(st);
	const sub = a[0] && !a[0].startsWith("-") ? a[0] : "push";
	if (sub === "list") { out.push({ type: "info", text: repo.stash.map((s, i) => `stash@{${i}}: On ${s.branch}: ${s.msg}`).join("\n") || "(sin stash)" }); return; }
	if (sub === "pop" || sub === "apply") {
		if (!repo.stash.length) fail("No hay entradas en el stash.");
		const s = repo.stash[0];
		repo.wd = { ...repo.wd, ...s.wd };
		repo.index = { ...repo.index, ...s.index };
		if (sub === "pop") repo.stash.shift();
		out.push({ type: "ok", text: `Cambios recuperados del stash (${s.msg}).` });
		return;
	}
	if (sub === "push" || sub === "save") {
		const dirty = fileStatus(st, repo).filter((f) => f.state !== "clean" && f.state !== "untracked");
		if (!dirty.length) fail("No local changes to save");
		const mi = a.indexOf("-m");
		const msg = mi >= 0 ? a[mi + 1] : `WIP en ${branchLabel(repo)}`;
		const wd = {}, index = {};
		for (const f of dirty) { wd[f.file] = repo.wd[f.file]; index[f.file] = repo.index[f.file]; }
		repo.stash.unshift({ msg, branch: branchLabel(repo), wd, index, base: headCommit(st, repo) });
		checkoutSnapshot(st, repo, headCommit(st, repo));
		out.push({ type: "ok", text: `Saved working directory and index state On ${branchLabel(repo)}: ${msg}` });
		return;
	}
	fail("uso: git stash [push -m \"mensaje\" | list | pop]");
}

// --- Remotos ---

function serverFor(st, repo, remote) {
	const key = repo.remotes[remote];
	if (!key) fail(`fatal: '${remote}' no es un repositorio remoto configurado. Revisa git remote -v`);
	const srv = st.servers[key];
	if (!srv) fail(`fatal: no se pudo acceder al remoto '${remote}'.`);
	return srv;
}

function cloneInto(st, key, out) {
	if (st.local) fail("fatal: ya hay un repositorio aquí. (En este simulador solo se clona una vez por nivel.)");
	const srv = st.servers[key];
	const repo = emptyRepo();
	repo.remotes.origin = key;
	for (const [b, id] of Object.entries(srv.branches)) repo.remoteRefs[`origin/${b}`] = id;
	Object.assign(repo.tags, srv.tags);
	const def = srv.HEAD.name in srv.branches ? srv.HEAD.name : Object.keys(srv.branches)[0];
	if (def) {
		repo.branches[def] = srv.branches[def];
		repo.upstream[def] = `origin/${def}`;
		repo.HEAD = { type: "branch", name: def };
	}
	st.local = repo;
	checkoutSnapshot(st, repo, def ? srv.branches[def] : null);
	if (def) st.visited.push(srv.branches[def]);
	out.push({ type: "ok", text: `Cloning into '${(st.urls[key] || key).split("/").pop().replace(".git", "")}'...\ndone.` });
}

function gClone(st, a, out) {
	const url = a.find((x) => !x.startsWith("-"));
	if (!url) fail("uso: git clone <url>");
	const key = Object.keys(st.servers).find((k) => st.urls[k] === url || st.urls[k].replace(/\.git$/, "") === url.replace(/\.git$/, "") || url === k);
	if (!key) fail(`fatal: repository '${url}' not found\n(Repositorios disponibles: ${Object.values(st.urls).join("  ")})`);
	cloneInto(st, key, out);
}

function gRemote(st, a, out) {
	const repo = needRepo(st);
	if (!a.length || a[0] === "-v") {
		const lines = [];
		for (const [n, k] of Object.entries(repo.remotes)) lines.push(`${n}\t${st.urls[k]} (fetch)`, `${n}\t${st.urls[k]} (push)`);
		out.push({ type: "info", text: lines.join("\n") || "(sin remotos)" });
		return;
	}
	if (a[0] === "add") {
		const [, name, url] = a;
		if (!name || !url) fail("uso: git remote add <nombre> <url>");
		if (repo.remotes[name]) fail(`error: el remoto ${name} ya existe.`);
		const key = Object.keys(st.servers).find((k) => st.urls[k] === url || st.urls[k].replace(/\.git$/, "") === url.replace(/\.git$/, ""));
		if (!key) fail(`No existe un repositorio con la URL ${url} en este nivel.\n(Disponibles: ${Object.values(st.urls).join("  ")})`);
		repo.remotes[name] = key;
		out.push({ type: "ok", text: `Remoto '${name}' agregado → ${url}` });
		return;
	}
	if (a[0] === "remove" || a[0] === "rm") {
		delete repo.remotes[a[1]];
		for (const r of Object.keys(repo.remoteRefs)) if (r.startsWith(a[1] + "/")) delete repo.remoteRefs[r];
		out.push({ type: "ok", text: `Remoto ${a[1]} eliminado.` });
		return;
	}
	fail("uso: git remote [-v] | add <nombre> <url> | remove <nombre>");
}

function fetchFrom(st, repo, remote, out) {
	const srv = serverFor(st, repo, remote);
	const changes = [];
	for (const [b, id] of Object.entries(srv.branches)) {
		const ref = `${remote}/${b}`;
		if (repo.remoteRefs[ref] !== id) changes.push(`   ${repo.remoteRefs[ref] || "[nueva]"}..${id}  ${b} -> ${ref}`);
		repo.remoteRefs[ref] = id;
	}
	for (const r of Object.keys(repo.remoteRefs)) if (r.startsWith(remote + "/") && srv.branches[r.slice(remote.length + 1)] === undefined) delete repo.remoteRefs[r];
	for (const [t, id] of Object.entries(srv.tags)) if (repo.tags[t] === undefined) repo.tags[t] = id;
	out.push({ type: "ok", text: changes.length ? `From ${st.urls[repo.remotes[remote]]}\n${changes.join("\n")}` : "(nada nuevo en el remoto)" });
}

function gFetch(st, a, out) {
	const repo = needRepo(st);
	const remotes = a.includes("--all") ? Object.keys(repo.remotes) : [a.find((x) => !x.startsWith("-")) || "origin"];
	for (const r of remotes) fetchFrom(st, repo, r, out);
}

function gPull(st, a, out) {
	const repo = needRepo(st);
	if (repo.HEAD.type !== "branch") fail("No estás en una rama: cámbiate a una rama antes de git pull.");
	const pos = a.filter((x) => !x.startsWith("-"));
	const remote = pos[0] || (repo.upstream[repo.HEAD.name] || "origin/").split("/")[0] || "origin";
	const branch = pos[1] || (repo.upstream[repo.HEAD.name] ? repo.upstream[repo.HEAD.name].split("/").slice(1).join("/") : repo.HEAD.name);
	guardSwitch(st, repo);
	fetchFrom(st, repo, remote, out);
	const ref = `${remote}/${branch}`;
	const id = repo.remoteRefs[ref];
	if (!id) fail(`fatal: la rama '${branch}' no existe en ${remote}.`);
	if (a.includes("--rebase")) return gRebase(st, [ref], out);
	return doMerge(st, repo, id, ref, { noff: false }, out);
}

function gPush(st, a, out) {
	const repo = needRepo(st);
	const force = a.includes("--force") || a.includes("-f") || a.includes("--force-with-lease");
	const setUp = a.includes("-u") || a.includes("--set-upstream");
	const pos = a.filter((x) => !x.startsWith("-"));
	const remote = pos[0] || (repo.HEAD.type === "branch" && repo.upstream[repo.HEAD.name] ? repo.upstream[repo.HEAD.name].split("/")[0] : "origin");
	const srv = serverFor(st, repo, remote);
	if (a.includes("--tags")) {
		for (const [t, id] of Object.entries(repo.tags)) srv.tags[t] = id;
		out.push({ type: "ok", text: `Tags enviados a ${remote}: ${Object.keys(repo.tags).join(", ") || "(ninguno)"}` });
		if (pos.length <= 1) return;
	}
	let branches = pos.slice(1);
	if (!branches.length) {
		if (repo.HEAD.type !== "branch") fail("fatal: no estás en una rama.");
		const b = repo.HEAD.name;
		if (!repo.upstream[b] && !setUp && srv.branches[b] === undefined) fail(`fatal: la rama actual ${b} no tiene rama remota.\nPara subirla: git push -u ${remote} ${b}`);
		branches = [b];
	}
	for (const spec of branches) {
		const [src, dst0] = spec.split(":");
		const dst = dst0 || src;
		const id = resolve(st, repo, src);
		if (!id) fail(`error: src refspec ${src} does not match any`);
		if (repo.tags[src] !== undefined && repo.branches[src] === undefined) { srv.tags[src] = repo.tags[src]; out.push({ type: "ok", text: ` * [new tag]  ${src} -> ${src}` }); continue; }
		const cur = srv.branches[dst];
		if (cur && !isAncestor(st, cur, id)) {
			if (!force) fail(` ! [rejected]  ${src} -> ${dst} (non-fast-forward)\nerror: el remoto tiene commits que no tienes. Haz git pull primero.`);
			out.push({ type: "warn", text: "Push forzado: reescribiste la historia del remoto. Evítalo en ramas compartidas." });
			st.forcePushed = true;
		}
		srv.branches[dst] = id;
		repo.remoteRefs[`${remote}/${dst}`] = id;
		if (setUp) repo.upstream[src] = `${remote}/${dst}`;
		out.push({ type: "ok", text: cur === id ? "Everything up-to-date" : `${cur ? `   ${cur}..${id}` : " * [new branch]"}  ${src} -> ${dst}` });
	}
	for (const [t, id] of Object.entries(repo.tags)) if (a.includes("--follow-tags")) srv.tags[t] = id;
}

// ---------- Ayuda ----------

export const HELP = [
	["git init", "crea un repositorio"],
	["git status", "estado de los archivos"],
	["git add <archivo> | .", "prepara cambios"],
	['git commit -m "mensaje"', "crea un commit"],
	["git log", "historial"],
	["git branch [-d] <rama>", "lista, crea o borra ramas"],
	["git switch [-c] <rama>", "cambia (o crea y cambia) de rama"],
	["git switch --detach <commit>", "mueve HEAD a un commit"],
	["git merge [--no-ff] <rama>", "integra una rama"],
	["git rebase <rama>", "mueve tus commits sobre otra rama"],
	["git cherry-pick <commit>", "copia un commit"],
	["git reset [--soft|--hard] <ref>", "mueve la rama actual"],
	["git revert <commit>", "deshace un commit con uno nuevo"],
	["git tag <nombre> [ref]", "crea un tag"],
	["git stash / git stash pop", "guarda / recupera cambios"],
	["git clone <url>", "copia un repositorio remoto"],
	["git fetch / git pull / git push", "sincroniza con el remoto"],
	["git remote -v | add <n> <url>", "gestiona remotos"],
	["gh repo fork | gh pr create", "fork y pull request (GitHub CLI)"],
	["touch <archivo> / editar <archivo>", "crea o modifica un archivo"],
	["ls · clear · ayuda", "utilidades"],
];
