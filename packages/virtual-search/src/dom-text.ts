interface TextSpan {
  node: Text;
  outputStart: number;
  outputEnd: number;
}

export interface DomTextMap {
  text: string;
  spans: readonly TextSpan[];
}

export class DomTextBuilder {
  private value = "";
  private readonly spans: TextSpan[] = [];

  appendText(node: Text): void {
    const text = node.data;
    if (text.length === 0) return;

    const outputStart = this.value.length;
    this.value += text;
    this.spans.push({
      node,
      outputStart,
      outputEnd: this.value.length,
    });
  }

  appendSeparator(separator = "\n"): void {
    if (this.value.length === 0 || this.value.endsWith(separator)) return;
    this.value += separator;
  }

  get length(): number {
    return this.value.length;
  }

  take(): DomTextMap {
    const map = {
      text: this.value,
      spans: [...this.spans],
    };

    this.value = "";
    this.spans.length = 0;
    return map;
  }
}

export function createRangeFromTextMap(
  map: DomTextMap,
  start: number,
  end: number,
): Range | null {
  const startSpan = map.spans.find(
    span => start >= span.outputStart && start < span.outputEnd,
  );
  const endSpan = [...map.spans].reverse().find(
    span => end > span.outputStart && end <= span.outputEnd,
  );

  if (!startSpan || !endSpan) return null;

  const range = startSpan.node.ownerDocument.createRange();
  range.setStart(startSpan.node, start - startSpan.outputStart);
  range.setEnd(endSpan.node, end - endSpan.outputStart);
  return range;
}

export function textMapForElement(element: Element): DomTextMap {
  const builder = new DomTextBuilder();
  const walker = element.ownerDocument.createTreeWalker(
    element,
    NodeFilter.SHOW_TEXT,
  );

  let node = walker.nextNode();
  while (node) {
    builder.appendText(node as Text);
    node = walker.nextNode();
  }

  return builder.take();
}
