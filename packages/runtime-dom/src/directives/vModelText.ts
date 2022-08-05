import { ObjectDirective } from "@vue/runtime-core";
import { toNumber } from "@vue/shared";

export const vModelText: ObjectDirective = {
  created(el, { modifiers: { lazy, trim, number } }, vnode) {
    el._assign = vnode.props!["onUpdate:modelValue"];
    const castToNumber =
      number || (vnode.props && vnode.props.type === "number");
    el.addEventListener(lazy ? "change" : "input", () => {
      let domValue = el.value;
      if (trim) {
        domValue = domValue.trim();
      }
      if (castToNumber) {
        domValue = toNumber(domValue);
      }
      el._assign(domValue);
    });
  },
  mounted(el, { value }) {
    el.value = value === null ? "" : value;
  },
  beforeUpdate(el, { value, oldValue }) {
    const newValue = value === null ? "" : value;
    if (newValue !== oldValue) {
      el.value = newValue;
    }
  },
};
