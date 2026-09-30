# Cookie Bridge · Cookie 搬家助手

Cookie Bridge 是一個給 **Chrome / Microsoft Edge** 使用的 Manifest V3 擴充功能，用來在自己的瀏覽器中預覽、匯入與匯出指定網站的 Cookie。

支援一般視窗與無痕 / InPrivate 視窗、Netscape `cookies.txt` 與 Cookie Bridge JSON。介面為繁體中文，執行期沒有第三方套件、遠端腳本或分析服務，也不需要編譯。

> **目前版本：1.1.0**
>
> v1.1.0 新增一般／無痕 Cookie 儲存區分離支援。完整變更請見 [CHANGELOG.md](CHANGELOG.md)。

## 功能

- 匯入 Netscape `cookies.txt`
- 匯入 / 匯出 Cookie Bridge JSON
- 匯入前預覽 Cookie 屬性與錯誤
- 可選擇覆寫或保留目的瀏覽器中的同名 Cookie
- 支援 `HttpOnly`、`Secure`、`__Secure-*`、`__Host-*` 等 Cookie 規則
- 支援 CHIPS / Partitioned Cookie 的 JSON 備份
- 一般視窗與無痕 / InPrivate Cookie 儲存區分離
- 每筆寫入後立即讀回確認
- 網站權限採按需授權，不在安裝時要求所有網站存取權
- 所有 Cookie 資料只在本機處理

## 支援環境

| 項目 | 支援狀態 |
| --- | --- |
| Google Chrome | 130 以上 |
| Microsoft Edge | 130 以上 |
| 一般視窗 | 支援 |
| 無痕 / InPrivate | 支援，需手動允許擴充功能在無痕模式執行 |
| Firefox | 不支援 |
| Safari | 不支援 |
| Node.js | 使用擴充功能時不需要；執行測試時需 20 以上 |

## 安裝

此專案目前尚未發布到 Chrome 線上應用程式商店，需以「載入未封裝項目」方式安裝。

1. 在 GitHub 按 **Code → Download ZIP**，解壓縮下載內容；也可以直接 clone 此 repository。
2. 找到內含 `manifest.json` 的專案根目錄。
3. Chrome 開啟 `chrome://extensions/`；Edge 開啟 `edge://extensions/`。
4. 開啟 **開發人員模式**。
5. 選擇 **載入未封裝項目**，指定專案根目錄。
6. 建議在工具列的擴充功能選單中將 Cookie Bridge 釘選。
7. 前往要操作的網站，點選 Cookie Bridge 圖示。

瀏覽器會從原資料夾載入擴充功能，因此安裝後請不要刪除或移動該資料夾。使用本擴充功能不需要 `npm install`。

## 快速使用

### 匯入 Cookie

1. 在目標網站開啟 Cookie Bridge。
2. 確認畫面上的「目標網站」與目前視窗模式。
3. 選擇 `cookies.txt` 或 JSON；也可以拖曳檔案或貼上內容。
4. 按 **解析並預覽**。
5. 檢查 Cookie 名稱、Domain、Path、Secure、HttpOnly、SameSite 與到期時間。
6. 選取要匯入的項目，並選擇遇到現有 Cookie 時要 **覆寫** 或 **略過**。
7. 按 **匯入 N 筆已選 Cookie**。
8. 瀏覽器詢問網站權限時予以授權。
9. 查看逐筆結果，回到原網站手動重新整理。

「成功」代表 Cookie 已寫入，並由擴充功能立即讀回確認；不代表網站一定會接受該登入狀態。

### 匯出 Cookie

1. 在來源網站開啟 Cookie Bridge。
2. 切換到 **匯出備份**。
3. 確認目標主機。
4. 選擇 JSON 或支援的匯出格式。
5. 按 **授權並下載備份**。
6. 妥善保存下載檔案。

若來源與目的瀏覽器都能安裝 Cookie Bridge，建議優先使用 **JSON**，因為它能保留比 Netscape `cookies.txt` 更多的 Cookie 屬性。

## 無痕 / InPrivate 模式

Cookie Bridge 使用 Manifest V3 的：

```json
"incognito": "split"
```

