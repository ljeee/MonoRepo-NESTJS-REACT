---
name: flatlist-className-web-invisible-bug
description: FlatList className="flex-1" is silently ignored on web — list renders invisible. Use ScrollView from tw instead.
metadata:
  type: feedback
---

# FlatList + className on React Native Web = silent invisible list

## The Bug
Using `className="flex-1"` on a `FlatList` from `react-native` does **nothing** on web.
`FlatList` is a raw RN component — it does not go through `useCssElement`, so `className` is
silently dropped. Result: the list has no height → renders invisible.

This is NOT obvious because:
- The skeleton (above the FlatList) shows fine (intrinsic height from fixed-size bars)
- State updates correctly (`loading=false`, `count=11`) — the data arrives
- The component appears "stuck on skeleton" because the FlatList beneath is invisible

Same applies to `style={{ flex: 1 }}` on FlatList inside a `scrollable={false}` PageContainer:
`useCssElement` wrappers (KeyboardAvoidingView, View) in the PageContainer chain don't give
FlatList a concrete pixel height on web — it collapses to zero.

## The Fix (proven pattern — used by OrdersOfDayPending, facturas-dia, usuarios)
```tsx
// ❌ WRONG — FlatList className ignored, height = 0, invisible
<PageContainer scrollable={false}>
  <FlatList className="flex-1" data={...} renderItem={...} />
</PageContainer>

// ✅ CORRECT — ScrollView from tw uses useCssElement, flex:1 applies properly
import { ScrollView } from '../../tw';

<PageContainer scrollable={false}>
  <ScrollView className="flex-1">
    {loading ? <ListSkeleton /> : (
      <View className="flex-row flex-wrap justify-between gap-y-4">
        {data.map((item, idx) => {
          const isLastOdd = !isMobile && data.length % 2 === 1 && idx === data.length - 1;
          return (
            <View key={...} className={isMobile ? 'w-full' : isLastOdd ? 'w-full' : 'w-[48.5%]'}>
              <ItemCard item={item} />
            </View>
          );
        })}
      </View>
    )}
  </ScrollView>
</PageContainer>
```

## Why ScrollView from tw works but FlatList doesn't
`ScrollView` is exported from `../../tw/index.tsx` as:
```tsx
export const ScrollView = (props) => useCssElement(RNScrollView, props, { className: "style" });
```
`useCssElement` converts `className="flex-1"` → `style={{ flex: 1 }}` at render time.
`FlatList` is imported directly from `react-native` — no `useCssElement`, no className processing.

## Screens fixed
- `Frontend/app/(main)/usuarios.web.tsx` — replaced FlatList with ScrollView + flex-wrap grid
- `Frontend/app/(main)/facturas.tsx` — replaced FlatList + ListHeaderComponent with ScrollView

## Rule going forward
**Never use `FlatList` with `className` or `style={{ flex:1 }}` inside `PageContainer scrollable={false}`.**
For list screens with `scrollable={false}`, always use `ScrollView className="flex-1"` from `../../tw`
and render items in `<View className="flex-row flex-wrap">`.
FlatList is only needed for very large lists (100+ items) that truly need virtualization.

**Why:** [[usuarios-skeleton-stuck]] [[react-native-usecssElement-issue]]
**How to apply:** When adding a new list screen with `PageContainer scrollable={false}`,
always reach for `ScrollView` from `../../tw` + flex-wrap grid. Search for `FlatList` usage in
the codebase before shipping — any `FlatList` inside `scrollable={false}` PageContainer is a bug.
