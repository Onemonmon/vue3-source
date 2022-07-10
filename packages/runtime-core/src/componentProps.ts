import { shallowReactive } from "@vue/reactivity";
import { hasOwn } from "@vue/shared";
import { ComponentInternalInstance } from "./component";

export const initProps = (
  instance: ComponentInternalInstance,
  rawProps: Record<string, any> | null
) => {
  const props: Record<string, any> = {};
  const attrs: Record<string, any> = {};
  const propsOptions = instance.propsOptions || {};
  for (let key in rawProps) {
    const value = rawProps[key];
    if (hasOwn(propsOptions, key)) {
      props[key] = value;
    } else {
      attrs[key] = value;
    }
  }
  instance.props = shallowReactive(props);
  instance.attrs = attrs;
};
