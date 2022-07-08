export const patchAttrs = (el: Element, key: string, nextValue: any | null) => {
  if (nextValue === null) {
    el.removeAttribute(key);
  } else {
    el.setAttribute(key, nextValue);
  }
};
