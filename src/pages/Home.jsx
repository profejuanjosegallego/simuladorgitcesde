import { LEVELS, MODULES } from "../levels.js";
import { QUIZZES } from "../quizzes.js";
import { getProgress } from "../store.js";

export default function Home() {
	const p = getProgress();
	const done = LEVELS.filter((l) => p.levels[l.id]).length;
	const next = LEVELS.find((l) => !p.levels[l.id]);
	return (
		<div className="home">
			<section className="hero">
				<div className="hero-text">
					<p className="kicker">Consultor Tech · CESDE</p>
					<h1>Practica Git, GitHub y GitFlow escribiendo comandos de verdad</h1>
					<p className="lead">Una terminal simulada dibuja tu repositorio en vivo. Cada nivel valida automáticamente lo que haces, desde tu primer commit hasta un hotfix con GitFlow.</p>
					<div className="row">
						<a className="btn" href={`#/nivel/${next ? next.id : "1-1"}`}>{done ? "Continuar donde iba →" : "Empezar desde cero →"}</a>
						<a className="btn ghost light" href="#/libre">Modo libre</a>
					</div>
				</div>
				<div className="hero-card">
					<div className="stat"><strong>{done}</strong><span>de {LEVELS.length} niveles</span></div>
					<div className="bar"><span style={{ width: `${(done / LEVELS.length) * 100}%` }} /></div>
					<div className="stat small"><strong>{Object.keys(p.quizzes).length}</strong><span>de 4 cuestionarios</span></div>
					<a href="#/progreso" className="link">Ver mi progreso →</a>
				</div>
			</section>

			<section className="how">
				{[
					["1", "Lee el reto", "Cada nivel plantea una situación real de un equipo de desarrollo."],
					["2", "Escribe comandos", "Usa la terminal como en Git Bash. El grafo se actualiza al instante."],
					["3", "Valida tu avance", "Los objetivos se marcan solos. Si te atascas, pide una pista."],
				].map(([n, t, x]) => (
					<div key={n} className="how-step"><span className="num">{n}</span><div><strong>{t}</strong><p>{x}</p></div></div>
				))}
			</section>

			<section className="modules">
				{MODULES.map((m) => {
					const lv = LEVELS.filter((l) => l.module === m.n);
					const md = lv.filter((l) => p.levels[l.id]).length;
					const qz = p.quizzes[m.n];
					return (
						<article key={m.n} className="module">
							<header style={{ background: m.color }}>
								<span className="mnum">Nivel {m.n}</span>
								<h2>{m.title}</h2>
								<p>{m.sub}</p>
								<span className="mprog">{md}/{lv.length}</span>
							</header>
							<ol>
								{lv.map((l) => (
									<li key={l.id}>
										<a href={`#/nivel/${l.id}`} className={p.levels[l.id] ? "done" : ""}>
											<span className="lid">{l.id}</span>
											<span>{l.title}</span>
											<span className="state">{p.levels[l.id] ? "✓" : "→"}</span>
										</a>
									</li>
								))}
							</ol>
							<a className="quiz-link" href={`#/quiz/${m.n}`}>
								📝 Cuestionario ({QUIZZES[m.n].length} preguntas){qz ? ` · mejor: ${qz.best}/${qz.total}` : ""}
							</a>
						</article>
					);
				})}
			</section>
		</div>
	);
}
