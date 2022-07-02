import { track, trigger } from "./effect";

export const enum ReactiveFlags {
  IS_REACTIVE = "__v_isReactive", // 判断对象是否被代理过（是否为响应式）
}

export const mutableHandlers = {
  get(target, key, receiver) {
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
    if (key === ReactiveFlags.IS_REACTIVE) {
      return true;
    }
    // 收集依赖
    track(target, "get", key);
    console.log("get key: ", key);
    return Reflect.get(target, key, receiver);
  },
  set(target, key, value, receiver) {
    // 修改值后要执行key对应的effect
    const oldValue = target[key];
    const newValue = Reflect.set(target, key, value, receiver);
    if (oldValue !== newValue) {
      trigger(target, "set", key, newValue, oldValue);
    }
    console.log("set key: ", key, " to ", value);
    return newValue;
  },
};
