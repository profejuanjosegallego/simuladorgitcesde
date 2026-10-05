import { useMemo } from "react";
import { reachableInRepo, headCommit } from "../engine/git.js";

// Colores por tipo de rama (los mismos de las presentaciones).
const COLORS = { main: "#2B0B3A", develop: "#D1007A", feature: "#16A88C", release: "#E8960C", hotfix: "#E5484D", other: ["#9E005C", "#6E56CF", "#0F8C74", "#D1007A"] };

function kind(name) {
	const n = name.replace(/^[\w-]+\//, (m) => (/^(origin|upstream)\//.test(m) ? "" : m));
	if (/^(main|master)$/.test(n)) return "main";
	if (/^develop$/.test(n)) return "develop";
	if (/^(feature|feat)\//.test(n)) return "feature";
	if (/^release\//.test(n)) return "release";
	if (/^(hotfix|fix)\//.test(n)) return "hotfix";
	return "other";
}
// Orden visual de carriles (como en el diagrama de GitFlow) y orden en que las ramas reclaman su historia.
const PRIORITY = { main: 0, hotfix: 1, release: 2, develop: 3, other: 4, feature: 5 };
const CLAIM = { main: 0, develop: 1, hotfix: 2, release: 3, other: 4, feature: 5 };

export function layoutGraph(st, repo, isLocal = true) {
	const ids = [...reachableInRepo(st, repo)];
	const set = new Set(ids);
	// Profundidad = 1 + máxima profundidad de los padres.
	const depth = {};
	const dfs = (id) => {
		if (depth[id] !== undefined) return depth[id];
		const ps = (st.commits[id].parents || []).filter((p) => set.has(p));
		depth[id] = ps.length ? Math.max(...ps.map(dfs)) + 1 : 0;
		return depth[id];
	};
	ids.forEach(dfs);

	// Referencias ordenadas por prioridad para asignar carriles.
	const refs = [];
	for (const [b, id] of Object.entries(repo.branches)) refs.push({ name: b, id, k: kind(b), c: CLAIM[kind(b)], p: PRIORITY[kind(b)] });
	for (const [b, id] of Object.entries(repo.remoteRefs || {})) {
		const k = kind(b.split("/").slice(1).join("/"));
		refs.push({ name: b, id, k, c: 10 + CLAIM[k], p: 10 + PRIORITY[k] });
	}
	for (const [t, id] of Object.entries(repo.tags || {})) refs.push({ name: t, id, k: "other", c: 20, p: 20 });
	if (repo.HEAD.type === "detached") refs.push({ name: "HEAD", id: repo.HEAD.id, k: "other", c: 30, p: 30 });
	refs.sort((a, b) => a.c - b.c || a.name.localeCompare(b.name));

	const lane = {};
	const lanes = [];
	for (const r of refs) {
		let c = r.id;
		let created = null;
		while (c && set.has(c) && lane[c] === undefined) {
			if (created === null) { created = lanes.length; lanes.push({ k: r.k, p: r.p, name: r.name }); }
			lane[c] = created;
			c = st.commits[c].parents[0];
		}
	}
	for (const id of ids) if (lane[id] === undefined) { lane[id] = lanes.length; lanes.push({ k: "other", p: 40 }); }
	const order = lanes.map((l, i) => i).sort((a, b) => lanes[a].p - lanes[b].p || a - b);
	const row = {};
	order.forEach((li, r) => (row[li] = r));

	// Etiquetas por commit.
	const labels = {};
	const add = (id, l) => { if (set.has(id)) (labels[id] = labels[id] || []).push(l); };
	const cur = isLocal && repo.HEAD.type === "branch" ? repo.HEAD.name : null;
	for (const [b, id] of Object.entries(repo.branches)) add(id, { text: b + (b === cur ? "*" : ""), type: "branch", k: kind(b), head: b === cur });
	for (const [b, id] of Object.entries(repo.remoteRefs || {})) add(id, { text: b, type: "remote", k: kind(b.split("/").slice(1).join("/")) });
	for (const [t, id] of Object.entries(repo.tags || {})) add(id, { text: t, type: "tag" });
	if (repo.HEAD.type === "detached") add(repo.HEAD.id, { text: "HEAD", type: "head" });
	const maxLabels = Math.max(1, ...Object.values(labels).map((l) => l.length));

	const colorOf = (li) => {
		const l = lanes[li];
		return l.k === "other" ? COLORS.other[li % COLORS.other.length] : COLORS[l.k];
	};
	return { ids, depth, lane, row, lanes, labels, maxLabels, colorOf, head: isLocal ? headCommit(st, repo) : null };
}

export default function Graph({ st, repo, title, subtitle, compact = false, highlight }) {
	const L = useMemo(() => (repo ? layoutGraph(st, repo, !compact) : null), [st, repo, compact]);
	if (!repo) {
		return (
			<div className="graph graph-empty">
				{title && <div className="graph-title">{title}</div>}
				<p>Aún no hay repositorio aquí.<br /><span className="muted">Usa <code>git init</code> o <code>git clone</code>.</span></p>
			</div>
		);
	}
	const dx = compact ? 64 : 84;
	const r = compact ? 15 : 19;
	const dy = (compact ? 44 : 52) + L.maxLabels * 20;
	const padX = 46, padY = 34;
	const maxDepth = Math.max(0, ...L.ids.map((id) => L.depth[id]));
	const rows = Math.max(1, ...Object.values(L.row).map((x) => x + 1));
	const W = padX * 2 + maxDepth * dx + 90;
	const H = padY + rows * dy + 10;
	const pos = (id) => ({ x: padX + L.depth[id] * dx, y: padY + L.row[L.lane[id]] * dy });

	const edges = [];
	for (const id of L.ids) {
		const c = st.commits[id];
		c.parents.forEach((p, i) => {
			if (!L.depth.hasOwnProperty(p)) return;
			const a = pos(p), b = pos(id);
			const d = a.y === b.y ? `M${a.x},${a.y} L${b.x},${b.y}` : `M${a.x},${a.y} C${a.x + dx * 0.6},${a.y} ${b.x - dx * 0.6},${b.y} ${b.x},${b.y}`;
			edges.push({ key: `${p}-${id}`, d, merge: i > 0, color: L.colorOf(L.lane[i > 0 ? p : id]) });
		});
	}

	return (
		<div className={"graph" + (compact ? " graph-compact" : "")}>
			{title && (
				<div className="graph-title">
					{title} {subtitle && <span className="muted">{subtitle}</span>}
				</div>
			)}
			<div className="graph-scroll">
				<svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Grafo de commits ${title || ""}`}>
					{edges.map((e) => (
						<path key={e.key} className="edge" style={{ d: `path("${e.d}")` }} d={e.d} stroke={e.color} strokeDasharray={e.merge ? "6 5" : undefined} />
					))}
					{L.ids.map((id) => {
						const p = pos(id);
						const color = L.colorOf(L.lane[id]);
						const isHead = id === L.head;
						const labels = L.labels[id] || [];
						return (
							<g key={id} className={"commit" + (highlight === id ? " hl" : "")} style={{ transform: `translate(${p.x}px, ${p.y}px)` }}>
								<title>{`${id}: ${st.commits[id].msg}`}</title>
								{isHead && <circle r={r + 6} className="head-ring" />}
								<circle r={r} fill={color} className="dot" />
								<text className="cid" textAnchor="middle" dy="0.35em" fontSize={compact ? 10 : 11}>{id}</text>
								{labels.map((l, i) => {
									const w = Math.max(40, l.text.length * 7 + 14);
									const y = r + 8 + i * 20;
									const fill = l.type === "branch" ? COLORS[l.k] || COLORS.other[0] : l.type === "head" ? "#2EC4A6" : "#fff";
									const cls = `ref ref-${l.type}` + (l.head ? " ref-current" : "");
									return (
										<g key={l.text} className={cls} transform={`translate(${-w / 2}, ${y})`}>
											<rect width={w} height={17} rx={8.5} fill={l.type === "branch" || l.type === "head" ? fill : "#fff"} stroke={l.type === "remote" ? COLORS[l.k] || "#7A6F86" : l.type === "tag" ? "#2B0B3A" : "none"} strokeDasharray={l.type === "remote" ? "3 2" : undefined} />
											<text x={w / 2} y={12.5} textAnchor="middle" fill={l.type === "branch" ? (l.k === "feature" || l.k === "release" ? "#1E0A29" : "#fff") : l.type === "head" ? "#1E0A29" : "#2B0B3A"}>
												{l.text}
											</text>
										</g>
									);
								})}
							</g>
						);
					})}
				</svg>
			</div>
		</div>
	);
}
