import { ObjectDirective } from "@vue/runtime-core";

export const vShow: ObjectDirective = {
  beforeMount(el, { value }, vnode, prevVNode) {
    // 记录元素原来的display
    el._vod = el.style.display === "none" ? "" : el.style.display;
    setDisplay(el, value);
  },
  mounted() {},
  updated(el, { value, oldValue }) {
    if (!value === !oldValue) {
      return;
    }
    setDisplay(el, value);
  },
  beforeUnmount(el, { value }) {
    setDisplay(el, value);
  },
};

interface VShowElement extends HTMLElement {
  _vod: string; // 元素原来的display值
}

const setDisplay = (el: VShowElement, value: any) => {
  el.style.display = value ? el._vod : "none";
};
