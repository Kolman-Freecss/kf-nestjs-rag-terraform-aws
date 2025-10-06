# WoW RAG UI

Angular 20 frontend to consume the WoW RAG API (NestJS).

## Prerequisites

- Node.js 22+
- pnpm 10+
- Angular CLI 20+
- NestJS backend running on `http://localhost:3000`

## Installation

Dependencies were already installed during project creation. If you need to reinstall them:

```bash
cd wow-rag-ui
pnpm install
```

## Available Commands

### Development

```bash
ng serve
# or
pnpm start
```

The application will be available at `http://localhost:4200`

### Production Build

```bash
ng build
```

Compiled files will be in `dist/wow-rag-ui/`

### Tests

```bash
# Unit tests
ng test

# E2E tests
ng e2e
```

## Project Structure

```
wow-rag-ui/
├── src/
│   ├── app/
│   │   ├── components/
│   │   │   ├── blizzard-query/    # Component for Blizzard API
│   │   │   └── rag-query/         # Component for RAG System
│   │   ├── services/
│   │   │   ├── blizzard.ts        # HTTP service for Blizzard API
│   │   │   └── rag.ts             # HTTP service for RAG API
│   │   ├── app.ts                 # Main component
│   │   ├── app.routes.ts          # Route configuration
│   │   └── app.config.ts          # App configuration
│   ├── main.ts
│   └── index.html
├── postcss.config.js
└── angular.json
```

## Features

### 1. Blizzard API Query (`/blizzard`)
- Query World of Warcraft realm information
- Example: search "area-52" or "tichondrius"
- Displays real-time data from Blizzard API

### 2. RAG System Query (`/rag`)
- WoW question and answer system
- Uses AI with vectorized context
- Shows information sources used
- Can integrate live Blizzard data if keywords are detected
- **GSAP Animations**: Smooth animated responses

## Usage

1. **Start the NestJS backend:**
   ```bash
   cd ../wow-rag-api
   pnpm start:dev
   ```

2. **Start the Angular frontend:**
   ```bash
   cd wow-rag-ui
   ng serve
   ```

3. **Open your browser at:** `http://localhost:4200`

### Example Queries

**Blizzard API:**
- `area-52`
- `tichondrius`
- `moonguard`

**RAG System:**
- "What are WoW expansions?"
- "Tell me about realm Area 52"
- "What is the history of World of Warcraft?"

## API Configuration

By default, the application points to `http://localhost:3000`. To change this, edit:

- `src/app/services/blizzard.ts` → `apiUrl`
- `src/app/services/rag.ts` → `apiUrl`

## Technologies Used

- **Angular 20** - Modern frontend framework
- **TypeScript** - Programming language
- **RxJS** - Reactive programming
- **HttpClient** - HTTP requests
- **TailwindCSS v4** - Latest utility-first CSS framework with Oxide engine
- **GSAP** - Professional-grade animation library
- **Standalone Components** - No NgModules, independent components
- **Zoneless Change Detection** - No Zone.js, experimental efficient change detection

## Modern Architecture

This application uses the latest Angular features:

### ✅ Standalone Components
All components are standalone (`standalone: true`), no need for NgModules:
- `App` - Root component
- `BlizzardQuery` - Component for Blizzard API queries
- `RagQuery` - Component for RAG system queries

### ✅ Zoneless Change Detection
Uses `provideExperimentalZonelessChangeDetection()` instead of Zone.js:
- Better performance
- Smaller bundle size
- More predictable change detection
- Doesn't require zone.js in final bundle

### ✅ TailwindCSS v4
Latest version of the utility-first CSS framework:
- **CSS-first configuration** using `@theme` directive
- **Lightning fast** with new Oxide engine
- **Zero-config** purging and optimization
- No custom CSS needed
- Responsive design out of the box
- Consistent design system

### ✅ GSAP Animations
Professional animations on RAG responses:
- Smooth fade-in for answers
- Staggered animation for context sources
- Configurable easing and timing
- Performance optimized

### ✅ Functional DI
Services use `providedIn: 'root'` for automatic tree-shaking

## Important Notes

- Application requires backend running on `http://localhost:3000`
- CORS must be enabled in NestJS backend
- Services use `providedIn: 'root'` for global dependency injection
- **No NgModules**: 100% standalone architecture
- **No Zone.js**: Experimental zoneless change detection

## Troubleshooting

### CORS Error
If you get CORS errors, make sure NestJS backend has CORS enabled in `main.ts`:
```typescript
app.enableCors({
  origin: 'http://localhost:4200',
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  credentials: true,
});
```

### "Cannot connect to API" Error
Verify the backend is running:
```bash
curl http://localhost:3000/blizzard/realm/area-52
```

### Port 4200 in use
Change the port in `angular.json` or use:
```bash
ng serve --port 4201
```

### TailwindCSS not working
Make sure you have run:
```bash
pnpm install
```

TailwindCSS v4 configuration is in `src/styles.css` using the `@theme` directive and `postcss.config.js`.

---

## Angular CLI Reference

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 20.3.0.

For more information on using the Angular CLI, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
