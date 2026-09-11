import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue';
import { StorageKeys, storageGet, storageKey, storageSetJSON } from '../utils/storageKeys';

export type Attachment = {
  id: string;
  filename: string;
  mime: string;
  dataUrl: string;
};

export type ComposerDraft = {
  messageInput: string;
  attachments: Attachment[];
  agent: string;
  model: string;
  variant?: string;
  updatedAt: number;
  rev: number;
  writerTabId: string;
};

type AgentOption = { id: string };
type ModelOption = { id: string };

export type UseComposerDraftsOptions = {
  messageInput: Ref<string>;
  attachments: Ref<Attachment[]>;
  selectedMode: Ref<string>;
  selectedModel: Ref<string>;
  selectedThinking: Ref<string | undefined>;
  selectedSessionId: Ref<string>;
  workingDirectory: Ref<string>;
  agentOptions: Ref<AgentOption[]>;
  modelOptions: Ref<ModelOption[]>;
  applyAgentDefaults: (agentName: string) => void;
  applyModelVariantSelection: (model: string | undefined, variant: string | undefined) => void;
  resolveDefaultAgentModel: () => { agent: string; model: string; variant: string | undefined };
};

export function composerDraftKey(sessionId: string, directory: string) {
  const id = sessionId.trim();
  if (id) return id;
  const dir = directory.trim();
  return dir ? `new:${dir}` : '';
}

function normalizeStoredAttachment(value: unknown): Attachment | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === 'string' ? record.id.trim() : '';
  const filename = typeof record.filename === 'string' ? record.filename.trim() : '';
  const mime = typeof record.mime === 'string' ? record.mime.trim() : '';
  const dataUrl = typeof record.dataUrl === 'string' ? record.dataUrl : '';
  if (!id || !filename || !mime || !dataUrl) return null;
  return { id, filename, mime, dataUrl };
}

function normalizeStoredComposerDraft(value: unknown): ComposerDraft | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const messageInput = typeof record.messageInput === 'string' ? record.messageInput : '';
  const attachments = Array.isArray(record.attachments)
    ? record.attachments
        .map((item) => normalizeStoredAttachment(item))
        .filter((item): item is Attachment => Boolean(item))
    : [];
  const agent = typeof record.agent === 'string' ? record.agent : '';
  const model = typeof record.model === 'string' ? record.model : '';
  const variant = typeof record.variant === 'string' ? record.variant : undefined;
  const updatedAt = typeof record.updatedAt === 'number' ? record.updatedAt : Date.now();
  const rev = typeof record.rev === 'number' ? record.rev : updatedAt;
  const writerTabId = typeof record.writerTabId === 'string' ? record.writerTabId : '';
  return {
    messageInput,
    attachments,
    agent,
    model,
    variant,
    updatedAt,
    rev,
    writerTabId,
  };
}

function parseComposerDraftStore(raw: string | null) {
  if (!raw) return {} as Record<string, ComposerDraft>;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return {} as Record<string, ComposerDraft>;
    const normalized: Record<string, ComposerDraft> = {};
    Object.entries(parsed).forEach(([key, value]) => {
      const draft = normalizeStoredComposerDraft(value);
      if (!draft) return;
      normalized[key] = draft;
    });
    return normalized;
  } catch {
    return {} as Record<string, ComposerDraft>;
  }
}

