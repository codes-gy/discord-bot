import { getAllAudioUrls } from 'google-tts-api';
import prism from 'prism-media';
import { StreamType } from '@discordjs/voice';
import { logger } from '@/utils/logger';

const MAX_TTS_TEXT_LENGTH = 300;
export const DEFAULT_TTS_LANG = 'ko';

/** 지원하는 TTS 언어 목록 (기획서 F-13). google-tts-api(Google 번역 TTS)가 지원하는 언어 코드 중 자주 쓰이는 것만 추린다. */
export const TTS_LANGUAGE_CHOICES = [
    { name: '한국어', value: 'ko' },
    { name: '영어', value: 'en' },
    { name: '일본어', value: 'ja' },
    { name: '중국어', value: 'zh-CN' },
] as const;

export interface TtsChunkStream {
    stream: prism.FFmpeg;
    inputType: StreamType;
}

export interface TtsAudioResult {
    urls: string[];
    /** MAX_TTS_TEXT_LENGTH를 초과해 잘렸는지 여부. 호출부가 사용자에게 안내할 때 사용한다. */
    truncated: boolean;
}

/**
 * 임의 길이의 텍스트를 google-tts-api 제약(청크당 200자)에 맞게 URL 목록으로 분할한다.
 * 과도하게 긴 메시지는 앞부분만 잘라서 읽어주고, truncated: true로 호출부가 사용자에게 안내할 수 있게 한다.
 */
export function buildTtsAudioUrls(rawText: string, lang: string = DEFAULT_TTS_LANG): TtsAudioResult {
    const trimmed = rawText.trim();
    const text = trimmed.slice(0, MAX_TTS_TEXT_LENGTH);
    const truncated = trimmed.length > MAX_TTS_TEXT_LENGTH;

    if (text.length === 0) {
        return { urls: [], truncated: false };
    }

    try {
        const results = getAllAudioUrls(text, { lang, slow: false });
        return { urls: results.map((result) => result.url), truncated };
    } catch (error) {
        logger.error('google-tts-api URL 생성 실패:', error);
        throw new Error('TTS 음성 생성에 실패했어요.', { cause: error });
    }
}

const TTS_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * google-tts-api가 반환한 mp3 URL을 prism-media FFmpeg로 raw PCM으로 트랜스코딩해
 * @discordjs/voice의 내장 Opus 인코더가 바로 처리할 수 있게 한다.
 * FFmpeg 프로세스는 호출부에서 재생 종료/에러 시 반드시 destroy() 해야 한다 (메모리 누수 방지).
 *
 * Google 번역 TTS 엔드포인트(translate_tts)는 브라우저처럼 보이는 User-Agent/Referer 헤더가 없으면
 * 요청을 403으로 차단한다. FFmpeg의 기본 User-Agent("Lavf/...")로 -i에 URL을 바로 넘기면 조용히
 * 0바이트 스트림으로 끝나버려 "봇은 입장하지만 TTS 소리가 전혀 안 들리는" 증상으로 나타난다.
 * 이를 막기 위해 -user_agent/-headers로 실제 브라우저처럼 요청을 보낸다.
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
            '-user_agent',
            TTS_USER_AGENT,
            '-headers',
            'Referer: https://translate.google.com/\r\n',
            '-i',
            audioUrl,
            '-analyzeduration',
            '0',
            '-loglevel',
            'error',
            '-f',
            's16le',
            '-ar',
            '48000',
            '-ac',
            '2',
        ],
    });

    // loglevel을 무음(0)에서 error로 올린 대신, stderr를 직접 소비해서 실패 원인을 서버 로그에 남긴다.
    // (stderr 파이프를 아무도 읽지 않으면 커널 파이프 버퍼가 가득 차 FFmpeg 프로세스가 멈출 수 있어 반드시 소비해야 한다.)
    ffmpeg.process.stderr?.on('data', (chunk: Buffer) => {
        logger.warn(`[tts] ffmpeg stderr: ${chunk.toString('utf-8').trim()}`);
    });

    return { stream: ffmpeg, inputType: StreamType.Raw };
}
