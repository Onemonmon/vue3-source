import { isString } from "@vue/shared";

export const patchStyle = (
  el: Element,
  prevValue: any | null,
  nextValue: any | null
) => {
  if (prevValue) {
    el.removeAttribute("style");
  }
  if (nextValue) {
    // 设置新样式
    if (isString(nextValue)) {
      (el as HTMLElement).style.cssText = nextValue;
    } else {
      for (let key in nextValue) {
        (el as HTMLElement).style.setProperty(key, nextValue[key]);
      }
    }
  }
};