因此一般視窗與無痕 / InPrivate 視窗會使用不同的擴充功能執行環境與 Cookie 儲存區。

### 啟用方式

1. Chrome 到 `chrome://extensions/`，開啟 Cookie Bridge 的 **詳細資料**。
2. 開啟 **允許在無痕模式中執行**。
3. Edge 則在 `edge://extensions/` 的詳細資料中開啟允許 InPrivate 的選項。
4. 開啟無痕 / InPrivate 視窗。
5. 在 **該視窗內** 點選 Cookie Bridge 工具列圖示。
6. 確認管理頁面上方顯示 **無痕視窗**。

| 開啟 Cookie Bridge 的位置 | 實際操作範圍 |
| --- | --- |
| 一般視窗 | 目前瀏覽器設定檔的一般 Cookie 儲存區 |
| 無痕 / InPrivate 視窗 | 目前瀏覽器設定檔的無痕 Cookie 儲存區 |

若要把一般視窗的 Cookie 搬到無痕視窗，流程是：

**一般視窗匯出 → 無痕視窗開啟 Cookie Bridge → 匯入同一份檔案**

反方向亦相同。來源 JSON 中的 `storeId` 不會決定目的儲存區；目的儲存區以 Cookie Bridge 所在的實際視窗為準。

同一設定檔中的多個無痕視窗通常共用同一個無痕 Cookie 儲存區，而不是每個視窗各自隔離。關閉所有無痕視窗，包括 Cookie Bridge 的無痕管理分頁後，無痕 Cookie 會由瀏覽器清除。

> 擴充功能不能自行替使用者開啟無痕權限。若此選項被公司、學校或瀏覽器政策停用，需依裝置管理政策處理。

## `cookies.txt` 與 JSON

### Netscape `cookies.txt`

Cookie Bridge 支援常見的 Netscape Cookie File 格式：

- 每筆固定 7 欄
- 欄位以 **Tab** 分隔
- 支援 `#HttpOnly_` 前綴
- 保留名稱、值、Domain、Path、Secure 與到期時間

若 Cookie 名稱被分割成例如：

```text
__Secure-next-auth.session-token.0
__Secure-next-auth.session-token.1
```

請匯入完整的一組。Cookie Bridge 不會自動合併、重排或修改分段值。

### Cookie Bridge JSON

JSON 可以保存更多瀏覽器 Cookie API 屬性，因此適合作為完整度較高的備份格式。

| 屬性 | Netscape cookies.txt | Cookie Bridge JSON |
| --- | --- | --- |
| 名稱、值、Domain、Path | 支援 | 支援 |
| Secure、到期時間、Session | 支援 | 支援 |
| HttpOnly | 透過 `#HttpOnly_` | 支援 |
| hostOnly | 依格式欄位表達 | 明確保存 |
| SameSite | 無此欄位 | 保存 |
| partitionKey | 無法保存 | 保存 |
| hasCrossSiteAncestor | 無法保存 | 保存 |
| 原始 storeId | 不適用 | 不複製到目的環境 |

JSON 是 Cookie API 可見屬性的備份，**不是整個瀏覽器設定檔的備份**。例如 Local Storage、IndexedDB、原始 Cookie 建立時間、Priority 等資料不在此格式中。

## CHIPS / Partitioned Cookie

一般情況下，「分割 Cookie 的頂層網站」欄位留白即可，此時處理的是未分割 Cookie。

只有在確定要搬移 CHIPS / Partitioned Cookie 時，才填入其**原本的頂層網站**，例如：

```text
https://example.com
```

Cookie Bridge 會依該 partition key 查詢對應資料，並保存 `hasCrossSiteAncestor` 狀態。

請勿為了搬到另一個網站而自行改寫 partition key。分割鍵屬於 Cookie 的安全與儲存範圍資訊，不是目的網址欄位。

## Cookie 規則處理

Cookie Bridge 不使用 `document.cookie` 直接搬移 Cookie，而是透過瀏覽器的 `chrome.cookies` API 讀寫。

主要處理規則如下：

