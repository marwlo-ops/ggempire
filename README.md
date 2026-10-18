# GGEmpire AI

A modular starting point for the GGEmpire AI platform, published as a static site with GitHub Pages.

## Current scope
- Responsive landing dashboard
- Modular frontend assets in `src/`
- GitHub Actions workflow for GitHub Pages deployment
- Safe configuration example; never commit real API keys

## Deploy with GitHub Pages
1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, choose **GitHub Actions** as the source.
3. Push to `main` (or run the workflow manually under **Actions → Deploy GGEmpire AI to GitHub Pages**).
4. After the workflow succeeds, GitHub will show the published URL in Settings → Pages.

## AI integration
GitHub Pages only hosts static frontend files. Do not put provider API keys, passwords, or private business logic in browser JavaScript. Add a separate backend/serverless function for authenticated AI requests and store secrets in that backend's environment or secret manager.

## Project layout
```
.
├── index.html
├── src/
│   ├── styles.css
│   └── app.js
├── .github/workflows/pages.yml
├── .env.example
└── .gitignore
```
