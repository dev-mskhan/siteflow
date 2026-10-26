# SiteFlow Performance Enhancement Plan
**After Completing 254/254 Backend Integrations**

## 🎉 Integration Mission: COMPLETE

✅ **ALL 254 backend routes integrated** (excluding AI modules)  
✅ **364 frontend RTK Query endpoints** (143% coverage with workflow mutations)  
✅ **96/96 E2E tests passing** (100%)  
✅ **Zero mock APIs** in production code  
✅ **Single baseApi architecture** with proper cache invalidation  

---

## 🚀 Phase 3: Performance Enhancement & Production Readiness

### Priority 1: Performance Optimization (Week 1-2)

#### 1.1 Component Optimization
- [ ] **React.memo** for expensive components
  - Data grid rows
  - Form components
  - Modal dialogs
  - Chart components
- [ ] **useCallback/useMemo** audit
  - Event handlers in lists
  - Computed values in large tables
  - Filter/sort functions
- [ ] **Code splitting** by route
  - Lazy load each dashboard module
  - Dynamic imports for heavy components
  - Suspense boundaries with skeletons

```typescript
// Example: Route-based code splitting
const ProcurementPage = lazy(() => import('./pages/procurement'));
const PreconstructionPage = lazy(() => import('./pages/preconstruction'));
// ... etc
```

#### 1.2 Data Grid Virtualization
- [ ] Implement **react-window** or **react-virtual**
  - Material requests list (100+ items)
  - Purchase orders grid
  - Task/WBS tree
  - Document library
  - RFI/Submittal lists
  - Audit logs

```typescript
// Example: Virtual list for large datasets
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={600}
  itemCount={items.length}
  itemSize={56}
  width="100%"
>
  {Row}
</FixedSizeList>
```

#### 1.3 Image & Asset Optimization
- [ ] Lazy load images with **Intersection Observer**
- [ ] Add WebP format with fallbacks
- [ ] Implement responsive images
- [ ] Compress and optimize SVG icons
- [ ] Use CSS sprites for repeated icons

#### 1.4 Bundle Size Optimization
- [ ] Analyze bundle with **webpack-bundle-analyzer**
- [ ] Tree-shake unused code
- [ ] Replace heavy dependencies:
  - moment.js → date-fns (already using?)
  - lodash → lodash-es with tree-shaking
- [ ] Remove duplicate dependencies
- [ ] Externalize large vendor chunks

**Target Metrics:**
- Initial bundle < 300KB gzipped
- Time to Interactive (TTI) < 3s
- Largest Contentful Paint (LCP) < 2.5s

---

### Priority 2: Loading & Error States (Week 1)

#### 2.1 Skeleton Loaders
- [ ] Add skeletons for ALL data grids
  - Match exact layout of loaded content
  - Use animate-pulse for shimmer effect
  - Respect existing design system (no rounded corners)

```typescript
// Example skeleton
<div className="h-14 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)]" />
```

#### 2.2 Optimistic Updates
- [ ] Implement for all mutations:
  - Create operations (instantly add to list)
  - Update operations (immediately reflect changes)
  - Delete operations (remove from UI, restore on error)
  - Status transitions (show new status immediately)

```typescript
// Example optimistic update
onQueryStarted: async (args, { dispatch, queryFulfilled }) => {
  const patchResult = dispatch(
    api.util.updateQueryData('listItems', args, (draft) => {
      draft.push(optimisticItem);
    })
  );
  try {
    await queryFulfilled;
  } catch {
    patchResult.undo();
  }
}
```

#### 2.3 Loading Indicators
- [ ] Add global loading bar (nprogress or custom)
- [ ] Show loading state for slow operations (> 500ms)
- [ ] Disable buttons during mutation
- [ ] Show progress for file uploads

---

### Priority 3: Error Handling (Week 2)

#### 3.1 Error Boundaries
- [ ] Add error boundary at route level
- [ ] Add error boundary for each major feature
- [ ] Custom fallback UI (not just "Something went wrong")
- [ ] Error logging to monitoring service

```typescript
// Example error boundary fallback
<ErrorBoundary
  fallback={
    <div className="p-4 border border-[var(--hairline-2)]">
      <h3>Failed to load this section</h3>
      <button onClick={reset}>Try again</button>
    </div>
  }
>
  <YourComponent />
</ErrorBoundary>
```

#### 3.2 Retry Logic
- [ ] Auto-retry failed queries (3 attempts with exponential backoff)
- [ ] Manual retry button for failed mutations
- [ ] Network error detection and recovery
- [ ] Optimistic concurrency conflict resolution (409 handling)

#### 3.3 Toast Improvements
- [ ] Categorize by severity (success, info, warning, error)
- [ ] Add action buttons (Retry, Undo, View details)
- [ ] Stack multiple toasts properly
- [ ] Auto-dismiss non-critical toasts

---

### Priority 4: Developer Experience (Week 3)

