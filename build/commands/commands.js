import { SlashCommandBuilder } from 'discord.js';
import { JOB_CHOICES } from '../types/forumType';
export const commands = [
    new SlashCommandBuilder()
        .setName('검색')
        .setDescription('문파 리스트에서 특정 내용을 검색합니다.')
        .addStringOption((option) => option.setName('검색어').setDescription('검색할 캐릭터명을 입력해주세요.').setRequired(true)),
    new SlashCommandBuilder()
        .setName('등록')
        .setDescription('문파 포스트를 찾아 특정 직업 항목에 캐릭터명을 추가합니다.')
        .addStringOption((option) => option.setName('문파명').setDescription('입력한 캐릭터명을 등록할 문파명').setRequired(true))
        .addStringOption((option) => option
        .setName('직업명')
        .setDescription('직업을 선택해주세요.')
        .setRequired(true)
        .addChoices(...JOB_CHOICES))
        .addStringOption((option) => option.setName('캐릭터명').setDescription('추가하려는 캐릭터명').setRequired(true)),
    new SlashCommandBuilder()
        .setName('조회')
        .setDescription('특정 문파 포스트에 작성된 전체 내용을 확인합니다.')
        .addStringOption((option) => option.setName('문파명').setDescription('내용을 조회할 문파명').setRequired(true)),
    new SlashCommandBuilder()
        .setName('삭제')
        .setDescription('문파 포스트에서 특정 캐릭터명을 삭제합니다.')
        .addStringOption((option) => option.setName('문파명').setDescription('삭제를 진행할 문파명').setRequired(true))
        .addStringOption((option) => option.setName('캐릭터명').setDescription('명단에서 삭제할 캐릭터명').setRequired(true)),
].map((command) => command.toJSON());
