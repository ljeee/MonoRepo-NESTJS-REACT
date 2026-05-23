import {
  useCssElement,
  useNativeVariable as useFunctionalVariable,
} from "react-native-css";

import { Link as RouterLink } from "expo-router";
import Animated from "react-native-reanimated";
import React from "react";
import {
  View as RNView,
  Text as RNText,
  Pressable as RNPressable,
  ScrollView as RNScrollView,
  TouchableHighlight as RNTouchableHighlight,
  TextInput as RNTextInput,
  TouchableOpacity as RNTouchableOpacity,
  KeyboardAvoidingView as RNKeyboardAvoidingView,
  FlatList as RNFlatList,
  StyleSheet,
} from "react-native";
import { SafeAreaView as RNSafeAreaView } from "react-native-safe-area-context";

// Ensures useCssElement always receives a className string (even empty),
// avoiding the unstable_createElement call that crashes on web.
function withClassName<T extends { className?: string }>(props: T): T {
  if (props.className !== undefined) return props;
  return { ...props, className: "" };
}

// CSS-enabled Link
export const Link = (
  props: React.ComponentProps<typeof RouterLink> & { className?: string }
) => {
  return useCssElement(RouterLink as any, withClassName(props) as any, { className: "style" }) as any;
};

Link.Trigger = RouterLink.Trigger;
Link.Menu = RouterLink.Menu;
Link.MenuAction = RouterLink.MenuAction;
Link.Preview = RouterLink.Preview;

// CSS Variable hook
export const useCSSVariable =
  process.env.EXPO_OS !== "web"
    ? useFunctionalVariable
    : (variable: string) => `var(${variable})`;

// View
export type ViewProps = React.ComponentProps<typeof RNView> & {
  className?: string;
};

export const View = (props: ViewProps) => {
  return useCssElement(RNView, withClassName(props), { className: "style" });
};
View.displayName = "CSS(View)";

// Text
export const Text = (
  props: React.ComponentProps<typeof RNText> & { className?: string }
) => {
  return useCssElement(RNText, withClassName(props), { className: "style" });
};
Text.displayName = "CSS(Text)";

// ScrollView
export const ScrollView = (
  props: React.ComponentProps<typeof RNScrollView> & {
    className?: string;
    contentContainerClassName?: string;
  }
) => {
  return useCssElement(RNScrollView as any, withClassName(props) as any, {
    className: "style",
    contentContainerClassName: "contentContainerStyle",
  }) as any;
};
ScrollView.displayName = "CSS(ScrollView)";

// Pressable
export const Pressable = (
  props: React.ComponentProps<typeof RNPressable> & { className?: string }
) => {
  return useCssElement(RNPressable as any, withClassName(props) as any, { className: "style" }) as any;
};
Pressable.displayName = "CSS(Pressable)";

// TextInput
export const TextInput = (
  props: React.ComponentProps<typeof RNTextInput> & { className?: string }
) => {
  return useCssElement(RNTextInput, withClassName(props), { className: "style" });
};
TextInput.displayName = "CSS(TextInput)";

// AnimatedScrollView
export const AnimatedScrollView = (
  props: React.ComponentProps<typeof Animated.ScrollView> & {
    className?: string;
    contentClassName?: string;
    contentContainerClassName?: string;
  }
) => {
  return useCssElement(Animated.ScrollView as any, withClassName(props) as any, {
    className: "style",
    contentClassName: "contentContainerStyle",
    contentContainerClassName: "contentContainerStyle",
  }) as any;
};

// TouchableHighlight with underlayColor extraction
function XXTouchableHighlight(
  props: React.ComponentProps<typeof RNTouchableHighlight>
) {
  const { underlayColor, ...style } = (StyleSheet.flatten(props.style) || {}) as any;
  return (
    <RNTouchableHighlight
      underlayColor={underlayColor}
      {...props}
      style={style}
    />
  );
}

export const TouchableHighlight = (
  props: React.ComponentProps<typeof RNTouchableHighlight> & { className?: string }
) => {
  return useCssElement(XXTouchableHighlight as any, withClassName(props) as any, { className: "style" }) as any;
};
TouchableHighlight.displayName = "CSS(TouchableHighlight)";

// TouchableOpacity
export const TouchableOpacity = (
  props: React.ComponentProps<typeof RNTouchableOpacity> & { className?: string }
) => {
  return useCssElement(RNTouchableOpacity as any, withClassName(props) as any, { className: "style" }) as any;
};
TouchableOpacity.displayName = "CSS(TouchableOpacity)";

// KeyboardAvoidingView
export const KeyboardAvoidingView = (
  props: React.ComponentProps<typeof RNKeyboardAvoidingView> & { className?: string }
) => {
  return useCssElement(RNKeyboardAvoidingView, withClassName(props), { className: "style" });
};
KeyboardAvoidingView.displayName = "CSS(KeyboardAvoidingView)";

// FlatList
export const FlatList = (
  props: React.ComponentProps<typeof RNFlatList> & {
    className?: string;
    contentContainerClassName?: string;
  }
) => {
  return useCssElement(RNFlatList as any, withClassName(props) as any, {
    className: "style",
    contentContainerClassName: "contentContainerStyle",
  }) as any;
};
FlatList.displayName = "CSS(FlatList)";

// SafeAreaView
export const SafeAreaView = (
  props: React.ComponentProps<typeof RNSafeAreaView> & { className?: string }
) => {
  return useCssElement(RNSafeAreaView, withClassName(props), { className: "style" });
};
SafeAreaView.displayName = "CSS(SafeAreaView)";
