import { ShapeFlags } from "@vue/shared";
import { ComponentInternalInstance } from "./component";
import { VNodeChildren } from "./vnode";

export type RawSlots = { [name: string]: unknown };

export const initSlots = (
  instance: ComponentInternalInstance,
  children: VNodeChildren
) => {
  const { shapeFlag } = instance.vnode;
  if (shapeFlag & ShapeFlags.SLOTS_CHILDREN) {
    instance.slots = children as RawSlots;
  }
};
