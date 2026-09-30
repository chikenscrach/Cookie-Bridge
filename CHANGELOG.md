# 更新紀錄

## 1.1.0 · 2026-09-30

新增一般與無痕 / InPrivate 視窗支援。

- Manifest 改用 `incognito: "split"`；需使用者在瀏覽器詳細資料啟用無痕權限。
- 管理分頁固定開在點選工具列圖示的視窗。
- 以管理分頁 Tab ID 和 `getAllCookieStores()` 對應目前的儲存區，再以 `inIncognitoContext` 檢查模式。
- 匯入、相同 Cookie 判定、讀回確認、未分割與分割 Cookie 匯出均明確指定目的 `storeId`。
- 無法確認視窗或儲存區時停止操作；不猜測 ID 或使用其他視窗作為備援。
- 畫面標示視窗模式，備份檔名區分 `regular` / `incognito`。
- 不沿用來源檔中的 `storeId`，跨模式搬移透過匯出再匯入完成。
- 新增 17 項自動化測試，合計 47 項通過；Chrome / Edge 實機驗證尚未完成。

## 1.0.0 · 2026-09-30

初版：cookies.txt / JSON 匯入、預覽、匯出，以及逐筆寫入確認。僅支援一般視窗。
