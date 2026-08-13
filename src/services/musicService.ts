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
import { VoiceBasedChannel } from 'discord.js';
import { logger } from '../utils/logger';

interface Song {
    title: string;
    url: string;
}

class MusicService {
    private connections = new Map<string, VoiceConnection>();
    private players = new Map<string, AudioPlayer>();
    private queues = new Map<string, Song[]>();
    private isPlaying = new Map<string, boolean>();

    async addAndPlay(guildId: string, voiceChannel: VoiceBasedChannel, query: string): Promise<string> {
        // 1. 유튜브 검색 또는 URL 정보 가져오기
        let songInfo: Song;
        if (play.yt_validate(query) === 'video') {
            const info = await play.video_info(query);
            songInfo = { title: info.video_details.title || '제목 없음', url: info.video_details.url };
        } else {
            const searchResults = await play.search(query, { limit: 1, source: { youtube: 'video' } });
            if (!searchResults.length) throw new Error('검색 결과를 찾을 수 없습니다.');
            songInfo = { title: searchResults[0].title || '제목 없음', url: searchResults[0].url };
        }

        // 2. 큐 등록
        if (!this.queues.has(guildId)) this.queues.set(guildId, []);
        this.queues.get(guildId)!.push(songInfo);

        // 3. 음성 채널 접속 및 플레이어 준비
        const connection = await this.getOrCreateConnection(guildId, voiceChannel);
        const player = this.getOrCreatePlayer(guildId, connection);

        // 4. 재생 중이 아니라면 바로 재생 시작
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
            // 💡 play-dl을 통해 오디오 스트림 추출
            const stream = await play.stream(nextSong.url);
            const resource = createAudioResource(stream.stream, {
                inputType: stream.type,
            });

            player.play(resource);
            logger.info(`[Music] 재생 시작: ${nextSong.title}`);
        } catch (error) {
            logger.error(`[Music Play Error] ${guildId}:`, error);
            await this.playNext(guildId, player);
        }
    }

    private async getOrCreateConnection(guildId: string, voiceChannel: VoiceBasedChannel): Promise<VoiceConnection> {
        let connection = this.connections.get(guildId);

        if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed) {
            connection = joinVoiceChannel({
                channelId: voiceChannel.id,
                guildId: guildId,
                adapterCreator: voiceChannel.guild.voiceAdapterCreator,
                selfDeaf: true,
            });

            await entersState(connection, VoiceConnectionStatus.Ready, 5_000);

            connection.on(VoiceConnectionStatus.Destroyed, () => {
                this.connections.delete(guildId);
                this.players.delete(guildId);
                this.queues.delete(guildId);
                this.isPlaying.delete(guildId);
            });

            this.connections.set(guildId, connection);
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
}

export const musicService = new MusicService();
