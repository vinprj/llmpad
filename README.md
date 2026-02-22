<!-- markdownlint-disable MD041 -->
<p align="center">
  <a href="https://llmpad.vercel.app">
    <img src="https://img.shields.io/badge/⚡-LLMPad-orange?style=for-the-badge" alt="LLMPad">
  </a>
  <br>
  <a href="https://llmpad.vercel.app">
    <img src="https://img.shields.io/badge/Live_Demo-ff9500?style=flat" alt="Live Demo">
  </a>
  <a href="https://github.com/vinprj/llmpad/stargazers">
    <img src="https://img.shields.io/github/stars/vinprj/llmpad?style=flat&color=ff9500" alt="Stars">
  </a>
  <a href="https://github.com/vinprj/llmpad/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/License-MIT-orange?style=flat" alt="License">
  </a>
</p>

# ⚡ LLMPad

AI chat playground powered by **Sarvam AI** — with streaming responses, markdown rendering, and multi-model support.

![LLMPad Screenshot](https://placehold.co/800x500/1a1a1a/ff9500?text=LLMPad+Chat+UI)

## Features

- 🌀 **Real-time streaming** — Responses stream in as they're generated
- 📝 **Markdown support** — Code blocks, tables, lists, and more
- 🎛️ **Model selector** — Choose from multiple Sarvam AI models
- 🧠 **Reasoning mode** — Switch to OpenRouter for advanced reasoning models
- 🔊 **Text-to-Speech** — Hear voices responses with configurable
- 👁️ **Vision API** — Upload images/PDFs for AI analysis
- 💬 **Conversation history** — Save and manage chats (Supabase auth)
- 🌙 **Dark/Light theme** — Follows system preference

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/vinprj/llmpad.git
cd llmpad
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file:

```env
# Supabase (required for auth & chat history)
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# API Keys (optional — users can also provide their own)
SARVAM_API_KEY=your_sarvam_api_key
OPENROUTER_API_KEY=your_openrouter_api_key
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Tech Stack

- **Framework:** Next.js 15 (App Router)
- **UI:** React 19, Tailwind CSS
- **Auth & DB:** Supabase
- **AI:** Sarvam AI, OpenRouter
- **Markdown:** react-markdown, react-syntax-highlighter

## Project Structure

```
llmpad/
├── app/
│   ├── api/
│   │   ├── chat/         # Sarvam AI chat endpoint
│   │   ├── openrouter/   # OpenRouter endpoint
│   │   ├── tts/         # Text-to-speech endpoint
│   │   └── vision/      # Vision API endpoint
│   ├── globals.css      # Global styles
│   ├── layout.tsx       # Root layout
│   ├── lib/
│   │   └── supabase.ts  # Supabase client
│   └── page.tsx         # Main chat UI
├── tailwind.config.ts   # Tailwind config
└── package.json
```

## Configuration

### Models

Edit the `MODELS` array in `app/page.tsx` to add/remove available models.

### TTS Voices

Configure `TTS_LANGUAGES` and `TTS_SPEAKERS` in `app/page.tsx`.

## Deployment

Deploy to Vercel:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/vinprj/llmpad)

> **Note:** Set environment variables in Vercel project settings.

## License

MIT — see [LICENSE](LICENSE) for details.

---

<p align="center">
  Made with ⚡ by <a href="https://github.com/vinprj">@vinprj</a>
</p>
