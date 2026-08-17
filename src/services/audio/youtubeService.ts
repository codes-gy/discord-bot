import { Readable } from 'stream';
import fs from 'fs';
import path from 'path';
import play from 'play-dl';
import youtubeDl from 'youtube-dl-exec';
import prism from 'prism-media';
import { StreamType as VoiceStreamType } from '@discordjs/voice';
import { logger } from '@/utils/logger';
import { env } from '@/libs/env';
import type { QueueItem } from '@/types';

const COOKIE_FILE_PATH = path.join(process.cwd(), 'cookies.txt');
let cookieInitialized = false;

/**
 * play-dl에 유튜브 쿠키를 로드한다 (429/봇 감지 우회용).
 * app.ts가 YOUTUBE_COOKIES_BASE64로 cookies.txt를 생성해두면 그 값을, 없으면 YOUTUBE_COOKIE 환경변수 원문을 사용한다.
 * 실패하더라도 쿠키 없이 스트리밍을 계속 시도할 수 있어야 하므로 에러를 흡수한다.
 */
export async function initYoutubeCookies(): Promise<void> {
    if (cookieInitialized) {
        return;
    }
    cookieInitialized = true;

    try {
        let cookie: string | null = null;
        if (fs.existsSync(COOKIE_FILE_PATH)) {
            cookie = fs.readFileSync(COOKIE_FILE_PATH, 'utf-8').trim();
        } else if (env.youtubeCookie && env.youtubeCookie !== 'YOUTUBE_COOKIE') {
            cookie = env.youtubeCookie;
        }

        if (cookie) {
            await play.setToken({ youtube: { cookie } });
            logger.info('play-dl 유튜브 쿠키 로드 완료');
        }
    } catch (error) {
        logger.warn('play-dl 유튜브 쿠키 로드 실패 (쿠키 없이 계속 진행합니다):', error);
    }
}

export interface ResolvedTrack {
    item: Omit<QueueItem, 'requestedById' | 'requestedByTag'>;
}

/**
 * 사용자 입력(검색어 또는 URL)을 실제 재생 가능한 유튜브 트랙 메타데이터로 변환한다.
 * URL이면 바로 정보를 조회하고, 아니면 최상위 검색 결과 1건을 사용한다.
 */
export async function resolveTrack(query: string): Promise<ResolvedTrack> {
    const trimmed = query.trim();
    const validationResult = play.yt_validate(trimmed);

    if (validationResult === 'video') {
        const info = await play.video_basic_info(trimmed);
        const details = info.video_details;
        return {
            item: {
                title: details.title ?? '제목 없음',
                url: details.url,
                durationSec: details.durationInSec ?? 0,
                thumbnailUrl: details.thumbnails?.[details.thumbnails.length - 1]?.url ?? null,
            },
        };
    }

    if (validationResult === 'playlist') {
        throw new Error('재생목록(playlist) URL은 아직 지원하지 않아요. 개별 영상 URL이나 검색어를 입력해주세요.');
    }

    const searchResults = await play.search(trimmed, { source: { youtube: 'video' }, limit: 1 });
    const firstResult = searchResults[0];
    if (!firstResult || !firstResult.url) {
        throw new Error(`"${trimmed}"에 대한 검색 결과를 찾지 못했어요.`);
    }

    return {
        item: {
            title: firstResult.title ?? '제목 없음',
            url: firstResult.url,
            durationSec: firstResult.durationInSec ?? 0,
            thumbnailUrl: firstResult.thumbnails?.[firstResult.thumbnails.length - 1]?.url ?? null,
        },
    };
}

export interface AudioStreamResult {
    stream: Readable;
    inputType: VoiceStreamType;
}

/**
 * 재생용 오디오 스트림을 생성한다.
 * 1차: play-dl.stream() — 대부분의 경우 가장 빠르고 안정적.
 * 2차(폴백): play-dl 추출 실패(스트림 추출 실패/429/토큰 만료 등) 시 youtube-dl-exec로 원본 스트림을 받아
 *            prism-media FFmpeg로 raw PCM으로 트랜스코딩. @discordjs/voice가 내장 Opus 인코더로 마무리한다.
 */
export async function createYoutubeAudioStream(url: string): Promise<AudioStreamResult> {
    try {
        const playDlStream = await play.stream(url, { discordPlayerCompatibility: false });
        return {
            stream: playDlStream.stream,
            // play-dl과 @discordjs/voice의 StreamType 문자열 값이 동일하므로 안전하게 매핑 가능
            inputType: playDlStream.type as unknown as VoiceStreamType,
        };
    } catch (playDlError) {
        logger.warn(`play-dl 스트림 추출 실패, youtube-dl-exec 폴백을 시도합니다 (url=${url}):`, playDlError);
        try {
            return await createFallbackAudioStream(url);
        } catch (fallbackError) {
            logger.error(`youtube-dl-exec 폴백도 실패했습니다 (url=${url}):`, fallbackError);
            throw new Error('음원 스트림을 추출하지 못했어요. 잠시 후 다시 시도하거나 다른 곡을 재생해주세요.', { cause: fallbackError });
        }
    }
}

