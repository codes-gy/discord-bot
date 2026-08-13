import {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnection,
    VoiceConnectionStatus,
    AudioPlayer,
    entersState,
} from '@discordjs/voice';
import play from 'play-dl';
import youtubeDl from 'youtube-dl-exec';
import { VoiceBasedChannel } from 'discord.js';
import { logger } from '../utils/logger';

export interface Song {
    title: string;
    url: string;
    channel?: string;
    duration?: string;
}

class MusicService {
    private connections = new Map<string, VoiceConnection>();
    private players = new Map<string, AudioPlayer>();
    private queues = new Map<string, Song[]>();
    private isPlaying = new Map<string, boolean>();

    // 1. 상위 5개 노래 검색 로직
    async searchSongs(query: string): Promise<Song[]> {
        const searchResults = await play.search(query, { limit: 10, source: { youtube: 'video' } });
        if (!searchResults.length) throw new Error('검색 결과를 찾을 수 없습니다.');

        return searchResults.map((item) => ({
            title: item.title || '제목 없음',
            url: item.url,
            channel: item.channel?.name || '알 수 없는 채널',
            duration: item.durationRaw || '시간 정보 없음',
        }));
    }

    // 2. 선택된 노래 큐 추가 및 재생
    async addAndPlaySong(guildId: string, voiceChannel: VoiceBasedChannel, songInfo: Song): Promise<string> {
        if (!this.queues.has(guildId)) this.queues.set(guildId, []);
        this.queues.get(guildId)!.push(songInfo);

        const connection = await this.getOrCreateConnection(guildId, voiceChannel);
        const player = this.getOrCreatePlayer(guildId, connection);

        if (!this.isPlaying.get(guildId)) {
            await this.playNext(guildId, player);
        }

        return songInfo.title;
    }

    private async playNext(guildId: string, player: AudioPlayer): Promise<void> {
        const queue = this.queues.get(guildId);
        if (!queue || queue.length === 0) {
            this.isPlaying.set(guildId, false);
            return;
        }

        this.isPlaying.set(guildId, true);
        const nextSong = queue.shift()!;

        try {
            // play-dl의 stream 기능을 이용하여 안전하게 스트림을 가져옵니다.
            const stream = await play.stream(nextSong.url);

            // inputType을 지정하여 디스코드 플레이어가 오디오 스트림을 올바르게 디코딩하도록 합니다.
            const resource = createAudioResource(stream.stream, {
                inputType: stream.type,
            });

            player.play(resource);
            logger.info(`[Music] 재생 시작: ${nextSong.title}`);
        } catch (error) {
            logger.error(`[Music Play Error] ${guildId}:`, error);
            // 에러 발생 시 다음 곡으로 진행
            await this.playNext(guildId, player);
        }
    }

    private async getOrCreateConnection(guildId: string, voiceChannel: VoiceBasedChannel): Promise<VoiceConnection> {
        let connection = this.connections.get(guildId);

        if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed) {
            const newConnection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guildId,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: true,
            });

            try {
                await entersState(newConnection, VoiceConnectionStatus.Ready, 5_000);
            } catch (error) {
                newConnection.destroy();
                throw error;
            }

            newConnection.on(VoiceConnectionStatus.Disconnected, async () => {
                try {
                    await Promise.race([
                        entersState(newConnection, VoiceConnectionStatus.Signalling, 5_000),
                        entersState(newConnection, VoiceConnectionStatus.Connecting, 5_000),
                    ]);
                } catch (error) {
                    newConnection.destroy();
                }
            });

            newConnection.on(VoiceConnectionStatus.Destroyed, () => {
                this.connections.delete(guildId);
                this.players.delete(guildId);
                this.queues.delete(guildId);
                this.isPlaying.delete(guildId);
            });

            this.connections.set(guildId, newConnection);
            return newConnection;
        }

        return connection;
    }

    private getOrCreatePlayer(guildId: string, connection: VoiceConnection): AudioPlayer {
        let player = this.players.get(guildId);

        if (!player) {
            player = createAudioPlayer();
            player.on(AudioPlayerStatus.Idle, () => this.playNext(guildId, player!));
            player.on('error', (error) => {
                logger.error(`[Audio Player Error] ${guildId}:`, error);
                this.playNext(guildId, player!);
            });

            connection.subscribe(player);
            this.players.set(guildId, player);
        }

        return player;
    }

    stop(guildId: string): boolean {
        const connection = this.connections.get(guildId);
        const player = this.players.get(guildId);

        // 재생 중이거나 접속된 상태가 아니라면 false 반환
        if (!connection && !player) return false;

        // 1. 큐 및 재생 상태 초기화
        this.queues.delete(guildId);
        this.isPlaying.set(guildId, false);

        // 2. 플레이어 정지
        if (player) {
            player.stop();
            this.players.delete(guildId);
        }

        // 3. 음성 채널 연결 해제 및 맵 정리
        if (connection) {
            connection.destroy();
            this.connections.delete(guildId);
        }

        return true;
    }
}

export const musicService = new MusicService();
