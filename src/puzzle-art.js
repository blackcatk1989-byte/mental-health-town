// 兩個謎題的插畫（自製 SVG）。線索用看的：場地的光影、植物的姿態、土的乾濕、桌上的東西。
// 每種線索同時有形狀（光線、葉影、水滴、裂痕、屋簷）而不只靠顏色；文字描述在 content/puzzles.json。
// 這裡只管「畫在哪裡、長什麼樣子」，規則在 src/game.js，操作在 src/puzzles.js。

export const PLANT_STAGE = {
  w: 400,
  h: 320,
  spots: {
    sun: { x: 78, y: 98, r: 52 },
    wall: { x: 200, y: 66, r: 44 },
    shade: { x: 322, y: 100, r: 52 },
    wet: { x: 86, y: 214, r: 48 },
    eaves: { x: 314, y: 214, r: 48 },
  },
  tray: { rosemary: { x: 140, y: 284 }, mint: { x: 200, y: 284 }, fern: { x: 260, y: 284 } },
};

export const TABLE_STAGE = {
  w: 400,
  h: 300,
  tables: { t1: { x: 78, y: 112, r: 54 }, t2: { x: 200, y: 92, r: 54 }, t3: { x: 322, y: 112, r: 54 } },
  tray: { ticket: { x: 140, y: 256 }, bill: { x: 200, y: 256 }, stamp: { x: 260, y: 256 } },
};

// ---- 植物謎題的場地 ----
function spotArt(id, { x, y, r }) {
  switch (id) {
    case 'sun': // 光斑＋放射狀的光線；一片影子會慢慢滑過
      return `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.75}" fill="#fbe7a4"/>
        <g stroke="#e9c35a" stroke-width="3" stroke-linecap="round">${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => {
    const c = Math.cos((a * Math.PI) / 180);
    const s = Math.sin((a * Math.PI) / 180);
    return `<line x1="${x + c * r * 0.62}" y1="${y + s * r * 0.48}" x2="${x + c * r * 0.82}" y2="${y + s * r * 0.62}"/>`;
  }).join('')}</g>
        <ellipse class="moving-shade" cx="${x - r * 0.9}" cy="${y}" rx="${r * 0.45}" ry="${r * 0.6}" fill="#000" opacity="0.07"/>`;
    case 'wall': // 發燙的水泥牆＋乾裂反光的地面＋熱氣
      return `<rect x="${x - r * 1.3}" y="${y - r * 1.25}" width="${r * 2.6}" height="${r * 0.55}" rx="4" fill="#cfc8bd"/>
        <ellipse cx="${x}" cy="${y + 4}" rx="${r}" ry="${r * 0.6}" fill="#efe3c9"/>
        <path d="M${x - 24} ${y} l10 6 l-4 10 M${x + 8} ${y - 6} l8 10 l10 -2 M${x - 4} ${y + 14} l6 8" stroke="#c4ab84" stroke-width="2" fill="none"/>
        <g class="heat" stroke="#e8b48a" stroke-width="2" fill="none" stroke-linecap="round">
          <path d="M${x - 20} ${y - 30} q4 -6 0 -12 q-4 -6 0 -12"/><path d="M${x} ${y - 32} q4 -6 0 -12 q-4 -6 0 -12"/><path d="M${x + 20} ${y - 30} q4 -6 0 -12 q-4 -6 0 -12"/></g>`;
    case 'shade': // 大樹＋一塊一塊的葉影
      return `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.75}" fill="#9fbf8e"/>
        ${[[-22, -10], [14, -18], [24, 12], [-10, 18], [-30, 10]].map(([dx, dy]) => `<ellipse cx="${x + dx}" cy="${y + dy}" rx="9" ry="6" fill="#cfe2bd"/>`).join('')}
        <circle cx="${x + r * 0.7}" cy="${y - r * 0.85}" r="${r * 0.55}" fill="#7aa476"/><circle cx="${x + r * 0.25}" cy="${y - r * 1.05}" r="${r * 0.42}" fill="#8fbd85"/>
        <rect x="${x + r * 0.62}" y="${y - r * 0.5}" width="8" height="${r * 0.6}" rx="3" fill="#9a7556"/>`;
    case 'wet': // 深色濕土＋小水窪＋水滴＋水龍頭
      return `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.72}" fill="#a98a6c"/>
        <ellipse cx="${x - 12}" cy="${y + 10}" rx="${r * 0.45}" ry="${r * 0.2}" fill="#9cc3d6"/>
        ${[[14, -14], [24, -2], [4, -22]].map(([dx, dy]) => `<path d="M${x + dx} ${y + dy - 6} q4 6 0 9 q-4 -3 0 -9" fill="#9cc3d6"/>`).join('')}
        <rect x="${x - r * 1.1}" y="${y - r * 0.95}" width="8" height="${r * 0.7}" rx="2" fill="#8d8580"/>
        <rect x="${x - r * 1.1}" y="${y - r * 0.95}" width="22" height="7" rx="2" fill="#8d8580"/>
        <path class="drip" d="M${x - r * 0.8} ${y - r * 0.8} q3 5 0 7 q-3 -2 0 -7" fill="#9cc3d6"/>`;
    case 'eaves': // 屋簷＋暗暗的陰影＋乾土
      return `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.72}" fill="#b8ab98"/>
        <path d="M${x - r * 1.15} ${y - r * 0.85} L${x + r * 1.15} ${y - r * 0.85} L${x + r * 0.95} ${y - r * 0.55} L${x - r * 0.95} ${y - r * 0.55} Z" fill="#c98a6c"/>
        <rect x="${x - r * 0.95}" y="${y - r * 0.55}" width="${r * 1.9}" height="${r * 1.1}" fill="#3d322c" opacity="0.18"/>
        <path d="M${x - 18} ${y + 8} l8 5 l-3 8 M${x + 10} ${y} l6 8" stroke="#9c8e7c" stroke-width="2" fill="none"/>`;
    default:
      return '';
  }
}