const STDOUT_FIRST_BYTE_TIMEOUT_MS = 20_000;

async function createFallbackAudioStream(url: string): Promise<AudioStreamResult> {
    // quiet/noWarnings을 켜두면 yt-dlp가 실패 사유(예: 유튜브 봇 감지로 인한 로그인 요구)를
    // stderr에 전혀 남기지 않아 원인 파악이 불가능해진다. 실패 시 진단할 수 있도록 끄고 stderr를 직접 수집한다.
    // (stdout에는 오디오 바이너리만 쓰기 때문에 진행 로그가 늘어나도 오디오 스트림이 오염되지는 않는다.)
    const flags: Record<string, unknown> = {
        output: '-',
        format: 'bestaudio',
        noPlaylist: true,
        preferFreeFormats: true,
        // yt-dlp는 유튜브의 서명/PoToken JS 챌린지를 풀 JS 런타임이 없으면 정상 공개 영상도
        // "This video is not available"/로그인 필요로 오판하는 경우가 많다 (yt-dlp 최근 버전 기준).
        // 별도 런타임(Deno 등)을 새로 설치하는 대신, 이미 이 봇을 구동 중인 Node.js 실행 파일을
        // 그대로 JS 런타임으로 재사용한다 — 로컬/Render 어디서든 추가 설치 없이 동작한다.
        jsRuntimes: `node:${process.execPath}`,
    };
    if (fs.existsSync(COOKIE_FILE_PATH)) {
        flags.cookies = COOKIE_FILE_PATH;
    }

    const subprocess = youtubeDl.exec(url, flags as Parameters<typeof youtubeDl.exec>[1], {
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    // subprocess.stdout은 tinyspawn이 프로세스 종료 시 "누적된 텍스트 문자열"을 반환하는 getter로
    // 재정의해버리므로, 스트림으로 계속 사용하려면 종료되기 전에 참조를 한 번만 고정해둬야 한다.
    const stdoutStream = subprocess.stdout;
    if (!stdoutStream) {
        throw new Error('youtube-dl-exec 프로세스에서 stdout을 가져오지 못했습니다.');
    }

    let stderrOutput = '';
    subprocess.stderr?.on('data', (chunk: Buffer) => {
        stderrOutput += chunk.toString('utf-8');
    });

    subprocess.catch((error: unknown) => {
        const stderrSuffix = stderrOutput.trim() ? `\nyt-dlp stderr: ${stderrOutput.trim()}` : '';
        logger.error(`youtube-dl-exec 프로세스 실행 중 에러 (url=${url}):${stderrSuffix}`, error);
    });

    // yt-dlp가 영상 정보 추출조차 실패하면 stdout에 단 1바이트도 쓰지 않고 곧바로 비정상 종료된다.
    // 예전에는 이 실패를 확인하지 않고 스트림 객체를 그대로 반환해버려서, 커맨드는 "재생을 시작했어요"라고
    // 응답하지만 실제로는 무음인 상태로 진행되는 버그가 있었다. 첫 데이터가 오거나 stdout이 먼저 끝나버리는 것 중
    // 무엇이 먼저 발생하는지를 확인해, 데이터 없이 끝나면 명확한 에러로 실패 처리한다.
    await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => {
            cleanup();
            reject(new Error('yt-dlp 응답이 너무 오래 걸려요. 잠시 후 다시 시도해주세요.'));
        }, STDOUT_FIRST_BYTE_TIMEOUT_MS);

        const onData = (): void => {
            cleanup();
            resolve();
        };
        const onEnded = (): void => {
            cleanup();
            const stderrSuffix = stderrOutput.trim() ? ` ${stderrOutput.trim()}` : '';
            reject(new Error(`yt-dlp가 오디오 스트림을 만들지 못했어요.${stderrSuffix}`));
        };
        const cleanup = (): void => {
            clearTimeout(timer);
            stdoutStream.off('data', onData);
            stdoutStream.off('end', onEnded);
            stdoutStream.off('close', onEnded);
        };

        stdoutStream.once('data', onData);
        stdoutStream.once('end', onEnded);
        stdoutStream.once('close', onEnded);
    });

    const ffmpeg = new prism.FFmpeg({
        args: ['-analyzeduration', '0', '-loglevel', 'error', '-f', 's16le', '-ar', '48000', '-ac', '2'],
    });
    ffmpeg.process.stderr?.on('data', (chunk: Buffer) => {
        logger.warn(`[youtube] fallback ffmpeg stderr (url=${url}): ${chunk.toString('utf-8').trim()}`);
    });

    stdoutStream.pipe(ffmpeg);
    stdoutStream.on('error', (error: unknown) => {
        logger.error(`youtube-dl-exec stdout 스트림 에러 (url=${url}):`, error);
        ffmpeg.destroy();
    });

    return { stream: ffmpeg, inputType: VoiceStreamType.Raw };
}
