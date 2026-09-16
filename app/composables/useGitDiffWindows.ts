import type { Ref } from 'vue';
import DiffViewer from '../components/viewers/DiffViewer.vue';
import { guessLanguageFromPath } from '../components/ToolWindow/utils';
import type { MessageDiffEntry } from '../types/message';
import type { WorktreeSnapshotMode } from '../utils/gitSnapshots';
import { GIT_COMMON_ARGS, gitNullDevice } from '../utils/gitStatus';
import { fileViewerWindowChrome } from '../utils/fileViewerWindow';
import type { useFloatingWindows } from './useFloatingWindows';

type Fw = ReturnType<typeof useFloatingWindows>;

type UseGitDiffWindowsOptions = {
  fw: Fw;
  workingDirectory: Ref<string>;
  runOneShotPtyCommand: (command: string, args: string[]) => Promise<string>;
  shikiTheme: Ref<string>;
  getFileViewerPosition: (factorX?: number, factorY?: number) => { x: number; y: number };
};

function isUsefulDiff(output: string) {
  return /^(diff |index |@@ |--- |\+\+\+ )/m.test(output);
}

export function useGitDiffWindows(options: UseGitDiffWindowsOptions) {
  const { fw, workingDirectory, runOneShotPtyCommand, shikiTheme, getFileViewerPosition } = options;

  function runGit(args: string[]) {
    return runOneShotPtyCommand('git', [...GIT_COMMON_ARGS, ...args]);
  }

  async function openSnapshotDiff(
    key: string,
    content: string,
    title: string,
    run: () => Promise<string>,
  ) {
    if (fw.has(key)) {
      fw.bringToFront(key);
      return null;
    }
    const pos = getFileViewerPosition();
    await fw.open(key, {
      content,
      lang: 'text',
      variant: 'plain',
      title,
      ...fileViewerWindowChrome(pos),
    });
    try {
      const output = await run();
      if (!fw.has(key)) return null;
      return { output, pos };
    } catch {
      if (fw.has(key)) await fw.close(key);
      return null;
    }
  }

  async function openPatchDiff(key: string, title: string, loading: string, run: () => Promise<string>) {
    const loaded = await openSnapshotDiff(key, loading, title, run);
    if (!loaded) return;
    if (!isUsefulDiff(loaded.output)) {
      await fw.close(key);
      return;
    }
    await fw.open(key, {
      component: DiffViewer,
      props: {
        path: title,
        isDiff: true,
        diffPatch: loaded.output,
        gutterMode: 'none',
        lang: 'diff',
        theme: shikiTheme.value,
      },
      title,
      ...fileViewerWindowChrome(loaded.pos),
    });
  }

  async function openGitDiff(payload: { path: string; staged: boolean }) {
    const { path, staged } = payload;
    const key = `git-diff:${staged ? 'staged' : 'changes'}:${path}`;
    const mode = staged ? 'staged' : 'unstaged';
    await openPatchDiff(key, `${path} (${mode})`, `Loading ${mode} diff for ${path}...`, async () => {
      const trackedArgs = staged ? ['diff', '--cached', '--', path] : ['diff', '--', path];
      const tracked = await runGit(trackedArgs);
      if (isUsefulDiff(tracked) || staged) return tracked;
      const empty = gitNullDevice(workingDirectory.value);
      return runGit(['diff', '--no-index', '--', empty, path]);
    });
  }

  async function openAllGitDiff(mode: WorktreeSnapshotMode = 'all') {
    const key = `git-diff:${mode}`;
    const title =
      mode === 'staged'
        ? 'Staged changes'
        : mode === 'changes'
          ? 'Unstaged changes'
          : 'Working tree (staged + changes)';
    const args =
      mode === 'staged' ? ['diff', '--cached'] : mode === 'changes' ? ['diff'] : ['diff', 'HEAD'];
    await openPatchDiff(key, title, 'Loading all changes...', () => runGit(args));
  }

  function handleShowMessageDiff(payload: { messageKey: string; diffs: Array<MessageDiffEntry> }) {
    const { messageKey, diffs } = payload;
    if (!diffs || diffs.length === 0) return;
    const key = `message-diff:${messageKey}`;
    if (fw.has(key)) {
      fw.bringToFront(key);
      return;
    }
    const hasBeforeAfter = diffs.some(
      (d) => typeof d.before === 'string' && typeof d.after === 'string',
    );
    const combinedDiff = hasBeforeAfter ? '' : diffs.map((d) => d.diff).filter(Boolean).join('\n');
    if (!hasBeforeAfter && !combinedDiff) return;
    const fileCount = diffs.length;
    const title = fileCount === 1 ? diffs[0].file : `${fileCount} files changed`;
    const firstFile = diffs[0]?.file ?? '';
    let diffTabs: Array<{ file: string; before: string; after: string }> | undefined;
    if (hasBeforeAfter && fileCount > 1) {
      diffTabs = diffs
        .filter((d) => typeof d.before === 'string' && typeof d.after === 'string')
        .map((d) => ({
          file: d.file,
          before: d.before!,
          after: d.after!,
        }));
    }
    const pos = getFileViewerPosition();
    fw.open(key, {
      component: DiffViewer,
      props: {
        path: firstFile,
        isDiff: true,
        diffCode: hasBeforeAfter ? (diffs[0]?.before ?? '') : '',
        diffAfter: hasBeforeAfter ? (diffs[0]?.after ?? '') : undefined,
        diffPatch: hasBeforeAfter ? undefined : combinedDiff,
        diffTabs,
        gutterMode: 'double',
        lang: fileCount === 1 ? guessLanguageFromPath(firstFile) : 'text',
        theme: shikiTheme.value,
      },
      title,
      ...fileViewerWindowChrome(pos),
    });
  }

  async function handleShowCommit(hashRaw: string) {
    const hash = hashRaw.trim();
    if (!/^[0-9a-f]{7,40}$/i.test(hash)) return;
    const key = `commit-diff:${hash}`;
    const loaded = await openSnapshotDiff(
      key,
      `Loading commit ${hash}...`,
      `commit ${hash}`,
      async () => {
        const [title, patch] = await Promise.all([
          runGit(['log', '--format=%h %s', '-1', hash]),
          runGit(['show', '--format=', '--patch', hash]),
        ]);
        return `${title.trim().split('\n')[0] ?? ''}\n${patch}`;
      },
    );
    if (!loaded) return;
    const newline = loaded.output.indexOf('\n');
    const heading = (newline >= 0 ? loaded.output.slice(0, newline) : loaded.output).trim();
    const patch = newline >= 0 ? loaded.output.slice(newline + 1) : '';
    if (!isUsefulDiff(patch)) {
      await fw.close(key);
      return;
    }
    await fw.open(key, {
      component: DiffViewer,
      props: {
        path: heading || hash,
        isDiff: true,
        diffPatch: patch,
        gutterMode: 'none',
        lang: 'diff',
        theme: shikiTheme.value,
      },
      title: heading || `commit ${hash}`,
      ...fileViewerWindowChrome(loaded.pos),
    });
  }

  return {
    openGitDiff,
    openAllGitDiff,
    handleShowMessageDiff,
    handleShowCommit,
  };
}
