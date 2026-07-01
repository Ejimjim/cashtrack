# CashTrack

CashTrack is a Cash-Flow Management Information System (MIS) designed to support financial decision-making among micro-enterprises in Nigeria. It is a research prototype built for a Master's thesis.

The system lets a trader record sales and expenses by typing plain-language messages to a Telegram bot (e.g. *"sold rice 3500"* or *"paid transport 800"*). An LLM (OpenAI API) interprets each message, extracts structured transaction data, and persists it to a SQLite database. The bot replies with immediate confirmation and daily totals. A separate mobile-first React dashboard reads the same database through a REST API, providing date-grouped transaction history and weekly financial decision-support insights.

---

## Key Features

- **Conversational transaction capture** via Telegram — no forms, no menus
- **Natural-language interpretation** using the OpenAI API (GPT-4o mini)
- **Free-text categories** derived from the item in the message, with spelling normalisation and reuse of existing close-match categories
- **Multi-item entry** in a single message, supporting comma, newline, space, and run-together formats; a single action verb carries forward to cover subsequent verb-less items, with per-line confirmation so the user can catch any wrong inference
- **Daily, weekly, and all-time queries** answered in plain language via the bot (`today`, `this week`, `balance`)
- **Plain-language financial insights** generated from computed figures without an LLM (rule-based)
- **Mobile-first React dashboard** with Home, History, Week, and Settings screens; history grouped by date; individual transaction delete with confirmation
- **Automated unit test suite** covering all cashflow computation functions and insight generation logic

---

## Architecture

```
Telegram ──► bot.js ──► interpreter.js ──► OpenAI API
                │
                ▼
           cashtrack.db  (SQLite — shared source of truth)
                │
                ▼
            api.js (Express REST API)
                │
                ▼
         React Dashboard (Vite)
```

| Component | Role |
|---|---|
| `bot.js` | Telegram bot; handles incoming messages, calls the interpreter, writes to the database, replies to the user |
| `interpreter.js` | Sends the raw message to the OpenAI API with a structured prompt; parses the JSON response into typed transaction objects |
| `cashflow.js` | Pure functions that query the database and compute financial summaries (today, week, balance, top categories) |
| `insights.js` | Rule-based plain-language sentences generated from computed figures; no LLM involved |
| `api.js` | Lightweight Express server exposing read-only JSON endpoints (`/api/today`, `/api/week`, `/api/balance`, `/api/history`, `/api/insights`) and one write endpoint (`DELETE /api/transaction/:id`) |
| React dashboard | Mobile-first single-page app that fetches from the API; four screens navigated by a bottom tab bar |
| `cashtrack.db` | SQLite database; the single source of truth shared by the bot and the API |

The bot process and the API process run independently and both connect to the same database file via `better-sqlite3`.

---

## Technology Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Bot | node-telegram-bot-api |
| API server | Express |
| LLM | OpenAI API (GPT-4o mini) |
| Database | SQLite via better-sqlite3 |
| Frontend | React 18, Vite |
| Testing | Jest |
| Config | dotenv, cors |

---

## Prerequisites

- **Node.js** (v18 or later) and **npm**
- A **Telegram bot token** — obtain one from [@BotFather](https://t.me/BotFather)
- An **OpenAI API key** — obtain one from [platform.openai.com](https://platform.openai.com)

---

## Setup and Installation

### 1. Clone the repository

```bash
git clone <repository-url>
cd cashtrack
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Install dashboard dependencies

```bash
cd ../dashboard
npm install
```

### 4. Configure environment variables

Create `backend/.env` with the following content (substitute your real values):

```
TELEGRAM_BOT_TOKEN=your_telegram_bot_token_here
OPENAI_API_KEY=your_openai_api_key_here
PORT=3000
DB_PATH=./cashtrack.db
```

### 5. Initialise the database

From the `backend` folder:

```bash
node setup.js
```

This creates `cashtrack.db`, builds the three-table schema, and seeds the two transaction types (`sale` and `expense`). It is safe to run more than once.

---

## Running the System

Each component runs as a separate process. Open a terminal for each.

**Telegram bot** (from `backend/`):
```bash
npm start
```

**REST API** (from `backend/`):
```bash
npm run api
```

**React dashboard** (from `dashboard/`):
```bash
npm run dev
```

The dashboard dev server starts at `http://localhost:5173`. The API listens on the port defined in `.env` (default `3000`).

> The bot and the API can run simultaneously without conflict — they both open the same SQLite file in WAL mode, which supports concurrent readers.

---

## Running the Tests

From the `backend/` folder:

```bash
npm test
```

The test suite uses Jest with an in-memory SQLite database (the real `cashtrack.db` is never touched during testing). It covers:

- **`cashflow.test.js`** — all five cashflow functions (`todaySummary`, `weekSummary`, `weekComparison`, `runningBalance`, `topCategories`), including edge cases for empty data, sales-only days, expenses-only days, boundary dates, category aggregation, and the 7-day window
- **`insights.test.js`** — all three insight functions (`todayInsight`, `weekInsights`, `balanceInsight`), asserting exact output strings across every branch

---

## Project Structure

```
cashtrack/
├── .gitignore
├── README.md
│
├── backend/
│   ├── package.json
│   ├── .env                  # secrets — not committed
│   ├── cashtrack.db          # SQLite database — not committed
│   │
│   ├── db.js                 # opens the database and enables WAL + foreign keys
│   ├── setup.js              # creates schema and seeds transaction types
│   ├── bot.js                # Telegram bot — message handling, transaction recording
│   ├── interpreter.js        # OpenAI integration — parses free-text into transactions
│   ├── cashflow.js           # pure query functions: today, week, comparison, balance, top categories
│   ├── insights.js           # rule-based plain-language insight generation
│   ├── api.js                # Express REST API consumed by the dashboard
│   ├── inspect.js            # dev utility — prints category and transaction counts
│   ├── reset.js              # dev utility — clears transactions and categories
│   │
│   └── __tests__/
│       ├── cashflow.test.js  # unit tests for cashflow.js (35 tests)
│       └── insights.test.js  # unit tests for insights.js (14 tests)
│
└── dashboard/
    ├── package.json
    ├── vite.config.js
    ├── index.html
    ├── .env                  # VITE_API_URL — not committed
    └── src/
        ├── main.jsx          # React entry point
        ├── App.jsx           # tab navigation shell
        ├── App.css           # global styles and design tokens
        ├── api.js            # fetch wrappers for all API endpoints
        └── screens/
            ├── Home.jsx      # running balance, today's totals, insight
            ├── History.jsx   # date-grouped transaction list with delete
            ├── Week.jsx      # 7-day summary, comparison, top categories
            └── Settings.jsx  # placeholder
```

---

## Limitations and Future Work

This prototype prioritises breadth of feature coverage over production hardening. Known limitations include single-user design (no authentication), English-only LLM prompts, and no offline support. The system has not been evaluated with target users in a field setting. Full discussion of limitations, evaluation methodology, and proposed future directions is provided in the accompanying thesis.

