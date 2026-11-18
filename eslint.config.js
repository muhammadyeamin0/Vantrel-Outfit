import firebaseRules from '@firebase/eslint-plugin-security-rules';
import * as securityRulesParser from '@firebase/eslint-plugin-security-rules/parser';

export default [
  {
    ignores: ['dist/**/*', 'node_modules/**/*']
  },
  {
    files: ['**/*.rules'],
    languageOptions: {
      parser: securityRulesParser
    },
    plugins: {
      '@firebase/security-rules': firebaseRules
    },
    rules: {
      ...firebaseRules.configs.recommended.rules
    }
  }
];
