import { createCommand } from './helper';
import { musicService } from '../services/musicService';

export const stopCommand = createCommand(
    (command) => command.setName('정지').setDescription('음악 재생을 중지합니다.'),
    async (interaction) => {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply();
        }

        const guildId = interaction.guildId;
        if (!guildId) {
            await interaction.editReply('서버에서만 사용할 수 있는 명령어입니다.');
            return;
        }

        const member = await interaction.guild?.members.fetch(interaction.user.id);
        const voiceChannel = member?.voice.channel;

        if (!voiceChannel) {
            await interaction.editReply('먼저 음성 채널에 입장해 주세요!');
            return;
        }

        const isStopped = musicService.stop(guildId);

        if (isStopped) {
            await interaction.editReply('음악 재생을 정지하고 채널에서 퇴장했습니다.');
        } else {
            await interaction.editReply('현재 재생 중인 음악이 없습니다.');
        }
    }
);
