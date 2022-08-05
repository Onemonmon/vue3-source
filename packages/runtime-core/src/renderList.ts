import { isArray } from "@vue/shared";
import { VNodeChildAtom } from "./vnode";

export function renderList(
  source: any,
  renderItem: (...args: any[]) => VNodeChildAtom
) {
  let ret: VNodeChildAtom[] = [];
  if (isArray(source)) {
    ret = new Array(source.length);
    for (let i = 0; i < source.length; i++) {
      ret[i] = renderItem(source[i], i);
    }
  }
  return ret;
}
