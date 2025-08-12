/*
Zombie Apocalypse Simulator — React Starter (single-file)
Placeable entities: humans, zombies, safe zones (max 5 each). Barricades supported.
Simulation: Zombies use multi-source BFS to chase humans. Humans greedily move toward nearest safe zone (BFS from safe zones).

How to use:
1. Create a React app (Vite or Create-React-App).
2. Replace src/App.jsx with this file's contents.
3. Optionally add Tailwind or just use the built-in CSS below.
4. npm start / yarn dev

This file is intentionally self-contained for quick prototyping.
*/

import React, { useEffect, useRef, useState } from "react";

// CONFIG
const DEFAULT_SIZE = 20;
const MAX_PLACEMENT = 5;
const CELL_SIZE = 26; // px

// cell types
const EMPTY = "empty";
const HUMAN = "human";
const ZOMBIE = "zombie";
const SAFE = "safe";
const BARRICADE = "barricade";

function createEmptyGrid(n) {
  return Array.from({ length: n }, () =>
    Array.from({ length: n }, () => ({ type: EMPTY }))
  );
}

function deepCopyGrid(g) {
  return g.map((row) => row.map((c) => ({ ...c })));
}

// Multi-source BFS (returns dist matrix)
function multiSourceBFS(sources, grid) {
  const n = grid.length;
  const INF = 1e9;
  const dist = Array.from({ length: n }, () => Array(n).fill(INF));
  const q = [];
  for (const s of sources) {
    dist[s.r][s.c] = 0;
    q.push([s.r, s.c]);
  }

  let qi = 0;
  const dirs = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  while (qi < q.length) {
    const [r, c] = q[qi++];
    for (const [dr, dc] of dirs) {
      const nr = r + dr,
        nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= n || nc >= n) continue;
      if (grid[nr][nc].type === BARRICADE) continue;
      if (dist[nr][nc] !== INF) continue;
      dist[nr][nc] = dist[r][c] + 1;
      q.push([nr, nc]);
    }
  }
  return dist;
}

