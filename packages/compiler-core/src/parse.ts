import { NodeTypes } from "./ast";

type Position = {
  column: number;
  line: number;
  offset: number;
};
type ParserContext = Position & {
  originalSource: string;
  source: string;
};

export type SourceLocation = {
  start: Position;
  end: Position;
  source: string;
};

// 创建根节点
const createRoot = (children: any[], loc: SourceLocation) => {
  return {
    type: NodeTypes.ROOT,
    children,
    loc,
  };
};

export const baseParse = (content: string) => {
  // 创建解析上下文
  const context = createParserContext(content);
  const start = getCursor(context);
  return createRoot(parseChildren(context), getSelection(context, start));
};

const parseChildren = (context: ParserContext) => {
  const nodes: any[] = [];
  // 遍历字符串
  while (!isEnd(context)) {
    const { source } = context;
    let node = null;
    if (source[0] === "<") {
      node = parseElement(context);
    } else if (source.startsWith("{{")) {
      node = parseInterpolation(context);
    } else {
      node = parseText(context);
    }
    nodes.push(node);
  }
  // 纯空白符的node删掉
  for (let i = 0; i < nodes.length; i++) {
    if (!/[^/f/r/n ]/.test(nodes[i].content)) {
      nodes[i] = null;
    }
  }
  return nodes.filter(Boolean);
};

// 处理元素
const parseElement = (context: ParserContext) => {
  // 解析标签 <div   name="a" disabled></div>  <br />
  const element: any = parseTag(context);
  // 处理元素的children
  const children = parseChildren(context);
  element.children = children;
  // </div> 可以直接去掉
  if (context.source.startsWith("</")) {
    parseTag(context);
  }
  // 去掉尾部标签后，再更新ele的位置信息
  element.loc = getSelection(context, element.loc.start);
  return element;
};

// 处理标签
const parseTag = (context: ParserContext) => {
  const start = getCursor(context);
  // 获取标签 <div> 或 </div> 的名称 div
  const match = /<\/?([a-z][^\t\r\n\f />]*)/i.exec(context.source)!;
  const tag = match[1];
  // 去掉 <div 或 </div
  advanceBy(context, match[0].length);
  // 去空格    name="a" disabled></div>
  advanceSpaces(context);
  // 处理属性、事件、指令等等 name="a" disabled></div>
  const props = parseAttributes(context);
  // 判断是否是自闭和标签 name="a" disabled /> 或 />
  const isSelfClosing = context.source.startsWith("/>");
  // 去掉标签结尾 > />
  advanceBy(context, isSelfClosing ? 2 : 1);
  return {
    type: NodeTypes.ELEMENT,
    tag,
    props,
    isSelfClosing,
    loc: getSelection(context, start),
  };
};

// 处理属性
const parseAttributes = (context: ParserContext) => {
  const props = [];
  while (
    context.source.length &&
    !context.source.startsWith(">") &&
    !context.source.startsWith("/>")
  ) {
    // 处理每个属性
    const attr = parseAttribute(context);
    props.push(attr);
    // 处理完一个属性，要去掉后面的空白符
    advanceSpaces(context);
  }
  return props;
};

// 处理单个属性
const parseAttribute = (context: ParserContext) => {
  const start = getCursor(context);
  // 正则获取属性名称
  const match = /^[^\t\r\n\f />][^\t\r\n\f />=]*/.exec(context.source)!;
  const name = match[0];
  let value: any = undefined;
  // 去掉属性名称
  advanceBy(context, name.length);
  // 获取=（需要考虑属性名称到=之间是否有空格）
  if (/^[\t\r\n\f ]*=/.test(context.source)) {
    // 去掉=前的空白符
    advanceSpaces(context);
    // 去掉等号
    advanceBy(context, 1);
    // 去掉=后的空白符
    advanceSpaces(context);
    // 获取value值
    value = parseAttributeValue(context);
  }
  return {
    type: NodeTypes.ATTRIBUTE,
    name, // 属性名
    value,
    loc: getSelection(context, start),
  };
};

// 处理属性值
const parseAttributeValue = (context: ParserContext) => {
  const start = getCursor(context);
  const quote = context.source[0];
  const isQuoted = quote === `"` || quote === `'`;
  if (isQuoted) {
    // 去掉开始的引号
    advanceBy(context, 1);
    // 获取值
    const endIndex = context.source.indexOf(quote);
    const content = parseTextData(context, endIndex);
    // 去掉结束的引号
    advanceBy(context, 1);
    return {
      type: NodeTypes.TEXT,
      content,
      loc: getSelection(context, start),
    };
  }
};

