# NiveshOS Refactoring Report — Component-Based File Structure

**Status:** Analysis Complete | Awaiting Your Confirmation on Proposed Structure  
**Project:** NiveshOS — Retail Investor Super App (Vanilla JS, Zero-Cost, Static Web)  
**Date:** August 6, 2026

---

## Step 1 — Analysis (Complete)

### 1.1 Technology Stack

| Aspect                   | Details                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| **Language & Framework** | Vanilla JavaScript (ES5 compatible, browser-only) — no modules, no build step, no npm dependencies at runtime                      |
| **Build Tooling**        | `http-server` for local dev; `node tools/build-real-data.mjs` for data snapshots only                                              |
| **CSS**                  | Vanilla CSS with custom properties (design tokens), no preprocessor                                                                |
| **Animation**            | GSAP 3 + ScrollTrigger (vendored in `vendor/`)                                                                                     |
| **Data**                 | Mock data + optional real market snapshot from free APIs (Yahoo Finance, AMFI, TradingView)                                        |
| **Constraints**          | Static file delivery (`file://` or HTTP), no external APIs at runtime, no build step on deploy, localStorage for state persistence |

### 1.2 Current File Structure

```
Sebi-Hackathon-/
├── index.html              (UI shell, DOM contract)
├── styles.css              (all styling)
├── app.js                  (3300+ lines; UI renderer, state, all panels, charts, copilot, etc.)
├── anim.js                 (350 lines; GSAP animations)
├── data.js                 (460 lines; mock user data, products, quiz, holdings)
├── real-quotes.js          (generated; market snapshot)
├── vendor/                 (GSAP vendored libraries)
├── tools/
│   └── build-real-data.mjs (fetches real prices)
├── package.json            (http-server only)
├── BUILD_SPEC.md           (API contract between UI/logic layers)
└── README.md
```

### 1.3 Organizing Principle — Current State

**File-type grouped, with hard ownership boundaries:**

- **Agent A (Logic):** `data.js`, `app.js` — all state, routing, rendering, suitability engine, rule-based copilot
- **Agent B (UI):** `index.html`, `styles.css`, `anim.js` — DOM, styling, animations
- **Cross-cutting:** `vendor/`, `tools/`

**Critical observation:** Although there are two "agents," the actual project is organized by **technology role** (data file, logic file, UI file), not by feature/domain. This works at current scale, but becomes unmaintainable as features grow.

### 1.4 Feature / Domain Boundaries Identified

Analyzing `app.js` (3300 lines), I've identified these **cohesive feature domains:**

1. **Authentication & User Management**
   - User login/logout, session management, per-user state isolation
   - ~150 lines in `app.js`

2. **Dashboard / Portfolio Overview**
   - KPI rendering, asset allocation donut chart, value trend line chart
   - ~200 lines

3. **Portfolio Discovery Panel**
   - Product catalog, filtering, browsing mutual funds / equities / REITs / InvITs / bonds / gold ETFs
   - ~250 lines

4. **Analytics & Exposure Panel**
   - Sector exposure, concentration alerts, correlation matrix, performance charts
   - ~300 lines

5. **Learning & Education Module**
   - Lesson catalog, quiz, suitability assessment workflow, rule-based recommendations
   - ~400 lines

6. **Account Aggregation (CAS Import)**
   - NSDL/CDSL/CAMS fixture data, import/merge workflow, account list
   - ~150 lines

7. **Goal-Based Planning**
   - Goal creation, target horizon, allocation suggestions
   - ~200 lines

8. **Smart Alerts & Notifications**
   - Threshold configuration, real-time alerts (NAV refresh, concentration breach, etc.)
   - ~150 lines

9. **Copilot / AI Advisor**
   - Rule-based question/answer, recommendation engine, consent ledger
   - ~300 lines

10. **Order Entry & Execution**
    - Simulated trade routing, order confirmation, holdings update
    - ~200 lines

11. **Trust & Security Panel**
    - Audit trail, consent management, data privacy statement
    - ~150 lines

12. **Settings & Profile**
    - Theme toggle, investor details, notification preferences
    - ~100 lines

13. **Shared Utilities & Formatting**
    - Number formatting, date handling, DOM helpers, color mapping
    - ~300 lines (currently mixed in main scope)

### 1.5 Shared vs. Feature-Local Code

