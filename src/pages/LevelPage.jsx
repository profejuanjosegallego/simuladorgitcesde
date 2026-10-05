import { useEffect, useMemo, useRef, useState } from "react";
import { createState, run, headCommit } from "../engine/git.js";
import { levelById, nextLevel, MODULES } from "../levels.js";
import Graph from "../components/Graph.jsx";
import Terminal, { HELP_TEXT } from "../components/Terminal.jsx";
import Files from "../components/Files.jsx";
import { Rich } from "../components/Rich.jsx";
import { completeLevel, getProgress, loadLevelState, saveLevelState } from "../store.js";

function initial(level) {
	return createState(level.setup);
}

function solve(level) {
	let st = initial(level);
	for (const c of level.solution) st = run(st, c).state;
	return st;
}

function welcome(level) {
	return [{ type: "info", text: `Nivel ${level.id}: ${level.title}. Escribe "ayuda" para ver los comandos.` }];
}

export default function LevelPage({ id }) {
	const level = levelById(id);
	const saved = useMemo(() => loadLevelState(id), [id]);
	const [st, setSt] = useState(() => saved?.st || initial(level));
	const [lines, setLines] = useState(() => saved?.lines || welcome(level));
	const [undo, setUndo] = useState([]);
	const [hints, setHints] = useState(0);
	const [modal, setModal] = useState(null); // "goal" | "done" | "solution"
	const [count, setCount] = useState(saved?.count || 0);
	const doneRef = useRef(!!getProgress().levels[id]);

	// Reinicia todo al cambiar de nivel.
	useEffect(() => {
		const s = loadLevelState(id);
		setSt(s?.st || initial(level));
		setLines(s?.lines || welcome(level));
		setCount(s?.count || 0);
		setUndo([]);
		setHints(0);
		setModal(null);
		doneRef.current = !!getProgress().levels[id];
		window.scrollTo(0, 0);
	}, [id]); // eslint-disable-line react-hooks/exhaustive-deps

	const start = useMemo(() => initial(level), [level]);
	const startChecks = useMemo(() => level.tasks.map((t) => !!t.check(start)), [level, start]);
	const checks = level.tasks.map((t) => !!t.check(st));
	const complete = level.tasks.length > 0 && checks.every(Boolean) && count > 0;
	const goal = useMemo(() => (modal === "goal" ? solve(level) : null), [modal, level]);

	useEffect(() => {
		saveLevelState(id, { st, lines: lines.slice(-200), count });
	}, [id, st, lines, count]);

	useEffect(() => {
		if (complete) {
			completeLevel(id, count);
			if (!doneRef.current) setModal("done");
			doneRef.current = true;
		}
	}, [complete]); // eslint-disable-line react-hooks/exhaustive-deps

	const repo = st.local;
	const branch = repo ? (repo.HEAD.type === "branch" ? repo.HEAD.name : headCommit(st, repo) || "HEAD") : null;
	const prompt = `docente@cesde ~/proyecto${branch ? ` (${branch}${repo.merge ? "|MERGING" : ""})` : ""}`;

	const reset = () => {
		setSt(initial(level));
		setLines([...welcome(level), { type: "ok", text: "Nivel reiniciado." }]);
		setUndo([]);
		setCount(0);
		saveLevelState(id, null);
	};

	const onCommand = (cmd) => {
		const c = cmd.trim();
		const echo = { type: "cmd", text: c, prompt };
		if (c === "clear" || c === "cls") return setLines([]);
		if (c === "ayuda" || c === "help" || c === "git help") return setLines((l) => [...l, echo, { type: "info", text: HELP_TEXT }]);
		if (c === "reiniciar" || c === "reset-level") return reset();
		if (c === "deshacer" || c === "undo") {
			if (!undo.length) return setLines((l) => [...l, echo, { type: "warn", text: "No hay nada que deshacer." }]);
			setSt(undo[undo.length - 1]);
			setUndo((u) => u.slice(0, -1));
			return setLines((l) => [...l, echo, { type: "ok", text: "Se deshizo el último comando." }]);
		}
		const r = run(st, c);
		setUndo((u) => [...u.slice(-49), st]);
		setSt(r.state);
		setCount((n) => n + 1);
		setLines((l) => [...l, echo, ...r.out]);
	};

	const mod = MODULES.find((m) => m.n === level.module);
	const next = nextLevel(id);
	const servers = Object.entries(st.servers);
	const showFiles = level.setup.strict || id === "3-3" || !!repo?.merge || id === "libre";

	return (
		<div className="level">
			<aside className="level-side">
				<nav className="crumbs"><a href="#/">Inicio</a> › {mod ? <span>Módulo {mod.n}</span> : <span>Práctica</span>}</nav>
				<div className="level-tag" style={{ background: mod?.color || "#2B0B3A" }}>{id === "libre" ? "Modo libre" : `Nivel ${level.id}`}</div>
				<h1>{level.title}</h1>
				{level.intro.map((p, i) => <p key={i}><Rich text={p} /></p>)}

				{level.tasks.length > 0 && (
					<div className="tasks">
						<h2>Objetivos</h2>
						<ul>
							{level.tasks.map((t, i) => (
								<li key={i} className={checks[i] ? "ok" : ""}>
									<span className="tick" aria-hidden>{checks[i] ? "✓" : ""}</span>
									<span><Rich text={t.text} />{startChecks[i] && <em className="cond"> · condición: mantenla</em>}</span>
								</li>
							))}
						</ul>
						<div className="progress-line"><span style={{ width: `${(checks.filter(Boolean).length / checks.length) * 100}%` }} /></div>
					</div>
				)}

				{level.hints.length > 0 && (
					<div className="hints">
						{level.hints.slice(0, hints).map((h, i) => <p key={i} className="hint">💡 <Rich text={h} /></p>)}
						{hints < level.hints.length && <button type="button" className="ghost" onClick={() => setHints(hints + 1)}>{hints ? "Otra pista" : "Necesito una pista"}</button>}
					</div>
				)}

				<div className="side-actions">
					<button type="button" onClick={() => onCommand("deshacer")} disabled={!undo.length}>↶ Deshacer</button>
					<button type="button" onClick={reset}>⟲ Reiniciar</button>
					{level.solution.length > 0 && <button type="button" onClick={() => setModal("goal")}>◎ Ver objetivo</button>}
					{level.solution.length > 0 && <button type="button" className="ghost" onClick={() => setModal("solution")}>Ver solución</button>}
				</div>
				{complete && (
					<div className="done-box">
						<strong>¡Nivel completado!</strong> en {count} comandos.
						{next ? <a className="btn" href={`#/nivel/${next.id}`}>Siguiente: {next.title} →</a> : <a className="btn" href="#/progreso">Ver mi progreso →</a>}
					</div>
				)}
			</aside>

			<section className="level-main">
				<div className={"graphs" + (servers.length ? " with-remote" : "")}>
					<Graph st={st} repo={repo} title="Tu computador" subtitle={repo ? "repositorio local" : ""} />
					{servers.map(([k, srv]) => (
						<Graph key={k} st={st} repo={srv} compact title={`GitHub · ${k}`} subtitle={st.urls[k]?.replace("https://", "")} />
					))}
				</div>
				{st.prs.length > 0 && (
					<div className="prs">
						{st.prs.map((p) => <span key={p.n} className="pr">⇄ PR #{p.n}: {p.head} → {p.target}/{p.base}</span>)}
					</div>
				)}
				{showFiles && <Files st={st} onCommand={onCommand} />}
				<Terminal lines={lines} onCommand={onCommand} prompt={prompt} />
				<p className="legend">
					<span><i style={{ background: "#2B0B3A" }} />main</span>
					<span><i style={{ background: "#D1007A" }} />develop</span>
					<span><i style={{ background: "#16A88C" }} />feature</span>
					<span><i style={{ background: "#E8960C" }} />release</span>
					<span><i style={{ background: "#E5484D" }} />hotfix</span>
					<span><b>*</b> rama actual (HEAD)</span>
					<span><i className="ring" />commit actual</span>
				</p>
			</section>

			{modal && (
				<div className="modal-bg" onClick={() => setModal(null)}>
					<div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
						<button type="button" className="close" onClick={() => setModal(null)} aria-label="Cerrar">×</button>
						{modal === "goal" && goal && (
							<>
								<h2>Así debería quedar</h2>
								<p className="muted">Los identificadores pueden variar; lo importante es la forma del grafo y dónde quedan las ramas.</p>
								<div className="graphs">
									<Graph st={goal} repo={goal.local} title="Tu computador" />
									{Object.entries(goal.servers).map(([k, srv]) => <Graph key={k} st={goal} repo={srv} compact title={`GitHub · ${k}`} />)}
								</div>
							</>
						)}
						{modal === "solution" && (
							<>
								<h2>Solución de referencia</h2>
								<p className="muted">Intenta primero con las pistas. Hay más de un camino correcto.</p>
								<ol className="solution">{level.solution.map((c, i) => <li key={i}><code>{c}</code></li>)}</ol>
							</>
						)}
						{modal === "done" && (
							<div className="celebrate">
								<div className="big">🎉</div>
								<h2>¡Nivel {level.id} completado!</h2>
								<p>Lo resolviste en <strong>{count}</strong> comandos. Tu progreso quedó guardado en este navegador.</p>
								<div className="row">
									<button type="button" className="ghost" onClick={() => setModal(null)}>Seguir explorando</button>
									{next ? <a className="btn" href={`#/nivel/${next.id}`}>Siguiente nivel →</a> : <a className="btn" href="#/progreso">Ver mi progreso →</a>}
								</div>
							</div>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
