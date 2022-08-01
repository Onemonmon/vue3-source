import { isObject } from "@vue/shared";
import {
  ReactiveFlags,
  mutableHandlers,
  shallowReactiveHandlers,
} from "./baseHandler";

const enum TargetType {
  INVALID = 0,
  COMMON = 1,
}

// 获取对象的类型
// 无效的对象类型：1.对象包含ReactiveFlags.SKIP属性 2.对象不可被扩展（不能添加属性）
function getTargetType(value: any) {
  return value[ReactiveFlags.SKIP] || !Object.isExtensible(value)
    ? TargetType.INVALID
    : TargetType.COMMON;
}

export const reactiveMap = new WeakMap();
export const shallowReactiveMap = new WeakMap();
/**
 * reactive
 * @param target 需要处理成响应式的对象
 */
export function reactive(target: Record<string, any>) {
  return createReactiveObject(target, mutableHandlers, reactiveMap);
}

export const shallowReactive = (target: Record<string, any>) => {
  return createReactiveObject(
    target,
    shallowReactiveHandlers,
    shallowReactiveMap
  );
};

export const toRaw = (observed: any): any => {
  const raw = observed && observed[ReactiveFlags.RAW];
  return raw ? toRaw(raw) : observed;
};

export const createReactiveObject = (
  target: Record<string, any>,
  baseHandlers: ProxyHandler<any>,
  proxyMap: WeakMap<object, any>
) => {
  if (!isObject(target)) {
    return target;
  }

  // 对象被代理过则直接返回自身
  // 此处访问 target.__v_isReactive，如果对象被代理过则会触发 Proxy.get 返回 true
  if (target[ReactiveFlags.IS_REACTIVE]) {
    return target;
  }

  // proxyMap 实现同一个对象被代理多次时，返回的是同一个代理
  const existingProxy = proxyMap.get(target);
  if (existingProxy) {
    return existingProxy;
  }

  // 不可代理的对象
  if (getTargetType(target) === TargetType.INVALID) {
    return target;
  }

  const proxy = new Proxy(target, baseHandlers);
  proxyMap.set(target, proxy);
  return proxy;
};

export function isReactive(target: any) {
  return Boolean(target && target[ReactiveFlags.IS_REACTIVE]);
}