**Genuinely shared (cross-cutting):**

- Number/currency formatting (`fmt()`, `fmtSigned()`, `pct()`)
- DOM helpers (`$()`, `el()`, `esc()`)
- Date utilities
- Color/series mapping functions
- localStorage wrapper for state persistence
- Chart rendering primitives (SVG generation for donut, line, bar charts)
- GSAP animation triggers

**Feature-local utilities:**

- Risk scoring logic → Learning module only
- Suitability assessment rules → Learning module
- Copilot decision trees → Copilot module
- Account merge logic → Account Aggregation module
- Concentration calculation → Analytics module

### 1.6 Import Path & Circular Dependency Analysis

**Current state:**

- No module system, so no explicit imports
- Single global namespace: `window.NIVESH`, `window.NIVESH_DATA`
- Script load order enforced in `index.html` (already correct per BUILD_SPEC)
- **No risk of circular dependencies** (no modules yet)

**Risk if modularizing:**

- If moving to ES modules, must ensure:
  - Shared utilities imported before features
  - No feature A → feature B direct imports (use events or mediator instead)
  - Export only public APIs, not internal helpers

### 1.7 Build/Lint/Test Infrastructure

- No linter configured
- No test suite
- No build step at deploy (http-server only)
- Script validation: manual testing in browser
- Build tool only: `tools/build-real-data.mjs` (Node.js, fetches real prices)

### 1.8 Risks & Constraints for Refactoring

| Risk                                                                                                 | Severity | Mitigation                                                                                                   |
| ---------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------ |
| **No module system** → refactoring only reorganizes files, script order still matters                | Medium   | Maintain single script load order in `index.html`; consider eventual adoption of ES modules if project grows |
| **Hard ownership boundary** (Agent A vs Agent B) → `app.js` owns both logic AND DOM manipulation     | High     | Recognize this is intentional per BUILD_SPEC; refactor only file organization, not separation of concerns    |
| **localStorage state coupling** → every feature reads/writes `state` object                          | Medium   | Colocate state mutations with features; consider centralized state module if this grows                      |
| **Inline SVG charts** → chart code lives in `app.js`, not separate                                   | Low      | Keep chart logic with dashboard/analytics; can extract to shared module if reuse appears                     |
| **GSAP animations tied to selector patterns** → `anim.js` scans for `.countup`, `[data-value]`, etc. | Low      | Maintain naming conventions when refactoring DOM; document selector contracts                                |
| **Real data build step** → `build-real-data.mjs` regenerates `real-quotes.js`                        | Low      | Move to `src/` structure but keep build output path same or update `index.html` load                         |

---

## Step 2 — Proposed Target Structure

### Design Principles

1. **Organize by feature/domain, not by file type**
2. **Colocate related code:** feature logic, its panel renderer, styles, data schemas, and feature-specific utilities live together
3. **Shallow, predictable nesting:** features are 1–2 levels deep
4. **Clear shared boundary:** `src/shared/` contains only genuinely cross-cutting code
5. **Preserve script load order:** without modules, script order in `index.html` must remain correct
6. **No public API changes:** this is a refactor of organization only

### Target Directory Tree

