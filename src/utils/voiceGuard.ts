import { PermissionFlagsBits, type ChatInputCommandInteraction, type StringSelectMenuInteraction, type GuildMember, type VoiceBasedChannel } from 'discord.js';

export type VoiceGuardResult =
    | { ok: true; voiceChannel: VoiceBasedChannel }
    | { ok: false; title: string; description: string };

/**
 * /재생 및 검색결과 선택 UI(F-12)가 공통으로 필요로 하는 검증을 한곳에서 처리한다:
 * 서버 안인지, 사용자가 음성 채널에 있는지, 봇에게 연결/말하기 권한이 있는지.
 */
export function resolveVoiceContext(interaction: ChatInputCommandInteraction | StringSelectMenuInteraction): VoiceGuardResult {
    if (!interaction.guild) {
        return { ok: false, title: '서버 전용 명령어예요', description: '이 명령어는 디스코드 서버 안에서만 사용할 수 있어요.' };
    }

    const member = interaction.member as GuildMember | null;
    const voiceChannel = member?.voice.channel ?? null;
    if (!voiceChannel) {
        return { ok: false, title: '음성 채널에 먼저 입장해주세요', description: '이 명령어는 음성 채널에 입장한 상태에서만 사용할 수 있어요.' };
    }

    const botMember = interaction.guild.members.me;
    if (botMember) {
        const permissions = voiceChannel.permissionsFor(botMember);
        if (!permissions?.has(PermissionFlagsBits.Connect) || !permissions.has(PermissionFlagsBits.Speak)) {
            return { ok: false, title: '권한이 부족해요', description: '봇에게 해당 음성 채널의 `연결` 및 `말하기` 권한이 필요해요.' };
        }
    }

    return { ok: true, voiceChannel };
}
