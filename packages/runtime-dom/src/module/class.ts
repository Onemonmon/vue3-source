export const patchClass = (el: Element, nextValue: string | null) => {
  if (nextValue === null) {
    el.removeAttribute("class");
  } else {
    el.className = nextValue;
  }
};
