import type { Readable } from 'stream';
import type { SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, ChatInputCommandInteraction } from 'discord.js';
import type { AudioPlayer, AudioResource, VoiceConnection } from '@discordjs/voice';

/**
 * 유튜브에서 추출한 재생 가능한 트랙 하나를 나타낸다.
 */
export interface QueueItem {
    title: string;
    url: string;
    durationSec: number;
    thumbnailUrl: string | null;
    requestedById: string;
    requestedByTag: string;
}

/**
 * 서버(Guild)별로 완전히 격리되는 재생 상태.
 * Map<guildId, ServerQueue> 싱글톤 스토어(queueStore.ts)를 통해서만 생성/조회/삭제된다.
 */
export interface ServerQueue {
    guildId: string;
    textChannelId: string;
    voiceChannelId: string;
    connection: VoiceConnection;
    /** 음악 전용 플레이어. TTS 인터럽트 중에도 일시정지된 상태로 리소스를 그대로 들고 있는다. */
    musicPlayer: AudioPlayer;
    /** TTS 전용 플레이어. VoiceConnection의 subscribe 대상을 musicPlayer <-> ttsPlayer로 스위칭해 인터럽트를 구현한다. */
    ttsPlayer: AudioPlayer;
    musicResource: AudioResource | null;
    /** musicResource의 원본 소스 스트림(FFmpeg Duplex 또는 play-dl 스트림). 정리 시 명시적으로 destroy() 해야 하는 대상. */
    musicSourceStream: Readable | null;
    currentItem: QueueItem | null;
    queue: QueueItem[];
    isTtsPlaying: boolean;
    idleLeaveTimer: NodeJS.Timeout | null;
    emptyChannelTimer: NodeJS.Timeout | null;
    reconnectAttempts: number;
}

/**
 * TTS 자동 읽기 채널 등록 레코드 (Redis 영속화 대상).
 */
export interface TtsChannelRecord {
    guildId: string;
    channelId: string;
}

/**
 * 슬래시 커맨드 표준 인터페이스. 모든 커맨드 파일은 이 형태로 export한다.
 */
export interface Command {
    data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder;
    execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}
