# Claude Development Guidelines

## Agent Guidelines

For guidelines on automated agent behavior (Bellskill PM and Bellskill Builder), see [AGENT_GUIDELINES.md](AGENT_GUIDELINES.md).

## Project Overview

This is a kettlebell workout tracking application built with React, TypeScript, Vite, and Supabase. It features PWA support for mobile installation.

## Custom Tailwind Sizing

This project uses **custom spacing values** in `tailwind.config.js` that are LARGER than Tailwind's defaults. When adding new shadcn/ui components to the `src/components/ui/` folder, you MUST use these custom sizes instead of the default values:

### Custom Spacing Scale:

```javascript
spacing: {
  px: '1px',
  0: '0',
  0.5: '4px',    // default: 2px
  1: '8px',      // default: 4px
  1.5: '12px',   // default: 6px
  2: '16px',     // default: 8px
  2.5: '20px',   // default: 10px
  3: '24px',     // default: 12px
  4: '32px',     // default: 16px
  5: '48px',     // default: 20px
  6: '64px',     // default: 24px
  7: '80px',     // default: 28px
}
```

### Important Rules for shadcn/ui Components:

1. **Always check existing UI components** in `src/components/ui/` for sizing patterns
2. **Use the custom spacing scale** - don't use default shadcn sizing
3. **Follow the existing height conventions**:
   - Small: `h-3` (24px)
   - Default: `h-4` (32px)
   - Large: `h-5` (48px)
4. **Maintain consistency** with existing components like `input.tsx` and `button.tsx`

### Example Adjustments Needed:

- Default shadcn input: `h-10` → Use: `h-4` or `h-5`
- Default shadcn button: `h-10` → Use: `h-4` or `h-5`
- Default shadcn padding: `px-3` → Use: `px-2` or `px-3` (but verify against existing components)

## Authentication

- Uses Supabase Auth with both magic links and OTP (one-time passwords)
- Magic links are primary method, OTP is fallback for mobile users
- Session management handled via React Context

## Testing

- Uses Vitest for unit testing
- Run tests with: `npm test`
- All tests must pass before committing

## Development Commands

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm test` - Run tests
- `npm run lint` - Run ESLint
- `npm run fetch-types` - Fetch Supabase types from backend

## Key Technologies

- React 18 with TypeScript
- Vite for build tooling
- Supabase for backend and auth
- Tailwind CSS with custom spacing
- Radix UI primitives
- React Query for data fetching
- Vitest for testing
