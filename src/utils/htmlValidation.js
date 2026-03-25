import { sanitizeHtml } from "../core/vdom.js";

const HTML_VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

export function validatePatchableHtml(input) {
  // patch 전에 막아야 하는 명백한 HTML 구조 문제를 검사합니다.
  const source = (input ?? "").trim();

  if (!source) {
    return {
      isValid: false,
      message: "HTML이 비어 있어서 적용할 수 없음",
    };
  }

  const structureValidation = validateHtmlTagStructure(source);

  if (!structureValidation.isValid) {
    return structureValidation;
  }

  const sanitized = sanitizeHtml(source);

  if (!sanitized) {
    return {
      isValid: false,
      message: "sanitize 후 남는 HTML이 없음",
    };
  }

  const duplicateKeys = findDuplicateDataKeys(sanitized);

  if (duplicateKeys.length > 0) {
    return {
      isValid: false,
      message: `중복 data-key 감지: ${duplicateKeys.join(", ")}`,
    };
  }

  const listItemsWithoutKeys = findListItemsWithoutDataKeys(sanitized);

  if (listItemsWithoutKeys > 0) {
    return {
      isValid: false,
      message: `li 태그에는 data-key가 필요함 (${listItemsWithoutKeys}개 누락)`,
    };
  }

  return {
    isValid: true,
    message: "HTML 적용 가능",
  };
}

function validateHtmlTagStructure(source) {
  // 열린 태그/닫는 태그의 기본 짝이 맞는지 스택으로 확인합니다.
  const tagPattern = /<\/?([a-zA-Z][\w:-]*)\b[^>]*>/g;
  const stack = [];

  for (const match of source.matchAll(tagPattern)) {
    const [fullMatch, rawTagName] = match;
    const tagName = rawTagName.toLowerCase();
    const isClosing = fullMatch.startsWith("</");
    const isSelfClosing = fullMatch.endsWith("/>") || HTML_VOID_TAGS.has(tagName);

    if (isClosing) {
      const expectedTag = stack.pop();

      if (expectedTag !== tagName) {
        return {
          isValid: false,
          message: `태그 짝이 맞지 않음: </${tagName}>`,
        };
      }

      continue;
    }

    if (!isSelfClosing) {
      stack.push(tagName);
    }
  }

  if (stack.length > 0) {
    return {
      isValid: false,
      message: `닫히지 않은 태그가 있음: <${stack[stack.length - 1]}>`,
    };
  }

  return {
    isValid: true,
    message: "태그 구조 정상",
  };
}

function findDuplicateDataKeys(html) {
  // 같은 data-key가 여러 번 나오면 keyed diff가 불안정해지므로 patch 전에 차단합니다.
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;

  const counts = new Map();

  wrapper.querySelectorAll("[data-key]").forEach((node) => {
    const key = node.getAttribute("data-key") ?? "";
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return Array.from(counts.entries())
    .filter(([, count]) => count > 1)
    .map(([key]) => key);
}

function findListItemsWithoutDataKeys(html) {
  // 리스트 항목은 순서 변경/삭제 추적을 위해 모두 비어 있지 않은 data-key를 가져야 합니다.
  const wrapper = document.createElement("div");
  wrapper.innerHTML = html;

  return Array.from(wrapper.querySelectorAll("ul > li, ol > li")).filter(
    (node) => {
      if (!node.hasAttribute("data-key")) {
        return true;
      }

      const key = node.getAttribute("data-key") ?? "";
      return key.trim().length === 0;
    },
  ).length;
}
