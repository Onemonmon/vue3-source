import {
  hasOwn,
  isArray,
  isIntegerKey,
  isObject,
  isSymbol,
  log,
} from "@vue/shared";
import { reactive, toRaw } from "./reactive";
import { track, trigger } from "./effect";

export const enum ReactiveFlags {
  SKIP = "__v_skip",
  IS_READONLY = "__v_isReadonly",
  IS_SHALLOW = "__v_isShallow",
  IS_REACTIVE = "__v_isReactive", // 判断对象是否被代理过（是否为响应式）
  RAW = "__v_raw",
}

// 扩展数组的一些方法，使其可以进行依赖收集
const arrayInstrumentations = createArrayInstrumentations();
function createArrayInstrumentations() {
  const instrumentations: Record<string, Function> = {};
  // 对includes indexOf lastIndexOf的扩展
  // 1.会对数组下标进行依赖收集
  // 2.当返回的结果不正确时，会尝试toRaw获取原数据，再次调用方法
  ["includes", "indexOf", "lastIndexOf"].forEach((n) => {
    instrumentations[n] = function (this: any, ...args: any[]) {
      const arr = toRaw(this);
      // 对数组下标进行依赖收集
      for (let i = 0; i < arr.length; i++) {
        track(arr, `${i}`);
      }
      const res = arr[n](...args);
      if (res === -1 || res === false) {
        return arr[n](...args.map(toRaw));
      }
      return res;
    };
  });
  return instrumentations;
}

const isNonTrackableKeys = ["__proto__", "__v_isRef", "__isVue"];

const builtInSymbols = new Set(
  Object.getOwnPropertyNames(Symbol)
    .filter((key) => key !== "arguments" && key !== "callee")
    .map((key) => (Symbol as any)[key])
    .filter(isSymbol)
);

let logHide: boolean = false;

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

    // isReactive函数判断对象是否是响应式，会进来这里
    if (key === ReactiveFlags.IS_REACTIVE) {
      return !isReadonly;
    }
    // isReadonly函数判断对象是否只读，会进来这里
    else if (key === ReactiveFlags.IS_READONLY) {
      return isReadonly;
    }
    // isShallow函数判断对象是否是浅响应式，会进来这里
    else if (key === ReactiveFlags.IS_SHALLOW) {
      return shallow;
    }
    // toRaw函数返回原对象，会进来这里
    else if (key === ReactiveFlags.RAW) {
      return target;
    }
    log(logHide, "reactive getter ", target, key);
    // 当代理的对象是个数组时，访问数组的一些方法会被劫持，做一些依赖收集的处理
    const targetIsArray = isArray(target);
    if (
      !isReadonly &&
      targetIsArray &&
      hasOwn(arrayInstrumentations, key as string)
    ) {
      return Reflect.get(arrayInstrumentations, key, receiver);
    }
    const res = Reflect.get(target, key, receiver);
    // 有些属性不收集依赖：Symbol内置的Symbol属性、__proto__,__v_isRef,__isVue
    if (
      isSymbol(key)
        ? builtInSymbols.has(key)
        : isNonTrackableKeys.includes(key as string)
    ) {
      return res;
    }
    if (!isReadonly) {
      // 收集依赖
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
    log(logHide, "reactive set key: ", key, " to ", value);
    // 修改值后要执行key对应的effect
    const oldValue = target[key];
    // 判断是新增属性还是修改属性
    const hadKey =
      isArray(target) && isIntegerKey(key)
        ? Number(key) < target.length
        : hasOwn(target, key as string);
    const result = Reflect.set(target, key, value, receiver);
    if (!hadKey) {
      trigger(target, key, "add");
    } else if (oldValue !== value) {
      trigger(target, key, "set");
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