export function useComposerDrafts(options: UseComposerDraftsOptions) {
  const {
    messageInput,
    attachments,
    selectedMode,
    selectedModel,
    selectedThinking,
    selectedSessionId,
    workingDirectory,
    agentOptions,
    modelOptions,
    applyAgentDefaults,
    applyModelVariantSelection,
    resolveDefaultAgentModel,
  } = options;

  const composerDraftRevisionByContext = new Map<string, number>();
  let lastDraftKey = '';
  const writerTabId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `tab-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  function draftKeyForSelectedContext() {
    return composerDraftKey(selectedSessionId.value, workingDirectory.value);
  }

  function welcomeDraftKey() {
    return composerDraftKey('', workingDirectory.value);
  }

  function readComposerDraftStore() {
    return parseComposerDraftStore(storageGet(StorageKeys.drafts.composer));
  }

  function writeComposerDraftStore(store: Record<string, ComposerDraft>) {
    storageSetJSON(StorageKeys.drafts.composer, store);
  }

  function readComposerDraft(contextKey: string) {
    if (!contextKey) return null;
    return readComposerDraftStore()[contextKey] ?? null;
  }

  function nextComposerDraftRevision(contextKey: string, existingDraft?: ComposerDraft | null) {
    const storeRev = existingDraft?.rev ?? 0;
    const knownRev = composerDraftRevisionByContext.get(contextKey) ?? 0;
    const nextRev = Math.max(storeRev, knownRev) + 1;
    composerDraftRevisionByContext.set(contextKey, nextRev);
    return nextRev;
  }

  function writeComposerDraft(contextKey: string, draft: ComposerDraft) {
    if (!contextKey) return;
    const store = readComposerDraftStore();
    store[contextKey] = draft;
    lastDraftKey = contextKey;
    composerDraftRevisionByContext.set(contextKey, draft.rev);
    writeComposerDraftStore(store);
  }

  function discardComposerDraft(contextKey: string) {
    if (!contextKey) return;
    const store = readComposerDraftStore();
    if (!(contextKey in store)) return;
    delete store[contextKey];
    composerDraftRevisionByContext.delete(contextKey);
    if (lastDraftKey === contextKey) lastDraftKey = '';
    writeComposerDraftStore(store);
  }

  function clearComposerInputState() {
    messageInput.value = '';
    attachments.value = [];
  }

  function applyComposerDraftToComposerState(draft: ComposerDraft, contextKey: string) {
    lastDraftKey = contextKey;
    composerDraftRevisionByContext.set(contextKey, draft.rev);
    messageInput.value = draft.messageInput;
    attachments.value = draft.attachments.slice();

    if (agentOptions.value.length === 0 || modelOptions.value.length === 0) {
      if (draft.agent) selectedMode.value = draft.agent;
      if (draft.model) selectedModel.value = draft.model;
      selectedThinking.value = draft.variant;
      return;
    }

    let agentToApply = draft.agent;
    if (draft.agent && !agentOptions.value.some((option) => option.id === draft.agent)) {
      agentToApply = resolveDefaultAgentModel().agent;
    } else if (draft.agent) {
      agentToApply = draft.agent;
      selectedMode.value = agentToApply;
    }

    if (agentToApply) {
      selectedMode.value = agentToApply;
      applyAgentDefaults(agentToApply);
    }

    const modelToApply =
      draft.model && modelOptions.value.some((model) => model.id === draft.model)
        ? draft.model
        : undefined;
    applyModelVariantSelection(modelToApply, draft.variant);
  }

  function restoreComposerDraftForContext(contextKey: string): boolean {
    if (!contextKey) return false;
    const draft = readComposerDraft(contextKey);
    if (!draft) return false;
    applyComposerDraftToComposerState(draft, contextKey);
    return true;
  }

  function persistComposerDraftForContext(contextKey: string) {
    if (!contextKey) return;
    const existingDraft = readComposerDraft(contextKey);
    const rev = nextComposerDraftRevision(contextKey, existingDraft);
    writeComposerDraft(contextKey, {
      messageInput: messageInput.value,
      attachments: attachments.value.map((item) => ({
        id: item.id,
        filename: item.filename,
        mime: item.mime,
        dataUrl: item.dataUrl,
      })),
      agent: selectedMode.value,
      model: selectedModel.value,
      variant: selectedThinking.value,
      updatedAt: Date.now(),
      rev,
      writerTabId,
    });
  }

  function persistComposerDraftForCurrentContext() {
    persistComposerDraftForContext(draftKeyForSelectedContext());
  }

  function persistComposerDraftForOutgoingContext(previousSessionId: string) {
    persistComposerDraftForContext(previousSessionId.trim() || lastDraftKey);
  }

  function restoreComposerDraftForCurrentContext() {
    return restoreComposerDraftForContext(draftKeyForSelectedContext());
  }

  function clearComposerDraftForCurrentContext() {
    messageInput.value = '';
    attachments.value = [];
    persistComposerDraftForCurrentContext();
  }

  function discardWelcomeComposerDraft() {
    discardComposerDraft(welcomeDraftKey());
  }

  function clearComposerDraftAfterSend(fromWelcome: boolean) {
    clearComposerDraftForCurrentContext();
    if (fromWelcome) discardWelcomeComposerDraft();
  }

  watch(workingDirectory, (_directory, previousDirectory) => {
    if (selectedSessionId.value.trim()) return;
    persistComposerDraftForContext(composerDraftKey('', previousDirectory ?? ''));
    if (!restoreComposerDraftForCurrentContext()) clearComposerInputState();
  });

  function handleComposerDraftStorage(event: StorageEvent) {
    if (event.storageArea !== window.localStorage) return;
    if (event.key !== storageKey(StorageKeys.drafts.composer)) return;
    const contextKey = draftKeyForSelectedContext();
    if (!contextKey) return;
    const store = parseComposerDraftStore(event.newValue);
    const draft = store[contextKey] ?? null;
    const knownRev = composerDraftRevisionByContext.get(contextKey) ?? 0;
    if (!draft) {
      composerDraftRevisionByContext.delete(contextKey);
      clearComposerInputState();
      return;
    }
    if (draft.rev < knownRev) return;
    applyComposerDraftToComposerState(draft, contextKey);
  }

  onMounted(() => {
    window.addEventListener('storage', handleComposerDraftStorage);
  });
  onBeforeUnmount(() => {
    window.removeEventListener('storage', handleComposerDraftStorage);
  });

  return {
    clearComposerInputState,
    persistComposerDraftForCurrentContext,
    persistComposerDraftForOutgoingContext,
    restoreComposerDraftForCurrentContext,
    clearComposerDraftAfterSend,
  };
}
