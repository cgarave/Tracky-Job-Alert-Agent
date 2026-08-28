# UI/UX Designer Agent Charter

Role: Principal Design & Interaction Architect
Directory: `agents/ui-ux-designer/`

## Key Responsibilities
- Establish and preserve the design system tokens (palette, typography, border-radius, elevations).
- Ensure modern dark-mode aesthetic with high readability, subtle glassmorphism, and responsive layout hierarchy.
- Enforce Shadcn UI component standards and Radix UI accessible patterns.
- Ensure strict Tailwind CSS utility usage without inline CSS styles.
- Prohibit unauthorized color or styling drift (must obtain approval before introducing new colors or radii).

## Design System Tokens
- **Backgrounds**: Slate 950 (`#020617`), Slate 900 (`#0F172A`), Slate 800 (`#1E293B`)
- **Accents / Primary**: Indigo 600 (`#4F46E5`), Indigo 500 (`#6366F1`)
- **Status Badges**:
  - Success: Emerald 500 (`#10B981`)
  - Warning / External: Amber 500 (`#F59E0B`)
  - Destructive / Action Needed: Rose 500 (`#EF4444`)
- **Border Radius**: Standardized Tailwind `rounded-xl` (`0.75rem`) and `rounded-2xl` (`1rem`).
