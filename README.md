# Cookie Bridge · Cookie 搬家助手

在自己的 Chrome / Microsoft Edge 一般或無痕視窗中，匯入或匯出指定網站的 Cookie。
繁體中文介面、Manifest V3、無第三方執行期套件，不需編譯。

目前版本：**1.1.0**，新增一般／無痕 Cookie 儲存區分離支援。

從 GitHub 取得：按 **Code → Download ZIP** 後解壓縮，或複製此倉庫；安裝時選擇內含 `manifest.json` 的根資料夾。使用原先提供的成品 ZIP 時，該資料夾名稱為 `cookie-bridge`。

## 安裝

1. 解壓縮 ZIP，找到 `cookie-bridge` 資料夾，確認裡面有 `manifest.json`。
2. Chrome 開啟 `chrome://extensions/`；Edge 開啟 `edge://extensions/`。
3. 開啟「開發人員模式」。
4. 按「載入未封裝項目」（Edge 的名稱可能略有不同），選擇 **內含 `manifest.json` 的 `cookie-bridge` 資料夾**。
5. 在瀏覽器工具列的擴充功能選單中，將 Cookie Bridge 釘選。
6. 前往目標網站，點選 Cookie Bridge 圖示，會另開一個管理分頁並帶入網站來源。

適用 Chrome / Edge 130 以上。本版不支援 Firefox 或 Safari。
請保留解壓縮資料夾；瀏覽器會從該位置載入程式。安裝後不需要 Node.js，也不用執行 `npm install`。
這是可自行載入的擴充功能原始碼，尚未發布到 Chrome 線上應用程式商店。

## 從 v1.0.0 更新

1. 關閉舊的 Cookie Bridge 管理分頁。
2. 解壓縮新版，把新版 `cookie-bridge` 的完整內容覆蓋到原本載入的資料夾，包含新增的 `browser-context.mjs`。
3. 到 `chrome://extensions/` 或 `edge://extensions/`，按 Cookie Bridge 卡片上的重新載入按鈕。
4. 在「詳細資料」確認版本為 1.1.0，再重新開啟工具。

保留原本資料夾位置可沿用同一個未封裝擴充功能。若改用新位置，請載入新版資料夾並停用舊版，以免點錯圖示。

## 在無痕模式使用

1. 到 Chrome 的 `chrome://extensions/`，按 Cookie Bridge 的「詳細資料」。
2. 開啟 **「允許在無痕模式中執行」**。Edge 請在 `edge://extensions/` 的詳細資料開啟允許 InPrivate 的選項。
3. 開啟無痕視窗（Windows：`Ctrl+Shift+N`），前往目標網站。
4. **在該無痕視窗**點選 Cookie Bridge 的工具列圖示。工具會在同一個視窗開啟管理分頁。
5. 確認畫面上方顯示 **「無痕視窗」**，再匯入或匯出。

| 開啟工具的視窗 | Cookie 匯入、匯出、覆寫判定及讀回範圍 |
| --- | --- |
| 一般視窗 | 目前瀏覽器設定檔的一般 Cookie 儲存區 |
| 無痕 / InPrivate 視窗 | 目前瀏覽器設定檔的無痕 Cookie 儲存區 |

例如要把一般登入狀態搬到無痕：先在一般視窗匯出 JSON，再到無痕視窗的 Cookie Bridge 匯入同一個檔案。反方向也使用相同流程。來源 JSON 的 `storeId` 不會控制目的地。

同一設定檔的多個無痕視窗通常共用同一個無痕 Cookie 儲存區；不是每扇無痕視窗各自隔離。關閉所有無痕視窗（**包含工具的管理分頁**）後，無痕 Cookie 會清除。已下載到磁碟的 JSON / TXT 檔案仍會保留。

擴充功能不能自行替你開啟無痕權限。如果設定被公司或學校政策停用，需要依該裝置的管理規則處理。

## 匯入現有的 cookies.txt

1. 在來源瀏覽器，用 Get cookies.txt LOCALLY 匯出自己要搬移的網站 Cookie。
2. 在目的瀏覽器開啟 Cookie Bridge，確認「目標網站」，例如 `https://chatgpt.com`。
3. 選擇 `cookies.txt`、拖曳檔案，或展開貼上區。來源內容預設遮蔽。
4. 按「解析並預覽」。查看 Cookie 名稱、Domain、Path、Secure、HttpOnly、SameSite 與到期時間。
5. 選取要匯入的項目，並選擇相同 Cookie 要覆寫或略過。
6. 按「匯入 N 筆已選 Cookie」，在瀏覽器出現網站權限提示時授權。
7. 查看逐筆結果；成功表示寫入後已立即讀回確認。回到網站手動重新整理。

