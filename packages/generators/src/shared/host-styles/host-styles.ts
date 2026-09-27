export function renderAtlasHostStyles(): string {
  return `body {
  margin: 0;
  font-family: system-ui, sans-serif;
}

atlas-navigation {
  display: flex;
  gap: 1rem;
  padding: 1rem;
}

atlas-route-outlet {
  padding: 1rem;
}

[data-atlas-status][role='alert'] {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  border: 1px solid #b8bec7;
}
`;
}
