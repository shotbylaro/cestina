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
const APP = `${P}/CESTINA ZKOUSENI/zkouseni 3rocniky/app`;
const PAGES = {
  "":        { src: "zdroje/lobby.html", lobby: true },
  sesit:     { src: "zdroje/sesit.html", vars: { SESIT_MD: "zdroje/SESIT.md" } },
  maturita:  { src: `${P}/CESTINA SIMPLIFIED/web/index.html` },          // už zašifrovaná – rozšifruje se a zamkne znovu
  zkouseni:  { src: `${APP}/index.html`, skeleton: true },
  opakovani: { src: `${APP}/opakovani.html`, skeleton: true },
  okruhy:    { src: `${APP}/okruhy.html` },
  mm:        { src: `${P}/CESTINA minimetro seznam/mm/index.html` },
  temp:      { src: `${P}/vektory/web/index.html`, assets: ["poster.jpg", "vektory.mp4", "vektory-dlouhe.mp4"] },
};
const ITER = 300000;

const root = path.dirname(fileURLToPath(import.meta.url));
const heslo = (process.env.WEB_HESLO || (() => { try { return fs.readFileSync(path.join(os.homedir(), ".cestina-heslo"), "utf8"); } catch { return ""; } })()).trim();
if (!heslo) { console.error("Chybí heslo: nastav WEB_HESLO nebo ulož heslo do ~/.cestina-heslo"); process.exit(1); }

const b64 = b => Buffer.from(b).toString("base64");
function encrypt(html) {
  const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(heslo, salt, ITER, 32, "sha256");
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
  if (!cfg.lobby) html = /<\/body>/i.test(html) ? html.replace(/<\/body>(?![\s\S]*<\/body>)/i, BACK + "</body>") : html + BACK;
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [, "Čeština"])[1];
  const outDir = path.join(root, name);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "index.html"), gate(title, encrypt(html)));
  for (const a of cfg.assets || []) fs.copyFileSync(path.join(srcDir, a), path.join(outDir, a));
  console.log(`✓ /${name}${name ? "/" : ""}  (${title})`);
}
