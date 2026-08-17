import type { ServerQueue } from '@/types';

/**
 * 서버(Guild)별 재생 상태를 완전히 격리하는 인메모리 싱글톤 스토어.
 * Map<guildId, ServerQueue> 형태로, AudioPlayer/VoiceConnection 같은 직렬화 불가능한 객체를
 * 그대로 들고 있어야 하므로 Redis가 아닌 순수 메모리로만 관리한다.
 */
const guildQueues = new Map<string, ServerQueue>();

export function getServerQueue(guildId: string): ServerQueue | undefined {
    return guildQueues.get(guildId);
}

export function setServerQueue(guildId: string, serverQueue: ServerQueue): void {
    guildQueues.set(guildId, serverQueue);
}

export function deleteServerQueue(guildId: string): void {
    guildQueues.delete(guildId);
}

export function hasServerQueue(guildId: string): boolean {
    return guildQueues.has(guildId);
}
