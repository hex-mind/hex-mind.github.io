import { onBeforeUnmount, ref, watch, type Ref } from 'vue';

type HighlightRegistryLike = {
  set(name: string, highlight: object): void;
  delete(name: string): void;
};

type HighlightConstructorLike = new (...ranges: Range[]) => object;

const SEARCH_HIGHLIGHT_NAME = 'fw-search';
const CURRENT_HIGHLIGHT_NAME = 'fw-search-current';
const SEARCH_DEBOUNCE_MS = 120;
let activeSearchOwner: symbol | null = null;

function getHighlightRegistry(): HighlightRegistryLike {
  return (CSS as unknown as { highlights: HighlightRegistryLike }).highlights;
}

function getHighlightConstructor(): HighlightConstructorLike {
  return (globalThis as unknown as { Highlight: HighlightConstructorLike }).Highlight;
}

function clearHighlights(registry: HighlightRegistryLike): void {
  registry.delete(SEARCH_HIGHLIGHT_NAME);
  registry.delete(CURRENT_HIGHLIGHT_NAME);
}

function collectMatchRanges(container: HTMLElement, queryText: string): Range[] {
  const ranges: Range[] = [];
  const query = queryText.toLocaleLowerCase();
  const queryLength = query.length;
  if (queryLength === 0) return ranges;

  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();

  while (node) {
    const text = node.textContent ?? '';
    if (text.length > 0) {
      const haystack = text.toLocaleLowerCase();
      let from = 0;
      while (from <= haystack.length - queryLength) {
        const at = haystack.indexOf(query, from);
        if (at < 0) break;
        const range = document.createRange();
        range.setStart(node, at);
        range.setEnd(node, at + queryLength);
        ranges.push(range);
        from = at + queryLength;
      }
    }
    node = walker.nextNode();
  }

  return ranges;
}

export function useContentSearch(containerEl: Ref<HTMLElement | undefined>) {
  const owner = Symbol('content-search-owner');
  const isSearching = ref(false);
  const query = ref('');
  const matchCount = ref(0);
  const currentIndex = ref(-1);

  const registry = getHighlightRegistry();
  const HighlightImpl = getHighlightConstructor();

  let matchRanges: Range[] = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function scrollCurrentRangeIntoView(): void {
    const range = matchRanges[currentIndex.value];
    if (!range) return;
    const target =
      range.startContainer instanceof Element
        ? range.startContainer
        : range.startContainer.parentElement;
    if (!target) return;
    target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
  }

  function updateCurrentHighlight(): void {
    if (activeSearchOwner !== owner) return;
    registry.delete(CURRENT_HIGHLIGHT_NAME);
    const range = matchRanges[currentIndex.value];
    if (!range) return;
    registry.set(CURRENT_HIGHLIGHT_NAME, new HighlightImpl(range));
    scrollCurrentRangeIntoView();
  }

  function renderHighlights(): void {
    if (activeSearchOwner !== owner) return;
    clearHighlights(registry);
    if (matchRanges.length === 0) return;
    registry.set(SEARCH_HIGHLIGHT_NAME, new HighlightImpl(...matchRanges));
    updateCurrentHighlight();
  }

  function performSearch(): void {
    const container = containerEl.value;
    const q = query.value;

    matchRanges = [];
    matchCount.value = 0;
    currentIndex.value = -1;

    if (!isSearching.value || !container || q.length === 0) {
      if (activeSearchOwner === owner) clearHighlights(registry);
      return;
    }
    if (activeSearchOwner !== owner) return;

    clearHighlights(registry);

    matchRanges = collectMatchRanges(container, q);
    matchCount.value = matchRanges.length;
    if (matchRanges.length > 0) currentIndex.value = 0;
    renderHighlights();
  }

  function scheduleSearch(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      performSearch();
    }, SEARCH_DEBOUNCE_MS);
  }

  function open(): void {
    isSearching.value = true;
    activeSearchOwner = owner;
    scheduleSearch();
  }

  function close(): void {
    isSearching.value = false;
    query.value = '';
    matchRanges = [];
    matchCount.value = 0;
    currentIndex.value = -1;
    if (activeSearchOwner === owner) {
      clearHighlights(registry);
      activeSearchOwner = null;
    }
  }

  function next(): void {
    activeSearchOwner = owner;
    if (matchRanges.length === 0) return;
    const nextIndex = currentIndex.value < 0 ? 0 : (currentIndex.value + 1) % matchRanges.length;
    currentIndex.value = nextIndex;
    updateCurrentHighlight();
  }

  function prev(): void {
    activeSearchOwner = owner;
    if (matchRanges.length === 0) return;
    const prevIndex =
      currentIndex.value < 0
        ? matchRanges.length - 1
        : (currentIndex.value - 1 + matchRanges.length) % matchRanges.length;
    currentIndex.value = prevIndex;
    updateCurrentHighlight();
  }

  function refresh(): void {
    if (!isSearching.value) return;
    scheduleSearch();
  }

  watch(query, () => {
    if (!isSearching.value) return;
    scheduleSearch();
  });

  onBeforeUnmount(() => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    if (activeSearchOwner === owner) {
      clearHighlights(registry);
      activeSearchOwner = null;
    }
  });

  return {
    isSearching,
    query,
    matchCount,
    currentIndex,
    open,
    close,
    next,
    prev,
    refresh,
  };
}
