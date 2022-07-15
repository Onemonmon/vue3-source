import { capitalize } from "@vue/shared";
import { ComponentInternalInstance } from "./component";

export const emit = (
  instance: ComponentInternalInstance,
  event: string,
  ...rawArgs: any[]
) => {
  const { props = {} } = instance.vnode;
  const handlerName = toHandlerKey(event);
  const handler = (props as Record<string, any>)[handlerName];
  handler && handler(...rawArgs);
};

export const toHandlerKey = (str: string) =>
  str ? `on${capitalize(str)}` : ``;
