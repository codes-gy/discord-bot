import { ActionRowBuilder, StringSelectMenuBuilder, ComponentType } from 'discord.js';
import { createCommand } from './helper';
import { musicService } from '../services/musicService';

export const playCommand = createCommand(
    (command) =>
        command
            .setName('재생')
            .setDescription('유튜브 노래를 검색하여 선택한 후 재생합니다.')
            .addStringOption((option) => option.setName('검색어').setDescription('노래 제목').setRequired(true)),
    async (interaction) => {
        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ ephemeral: true });
        }

        const query = interaction.options.getString('검색어', true);
        const member = await interaction.guild?.members.fetch(interaction.user.id);
        const voiceChannel = member?.voice.channel;

        if (!voiceChannel) {
            await interaction.editReply('먼저 음성 채널에 입장해 주세요!');
            return;
        }

        try {
            // 1. 노래 10개 검색
            const searchResults = await musicService.searchSongs(query);

            // 2. 선택 드롭다운 생성
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('select_song')
                .setPlaceholder('재생할 노래를 선택해 주세요')
                .addOptions(
                    searchResults.map((song, index) => ({
                        label: `${index + 1}. ${song.title}`.slice(0, 100),
                        description: `채널: ${song.channel} | 재생시간: ${song.duration}`.slice(0, 100),
                        value: index.toString(),
                    }))
                );

            const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

            const response = await interaction.editReply({
                content: `"${query}" 검색 결과입니다. 재생할 노래를 선택해 주세요!`,
                components: [row],
            });

            // 3. 사용자 입력 수집기 생성
            const collector = response.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                filter: (i) => i.user.id === interaction.user.id,
                time: 30_000,
            });

            collector.on('collect', async (menuInteraction) => {
                await menuInteraction.deferUpdate();
                const selectedIndex = parseInt(menuInteraction.values[0], 10);
                const selectedSong = searchResults[selectedIndex];

                try {
                    const title = await musicService.addAndPlaySong(interaction.guildId!, voiceChannel, selectedSong);
                    await interaction.editReply({
                        content: `${title} 을(를) 추가했습니다.`,
                        components: [],
                    });
                } catch (error) {
                    await interaction.editReply({
                        content: '음악을 추가하는 중 오류가 발생했습니다.',
                        components: [],
                    });
                }
            });

            // 4. 제한 시간 초과 처리
            collector.on('end', async (collected, reason) => {
                if (reason === 'time' && collected.size === 0) {
                    await interaction.editReply({
                        content: '시간이 초과되었습니다. 다시 명령어를 입력해 주세요.',
                        components: [],
                    });
                }
            });
        } catch (error) {
            await interaction.editReply('검색 결과를 찾을 수 없거나 음악을 불러오는 중 오류가 발생했습니다.');
        }
    }
);
