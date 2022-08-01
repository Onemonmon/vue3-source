import { capitalize } from "@vue/shared";
import { ComponentInternalInstance } from "./component";

// emit("xxx", xxx) 相当于执行 props.onXxx(xxx)
export const emit = (
  instance: ComponentInternalInstance,
  event: string,
  ...rawArgs: any[]
) => {
  const { props = {} } = instance.vnode;
  // 把xxx转成onXxx
  const handlerName = toHandlerKey(event);
  const handler = (props as Record<string, any>)[handlerName];
  // 执行props.onXxx
  handler && handler(...rawArgs);
};

export const toHandlerKey = (str: string) =>
  str ? `on${capitalize(str)}` : ``;
