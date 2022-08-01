import { shallowReactive, toRaw } from "@vue/reactivity";
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

// 组件属性是否发生变化
export const hasPropsChanged = (
  prevProps: Record<string, any>,
  nextProps: Record<string, any>
) => {
  // 先比较props的长度是否一样
  const nextKeys = Object.keys(nextProps);
  if (nextKeys.length !== Object.keys(prevProps).length) {
    return true;
  }
  // 再详细比较值
  for (let i = 0; i < nextKeys.length; i++) {
    const key = nextKeys[i];
    if (nextProps[key] !== prevProps[key]) {
      return true;
    }
  }
  return false;
};

export const updateProps = (
  rawProps: Record<string, any> | null,
  props: Record<string, any>
) => {
  // 旧props
  const rawCurrentProps = toRaw(props);
  if (rawProps) {
    // 赋值新属性
    for (const key in rawProps) {
      const nextValue = rawProps[key];
      if (nextValue !== rawCurrentProps[key]) {
        props[key] = nextValue;
      }
    }
    // 删除不存在的老属性
    for (const key in rawCurrentProps) {
      if (!hasOwn(rawProps, key)) {
        delete props[key];
      }
    }
  }
};
