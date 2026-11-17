// 可以摸的小東西：純趣味的小互動（content/fun.json）。每個只有一個小動畫或一行字，
// 不給卡片、不影響任務、不寫進存檔，也不出現在任務欄、麻糬的提示與文字模式。
import { play } from '../sfx.js';
import { esc } from '../ui.js';

export function createToys(list, meshes, ui, effects = {}) {
  const targets = list.map((toy) => ({
    id: `toy:${toy.id}`, kind: 'toy', name: toy.name, verb: toy.verb, x: toy.x, z: toy.z, cardTarget: false, toy, turn: 0,
  }));
  const byId = new Map(targets.map((t) => [t.id, t]));
  const wobbles = new Map(); // 網格 → 剩餘時間

  return {
    targets,
    byId: (id) => byId.get(id),
    // 玩家摸了一下
    poke(t) {
      const { toy } = t;
      const line = toy.lines[t.turn % toy.lines.length];
      t.turn++;
      ui.toast(esc(line), { ms: 3600 });
      play(toy.sound ?? 'click');
      const mesh = meshes[toy.mesh];
      if (mesh) wobbles.set(mesh, 0.9);
      effects[toy.effect]?.(); // 少數小東西有自己的效果（例如上香）
      return line;
    },
    update(dt, still) {
      for (const [mesh, left] of wobbles) {
        const l = left - dt;
        // 減少動畫時不晃，只有文字與聲音
        mesh.rotation.z = still || l <= 0 ? 0 : Math.sin((0.9 - l) * 22) * 0.09 * (l / 0.9);
        if (l <= 0) wobbles.delete(mesh); else wobbles.set(mesh, l);
      }
    },
  };
}
