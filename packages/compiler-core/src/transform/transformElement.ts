import { createObjectExpression, createVNodeCall, NodeTypes } from "../ast";
import { Node } from "../parse";
import { TransformContext } from "../transform";
import { CREATE_ELEMENT_VNODE } from "./runtimeHelpers";

export const transformElement = (node: Node, context: TransformContext) => {
  if (node.type === NodeTypes.ELEMENT) {
    // 返回一个退出函数，当子项都完成了之后才执行
    return () => {
      /**
       * <div a="1" b="2">  aa {{ n }} <span /></div>
       * 转换成
       * createElementBlock("div", { a: "1", b: "2" }, [
       *   createTextVNode(" aa " + toDisplayString(_ctx.n) + " ", 1),
       *   createElementVNode("span")
       * ]))
       */
      const { tag, props } = node;
      const vnodeTag = `"${tag}"`;
      const propsExpression = createObjectExpression(props);
      context.helper(CREATE_ELEMENT_VNODE);
      node.codegenNode = createVNodeCall(
        vnodeTag,
        propsExpression,
        node.children
      );
    };
  }
};
