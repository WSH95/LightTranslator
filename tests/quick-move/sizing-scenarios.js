// Assert rendered line geometry, rather than only the requested window size.
export async function runSizing(qa) {
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const checks = [];
  const screenshotText = '你好啊' + '哈'.repeat(24);
  const longText = 'A long translation with 中文 and emoji 🙂. '.repeat(150) + '\nFINAL LINE: goodbye.';
  let invocation = 0;
  const scroller = () => document.querySelector('.overflow-y-auto');
  const geometry = () => {
    const scroll = scroller();
    const text = document.querySelector('.translation-text');
    const range = document.createRange();
    range.selectNodeContents(text);
    const last = [...range.getClientRects()].filter(rect => rect.width > 0).at(-1);
    return {
      viewport: [innerWidth, innerHeight],
      requested: qa.calls.dimensions.at(-1),
      clientHeight: scroll.clientHeight,
      scrollHeight: scroll.scrollHeight,
      gutter: scroll.offsetWidth - scroll.clientWidth,
      bottom: scroll.getBoundingClientRect().bottom,
      lastLineBottom: last?.bottom,
      footerTop: scroll.nextElementSibling?.getBoundingClientRect().top,
    };
  };
  const check = (name, pass) => {
    checks.push({ name, pass: Boolean(pass) });
    if (!pass) throw new Error(JSON.stringify({ checks, geometry: geometry() }));
  };
  const until = async predicate => {
    for (let i = 0; i < 60; i++) {
      if (predicate()) return;
      await pause(25);
    }
    throw new Error('Timed out waiting for the sizing fixture');
  };
  const settle = async () => {
    await document.fonts.ready;
    let previous;
    let stable = 0;
    for (let i = 0; i < 40; i++) {
      await pause(25);
      const next = JSON.stringify(geometry());
      stable = next === previous ? stable + 1 : 0;
      previous = next;
      if (stable === 4) return;
    }
    throw new Error('Popup geometry did not settle');
  };
  const shortFits = () => {
    const actual = geometry();
    return actual.scrollHeight <= actual.clientHeight + 1
      && actual.lastLineBottom <= actual.bottom + 0.5
      && actual.bottom <= actual.footerTop + 0.5;
  };
  const translate = async (text, paintLoading = false) => {
    qa.response(text);
    if (paintLoading) qa.hold(true);
    qa.text(`Sizing invocation ${++invocation}`);
    if (paintLoading) {
      await until(() => document.body.textContent.includes('Translating…'));
      await pause(100);
      qa.hold(false);
    }
    await until(() => document.querySelector('.translation-text')?.textContent === text);
    await settle();
  };

  await until(() => qa.calls.ready.length > 0);
  document.documentElement.dataset.textSize = 'medium';
  qa.store.setState({ translationTextSize: 'medium', quickWindowMaxWidth: 480 });
  await translate(screenshotText, true);
  check('first screenshot-text result fits without clipping or scrolling', shortFits());

  const beforeSizeChanges = qa.calls.translations;
  for (const size of ['small', 'medium', 'large']) {
    document.documentElement.dataset.textSize = size;
    qa.store.setState({ translationTextSize: size });
    await settle();
    check(`existing result remains fully visible with ${size} text`, shortFits());
  }
  check('text-size layout changes add no translation requests', qa.calls.translations === beforeSizeChanges);

  for (const size of ['small', 'medium', 'large']) {
    document.documentElement.dataset.textSize = size;
    qa.store.setState({ translationTextSize: size });
    for (const width of [300, 480, 600]) {
      qa.store.setState({ quickWindowMaxWidth: width });
      await translate(screenshotText, true);
      check(`short ${size} result fits at width cap ${width}`, shortFits() && innerWidth <= width);
      await translate(longText);
      check(`long ${size} result scrolls at width cap ${width}`, innerHeight === 500
        && scroller().scrollHeight > scroller().clientHeight
        && getComputedStyle(scroller()).overflowY === 'auto');
      scroller().scrollTop = scroller().scrollHeight;
      await pause(25);
      const actual = geometry();
      check(`last ${size} line is visible at the bottom, width cap ${width}`,
        actual.lastLineBottom <= actual.bottom + 0.5 && actual.bottom <= actual.footerTop + 0.5);
      await translate(screenshotText);
      check(`long-to-short ${size} result shrinks without clipping, width cap ${width}`,
        shortFits() && innerHeight < 500 && innerWidth <= width);
    }
  }

  document.documentElement.dataset.textSize = 'medium';
  qa.store.setState({ translationTextSize: 'medium', quickWindowMaxWidth: 480 });
  await translate('第一行：Good morning，我的朋友。\n第二行：🙂 emoji and 中文。\n最后一行：Goodbye, happy friend.');
  check('explicit newlines, mixed scripts and emoji remain fully visible', shortFits());
  const translated = qa.calls.translations;
  await settle();
  check('settled layout adds no translation requests', qa.calls.translations === translated);
  qa.response('早上好，我的朋友。');
  return checks;
}
