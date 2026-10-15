// data.json の達成状態を更新する（手元でも GitHub Actions からでも使える）。
//
//   node scripts/update-status.mjs --set 13=true            # 東京都を達成にする
//   node scripts/update-status.mjs --set 東京都=true --set 23=false
//   node scripts/update-status.mjs --from-url https://.../status.json
//
// --from-url の応答は次のどちらか:
//   { "done": [13, 23, "福岡県"] }         … 達成している都道府県（コードまたは名前）の一覧
//   { "prefectures": [{ "code": 13, "done": true }, ...] }  … data.json と同じ形
// 変更があれば updatedAt を現在時刻（JST）にして書き戻し、終了コード 0 / 変更なしは 0 のまま
// "unchanged" を出力する。

import { readFileSync, writeFileSync } from "node:fs";

const FILE = new URL("../data.json", import.meta.url);
const data = JSON.parse(readFileSync(FILE, "utf8"));

const byKey = new Map();
for (const p of data.prefectures) {
  byKey.set(String(p.code), p);
  byKey.set(p.name, p);
}
const find = (key) => {
  const p = byKey.get(String(key).trim());
  if (!p) throw new Error(`対象外または不明な都道府県: ${key}`);
  return p;
};
const toBool = (v) => {
  const s = String(v).trim().toLowerCase();
  if (["true", "1", "yes", "done", "達成"].includes(s)) return true;
  if (["false", "0", "no", "open", "未達成"].includes(s)) return false;
  throw new Error(`true/false で指定してください: ${v}`);
};

const before = JSON.stringify(data.prefectures);
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--set") {
    const [key, val] = args[++i].split("=");
    find(key).done = toBool(val);
  } else if (args[i] === "--from-url") {
    const res = await fetch(args[++i]);
    if (!res.ok) throw new Error(`取得失敗: HTTP ${res.status}`);
    const remote = await res.json();
    if (Array.isArray(remote.done)) {
      const done = new Set(remote.done.map((k) => find(k).code));
      for (const p of data.prefectures) p.done = done.has(p.code);
    } else if (Array.isArray(remote.prefectures)) {
      for (const r of remote.prefectures) {
        const p = byKey.get(String(r.code ?? r.name));
        if (p) p.done = Boolean(r.done);
      }
    } else {
      throw new Error("応答の形式が不明です（done 配列か prefectures 配列が必要）");
    }
  } else {
    throw new Error(`不明な引数: ${args[i]}`);
  }
}

if (JSON.stringify(data.prefectures) === before) {
  console.log("unchanged");
  process.exit(0);
}

// updatedAt を JST の ISO 形式で
const now = new Date();
const jst = new Date(now.getTime() + 9 * 3600 * 1000);
data.updatedAt = jst.toISOString().replace(/\.\d{3}Z$/, "+09:00");

const lines = data.prefectures.map(
  (p) => `    { "code": ${String(p.code).padStart(2)}, "name": ${JSON.stringify(p.name)}, "done": ${Boolean(p.done)} }`
);
writeFileSync(
  FILE,
  `{\n  "round": ${data.round},\n  "updatedAt": "${data.updatedAt}",\n  "prefectures": [\n${lines.join(",\n")}\n  ]\n}\n`
);
console.log(`updated: ${data.prefectures.filter((p) => p.done).length}/${data.prefectures.length} done, updatedAt=${data.updatedAt}`);
