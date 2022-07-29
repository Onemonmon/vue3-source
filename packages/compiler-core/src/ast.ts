export const enum NodeTypes {
  ROOT, // 根节点
  ELEMENT, // 元素
  TEXT, // 文本
  COMMENT, // 注释
  SIMPLE_EXPRESSION, // 简单表达式 a
  INTERPOLATION, // 模板表达式 {{ a }}
  ATTRIBUTE, // 属性
  DIRECTIVE, // 指令
  // containers
  COMPOUND_EXPRESSION, // 复合表达式 INTERPOLATION + SIMPLE_EXPRESSION {{ a }} a
  IF,
  IF_BRANCH,
  FOR,
  TEXT_CALL,
  // codegen
  VNODE_CALL,
  JS_CALL_EXPRESSION,
  JS_OBJECT_EXPRESSION,
  JS_PROPERTY,
  JS_ARRAY_EXPRESSION,
  JS_FUNCTION_EXPRESSION,
  JS_CONDITIONAL_EXPRESSION,
  JS_CACHE_EXPRESSION,

  // ssr codegen
  JS_BLOCK_STATEMENT,
  JS_TEMPLATE_LITERAL,
  JS_IF_STATEMENT,
  JS_ASSIGNMENT_EXPRESSION,
  JS_SEQUENCE_EXPRESSION,
  JS_RETURN_STATEMENT,
}

export const createCallExpression = (callee: any, args: any[]) => {
  return {
    callee,
    type: NodeTypes.JS_CALL_EXPRESSION,
    arguments: args,
  };
};

export const createObjectExpression = (properties: any) => {
  return {
    type: NodeTypes.JS_OBJECT_EXPRESSION,
    properties,
  };
};

export const createVNodeCall = (
  tag: any,
  propsExpression: any,
  children: any[]
) => {
  return {
    type: NodeTypes.VNODE_CALL,
    tag,
    props: propsExpression,
    children,
  };
};
