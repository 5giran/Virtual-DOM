(() => {
  const createPropsPatch = (oldProps = {}, newProps = {}) => {
    const propChanges = {};
    const propNames = new Set([...Object.keys(oldProps), ...Object.keys(newProps)]);

    propNames.forEach((propName) => {
      if (oldProps[propName] !== newProps[propName]) {
        propChanges[propName] = Object.prototype.hasOwnProperty.call(newProps, propName)
          ? newProps[propName]
          : null;
      }
    });

    return propChanges;
  };

  const walk = (oldVnode, newVnode, index, patches) => {
    if (!oldVnode && newVnode) {
      patches.push({
        type: "ADD",
        index,
        vnode: newVnode
      });

      return index;
    }

    if (oldVnode && !newVnode) {
      patches.push({
        type: "REMOVE",
        index
      });

      return index;
    }

    if (!oldVnode || !newVnode) {
      return index;
    }

    if (oldVnode.type !== newVnode.type) {
      patches.push({
        type: "REPLACE",
        index,
        vnode: newVnode
      });

      return index;
    }

    if (oldVnode.type === "#text" && newVnode.type === "#text") {
      const oldText = oldVnode.children[0] || "";
      const newText = newVnode.children[0] || "";

      if (oldText !== newText) {
        patches.push({
          type: "TEXT",
          index,
          text: newText
        });
      }

      return index;
    }

    const propChanges = createPropsPatch(oldVnode.props, newVnode.props);

    if (Object.keys(propChanges).length > 0) {
      patches.push({
        type: "PROPS",
        index,
        props: propChanges
      });
    }

    let currentIndex = index;
    const oldChildren = oldVnode.children || [];
    const newChildren = newVnode.children || [];
    const childCount = Math.max(oldChildren.length, newChildren.length);

    for (let childIndex = 0; childIndex < childCount; childIndex += 1) {
      const oldChild = oldChildren[childIndex];
      const newChild = newChildren[childIndex];

      if (!oldChild && newChild) {
        patches.push({
          type: "ADD",
          index,
          vnode: newChild
        });

        continue;
      }

      currentIndex += 1;
      currentIndex = walk(oldChild, newChild, currentIndex, patches);
    }

    return currentIndex;
  };

  const diff = (oldVnode, newVnode, index = 0) => {
    const patches = [];

    walk(oldVnode, newVnode, index, patches);

    return patches;
  };

  window.diff = diff;
})();
