import type { Ref } from 'vue';
import DiffViewer from '../components/viewers/DiffViewer.vue';
import { guessLanguageFromPath } from '../components/ToolWindow/utils';
import type { MessageDiffEntry } from '../types/message';
import {
  COMMIT_SNAPSHOT_SCRIPT,
  FILE_SNAPSHOT_SCRIPT,
  buildWorktreeSnapshotScript,
  parseCommitSnapshotOutput,
  parseFileSnapshotOutput,
  type WorktreeSnapshotMode,
} from '../utils/gitSnapshots';
import { fileViewerWindowChrome } from '../utils/fileViewerWindow';
import type { useFloatingWindows } from './useFloatingWindows';

type Fw = ReturnType<typeof useFloatingWindows>;

type UseGitDiffWindowsOptions = {
  fw: Fw;
  runOneShotPtyCommand: (command: string, args: string[]) => Promise<string>;
  shikiTheme: Ref<string>;
  getFileViewerPosition: (factorX?: number, factorY?: number) => { x: number; y: number };
};

export function useGitDiffWindows(options: UseGitDiffWindowsOptions) {
  const { fw, runOneShotPtyCommand, shikiTheme, getFileViewerPosition } = options;

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

  async function openGitDiff(payload: { path: string; staged: boolean }) {
    const { path, staged } = payload;
    const key = `git-diff:${staged ? 'staged' : 'changes'}:${path}`;
    const mode = staged ? 'staged' : 'unstaged';
    const loaded = await openSnapshotDiff(
      key,
      `Loading ${mode} diff for ${path}...`,
      `${path} (${mode})`,
      () =>
        runOneShotPtyCommand('bash', [
          '--noprofile',
          '--norc',
          '-c',
          FILE_SNAPSHOT_SCRIPT,
          '_',
          mode,
          path,
        ]),
    );
    if (!loaded) return;
    const snapshot = parseFileSnapshotOutput(loaded.output);
    await fw.open(key, {
      component: DiffViewer,
      props: {
        path,
        isDiff: true,
        diffCode: snapshot.before,
        diffAfter: snapshot.after,
        diffCodeBase64: snapshot.beforeBase64,
        diffAfterBase64: snapshot.afterBase64,
        gutterMode: 'double',
        lang: guessLanguageFromPath(path),
        theme: shikiTheme.value,
      },
      title: `${path} (${mode})`,
      ...fileViewerWindowChrome(loaded.pos),
    });
  }

  async function openAllGitDiff(mode: WorktreeSnapshotMode = 'all') {
    const key = `git-diff:${mode}`;
    const loaded = await openSnapshotDiff(key, 'Loading all changes...', 'Loading...', () =>
      runOneShotPtyCommand('bash', [
        '--noprofile',
        '--norc',
        '-c',
        buildWorktreeSnapshotScript(mode),
      ]),
    );
    if (!loaded) return;
    const snapshot = parseCommitSnapshotOutput(loaded.output);
    if (snapshot.files.length === 0) {
      await fw.close(key);
      return;
    }
    const first = snapshot.files[0];
    const title =
      snapshot.files.length === 1 ? first.file : `${snapshot.files.length} files changed`;
    const diffTabs =
      snapshot.files.length > 1
        ? snapshot.files.map((entry) => ({
            file: entry.file,
            before: entry.before,
            after: entry.after,
            beforeBase64: entry.beforeBase64,
            afterBase64: entry.afterBase64,
          }))
        : undefined;
    await fw.open(key, {
      component: DiffViewer,
      props: {
        path: first.file,
        isDiff: true,
        diffCode: first.before,
        diffAfter: first.after,
        diffCodeBase64: first.beforeBase64,
        diffAfterBase64: first.afterBase64,
        diffTabs,
        gutterMode: 'double',
        lang: snapshot.files.length === 1 ? guessLanguageFromPath(first.file) : 'text',
        theme: shikiTheme.value,
      },
      title,
      ...fileViewerWindowChrome(loaded.pos),
    });
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
    const combinedDiff = hasBeforeAfter ? '' : diffs.map((d) => d.diff).join('\n');
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
        gutterMode: hasBeforeAfter ? 'double' : 'none',
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
    const loaded = await openSnapshotDiff(key, `Loading commit ${hash}...`, `commit ${hash}`, () =>
      runOneShotPtyCommand('bash', [
        '--noprofile',
        '--norc',
        '-c',
        COMMIT_SNAPSHOT_SCRIPT,
        '_',
        hash,
      ]),
    );
    if (!loaded) return;
    const snapshot = parseCommitSnapshotOutput(loaded.output);
    if (snapshot.files.length === 0) {
      await fw.close(key);
      return;
    }
    const first = snapshot.files[0];
    const title =
      snapshot.title ||
      (snapshot.files.length === 1 ? first.file : `${snapshot.files.length} files changed`);
    const diffTabs =
      snapshot.files.length > 1
        ? snapshot.files.map((entry) => ({
            file: entry.file,
            before: entry.before,
            after: entry.after,
            beforeBase64: entry.beforeBase64,
            afterBase64: entry.afterBase64,
          }))
        : undefined;
    await fw.open(key, {
      component: DiffViewer,
      props: {
        path: first.file,
        isDiff: true,
        diffCode: first.before,
        diffAfter: first.after,
        diffCodeBase64: first.beforeBase64,
        diffAfterBase64: first.afterBase64,
        diffTabs,
        gutterMode: 'double',
        lang: snapshot.files.length === 1 ? guessLanguageFromPath(first.file) : 'text',
        theme: shikiTheme.value,
      },
      title,
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