```
Sebi-Hackathon-/
│
├── index.html                           (no change; same script load order)
│
├── src/
│   │
│   ├── shared/                          [Cross-cutting utilities, design primitives]
│   │   ├── fmt.js                       (number/currency, date, % formatting)
│   │   ├── dom.js                       (querySelector helpers, element creation)
│   │   ├── colors.js                    (series/sector color mapping, token helpers)
│   │   ├── chart-primitives.js          (SVG donut, line, bar chart generators)
│   │   ├── storage.js                   (localStorage wrapper, per-user key namespacing)
│   │   └── constants.js                 (dates array, series colors, SERIES const)
│   │
│   ├── auth/                            [User login, session, per-user state]
│   │   ├── auth.js                      (login/logout, session storage, user lookup)
│   │   ├── state.js                     (state object def, loadState, saveAll, per-user persistence)
│   │   └── user-session.js              (user by ID, setActiveUser, clearSession helpers)
│   │
│   ├── dashboard/                       [Portfolio overview, KPIs, allocation]
│   │   ├── dashboard.js                 (panel renderer, KPI calculation)
│   │   ├── dashboard-charts.js          (donut chart, line chart drawing)
│   │   └── dashboard.css                (styles for dashboard only)
│   │
│   ├── discover/                        [Product catalog, filtering, browsing]
│   │   ├── discover.js                  (product listing, filtering, category view)
│   │   ├── discover-filters.js          (filter state, apply/reset logic)
│   │   └── discover.css
│   │
│   ├── analytics/                       [Exposure, concentration, performance]
│   │   ├── analytics.js                 (panel renderer, chart setup)
│   │   ├── exposure-calc.js             (sector/asset-class aggregation, concentration)
│   │   ├── correlation.js               (correlation matrix calculation)
│   │   ├── performance.js               (return calculations, performance charts)
│   │   ├── alerts-logic.js              (concentration thresholds, alert generation)
│   │   └── analytics.css
│   │
│   ├── learn/                           [Education, quiz, suitability assessment]
│   │   ├── learn.js                     (lesson panel, navigation, completion tracking)
│   │   ├── quiz.js                      (suitability quiz logic, scoring)
│   │   ├── assessment.js                (risk profile assignment, recommendation rules)
│   │   ├── lessons-data.js              (lesson content, quiz questions in feature)
│   │   └── learn.css
│   │
│   ├── accounts/                        [CAS import, account aggregation]
│   │   ├── accounts.js                  (panel renderer, account list, import UI)
│   │   ├── account-merge.js             (CAS data parsing, holdings merge logic)
│   │   └── accounts.css
│   │
│   ├── goals/                           [Goal-based planning]
│   │   ├── goals.js                     (panel renderer, goal CRUD)
│   │   ├── goal-allocation.js           (allocation suggestions, target calculations)
│   │   └── goals.css
│   │
│   ├── alerts/                          [Smart alerts, notifications]
│   │   ├── alerts.js                    (alerts panel, notification UI)
│   │   ├── alerts-config.js             (threshold configuration logic)
│   │   └── alerts.css
│   │
│   ├── order/                           [Trade entry, execution simulation]
│   │   ├── order.js                     (order panel renderer)
│   │   ├── order-entry.js               (form, validation, submission)
│   │   ├── order-confirm.js             (confirmation modal, holdings update)
│   │   └── order.css
│   │
│   ├── copilot/                         [AI advisor, rule-based Q&A]
│   │   ├── copilot.js                   (panel renderer, chat UI)
│   │   ├── copilot-engine.js            (decision trees, rule evaluation)
│   │   ├── copilot-rules.js             (recommendation rules, answer templates)
│   │   └── copilot.css
│   │
│   ├── trust/                           [Audit trail, consent ledger]
│   │   ├── trust.js                     (panel renderer, audit/consent display)
│   │   ├── audit-trail.js               (audit log rendering)
│   │   ├── consent-ledger.js            (consent tracking, privacy statement)
│   │   └── trust.css
│   │
│   ├── profile/                         [User settings, preferences]
│   │   ├── profile.js                   (panel renderer, user details)
│   │   ├── settings.js                  (theme toggle, notification prefs)
│   │   └── profile.css
│   │
│   ├── data/                            [Data definitions, mock fixtures]
│   │   ├── data.js                      (user objects, holdings, products, lessons, quiz, risk quiz)
│   │   ├── real-quotes.js               (generated by build tool; market snapshot)
│   │   └── schema.js                    (optional: JSDoc type stubs for holdings, accounts, etc.)
│   │
│   └── app-main.js                      [App initialization, panel router, window.NIVESH export]
│       (merges all features into one router, initializes state, sets up global event listeners)
│
├── styles.css                           (global styles, design tokens, shared layout)
├── anim.js                              (GSAP animations, unchanged)
├── vendor/                              (GSAP libs, unchanged)
├── tools/
│   └── build-real-data.mjs              (fetch real prices, generate src/data/real-quotes.js)
├── package.json                         (unchanged)
├── BUILD_SPEC.md                        (no change to contract)
└── README.md                            (update to reference new structure)
```

### Rationale per Folder

