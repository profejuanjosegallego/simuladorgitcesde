// Texto con `código` en línea.
export function Rich({ text }) {
	const parts = text.split(/(`[^`]+`)/g);
	return parts.map((p, i) => (p.startsWith("`") && p.endsWith("`") ? <code key={i}>{p.slice(1, -1)}</code> : <span key={i}>{p}</span>));
}
