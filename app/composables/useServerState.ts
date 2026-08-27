import { reactive, ref } from 'vue';
import type { WorkerToTabMessage } from '../types/sse-worker';
import type { ProjectState, WorkerNotificationEntry } from '../types/worker-state';

type NotificationShowMessage = Extract<WorkerToTabMessage, { type: 'notification.show' }>;

export function useServerState() {
  const projects = reactive<Record<string, ProjectState>>({});
  const notifications = reactive<Record<string, WorkerNotificationEntry>>({});
  const bootstrapped = ref(false);

  let onNotificationShow: ((message: NotificationShowMessage) => void) | undefined;

  function replaceProjects(next: Record<string, ProjectState>) {
    Object.keys(projects).forEach((key) => {
      delete projects[key];
    });
    Object.assign(projects, next);
  }

  function replaceNotifications(next: Record<string, WorkerNotificationEntry>) {
    Object.keys(notifications).forEach((key) => {
      delete notifications[key];
    });
    Object.assign(notifications, next);
  }

  function handleStateMessage(message: WorkerToTabMessage): boolean {
    if (message.type === 'state.bootstrap') {
      replaceProjects(message.projects);
      replaceNotifications(message.notifications);
      bootstrapped.value = true;
      return true;
    }
    if (message.type === 'state.project-updated') {
      projects[message.projectId] = message.project;
      return true;
    }
    if (message.type === 'state.project-removed') {
      delete projects[message.projectId];
      return true;
    }
    if (message.type === 'state.notifications-updated') {
      replaceNotifications(message.notifications);
      return true;
    }
    if (message.type === 'notification.show') {
      onNotificationShow?.(message);
      return true;
    }
    return false;
  }

  function setNotificationShowHandler(handler?: (message: NotificationShowMessage) => void) {
    onNotificationShow = handler;
  }

  return {
    projects,
    notifications,
    bootstrapped,
    handleStateMessage,
    setNotificationShowHandler,
  };
}

export type UseServerState = ReturnType<typeof useServerState>;