export function plantStageSvg() {
  const { w, h, spots } = PLANT_STAGE;
  return `<svg class="stage" viewBox="0 0 ${w} ${h}" role="group" aria-label="花園角落">
    <rect width="${w}" height="${h}" rx="18" fill="#cfe0b6"/>
    <path d="M0 ${h - 64} H${w}" stroke="#bccfa3" stroke-width="2" stroke-dasharray="6 6"/>
    ${Object.entries(spots).map(([id, s]) => `<g class="zone" data-slot="${id}">${spotArt(id, s)}
      <circle class="zone-hit" cx="${s.x}" cy="${s.y}" r="${s.r}" fill="transparent"/></g>`).join('')}
    <g class="tray-area" data-slot=""><rect x="96" y="${h - 58}" width="208" height="50" rx="12" fill="#e8d6b8" opacity="0.7"/></g>
    <g class="pots"></g>
    ${catSvg(w - 46, h - 40)}
  </svg>`;
}

// ---- 植物：初始姿態就是第一個線索；土面是第二個線索 ----
// 動畫用 CSS class：r-bloom 舒展開花、r-droop 垂下、r-lean 轉向光、r-curl 葉緣捲起
export function potSvg(id, { soil }) {
  const soilArt = soil === 'wet'
    ? `<ellipse cx="0" cy="-26" rx="17" ry="5" fill="#6e4f39"/><circle cx="-6" cy="-26" r="1.6" fill="#9cc3d6"/><circle cx="5" cy="-25" r="1.6" fill="#9cc3d6"/>`
    : `<ellipse cx="0" cy="-26" rx="17" ry="5" fill="#d8bf98"/><path d="M-9 -27 l4 2 l-1 2 M3 -28 l3 3 l4 -1" stroke="#a88a62" stroke-width="1.2" fill="none"/>`;
  let plant = '';
  if (id === 'rosemary') {
    plant = `<g class="stems">${[-8, -3, 2, 7].map((x, i) => `<g transform="translate(${x} 0)">
        <line x1="0" y1="-27" x2="0" y2="${-62 - i * 4}" stroke="#7f9d7a" stroke-width="2"/>
        ${[0, 1, 2, 3, 4].map((k) => `<line class="edge" x1="0" y1="${-34 - k * 6}" x2="${k % 2 ? 5 : -5}" y2="${-37 - k * 6}" stroke="#6f8f6a" stroke-width="2" stroke-linecap="round"/>`).join('')}
      </g>`).join('')}</g>
      <g class="extra">${[[-8, -64], [2, -72], [7, -76]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" fill="#b9a3d9"/>`).join('')}</g>`;
  } else if (id === 'mint') {
    plant = `<g class="stems">${[-7, 0, 7].map((x, i) => `<g transform="translate(${x} 0)">
        <path d="M0 -27 q ${i - 1} -14 0 -30" stroke="#6f9f6a" stroke-width="2.5" fill="none"/>
        ${[0, 1, 2].map((k) => `<ellipse class="edge" cx="${k % 2 ? 6 : -6}" cy="${-34 - k * 8}" rx="6" ry="3.6" fill="#9fd0a0" stroke="#7fb282" stroke-width="1"/>`).join('')}
      </g>`).join('')}</g>
      <g class="extra"><ellipse cx="0" cy="-64" rx="6" ry="4" fill="#c3ecbc" stroke="#7fb282"/></g>`;
  } else {
    plant = `<g class="stems">${[-1, 0, 1].map((d) => `<g transform="rotate(${d * 32} 0 -27)">
        <path d="M0 -27 q ${d * 4} -20 ${d * 2} -42" stroke="#5f8f5b" stroke-width="2" fill="none"/>
        ${[0, 1, 2, 3, 4].map((k) => `<ellipse cx="${d * 2 + (k % 2 ? 5 : -5)}" cy="${-34 - k * 7}" rx="5" ry="2.4" fill="#6fa36b" class="edge frond" stroke="#c49a52" stroke-width="1.4"/>`).join('')}
      </g>`).join('')}</g>
      <g class="extra"><path d="M0 -40 q-6 -10 0 -16 q6 -4 5 4 q-2 4 -5 2" stroke="#6fa36b" stroke-width="2.5" fill="none"/></g>`;
  }
  return `<g class="plant plant-${id}">
    ${plant}
    <path d="M-17 -27 L17 -27 L13 0 L-13 0 Z" fill="#c98a6b"/><rect x="-19" y="-30" width="38" height="6" rx="3" fill="#d99a78"/>
    ${soilArt}
  </g>`;
}

// ---- 麻糬（歪頭表示「嗯？」）----
export function catSvg(x, y) {
  return `<g class="cat" transform="translate(${x} ${y})" aria-hidden="true">
    <ellipse cx="0" cy="12" rx="18" ry="12" fill="#eaa25a"/>
    <g class="cat-head"><circle cx="0" cy="-4" r="13" fill="#eaa25a"/>
      <path d="M-11 -12 l3 -10 l6 7 Z M11 -12 l-3 -10 l-6 7 Z" fill="#eaa25a"/>
      <circle cx="-5" cy="-5" r="1.8" fill="#3d322c"/><circle cx="5" cy="-5" r="1.8" fill="#3d322c"/>
      <ellipse cx="0" cy="0" rx="2" ry="1.3" fill="#e48c86"/></g>
    <path class="cat-tail" d="M16 16 q12 -4 8 -18" stroke="#d98d45" stroke-width="5" fill="none" stroke-linecap="round"/>
  </g>`;
}

// ---- 桌子謎題 ----
const THEME_ICON = {
  book: '<rect x="-9" y="-7" width="18" height="13" rx="2" fill="#8fb3c9"/><line x1="0" y1="-7" x2="0" y2="6" stroke="#fff" stroke-width="1.5"/>',
  coin: '<circle cx="0" cy="0" r="8" fill="#e9c35a"/><circle cx="0" cy="0" r="5" fill="none" stroke="#c9a03a" stroke-width="1.5"/>',
  letter: '<rect x="-10" y="-7" width="20" height="14" rx="2" fill="#f6e3c8" stroke="#c98f6b"/><path d="M-10 -7 L0 1 L10 -7" stroke="#c98f6b" fill="none"/>',
};

function tableItems(id) {
  if (id === 't1') {
    return `<rect x="-26" y="-14" width="30" height="22" rx="2" fill="#fffaf0" transform="rotate(-8)"/>
      <g transform="rotate(-8)"><rect x="-22" y="-9" width="20" height="3" fill="#f2e46a"/><rect x="-22" y="-2" width="16" height="3" fill="#f2e46a"/></g>
      ${[[14, -10], [22, 0], [12, 10]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#fff" stroke="#d8c6ad"/><circle cx="${x}" cy="${y}" r="3" fill="#c9a78a"/>`).join('')}
      <g class="table-win" opacity="0"><rect x="-20" y="-20" width="16" height="10" rx="1" fill="#f6d9c8" transform="rotate(-8)"/></g>`;
  }
  if (id === 't2') {
    return `<rect x="-24" y="-14" width="20" height="26" rx="3" fill="#8d8580"/><rect x="-21" y="-11" width="14" height="6" fill="#cfe2bd"/>
      ${[0, 1, 2].map((r) => [0, 1].map((c) => `<rect x="${-21 + c * 8}" y="${-2 + r * 5}" width="5" height="3" fill="#e9e6e0"/>`).join('')).join('')}
      <rect x="6" y="-10" width="22" height="22" fill="#fffdf7" transform="rotate(10)"/>
      <g transform="rotate(10)" stroke="#a89e95" stroke-width="1.2"><line x1="9" y1="-5" x2="24" y2="-5"/><line x1="9" y1="0" x2="22" y2="0"/><line x1="9" y1="5" x2="24" y2="5"/></g>
      <g class="table-win" opacity="0"><rect x="-26" y="12" width="22" height="8" rx="1" fill="#e9d0b0"/></g>`;
  }
  return `<rect x="-26" y="-12" width="28" height="20" rx="2" fill="#f4e4c9" stroke="#c98f6b"/>
    <g stroke="#a89e95" stroke-width="1.2"><line x1="-22" y1="-6" x2="-6" y2="-6"/><line x1="-22" y1="-1" x2="-10" y2="-1"/></g>
    <rect x="8" y="-12" width="18" height="22" rx="2" fill="#b8cfe0"/><circle cx="14" cy="-3" r="3" fill="#f0d3b8"/><circle cx="20" cy="-3" r="3" fill="#e6c3a2"/>
    <g class="table-win" opacity="0"><rect x="-8" y="-10" width="7" height="8" fill="#d2705f" stroke="#fff" stroke-width="0.8"/></g>`;
}

export function tableStageSvg(tables) {
  const { w, h } = TABLE_STAGE;
  return `<svg class="stage" viewBox="0 0 ${w} ${h}" role="group" aria-label="咖啡店外的三張桌子">
    <rect width="${w}" height="${h}" rx="18" fill="#efe3cf"/>
    ${tables.map((t) => {
    const s = TABLE_STAGE.tables[t.id];
    return `<g class="zone table" data-slot="${t.id}">
        <circle cx="${s.x}" cy="${s.y}" r="${s.r}" fill="#fffaf0" stroke="#e0cdb4" stroke-width="3"/>
        <g class="table-items" transform="translate(${s.x} ${s.y})">${tableItems(t.id)}</g>
        <g class="sigh" transform="translate(${s.x + 30} ${s.y - 62})">
          <path d="M-16 -12 h32 a8 8 0 0 1 8 8 v10 a8 8 0 0 1 -8 8 h-20 l-8 8 v-8 h-4 a8 8 0 0 1 -8 -8 v-10 a8 8 0 0 1 8 -8 Z" fill="#fff" stroke="#c9b9a6"/>
          <g class="sigh-dots">${[-8, 0, 8].map((x) => `<circle cx="${x}" cy="0" r="2.2" fill="#a89e95"/>`).join('')}</g>
          <g class="sigh-theme" opacity="0">${THEME_ICON[t.theme]}</g>
        </g>
        <circle class="zone-hit" cx="${s.x}" cy="${s.y}" r="${s.r}" fill="transparent"/>
      </g>`;
  }).join('')}
    <g class="tray-area" data-slot=""><rect x="96" y="${h - 76}" width="208" height="56" rx="10" fill="#9d7b5c"/></g>
    <g class="pots"></g>
  </svg>`;
}

export function itemSvg(id) {
  if (id === 'ticket') {
    return `<g class="thing"><rect x="-16" y="-11" width="32" height="22" rx="2" fill="#fffaf0" stroke="#8fb3c9" stroke-width="1.5"/>
      <rect x="-12" y="-7" width="8" height="10" fill="#e2eedb"/><circle cx="8" cy="0" r="6" fill="none" stroke="#3d322c" stroke-width="1.4"/>
      <path d="M8 -3 v3 l2 2" stroke="#3d322c" stroke-width="1.2" fill="none"/></g>`;
  }
  if (id === 'bill') {
    return `<g class="thing"><rect x="-14" y="-12" width="28" height="24" fill="#f6f0dc" stroke="#c9a03a" stroke-width="1.5"/>
      <path d="M-14 0 h28" stroke="#d8c6ad" stroke-dasharray="3 2"/><circle cx="7" cy="-5" r="4" fill="#e9c35a"/><line x1="-10" y1="6" x2="4" y2="6" stroke="#a89e95"/></g>`;
  }
  return `<g class="thing"><rect x="-11" y="-13" width="22" height="26" fill="#d2705f" stroke="#fff" stroke-width="2" stroke-dasharray="2 2"/>
    <path d="M-6 4 l6 -10 l6 10 Z" fill="#fff"/></g>`;
}
