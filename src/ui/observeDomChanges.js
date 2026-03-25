export function createDomObserver(target) {
  const observer = new MutationObserver(() => {});

  observer.observe(target, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
  });

  return {
    flush() {
      return observer.takeRecords().length;
    },

    disconnect() {
      observer.disconnect();
    },
  };
}
