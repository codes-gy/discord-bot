import { createCommand } from './helper';
import { musicService } from '../services/musicService';

export const playCommand = createCommand(
    (command) =>
        command
            .setName('재생')
            .setDescription('유튜브 노래를 검색하거나 URL을 입력하여 재생합니다.')
            .addStringOption((option) => option.setName('검색어').setDescription('노래 제목 또는 유튜브 URL').setRequired(true)),
    async (interaction) => {
        const query = interaction.options.getString('검색어', true);
        const member = await interaction.guild?.members.fetch(interaction.user.id);
        const voiceChannel = member?.voice.channel;

        if (!voiceChannel) {
            await interaction.editReply('먼저 음성 채널에 입장해 주세요!');
            return;
        }

        try {
            const title = await musicService.addAndPlay(interaction.guildId!, voiceChannel, query);
            await interaction.editReply(`🎵 **${title}** 을 추가했습니다.`);
        } catch (error) {
            await interaction.editReply('음악을 불러오는 중 오류가 발생했습니다.');
        }
    }
);
