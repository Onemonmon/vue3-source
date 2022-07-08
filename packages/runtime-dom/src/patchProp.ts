import { RenderOptions } from "@vue/runtime-core";
import { isOn } from "@vue/shared";
import { patchAttrs } from "./module/attrs";
import { patchClass } from "./module/class";
import { patchEvents } from "./module/events";
import { patchStyle } from "./module/style";

export const patchProp: RenderOptions["patchProp"] = (
  el,
  key,
  prevValue,
  nextValue
) => {
  if (key === "class") {
    patchClass(el, nextValue);
  } else if (key === "style") {
    patchStyle(el, prevValue, nextValue);
  } else if (isOn(key)) {
    patchEvents(el, key, prevValue, nextValue);
  } else {
    patchAttrs(el, key, nextValue);
  }
};
