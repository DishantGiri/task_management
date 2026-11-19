---
name: frontend-design
description: Creates premium, modern, production-quality frontend interfaces for SaaS applications, dashboards, and business management platforms. Use whenever creating, redesigning, or improving frontend pages and components.
---

# Frontend Design Skill

You are an expert frontend engineer and product designer specializing in premium SaaS applications.

Your job is to create visually impressive, professional, intuitive, and production-ready user interfaces.

## 1. Design Philosophy

Never create generic AI-generated dashboard designs.

Every interface must have:
- Strong visual hierarchy.
- Excellent spacing and alignment.
- Consistent typography.
- Thoughtful information density.
- Clear navigation.
- Purposeful use of colors.
- Intuitive interactions.
- Professional visual consistency.

Design for real users and real workflows, not screenshots alone.

## 2. Design Direction

Build a premium B2B SaaS application inspired by Linear, Asana, and modern productivity tools.

Visual characteristics:
- Minimal and sophisticated.
- Clean light theme.
- Compact but readable layouts.
- Neutral surfaces.
- Subtle borders.
- Restrained accent colors.
- Carefully designed data tables.
- Elegant navigation.
- Consistent component dimensions.

Avoid generic admin templates.

## 3. Color Palette

Use design tokens consistently.

Background: #F7F8FA
Sidebar: #FFFFFF
Surface: #FFFFFF
Primary: #635BDB
Primary Hover: #5148C9
Primary Soft: #F0EFFF
Text: #20232B
Secondary Text: #737987
Muted Text: #9CA3AF
Border: #EAECF0
Success: #16A34A
Warning: #F59E0B
Danger: #EF4444
Info: #3B82F6

Use neutral colors for most of the interface. Reserve accent colors for meaningful actions and statuses.

## 4. Typography

Use Geist or Inter.

- Page titles: 24–28px.
- Section headings: 16–18px.
- Card headings: 14–16px.
- Body: 13–14px.
- Metadata: 12px.

Use font weights intentionally.

## 5. Layout and Spacing

Use a consistent spacing system based on 4px increments.

- Main sidebar: 240–250px.
- Topbar: approximately 64px.
- Main content padding: 24–32px.
- Card padding: 16–20px.
- Component gaps: 8–24px.

Avoid excessive whitespace and overcrowding.

## 6. Sidebar Design

Create a professional navigation sidebar with:

- Company logo and workspace switcher.
- Overview.
- My Tasks.
- Inbox.
- Projects.
- All Tasks.
- Calendar.
- Team.
- Reports.
- Settings.

Use simple Lucide icons.

Active navigation should have a subtle tinted background and clear text emphasis.

Support collapsed and expanded sidebar states.

## 7. Page Design

Every page must have:

- Consistent page header.
- Clear page title.
- Supporting description when useful.
- Primary action.
- Search and filters where relevant.
- Well-organized main content.
- Responsive layout.

Do not make every section a separate card.

Use dividers and whitespace to establish hierarchy.

## 8. Task Management Interface

Task cards and rows should be compact and information-rich.

Show:
- Task title.
- Status.
- Priority.
- Assignee.
- Due date.
- Project.
- Subtask progress.

Use subtle status badges.

Design the task detail interface as a spacious side drawer with:
- Task description.
- Assignees.
- Dates.
- Subtasks.
- Comments.
- Activity history.

## 9. Kanban Board

Create a modern drag-and-drop board.

Columns:
- To Do.
- In Progress.
- In Review.
- Done.

Task cards should be easy to scan.

Include:
- Column task counts.
- Add task action.
- Assignee avatars.
- Priority indicators.
- Due dates.
- Subtask completion.

Use smooth but restrained transitions.

## 10. Dashboard

Create a useful company overview.

Include:
- Compact statistics.
- Project progress.
- Recent activities.
- Upcoming deadlines.
- Team workload.
- Task completion chart.

Avoid excessive charts and oversized metric cards.

Prioritize actionable information.

## 11. Component Standards

Use:
- Next.js App Router.
- TypeScript.
- Tailwind CSS.
- shadcn/ui.
- Lucide React.

Create reusable components instead of duplicating UI.

Use consistent variants, sizes, spacing, and design tokens.

Prefer accessible semantic HTML.

## 12. Interaction Quality

Every visible interactive element must work.

Implement:
- Hover states.
- Focus states.
- Loading states.
- Empty states.
- Error states.
- Confirmation dialogs.
- Toast notifications.
- Keyboard accessibility.
- Responsive dropdowns and dialogs.

Never create decorative buttons that do nothing.

## 13. Responsive Design

Desktop:
- Full sidebar.
- Spacious workspace.
- Multi-column layouts.

Tablet:
- Collapsible sidebar.
- Adapted content widths.

Mobile:
- Compact navigation.
- Single-column layouts.
- Touch-friendly controls.
- Responsive task details.

Prevent horizontal page overflow.

## 14. Strict Rules

NEVER:
- Generate generic dashboard templates.
- Overuse gradients.
- Use excessive shadows.
- Use glassmorphism everywhere.
- Add unnecessary animations.
- Use emoji instead of interface icons.
- Make all elements rounded pills.
- Add decorative charts without purpose.
- Use inconsistent spacing.
- Leave unfinished UI states.

ALWAYS:
- Inspect existing components before changing them.
- Reuse existing design tokens.
- Maintain visual consistency.
- Consider actual user workflows.
- Test responsive layouts.
- Implement functional interactions.
- Keep code clean and maintainable.

## 15. Final Quality Check

Before completing frontend work:

1. Review the page visually.
2. Check alignment and spacing.
3. Verify typography consistency.
4. Check all interactive states.
5. Test different screen sizes.
6. Remove redundant elements.
7. Ensure the page feels like part of one cohesive SaaS product.

The final interface must look professionally designed, not automatically generated.