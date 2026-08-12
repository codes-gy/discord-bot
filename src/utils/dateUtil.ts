/**
 * 유효한 Date 객체인지 확인합니다.
 * @returns {boolean} 유효한 Date 객체이면 true
 * @param value
 */
export function isValidDate(value: unknown): value is Date {
    // date가 Date 인스턴스이고, getTime() 결과가 NaN이 아니어야 합니다.
    return value instanceof Date && !Number.isNaN(value.getTime());
}

/**
 * 주어진 값을 안전하게 Date 객체로 변환합니다.
 * 변환에 실패하면 null 반환합니다.
 * @param {*} value - 변환할 값 (Date 객체, 타임스탬프, 날짜 문자열 등)
 * @returns {Date | null} 변환된 Date 객체 또는 null
 */

export function safeDate(value: unknown): Date | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'string' && value.trim().length === 0) return null;
    if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    return isValidDate(date) ? date : null;
}

/**
 * 현재 시간을 ISO 8601 형식 문자열로 반환합니다. (예: "2023-12-17T02:51:00.000Z")
 * @returns {string} ISO 8601 형식의 현재 시간 문자열
 */
export function getNowISOString(): string {
    return new Date().toISOString();
}

/**
 * 날짜를 'YYYY-MM-DD' 형식의 문자열로 포맷합니다.
 * @param {*} value - 포맷할 날짜 값
 * @returns {string | null} 포맷된 문자열 (유효하지 않으면 null)
 */
export function formatDate(value: unknown): string | null {
    const date = safeDate(value);
    if (!date) return null;

    const year = date.getFullYear();
    // 월과 일은 두 자리로 맞춥니다 (padStart 사용).
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

/**
 * 날짜와 시간을 'YYYY-MM-DD HH:mm:ss' 형식의 문자열로 포맷합니다.
 * @param {*} value - 포맷할 날짜 값
 * @returns {string | null} 포맷된 문자열 (유효하지 않으면 null)
 */
export function formatDateTime(value: unknown): string | null {
    const date = safeDate(value);
    if (!date) return null;

    const datePart = formatDate(date);

    // 시, 분, 초를 두 자리로 맞춥니다.
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${datePart} ${hours}:${minutes}:${seconds}`;
}

/**
 * 두 날짜 사이의 차이를 일(Day) 단위로 계산합니다.
 * @param {*} startDate - 시작 날짜 값
 * @param {*} endDate - 종료 날짜 값
 * @returns {number | null} 두 날짜 사이의 일 수 (종료일 - 시작일), 유효하지 않으면 null
 */
export function diffInDays(startDate: unknown, endDate: unknown): number | null {
    const start = safeDate(startDate);
    const end = safeDate(endDate);

    if (!start || !end) return null;

    // getTime()은 밀리초 단위 타임스탬프를 반환합니다.
    const timeDifference = end.getTime() - start.getTime();

    // 밀리초를 일(Day)로 변환합니다. (1000ms * 60s * 60min * 24hr)
    const oneDay = 1000 * 60 * 60 * 24;

    // 반올림을 사용하여 정확한 일 수를 얻습니다.
    return Math.round(timeDifference / oneDay);
}
