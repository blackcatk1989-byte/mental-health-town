// 許願池留言的連線設定（Supabase）。
// 這裡只能放「設計上可以公開」的資料：專案網址與公開金鑰（publishable／anon public）。
// 管理用的 service_role／secret 金鑰、資料庫密碼、製作者帳號的密碼，絕對不可以寫進這個檔案或上傳到 GitHub。
// 兩個欄位都留空時：在本機（localhost）用假的收件端測試；在正式網站上，留言功能顯示「還在準備中」，只能許願不能留言。
// 設定步驟見 docs/許願池設定說明.md。
export const WISH_CONFIG = {
  url: 'https://kagbhcuaywodaufmdhut.supabase.co',
  publicKey: 'sb_publishable_2XUdytVc-kuxeCXsI-dYDg_pAu9scFd', // 公開金鑰（publishable），設計上可以公開
  table: 'wishes',
};
