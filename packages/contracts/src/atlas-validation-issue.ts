/** One problem found when checking an Atlas JSON object. */
export interface AtlasValidationIssue {
  /** Field location with the problem, such as "manifests.0.id". */
  path: string;
  /** Explanation of what is wrong and what shape Atlas expected. */
  message: string;
}