export default function App() {
  const [size, setSize] = useState(DEFAULT_SIZE);
  const [grid, setGrid] = useState(() => createEmptyGrid(DEFAULT_SIZE));
  const [mode, setMode] = useState(HUMAN); // placement mode
  const [placed, setPlaced] = useState({ human: 0, zombie: 0, safe: 0 });
  const [running, setRunning] = useState(false);
  const [tickMs, setTickMs] = useState(400);
  const [turn, setTurn] = useState(0);
  const canvasRef = useRef(null);
  const intervalRef = useRef(null);

  // When size changes, recreate grid and reset placements
  useEffect(() => {
    setGrid(createEmptyGrid(size));
    setPlaced({ human: 0, zombie: 0, safe: 0 });
    setTurn(0);
    setRunning(false);
  }, [size]);

  // Draw grid to canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = size * CELL_SIZE;
    canvas.height = size * CELL_SIZE;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "12px monospace";

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const cell = grid[r][c];
        // background
        switch (cell.type) {
          case HUMAN:
            ctx.fillStyle = "#2563eb"; // blue
            break;
          case ZOMBIE:
            ctx.fillStyle = "#ef4444"; // red
            break;
          case SAFE:
            ctx.fillStyle = "#16a34a"; // green
            break;
          case BARRICADE:
            ctx.fillStyle = "#6b7280"; // gray
            break;
          default:
            ctx.fillStyle = "#f8fafc"; // white-ish
        }
        ctx.fillRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        ctx.strokeStyle = "#e6e6e6";
        ctx.strokeRect(c * CELL_SIZE, r * CELL_SIZE, CELL_SIZE, CELL_SIZE);

        // small label
        if (cell.type === HUMAN) ctx.fillStyle = "white";
        else if (cell.type === ZOMBIE) ctx.fillStyle = "white";
        else if (cell.type === SAFE) ctx.fillStyle = "white";
        else if (cell.type === BARRICADE) ctx.fillStyle = "white";
        else ctx.fillStyle = "#94a3b8";

        const label =
          cell.type === HUMAN
            ? "H"
            : cell.type === ZOMBIE
            ? "Z"
            : cell.type === SAFE
            ? "S"
            : cell.type === BARRICADE
            ? "#"
            : "";
        if (label) ctx.fillText(label, c * CELL_SIZE + CELL_SIZE / 2, r * CELL_SIZE + CELL_SIZE / 2);
      }
    }
  }, [grid, size]);

  // Click to place entities
  function handleCanvasClick(e) {
    if (running) return; // disable placing while running
    const rect = canvasRef.current.getBoundingClientRect();
    const x = Math.floor((e.clientX - rect.left) / CELL_SIZE);
    const y = Math.floor((e.clientY - rect.top) / CELL_SIZE);
    if (x < 0 || y < 0 || x >= size || y >= size) return;

    setGrid((prev) => {
      const ng = deepCopyGrid(prev);
      const current = ng[y][x];
      // toggle: if same type -> remove, else set new type
      if (current.type === mode) {
        // remove
        ng[y][x] = { type: EMPTY };
        setPlaced((p) => ({ ...p, [mode]: Math.max(0, p[mode] - 1) }));
      } else {
        // enforce limits for humans/zombies/safe
        if ((mode === HUMAN || mode === ZOMBIE || mode === SAFE) && placed[mode] >= MAX_PLACEMENT) {
          alert(`Max ${MAX_PLACEMENT} ${mode}s allowed`);
          return prev;
        }
        // if placing, and the cell had a counted type previously, decrement
        if (current.type === HUMAN || current.type === ZOMBIE || current.type === SAFE) {
          setPlaced((p) => ({ ...p, [current.type]: Math.max(0, p[current.type] - 1) }));
        }
        ng[y][x] = { type: mode };
        if (mode === HUMAN || mode === ZOMBIE || mode === SAFE) {
          setPlaced((p) => ({ ...p, [mode]: p[mode] + 1 }));
        }
      }
      return ng;
    });
  }

  // Extract positions helpers
  function collectPositions(type) {
    const res = [];
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (grid[r][c].type === type) res.push({ r, c });
    return res;
  }

  // Single simulation step
  function stepSimulation() {
    setGrid((prevGrid) => {
      const ng = deepCopyGrid(prevGrid);
      const humans = collectPositions(HUMAN);
      const zombies = collectPositions(ZOMBIE);
      const safes = collectPositions(SAFE);

      // 1) Humans move toward nearest safe (BFS map from safe zones)
      if (safes.length > 0 && humans.length > 0) {
        const distToSafe = multiSourceBFS(safes, ng);
        const dirs = [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ];

        // we'll compute moves and apply after to avoid conflicts
        const humanMoves = new Map(); // key = r,c -> target r,c
        for (const h of humans) {
          const { r, c } = h;
          // If already on safe, skip
          if (ng[r][c].type === SAFE) continue;
          let best = { dist: Infinity, pos: [r, c] };
          for (const [dr, dc] of dirs) {
            const nr = r + dr,
              nc = c + dc;
            if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
            if (ng[nr][nc].type === BARRICADE) continue;
            if (ng[nr][nc].type === ZOMBIE) continue; // avoid walking into zombie directly
            if (distToSafe[nr][nc] < best.dist) {
              best = { dist: distToSafe[nr][nc], pos: [nr, nc] };
            }
          }
          // only move if it gets closer
          if (best.dist < Infinity && best.dist < distToSafe[r][c]) {
            humanMoves.set(`${r},${c}`, best.pos);
          }
        }
        // apply human moves (simple conflict resolution: first come wins)
        const occupied = new Set();
        for (const [src, tgt] of humanMoves.entries()) {
          const [sr, sc] = src.split(",").map(Number);
          const [tr, tc] = tgt;
          const key = `${tr},${tc}`;
          if (occupied.has(key)) continue; // conflict
          if (ng[tr][tc].type === EMPTY || ng[tr][tc].type === SAFE) {
            ng[tr][tc] = { type: HUMAN };
            ng[sr][sc] = { type: EMPTY };
            occupied.add(key);
          }
        }
      }

      // 2) Zombies BFS toward humans (multi-source from zombies, but we want distances to humans so
      // compute multi-source from humans instead, and zombies pick neighbor with smaller dist)
      const humansNow = collectPositions(HUMAN);
      const zombiesNow = collectPositions(ZOMBIE);
      if (humansNow.length > 0 && zombiesNow.length > 0) {
        const distToHuman = multiSourceBFS(humansNow, ng);
        const dirs = [
          [-1, 0],
          [1, 0],
          [0, -1],
          [0, 1],
        ];
        // store zombie moves
        const zombieMoves = new Map();
        for (const z of zombiesNow) {
          const { r, c } = z;
          let best = { dist: distToHuman[r][c], pos: [r, c] };
          for (const [dr, dc] of dirs) {
            const nr = r + dr,
              nc = c + dc;
            if (nr < 0 || nc < 0 || nr >= size || nc >= size) continue;
            if (ng[nr][nc].type === BARRICADE) continue;
            // zombies can walk into humans
            if (distToHuman[nr][nc] < best.dist) {
              best = { dist: distToHuman[nr][nc], pos: [nr, nc] };
            }
          }
          if (best.pos[0] !== r || best.pos[1] !== c) {
            zombieMoves.set(`${r},${c}`, best.pos);
          }
        }
        // apply zombie moves (conflict resolution: first come wins). If zombie moves into human, human dies.
        const occupied = new Set();
        for (const [src, tgt] of zombieMoves.entries()) {
          const [sr, sc] = src.split(",").map(Number);
          const [tr, tc] = tgt;
          const key = `${tr},${tc}`;
          if (occupied.has(key)) continue;
          // if target has a human, remove the human
          if (ng[tr][tc].type === HUMAN) {
            ng[tr][tc] = { type: ZOMBIE };
            ng[sr][sc] = { type: EMPTY };
            occupied.add(key);
          } else if (ng[tr][tc].type === EMPTY || ng[tr][tc].type === SAFE) {
            ng[tr][tc] = { type: ZOMBIE };
            ng[sr][sc] = { type: EMPTY };
            occupied.add(key);
          }
        }
      }

      return ng;
    });

    setTurn((t) => t + 1);
  }

  // Auto-run loop
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        stepSimulation();
      }, tickMs);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, tickMs]);

  function startSimulation() {
    // validations: need at least one human and one zombie and a safe zone
    const humans = collectPositions(HUMAN).length;
    const zombies = collectPositions(ZOMBIE).length;
    const safes = collectPositions(SAFE).length;
    if (humans === 0) return alert("Place at least one human");
    if (zombies === 0) return alert("Place at least one zombie");
    if (safes === 0) return alert("Place at least one safe zone");
    setRunning(true);
  }

  function stopSimulation() {
    setRunning(false);
  }

  function resetSimulation() {
    setRunning(false);
    setGrid(createEmptyGrid(size));
    setPlaced({ human: 0, zombie: 0, safe: 0 });
    setTurn(0);
  }

  // Quick presets
  function presetRandom(params = { humans: 3, zombies: 3, safes: 1, barricadeDensity: 0.05 }) {
    setRunning(false);
    const ng = createEmptyGrid(size);
    const placeRandom = (type, count) => {
      let placed = 0;
      while (placed < count) {
        const r = Math.floor(Math.random() * size);
        const c = Math.floor(Math.random() * size);
        if (ng[r][c].type === EMPTY) {
          ng[r][c] = { type };
          placed++;
        }
      }
    };
    placeRandom(HUMAN, Math.min(params.humans, MAX_PLACEMENT));
    placeRandom(ZOMBIE, Math.min(params.zombies, MAX_PLACEMENT));
    placeRandom(SAFE, Math.min(params.safes, MAX_PLACEMENT));
    // barricades
    for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) if (Math.random() < params.barricadeDensity) ng[r][c] = { type: BARRICADE };

    setGrid(ng);
    setPlaced({ human: Math.min(params.humans, MAX_PLACEMENT), zombie: Math.min(params.zombies, MAX_PLACEMENT), safe: Math.min(params.safes, MAX_PLACEMENT) });
    setTurn(0);
  }

  // Stats
  const humanCount = collectPositions(HUMAN).length;
  const zombieCount = collectPositions(ZOMBIE).length;
  const safeCount = collectPositions(SAFE).length;

