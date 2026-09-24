import type { ButtonInteraction, GuildMember } from 'discord.js';
import { AudioPlayerStatus } from '@discordjs/voice';
import { MUSIC_BUTTON_ID, buildSuccessEmbed, buildEmptyStateEmbed } from '@/utils/embeds';
import { getServerQueue } from '@/services/audio/queueStore';
import { pauseMusic, resumeMusic, skipCurrent, stopAndClearQueue, setLoopMode } from '@/services/audio/playerOrchestrator';
import { logger } from '@/utils/logger';

const LOOP_CYCLE: Record<'off' | 'track' | 'queue', 'off' | 'track' | 'queue'> = {
    off: 'track',
    track: 'queue',
    queue: 'off',
};

const LOOP_MODE_LABEL: Record<'off' | 'track' | 'queue', string> = {
    off: '반복 끔',
    track: '한 곡 반복',
    queue: '전체 반복',
};

/**
 * Now Playing 임베드 버튼 클릭(기획서 F-11) 처리. 커스텀 ID는 embeds.ts의 MUSIC_BUTTON_ID와 동일해야 한다.
 * 음성 채널에 없는 사용자가 명령어 없이 마음대로 남의 재생을 조작하지 못하도록,
 * 클릭한 사람이 봇과 "같은 음성 채널"에 있는지를 항상 먼저 확인한다.
 */
export async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    if (!interaction.guildId) {
        return;
    }

    const serverQueue = getServerQueue(interaction.guildId);
    if (!serverQueue) {
        await interaction.reply({ embeds: [buildEmptyStateEmbed('재생 중인 음악이 없어요', '봇이 음성 채널에 있지 않아요.')], ephemeral: true });
        return;
    }

    const member = interaction.member as GuildMember | null;
    if (member?.voice.channelId !== serverQueue.voiceChannelId) {
        await interaction.reply({
            embeds: [buildEmptyStateEmbed('같은 음성 채널에 있어야 해요', '봇과 같은 음성 채널에 입장한 상태에서만 조작할 수 있어요.')],
            ephemeral: true,
        });
        return;
    }

    try {
        switch (interaction.customId) {
            case MUSIC_BUTTON_ID.pauseResume: {
                const isPaused = serverQueue.musicPlayer.state.status === AudioPlayerStatus.Paused;
                const result = isPaused ? resumeMusic(interaction.guildId) : pauseMusic(interaction.guildId);
                const success = result === 'resumed' || result === 'paused';
                const label = isPaused ? '▶ 다시 재생할게요' : '⏸ 일시정지했어요';
                await interaction.reply({
                    embeds: [success ? buildSuccessEmbed(label, '버튼으로 조작했어요.') : buildEmptyStateEmbed('재생 중인 음악이 없어요', '봇이 음성 채널에 있지 않거나 재생 중인 곡이 없어요.')],
                    ephemeral: true,
                });
                return;
            }
            case MUSIC_BUTTON_ID.skip: {
                const skipped = skipCurrent(interaction.guildId);
                await interaction.reply({
                    embeds: [
                        skipped
                            ? buildSuccessEmbed('⏭ 스킵했어요', '다음 곡으로 넘어갈게요.')
                            : buildEmptyStateEmbed('건너뛸 곡이 없어요', '재생 중인 곡이 없어요.'),
                    ],
                    ephemeral: true,
                });
                return;
            }
            case MUSIC_BUTTON_ID.stop: {
                const stopped = stopAndClearQueue(interaction.guildId);
                await interaction.reply({
                    embeds: [
                        stopped
                            ? buildSuccessEmbed('⏹ 정지했어요', '대기열을 모두 비웠어요.')
                            : buildEmptyStateEmbed('재생 중인 음악이 없어요', '봇이 음성 채널에 있지 않거나 재생 중인 곡이 없어요.'),
                    ],
                    ephemeral: true,
                });
                return;
            }
            case MUSIC_BUTTON_ID.loop: {
                const nextMode = LOOP_CYCLE[serverQueue.loopMode];
                setLoopMode(interaction.guildId, nextMode);
                await interaction.reply({ embeds: [buildSuccessEmbed(`🔁 ${LOOP_MODE_LABEL[nextMode]}`, '반복 모드를 전환했어요.')], ephemeral: true });
                return;
            }
            default:
                return;
        }
    } catch (error) {
        logger.error(`[button:${interaction.customId}] 처리 중 오류가 발생했습니다:`, error);
        try {
            await interaction.reply({ embeds: [buildEmptyStateEmbed('오류가 발생했어요', '잠시 후 다시 시도해주세요.')], ephemeral: true });
        } catch {
            // 이미 응답된 인터랙션 등은 조용히 무시한다.
        }
    }
}
