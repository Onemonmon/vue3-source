import { isString, ShapeFlags } from "@vue/shared";

export const Text = Symbol();

export type VNodeTypes =
  | string
  | VNode
  // | Component
  | typeof Text;

export type VNodeChildAtom = string | VNode;

export type VNode = {
  __v_isVNode: true;
  type: VNodeTypes;
  props: Record<string, any> | null;
  key: string | number | symbol | null;
  children: VNodeChildAtom[] | string | null;
  el: Element | null;
  shapeFlag: number;
  patchFlag: number;
};

export const isSameVNodeType = (n1: VNode, n2: VNode) =>
  n1.type === n2.type && n1.key === n2.key;

export const isVNode = (target: any) =>
  target ? target.__v_isVNode === true : false;

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
    shapeFlag: isString(type) ? ShapeFlags.ELEMENT : 0,
    patchFlag: 0,
  };
  // 判断children是文本还是数组
  if (children) {
    vnode.shapeFlag |= isString(children)
      ? ShapeFlags.TEXT_CHILDREN
      : ShapeFlags.ARRAY_CHILDREN;
  }
  return vnode;
};
