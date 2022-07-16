import { baseParse } from "./parse";

export const compile = (template: string) => {
  // 1. 生成ast，将模板转换成js
  const ast = baseParse(template);
  console.log(ast);

  // 2. 处理ast

  // 3. 生成代码
};
