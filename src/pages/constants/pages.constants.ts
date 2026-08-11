import { ProjectRole } from 'src/projects/enums/project.enums';

export enum PermanentDeleteChildrenStrategy {
  DELETE_SUBTREE = 'DELETE_SUBTREE',
  MOVE_CHILDREN_TO_PARENT = 'MOVE_CHILDREN_TO_PARENT',
  MAKE_CHILDREN_ROOT = 'MAKE_CHILDREN_ROOT',
}

export const PAGE_WRITE_ROLES: ProjectRole[] = [
  ProjectRole.OWNER,
  ProjectRole.EDITOR,
];
