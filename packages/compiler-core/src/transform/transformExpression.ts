import { NodeTypes } from "../ast";
import { Node } from "../parse";
export const transformExpression = (node: Node) => {
  // {{aaa}} => _toDisplayString(_ctx.aaa)
  if (node.type === NodeTypes.INTERPOLATION) {
    const rawContent = node.content.content;
    node.content.content = `_cxt.${rawContent}`;
  }
};
