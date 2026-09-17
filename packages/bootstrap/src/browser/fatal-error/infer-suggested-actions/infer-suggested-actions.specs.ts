import { inferSuggestedActionsFromMessage } from './infer-suggested-actions.js';

const CASES = [
  ['invalid override', 'Select Clear overrides and reload below.'],
  [
    'failed integrity validation',
    'Verify atlas.runtime.json registry origins and the selected host remote-entry URL.',
  ],
  [
    'host root is missing',
    'Verify the bootstrap page contains #atlas-host-root and the selected host client exports mount(request).',
  ],
  [
    'catalog is malformed',
    'Verify /atlas.runtime.json and the selected environment manifest return valid Atlas JSON.',
  ],
  [
    'fetch timed out',
    'Open the failed URL from the error details and verify it is reachable.',
  ],
  [
    'something else',
    'Inspect the preserved cause in the browser console for the first failing URL or configuration value.',
  ],
];

describe('inferSuggestedActionsFromMessage', () => {
  it.each(CASES)(
    'should suggest actions matching the message when the message is "%s"',
    (message, firstAction) => {
      expect(inferSuggestedActionsFromMessage(message)[0]).toBe(firstAction);
    },
  );
});
