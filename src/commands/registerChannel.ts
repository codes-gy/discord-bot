import { createCommand } from './helper';
import { channelRepository } from '../repositories/channelRepository';
import { MessageFlags } from 'discord.js';

export const registerChannelCommand = createCommand(
    (command) => command.setName('채널등록').setDescription('현재 텍스트 채널을 TTS 자동 읽기 채널로 등록합니다.'),
    async (interaction) => {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        }

        const channelId = interaction.channelId;
        const guildId = interaction.guildId;

        if (!guildId) {
            await interaction.editReply('서버 내에서만 사용할 수 있는 명령어입니다.');
            return;
        }

        const isAlreadyRegistered = await channelRepository.isTtsChannel(guildId, channelId);
        if (isAlreadyRegistered) {
            await interaction.editReply(`이 채널은 이미 등록되어 있습니다.`);
            return;
        }

        await channelRepository.registerTtsChannel(guildId, channelId);
        await interaction.editReply(`채널이 등록되었습니다!`);
    }
);
