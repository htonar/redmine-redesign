import type { Project } from "@/hooks/useProjects";

export interface FlatProject {
  project: Project;
  depth: number;
}

/**
 * Разворачивает плоский список проектов в иерархический порядок (родитель, за
 * ним его дети, и т.д.) с глубиной вложенности для отступов в селекторе
 * (issue #63). Проект, чей родитель не входит в список (нет прав / не
 * загружен), считается корневым. Порядок внутри уровня - как пришёл с API.
 * Циклы (теоретически невозможные в Redmine) не зациклят - каждый проект
 * посещается один раз.
 */
export function orderProjectsHierarchically(projects: Project[]): FlatProject[] {
  const ids = new Set(projects.map((p) => p.id));
  const childrenOf = new Map<number | null, Project[]>();
  for (const p of projects) {
    const key = p.parentId != null && ids.has(p.parentId) ? p.parentId : null;
    const list = childrenOf.get(key) ?? [];
    list.push(p);
    childrenOf.set(key, list);
  }

  const result: FlatProject[] = [];
  const visited = new Set<number>();

  const walk = (parentKey: number | null, depth: number) => {
    for (const project of childrenOf.get(parentKey) ?? []) {
      if (visited.has(project.id)) continue;
      visited.add(project.id);
      result.push({ project, depth });
      walk(project.id, depth + 1);
    }
  };

  walk(null, 0);

  // Подстраховка: проекты, не попавшие в обход (осиротевшие цепочки), - в конец.
  for (const p of projects) {
    if (!visited.has(p.id)) result.push({ project: p, depth: 0 });
  }

  return result;
}

/** Совпадение по подстроке, регистронезависимо, с учётом пробелов по краям. */
export function projectMatchesQuery(name: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return name.toLowerCase().includes(q);
}
