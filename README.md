# Cloudflare Workers Full-Stack React Template

[cloudflarebutton]

A production-ready full-stack template for Cloudflare Workers featuring a React frontend with Vite, Tailwind CSS, shadcn/ui, and a Hono backend powered by Durable Objects for scalable state management. Demonstrates real-time chat boards with users and messages, using indexed entity listing and transactional storage.

## ✨ Key Features

- **Full-Stack on Cloudflare Workers**: Single deployment for API and static assets.
- **Durable Objects for Entities**: One DO per user/chat, with automatic indexing for efficient listing/pagination.
- **React 18 + Vite + TanStack Query**: Fast, type-safe frontend with optimistic updates and caching.
- **shadcn/ui + Tailwind CSS**: Beautiful, customizable UI components with dark mode support.
- **Hono Routing**: Type-safe API routes with CORS and logging.
- **TypeScript Everywhere**: Shared types between frontend and worker, full type safety.
- **Production Optimizations**: Error boundaries, client error reporting, theme persistence.
- **Seed Data & CRUD**: Pre-seeded users/chats/messages, full create/read/update/delete APIs.
- **Mobile-Responsive**: Hooks for mobile detection, sidebar layouts.

## 🛠️ Tech Stack

| Frontend | Backend | Styling | Data | Utils |
|----------|---------|---------|------|-------|
| React 18, Vite, TanStack Query, React Router | Cloudflare Workers, Hono, Durable Objects | Tailwind CSS, shadcn/ui, Lucide Icons | Shared TypeScript types, Immer | Bun, Wrangler, ESLint, Zod |

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh/) installed (recommended package manager)
- [Cloudflare Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-update/#bun): `bunx wrangler@latest`

### Installation

1. Clone or download the project.
2. Install dependencies:
   ```bash
   bun install
   ```
3. Generate Worker types:
   ```bash
   bun run cf-typegen
   ```
4. Login to Cloudflare:
   ```bash
   bunx wrangler@latest login
   ```

### Development

- Start the dev server (frontend + mocked APIs):
  ```bash
  bun dev
  ```
  Open [http://localhost:3000](http://localhost:3000) (or `$PORT`).

- For full Cloudflare preview (requires `wrangler.toml` setup):
  ```bash
  bunx wrangler@latest dev
  ```

### Build for Production

```bash
bun run build
```

Output in `dist/` ready for deployment.

## 📚 Usage Examples

### API Routes (via Hono)

All APIs under `/api/`:

- **Users**: `GET/POST/DELETE /api/users`, `POST /api/users/deleteMany`
- **Chats**: `GET/POST/DELETE /api/chats`, `POST /api/chats/deleteMany`
- **Messages**: `GET/POST /api/chats/:chatId/messages`
- **Health**: `GET /api/health`
- **Error Reporting**: `POST /api/client-errors`

Example with `fetch` or TanStack Query:

```ts
// List users with pagination
const { data } = useQuery({
  queryKey: ['users'],
  queryFn: () => api<{ items: User[]; next: string | null }>('/api/users?limit=10'),
});
```

Frontend integrates via `@/lib/api-client.ts` with automatic error handling.

### Custom Entities

1. Define in `worker/entities.ts` extending `IndexedEntity<S>`.
2. Add statics: `entityName`, `indexName`, `initialState`, optional `seedData`.
3. Add routes in `worker/user-routes.ts`.
4. Use `api()` in React components.

Worker reloads routes dynamically in dev mode.

## ☁️ Deployment

Deploy to Cloudflare Workers in one command:

```bash
bun run deploy
```

Or manually:

```bash
bun run build
bunx wrangler@latest deploy
```

[cloudflarebutton]

### Custom Domain & Config

Edit `wrangler.jsonc`:
- Update `name`.
- Add secrets: `wrangler secret put NAME`.
- Custom assets/migrations in `assets`/`migrations`.

View logs/metrics in [Cloudflare Dashboard](https://dash.cloudflare.com/).

## 🤝 Contributing

1. Fork & clone.
2. Install: `bun install`.
3. Develop: `bun dev`.
4. PR to `main`.

Lint: `bun lint`. Format with Prettier (auto on save).

## 📄 License

MIT. See [LICENSE](LICENSE) for details.

## 🙌 Support

- [Cloudflare Workers Docs](https://developers.cloudflare.com/workers/)
- [shadcn/ui](https://ui.shadcn.com/)
- Issues: [GitHub Issues](https://github.com/YOUR_USERNAME/YOUR_REPO/issues)

Built with ❤️ for Cloudflare Developers.