import { HELP } from "../engine/git.js";

const TYPES = [
	["feat", "Nueva funcionalidad"], ["fix", "Corrección de un error"], ["docs", "Documentación"], ["style", "Formato, sin cambiar lógica"],
	["refactor", "Reestructura sin cambiar comportamiento"], ["test", "Pruebas"], ["perf", "Rendimiento"], ["build / ci", "Compilación y pipelines"], ["chore", "Mantenimiento"],
];

const GLOSSARY = [
	["Repositorio", "Carpeta de un proyecto con todo su historial de cambios (.git)."],
	["Commit", "Foto instantánea del proyecto con autor, fecha, mensaje y padre(s)."],
	["Staging", "Área de preparación donde eliges qué entra en el próximo commit."],
	["Rama", "Etiqueta móvil que apunta a un commit; permite trabajar en paralelo."],
	["HEAD", "Indica dónde estás: normalmente en una rama; si apunta a un commit, está “desacoplado”."],
	["Merge", "Integra el trabajo de una rama en otra."],
	["Rebase", "Copia tus commits para que partan de otro punto; deja la historia lineal."],
	["Remoto (origin)", "Copia del repositorio en un servidor como GitHub."],
	["Fork", "Copia de un repositorio ajeno en tu cuenta de GitHub."],
	["Pull request", "Propuesta para integrar los cambios de una rama, con revisión."],
	["Tag", "Etiqueta fija para marcar versiones, por ejemplo v1.2.0."],
	["GitFlow", "Estrategia con ramas main, develop, feature/*, release/* y hotfix/*."],
];

export default function GuidePage() {
	return (
		<div className="page guide">
			<nav className="crumbs"><a href="#/">Inicio</a> › Guía rápida</nav>
			<h1>Guía rápida</h1>
			<div className="guide-grid">
				<section>
					<h2>Comandos del simulador</h2>
					<table className="detail">
						<tbody>{HELP.map(([c, d]) => <tr key={c}><td><code>{c}</code></td><td>{d}</td></tr>)}</tbody>
					</table>
				</section>
				<section>
					<h2>Conventional Commits</h2>
					<p><code>tipo(alcance): descripción en imperativo</code></p>
					<table className="detail">
						<tbody>{TYPES.map(([t, d]) => <tr key={t}><td><code>{t}</code></td><td>{d}</td></tr>)}</tbody>
					</table>
					<h2>GitFlow en una tabla</h2>
					<table className="detail">
						<thead><tr><th>Rama</th><th>Sale de</th><th>Se integra en</th></tr></thead>
						<tbody>
							<tr><td><code>feature/*</code></td><td>develop</td><td>develop</td></tr>
							<tr><td><code>release/*</code></td><td>develop</td><td>main (tag) y develop</td></tr>
							<tr><td><code>hotfix/*</code></td><td>main</td><td>main (tag) y develop</td></tr>
						</tbody>
					</table>
				</section>
			</div>
			<h2>Glosario</h2>
			<dl className="glossary">{GLOSSARY.map(([t, d]) => <div key={t}><dt>{t}</dt><dd>{d}</dd></div>)}</dl>
		</div>
	);
}
