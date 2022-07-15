import { isObject, isString, ShapeFlags, isArray } from "@vue/shared";
import { Component, ComponentInternalInstance } from "./component";
import { RawSlots } from "./componentSlots";

export const Text = Symbol("Text");
export const Fragment = Symbol("Fragment");

export type VNodeTypes =
  | string
  | VNode
  | Component
  | typeof Text
  | typeof Fragment;

export type VNodeChildAtom = string | VNode;

export type VNodeChildren = VNodeChildAtom[] | string | RawSlots | null;

export type VNode = {
  __v_isVNode: true;
  type: VNodeTypes;
  props: Record<string, any> | null;
  key: string | number | symbol | null;
  children: VNodeChildren;
  el: Element | Text | null;
  shapeFlag: number;
  patchFlag: number;
  component: ComponentInternalInstance | null;
};

export const isSameVNodeType = (n1: VNode, n2: VNode) =>
  n1.type === n2.type && n1.key === n2.key;

export const isVNode = (target: any) =>
  target ? target.__v_isVNode === true : false;

export const normalizeVNode = (vnode: VNode | string) => {
  if (isVNode(vnode)) {
    return vnode as VNode;
  } else {
    return createVNode(Text, null, vnode as string);
  }
};

export const normalizeChildren = (children: VNodeChildAtom[]) => {
  for (let i = 0; i < children.length; i++) {
    children[i] = normalizeVNode(children[i]);
  }
};

export const createVNode = (
  type: VNodeTypes,
  props: Record<string, any> | null,
  children: VNodeChildren
) => {
  const vnode: VNode = {
    __v_isVNode: true,
    type,
    props,
    children,
    key: props && props.key,
    el: null,
    shapeFlag: isString(type)
      ? ShapeFlags.ELEMENT
      : isObject(type) // 组件的type就是组件对象
      ? ShapeFlags.STATEFUL_COMPONENT
      : 0,
    patchFlag: 0,
    component: null,
  };
  // 判断children的类型
  // 1. 文本
  // 2. 数组
  // 2. 对象 => 插槽
  if (children) {
    vnode.shapeFlag |= isString(children)
      ? ShapeFlags.TEXT_CHILDREN
      : isArray(children)
      ? ShapeFlags.ARRAY_CHILDREN
      : isObject(children)
      ? ShapeFlags.SLOTS_CHILDREN
      : ShapeFlags.ELEMENT;
    if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      normalizeChildren(children as VNodeChildAtom[]);
    }
  }
  return vnode;
};
