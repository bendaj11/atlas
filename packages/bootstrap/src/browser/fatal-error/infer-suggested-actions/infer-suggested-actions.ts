export function inferSuggestedActionsFromMessage(message: string): string[] {
  if (/override/i.test(message))
    return [
      'Select Clear overrides and reload below.',
      'If the page then works, correct or disable the invalid override in Columbus before enabling it again.',
    ];

  if (/integrity|HTTPS|origin|assetOrigins|loopback|protocol/i.test(message)) {
    return [
      'Verify atlas.runtime.json registry origins and the selected host remote-entry URL.',
      'Publish the host client from an approved HTTPS origin with matching SHA-256 integrity, then reload.',
    ];
  }

  if (/host root|mount/i.test(message))
    return [
      'Verify the bootstrap page contains #atlas-host-root and the selected host client exports mount(request).',
      'Rebuild and redeploy the host bootstrap and host client, then reload.',
    ];

  if (
    /catalog|bootstrap|discovery|runtime|JSON|schemaVersion|host client|manifest|expose|loader API|shared dependency/i.test(
      message,
    )
  ) {
    return [
      'Verify /atlas.runtime.json and the selected environment manifest return valid Atlas JSON.',
      'Publish a host client compatible with this Atlas loader, then reload.',
    ];
  }

  if (/fetch|HTTP|network|timed out|abort/i.test(message)) {
    return [
      'Open the failed URL from the error details and verify it is reachable.',
      'Correct the deployment, authentication, or CORS policy, then reload.',
    ];
  }

  return [
    'Inspect the preserved cause in the browser console for the first failing URL or configuration value.',
    'Correct the deployed host configuration or artifact, then reload.',
  ];
}
