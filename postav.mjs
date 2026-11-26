// Postaví web cestina.shotbylaro.eu: každou stránku zašifruje heslem (AES-GCM, klíč z PBKDF2),
// takže v repu není nic čitelného. Heslo: proměnná WEB_HESLO, jinak soubor ~/.cestina-heslo.
//   node postav.mjs            -> všechny stránky
//   node postav.mjs sesit mm   -> jen vybrané (lobby = "lobby")
// Zadané heslo si prohlížeč pamatuje (localStorage "heslo"), takže na celé doméně stačí zadat jednou.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const P = "/Users/grig/Desktop/PROJECTS CC";
const SCHULE = `${P}/CESTINA SESIT`;   // repo SCHULE, web skola.shotbylaro.eu
const APP = `${P}/CESTINA ZKOUSENI/zkouseni 3rocniky/app`;
const PAGES = {
  "":        { src: "zdroje/lobby.html", lobby: true },
  sesit:     { src: "zdroje/sesit.html", vars: { SESIT_MD: "zdroje/SESIT.md" } },
  maturita:  { src: `${P}/CESTINA SIMPLIFIED/web/index.html` },          // už zašifrovaná – rozšifruje se a zamkne znovu
  zkouseni:  { src: `${APP}/index.html`, skeleton: true },
  opakovani: { src: `${APP}/opakovani.html`, skeleton: true },
  okruhy:    { src: `${APP}/okruhy.html` },
  mm:        { src: `${P}/CESTINA minimetro seznam/mm/index.html` },
  // zdroj Vektorů je kopie z gitové historie repa temp (jeho index.html je teď přesměrování sem)
  temp:      { src: "zdroje/temp/index.html", assetDir: `${P}/vektory/web`, assets: ["poster.jpg", "vektory.mp4", "vektory-dlouhe.mp4"] },
  primka:    { src: `${P}/vektory/primka.html` },
  // C1 Advanced: bez odkazu zpět do lobby. Host má dočasné heslo z proměnné C1_HOST_HESLO (jen při buildu, nikde se neukládá),
  // platí do `until`; po tomhle datu ho build vynechá a brána ho odmítne. Vlastník otevře stránku hlavním heslem.
  // Výstup jde na skola.shotbylaro.eu/c1/ (repo SCHULE); cestina.shotbylaro.eu/c1/ je jen přesměrování.
  c1:        { src: `${P}/vektory/c1/index.html`, noBack: true, guest: { env: "C1_HOST_HESLO", until: "2026-11-24" }, out: `${SCHULE}/c1/index.html` },
  // skola.shotbylaro.eu = repo SCHULE (složka nad tímhle webem): rozcestník všech předmětů a stránka Fotografie
  skola:     { src: "zdroje/skola.html", lobby: true, out: `${SCHULE}/index.html` },
  fotografie:{ src: "zdroje/fotografie.html", vars: { FOTO_MD: `${SCHULE}/fotografie/opakovani-k-mz-fft.md` }, out: `${SCHULE}/fotografie/index.html`, back: "← Škola" },
  // sešit z fotografie: zápisy k 20 okruhům FFT (SESIT.md ve složce fotografie repa SCHULE)
  fotosesit: { src: "zdroje/fotografie-sesit.html", vars: { SESIT_MD: `${SCHULE}/fotografie/SESIT.md` }, out: `${SCHULE}/fotografie/sesit/index.html`, back: "← Škola" },
  // dočasné opáčko k okruhům FOT 1–9 (fragment bez <html>, proto skeleton)
  // Angličtina: tahák na C1 Writing (essay, letter, report, proposal, review + barevné linkery)
  // Host (kámoš) má dočasné heslo z WRITING_HOST_HESLO (jen při buildu, nikde se neukládá), platí do `until` včetně; bez odkazu do lobby.
  c1writing: { src: "zdroje/c1-writing.html", out: `${SCHULE}/c1-writing/index.html`, noBack: true, guest: { env: "WRITING_HOST_HESLO", until: "2026-11-28" } },
  fotoopacko:{ src: "zdroje/foto-opacko.html", skeleton: true, out: `${SCHULE}/fotografie/opacko/index.html`, back: "← Škola" },
};
const ITER = 300000;

const root = path.dirname(fileURLToPath(import.meta.url));
const heslo = (process.env.WEB_HESLO || (() => { try { return fs.readFileSync(path.join(os.homedir(), ".cestina-heslo"), "utf8"); } catch { return ""; } })()).trim();
if (!heslo) { console.error("Chybí heslo: nastav WEB_HESLO nebo ulož heslo do ~/.cestina-heslo"); process.exit(1); }

