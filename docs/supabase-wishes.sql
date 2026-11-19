-- 許願池留言的資料表與權限規則（Supabase）。
-- 用法：Supabase 專案左側 SQL Editor → New query → 整段貼上 → Run。只需要執行一次。
-- 這個檔案沒有任何金鑰或密碼，可以放在倉庫裡。

-- 1. 資料表：每筆只有留言文字、送出時間，以及製作者自己用的「已讀」標記
create table if not exists public.wishes (
  id uuid primary key default gen_random_uuid(),
  message text not null check (char_length(btrim(message)) between 1 and 200),
  created_at timestamptz not null default now(),
  is_read boolean not null default false
);

-- 2. 打開「列層級安全性」：沒有寫明允許的事，一律不准
alter table public.wishes enable row level security;

-- 3. 一般訪客（未登入）：只能新增留言，而且只能填 message 這一欄（時間由資料庫自己記，無法偽造）
drop policy if exists "visitors can add a wish" on public.wishes;
create policy "visitors can add a wish" on public.wishes
  for insert to anon
  with check (is_read = false);

-- 4. 登入的製作者：可以讀取、標記已讀、刪除
drop policy if exists "makers can read wishes" on public.wishes;
create policy "makers can read wishes" on public.wishes
  for select to authenticated using (true);

drop policy if exists "makers can mark wishes read" on public.wishes;
create policy "makers can mark wishes read" on public.wishes
  for update to authenticated using (true) with check (true);

drop policy if exists "makers can delete wishes" on public.wishes;
create policy "makers can delete wishes" on public.wishes
  for delete to authenticated using (true);

-- 5. 欄位層級的權限：訪客只能寫入 message；製作者只能改 is_read
revoke all on public.wishes from anon, authenticated;
grant insert (message) on public.wishes to anon;
grant select, delete on public.wishes to authenticated;
grant update (is_read) on public.wishes to authenticated;

-- 注意：「登入的人都能讀」這條規則，要搭配在 Authentication 設定裡關閉「允許新使用者註冊」，
-- 否則任何人自己註冊一個帳號就能讀到留言。製作者帳號請在 Authentication → Users 手動新增。
