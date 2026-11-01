# Local Artisan Client

The client is a React 19 and TypeScript application built with Vite and TanStack Start/Router. Tailwind CSS 4 supplies utility-first styling; reusable components use Radix UI primitives and Lucide icons. TanStack Query handles server state, and the typed API client in `src/lib/local` connects the UI to the Flask API.

## Requirements

- Node.js 22 or newer and npm
- A running Local Artisan API (see [server setup](../server/README.md))

Bun is also available as a package manager; the repository includes `bun.lock` and `bunfig.toml`.

## Configuration

Create a local environment file from the example:

```bash
cp .env.example .env
```

Set `VITE_API_BASE_URL` to the API's base URL, including `/api`. The default is:

```dotenv
VITE_API_BASE_URL=http://127.0.0.1:5000/api
```

Only put values intended for browser exposure in `VITE_*` variables. Do not put credentials, signing secrets, or other private configuration in the client environment.

## Install and Run

From this directory:

```bash
npm ci
npm run dev
```

Vite prints the local development URL when the server starts. Keep the Flask API running separately.

## Build, Test, and Lint

```bash
npm run build       # Production build
npm run build:dev   # Development-mode build
npm run preview     # Serve the most recent production build locally
npm test            # Run the Vitest suite once
npm run test:watch  # Run Vitest in watch mode
npm run lint        # Run ESLint
```

## Project Structure

```text
src/
├── components/
│   ├── common/      # Shared chat components
│   ├── local/       # Marketplace, account, artisan, and booking screens
│   └── ui/          # Reusable UI primitives
├── hooks/           # Shared React hooks
├── lib/
│   └── local/       # Typed API client and client-side domain helpers
├── routes/          # TanStack file-based routes and account routes
├── test/            # Vitest and Testing Library tests
├── router.tsx       # Router setup
├── server.ts        # TanStack Start server entry
└── styles.css       # Global styles and shared design tokens
```

Static files live in `public/`; Vite, TypeScript, Vitest, and ESLint configuration are at the client root.
