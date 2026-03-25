export function cloneVdom(vnode) {
  if (!vnode) {
    return null;
  }

  return JSON.parse(JSON.stringify(vnode));
}
