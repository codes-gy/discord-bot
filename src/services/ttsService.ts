import { Message } from 'discord.js';
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
import * as googleTTS from 'google-tts-api';
import { Readable } from 'stream';
import ffmpegPath from 'ffmpeg-static';
import { channelRepository } from '../repositories/channelRepository';
import { logger } from '../utils/logger';

// ➕ FFmpeg 실행 경로를 명시적으로 지정 (MP3 -> Opus 변환 필수)
if (ffmpegPath) {
    process.env.FFMPEG_PATH = ffmpegPath;
}

class TtsService {
    private connections = new Map<string, VoiceConnection>();
    private players = new Map<string, AudioPlayer>();
    private queues = new Map<string, string[]>();
    private isPlaying = new Map<string, boolean>();

    async processMessageTts(message: Message): Promise<void> {
        if (message.author.bot || !message.guild || !message.content.trim()) return;

        const guildId = message.guild.id;
        const channelId = message.channelId;

        // 1. 등록된 TTS 채널인지 Redis 조회
        const isRegistered = await channelRepository.isTtsChannel(guildId, channelId);
        if (!isRegistered) return;

        // 2. 유저 정보 최신화 및 음성 채널 접속 여부 확인
        const member = await message.guild.members.fetch(message.author.id).catch(() => null);
        const voiceChannel = member?.voice.channel;

        if (!voiceChannel) {
            logger.warn(`[TTS 거부] ${message.author.tag} 님이 음성 채널에 없습니다.`);
            return;
        }

        try {
            // 3. 텍스트 정제
            let cleanText = message.content
                .replace(/https?:\/\/\S+/g, '링크')
                .replace(/<[^>]*>/g, '')
                .trim();

            if (!cleanText) return;

            if (cleanText.length > 100) {
                cleanText = cleanText.substring(0, 100) + ' 이하 생략';
            }

            // 4. 음성 채널 연결 수립 및 플레이어 준비
            const connection = await this.getOrCreateConnection(guildId, voiceChannel.id, message.guild.voiceAdapterCreator);
            const player = this.getOrCreatePlayer(guildId, connection);

            // 5. 큐 추가 및 순차 재생 시도
            if (!this.queues.has(guildId)) {
                this.queues.set(guildId, []);
            }
            this.queues.get(guildId)!.push(cleanText);

            if (!this.isPlaying.get(guildId)) {
                await this.playNextInQueue(guildId, player);
            }
        } catch (error) {
            logger.error(`[TTS Service Error] ${guildId}:`, error);
        }
    }

    // ➕ Base64 및 Stream 생성을 위해 async 함수로 변경
    private async playNextInQueue(guildId: string, player: AudioPlayer): Promise<void> {
        const queue = this.queues.get(guildId);

        if (!queue || queue.length === 0) {
            this.isPlaying.set(guildId, false);
            return;
        }

        this.isPlaying.set(guildId, true);
        const textToSpeech = queue.shift()!;

        try {
            // URL 대신 Base64 데이터를 받아 버퍼 스트림으로 전달
            const base64Audio = await googleTTS.getAudioBase64(textToSpeech, {
                lang: 'ko',
                slow: false,
                timeout: 10000,
            });

            const audioBuffer = Buffer.from(base64Audio, 'base64');
            const stream = Readable.from(audioBuffer);
            const resource = createAudioResource(stream);

            player.play(resource);
        } catch (error) {
            logger.error(`[TTS Play Error] ${guildId}:`, error);
            await this.playNextInQueue(guildId, player);
        }
    }

    private async getOrCreateConnection(guildId: string, voiceChannelId: string, adapterCreator: any): Promise<VoiceConnection> {
        let connection = this.connections.get(guildId);

        // 연결이 없거나, 파괴되었거나, 유저가 다른 음성 채널로 이동한 경우 재연결
        if (!connection || connection.state.status === VoiceConnectionStatus.Destroyed || connection.joinConfig.channelId !== voiceChannelId) {
            connection = joinVoiceChannel({
                channelId: voiceChannelId,
                guildId: guildId,
                adapterCreator: adapterCreator,
                selfDeaf: true,
            });

            try {
                await entersState(connection, VoiceConnectionStatus.Ready, 5_000);
            } catch (error) {
                connection.destroy();
                this.connections.delete(guildId);
                throw error;
            }

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
            const newPlayer = createAudioPlayer();

            newPlayer.on(AudioPlayerStatus.Idle, () => {
                this.playNextInQueue(guildId, newPlayer);
            });

            newPlayer.on('error', (error) => {
                logger.error(`[Audio Player Error] ${guildId}:`, error);
                this.playNextInQueue(guildId, newPlayer);
            });

            connection.subscribe(newPlayer);
            this.players.set(guildId, newPlayer);
            return newPlayer;
        }

        return player;
    }
}

export const ttsService = new TtsService();
