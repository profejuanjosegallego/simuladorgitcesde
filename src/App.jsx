import { useEffect, useState } from "react";
import Home from "./pages/Home.jsx";
import LevelPage from "./pages/LevelPage.jsx";
import QuizPage from "./pages/QuizPage.jsx";
import ProgressPage from "./pages/ProgressPage.jsx";
import GuidePage from "./pages/GuidePage.jsx";
import { levelById } from "./levels.js";

function useHash() {
	const [hash, setHash] = useState(() => window.location.hash || "#/");
	useEffect(() => {
		const on = () => setHash(window.location.hash || "#/");
		window.addEventListener("hashchange", on);
		return () => window.removeEventListener("hashchange", on);
	}, []);
	return hash.replace(/^#/, "");
}

export default function App() {
	const path = useHash();
	let page;
	let m;
	if ((m = path.match(/^\/nivel\/([\w-]+)/)) && levelById(m[1])) page = <LevelPage id={m[1]} />;
	else if (path === "/libre") page = <LevelPage id="libre" />;
	else if ((m = path.match(/^\/quiz\/(\d)/))) page = <QuizPage n={m[1]} />;
	else if (path === "/progreso") page = <ProgressPage />;
	else if (path === "/guia") page = <GuidePage />;
	else page = <Home />;

	const link = (href, label) => <a href={href} className={path === href.slice(1) || (href !== "#/" && path.startsWith(href.slice(1))) ? "active" : ""}>{label}</a>;

	return (
		<>
			<header className="top no-print">
				<a href="#/" className="brand">
					<img src="/cesde-blanco.png" alt="CESDE" />
					<span>Consultor Tech <b>· Git</b></span>
				</a>
				<nav>
					{link("#/", "Inicio")}
					{link("#/libre", "Modo libre")}
					{link("#/guia", "Guía")}
					{link("#/progreso", "Mi progreso")}
				</nav>
			</header>
			<main>{page}</main>
			<footer className="no-print">
				Consultor Tech · CESDE · Inspirado en <a href="https://learngitbranching.js.org/?locale=es_ES" target="_blank" rel="noreferrer">Learn Git Branching</a>. Simulador educativo: los comandos no modifican ningún repositorio real.
			</footer>
		</>
	);
}
