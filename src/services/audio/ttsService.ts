import { getAllAudioUrls } from 'google-tts-api';
import prism from 'prism-media';
import { StreamType } from '@discordjs/voice';
import { logger } from '@/utils/logger';

const MAX_TTS_TEXT_LENGTH = 300;

export interface TtsChunkStream {
    stream: prism.FFmpeg;
    inputType: StreamType;
}

/**
 * 임의 길이의 텍스트를 google-tts-api 제약(청크당 200자)에 맞게 URL 목록으로 분할한다.
 * 과도하게 긴 메시지는 사용자 안내 후 앞부분만 잘라서 읽어준다.
 */
export function buildTtsAudioUrls(rawText: string): string[] {
    const text = rawText.trim().slice(0, MAX_TTS_TEXT_LENGTH);
    if (text.length === 0) {
        return [];
    }

    try {
        const results = getAllAudioUrls(text, { lang: 'ko', slow: false });
        return results.map((result) => result.url);
    } catch (error) {
        logger.error('google-tts-api URL 생성 실패:', error);
        throw new Error('TTS 음성 생성에 실패했어요.', { cause: error });
    }
}

/**
 * google-tts-api가 반환한 mp3 URL을 prism-media FFmpeg로 raw PCM으로 트랜스코딩해
 * @discordjs/voice의 내장 Opus 인코더가 바로 처리할 수 있게 한다.
 * FFmpeg 프로세스는 호출부에서 재생 종료/에러 시 반드시 destroy() 해야 한다 (메모리 누수 방지).
 */
export function createTtsChunkStream(audioUrl: string): TtsChunkStream {
    const ffmpeg = new prism.FFmpeg({
        args: [
            '-reconnect',
            '1',
            '-reconnect_streamed',
            '1',
            '-reconnect_delay_max',
            '5',
            '-i',
            audioUrl,
            '-analyzeduration',
            '0',
            '-loglevel',
            '0',
            '-f',
            's16le',
            '-ar',
            '48000',
            '-ac',
            '2',
        ],
    });

    return { stream: ffmpeg, inputType: StreamType.Raw };
}
