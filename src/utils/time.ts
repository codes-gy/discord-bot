/**
 * 초 단위 시간을 사람이 읽기 쉬운 mm:ss 또는 h:mm:ss 형식으로 변환한다.
 * 음수/NaN 등 비정상 입력은 0:00으로 안전하게 처리한다.
 */
export function formatDuration(totalSeconds: number): string {
    if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
        return '0:00';
    }

    const seconds = Math.floor(totalSeconds % 60);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const minutes = totalMinutes % 60;
    const hours = Math.floor(totalMinutes / 60);

    const paddedSeconds = seconds.toString().padStart(2, '0');

    if (hours > 0) {
        const paddedMinutes = minutes.toString().padStart(2, '0');
        return `${hours}:${paddedMinutes}:${paddedSeconds}`;
    }

    return `${minutes}:${paddedSeconds}`;
}

/**
 * 현재 시각을 기준으로 상대적인 짧은 타임스탬프 문자열을 만든다 (로그/디버그용).
 */
export function nowLabel(): string {
    return new Date().toLocaleTimeString('ko-KR', { hour12: false });
}
