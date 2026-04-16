# Smart Archie - 金融合規決策引擎

## 技術架構
- Frontend: 純 HTML + Chart.js
- Backend: Vercel Serverless (analyze.js)
- DB/Auth: Supabase
- AI: Claude API (claude-sonnet)

## 重要規則
- 合規規則資料在 data/ 資料夾
- 每個用戶每月限用 10 次（usage_log 表）
- 兩種報告風格：exec（高層）/ pm（技術）
