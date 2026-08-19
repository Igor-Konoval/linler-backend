export enum ProjectRole {
  OWNER = 'OWNER',
  EDITOR = 'EDITOR',
  VIEWER = 'VIEWER',
}

export enum ProjectVisibility {
  PRIVATE = 'PRIVATE',
  WORKSPACE = 'WORKSPACE',
}

export const ASSIGNABLE_ROLES = [
  ProjectRole.EDITOR,
  ProjectRole.VIEWER,
] as const;
