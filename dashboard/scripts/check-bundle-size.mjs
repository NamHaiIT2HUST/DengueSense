// Kiểm ngân sách kích thước bundle (docs/10 §15). Chạy sau `npm run build`:  npm run size:check
//   - JS khởi đầu (các script trong dist/index.html, gồm modulepreload) ≤ 250 KB gzip
//   - mỗi chunk JS ≤ 150 KB gzip
// Vượt ngân sách → thoát 1 (CI fail). Muốn nâng ngân sách phải sửa docs/10 §15 kèm lý do trong PR.
import { readFileSync, readdirSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const INITIAL_BUDGET_KB = 250;
const CHUNK_BUDGET_KB = 150;
const dist = fileURLToPath(new URL("../dist/", import.meta.url));

const html = readFileSync(join(dist, "index.html"), "utf8");
const initial = new Set(
  [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1])
);

const kb = (bytes) => bytes / 1024;
const rows = readdirSync(join(dist, "assets"))
  .filter((f) => f.endsWith(".js"))
  .map((f) => {
    const gz = gzipSync(readFileSync(join(dist, "assets", f))).length;
    return { file: `assets/${f}`, gzKb: kb(gz), initial: initial.has(`assets/${f}`) };
  })
  .sort((a, b) => b.gzKb - a.gzKb);

const initialKb = rows.filter((r) => r.initial).reduce((s, r) => s + r.gzKb, 0);
let failed = false;

console.log("Chunk JS (gzip):");
for (const r of rows) {
  const over = r.gzKb > CHUNK_BUDGET_KB;
  failed ||= over;
  console.log(
    `  ${r.gzKb.toFixed(1).padStart(7)} KB  ${r.initial ? "[khởi đầu]" : "[lazy]    "}  ${r.file}${over ? `   ✘ vượt ${CHUNK_BUDGET_KB} KB` : ""}`
  );
}
const initialOver = initialKb > INITIAL_BUDGET_KB;
failed ||= initialOver;
console.log(
  `\nJS khởi đầu: ${initialKb.toFixed(1)} KB / ${INITIAL_BUDGET_KB} KB  ${initialOver ? "✘ VƯỢT" : "✔"}`
);
process.exit(failed ? 1 : 0);
