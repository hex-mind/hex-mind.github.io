import type { ProjectState } from '../types/worker-state';

export function formatSessionGraphDump(projects: Record<string, ProjectState>): string {
  const lines: string[] = [];

  const allProjects = Object.values(projects).sort((a, b) =>
    a.worktree === b.worktree ? a.id.localeCompare(b.id) : a.worktree.localeCompare(b.worktree),
  );
  const totalSessions = allProjects.reduce((count, project) => {
    return (
      count +
      Object.values(project.sandboxes).reduce((projectCount, sandbox) => {
        return projectCount + Object.keys(sandbox.sessions).length;
      }, 0)
    );
  }, 0);

  lines.push('Project Tree (worker-state)');
  lines.push(`  projects: ${allProjects.length}  sessions(total): ${totalSessions}`);
  lines.push('');

  function fmtTime(ts?: number) {
    if (!ts) return '-';
    return new Date(ts).toLocaleString();
  }

  function fmtStatus(s: string) {
    if (s === 'busy') return '[BUSY]';
    if (s === 'retry') return '[RETRY]';
    if (s === 'idle') return '[idle]';
    return `[${s}]`;
  }

  for (const project of allProjects) {
    lines.push(`PROJECT ${project.id}`);
    lines.push(`  worktree: ${project.worktree || '-'}`);
    if (project.name) lines.push(`  name: ${project.name}`);
    if (project.icon?.color) lines.push(`  color: ${project.icon.color}`);
    lines.push(
      `  time: created=${fmtTime(project.time?.created)} updated=${fmtTime(project.time?.updated)} initialized=${fmtTime(project.time?.initialized)}`,
    );

    const sandboxEntries = Object.entries(project.sandboxes).sort(([a], [b]) => a.localeCompare(b));
    if (sandboxEntries.length === 0) {
      lines.push('  (no sandboxes)');
      lines.push('');
      continue;
    }

    for (let si = 0; si < sandboxEntries.length; si++) {
      const [sandboxDirectory, sandbox] = sandboxEntries[si];
      const isLastSandbox = si === sandboxEntries.length - 1;
      const sConnector = isLastSandbox ? '└── ' : '├── ';
      const sPrefix = isLastSandbox ? '    ' : '│   ';

      const branchMeta = sandbox.name ? `  (branch: ${sandbox.name})` : '';
      lines.push(`${sConnector}SANDBOX ${sandboxDirectory}${branchMeta}`);
      lines.push(`${sPrefix}rootSessions: [${sandbox.rootSessions.join(', ')}]`);

      const sessions = Object.values(sandbox.sessions).sort((a, b) => {
        const aTime = a.timeUpdated ?? a.timeCreated ?? 0;
        const bTime = b.timeUpdated ?? b.timeCreated ?? 0;
        return bTime - aTime;
      });

      if (sessions.length === 0) {
        lines.push(`${sPrefix}(no sessions)`);
        continue;
      }

      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        const isLastSession = i === sessions.length - 1;
        const sessionConnector = isLastSession ? '└── ' : '├── ';
        const sessionPrefix = `${sPrefix}${isLastSession ? '    ' : '│   '}`;
        const status = fmtStatus(session.status ?? 'unknown');
        const title = session.title ? `  "${session.title}"` : '';
        const slug = session.slug ? `  slug=${session.slug}` : '';
        lines.push(`${sPrefix}${sessionConnector}${session.id}  ${status}${title}${slug}`);
        const revertLabel = session.revert
          ? `msg=${session.revert.messageID}${session.revert.partID ? ` part=${session.revert.partID}` : ''}`
          : '-';
        lines.push(
          `${sessionPrefix}dir=${session.directory || sandboxDirectory}  parent=${session.parentID || '(root)'}  archived=${fmtTime(session.timeArchived)}  revert=${revertLabel}`,
        );
        lines.push(
          `${sessionPrefix}created=${fmtTime(session.timeCreated)}  updated=${fmtTime(session.timeUpdated)}`,
        );
      }
    }

    lines.push('');
  }

  return lines.join('\n');
}