如有 `__Secure-next-auth.session-token.0`、`.1` 等分段，請匯入完整的一組。工具不會合併或修改分段值，也不會刪除目的網站原有的額外分段。
操作時可先關閉其他正在使用該網站的分頁，以減少網站同時更新 Cookie 的情況。

## 建議使用 JSON 備份

如能在來源瀏覽器也安裝 Cookie Bridge，請用「匯出備份」的 JSON 格式：

1. 輸入目標主機，例如 `https://chatgpt.com`。
2. 選擇 JSON。
3. 通常把「分割 Cookie 的頂層網站」留白即可，這會匯出未分割的 Cookie。「未分割」與「一般／無痕視窗」是不同概念，實際儲存區以畫面上方標示為準。
4. 如果確實要搬移 CHIPS / Partitioned Cookie，填入其**原本**的頂層網站，例如 `https://example.com`；工具會額外查詢該分割下的兩種 cross-site-ancestor 狀態。不要把目的站的網址當作新分割鍵改寫。
5. 按「授權並下載備份」，到瀏覽器下載項目確認，再把檔案帶到目的瀏覽器匯入。

匯出範圍是目標主機本身的 Cookie，包括該主機的所有 Path，以及 `.目標主機` 形式的網域 Cookie。
它不會自動收集父網域、其他子網域或所有分割網站。例如匯出 `app.example.com` 不會自動備份 `.example.com`；需要時另外匯出 `example.com`。

| 屬性 | Netscape cookies.txt | Cookie Bridge JSON |
| --- | --- | --- |
| 名稱、值、Domain、Path | 支援 | 支援 |
| Secure、到期時間、工作階段 | 支援 | 支援 |
| HttpOnly | 支援 `#HttpOnly_` 前綴 | 支援 |
| hostOnly / 子網域範圍 | 使用第 2 欄 TRUE / FALSE | 明確保存 |
| SameSite | 格式無此欄位，匯入不指定 | 保存 |
| partitionKey / hasCrossSiteAncestor | 無法保存；不允許匯出分割 Cookie | 保存 |
| 原設定檔 storeId | 不適用 | 不複製；匯入到工具所在的一般／無痕儲存區 |

JSON 是 Cookie API 屬性的備份，並非整個瀏覽器設定檔的複本。Chrome API 不提供的中繼資料（例如原始建立時間、Priority）不在備份中。

## 原本討論的問題如何處理

- `HttpOnly`：使用 `chrome.cookies` API，不依賴 `document.cookie`。
- `__Secure-*`：驗證 Secure，寫入時使用 HTTPS URL。
- `__Host-*`：驗證 Secure、`hostOnly=true`、`Path=/`，呼叫 API 時完全省略 `domain` 欄位。
- `__Http-*` / `__Host-Http-*`：一併驗證 HttpOnly。
- 空值、含等號的值：不做 URL 解碼，不合併分段；保留符合 Cookie 規則的原始值。
- 已過期資料：在預覽及實際寫入前各檢查一次，避免用過期 Cookie 刪掉現有 Cookie。
- 設定不一致：顯示錯誤，不猜測或自動放寬安全屬性。
- 網站把 Cookie 刪掉：工具只能確認當下寫入及讀回，不能阻止網站之後重新設定或刪除。
- 一般／無痕混用：使用 split 模式，依管理分頁的實際 Tab ID 對應 Cookie 儲存區，每一筆 API 讀寫都明確傳入同一個目的 `storeId`。無法確認或狀態不一致時會停止，不猜測 `0` / `1`，也不退回預設儲存區。

**Cookie 匯入成功不保證恢復登入。** 伺服器可讓登入憑證失效，也可能驗證其他裝置狀態；網站還可能依賴 Local Storage、IndexedDB 等未包含在 Cookie 檔案中的資料。

## 格式與限制

