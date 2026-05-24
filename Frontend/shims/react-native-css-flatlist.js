"use strict";
// Shim for react-native-css/components/FlatList on web.
// The original module calls copyComponentProperties(react-native.FlatList, ...)
// at module init time, which triggers a circular-dep getter in react-native-web 0.21
// and crashes with "Cannot read properties of undefined (reading 'default')".
// This shim defers all FlatList access to render time, breaking the cycle.

const mapping = {
  className: "style",
  contentContainerClassName: "contentContainerStyle",
  columnWrapperClassName: "columnWrapperStyle",
  ListFooterComponentClassName: "ListFooterComponentStyle",
  ListHeaderComponentClassName: "ListHeaderComponentStyle",
};

function FlatList(props) {
  const { useCssElement } = require("react-native-css");
  const { FlatList: RNFlatList } = require("react-native");
  return useCssElement(RNFlatList, props, mapping);
}
FlatList.displayName = "CSS(FlatList)";

exports.FlatList = FlatList;
exports.default = FlatList;
