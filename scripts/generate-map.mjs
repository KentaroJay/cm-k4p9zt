// 地図SVG生成（運用中は実行不要）: japan.topojson → index.html のインラインSVG。
// 47都道府県すべてを <path id="pref-NN" class="pref"> として出力する。
// 対象／達成の色分けはページ側のスクリプトが data.json を読んでクラスを付ける。
//
// 本土は viewBox に合わせて投影し、沖縄県は右下の別枠に別投影で描く。

import { readFileSync, writeFileSync } from "node:fs";
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import { presimplify, simplify, quantile } from "topojson-simplify";

const W = 420;
const H = 440;

// 県境の見た目を保ったまま座標点を間引く（ページ重量対策）。引数は「残す点の割合」。
const SIMPLIFY_KEEP = 0.08;

const raw = JSON.parse(readFileSync(new URL("./japan.topojson", import.meta.url)));
const pre = presimplify(raw);
const topo = simplify(pre, quantile(pre, SIMPLIFY_KEEP));
const prefs = feature(topo, topo.objects.japan).features;

const OKINAWA_ID = 47;
const mainland = prefs.filter((f) => f.properties.id !== OKINAWA_ID);
// 沖縄は島が小さく間引きで消えるため、無圧縮ジオメトリから取る
const okinawa = feature(raw, raw.objects.japan).features
  .find((f) => f.properties.id === OKINAWA_ID);

// 本土: 主要4島のバウンディングボックスにフィット（枠外の離島はクリップ）。
const MAIN_BBOX = {
  type: "MultiPoint",
  coordinates: [[128.3, 30.9], [146.2, 45.7]],
};
const mainProj = geoMercator().fitExtent([[6, 6], [W - 6, H - 6]], MAIN_BBOX);
const mainPath = geoPath(mainProj).digits(1);

// 沖縄県の別枠（右下の空き海域）。沖縄本島周辺にフィットさせる。
const INSET = { x: W - 118, y: H - 100, w: 110, h: 92 };
const OKI_BBOX = { type: "MultiPoint", coordinates: [[126.7, 26.0], [128.35, 27.05]] };
const okiProj = geoMercator().fitExtent(
  [[INSET.x + 8, INSET.y + 8], [INSET.x + INSET.w - 8, INSET.y + INSET.h - 8]],
  OKI_BBOX
);
const okiPath = geoPath(okiProj).digits(1);

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

const prefPathEl = (f, d) => {
  const { id, nam_ja } = f.properties;
  return `    <path id="pref-${id}" class="pref" d="${d}"><title>${esc(nam_ja)}</title></path>`;
};

const paths = mainland
  .sort((a, b) => a.properties.id - b.properties.id)
  .map((f) => prefPathEl(f, mainPath(f)));

const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-labelledby="map-title" id="japan-map">
  <title id="map-title">都道府県別の達成状況マップ</title>
  <defs>
    <clipPath id="map-clip"><rect x="0" y="0" width="${W}" height="${H}"/></clipPath>
    <clipPath id="inset-clip"><rect x="${INSET.x}" y="${INSET.y}" width="${INSET.w}" height="${INSET.h}"/></clipPath>
  </defs>
  <g class="prefs" clip-path="url(#map-clip)">
${paths.join("\n")}
  </g>
  <g class="inset" clip-path="url(#inset-clip)">
    <rect x="${INSET.x}" y="${INSET.y}" width="${INSET.w}" height="${INSET.h}" class="inset-box"/>
    <path id="pref-47" class="pref" d="${okiPath(okinawa)}"><title>沖縄県</title></path>
    <text x="${INSET.x + 6}" y="${INSET.y + 13}" class="inset-label">沖縄県</text>
  </g>
</svg>`;

// index.html のマーカー間に差し込む。
const htmlUrl = new URL("../index.html", import.meta.url);
const html = readFileSync(htmlUrl, "utf8");
const START = "<!-- MAP:START -->";
const END = "<!-- MAP:END -->";
const s = html.indexOf(START);
const e = html.indexOf(END);
if (s === -1 || e === -1) throw new Error("MAP:START / MAP:END markers not found in index.html");
writeFileSync(htmlUrl, html.slice(0, s + START.length) + "\n" + svg + "\n" + html.slice(e));
console.log(`Injected SVG (${(svg.length / 1024).toFixed(0)} KB) into index.html`);
