import { onBeforeUnmount, reactive, watch, watchEffect } from 'vue';
import type { Ref } from 'vue';
import type { MessageInfo } from '../types/sse';
import { renderWorkerHtml } from '../utils/workerRenderer';

const ASSISTANT_RENDER_INTERVAL_MS = 80;

type UseAssistantPreRendererOptions = {
  visibleRoots: Ref<MessageInfo[]>;
  theme: Ref<string>;
  filesWithBasenames: Ref<string[]>;
  getFinalAnswer: (root: MessageInfo) => MessageInfo | undefined;
  hasAssistantMessages: (root: MessageInfo) => boolean;
  getFinalAnswerContent: (root: MessageInfo) => string;
  getThreadTransitionKey: (root: MessageInfo) => string;
  getThreadAssistantRenderKeyById: (rootId: string, answerId?: string) => string;
  onRendered: (renderKey: string) => void;
};

export function useAssistantPreRenderer(options: UseAssistantPreRendererOptions) {
  const assistantHtmlCache = reactive(new Map<string, string>());
  const deferredKeyCache = reactive(new Map<string, string>());

  const submitSeqMap = new Map<string, number>();
  const appliedSeqMap = new Map<string, number>();
  const lastSubmitted = new Map<string, { answerId: string; content: string; theme: string }>();
  const pendingByRoot = new Map<string, { answerId: string; content: string }>();
  const lastPostedAt = new Map<string, number>();
  const trailingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  let filesSnapshot: string[] = options.filesWithBasenames.value;
  watch(
    options.filesWithBasenames,
    (files) => {
      filesSnapshot = files;
    },
    { flush: 'sync' },
  );

  function submitAssistantRender(rootId: string, answerId: string, content: string) {
    const seq = (submitSeqMap.get(rootId) ?? 0) + 1;
    submitSeqMap.set(rootId, seq);
    lastPostedAt.set(rootId, Date.now());

    const requestId = `assistant-${rootId}-${seq}`;
    void renderWorkerHtml({
      id: requestId,
      code: content,
      lang: 'markdown',
      theme: options.theme.value,
      gutterMode: 'none',
      files: filesSnapshot,
    }).then((html) => {
      if (seq !== submitSeqMap.get(rootId)) return;
      const applied = appliedSeqMap.get(rootId) ?? 0;
      if (seq <= applied) return;
      appliedSeqMap.set(rootId, seq);
      assistantHtmlCache.set(rootId, html);
      deferredKeyCache.set(rootId, answerId);
      options.onRendered(options.getThreadAssistantRenderKeyById(rootId, answerId));
    });
  }

  function flushAssistantRender(rootId: string) {
    const pending = pendingByRoot.get(rootId);
    if (!pending) return;
    pendingByRoot.delete(rootId);
    submitAssistantRender(rootId, pending.answerId, pending.content);
  }

  function enqueueAssistantRender(rootId: string, answerId: string, content: string) {
    pendingByRoot.set(rootId, { answerId, content });
    const wait = ASSISTANT_RENDER_INTERVAL_MS - (Date.now() - (lastPostedAt.get(rootId) ?? 0));
    if (wait <= 0) {
      const timer = trailingTimers.get(rootId);
      if (timer !== undefined) {
        clearTimeout(timer);
        trailingTimers.delete(rootId);
      }
      flushAssistantRender(rootId);
      return;
    }
    if (trailingTimers.has(rootId)) return;
    trailingTimers.set(
      rootId,
      setTimeout(() => {
        trailingTimers.delete(rootId);
        flushAssistantRender(rootId);
      }, wait),
    );
  }

  function getAssistantHtml(rootId: string): string | undefined {
    return assistantHtmlCache.get(rootId);
  }

  function getDeferredTransitionKey(root: MessageInfo): string {
    return deferredKeyCache.get(root.id) ?? options.getThreadTransitionKey(root);
  }

  watchEffect(() => {
    const theme = options.theme.value;
    for (const root of options.visibleRoots.value) {
      if (!options.hasAssistantMessages(root)) continue;
      const final = options.getFinalAnswer(root);
      const answerId = final?.id ?? root.id;
      const content = options.getFinalAnswerContent(root);

      const last = lastSubmitted.get(root.id);
      if (last && last.answerId === answerId && last.content === content && last.theme === theme) {
        // Notify that cached HTML is already available so initial render
        // tracking can resolve the assistant key (prevents stuck spinner
        // when the same session is reloaded by FORK / REVERT / UNDO).
        if (assistantHtmlCache.has(root.id)) {
          options.onRendered(options.getThreadAssistantRenderKeyById(root.id, answerId));
        }
        continue;
      }
      lastSubmitted.set(root.id, {
        answerId,
        content,
        theme,
      });
      enqueueAssistantRender(root.id, answerId, content);
    }
  });

  onBeforeUnmount(() => {
    for (const timer of trailingTimers.values()) clearTimeout(timer);
    trailingTimers.clear();
    pendingByRoot.clear();
  });

  return {
    getAssistantHtml,
    getDeferredTransitionKey,
  };
}
