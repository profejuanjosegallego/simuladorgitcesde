import { useEffect, useRef, useState } from "react";
import { HELP } from "../engine/git.js";

const COMMANDS = ["git init", "git status", "git add ", "git commit -m \"", "git log --oneline", "git branch ", "git switch ", "git switch -c ", "git switch --detach ", "git checkout ", "git merge ", "git merge --no-ff ", "git rebase ", "git cherry-pick ", "git reset --hard ", "git reset --soft ", "git revert ", "git tag ", "git stash", "git stash pop", "git clone ", "git fetch", "git pull", "git push", "git push -u origin ", "git remote -v", "git remote add ", "git restore ", "git restore --staged ", "git diff", "gh repo fork", "gh pr create --base ", "editar ", "touch ", "ayuda", "clear"];

export default function Terminal({ lines, onCommand, prompt, disabled, autoFocus = true }) {
	const [value, setValue] = useState("");
	const [hist, setHist] = useState([]);
	const [hi, setHi] = useState(-1);
	const bodyRef = useRef(null);
	const inputRef = useRef(null);

	useEffect(() => {
		const b = bodyRef.current;
		if (b) b.scrollTop = b.scrollHeight;
	}, [lines]);
	useEffect(() => { if (autoFocus) inputRef.current?.focus({ preventScroll: true }); }, [autoFocus]);

	const submit = (e) => {
		e.preventDefault();
		const v = value.trim();
		if (!v || disabled) return;
		setHist((h) => [v, ...h].slice(0, 100));
		setHi(-1);
		setValue("");
		onCommand(v);
	};

	const onKey = (e) => {
		if (e.key === "ArrowUp") {
			e.preventDefault();
			const n = Math.min(hi + 1, hist.length - 1);
			if (n >= 0) { setHi(n); setValue(hist[n]); }
		} else if (e.key === "ArrowDown") {
			e.preventDefault();
			const n = hi - 1;
			setHi(n);
			setValue(n >= 0 ? hist[n] : "");
		} else if (e.key === "Tab") {
			e.preventDefault();
			const m = COMMANDS.filter((c) => c.startsWith(value) && c !== value);
			if (m.length === 1) setValue(m[0]);
			else if (m.length > 1) {
				let p = m[0];
				for (const c of m) while (!c.startsWith(p)) p = p.slice(0, -1);
				if (p.length > value.length) setValue(p);
			}
		}
	};

	return (
		<div className="terminal" onClick={() => inputRef.current?.focus({ preventScroll: true })}>
			<div className="terminal-bar">
				<span className="dot r" /><span className="dot y" /><span className="dot g" />
				<span className="terminal-title">terminal — Git Bash (simulado)</span>
			</div>
			<div className="terminal-body" aria-live="polite" ref={bodyRef}>
				{lines.map((l, i) => (
					<div key={i} className={"tl tl-" + l.type}>
						{l.type === "cmd" ? (<><span className="tl-prompt">{l.prompt} $ </span>{l.text}</>) : l.text}
					</div>
				))}
				<form onSubmit={submit} className="terminal-input">
					<label htmlFor="cmd" className="tl-prompt">{prompt} $&nbsp;</label>
					<input
						id="cmd" ref={inputRef} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={onKey}
						autoComplete="off" autoCapitalize="off" spellCheck={false} disabled={disabled} aria-label="Escribe un comando de git"
						placeholder={lines.length < 3 ? "escribe un comando, por ejemplo: git status" : ""}
					/>
				</form>
			</div>
		</div>
	);
}

export const HELP_TEXT = "Comandos disponibles:\n" + HELP.map(([c, d]) => `  ${c.padEnd(36)} ${d}`).join("\n") + "\n\nAtajos: ↑/↓ historial · Tab autocompletar · clear limpiar";
