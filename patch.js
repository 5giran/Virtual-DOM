(() => {
  const ELEMENT_NODE = 1;
  const TEXT_NODE = 3;
  const COMMENT_NODE = 8;
  const HIGHLIGHT_DURATION = 1500;

  const shouldSkipNode = (node) =>
    !node ||
    node.nodeType === COMMENT_NODE ||
    (node.nodeType === TEXT_NODE && node.textContent.trim() === "");

  const collectNodesDepthFirst = (rootNode) => {
    const nodes = [];

    const walk = (node) => {
      if (shouldSkipNode(node)) {
        return;
      }

      nodes.push(node);
      Array.from(node.childNodes).forEach((childNode) => walk(childNode));
    };

    walk(rootNode);

    return nodes;
  };

  const highlightNode = (node) => {
    const target = node && node.nodeType === ELEMENT_NODE ? node : node?.parentElement;

    if (!target) {
      return;
    }

    target.classList.add("highlight-changed");

    window.setTimeout(() => {
      target.classList.remove("highlight-changed");
    }, HIGHLIGHT_DURATION);
  };

  const applyPropsPatch = (node, props = {}) => {
    if (!node || node.nodeType !== ELEMENT_NODE) {
      return;
    }

    Object.entries(props).forEach(([name, value]) => {
      if (value === null || value === undefined) {
        node.removeAttribute(name);
        return;
      }

      node.setAttribute(name, value);
    });
  };

  const getTrackedChildren = (node) =>
    Array.from(node?.childNodes || []).filter((childNode) => !shouldSkipNode(childNode));

  const resolveHighlightTarget = (realDomRoot, indexedNodes, patch) => {
    const targetNode = indexedNodes[patch.index];

    switch (patch.type) {
      case "ADD": {
        const appendedChildren = getTrackedChildren(targetNode);
        return appendedChildren[appendedChildren.length - 1] || targetNode;
      }

      case "REMOVE":
        return targetNode?.parentNode || targetNode || realDomRoot;

      case "REPLACE":
      case "TEXT":
      case "PROPS":
        return targetNode || realDomRoot;

      default:
        return null;
    }
  };

  const applyPatches = (realDomRoot, patches = []) => {
    if (!realDomRoot || !Array.isArray(patches) || patches.length === 0) {
      return;
    }

    const indexedNodes = collectNodesDepthFirst(realDomRoot);

    patches.forEach((patch) => {
      const targetNode = indexedNodes[patch.index];

      if (!targetNode) {
        return;
      }

      switch (patch.type) {
        case "ADD": {
          const newNode = window.vdomToDom(patch.vnode);

          if (!newNode) {
            break;
          }

          targetNode.appendChild(newNode);
          highlightNode(newNode);
          break;
        }

        case "REMOVE": {
          const parentNode = targetNode.parentNode;

          if (!parentNode) {
            break;
          }

          parentNode.removeChild(targetNode);
          highlightNode(parentNode);
          break;
        }

        case "REPLACE": {
          const parentNode = targetNode.parentNode;
          const newNode = window.vdomToDom(patch.vnode);

          if (!parentNode || !newNode) {
            break;
          }

          parentNode.replaceChild(newNode, targetNode);
          highlightNode(newNode);
          break;
        }

        case "TEXT": {
          if (targetNode.nodeType !== TEXT_NODE) {
            break;
          }

          targetNode.nodeValue = patch.text;
          highlightNode(targetNode);
          break;
        }

        case "PROPS": {
          applyPropsPatch(targetNode, patch.props);
          highlightNode(targetNode);
          break;
        }

        default:
          break;
      }
    });
  };

  const highlightPatches = (realDomRoot, patches = []) => {
    if (!realDomRoot || !Array.isArray(patches) || patches.length === 0) {
      return;
    }

    const indexedNodes = collectNodesDepthFirst(realDomRoot);

    patches.forEach((patch) => {
      const highlightTarget = resolveHighlightTarget(realDomRoot, indexedNodes, patch);

      if (highlightTarget) {
        highlightNode(highlightTarget);
      }
    });
  };

  window.applyPatches = applyPatches;
  window.highlightPatches = highlightPatches;
})();
