/* Files are held in memory only. Each compression gets an isolated, cancellable worker. */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  let file = null;
  let worker = null;
  let downloadUrl = null;
  let runId = 0;
  let timeout = null;
  let dragDepth = 0;
  const maxBytes = 50 * 1024 * 1024;
  const bytes = (size) => size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(2)} MB`;
  function announce(message) { $('announcer').textContent = message; }
  function clearDownload() { if (downloadUrl) URL.revokeObjectURL(downloadUrl); downloadUrl = null; $('download').removeAttribute('href'); }
  function stop() { runId++; clearTimeout(timeout); timeout = null; if (worker) worker.terminate(); worker = null; }
  function show(state) {
    ['dropzone', 'selected', 'processing', 'result'].forEach((id) => { $(id).hidden = id !== state; });
    $('step-label').textContent = {dropzone:'01 / ADD YOUR FILE', selected:'02 / CHOOSE YOUR BALANCE', processing:'02 / COMPRESSING', result:'03 / READY TO DOWNLOAD'}[state];
  }
  function error(message) { $('error').textContent = message; $('error').hidden = false; }
  function clearError() { $('error').hidden = true; $('error').textContent = ''; }
  function reset() { stop(); clearDownload(); clearError(); file = null; $('file-input').value = ''; show('dropzone'); $('browse').focus(); }
  function select(files) {
    if (worker) return;
    if (files.length !== 1) { error('Choose one PDF at a time.'); return; }
    const candidate = files[0];
    if (!/\.pdf$/i.test(candidate.name)) { error('Please choose a PDF file.'); return; }
    if (!candidate.size) { error('This file is empty. Choose another PDF.'); return; }
    if (candidate.size > maxBytes) { error('This PDF is larger than 50 MB. Please choose a smaller file.'); return; }
    stop(); clearError(); clearDownload(); file = candidate;
    $('file-name').textContent = file.name; $('file-size').textContent = bytes(file.size);
    show('selected'); $('compress').focus(); announce(`${file.name} selected. Choose a compression level.`);
  }
  $('browse').addEventListener('click', () => $('file-input').click());
  $('file-input').addEventListener('change', (event) => { if (event.target.files.length) select(event.target.files); event.target.value = ''; });
  $('remove').addEventListener('click', reset); $('again').addEventListener('click', reset);
  $('cancel').addEventListener('click', () => { stop(); clearError(); show('selected'); $('compress').focus(); announce('Compression canceled.'); });
  // Prevent dropped files from navigating away from the utility, including outside the drop area.
  window.addEventListener('dragover', (event) => event.preventDefault());
  window.addEventListener('drop', (event) => event.preventDefault());
  $('dropzone').addEventListener('dragenter', (event) => { event.preventDefault(); dragDepth++; $('dropzone').classList.add('dragging'); });
  $('dropzone').addEventListener('dragleave', () => { if (--dragDepth <= 0) { dragDepth = 0; $('dropzone').classList.remove('dragging'); } });
  $('dropzone').addEventListener('drop', (event) => { event.preventDefault(); dragDepth = 0; $('dropzone').classList.remove('dragging'); select(event.dataTransfer.files); });
  $('compress').addEventListener('click', async () => {
    if (!file || worker) return;
    stop(); clearError(); clearDownload();
    const activeRun = runId;
    show('processing'); $('progress').value = 0; $('progress-label').textContent = 'Opening your PDF…'; $('cancel').focus();
    const fail = (message) => { if (activeRun !== runId) return; stop(); show('selected'); error(message); $('compress').focus(); };
    try {
      const buffer = await file.arrayBuffer();
      if (activeRun !== runId) return;
      if (!new TextDecoder('latin1').decode(new Uint8Array(buffer, 0, Math.min(1024, buffer.byteLength))).includes('%PDF-')) { fail('This file does not appear to be a valid PDF. Choose another file.'); return; }
      worker = new Worker('/compress-pdf/compression-worker.js');
      timeout = setTimeout(() => fail('This PDF is taking too long to process. Try a smaller file or a different compression level.'), 180000);
      worker.onerror = () => fail('The compressor could not run. Refresh the page and try again in an up-to-date browser.');
      worker.onmessage = ({ data }) => {
        if (activeRun !== runId) return;
        if (data.type === 'progress') { $('progress').value = data.value; $('progress-label').textContent = data.label; }
        if (data.type === 'error') fail(data.message);
        if (data.type === 'result') {
          stop();
          const resultBytes = new Uint8Array(data.buffer);
          downloadUrl = URL.createObjectURL(new Blob([resultBytes], { type: 'application/pdf' }));
          $('download').href = downloadUrl;
          $('download').download = data.unchanged ? file.name : `${file.name.replace(/\.pdf$/i, '')}-compressed.pdf`;
          const saved = Math.max(0, (1 - resultBytes.byteLength / file.size) * 100);
          $('before-size').textContent = bytes(file.size); $('after-size').textContent = bytes(resultBytes.byteLength);
          $('savings').textContent = saved > 0 && saved < .1 ? '<0.1% smaller' : `${saved.toFixed(1)}% smaller`;
          $('savings').hidden = data.unchanged;
          $('result-title').textContent = data.unchanged ? 'Already looking light.' : 'Lighter. Ready to go.';
          $('result-subtitle').textContent = data.unchanged ? 'We couldn’t safely make this PDF smaller. You can download the original below.' : `${data.pages} ${data.pages === 1 ? 'page' : 'pages'}, ready to share. Your text and page layout stay intact.`;
          $('download').firstChild.textContent = data.unchanged ? 'Download original PDF ' : 'Download compressed PDF ';
          show('result'); $('download').focus(); announce(data.unchanged ? 'Compression complete. Original file kept because it is smaller.' : `Compression complete. ${saved.toFixed(1)} percent smaller.`);
        }
      };
      worker.postMessage({ buffer, level: document.querySelector('input[name="level"]:checked').value }, [buffer]);
    } catch { fail('We couldn’t open this PDF. Please try another file.'); }
  });
  window.addEventListener('pagehide', () => { stop(); clearDownload(); });
  window.addEventListener('pageshow', (event) => { if (event.persisted) reset(); });
})();
