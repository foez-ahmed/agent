# Agentic AI Coder

A lightweight web app that lets you generate code using NVIDIA's **nemotron‑3‑ultra‑550b‑a55b** model via the NIM API.

## Prerequisites
- **Node.js** (v18 or later) and **npm** installed.
- An NVIDIA NIM API key (obtain from NVIDIA AI Foundations).

## Setup & Run Locally
1. Open a terminal and go to the project folder:
   ```bash
   cd "C:/Users/Foez/Desktop/nemotron/agentic_ai_coder"
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Configure the API key:
   ```bash
   copy .env.example .env   # Windows copy command
   # Edit .env and replace YOUR_NVIDIA_NIM_API_KEY_HERE with your key
   ```
4. Start the server:
   ```bash
   npm run dev
   ```
   The app will be available at **http://localhost:3000** (or the `PORT` you set).
5. Open the URL in a browser, type a coding prompt, and click **Generate Code**.

## Project structure
```
agentic_ai_coder/
├─ public/          # HTML, CSS, JS UI
├─ server.js        # Express backend that proxies to NVIDIA NIM
├─ package.json     # npm manifest
└─ .env.example     # template for environment variables
```

## Customisation
- Edit `public/styles.css` to change colours or theme.
- Tweak request parameters (temperature, top_p, etc.) in `server.js`.

Happy coding! 🎉
