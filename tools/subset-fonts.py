#!/usr/bin/env python3
"""維護用：把字體縮成「遊戲實際用到的字」，產生 assets/fonts/*.woff2。

這不是遊戲執行時需要的建置步驟；只有新增或修改文字後，才需要手動重跑一次。
沒重跑時，子集裡沒有的字會自動退回系統字體顯示，不會變成空白。

需要：
  pip install fonttools brotli
  原始字體（不放進倉庫，太大）：
    jf open 粉圓 2.1  https://github.com/justfont/open-huninn-font （font/jf-openhuninn-2.1.ttf）
    芫荽 Iansui        https://github.com/ButTaiwan/iansui （或 Google Fonts 的 Iansui-Regular.ttf）

用法：
  python3 tools/subset-fonts.py --huninn 路徑/jf-openhuninn-2.1.ttf --iansui 路徑/Iansui-Regular.ttf

授權：兩款都是 SIL Open Font License 1.1。jf open 粉圓宣告了保留字型名稱（open huninn、huninn、Varela、Varela Round），
子集化屬於修改，所以輸出的字體內部名稱改為「XZJ Round」；芫荽沒有保留字型名稱，仍一併改名為「XZJ Hand」以便辨識。
"""
import argparse
import json
import re
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'assets' / 'fonts'

# 一定要有的字：英數、常用標點、全形標點
BASE = ''.join(chr(c) for c in range(0x20, 0x7F)) + '　、。，．：；？！「」『』（）《》〈〉【】…—～・＋－＝％／０１２３４５６７８９'


def strings_in(value):
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for v in value.values():
            yield from strings_in(v)
    elif isinstance(value, list):
        for v in value:
            yield from strings_in(v)


def all_text():
    """遊戲裡會出現的所有文字：content/ 的 JSON、index.html、src/ 的程式（介面字串）。"""
    parts = [BASE]
    for p in sorted((ROOT / 'content').glob('*.json')):
        parts.extend(strings_in(json.loads(p.read_text(encoding='utf-8'))))
    parts.append((ROOT / 'index.html').read_text(encoding='utf-8'))
    for p in sorted((ROOT / 'src').rglob('*.js')):
        parts.append(p.read_text(encoding='utf-8'))
    return ''.join(parts)


def hand_text():
    """手寫字體只用在便條、卡片標題、標題列，字數少很多。"""
    parts = [BASE, '心之間微光里今天有點卡卡的']
    cards = json.loads((ROOT / 'content' / 'cards.json').read_text(encoding='utf-8'))
    parts.extend(k['title'] for k in cards['cards'])
    mg = json.loads((ROOT / 'content' / 'minigames.json').read_text(encoding='utf-8'))
    parts.append(mg['thought']['note'])
    parts.extend(m['title'] for m in mg.values() if isinstance(m, dict) and 'title' in m)
    pz = json.loads((ROOT / 'content' / 'puzzles.json').read_text(encoding='utf-8'))
    parts.extend(p['title'] for p in pz['puzzles'].values())
    parts.extend(p.get('note', '') for p in pz['puzzles'].values())
    return ''.join(parts)


def rename(font, family):
    """把 name 表裡的家族名稱改掉（OFL 保留字型名稱的規定）。"""
    names = {1: family, 4: family, 6: family.replace(' ', '') + '-Regular', 16: family, 3: family + ' subset', 17: 'Regular'}
    for rec in font['name'].names:
        if rec.nameID in names:
            rec.string = names[rec.nameID]


def build(src, text, family, out):
    chars = sorted({c for c in text if ord(c) >= 0x20})
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['*']
    opts.name_IDs = ['*']
    opts.name_languages = ['*']
    opts.notdef_outline = True
    font = TTFont(src)
    sub = subset.Subsetter(options=opts)
    sub.populate(text=''.join(chars))
    sub.subset(font)
    rename(font, family)
    font.flavor = 'woff2'
    out.parent.mkdir(parents=True, exist_ok=True)
    font.save(out)
    print(f'{out.relative_to(ROOT)}：{len(chars)} 字，{out.stat().st_size / 1024:.0f} KB')


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--huninn', required=True, help='jf-openhuninn-2.1.ttf 的路徑')
    ap.add_argument('--iansui', required=True, help='Iansui-Regular.ttf 的路徑')
    args = ap.parse_args()
    # 去掉程式碼裡的註解以外沒必要區分；多收幾個字不影響正確性，只多一點檔案大小
    text = re.sub(r'\s+', '', all_text())
    build(args.huninn, text, 'XZJ Round', OUT / 'xzj-round.woff2')
    build(args.iansui, hand_text(), 'XZJ Hand', OUT / 'xzj-hand.woff2')


if __name__ == '__main__':
    main()
