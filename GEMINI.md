# Workspace Design Guidelines

## Responsive Mobile Grid & Scaling Rules
- **Multi-Column Layouts on Mobile:** When building or modifying responsive grids for mobile, do not automatically default to stacking all components (such as stats cards, metrics, or list elements) vertically in a single full-width column.
- **Proportional Scaling:** Scale down component dimensions (such as paddings, font sizes, margins, and icon sizes) to comfortably accommodate a 2-column or multi-column layout on small screens (e.g., using `grid-cols-2`).
- **Layout Integrity:** Ensure that scaled-down elements are optimized to prevent text wrapping, vertical overflow, or visual crowding, keeping the design clean, dense, and native-feeling.
