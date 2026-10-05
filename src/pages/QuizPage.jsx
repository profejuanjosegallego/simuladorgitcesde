import { useEffect, useState } from "react";
import { QUIZZES } from "../quizzes.js";
import { MODULES } from "../levels.js";
import { saveQuiz } from "../store.js";

export default function QuizPage({ n }) {
	const qs = QUIZZES[n];
	const mod = MODULES.find((m) => String(m.n) === String(n));
	const [answers, setAnswers] = useState({});
	const [saved, setSaved] = useState(false);
	useEffect(() => { setAnswers({}); setSaved(false); window.scrollTo(0, 0); }, [n]);
	const answered = Object.keys(answers).length;
	const score = qs ? qs.filter((q, i) => answers[i] === q.a).length : 0;
	const finished = !!qs && answered === qs.length;
	useEffect(() => {
		if (finished && !saved) { saveQuiz(n, score, qs.length); setSaved(true); }
	}, [finished, saved, n, score, qs]);

	if (!qs) return <div className="page"><p>Cuestionario no encontrado. <a href="#/">Volver</a></p></div>;
	return (
		<div className="page quiz">
			<nav className="crumbs"><a href="#/">Inicio</a> › Cuestionario</nav>
			<p className="kicker" style={{ color: mod.color }}>Nivel {mod.n} · {mod.title}</p>
			<h1>Verifica lo aprendido</h1>
			<p className="muted">Elige una respuesta en cada pregunta; verás la explicación al instante.</p>
			{qs.map((q, i) => {
				const a = answers[i];
				return (
					<fieldset key={i} className="q">
						<legend><span className="qn">{i + 1}</span>{q.q}</legend>
						<div className="opts">
							{q.o.map((o, j) => {
								const cls = a === undefined ? "" : j === q.a ? "right" : j === a ? "wrong" : "dim";
								return (
									<button key={j} type="button" className={"opt " + cls} disabled={a !== undefined} onClick={() => setAnswers({ ...answers, [i]: j })}>
										<span className="letter">{"ABCD"[j]}</span>{o}
									</button>
								);
							})}
						</div>
						{a !== undefined && <p className={"expl " + (a === q.a ? "ok" : "no")}>{a === q.a ? "✓ ¡Correcto! " : "✗ No exactamente. "}{q.e}</p>}
					</fieldset>
				);
			})}
			{finished && (
				<div className="quiz-result">
					<strong>{score} / {qs.length}</strong>
					<p>{score === qs.length ? "¡Excelente! Dominas este nivel." : score >= qs.length * 0.7 ? "¡Muy bien! Repasa las explicaciones de las que fallaste." : "Vale la pena repasar la presentación y practicar los niveles de este módulo."}</p>
					<div className="row">
						<button type="button" className="ghost" onClick={() => { setAnswers({}); setSaved(false); }}>Intentar de nuevo</button>
						{Number(n) < 4 ? <a className="btn" href={`#/nivel/${Number(n) + 1}-1`}>Ir al nivel {Number(n) + 1} →</a> : <a className="btn" href="#/progreso">Ver mi progreso →</a>}
					</div>
				</div>
			)}
		</div>
	);
}
