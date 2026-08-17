import type { GuildMember, Message } from 'discord.js';
import { getTtsChannel } from '@/libs/redis';
import { interruptWithTts } from '@/services/audio/playerOrchestrator';
import { logger } from '@/utils/logger';

/**
 * TTS 인터럽트 트리거 (기획서 F-04/F-05):
 * 등록된 TTS 채널에 일반 사용자 메시지가 올라오면 감지해 음성 채널로 읽어준다.
 */
export async function handleMessageCreate(message: Message): Promise<void> {
    if (message.author.bot || !message.inGuild()) {
        return;
    }

    const content = message.content?.trim();
    if (!content) {
        return; // 첨부파일/스티커만 있는 메시지 등은 TTS 대상에서 제외
    }

    try {
        const ttsChannelId = await getTtsChannel(message.guildId);
        if (!ttsChannelId || ttsChannelId !== message.channelId) {
            return;
        }

        const member = message.member as GuildMember | null;
        const voiceChannel = member?.voice.channel ?? null;
        if (!voiceChannel) {
            // 음성 채널에 없는 사용자의 메시지는 어디로도 재생할 수 없으므로 안내 리액션만 남긴다.
            await message.react('🔇').catch((reactError: unknown) => {
                logger.warn('TTS 미입장 안내 리액션 실패:', reactError);
            });
            return;
        }

        await interruptWithTts(voiceChannel, message.channelId, content);
    } catch (error) {
        logger.error(`[messageCreate] TTS 처리 중 오류가 발생했습니다 (guildId=${message.guildId}):`, error);
        // 서버 로그만으로는 사용자가 실패 사실을 알 수 없으므로, 채널에도 눈에 보이는 실패 신호를 남긴다.
        await message.react('⚠️').catch((reactError: unknown) => {
            logger.warn('TTS 실패 안내 리액션 실패:', reactError);
        });
    }
}
