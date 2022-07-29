import { transformElement } from "./transform/transformElement";
import { transformExpression } from "./transform/transformExpression";
import { transformText } from "./transform/transformText";
import { Node } from "./parse";
import { createVNodeCall, NodeTypes } from "./ast";
import {
  CREATE_ELEMENT_BLOCK,
  CREATE_ELEMENT_VNODE,
  FRAGMENT,
  OPEN_BLOCK,
  TO_DISPLAY_STRING,
} from "./transform/runtimeHelpers";

export type TransformContext = {
  currentNode: Node;
  parent: Node | null;
  helpers: Map<Symbol, number>;
  helper(name: Symbol): Symbol;
  removeHelper(name: Symbol): void;
  nodeTransforms: ((node: Node, context: TransformContext) => any)[];
};

const createRootCodegen = (ast: Node, context: TransformContext) => {
  const { children } = ast;
  if (children.length === 1) {
    // 文本、元素
    const child = children[0];
    if (child.type === NodeTypes.ELEMENT && child.codegenNode) {
      ast.codegenNode = child.codegenNode;
      // 此时不再使用createElementVNode，而是使用createElementBlock
      context.removeHelper(CREATE_ELEMENT_VNODE);
      context.helper(OPEN_BLOCK);
      context.helper(CREATE_ELEMENT_BLOCK);
      ast.codegenNode.isBlock = true;
    } else {
      ast.codegenNode = child;
    }
  } else if (children.length > 1) {
    // 需要创建Fragment
    ast.codegenNode = createVNodeCall(context.helper(FRAGMENT), null, children);
    context.helper(OPEN_BLOCK);
    context.helper(CREATE_ELEMENT_BLOCK);
    ast.codegenNode.isBlock = true;
  }
};

export const transform = (ast: Node) => {
  const context = createTransfromContext(ast);
  // 遍历
  traverse(ast, context);
  // 处理最外层
  createRootCodegen(ast, context);
  ast.helpers = context.helpers;
  console.log(ast);
};

const traverse = (node: Node, context: TransformContext) => {
  context.currentNode = node;
  const { nodeTransforms } = context;
  const exitFns: any[] = [];
  for (let i = 0; i < nodeTransforms.length; i++) {
    const onExit = nodeTransforms[i](node, context);
    if (onExit) {
      exitFns.push(onExit);
    }
    // 处理过程中，node被删除了
    if (!context.currentNode) {
      return;
    }
  }
  switch (node.type) {
    case NodeTypes.INTERPOLATION:
      context.helper(TO_DISPLAY_STRING);
      break;
    case NodeTypes.ELEMENT:
    case NodeTypes.ROOT:
      for (let i = 0; i < node.children.length; i++) {
        context.parent = node;
        traverse(node.children[i], context);
      }
  }
  context.currentNode = node;
  let i = exitFns.length;
  while (i--) {
    exitFns[i]();
  }
};

const createTransfromContext = (root: Node): TransformContext => {
  const context = {
    currentNode: root, // 当前转化的节点
    parent: null, // 父节点
    helpers: new Map<Symbol, number>(), // 记录转化所使用的方法，可用于优化
    helper(name: Symbol) {
      const count = context.helpers.get(name) || 0;
      context.helpers.set(name, count + 1);
      return name;
    },
    removeHelper(name: Symbol) {
      let count = context.helpers.get(name);
      if (count) {
        count--;
        if (count) {
          context.helpers.delete(name);
        } else {
          context.helpers.set(name, count);
        }
      }
    },
    nodeTransforms: [
      // 依次对节点进行转化的方法
      transformElement,
      transformText,
      transformExpression,
    ],
  };
  return context;
};
