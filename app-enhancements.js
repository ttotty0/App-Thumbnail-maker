// PWA enhancements for installed/mobile use.
// A browser/PWA cannot write directly to the Photos library. Use the native
// share sheet when supported so the user can choose "Save Image" there.
(() => {
  const header = document.querySelector('header');
  const title = header?.querySelector('h1');
  if (title) {
    title.parentElement?.querySelector('p')?.remove();
    title.parentElement?.nextElementSibling?.remove();
    const layout = title.closest('.max-w-6xl');
    layout?.classList.remove('sm:flex-row', 'justify-between');
    layout?.classList.add('justify-center');
  }

  function downloadFile(item) {
    const link = document.createElement('a');
    link.download = item.filename;
    link.href = item.dataUrl;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  document.addEventListener('click', async (event) => {
    const button = event.target instanceof Element
      ? event.target.closest('#thumbnailsContainer button')
      : null;
    if (!button) return;

    // Replace the page's ordinary download action with native image sharing.
    event.preventDefault();
    event.stopImmediatePropagation();
    const card = button.closest('#thumbnailsContainer > div');
    const index = card ? Array.from(card.parentElement.children).indexOf(card) : -1;
    const item = window.generatedThumbnails?.[index];
    if (!item) return;

    try {
      const encoded = item.dataUrl.split(',')[1];
      const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
      const file = new File([bytes], item.filename, { type: 'image/jpeg' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: item.name });
        window.showToast?.('공유 메뉴에서 "이미지 저장"을 선택해 사진 앱에 저장하세요.');
      } else {
        downloadFile(item);
        window.showToast?.('이 기기에서는 사진 앱 공유를 지원하지 않아 JPG 파일로 다운로드했습니다.');
      }
    } catch (error) {
      if (error?.name === 'AbortError') return;
      console.error('Image sharing failed:', error);
      downloadFile(item);
      window.showToast?.('공유에 실패해 JPG 파일로 다운로드했습니다.');
    }
  }, true);
})();