// 处理表达式
const parseInterpolation = (context: ParserContext) => {
  const start = getCursor(context);
  // }}的索引
  const closeIndex = context.source.indexOf("}}", 2);
  if (closeIndex < 0) {
    return;
  }
  // 前进2个字符，去掉{{
  advanceBy(context, 2);
  // 此时source = xxx }}，需要获取简单表达式的内容xxx
  const innerStart = getCursor(context);
  const innerEnd = getCursor(context);
  // 获取简单表达式内容的长度
  const rawContentLength = closeIndex - 2;
  const preTrimContent = parseTextData(context, rawContentLength);
  // 去空格
  const content = preTrimContent.trim();
  // content 在 preTrimContent 中的位置
  const startOffset = preTrimContent.indexOf(content);
  // preTrimContent 的前面有空格
  if (startOffset > 0) {
    // 更新 innerStart 的信息
    advancePositionWithMutation(innerStart, preTrimContent, startOffset);
  }
  // 更新 innerEnd 的信息
  const endOffset = startOffset + content.length;
  advancePositionWithMutation(innerEnd, preTrimContent, endOffset);
  // 前进2个字符，去掉}}
  advanceBy(context, 2);
  return {
    type: NodeTypes.INTERPOLATION,
    content: {
      type: NodeTypes.SIMPLE_EXPRESSION,
      content,
      loc: getSelection(context, innerStart, innerEnd),
    },
    loc: getSelection(context, start),
  };
};

// 处理文本，文本后面可能会遇到 {{}} 和 <>
// aaa {{ x }} <div></div>
const parseText = (context: ParserContext) => {
  const endTokens = ["<", "{{"];
  const { source } = context;
  // 文本结束的位置
  let endIndex = source.length;
  for (let i = 0; i < endTokens.length; i++) {
    const index = source.indexOf(endTokens[i]);
    if (index !== -1 && index < endIndex) {
      endIndex = index;
    }
  }
  // 创建行列信息（报错）
  // 获取当前位置
  const start = getCursor(context);
  // 获取文本内容 内部修改了context信息，再获取getCursor就是获取end
  const content = parseTextData(context, endIndex);
  return {
    type: NodeTypes.TEXT,
    content,
    loc: getSelection(context, start),
  };
};

// 获取当前光标位置
const getCursor = (context: ParserContext): Position => {
  const { line, column, offset } = context;
  return { line, column, offset };
};

// 获取到特定位置的文本，并更新信息
const parseTextData = (context: ParserContext, length: number) => {
  // 截取文本
  const rawText = context.source.slice(0, length);
  // 从source中删除刚刚截取的文本
  advanceBy(context, length);
  return rawText;
};

// 文本前进length个字符
const advanceBy = (context: ParserContext, length: number) => {
  const { source } = context;
  // 删除文本前，先更新下context信息
  advancePositionWithMutation(context, source, length);
  context.source = source.slice(length);
};

// 去掉文本前面的空格
const advanceSpaces = (context: ParserContext) => {
  const match = /^[ \t\n\r]+/.exec(context.source);
  if (match) {
    advanceBy(context, match[0].length);
  }
};

// 更新行列偏移量信息
const advancePositionWithMutation = (
  pos: Position,
  source: string,
  length: number
) => {
  let linesCount = 0;
  let lastNewLinePos = -1;
  for (let i = 0; i < length; i++) {
    // 换行符
    if (source.charCodeAt(i) === 10) {
      // 行数增加
      linesCount++;
      // 换行前的索引
      lastNewLinePos = i;
    }
  }
  pos.line += linesCount;
  // 没换行 column += length
  // 换行
  /**
   * aaaa
   *
   *     bbbb
   */
  // length = 4(aaaa) + 1(\n) + 1(\n) + 4(    ) + 4(bbbb)
  // 1. lastNewLinePos => 4  2. lastNewLinePos => 5
  pos.column =
    lastNewLinePos === -1 ? pos.column + length : length - lastNewLinePos;
  pos.offset += length;
  return pos;
};

// 获取当前的开始位置和结束位置
const getSelection = (
  context: ParserContext,
  start: Position,
  end?: Position
): SourceLocation => {
  end = end || getCursor(context);
  return {
    start,
    end,
    source: context.originalSource.slice(start.offset, end.offset),
  };
};

const createParserContext = (content: string): ParserContext => {
  return {
    column: 1, // 列
    line: 1, // 行
    offset: 0, // 偏移量
    originalSource: content,
    source: content,
  };
};

const isEnd = (context: ParserContext) => {
  const { source } = context;
  if (source && source.startsWith("</")) {
    return true;
  }
  return !source;
};
