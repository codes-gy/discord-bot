import { PassThrough } from 'stream';
import { getAllAudioBase64 } from 'google-tts-api';
import prism from 'prism-media';
import { StreamType } from '@discordjs/voice';
import { logger } from '@/utils/logger';

const MAX_TTS_TEXT_LENGTH = 300;

export interface TtsChunkStream {
    stream: prism.FFmpeg;
    inputType: StreamType;
}

/**
 * 임의 길이의 텍스트를 google-tts-api 제약(청크당 200자)에 맞게 분할한 뒤, 각 조각의 오디오를 base64 mp3로 받아온다.
 * 과도하게 긴 메시지는 사용자 안내 없이 앞부분만 잘라서 읽어준다.
 *
 * 예전에는 `getAllAudioUrls`로 translate_tts URL만 만든 뒤 FFmpeg가 그 URL을 직접 fetch하게 했었다.
 * 하지만 그 방식은 (1) FFmpeg의 HTTP 클라이언트가 Google에 차단당해도 예외 없이 조용히 0바이트로
 * 끝나버려 실패를 감지할 수 없고, (2) User-Agent/Referer를 붙여도 여전히 불안정했다.
 * `getAllAudioBase64`는 실제 translate.google.com 웹사이트가 쓰는 batchexecute API를 axios로 직접
 * 호출해 오디오를 Node 프로세스 안에서 바로 받아오므로 훨씬 안정적이고, 실패하면 axios가 실제
 * HTTP 에러를 던져줘서 원인을 정확히 로그에 남길 수 있다.
 */
export async function buildTtsAudioChunks(rawText: string): Promise<string[]> {
    const text = rawText.trim().slice(0, MAX_TTS_TEXT_LENGTH);
    if (text.length === 0) {
        return [];
    }

    try {
        const results = await getAllAudioBase64(text, { lang: 'ko', slow: false });
        return results.map((result) => result.base64);
    } catch (error) {
        logger.error('google-tts-api 오디오 생성 실패:', error);
        throw new Error('TTS 음성 생성에 실패했어요.', { cause: error });
    }
}

/**
 * google-tts-api가 반환한 base64 mp3 데이터를 prism-media FFmpeg로 raw PCM으로 트랜스코딩해
 * @discordjs/voice의 내장 Opus 인코더가 바로 처리할 수 있게 한다.
 * 오디오 바이트를 이미 메모리에 들고 있으므로 FFmpeg는 URL을 fetch하지 않고 stdin으로 파이프만 받는다
 * (네트워크 요청 자체가 없으므로 FFmpeg의 HTTP 클라이언트가 차단당할 여지가 원천적으로 없다).
 * FFmpeg 프로세스는 호출부에서 재생 종료/에러 시 반드시 destroy() 해야 한다 (메모리 누수 방지).
 */
export function createTtsChunkStream(base64Audio: string): TtsChunkStream {
    const ffmpeg = new prism.FFmpeg({
        args: ['-analyzeduration', '0', '-loglevel', 'error', '-f', 's16le', '-ar', '48000', '-ac', '2'],
    });

    // loglevel을 무음(0)이 아니라 error로 둔 대신, stderr를 직접 소비해서 실패 원인을 서버 로그에 남긴다.
    // (stderr 파이프를 아무도 읽지 않으면 커널 파이프 버퍼가 가득 차 FFmpeg 프로세스가 멈출 수 있어 반드시 소비해야 한다.)
    ffmpeg.process.stderr?.on('data', (chunk: Buffer) => {
        logger.warn(`[tts] ffmpeg stderr: ${chunk.toString('utf-8').trim()}`);
    });

    const audioBuffer = Buffer.from(base64Audio, 'base64');
    const input = new PassThrough();
    input.on('error', (error) => {
        logger.error('[tts] TTS 오디오 버퍼 스트림 에러:', error);
        ffmpeg.destroy();
    });
    input.pipe(ffmpeg);
    input.end(audioBuffer);

    return { stream: ffmpeg, inputType: StreamType.Raw };
}
