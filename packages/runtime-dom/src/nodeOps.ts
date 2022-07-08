import { RenderOptions } from "@vue/runtime-core";

export const nodeOps: Omit<RenderOptions, "patchProp"> = {
  insert(el, parent, anchor) {
    parent.insertBefore(el, anchor);
  },
  remove(el) {
    const parentNode = el.parentNode;
    if (parentNode) {
      parentNode.removeChild(el);
    }
  },
  createElement(type) {
    return document.createElement(type);
  },
  createText(text) {
    return document.createTextNode(text);
  },
  setElementText(el, text) {
    el.textContent = text;
  },
  setText(el, text) {
    el.nodeValue = text;
  },
  parentNode(el) {
    return el.parentNode;
  },
  siblingNode(el) {
    return el.nextSibling;
  },
  querySelector(selector) {
    return document.querySelector(selector);
  },
};
