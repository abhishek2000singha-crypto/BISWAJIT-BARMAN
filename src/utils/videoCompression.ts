import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

let ffmpeg: FFmpeg | null = null;

export const loadFFmpeg = async () => {
  if (ffmpeg) return ffmpeg;

  ffmpeg = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return ffmpeg;
};

export const compressVideo = async (file: File, onProgress?: (progress: number) => void): Promise<Blob> => {
  const ffmpeg = await loadFFmpeg();
  const inputName = 'input.mp4';
  const outputName = 'output.mp4';

  await ffmpeg.writeFile(inputName, await fetchFile(file));

  ffmpeg.on('progress', ({ progress }) => {
    if (onProgress) onProgress(progress * 100);
  });

  // Compression settings: 
  // -vcodec libx264: Use H.264 codec
  // -crf 28: Constant Rate Factor (higher = more compression, 23 is default, 28 is good balance)
  // -preset faster: Speed of compression
  // -vf scale=-2:720: Scale to 720p height while maintaining aspect ratio (must be even)
  await ffmpeg.exec([
    '-i', inputName,
    '-vcodec', 'libx264',
    '-crf', '28',
    '-preset', 'faster',
    '-vf', 'scale=-2:720',
    '-acodec', 'aac',
    '-b:a', '128k',
    outputName
  ]);

  const data = await ffmpeg.readFile(outputName);
  return new Blob([data], { type: 'video/mp4' });
};
