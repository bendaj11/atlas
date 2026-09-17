export interface HelpEntry {
  label: string;
  description: string;
}

export interface CommandHelp {
  summary: string;
  usage: string;
  arguments?: readonly HelpEntry[];
  options?: readonly HelpEntry[];
  advancedOptions?: readonly HelpEntry[];
  environment?: readonly HelpEntry[];
  examples: readonly string[];
}
