import { SlashCommandBuilder } from 'discord.js';
import { JOB_CHOICES } from '../types/forumType';

export const commands = [
    new SlashCommandBuilder().setName('도움말').setDescription('젤리봇 사용법을 안내드려요!'),

    new SlashCommandBuilder()
        .setName('생성')
        .setDescription('새 포스트를 작성합니다!')
        .addStringOption((option) => option.setName('문파명').setDescription('생성할 문파명').setRequired(true)),

    new SlashCommandBuilder()
        .setName('검색')
        .setDescription('포스트에서 특정 내용을 검색합니다.')
        .addStringOption((option) => option.setName('검색어').setDescription('검색할 캐릭터명을 입력해주세요.').setRequired(true)),

    new SlashCommandBuilder()
        .setName('등록')
        .setDescription('포스트를 찾아 특정 직업 항목에 캐릭터 명을 추가합니다.')
        .addStringOption((option) => option.setName('문파명').setDescription('입력한 캐릭터명을 등록할 문파명').setRequired(true))
        .addStringOption((option) =>
            option
                .setName('직업명')
                .setDescription('직업을 선택해주세요.')
                .setRequired(true)
                .addChoices(...JOB_CHOICES)
        )
        .addStringOption((option) => option.setName('캐릭터명').setDescription('추가하려는 캐릭터명').setRequired(true)),

    new SlashCommandBuilder()
        .setName('조회')
        .setDescription('특정 포스트에 작성된 전체 내용을 확인합니다.')
        .addStringOption((option) => option.setName('문파명').setDescription('내용을 조회할 문파명').setRequired(true)),

    new SlashCommandBuilder()
        .setName('삭제')
        .setDescription('포스트에서 특정 캐릭터 명을 삭제합니다.')
        .addStringOption((option) => option.setName('문파명').setDescription('삭제를 진행할 문파명').setRequired(true))
        .addStringOption((option) => option.setName('캐릭터명').setDescription('명단에서 삭제할 캐릭터명').setRequired(true)),

    new SlashCommandBuilder()
        .setName('수정')
        .setDescription('포스트에서 캐릭터 명을 수정합니다.')
        .addStringOption((option) => option.setName('문파명').setDescription('수정하려는 캐릭터의 문파명').setRequired(true))
        .addStringOption((option) => option.setName('기존캐릭터명').setDescription('수정할 기존 캐릭터명').setRequired(true))
        .addStringOption((option) => option.setName('새캐릭터명').setDescription('새로운 캐릭터명').setRequired(true)),

    new SlashCommandBuilder()
        .setName('통계')
        .setDescription('특정 포스트의 직업별 현황을 조회합니다.')
        .addStringOption((option) => option.setName('문파명').setDescription('조회하려는 문파명').setRequired(true)),

    new SlashCommandBuilder()
        .setName('직업변경')
        .setDescription('다른 직업 항목으로 변경합니다.')
        .addStringOption((option) => option.setName('문파명').setDescription('변경하려는 대상의 문파명').setRequired(true))
        .addStringOption((option) => option.setName('캐릭터명').setDescription('변경할 캐릭터 명').setRequired(true))
        .addStringOption((option) =>
            option
                .setName('직업명')
                .setDescription('변경할 직업을 선택하세요.')
                .setRequired(true)
                .addChoices(...JOB_CHOICES)
        ),

    new SlashCommandBuilder().setName('중복검사').setDescription('전체 포스트에서 중복으로 등록된 캐릭터명을 확인합니다.'),
].map((command) => command.toJSON());