const b64 = b => Buffer.from(b).toString("base64");
function encrypt(html, pw = heslo) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(pw, salt, ITER, 32, "sha256");
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(html, "utf8"), c.final(), c.getAuthTag()]);   // WebCrypto čeká tag na konci
  return { S: b64(salt), I: b64(iv), C: b64(ct) };
}
function decryptGated(html) {
  const g = n => (html.match(new RegExp(`${n}="([^"]+)"`)) || [])[1];
  if (!g("S") || !g("C") || !/crypto\.subtle\.decrypt/.test(html)) return html;     // není zamčená
  const C = Buffer.from(g("C"), "base64"), key = crypto.pbkdf2Sync(heslo, Buffer.from(g("S"), "base64"), ITER, 32, "sha256");
  const d = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(g("I"), "base64"));
  d.setAuthTag(C.subarray(C.length - 16));
  return Buffer.concat([d.update(C.subarray(0, C.length - 16)), d.final()]).toString("utf8");
}

const SKELETON = s => `<!doctype html>\n<html lang="cs">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}img{max-width:100%}[hidden]{display:none!important}</style>\n</head>\n<body>\n${s}\n</body>\n</html>\n`;
const BACK = `<a href="/" title="Zpět do lobby" style="position:fixed;left:max(10px,env(safe-area-inset-left,0px));bottom:max(10px,env(safe-area-inset-bottom,0px));z-index:2147483000;font:600 13px/1 system-ui,sans-serif;color:#f1ecff;background:#1b1233;border:2px solid #352a57;border-radius:99px;padding:8px 12px;text-decoration:none;opacity:.85">← Čeština</a>`;
const scriptSafe = s => s.replace(/<\/script/gi, "<\\/script");

function gate(title, d) {
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>body{font:16px system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px;box-sizing:border-box;background:#0f0a1f;color:#f1ecff}
form{display:grid;gap:8px;max-width:320px;width:100%}input,button{font:inherit;padding:10px;border-radius:8px;border:2px solid #352a57;background:#1b1233;color:inherit}button{cursor:pointer;font-weight:600}#e{color:#ff5c70;min-height:1.2em}</style></head>
<body><form id="f"><label for="p">Heslo</label><input id="p" type="password" autofocus autocomplete="current-password">
<button>Vstoupit</button><div id="e" role="alert"></div></form>
<script>
// Převod postupu z Linek učení ze staré adresy mm.shotbylaro.eu (přijde v #m5=…)
if(location.hash.startsWith("#m5=")){try{localStorage.setItem("metro5",decodeURIComponent(location.hash.slice(4)))}catch(_){}history.replaceState(null,"",location.pathname)}
try{sessionStorage.setItem("mm_ok","1")}catch(_){}
const S="${d.S}",I="${d.I}",C="${d.C}",u=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
async function open_(pw){
  const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(pw),"PBKDF2",false,["deriveKey"]);
  const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt:u(S),iterations:${ITER},hash:"SHA-256"},k,{name:"AES-GCM",length:256},false,["decrypt"]);
  const html=new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:u(I)},key,u(C)));
  try{localStorage.setItem("heslo",pw)}catch(_){}
  document.open();document.write(html);document.close();
}
const e_=document.getElementById("e");
f.onsubmit=e=>{e.preventDefault();e_.textContent="";open_(p.value).catch(()=>e_.textContent="Špatné heslo")};
try{const s=localStorage.getItem("heslo");if(s)open_(s).catch(()=>localStorage.removeItem("heslo"))}catch(_){}
</script></body></html>
`;
}

// Brána se dvěma klíči: "owner" (hlavní heslo, pamatuje si ho localStorage "heslo" jako zbytek webu)
// a "host" (dočasné heslo do g.until, pamatuje si ho jen localStorage "heslo-c1"; do "heslo" nikdy nesahá).
// Varianta pro hosta má navíc window.C1_MODE="host". Skript je v uzavřené funkci, aby jeho proměnné
// nekolidovaly s rozšifrovanou stránkou po document.write.
function gateGuest(title, html, g) {
  const V = [{ k: "owner", ...encrypt(html) }];
  const gpw = (process.env[g.env] || "").trim(), today = new Date().toLocaleDateString("sv-SE");
  if (gpw && today <= g.until) V.push({ k: "host", u: g.until, ...encrypt(html.replace(/<script/i, '<script>window.C1_MODE="host";</script><script'), gpw) });
  else console.log(gpw ? `  (heslo hosta platilo do ${g.until}, stránka je jen s hlavním heslem)` : `  (bez hesla hosta – nastav ${g.env}, pokud ho chceš)`);
  return `<!doctype html><html lang="cs"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title>
