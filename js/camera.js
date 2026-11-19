// Front-camera capture for the "Free photograph" prize.
// Photos are cropped to a small 4:5 polaroid and compressed to a ~20–40 KB JPEG,
// small enough to store directly in Firestore (no paid file storage needed).

const W = 240;
const H = 300;
const MAX_BYTES = 140000; // keep in sync with firestore.rules (photos < 150000 chars)

export async function openCamera(video) {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('no-camera');
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 900 } },
    audio: false,
  });
  video.srcObject = stream;
  video.setAttribute('playsinline', '');
  video.muted = true;
  await video.play();
  return () => stream.getTracks().forEach((t) => t.stop());
}

/** Draws a video frame or image into a W×H "cover" crop and returns a JPEG data URL. */
export function capture(source, mirror) {
  const sw = source.videoWidth || source.naturalWidth || source.width;
  const sh = source.videoHeight || source.naturalHeight || source.height;
  const scale = Math.max(W / sw, H / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  if (mirror) { ctx.translate(W, 0); ctx.scale(-1, 1); }
  ctx.drawImage(source, (W - dw) / 2, (H - dh) / 2, dw, dh);
  let q = 0.78;
  let url = c.toDataURL('image/jpeg', q);
  while (url.length > MAX_BYTES && q > 0.3) { q -= 0.1; url = c.toDataURL('image/jpeg', q); }
  return url;
}

export function fileToPhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const u = URL.createObjectURL(file);
    img.onload = () => { try { resolve(capture(img, false)); } catch (e) { reject(e); } finally { URL.revokeObjectURL(u); } };
    img.onerror = () => { URL.revokeObjectURL(u); reject(new Error('bad-image')); };
    img.src = u;
  });
}
