export const patchEvents = (
  el: Element & { [key: string]: any },
  key: string,
  prevValue: any | null,
  nextValue: any | null
) => {
  // 元素上存在一个_vei属性，存放绑定的事件
  const invokers = el._vei || (el._vei = {});
  const existingInvorker = invokers[key];
  // 如果存在key的invoker，说明之前绑定过该事件，可以复用
  if (existingInvorker) {
    // 将invoker的值改成新的事件回调
    existingInvorker.value = nextValue;
  } else {
    const eventName = key.slice(2).toLowerCase();
    // 创建invoker 新增事件
    if (nextValue) {
      const invoker = (invokers[key] = createInvoker(nextValue));
      el.addEventListener(eventName, invoker);
    }
    // 移除事件
    else {
      el.removeEventListener(eventName, prevValue);
      invokers[key] = null;
    }
  }
};

/**
 * 通过改变value，可以直接改变事件回调函数，不需要重新addEventListener
 */
function createInvoker(initialValue: any) {
  const invoker = (e: Event) => {
    invoker.value && invoker.value(e);
  };
  invoker.value = initialValue;
  return invoker;
}
