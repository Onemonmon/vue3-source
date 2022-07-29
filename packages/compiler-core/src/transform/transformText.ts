import { PatchFlagNames, PatchFlags } from "@vue/shared";
import { createCallExpression, NodeTypes } from "../ast";
import { Node } from "../parse";
import { TransformContext } from "../transform";
import { CREATE_TEXT } from "./runtimeHelpers";

const isText = (node: Node) =>
  node.type === NodeTypes.TEXT || node.type === NodeTypes.INTERPOLATION;

// 期望 当前文本aa 跟则 其他文本{{bb}}，能合成同一个文本
export const transformText = (node: Node, context: TransformContext) => {
  // 在元素中的文本才需处理
  if (node.type === NodeTypes.ELEMENT || node.type === NodeTypes.ROOT) {
    // 返回一个退出函数，当子项都完成了之后才执行
    return () => {
      // 获取连续的 文本和表达式
      const children = node.children;
      // 子节点是否包含文本
      let hasText = false;
      let currentContainer: Node | null = null;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (isText(child)) {
          hasText = true;
          for (let j = i + 1; j < children.length; j++) {
            const next = children[j];
            // 下一个还是文本，需要合并
            if (isText(next)) {
              if (!currentContainer) {
                currentContainer = children[i] = {
                  type: NodeTypes.COMPOUND_EXPRESSION,
                  children: [child],
                  loc: child.loc,
                };
              }
              currentContainer.children.push("+", next);
              // 合并后外层循环不再需要遍历这一个节点
              children.splice(j, 1);
              j--;
            } else {
              currentContainer = null;
              break;
            }
          }
        }
      }
      // 如果合并完之后，只有一个节点，且该节点还是文本，则可以不需要通过createTextVNode创建
      // <div> aa {{ n }} </div>
      // createElementBlock("div", null, " aa " + toDisplayString(_ctx.n), 1 /* TEXT */))
      if (!hasText || node.children.length === 1) {
        return;
      }
      // 否则需要打标签
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (isText(child) || child.type === NodeTypes.COMPOUND_EXPRESSION) {
          const callArgs: any[] = [];
          // 纯文本时
          // <div> aa <span /></div> => createTextVNode(" aa ")
          callArgs.push(child);
          if (child.type !== NodeTypes.TEXT) {
            // 不是纯文本，则一定是动态节点
            // <div>  aa {{ n }} <span /></div> => createTextVNode(" aa " + toDisplayString(_ctx.n) + " ", 1 /* TEXT */)
            callArgs.push(
              PatchFlags.TEXT, // 靶向更新
              `/* ${PatchFlagNames[PatchFlags.TEXT]} */`
            );
          }
          children[i] = {
            type: NodeTypes.TEXT_CALL,
            content: child,
            loc: child.loc,
            codegenNode: createCallExpression(
              context.helper(CREATE_TEXT),
              callArgs
            ),
          };
        }
      }
    };
  }
};
