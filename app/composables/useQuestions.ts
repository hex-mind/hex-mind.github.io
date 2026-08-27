import { ref } from 'vue';
import type { ComputedRef, Ref } from 'vue';
import QuestionContent from '../components/ToolWindow/Question.vue';
import * as opencodeApi from '../utils/opencode';
import type { useFloatingWindows } from './useFloatingWindows';

export type QuestionOption = {
  label: string;
  description: string;
};

export type QuestionInfo = {
  question: string;
  header: string;
  options: QuestionOption[];
  multiple?: boolean;
  custom?: boolean;
};

export type QuestionRequest = {
  id: string;
  sessionID: string;
  questions: QuestionInfo[];
  tool?: {
    messageID: string;
    callID: string;
  };
};

export type QuestionAnswer = string[];

const QUESTION_WINDOW_WIDTH = 760;
const QUESTION_WINDOW_HEIGHT = 560;

export function useQuestions(options: {
  fw: ReturnType<typeof useFloatingWindows>;
  allowedSessionIds: ComputedRef<Set<string>>;
  activeDirectory: Ref<string>;
  ensureConnectionReady: (action: string) => boolean;
  getTextContent: (messageId: string) => string;
}) {
  const questionSendingById = ref<Record<string, boolean>>({});
  const questionErrorById = ref<Record<string, string>>({});

  function parseQuestionRequest(
    value: unknown,
    fallbackSessionId?: string,
  ): QuestionRequest | null {
    if (!value || typeof value !== 'object') return null;
    const record = value as Record<string, unknown>;
    const id =
      (typeof record.id === 'string' && record.id) ||
      (typeof record.questionID === 'string' && record.questionID) ||
      (typeof record.requestID === 'string' && record.requestID)
        ? String(record.id ?? record.questionID ?? record.requestID)
        : undefined;
    const sessionID =
      (typeof record.sessionID === 'string' && record.sessionID) ||
      (typeof record.sessionId === 'string' && record.sessionId) ||
      (typeof record.session_id === 'string' && record.session_id) ||
      fallbackSessionId;
    const questionsRaw = Array.isArray(record.questions)
      ? record.questions
      : Array.isArray(record.items)
        ? record.items
        : [];
    const questions: QuestionInfo[] = [];
    questionsRaw.forEach((item) => {
      if (!item || typeof item !== 'object') return;
      const info = item as Record<string, unknown>;
      const question = typeof info.question === 'string' ? info.question.trim() : '';
      const header = typeof info.header === 'string' ? info.header.trim() : '';
      const optionsRaw = Array.isArray(info.options) ? info.options : [];
      const optionsList: QuestionOption[] = [];
      optionsRaw.forEach((option) => {
        if (!option || typeof option !== 'object') return;
        const optionInfo = option as Record<string, unknown>;
        const label = typeof optionInfo.label === 'string' ? optionInfo.label.trim() : '';
        const description =
          typeof optionInfo.description === 'string' ? optionInfo.description.trim() : '';
        if (!label || !description) return;
        optionsList.push({ label, description });
      });
      if (!question || !header || optionsList.length === 0) return;
      questions.push({
        question,
        header,
        options: optionsList,
        multiple: info.multiple === true,
        custom: info.custom !== false,
      });
    });
    const toolRaw =
      record.tool && typeof record.tool === 'object'
        ? (record.tool as Record<string, unknown>)
        : null;
    const toolMessageId =
      (typeof record.messageID === 'string' && record.messageID) ||
      (toolRaw && typeof toolRaw.messageID === 'string' ? toolRaw.messageID : undefined);
    const toolCallId =
      (typeof record.callID === 'string' && record.callID) ||
      (typeof record.callId === 'string' && record.callId) ||
      (toolRaw && typeof toolRaw.callID === 'string' ? toolRaw.callID : undefined);
    if (!id || !sessionID || questions.length === 0) return null;
    const tool =
      toolMessageId && toolCallId ? { messageID: toolMessageId, callID: toolCallId } : undefined;
    return {
      id,
      sessionID,
      questions,
      tool,
    };
  }

  function getQuestionContextText(request: QuestionRequest): string {
    if (!request.tool?.messageID) return '';
    return options.getTextContent(request.tool.messageID) || '';
  }

  function upsertQuestionEntry(request: QuestionRequest): void {
    const key = `question:${request.id}`;
    options.fw.open(key, {
      component: QuestionContent,
      props: {
        request,
        contextText: getQuestionContextText(request),
        isSubmitting: isQuestionSubmitting(request.id),
        error: getQuestionError(request.id),
        onReply: handleQuestionReply,
        onReject: handleQuestionReject,
      },
      closable: false,
      resizable: true,
      scroll: 'follow',
      color: '#34d399',
      title: `Question: ${request.questions?.[0]?.header || 'request'}`,
      width: QUESTION_WINDOW_WIDTH,
      height: QUESTION_WINDOW_HEIGHT,
      expiry: Infinity,
    });
  }

  function refreshQuestionWindow(requestId: string): void {
    const key = `question:${requestId}`;
    const entry = options.fw.get(key);
    if (!entry) return;
    const request = entry.props?.request as QuestionRequest | undefined;
    options.fw.updateOptions(key, {
      props: {
        ...entry.props,
        contextText: request ? getQuestionContextText(request) : '',
        isSubmitting: isQuestionSubmitting(requestId),
        error: getQuestionError(requestId),
      },
    });
  }

  function removeQuestionEntry(requestId: string): void {
    options.fw.close(`question:${requestId}`);
    clearQuestionSending(requestId);
    clearQuestionError(requestId);
  }

  function setQuestionSending(requestId: string, value: boolean): void {
    const next = { ...questionSendingById.value };
    if (value) next[requestId] = true;
    else delete next[requestId];
    questionSendingById.value = next;
  }

  function clearQuestionSending(requestId: string): void {
    setQuestionSending(requestId, false);
  }

  function setQuestionError(requestId: string, message: string): void {
    const next = { ...questionErrorById.value };
    if (message) next[requestId] = message;
    else delete next[requestId];
    questionErrorById.value = next;
  }

  function clearQuestionError(requestId: string): void {
    setQuestionError(requestId, '');
  }

  function isQuestionSubmitting(requestId: string): boolean {
    return Boolean(questionSendingById.value[requestId]);
  }

  function getQuestionError(requestId: string): string {
    return questionErrorById.value[requestId] ?? '';
  }

  function isQuestionSessionAllowed(request: QuestionRequest): boolean {
    const allowed = options.allowedSessionIds.value;
    if (!request.sessionID) return false;
    if (allowed.size === 0) return false;
    return allowed.has(request.sessionID);
  }

  function pruneQuestionEntries(): void {
    const allowed = options.allowedSessionIds.value;
    for (const entry of options.fw.entries.value) {
      if (!entry.key.startsWith('question:')) continue;
      const request = entry.props?.request as QuestionRequest | undefined;
      if (!request) continue;
      if (!allowed.has(request.sessionID)) {
        removeQuestionEntry(request.id);
      }
    }
  }

  function normalizeQuestionAnswers(answers: QuestionAnswer[]): QuestionAnswer[] {
    return answers.map((answer) => {
      if (!Array.isArray(answer)) return [];
      const cleaned = answer
        .map((value) => (typeof value === 'string' ? value.trim() : ''))
        .filter((value) => value.length > 0);
      return Array.from(new Set(cleaned));
    });
  }

  async function sendQuestionReply(requestId: string, answers: QuestionAnswer[]): Promise<void> {
    if (!options.ensureConnectionReady('Question reply')) return;
    const directory = options.activeDirectory.value.trim();
    await opencodeApi.replyQuestion(requestId, {
      directory: directory || undefined,
      answers: normalizeQuestionAnswers(answers),
    });
  }

  async function sendQuestionReject(requestId: string): Promise<void> {
    if (!options.ensureConnectionReady('Question reject')) return;
    const directory = options.activeDirectory.value.trim();
    await opencodeApi.rejectQuestion(requestId, directory || undefined);
  }

  async function handleQuestionReply(payload: {
    requestId: string;
    answers: QuestionAnswer[];
  }): Promise<void> {
    if (!options.ensureConnectionReady('Question reply')) return;
    const { requestId, answers } = payload;
    if (isQuestionSubmitting(requestId)) return;
    clearQuestionError(requestId);
    setQuestionSending(requestId, true);
    refreshQuestionWindow(requestId);
    try {
      await sendQuestionReply(requestId, answers);
      removeQuestionEntry(requestId);
    } catch (error) {
      setQuestionError(requestId, toErrorMessage(error));
      refreshQuestionWindow(requestId);
    } finally {
      clearQuestionSending(requestId);
      refreshQuestionWindow(requestId);
    }
  }

  async function handleQuestionReject(requestId: string): Promise<void> {
    if (!options.ensureConnectionReady('Question reject')) return;
    if (isQuestionSubmitting(requestId)) return;
    clearQuestionError(requestId);
    setQuestionSending(requestId, true);
    refreshQuestionWindow(requestId);
    try {
      await sendQuestionReject(requestId);
      removeQuestionEntry(requestId);
    } catch (error) {
      setQuestionError(requestId, toErrorMessage(error));
      refreshQuestionWindow(requestId);
    } finally {
      clearQuestionSending(requestId);
      refreshQuestionWindow(requestId);
    }
  }

  async function fetchPendingQuestions(directory?: string): Promise<void> {
    try {
      const data = await opencodeApi.listPendingQuestions(directory);
      if (!Array.isArray(data)) return;
      data
        .map((entry) => parseQuestionRequest(entry))
        .filter((entry): entry is QuestionRequest => Boolean(entry))
        .filter((entry) => isQuestionSessionAllowed(entry))
        .forEach((entry) => {
          upsertQuestionEntry(entry);
        });
    } catch (error) {
      log('Question list failed', error);
    }
  }

  return {
    parseQuestionRequest,
    upsertQuestionEntry,
    removeQuestionEntry,
    pruneQuestionEntries,
    handleQuestionReply,
    handleQuestionReject,
    isQuestionSessionAllowed,
    fetchPendingQuestions,
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function log(..._args: unknown[]): void {}
