import { isObject } from "@vue/shared";
import { reactive } from "./reactive";
import { track, trigger } from "./effect";

export const enum ReactiveFlags {
  IS_REACTIVE = "__v_isReactive", // 判断对象是否被代理过（是否为响应式）
}

const createGetter = (isReadonly = false, shallow = false) => {
  const getter: (
    target: Record<string | symbol, any>,
    key: string | symbol,
    receiver: any
  ) => any = (target, key, receiver) => {
    /**
     * 为什么不用 return target[key]，而要使用 Reflect.get ？
     * 当获取的属性a需要依赖对象的属性b时，b无法触发get
     * const test = {
     *   b: 'lalala',
     *   get a() {
     *     return this.b + 'dadada'
     *   }
     * }
     * 而使用 Reflect.get 会将 this 指定为 receiver（Proxy 对象），因此 this.b 就会继续触发 Proxy.get
     */
    console.log("get key: ", key);
    if (key === ReactiveFlags.IS_REACTIVE) {
      return true;
    }
    const res = Reflect.get(target, key, receiver);
    // 收集依赖
    if (!isReadonly) {
      track(target, key);
    }
    if (shallow) {
      return res;
    }
    // 对象嵌套时，也需要变成响应式
    if (isObject(res)) {
      return reactive(res);
    }
    return res;
  };
  return getter;
};

const createSetter = (shallow = false) => {
  const setter: (
    target: Record<string | symbol, any>,
    key: string | symbol,
    value: any,
    receiver: any
  ) => boolean = (target, key, value, receiver) => {
    console.log("set key: ", key, " to ", value);
    // 修改值后要执行key对应的effect
    const oldValue = target[key];
    const result = Reflect.set(target, key, value, receiver);
    if (oldValue !== value) {
      trigger(target, key);
    }
    return result;
  };
  return setter;
};

const get = createGetter();
const set = createSetter();
const shallowGet = createGetter(false, true);
const shallowSet = createSetter(true);

export const mutableHandlers: ProxyHandler<Record<string | symbol, any>> = {
  get,
  set,
};

export const shallowReactiveHandlers: ProxyHandler<
  Record<string | symbol, any>
> = {
  get: shallowGet,
  set: shallowSet,
};
