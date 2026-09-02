export const ERROR_MESSAGES = {
  // Auth
  UNAUTHORIZED: 'Unauthorized',
  FORBIDDEN: 'Forbidden',
  INVALID_CREDENTIALS: 'Invalid email or password',
  SESSION_EXPIRED: 'Session expired',
  SESSION_NOT_FOUND: 'Session not found',
  SESSION_WAS_REVOKED: 'Session was revoked',
  INVALID_REFRESH_TOKEN: 'Invalid refresh token',
  REFRESH_TOKEN_IS_MISSING: 'Refresh token is missing',
  ACCESS_TOKEN_IS_MISSING: 'Access token is missing',
  INVALID_SESSION: 'Invalid session',

  // Validation
  VALIDATION_FAILED: 'Validation failed',
  INVALID_FILE_TYPE: 'Invalid file type',
  FILE_TOO_LARGE: 'File too large',
  FAILED_TO_UPLOAD_AVATAR: 'Failed to upload avatar',

  // User
  USER_NOT_FOUND: 'User not found',
  USER_ALREADY_EXISTS: 'User with this email already exists',

  // Workspace
  WORKSPACE_NOT_FOUND: 'Workspace not found',
  WORKSPACE_ACCESS_DENIED: 'You do not have access to this workspace',
  WORKSPACE_INSUFFICIENT_ROLE:
    'You do not have enough permissions in this workspace',
  WORKSPACE_OWNER_CANNOT_LEAVE:
    'Workspace owner cannot leave or be removed. Transfer ownership first',
  WORKSPACE_MEMBER_NOT_FOUND: 'Workspace member not found',
  WORKSPACE_MEMBER_ALREADY_EXISTS:
    'This user is already a member of the workspace',
  WORKSPACE_INVITATION_NOT_FOUND: 'Invitation not found or no longer valid',
  WORKSPACE_INVITATION_EXPIRED: 'Invitation has expired',
  WORKSPACE_INVITATION_EMAIL_MISMATCH:
    'This invitation was issued for a different email',
  WORKSPACE_INVITATION_ALREADY_EXISTS:
    'A pending invitation for this email already exists in the workspace',
  WORKSPACE_INVITATION_ALREADY_ACCEPTED: 'Invitation has already been accepted',
  WORKSPACE_INVITATION_ALREADY_DECLINED: 'Invitation has already been declined',
  WORKSPACE_INVITATION_REVOKED: 'Invitation has been revoked',

  // Project
  PROJECT_NOT_FOUND: 'Project not found',
  PROJECT_ACCESS_DENIED: 'You do not have access to this project',
  PROJECT_INSUFFICIENT_ROLE:
    'You do not have enough permissions in this project',
  PROJECT_MEMBER_NOT_FOUND: 'Project member not found',
  PROJECT_MEMBER_ALREADY_EXISTS: 'This user is already a project member',
  PROJECT_MEMBER_NOT_IN_WORKSPACE:
    'User must be an active member of the workspace to be added to a project',
  PROJECT_OWNER_CANNOT_BE_REMOVED: 'The project owner cannot be removed',

  // Page
  PAGE_NOT_FOUND: 'Page not found',
  PAGE_ACCESS_DENIED: 'You do not have access to this page',
  PAGE_INSUFFICIENT_ROLE:
    'You do not have enough permissions to edit this page',
  PAGE_PARENT_NOT_FOUND: 'Parent page not found in this project',
  PAGE_PARENT_CYCLE_DETECTED:
    'Cannot move page under itself or its descendants',
  PAGE_MUST_BE_ARCHIVED_BEFORE_PERMANENT_DELETE:
    'Page must be archived before permanent deletion',
  PAGE_DELETE_CHILDREN_STRATEGY_REQUIRED:
    'Permanent deletion requires a strategy when page has children',
  PAGE_CONTENT_INVALID: 'Invalid page content',
  TASK_BOARD_INVALID: 'Invalid task board data',
  TASK_BOARD_INVALID_COLOR: 'Invalid task board color',
  TASK_BOARD_INVALID_PRIORITY: 'Invalid task card priority',

  // Attachments
  ATTACHMENT_NOT_FOUND: 'Attachment not found',
  FAILED_TO_UPLOAD_ATTACHMENT: 'Failed to upload attachment',

  // Generic
  INTERNAL_SERVER_ERROR: 'Internal server error',
  RESOURCE_NOT_FOUND: 'Resource not found',
} as const;

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS: 'USER_ALREADY_EXISTS',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  WORKSPACE_ACCESS_DENIED: 'WORKSPACE_ACCESS_DENIED',
  WORKSPACE_INSUFFICIENT_ROLE: 'WORKSPACE_INSUFFICIENT_ROLE',
  PROJECT_NOT_FOUND: 'PROJECT_NOT_FOUND',
  PROJECT_ACCESS_DENIED: 'PROJECT_ACCESS_DENIED',
  PROJECT_INSUFFICIENT_ROLE: 'PROJECT_INSUFFICIENT_ROLE',
  PAGE_NOT_FOUND: 'PAGE_NOT_FOUND',
  PAGE_ACCESS_DENIED: 'PAGE_ACCESS_DENIED',
  PAGE_INSUFFICIENT_ROLE: 'PAGE_INSUFFICIENT_ROLE',
  PAGE_MUST_BE_ARCHIVED_BEFORE_PERMANENT_DELETE:
    'PAGE_MUST_BE_ARCHIVED_BEFORE_PERMANENT_DELETE',
  PAGE_DELETE_CHILDREN_STRATEGY_REQUIRED:
    'PAGE_DELETE_CHILDREN_STRATEGY_REQUIRED',
  ATTACHMENT_NOT_FOUND: 'ATTACHMENT_NOT_FOUND',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;
