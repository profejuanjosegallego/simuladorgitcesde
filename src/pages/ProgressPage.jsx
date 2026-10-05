import { useState } from "react";
import { LEVELS, MODULES } from "../levels.js";
import { QUIZZES } from "../quizzes.js";
import { getProgress, resetProgress, saveName } from "../store.js";

const fmt = (iso) => new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric" });

export default function ProgressPage() {
	const [p, setP] = useState(getProgress());
	const [name, setName] = useState(p.name);
	const [confirm, setConfirm] = useState(false);
	const done = LEVELS.filter((l) => p.levels[l.id]).length;
	const quizOk = Object.values(p.quizzes).length;
	const all = done === LEVELS.length && quizOk === 4;

	return (
		<div className="page progress">
			<nav className="crumbs no-print"><a href="#/">Inicio</a> › Mi progreso</nav>
			<h1 className="no-print">Mi progreso</h1>
			<p className="muted no-print">Se guarda solo en este navegador. Para presentar evidencia, escribe tu nombre e imprime la constancia (o guárdala como PDF).</p>

			<label className="name no-print">
				Nombre completo
				<input value={name} onChange={(e) => { setName(e.target.value); saveName(e.target.value); }} placeholder="Ej.: Ana María Pérez" />
			</label>

			<div className="certificate">
				<img src="/cesde-oscuro.png" alt="CESDE" className="cert-logo" />
				<p className="kicker">Consultor Tech · Constancia de práctica</p>
				<h2>{name || "Nombre del docente"}</h2>
				<p>completó <strong>{done} de {LEVELS.length}</strong> retos prácticos y <strong>{quizOk} de 4</strong> cuestionarios de la ruta <strong>Git, GitHub y GitFlow</strong>.</p>
				<div className="cert-mods">
					{MODULES.map((m) => {
						const lv = LEVELS.filter((l) => l.module === m.n);
						const d = lv.filter((l) => p.levels[l.id]).length;
						const q = p.quizzes[m.n];
						return (
							<div key={m.n} className="cert-mod">
								<div className="cm-head" style={{ color: m.color }}>Nivel {m.n} · {m.title}</div>
								<div className="bar"><span style={{ width: `${(d / lv.length) * 100}%`, background: m.color }} /></div>
								<div className="muted">{d}/{lv.length} retos · cuestionario {q ? `${q.best}/${q.total}` : "pendiente"}</div>
							</div>
						);
					})}
				</div>
				<p className="cert-date">{all ? "Ruta completa · " : ""}Generada el {fmt(new Date().toISOString())}</p>
			</div>

			<div className="row no-print">
				<button type="button" className="btn" onClick={() => window.print()}>🖨 Imprimir / guardar PDF</button>
				{!confirm ? (
					<button type="button" className="ghost" onClick={() => setConfirm(true)}>Borrar mi progreso</button>
				) : (
					<>
						<span className="warn-text">¿Seguro? Esto no se puede deshacer.</span>
						<button type="button" className="danger" onClick={() => { resetProgress(); setP(getProgress()); setName(""); setConfirm(false); }}>Sí, borrar</button>
						<button type="button" className="ghost" onClick={() => setConfirm(false)}>Cancelar</button>
					</>
				)}
			</div>

			<h2 className="no-print">Detalle por reto</h2>
			<table className="detail no-print">
				<thead><tr><th>Reto</th><th>Estado</th><th>Mejor marca</th></tr></thead>
				<tbody>
					{LEVELS.map((l) => (
						<tr key={l.id}>
							<td><a href={`#/nivel/${l.id}`}>{l.id} · {l.title}</a></td>
							<td>{p.levels[l.id] ? `✓ ${fmt(p.levels[l.id].at)}` : "Pendiente"}</td>
							<td>{p.levels[l.id] ? `${p.levels[l.id].best} comandos` : "—"}</td>
						</tr>
					))}
					{Object.keys(QUIZZES).map((n) => (
						<tr key={"q" + n}>
							<td><a href={`#/quiz/${n}`}>Cuestionario nivel {n}</a></td>
							<td>{p.quizzes[n] ? `✓ ${fmt(p.quizzes[n].at)}` : "Pendiente"}</td>
							<td>{p.quizzes[n] ? `${p.quizzes[n].best}/${p.quizzes[n].total}` : "—"}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