- `HttpOnly`：透過 Cookies API 處理。
- `__Secure-*`：要求 Secure，並以 HTTPS URL 寫入。
- `__Host-*`：要求 Secure、`Path=/`、`hostOnly=true`，寫入時省略 `domain` 欄位。
- `__Http-*` / `__Host-Http-*`：同時檢查 HttpOnly。
- 空值與含 `=` 的值：不做 URL 解碼或內容重組。
- 已過期 Cookie：預覽與實際寫入前都會檢查，避免用過期資料刪除現有 Cookie。
- 設定互相衝突：顯示錯誤，不自行放寬安全屬性。
- 一般／無痕模式：每次操作均確認目前管理分頁所屬 Cookie store，並明確指定相同 `storeId`。
- 無法確認目前 store 或視窗模式時：停止操作，不猜測 `0`、`1` 等實作 ID，也不回退到預設儲存區。

網站仍可在頁面重新載入後重新設定或刪除 Cookie。Cookie Bridge 只能確認「寫入當下」的結果。

## 匯出範圍

匯出指定主機時，Cookie Bridge 會處理：

- 該主機本身的 Cookie
- 該主機所有 Path
- 對應的 `.目標主機` 網域 Cookie

它不會自動掃描：

- 父網域
- 其他子網域
- 所有 partition key

例如匯出 `app.example.com` 不代表會自動把所有 `.example.com` 或其他子網域資料一起備份。若需要其他範圍，請分別匯出。

## 格式與限制

- JSON 接受 Cookie 陣列，或 `{ "cookies": [...] }`。
- 支援 Chrome Cookie JSON 常見的 `expirationDate`。
- 也接受數值型 `expires` Unix 秒數。
- 不接受只有 `Cookie: a=b; c=d` 的 HTTP Cookie request header，因為它缺少 Domain、Path 與安全屬性。
- JSON 缺少 `hostOnly` 時，會依 Domain 是否以句點開頭推定，並在預覽中標示。
- 缺少 SameSite 時使用 `unspecified`，不猜測 Lax / Strict / None。
- 分割 Cookie 需提供 `partitionKey.topLevelSite` 與 `hasCrossSiteAncestor`。
- 過期、重複、其他主機或格式錯誤的資料會略過。
- 檔案內相同名稱、Domain、Path 與 partition key 的重複項目保留第一筆。
- 單次檔案最大 5 MiB。
- 單次最多 5,000 筆。
- Cookie 名稱與值合計限制為 4,096 bytes。
- 瀏覽器自身仍會套用 Domain、Public Suffix、Cookie 大小、數量與到期上限等規則。
- 匯入數量過多時，瀏覽器仍可能依自身規則淘汰舊 Cookie。
- Cookie Bridge 不提供「先清空整站 Cookie」功能。
- 覆寫不是交易操作；若途中關閉管理頁面或發生錯誤，先前成功寫入的項目不會自動回復。

重要資料建議先用 JSON 匯出備份，再進行覆寫。

## 登入狀態的重要限制

> **Cookie 匯入成功，不代表登入狀態一定能恢復。**

網站可能還會驗證或依賴：

- 已被伺服器撤銷的 Session / Token
- 裝置或瀏覽器狀態
- Local Storage
- IndexedDB
- Service Worker 或其他站點資料
- 伺服器端風險判定與重新登入要求

Cookie Bridge 不會繞過網站的登入驗證，只負責依瀏覽器允許的 Cookie API 匯入與匯出資料。

## 隱私與安全

- 執行期不連外。
- 不含分析服務、遠端腳本或定時掃描。
- CSP 設定 `connect-src 'none'`。
- 不使用內容腳本讀取頁面。
- Cookie 內容只在 Cookie Bridge 管理頁面的記憶體中處理。
- 不使用 `chrome.storage`、Local Storage 或同步儲存保存 Cookie。
- 匯入結果與錯誤訊息不顯示 Cookie 值。
- 匯入完成後會清除畫面中的來源值。
- `cookies` 權限僅用於手動讀寫 Cookie。
- `activeTab` 只用於點選工具列圖示時帶入目前網站來源。
- 不複製原始頁面的 Path、Query String 或 Fragment。
- `optional_host_permissions` 僅宣告 HTTP / HTTPS 的可選存取範圍。
- 實際操作網站時才要求對應主機權限。
- 不在安裝時取得所有網站的永久存取權。
- 已授權網站可由工具介面中的權限管理功能撤銷。

