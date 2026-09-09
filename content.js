// Prefixes document.title with this tab's position number, and keeps
// re-applying the prefix if the page changes its own title later (SPAs
// routinely do this on navigation).

let currentNumber = null;
let isUpdating = false;

function getBaseTitle() {
  const t = document.title;
  if (currentNumber != null) {
    const prefix = currentNumber + " ";
    if (t.startsWith(prefix)) {
      return t.slice(prefix.length);
    }
  }
  return t;
}

function applyPrefixedTitle(baseTitle) {
  if (currentNumber == null) return;
  const next = `${currentNumber} ${baseTitle}`;
  if (document.title === next) return;
  isUpdating = true;
  document.title = next;
  // Let the mutation this causes fire and be ignored before clearing the flag.
  setTimeout(() => {
    isUpdating = false;
  }, 0);
}

function ensureTitleElement() {
  let el = document.querySelector("title");
  if (!el) {
    el = document.createElement("title");
    (document.head || document.documentElement).appendChild(el);
  }
  return el;
}

const titleEl = ensureTitleElement();
const observer = new MutationObserver(() => {
  if (isUpdating) return;
  const base = getBaseTitle();
  applyPrefixedTitle(base);
});
observer.observe(titleEl, { childList: true, characterData: true, subtree: true });

chrome.runtime.onMessage.addListener((msg) => {
  if (msg && msg.type === "set-tab-number") {
    const base = getBaseTitle();
    currentNumber = msg.number;
    applyPrefixedTitle(base);
  }
});

// Ask the background script for our number as soon as we load
// (covers the case where no tab event fires right after injection).
chrome.runtime.sendMessage({ type: "get-tab-number" }, (response) => {
  if (chrome.runtime.lastError) return;
  if (response && response.number) {
    currentNumber = response.number;
    applyPrefixedTitle(document.title);
  }
});
