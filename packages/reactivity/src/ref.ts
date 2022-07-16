import { isObject } from "@vue/shared";
import { ReactiveEffect, trackEffect, triggerEffect } from "./effect";
import { isReactive, reactive } from "./reactive";

/**
 * 将对象变成响应式
 */
function toReactive(target: any) {
  return isObject(target) ? reactive(target) : target;
}

export const isRef = (target: any) => target && target.__v_isRef;

class RefImpl {
  private _value: any;
  private __v_isRef: boolean = true;
  private dep: Set<ReactiveEffect> = new Set();
  constructor(public _rawValue: any) {
    this._value = toReactive(_rawValue);
  }
  get value() {
    // 收集依赖
    trackEffect(this.dep);
    return this._value;
  }
  set value(newValue) {
    if (newValue !== this._rawValue) {
      this._value = toReactive(newValue);
      this._rawValue = newValue;
      // 触发effect
      triggerEffect(this.dep);
    }
  }
}

class ObjectRefImpl {
  private __v_isRef: boolean = true;
  constructor(private _object: any, private _key: string) {}
  get value() {
    return this._object[this._key];
  }
  set value(newValue) {
    this._object[this._key] = newValue;
  }
}

export function ref(target: any) {
  return new RefImpl(target);
}

export const unRef = (target: any) => (isRef(target) ? target.value : target);

const shallowUnwrapHandlers: ProxyHandler<any> = {
  get(target, key, receiver) {
    return unRef(Reflect.get(target, key, receiver));
  },
  set(target, key, value, receiver) {
    const oldValue = target[key];
    if (isRef(oldValue)) {
      oldValue.value = value;
      return true;
    }
    return Reflect.set(target, key, value, receiver);
  },
};

export const proxyRef = (objectWithRefs: any) => {
  return isReactive(objectWithRefs)
    ? objectWithRefs
    : new Proxy(objectWithRefs, shallowUnwrapHandlers);
};

export const toRef = (object: any, key: string) => {
  if (isRef(object)) {
    return object;
  }
  return new ObjectRefImpl(object, key);
};

export const toRefs = (object: any) => {
  const result: any = {};
  for (let key in object) {
    result[key] = toRef(object, key);
  }
  return result;
};