| Folder                                  | Purpose                                                                | Why This Level                                 |
| --------------------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------- |
| `src/shared/`                           | Formatting, DOM, colors, storage, constants — nothing domain-specific  | One level for clarity; imports by all features |
| `src/auth/`                             | Login, session, user isolation — prerequisite for all other features   | Separate to emphasize it runs first            |
| `src/dashboard/`                        | Portfolio overview, KPIs, core charts                                  | Each panel = one folder                        |
| `src/discover/`, `src/analytics/`, etc. | Feature folders, each with `.js` logic, `.js` utilities, `.css` styles | Colocated, shallow                             |
| `src/data/`                             | Mock data + generated real quotes                                      | Separation from logic, clear boundary          |
| `src/app-main.js`                       | Router, initialization, window.NIVESH                                  | Single entry point after data + shared         |

### Naming Convention

- **Filenames:** kebab-case (e.g., `dashboard-charts.js`, `order-entry.js`)
- **Functions:** camelCase (e.g., `renderDashboard()`, `validateOrder()`)
- **CSS classes:** kebab-case (e.g., `.dashboard-kpi-row`, `.order-form-input`)
- **HTML IDs:** kebab-case, scoped to panel (e.g., `#dashboard-kpi-row`, `#order-form`)

### Shared vs. Feature-Local Rule

**Belongs in `src/shared/`:**

- Used by 2+ features
- No domain knowledge; generic utility
- Examples: `fmt()`, `$()`, localStorage wrapper, color series

**Belongs in feature folder:**

- Used by one feature only
- Domain-specific logic
- Feature-specific state mutations
- Examples: `calculateConcentration()`, `assessRiskProfile()`, quiz scoring

**Exception:** Design tokens (colors, spacing, fonts) stay in `styles.css` (global), not scattered.

### Script Load Order (Updated for `index.html`)

```html
<!-- Vendor -->
<script src="vendor/gsap.min.js"></script>
<script src="vendor/ScrollTrigger.min.js"></script>

<!-- Shared utilities (no inter-dependencies) -->
<script src="src/shared/constants.js"></script>
<script src="src/shared/fmt.js"></script>
<script src="src/shared/dom.js"></script>
<script src="src/shared/colors.js"></script>
<script src="src/shared/storage.js"></script>
<script src="src/shared/chart-primitives.js"></script>

<!-- Data layer -->
<script src="src/data/data.js"></script>
<script src="src/data/real-quotes.js"></script>

<!-- Auth (must run before features) -->
<script src="src/auth/user-session.js"></script>
<script src="src/auth/state.js"></script>
<script src="src/auth/auth.js"></script>

<!-- Feature modules (no inter-dependencies) -->
<script src="src/dashboard/dashboard-charts.js"></script>
<script src="src/dashboard/dashboard.js"></script>

<script src="src/discover/discover-filters.js"></script>
<script src="src/discover/discover.js"></script>

<script src="src/analytics/exposure-calc.js"></script>
<script src="src/analytics/correlation.js"></script>
<script src="src/analytics/performance.js"></script>
<script src="src/analytics/alerts-logic.js"></script>
<script src="src/analytics/analytics.js"></script>

<!-- Learn module (quiz + assessment) -->
<script src="src/learn/lessons-data.js"></script>
<script src="src/learn/quiz.js"></script>
<script src="src/learn/assessment.js"></script>
<script src="src/learn/learn.js"></script>

<!-- Remaining features -->
<script src="src/accounts/account-merge.js"></script>
<script src="src/accounts/accounts.js"></script>

<script src="src/goals/goal-allocation.js"></script>
<script src="src/goals/goals.js"></script>

<script src="src/alerts/alerts-config.js"></script>
<script src="src/alerts/alerts.js"></script>

<script src="src/order/order-entry.js"></script>
<script src="src/order/order-confirm.js"></script>
<script src="src/order/order.js"></script>

<script src="src/copilot/copilot-rules.js"></script>
<script src="src/copilot/copilot-engine.js"></script>
<script src="src/copilot/copilot.js"></script>

<script src="src/trust/audit-trail.js"></script>
<script src="src/trust/consent-ledger.js"></script>
<script src="src/trust/trust.js"></script>

<script src="src/profile/settings.js"></script>
<script src="src/profile/profile.js"></script>

<!-- App initialization & router (last) -->
<script src="src/app-main.js"></script>

<!-- Animations (after DOM is rendered) -->
<script src="anim.js"></script>
```

### Import Paths (No Modules, But Use Global Scope)

Each feature function exposes itself on a global namespace, e.g.:

