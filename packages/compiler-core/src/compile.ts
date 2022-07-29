import { baseParse } from "./parse";
import { transform } from "./transform";

export const compile = (template: string) => {
  // 1. 生成ast，将模板转换成js
  const ast = baseParse(template);
  // 2. 处理ast
  // 如 <div>{{aa}} 123</div> => createElementVNode("div", toDisplayString(aa) + 123)
  // 而不会为div内创建两个child
  // 需要收集转换所需要的方法如：createElementVNode、toDisplayString
  transform(ast);
  // 3. 生成代码
};
