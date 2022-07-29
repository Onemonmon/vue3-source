export const FRAGMENT = Symbol(`Fragment`);
export const OPEN_BLOCK = Symbol(`openBlock`);
export const CREATE_BLOCK = Symbol(`createBlock`);
export const CREATE_ELEMENT_BLOCK = Symbol(`createElementBlock`);
export const CREATE_VNODE = Symbol(`createVNode`);
export const CREATE_ELEMENT_VNODE = Symbol(`createElementVNode`);
export const CREATE_COMMENT = Symbol(`createCommentVNode`);
export const CREATE_TEXT = Symbol(`createTextVNode`);
export const TO_DISPLAY_STRING = Symbol(`toDisplayString`);

export const helperNameMap: any = {
  [FRAGMENT]: `Fragment`,
  [OPEN_BLOCK]: `openBlock`,
  [CREATE_BLOCK]: `createBlock`,
  [CREATE_ELEMENT_BLOCK]: `createElementBlock`,
  [CREATE_VNODE]: `createVNode`,
  [CREATE_ELEMENT_VNODE]: `createElementVNode`,
  [CREATE_COMMENT]: `createCommentVNode`,
  [CREATE_TEXT]: `createTextVNode`,
  [TO_DISPLAY_STRING]: `toDisplayString`,
};
