import { fileStatus } from "../engine/git.js";

const LABEL = {
	untracked: ["Sin seguimiento", "untracked"],
	modified: ["Modificado", "modified"],
	deleted: ["Eliminado", "deleted"],
	staged: ["Preparado", "staged"],
	"staged+modified": ["Preparado y modificado", "staged"],
	clean: ["Confirmado", "clean"],
	conflict: ["¡Conflicto!", "conflict"],
};

// Panel de archivos: muestra las tres áreas de Git y permite resolver conflictos.
export default function Files({ st, onCommand }) {
	const repo = st.local;
	const pending = !repo && st.pendingFiles ? Object.keys(st.pendingFiles) : null;
	const list = (repo ? fileStatus(st, repo) : (pending || []).map((f) => ({ file: f, state: "untracked" })))
		.filter((f) => !(/^trabajo-\d+\.txt$/.test(f.file) && f.state === "clean"));
	if (!list.length) return null;
	return (
		<div className="files">
			<div className="files-head">
				<strong>Archivos del proyecto</strong>
				<span className="muted">{repo ? "estado según git status" : "carpeta sin repositorio"}</span>
			</div>
			<ul>
				{list.map((f) => {
					const [txt, cls] = LABEL[f.state] || [f.state, "clean"];
					const conflict = f.state === "conflict" ? repo.wd[f.file] : null;
					return (
						<li key={f.file} className={"file file-" + cls}>
							<div className="file-row">
								<span className="file-name">📄 {f.file}</span>
								<span className={"chip chip-" + cls}>{txt}</span>
								{repo && f.state !== "conflict" && (
									<span className="file-actions">
										<button type="button" className="mini" onClick={() => onCommand(`editar ${f.file}`)} title="Simula que editas el archivo">editar</button>
										{["untracked", "modified", "deleted", "staged+modified"].includes(f.state) && (
											<button type="button" className="mini" onClick={() => onCommand(`git add ${f.file}`)}>git add</button>
										)}
									</span>
								)}
							</div>
							{conflict && (
								<div className="conflict">
									<pre>
										<span className="cm-ours">{"<<<<<<< HEAD (actual)\n"}</span>
										{`${conflict.ours}\n`}
										<span className="cm-sep">{"=======\n"}</span>
										{`${conflict.theirs}\n`}
										<span className="cm-theirs">{">>>>>>> (entrante)"}</span>
									</pre>
									<div className="conflict-actions">
										<button type="button" onClick={() => onCommand(`git checkout --ours ${f.file}`)}>Conservar actual</button>
										<button type="button" onClick={() => onCommand(`git checkout --theirs ${f.file}`)}>Conservar entrante</button>
									</div>
								</div>
							)}
						</li>
					);
				})}
			</ul>
		</div>
	);
}
