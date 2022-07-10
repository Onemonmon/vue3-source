export const isObject = (target: any) =>
  typeof target === "object" && target !== null;

export const isArray = (target: any) => Array.isArray(target);

export const isFunction = (target: any) => typeof target === "function";

export const isString = (target: any) => typeof target === "string";

const onReg = /^on[^a-z]/;
// 是否是事件名称
export const isOn = (key: string) => onReg.test(key);

export const EMPTY_OBJ = {};

export const hasOwn = (target: object, key: string) =>
  Object.prototype.hasOwnProperty.call(target, key);

export * from "./shapeFlags";