return (
  <div style={{ fontFamily: "Inter, Arial, sans-serif", padding: 16, maxWidth: "1200px", margin: "0 auto" }}>
    <h1 style={{ margin: 0, fontSize: "1.8rem", display: "flex", alignItems: "center", gap: 8 }}>
      🧟‍♀️ Zombie Apocalypse Simulator
    </h1>
    <p style={{ marginTop: 6, marginBottom: 16, color: "#555", fontSize: "0.95rem" }}>
      Place up to {MAX_PLACEMENT} humans, zombies, and safe zones. Click to toggle cell placement.  
      Press <strong>Start</strong> to run the simulation.
    </p>

    <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
      {/* Sidebar */}
      <div style={{ width: 300, background: "#f9fafb", borderRadius: 8, padding: 14, border: "1px solid #ddd" }}>
        <div style={{ marginBottom: 12 }}>
          <label><strong>Grid Size:</strong></label>
          <input
            type="number"
            value={size}
            min={6}
            max={60}
            onChange={(e) => setSize(Math.max(6, Math.min(60, Number(e.target.value) || DEFAULT_SIZE)))}
            style={{ marginLeft: 8, padding: 4, width: 60 }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label><strong>Placement Mode:</strong></label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            <button onClick={() => setMode(HUMAN)} style={{ padding: "6px 8px", background: mode === HUMAN ? "#2563eb" : "#eee", color: mode === HUMAN ? "white" : "black", borderRadius: 4 }}>Human</button>
            <button onClick={() => setMode(ZOMBIE)} style={{ padding: "6px 8px", background: mode === ZOMBIE ? "#ef4444" : "#eee", color: mode === ZOMBIE ? "white" : "black", borderRadius: 4 }}>Zombie</button>
            <button onClick={() => setMode(SAFE)} style={{ padding: "6px 8px", background: mode === SAFE ? "#16a34a" : "#eee", color: mode === SAFE ? "white" : "black", borderRadius: 4 }}>Safe</button>
            <button onClick={() => setMode(BARRICADE)} style={{ padding: "6px 8px", background: mode === BARRICADE ? "#6b7280" : "#eee", color: mode === BARRICADE ? "white" : "black", borderRadius: 4 }}>Barricade</button>
            <button onClick={() => setMode(EMPTY)} style={{ padding: "6px 8px", borderRadius: 4 }}>Erase</button>
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <button onClick={startSimulation} disabled={running} style={{ padding: "6px 10px", marginRight: 6 }}>Start</button>
          <button onClick={stopSimulation} disabled={!running} style={{ padding: "6px 10px", marginRight: 6 }}>Pause</button>
          <button onClick={resetSimulation} style={{ padding: "6px 10px" }}>Reset</button>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label><strong>Show Movement:</strong></label>
          <input
            type="range"
            min={50}
            max={1000}
            value={tickMs}
            onChange={(e) => setTickMs(Number(e.target.value))}
            style={{ marginLeft: 6, verticalAlign: "middle" }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <button onClick={() => presetRandom({ humans: 3, zombies: 3, safes: 1, barricadeDensity: 0.06 })} style={{ marginRight: 6 }}>Random</button>
          <button onClick={() => presetRandom({ humans: 1, zombies: 5, safes: 1, barricadeDensity: 0.02 })}>Hard</button>
        </div>

        <div style={{ background: "#fff", borderRadius: 6, padding: 8, border: "1px solid #ddd" }}>
          <div><strong>Turn:</strong> {turn}</div>
          <div><strong>Humans:</strong> {humanCount} / {MAX_PLACEMENT}</div>
          <div><strong>Zombies:</strong> {zombieCount} / {MAX_PLACEMENT}</div>
          <div><strong>Safe zones:</strong> {safeCount} / {MAX_PLACEMENT}</div>
        </div>

        <div style={{ marginTop: 14, color: "#444", fontSize: "0.9rem" }}>
          <p style={{ margin: "6px 0" }}><strong>Controls</strong></p>
          <ol style={{ paddingLeft: 18, marginTop: 6 }}>
            <li>Pick grid size</li>
            <li>Select placement mode</li>
            <li>Click a cell to place/remove</li>
            <li>Press Start to simulate</li>
          </ol>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ border: "1px solid #ddd", borderRadius: 6, background: "#fff", padding: 6 }}>
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          style={{
            display: "block",
            cursor: running ? "not-allowed" : "pointer",
            background: "#f8fafc"
          }}
        />
      </div>
    </div>
  </div>
);

}
