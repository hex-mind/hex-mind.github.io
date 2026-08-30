export type ConfirmRequest = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmFn = (request: ConfirmRequest) => Promise<boolean>;

let confirmImpl: ConfirmFn | null = null;

export function registerConfirmDialog(fn: ConfirmFn | null) {
  confirmImpl = fn;
}

export function confirmAction(request: ConfirmRequest): Promise<boolean> {
  if (confirmImpl) return confirmImpl(request);
  if (typeof window === 'undefined') return Promise.resolve(false);
  const text = request.message ? `${request.title}\n\n${request.message}` : request.title;
  return Promise.resolve(window.confirm(text));
}
