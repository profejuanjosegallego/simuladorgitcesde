// Verifica que la solución de referencia de cada nivel cumpla todas las tareas
// y que ningún nivel empiece ya resuelto.
import { createState, run } from "../src/engine/git.js";
import { LEVELS } from "../src/levels.js";

let failures = 0;
for (const lv of LEVELS) {
	let st = createState(lv.setup);
	const pre = lv.tasks.filter((t) => t.check(st)).length;
	const errors = [];
	for (const cmd of lv.solution) {
		const r = run(st, cmd);
		if (!r.ok) errors.push(`${cmd} → ${r.out.map((o) => o.text).join(" | ")}`);
		st = r.state;
	}
	const res = lv.tasks.map((t) => [t.text, !!t.check(st)]);
	const ok = res.every(([, v]) => v) && pre < lv.tasks.length && !errors.length;
	if (!ok) failures++;
	console.log(`${ok ? "✔" : "✘"} ${lv.id} ${lv.title}  (tareas al inicio: ${pre}/${lv.tasks.length})`);
	if (!ok) {
		errors.forEach((e) => console.log("    ERROR:", e));
		res.filter(([, v]) => !v).forEach(([t]) => console.log("    FALTA:", t));
	}
}
console.log(failures ? `\n${failures} nivel(es) con fallas` : "\nTodos los niveles son resolubles.");
process.exit(failures ? 1 : 0);
