import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
    prettier,
    {
        // 검사할 파일 확장자 지정 (.ts 파일 대상)
        files: ['**/*.ts'],
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                project: './tsconfig.json', // TS 설정 연동
            },
        },
        rules: {
            // 🧹 공백 및 스타일 관련 엄격한 규칙
            'no-trailing-spaces': 'error', // 줄 끝에 붙은 의미 없는 공백 제거
            'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0, maxBOF: 0 }], // 연속된 빈 줄은 무조건 1줄만 허용
            'eol-last': ['error', 'always'], // 파일의 가장 마지막은 항상 한 줄 비우기

            // 🛠️ TypeScript 권장 규칙
            '@typescript-eslint/no-explicit-any': 'warn',
            '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
            'no-console': 'off', // 디스코드 봇 로그 출력을 위해 콘솔 허용
        },
    }
);