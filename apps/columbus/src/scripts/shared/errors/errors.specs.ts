import { failureMessage, messageFromError } from './errors';

describe('messageFromError', () => {
  it('should use the error message when given an Error', () => {
    expect(messageFromError(new Error('Boom'))).toBe('Boom');
  });

  it('should stringify the value when given a non-Error', () => {
    expect(messageFromError(404)).toBe('404');
  });
});

describe('failureMessage', () => {
  it('should describe the operation, detail, and suggested action when all are given', () => {
    expect(
      failureMessage(new Error('Tab gone.'), 'read the host', 'Retry.'),
    ).toBe(
      'Columbus could not read the host: Tab gone. Suggested action: Retry.',
    );
  });

  it('should strip a nested suggested action when the detail already has one', () => {
    expect(
      failureMessage(
        new Error('Tab gone. Suggested action: Old advice.'),
        'read',
        'New.',
      ),
    ).toBe('Columbus could not read: Tab gone. Suggested action: New.');
  });

  it('should use generic wording when only the error is given', () => {
    expect(failureMessage('oops')).toBe(
      'Columbus could not complete the requested action: oops Suggested action: Reload the Atlas host page, reopen Columbus, and retry.',
    );
  });
});
