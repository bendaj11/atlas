import { faker } from '@faker-js/faker';
import ts from 'typescript';
import { formatTypeScriptDiagnostics } from './typescript.js';

describe('formatTypeScriptDiagnostics', () => {
  it('should include the diagnostic message when formatted', async () => {
    const messageText = faker.lorem.sentence();
    const diagnostic: ts.Diagnostic = {
      category: ts.DiagnosticCategory.Error,
      code: faker.number.int({ min: 1000, max: 9999 }),
      file: undefined,
      length: undefined,
      messageText,
      start: undefined,
    };

    expect(
      await formatTypeScriptDiagnostics(
        [diagnostic],
        faker.system.directoryPath(),
      ),
    ).toContain(messageText);
  });
});
