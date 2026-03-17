export const translations = {
  zh: {
    // Navbar
    nav_about: "关于",
    nav_plugins: "插件",
    nav_architecture: "架构",
    nav_community: "社区",
    nav_launch: "启动应用",

    // Hero
    hero_subtitle: "Web3 AI 智能体框架",
    hero_tagline: "一个框架，35+ 插件，无限可能。",
    hero_cta_launch: "启动应用",
    hero_cta_explore: "了解更多",

    // Capabilities
    cap_title: "核心能力",
    cap_subtitle: "为 Web3 打造的全栈 AI 智能体运行时",
    cap_ai_title: "AI 运行时",
    cap_ai_desc: "多模型 LLM 支持、工具调用、持久化记忆、RAG 知识检索、多智能体编排。",
    cap_trade_title: "交易引擎",
    cap_trade_desc: "自动交易、跟单交易、量化信号、鲸鱼动向预警、DEX 聚合跨协议执行。",
    cap_chain_title: "链上原生",
    cap_chain_desc: "4 种钱包模式、合约扫描、NFT 支持、链上事件监听、代币信任评分。",
    cap_multi_title: "多平台接入",
    cap_multi_desc: "Web、Telegram、Discord、Twitter 连接器，以及 CLI、REST API 和 WebSocket 实时接口。",

    // Plugins
    plug_title: "35+ 插件",
    plug_subtitle: "一个生态，无限扩展。",
    // Plugin descriptions
    p_price: "实时币安行情",
    p_scan: "GoPlus 合约扫描",
    p_swap: "PancakeSwap 交易",
    p_wallet: "余额与转账",
    p_nfa: "BAP-578 Agent 身份",
    p_browser: "浏览器自动化",
    p_shell: "Shell 与文件系统",
    p_cron: "定时任务",
    p_memory: "持久化记忆",
    p_computeruse: "桌面自动化",
    p_vision: "图像分析与 OCR",
    p_knowledge: "文档 RAG 检索",
    p_tts: "语音合成",
    p_sql: "SQL 数据访问",
    p_orchestrator: "多 Agent 编排",
    p_chain_events: "价格与链上监听",
    p_alerts: "通知引擎",
    p_dex_agg: "DEX 聚合",
    p_webhook: "Webhook 推送",
    p_history: "BscScan 查询",
    p_nft: "NFT 详情与转账",
    p_news: "新闻聚合与情绪分析",
    p_trust_score: "代币信任评分",
    p_quant_signal: "量化交易信号",
    p_auto_trade: "策略自动执行",
    p_copy_trade: "钱包跟单",
    p_whale_alert: "鲸鱼监控",
    p_report: "PDF/HTML 报告",
    p_polymarket: "预测市场",
    p_ollama: "本地模型支持",

    // Wallet
    wallet_title: "钱包架构",
    wallet_subtitle: "4 种执行模式 · SQLite 账本 · 每日限额自动重置",
    w_unsigned: "未签名",
    w_unsigned_desc: "返回未签名交易，由外部钱包签名",
    w_delegated: "委托钱包",
    w_delegated_desc: "服务端托管钱包，自动广播",
    w_session: "会话密钥",
    w_session_desc: "签名者、过期时间、权限与限额控制",
    w_custodial: "托管钱包",
    w_custodial_desc: "完全服务端签名与广播",

    // Contract
    contract_label: "合约地址",
    contract_copied: "✓ 已复制！",
    contract_copy: "📋",
    contract_listed: "已上线：",

    // Community
    community_title: "加入社区",

    // Footer
    footer_rights: "© 2026 COCO. 保留所有权利。",
  },

  en: {
    // Navbar
    nav_about: "About",
    nav_plugins: "Plugins",
    nav_architecture: "Architecture",
    nav_community: "Community",
    nav_launch: "Launch App",

    // Hero
    hero_subtitle: "Web3 AI Agent Framework",
    hero_tagline: "One framework. 35+ plugins. Infinite possibilities.",
    hero_cta_launch: "Launch App",
    hero_cta_explore: "Explore",

    // Capabilities
    cap_title: "Core Capabilities",
    cap_subtitle: "A full-stack AI agent runtime built for Web3",
    cap_ai_title: "AI Runtime",
    cap_ai_desc: "Multi-model LLM support, tool calling, persistent memory, RAG knowledge retrieval, and multi-agent orchestration.",
    cap_trade_title: "Trading Engine",
    cap_trade_desc: "Auto-trading, copy-trading, quant signals, whale movement alerts, and DEX aggregation across protocols.",
    cap_chain_title: "On-Chain Native",
    cap_chain_desc: "4 wallet modes, contract scanning, NFT support, chain event monitoring, and normalized trust scoring.",
    cap_multi_title: "Multi-Platform",
    cap_multi_desc: "Web, Telegram, Discord, Twitter connectors plus CLI, REST API, and WebSocket real-time interface.",

    // Plugins
    plug_title: "35+ Plugins",
    plug_subtitle: "One ecosystem. Endlessly extensible.",
    p_price: "Real-time Binance prices",
    p_scan: "GoPlus contract scanning",
    p_swap: "PancakeSwap execution",
    p_wallet: "Balance & transfers",
    p_nfa: "BAP-578 agent identities",
    p_browser: "Browser automation",
    p_shell: "Shell & filesystem",
    p_cron: "Scheduled tasks",
    p_memory: "Persistent memory",
    p_computeruse: "Desktop automation",
    p_vision: "Image analysis & OCR",
    p_knowledge: "Document RAG",
    p_tts: "Text-to-speech",
    p_sql: "SQL data access",
    p_orchestrator: "Multi-agent coordination",
    p_chain_events: "Price & chain watchers",
    p_alerts: "Notifications engine",
    p_dex_agg: "DEX aggregation",
    p_webhook: "Webhook delivery",
    p_history: "BscScan lookups",
    p_nft: "NFT detail & transfer",
    p_news: "RSS & sentiment",
    p_trust_score: "Token trust scoring",
    p_quant_signal: "Trade signals",
    p_auto_trade: "Strategy execution",
    p_copy_trade: "Wallet copy trading",
    p_whale_alert: "Whale monitoring",
    p_report: "PDF/HTML reports",
    p_polymarket: "Prediction markets",
    p_ollama: "Local model support",

    // Wallet
    wallet_title: "Wallet Architecture",
    wallet_subtitle: "4 execution modes. SQLite-backed ledger. Daily limit resets.",
    w_unsigned: "Unsigned",
    w_unsigned_desc: "Returns unsigned transactions for external signing",
    w_delegated: "Delegated",
    w_delegated_desc: "Server-managed wallet with broadcast",
    w_session: "Session Key",
    w_session_desc: "Enforced signer, expiry, permissions & limits",
    w_custodial: "Custodial",
    w_custodial_desc: "Full server-managed signing & broadcast",

    // Contract
    contract_label: "Contract Address",
    contract_copied: "✓ Copied!",
    contract_copy: "📋",
    contract_listed: "Listed on:",

    // Community
    community_title: "Join the Community",

    // Footer
    footer_rights: "© 2026 COCO. All rights reserved.",
  },
};
