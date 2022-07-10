import { isObject, isString, ShapeFlags } from "@vue/shared";
import { Component, ComponentInternalInstance } from "./component";

export const Text = Symbol("Text");
export const Fragment = Symbol("Fragment");

export type VNodeTypes =
  | string
  | VNode
  | Component
  | typeof Text
  | typeof Fragment;

export type VNodeChildAtom = string | VNode;

export type VNode = {
  __v_isVNode: true;
  type: VNodeTypes;
  props: Record<string, any> | null;
  key: string | number | symbol | null;
  children: VNodeChildAtom[] | string | null;
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
  children: VNodeChildAtom[] | string | null
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
  // 判断children是文本还是数组
  if (children) {
    vnode.shapeFlag |= isString(children)
      ? ShapeFlags.TEXT_CHILDREN
      : ShapeFlags.ARRAY_CHILDREN;
    if (vnode.shapeFlag & ShapeFlags.ARRAY_CHILDREN) {
      normalizeChildren(children as VNodeChildAtom[]);
    }
  }
  return vnode;
};
