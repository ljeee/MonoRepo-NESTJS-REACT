"use strict";
// Universal lazy shim for ALL react-native-css/components/* modules.
//
// react-native-css's babel plugin rewrites every `import { X } from 'react-native'`
// to `import { X } from 'react-native-css/components/X'`. Each of those component
// files calls copyComponentProperties(react-native.X, wrapper) at MODULE INIT TIME,
// which triggers a circular-dep getter in react-native-web 0.21 and crashes with
// "Cannot read properties of undefined (reading 'default')".
//
// This shim replicates the exact same className→style mappings but defers ALL
// react-native / react-native-css access to first render, breaking the init cycle.

const MAPPINGS = {
  View:                   { className: "style" },
  Text:                   { className: "style" },
  Image:                  { className: "style" },
  Switch:                 { className: "style" },
  TouchableHighlight:     { className: "style" },
  TouchableOpacity:       { className: "style" },
  TouchableWithoutFeedback: { className: "style" },
  Pressable:              { className: "style" },
  KeyboardAvoidingView:   { className: { target: "style" } },
  TextInput:              { className: { target: "style", nativeStyleMapping: { textAlign: true } } },
  ActivityIndicator:      { className: { target: "style", nativeStyleMapping: { color: "color" } } },
  Button:                 { className: { target: false,  nativeStyleMapping: { color: "color" } } },
  ImageBackground:        { className: { target: "style", nativeStyleMapping: { backgroundColor: true } } },
  ScrollView: {
    className: "style",
    contentContainerClassName: "contentContainerStyle",
  },
  FlatList: {
    className: "style",
    contentContainerClassName: "contentContainerStyle",
    columnWrapperClassName: "columnWrapperStyle",
    ListFooterComponentClassName: "ListFooterComponentStyle",
    ListHeaderComponentClassName: "ListHeaderComponentStyle",
  },
  VirtualizedList: {
    className: "style",
    contentContainerClassName: "contentContainerStyle",
    ListFooterComponentClassName: "ListFooterComponentStyle",
    ListHeaderComponentClassName: "ListHeaderComponentStyle",
  },
};

for (const [name, mapping] of Object.entries(MAPPINGS)) {
  const component = function CSSComponent(props) {
    const { useCssElement } = require("react-native-css");
    const RN = require("react-native");
    return useCssElement(RN[name], props, mapping);
  };
  Object.defineProperty(component, "name", { value: name });
  component.displayName = "CSS(" + name + ")";
  exports[name] = component;
  exports.default = component; // overwritten each iteration — last one wins (unused anyway)
}