<style>body{font:16px system-ui,sans-serif;display:grid;place-items:center;min-height:100vh;margin:0;padding:16px;box-sizing:border-box;background:#0f0a1f;color:#f1ecff}
form{display:grid;gap:8px;max-width:320px;width:100%}input,button{font:inherit;padding:10px;border-radius:8px;border:2px solid #352a57;background:#1b1233;color:inherit}button{cursor:pointer;font-weight:600}#e{color:#ff5c70;min-height:1.2em}</style></head>
<body><form id="f"><label for="p">Heslo</label><input id="p" type="password" autofocus autocomplete="current-password">
<button>Vstoupit</button><div id="e" role="alert"></div></form>
<script>
(() => {
const V=${JSON.stringify(V)},u=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)),td=()=>new Date().toLocaleDateString("sv-SE");
async function dec(v,pw){
  const k=await crypto.subtle.importKey("raw",new TextEncoder().encode(pw),"PBKDF2",false,["deriveKey"]);
  const key=await crypto.subtle.deriveKey({name:"PBKDF2",salt:u(v.S),iterations:${ITER},hash:"SHA-256"},k,{name:"AES-GCM",length:256},false,["decrypt"]);
  return new TextDecoder().decode(await crypto.subtle.decrypt({name:"AES-GCM",iv:u(v.I)},key,u(v.C)));
}
async function tryPw(pw,kinds){for(const v of V){if(!kinds.includes(v.k)||(v.u&&td()>v.u))continue;try{return {v,html:await dec(v,pw)}}catch(_){}}return null}
function show(r,pw){try{localStorage.setItem(r.v.k==="host"?"heslo-c1":"heslo",pw)}catch(_){}document.open();document.write(r.html);document.close()}
const form=document.getElementById("f"),inp=document.getElementById("p"),err=document.getElementById("e");
form.onsubmit=async e=>{e.preventDefault();err.textContent="Ověřuju…";const r=await tryPw(inp.value,["owner","host"]);if(r)show(r,inp.value);else err.textContent="Špatné heslo, nebo už neplatí."};
(async()=>{let s=null;try{s=localStorage.getItem("heslo")}catch(_){}
  if(s){const r=await tryPw(s,["owner"]);if(r)return show(r,s)}
  try{s=localStorage.getItem("heslo-c1")}catch(_){s=null}
  if(s){const r=await tryPw(s,["host"]);if(r)return show(r,s);try{localStorage.removeItem("heslo-c1")}catch(_){}}})();
})();
</script></body></html>
`;
}

const only = process.argv.slice(2);
for (const [name, cfg] of Object.entries(PAGES)) {
  if (only.length && !only.includes(name || "lobby")) continue;
  const srcPath = path.resolve(root, cfg.src), srcDir = path.dirname(srcPath);
  let html = decryptGated(fs.readFileSync(srcPath, "utf8"));
  if (cfg.skeleton) html = SKELETON(html);
  // lokální <script src="x.js"> vložit přímo do stránky, ať nic nezůstane nezašifrované
  html = html.replace(/<script src="(?!https?:)([^"]+)"><\/script>/g, (m, f) => `<script>${scriptSafe(fs.readFileSync(path.join(srcDir, f), "utf8"))}</script>`);
  for (const [v, f] of Object.entries(cfg.vars || {}))
    html = html.replace(/<script/i, `<script>window.${v}=${scriptSafe(JSON.stringify(fs.readFileSync(path.resolve(root, f), "utf8")))};</script><script`);
  html = html.replaceAll("https://skola.shotbylaro.eu/opakovani/", "../opakovani/").replaceAll("https://skola.shotbylaro.eu/zkouseni/", "../zkouseni/");
  const back = cfg.back ? BACK.replace("← Čeština", cfg.back) : BACK;   // odkaz vždy na "/" vlastní domény
  if (!cfg.lobby && !cfg.noBack) html = /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, back + "</body>") : html + back;
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [, "Čeština"])[1];
  const outFile = cfg.out || path.join(root, name, "index.html"), outDir = path.dirname(outFile);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, cfg.guest ? gateGuest(title, html, cfg.guest) : gate(title, encrypt(html)));
  for (const a of cfg.assets || []) fs.copyFileSync(path.join(cfg.assetDir || srcDir, a), path.join(outDir, a));
  console.log(`✓ /${name}${name ? "/" : ""}  (${title})`);
}
