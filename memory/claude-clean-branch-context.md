---
name: claude-clean-branch-context
description: What was done in the Claude-Clean branch vs main — key work items the user requested
metadata:
  type: project
---

# Claude-Clean Branch — Key Changes vs main

## 1. `tw` Unification
- At the start of the branch there were TWO identical `tw` wrappers:
  - `Frontend/tw/index.tsx` (primary — used by screens via `../../tw`)
  - `Frontend/src/tw/index.tsx` (duplicate)
- The branch unified them: `Frontend/tw/index.tsx` was enhanced and is the canonical one
- `Frontend/shims/react-native-css-flatlist.js` was added — defers FlatList's
  `react-native-css` access to render time to break a circular dep in RNW 0.21
- `Frontend/shims/react-native-css-components.js` was also added for the same reason

## 2. Order Management Responsive / Select Order UI
- `Frontend/components/orderForm/CreateOrderForm.tsx` — responsive layout improvements
- `Frontend/components/orderForm/CartPanel.tsx` — cart panel responsive/layout
- `Frontend/components/orderForm/MenuPicker.tsx` — menu picker (select order) improvements
- `Frontend/components/orderForm/PizzaPersonalizadaModal.tsx` — custom pizza modal
- Refresh button placement was improved across order screens

## 3. `@monorepo/shared` → `@/src/shared` migration
- `packages/shared/` was removed; code inlined into `Frontend/src/shared/`
- All imports updated from `@monorepo/shared` to `@/src/shared`

## 4. SkeletonLoader memory leak fix (this session)
- `Frontend/components/ui/SkeletonLoader.tsx` — platform split:
  web uses pure CSS `@keyframes`, native uses reanimated with `cancelAnimation`
- `Frontend/src/global.web.css` — added `.skeleton-shimmer` keyframe

## 5. Screen-level fixes (this session, Claude-Clean)
- `usuarios.web.tsx` — `<RNView style={{flex:1}}>` replaces `<View className="flex-1">`
  + `FlatList style={{flex:1}}` explicit + `mountedRef` + `memo UsuarioItem`
- `usuarios.tsx` — `mountedRef`, `memo UsuarioItem`, `useCallback` onRefresh/renderItem
- `registro-usuarios.tsx` — `showToastRef` pattern (showToast new ref each render)
- `Card.tsx` — skip reanimated animations when `onPress` absent (saves 2 worklets/item)

**Why:** [[react-native-usecssElement-issue]] [[skeleton-memory-leak]]
