// 3D 模式的輸入：鍵盤（WASD／方向鍵移動、E 互動、F 使用理解卡）、手機虛擬搖桿、互動按鈕列。
import { $ } from '../ui.js';

export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

export function setupControls({ onInteract, onUse, isBlocked }) {
  const keys = new Set();
  const stick = { x: 0, y: 0 };

  const keydown = (e) => {
    if (isBlocked()) return;
    if (MOVE_KEYS.includes(e.code)) {
      keys.add(e.code);
      e.preventDefault();
    }
    if (e.repeat) return;
    if (e.code === 'KeyE') onInteract();
    if (e.code === 'KeyF') onUse();
  };
  const keyup = (e) => keys.delete(e.code);
  const blur = () => keys.clear();
  addEventListener('keydown', keydown);
  addEventListener('keyup', keyup);
  addEventListener('blur', blur);

  // 手機虛擬搖桿
  const pad = $('stick');
  const thumb = $('stick-thumb');
  let id = null;
  const move = (e) => {
    const r = pad.getBoundingClientRect();
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const max = r.width / 2;
    const len = Math.hypot(dx, dy);
    if (len > max) { dx *= max / len; dy *= max / len; }
    thumb.style.transform = `translate(${dx}px, ${dy}px)`;
    stick.x = dx / max;
    stick.y = dy / max;
  };
  const end = (e) => {
    if (e.pointerId !== id) return;
    id = null;
    thumb.style.transform = '';
    stick.x = stick.y = 0;
  };
  const down = (e) => { id = e.pointerId; pad.setPointerCapture(id); move(e); };
  const pmove = (e) => { if (e.pointerId === id) move(e); };
  pad.addEventListener('pointerdown', down);
  pad.addEventListener('pointermove', pmove);
  pad.addEventListener('pointerup', end);
  pad.addEventListener('pointercancel', end);
  pad.classList.toggle('hidden', !isTouch);
  $('controls-tip').classList.toggle('hidden', isTouch);

  $('interact-go').onclick = onInteract;
  $('interact-use').onclick = onUse;

  return {
    // 目前的移動方向（-1～1）；面板或對話開著時為 0
    direction() {
      if (isBlocked()) {
        keys.clear();
        return { x: 0, y: 0 };
      }
      const k = (a, b) => (keys.has(a) || keys.has(b) ? 1 : 0);
      return {
        x: k('ArrowRight', 'KeyD') - k('ArrowLeft', 'KeyA') + stick.x,
        y: k('ArrowDown', 'KeyS') - k('ArrowUp', 'KeyW') + stick.y,
      };
    },
    // 顯示附近可互動的目標
    showTarget(t) {
      $('interact').classList.toggle('hidden', !t);
      if (!t) return;
      $('interact-name').textContent = t.name;
      $('interact-go').textContent = `${t.kind === 'character' ? '對話' : t.kind === 'pickup' ? '拾取' : '查看'}${isTouch ? '' : '（E）'}`;
      $('interact-use').classList.toggle('hidden', !t.cardTarget);
      $('interact-use').textContent = `使用理解卡${isTouch ? '' : '（F）'}`;
    },
    stop() {
      removeEventListener('keydown', keydown);
      removeEventListener('keyup', keyup);
      removeEventListener('blur', blur);
      pad.removeEventListener('pointerdown', down);
      pad.removeEventListener('pointermove', pmove);
      pad.removeEventListener('pointerup', end);
      pad.removeEventListener('pointercancel', end);
      pad.classList.add('hidden');
      $('controls-tip').classList.add('hidden');
      $('interact').classList.add('hidden');
    },
  };
}