### 備份檔案

JSON / TXT 匯出檔包含**可直接讀取的原始 Cookie 值，而且沒有加密**。

請把這類檔案視為密碼或 Session 備份：

- 不要傳給不信任的人
- 不要貼到公開聊天、Issue 或論壇
- 不要提交到 Git repository
- 使用完畢後依需求刪除或安全保存

## 從 v1.0.0 更新

1. 關閉舊版 Cookie Bridge 管理頁面。
2. 下載 v1.1.0。
3. 將新版專案內容完整覆蓋原本載入的資料夾，包含新增的 `browser-context.mjs`。
4. 到 `chrome://extensions/` 或 `edge://extensions/`。
5. 對 Cookie Bridge 按 **重新載入**。
6. 在詳細資料中確認版本為 **1.1.0**。

如果改用另一個資料夾位置重新載入，建議停用或移除舊版，避免工具列同時出現兩個 Cookie Bridge。

## 開發與測試

測試需要 Node.js 20 以上，不需要安裝 npm 套件：

```sh
npm test
```

目前測試使用 Node.js 內建 test runner，所有測試資料皆為人工建立的假 Cookie。

v1.1.0 共 **47 項自動化測試通過**，涵蓋：

- Netscape / JSON 解析
- HttpOnly、hostOnly、SameSite 與 Cookie prefix
- Domain 邊界
- 過期、重複與分段資料
- Partitioned Cookie
- 權限範圍
- 匯出往返
- 覆寫 / 略過
- 一般／無痕 Cookie store 隔離
- storeId 對應與失敗保護

更完整的驗證內容請見 [TESTING.md](TESTING.md)。

> **實機驗證狀態**
>
> 目前自動化測試已完成，但專案製作環境尚未完成 Chrome / Edge 的真實瀏覽器實機驗證。因此 README 不宣稱真實瀏覽器上的所有 Cookie API 行為、無痕 split 行為、權限提示與登入狀態恢復都已實測。

## 專案結構

| 檔案 | 用途 |
| --- | --- |
| `manifest.json` | Manifest V3、權限、Incognito split 與 CSP |
| `background.js` | 點選工具列圖示時開啟管理頁面 |
| `browser-context.mjs` | 判定一般／無痕視窗與 Cookie storeId |
| `manager.html` | 管理介面 |
| `manager.css` | 管理介面樣式 |
| `manager.mjs` | 管理介面互動與操作流程 |
| `core.mjs` | 格式解析、屬性驗證、範圍判定與序列化 |
| `cookie-api.mjs` | Cookies API 讀寫、衝突處理與讀回確認 |
| `tests/` | Node.js 自動化測試 |
| `examples/` | 不含真實憑證的示範資料 |
| `TESTING.md` | 測試範圍與實機驗證清單 |
| `CHANGELOG.md` | 版本更新紀錄 |

## 技術參考

實作主要參考以下文件，查閱日期：2026-09-30。

- [Chrome Cookies API](https://developer.chrome.com/docs/extensions/reference/api/cookies)
- [Chrome Manifest：Incognito / split](https://developer.chrome.com/docs/extensions/reference/manifest/incognito)
- [Chrome Tabs API：getCurrent](https://developer.chrome.com/docs/extensions/reference/api/tabs#method-getCurrent)
- [Chrome Extension API：inIncognitoContext](https://developer.chrome.com/docs/extensions/reference/api/extension#property-inIncognitoContext)
- [Chrome Permissions API](https://developer.chrome.com/docs/extensions/reference/api/permissions)
- [Chrome 權限宣告](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [MDN：Set-Cookie 與 Cookie prefixes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie)
- [curl：HTTP Cookies / Netscape Cookie File](https://curl.se/docs/http-cookies.html)

---

Cookie Bridge 適合在**自己控制的瀏覽器與帳號環境**中搬移或備份 Cookie。對重要帳號操作前，建議先保留原始 Cookie 備份，並確認匯出檔案沒有被同步、公開或提交到版本控制。
