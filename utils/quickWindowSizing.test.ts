import assert from 'node:assert/strict';
import test from 'node:test';
import {
  QuickWindowResizeCoordinator,
  chooseQuickWindowDimensions,
  type QuickWindowDimensions,
} from './quickWindowSizing.ts';

test('uses measured toolbar width as the floor for short content', () => {
  assert.deepEqual(
    chooseQuickWindowDimensions({
      intrinsicContentWidth: 126.2,
      toolbarWidth: 214.1,
      headerHeight: 44,
      wrappedContentHeight: 28.2,
      footerHeight: 21,
      maximumWidth: 480,
    }),
    { width: 215, height: 94 },
  );
});

test('uses measured intrinsic width until the configured maximum', () => {
  const base = {
    toolbarWidth: 214,
    headerHeight: 44,
    wrappedContentHeight: 72,
    footerHeight: 21,
  };

  assert.deepEqual(
    chooseQuickWindowDimensions({ ...base, intrinsicContentWidth: 372.4, maximumWidth: 480 }),
    { width: 373, height: 137 },
  );
  assert.deepEqual(
    chooseQuickWindowDimensions({ ...base, intrinsicContentWidth: 900, maximumWidth: 480 }),
    { width: 480, height: 137 },
  );
});

test('honors both maximum-width endpoints and the height limits', () => {
  assert.deepEqual(
    chooseQuickWindowDimensions({
      intrinsicContentWidth: 900,
      toolbarWidth: 214,
      headerHeight: 44,
      wrappedContentHeight: 8,
      footerHeight: 0,
      maximumWidth: 300,
    }),
    { width: 300, height: 80 },
  );
  assert.deepEqual(
    chooseQuickWindowDimensions({
      intrinsicContentWidth: 900,
      toolbarWidth: 214,
      headerHeight: 44,
      wrappedContentHeight: 700,
      footerHeight: 21,
      maximumWidth: 600,
    }),
    { width: 600, height: 500 },
  );
});

test('reserves measured menu space and restores content sizing after close', () => {
  const content = {
    intrinsicContentWidth: 180,
    toolbarWidth: 155,
    headerHeight: 44,
    wrappedContentHeight: 40,
    footerHeight: 21,
    maximumWidth: 480,
  };

  assert.deepEqual(
    chooseQuickWindowDimensions({
      ...content,
      menuRequiredWidth: 235.2,
      menuRequiredHeight: 361.2,
    }),
    { width: 236, height: 362 },
  );
  assert.deepEqual(chooseQuickWindowDimensions(content), { width: 180, height: 105 });
});

test('a short result after a long result shrinks both dimensions', () => {
  const long = chooseQuickWindowDimensions({
    intrinsicContentWidth: 1200,
    toolbarWidth: 214,
    headerHeight: 44,
    wrappedContentHeight: 680,
    footerHeight: 21,
    maximumWidth: 480,
  });
  const short = chooseQuickWindowDimensions({
    intrinsicContentWidth: 142,
    toolbarWidth: 214,
    headerHeight: 44,
    wrappedContentHeight: 29,
    footerHeight: 21,
    maximumWidth: 480,
  });

  assert.ok(short.width < long.width);
  assert.ok(short.height < long.height);
  assert.deepEqual(short, { width: 214, height: 94 });
});

test('coalesces frames, serializes IPC, and applies only the latest pending size', async () => {
  let measured: QuickWindowDimensions = { width: 220, height: 90 };
  const frames: Array<() => void> = [];
  const calls: QuickWindowDimensions[] = [];
  const completions: Array<() => void> = [];
  const coordinator = new QuickWindowResizeCoordinator({
    measure: () => measured,
    resize: (dimensions) => {
      calls.push(dimensions);
      return new Promise<void>((resolve) => completions.push(resolve));
    },
    requestFrame: (callback) => {
      frames.push(callback);
      return frames.length;
    },
    cancelFrame: () => {},
  });

  coordinator.request();
  measured = { width: 260, height: 110 };
  coordinator.request();
  assert.equal(frames.length, 1, 'multiple invalidations share one frame');
  frames.shift()?.();
  assert.deepEqual(calls, [{ width: 260, height: 110 }]);

  measured = { width: 480, height: 300 };
  coordinator.request();
  measured = { width: 230, height: 92 };
  coordinator.request();
  assert.equal(calls.length, 1, 'a second resize never overlaps the first');

  completions.shift()?.();
  await Promise.resolve();
  assert.equal(frames.length, 1, 'completion queues one fresh measurement frame');
  frames.shift()?.();
  assert.deepEqual(calls, [
    { width: 260, height: 110 },
    { width: 230, height: 92 },
  ]);

  completions.shift()?.();
  await Promise.resolve();
  coordinator.request();
  frames.shift()?.();
  assert.equal(calls.length, 2, 'an unchanged dimension is not sent again');
  coordinator.dispose();
});

test('dispose cancels queued and post-IPC work', async () => {
  const frames = new Map<number, () => void>();
  const cancelled: number[] = [];
  let nextFrame = 0;
  let completeResize: (() => void) | undefined;
  let calls = 0;
  const coordinator = new QuickWindowResizeCoordinator({
    measure: () => ({ width: 240, height: 100 }),
    resize: () => {
      calls += 1;
      return new Promise<void>((resolve) => { completeResize = resolve; });
    },
    requestFrame: (callback) => {
      nextFrame += 1;
      frames.set(nextFrame, callback);
      return nextFrame;
    },
    cancelFrame: (handle) => {
      cancelled.push(handle);
      frames.delete(handle);
    },
  });

  coordinator.request();
  coordinator.dispose();
  assert.deepEqual(cancelled, [1]);
  assert.equal(calls, 0);

  const active = new QuickWindowResizeCoordinator({
    measure: () => ({ width: 240, height: 100 }),
    resize: () => {
      calls += 1;
      return new Promise<void>((resolve) => { completeResize = resolve; });
    },
    requestFrame: (callback) => {
      nextFrame += 1;
      frames.set(nextFrame, callback);
      return nextFrame;
    },
    cancelFrame: () => {},
  });
  active.request();
  frames.get(2)?.();
  active.request();
  active.dispose();
  completeResize?.();
  await Promise.resolve();
  assert.equal(calls, 1, 'disposing during IPC drops pending work');
});