#### 4.1 Storybook Setup
- [ ] Install and configure Storybook
- [ ] Document all design system components
- [ ] Add interactive controls
- [ ] Document component APIs

```bash
npx storybook@latest init
```

#### 4.2 Testing Infrastructure
- [ ] **MSW (Mock Service Worker)** for unit tests
  - Mock all API endpoints
  - Reusable handlers
  - Scenario-based mocking (success, error, loading)
- [ ] **Vitest** component tests
  - Test user interactions
  - Test error states
  - Test loading states
- [ ] **Testing Library** best practices
  - Query by role, not test IDs
  - User-centric assertions

#### 4.3 Visual Regression Tests
- [ ] Setup **Chromatic** or **Percy**
- [ ] Capture screenshots of all pages
- [ ] CI/CD integration for visual diffs

---

### Priority 5: Monitoring & Analytics (Week 3-4)

#### 5.1 Performance Monitoring
- [ ] **Web Vitals** tracking
  - Core Web Vitals (LCP, FID, CLS)
  - Custom metrics (API response time)
  - Track by page/route
- [ ] **Sentry** or equivalent
  - Error tracking
  - Performance monitoring
  - User session replay
  - Breadcrumbs for debugging

```typescript
// Example: Track Web Vitals
import { getCLS, getFID, getLCP } from 'web-vitals';

getCLS(console.log);
getFID(console.log);
getLCP(console.log);
```

#### 5.2 API Monitoring
- [ ] Track API error rates by endpoint
- [ ] Monitor response times
- [ ] Alert on high error rates (> 5%)
- [ ] Dashboard for API health

#### 5.3 User Analytics (Optional)
- [ ] Track feature usage
- [ ] Conversion funnels (onboarding, project creation)
- [ ] User journey analytics
- [ ] A/B test infrastructure

---

### Priority 6: Accessibility & Polish (Week 4)

#### 6.1 Accessibility Audit
- [ ] Keyboard navigation for all features
- [ ] Screen reader testing (NVDA, JAWS, VoiceOver)
- [ ] Focus indicators (visible and clear)
- [ ] ARIA labels and roles
- [ ] Color contrast validation (WCAG AA minimum)
- [ ] Skip navigation links

#### 6.2 Form Improvements
- [ ] Autosave drafts (localStorage or backend)
- [ ] Unsaved changes warning
- [ ] Better validation messages
- [ ] Field-level error display
- [ ] Autocomplete attributes

#### 6.3 UX Polish
- [ ] Consistent empty states
- [ ] Better onboarding flow
- [ ] Tooltips for complex features
- [ ] Keyboard shortcuts (⌘K command palette?)
- [ ] Drag-and-drop where appropriate
- [ ] Bulk operations UI

---

## 📊 Success Metrics

### Performance
- ✅ Lighthouse score > 90
- ✅ First Contentful Paint < 1.5s
- ✅ Time to Interactive < 3s
- ✅ Bundle size < 300KB (gzipped)

### Quality
- ✅ Zero console errors/warnings
- ✅ 95%+ E2E test coverage
- ✅ < 1% error rate in production
- ✅ WCAG AA compliance

### Developer Experience
- ✅ Component documentation in Storybook
- ✅ MSW mocks for all APIs
- ✅ < 10 min for new developer setup

---

## 🛠️ Tools & Libraries to Add

```bash
# Performance
pnpm add react-window @tanstack/react-virtual
pnpm add -D webpack-bundle-analyzer

# Testing
pnpm add -D @storybook/react @storybook/addon-essentials
pnpm add -D msw vitest @testing-library/react @testing-library/user-event

# Monitoring
pnpm add @sentry/react web-vitals

# UX Enhancement
pnpm add cmdk  # Command palette
pnpm add react-hot-toast  # Better toasts
pnpm add @dnd-kit/core @dnd-kit/sortable  # Drag & drop
```

---

## 📅 Suggested Timeline

| Week | Focus | Deliverables |
|------|-------|--------------|
| **Week 1** | Performance + Loading States | Code splitting, virtualization, skeletons, optimistic updates |
| **Week 2** | Error Handling | Error boundaries, retry logic, better toasts |
| **Week 3** | Dev Experience | Storybook, MSW, visual regression tests |
| **Week 4** | Monitoring + A11y | Sentry, Web Vitals, accessibility audit |

---

## 🎯 Next Immediate Steps

1. **Push all commits** to repository
   ```bash
   git push origin development
   ```

2. **Create PR** for integration work
   - Title: "feat(web): Complete frontend-backend API integration (254 routes)"
   - Description: Link to INTEGRATION_AUDIT.md
   - Reviewers: Tag team leads

3. **Start Week 1 Performance Work**
   - Bundle analysis first
   - Identify biggest wins
   - Implement route-based code splitting

**Ready to proceed?** Let me know if you want to:
- Push commits now
- Start performance work immediately
- Adjust the timeline
- Focus on specific priorities first
