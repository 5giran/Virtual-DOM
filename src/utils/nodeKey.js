export function getNodeKey(vnode) {
  if (!vnode || vnode.type !== "element") {
    return null;
  }

  return vnode.attrs?.["data-key"] ?? vnode.attrs?.key ?? null;
}
