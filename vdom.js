(() => {
  const ELEMENT_NODE = 1;
  const TEXT_NODE = 3;
  const COMMENT_NODE = 8;
  const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

  const isWhitespaceText = (node) => node && node.nodeType === TEXT_NODE && node.textContent.trim() === "";

  const shouldSkipNode = (node) => !node || node.nodeType === COMMENT_NODE || isWhitespaceText(node);

  const getNodeProps = (node) => {
    const props = {};

    Array.from(node.attributes).forEach((attribute) => {
      props[attribute.name] = attribute.value;
    });

    return props;
  };

  const domToVdom = (domNode) => {
    if (shouldSkipNode(domNode)) {
      return null;
    }

    if (domNode.nodeType === TEXT_NODE) {
      return {
        type: "#text",
        props: {},
        children: [domNode.textContent]
      };
    }

    if (domNode.nodeType !== ELEMENT_NODE) {
      return null;
    }

    const children = VOID_TAGS.has(domNode.tagName.toLowerCase())
      ? []
      : Array.from(domNode.childNodes)
          .map((childNode) => domToVdom(childNode))
          .filter(Boolean);

    return {
      type: domNode.tagName.toLowerCase(),
      props: getNodeProps(domNode),
      children
    };
  };

  const appendChildren = (domNode, children = []) => {
    children.forEach((child) => {
      const childDom = vdomToDom(child);

      if (childDom) {
        domNode.appendChild(childDom);
      }
    });
  };

  const vdomToDom = (vNode) => {
    if (!vNode) {
      return null;
    }

    if (typeof vNode === "string") {
      return document.createTextNode(vNode);
    }

    if (vNode.type === "#text") {
      return document.createTextNode(vNode.children[0] || "");
    }

    const domNode = document.createElement(vNode.type);

    Object.entries(vNode.props || {}).forEach(([name, value]) => {
      domNode.setAttribute(name, value);
    });

    appendChildren(domNode, vNode.children);

    return domNode;
  };

  window.domToVdom = domToVdom;
  window.vdomToDom = vdomToDom;
})();
