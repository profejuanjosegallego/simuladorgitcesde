// Persistencia local (solo en este navegador). Toda lectura/escritura tolera fallos:
// en modo privado o con almacenamiento bloqueado la plataforma sigue funcionando sin guardar.
const KEY = "consultortech-gitflow-v1";

function read() {
	try {
		return JSON.parse(localStorage.getItem(KEY)) || {};
	} catch {
		return {};
	}
}

function write(data) {
	try {
		localStorage.setItem(KEY, JSON.stringify(data));
	} catch {
		/* almacenamiento no disponible */
	}
}

export function getProgress() {
	const d = read();
	return { levels: d.levels || {}, quizzes: d.quizzes || {}, name: d.name || "" };
}

export function completeLevel(id, commands) {
	const d = read();
	d.levels = d.levels || {};
	const prev = d.levels[id];
	d.levels[id] = { at: prev?.at || new Date().toISOString(), best: Math.min(prev?.best ?? Infinity, commands) };
	write(d);
}

export function saveQuiz(n, score, total) {
	const d = read();
	d.quizzes = d.quizzes || {};
	const prev = d.quizzes[n];
	d.quizzes[n] = { best: Math.max(prev?.best || 0, score), total, at: new Date().toISOString() };
	write(d);
}

export function saveName(name) {
	const d = read();
	d.name = name;
	write(d);
}

export function resetProgress() {
	write({});
}

// Estado en curso de un nivel, para no perderlo al recargar.
export function loadLevelState(id) {
	try {
		return JSON.parse(sessionStorage.getItem(`${KEY}-lv-${id}`));
	} catch {
		return null;
	}
}

export function saveLevelState(id, data) {
	try {
		if (data) sessionStorage.setItem(`${KEY}-lv-${id}`, JSON.stringify(data));
		else sessionStorage.removeItem(`${KEY}-lv-${id}`);
	} catch {
		/* sin almacenamiento */
	}
}
