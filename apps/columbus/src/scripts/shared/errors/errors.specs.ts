import { faker } from '@faker-js/faker';
import { failureMessage, messageFromError } from './errors';

describe('messageFromError', () => {
  it('should use the error message when given an Error', () => {
    const message = faker.lorem.sentence();

    expect(messageFromError(new Error(message))).toBe(message);
  });

  it('should stringify the value when given a non-Error', () => {
    const status = faker.number.int();

    expect(messageFromError(status)).toBe(String(status));
  });
});

describe('failureMessage', () => {
  it('should use generic wording when only the error is given', () => {
    const detail = faker.lorem.sentence();

    expect(failureMessage(new Error(detail))).toBe(
      `Columbus could not complete the requested action: ${detail} Suggested action: Reload the Atlas host page, reopen Columbus, and retry.`,
    );
  });

  it('should describe operation, detail, and action when all are given', () => {
    const detail = faker.lorem.sentence();
    const operation = faker.lorem.words();
    const suggestedAction = faker.lorem.sentence();

    expect(failureMessage(new Error(detail), operation, suggestedAction)).toBe(
      `Columbus could not ${operation}: ${detail} Suggested action: ${suggestedAction}`,
    );
  });

  it('should strip the nested suggested action when the detail already has one', () => {
    const detail = faker.lorem.sentence();
    const operation = faker.lorem.words();
    const suggestedAction = faker.lorem.sentence();

    expect(
      failureMessage(
        new Error(`${detail} Suggested action: ${faker.lorem.sentence()}`),
        operation,
        suggestedAction,
      ),
    ).toBe(
      `Columbus could not ${operation}: ${detail} Suggested action: ${suggestedAction}`,
    );
  });
});
