import React from "react";
import { C } from "./theme";
import { WORLD_PATHS, COUNTRIES } from "./worldMap";

// Static locator map — inline SVG world (Natural Earth 110m), equirectangular.
// No map library, tiles, or API key. Renders one of:
//   point   {kind:'point', lat, lng}                 — a marker on a site
//   points  {kind:'points', points:[{lat,lng}...]}   — several markers, no line
//   route   {kind:'route', points:[{lat,lng}...]}    — a dashed path
//   country {kind:'country', codes:['ZW',...]}        — shades modern country/countries
//   area    {kind:'area', lat, lng, radiusKm}         — soft "approximate region" glow
//
// Lazy-loaded from App.jsx so the ~46KB (gzip) world geometry only downloads on
// pages that actually show a map.
export default function LocatorMap({ geo, accent }) {
  if (!geo) return null;
  const W = 1000, H = 500, ac = accent || C.navy;
  const px = (lng) => (lng + 180) / 360 * W;
  const py = (lat) => (90 - lat) / 180 * H;
  const isRoute = geo.kind === "route" && Array.isArray(geo.points) && geo.points.length > 1;
  const isPoints = geo.kind === "points" && Array.isArray(geo.points) && geo.points.length > 0; // several markers, no line
  const codes = (geo.kind === "country" && Array.isArray(geo.codes)) ? geo.codes.filter(c => COUNTRIES[c]) : [];
  const isCountry = codes.length > 0;
  const isArea = geo.kind === "area" && typeof geo.lat === "number" && typeof geo.lng === "number";
  const isPoint = !isRoute && !isPoints && !isCountry && !isArea && typeof geo.lat === "number" && typeof geo.lng === "number";
  if (!isRoute && !isPoints && !isCountry && !isArea && !isPoint) return null;

  let minx, miny, maxx, maxy, pts = [];
  if (isCountry) {
    const b = codes.map(c => COUNTRIES[c].b);
    minx = Math.min(...b.map(x => x[0])); miny = Math.min(...b.map(x => x[1]));
    maxx = Math.max(...b.map(x => x[2])); maxy = Math.max(...b.map(x => x[3]));
  } else if (isArea) {
    const cx = px(geo.lng), cy = py(geo.lat), rr = (geo.radiusKm || 500) / 111 * (W / 360);
    minx = cx - rr; maxx = cx + rr; miny = cy - rr; maxy = cy + rr; pts = [{ x: cx, y: cy, rr }];
  } else {
    pts = (isRoute || isPoints) ? geo.points.map(p => ({ x: px(p.lng), y: py(p.lat) })) : [{ x: px(geo.lng), y: py(geo.lat) }];
    minx = Math.min(...pts.map(p => p.x)); maxx = Math.max(...pts.map(p => p.x));
    miny = Math.min(...pts.map(p => p.y)); maxy = Math.max(...pts.map(p => p.y));
  }
  const ASPECT = 1.85;
  let padX, padY;
  if (isCountry) { padX = Math.max((maxx - minx) * 0.6, 22); padY = Math.max((maxy - miny) * 0.6, 15); }
  else if (isRoute || isPoints) { padX = Math.max((maxx - minx) * 0.35, 45); padY = Math.max((maxy - miny) * 0.45, 30); }
  else if (isArea) { padX = Math.max((maxx - minx) * 0.5, 110); padY = Math.max((maxy - miny) * 0.5, 70); }
  else { padX = 120; padY = 82; }
  let vx = minx - padX, vy = miny - padY, vw = (maxx - minx) + 2 * padX, vh = (maxy - miny) + 2 * padY;
  if (vw / vh > ASPECT) { const n = vw / ASPECT; vy -= (n - vh) / 2; vh = n; }
  else { const n = vh * ASPECT; vx -= (n - vw) / 2; vw = n; }
  if (vx < 0) vx = 0; if (vy < 0) vy = 0;
  if (vx + vw > W) vx = Math.max(0, W - vw); if (vy + vh > H) vy = Math.max(0, H - vh);
  const r = Math.max(vw, vh) * 0.011, sw = vw * 0.0011;
  return (
    <div style={{ marginBottom:24 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:9 }}>
        <span style={{ width:3, height:13, borderRadius:2, background:ac, flexShrink:0 }} />
        <span style={{ fontSize:11, fontFamily:"'JetBrains Mono',monospace", letterSpacing:"0.09em", textTransform:"uppercase", color:ac, fontWeight:700 }}>Where this took place</span>
      </div>
      <div style={{ width:"100%", aspectRatio:String(ASPECT), border:`1px solid ${C.border}`, borderRadius:8, overflow:"hidden", background:"#e9eef2" }}>
        <svg viewBox={`${vx} ${vy} ${vw} ${vh}`} width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label={"Map showing " + (geo.label || "location")}>
          <rect x="0" y="0" width={W} height={H} fill="#e9eef2" />
          {WORLD_PATHS.map((d,i) => <path key={i} d={d} fill="#e6ddc9" stroke="#c9bd9f" strokeWidth={sw} />)}
          {isCountry && codes.flatMap(c => COUNTRIES[c].p).map((d,i) => <path key={"c"+i} d={d} fill={ac} fillOpacity="0.5" stroke={ac} strokeWidth={sw*2.2} strokeLinejoin="round" />)}
          {isArea && <circle cx={pts[0].x} cy={pts[0].y} r={pts[0].rr} fill={ac} fillOpacity="0.13" stroke={ac} strokeWidth={sw*1.6} strokeDasharray={`${r} ${r*0.8}`} />}
          {isRoute && <polyline points={pts.map(p => p.x + "," + p.y).join(" ")} fill="none" stroke={ac} strokeWidth={r*0.6} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={`${r*1.5} ${r*1.1}`} opacity="0.92" />}
          {(isPoint || isRoute || isPoints) && pts.map((p,i) => {
            const end = !isRoute || i === 0 || i === pts.length - 1;
            const rr = end ? r : r * 0.55;
            return (
              <g key={i}>
                <circle cx={p.x} cy={p.y} r={rr*2} fill={ac} opacity="0.16" />
                <circle cx={p.x} cy={p.y} r={rr} fill={ac} stroke="#fff" strokeWidth={rr*0.45} />
              </g>
            );
          })}
        </svg>
      </div>
      {geo.label && <div style={{ fontFamily:"'Lora',serif", fontSize:12.5, color:C.light, fontStyle:"italic", marginTop:6 }}>{geo.label}{geo.approx ? " · approximate" : ""}</div>}
    </div>
  );
}