```javascript
window.NIVESH_DASHBOARD = { render: renderDashboard /* ... */ };
window.NIVESH_LEARN = { render: renderLearn /* ... */ };
```

`app-main.js` calls them:

```javascript
window.NIVESH = {
  switchPanel: function (name) {
    if (window.NIVESH_DASHBOARD && name === "dashboard") {
      window.NIVESH_DASHBOARD.render();
    }
    // ... etc for other features
  },
};
```

**No circular dependencies possible** because features don't directly import each other — they go through the global router.

---

## Step 3 — Migration Readiness

### Changes Required

| Item                  | Current                         | Target                                | Impact                                                 |
| --------------------- | ------------------------------- | ------------------------------------- | ------------------------------------------------------ |
| **File count**        | 6 files (+ vendor)              | 50+ files                             | Higher clarity, but more files to manage               |
| **Folder depth**      | Flat                            | 2 levels                              | Easier to locate features                              |
| **CSS file count**    | 1 (styles.css)                  | 1 global + 12 feature-local           | More modular styles (can still concatenate at build)   |
| **Script load order** | 5 scripts                       | 40+ scripts (but order still matters) | More granular, but must maintain order in `index.html` |
| **Build step**        | Only for real-quotes (optional) | Same                                  | No new build requirement                               |
| **Import paths**      | N/A (no modules)                | Global namespace (window.NIVESH\_\*)  | Safe, tested pattern                                   |

### No Breaking Changes

- **Public API:** `window.NIVESH`, `window.NIVESH_DATA` — unchanged
- **DOM contract:** All IDs and classes stay the same (BUILD_SPEC enforced)
- **Behavior:** All features work identically
- **Data schema:** User objects, holdings, products — unchanged
- **Build:** `npm start` still works, `build-real-data.mjs` still generates `real-quotes.js` (at new path)

### Why This Structure Works

1. **Scales with features:** Adding a new panel (e.g., "Tax Optimizer") is one folder with `.js`, `.css`, zero disruption
2. **Clear ownership:** Feature team owns their folder, no confusion about whose code lives where
3. **Testable:** Each feature can be tested in isolation (once test suite added)
4. **Modular CSS:** Styles can be split per-feature, but still concatenated to one file for HTTP
5. **Preserves performance:** No runtime module overhead; same single-threaded execution
6. **Backward compatible:** Existing animations, data, and BUILD_SPEC contract remain valid

---

## Step 4 — Migration Plan (Awaiting Your Approval)

Once you approve this structure, I will:

1. **Create directory tree** (`src/` and all 12 feature folders)
2. **Migrate `app.js` piece by piece:**
   - Extract shared utilities → `src/shared/`
   - Extract auth logic → `src/auth/`
   - Extract dashboard renderer → `src/dashboard/`
   - ... repeat for each feature
3. **Migrate styles:** Split `styles.css` into global + per-feature; keep combined for now
4. **Update `index.html`:** New script load order
5. **Update build tool:** `build-real-data.mjs` output path to `src/data/real-quotes.js`
6. **Test after each step:** Run in browser, confirm no functional breaks, no console errors
7. **Final validation:** All 12 panels render, charts draw, animations play, localStorage works

---

## Summary

| Aspect             | Finding                                                                                                      |
| ------------------ | ------------------------------------------------------------------------------------------------------------ |
| **Current state**  | Organized by file type (data, logic, ui), all logic in `app.js`                                              |
| **Challenges**     | 3300-line monolithic file; hard to locate/modify individual features; unclear ownership after initial agents |
| **Proposed state** | Feature-based folders; colocated logic, styles, utilities; shallow, predictable nesting                      |
| **Key constraint** | Must preserve vanilla JS, no modules, script load order, BUILD_SPEC DOM contract                             |
| **Benefit**        | Scalable, maintainable, team-friendly without new tooling or dependencies                                    |

---

## ✅ Next Step: Your Confirmation

Please review the proposed structure above. If you agree, reply with:

> "Approved — proceed with migration"

and I will:

1. Create all folders
2. Migrate code incrementally (1–2 features per step)
3. Test after each step
4. Provide final report with new directory tree, import updates, and test results

If you'd like changes to the structure (e.g., rename a folder, merge features, reorganize shared utilities), let me know and I'll revise before starting.
