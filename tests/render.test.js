// Renderiza cada página en Node (SSR) para detectar errores o bucles de render.
import { createServer } from "vite";
const store = {};
globalThis.sessionStorage = globalThis.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => (store[k] = v), removeItem: (k) => delete store[k] };
globalThis.window = { location: { hash: "#/" }, addEventListener() {}, removeEventListener() {}, scrollTo() {} };
const server = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
const React = (await import("react")).default;
const { renderToString } = await import("react-dom/server");
const { default: LevelPage } = await server.ssrLoadModule("/src/pages/LevelPage.jsx");
const { LEVELS } = await server.ssrLoadModule("/src/levels.js");
for (const id of [...LEVELS.map((l) => l.id), "libre"]) {
	const t = Date.now();
	try {
		const html = renderToString(React.createElement(LevelPage, { id }));
		console.log("ok", id, html.length, Date.now() - t + "ms");
	} catch (e) {
		console.log("FAIL", id, e.message);
	}
}
await server.close();