- Netscape 格式每筆固定 7 欄，以 **Tab** 分隔，並支援 `#HttpOnly_`。
- JSON 接受 Cookie 陣列，或 `{ "cookies": [...] }`。支援 Chrome Cookie JSON 常見的 `expirationDate`；也接受數值型 `expires` Unix 秒數。
- 不接受 `Cookie: a=b; c=d` 這類 HTTP 請求標頭，因為它缺少必要的範圍與安全屬性。
- 缺少 `hostOnly` 時，JSON 會依 Domain 開頭句點推定，並在預覽標示。若來源格式沒有這個資訊，建議重新匯出。
- 缺少 SameSite 時使用 `unspecified`，不猜測原本是 Lax / Strict / None。
- 分割 Cookie 必須明確提供 `partitionKey.topLevelSite` 與 `hasCrossSiteAncestor`；若舊版匯出檔缺少後者，請用新版 Chrome 重新匯出，避免猜錯分割範圍。
- 過期資料、重複資料、其他主機及格式錯誤的資料會略過。檔案內相同名稱、網域、Path、分割的重複項目，保留第一筆。
- 單次檔案限制 5 MiB、5,000 筆；名稱與值合計限制 4,096 bytes。
- 瀏覽器仍會執行自己的 Domain、公共後綴、Cookie 大小、儲存數量及到期上限規則；工具會顯示失敗或瀏覽器調整結果。
- 來源 `storeId` 不適用其他瀏覽器設定檔或視窗模式，會被忽略。每次開始操作時會重新確認目前管理分頁的儲存區；無法確認時請關閉管理分頁，從目標視窗重新開啟。
- 若匯入數量超出瀏覽器 Cookie 儲存限制，瀏覽器本身仍可能淘汰 Cookie。
- 本工具沒有「先清空整站」功能。覆寫不是交易：中途關閉分頁或發生錯誤時，已寫入的項目會保留；如需復原，先用 JSON 備份。

## 隱私與權限

- 執行期不連外、不含分析服務、遠端腳本、內容腳本或定時掃描。
- CSP 使用 `connect-src 'none'`；不將 Cookie 傳給網站或服務。
- Cookie 來源只在管理分頁的記憶體中處理，不使用 `chrome.storage`、Local Storage 或同步儲存。
- 匯入結果與錯誤不列出 Cookie 值；完成匯入後清除畫面來源值。
- `cookies` 用於手動讀寫，`activeTab` 用於按圖示時帶入目前網站來源；不複製路徑或網址中的查詢資料。
- `optional_host_permissions` 宣告 HTTP / HTTPS 的可選範圍，實際操作時才要求精確主機的存取權；不會在安裝時取得所有網站權限。
- 網域 Cookie 可能適用子網域；匯入父網域 Cookie 時會要求父網域權限。
- 「關於登入狀態、資料格式與權限」中可撤銷已授權的網站權限。
- 無痕模式採 `incognito: "split"`。沒有新增 `tabs`、全網站永久授權或同步資料等權限；視窗模式由瀏覽器 API 判定，不能由網址或匯入檔覆寫。
- 網站存取權由瀏覽器管理，不能把 Cookie 儲存區分離理解為每個模式都有完全獨立的授權設定。
- JSON / TXT 下載檔含可讀的原始 Cookie 值，並未加密。請像密碼備份一樣保管，不要傳給他人或上傳到 Git 儲存庫。

## 開發與驗證

需要 Node.js 20 以上，沒有 npm 套件依賴：

```sh
npm test
```

測試資料全部使用 `example.com` / `.test` 等示範網域與假值，沒有真實登入 Cookie。
`TESTING.md` 記錄自動化測試範圍，以及需要在實際瀏覽器完成的檢查。

檔案結構：

| 檔案 | 用途 |
| --- | --- |
| `manifest.json` | MV3、可選網站權限與 CSP |
| `background.js` | 點工具列圖示時開啟管理分頁 |
| `browser-context.mjs` | 在原視窗開啟工具，驗證一般／無痕模式與 Cookie storeId |
| `manager.html` / `manager.css` / `manager.mjs` | 繁體中文操作介面 |
| `core.mjs` | 純函式格式解析、屬性驗證、範圍判定、序列化 |
| `cookie-api.mjs` | Cookie API 讀寫、衝突處理與讀回驗證 |
| `tests/` | Node.js 自動測試 |
| `examples/` | 無真實憑證的示範資料 |

## 技術參考

依下列文件實作，查閱日期 2026-09-30：

- [Chrome Cookies API](https://developer.chrome.com/docs/extensions/reference/api/cookies)
- [Chrome Manifest：Incognito / split](https://developer.chrome.com/docs/extensions/reference/manifest/incognito)
- [Chrome Tabs API：getCurrent](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-getCurrent)
- [Chrome Extension API：inIncognitoContext](https://developer.chrome.com/docs/extensions/reference/api/extension#property-inIncognitoContext)
- [Chrome Permissions API](https://developer.chrome.com/docs/extensions/reference/api/permissions)
- [Chrome 權限宣告](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [MDN Set-Cookie 與 Cookie 前綴](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)
- [curl Netscape Cookie 格式](https://curl.se/docs/http-cookies.html)
