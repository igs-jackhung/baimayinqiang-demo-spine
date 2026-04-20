# AI Agent 開發分發包使用指南 (Agent Distribution Legend)

本資料夾包含了從「白馬銀槍」Demo 成功經驗中提取的核心 AI Agent 資源。這套資源包旨在幫助新的專案組快速建立具備高美學標準、技術穩定性的博弈遊戲原型。

## 📦 資源包內容

- **`.cursorrules`**: AI 核心行為準則，定義了 UI 對稱、人體工學、Spine 補丁與開發品質的黃金標準。
- **`.agent/skills/`**: 7 個核心技能腳本，賦予 AI 產出 GDD、美術規格、Demo 代碼、影片過場與音效整合的能力。
- **`.agent/resources/`**: 通用的遊戲開發公規（common_game_specs.md），減少 AI 解析 Token 並維持規格一致。
- **`agent_dashboard.html`**: 分享儀表板 (Quick Preview)，用於引導使用者理解開發流程與 Skill 說明。

## 🚀 如何匯入新專案

1.  **複製檔案**：將此資料夾內的所有內容（含隱藏檔 `.cursorrules` 與 `.agent/`）複製到你的新專案根目錄。
2.  **啟動環境**：建議使用支援 Cursor 規則或類似 Agentic Workflow 的開發環境。
3.  **初次對話**：在新專案中詢問 AI：「請讀取 .cursorrules 與所有的 Skill，並產出一份新遊戲的開發架構建議。」

## 🛠️ 核心功能指令

匯入後，你可以嘗試使用以下指令（或類似語義的工作流）：

*   **`/generate-gdd`**：啟動 `Skill 02` 產出標準程式規格文件。
*   **`/generate-art-spec`**：啟動 `Skill 04` 定義美術素材清單。
*   **`/launch-demo`**：啟動本地伺服器並預覽 Demo 畫面。
*   **「執行 Spine 串接優化」**：指導 AI 針對現有 PixiJS 專案套用 `Skill 13` 中的相容性補丁。

## ⚠️ 注意事項
- **去專案化**：本資源包已移除所有特定英雄（如趙雲）或主題（如三國）的限制，僅保留技術與 UI 標準，請根據新專案需求自行填入主題內容。
- **金鑰配置**：若需使用 `Skill 11` (產圖) 或 `Skill 15` (過場影片)，請確保根目錄下的 `.env` 檔案已配置正確的 `GEMINI_API_KEY`。

---
"Thank You. Ready for Next Generation."
