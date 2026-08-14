import { createCommand } from './helper';
import { channelRepository } from '../repositories/channelRepository';

export const unregisterChannelCommand = createCommand(
    (command) => command.setName('채널해제').setDescription('현재 텍스트 채널의 TTS 자동 읽기 설정을 해제합니다.'),
    async (interaction) => {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: true });
        }
        const channelId = interaction.channelId;
        const guildId = interaction.guildId;

        if (!guildId) {
            await interaction.editReply('서버 내에서만 사용할 수 있는 명령어입니다.');
            return;
        }

        // 등록되어 있지 않은 경우 처리
        const isRegistered = await channelRepository.isTtsChannel(guildId, channelId);
        if (!isRegistered) {
            await interaction.editReply(`이 채널은 등록되어 있지 않습니다.`);
            return;
        }

        await channelRepository.unregisterTtsChannel(guildId, channelId);
        await interaction.editReply(`채널등록이 해제되었습니다.`);
    }
);
